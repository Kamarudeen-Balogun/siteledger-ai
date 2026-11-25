"use client";
import Link from "next/link";
import { useState } from "react";
import { displayDate } from "@/lib/reports/model";
import { recordAction, recordStage, type ProjectRecord, type RecordStage } from "@/lib/projects/journey";
export function ProjectRecords({ notes, role }: { notes: ProjectRecord[]; role: "foreman" | "pm" }) {
  const [filter, setFilter] = useState<"all" | RecordStage>("all");
  const filters = [{ key: "all", label: "All" }, { key: "review", label: "To review" }, { key: "draft", label: "Drafts" }, { key: "approved", label: "Approved" }] as const;
  const visible = notes.filter(note => filter === "all" || recordStage(note) === filter);
  return <section className="project-records"><h2 className="font-serif text-2xl">Site records</h2><p className="mt-3 leading-7">{role === "pm" ? "Review this project’s notes and reports." : "Your own site notes and reports."}</p>
    <div className="record-filters" role="group" aria-label="Filter site records">{filters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}<span>{item.key === "all" ? notes.length : notes.filter(note => recordStage(note) === item.key).length}</span></button>)}</div>
    {!visible.length ? <p className="project-empty">{notes.length ? "No records in this view." : "No site notes yet. Record your first note from the project home."}</p> : <ol className="record-list">{visible.map(note => {
      const stage = recordStage(note), action = recordAction(note);
      return <li key={note.id} className="project-record-row"><div><p className="eyebrow">{displayDate(note.date)}</p><h3 className="mt-2 font-semibold">{stage === "approved" ? "Approved report" : stage === "draft" ? note.report_id ? "Draft report" : "Confirmed site note" : note.status === "received" ? "Processing site note" : "Site note to review"}</h3><p className="mt-2 text-sm leading-6">Recorded by {note.submitted_by}</p></div><Link className="work-button" href={action.href} prefetch={false}>{action.label}<span aria-hidden="true">→</span></Link></li>;
    })}</ol>}
  </section>;
}
