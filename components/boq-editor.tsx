"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/costing/format-money";
import { displayUnit } from "@/lib/reports/model";
import { boqUnits, type BoqEdit, type BoqRow } from "@/lib/projects/boq-types";
import { useActionConfirmation } from "./action-confirmation";
const field = "mt-2 min-h-12 w-full border border-rule bg-white px-3 py-3 text-base";
const button = "inline-flex min-h-12 items-center justify-center border border-ink px-5 py-3 disabled:opacity-50";
export function BoqEditor({ projectId, currency, rows, editable }: { projectId: string; currency: string; rows: BoqRow[]; editable: boolean }) {
  const router = useRouter(), { confirm, confirmation } = useActionConfirmation();
  const [selected, setSelected] = useState<BoqRow | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [newId, setNewId] = useState("");
  function edit(row: BoqRow | null) { setSelected(row); setOpen(true); setError(""); setMessage(""); setNewId(crypto.randomUUID()); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const item = { id: selected?.id ?? newId, revision: selected?.revision ?? null, ...Object.fromEntries(["item_code", "section", "description", "unit", "boq_quantity", "rate"].map(key => [key, String(form.get(key) ?? "")])) } as BoqEdit;
    if (!await confirm({ title: selected ? "Save these BoQ changes?" : "Add this supplied BoQ item?", description: "These quantities and rates will be used for new and rebuilt drafts. Saved drafts may need costing again. Approved reports keep their original recorded amounts.", confirmLabel: "Save BoQ item", detail: <><p className="font-semibold">{item.description}</p><p>{item.boq_quantity} {displayUnit(item.unit)} · {formatMoney(item.rate, currency)} {currency} per {displayUnit(item.unit)}</p></> })) return;
    setBusy(true); setError("");
    try { const response = await fetch("/api/projects/boq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, item }), cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save this item."); setOpen(false); setMessage("BoQ item saved. New and rebuilt drafts use these supplied values."); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save this item."); } finally { setBusy(false); }
  }
  return <section className="my-8">{confirmation}
    {editable && <button type="button" className={button + " bg-accent text-white"} disabled={busy} onClick={() => edit(null)}>Add BoQ item</button>}
    {message && <p role="status" className="my-5 border-l-4 border-accent pl-4 leading-7">{message}</p>}
    {open && editable && <form key={selected?.id ?? newId} onSubmit={save} className="my-7 max-w-3xl border-y border-rule py-7"><h2 className="font-serif text-2xl">{selected ? "Edit supplied BoQ item" : "Add supplied BoQ item"}</h2><div className="grid gap-x-6 sm:grid-cols-2">
      <label className="mt-5 block">Item code<input className={field} name="item_code" required maxLength={200} defaultValue={selected?.item_code ?? ""} /></label><label className="mt-5 block">Section<input className={field} name="section" required maxLength={200} defaultValue={selected?.section ?? ""} /></label><label className="mt-5 block sm:col-span-2">Description<input className={field} name="description" required maxLength={200} defaultValue={selected?.description ?? ""} /></label>
      <label className="mt-5 block">Measurement unit<select className={field} name="unit" defaultValue={selected?.unit ?? "m2"} disabled={selected?.used}>{boqUnits.map(unit => <option key={unit} value={unit}>{displayUnit(unit)}</option>)}</select>{selected?.used && <><input type="hidden" name="unit" value={selected.unit} /><span className="mt-2 block text-sm leading-6">This unit is fixed because the item is used in confirmed work.</span></>}</label>
      <label className="mt-5 block">BoQ quantity<input className={field} name="boq_quantity" required inputMode="decimal" pattern="[0-9]{1,10}([.][0-9]{1,4})?" maxLength={15} defaultValue={selected?.boq_quantity ?? ""} /><span className="mt-2 block text-sm">Positive quantity; up to four decimal places.</span></label>
      <label className="mt-5 block sm:col-span-2">Supplied rate ({currency})<input className={field} name="rate" required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" maxLength={40} defaultValue={selected?.rate ?? ""} /><span className="mt-2 block text-sm leading-6">Enter your QS-verified rate in {currency}. No conversion or suggested price is applied.</span></label>
    </div>{error && <p role="alert" className="my-5 text-[#B91C1C]">{error}</p>}<div className="mt-6 flex flex-wrap gap-3"><button className={button + " bg-accent text-white"} disabled={busy}>{busy ? "Saving…" : "Review and save"}</button><button type="button" className={button} disabled={busy} onClick={() => setOpen(false)}>Cancel editing</button></div></form>}
    {!rows.length ? <p className="my-7 leading-7">No BoQ items supplied yet.</p> : <div className="ledger-scroll mt-7" tabIndex={0} role="region" aria-label="Supplied BoQ price list"><table className="ledger-table"><thead><tr><th scope="col">Item / section</th><th scope="col">Unit</th><th scope="col">BoQ quantity</th><th scope="col">Rate ({currency})</th>{editable && <th scope="col">Action</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row"><span className="eyebrow">{row.section} / {row.item_code}</span><span className="mt-1 block font-semibold">{row.description}</span></th><td>{displayUnit(row.unit)}</td><td>{row.boq_quantity}</td><td>{formatMoney(row.rate, currency)}</td>{editable && <td><button type="button" className={button} disabled={busy} onClick={() => edit(row)} aria-label={`Edit ${row.item_code}`}>Edit item</button></td>}</tr>)}</tbody></table></div>}
  </section>;
}
