import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateDashboard } from "@/lib/projects/boq-data";
import { BoqEditor } from "@/components/boq-editor";
import { WorkspaceHeader } from "@/components/workspace-header";
export const metadata = { title: "Project BoQ and rates — SiteLedger AI", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID.test(id)) notFound(); const data = await privateDashboard(id); if (!data) notFound();
  return <><Link href={`/projects/${id}`} className="inline-flex min-h-12 items-center underline">Return to project ledger</Link><p className="eyebrow mt-5">{data.access.currency} / {data.access.role === "pm" ? "PM" : "Foreman"}</p><h1 className="mt-3 font-serif text-3xl">{data.project.name} — BoQ and rates</h1>
    <p className="mt-5 max-w-3xl leading-7">Quantities and rates come from your supplied Bill of Quantities. New and rebuilt drafts use current rates; locked reports retain their original evidence and money.</p>
    {data.project.is_demo && <p className="mt-5 border-l-4 border-accent pl-4 leading-7">Demo rates — verify before real use. Illustrative quantities and prices are not live market rates.</p>}
    {(data.access.archived_at || data.access.role !== "pm") && <p role="status" className="mt-5 border-l-4 border-rule pl-4 leading-7">{data.access.archived_at ? "Archived project. Its BoQ remains available to read." : "Read-only BoQ. A project PM can change supplied quantities and rates."}</p>}
    <BoqEditor projectId={id} currency={data.access.currency} rows={data.boq} editable={data.access.role === "pm" && !data.access.archived_at} /></>;
}
export default function BoqPage(props: { params: Promise<{ id: string }> }) { return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects" /><Suspense fallback={<p role="status">Opening your authorized BoQ…</p>}><Content {...props} /></Suspense></main>; }
