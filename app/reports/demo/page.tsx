import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { getDemoReport } from "@/lib/reports/data";
import { ReportDocument } from "@/components/report-document";
export const metadata: Metadata = { title: "Demo daily report — SiteLedger", robots: { index: false, follow: false } };
async function Demo() {
  await connection();
  const report = await getDemoReport().catch(() => null);
  if (!report) return <p>The demo report is unavailable just now. Try again shortly.</p>;
  return <><nav className="report-toolbar mb-5 flex flex-wrap items-center gap-4"><a download className="min-h-12 bg-accent px-5 py-3 font-semibold text-white" href="/api/reports/demo/pdf">Download demo PDF</a>
    <Link href="/log/demo" className="min-h-12 py-3 underline">Open demo dispute log</Link><p>Fictional seeded record · 6 November 2026</p></nav><ReportDocument report={report} /></>;
}
export default function Page() {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-8"><Suspense fallback={<p role="status">Opening the demo report…</p>}><Demo /></Suspense></main>;
}
