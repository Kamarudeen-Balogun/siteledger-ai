import Link from "next/link";
import { WorkspaceBack, WorkspaceNavigation, WorkspaceProfile, WorkspaceProjectPicker } from "./app-navigation";
import { ThemeSwitch } from "./diary-theme";
import { SiteLedgerMark } from "./siteledger-mark";

export type WorkspaceArea = "today" | "account" | "projects" | "reports" | "boq";
const labels: Record<WorkspaceArea, string> = { today: "Today", account: "Account", projects: "Projects & team", reports: "Reports & log", boq: "BoQ & rates" };

export function WorkspaceHeader({ current, title, project, projectId, publicView = false, detail = false, hideProfile = false, onBack }: {
  current: WorkspaceArea; title?: string; project?: string; projectId?: string; publicView?: boolean; detail?: boolean; hideProfile?: boolean; onBack?: () => void;
}) {
  const isDetail = detail || current === "account" || publicView;
  return <header className="workspace-header stitch-header print:hidden" data-detail={isDetail || undefined}>
    <div className="stitch-header-row">
      <div className="diary-header-title">
        {isDetail ? <WorkspaceBack onBack={onBack}/> : <SiteLedgerMark/>}
        <div><span className="diary-header-name">{isDetail ? title ?? "My Profile" : "SiteLedger AI"}</span>
          {(!isDetail || project) && <span className="diary-header-project">{isDetail ? project : title ?? labels[current]}</span>}
        </div>
      </div>
      <Link href="/" className="site-brand diary-desktop-brand" aria-label="SiteLedger AI home"><SiteLedgerMark/>SiteLedger AI</Link>
      <div className="diary-header-actions"><ThemeSwitch/>{!hideProfile && <WorkspaceProfile/>}</div>
    </div>
    {!isDetail && <WorkspaceProjectPicker current={current} project={project} projectId={projectId}/>}
    {!publicView && <WorkspaceNavigation current={current}/>}
  </header>;
}
