"use client";
import { useMemo, useState } from "react";

export type HelpQuestion = { title: string; text: string; topic: string };
export const helpTopics = ["All topics", "Site intake & voice", "BoQ & rates", "Lock & disputes", "Offline queue", "Team roles", "Accounts"] as const;

export function HelpSearch({ questions }: { questions: HelpQuestion[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>("All topics");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return questions.filter(item => (topic === "All topics" || item.topic === topic) && (!needle || `${item.title} ${item.text}`.toLowerCase().includes(needle)));
  }, [query, topic, questions]);
  return <>
    <div className="stitch-help-search" role="search">
      <label className="sr-only" htmlFor="help-search">Search help</label>
      <input id="help-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search help — try ‘offline’, ‘BoQ’, ‘dispute’, or ‘cement’" autoComplete="off" />
    </div>
    <div className="stitch-help-topics" role="group" aria-label="Filter by topic">
      {helpTopics.map(name => <button key={name} type="button" className="stitch-button" aria-pressed={topic === name} onClick={() => setTopic(name)}>{name}{name !== "All topics" && <span> ({questions.filter(item => item.topic === name).length})</span>}</button>)}
    </div>
    <p role="status" className="mt-4">Showing {filtered.length} of {questions.length} questions.</p>
    {filtered.length === 0 ? <section className="stitch-card"><h2>No matching questions</h2><p className="mt-3 leading-7">Try terms like ‘offline’, ‘BoQ’, ‘dispute’, or ‘cement’.</p><button type="button" className="work-button mt-4" onClick={() => { setQuery(""); setTopic("All topics"); }}>Clear filters</button></section> :
      <div className="faq-list">{filtered.map(({ title, text }) => <details key={title}><summary>{title}</summary><p>{text}</p></details>)}</div>}
  </>;
}
