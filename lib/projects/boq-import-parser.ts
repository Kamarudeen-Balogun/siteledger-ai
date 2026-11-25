import "server-only";
import { parse } from "csv-parse/sync";
import readXlsxFile from "read-excel-file/node";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import { Open } from "unzipper-esm";
import { MAX_FILE_BYTES, type ImportSheet } from "./boq-input";

function boundedRows(rows: unknown[][]): string[][] {
  if (rows.length > 1000) throw new Error("Keep each sheet to 1,000 rows or fewer. You can import up to 200 items at a time.");
  return rows.map(row => {
    if (row.length > 50) throw new Error("Keep the sheet to 50 columns or fewer.");
    return row.map(cell => {
      if (cell instanceof Date || typeof cell === "boolean") return "[Enter a text or decimal value]";
      const value = cell == null ? "" : String(cell);
      if (value.length > 2000) throw new Error("A cell is too long. Keep text cells below 2,000 characters.");
      return value;
    });
  });
}
export async function parseBoqFile(name: string, bytes: Uint8Array): Promise<ImportSheet[]> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error("Choose a non-empty CSV or XLSX file up to 2 MB.");
  if (name.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let count = 0;
    const rows = parse(text, { bom: true, relax_column_count: true, max_record_size: 10000, on_record(record: string[]) {
      if (++count > 1000) throw new Error("Keep each sheet to 1,000 rows or fewer.");
      if (record.length > 50) throw new Error("Keep the sheet to 50 columns or fewer.");
      return record;
    } }) as string[][];
    return [{ name: "CSV", rows: boundedRows(rows) }];
  }
  if (!name.toLowerCase().endsWith(".xlsx")) throw new Error("Use CSV or XLSX. Other document formats are not supported.");
  // Bound ZIP entries before inflation; then repackage bounded bytes for the
  // spreadsheet reader so it never inflates arbitrary original ZIP streams.
  let size = 0, entries = 0;
  unzipSync(bytes, { filter(entry) {
    size += entry.originalSize; entries++;
    if (entries > 200 || size > 8 * 1024 * 1024 || entry.originalSize > 4 * 1024 * 1024) throw new Error("This spreadsheet is too large when opened. Export a smaller BoQ.");
    if (entry.name.includes("..") || /vbaProject|externalLinks/i.test(entry.name)) throw new Error("Export a workbook without macros or external links.");
    return false;
  } });
  const archive = await Open.buffer(Buffer.from(bytes));
  const files: Record<string, Uint8Array> = Object.create(null);
  let actualSize = 0;
  for (const entry of archive.files) {
    if (!entry.path.endsWith(".xml") && !entry.path.endsWith(".rels")) continue;
    const stream = entry.stream(), parts: Buffer[] = []; let entrySize = 0;
    try {
      for await (const chunk of stream) {
        const part = Buffer.from(chunk); entrySize += part.length; actualSize += part.length;
        if (entrySize > 4 * 1024 * 1024 || actualSize > 8 * 1024 * 1024) throw new Error("This spreadsheet is too large when opened. Export a smaller BoQ.");
        parts.push(part);
      }
    } finally { stream.destroy(); }
    files[entry.path] = Buffer.concat(parts);
  }
  if (!files["xl/workbook.xml"]) throw new Error("This file is not a valid XLSX workbook.");
  if (Object.keys(files).filter(path => /^xl\/worksheets\/[^/]+\.xml$/.test(path)).length > 10) throw new Error("Keep the workbook to 10 sheets or fewer.");
  for (const [path, content] of Object.entries(files)) {
    const xml = strFromU8(content);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Export a standard XLSX workbook without XML entities.");
    if (!path.startsWith("xl/worksheets/")) continue;
    if (/<(?:\w+:)?f(?:\s|>)/.test(xml)) throw new Error("Convert spreadsheet formulas to values before importing. Rates and quantities must be supplied values.");
    // Sparse extreme coordinates must not make the reader allocate a huge grid.
    for (const match of xml.matchAll(/\b(?:r|ref)=["']([A-Z]+)([0-9]+)(?::([A-Z]+)([0-9]+))?["']/g)) {
      for (const [column, row] of [[match[1], match[2]], [match[3], match[4]]]) {
        if (!column) continue;
        const index = [...column].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0);
        if (index > 50 || Number(row) > 1000) throw new Error("Keep each sheet within 50 columns and 1,000 rows.");
      }
    }
    for (const match of xml.matchAll(/<(?:\w+:)?row\b[^>]*\br=["'](\d+)["']/g)) if (Number(match[1]) > 1000) throw new Error("Keep each sheet within 1,000 rows.");
    if ((xml.match(/<(?:\w+:)?c\b/g) ?? []).length > 50000) throw new Error("Keep each sheet within 50 columns and 1,000 rows.");
  }
  const data = await readXlsxFile(Buffer.from(zipSync(files)), { parseNumber: value => value });
  if (data.length > 10) throw new Error("Keep the workbook to 10 sheets or fewer.");
  return data.map(sheet => ({ name: sheet.sheet, rows: boundedRows(sheet.data) }));
}
