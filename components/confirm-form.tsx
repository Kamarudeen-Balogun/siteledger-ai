"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReviewRecord } from "@/lib/confirm/data";
import type { WorkItem, SiteExtraction } from "@/lib/ai/extraction-schema";
import { validateConfirmation, type Confirmation } from "@/lib/confirm/validation";
import { TelegramFrame } from "@/components/telegram-frame";
import { PhotoObservations } from "@/components/photo-observations";
import { WorkspaceHeader } from "./workspace-header";
import { DiaryNotice } from "./diary-notice";
import { WorkDisclosure } from "./work-flow";
import type { ReviewDraft } from "@/lib/confirm/draft";
import { DiaryIcon } from "./diary-icon";

const empty: SiteExtraction = { work_items: [], materials: [], delays: [], issues: [], raw_language_notes: "" };
const inputClass = "min-h-12 w-full rounded-none border border-rule bg-[#fffdf9] px-3 py-2 text-base outline-offset-2 focus:outline-accent";
const unit = (value: string | null) => value === "m²" ? "m2" : value === "m³" ? "m3" : value;
const unitLabel = (value: string) => ({ m2: "m²", m3: "m³" }[unit(value)!] ?? value);
const unitMeaning = (value: string) => ({ m2: "Square metres — area", m3: "Cubic metres — volume", tonne: "Tonnes — weight", point: "Points — individual fixtures", day: "Days of work" }[unit(value)!] ?? value);
function Field({ label, name, value, number, required = false, low = false, initial }: {
  label: string; name: string; value: string | number | null; number?: boolean; required?: boolean; low?: boolean; initial?: string;
}) {
  return <label className="block text-base"><span className="mb-2 block">{label}{required ? " *" : ""}</span>
    <input className={low ? inputClass.replace("border-rule bg-[#fffdf9]", "border-amber-700 bg-amber-50") : inputClass} name={name}
      type={number ? "number" : "text"} inputMode={number ? "decimal" : undefined} step={number ? "any" : undefined}
      min={number ? 0 : undefined} maxLength={number ? undefined : 20000} required={required}
      defaultValue={initial ?? (low ? "" : value ?? "")} aria-describedby={low ? name + "-check" : undefined} />
    {low && <span id={name + "-check"} className="sr-only">Check this one — enter the value.</span>}
  </label>;
}
function Score({ name, value }: { name: string; value: number }) {
  return <input type="hidden" name={name} value={value} />;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="stitch-review-items"><h2 className="stitch-section-title"><DiaryIcon name="review" size={20}/>{title}</h2>{children}</section>;
}
function VoicePlayback({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number|null>(null);
  const [error, setError] = useState(false);
  return <section className="stitch-card stitch-transcript">
    <div className="stitch-title-row"><p className="stitch-kicker"><DiaryIcon name="mic" size={18}/>Voice intake transcript</p><time className="stitch-kicker stitch-chip">{label}</time></div>
    <div className="stitch-audio">
      <audio ref={audio} src={src} preload="metadata" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onLoadedMetadata={event=>{const seconds=event.currentTarget.duration;if(Number.isFinite(seconds))setDuration(seconds);}}/>
      <button className="stitch-button" data-primary type="button" aria-label={playing?"Pause original site voice note":"Play original site voice note"} onClick={()=>{if(playing)audio.current?.pause();else void audio.current?.play().catch(()=>setError(true));}}><DiaryIcon name={playing?"pause":"play"} size={20}/></button>
      <div className="stitch-wave" aria-hidden="true">{[7,13,18,12,24,14,19,10,21,13,18,10,5].map((height,index)=><i key={index} style={{height,opacity:index<5?1:.4}}/>)}</div>
      {duration!==null&&<span className="stitch-kicker">{Math.floor(duration/60)}:{String(Math.floor(duration%60)).padStart(2,"0")}</span>}
    </div>
    {error&&<p role="alert">Could not play the original voice note.</p>}
  </section>;
}
export function ConfirmForm({ record, draft, trial = false, banner, children }: { record: ReviewRecord; draft?: ReviewDraft | null; trial?: boolean; banner?: ReactNode; children?: ReactNode }) {
  const router = useRouter();
  const source = record.confirmed_extraction ?? record.trial_values ?? record.extraction ?? empty;
  const previouslyChecked = Boolean(record.confirmed_extraction || record.trial_values);
  const fields = draft?.fields ?? {};
  const [work, setWork] = useState(() => Array.from({ length: draft?.work ?? source.work_items.length }, (_, i) => {
    const value = draft ? { description: fields[`w${i}.description`] ?? "", quantity: null, unit: null, crew: null, confidence: Number(fields[`w${i}.confidence`] ?? 1), matched_boq_hint: fields[`w${i}.hint`] ?? null } : source.work_items[i];
    return { key: `work-${i}`, value,
      unitValue: draft ? fields[`w${i}.unit`] ?? "" : !previouslyChecked && value.confidence < 0.6 ? "" : unit(value.unit) ?? "",
      boqId: draft ? fields[`w${i}.boq`] ?? "" : !previouslyChecked && value.confidence < 0.6 ? "" : (record.confirmed_boq_ids ?? record.trial_boq_ids)?.[i] ?? record.boq.find(item => item.description.toLowerCase() === value.matched_boq_hint?.toLowerCase())?.id ?? "" };
  }));
  const [materials, setMaterials] = useState(() => Array.from({ length: draft?.materials ?? source.materials.length }, (_, i) => ({ key: `material-${i}`, value: draft ? { name: "", quantity: null, unit: null, action: null, confidence: Number(fields[`m${i}.confidence`] ?? 1) } : source.materials[i] })));
  const [delays, setDelays] = useState(() => Array.from({ length: draft?.delays ?? source.delays.length }, (_, i) => ({ key: `delay-${i}`, value: draft ? { reason: "", hours: null, confidence: Number(fields[`d${i}.confidence`] ?? 1) } : source.delays[i] })));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [costing, setCosting] = useState(false);
  const [saved, setSaved] = useState<{ by: string; at: string } | null>(() => record.confirmed_at ? { by: record.confirmed_by!, at: record.confirmed_at } : null);
  const [dirty, setDirty] = useState(false), [savingDraft,setSavingDraft]=useState(false), [draftNotice,setDraftNotice]=useState(Boolean(draft));
  const feedback = useRef<HTMLDivElement>(null), focusFeedback = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Autosave: leaving Confirm without tapping "Save draft" must not lose
  // edits. Draft fields are saved quietly 2 seconds after the last
  // change, so a draft reopens exactly as left even if the user never
  // taps Save. No navigation happens on autosave.
  useEffect(() => {
    if (!dirty || locked || archived || saving) return;
    const timer = setTimeout(() => { void saveDraft(formRef.current, { stay: true }); }, 2000);
    return () => clearTimeout(timer);
  });
  const listening = ["queued", "processing"].includes(record.job_status ?? "");
  const locked = record.status === "locked";
  const archived = Boolean(record.archived_at);
  const low = (confidence: number) => !previouslyChecked && confidence < 0.6;
  useEffect(() => {
    if (!listening && !record.pending_media && !record.pending_photo_analysis) return;
    const timer = setInterval(() => { if (navigator.onLine) router.refresh(); }, 3000);
    return () => clearInterval(timer);
  }, [listening, record.pending_media, record.pending_photo_analysis, router]);
  useEffect(() => {
    if (!focusFeedback.current || saving || (!saved && !error)) return;
    feedback.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    feedback.current?.focus({ preventScroll: true });
    focusFeedback.current = false;
  }, [saved, error, saving]);
  const mediaUrl = (id: string) => trial ? `/api/trial/media/${id}` : `/api/confirm/${record.id}/media/${id}`;
  async function saveDraft(form: HTMLFormElement | null, options: { stay?: boolean } = {}) {
    if (!form || savingDraft) return;
    setSavingDraft(true); setError("");
    try {
      const fields = Object.fromEntries([...new FormData(form)].map(([name,value]) => [name,String(value)]));
      const response = await fetch(`/api/confirm/${record.id}/draft`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ work: work.length, materials: materials.length, delays: delays.length, fields }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDirty(false); setDraftNotice(true);
      if (!options.stay) router.push("/today");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save this draft. Try again."); focusFeedback.current = true; }
    finally { setSavingDraft(false); }
  }
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
      const response = await fetch(trial ? "/api/trial/confirm" : `/api/confirm/${record.id}`, { method: "POST", headers: {
        "Content-Type": "application/json",
      }, body: JSON.stringify(confirmation), cache: "no-store", signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Your edits are still here. Try confirming again."); return; }
      setSaved({ by: result.confirmed_by, at: result.confirmed_at }); setDirty(false);
      if (trial) { router.push("/trial/report"); router.refresh(); return; }
      setCosting(true);
      const costResponse = await fetch(`/api/reports/${record.id}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), cache: "no-store", signal: AbortSignal.timeout(20000) });
      if (!costResponse.ok) { setError("Your confirmation is saved. Open the costed report below to try creating it again."); return; }
      router.push(`/reports/${record.id}`);
    } catch { setError("Could not reach SiteLedger. Your edits are still here; try again."); }
    finally { setSaving(false); setCosting(false); }
  }
  const time = new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: record.timezone ?? "Africa/Lagos" }).format(new Date(record.created_at));
  return <main className="mx-auto max-w-7xl px-5 pb-12 pt-7 sm:px-10 stitch-confirm">
    <TelegramFrame />
    <WorkspaceHeader current="reports" title="Confirm site note" project={record.project_name} detail/>{banner}
    <header className="stitch-human-gate stitch-card"><span><DiaryIcon name={locked?"lock":"verified"} size={18}/></span><div>
      <p className="stitch-kicker" data-ink="orange">{locked?"Locked record":"Mandatory human review"}</p>
      <h1>{locked?"This site note belongs to a locked report.":"Human confirmation mandatory — nothing is costed or locked until you verify."}</h1></div></header>
      {record.guest_origin && <p className="mt-4 border-l-4 border-accent pl-4 leading-7">Originally captured by {record.guest_origin.recorded_by}. Your guest edits are carried forward. Confirm this work under your verified professional name before approval.</p>}
      {record.guest_origin && <Link className="inline-flex min-h-12 items-center underline" href={`/trial/original/${record.id}`}>View the preserved guest trial</Link>}
      {trial && <p className="stitch-card mt-4">Private trial. Demo rates are illustrative. Save your work to a verified account before approval.</p>}
    <div ref={feedback} tabIndex={-1} className="outline-none">
      {error ? <DiaryNotice tone="error" title="Your changes need another check">{error}</DiaryNotice>
        : saved && <div role="status" className={"mt-5 border-l-4 p-5 " + (dirty ? "border-amber-700 bg-amber-50" : "border-[#657055] bg-[#EEF0E7]")}>
          <h2 className="font-serif text-2xl">{dirty ? "Changes not yet confirmed" : "Site note confirmed"}</h2>
          <p className="mt-2">{dirty ? "Check your changes and tap Confirm changes to save them." : "Your quantities and observations have been saved."}</p>
          <p className="mt-2 font-mono text-sm">Confirmed by {saved.by} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: record.timezone ?? "Africa/Lagos" }).format(new Date(saved.at))} · {record.timezone ?? "Africa/Lagos"}</p>
          <p className="mt-2">Your original voice note is kept. You can correct this note until its report is locked.</p>
        </div>}
    </div>
    {saved && !dirty && <Link prefetch={false} className="mt-4 block min-h-12 py-3 font-semibold underline" href={trial ? "/trial/report" : `/reports/${record.id}`}>Open costed report</Link>}
    {!record.audio_url&&record.photos.length>0&&<DiaryNotice title="Photo-only site note">Add the work and quantities you want costed. Photo findings are suggestions; they do not supply a quantity or price.</DiaryNotice>}
    {archived && <p role="status" className="my-4 border-l-4 border-accent p-4">Archived project. This site note is available for reading; the owner must restore the project before changes.</p>}
    {record.audio_url && <div className="stitch-transcript-block">
      <VoicePlayback src={mediaUrl("audio")} label={time}/>
      <blockquote>{record.transcript ? <>“{record.transcript}”</> : "The original audio is saved. A transcript isn’t available yet."}</blockquote>
      {source.raw_language_notes && <p className="stitch-language"><DiaryIcon name="translate" size={18}/>{source.raw_language_notes}</p>}
    </div>}
    {listening ? <DiaryNotice busy title="Listening to your note…">Your audio and photos are saved. This page will update when your note is ready to check.</DiaryNotice>
      : <form ref={formRef} onSubmit={submit} onChange={() => setDirty(true)} data-unsaved={dirty&&!locked&&!archived&&!saving}>
      {record.job_status === "manual_entry" && <DiaryNotice tone="warning" title="Enter the site details">We couldn’t read this note reliably. Your audio and photos are saved. Enter what happened below.</DiaryNotice>}
      <fieldset disabled={locked || archived || saving}>
      <Section title="Work items">
        {!work.length && <p className="stitch-card">No work items were picked up. Add an item if work was done.</p>}
        <table className="w-full table-fixed border-collapse text-left"><caption className="sr-only">Editable work quantities and BoQ choices</caption>
          <thead className="sr-only"><tr><th scope="col">Work item</th><th scope="col">Quantity</th></tr></thead>
          <tbody>{work.map(({ key, value, boqId, unitValue }, i) => <tr key={key} className="review-row border-b border-rule" data-confidence={low(value.confidence) ? "low" : undefined}><td colSpan={2} className="py-5">
            <div className="stitch-title-row" data-tour={i===0?"work-items":undefined}><span className="stitch-kicker" data-ink="orange">{record.boq.find(item=>item.id===boqId)?.section ?? "Work item"}</span><span className="stitch-kicker stitch-chip" data-tone={low(value.confidence)?"red":"green"}>{value.confidence.toFixed(2)} conf.</span></div>
            {low(value.confidence) && <p className="stitch-review-warning">Check this one — this item needs your input.</p>}
            <Field label="Description" name={`w${i}.description`} value={value.description} initial={fields[`w${i}.description`]} required low={low(value.confidence)} />
            <div className="stitch-quantity">
              <label htmlFor={`quantity-${key}`} className="stitch-kicker">{unitValue ? `Quantity (${unitLabel(unitValue)})` : "Quantity"} *</label>
              <button type="button" className="stitch-button" aria-label={`Decrease quantity for work item ${i+1}`} onClick={event=>{const input=event.currentTarget.parentElement?.querySelector("input");if(input){input.value=String(Math.max(0,(Number(input.value)||0)-1));setDirty(true);}}}>−</button>
              <input id={`quantity-${key}`} className={inputClass} name={`w${i}.quantity`} type="number" step="any" min="0" inputMode="decimal" defaultValue={fields[`w${i}.quantity`] ?? (low(value.confidence) ? "" : value.quantity ?? "")} required aria-describedby={low(value.confidence) || value.quantity === null ? `quantity-hint-${key}` : undefined}/>
              <button type="button" className="stitch-button" aria-label={`Increase quantity for work item ${i+1}`} onClick={event=>{const input=event.currentTarget.parentElement?.querySelector("input");if(input){input.value=String((Number(input.value)||0)+1);setDirty(true);}}}>+</button>
              {(low(value.confidence) || value.quantity === null) && <span id={`quantity-hint-${key}`} className="sr-only">Check this one — enter the value.</span>}
            </div>
            <label className="mt-4 block">BoQ item *<select className={inputClass + " mt-2"} name={`w${i}.boq`} value={boqId} onChange={event => {
              const selected = event.target.value; const chosen = record.boq.find(item => item.id === selected);
              setWork(rows => rows.map(row => row.key === key ? { ...row, boqId: selected, unitValue: chosen?.unit ?? row.unitValue } : row));
            }} required>
              <option value="">Choose the item this work belongs to</option>{record.boq.map(item => <option key={item.id} value={item.id}>{item.section} — {item.description} ({unitLabel(item.unit)})</option>)}</select></label>
            <p className="mt-3 border-l-2 border-rule pl-3 font-semibold">{unitValue ? `Measure in ${unitLabel(unitValue)}: ${unitMeaning(unitValue)}` : "Choose a BoQ item to see its measurement unit."}</p>
            <div className="review-helper-fields mt-4"><label className="block">Measurement unit *
              <input className={inputClass + " mt-2"} name={`w${i}.unit`} value={unitValue} required onChange={event => {
                const next = event.target.value; setWork(rows => rows.map(row => row.key === key ? { ...row, unitValue: next } : row));
              }} /><span className="mt-1 block text-sm">m2 = m² · m3 = m³</span></label>
              <Field label="Crew count" name={`w${i}.crew`} value={value.crew} initial={fields[`w${i}.crew`]} number required={low(value.confidence) && value.crew !== null} low={low(value.confidence)} />
              </div><Score name={`w${i}.confidence`} value={value.confidence} /><input type="hidden" name={`w${i}.hint`} value={value.matched_boq_hint ?? ""}/>
            <button type="button" className="mt-3 min-h-12 underline underline-offset-4" onClick={() => { setDirty(true); setWork(rows => rows.filter(row => row.key !== key)); }}>Remove work item {i + 1}</button>
          </td></tr>)}</tbody></table>
        <button type="button" className="mt-4 min-h-12 border border-rule px-4" onClick={() => { setDirty(true); setWork(rows => [...rows, { key: crypto.randomUUID(), boqId: "", unitValue: "", value: {
          description: "", matched_boq_hint: null, quantity: null, unit: null, crew: null, confidence: 1,
        } as WorkItem }]); }}>Add work item</button>
      </Section>
      <div data-tour="materials"><WorkDisclosure title="Materials recorded" description="Deliveries and materials used stay separate from costs" open={materials.length>0}>
        {!materials.length && <p>No materials were mentioned.</p>}
        {materials.map(({ key, value }, i) => <div key={key} className="border-b border-rule py-5">
          <div className="grid grid-cols-2 gap-4"><Field label="Material" name={`m${i}.name`} value={value.name} initial={fields[`m${i}.name`]} required low={low(value.confidence)} />
            <Field label="Quantity" name={`m${i}.quantity`} value={value.quantity} initial={fields[`m${i}.quantity`]} number required low={low(value.confidence) || value.quantity === null} /></div>
          <div className="mt-4 grid grid-cols-2 gap-4"><Field label="Count label" name={`m${i}.unit`} value={value.unit} initial={fields[`m${i}.unit`]} required low={low(value.confidence)} />
            <label className="block">Action *<select className={inputClass + " mt-2"} name={`m${i}.action`} defaultValue={fields[`m${i}.action`] ?? (low(value.confidence) ? "" : value.action ?? "")} required>
              <option value="">Choose action</option><option value="delivered">Delivered</option><option value="used">Used</option></select></label><Score name={`m${i}.confidence`} value={value.confidence} /></div>
          <button type="button" className="mt-3 min-h-12 underline" onClick={() => { setDirty(true); setMaterials(rows => rows.filter(row => row.key !== key)); }}>Remove material {i + 1}</button>
        </div>)}
        <button type="button" className="mt-4 min-h-12 border border-rule px-4" onClick={() => { setDirty(true); setMaterials(rows => [...rows, { key: crypto.randomUUID(), value: { name: "", quantity: null, unit: null, action: null, confidence: 1 } }]); }}>Add material</button>
      </WorkDisclosure></div>
      <WorkDisclosure title="Delays" description={delays.length?`${delays.length} mentioned in this note`:"Add a delay, if needed"} open={delays.length>0}>
        {!delays.length && <p>No delays were mentioned.</p>}
        {delays.map(({ key, value }, i) => <div key={key} className="border-b border-rule py-5">
          <div className="grid grid-cols-2 gap-4"><Field label="Reason" name={`d${i}.reason`} value={value.reason} initial={fields[`d${i}.reason`]} required low={low(value.confidence)} />
            <Field label="Hours" name={`d${i}.hours`} value={value.hours} initial={fields[`d${i}.hours`]} number required low={low(value.confidence) || value.hours === null} /></div>
          <div className="mt-4 max-w-xs"><Score name={`d${i}.confidence`} value={value.confidence} /></div>
          <button type="button" className="mt-3 min-h-12 underline" onClick={() => { setDirty(true); setDelays(rows => rows.filter(row => row.key !== key)); }}>Remove delay {i + 1}</button>
        </div>)}
        <button type="button" className="mt-4 min-h-12 border border-rule px-4" onClick={() => { setDirty(true); setDelays(rows => [...rows, { key: crypto.randomUUID(), value: { reason: "", hours: null, confidence: 1 } }]); }}>Add delay</button>
      </WorkDisclosure>
      <Section title="Photos">
        {!record.photos.length && <p>{trial ? "No photos are attached to this trial note." : "No photos are attached to this note. You can send them in the same Telegram chat."}</p>}
        <div className="grid gap-7 sm:grid-cols-2">{record.photos.map((photo, i) => <div key={photo.id}>
          <Image src={mediaUrl(photo.id)} alt={`Site evidence photo ${i + 1}`} width={800} height={600} unoptimized className="h-auto w-full border border-rule" />
          <PhotoObservations photo={photo} number={i + 1} initial={fields[`photo.${photo.id}`]} onEdit={() => setDirty(true)} />
        </div>)}</div>
      </Section>
      <WorkDisclosure title="Issues and language notes" description="Optional details and the original language notes" open={source.issues.length>0}>
        <label className="block">Issues — one per line<textarea className={inputClass + " mt-2 min-h-28"} name="issues" defaultValue={fields.issues ?? source.issues.join("\n")} maxLength={20000} /></label>
        <label className="mt-5 block">Language notes<textarea className={inputClass + " mt-2 min-h-24"} name="language_notes" defaultValue={fields.language_notes ?? source.raw_language_notes} maxLength={20000} /></label>
      </WorkDisclosure>
      </fieldset>
      {record.pending_media && <p role="status" className="mb-4 border-l-4 border-amber-700 p-4">A photo is still saving. You can review the fields now; wait before confirming.</p>}
      {record.pending_photo_analysis && <DiaryNotice busy title="Checking your photos…">Review the fields now; findings will appear here before you confirm.</DiaryNotice>}
      {saved && !dirty && !error && <p className="mb-4 border-l-4 border-[#657055] bg-[#EEF0E7] p-4 font-semibold">Site note confirmed. Your changes are saved.</p>}
      <p className="mb-4">By confirming, you confirm that these are the quantities and observations from your site.</p>
      {!record.audio_url&&!record.photos.length&&!locked&&<p role="status" className="my-4">Add a voice note or photo in the same Telegram chat before confirming.</p>}
      {draftNotice&&!dirty&&<p role="status" className="mb-3">Draft saved. <Link href="/today" className="text-link">Return to Today</Link></p>}
      {!locked&&!archived&&<div className="diary-confirm-actions"><button type="submit" disabled={saving || savingDraft || record.pending_media || record.pending_photo_analysis || (!record.audio_url&&!record.photos.length) || (!!saved && !dirty && !draftNotice)} className="stitch-button" data-primary>
        <DiaryIcon name="check" size={20}/>{saving ? costing ? <><span className="stitch-spinner" aria-hidden="true"/>Costing against the BoQ…</> : "Saving your confirmation…" : saved ? "Confirm changes and rebuild report" : "Confirm and cost it"}</button>
        {!trial&&<button type="button" data-tour="save-draft" className="stitch-button" disabled={saving||savingDraft} onClick={event=>void saveDraft(event.currentTarget.form)}><DiaryIcon name="bookmark" size={20}/>{savingDraft?"Saving draft…":"Save draft — finish later"}</button>}</div>}
      </form>}{children}
  </main>;
}
