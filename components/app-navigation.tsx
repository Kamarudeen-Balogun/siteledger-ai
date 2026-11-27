"use client";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { isWorkspacePath, navigationFallback } from "@/lib/navigation/routes";
import { useActionConfirmation } from "./action-confirmation";
import { resolveClientAccount } from "@/lib/auth/client-session";
import { DiaryIcon } from "./diary-icon";
import { AdaHelp } from "./ada-help";
import { DiaryTour } from "./diary-tour";
import type { WorkspaceArea } from "./workspace-header";
import type { PrivateProject } from "@/lib/projects/types";
import { projectAction } from "@/lib/projects/client-actions";

type TelegramApp = { initData: string; ready: () => void; expand: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void } };
const Navigation = createContext<{ back: () => void; active: boolean; projectId: string | null; selectProject: (id: string) => void; person: string | null; projects: PrivateProject[]; pathname: string; avatar: boolean; avatarVersion: number } | null>(null);
const marker = "siteledgerNavigation";
const mockListen = (notify: () => void) => { window.addEventListener("siteledger-mock-change", notify); window.addEventListener("storage", notify); return () => { window.removeEventListener("siteledger-mock-change", notify); window.removeEventListener("storage", notify); }; };
function recordedDepth(state: unknown) {
  const depth = (state as { siteledgerNavigation?: { depth?: unknown } } | null)?.siteledgerNavigation?.depth;
  return typeof depth === "number" && Number.isSafeInteger(depth) && depth >= 0 && depth < window.history.length ? depth : 0;
}

function PathChanges({ changed }: { changed: (path: string) => void }) {
  const pathname = usePathname(), query = useSearchParams().toString();
  useEffect(() => changed(pathname + (query ? `?${query}` : "")), [pathname, query, changed]);
  return null;
}

export function AppNavigation({ children }: { children: ReactNode }) {
  const router = useRouter(), depth = useRef(0), lastPath = useRef<string | null>(null);
  const { confirm, confirmation } = useActionConfirmation();
  const [changing, setChanging] = useState(false);
  const [pathname, setPathname] = useState("/");
  const [active, setActive] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [avatar,setAvatar]=useState(false),[avatarVersion,setAvatarVersion]=useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<PrivateProject[]>([]);
  // Project switching must update the active project in app state
  // IMMEDIATELY on select — never wait for a pathname change or a
  // refetch to confirm it. The server call below confirms it after.
  const selectProject = useCallback((id: string) => { setProjectId(id); }, []);
  useEffect(() => {
    if (!changing) return;
    const timer=setTimeout(()=>setChanging(false),280);
    return()=>clearTimeout(timer);
  },[changing]);
  const accountRequest = useRef(0);
  const checkAccount = useCallback(() => {
    const request = ++accountRequest.current;
    void (async () => {
      try {
        const account = await resolveClientAccount();
        if (request !== accountRequest.current) return;
        setActive(Boolean(account));
        setPerson(account?.profile_id ?? null);
        setAvatar(Boolean(account?.has_photo));
        if (!account) { setProjectId(null); setProjects([]); return; }
        const launch = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
        if (account.telegram_linked && launch?.initData && window.location.pathname === "/") router.replace("/today");
        const response = await fetch("/api/projects/private", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const data = response.ok ? await response.json() : null;
        if (request === accountRequest.current) { setProjectId(data?.active_project_id ?? null); setProjects(data?.projects ?? []); }
      } catch { if (request === accountRequest.current && navigator.onLine) { setActive(false); setPerson(null); setProjectId(null); setProjects([]); } }
    })();
  }, [router]);
  useEffect(() => { checkAccount(); }, [pathname, checkAccount]);
  useEffect(() => { window.addEventListener("siteledger-account-change", checkAccount); return () => window.removeEventListener("siteledger-account-change", checkAccount); }, [checkAccount]);
  useEffect(() => { window.addEventListener("siteledger-project-change", checkAccount); return () => window.removeEventListener("siteledger-project-change", checkAccount); }, [checkAccount]);
  // Server-rendered workspace lists (/reports, Today) only swap when the
  // server re-renders. A project switch must refresh them too — a
  // same-path switch (e.g. /today → /today) otherwise shows stale data.
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("siteledger-project-change", refresh);
    return () => window.removeEventListener("siteledger-project-change", refresh);
  }, [router]);
  useEffect(() => {const refresh=()=>{setAvatarVersion(value=>value+1);checkAccount();};window.addEventListener("siteledger-avatar-change",refresh);return()=>window.removeEventListener("siteledger-avatar-change",refresh);},[checkAccount]);
  const [canBack, setCanBack] = useState(false), [telegram, setTelegram] = useState<TelegramApp | null>(null);
  useEffect(() => {
    function popped(event: PopStateEvent) {
      depth.current = recordedDepth(event.state); lastPath.current = window.location.pathname + window.location.search;
      setCanBack(depth.current > 0);
    }
    window.addEventListener("popstate", popped);
    return () => window.removeEventListener("popstate", popped);
  }, []);
  const changed = useCallback((path: string) => {
    setPathname(path.split("?")[0]);
    if (lastPath.current === path) return;
    if (lastPath.current === null) {
      depth.current = recordedDepth(window.history.state);
      // Ordinary same-site links can reload the document. A first Telegram or
      // external launch has no trusted previous app page and uses a local parent.
      if (!depth.current && window.history.length > 1 && document.referrer) {
        try { if (new URL(document.referrer).origin === window.location.origin) depth.current = 1; } catch { /* No previous site page. */ }
      }
    } else { depth.current += 1; setChanging(true); }
    lastPath.current = path;
    const state = typeof window.history.state === "object" && window.history.state !== null ? window.history.state : {};
    // Preserve Next's own history state. Store only a depth, no tokens, query
    // strings, project content or account data. Browser Back keeps the real URL.
    window.history.replaceState({ ...state, [marker]: { depth: depth.current } }, "");
    setCanBack(depth.current > 0);
  }, []);
  const canLeave = useCallback(async () => !document.querySelector('[data-unsaved="true"]') || await confirm({title:"Leave without saving these changes?",description:"Attachments or edits on this screen have not been saved. Saved notes and reports stay in your project.",confirmLabel:"Leave page",danger:true}),[confirm]);
  const back = useCallback(async () => {
    const dialog=document.querySelector<HTMLDialogElement>("dialog[open]");
    if(dialog){dialog.close();return;}
    if(!await canLeave())return;
    if (depth.current > 0) window.history.back();
    else router.push(navigationFallback(lastPath.current?.split("?")[0] ?? window.location.pathname));
  }, [router,canLeave]);
  useEffect(()=>{
    function leaving(event:BeforeUnloadEvent){if(document.querySelector('[data-unsaved="true"]')){event.preventDefault();event.returnValue="";}}
    async function navigate(event:MouseEvent){
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!document.querySelector('[data-unsaved="true"]'))return;
      const link=(event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if(!link||link.download||link.target==="_blank")return;
      const target=new URL(link.href);if(target.origin!==location.origin||target.pathname+target.search===location.pathname+location.search)return;
      event.preventDefault();event.stopPropagation();
      if(await canLeave())router.push(target.pathname+target.search+target.hash);
    }
    window.addEventListener("beforeunload",leaving);document.addEventListener("click",navigate,true);
    return()=>{window.removeEventListener("beforeunload",leaving);document.removeEventListener("click",navigate,true);};
  },[router,canLeave]);
  useEffect(() => {
    if (!telegram) return;
    telegram.BackButton.onClick(back);
    return () => telegram.BackButton.offClick(back);
  }, [telegram, back]);
  useEffect(() => {
    if (!telegram) return;
    if (canBack || pathname !== "/") telegram.BackButton.show();
    else telegram.BackButton.hide();
  }, [telegram, pathname, canBack]);
  const workspace = isWorkspacePath(pathname) || (active && pathname === "/help");
  return <Navigation.Provider value={{ back, active, projectId, selectProject, person, projects, pathname, avatar, avatarVersion }}>{children}{confirmation}{changing&&workspace&&<div className="stitch-transition" aria-hidden="true"/>}{workspace&&!pathname.endsWith("/demo")&&<AdaHelp projectId={projectId}/>} {person&&<DiaryTour key={`${person}/${pathname}`} person={person} path={pathname}/>}<Suspense fallback={null}><PathChanges changed={changed}/></Suspense>{(workspace||pathname==="/") &&
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => {
      const app = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
      if (app?.initData && app.BackButton) { app.ready(); app.expand(); setTelegram(app); }
      checkAccount();
    }} />}</Navigation.Provider>;
}

export function WorkspaceProfile({ onlyWhenActive = false }: { onlyWhenActive?: boolean } = {}) {
  const navigation = useContext(Navigation);
  if (!navigation?.active) {
    // Public pages must show no sign of a signed-in user unless one is actually
    // signed in: logged-out visitors get a plain Sign in link, never a profile icon.
    if (onlyWhenActive) return null;
    return <Link href="/account" prefetch={false} className="public-button homepage-signin" data-tour="profile">Sign in</Link>;
  }
  return <Link href="/account" prefetch={false} className="diary-icon-button diary-profile-button" aria-label="Profile" data-tour="profile">{navigation.avatar?<Image src={`/api/account/avatar?v=${navigation.avatarVersion}`} unoptimized alt="" width={32} height={32}/>:<DiaryIcon name="profile" size={18}/>}</Link>;
}

export function WorkspaceBack({ onBack }: { onBack?: () => void }) {
  const navigation = useContext(Navigation);
  return <button type="button" className="stitch-back" aria-label="Go back" onClick={() => onBack ? onBack() : navigation?.back()}><DiaryIcon name="back"/></button>;
}

export function WorkspaceProjectPicker({ current, project, projectId }: { current: WorkspaceArea; project?: string; projectId?: string }) {
  const navigation = useContext(Navigation);
  const router = useRouter(), sheet = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const id = projectId ?? navigation?.projectId;
  const projects = navigation?.projects ?? [];
  const selected = projects.find(item => item.id === id);
  // The mock project is a demo-data entry in the switcher, not a real
  // project. It hides when the user deletes it (same per-person flag as
  // MockProjectControl) and returns via Restore in Help / Settings.
  const mockHidden = useSyncExternalStore(mockListen, () => {
    try { return Boolean(navigation?.person) && localStorage.getItem(`siteledger-mock-hidden:${navigation!.person}`) === "yes"; } catch { return false; }
  }, () => false);
  if (!project && !navigation?.active) return null;
  async function select(id: string) {
    setBusy(true);
    setError("");
    try {
      // Update the active project in app state FIRST, so every screen
      // that reads it (header, dock, Ada, Today, Log) swaps at once —
      // even when the destination path is the one we are already on.
      navigation?.selectProject(id);
      await projectAction("select", { project_id: id });
      sheet.current?.close();
      const path = current === "today" ? "/today" : current === "boq" ? `/projects/${id}/boq` : current === "reports" ? "/reports" : `/projects/${id}/team`;
      router.push(path);
      router.refresh();
    } catch (error) {
      // The optimistic switch was wrong: reload the real active project.
      window.dispatchEvent(new Event("siteledger-project-change"));
      setError(error instanceof Error ? error.message : "Could not switch projects.");
    } finally { setBusy(false); }
  }
  return <>
    <button type="button" className="stitch-project-switch" data-tour="switch-project" onClick={() => { setError(""); sheet.current?.showModal(); }}>
      <DiaryIcon name="building" size={18}/><strong>{project ?? selected?.name ?? "Choose a project"}</strong>
      {selected?.client && <span className="stitch-kicker">{selected.client}</span>}<DiaryIcon name="switch" size={18}/>
    </button>
    <dialog ref={sheet} className="action-dialog stitch-sheet" aria-label="Switch project">
      <div className="action-dialog__body">
        <h2>Switch project</h2>
        {projects.length ? <ul>{projects.map(item => <li key={item.id}>
          <button type="button" className="stitch-menu-row" disabled={busy} onClick={() => void select(item.id)}>
            <DiaryIcon name="building"/><span><strong>{item.name}</strong><small>{item.archived_at ? "Archived" : item.client}</small></span>{id===item.id ? <DiaryIcon name="verified" size={18}/> : <DiaryIcon name="chevron" size={18}/>}
          </button>
        </li>)}</ul> : <p>No projects to switch to yet.</p>}
        {!mockHidden && <Link href="/projects/mock" className="stitch-menu-row" onClick={() => sheet.current?.close()}><DiaryIcon name="flask"/><span><strong>Mock project — Sample Duplex, Ikeja</strong><small>Demo data · not a real project</small></span><span className="stitch-chip">Demo</span></Link>}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="action-dialog__actions stitch-sheet-actions"><Link href="/projects" className="work-button" onClick={() => sheet.current?.close()}>All projects</Link><button type="button" className="work-button" onClick={() => sheet.current?.close()}>Close</button></div>
    </dialog>
  </>;
}

export function WorkspaceNavigation({ current }: { current: WorkspaceArea }) {
  const navigation = useContext(Navigation);
  const path = navigation?.pathname ?? "/";
  const project = /^\/projects\/([a-f0-9-]{36})(?:\/|$)/.exec(path)?.[1] ?? navigation?.projectId;
  const projectHref = project ? `/projects/${project}` : null;
  const links = [
    { href: "/today", label: "Today", area: "today", icon: "today" },
    { href: "/reports", label: "Reports & Log", area: "reports", icon: "reports" },
    { href: projectHref ? `${projectHref}/boq` : "/projects", label: "BoQ & Rates", area: "boq", icon: "boq" },
    { href: projectHref ? `${projectHref}/team` : "/projects", label: "Projects & Team", area: "projects", icon: "team" },
  ] as const;
  function back() {
    if (navigation) navigation.back();
    else window.location.assign(navigationFallback(window.location.pathname));
  }
  return <div className="workspace-navigation">
    <button type="button" className="workspace-back" onClick={back}><DiaryIcon name="back" size={18}/>Back</button>
    <nav aria-label="Workspace navigation" className="workspace-desktop-nav">{(navigation?.active ? [["/today", "Today"], ["/projects", "Projects"], ["/account", "Account"], ["/help", "Help"]] : [["/", "Home"], ["/account", "Sign in"], ["/help", "Help"]]).map(([href,label]) => <Link key={href} href={href} aria-current={href === `/${current}` ? "page" : undefined}>{label}</Link>)}</nav>
    {navigation?.active && <nav aria-label="Mobile workspace navigation" className="workspace-dock">{links.map(({href,label,area,icon}) => <Link key={area} href={href} prefetch={false} aria-current={area === current ? "page" : undefined}><DiaryIcon name={icon}/><span>{label}</span></Link>)}</nav>}
  </div>;
}
