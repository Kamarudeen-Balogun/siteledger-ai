"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/costing/format-money";
import { displayRatio, displayUnit, formatQuantity } from "@/lib/reports/model";
import type { ProjectDashboard } from "@/lib/projects/dashboard";
import { boqUnits, type BoqRow } from "@/lib/projects/boq-types";
import { importFields, importLabels, inputErrors, nextBoqCode, reviewedItem, type ImportField, type ImportValues } from "@/lib/projects/boq-input";
import { DiaryIcon } from "./diary-icon";
import { useActionConfirmation } from "./action-confirmation";
import { projectAction } from "@/lib/projects/client-actions";
import { decimal } from "@/lib/costing/decimal";
import { suppliedDecimal } from "@/lib/projects/boq-input";
const BoqImporter = dynamic(() => import("./boq-importer"), { loading: () => <p role="status">Opening import…</p>, ssr: false });
const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
const button = "work-button";
export function BoqEditor({ projectId, currency, rows, editable, overview }: { projectId: string; currency: string; rows: ProjectDashboard["rows"]; editable: boolean; overview?: ReactNode }) {
  const router = useRouter(), { confirm, confirmation } = useActionConfirmation();
  const [selected, setSelected] = useState<BoqRow | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [newId, setNewId] = useState(""), [code, setCode] = useState(""), [dirty,setDirty]=useState(false), [details,setDetails]=useState(false), [importing,setImporting]=useState(false);
  const [errors,setErrors]=useState<Partial<Record<ImportField,string>>>({});
  const [lineTotal,setLineTotal]=useState<string|null>(null);
  // The BoQ upload opens as a bottom sheet, like the mock's upload item:
  // a native dialog docked to the bottom, fully opaque, actions pinned.
  const importDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!importing) return;
    const dialog = importDialog.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector(".action-dialog__body")?.scrollTo(0, 0);
  }, [importing]);
  async function discard() { return !dirty || await confirm({title:"Discard these BoQ edits?",description:"Your changes have not been saved. The existing BoQ is preserved.",confirmLabel:"Discard edits",danger:true}); }
  async function edit(row: BoqRow | null) { if(!await discard())return; setSelected(row); setOpen(true); setError(""); setErrors({}); setMessage(""); setNewId(crypto.randomUUID()); setCode(row?.item_code??nextBoqCode(rows));setDirty(false);setDetails(false);setLineTotal(row?formatMoney(decimal(row.rate,"rate").times(row.boq_quantity).toFixed(),currency):null); }
  async function retire(row:BoqRow) {
    if(!await confirm({title:"Remove this item from the current BoQ?",description:"Locked reports keep the original quantity, rate and cost. Drafts using this item will need a new match.",confirmLabel:"Remove from BoQ",danger:true,detail:<p>{row.description}</p>}))return;
    setBusy(true);setError("");try{await projectAction("retire_boq",{project_id:projectId,item_id:row.id,revision:row.revision});setOpen(false);setDirty(false);setMessage("BoQ item removed.");router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Could not remove this BoQ item.");}finally{setBusy(false);}
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(importFields.map(key => [key, String(form.get(key) ?? "")])) as ImportValues;
    const invalid=inputErrors(values);if(Object.keys(invalid).length){setErrors(invalid);if(invalid.item_code||invalid.section)setDetails(true);event.currentTarget.querySelector<HTMLInputElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus();return;}
    const item = reviewedItem(values,selected?.id??newId,selected?.revision??null,code);if(!item)return;
    if (!await confirm({ title: selected ? "Save these BoQ changes?" : "Add this supplied BoQ item?", description: "New and rebuilt drafts will use these quantities and rates. Saved drafts may need costing again. Approved reports keep their original amounts.", confirmLabel: "Save BoQ item", detail: <><p className="font-semibold">{item.description}</p><p>{formatQuantity(item.boq_quantity)} {displayUnit(item.unit)} · {formatMoney(item.rate, currency)} {currency} per {displayUnit(item.unit)}</p></> })) return;
    setBusy(true); setError("");setErrors({});
    try { const response = await fetch("/api/projects/boq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, item }), cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save this item."); setOpen(false);setDirty(false); setMessage("BoQ item saved."); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save this item."); } finally { setBusy(false); }
  }
  function errorFor(key: ImportField) {return errors[key]&&<span id={`boq-${key}-error`} className="mt-2 block text-sm leading-6 text-red-800">{errors[key]}</span>;}
  function input(key: ImportField,placeholder?:string) {return <><input className={field} name={key} id={`boq-${key}`} aria-label={key==="rate"?`Rate per unit (${currency})`:importLabels[key]} maxLength={key==="rate"?50:200} inputMode={key==="rate"||key==="boq_quantity"?"decimal":undefined} required={key!=="item_code"&&key!=="section"} placeholder={placeholder} defaultValue={selected?.[key]??(key==="item_code"?code:key==="section"?"General":"")} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`boq-${key}-error`:undefined}/>{errorFor(key)}</>;}
  return <section className="stitch-boq-editor">{confirmation}
    {editable && !open && !importing && <div className="stitch-two-actions"><button type="button" className="stitch-button" data-primary onClick={()=>{setImporting(true);setMessage("");}} data-tour="boq-upload"><DiaryIcon name="upload" size={20}/>+ Upload BoQ File</button><button type="button" className="stitch-button" data-white disabled={busy} onClick={() => edit(null)} data-tour="boq-add"><DiaryIcon name="plus" size={20}/>+ Add item</button></div>}
    {message && <p className="stitch-card" role="status">{message}</p>}
    {importing&&editable&&<dialog ref={importDialog} className="action-dialog stitch-sheet" aria-label="Import your BoQ" onClose={()=>setImporting(false)}><BoqImporter projectId={projectId} currency={currency} existing={rows} inSheet close={()=>{importDialog.current?.close();setImporting(false);}} saved={message=>{setMessage(message);importDialog.current?.close();setImporting(false);}}/></dialog>}
    {open && editable && <form key={selected?.id ?? newId} onSubmit={save} noValidate onChange={event=>{setDirty(true);const values=new FormData(event.currentTarget),qty=suppliedDecimal(String(values.get("boq_quantity")??"")),rate=suppliedDecimal(String(values.get("rate")??""));setLineTotal(qty&&rate?formatMoney(decimal(qty,"quantity").times(rate).toFixed(),currency):null);}} data-unsaved={dirty||undefined} className="my-7 max-w-3xl diary-panel"><h2 className="font-serif text-2xl">{selected ? "Edit BoQ item" : "Add a work item"}</h2><div className="grid gap-x-6 sm:grid-cols-2">
      <label className="mt-5 block sm:col-span-2" htmlFor="boq-description">Work description{input("description","e.g. 225 mm blockwork")}</label>
      <label className="mt-5 block">Measurement unit<select className={field} name="unit" defaultValue={selected?.unit ?? "m2"} disabled={selected?.used}>{boqUnits.map(unit => <option key={unit} value={unit}>{displayUnit(unit)} · {({m2:"area",m3:"volume",tonne:"weight",point:"count",day:"time"})[unit]}</option>)}</select>{selected?.used && <><input type="hidden" name="unit" value={selected.unit} /><span className="mt-2 block text-sm leading-6">Fixed because this unit is used in confirmed work.</span></>}{errorFor("unit")}</label>
      <label className="mt-5 block" htmlFor="boq-boq_quantity">Total planned quantity{input("boq_quantity","e.g. 420")}<span className="mt-2 block text-sm leading-6">The full quantity planned for this item.</span></label>
      <label className="mt-5 block sm:col-span-2" htmlFor="boq-rate">Rate per unit ({currency}){input("rate","Your supplied rate")}<span className="mt-2 block text-sm leading-6">Use your QS-verified rate. Commas can group thousands; use a dot for decimals.</span></label>
      {lineTotal&&<p className="mt-4 font-semibold" aria-live="polite">Line total {lineTotal}</p>}
    </div><details className="mt-6 border-t border-rule pt-4" open={details} onToggle={event=>setDetails(event.currentTarget.open)}><summary className="min-h-12 cursor-pointer">Optional details · code and section</summary><div className="grid gap-x-6 sm:grid-cols-2"><label className="mt-4 block" htmlFor="boq-item_code">Item code{input("item_code")}</label><label className="mt-4 block" htmlFor="boq-section">Section{input("section")}</label></div><p className="mt-3 text-sm leading-6">We generate a reference code and use General unless you choose your own.</p></details>
      {error && <p role="alert" className="my-5 border-l-4 border-amber-700 p-4 text-amber-900">{error}</p>}<div className="mt-6 flex flex-wrap gap-3"><button className={button + " work-button-primary"} disabled={busy}>{busy ? "Saving…" : "Review and save"}</button><button type="button" className={button} disabled={busy} onClick={async()=>{if(await discard()){setOpen(false);setDirty(false);}}}>Cancel editing</button>{selected&&<button type="button" className="text-link" disabled={busy} onClick={()=>void retire(selected)}>Remove item</button>}</div></form>}
    {overview}
    <div className="stitch-title-row"><h2 className="stitch-section-title">Contract Schedule Items</h2><span className="stitch-kicker">Sorted by trade</span></div>
    {!rows.length ? <p className="stitch-card">No BoQ items yet. Site notes can still be recorded while rates are prepared.</p> : <ul className="stitch-boq-items" aria-label="Supplied BoQ price list" data-tour="boq-progress">{rows.map((row,index) => <li key={row.id} id={`boq-item-${row.item_code}`} className="stitch-card scroll-mt-24">
      <div className="stitch-title-row"><span className="stitch-kicker">Item {String(index+1).padStart(2,"0")} · {row.section}</span>{row.progress.is_overrun&&<span className="stitch-kicker stitch-chip" data-tone="red">Overrun</span>}</div>
      <h3>{row.description}</h3>
      <dl className="stitch-boq-values">
        <div><dt>Scope qty</dt><dd>{formatQuantity(row.boq_quantity)} {displayUnit(row.unit)}</dd></div>
        <div><dt>Unit rate</dt><dd>{formatMoney(row.rate,currency)}</dd></div>
        <div><dt>Line total</dt><dd>{formatMoney(decimal(row.rate,"rate").times(row.boq_quantity).toFixed(),currency)}</dd></div>
      </dl>
      <div className="stitch-title-row"><small>Measured progress</small><strong>{formatQuantity(row.progress.cumulative_quantity)} {displayUnit(row.unit)} · {displayRatio(row.progress.percentage_complete)}%</strong></div>
      <progress max={100} value={Math.min(100, Number(row.progress.percentage_complete))} aria-label={`Progress for ${row.description}`}/>
      {editable && <button type="button" className="stitch-button mt-3" disabled={busy||importing} onClick={() => edit(row)} aria-label={`Edit ${row.item_code}`}>Adjust item</button>}
    </li>)}</ul>}
  </section>;
}
