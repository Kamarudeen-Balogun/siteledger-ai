import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDisputeLog, getReviewer } from "@/lib/log/data";
import { DisputeLogDocument } from "@/components/dispute-log";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { AmendmentForm } from "@/components/amendment-form";
export const metadata: Metadata = { title: "Dispute log — SiteLedger", referrer: "no-referrer", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };
async function Log(props: Props) {
  await connection(); const { id } = await props.params;
  const result = await Promise.all([getDisputeLog(id),getReviewer(id)]).then(([log,reviewer]) => ({ log,reviewer })).catch(() => null);
  if (!result) return <><WorkspaceHeader current="reports"/><DiaryNotice tone="error" title="Could not open the log">Reopen the link to try again.</DiaryNotice></>;
  if (!result.log) return <><WorkspaceHeader current="reports"/><TelegramAccountEntry /><p>Sign in and open an authorized project to read its dispute log.</p><Link prefetch={false} className="text-link" href="/account">Open your account</Link></>;
  const canAmend = result.reviewer?.canReview && !result.reviewer.archived && result.log.entries.some(entry=>entry.kind==="report"&&entry.submission_id===id);
  return <><WorkspaceHeader current="reports" project={result.log.project.name} projectId={result.log.project.id}/>
    <DisputeLogDocument log={result.log} canShare={result.reviewer?.canApprove} actions={canAmend?<AmendmentForm id={id} sheet primary/>:undefined}/>
    <Link prefetch={false} href={`/reports/${id}`} className="text-link">Back to report</Link>
  </>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><Suspense fallback={<><WorkspaceHeader current="reports"/><DiaryNotice busy title="Opening the dispute log…"/></>}><Log {...props} /></Suspense></main>;
}
