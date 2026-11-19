import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getDemoDisputeLog } from "@/lib/log/data";
import { DisputeLogDocument } from "@/components/dispute-log";
export const metadata = { title: "Demo dispute log — SiteLedger", referrer: "no-referrer" as const };
async function Demo() {
  await connection(); const log = await getDemoDisputeLog().catch(() => null);
  return log ? <><Link href="/reports/demo" className="mb-4 inline-block min-h-12 py-3 underline">Back to demo report</Link><DisputeLogDocument log={log} /></>
    : <p>The demo log is unavailable. Check the database connection and reopen this page.</p>;
}
export default function Page() {
  return <main className="mx-auto max-w-4xl px-5 py-7 sm:px-8"><Suspense fallback={<p role="status">Opening the demo log…</p>}><Demo /></Suspense></main>;
}
