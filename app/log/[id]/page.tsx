import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDisputeLog } from "@/lib/log/data";
import { DisputeLogDocument } from "@/components/dispute-log";
export const metadata: Metadata = { title: "Dispute log — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ access?: string }> };
async function Log(props: Props) {
  await connection(); const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const access = typeof query.access === "string" ? query.access : "";
  const result = await getDisputeLog(id, access).then(log => ({ log })).catch(() => null);
  if (!result) return <p>Could not open the log. Your records are preserved; reopen the link to try again.</p>;
  if (!result.log) return <p>Open the private dispute log from your report. Send /today in Telegram if you need a fresh review button.</p>;
  return <><a href={`/reports/${id}?access=${encodeURIComponent(access)}`} className="mb-4 inline-block min-h-12 py-3 underline">Back to report</a><DisputeLogDocument log={result.log} /></>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-4xl px-5 py-7 sm:px-8"><Suspense fallback={<p role="status">Opening the dispute log…</p>}><Log {...props} /></Suspense></main>;
}
