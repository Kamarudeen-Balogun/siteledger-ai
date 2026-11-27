"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type FormEvent } from "react";
import { DiaryIcon } from "./diary-icon";

import { adaTopics, answerAda, type AdaReply } from "@/lib/ada";

const storage = "siteledger-ada-position";
const chatStorage = "siteledger-ada-chat";
type Placement = { side: "left" | "right"; y: number };
type Exchange = { question: string; answer: AdaReply };
// The chat survives in-app navigation (tapping a link Ada suggests used
// to wipe the whole conversation, because messages lived only in state).
function loadChat(): { messages: Exchange[]; lastTopic: string | null } {
  try {
    const value = JSON.parse(sessionStorage.getItem(chatStorage) ?? "null");
    if (value && Array.isArray(value.messages)) return { messages: value.messages.filter((item: unknown): item is Exchange => Boolean(item && typeof item === "object" && typeof (item as Exchange).question === "string" && (item as Exchange).answer)).slice(-20), lastTopic: typeof value.lastTopic === "string" ? value.lastTopic : null };
  } catch { /* Start a fresh chat. */ }
  return { messages: [], lastTopic: null };
}

export function AdaHelp({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Exchange[]>(() => loadChat().messages);
  const [lastTopic, setLastTopic] = useState<string | null>(() => loadChat().lastTopic);
  useEffect(() => {
    try { sessionStorage.setItem(chatStorage, JSON.stringify({ messages: messages.slice(-20), lastTopic })); } catch { /* Keep the chat for this visit only. */ }
  }, [messages, lastTopic]);
  const [position, setPosition] = useState<Placement | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storage) ?? "null");
      return value && (value.side === "left" || value.side === "right") && Number.isFinite(value.y) ? value : null;
    } catch { return null; }
  });
  const [dragged, setDragged] = useState<{ x: number; y: number } | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [panelDrag, setPanelDrag] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean; panel: boolean; armed: boolean } | null>(null), skipClick = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chat = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const launch = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); launch.current?.focus(); }
    }
    document.addEventListener("keydown",escape);
    return () => document.removeEventListener("keydown",escape);
  }, [open]);

  function answer(value: string) {
    const question = value.trim().slice(0, 400);
    if (!question) return;
    const reply = answerAda(question, lastTopic);
    setMessages(current => [...current.slice(-19), { question, answer: reply }]);
    setLastTopic(reply.topicId);
    setQuery("");
    requestAnimationFrame(() => chat.current?.scrollTo(0, chat.current.scrollHeight));
  }
  function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); answer(query); }
  function begin(event: PointerEvent<HTMLElement>, isPanel=false) {
    if(event.button!==0 || (isPanel&&(event.target as HTMLElement).closest("button")))return;
    const element=isPanel?panel.current:event.currentTarget;
    const rect=element?.getBoundingClientRect();
    if(!rect)return;
    skipClick.current=false;
    drag.current={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moved:false,panel:isPanel,armed:isPanel};
    // Long-press to drag: the button starts moving after a short press
    // (200ms) or a clear drag (24px), whichever comes first. A quick tap
    // never moves it, and a drag never counts as a tap.
    if(!isPanel){ holdTimer.current=setTimeout(()=>{ if(drag.current) drag.current.armed=true; },200); }
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function bounded(x:number,y:number,element:HTMLElement){
    const dock=document.querySelector(".workspace-dock")?.getBoundingClientRect();
    const floor=dock?.height ? dock.top : innerHeight;
    return {x:Math.max(8,Math.min(innerWidth-element.offsetWidth-8,x)),y:Math.max(8,Math.min(floor-element.offsetHeight-10,y))};
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    const { clientX, clientY } = event;
    const distance = Math.hypot(clientX - drag.current.x, clientY - drag.current.y);
    if (!drag.current.armed && distance < 24) return;
    drag.current.armed = true;
    if (distance < 8 && !drag.current.moved) return;
    drag.current.moved = true;
    const element = drag.current.panel ? panel.current : launch.current;
    if(!element)return;
    const point=bounded(drag.current.left+clientX-drag.current.x,drag.current.top+clientY-drag.current.y,element);
    if(drag.current.panel)setPanelDrag(point);else setDragged(point);
  }
  function release(event: PointerEvent<HTMLElement>) {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (drag.current?.moved) {
      const element=drag.current.panel?panel.current:launch.current;
      if(element){
        const point=bounded(drag.current.left+event.clientX-drag.current.x,drag.current.top+event.clientY-drag.current.y,element);
        if(drag.current.panel)setPanelPosition({x:event.clientX<innerWidth/2?8:innerWidth-element.offsetWidth-8,y:point.y});
        else {
          const value: Placement = { side: event.clientX < innerWidth / 2 ? "left" : "right", y: point.y };
          setPosition(value);
          try { localStorage.setItem(storage, JSON.stringify(value)); } catch { /* Keep position for this visit. */ }
          skipClick.current = true;
        }
      }
    }
    drag.current = null; setDragged(null);setPanelDrag(null);
  }
  function href(path: string) {
    if (path === "/reports") return "/reports";
    if (path === "/boq") return projectId ? `/projects/${projectId}/boq` : "/projects";
    return path;
  }

  const panelPoint=panelDrag??panelPosition;
  return <aside className="ada-help" aria-label="SiteLedger help assistant">
    {open && <section ref={panel} className="ada-panel" id="ada-panel" role="dialog" aria-label="Chat with Ada"
      data-dragging={Boolean(panelDrag)||undefined} style={panelPoint?{left:`clamp(8px, ${panelPoint.x}px, calc(100vw - min(360px, 92vw) - 8px))`,top:`clamp(8px, ${panelPoint.y}px, var(--ada-panel-limit))`,right:"auto",bottom:"auto"}:undefined}>
      <header className="ada-head" onPointerDown={event=>begin(event,true)} onPointerMove={move} onPointerUp={release} onPointerCancel={()=>{drag.current=null;setPanelDrag(null);}}>
        <span className="ada-avatar"><DiaryIcon name="help" size={20}/></span><div><strong>Ada — SiteLedger assistant</strong><small>Help for using SiteLedger</small></div>
        <button type="button" className="diary-icon-button" aria-label="Close Ada" onClick={() => {setOpen(false);launch.current?.focus();}}><DiaryIcon name="close" size={20}/></button>
      </header>
      <div className="ada-messages" ref={chat}>
        <p className="ada-answer"><strong>Hi, I&apos;m Ada, your SiteLedger assistant.</strong><br/>I can guide you through recording work, costing it, and finding your reports. I can make mistakes, so do not rely on me alone — always confirm anything about money or a locked report on the report itself.</p>
        <div aria-live="polite">{messages.map(({ question, answer: reply }, index) => <div key={index}><p className="ada-question">{question}</p><p className="ada-answer">{reply.answer}<br/><Link href={href(reply.href)} className="text-link" onClick={() => setOpen(false)}>{reply.label}</Link></p></div>)}</div>
      </div>
      <div className="ada-topics">{adaTopics.map(topic => <button type="button" key={topic.id} onClick={() => answer(topic.question)}>{topic.question}</button>)}</div>
      <form onSubmit={send}><label className="sr-only" htmlFor="ada-question">Ask Ada</label><input id="ada-question" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} maxLength={400} placeholder="Ask Ada a help question…"/><button type="submit" className="diary-icon-button" aria-label="Send question" disabled={!query.trim()}><DiaryIcon name="send" size={20}/></button></form>
      <p className="ada-foot">Ada can make mistakes. Check money and locked-report details on the report itself.</p>
    </section>}
    <button ref={launch} type="button" className="ada-launch" aria-label={open ? "Hide Ada" : "Open Ada help"} aria-expanded={open} aria-controls={open ? "ada-panel" : undefined} data-tour="ada" data-dragging={Boolean(dragged)||undefined}
      style={dragged ? { left: dragged.x, top: dragged.y, right: "auto", bottom: "auto" } : position ? { [position.side]: 12, [position.side === "left" ? "right" : "left"]: "auto", top: `clamp(env(safe-area-inset-top), ${position.y}px, calc(100dvh - var(--ada-reserve) - 52px))`, bottom: "auto" } : undefined}
      onPointerDown={event => begin(event)}
      onPointerMove={move} onPointerUp={release} onPointerCancel={() => { drag.current = null; setDragged(null); }}
      onClick={event => { if (event.detail === 0 || !skipClick.current) setOpen(value => !value); skipClick.current = false; }}><DiaryIcon name="help"/><span>Ada</span></button>
  </aside>;
}
