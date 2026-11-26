import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateProjects, privateTeam } from "@/lib/projects/data";
import { TeamManagement } from "@/components/project-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Project team — SiteLedger AI",robots:{index:false,follow:false}};
async function TeamContent({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){
  const {id}=await params;if(!UUID.test(id))notFound();
  const [projects,team]=await Promise.all([privateProjects(),privateTeam(id)]),project=projects?.projects.find(p=>p.id===id);
  if(!project||!team)notFound();
  const sections=[["members","Members"],...(project.permissions?.invite_members||project.owner?[["invitations","Invitations"]]:[]),...(project.owner?[["settings","Settings"]]:[])];
  const requested=(await searchParams).section,section=requested&&(requested==="invitations"||requested==="settings")&&sections.some(([key])=>key===requested)?requested:"members";
  return <><Link href={`/projects/${id}`} className="project-breadcrumb">Project overview</Link><h1 className="mt-5 font-serif text-3xl">Projects &amp; team</h1><p className="mt-3">{project.name}</p><div className="settings-layout"><nav aria-label="Team sections" className="work-tabs settings-nav">{sections.map(([key,label])=><Link key={key} href={`/projects/${id}/team?section=${key}`} prefetch={false} aria-current={section===key?"page":undefined}>{label}</Link>)}</nav><div className="settings-content"><TeamManagement project={project} team={team} section={section}/></div></div></>;
}
export default function TeamPage(props:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){return <main className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects"/><Suspense fallback={<DiaryNotice busy title="Opening the project team…">Checking owner access and active memberships.</DiaryNotice>}><TeamContent {...props}/></Suspense></main>;}
