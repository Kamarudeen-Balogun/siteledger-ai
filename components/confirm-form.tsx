"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ReviewRecord } from "@/lib/confirm/data";
import type { WorkItem, SiteExtraction } from "@/lib/ai/extraction-schema";
import { validateConfirmation, type Confirmation } from "@/lib/confirm/validation";
import { TelegramFrame } from "@/components/telegram-frame";

const empty: SiteExtraction = { work_items: [], materials: [], delays: [], issues: [], raw_language_notes: "" };
const inputClass = "min-h-12 w-full rounded-none border border-rule bg-white/50 px-3 py-2 text-base outline-offset-2 focus:outline-accent";
const unit = (value: string | null) => value === "m²" ? "m2" : value === "m³" ? "m3" : value;
const unitLabel = (value: string) => ({ m2: "m²", m3: "m³" }[unit(value)!] ?? value);
const unitMeaning = (value: string) => ({ m2: "Square metres — area", m3: "Cubic metres — volume", tonne: "Tonnes — weight", point: "Points — individual fixtures", day: "Days of work" }[unit(value)!] ?? value);
function Field({ label, name, value, number, required = false, low = false }: {
  label: string; name: string; value: string | number | null; number?: boolean; required?: boolean; low?: boolean;
}) {
  return <label className="block text-base"><span className="mb-2 block">{label}{required ? " *" : ""}</span>
    <input className={inputClass + (low ? " border-amber-700 bg-amber-50" : "")} name={name}
      type={number ? "number" : "text"} inputMode={number ? "decimal" : undefined} step={number ? "any" : undefined}
      min={number ? 0 : undefined} maxLength={number ? undefined : 20000} required={required}
      defaultValue={low ? "" : value ?? ""} aria-describedby={low ? name + "-check" : undefined} />
    {low && <span id={name + "-check"} className="mt-1 block text-amber-900">Check this one — enter the value.</span>}
  </label>;
}
function Score({ name, value }: { name: string; value: number }) {
  return <label className="block">AI confidence (0–1)<input className={inputClass + " mt-2"} aria-label="Confidence (0–1)"
    name={name} type="number" min="0" max="1" step="0.001" defaultValue={value} required />
    <span className="mt-1 block text-sm leading-5">1 means very certain. You still check the value.</span></label>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-rule py-7"><h2 className="mb-5 font-serif text-2xl">{title}</h2>{children}</section>;
}
function strings(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(strings).filter(Boolean).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(strings).filter(Boolean).join("\n");
  return "";
}
export function ConfirmForm({ record, access }: { record: ReviewRecord; access: string }) {
  const router = useRouter();
  const source = record.confirmed_extraction ?? record.extraction ?? empty;
  const [work, setWork] = useState(() => source.work_items.map((value, i) => ({ key: "work-" + i, value,
    unitValue: !record.confirmed_extraction && value.confidence < 0.6 ? "" : unit(value.unit) ?? "",
    boqId: !record.confirmed_extraction && value.confidence < 0.6 ? "" : record.confirmed_boq_ids?.[i] ?? record.boq.find(item => item.description.toLowerCase() === value.matched_boq_hint?.toLowerCase())?.id ?? "" })));
  const [materials, setMaterials] = useState(() => source.materials.map((value, i) => ({ key: "material-" + i, value })));
  const [delays, setDelays] = useState(() => source.delays.map((value, i) => ({ key: "delay-" + i, value })));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [saved, setSaved] = useState<{ by: string; at: string } | null>(() => record.confirmed_at ? { by: record.confirmed_by!, at: record.confirmed_at } : null);
  const [dirty, setDirty] = useState(false);
  const feedback = useRef<HTMLDivElement>(null), focusFeedback = useRef(false);
  const listening = ["queued", "processing"].includes(record.job_status ?? "");
  const locked = record.status === "locked";
  const low = (confidence: number) => !record.confirmed_extraction && confidence < 0.6;
  useEffect(() => {
    if (!listening && !record.pending_media) return;
    const timer = setInterval(() => { if (navigator.onLine) router.refresh(); }, 3000);
    return () => clearInterval(timer);
  }, [listening, record.pending_media, router]);
  useEffect(() => {
    if (!focusFeedback.current || saving || (!saved && !error)) return;
    feedback.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    feedback.current?.focus({ preventScroll: true });
    focusFeedback.current = false;
  }, [saved, error, saving]);
  const mediaUrl = (id: string) => `/api/confirm/${record.id}/media/${id}?access=${encodeURIComponent(access)}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    focusFeedback.current = true;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const number = (name: string) => text(name) === "" ? null : Number(text(name));
    const values: SiteExtraction = {
      work_items: work.map((_, i) => ({ description: text(`w${i}.description`), matched_boq_hint: text(`w${i}.hint`) || null,
        quantity: number(`w${i}.quantity`), unit: unit(text(`w${i}.unit`)) || null, crew: number(`w${i}.crew`), confidence: number(`w${i}.confidence`)! })),
      materials: materials.map((_, i) => ({ name: text(`m${i}.name`), quantity: number(`m${i}.quantity`), unit: text(`m${i}.unit`) || null,
        action: text(`m${i}.action`) as "delivered" | "used", confidence: number(`m${i}.confidence`)! })),
      delays: delays.map((_, i) => ({ reason: text(`d${i}.reason`), hours: number(`d${i}.hours`), confidence: number(`d${i}.confidence`)! })),
      issues: text("issues").split(/\r?\n/).map(value => value.trim()).filter(Boolean), raw_language_notes: text("language_notes"),
    };
    const confirmation: Confirmation = { human_confirmed: true, values, boq_ids: work.map((_, i) => text(`w${i}.boq`)),
      photo_notes: record.photos.map(photo => ({ id: photo.id, note: text(`photo.${photo.id}`) })) };
    if (!validateConfirmation(confirmation, record.boq, record.photos.map(photo => photo.id))) {
      setError("Check quantities, crew counts and confidence. Choose a BoQ item with the same unit for every work item."); return;
    }
    if (!navigator.onLine) { setError("You’re offline. Your edits are still here. Reconnect before confirming."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/confirm/${record.id}`, { method: "POST", headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${access}`,
      }, body: JSON.stringify(confirmation), cache: "no-store", signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Your edits are still here. Try confirming again."); return; }
      setSaved({ by: result.confirmed_by, at: result.confirmed_at }); setDirty(false);
    } catch { setError("Could not reach SiteLedger. Your edits are still here; try again."); }
    finally { setSaving(false); }
  }
  const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(record.created_at));
  return <main className="mx-auto max-w-5xl px-4 pb-12 sm:px-8">
    <TelegramFrame />
    <header className="border-b border-rule py-7"><p className="font-mono text-sm tracking-wide">SITELEDGER / SITE DIARY</p>
      <h1 className="mt-4 font-serif text-3xl">Review your site note</h1><p className="mt-3 leading-7">{record.project_name}</p>
      <p className="mt-2 font-mono text-sm">{date} WAT</p><p className="mt-2">Sent by {record.submitted_by}</p></header>
    <div ref={feedback} tabIndex={-1} className="outline-none">
      {error ? <div role="alert" className="mt-5 border-l-4 border-[#B91C1C] bg-red-50 p-5 text-[#B91C1C]"><p className="font-semibold">Your changes need another check</p><p className="mt-2">{error}</p></div>
        : saved && <div role="status" className={"mt-5 border-l-4 p-5 " + (dirty ? "border-amber-700 bg-amber-50" : "border-[#657055] bg-[#EEF0E7]")}>
          <h2 className="font-serif text-2xl">{dirty ? "Changes not yet confirmed" : "Site note confirmed"}</h2>
          <p className="mt-2">{dirty ? "Check your changes and tap Confirm changes to save them." : "Your quantities and observations have been saved."}</p>
          <p className="mt-2 font-mono text-sm">Confirmed by {saved.by} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(saved.at))} WAT</p>
          <p className="mt-2">Your original voice note is kept. You can correct this note until its report is locked.</p>
        </div>}
    </div>
    <div className="py-6 text-base leading-7"><p className="font-semibold">Three steps to check your site note</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5"><li>Listen to your voice note or read the original transcript.</li>
        <li>Choose each BoQ item. Check its quantity, measurement unit and crew, then review materials, delays and photos.</li>
        <li>Tap Confirm site note. Look for “Site note confirmed” at the top.</li></ol>
      <p className="mt-3">An asterisk (*) marks a required field. Unclear values are blank and marked “Check this one”. Nothing is costed or locked before you confirm.</p></div>
    {locked && <p className="my-4 border-2 border-accent p-4 font-mono text-accent">LOCKED — this record cannot be changed.</p>}
    {record.audio_url && <Section title="Your voice note"><audio aria-label="Original site voice note" className="w-full" controls preload="none" src={mediaUrl("audio")} />
      <details className="mt-4"><summary className="min-h-12 cursor-pointer py-3">Read the original transcript</summary>
        <p className="whitespace-pre-wrap border-l-2 border-rule pl-4 leading-7">{record.transcript ?? "The original audio is saved. A transcript isn’t available."}</p></details></Section>}
    {listening ? <Section title="Listening to your note…"><p role="status">Your audio and photos are saved. This page will update when your note is ready to check.</p></Section>
      : <form onSubmit={submit} onChange={() => setDirty(true)}>
      {record.job_status === "manual_entry" && <p role="status" className="mb-5 border-l-4 border-amber-700 bg-amber-50 p-4">We couldn’t read this note reliably. Your audio and photos are saved. Enter what happened below.</p>}
      <fieldset disabled={locked || saving}>
      <Section title="Work done">
        <p className="mb-5 leading-7">The BoQ is your project’s agreed list of work. Choose the matching item; its unit tells you how the quantity is measured.</p>
        {!work.length && <p className="mb-5">No work items were picked up. Add an item if work was done.</p>}
        <table className="w-full table-fixed border-collapse text-left"><caption className="sr-only">Editable work quantities and BoQ choices</caption>
          <thead><tr className="border-b border-rule"><th scope="col" className="w-2/3 py-3 pr-3 font-normal">Work item</th><th scope="col" className="py-3 font-normal">Quantity</th></tr></thead>
          <tbody>{work.map(({ key, value, boqId, unitValue }, i) => <tr key={key} className="border-b border-rule"><td colSpan={2} className="py-5">
            {low(value.confidence) && <p className="mb-3 text-amber-900">Check this one — this item needs your input.</p>}
            <div className="grid grid-cols-3 gap-3"><div className="col-span-2"><Field label="Description" name={`w${i}.description`} value={value.description} required low={low(value.confidence)} /></div>
              <Field label={unitValue ? `Quantity (${unitLabel(unitValue)})` : "Quantity"} name={`w${i}.quantity`} value={value.quantity} number required low={low(value.confidence) || value.quantity === null} /></div>
            <label className="mt-4 block">BoQ item *<select className={inputClass + " mt-2"} name={`w${i}.boq`} value={boqId} onChange={event => {
              const selected = event.target.value; const chosen = record.boq.find(item => item.id === selected);
              setWork(rows => rows.map(row => row.key === key ? { ...row, boqId: selected, unitValue: chosen?.unit ?? row.unitValue } : row));
            }} required>
              <option value="">Choose the item this work belongs to</option>{record.boq.map(item => <option key={item.id} value={item.id}>{item.section} — {item.description} ({unitLabel(item.unit)})</option>)}</select></label>
            <p className="mt-3 border-l-2 border-rule pl-3 font-semibold">{unitValue ? `Measure in ${unitLabel(unitValue)}: ${unitMeaning(unitValue)}` : "Choose a BoQ item to see its measurement unit."}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><label className="block">Measurement unit *
              <input className={inputClass + " mt-2"} name={`w${i}.unit`} value={unitValue} required onChange={event => {
                const next = event.target.value; setWork(rows => rows.map(row => row.key === key ? { ...row, unitValue: next } : row));
              }} /><span className="mt-1 block text-sm">m2 = m² · m3 = m³</span></label>
              <Field label="Crew count" name={`w${i}.crew`} value={value.crew} number required={low(value.confidence) && value.crew !== null} low={low(value.confidence)} />
              <Score name={`w${i}.confidence`} value={value.confidence} /><Field label="BoQ suggestion" name={`w${i}.hint`} value={value.matched_boq_hint} low={low(value.confidence)} /></div>
            <button type="button" className="mt-3 min-h-12 underline underline-offset-4" onClick={() => { setDirty(true); setWork(rows => rows.filter(row => row.key !== key)); }}>Remove work item {i + 1}</button>
          </td></tr>)}</tbody></table>
        <button type="button" className="mt-4 min-h-12 border border-rule px-4" onClick={() => { setDirty(true); setWork(rows => [...rows, { key: crypto.randomUUID(), boqId: "", unitValue: "", value: {
          description: "", matched_boq_hint: null, quantity: null, unit: null, crew: null, confidence: 1,
        } as WorkItem }]); }}>Add work item</button>
      </Section>
      <Section title="Materials">
        {!materials.length && <p>No materials were mentioned.</p>}
        {materials.map(({ key, value }, i) => <div key={key} className="border-b border-rule py-5">
          <div className="grid grid-cols-2 gap-4"><Field label="Material" name={`m${i}.name`} value={value.name} required low={low(value.confidence)} />
            <Field label={value.unit ? `Quantity (${value.unit})` : "Quantity"} name={`m${i}.quantity`} value={value.quantity} number required low={low(value.confidence) || value.quantity === null} /></div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3"><Field label="Unit" name={`m${i}.unit`} value={value.unit} required low={low(value.confidence)} />
            <label className="block">Action *<select className={inputClass + " mt-2"} name={`m${i}.action`} defaultValue={low(value.confidence) ? "" : value.action ?? ""} required>
              <option value="">Choose action</option><option value="delivered">Delivered</option><option value="used">Used</option></select></label><Score name={`m${i}.confidence`} value={value.confidence} /></div>
          <button type="button" className="mt-3 min-h-12 underline" onClick={() => { setDirty(true); setMaterials(rows => rows.filter(row => row.key !== key)); }}>Remove material {i + 1}</button>
        </div>)}
        <button type="button" className="mt-4 min-h-12 border border-rule px-4" onClick={() => { setDirty(true); setMaterials(rows => [...rows, { key: crypto.randomUUID(), value: { name: "", quantity: null, unit: null, action: null, confidence: 1 } }]); }}>Add material</button>
      </Section>
      <Section title="Delays">
        {!delays.length && <p>No delays were mentioned.</p>}
        {delays.map(({ key, value }, i) => <div key={key} className="border-b border-rule py-5">
          <div className="grid grid-cols-2 gap-4"><Field label="Reason" name={`d${i}.reason`} value={value.reason} required low={low(value.confidence)} />
            <Field label="Hours" name={`d${i}.hours`} value={value.hours} number required low={low(value.confidence) || value.hours === null} /></div>
          <div className="mt-4 max-w-xs"><Score name={`d${i}.confidence`} value={value.confidence} /></div>
          <button type="button" className="mt-3 min-h-12 underline" onClick={() => { setDirty(true); setDelays(rows => rows.filter(row => row.key !== key)); }}>Remove delay {i + 1}</button>
        </div>)}
        <button type="button" className="mt-4 min-h-12 border border-rule px-4" onClick={() => { setDirty(true); setDelays(rows => [...rows, { key: crypto.randomUUID(), value: { reason: "", hours: null, confidence: 1 } }]); }}>Add delay</button>
      </Section>
      <Section title="Photos">
        {!record.photos.length && <p>No photos are attached to this note. You can send them in the same Telegram chat.</p>}
        <div className="grid gap-7 sm:grid-cols-2">{record.photos.map((photo, i) => <div key={photo.id}>
          <Image src={mediaUrl(photo.id)} alt={`Site evidence photo ${i + 1}`} width={800} height={600} unoptimized className="h-auto w-full border border-rule" />
          <label className="mt-3 block">Photo {i + 1} observations {photo.ai_findings ? "— possible findings, please check" : ""}
            <textarea className={inputClass + " mt-2 min-h-24"} name={`photo.${photo.id}`} maxLength={5000}
              defaultValue={photo.confirmed_findings?.note ?? strings(photo.ai_findings)} placeholder="Add a note or clear any suggestion you disagree with." /></label>
        </div>)}</div>
      </Section>
      <Section title="Issues and language notes">
        <label className="block">Issues — one per line<textarea className={inputClass + " mt-2 min-h-28"} name="issues" defaultValue={source.issues.join("\n")} maxLength={20000} /></label>
        <label className="mt-5 block">Language notes<textarea className={inputClass + " mt-2 min-h-24"} name="language_notes" defaultValue={source.raw_language_notes} maxLength={20000} /></label>
      </Section>
      </fieldset>
      {record.pending_media && <p role="status" className="mb-4 border-l-4 border-amber-700 p-4">A photo is still saving. You can review the fields now; wait before confirming.</p>}
      {saved && !dirty && !error && <p className="mb-4 border-l-4 border-[#657055] bg-[#EEF0E7] p-4 font-semibold">Site note confirmed. Your changes are saved.</p>}
      <p className="mb-4">By confirming, you confirm that these are the quantities and observations from your site.</p>
      <button type="submit" disabled={saving || locked || record.pending_media || (!!saved && !dirty)} className="min-h-14 w-full bg-accent px-6 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
        {saving ? "Saving your confirmation…" : saved ? dirty ? "Confirm changes" : "Confirmed — saved" : "Confirm site note"}</button>
      </form>}
  </main>;
}
