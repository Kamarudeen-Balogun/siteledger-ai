import { Suspense } from "react";
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
export const metadata: Metadata = { title: "Daily site report — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };
async function Report(props: Props) {
  await connection();
  const { id } = await props.params;
  const result = await Promise.all([readReportInput(id), getReviewer(id)])
    .then(([input, reviewer]) => ({ input, reviewer, report: input ? reportFromInput(input) : null })).catch(() => undefined);
  if (result === undefined) return <p>Your site note is saved. We couldn’t load the report just now; reopen the link to try again.</p>;
    const { input, report, reviewer } = result;
    if (!input) return <><TelegramAccountEntry /><p>Sign in and open an authorized project to read this report.</p><a className="inline-flex min-h-12 items-center underline" href="/account">Open your account</a></>;
    if (!report) return <><h1 className="font-serif text-3xl">Your site note is saved</h1>
      {reviewer?.archived ? <p className="mt-3">This project is archived. Its site note is preserved; the owner must restore the project before creating a report.</p> : input.source.status === "confirmed" ? <><p className="mt-3">Create a costed report from the quantities you confirmed.</p><ReportActions id={id} /></>
        : <p className="mt-3">Confirm the quantities before creating a report.</p>}
      <a className="block min-h-12 py-3 underline" href={`/confirm/${id}`}>Review site note</a></>;
    return <>
      {reviewer?.archived && <p role="status" className="mb-5 border-l-4 border-accent p-4">Archived project. Existing records are preserved. The owner must restore it before new work can be saved.</p>}
      <nav aria-label="Report actions" className="report-toolbar mb-5 flex flex-wrap items-center gap-3">
        {!report.stale && <a download href={`/api/reports/${id}/pdf`} className="min-h-12 bg-accent px-5 py-3 font-semibold text-white">Download PDF</a>}
        <a href={`/confirm/${id}`} className="min-h-12 px-3 py-3 underline">{report.status === "locked" ? "View original site note" : "Correct site note"}</a>
        <a href={`/log/${id}`} className="min-h-12 px-3 py-3 underline">Dispute log</a>
        {report.document.source.guest_origin && <a href={`/trial/original/${id}`} className="min-h-12 px-3 py-3 underline">Original guest trial</a>}
        {report.status === "locked" && !reviewer?.archived && <a href="#amendment" className="min-h-12 px-3 py-3 underline">Add an amendment</a>}
      </nav>
      {report.stale && <p role="status" className="mb-4 border-l-4 border-amber-700 bg-amber-50 p-4">The confirmation or BoQ changed. Rebuild this draft before downloading it.</p>}
      {report.status === "draft" && !reviewer?.archived && <div className="report-toolbar"><ReportActions id={id} weather={report.document.weather} exists /></div>}
      <ReportDocument report={report} />
      <div className="report-toolbar">
        {report.status === "draft" && !report.stale && !reviewer?.archived && reviewer?.role === "pm" &&
          <ApprovalForm id={id} version={reportVersion(report)} reviewer={reviewer.name} project={report.document.source.project.name} date={displayDate(report.document.source.date)} amount={formatMoney(report.document.costing.total_cost,report.document.currency)} />}
        {report.status === "draft" && reviewer?.role === "foreman" && <p className="my-5">Awaiting project manager approval. Your draft remains correctable until it is locked.</p>}
        {report.status === "locked" && !reviewer?.archived && <div id="amendment"><AmendmentForm id={id} /></div>}
      </div>
    </>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Suspense fallback={<p role="status">Opening your report…</p>}><Report {...props} /></Suspense></main>;
}
