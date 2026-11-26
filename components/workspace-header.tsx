import Link from "next/link";
import Image from "next/image";
import { WorkspaceNavigation, WorkspaceProfile } from "./app-navigation";
import { ThemeSwitch } from "./diary-theme";

export type WorkspaceArea = "today" | "account" | "projects" | "reports" | "boq";
const labels: Record<WorkspaceArea, string> = { today: "Today", account: "Account", projects: "Projects & team", reports: "Reports & log", boq: "BoQ & rates" };

export function WorkspaceHeader({ current, title, project, publicView = false }: {
  current: WorkspaceArea; title?: string; project?: string; publicView?: boolean;
}) {
  return <header className="workspace-header print:hidden">
    <div className="diary-header-title">
      <Image src="/stitch-siteledger-mark.png" alt="" width={32} height={32} className="diary-header-logo"/>
      <div><span className="diary-header-name">{current==="today"&&!title?"SiteLedger AI":title ?? labels[current]}</span><span className="diary-header-project">{project ?? (current==="today"?"Today":"SiteLedger AI")}</span></div>
    </div>
    <Link href="/" className="site-brand diary-desktop-brand" aria-label="SiteLedger AI home"><span aria-hidden="true" className="brand-mark">SL</span>SiteLedger AI</Link>
    <div className="diary-header-actions"><ThemeSwitch/><WorkspaceProfile/></div>
    {!publicView && <WorkspaceNavigation current={current}/>}
  </header>;
}
