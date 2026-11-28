import { Suspense } from "react";
import Link from "next/link";
import { privateProjects, pendingInvites } from "@/lib/projects/data";
import { CreateProject, ProjectSelection } from "@/components/project-forms";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PageLoading } from "@/components/page-loading";
import { MockProjectControl } from "@/components/mock-project";
export const metadata={title:"Your projects — SiteLedger AI",robots:{index:false,follow:false}};
async function ProjectsContent({ searchParams }: { searchParams: Promise<{ view?: string; from?: string }> }) {
  const data = await privateProjects();
  if (!data) return <><WorkspaceHeader current="projects"/><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> to open your private projects.</p></>;
  if (!data.account.name_confirmed_at) return <><WorkspaceHeader current="projects"/><p className="my-6 leading-7"><Link href="/account" className="underline">Confirm your professional name</Link> before creating or selecting a project.</p></>;
  const query=await searchParams;
  // Invitations addressed to this account, discoverable in-app even if
  // the invitation email was missed. The code itself still comes from
  // the email and is entered on /invite.
  const invites = await pendingInvites().catch(() => []);
  return query.view === "create" ? <><WorkspaceHeader current="projects" title="New Project" detail hideProfile/><CreateProject/></> : <><WorkspaceHeader current="projects"/>
    {invites.length > 0 && <section className="stitch-card" aria-labelledby="pending-invites"><h2 id="pending-invites" className="stitch-section-title">Invitations for you</h2>
      <p>These projects invited you. Open the invitation page and enter the code from the invitation email.</p>
      <ul className="diary-list">{invites.map(invite => <li key={invite.project_id}><Link href="/invite" prefetch={false}><span><strong>{invite.project_name}</strong><small>{invite.client}{invite.role_label ? ` · ${invite.role_label}` : ""}</small></span><span>Join</span></Link></li>)}</ul>
    </section>}
    <ProjectSelection projects={data.projects} active={data.active_project_id} returnToToday={query.from==="today"}/><MockProjectControl person={data.account.profile_id}/></>;
}
export default function ProjectsPage(props:{searchParams:Promise<{view?:string;from?:string}>}){return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening your projects…" header={<WorkspaceHeader current="projects"/>}/>}><ProjectsContent {...props}/></Suspense></main>;}
