import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDisputeLog, getReviewer } from "@/lib/log/data";
import { privateProjects } from "@/lib/projects/data";
import { DisputeLogDocument } from "@/components/dispute-log";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PageLoading } from "@/components/page-loading";
import { DiaryNotice } from "@/components/diary-notice";
import { AmendmentForm } from "@/components/amendment-form";
import { pageMetadata } from "@/lib/seo";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { ...pageMetadata({ title: "Dispute log — SiteLedger", description: "The append-only dispute log for a SiteLedger project. Locked records can never be silently edited.", path: `/log/${id}` }), robots: { index: false, follow: false }, referrer: "no-referrer" };
  try {
    const log = await getDisputeLog(id);
    if (!log) return fallback;
    const reports = log.entries.filter(entry => entry.kind === "report").length;
    const amendments = log.entries.filter(entry => entry.kind === "amendment").length;
    const title = `Dispute log — ${log.project.name} — SiteLedger AI`;
    const description = `The append-only dispute log for ${log.project.name}: ${reports} locked reports and ${amendments} amendments. Locked records can never be silently edited.`;
    return { ...pageMetadata({ title, description, path: `/log/${id}` }), robots: { index: false, follow: false }, referrer: "no-referrer" };
  } catch {
    return fallback;
  }
}
type Props = { params: Promise<{ id: string }> };
async function Log(props: Props) {
  await connection(); const { id } = await props.params;
  const result = await Promise.all([getDisputeLog(id),getReviewer(id)]).then(([log,reviewer]) => ({ log,reviewer })).catch(() => null);
  if (!result) return <><WorkspaceHeader current="reports"/><DiaryNotice tone="error" title="Could not open the log">Reopen the link to try again.</DiaryNotice></>;
  if (!result.log) return <><WorkspaceHeader current="reports"/><TelegramAccountEntry /><p>Sign in and open an authorized project to read its dispute log.</p><Link prefetch={false} className="text-link" href="/account">Open your account</Link></>;
  // A dispute log belongs to one project. If the active project has
  // switched since this URL was opened, do not show the old project's
  // log — send the user to the active project's Reports & Log instead.
  const active = await privateProjects().catch(() => null);
  if (active?.active_project_id && result.log.project.id !== active.active_project_id) redirect("/reports");
  const canAmend = result.reviewer?.canReview && !result.reviewer.archived && result.log.entries.some(entry=>entry.kind==="report"&&entry.submission_id===id);
  return <><WorkspaceHeader current="reports" project={result.log.project.name} projectId={result.log.project.id}/>
    <DisputeLogDocument log={result.log} canShare={result.reviewer?.canView} actions={canAmend?<AmendmentForm id={id} sheet primary/>:undefined}/>
    <Link prefetch={false} href={`/reports/${id}`} className="text-link">Back to report</Link>
  </>;
}
export default function Page(props: Props) {
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening the dispute log…" variant="report" header={<WorkspaceHeader current="reports"/>}/>}> <Log {...props} /></Suspense></main>;
}
