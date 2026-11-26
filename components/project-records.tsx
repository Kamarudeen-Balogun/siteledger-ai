"use client";
import Link from "next/link";
import { useState } from "react";
import { displayDate, displayTimestamp } from "@/lib/reports/model";
import { recordAction, recordStage, type ProjectRecord, type RecordStage } from "@/lib/projects/journey";
export function ProjectRecords({ notes, timezone }: { notes: ProjectRecord[]; timezone:string }) {
  const [filter, setFilter] = useState<"all" | RecordStage>("all");
  const filters = [{ key: "all", label: "All" }, { key: "review", label: "To review" }, { key: "draft", label: "Drafts" }, { key: "approved", label: "Approved" }] as const;
  const visible = notes.filter(note => filter === "all" || recordStage(note) === filter);
  return <section className="project-records"><h2 className="font-serif text-2xl">Site records</h2>
    <div className="record-filters" role="group" aria-label="Filter site records">{filters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}<span>{item.key === "all" ? notes.length : notes.filter(note => recordStage(note) === item.key).length}</span></button>)}</div>
    {!visible.length ? <p className="project-empty">{notes.length ? "No records in this view." : "No site notes yet. Record your first note from the project home."}</p> : <ol className="record-list">{visible.map(note => {
      const stage = recordStage(note), action = recordAction(note);
      return <li key={note.id} className="project-record-row diary-panel"><div><p className="eyebrow">{note.captured_at?displayTimestamp(note.captured_at,timezone):displayDate(note.date)}</p><h3 className="mt-2 font-semibold">{stage === "approved" ? "Locked report" : stage === "draft" ? note.report_id ? "Draft report" : "Confirmed site note" : note.status === "received" ? "Processing site note" : "Site note to review"}</h3><p className="mt-2 text-sm leading-6">Recorded by {note.submitted_by}</p></div><div className="flex flex-wrap gap-2"><Link className="work-button" href={action.href} prefetch={false} data-tour={stage==="approved"?"locked-record":undefined}>{action.label}<span aria-hidden="true">→</span></Link>{stage==="approved"&&<Link className="text-link" href={`/log/${note.id}`}>Dispute log</Link>}</div></li>;
    })}</ol>}
  </section>;
}
