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
import { ProjectRecords } from "@/components/project-records";
import { projectStep } from "@/lib/projects/journey";
import { DiaryIcon } from "@/components/diary-icon";
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
  const canRecord = access.permissions?.record_notes!==false;
  return <><WorkspaceHeader current="projects" project={project.name} projectId={id}/>
    <Link href="/projects" className="text-link" prefetch={false}>← Your projects</Link>
    <section className="stitch-card stitch-team-overview">
      <div className="stitch-title-row"><span className="stitch-kicker stitch-chip" data-tone={access.archived_at?"red":"green"}>{access.archived_at?"Archived":"Current site"}</span><span className="stitch-kicker">{access.role_label ?? (access.role === "pm" ? "PM/QS" : "Foreman")} / {access.currency}</span></div>
      <h1>{project.name}</h1><p><DiaryIcon name="location" size={16}/>{project.client} · {project.location}</p>
    </section>
    {access.archived_at && view!=="overview" && <p role="status" className="my-5 border-l-4 border-accent p-4">Archived. Previous records remain available. The owner can restore this project in settings.</p>}
    <OwnershipAcceptance projectId={id} transfers={data.transfers} timezone={access.timezone} />
    {view==="overview"&&<>
      <section className="stitch-card" aria-labelledby="project-next-title" data-project-step={next.kind}>
        <span className="stitch-kicker">{next.kind==="archived"?"Preserved project":"Next step"}</span>
        <h2 id="project-next-title" className="mt-2 font-serif text-2xl">{canRecord?next.title:"Open the project records"}</h2>
        <p className="mt-3 leading-7">{next.description}</p>
        {next.note&&<p className="mt-3 text-sm leading-6">{displayDate(next.note.date)} · {next.note.submitted_by}</p>}
        <div className="stitch-two-actions mt-5">
          {next.kind==="record"&&canRecord?<StartProjectNote id={id}/>:<Link className="stitch-button" data-primary href={!canRecord?`/projects/${id}?view=records`:next.href??`/projects/${id}?view=records`} prefetch={false}>{!canRecord?"Open reports":next.label}<span aria-hidden="true">→</span></Link>}
          {next.kind!=="record"&&next.kind!=="archived"&&canRecord&&<StartProjectNote id={id} secondary/>}
        </div>
      </section>
      {dashboard&&<ProjectDashboard data={dashboard} compact/>}
      <div className="stitch-menu-list mt-4">
        <Link href={`/projects/${id}?view=records`} className="stitch-menu-row" prefetch={false}><DiaryIcon name="reports"/><span><strong>Site records</strong><small>Notes, drafts and locked reports</small></span><DiaryIcon name="chevron" size={18}/></Link>
        <Link href={`/projects/${id}?view=progress`} className="stitch-menu-row" prefetch={false}><DiaryIcon name="progress"/><span><strong>Work progress</strong><small>Measured against the BoQ</small></span><DiaryIcon name="chevron" size={18}/></Link>
        <Link href={`/projects/${id}/boq`} className="stitch-menu-row" prefetch={false}><DiaryIcon name="boq"/><span><strong>BoQ &amp; rates</strong><small>Supplied quantities and rates</small></span><DiaryIcon name="chevron" size={18}/></Link>
        <Link href={`/projects/${id}/team`} className="stitch-menu-row" prefetch={false}><DiaryIcon name="team"/><span><strong>Site team</strong><small>Members, invitations and settings</small></span><DiaryIcon name="chevron" size={18}/></Link>
      </div>
    </>}
    {view==="records"&&<><Link href={`/projects/${id}`} className="text-link" prefetch={false}>← Project overview</Link><ProjectRecords notes={data.submissions} timezone={access.timezone} currency={access.currency}/></>}
    {view==="progress"&&<><Link href={`/projects/${id}`} className="text-link" prefetch={false}>← Project overview</Link>{dashboard&&<ProjectDashboard data={dashboard}/>}</>}
  </>;
}
export default function ProjectPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{view?:string}> }) {
  return <main className="project-workspace mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><Suspense fallback={<PageLoading title="Opening project records…" variant="rows" header={<WorkspaceHeader current="projects"/>}/>}> <History {...props} /></Suspense></main>;
}
