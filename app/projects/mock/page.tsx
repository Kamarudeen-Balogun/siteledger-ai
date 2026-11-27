import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { demoLog,demoReport } from "@/lib/data/demo-documents";
import { formatMoney } from "@/lib/costing/format-money";
import { decimal } from "@/lib/costing/decimal";
import { displayDate, displayRatio, displayWorkTitle, formatMoneyLabel, formatMoneyPerUnit, formatQuantityWithUnit } from "@/lib/reports/model";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PageLoading } from "@/components/page-loading";
import { ReportDocument } from "@/components/report-document";
import { MockReportActions } from "@/components/mock-report-actions";
import { DisputeLogDocument } from "@/components/dispute-log";
import { BoqReview } from "@/components/boq-review";
import { DiaryIcon } from "@/components/diary-icon";

const title="Mock project — demo data";
export const metadata={title,robots:{index:false,follow:false}};
const views=[["today","Today"],["report","Report"],["log","Log"],["boq","BoQ"],["team","Team"]] as const;

async function MockContent({query}:{query:Promise<{view?:string}>}) {
  if(!await currentAccount())redirect("/account");
  const requested=(await query).view,view=views.some(([key])=>key===requested)?requested:"today";
  const sample={...demoReport,document:{...demoReport.document,source:{...demoReport.document.source,project:{...demoReport.document.source.project,name:title}}}};
  const currency=sample.document.currency;
  const [latest]=demoLog.entries.filter(entry=>entry.kind==="report").toSorted((a,b)=>b.timestamp.localeCompare(a.timestamp));
  // Demo totals, computed from the demo price list and the demo log the
  // same way the real BoQ page computes them — no invented figures.
  const allocation=sample.document.source.price_list.reduce((sum,row)=>sum.plus(decimal(row.boq_quantity,"BoQ quantity").times(row.rate)),decimal("0","allocation"));
  const earnedTotal=demoLog.entries.filter(entry=>entry.kind==="report").reduce((sum,entry)=>sum.plus(decimal(entry.total_cost??"0","locked total")),decimal("0","earned"));
  const overall=allocation.gt(0)?earnedTotal.times(100).div(allocation).toNumber():0;
  return <><WorkspaceHeader current="projects" title={title}/><nav className="work-tabs" aria-label="Mock project sections">{views.map(([key,label])=><Link key={key} href={`/projects/mock?view=${key}`} aria-current={key===view?"page":undefined}>{label}</Link>)}</nav>
    {view==="today"&&<>
      <div className="diary-today-actions"><Link href="/today" className="diary-primary" data-tour="add-work"><DiaryIcon name="plus" size={26}/>Add today&apos;s work</Link><a href="https://t.me/SiteLedgerNGbot" className="diary-row-link" target="_blank" rel="noreferrer"><DiaryIcon name="send" size={20}/><strong>Send via Telegram</strong><span className="stitch-chip">@SiteLedgerNGbot</span></a></div>
      <p className="stitch-card">Demo data — this project is a safe copy to explore. Record work in your own project.</p>
      <section className="stitch-card stitch-drafts" aria-labelledby="today-drafts" data-tour="drafts"><div className="stitch-title-row">
        <h2 id="today-drafts"><DiaryIcon name="pending" size={20}/>Awaiting review <span className="stitch-chip">0</span></h2><span className="stitch-kicker">Not costed yet</span></div>
        <p>Open a draft to check the details, edit quantities, or finish costing it later.</p><p>No notes waiting for review.</p></section>
      <section className="stitch-card stitch-drafts" data-tour="day-submissions"><div className="stitch-title-row"><h2><DiaryIcon name="receipt" size={20}/>Today&apos;s submissions</h2></div>
        <p>No site notes have been submitted today.</p>
        <div className="stitch-day-total"><span className="stitch-kicker">Day total (costed so far)</span><strong>—</strong></div></section>
      <section className="stitch-card stitch-ledger"><span className="stitch-kicker" data-ink="orange">Daily ledger entry</span><h2>{displayDate(sample.document.source.date)}</h2><Link href="/projects/mock?view=report" className="stitch-menu-row"><DiaryIcon name="lock"/>Open last locked report<DiaryIcon name="chevron" size={18}/></Link></section>
      <section className="stitch-card diary-progress" data-tour="measured-progress"><div className="stitch-title-row"><h2><DiaryIcon name="progress" size={20}/>Work Progress — Measured</h2></div><p className="stitch-kicker" data-ink="green">Locked reports</p>
        <div className="diary-progress-summary"><strong>{displayRatio(String(overall))}% complete</strong><span>{formatMoneyLabel(formatMoney(earnedTotal.toFixed(), currency), "earned")}</span></div>
        <progress max={100} value={Math.min(100,overall)} aria-label="Measured project progress"/>
        <dl>{sample.document.costing.items.map((item,index)=><div key={index}><dt>{displayWorkTitle(sample.document.source.price_list.find(price=>price.id===item.boq_item_id)?.description, sample.document.source.items[index].description)}</dt><dd>{formatQuantityWithUnit(item.cumulative_quantity, item.unit)} · {displayRatio(item.percentage_complete)}%</dd></div>)}</dl>
        <Link className="text-link" href="/projects/mock?view=boq">View all work progress</Link></section>
    </>}
    {view==="report"&&<ReportDocument report={sample} demoPhotos actions={<MockReportActions/>}/>}
    {view==="log"&&<DisputeLogDocument log={{...demoLog,project:{...demoLog.project,name:title},entries:demoLog.entries.map(entry=>({...entry,href:entry.submission_id===sample.document.source.submission_id?"/projects/mock?view=report":undefined}))}}/>}
    {view==="boq"&&<>
      <p className="stitch-card">Demo data — read-only. Upload and edit the BoQ in your own project.</p>
      <section className="stitch-card stitch-boq-allocation">
        <div className="stitch-title-row"><h2 className="stitch-kicker" data-ink="orange">Contract ledger allocation</h2><span className="stitch-kicker stitch-chip" data-tone="green">{displayRatio(String(overall))}% earned</span></div>
        <div className="stitch-title-row"><strong>{formatMoney(allocation.toFixed(),currency)}</strong><small>{formatMoney(earnedTotal.toFixed(),currency)} to date</small></div>
        <progress max={100} value={Math.min(100,overall)} aria-label="Contract ledger progress"/>
      </section>
      <div className="stitch-two-actions"><button type="button" className="stitch-button" data-primary disabled><DiaryIcon name="upload" size={20}/>+ Upload BoQ File</button><button type="button" className="stitch-button" data-white disabled><DiaryIcon name="plus" size={20}/>+ Add item</button></div>
      <details className="boq-versions" data-tour="boq-history"><summary><span className="boq-versions__label"><DiaryIcon name="history" size={16}/>Version History</span><DiaryIcon name="chevron" size={16}/></summary>
        <div className="boq-versions__body"><p>No BoQ versions have been saved yet.</p></div></details>
      <BoqReview changes={[]} currency={currency}/>
      <section className="diary-panel"><h1>BoQ &amp; rates</h1><p>{title}</p><dl className="settings-summary">{sample.document.source.price_list.map(row=><div key={row.id}><dt>{row.description}</dt><dd>{formatQuantityWithUnit(row.cumulative_locked_quantity, row.unit)} / {formatQuantityWithUnit(row.boq_quantity, row.unit)} <span>{formatMoneyPerUnit(row.rate, sample.document.currency, row.unit)}</span></dd></div>)}</dl></section>
    </>}
    {view==="team"&&<section className="diary-panel"><h1>Site team</h1><p>{title}</p><dl className="settings-summary"><div><dt>{sample.document.source.submitted_by}</dt><dd>Foreman</dd></div>{latest&&<div><dt>{latest.author}</dt><dd>PM/QS</dd></div>}</dl></section>}
    <Link className="text-link" href="/projects">Back to your projects</Link>
  </>;
}
export default function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  return <main className="mx-auto max-w-5xl px-5 py-7"><Suspense fallback={<PageLoading title="Opening mock project…" variant="rows"/>}> <MockContent query={searchParams}/></Suspense></main>;
}
