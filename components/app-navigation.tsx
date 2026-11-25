"use client";
import Link from "next/link";
import Script from "next/script";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isWorkspacePath, navigationFallback } from "@/lib/navigation/routes";
import { useActionConfirmation } from "./action-confirmation";
import { resolveClientAccount } from "@/lib/auth/client-session";

type TelegramApp = { initData: string; ready: () => void; expand: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void } };
const Navigation = createContext<{ back: () => void; active: boolean } | null>(null);
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
  const checkAccount = useCallback(() => { void resolveClientAccount().then(account => setActive(Boolean(account))).catch(() => setActive(false)); }, []);
  useEffect(() => { checkAccount(); }, [pathname, checkAccount]);
  useEffect(() => { window.addEventListener("siteledger-account-change", checkAccount); return () => window.removeEventListener("siteledger-account-change", checkAccount); }, [checkAccount]);
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
  return <Navigation.Provider value={{ back, active }}>{children}{confirmation}<Suspense fallback={null}><PathChanges changed={changed}/></Suspense>{(isWorkspacePath(pathname)||pathname==="/") &&
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => {
      const app = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
      if (app?.initData && app.BackButton) { app.ready(); app.expand(); setTelegram(app); }
      checkAccount();
    }} />}</Navigation.Provider>;
}

export function WorkspaceNavigation({ current }: { current: "today" | "account" | "projects" | "reports" }) {
  const navigation = useContext(Navigation);
  const links = navigation?.active ? [["/today", "Today"], ["/projects", "Projects"], ["/account", "Account"], ["/help", "Help"]] : [["/", "Home"], ["/account", "Sign in"], ["/help", "Help"]];
  function back() {
    if (navigation) navigation.back();
    else window.location.assign(navigationFallback(window.location.pathname));
  }
  return <div className="workspace-navigation">
    <button type="button" className="workspace-back" onClick={back}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 5-7 7 7 7M5 12h14" /></svg>Back</button>
    <nav aria-label="Workspace navigation" className="workspace-desktop-nav">{links.map(([href, label]) => <Link key={href} href={href} aria-current={href === `/${current}` ? "page" : undefined}>{label}</Link>)}</nav>
    <nav aria-label="Mobile workspace navigation" className="workspace-dock" style={{gridTemplateColumns:`repeat(${links.length}, 1fr)`}}>{links.map(([href, label]) => <Link key={href} href={href} prefetch={false} aria-current={href === `/${current}` ? "page" : undefined}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={({"/":"M3 10 12 3l9 7v11H3zM9 21v-8h6v8", "/today":"M8 3H5v18h14V3h-3M8 2h8v4H8zM8 11h8M8 15h6", "/projects":"M3 6h7l2 2h9v12H3z", "/account":"M20 21v-2a6 6 0 0 0-12 0v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "/help":"M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20"} as Record<string,string>)[href]} /></svg><span>{label}</span></Link>)}</nav>
  </div>;
}
