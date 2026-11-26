import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { readReportInput } from "@/lib/reports/data";
import { reportFromInput, displayDate } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { ReportDocument } from "@/components/report-document";
import { ReportActions } from "@/components/report-actions";
import { ApprovalForm } from "@/components/approval-form";
import { AmendmentForm } from "@/components/amendment-form";
import { getReviewer, reportVersion } from "@/lib/log/data";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { WorkFlow, WorkIntro } from "@/components/work-flow";
import { ReportShare } from "@/components/report-share";
import { privateHistory } from "@/lib/projects/data";
import { decimal } from "@/lib/costing/decimal";
import { displayTimestamp } from "@/lib/reports/model";
export const metadata: Metadata = { title: "Daily site report — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> };
async function Report(props: Props) {
  await connection();
  const { id } = await props.params;
  const result = await Promise.all([readReportInput(id), getReviewer(id)])
    .then(([input, reviewer]) => ({ input, reviewer, report: input ? reportFromInput(input) : null })).catch(() => undefined);
  if (result === undefined) return <p>Your site note is saved. We couldn’t load the report just now; reopen the link to try again.</p>;
    const { input, report, reviewer } = result;
    if (!input) return <><TelegramAccountEntry /><p>Sign in and open an authorized project to read this report.</p><Link prefetch={false} className="inline-flex min-h-12 items-center underline" href="/account">Open your account</Link></>;
    if (!report) return <><h1 className="font-serif text-3xl">Your site note is saved</h1>
      {reviewer?.archived ? <p className="mt-3">This project is archived. Its site note is preserved; the owner must restore the project before creating a report.</p> : input.source.status === "confirmed" ? <><p className="mt-3">Create a costed report from the quantities you confirmed.</p><ReportActions id={id} /></>
        : <p className="mt-3">Confirm the quantities before creating a report.</p>}
      <Link prefetch={false} className="block min-h-12 py-3 underline" href={`/confirm/${id}`}>Review site note</Link></>;
    if (report.status==="locked" && reviewer?.canReview && !reviewer.archived && (await props.searchParams).view==="amendment") return <>
      <WorkIntro label="Correction to a locked report" title="Add an amendment"><p>{report.document.source.project.name} · {displayDate(report.document.source.date)}</p></WorkIntro>
      <nav className="work-tabs" aria-label="Report sections"><Link href={`/reports/${id}`} prefetch={false}>Report</Link><Link href={`/reports/${id}?view=amendment`} prefetch={false} aria-current="page">Amendment</Link><Link href={`/log/${id}`} prefetch={false}>Dispute log</Link></nav>
      <div className="settings-content"><AmendmentForm id={id}/></div>
    </>;
    const source=report.document.source;
    const history=await privateHistory(source.project.id).catch(()=>null);
    const sameDay=history?.submissions.filter(note=>note.date===source.date&&note.total_cost!=null).toReversed()??[];
    const dayAmount=sameDay.reduce((sum,note)=>sum.plus(decimal(note.total_cost!,"report total")),decimal("0","daily total"));
    return <>
      <WorkFlow step="report"/>
      <section className="work-state report-toolbar"><p className="eyebrow">{report.status==="locked"?"Approved & locked":"Draft report"}</p><h2>{report.status==="locked"?"Your approved site record":"Review the costed report"}</h2><p>{report.status==="locked"?"Download the client PDF or open the dispute log.":reviewer?.role==="pm"?"Check the record below, then approve it to lock the evidence.":"The project PM will review and approve this draft."}</p>
        {report.status === "draft" && !report.stale && !reviewer?.archived && reviewer?.canApprove && <ApprovalForm id={id} version={reportVersion(report)} reviewer={reviewer.name} project={report.document.source.project.name} date={displayDate(report.document.source.date)} amount={formatMoney(report.document.costing.total_cost,report.document.currency)} />}
      </section>
      {reviewer?.archived && <p role="status" className="mb-5 border-l-4 border-accent p-4">Archived project. Existing records are preserved. The owner must restore it before new work can be saved.</p>}
      <nav aria-label="Report actions" className="report-toolbar mb-5 flex flex-wrap items-center gap-3">
        {!report.stale && <a download href={`/api/reports/${id}/pdf`} className={"work-button "+(report.status==="locked"?"work-button-primary":"")} data-tour="download-pdf">Download PDF</a>}
        {report.status === "locked" && reviewer?.canApprove && <ReportShare id={id}/>}
        {reviewer?.canReview&&<Link prefetch={false} href={`/confirm/${id}`} className="min-h-12 px-3 py-3 underline">{report.status === "locked" ? "View original site note" : "Correct site note"}</Link>}
        <Link prefetch={false} href={`/log/${id}`} className="min-h-12 px-3 py-3 underline">Dispute log</Link>
        {report.document.source.guest_origin && <Link prefetch={false} href={`/trial/original/${id}`} className="min-h-12 px-3 py-3 underline">Original guest trial</Link>}
        {report.status === "locked" && reviewer?.canReview && !reviewer.archived && <AmendmentForm id={id} sheet/>}
      </nav>
      {report.stale && <p role="status" className="mb-4 border-l-4 border-amber-700 bg-amber-50 p-4">The confirmation or BoQ changed. Rebuild this draft before downloading it.</p>}
      {report.status === "draft" && reviewer?.canReview && !reviewer.archived && <div className="report-toolbar"><ReportActions id={id} weather={report.document.weather} exists /></div>}
      <ReportDocument report={report} />
      {sameDay.length>0&&<section className="diary-panel" data-tour="day-submissions"><div className="diary-panel-heading"><h2>Today’s costed submissions</h2><strong>{formatMoney(dayAmount.toFixed(),report.document.currency)}</strong></div><ol className="diary-list">{sameDay.map(note=><li key={note.id}><Link href={`/reports/${note.id}`} prefetch={false} aria-current={note.id===id?"page":undefined}><span><strong>{note.report_status==="locked"?"Locked report":"Draft report"}</strong><small>{note.captured_at?displayTimestamp(note.captured_at,source.project.timezone):displayDate(note.date)}</small>{note.summary_items?.map((item,index)=><small key={index}>{item}</small>)}</span><strong>{formatMoney(note.total_cost!,report.document.currency)}</strong></Link></li>)}</ol></section>}
      <div className="report-toolbar">
        {report.status === "draft" && reviewer?.role === "foreman" && <p className="my-5">Awaiting project manager approval. Your draft remains correctable until it is locked.</p>}
      </div>
    </>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Suspense fallback={<DiaryNotice busy title="Opening your report…">Loading the costed record and checking access.</DiaryNotice>}><Report {...props} /></Suspense></main>;
}
