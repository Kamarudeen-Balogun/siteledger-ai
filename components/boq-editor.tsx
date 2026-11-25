"use client";
import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/costing/format-money";
import { displayUnit } from "@/lib/reports/model";
import { boqUnits, type BoqRow } from "@/lib/projects/boq-types";
import { importFields, importLabels, inputErrors, nextBoqCode, reviewedItem, type ImportField, type ImportValues } from "@/lib/projects/boq-input";
import { StartProjectNote } from "./project-forms";
import { useActionConfirmation } from "./action-confirmation";
const BoqImporter = dynamic(() => import("./boq-importer"), { loading: () => <p role="status">Opening import…</p>, ssr: false });
const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
const button = "work-button";
export function BoqEditor({ projectId, currency, rows, editable }: { projectId: string; currency: string; rows: BoqRow[]; editable: boolean }) {
  const router = useRouter(), { confirm, confirmation } = useActionConfirmation();
  const [selected, setSelected] = useState<BoqRow | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [newId, setNewId] = useState(""), [code, setCode] = useState(""), [dirty,setDirty]=useState(false), [details,setDetails]=useState(false), [importing,setImporting]=useState(false);
  const [errors,setErrors]=useState<Partial<Record<ImportField,string>>>({});
  async function discard() { return !dirty || await confirm({title:"Discard these BoQ edits?",description:"Your changes have not been saved. The existing BoQ is preserved.",confirmLabel:"Discard edits",danger:true}); }
  async function edit(row: BoqRow | null) { if(!await discard())return; setSelected(row); setOpen(true); setError(""); setErrors({}); setMessage(""); setNewId(crypto.randomUUID()); setCode(row?.item_code??nextBoqCode(rows));setDirty(false);setDetails(false); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(importFields.map(key => [key, String(form.get(key) ?? "")])) as ImportValues;
    const invalid=inputErrors(values);if(Object.keys(invalid).length){setErrors(invalid);if(invalid.item_code||invalid.section)setDetails(true);event.currentTarget.querySelector<HTMLInputElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus();return;}
    const item = reviewedItem(values,selected?.id??newId,selected?.revision??null,code);if(!item)return;
    if (!await confirm({ title: selected ? "Save these BoQ changes?" : "Add this supplied BoQ item?", description: "New and rebuilt drafts will use these quantities and rates. Saved drafts may need costing again. Approved reports keep their original amounts.", confirmLabel: "Save BoQ item", detail: <><p className="font-semibold">{item.description}</p><p>{item.boq_quantity} {displayUnit(item.unit)} · {formatMoney(item.rate, currency)} {currency} per {displayUnit(item.unit)}</p></> })) return;
    setBusy(true); setError("");setErrors({});
    try { const response = await fetch("/api/projects/boq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, item }), cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save this item."); setOpen(false);setDirty(false); setMessage("BoQ item saved."); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save this item."); } finally { setBusy(false); }
  }
  function errorFor(key: ImportField) {return errors[key]&&<span id={`boq-${key}-error`} className="mt-2 block text-sm leading-6 text-red-800">{errors[key]}</span>;}
  function input(key: ImportField,placeholder?:string) {return <><input className={field} name={key} id={`boq-${key}`} aria-label={key==="rate"?`Rate per unit (${currency})`:importLabels[key]} maxLength={key==="rate"?50:200} inputMode={key==="rate"||key==="boq_quantity"?"decimal":undefined} required={key!=="item_code"&&key!=="section"} placeholder={placeholder} defaultValue={selected?.[key]??(key==="item_code"?code:key==="section"?"General":"")} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`boq-${key}-error`:undefined}/>{errorFor(key)}</>;}
  return <section className="my-8">{confirmation}
    {editable && !open && !importing && !message && <div className="flex flex-wrap gap-3"><button type="button" className={button+" work-button-primary"} disabled={busy} onClick={() => edit(null)}>Add BoQ item</button><button type="button" className={button} onClick={()=>{setImporting(true);setMessage("");}}>Import CSV / XLSX</button></div>}
    {message && <div className="my-5 border-l-4 border-accent pl-4"><p role="status" className="leading-7">{message}</p>{editable&&<div className="mt-4 flex flex-wrap gap-3"><StartProjectNote id={projectId}/><button type="button" className={button} onClick={()=>edit(null)}>Add another item</button><button type="button" className={button} onClick={()=>{setImporting(true);setMessage("");}}>Import CSV / XLSX</button></div>}</div>}
    {importing&&editable&&<BoqImporter projectId={projectId} currency={currency} existing={rows} close={()=>setImporting(false)} saved={message=>{setMessage(message);setImporting(false);}}/>}
    {open && editable && <form key={selected?.id ?? newId} onSubmit={save} noValidate onChange={()=>setDirty(true)} data-unsaved={dirty||undefined} className="my-7 max-w-3xl border-y border-rule py-7"><h2 className="font-serif text-2xl">{selected ? "Edit BoQ item" : "Add a work item"}</h2><div className="grid gap-x-6 sm:grid-cols-2">
      <label className="mt-5 block sm:col-span-2" htmlFor="boq-description">Work description{input("description","e.g. 225 mm blockwork")}</label>
      <label className="mt-5 block">Measurement unit<select className={field} name="unit" defaultValue={selected?.unit ?? "m2"} disabled={selected?.used}>{boqUnits.map(unit => <option key={unit} value={unit}>{displayUnit(unit)} · {({m2:"area",m3:"volume",tonne:"weight",point:"count",day:"time"})[unit]}</option>)}</select>{selected?.used && <><input type="hidden" name="unit" value={selected.unit} /><span className="mt-2 block text-sm leading-6">Fixed because this unit is used in confirmed work.</span></>}{errorFor("unit")}</label>
      <label className="mt-5 block" htmlFor="boq-boq_quantity">Total planned quantity{input("boq_quantity","e.g. 420")}<span className="mt-2 block text-sm leading-6">The full quantity planned for this item.</span></label>
      <label className="mt-5 block sm:col-span-2" htmlFor="boq-rate">Rate per unit ({currency}){input("rate","Your supplied rate")}<span className="mt-2 block text-sm leading-6">Use your QS-verified rate. Commas can group thousands; use a dot for decimals.</span></label>
    </div><details className="mt-6 border-t border-rule pt-4" open={details} onToggle={event=>setDetails(event.currentTarget.open)}><summary className="min-h-12 cursor-pointer">Optional details · code and section</summary><div className="grid gap-x-6 sm:grid-cols-2"><label className="mt-4 block" htmlFor="boq-item_code">Item code{input("item_code")}</label><label className="mt-4 block" htmlFor="boq-section">Section{input("section")}</label></div><p className="mt-3 text-sm leading-6">We generate a reference code and use General unless you choose your own.</p></details>
      {error && <p role="alert" className="my-5 border-l-4 border-amber-700 p-4 text-amber-900">{error}</p>}<div className="mt-6 flex flex-wrap gap-3"><button className={button + " work-button-primary"} disabled={busy}>{busy ? "Saving…" : "Review and save"}</button><button type="button" className={button} disabled={busy} onClick={async()=>{if(await discard()){setOpen(false);setDirty(false);}}}>Cancel editing</button></div></form>}
    {!rows.length ? <p className="my-7 leading-7">No BoQ items yet. You can record a site note while prices are being prepared.</p> : <div className="mt-7" role="region" aria-label="Supplied BoQ price list"><table className="ledger-table boq-table"><thead><tr><th scope="col">Work item</th><th scope="col">Unit</th><th scope="col">Planned quantity</th><th scope="col">Rate ({currency})</th>{editable && <th scope="col">Action</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row"><span className="font-semibold">{row.description}</span><span className="eyebrow mt-1 block">{row.section} / {row.item_code}</span></th><td data-label="Unit">{displayUnit(row.unit)}</td><td data-label="Planned quantity">{row.boq_quantity}</td><td data-label={`Rate (${currency})`}>{formatMoney(row.rate, currency)}</td>{editable && <td><button type="button" className={button} disabled={busy||importing} onClick={() => edit(row)} aria-label={`Edit ${row.item_code}`}>Edit item</button></td>}</tr>)}</tbody></table></div>}
  </section>;
}
