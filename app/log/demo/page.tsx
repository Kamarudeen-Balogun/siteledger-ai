import Link from "next/link";
import { demoLog } from "@/lib/data/demo-documents";
import { DisputeLogDocument } from "@/components/dispute-log";
import { WorkspaceHeader } from "@/components/workspace-header";
export const metadata = { title: "Demo dispute log — SiteLedger", referrer: "no-referrer" as const };
function Demo() {
  const log = demoLog;
  return log ? <><Link href="/reports/demo" className="mb-4 inline-block min-h-12 py-3 underline">Back to demo report</Link><DisputeLogDocument log={log} /></>
    : <p>The demo log is unavailable. Check the database connection and reopen this page.</p>;
}
export default function Page() {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Demo /></main>;
}
