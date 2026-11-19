import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { readReportInput } from "@/lib/reports/data";
import { reportFromInput } from "@/lib/reports/model";
import { ReportDocument } from "@/components/report-document";
import { ReportActions } from "@/components/report-actions";
import { ApprovalForm } from "@/components/approval-form";
import { AmendmentForm } from "@/components/amendment-form";
import { getReviewer, reportVersion } from "@/lib/log/data";
export const metadata: Metadata = { title: "Daily site report — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ access?: string }> };
async function Report(props: Props) {
  await connection();
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const access = typeof query.access === "string" ? query.access : "";
  const result = await Promise.all([readReportInput(id, access), getReviewer(id, access)])
    .then(([input, reviewer]) => ({ input, reviewer, report: input ? reportFromInput(input) : null })).catch(() => undefined);
  if (result === undefined) return <p>Your site note is saved. We couldn’t load the report just now; reopen the link to try again.</p>;
    const { input, report, reviewer } = result;
    if (!input) return <p>Open the private report link from your confirmed site note. If it expired, send /today in Telegram for a fresh review button.</p>;
    if (!report) return <><h1 className="font-serif text-3xl">Your site note is saved</h1>
      {input.source.status === "confirmed" ? <><p className="mt-3">Create a costed report from the quantities you confirmed.</p><ReportActions id={id} access={access} /></>
        : <p className="mt-3">Confirm the quantities before creating a report.</p>}
      <a className="block min-h-12 py-3 underline" href={`/confirm/${id}?access=${encodeURIComponent(access)}`}>Review site note</a></>;
    return <>
      <nav aria-label="Report actions" className="report-toolbar mb-5 flex flex-wrap items-center gap-3">
        {!report.stale && <a download href={`/api/reports/${id}/pdf?access=${encodeURIComponent(access)}`} className="min-h-12 bg-accent px-5 py-3 font-semibold text-white">Download PDF</a>}
        <a href={`/confirm/${id}?access=${encodeURIComponent(access)}`} className="min-h-12 px-3 py-3 underline">{report.status === "locked" ? "View original site note" : "Correct site note"}</a>
        <a href={`/log/${id}?access=${encodeURIComponent(access)}`} className="min-h-12 px-3 py-3 underline">Dispute log</a>
        {report.status === "locked" && <a href="#amendment" className="min-h-12 px-3 py-3 underline">Add an amendment</a>}
      </nav>
      {report.stale && <p role="status" className="mb-4 border-l-4 border-amber-700 bg-amber-50 p-4">The confirmation or BoQ changed. Rebuild this draft before downloading it.</p>}
      {report.status === "draft" && <div className="report-toolbar"><ReportActions id={id} access={access} weather={report.document.weather} exists /></div>}
      <ReportDocument report={report} access={access} />
      <div className="report-toolbar">
        {report.status === "draft" && !report.stale && reviewer?.role === "pm" &&
          <ApprovalForm id={id} access={access} version={reportVersion(report)} reviewer={reviewer.name} />}
        {report.status === "draft" && reviewer?.role === "foreman" && <p className="my-5">Awaiting project manager approval. Your draft remains correctable until it is locked.</p>}
        {report.status === "locked" && <div id="amendment"><AmendmentForm id={id} access={access} /></div>}
      </div>
    </>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-8"><Suspense fallback={<p role="status">Opening your report…</p>}><Report {...props} /></Suspense></main>;
}
