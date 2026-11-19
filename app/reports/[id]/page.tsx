import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { readReportInput } from "@/lib/reports/data";
import { reportFromInput } from "@/lib/reports/model";
import { ReportDocument } from "@/components/report-document";
import { ReportActions } from "@/components/report-actions";
export const metadata: Metadata = { title: "Daily site report — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ access?: string }> };
async function Report(props: Props) {
  await connection();
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const access = typeof query.access === "string" ? query.access : "";
  const result = await readReportInput(id, access).then(input => ({ input, report: input ? reportFromInput(input) : null })).catch(() => undefined);
  if (result === undefined) return <p>Your site note is saved. We couldn’t load the report just now; reopen the link to try again.</p>;
    const { input, report } = result;
    if (!input) return <p>Open the private report link from your confirmed site note. If it expired, send /today in Telegram for a fresh review button.</p>;
    if (!report) return <><h1 className="font-serif text-3xl">Your site note is saved</h1>
      {input.source.status === "confirmed" ? <><p className="mt-3">Create a costed report from the quantities you confirmed.</p><ReportActions id={id} access={access} /></>
        : <p className="mt-3">Confirm the quantities before creating a report.</p>}
      <a className="block min-h-12 py-3 underline" href={`/confirm/${id}?access=${encodeURIComponent(access)}`}>Review site note</a></>;
    return <>
      <nav aria-label="Report actions" className="report-toolbar mb-5 flex flex-wrap items-center gap-3">
        {!report.stale && <a download href={`/api/reports/${id}/pdf?access=${encodeURIComponent(access)}`} className="min-h-12 bg-accent px-5 py-3 font-semibold text-white">Download PDF</a>}
        <a href={`/confirm/${id}?access=${encodeURIComponent(access)}`} className="min-h-12 px-3 py-3 underline">{report.status === "locked" ? "View original site note" : "Correct site note"}</a>
      </nav>
      {report.stale && <p role="status" className="mb-4 border-l-4 border-amber-700 bg-amber-50 p-4">The confirmation or BoQ changed. Rebuild this draft before downloading it.</p>}
      {report.status === "draft" && <div className="report-toolbar"><ReportActions id={id} access={access} weather={report.document.weather} exists /></div>}
      <ReportDocument report={report} access={access} />
    </>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-8"><Suspense fallback={<p role="status">Opening your report…</p>}><Report {...props} /></Suspense></main>;
}
