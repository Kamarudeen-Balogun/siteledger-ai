import "server-only";
import { createHash } from "node:crypto";
import { UUID } from "../confirm/access";
import { currentSessionHash } from "../auth/session";
import { recordActor } from "../auth/record";
import { intakeRpc } from "../telegram/storage";
import { getReport, readReportInput } from "../reports/data";
import { reportFromInput, ReportStateError, type ReportView } from "../reports/model";

export type Reviewer = { name: string; role: "foreman" | "pm"; archived?: boolean; canApprove: boolean; canReview: boolean };
export type LogEntry = { kind: "report" | "amendment"; id: string; report_id: string; submission_id: string;
  date: string; timestamp: string; author: string; total_cost?: string; currency?: string; timezone?: string; note?: string; href?: string };
export type DisputeLog = { project: { id: string; name: string }; is_demo: boolean; entries: LogEntry[] };
export const reportVersion = (report: ReportView) => createHash("sha256").update(JSON.stringify(report.document)).digest("hex");
export async function getReviewer(id: string, hash?: string): Promise<Reviewer | null> {
  const actor=await recordActor(id,hash);
  return actor?{name:actor.professional_name,role:actor.role,archived:Boolean(actor.archived_at),canApprove:actor.permissions?actor.permissions.approve_lock&&actor.permissions.view_reports:actor.role==="pm",canReview:actor.can_review??true}:null;
}
const errors: Record<string, [string, number]> = {
  forbidden: ["Only the project manager can approve this report.", 403], unavailable: ["Report unavailable.", 404],
  draft_required: ["Create the draft report before approval.", 409], stale: ["This draft changed. Reopen and rebuild it before approving.", 409],
  confirmation_required: ["Confirm the site note before approval.", 409], pending: ["Wait for your audio and photos to finish saving.", 409],
  empty: ["Record confirmed work before approving.", 409], locked_required: ["Amendments belong to locked reports.", 409],
  invalid_note: ["Enter a correction of up to 5,000 characters.", 422], request_conflict: ["This amendment was already saved with different text. Reopen the report.", 409],
  archived: ["This project is archived. Its original records are preserved.",409],
};
function checked(result: Record<string, unknown>) {
  if (result.error) {
    const [message, status] = errors[String(result.error)] ?? ["Could not save this record. Try again.", 503];
    throw new ReportStateError(message, status);
  }
  return result;
}
export async function approveReport(id: string, hash: string, version: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new ReportStateError("Sign in to approve this report.", 401);
  const [input, reviewer] = await Promise.all([readReportInput(id, hash), getReviewer(id, hash)]);
  if (!input || !reviewer) throw new ReportStateError("Report unavailable.", 404);
  if (!reviewer.canApprove) throw new ReportStateError(errors.forbidden[0], 403);
  if (reviewer.archived) throw new ReportStateError(errors.archived[0]);
  const report = reportFromInput(input);
  if (!report) throw new ReportStateError(errors.draft_required[0]);
  if (report.stale || reportVersion(report) !== version) throw new ReportStateError(errors.stale[0]);
  return checked(await intakeRpc("account_approve", { p_id: id, p_hash: hash, p_document: report.document }));
}
export async function addAmendment(id: string, hash: string, note: string, requestId: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new ReportStateError("Sign in to amend this report.", 401);
  const actor=await recordActor(id,hash,true);
  if (actor?.error) throw new ReportStateError(errors.archived[0]);
  const report = await getReport(id, hash);
  if (!report) throw new ReportStateError("Report unavailable.", 404);
  if (report.status !== "locked") throw new ReportStateError(errors.locked_required[0]);
  return checked(await intakeRpc("account_amend", { p_id: id, p_hash: hash, p_note: note, p_request_id: requestId }));
}
export async function getDisputeLog(id: string, hash?: string): Promise<DisputeLog | null> {
  const access=hash??await currentSessionHash();
  if (!UUID.test(id) || !/^[a-f0-9]{64}$/.test(access)) return null;
  const log = await intakeRpc<DisputeLog | null>("account_dispute_log", { p_id: id, p_hash: access });
  if (!log) return null;
  for (const entry of log.entries) {
    entry.href = `/reports/${entry.submission_id}`;
  }
  return log;
}
export async function getDemoDisputeLog(): Promise<DisputeLog | null> {
  const log = await intakeRpc<DisputeLog | null>("get_demo_dispute_log", {});
  if (log) for (const entry of log.entries) if (entry.submission_id === "30000000-0000-4000-8000-000000000004") entry.href = "/reports/demo";
  return log;
}
