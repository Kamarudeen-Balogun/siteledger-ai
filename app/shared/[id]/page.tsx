import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readSharedReport } from "@/lib/reports/sharing";
import { displayDate } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { pageMetadata } from "@/lib/seo";
import { PageLoading } from "@/components/page-loading";
import { ReportDocument } from "@/components/report-document";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { ...pageMetadata({ title: "Shared site report — SiteLedger", description: "A shared locked site report, costed against the Bill of Quantities. Locked into the dispute log — it cannot be silently edited.", path: `/shared/${id}` }), robots: { index: false, follow: false }, referrer: "no-referrer" };
  try {
    const report = await readSharedReport(id);
    if (!report) return fallback;
    const { source } = report.document;
    const total = formatMoney(report.document.costing.total_cost, report.document.currency);
    const date = displayDate(source.date);
    const count = report.document.costing.items.length;
    const title = `Daily site report — ${source.project.name} — ${date} — ${total} — SiteLedger AI`;
    const description = `Shared locked report for ${source.project.name}, ${date}: ${count} items costed against the Bill of Quantities, totalling ${total}. Locked into the dispute log — it cannot be silently edited.`;
    return { ...pageMetadata({ title, description, path: `/shared/${id}`, type: "article", publishedTime: source.date }), robots: { index: false, follow: false }, referrer: "no-referrer" };
  } catch {
    return fallback;
  }
}

async function SharedReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await readSharedReport(id);
  if (!report) notFound();
  return <>
    <header className="report-toolbar mb-5 flex items-center justify-between gap-3"><Link href="/" className="font-serif text-xl">SiteLedger AI</Link><a href={`/api/shared/${id}/pdf`} download className="work-button work-button-primary">Download PDF</a></header>
    <Link href="/" className="text-link">Back to home</Link>
    <ReportDocument report={report} sharedPath={`/api/shared/${id}/photos`}/>
  </>;
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <main className="mx-auto max-w-5xl px-4 py-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening shared report…" variant="report"/>}><SharedReport {...props}/></Suspense></main>;
}
