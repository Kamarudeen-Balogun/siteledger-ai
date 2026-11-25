import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateDashboard, privateBoqHistory } from "@/lib/projects/boq-data";
import { BoqHistory } from "@/components/boq-history";
import { BoqEditor } from "@/components/boq-editor";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { ProjectNavigation } from "@/components/project-navigation";
export const metadata = { title: "Project BoQ and rates — SiteLedger AI", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID.test(id)) notFound(); const data = await privateDashboard(id); if (!data) notFound();
  const changes = data.access.role === "pm" ? await privateBoqHistory(id) : null;
  return <><Link href={`/projects/${id}`} className="project-breadcrumb">← {data.project.name}</Link><p className="eyebrow mt-5">{data.access.currency} / {data.access.role === "pm" ? "PM" : "Foreman"}</p><h1 className="mt-3 font-serif text-3xl">BoQ & rates</h1><ProjectNavigation id={id} current="boq" owner={data.access.owner}/>
    <p className="mt-5 max-w-3xl leading-7">Add the work items, quantities and rates supplied by your QS. These are the prices used to cost new reports.</p>
    {data.project.is_demo && <p className="mt-5 border-l-4 border-accent pl-4 leading-7">Demo rates — verify before real use. Illustrative quantities and prices are not live market rates.</p>}
    {(data.access.archived_at || data.access.role !== "pm") && <p role="status" className="mt-5 border-l-4 border-rule pl-4 leading-7">{data.access.archived_at ? "Archived project. Its BoQ remains available to read." : "Read-only BoQ. A project PM can change supplied quantities and rates."}</p>}
    <BoqEditor projectId={id} currency={data.access.currency} rows={data.boq} editable={data.access.role === "pm" && !data.access.archived_at} />{changes&&<BoqHistory changes={changes} timezone={data.access.timezone}/>}</>;
}
export default function BoqPage(props: { params: Promise<{ id: string }> }) { return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="projects" /><Suspense fallback={<DiaryNotice busy title="Opening the project BoQ…">Loading supplied quantities and rates.</DiaryNotice>}><Content {...props} /></Suspense></main>; }
