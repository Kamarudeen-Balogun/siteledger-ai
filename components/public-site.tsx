import Link from "next/link";
import type { ReactNode } from "react";
const links = [["/about", "About"], ["/help", "Help & FAQ"], ["/contact", "Contact"]] as const;
export function PublicSite({ children, current }: { children: ReactNode; current: string }) {
  return <div className="public-site"><a href="#content" className="skip-link">Skip to content</a>
    <header className="public-header content-width"><Link href="/" className="site-brand" aria-label="SiteLedger AI home"><span aria-hidden="true" className="brand-mark">SL</span><span>SiteLedger <span className="text-accent">AI</span></span></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">{links.map(([href,label])=><Link key={href} href={href} aria-current={current===href?"page":undefined} className="nav-link">{label}</Link>)}</nav>
      <div className="flex items-center gap-3"><Link href="/account" className="public-button border border-ink">Get started</Link><details className="public-menu lg:hidden"><summary className="public-button cursor-pointer border border-rule">Menu</summary><nav aria-label="Mobile navigation">{links.map(([href,label])=><Link key={href} href={href} aria-current={current===href?"page":undefined}>{label}</Link>)}<Link href="/reports/demo">Sample report</Link><Link href="/account">Sign in</Link></nav></details></div>
    </header><main id="content" tabIndex={-1}>{children}</main>
    <footer className="public-footer content-width"><div><Link href="/" className="font-serif text-2xl">SiteLedger AI</Link><p className="mt-3 max-w-sm leading-7">The day’s work, confirmed and costed.<br />A record you can return to.</p></div><nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8">{[...links,["/privacy","Privacy"],["/terms","Terms"],["/reports/demo","Sample report"]].map(([href,label])=><Link key={href} className="nav-link" href={href}>{label}</Link>)}</nav></footer>
  </div>;
}
export function PageIntro({label,title,children}:{label:string;title:string;children:ReactNode}) {return <header className="public-intro"><p className="eyebrow">{label}</p><h1>{title}</h1><div className="mt-6 max-w-2xl text-lg leading-8">{children}</div></header>;}
export function InformationPage({current,label,title,intro,children}:{current:string;label:string;title:string;intro:ReactNode;children:ReactNode}) {return <PublicSite current={current}><div className="content-width"><PageIntro label={label} title={title}>{intro}</PageIntro><div className="information-body">{children}</div></div></PublicSite>;}
