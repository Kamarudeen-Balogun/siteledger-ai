import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { demoBoq, demoLog, demoNote2Report, demoReport, demoTeam, demoTodayNotes, demoVersions } from "@/lib/data/demo-documents";
import { formatMoney } from "@/lib/costing/format-money";
import { decimal } from "@/lib/costing/decimal";
import { displayRatio, displayTimestamp, displayWorkTitle, formatMoneyLabel, formatQuantityWithUnit } from "@/lib/reports/model";
import { WorkspaceHeader, type WorkspaceArea } from "@/components/workspace-header";
import { PageLoading } from "@/components/page-loading";
import { ReportDocument } from "@/components/report-document";
import { MockReportActions } from "@/components/mock-report-actions";
import { DisputeLogDocument } from "@/components/dispute-log";
import { BoqReview } from "@/components/boq-review";
import { BoqVersions } from "@/components/boq-versions";
import { MockAddWork, MockBoqActions } from "@/components/mock-project";
import { DiaryIcon } from "@/components/diary-icon";
import { DemoVoicePlayer, MockBoqRows, MockConfirmView, MockNoteDetail, MockTeamMembers } from "@/components/mock-demo";

const title = "Mock project — demo data";
const headerTitle = "Mock project";
export const metadata = { title, robots: { index: false, follow: false } };
// The mock views are switched by the bottom navigation, never by a tab bar:
// these labels are data only (validation + dock area) and render no tabs.
const views = [["today", "Today"], ["report", "Report"], ["log", "Log"], ["boq", "BoQ"], ["team", "Team"]] as const;
const detailViews = ["note", "confirm"] as const;
const viewArea: Record<string, WorkspaceArea> = { today: "today", report: "reports", log: "reports", boq: "boq", team: "projects", note: "today", confirm: "today" };

async function MockContent({ query }: { query: Promise<{ view?: string; note?: string }> }) {
  if (!await currentAccount()) redirect("/account");
  const params = await query;
  const valid = [...views.map(([key]) => key), ...detailViews];
  const requested = params.view ?? "";
  let view = valid.includes(requested as (typeof valid)[number]) ? requested : "today";
  // Detail views exist only for their own note; anything else is Today.
  if (view === "note" && params.note !== "2") view = "today";
  if (view === "confirm" && params.note !== "3") view = "today";
  const sample = { ...demoReport, document: { ...demoReport.document, source: { ...demoReport.document.source, project: { ...demoReport.document.source.project, name: title } } } };
  const note2Report = { ...demoNote2Report, document: { ...demoNote2Report.document, source: { ...demoNote2Report.document.source, project: { ...demoNote2Report.document.source.project, name: title } } } };
  const currency = sample.document.currency;
  // Demo totals, computed from the demo price list and the demo log the
  // same way the real BoQ page computes them — no invented figures.
  const allocation = sample.document.source.price_list.reduce((sum, row) => sum.plus(decimal(row.boq_quantity, "BoQ quantity").times(row.rate)), decimal("0", "allocation"));
  const earnedTotal = demoLog.entries.filter(entry => entry.kind === "report").reduce((sum, entry) => sum.plus(decimal(entry.total_cost ?? "0", "locked total")), decimal("0", "earned"));
  const overall = allocation.gt(0) ? earnedTotal.times(100).div(allocation).toNumber() : 0;
  const dayTotal = demoTodayNotes.reduce((sum, note) => note.total_cost ? sum.plus(decimal(note.total_cost, "demo day total")) : sum, decimal("0", "day total"));
  const awaiting = demoTodayNotes.filter(note => note.state === "draft");
  // The demo day is a Lagos date: pin the formatter to Africa/Lagos so
  // the heading reads 6 Nov 2026 in every timezone. Without a timeZone
  // the midnight +01:00 instant formats as 5 Nov in UTC and west of it.
  const demoDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date("2026-11-06T00:00:00+01:00"));
  // The bottom navigation switches mock views (Today / Reports & Log /
  // BoQ & Rates / Projects & Team), so there is no tab bar here. The header
  // carries the mock project itself, never the previous real project.
  return <><WorkspaceHeader current={viewArea[view ?? "today"]} title={headerTitle} project={headerTitle} />
    {view === "today" && <div className="stitch-today">
      <div className="diary-today-actions"><MockAddWork/><a href="https://t.me/SiteLedgerNGbot" className="diary-row-link" target="_blank" rel="noreferrer"><DiaryIcon name="send" size={20} /><strong>Send via Telegram</strong><span className="stitch-chip">@SiteLedgerNGbot</span></a></div>
      <p className="stitch-card">Demo data — this project is a safe copy to explore. Record work in your own project.</p>
      <section className="stitch-card stitch-drafts" aria-labelledby="today-drafts" data-tour="drafts"><div className="stitch-title-row">
        <h2 id="today-drafts"><DiaryIcon name="pending" size={20} />Awaiting review <span className="stitch-chip">{awaiting.length}</span></h2><span className="stitch-kicker">Not costed yet</span></div>
        <p>Open a draft to check the details, edit quantities, or finish costing it later.</p>
        {awaiting.length ? <ul className="diary-list">{awaiting.map(note => <li key={note.id}><Link href={note.href} prefetch={false}><span><strong>Review site note</strong><small>{displayTimestamp(note.captured_at)}</small></span><DiaryIcon name="chevron" size={18} /></Link></li>)}</ul> : <p>No notes waiting for review.</p>}</section>
      <section className="stitch-card stitch-drafts" data-tour="day-submissions"><div className="stitch-title-row"><h2><DiaryIcon name="receipt" size={20} />Today&apos;s submissions</h2></div>
        <p>Today, {demoDay} — every note from the demo day, in time order.</p>
        {demoTodayNotes.map(note => <article key={note.id} className="stitch-card" aria-label={note.state === "locked" ? "Locked report" : note.state === "costed" ? "Costed draft" : "Draft awaiting review"}>
          <div className="stitch-title-row"><h3>{note.state === "locked" ? "Locked report" : note.state === "costed" ? "Costed draft" : "Awaiting review"}</h3>
            <span className="stitch-chip">{note.total_cost ? formatMoney(note.total_cost, currency) : "Not costed yet"}</span></div>
          <p className="stitch-kicker">{displayTimestamp(note.captured_at)}</p>
          <p>{note.summary}</p>
          <DemoVoicePlayer src={note.audio_url} label="Voice note" />
          <div className="diary-photo-grid">{note.photos.map((photo, i) => <figure key={photo.id}>
            <Image src={photo.storage_url} width={800} height={600} alt={`Demo site photo ${i + 1}`} className="h-auto w-full" />
            <figcaption>{displayTimestamp(photo.captured_at)} · {photo.note}</figcaption>
          </figure>)}</div>
          <Link href={note.href} prefetch={false} className="stitch-menu-row"><DiaryIcon name={note.state === "locked" ? "lock" : "receipt"} />{note.state === "locked" ? "Open locked report" : note.state === "costed" ? "Review costing" : "Review site note"}<DiaryIcon name="chevron" size={18} /></Link>
        </article>)}
        <div className="stitch-day-total"><span className="stitch-kicker">Day total (costed so far)</span><strong>{formatMoney(dayTotal.toFixed(), currency)}</strong></div></section>
      <section className="stitch-card stitch-ledger"><span className="stitch-kicker" data-ink="orange">Daily ledger entry</span><h2>Today, {demoDay}</h2><Link href="/projects/mock?view=report" className="stitch-menu-row"><DiaryIcon name="lock" />Open last locked report<DiaryIcon name="chevron" size={18} /></Link></section>
      <section className="stitch-card diary-progress" data-tour="measured-progress"><div className="stitch-title-row"><h2><DiaryIcon name="progress" size={20} />Work Progress — Measured</h2></div><p className="stitch-kicker" data-ink="green">Locked reports</p>
        <div className="diary-progress-summary"><strong>{displayRatio(String(overall))}% complete</strong><span>{formatMoneyLabel(formatMoney(earnedTotal.toFixed(), currency), "earned")}</span></div>
        <progress max={100} value={Math.min(100, overall)} aria-label="Measured project progress" />
        <dl>{sample.document.costing.items.map((item, index) => <div key={index}><dt>{displayWorkTitle(sample.document.source.price_list.find(price => price.id === item.boq_item_id)?.description, sample.document.source.items[index].description)}</dt><dd>{formatQuantityWithUnit(item.cumulative_quantity, item.unit)} · {displayRatio(item.percentage_complete)}%</dd></div>)}</dl>
        <Link className="text-link" href="/projects/mock?view=boq">View all work progress</Link></section>
    </div>}
    {view === "note" && <MockNoteDetail note={demoTodayNotes[1]} report={note2Report} priceList={sample.document.source.price_list} currency={currency} />}
    {view === "confirm" && <MockConfirmView note={demoTodayNotes[2]} priceList={sample.document.source.price_list} currency={currency} />}
    {view === "report" && <ReportDocument report={sample} demoPhotos actions={<MockReportActions />} />}
    {view === "log" && <DisputeLogDocument log={{ ...demoLog, project: { ...demoLog.project, name: title }, entries: demoLog.entries.map(entry => ({ ...entry, href: entry.submission_id === sample.document.source.submission_id ? "/projects/mock?view=report" : undefined })) }} />}
    {view === "boq" && <>
      <p className="stitch-card">Demo data — read-only. Upload and edit the BoQ in your own project.</p>
      <section className="stitch-card stitch-boq-allocation">
        <div className="stitch-title-row"><h2 className="stitch-kicker" data-ink="orange">Contract ledger allocation</h2><span className="stitch-kicker stitch-chip" data-tone="green">{displayRatio(String(overall))}% earned</span></div>
        <div className="stitch-title-row"><strong>{formatMoney(allocation.toFixed(), currency)}</strong><small>{formatMoney(earnedTotal.toFixed(), currency)} to date</small></div>
        <progress max={100} value={Math.min(100, overall)} aria-label="Contract ledger progress" />
      </section>
      <MockBoqActions />
      <BoqVersions versions={demoVersions} currency={currency} />
      <BoqReview changes={[]} currency={currency} />
      <MockBoqRows rows={demoBoq} currency={currency} />
    </>}
    {view === "team" && <div className="team-workspace">
      <section className="stitch-card stitch-team-overview">
        <div className="stitch-title-row"><h2 className="stitch-kicker" data-ink="orange">Perkins Ltd account</h2><span className="stitch-kicker stitch-chip" data-tone="green">Demo data</span></div>
        <p><strong>{title}</strong><br />{sample.document.source.project.location} · Client: {sample.document.source.project.client}</p>
        <dl className="stitch-boq-values">
          <div><dt>Contract sum</dt><dd>{formatMoney(String(demoBoq.reduce((sum, row) => sum + row.rate * row.boq_quantity, 0)), currency)}</dd></div>
          <div><dt>Value earned</dt><dd>{formatMoney(earnedTotal.toFixed(), currency)}</dd></div>
          <div><dt>Locked reports</dt><dd>{demoLog.entries.filter(entry => entry.kind === "report").length}</dd></div>
        </dl>
      </section>
      <section className="stitch-card stitch-team-telegram">
        <div className="stitch-title-row"><h2 className="stitch-section-title">Telegram bot</h2></div>
        <p>Foremen send voice notes and photos to the bot — no new app to learn.</p>
        <a href="https://t.me/SiteLedgerNGbot" className="diary-row-link" target="_blank" rel="noreferrer"><DiaryIcon name="send" size={20} /><strong>Send via Telegram</strong><span className="stitch-chip">@SiteLedgerNGbot</span></a>
      </section>
      <MockTeamMembers members={demoTeam} />
    </div>}
    <Link className="text-link" href="/projects">Back to your projects</Link>
  </>;
}
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string; note?: string }> }) {
  return <main className="mx-auto max-w-7xl px-5 py-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening mock project…" variant="split" split="6-6" header={<WorkspaceHeader current="today" title={headerTitle} project={headerTitle} />} />}> <MockContent query={searchParams} /></Suspense></main>;
}
