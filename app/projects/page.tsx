import { Suspense } from "react";
import Link from "next/link";
import { privateProjects } from "@/lib/projects/data";
import { CreateProject, ProjectSelection } from "@/components/project-forms";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { TrialReturnLink } from "@/components/trial-return-link";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Your projects — SiteLedger AI",robots:{index:false,follow:false}};
async function ProjectsContent({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const data = await privateProjects();
  if (!data) return <><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> to open your private projects.</p></>;
  if (!data.account.name_confirmed_at) return <p className="my-6 leading-7"><Link href="/account" className="underline">Confirm your professional name</Link> before creating or selecting a project.</p>;
  return (await searchParams).view === "create" ? <CreateProject/> : <ProjectSelection projects={data.projects} active={data.active_project_id}/>;
}
export default function ProjectsPage(props:{searchParams:Promise<{view?:string}>}){return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects"/><Suspense fallback={null}><TrialReturnLink/></Suspense><Suspense fallback={<DiaryNotice busy title="Opening your projects…">Checking your membership.</DiaryNotice>}><ProjectsContent {...props}/></Suspense></main>;}
