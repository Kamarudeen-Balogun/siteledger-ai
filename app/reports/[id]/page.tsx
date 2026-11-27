import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { readReportInput } from "@/lib/reports/data";
import { reportFromInput, displayDate, displayTimestamp } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { decimal } from "@/lib/costing/decimal";
import { ReportDocument } from "@/components/report-document";
import { ReportActions } from "@/components/report-actions";
import { ApprovalForm } from "@/components/approval-form";
import { AmendmentForm } from "@/components/amendment-form";
import { getReviewer, reportVersion } from "@/lib/log/data";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { DiaryIcon } from "@/components/diary-icon";
import { ReportShare } from "@/components/report-share";
import { privateHistory } from "@/lib/projects/data";

export const metadata: Metadata = { title: "Daily site report — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };

async function Report({ params }: Props) {
  await connection();
  const { id } = await params;
  const result = await Promise.all([readReportInput(id), getReviewer(id)])
    .then(([input, reviewer]) => ({ input, reviewer, report: input ? reportFromInput(input) : null }))
    .catch(() => null);
  if (!result) return <><WorkspaceHeader current="reports"/><DiaryNotice tone="error" title="Could not open your report">Your site note is saved. Reopen the link to try again.</DiaryNotice></>;
  const { input, report, reviewer } = result;
  if (!input) return <><WorkspaceHeader current="reports"/><TelegramAccountEntry/><DiaryNotice title="Report unavailable">Open an authorized project to read this report.<Link prefetch={false} className="text-link ml-2" href="/account">Open your account</Link></DiaryNotice></>;
  const project = input.source.project;
  if (!report) return <><WorkspaceHeader current="reports" project={project.name} projectId={project.id}/>
    <section className="stitch-card"><h1 className="stitch-section-title">Your site note is saved</h1>
      {reviewer?.archived ? <p>The project is archived. Its site note is preserved.</p> : input.source.status === "confirmed" ? <ReportActions id={id}/> : <p>Confirm the quantities before creating a report.</p>}
      <Link prefetch={false} className="text-link" href={`/confirm/${id}`}>Review site note</Link>
    </section>
  </>;

  const { source } = report.document;
  const locked = report.status === "locked";
  const amendable = locked && reviewer?.canReview && !reviewer.archived;
  // Amendments always open as the scrollable sheet (toolbar below) with
  // Confirm pinned — never as a separate inline page. The old
  // ?view=amendment inline form is removed.

  const history = await privateHistory(source.project.id).catch(() => null);
  const sameDay = history?.submissions.filter(note => note.date === source.date && note.total_cost != null).toReversed() ?? [];
  const dayAmount = sameDay.reduce((sum,note) => sum.plus(decimal(note.total_cost!, "report total")),decimal("0", "daily total"));
  return <>
    <WorkspaceHeader current="reports" project={source.project.name} projectId={source.project.id}/>
    <ReportDocument report={report} actions={<>
      <nav aria-label="Report actions" className="stitch-report-actions report-toolbar">
        {locked && reviewer?.canApprove && <ReportShare id={id} primary/>}
        {!report.stale && <a download href={`/api/reports/${id}/pdf`} className="stitch-button" data-tour="download-pdf"><DiaryIcon name="pdf" size={19}/>Download Client PDF</a>}
        {amendable && <AmendmentForm id={id} sheet/>}
      </nav>
      {reviewer?.archived && <p role="status" className="stitch-card">Archived project. The owner can restore the project before new work is added.</p>}
      {report.stale && <p role="status" className="stitch-card stitch-review-warning">The confirmation or BoQ changed. Rebuild this draft before downloading it.</p>}
      {!locked && reviewer?.canReview && !reviewer.archived && <details className="work-disclosure report-toolbar"><summary>Edit draft report details</summary><ReportActions id={id} weather={report.document.weather} exists/></details>}
      {!locked && !report.stale && !reviewer?.archived && reviewer?.canApprove && <ApprovalForm id={id} version={reportVersion(report)} reviewer={reviewer.name} project={source.project.name} date={displayDate(source.date)} amount={formatMoney(report.document.costing.total_cost,report.document.currency)}/>}
    </>}/>
    {sameDay.length > 0 && <section className="stitch-card mt-4" data-tour="day-submissions">
      <div className="stitch-title-row"><h2>Today’s costed submissions</h2><strong>{formatMoney(dayAmount.toFixed(),report.document.currency)}</strong></div>
      <ol className="diary-list">{sameDay.map(note=><li key={note.id}><Link href={`/reports/${note.id}`} prefetch={false} aria-current={note.id===id?"page":undefined}>
        <span><strong>{note.report_status==="locked"?"Locked report":"Draft report"}</strong><small>{note.captured_at?displayTimestamp(note.captured_at,source.project.timezone):displayDate(note.date)}</small>{note.summary_items?.map((item,index)=><small key={index}>{item}</small>)}</span>
        <strong>{formatMoney(note.total_cost!,report.document.currency)}</strong>
      </Link></li>)}</ol>
    </section>}
    <nav aria-label="Related records" className="stitch-menu-list mt-4">
      <Link prefetch={false} href={`/log/${id}`} className="stitch-menu-row"><DiaryIcon name="lock"/><span>Dispute log</span><DiaryIcon name="chevron"/></Link>
      {reviewer?.canReview && <Link prefetch={false} href={`/confirm/${id}`} className="stitch-menu-row"><DiaryIcon name="mic"/><span>{locked?"View original site note":"Correct site note"}</span><DiaryIcon name="chevron"/></Link>}
      {source.guest_origin && <Link prefetch={false} href={`/trial/original/${id}`} className="stitch-menu-row"><DiaryIcon name="history"/><span>Original guest trial</span><DiaryIcon name="chevron"/></Link>}
    </nav>
  </>;
}

export default function Page(props: Props) {
  return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><Suspense fallback={<><WorkspaceHeader current="reports"/><DiaryNotice busy title="Opening your report…"/></>}><Report {...props}/></Suspense></main>;
}
