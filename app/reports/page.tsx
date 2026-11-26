import Link from "next/link";
import { Suspense } from "react";
import { DiaryIcon } from "@/components/diary-icon";
import { DiaryNotice } from "@/components/diary-notice";
import { ProjectRecords } from "@/components/project-records";
import { WorkspaceHeader } from "@/components/workspace-header";
import { privateHistory, privateProjects } from "@/lib/projects/data";

export const metadata = { title: "Reports & Log — SiteLedger", robots: { index: false, follow: false } };

async function Reports({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const list = await privateProjects();
  const data = list?.active_project_id ? await privateHistory(list.active_project_id) : null;
  const approved = data?.submissions.find(note => note.report_status === "locked");
  const log = (await searchParams).view === "log";
  return <>
    <WorkspaceHeader current="reports" project={data?.project.name} projectId={data?.project.id}/>
    {data ? <>
      <div className="stitch-two-actions stitch-report-tabs">
        <Link href="/reports" className="stitch-button" data-primary={!log || undefined} aria-current={!log ? "page" : undefined}><DiaryIcon name="reports" size={18}/>Reports</Link>
        <Link href={approved ? `/log/${approved.id}` : "/reports?view=log"} className="stitch-button" data-primary={log || undefined} aria-current={log ? "page" : undefined}><DiaryIcon name="lock" size={18}/>Dispute log</Link>
      </div>
      {log ? <DiaryNotice title="No locked reports yet">Approved reports appear here once they are locked.</DiaryNotice> : <ProjectRecords notes={data.submissions} timezone={data.access.timezone} currency={data.access.currency}/>}
    </> : <section className="stitch-card"><h1 className="stitch-section-title">Reports &amp; Log</h1><p>{list ? "Select a project to see its reports." : "Sign in to see your site reports."}</p><Link href={list ? "/projects" : "/account"} className="stitch-button mt-3" data-primary>{list ? "Choose project" : "Sign in"}</Link></section>}
  </>;
}

export default function Page(props: { searchParams: Promise<{ view?: string }> }) {
  return <main className="mx-auto min-h-svh max-w-5xl px-5 py-7 sm:px-10">
    <Suspense fallback={<><WorkspaceHeader current="reports"/><DiaryNotice busy title="Opening reports…"/></>}><Reports {...props}/></Suspense>
  </main>;
}
