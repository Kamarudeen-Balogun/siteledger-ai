import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateHistory } from "@/lib/projects/data";
import { formatMoney } from "@/lib/costing/format-money";
import { displayDate } from "@/lib/reports/model";
import { OwnershipAcceptance } from "@/components/project-forms";
import { TelegramAccountEntry } from "@/components/account-forms";
export const metadata = { title: "Project records — SiteLedger", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
async function History({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await privateHistory(id);
  if (!data) return <><TelegramAccountEntry /><p className="my-6 leading-7"><Link href="/account" className="underline">Sign in</Link> and open an authorized project to view its records.</p></>;
  const { project, access } = data;
  return <><Link href="/projects" className="inline-flex min-h-12 items-center underline">Your projects</Link>
    <h1 className="mt-5 font-serif text-3xl">{project.name}</h1><p className="mt-4 leading-7">{project.client} · {project.location}</p>
    <p className="mt-3 font-mono text-sm">{access.role === "pm" ? "PM" : "Foreman"}{access.owner ? " / Owner" : ""} · {access.currency} · {access.timezone}</p>
    <p className="mt-3">Contract sum {formatMoney(project.contract_sum, access.currency)} {access.currency}</p>
    {access.archived_at && <p role="status" className="my-5 border-l-4 border-accent p-4">Archived. Existing reports, photos and amendments remain available to authorized members. The owner can restore this project.</p>}
    {access.owner && <Link href={`/projects/${id}/team`} className="my-5 inline-flex min-h-12 items-center border border-ink px-5 py-3">Manage team and project</Link>}
    <OwnershipAcceptance projectId={id} transfers={data.transfers} timezone={access.timezone} />
    <section className="mt-7 border-t border-rule pt-6"><h2 className="font-serif text-2xl">Site records</h2>
      <p className="mt-3 leading-7">{access.role === "pm" ? "You can review this project's site records." : "Your own site records appear here."}</p>
      {data.submissions.length === 0 ? <p className="my-6">No site notes recorded yet.</p> : <ol className="mt-5">{data.submissions.map(note => <li key={note.id} className="border-b border-rule py-5">
        <p className="font-mono text-sm">{displayDate(note.date)} / {note.report_status === "locked" ? "LOCKED REPORT" : note.status.toUpperCase()}</p>
        <p className="my-3">Recorded by {note.submitted_by}</p><div className="flex flex-wrap gap-4"><Link className="inline-flex min-h-12 items-center underline" href={`/confirm/${note.id}`}>View site note</Link>
          {(note.report_id || note.status === "confirmed") && <Link className="inline-flex min-h-12 items-center underline" href={`/reports/${note.id}`}>Open report</Link>}
          {note.report_status === "locked" && <Link className="inline-flex min-h-12 items-center underline" href={`/log/${note.id}`}>Dispute log</Link>}</div>
      </li>)}</ol>}
    </section></>;
}
export default function ProjectPage(props: { params: Promise<{ id: string }> }) {
  return <main className="mx-auto min-h-screen max-w-4xl px-5 pb-16 pt-7"><Suspense fallback={<p role="status">Opening authorized project records…</p>}><History {...props} /></Suspense></main>;
}
