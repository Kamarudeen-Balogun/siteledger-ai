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
const Navigation = createContext<{ back: () => void; active: boolean; ready: boolean; projectId: string | null; selectProject: (id: string) => void; person: string | null; projects: PrivateProject[]; pathname: string; avatar: boolean; avatarVersion: number } | null>(null);
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
  // The session check is async: until the first check settles, `active` is
  // still its initial false and the header would flash a "Sign in" link
  // for a signed-in user. Nothing session-dependent renders until ready.
  const [ready, setReady] = useState(false);
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
      finally { if (request === accountRequest.current) setReady(true); }
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
  return <Navigation.Provider value={{ back, active, ready, projectId, selectProject, person, projects, pathname, avatar, avatarVersion }}>{children}{confirmation}{changing&&workspace&&<div className="stitch-transition" aria-hidden="true"/>}{workspace&&!pathname.endsWith("/demo")&&<AdaHelp projectId={projectId}/>} {person&&<DiaryTour key={`${person}/${pathname}`} person={person} path={pathname}/>}<Suspense fallback={null}><PathChanges changed={changed}/></Suspense>{(workspace||pathname==="/") &&
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => {
      const app = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
      if (app?.initData && app.BackButton) { app.ready(); app.expand(); setTelegram(app); }
      checkAccount();
    }} />}</Navigation.Provider>;
}

export function WorkspaceProfile({ onlyWhenActive = false }: { onlyWhenActive?: boolean } = {}) {
  const navigation = useContext(Navigation);
  // Until the session check settles, render nothing rather than a "Sign in"
  // link a signed-in user would see flash on every page load.
  if (!navigation) return <Link href="/account" prefetch={false} className="public-button homepage-signin" data-tour="profile">Sign in</Link>;
  if (!navigation.ready) return null;
  if (!navigation.active) {
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
  // The mock project is not a real project: it has no server-side active
  // state, so "mock is current" is derived from the path, never from the
  // server project id — the session check would otherwise overwrite it
  // with the previous real project on every navigation.
  const isMock = (navigation?.pathname ?? "").startsWith("/projects/mock");
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
      // Stay in the section the switch was opened from. Switching from the
      // Projects list or a project overview must land on the project
      // overview — landing on the team page instead made its role-gated
      // Invite button appear and vanish as the project changed. Switching
      // from a team page stays on the team page. Switching back from the
      // mock project always lands on the new Today for that project —
      // never on the old project page.
      const fromMock = (navigation?.pathname ?? "").startsWith("/projects/mock");
      const onTeam = /^\/projects\/[a-f0-9-]{36}\/team/.test(navigation?.pathname ?? "");
      const path = fromMock ? "/today" : current === "today" ? "/today" : current === "boq" ? `/projects/${id}/boq` : current === "reports" ? "/reports" : onTeam ? `/projects/${id}/team` : `/projects/${id}`;
      router.push(path);
      router.refresh();
    } catch (error) {
      // The optimistic switch was wrong: reload the real active project.
      window.dispatchEvent(new Event("siteledger-project-change"));
      setError(error instanceof Error ? error.message : "Could not switch projects.");
    } finally { setBusy(false); }
  }
  function selectMock() {
    // The mock is demo data, not a real project: there is no server-side
    // select to run. It still counts as a project switch, so listeners
    // refresh, and the path itself marks the mock as current. The landing
    // is the mock's Today view, explicitly — tapping the current mock from
    // a sub-view (BoQ, Team, log) must return to Today, exactly as
    // tapping a current real project returns to its Today.
    setError("");
    sheet.current?.close();
    window.dispatchEvent(new Event("siteledger-project-change"));
    router.push("/projects/mock?view=today");
    router.refresh();
  }
  return <>
    <button type="button" className="stitch-project-switch" data-tour="switch-project" onClick={() => { setError(""); sheet.current?.showModal(); }}>
      <DiaryIcon name="building" size={18}/><strong>{project ?? selected?.name ?? "Choose a project"}</strong>
      {isMock ? <span className="stitch-kicker">Demo data</span> : selected?.client && <span className="stitch-kicker">{selected.client}</span>}<DiaryIcon name="switch" size={18}/>
    </button>
    <dialog ref={sheet} className="action-dialog stitch-sheet" aria-label="Switch project">
      <div className="action-dialog__body">
        <h2>Switch project</h2>
        {projects.length ? <ul>{projects.map(item => <li key={item.id}>
          <button type="button" className="stitch-menu-row" disabled={busy} onClick={() => void select(item.id)}>
            <DiaryIcon name="building"/><span><strong>{item.name}</strong><small>{item.archived_at ? "Archived" : item.client}</small></span>{id===item.id && !isMock ? <span className="stitch-switch-current"><DiaryIcon name="verified" size={18}/><span className="stitch-kicker">Current</span></span> : <DiaryIcon name="chevron" size={18}/>}
          </button>
        </li>)}</ul> : <p>No projects to switch to yet.</p>}
        {!mockHidden && <button type="button" className="stitch-menu-row" disabled={busy} onClick={() => selectMock()}><DiaryIcon name="flask"/><span><strong>Mock project — Sample Duplex, Ikeja</strong><small>Demo data · not a real project</small></span>{isMock ? <span className="stitch-switch-current"><DiaryIcon name="verified" size={18}/><span className="stitch-kicker">Current</span></span> : <span className="stitch-chip">Demo</span>}</button>}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="action-dialog__actions stitch-sheet-actions"><Link href="/projects" className="work-button" onClick={() => sheet.current?.close()}>All projects</Link><button type="button" className="work-button" onClick={() => sheet.current?.close()}>Close</button></div>
    </dialog>
  </>;
}

export function WorkspaceNavigation({ current, onBack }: { current: WorkspaceArea; onBack?: () => void }) {
  const navigation = useContext(Navigation);
  const path = navigation?.pathname ?? "/";
  // On the mock project the dock stays on the mock: its Today, Reports,
  // BoQ and Team tabs are the mock views, never the real project's pages.
  const isMock = path.startsWith("/projects/mock");
  const project = isMock ? null : /^\/projects\/([a-f0-9-]{36})(?:\/|$)/.exec(path)?.[1] ?? navigation?.projectId;
  const projectHref = isMock ? "/projects/mock" : project ? `/projects/${project}` : null;
  const links = [
    { href: isMock ? "/projects/mock?view=today" : "/today", label: "Today", area: "today", icon: "today" },
    { href: isMock ? "/projects/mock?view=log" : "/reports", label: "Reports & Log", area: "reports", icon: "reports" },
    { href: isMock ? "/projects/mock?view=boq" : projectHref ? `${projectHref}/boq` : "/projects", label: "BoQ & Rates", area: "boq", icon: "boq" },
    { href: isMock ? "/projects/mock?view=team" : projectHref ? `${projectHref}/team` : "/projects", label: "Projects & Team", area: "projects", icon: "team" },
  ] as const;
  function back() {
    // A caller-supplied back action wins: during "Add today's work"
    // the header Back closes the capture sheet instead of leaving
    // the page (the icon button in the title already does this).
    if (onBack) { onBack(); return; }
    if (navigation) navigation.back();
    else window.location.assign(navigationFallback(window.location.pathname));
  }
  // Desktop top nav (Stitch desktop adaptation): the workspace areas
  // as a tab bar — Today / Projects / BoQ & Rates / Reports & Log /
  // Team / Settings. The mobile dock keeps its four tabs; the desktop
  // bar splits Projects & Team and adds Settings. The active item is
  // derived from the path (and the workspace area for the mock, whose
  // view lives in the query string): mock team is the only mock view
  // whose area is "projects", so that area means Team on the mock.
  const desktopLinks: [string, string][] = navigation?.active ? (isMock ? [
    ["/projects/mock?view=today", "Today"],
    ["/projects", "Projects"],
    ["/projects/mock?view=boq", "BoQ & Rates"],
    ["/projects/mock?view=log", "Reports & Log"],
    ["/projects/mock?view=team", "Team"],
    ["/account", "Settings"],
  ] : [
    ["/today", "Today"],
    ["/projects", "Projects"],
    [projectHref ? `${projectHref}/boq` : "/projects", "BoQ & Rates"],
    ["/reports", "Reports & Log"],
    [projectHref ? `${projectHref}/team` : "/projects", "Team"],
    ["/account", "Settings"],
  ]) : [["/", "Home"], ["/account", "Sign in"], ["/help", "Help"]];
  function desktopActive(label: string): boolean {
    if (isMock) {
      if (current === "boq") return label === "BoQ & Rates";
      if (current === "reports") return label === "Reports & Log";
      if (current === "projects") return label === "Team";
      return label === "Today";
    }
    if (label === "Settings") return path.startsWith("/account");
    if (label === "Today") return path === "/today";
    if (label === "Reports & Log") return path === "/reports" || path.startsWith("/reports/") || path.startsWith("/log/");
    if (label === "BoQ & Rates") return /\/boq(?:\/|$)/.test(path) || current === "boq";
    if (label === "Team") return /\/team(?:\/|$)/.test(path);
    if (label === "Projects") return path === "/projects" || /^\/projects\/[a-f0-9-]{36}/.test(path);
    return false;
  }
  return <div className="workspace-navigation">
    <button type="button" className="workspace-back" onClick={back}><DiaryIcon name="back" size={18}/>Back</button>
    <nav aria-label="Workspace navigation" className="workspace-desktop-nav">{(navigation?.ready ? navigation.active ? desktopLinks : [["/", "Home"], ["/account", "Sign in"], ["/help", "Help"]] : []).map(([href,label]) => <Link key={href} href={href} aria-current={desktopActive(label) ? "page" : undefined}>{label}</Link>)}</nav>
    {navigation?.active && <nav aria-label="Mobile workspace navigation" className="workspace-dock">{links.map(({href,label,area,icon}) => <Link key={area} href={href} prefetch={false} aria-current={area === current ? "page" : undefined}><DiaryIcon name={icon}/><span>{label}</span></Link>)}</nav>}
  </div>;
}
