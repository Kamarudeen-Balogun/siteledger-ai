import "server-only";
import { currentSessionHash } from "../auth/session";
import { intakeRpc } from "../telegram/storage";
import { projectDashboard, type DashboardInput } from "./dashboard";
import type { BoqRow } from "./boq-types";
export type BoqChange = { id: string; timestamp: string; action: string; actor: string; currency: string; before: BoqRow | null; after: BoqRow };
export async function privateBoqHistory(id: string): Promise<BoqChange[] | null> {
  return intakeRpc("account_boq_history", { p_hash: await currentSessionHash(), p_project: id });
}
export async function privateBoqVersions(id:string) {
  return intakeRpc<{version:number;effective_date:string}[]|null>("account_boq_versions",{p_hash:await currentSessionHash(),p_project:id});
}
export async function privateDashboard(id: string) {
  const input = await intakeRpc<DashboardInput | null>("account_dashboard_input", { p_hash: await currentSessionHash(), p_project: id });
  return input ? projectDashboard(input) : null;
}
