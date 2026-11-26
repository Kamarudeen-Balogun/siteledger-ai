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
  if (!result) return <DiaryNotice tone="error" title="Could not open the log">Your records are preserved; reopen the link to try again.</DiaryNotice>;
  if (!result.log) return <><TelegramAccountEntry /><p>Sign in and open an authorized project to read its dispute log.</p><Link prefetch={false} className="inline-flex min-h-12 items-center underline" href="/account">Open your account</Link></>;
  return <><div className="mb-4 flex flex-wrap items-center gap-3"><Link prefetch={false} href={`/reports/${id}`} className="text-link">Back to report</Link>{result.reviewer?.canReview&&!result.reviewer.archived&&result.log.entries.some(entry=>entry.kind==="report"&&entry.submission_id===id)&&<AmendmentForm id={id} sheet/>}</div><DisputeLogDocument log={result.log} canShare={result.reviewer?.canApprove} /></>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><WorkspaceHeader current="reports"/><Suspense fallback={<DiaryNotice busy title="Opening the dispute log…">Loading authorized locked records and amendments.</DiaryNotice>}><Log {...props} /></Suspense></main>;
}
