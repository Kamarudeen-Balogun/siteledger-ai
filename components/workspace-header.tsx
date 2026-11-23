import Link from "next/link";
import { WorkspaceNavigation } from "./app-navigation";
export function WorkspaceHeader({current,title}:{current:"today"|"account"|"projects"|"reports";title?:string}) {return <header className="workspace-header print:hidden"><Link href="/" className="site-brand" aria-label="SiteLedger AI home"><span aria-hidden="true" className="brand-mark">SL</span><span>SiteLedger AI</span></Link><WorkspaceNavigation current={current}/>{title&&<h1 className="w-full font-serif text-3xl sm:text-4xl">{title}</h1>}</header>;}
