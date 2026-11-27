import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ThemeSwitch } from "./diary-theme";
import { WorkspaceProfile } from "./app-navigation";
import { LandingAccountLink } from "./landing-account-link";
const links = [["/#about", "About"], ["/help", "Help & FAQ"], ["/contact", "Contact"]] as const;
export function PublicSite({ children, current }: { children: ReactNode; current: string }) {
  return <div className="public-site"><a href="#content" className="skip-link">Skip to content</a>
    <header className={`public-header content-width${current==="/"?" homepage-header":""}`}><Link href="/" className="site-brand" aria-label="SiteLedger AI home"><Image src="/stitch-siteledger-mark.png" alt="" width={32} height={32}/><span>SiteLedger AI</span></Link>
      {current==="/"?<nav aria-label="Main navigation" className="homepage-nav"><a href="#how-it-works" className="nav-link">How it works</a><LandingAccountLink className="public-button homepage-signin" anonymousLabel="Sign in" activeHref="/today" activeLabel="Open diary"/><WorkspaceProfile onlyWhenActive/></nav>:<><nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">{links.map(([href,label])=><Link key={href} href={href} aria-current={current===href?"page":undefined} className="nav-link">{label}</Link>)}</nav><div className="diary-header-actions"><ThemeSwitch/><WorkspaceProfile onlyWhenActive/></div></>}
    </header><main id="content" tabIndex={-1}>{children}</main>
    <footer className="public-footer content-width"><div><Link href="/" className="font-serif text-2xl">SiteLedger AI</Link><p className="mt-3 max-w-sm leading-7">The day’s work, confirmed and costed.<br />A record you can return to.</p><p className="mt-4 max-w-sm leading-7">Built by Balogun Kamarudeen Ayomide — Civil Engineer &amp; AI Automation Specialist · <a className="text-link" href="https://codeflowx.dev">codeflowx.dev</a> · <a className="text-link" href="mailto:kamarudeen@codeflowx.dev">kamarudeen@codeflowx.dev</a> · <a className="text-link" href="https://github.com/Kamarudeen-Balogun/siteledger-ai">GitHub</a> · <a className="text-link" href="https://t.me/SiteLedgerNGbot">Telegram @SiteLedgerNGbot</a></p></div><nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8">{[...links,["/reports/demo","Sample report"],["/privacy","Privacy"],["/terms","Terms"]].map(([href,label])=><Link key={href} className="nav-link" href={href}>{label}</Link>)}<LandingAccountLink trial className="nav-link" anonymousLabel="Private trial"/></nav></footer>
  </div>;
}
export function PageIntro({label,title,children}:{label:string;title:string;children:ReactNode}) {return <header className="public-intro"><p className="eyebrow">{label}</p><h1>{title}</h1><div className="mt-6 max-w-2xl text-lg leading-8">{children}</div></header>;}
export function InformationPage({current,label,title,intro,children}:{current:string;label:string;title:string;intro:ReactNode;children:ReactNode}) {return <PublicSite current={current}><div className="content-width"><PageIntro label={label} title={title}>{intro}</PageIntro><div className="information-body">{children}</div></div></PublicSite>;}
