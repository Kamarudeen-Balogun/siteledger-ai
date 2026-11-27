import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UUID } from "@/lib/confirm/access";
import { privateDashboard, privateBoqHistory, privateBoqVersions } from "@/lib/projects/boq-data";
import { BoqHistory } from "@/components/boq-history";
import { BoqReview } from "@/components/boq-review";
import { BoqEditor } from "@/components/boq-editor";
import { WorkspaceHeader } from "@/components/workspace-header";
import { PageLoading } from "@/components/page-loading";
import { DiaryIcon } from "@/components/diary-icon";
import { displayDate, formatMoneyPerUnit, formatQuantityWithUnit } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { decimal } from "@/lib/costing/decimal";
import { costReport } from "@/lib/costing/cost-report";

export const metadata = { title: "Project BoQ and rates — SiteLedger AI", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await privateDashboard(id);
  if (!data) notFound();
  const canEdit = data.access.permissions?.edit_boq ?? data.access.owner;
  const [changes,versions] = await Promise.all([canEdit ? privateBoqHistory(id) : null,privateBoqVersions(id).catch(()=>null)]);
  const currency = data.access.currency;
  const money = (value: string | number) => formatMoney(value, currency);
  const rows = data.rows;
  const allocation = costReport(rows.map(row=>({boq_item_id:row.id,unit:row.unit,quantity_done:row.boq_quantity,confirmed_by:data.access.professional_name})),
    data.boq.map(row=>({...row,cumulative_locked_quantity:"0"}))).total_cost;
  const scope = decimal(allocation,"BoQ allocation");
  const earnedPercent = scope.gt(0) ? decimal(data.earned,"earned value").times(100).div(scope).toNumber() : 0;
  const difference = decimal(data.project.contract_sum,"contract sum").minus(scope);
  return <>
    <WorkspaceHeader current="boq" project={data.project.name} projectId={id}/>
    <div className="stitch-title-row stitch-boq-heading"><h1 className="stitch-kicker"><DiaryIcon name="seal" size={17}/>BoQ — current version</h1>
      <span className="stitch-kicker stitch-chip" data-tone="green">{data.access.archived_at?"Archived":"Active schedule"}</span></div>
    {data.project.is_demo && <p className="stitch-card">Demo rates are illustrative. Verify them before real use.</p>}
    {(data.access.archived_at || !canEdit) && <p role="status" className="stitch-card">{data.access.archived_at ? "Archived project. Its BoQ remains available to read." : "You have read-only access to the BoQ."}</p>}
    <BoqEditor projectId={id} currency={currency} rows={rows} editable={canEdit && !data.access.archived_at} overview={<>
      <div className="stitch-title-row">
        <details className="boq-versions" data-tour="boq-history"><summary><span className="boq-versions__label"><DiaryIcon name="history" size={16}/>Version History{versions?.length ? ` (v${versions[0].version} Active)` : ""}</span><DiaryIcon name="chevron" size={16}/></summary>
          <div className="boq-versions__body">
            {versions?.length ? <ol className="boq-versions__list">{versions.map(item=><li key={item.version} className="boq-versions__version"><details>
              <summary><span><strong>Version {item.version}</strong><small>{displayDate(item.effective_date)} · {item.items} {item.items===1?"item":"items"}</small></span>{item.version===versions[0].version&&<span className="stitch-kicker stitch-chip" data-tone="green">Active</span>}</summary>
              <ul className="boq-versions__rows">{item.rows.map((row,index)=><li key={row.item_code ?? index}><span>{row.description}</span><span>{formatQuantityWithUnit(row.boq_quantity, row.unit)} @ {formatMoneyPerUnit(row.rate, currency, row.unit)}</span></li>)}</ul>
            </details></li>)}</ol> : <p>No BoQ versions have been saved yet.{changes?.length ? " The current BoQ is the original schedule — every change is listed in the change history below." : ""}</p>}
            {versions?.length ? <p>Drafts use the current version (Version {versions[0].version}). Locked reports keep the version they were locked with.</p> : null}
          </div>
        </details><span className="stitch-kicker">{rows.length} contract {rows.length===1?"item":"items"}</span>
      </div>
      {changes && <BoqReview changes={changes} currency={currency}/>}
      <section className="stitch-card stitch-boq-allocation">
        <div className="stitch-title-row"><h2 className="stitch-kicker" data-ink="orange">Contract ledger allocation</h2><span className="stitch-kicker stitch-chip" data-tone="green">{earnedPercent.toFixed(1)}% earned</span></div>
        <div className="stitch-title-row"><strong>{money(allocation)}</strong><small>{money(data.earned)} to date</small></div>
        <progress max={100} value={Math.min(100,earnedPercent)} aria-label="Contract ledger progress"/>
        <dl className="stitch-boq-values"><div><dt>Total contract sum</dt><dd>{money(data.project.contract_sum)}</dd></div><div><dt>{difference.lt(0)?"Above contract sum":"Unallocated contingency"}</dt><dd>{money(difference.abs().toFixed())}</dd></div></dl>
      </section>
    </>}/>
    {changes && <BoqHistory changes={changes} timezone={data.access.timezone}/>}
    <Link href={`/projects/${id}`} className="text-link">Project overview</Link>
  </>;
}

export default function BoqPage(props: { params: Promise<{ id: string }> }) {
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-16 pt-7 sm:px-10">
    <Suspense fallback={<PageLoading title="Opening the project BoQ…" variant="table" header={<WorkspaceHeader current="boq"/>}/>}> <Content {...props}/></Suspense>
  </main>;
}
