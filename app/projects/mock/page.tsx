import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { demoLog,demoReport } from "@/lib/data/demo-documents";
import { formatMoney } from "@/lib/costing/format-money";
import { displayRatio, displayUnit } from "@/lib/reports/model";
import { WorkspaceHeader } from "@/components/workspace-header";
import { DiaryNotice } from "@/components/diary-notice";
import { ReportDocument } from "@/components/report-document";
import { MockReportActions } from "@/components/mock-report-actions";
import { DisputeLogDocument } from "@/components/dispute-log";

const title="Mock project — demo data";
export const metadata={title,robots:{index:false,follow:false}};
const views=[["today","Today"],["report","Report"],["log","Log"],["boq","BoQ"],["team","Team"]] as const;

async function MockContent({query}:{query:Promise<{view?:string}>}) {
  if(!await currentAccount())redirect("/account");
  const requested=(await query).view,view=views.some(([key])=>key===requested)?requested:"today";
  const sample={...demoReport,document:{...demoReport.document,source:{...demoReport.document.source,project:{...demoReport.document.source.project,name:title}}}};
  const [latest]=demoLog.entries.filter(entry=>entry.kind==="report").toSorted((a,b)=>b.timestamp.localeCompare(a.timestamp));
  return <><WorkspaceHeader current="projects" title={title}/><nav className="work-tabs" aria-label="Mock project sections">{views.map(([key,label])=><Link key={key} href={`/projects/mock?view=${key}`} aria-current={key===view?"page":undefined}>{label}</Link>)}</nav>
    {view==="today"&&<section className="diary-panel"><h1>{title}</h1><p>{sample.document.source.project.location}</p><h2 className="mt-4">Work Progress — Measured</h2><p>Based on the example locked report.</p><dl className="settings-summary">{sample.document.costing.items.map((item,index)=><div key={index}><dt>{sample.document.source.items[index].description}</dt><dd>{item.cumulative_quantity} {displayUnit(item.unit)} · {displayRatio(item.percentage_complete)}%</dd></div>)}</dl><Link href="/projects/mock?view=report" className="work-button work-button-primary">Open locked report</Link></section>}
    {view==="report"&&<ReportDocument report={sample} demoPhotos actions={<MockReportActions/>}/>}
    {view==="log"&&<DisputeLogDocument log={{...demoLog,project:{...demoLog.project,name:title},entries:demoLog.entries.map(entry=>({...entry,href:entry.submission_id===sample.document.source.submission_id?"/projects/mock?view=report":undefined}))}}/>}
    {view==="boq"&&<section className="diary-panel"><h1>BoQ &amp; rates</h1><p>{title}</p><dl className="settings-summary">{sample.document.source.price_list.map(row=><div key={row.id}><dt>{row.description}</dt><dd>{row.cumulative_locked_quantity} / {row.boq_quantity} {displayUnit(row.unit)}<span>{formatMoney(row.rate,sample.document.currency)} per {displayUnit(row.unit)}</span></dd></div>)}</dl></section>}
    {view==="team"&&<section className="diary-panel"><h1>Site team</h1><p>{title}</p><dl className="settings-summary"><div><dt>{sample.document.source.submitted_by}</dt><dd>Foreman</dd></div>{latest&&<div><dt>{latest.author}</dt><dd>PM/QS</dd></div>}</dl></section>}
    <Link className="text-link" href="/projects">Back to your projects</Link>
  </>;
}
export default function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  return <main className="mx-auto max-w-5xl px-5 py-7"><Suspense fallback={<DiaryNotice busy title="Opening mock project…"/>}><MockContent query={searchParams}/></Suspense></main>;
}
