import { Suspense } from "react";
import Link from "next/link";
import { privateProjects } from "@/lib/projects/data";
import { CreateProject, ProjectSelection } from "@/components/project-forms";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { MockProjectControl } from "@/components/mock-project";
export const metadata={title:"Your projects — SiteLedger AI",robots:{index:false,follow:false}};
async function ProjectsContent({ searchParams }: { searchParams: Promise<{ view?: string; from?: string }> }) {
  const data = await privateProjects();
  if (!data) return <><WorkspaceHeader current="projects"/><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> to open your private projects.</p></>;
  if (!data.account.name_confirmed_at) return <><WorkspaceHeader current="projects"/><p className="my-6 leading-7"><Link href="/account" className="underline">Confirm your professional name</Link> before creating or selecting a project.</p></>;
  const query=await searchParams;
  return query.view === "create" ? <><WorkspaceHeader current="projects" title="New Project" detail hideProfile/><CreateProject/></> : <><WorkspaceHeader current="projects"/><ProjectSelection projects={data.projects} active={data.active_project_id} returnToToday={query.from==="today"}/><MockProjectControl person={data.account.profile_id}/></>;
}
export default function ProjectsPage(props:{searchParams:Promise<{view?:string;from?:string}>}){return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><Suspense fallback={<><WorkspaceHeader current="projects"/><DiaryNotice busy title="Opening your projects…"/></>}><ProjectsContent {...props}/></Suspense></main>;}
