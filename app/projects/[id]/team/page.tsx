import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateProjects, privateTeam } from "@/lib/projects/data";
import { TeamManagement } from "@/components/project-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Project team — SiteLedger AI",robots:{index:false,follow:false}};
async function TeamContent({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){const{id}=await params;if(!UUID.test(id))notFound();const projects=await privateProjects(),project=projects?.projects.find(p=>p.id===id);if(!project?.owner)notFound();const team=await privateTeam(id);if(!team)notFound();const requested=(await searchParams).section,section=requested==="invitations"||requested==="settings"?requested:"members";return <><Link href={`/projects/${id}`} className="inline-flex min-h-12 items-center underline">Project overview</Link><h1 className="mt-5 font-serif text-3xl">Team & settings</h1><p className="mt-3">{project.name}</p><div className="settings-layout"><nav aria-label="Team sections" className="work-tabs settings-nav">{[["members","Members"],["invitations","Invitations"],["settings","Settings"]].map(([key,label])=><Link key={key} href={`/projects/${id}/team?section=${key}`} prefetch={false} aria-current={section===key?"page":undefined}>{label}</Link>)}</nav><div className="settings-content"><TeamManagement project={project} team={team} section={section}/></div></div></>;}
export default function TeamPage(props:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){return <main className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects"/><Suspense fallback={<DiaryNotice busy title="Opening the project team…">Checking owner access and active memberships.</DiaryNotice>}><TeamContent {...props}/></Suspense></main>;}
