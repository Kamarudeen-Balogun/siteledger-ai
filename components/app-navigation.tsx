"use client";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isWorkspacePath, navigationFallback } from "@/lib/navigation/routes";
import { useActionConfirmation } from "./action-confirmation";
import { resolveClientAccount } from "@/lib/auth/client-session";
import { DiaryIcon } from "./diary-icon";
import { AdaHelp } from "./ada-help";
import { DiaryTour } from "./diary-tour";
import type { WorkspaceArea } from "./workspace-header";

type TelegramApp = { initData: string; ready: () => void; expand: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void } };
const Navigation = createContext<{ back: () => void; active: boolean; projectId: string | null; pathname: string; avatar: boolean; avatarVersion: number } | null>(null);
const marker = "siteledgerNavigation";
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
  const [pathname, setPathname] = useState("/");
  const [active, setActive] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [avatar,setAvatar]=useState(false),[avatarVersion,setAvatarVersion]=useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
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
        if (!account) { setProjectId(null); return; }
        const launch = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
        if (account.telegram_linked && launch?.initData && window.location.pathname === "/") router.replace("/today");
        const response = await fetch("/api/projects/private", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const data = response.ok ? await response.json() : null;
        if (request === accountRequest.current) setProjectId(data?.active_project_id ?? null);
      } catch { if (request === accountRequest.current && navigator.onLine) { setActive(false); setPerson(null); setProjectId(null); } }
    })();
  }, [router]);
  useEffect(() => { checkAccount(); }, [pathname, checkAccount]);
  useEffect(() => { window.addEventListener("siteledger-account-change", checkAccount); return () => window.removeEventListener("siteledger-account-change", checkAccount); }, [checkAccount]);
  useEffect(() => { window.addEventListener("siteledger-project-change", checkAccount); return () => window.removeEventListener("siteledger-project-change", checkAccount); }, [checkAccount]);
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
    } else depth.current += 1;
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
  return <Navigation.Provider value={{ back, active, projectId, pathname, avatar, avatarVersion }}>{children}{confirmation}{isWorkspacePath(pathname)&&<AdaHelp projectId={projectId}/>} {person&&<DiaryTour key={`${person}/${pathname}`} person={person} path={pathname}/>}<Suspense fallback={null}><PathChanges changed={changed}/></Suspense>{(isWorkspacePath(pathname)||pathname==="/") &&
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => {
      const app = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
      if (app?.initData && app.BackButton) { app.ready(); app.expand(); setTelegram(app); }
      checkAccount();
    }} />}</Navigation.Provider>;
}

export function WorkspaceProfile() {
  const navigation = useContext(Navigation);
  return <Link href="/account" prefetch={false} className="diary-icon-button diary-profile-button" aria-label={navigation?.active ? "Profile" : "Account"} data-tour="profile">{navigation?.active&&navigation.avatar?<Image src={`/api/account/avatar?v=${navigation.avatarVersion}`} unoptimized alt="" width={48} height={48}/>:<DiaryIcon name="profile" size={19}/>}</Link>;
}

export function WorkspaceNavigation({ current }: { current: WorkspaceArea }) {
  const navigation = useContext(Navigation);
  const path = navigation?.pathname ?? "/";
  const project = /^\/projects\/([a-f0-9-]{36})(?:\/|$)/.exec(path)?.[1] ?? navigation?.projectId;
  const projectHref = project ? `/projects/${project}` : null;
  const links = [
    { href: "/today", label: "Today", area: "today", icon: "today" },
    { href: projectHref ? `${projectHref}?view=records` : "/projects", label: "Reports & Log", area: "reports", icon: "reports" },
    { href: projectHref ? `${projectHref}/boq` : "/projects", label: "BoQ & Rates", area: "boq", icon: "boq" },
    { href: "/projects", label: "Projects & Team", area: "projects", icon: "team" },
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
