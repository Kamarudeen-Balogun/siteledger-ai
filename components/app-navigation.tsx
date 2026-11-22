"use client";
import Link from "next/link";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isWorkspacePath, navigationFallback } from "@/lib/navigation/routes";

type TelegramApp = { initData: string; ready: () => void; expand: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void } };
const Navigation = createContext<{ back: () => void } | null>(null);
const marker = "siteledgerNavigation";
function recordedDepth(state: unknown) {
  const depth = (state as { siteledgerNavigation?: { depth?: unknown } } | null)?.siteledgerNavigation?.depth;
  return typeof depth === "number" && Number.isSafeInteger(depth) && depth >= 0 && depth < window.history.length ? depth : 0;
}

function PathChanges({ changed }: { changed: (path: string) => void }) {
  const pathname = usePathname();
  useEffect(() => changed(pathname), [pathname, changed]);
  return null;
}

export function AppNavigation({ children }: { children: ReactNode }) {
  const router = useRouter(), depth = useRef(0), lastPath = useRef<string | null>(null);
  const [pathname, setPathname] = useState("/");
  const [canBack, setCanBack] = useState(false), [telegram, setTelegram] = useState<TelegramApp | null>(null);
  useEffect(() => {
    function popped(event: PopStateEvent) {
      depth.current = recordedDepth(event.state); lastPath.current = window.location.pathname;
      setCanBack(depth.current > 0);
    }
    window.addEventListener("popstate", popped);
    return () => window.removeEventListener("popstate", popped);
  }, []);
  const changed = useCallback((path: string) => {
    setPathname(path);
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
  const back = useCallback(() => {
    if (depth.current > 0) window.history.back();
    else router.push(navigationFallback(lastPath.current ?? window.location.pathname));
  }, [router]);
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
  return <Navigation.Provider value={{ back }}>{children}<Suspense fallback={null}><PathChanges changed={changed}/></Suspense>{isWorkspacePath(pathname) &&
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => {
      const app = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
      if (app?.initData && app.BackButton) { app.ready(); app.expand(); setTelegram(app); }
    }} />}</Navigation.Provider>;
}

export function WorkspaceNavigation({ current }: { current: "today" | "account" | "projects" | "reports" }) {
  const navigation = useContext(Navigation), menuId = useId(), [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null), menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const links = [["/today", "Today"], ["/projects", "Projects"], ["/account", "Account"], ["/help", "Help"]];
  function back() {
    if (navigation) navigation.back();
    else window.location.assign(navigationFallback(window.location.pathname));
  }
  return <div className="workspace-navigation" ref={container}>
    <button type="button" className="workspace-back" onClick={back}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 5-7 7 7 7M5 12h14" /></svg>Back</button>
    <nav aria-label="Workspace navigation" className="workspace-desktop-nav">{links.map(([href, label]) => <Link key={href} href={href} aria-current={href === `/${current}` ? "page" : undefined}>{label}</Link>)}</nav>
    <div className="workspace-mobile-menu"><button ref={menuButton} type="button" aria-expanded={open} aria-controls={menuId} className="workspace-menu-button" onClick={() => setOpen(value => !value)}>Menu</button>
      {open && <nav id={menuId} aria-label="Workspace menu">{links.map(([href, label]) => <Link key={href} href={href} aria-current={href === `/${current}` ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>)}</nav>}
    </div>
  </div>;
}
