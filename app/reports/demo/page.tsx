import type { Metadata } from "next";
import Link from "next/link";
import { demoReport } from "@/lib/data/demo-documents";
import { ReportDocument } from "@/components/report-document";
import { WorkspaceHeader } from "@/components/workspace-header";
export const metadata: Metadata = { title: "Demo daily report — SiteLedger", robots: { index: false, follow: false } };
function Demo() {
  const report = demoReport;
  return <><nav className="report-toolbar mb-5 flex flex-wrap items-center gap-4"><a download className="min-h-12 bg-accent px-5 py-3 font-semibold text-white" href="/api/reports/demo/pdf">Download demo PDF</a>
    <Link href="/log/demo" className="min-h-12 py-3 underline">Open demo dispute log</Link><p>Fictional seeded record · 6 November 2026</p></nav><ReportDocument report={report} /></>;
}
export default function Page() {
  return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Demo /></main>;
}
