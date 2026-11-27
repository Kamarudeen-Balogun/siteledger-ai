import "server-only";
import { currentSessionHash } from "../auth/session";
import { intakeRpc } from "../telegram/storage";
import { projectDashboard, type DashboardInput } from "./dashboard";
import type { BoqRow } from "./boq-types";
export type BoqChange = { id: string; timestamp: string; action: string; actor: string; currency: string; before: BoqRow | null; after: BoqRow };
export async function privateBoqHistory(id: string): Promise<BoqChange[] | null> {
  return intakeRpc("account_boq_history", { p_hash: await currentSessionHash(), p_project: id });
}
export type BoqVersion = { version: number; effective_date: string; items: number; rows: { description: string; unit: string; boq_quantity: string | number; rate: string | number; item_code?: string; section?: string }[] };
// Version rows are the raw BoQ row (to_jsonb), so rate and boq_quantity
// arrive as JSON numbers, not strings — every consumer must coerce before
// calling string methods on them.
export async function privateBoqVersions(id:string) {
  return intakeRpc<BoqVersion[]|null>("account_boq_versions",{p_hash:await currentSessionHash(),p_project:id});
}
export async function privateDashboard(id: string) {
  const input = await intakeRpc<DashboardInput | null>("account_dashboard_input", { p_hash: await currentSessionHash(), p_project: id });
  return input ? projectDashboard(input) : null;
}
