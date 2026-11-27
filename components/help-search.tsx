"use client";
import { useMemo, useState } from "react";
import { DiaryIcon } from "./diary-icon";

export type HelpQuestion = { title: string; text: string; topic: string };
export const helpTopics = ["All topics", "Site intake & voice", "BoQ & rates", "Lock & disputes", "Offline queue", "Team roles", "Accounts"] as const;

export function HelpSearch({ questions }: { questions: HelpQuestion[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>("All topics");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return questions.filter(item => (topic === "All topics" || item.topic === topic) && (!needle || `${item.title} ${item.text}`.toLowerCase().includes(needle)));
  }, [query, topic, questions]);
  return <>
    <div className="relative" role="search">
      <label className="sr-only" htmlFor="help-search">Search help</label>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"><DiaryIcon name="explore" size={20} /></span>
      <input id="help-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search help — try ‘offline’, ‘BoQ’, ‘dispute’, or ‘cement’" autoComplete="off" className="h-12 w-full rounded-full bg-surface-container-high pl-11 pr-4 font-body-lg text-[16px] text-on-surface shadow-inner placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
    <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by topic">
      {helpTopics.map(name => <button key={name} type="button" aria-pressed={topic === name} onClick={() => setTopic(name)} className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 font-label-ledger text-[13px] ${topic === name ? "bg-primary-container text-on-primary shadow-sm" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"}`}>{name}{name !== "All topics" && <span> ({questions.filter(item => item.topic === name).length})</span>}</button>)}
    </div>
    <p role="status" className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Showing {filtered.length} of {questions.length} questions.</p>
    {filtered.length === 0 ? <section className="mt-4 rounded-xl bg-surface-container-lowest p-4 shadow-sm"><h2 className="font-headline-sm text-headline-sm text-on-surface">No matching questions</h2><p className="mt-3 font-body-md text-body-md text-on-surface-variant">Try terms like ‘offline’, ‘BoQ’, ‘dispute’, or ‘cement’.</p><button type="button" className="mt-4 flex min-h-12 items-center rounded-lg bg-surface-container-low px-5 font-label-ledger text-label-ledger text-on-surface hover:bg-surface-container" onClick={() => { setQuery(""); setTopic("All topics"); }}>Clear filters</button></section> :
      <div className="mt-2 divide-y divide-outline-variant">{filtered.map(({ title, text }) => {
        const isOpen = open === title;
        return <div key={title} data-open={isOpen}>
          <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : title)} className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left">
            <span className="font-label-ledger text-label-ledger text-on-surface">{title}</span>
            <span className="chevron-icon shrink-0 text-on-surface-variant"><DiaryIcon name="chevron" size={20} /></span>
          </button>
          {isOpen && <p className="pb-4 pr-8 font-body-md text-body-md text-on-surface-variant">{text}</p>}
        </div>;
      })}</div>}
  </>;
}
