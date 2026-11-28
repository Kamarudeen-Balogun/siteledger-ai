import Link from "next/link";
import { Suspense } from "react";
import { AmendmentForm } from "@/components/amendment-form";
import { DiaryNotice } from "@/components/diary-notice";
import { DisputeLogDocument } from "@/components/dispute-log";
import { PageLoading } from "@/components/page-loading";
import { WorkspaceHeader } from "@/components/workspace-header";
import { getDisputeLog, getReviewer } from "@/lib/log/data";
import { privateHistory, privateProjects } from "@/lib/projects/data";

export const metadata = { title: "Reports & Log — SiteLedger", robots: { index: false, follow: false } };

async function Reports() {
  const list = await privateProjects();
  const data = list?.active_project_id ? await privateHistory(list.active_project_id) : null;
  if (!data) return <>
    <WorkspaceHeader current="reports"/>
    <section className="stitch-card"><h1 className="stitch-section-title">Reports &amp; Log</h1><p>{list ? "Select a project to see its reports." : "Sign in to see your site reports."}</p><Link href={list ? "/projects" : "/account"} className="stitch-button mt-3" data-primary>{list ? "Choose project" : "Sign in"}</Link></section>
  </>;
  // This page is the mock's Log screen: the sealed log for the active
  // project — locked reports and their amendments, with the sealed totals,
  // the filters and the amendment entry point at the bottom. Drafts and
  // notes awaiting review do not belong here; they live on Today and the
  // project overview, and are only pointed at from here.
  const locked = data.submissions.filter(note => note.report_status === "locked");
  const drafts = data.submissions.filter(note => note.report_status !== "locked");
  const latest = locked[0];
  const result = latest ? await Promise.all([getDisputeLog(latest.id), getReviewer(latest.id)]).then(([log, reviewer]) => ({ log, reviewer })).catch(() => null) : null;
  const log = result?.log;
  const canAmend = Boolean(result?.reviewer?.canReview && !result.reviewer.archived && locked.length);
  const tallies = Object.fromEntries(data.submissions.map(note => [note.id, note.summary_items ?? []]));
  return <>
    <WorkspaceHeader current="reports" project={data.project.name} projectId={data.project.id}/>
    {log
      ? <DisputeLogDocument log={log} tallies={tallies} canShare={result?.reviewer?.canView} actions={canAmend && latest ? <AmendmentForm id={latest.id} sheet primary/> : undefined}/>
      : <DiaryNotice title="No locked reports yet">Approved reports appear here once they are locked.</DiaryNotice>}
    {drafts.length > 0 && <p className="mt-4"><Link className="text-link" href="/today">{drafts.length} {drafts.length === 1 ? "note is" : "notes are"} awaiting review on Today</Link></p>}
  </>;
}

export default function Page() {
  return <main className="mx-auto min-h-svh max-w-5xl px-5 py-7 sm:px-10">
    <Suspense fallback={<PageLoading title="Opening reports…" variant="report" header={<WorkspaceHeader current="reports"/>}/>}> <Reports/></Suspense>
  </main>;
}
