import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getDemoDisputeLog } from "@/lib/log/data";
import { DisputeLogDocument } from "@/components/dispute-log";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata = { title: "Demo dispute log — SiteLedger", referrer: "no-referrer" as const };
async function Demo() {
  await connection(); const log = await getDemoDisputeLog().catch(() => null);
  return log ? <><Link href="/reports/demo" className="mb-4 inline-block min-h-12 py-3 underline">Back to demo report</Link><DisputeLogDocument log={log} /></>
    : <p>The demo log is unavailable. Check the database connection and reopen this page.</p>;
}
export default function Page() {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Suspense fallback={<DiaryNotice busy title="Opening the demo log…">Loading the original fictional record history.</DiaryNotice>}><Demo /></Suspense></main>;
}
