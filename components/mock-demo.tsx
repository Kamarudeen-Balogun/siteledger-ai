"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DiaryIcon } from "./diary-icon";
import { ReportDocument } from "./report-document";
import { displayTimestamp, displayRatio, formatMoneyLabel, formatMoneyPerUnit, formatQuantityWithUnit, type ReportSource, type ReportView } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { costReport } from "@/lib/costing/cost-report";
import type { DemoTeamMember, DemoTodayNote } from "@/lib/data/demo-documents";

// Demo voice notes are synthetic recordings (gTTS, Nigerian English) of the
// demo transcripts — clearly labelled as demo audio, never presented as a
// real site recording. The player is the same play/pause + progress pattern
// as the real confirm screen's voice playback.
export function DemoVoicePlayer({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(false);
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  return <div>
    <div className="stitch-audio">
      <audio ref={audio} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setElapsed(0); }}
        onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)}
        onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds)) setDuration(seconds); }} />
      <button className="stitch-button" data-primary type="button" aria-label={playing ? "Pause demo voice note" : "Play demo voice note"}
        onClick={() => { if (playing) audio.current?.pause(); else void audio.current?.play().catch(() => setError(true)); }}>
        <DiaryIcon name={playing ? "pause" : "play"} size={20} />
      </button>
      <div className="stitch-wave" aria-hidden="true">{[7, 13, 18, 12, 24, 14, 19, 10, 21, 13, 18, 10, 5].map((height, index) => {
        const played = duration !== null && duration > 0 && elapsed / duration > index / 13;
        return <i key={index} style={{ height, opacity: played ? 1 : .4 }} />;
      })}</div>
      <span className="stitch-kicker">{duration !== null ? `${format(elapsed)} / ${format(duration)}` : label}</span>
    </div>
    <div className="stitch-audio-progress" aria-hidden="true"><i style={{ width: `${duration !== null && duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0}%` }} /></div>
    <p className="stitch-kicker" style={{ marginTop: 6 }}>Demo voice note — synthetic recording</p>
    {error && <p role="alert">Could not play the demo voice note.</p>}
  </div>;
}

function DemoPhotos({ photos }: { photos: DemoTodayNote["photos"] }) {
  return <div className="diary-photo-grid">{photos.map((photo, i) => <figure key={photo.id}>
    <Image src={photo.storage_url} width={800} height={600} alt={`Demo site photo ${i + 1}`} className="h-auto w-full" />
    <figcaption>{photo.captured_at ? displayTimestamp(photo.captured_at) : ""}{photo.note ? ` · ${photo.note}` : ""}</figcaption>
  </figure>)}</div>;
}

// Note 2 — the costed draft (₦551,000). Opens its costing; Approve & lock
// seals it and shows the full locked report, exactly as the real flow does.
export function MockNoteDetail({ note, report, priceList, currency }: { note: DemoTodayNote; report: ReportView; priceList: ReportSource["price_list"]; currency: string }) {
  const [locked, setLocked] = useState(false);
  const confirmed = note.items.map(item => ({ ...item, confirmed_by: "Engr. Tola Adeyemi (demo PM)" }));
  const costed = costReport(confirmed, priceList);
  if (locked) return <>
    <p className="stitch-card">Locked in the demo — in your own project this report would now appear in Reports &amp; Log.</p>
    <ReportDocument report={report} demoPhotos />
    <Link className="text-link" href="/projects/mock?view=today">Back to Today</Link>
  </>;
  return <>
    <section className="stitch-card">
      <div className="stitch-title-row"><h2>Costed draft</h2><span className="stitch-chip">{formatMoney(note.total_cost ?? "0", currency)}</span></div>
      <p className="stitch-kicker">{displayTimestamp(note.captured_at)} · Checked and costed — not yet locked</p>
      <blockquote>“{note.transcript}”</blockquote>
      <DemoVoicePlayer src={note.audio_url} label="Voice note" />
    </section>
    <section className="stitch-card">
      <h2 className="stitch-section-title">Costed against the BoQ</h2>
      <dl className="stitch-boq-values">{costed.items.map((item, i) => <div key={i}>
        <dt>{note.items[i]?.description}</dt>
        <dd>{formatQuantityWithUnit(item.quantity_done, item.unit)} · {formatMoney(item.cost_today, currency)}</dd>
      </div>)}</dl>
      <div className="stitch-day-total"><span className="stitch-kicker">Total costed</span><strong>{formatMoney(costed.total_cost, currency)}</strong></div>
      {note.materials.length > 0 && <p>{note.materials.map(material => `${material.quantity} ${material.unit} ${material.name} · ${material.action ?? "recorded"}`).join(" · ")} — counted, not costed.</p>}
      {note.delays.length > 0 && <p>{note.delays.map(delay => `${delay.reason} — ${delay.hours} hrs`).join(" · ")}</p>}
      {note.issues.length > 0 && <ul>{note.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    </section>
    <section className="stitch-card"><h2 className="stitch-section-title">Photos</h2><DemoPhotos photos={note.photos} /></section>
    <div className="diary-confirm-actions">
      <button type="button" className="stitch-button" data-primary onClick={() => setLocked(true)}><DiaryIcon name="check" size={20} />Approve &amp; lock report</button>
      <Link className="text-link" href="/projects/mock?view=today">Back to Today</Link>
    </div>
  </>;
}

// Note 3 — the uncosted draft. The confirm screen: editable quantities,
// live costing from the frozen BoQ rates, then a costed summary.
export function MockConfirmView({ note, priceList, currency }: { note: DemoTodayNote; priceList: ReportSource["price_list"]; currency: string }) {
  const suggested = note.suggested_items?.[0];
  const [quantity, setQuantity] = useState(suggested?.quantity ?? 0);
  const [confirmed, setConfirmed] = useState(false);
  const preview = suggested && quantity > 0 ? costReport(
    [{ boq_item_id: suggested.boq_item_id, quantity_done: String(quantity), unit: suggested.unit, crew: suggested.crew, confirmed_by: "Musa Bello (demo foreman)" }],
    priceList) : null;
  if (confirmed && preview) return <>
    <section className="stitch-card">
      <div className="stitch-title-row"><h2>Site note confirmed</h2><span className="stitch-chip">{formatMoney(preview.total_cost, currency)}</span></div>
      <p className="stitch-kicker">{displayTimestamp(note.captured_at)} · Costed in demo</p>
      <dl className="stitch-boq-values">{preview.items.map((item, i) => <div key={i}>
        <dt>{suggested?.description}</dt>
        <dd>{formatQuantityWithUnit(item.quantity_done, item.unit)} · {formatMoney(item.cost_today, currency)}</dd>
      </div>)}</dl>
      <div className="stitch-day-total"><span className="stitch-kicker">Total costed</span><strong>{formatMoney(preview.total_cost, currency)}</strong></div>
      <p>In your own project this would now be a costed draft, ready to approve and lock.</p>
    </section>
    <Link className="text-link" href="/projects/mock?view=today">Back to Today</Link>
  </>;
  return <>
    <section className="stitch-card">
      <div className="stitch-title-row"><h2>Confirm site note</h2><span className="stitch-chip">Not costed yet</span></div>
      <p className="stitch-kicker">{displayTimestamp(note.captured_at)} · Human confirmation — nothing is costed or locked until you verify.</p>
      <blockquote>“{note.transcript}”</blockquote>
      <DemoVoicePlayer src={note.audio_url} label="Voice note" />
    </section>
    {suggested && <section className="stitch-card">
      <h2 className="stitch-section-title">Check the quantities</h2>
      <p>{suggested.description}</p>
      <label>Quantity ({suggested.unit}) <input type="number" min={0} step={0.5} value={quantity} onChange={event => setQuantity(Number(event.target.value))} style={{ width: 96 }} /></label>
      <p>{formatMoneyPerUnit(priceList.find(row => row.id === suggested.boq_item_id)?.rate ?? "0", currency, suggested.unit)} · {quantity > 0 ? formatMoney(String(quantity * Number(priceList.find(row => row.id === suggested.boq_item_id)?.rate ?? 0)), currency) : "—"}</p>
      <p>Photo findings are suggestions; they do not supply a quantity or price.</p>
    </section>}
    <section className="stitch-card"><h2 className="stitch-section-title">Photos</h2><DemoPhotos photos={note.photos} /></section>
    <section className="stitch-card">
      <h2 className="stitch-section-title">Materials &amp; issues</h2>
      {note.materials.length > 0 && <p>{note.materials.map(material => `${material.quantity} ${material.unit} ${material.name} · ${material.action ?? "recorded"}`).join(" · ")} — counted, not costed.</p>}
      {note.issues.length > 0 && <ul>{note.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    </section>
    <div className="diary-confirm-actions">
      <button type="button" className="stitch-button" data-primary disabled={!preview} onClick={() => setConfirmed(true)}>
        <DiaryIcon name="check" size={20} />{preview ? `Confirm and cost it (${formatMoney(preview.total_cost, currency)})` : "Enter a quantity to cost it"}
      </button>
      <Link className="text-link" href="/projects/mock?view=today">Back to Today</Link>
    </div>
  </>;
}

// Demo BoQ rows: each row opens its detail in a bottom sheet over the BoQ
// page — the same pattern as the real BoQ screen's version sheets.
export function MockBoqRows({ rows, currency }: { rows: { item_code: string; description: string; section: string; unit: string; boq_quantity: number; rate: number; cumulative_quantity: number; percentage_complete: number; recorded_cost: number; is_overrun: boolean }[]; currency: string }) {
  const [selected, setSelected] = useState<(typeof rows)[number] | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!selected) return;
    const dialog = sheet.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [selected]);
  return <>
    <section className="stitch-card">
      <div className="stitch-title-row"><h2 className="stitch-section-title">Contract Schedule Items</h2><span className="stitch-kicker">Sorted by trade</span></div>
      <ul className="stitch-boq-items">{rows.map((row, index) => <li key={row.item_code} className="stitch-card scroll-mt-24">
        <button type="button" className="text-link stitch-boq-item-open" onClick={() => setSelected(row)} aria-label={`Open ${row.item_code}`}>
          <span className="stitch-kicker">Item {String(index + 1).padStart(2, "0")} · {row.section}</span>
          <strong>{row.description}</strong>
        </button>
        <dl className="stitch-boq-values">
          <div><dt>Scope qty</dt><dd>{formatQuantityWithUnit(row.boq_quantity, row.unit)}</dd></div>
          <div><dt>Unit rate</dt><dd>{formatMoneyPerUnit(row.rate, currency, row.unit)}</dd></div>
          <div><dt>Line total</dt><dd>{formatMoney(String(row.rate * row.boq_quantity), currency)}</dd></div>
        </dl>
        <div className="stitch-boq-progress">
          <div className="stitch-title-row"><small>Measured progress</small><strong>{formatQuantityWithUnit(row.cumulative_quantity, row.unit)} · {displayRatio(String(row.percentage_complete))}%</strong></div>
          <progress max={100} value={Math.min(100, row.percentage_complete)} aria-label={`Progress for ${row.description}`} />
          {row.is_overrun && <p className="report-variance">Over BoQ quantity — check this item.</p>}
        </div>
      </li>)}</ul>
    </section>
    {selected && <dialog ref={sheet} className="action-dialog stitch-sheet" aria-label={selected.description} onClose={() => setSelected(null)}>
      <div className="action-dialog__body">
        <h2>{selected.description}</h2>
        <p>{selected.item_code} · {selected.section}</p>
        <dl className="stitch-boq-values">
          <div><dt>Scope qty</dt><dd>{formatQuantityWithUnit(selected.boq_quantity, selected.unit)}</dd></div>
          <div><dt>Unit rate</dt><dd>{formatMoneyPerUnit(selected.rate, currency, selected.unit)}</dd></div>
          <div><dt>Line total</dt><dd>{formatMoney(String(selected.rate * selected.boq_quantity), currency)}</dd></div>
        </dl>
        <p>Measured {formatQuantityWithUnit(selected.cumulative_quantity, selected.unit)} · {displayRatio(String(selected.percentage_complete))}% complete · {formatMoneyLabel(formatMoney(String(selected.recorded_cost), currency), "earned")}</p>
        {selected.is_overrun && <p className="report-variance">Over BoQ quantity — check this item.</p>}
        <p>Demo BoQ — read-only. Locked reports keep the version they were locked with.</p>
      </div>
      <div className="action-dialog__actions stitch-sheet-actions"><button type="button" className="stitch-button" onClick={() => { sheet.current?.close(); setSelected(null); }}>Close</button></div>
    </dialog>}
  </>;
}

// Demo team rows: each member opens a detail sheet with role and
// permissions — the same pattern as the real team screen.
export function MockTeamMembers({ members }: { members: DemoTeamMember[] }) {
  const [selected, setSelected] = useState<DemoTeamMember | null>(null);
  const [resent, setResent] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!selected) return;
    const dialog = sheet.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [selected]);
  return <>
    <section className="stitch-card">
      <div className="stitch-title-row"><h2 className="stitch-section-title">Site team &amp; access</h2><span className="stitch-kicker">Field diary permissions</span></div>
      <ul>{members.map(member => <li key={member.name}>
        <button type="button" className="stitch-menu-row" onClick={() => { setResent(false); setSelected(member); }}>
          <DiaryIcon name="profile" /><span><strong>{member.name}</strong><small>{member.role} · {member.access}</small></span>
          {member.status === "pending" ? <span className="stitch-chip">Pending</span> : <DiaryIcon name="chevron" size={18} />}
        </button>
      </li>)}</ul>
    </section>
    {selected && <dialog ref={sheet} className="action-dialog stitch-sheet" aria-label={selected.name} onClose={() => setSelected(null)}>
      <div className="action-dialog__body">
        <h2>{selected.name}</h2>
        <p>{selected.role} · {selected.access}</p>
        <p>{selected.permissions}</p>
        {selected.status === "pending" && <p>Invitation link sent. Expires in 48 hours.</p>}
        {selected.status === "pending" && (resent
          ? <p role="status">Invite re-sent (demo).</p>
          : <button type="button" className="stitch-button" onClick={() => setResent(true)}>Resend invite</button>)}
        <p>Demo member — no real contact details.</p>
      </div>
      <div className="action-dialog__actions stitch-sheet-actions"><button type="button" className="stitch-button" onClick={() => { sheet.current?.close(); setSelected(null); }}>Close</button></div>
    </dialog>}
  </>;
}
