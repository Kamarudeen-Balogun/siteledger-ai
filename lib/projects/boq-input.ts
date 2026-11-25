import { boqUnits, validBoqEdit, type BoqEdit, type BoqRow } from "./boq-types";
import { projectText } from "./types";

export const importFields = ["description", "unit", "boq_quantity", "rate", "item_code", "section"] as const;
export type ImportField = typeof importFields[number];
export type ImportValues = Record<ImportField, string>;
export const importLabels: Record<ImportField, string> = { description: "Work description", unit: "Measurement unit", boq_quantity: "Total planned quantity", rate: "Rate per unit", item_code: "Item code (optional)", section: "Section (optional)" };
export type ImportSheet = { name: string; rows: string[][] };
export const MAX_IMPORT_ROWS = 200;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Accept conventional comma grouping without guessing a decimal separator.
// Keep all values as decimal strings, including foreign-currency rates.
export function suppliedDecimal(value: string): string | null {
  const text = value.trim();
  if (/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/.test(text)) return text.replaceAll(",", "");
  return null;
}
export function nextBoqCode(rows: Pick<BoqRow, "item_code">[], reserved: string[] = []): string {
  const used = new Set([...rows.map(row => row.item_code), ...reserved]);
  let index = 1; while (used.has(`ITEM-${String(index).padStart(3, "0")}`)) index++;
  return `ITEM-${String(index).padStart(3, "0")}`;
}
export function inputErrors(values: ImportValues): Partial<Record<ImportField, string>> {
  const errors: Partial<Record<ImportField, string>> = {};
  if (!projectText(values.description)) errors.description = "Enter a work description (1–200 characters).";
  if (!boqUnits.includes(values.unit as BoqRow["unit"])) errors.unit = "Choose m², m³, tonne, point or day.";
  const quantity = suppliedDecimal(values.boq_quantity);
  if (!quantity || !/^[0-9]{1,10}(\.[0-9]{1,4})?$/.test(quantity) || !/[1-9]/.test(quantity) || Number(quantity) >= 10000000000) errors.boq_quantity = "Enter a positive quantity below 10 billion, with up to four decimal places.";
  const rate = suppliedDecimal(values.rate);
  if (!rate || rate.length > 40) errors.rate = "Enter the supplied rate, such as 14,500 or 0.123. Use a dot for decimals.";
  for (const key of ["item_code", "section"] as const) if (values[key].trim() && !projectText(values[key])) errors[key] = "Use 1–200 characters without control characters.";
  return errors;
}
export function reviewedItem(values: ImportValues, id: string, revision: string | null, fallbackCode: string): BoqEdit | null {
  if (Object.keys(inputErrors(values)).length) return null;
  const item = { id, revision, description: values.description.trim(), unit: values.unit as BoqRow["unit"], boq_quantity: suppliedDecimal(values.boq_quantity)!, rate: suppliedDecimal(values.rate)!, item_code: values.item_code.trim() || fallbackCode, section: values.section.trim() || "General" };
  return validBoqEdit(item) ? item : null;
}
export function suggestedMapping(headers: string[]): Record<ImportField, number> {
  const aliases: Record<ImportField, string[]> = { description: ["description", "work description", "work item", "item description"], unit: ["unit", "measurement unit", "uom"], boq_quantity: ["quantity", "qty", "boq quantity", "total planned quantity"], rate: ["rate", "unit rate", "rate per unit", "price"], item_code: ["code", "item code"], section: ["section", "trade"] };
  return Object.fromEntries(importFields.map(key => [key, headers.findIndex(value => aliases[key].includes(value.trim().toLowerCase()))])) as Record<ImportField, number>;
}
