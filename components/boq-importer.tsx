"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { displayUnit } from "@/lib/reports/model";
import { boqUnits, type BoqRow } from "@/lib/projects/boq-types";
import { importFields, importLabels, inputErrors, MAX_IMPORT_ROWS, nextBoqCode, reviewedItem, suggestedMapping, type ImportField, type ImportSheet, type ImportValues } from "@/lib/projects/boq-input";
import { useActionConfirmation } from "./action-confirmation";
const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
type PreviewRow = { id: string; sourceRow: number; values: ImportValues };
async function post(path: string, input: object) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Import could not finish."); return result;
}
export default function BoqImporter({ projectId, currency, existing, close, saved }: { projectId: string; currency: string; existing: BoqRow[]; close: () => void; saved: (message: string) => void }) {
  const router = useRouter(), { confirm, confirmation } = useActionConfirmation();
  const [sheets, setSheets] = useState<ImportSheet[]>([]), [sheetIndex, setSheetIndex] = useState(0), [header, setHeader] = useState(0);
  const [mapping, setMapping] = useState<Record<ImportField, number>>(suggestedMapping([]));
  const [preview, setPreview] = useState<PreviewRow[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sheet = sheets[sheetIndex], headers = sheet?.rows[header] ?? [];
  function chooseSheet(index: number, row: number) { setSheetIndex(index); setHeader(row); setMapping(suggestedMapping(sheets[index]?.rows[row] ?? [])); }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) { setError("Choose a BoQ file up to 2 MB."); return; }
    setBusy(true); setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Could not read this file.")); reader.readAsDataURL(file); });
      const result = await post("/api/projects/boq/import", { project_id: projectId, name: file.name, data });
      setSheets(result.sheets); setSheetIndex(0); setHeader(0); setMapping(suggestedMapping(result.sheets[0]?.rows[0] ?? []));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not read this file."); } finally { setBusy(false); }
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const required = importFields.slice(0, 4);
    if (required.some(key => mapping[key] < 0) || new Set(importFields.map(key => mapping[key]).filter(value => value >= 0)).size !== importFields.filter(key => mapping[key] >= 0).length) { setError("Choose a different column for each field. Description, unit, quantity and rate are required."); return; }
    const source = sheet.rows.map((cells, index) => ({ cells, index })).filter(row => row.index > header && row.cells.some(value => value.trim()));
    if (!source.length || source.length > MAX_IMPORT_ROWS) { setError("Choose a sheet with 1–200 work-item rows after the header. Split larger BoQs into smaller files."); return; }
    const reserved = source.map(row => row.cells[mapping.item_code] ?? "");
    const rows = source.map(row => {
      const values = Object.fromEntries(importFields.map(key => [key, row.cells[mapping[key]] ?? ""])) as ImportValues;
      if (!values.item_code.trim()) { values.item_code = nextBoqCode(existing, reserved); reserved.push(values.item_code); }
      if (!values.section.trim()) values.section = "General";
      if (values.unit === "m²") values.unit = "m2"; if (values.unit === "m³") values.unit = "m3";
      return { id: crypto.randomUUID(), sourceRow: row.index + 1, values };
    });
    setPreview(rows);
  }
  function errorsFor(row: PreviewRow) {
    const errors = inputErrors(row.values), code = row.values.item_code.trim();
    if (existing.some(item => item.item_code === code)) errors.item_code = "This code already exists. Edit that item in the BoQ or use a new code.";
    if (preview?.some(item => item.id !== row.id && item.values.item_code.trim() === code)) errors.item_code = "Each imported item needs a unique code.";
    return errors;
  }
  const invalid = preview?.filter(row => Object.keys(errorsFor(row)).length).length ?? 0;
  async function save() {
    if (!preview?.length || invalid) return;
    const items = preview.map(row => reviewedItem(row.values, row.id, null, row.values.item_code));
    if (items.some(item => !item)) return;
    if (!await confirm({ title: `Import ${items.length} BoQ items?`, description: `Save the reviewed quantities and rates in ${currency}. New and rebuilt drafts use these values. Approved reports retain their original amounts.`, confirmLabel: "Confirm import", detail: <p>{sheet.name} · {items.length} new items · No existing items replaced</p> })) return;
    setBusy(true); setError("");
    try { const result = await post("/api/projects/boq/import/confirm", { project_id: projectId, items, confirmed: true }); saved(result.already_saved ? "This import is already saved." : `${result.saved} BoQ item${result.saved===1?"":"s"} imported.`); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save this import."); } finally { setBusy(false); }
  }
  async function cancel() { if (!preview || await confirm({title:"Discard this import preview?",description:"These rows have not been saved. Your existing BoQ stays available.",confirmLabel:"Discard preview",danger:true})) close(); }
  return <section className="boq-import my-7 border-y border-rule py-7" data-unsaved={Boolean(preview) || undefined}>{confirmation}<h2 className="font-serif text-2xl">Import your BoQ</h2>
    <p className="mt-3 leading-7">CSV, Excel, PDF, Word, text or photo · up to 2 MB. <a href="/boq-import-template.csv" download className="text-link">Download the column template</a></p>
    {!preview && <form onSubmit={upload} className="my-5 max-w-xl"><label className="block">BoQ file<input className={field} name="file" type="file" accept=".csv,.xlsx,.xls,.pdf,.docx,.txt,.jpeg,.jpg,.png,.webp" required disabled={busy}/></label><button className="work-button mt-4" disabled={busy}>{busy?"Reading file…":"Read file"}</button></form>}
    {!preview && sheet && <form onSubmit={review} className="my-6 max-w-3xl"><div className="grid gap-5 sm:grid-cols-2"><label>Sheet<select aria-label="Sheet" className={field} value={sheetIndex} onChange={event=>chooseSheet(Number(event.target.value),0)}>{sheets.map((item,index)=><option key={index} value={index}>{item.name}</option>)}</select></label><label>Header row<select aria-label="Header row" className={field} value={header} onChange={event=>chooseSheet(sheetIndex,Number(event.target.value))}>{sheet.rows.slice(0,20).map((row,index)=><option key={index} value={index}>Row {index+1} · {row.slice(0,2).join(" / ").slice(0,70)}</option>)}</select></label></div><p className="my-5">Match your columns to these fields.</p><div className="grid gap-5 sm:grid-cols-2">{importFields.map(key=><label key={key}>{importLabels[key]}<select aria-label={importLabels[key]} className={field} value={mapping[key]} onChange={event=>setMapping(previous=>({...previous,[key]:Number(event.target.value)}))}><option value={-1}>{key==="section"||key==="item_code"?"Generate automatically":"Choose column"}</option>{headers.map((title,index)=><option key={index} value={index}>Column {index+1} · {title || "Untitled"}</option>)}</select></label>)}</div><button className="work-button work-button-primary mt-5" disabled={busy}>Review rows</button></form>}
    {preview && <><p className="my-5" role="status">{preview.length} items to import in {currency}. {invalid?`${invalid} rows need correction.`:"All rows are ready for review."}</p>
      <details className="work-disclosure" data-tour="boq-review"><summary>{invalid?"Action required":"Review supplied rates"}</summary><div className="work-disclosure-body">{invalid?<ul className="diary-list">{preview.flatMap(row=>Object.entries(errorsFor(row)).map(([key,warning])=><li key={`${row.id}-${key}`}><a href={`#${row.id}-${key}`} onClick={event=>{event.preventDefault();const input=document.getElementById(`${row.id}-${key}`);input?.scrollIntoView({block:"center"});input?.focus({preventScroll:true});}}><span><strong>Row {row.sourceRow} · {importLabels[key as ImportField]}</strong><small>{warning}</small></span><span>Fix</span></a></li>))}</ul>:<p>Compare the quantities and rates with the supplied BoQ before saving.</p>}</div></details>
      <ol className="import-rows">{preview.map(row=>{const errors=errorsFor(row);return <li key={row.id} className="border-t border-rule py-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">File row {row.sourceRow}</h3><button className="work-button" disabled={busy} onClick={()=>setPreview(current=>current!.filter(item=>item.id!==row.id))}>Exclude row {row.sourceRow}</button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{importFields.map(key=>{const id=`${row.id}-${key}`;return <label key={key} htmlFor={id} className="mt-2">{importLabels[key]}{key==="unit"?<select id={id} aria-label={importLabels[key]} className={field} value={row.values[key]} disabled={busy} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`${id}-error`:undefined} onChange={event=>setPreview(current=>current!.map(item=>item.id===row.id?{...item,values:{...item.values,[key]:event.target.value}}:item))}>{!boqUnits.includes(row.values.unit as BoqRow["unit"])&&<option value={row.values.unit}>Unrecognized: {row.values.unit || "empty"}</option>}{boqUnits.map(unit=><option key={unit} value={unit}>{displayUnit(unit)}</option>)}</select>:<input id={id} aria-label={importLabels[key]} className={field} value={row.values[key]} inputMode={key==="rate"||key==="boq_quantity"?"decimal":undefined} disabled={busy} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`${id}-error`:undefined} onChange={event=>setPreview(current=>current!.map(item=>item.id===row.id?{...item,values:{...item.values,[key]:event.target.value}}:item))}/>} {errors[key]&&<span id={`${id}-error`} className="mt-2 block text-sm text-red-800">{errors[key]}</span>}</label>;})}</div></li>;})}</ol><button className="work-button work-button-primary mt-5" disabled={busy||Boolean(invalid)||!preview.length} onClick={save}>{busy?"Saving import…":`Save ${preview.length} reviewed item${preview.length===1?"":"s"}`}</button></>}
    {error&&<p role="alert" className="my-5 border-l-4 border-amber-700 p-4 text-amber-900">{error}</p>}<button className="text-link mt-5" disabled={busy} onClick={cancel}>Cancel import</button>
  </section>;
}
