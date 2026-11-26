"use client";
import Link from "next/link";
import { useState } from "react";
import { displayDate, displayTimestamp } from "@/lib/reports/model";
import { recordAction, recordStage, type ProjectRecord, type RecordStage } from "@/lib/projects/journey";
import { formatMoney } from "@/lib/costing/format-money";
import { DiaryIcon } from "./diary-icon";
export function ProjectRecords({ notes, timezone, currency }: { notes: ProjectRecord[]; timezone:string; currency?:string }) {
  const [filter, setFilter] = useState<"all" | RecordStage>("all");
  const filters = [{ key: "all", label: "All" }, { key: "review", label: "To review" }, { key: "draft", label: "Drafts" }, { key: "approved", label: "Approved" }] as const;
  const visible = notes.filter(note => filter === "all" || recordStage(note) === filter);
  return <section className="project-records stitch-records"><h2 className="stitch-section-title">Site records</h2>
    <div className="record-filters" role="group" aria-label="Filter site records">{filters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}<span>{item.key === "all" ? notes.length : notes.filter(note => recordStage(note) === item.key).length}</span></button>)}</div>
    {!visible.length ? <p className="project-empty">{notes.length ? "No records in this view." : "No site notes yet. Record your first note from the project home."}</p> : <ol className="record-list">{visible.map(note => {
      const stage = recordStage(note), action = recordAction(note);
      const title = stage === "approved" ? "Locked report" : stage === "draft" ? note.report_id ? "Draft report" : "Confirmed site note" : note.status === "received" ? "Processing site note" : "Site note to review";
      return <li key={note.id} className="stitch-card stitch-record-card"><Link href={action.href} prefetch={false} data-tour={stage==="approved"?"locked-record":undefined}>
        <div className="stitch-title-row"><span className="stitch-kicker stitch-chip" data-tone={stage==="approved"?"green":undefined}>{title}</span><time className="stitch-kicker">{note.captured_at?displayTimestamp(note.captured_at,timezone):displayDate(note.date)}</time></div>
        {note.summary_items?.length ? <h3>{note.summary_items.join(" · ")}</h3> : <h3>{action.label}</h3>}
        <div className="stitch-title-row"><small>{note.submitted_by}</small>{note.total_cost != null && currency && <strong>{formatMoney(note.total_cost,currency)}</strong>}<DiaryIcon name="chevron" size={18}/></div>
      </Link>{stage==="approved"&&<Link className="text-link" href={`/log/${note.id}`}>Dispute log</Link>}</li>;
    })}</ol>}
  </section>;
}
