import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateHistory } from "@/lib/projects/data";
import { displayDate } from "@/lib/reports/model";
import { OwnershipAcceptance, StartProjectNote } from "@/components/project-forms";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { privateDashboard } from "@/lib/projects/boq-data";
import { ProjectDashboard } from "@/components/project-dashboard";
import { PageLoading } from "@/components/page-loading";
import { WorkIntro } from "@/components/work-flow";
import { ProjectNavigation } from "@/components/project-navigation";
import { ProjectRecords } from "@/components/project-records";
import { projectStep } from "@/lib/projects/journey";
export const metadata = { title: "Project records — SiteLedger", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
async function History({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await privateHistory(id);
  if (!data) return <><WorkspaceHeader current="projects"/><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> and open an authorized project to view its records.</p></>;
  const { project, access } = data;
  const requested=(await searchParams).view,view=requested==="records"||requested==="progress"?requested:"overview";
  const dashboard = view==="progress" || view==="overview" ? await privateDashboard(id) : null;
  const next = projectStep(data.submissions,access.role,Boolean(access.archived_at));
  return <><WorkspaceHeader current={view==="records"?"reports":"projects"} title={view==="progress"?"Work progress":undefined} project={project.name}/><Link href="/projects" className="project-breadcrumb" prefetch={false}>← Your projects</Link><WorkIntro label={`${access.role_label ?? (access.role === "pm" ? "PM" : "Foreman")} / ${access.currency}`} title={project.name}><p>{project.client} · {project.location}</p></WorkIntro>
    {view!=="overview"&&<ProjectNavigation id={id} current={view} owner={access.owner}/>}
    {access.archived_at && view!=="overview" && <p role="status" className="my-5 border-l-4 border-accent p-4">Archived. Previous records remain available. The owner can restore this project in settings.</p>}
    <OwnershipAcceptance projectId={id} transfers={data.transfers} timezone={access.timezone} />
    {view==="overview"&&<div className="project-home"><section className="project-next" aria-labelledby="project-next-title" data-project-step={next.kind}><p className="eyebrow">{next.kind==="archived"?"Preserved project":"Next step"}</p><h2 id="project-next-title">{access.permissions?.record_notes===false?"Open the project records":next.title}</h2><div className="project-next-actions">{next.kind==="record"&&access.permissions?.record_notes!==false?<StartProjectNote id={id}/>:<Link className="work-button work-button-primary" href={access.permissions?.record_notes===false?`/projects/${id}?view=records`:next.href??`/projects/${id}?view=records`} prefetch={false}>{access.permissions?.record_notes===false?"Open reports":next.label}<span aria-hidden="true">→</span></Link>}</div>{access.permissions?.record_notes!==false&&<p>{next.description}</p>}{next.note&&<p className="project-next-context">{displayDate(next.note.date)} · {next.note.submitted_by}</p>}{next.kind!=="record"&&next.kind!=="archived"&&access.permissions?.record_notes!==false&&<div className="project-next-secondary"><StartProjectNote id={id} secondary/></div>}</section></div>}
    {view==="overview"&&<ProjectNavigation id={id} current={view} owner={access.owner}/>}
    {view==="overview"&&dashboard&&<ProjectDashboard data={dashboard} compact/>}
    {view==="progress"&&dashboard&&<ProjectDashboard data={dashboard}/>}
    {view==="records"&&<ProjectRecords notes={data.submissions} timezone={access.timezone} currency={access.currency}/>}</>;
}
export default function ProjectPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{view?:string}> }) {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening project records…" variant="rows" header={<WorkspaceHeader current="projects"/>}/>}> <History {...props} /></Suspense></main>;
}
