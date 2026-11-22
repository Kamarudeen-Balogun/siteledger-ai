import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateProjects, privateTeam } from "@/lib/projects/data";
import { TeamManagement } from "@/components/project-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
export const metadata={title:"Project team — SiteLedger AI",robots:{index:false,follow:false}};
async function TeamContent({params}:{params:Promise<{id:string}>}){const{id}=await params;if(!UUID.test(id))notFound();const projects=await privateProjects(),project=projects?.projects.find(p=>p.id===id);if(!project?.owner)notFound();const team=await privateTeam(id);if(!team)notFound();return <><Link href={`/projects/${id}`} className="inline-flex min-h-12 items-center underline">Project records</Link><h1 className="mt-5 font-serif text-3xl">{project.name} / Team</h1><div className="team-layout"><TeamManagement project={project} team={team}/></div></>;}
export default function TeamPage(props:{params:Promise<{id:string}>}){return <main className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects"/><Suspense fallback={<DiaryNotice busy title="Opening the project team…">Checking owner access and active memberships.</DiaryNotice>}><TeamContent {...props}/></Suspense></main>;}
