"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { displayDate, displayTimestamp } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { decimal } from "@/lib/costing/decimal";
import type { DisputeLog } from "@/lib/log/data";
import { ReportShare } from "./report-share";
import { DiaryIcon } from "./diary-icon";

export function DisputeLogDocument({ log, tallies, canShare = false, actions }: { log: DisputeLog; tallies?: Record<string, string[]>; canShare?: boolean; actions?: ReactNode }) {
  const [filter, setFilter] = useState<"all"|"report"|"amendment"|"defect">("all");
  const reports = log.entries.filter(entry=>entry.kind==="report");
  const currencies = new Set(reports.map(entry=>entry.currency??"NGN"));
  const totals = [...currencies].map(currency=>({currency,value:reports.filter(report=>(report.currency??"NGN")===currency)
    .reduce((sum,report)=>sum.plus(decimal(report.total_cost??"0","locked total")),decimal("0","locked total")).toFixed()}));
  // The log holds locked reports and amendments only — there are no defect
  // entries in the data model yet, so the flag count is honestly 0 and the
  // filter shows the empty state until defects are recorded.
  const visible = filter==="defect" ? [] : log.entries.filter(entry=>filter==="all"||entry.kind===filter)
    .toSorted((first,second)=>second.timestamp.localeCompare(first.timestamp));
  const filters = [
    { id: "all", text: "All entries", count: log.entries.length },
    { id: "report", text: "Reports", count: reports.length },
    { id: "amendment", text: "Amendments", count: log.entries.length - reports.length },
    { id: "defect", text: "Defects flagged", count: 0 },
  ] as const;
  return <section aria-label="Dispute log" className="stitch-log">
    <header className="stitch-card">
      <h1 className="stitch-kicker" data-ink="green"><DiaryIcon name="verified" size={18}/>Sealed &amp; locked</h1>
      <p>Sealed record log for <strong>{log.project.name}.</strong> Sealed records keep the details of each day on site.</p>
      {log.is_demo && <p>Fictional demo history and illustrative rates.</p>}
      <dl className="stitch-log-summary">
        <div><dt className="stitch-kicker">Sealed reports</dt><dd><strong>{reports.length}</strong> <span className="stitch-kicker" data-ink="green">Locked</span></dd></div>
        <div><dt className="stitch-kicker">Total value locked</dt><dd>{totals.map(total=><span key={total.currency}>{formatMoney(total.value,total.currency)}</span>)}{!totals.length&&"—"}</dd></div>
      </dl>
    </header>
    <div className="stitch-log-filters" role="group" aria-label="Filter log entries">{filters.map(item=><button type="button" className="stitch-kicker" key={item.id} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.text} ({item.count})</button>)}</div>
    {!visible.length && <p className="stitch-card">{filter==="defect"?"No defects flagged on this project yet.":log.entries.length?"No entries in this view.":"No locked records yet. Approved reports will appear here."}</p>}
    <ol className="stitch-log-entries">{visible.map(entry => {
      const locked = entry.kind==="report";
      return <li key={entry.id} className="stitch-card stitch-log-entry" data-kind={entry.kind}>
        <div className="stitch-title-row">
          <span className="stitch-kicker stitch-chip" data-tone={locked?"green":"red"}>{locked?"Locked report":"Amendment"}</span>
          <time className="stitch-kicker" dateTime={entry.timestamp}>{displayDate(entry.date)}</time>
        </div>
        <time className="stitch-kicker stitch-log-time" dateTime={entry.timestamp}>{displayTimestamp(entry.timestamp,entry.timezone)}</time>
        <p className="stitch-log-author"><DiaryIcon name="profile" size={18}/>{entry.author}</p>
        {locked ? <><strong className="stitch-log-value">{formatMoney(entry.total_cost??"0",entry.currency??"NGN")}</strong>
          {tallies?.[entry.submission_id]?.length ? <p className="stitch-log-tally"><span className="stitch-kicker">Site works executed &amp; tally</span>{tallies[entry.submission_id].join(", ")}</p> : null}</> : <div className="stitch-log-note">
          <span className="stitch-kicker"><DiaryIcon name="warning" size={16}/>Record amendment</span><p>{entry.note}</p>
        </div>}
        {entry.href && <Link prefetch={false} href={entry.href} className="text-link" data-tour={locked?"locked-record":undefined}>{locked?"Open locked report":"Open original report"}</Link>}
        {canShare&&locked&&<ReportShare id={entry.submission_id}/>}
      </li>;
    })}</ol>
    {actions && <div className="stitch-log-actions">{actions}</div>}
  </section>;
}
