import Link from "next/link";
import { demoLog } from "@/lib/data/demo-documents";
import { DisputeLogDocument } from "@/components/dispute-log";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PublicFooter } from "@/components/public-site";
export const metadata = { title: "Demo dispute log — SiteLedger", referrer: "no-referrer" as const };
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
