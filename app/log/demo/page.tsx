import Link from "next/link";
import { demoLog } from "@/lib/data/demo-documents";
import { DisputeLogDocument } from "@/components/dispute-log";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PublicFooter } from "@/components/public-site";
import { pageMetadata } from "@/lib/seo";
const naira = new Intl.NumberFormat("en-NG");
const demoLogReports = demoLog.entries.filter(entry => entry.kind === "report");
const demoLogAmendments = demoLog.entries.filter(entry => entry.kind === "amendment");
const demoLogTotal = demoLogReports.reduce((sum, entry) => sum + Number(entry.total_cost ?? 0), 0);
export const metadata = pageMetadata({
  title: `Demo dispute log — ${demoLog.project.name} — SiteLedger AI`,
  description: `The public append-only dispute log for the SiteLedger demo project: ${demoLogReports.length} locked reports and ${demoLogAmendments.length} amendment, ₦${naira.format(demoLogTotal)} of work locked in — records that can never be silently edited.`,
  path: "/log/demo",
});
function Demo() {
  const log = demoLog;
  return log ? <><Link href="/reports/demo" className="mb-4 inline-block min-h-12 py-3 underline">Back to demo report</Link><DisputeLogDocument log={log} /></>
    : <p>The demo log is unavailable. Check the database connection and reopen this page.</p>;
}
export default function Page() {
  /* The demo log is a public page but renders the workspace header,
     so it had no footer. The `.transplant` wrapper supplies the
     token classes; the workspace layout has no `.transplant`
     ancestor. */
  return <><main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Demo /></main><div className="transplant"><PublicFooter current="/log/demo" /></div></>;
}
