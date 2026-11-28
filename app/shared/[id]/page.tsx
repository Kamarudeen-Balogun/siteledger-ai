import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSharedReport } from "@/lib/reports/sharing";
import { PageLoading } from "@/components/page-loading";
import { ReportDocument } from "@/components/report-document";

export const metadata = { title: "Shared site report — SiteLedger", referrer: "no-referrer" as const, robots: { index: false, follow: false } };

async function SharedReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await readSharedReport(id);
  if (!report) notFound();
  return <>
    <header className="report-toolbar mb-5 flex items-center justify-between gap-3"><Link href="/" className="font-serif text-xl">SiteLedger AI</Link><a href={`/api/shared/${id}/pdf`} download className="work-button work-button-primary">Download PDF</a></header>
    <ReportDocument report={report} sharedPath={`/api/shared/${id}/photos`}/>
  </>;
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <main className="mx-auto max-w-5xl px-4 py-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening shared report…" variant="report"/>}><SharedReport {...props}/></Suspense></main>;
}
