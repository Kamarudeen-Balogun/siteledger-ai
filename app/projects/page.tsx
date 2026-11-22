import { Suspense } from "react";
import Link from "next/link";
import { privateProjects } from "@/lib/projects/data";
import { CreateProject, ProjectSelection } from "@/components/project-forms";
import { TelegramConnect, TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { TrialReturnLink } from "@/components/trial-return-link";
import { privateDashboard } from "@/lib/projects/boq-data";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Your projects — SiteLedger AI",robots:{index:false,follow:false}};
async function ProjectsContent() {
  const data = await privateProjects();
  if (!data) return <><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> to open your private projects.</p></>;
  if (!data.account.name_confirmed_at) return <p className="my-6 leading-7"><Link href="/account" className="underline">Confirm your professional name</Link> before creating or selecting a project.</p>;
  const projects = await Promise.all(data.projects.map(async project => {
    const dashboard = await privateDashboard(project.id);
    return { ...project, dashboard: dashboard ? { earned: dashboard.earned, locked_count: dashboard.locked_count } : null };
  }));
  return <><TelegramConnect account={data.account} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} /><div className="project-columns"><ProjectSelection projects={projects} active={data.active_project_id} /><CreateProject /></div></>;
}
export default function ProjectsPage(){return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects" title="Your projects"/><Suspense fallback={null}><TrialReturnLink/></Suspense><Suspense fallback={<DiaryNotice busy title="Opening your projects…">Checking membership and recorded project values.</DiaryNotice>}><ProjectsContent/></Suspense></main>;}
