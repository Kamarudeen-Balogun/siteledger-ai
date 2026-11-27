import "server-only";
import { currentSessionHash } from "../auth/session";
import type { Account } from "../auth/types";
import { intakeRpc } from "../telegram/storage";
import type { PrivateProject } from "./types";
import type { ProjectPermissions } from "./permissions";
export type ProjectList = { account: Account; projects: PrivateProject[]; active_project_id: string | null };
export async function privateProjects(): Promise<ProjectList | null> { return intakeRpc("account_list_projects", { p_hash: await currentSessionHash() }); }
export type PendingInvite = { project_id: string; project_name: string; client: string; role_label: string | null; expires_at: string; created_at: string };
export async function pendingInvites(): Promise<PendingInvite[]> {
  const result = await intakeRpc<{ invites: PendingInvite[] } | null>("account_pending_invites", { p_hash: await currentSessionHash() });
  return result?.invites ?? [];
}
export async function privateProjectAccess(id: string) { return intakeRpc<Account & { owner: boolean; role: "foreman"|"pm"; archived_at: string | null; project_id: string; currency: string; timezone: string; permissions: ProjectPermissions } | null>("account_project_access", { p_hash: await currentSessionHash(), p_project: id }); }
export type ProjectTeam = { roles: string[]; members: { profile_id: string; name: string; role: "foreman"|"pm"; role_label: string; permissions: ProjectPermissions; owner: boolean }[];
  invitations: { id: string; email: string; role: string; expires_at: string; expired: boolean; cancelled_at: string|null; consumed_at: string|null }[];
  events: { id: string; actor_profile_id: string|null; action: string; timestamp: string; details: Record<string,unknown> }[] };
export async function privateTeam(id: string): Promise<ProjectTeam | null> { return intakeRpc("account_team", { p_hash: await currentSessionHash(), p_project: id }); }
export type ProjectHistory = {
  access: Account & { role: "foreman" | "pm"; owner: boolean; currency: string; timezone: string; archived_at: string | null; role_label?: string; permissions?: ProjectPermissions };
  project: Pick<PrivateProject, "id" | "name" | "client" | "location" | "contract_sum">;
  submissions: { id: string; date: string; submitted_by: string; status: string; report_id: string | null; report_status: string | null; captured_at?: string; total_cost?: string | null; summary_items?: string[] }[];
  transfers: { id: string; expires_at: string }[];
};
export async function privateHistory(id: string): Promise<ProjectHistory | null> {
  return intakeRpc("account_project_history", { p_hash: await currentSessionHash(), p_project: id });
}
