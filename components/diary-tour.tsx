"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DiaryIcon } from "./diary-icon";

type Step = [target: string, title: string, note: string];
const shared: Step[] = [
  ["theme", "Theme", "Switch between Light, Dark and System. SiteLedger starts in Light."],
  ["profile", "Profile", "Open your profile and settings here."],
  ["ada", "Ask Ada", "Move Ada’s button to a convenient spot — drag it after a short press, and it stays where you leave it. She answers help questions and can make mistakes. She never costs, locks, or edits anything: a person confirms all work. Check money and locked records on the report itself."],
];
const screens: Record<string, Step[]> = {
  reports: [["locked-record","Read the locked record","Open a report to see its approved record."],["amendment","Add an amendment","Record a dated correction while keeping the original report available. The sheet scrolls and Confirm stays pinned at the bottom."]],
  today: [["switch-project","Choose a project","Switch projects here. The diary and reports follow the selected project."],["add-work","Add today’s work","Start a voice note, add photos, or do both."],["drafts","Awaiting review","Come back to unfinished notes and costed drafts here."],["measured-progress","Measured progress","See quantities measured against the BoQ from locked reports."],["bot-example","How the Telegram bot works","See an example of the Telegram chat. The real chat lives in Telegram, not on this page."]],
  capture: [["record","Record a voice note","Speak as you would on site. You can listen back before sending."],["photos","Add photos","A photo on its own can start a site note."]],
  confirm: [["work-items","Check the work items","Review the suggested quantities and select their BoQ match."],["materials","Record materials","Keep deliveries and usage here, separate from BoQ costs."],["save-draft","Save draft","Save your edits if you need to finish later."]],
  report: [["report-total","Report total","See the value of the confirmed work."],["day-submissions","Today’s work","Open every costed submission for this site day."],["report-progress","Work progress","See the quantity completed against the planned quantity for each item."],["download-pdf","Download the PDF","Download the formatted report and its photos."],["share","Share a report","Create a client link for the locked report and its PDF."]],
  log: [["locked-record","Read the locked record","Open a report to see its approved record."],["amendment","Add an amendment","Record a dated correction while keeping the original report available."]],
  boq: [["boq-add","Add an item","Enter the scope quantity and the rate supplied for the work."],["boq-upload","Upload BoQ","Review the mapped rows and fix flagged values before saving."],["boq-review","Review flagged values","Open Action required and tap a row to check and correct it."],["boq-progress","Measure the work","Compare completed quantities with planned quantities."],["boq-history","BoQ history","Review the saved rate and quantity changes here."]],
  team: [["invite","Invite a person","Enter an email and choose the recipient’s role. You can resend a pending invitation."],["team-members","Team access","Review who has access to this project."],["permissions","Permissions","Open a member’s role and permissions to choose which actions they can take."]],
  profile: [["profile-card","Your profile","See the details attached to your account."],["avatar","Profile photo","Tap your avatar to choose or take a photo."],["profile-settings","Settings","Open Help or About, send feedback, or switch your theme."],["sign-out","Sign out","Close your session when you finish work."]],
};
const prefix = "siteledger-tour:";
const replay = "siteledger-tour-replay";

export function DiaryTour({ path, person }: { path: string; person: string }) {
  const [steps, setSteps] = useState<Step[]>([]), [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [capture, setCapture] = useState(false);
  const [generation,setGeneration] = useState(0);
  const screen = path === "/today" ? capture ? "capture" : "today" : /^\/confirm\/[^/]+$/.test(path) ? "confirm" :
    /^\/reports\/(?!demo$)[^/]+$/.test(path) ? "report" : path === "/reports" ? "reports" : /^\/log\/(?!demo$)[^/]+$/.test(path) ? "log" :
    path.endsWith("/boq") ? "boq" : path.endsWith("/team") ? "team" : path === "/account" ? "profile" : null;
  const target = useCallback((name: string) => document.querySelector<HTMLElement>(`[data-tour="${name}"]`), []);
  useEffect(() => {
    const restart = () => setGeneration(value=>value+1);
    window.addEventListener(replay,restart);
    return () => window.removeEventListener(replay,restart);
  },[]);
  useEffect(() => {
    if (path !== "/today") return;
    const check = () => setCapture(Boolean(target("record")?.getClientRects().length));
    const observer = new MutationObserver(check);
    observer.observe(document.body,{ childList: true, subtree: true }); check();
    return () => observer.disconnect();
  }, [path,target]);
  const finish = useCallback(() => {
    if (screen) try { localStorage.setItem(`${prefix}${person}:${screen}`, "done"); } catch { /* End this visit either way. */ }
    dialog.current?.close(); setSteps([]); setRect(null);
  }, [person,screen]);

  useEffect(() => {
    if (!screen) return;
    const panel = dialog.current;
    const primary = screens[screen];
    let timer: ReturnType<typeof setTimeout>;
    let observed = false;
    function open() {
      if (observed) return;
      try { if (localStorage.getItem(`${prefix}${person}:${screen}`)) return; } catch { /* Continue for this visit. */ }
      const visible = (step: Step) => Boolean(target(step[0])?.getClientRects().length);
      if (!primary.some(visible)) return;
      if (document.querySelector("dialog[open]")) return;
      observed = true;
      timer = setTimeout(() => {
        if (document.querySelector("dialog[open]")) { observed=false; return; }
        setSteps([...primary, ...shared].filter(visible)); setIndex(0);
      }, 500);
    }
    const observer = new MutationObserver(open);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    open();
    return () => { observer.disconnect(); clearTimeout(timer); panel?.close(); };
  }, [person,screen,target,generation]);

  const step = steps[index];
  useEffect(() => {
    if (!step || !dialog.current) return;
    const element = target(step[0]);
    if (!element?.getClientRects().length) { const frame = requestAnimationFrame(finish); return () => cancelAnimationFrame(frame); }
    element.scrollIntoView({ block: "center", behavior: "instant" });
    const measure = () => setRect(element.getBoundingClientRect());
    const frame = requestAnimationFrame(measure);
    if (!dialog.current.open) dialog.current.showModal();
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", measure); };
  }, [step,finish,target]);

  return <dialog ref={dialog} className="diary-tour" aria-labelledby="tour-title" onCancel={event => { event.preventDefault(); finish(); }}>
    {step && rect && <><div className="diary-tour-ring" style={{ left: Math.max(0,rect.left-3), top: Math.max(0,rect.top-3), width: rect.width+6, height: rect.height+6 }}/>
      <div className="diary-tour-note" data-placement={rect.top > innerHeight * .49 ? "top" : "bottom"}>
        <p className="eyebrow">{index+1} of {steps.length}</p><h2 id="tour-title">{step[1]}</h2><p>{step[2]}</p>
        <div><button type="button" className="text-link" onClick={finish}>Skip</button><button type="button" className="work-button" onClick={() => setIndex(index-1)} disabled={index===0}>Back</button><button type="button" className="work-button work-button-primary" onClick={() => index===steps.length-1?finish():setIndex(index+1)}>{index===steps.length-1?"Done":"Next"}</button></div>
      </div></>}
  </dialog>;
}

export function ReplayTour({ label = "Take the tour again", inPlace = false, help = false, signedIn }: { label?: string; inPlace?: boolean; help?: boolean; signedIn: boolean }) {
  const router = useRouter();
  return <button type="button" className={help?"stitch-menu-row":"stitch-button"} data-primary={help||undefined} onClick={() => {
    try { for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key); } catch { /* Continue to Today. */ }
    window.dispatchEvent(new Event(replay));
    if (!inPlace) router.push(signedIn ? "/today" : "/account");
  }}><DiaryIcon name="tour" size={19}/>{help?<><span><strong>{label}</strong><small>Step-by-step highlights on each screen</small></span><DiaryIcon name="play" size={18}/></>:label}</button>;
}
