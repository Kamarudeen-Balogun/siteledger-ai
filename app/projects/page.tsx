import { Suspense } from "react";
import Link from "next/link";
import { privateProjects } from "@/lib/projects/data";
import { CreateProject, ProjectSelection } from "@/components/project-forms";
import { TelegramConnect, TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { TrialReturnLink } from "@/components/trial-return-link";
export const metadata={title:"Your projects — SiteLedger AI",robots:{index:false,follow:false}};
async function ProjectsContent(){const data=await privateProjects();if(!data)return <><TelegramAccountEntry/><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> to open your private projects.</p></>;if(!data.account.name_confirmed_at)return <p className="my-6 leading-7"><Link href="/account" className="underline">Confirm your professional name</Link> before creating or selecting a project.</p>;return <><TelegramConnect account={data.account} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??""}/><div className="project-columns"><ProjectSelection projects={data.projects} active={data.active_project_id}/><CreateProject/></div></>;}
export default function ProjectsPage(){return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects" title="Your projects"/><Suspense fallback={null}><TrialReturnLink/></Suspense><Suspense fallback={<p role="status" className="my-7">Opening your authorized projects…</p>}><ProjectsContent/></Suspense></main>;}
