import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateProjects, privateTeam } from "@/lib/projects/data";
import { TeamManagement } from "@/components/project-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { DiaryIcon } from "@/components/diary-icon";
import { privateDashboard } from "@/lib/projects/boq-data";
import { formatMoney } from "@/lib/costing/format-money";
import { TelegramLink } from "@/components/account-forms";
export const metadata={title:"Project team — SiteLedger AI",robots:{index:false,follow:false}};
async function TeamContent({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){
  const {id}=await params;if(!UUID.test(id))notFound();
  const [projects,team,dashboard]=await Promise.all([privateProjects(),privateTeam(id),privateDashboard(id).catch(()=>null)]),project=projects?.projects.find(p=>p.id===id);
  if(!projects||!project||!team)notFound();
  const sections=[["members","Members"],...(project.permissions?.invite_members||project.owner?[["invitations","Invitations"]]:[]),...(project.owner?[["settings","Settings"]]:[])];
  const requested=(await searchParams).section,section=requested&&(requested==="invitations"||requested==="settings")&&sections.some(([key])=>key===requested)?requested:"members";
  return <>
    <WorkspaceHeader current="projects" project={project.name} projectId={id}/>
    <div className="stitch-title-row stitch-team-title"><span className="stitch-kicker" data-ink="orange">{project.client}</span>
      <span>{projects?.projects.filter(item=>!item.archived_at).length} active ledgers</span>
      <Link href="/projects?view=create" className="stitch-button" data-primary><DiaryIcon name="plus" size={18}/>New Project</Link>
    </div>
    <section className="stitch-card stitch-team-overview">
      <div className="stitch-title-row"><span className="stitch-kicker stitch-chip" data-tone="green">{project.archived_at?"Archived":"Current site"}</span>
        <Link className="stitch-button" href="/projects" aria-label="All projects"><DiaryIcon name="switch"/></Link>
      </div>
      <h1>{project.name}</h1><p><DiaryIcon name="location" size={16}/>{project.location}</p>
      <dl className="stitch-boq-values"><div><dt>Contract sum</dt><dd>{formatMoney(project.contract_sum,project.currency)}</dd></div>
        {dashboard&&project.permissions?.view_reports!==false&&<div><dt>Earned to date</dt><dd>{formatMoney(dashboard.earned,project.currency)}</dd></div>}</dl>
    </section>
    {dashboard&&project.permissions?.view_reports!==false&&<Link href="/reports" className="stitch-menu-row stitch-team-report"><DiaryIcon name="lock" size={19}/><span><strong>{dashboard.locked_count} stamped {dashboard.locked_count===1?"report":"reports"}</strong><small>Open Reports &amp; Log</small></span><DiaryIcon name="chevron" size={18}/></Link>}
    {!project.archived_at && projects.account.source === "browser" && <TelegramLink siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} account={projects.account} project={project}/>}
    {!project.archived_at && projects.account.source === "telegram" && <div className="stitch-card stitch-team-telegram"><div className="stitch-telegram-heading"><span className="stitch-telegram-icon"><DiaryIcon name="telegram"/></span><div><h2>Telegram connected</h2><p>In Telegram, use /projects to select {project.name}.</p></div></div></div>}
    {section!=="members"&&<Link href={`/projects/${id}/team`} className="text-link" prefetch={false}>← Site team</Link>}
    <TeamManagement project={project} team={team} section={section}/>
    <div className="stitch-menu-list mt-4"><Link href={`/projects/${id}`} className="stitch-menu-row"><DiaryIcon name="building"/><span>Project overview</span><DiaryIcon name="chevron"/></Link>{section!=="members"&&<Link href={`/projects/${id}/team`} className="stitch-menu-row"><DiaryIcon name="team"/><span>Site team</span><DiaryIcon name="chevron"/></Link>}{sections.some(([key])=>key==="invitations")&&section!=="invitations"&&<Link href={`/projects/${id}/team?section=invitations`} className="stitch-menu-row"><DiaryIcon name="invite"/><span>Manage pending invitations</span><DiaryIcon name="chevron"/></Link>}{project.owner&&section!=="settings"&&<Link href={`/projects/${id}/team?section=settings`} className="stitch-menu-row"><DiaryIcon name="settings"/><span>Project settings</span><DiaryIcon name="chevron"/></Link>}</div>
  </>;
}
export default function TeamPage(props:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){return <main className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-7 sm:px-10"><Suspense fallback={<><WorkspaceHeader current="projects"/><DiaryNotice busy title="Opening the project team…"/></>}><TeamContent {...props}/></Suspense></main>;}
