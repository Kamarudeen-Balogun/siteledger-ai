import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateHistory } from "@/lib/projects/data";
import { formatMoney } from "@/lib/costing/format-money";
import { displayDate } from "@/lib/reports/model";
import { OwnershipAcceptance, StartProjectNote } from "@/components/project-forms";
import { TelegramAccountEntry } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
import { privateDashboard } from "@/lib/projects/boq-data";
import { ProjectDashboard } from "@/components/project-dashboard";
import { DiaryNotice } from "@/components/diary-notice";
import { WorkIntro } from "@/components/work-flow";
export const metadata = { title: "Project records — SiteLedger", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
async function History({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await privateHistory(id);
  if (!data) return <><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> and open an authorized project to view its records.</p></>;
  const { project, access } = data;
  const dashboard = await privateDashboard(id);
  const requested=(await searchParams).view,view=requested==="records"||requested==="progress"?requested:"overview";
  return <><WorkIntro label={`${access.role === "pm" ? "PM" : "Foreman"} / ${access.currency}`} title={project.name} action={!access.archived_at?<StartProjectNote id={id}/>:undefined}><p>{project.client} · {project.location}</p></WorkIntro>
    <nav aria-label="Project sections" className="work-tabs">{[["overview","Overview"],["records","Site records"],["progress","Progress"]].map(([key,label])=><Link key={key} href={key==="overview"?`/projects/${id}`:`/projects/${id}?view=${key}`} prefetch={false} aria-current={view===key?"page":undefined}>{label}</Link>)}{access.owner&&<Link href={`/projects/${id}/team`} prefetch={false}>Team & settings</Link>}</nav>
    {!dashboard && <p className="mt-3">Contract sum {formatMoney(project.contract_sum, access.currency)} {access.currency}</p>}
    {access.archived_at && <p role="status" className="my-5 border-l-4 border-accent p-4">Archived. Existing reports, photos and amendments remain available to authorized members. The owner can restore this project.</p>}
    <OwnershipAcceptance projectId={id} transfers={data.transfers} timezone={access.timezone} />
    {view==="overview"&&<>{dashboard&&<ProjectDashboard data={dashboard} compact/>}{dashboard?.rows.length===0&&<section className="work-state"><h2>Ready to record work</h2><p>Save a voice note, photos or both now. {access.role==="pm"?"Add your supplied BoQ before costing the report.":"Your PM can add prices before the report is costed."}</p>{!access.archived_at&&access.role==="pm"&&<Link href={`/projects/${id}/boq`} className="text-link mt-4">Add or import BoQ items</Link>}</section>}<Link href={`/projects/${id}?view=records`} prefetch={false} className="work-button mt-5">Open site records · {data.submissions.length}</Link></>}
    {view==="progress"&&dashboard&&<ProjectDashboard data={dashboard}/>}
    {view==="records"&&<section className="mt-7 border-t border-rule pt-6"><h2 className="font-serif text-2xl">Site records</h2>
      <p className="mt-3 leading-7">{access.role === "pm" ? "You can review this project's site records." : "Your own site records appear here."}</p>
      {data.submissions.length === 0 ? <p className="my-6">No site notes recorded yet.</p> : <ol className="record-list mt-5">{data.submissions.map(note => <li key={note.id} className="border-b border-rule py-5">
        <p className="font-mono text-sm">{displayDate(note.date)} / {note.report_status === "locked" ? "APPROVED & LOCKED" : note.report_status === "draft" ? "DRAFT REPORT" : note.status === "confirmed" ? "CONFIRMED NOTE" : "READY FOR REVIEW"}</p>
        <p className="my-3">Recorded by {note.submitted_by}</p><div className="flex flex-wrap gap-4"><Link className={(note.report_id||note.status==="confirmed")?"inline-flex min-h-12 items-center underline":"work-button work-button-primary"} href={`/confirm/${note.id}`} prefetch={false}>{note.report_status==="locked"?"View original note":"Review site note"}</Link>
          {(note.report_id || note.status === "confirmed") && <Link className="work-button work-button-primary" prefetch={false} href={`/reports/${note.id}`}>Open report</Link>}
          {note.report_status === "locked" && <Link className="inline-flex min-h-12 items-center underline" href={`/log/${note.id}`}>Dispute log</Link>}</div>
      </li>)}</ol>}
    </section>}</>;
}
export default function ProjectPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{view?:string}> }) {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects"/><Suspense fallback={<DiaryNotice busy title="Opening project records…">Checking your access and the project ledger.</DiaryNotice>}><History {...props} /></Suspense></main>;
}
