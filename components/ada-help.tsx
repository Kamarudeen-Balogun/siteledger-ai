"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent, type FormEvent } from "react";
import { DiaryIcon } from "./diary-icon";

const topics = [
  { match: /\b(lock\w*|approv\w*|share\w*)\b/i, question: "How do I lock a report?", answer: "Open the costed draft from Reports. If you can approve reports in this project, check the record and choose Approve & lock. Open the locked report to download its PDF or share it.", label: "Reports", href: "/reports" },
  { match: /\b(warn\w*|ambigu\w*|missing|stale)\b/i, question: "What does a warning mean?", answer: "Open the warning and check the field it points to. For a BoQ import, compare any flagged quantity or rate with the supplied file before saving. If a draft uses old rates, review the changes and rebuild it before approval.", label: "BoQ & rates", href: "/boq" },
  { match: /\b(invit\w*|team|member\w*)\b/i, question: "How do I invite someone?", answer: "Open Your projects, choose the site and open its team settings. If you have invitation access, choose Invite a person and enter the recipient’s email and project role.", label: "Your projects", href: "/projects" },
  { match: /\b(boq|bill of quantities|version\w*|rate\w*)\b/i, question: "How do BoQ changes work?", answer: "Review the BoQ and its change history. When a supplied quantity or rate changes, review and save the edit. Locked reports keep their original quantities, rates and currency.", label: "BoQ & rates", href: "/boq" },
  { match: /\b(record\w*|voice|photos?|upload\w*)\b/i, question: "How do I record work?", answer: "Open Today, choose the project and tap Add today’s work. Add a voice note, photos or both. Then review the note and confirm the quantities.", label: "Today", href: "/today" },
  { match: /\b(cost\w*|price\w*|money|quantit\w*)\b/i, question: "How do I cost a site note?", answer: "Open the note and check the extracted quantities and their BoQ matches. Confirm the note before costing it. The report uses the supplied BoQ rates.", label: "Today", href: "/today" },
];
const defaultAnswer = { answer: "I can explain how to use SiteLedger. Choose a question here or open Help for the full guide.", label: "Open Help", href: "/help" };
const storage = "siteledger-ada-position";
type Placement = { side: "left" | "right"; y: number };
type Exchange = { question: string; answer: typeof defaultAnswer };

export function AdaHelp({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Exchange[]>([]);
  const [position, setPosition] = useState<Placement | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storage) ?? "null");
      return value && (value.side === "left" || value.side === "right") && Number.isFinite(value.y) ? value : null;
    } catch { return null; }
  });
  const [dragged, setDragged] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null), skipClick = useRef(false);
  const chat = useRef<HTMLDivElement>(null);

  function answer(value: string) {
    const question = value.trim().slice(0, 400);
    if (!question) return;
    const topic = topics.find(item => item.match.test(question)) ?? defaultAnswer;
    const actionRequest=/\b(?:do it|for me|please (?:lock|cost|edit|invite|create|approve)|(?:lock|cost|edit|invite|create|approve) (?:this|my|the))\b/i.test(question)&&!/^how\b/i.test(question);
    const reply=actionRequest?{...topic,answer:`You’ll need to do this in SiteLedger. ${topic.answer}`}:topic;
    setMessages(current => [...current.slice(-19), { question, answer: reply }]);
    setQuery("");
    requestAnimationFrame(() => chat.current?.scrollTo(0, chat.current.scrollHeight));
  }
  function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); answer(query); }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const { clientX, clientY } = event;
    if (Math.hypot(clientX - drag.current.x, clientY - drag.current.y) < 8 && !drag.current.moved) return;
    drag.current.moved = true;
    const width=event.currentTarget.offsetWidth;
    setDragged({ x: Math.max(8, Math.min(innerWidth - width - 8, clientX - width/2)), y: Math.max(0, clientY - 24) });
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.moved) {
      const value: Placement = { side: event.clientX < innerWidth / 2 ? "left" : "right", y: Math.max(0, event.clientY - 24) };
      setPosition(value);
      try { localStorage.setItem(storage, JSON.stringify(value)); } catch { /* Keep position for this visit. */ }
      skipClick.current = true;
    }
    drag.current = null; setDragged(null);
  }
  function href(path: string) {
    if (path === "/reports") return projectId ? `/projects/${projectId}?view=records` : "/projects";
    if (path === "/boq") return projectId ? `/projects/${projectId}/boq` : "/projects";
    return path;
  }

  return <aside className="ada-help" aria-label="SiteLedger help assistant">
    {open && <section className="ada-panel" id="ada-panel" aria-label="Chat with Ada" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      <header><span className="ada-avatar"><DiaryIcon name="help" size={20}/></span><strong>Ada — SiteLedger assistant</strong><button type="button" className="diary-icon-button" aria-label="Close Ada" onClick={() => setOpen(false)}><DiaryIcon name="close"/></button></header>
      <div className="ada-messages" ref={chat}>
        <p className="ada-answer"><strong>Hi, I&apos;m Ada, your SiteLedger assistant</strong><br/>I can make mistakes. Don’t rely on me alone. Always confirm anything about money or a locked report on the report itself. I can guide you through the steps.</p>
        <div className="ada-topics">{topics.slice(0, 4).map(topic => <button type="button" key={topic.question} onClick={() => answer(topic.question)}>{topic.question}</button>)}</div>
        <div aria-live="polite">{messages.map(({ question, answer: reply }, index) => <div key={index}><p className="ada-question">{question}</p><p className="ada-answer">{reply.answer}<br/><Link href={href(reply.href)} className="text-link" onClick={() => setOpen(false)}>{reply.label}</Link></p></div>)}</div>
      </div>
      <form onSubmit={send}><label className="sr-only" htmlFor="ada-question">Ask Ada</label><input id="ada-question" value={query} onChange={event => setQuery(event.target.value)} maxLength={400} placeholder="Ask about SiteLedger"/><button type="submit" className="diary-icon-button" aria-label="Send question" disabled={!query.trim()}><DiaryIcon name="send"/></button></form>
    </section>}
    <button type="button" className="ada-launch" aria-label={open ? "Close Ada" : "Open Ada help"} aria-expanded={open} aria-controls={open ? "ada-panel" : undefined} data-tour="ada"
      style={dragged ? { left: dragged.x, top: dragged.y, right: "auto", bottom: "auto" } : position ? { [position.side]: 12, [position.side === "left" ? "right" : "left"]: "auto", top: `clamp(env(safe-area-inset-top), ${position.y}px, calc(100dvh - var(--ada-reserve) - 52px))`, bottom: "auto" } : undefined}
      onPointerDown={event => { skipClick.current = false; drag.current = { x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={move} onPointerUp={release} onPointerCancel={() => { drag.current = null; setDragged(null); }}
      onClick={event => { if (event.detail === 0 || !skipClick.current) setOpen(value => !value); skipClick.current = false; }}><DiaryIcon name="help"/><span>Ada</span></button>
  </aside>;
}
