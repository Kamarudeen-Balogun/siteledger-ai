import "server-only";
import { currentSessionHash } from "../auth/session";
import { intakeRpc } from "../telegram/storage";
import { projectDashboard, type DashboardInput } from "./dashboard";
export async function privateDashboard(id: string) {
  const input = await intakeRpc<DashboardInput | null>("account_dashboard_input", { p_hash: await currentSessionHash(), p_project: id });
  return input ? projectDashboard(input) : null;
}
