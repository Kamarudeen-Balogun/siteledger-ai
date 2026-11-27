"use client";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DiaryIcon } from "./diary-icon";
import { WorkspaceProfile } from "./app-navigation";
import { LandingAccountLink } from "./landing-account-link";

const menuLinks = [
  ["/about", "About"],
  ["/reports/demo", "Sample report"],
  ["/trial", "Trial"],
  ["/help", "Help & FAQ"],
  ["/contact", "Contact"],
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
] as const;

function PublicMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open ]);
  return <>
    <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded px-2 text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-95">
      <span className="font-label-ledger text-label-ledger text-on-surface">Menu</span>
      <DiaryIcon name="switch" size={18} />
    </button>
    {/* The dialog is portalled to document.body, NOT rendered inside the
        header: the header uses backdrop-blur-xl, and a backdrop-filter makes
        its element the containing block for fixed-position descendants, so a
        `fixed inset-0` dialog nested in the header is only the header's ~64px
        box instead of the viewport (the drawer looked transparent because its
        solid background covered only the top strip). Portalling keeps the
        header's blur and gives the dialog the full viewport again. */}
    {open && createPortal(<div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Site menu">
      <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 h-full w-full cursor-default bg-black/40" />
      <div className="absolute right-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-surface shadow-xl">
        <div className="flex h-16 items-center justify-between px-4 pt-safe">
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-primary-container"><span className="font-stamp-label text-stamp-label text-on-primary">SL</span></span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">SiteLedger AI</span>
          </span>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high active:scale-95"><DiaryIcon name="close" size={22} /></button>
        </div>
        <nav aria-label="Site menu" className="flex flex-col gap-1 px-4 pb-6">
          {menuLinks.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-[48px] items-center justify-between rounded px-3 py-3 font-label-ledger text-label-ledger text-on-surface hover:bg-surface-container active:scale-[0.99]">{label}<DiaryIcon name="chevron" size={18} /></Link>)}
        </nav>
        <div className="mt-auto border-t border-surface-container-high px-4 py-4 pb-safe">
          <LandingAccountLink className="flex h-12 w-full items-center justify-center rounded bg-primary-container px-4 font-label-ledger text-label-ledger text-on-primary" anonymousLabel="Sign in / Create account" activeHref="/today" activeLabel="Open your projects" />
          <a href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer" className="mt-2 flex min-h-[48px] items-center justify-center gap-2 rounded font-label-ledger text-label-ledger text-primary">Telegram @SiteLedgerNGbot</a>
        </div>
      </div>
    </div>, document.body)}
  </>;
}

export function PublicSite({ children, current }: { children: ReactNode; current: string }) {
  return <div className="transplant public-site min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased">
    <a href="#content" className="skip-link">Skip to content</a>
    <header className="fixed top-0 z-40 w-full bg-surface/90 pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="public-column flex h-16 items-center justify-between gap-2">
        <Link href="/" className="flex min-h-[48px] items-center gap-2 active:scale-95" aria-label="SiteLedger AI home">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-primary-container"><span className="font-stamp-label text-stamp-label text-on-primary">SL</span></span>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">SiteLedger AI</span>
        </Link>
        <div className="flex items-center gap-1">
          <LandingAccountLink className="flex h-10 min-h-[44px] items-center justify-center rounded bg-surface-container-high px-4 font-label-ledger text-label-ledger text-on-surface transition-colors hover:bg-surface-container-highest active:scale-95" anonymousLabel="Sign in" activeHref="/today" activeLabel="Open diary" />
          <WorkspaceProfile onlyWhenActive />
          <PublicMenu />
        </div>
      </div>
    </header>
    <main id="content" tabIndex={-1} className="pt-16">{children}</main>
    <footer className="public-column mt-10 flex flex-col gap-4 border-t border-surface-container-high pb-safe pt-6">
      <div className="flex items-center justify-between">
        <span className="font-stamp-label text-stamp-label uppercase text-primary">Digital Site Diary</span>
      </div>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-ledger text-label-ledger" aria-label="Footer navigation">
        {menuLinks.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined} className="flex min-h-[44px] items-center py-1 text-on-surface-variant transition-colors hover:text-on-surface">{label}</Link>)}
      </nav>
      <div className="flex flex-col gap-1 pb-6 pt-2">
        <p className="font-body-sm text-body-sm text-on-surface-variant">The day’s work, confirmed and costed. A record you can return to.</p>
        <p className="font-body-sm text-body-sm leading-6 text-on-surface-variant">Built by Balogun Kamarudeen Ayomide — Civil Engineer &amp; AI Automation Specialist · <a className="underline" href="https://codeflowx.dev" target="_blank" rel="noreferrer">codeflowx.dev</a> · <a className="underline" href="mailto:kamarudeen@codeflowx.dev">kamarudeen@codeflowx.dev</a> · <a className="underline" href="https://github.com/Kamarudeen-Balogun/siteledger-ai" target="_blank" rel="noreferrer">GitHub</a> · <a className="underline" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer">Telegram @SiteLedgerNGbot</a></p>
      </div>
    </footer>
  </div>;
}

export function PageIntro({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return <header className="flex flex-col gap-2 pb-4 pt-4">
    <p className="font-stamp-label text-stamp-label uppercase text-primary">{label}</p>
    <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-on-surface">{title}</h1>
    <div className="mt-1 max-w-2xl font-body-md text-body-md leading-relaxed text-on-surface-variant">{children}</div>
  </header>;
}

export function InformationPage({ current, label, title, intro, children }: { current: string; label: string; title: string; intro: ReactNode; children: ReactNode }) {
  return <PublicSite current={current}><div className="public-column flex flex-col pb-10"><PageIntro label={label} title={title}>{intro}</PageIntro><div className="flex flex-col gap-4">{children}</div></div></PublicSite>;
}
