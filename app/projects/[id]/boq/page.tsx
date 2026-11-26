import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateDashboard, privateBoqHistory, privateBoqVersions } from "@/lib/projects/boq-data";
import { BoqHistory } from "@/components/boq-history";
import { BoqEditor } from "@/components/boq-editor";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { ProjectNavigation } from "@/components/project-navigation";
import { displayDate } from "@/lib/reports/model";
export const metadata = { title: "Project BoQ and rates — SiteLedger AI", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID.test(id)) notFound(); const data = await privateDashboard(id); if (!data) notFound();
  const canEdit = data.access.permissions?.edit_boq ?? data.access.role === "pm";
  const [changes,versions]=await Promise.all([canEdit?privateBoqHistory(id):null,privateBoqVersions(id).catch(()=>null)]);
  return <><Link href={`/projects/${id}`} className="project-breadcrumb">← {data.project.name}</Link><p className="eyebrow mt-5">{data.access.currency} / {data.access.role === "pm" ? "PM" : "Foreman"}</p><h1 className="mt-3 font-serif text-3xl">BoQ & rates</h1><ProjectNavigation id={id} current="boq" owner={data.access.owner}/>
    <p className="mt-5 max-w-3xl leading-7">Add the work items, quantities and rates supplied by your QS. These are the prices used to cost new reports.</p>
    {data.project.is_demo && <p className="mt-5 border-l-4 border-accent pl-4 leading-7">Demo rates — verify before real use. Illustrative quantities and prices are not live market rates.</p>}
    {(data.access.archived_at || !canEdit) && <p role="status" className="mt-5 border-l-4 border-rule pl-4 leading-7">{data.access.archived_at ? "Archived project. Its BoQ remains available to read." : "You have read-only access to the BoQ."}</p>}
    <BoqEditor projectId={id} currency={data.access.currency} rows={data.rows} editable={canEdit && !data.access.archived_at} />
    <details className="work-disclosure" data-tour="boq-history"><summary>BoQ version history</summary><div className="work-disclosure-body">{versions?.length?<ul>{versions.map(item=><li key={item.version} className="border-b border-rule py-3">Version {item.version} · {displayDate(item.effective_date)}</li>)}</ul>:<p>No BoQ versions have been saved yet.</p>}</div></details>
    {changes&&<BoqHistory changes={changes} timezone={data.access.timezone}/>}</>;
}
export default function BoqPage(props: { params: Promise<{ id: string }> }) { return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10"><WorkspaceHeader current="boq" /><Suspense fallback={<DiaryNotice busy title="Opening the project BoQ…"/>}><Content {...props} /></Suspense></main>; }
