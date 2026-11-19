import "server-only";
import { createHash } from "node:crypto";
import { createReviewToken, verifyReviewToken } from "../confirm/access";
import { intakeRpc } from "../telegram/storage";
import { getReport, readReportInput } from "../reports/data";
import { reportFromInput, ReportStateError, type ReportView } from "../reports/model";

export type Reviewer = { name: string; role: "foreman" | "pm" };
export type LogEntry = { kind: "report" | "amendment"; id: string; report_id: string; submission_id: string;
  date: string; timestamp: string; author: string; total_cost?: string; currency?: string; note?: string; href?: string };
export type DisputeLog = { project: { id: string; name: string }; is_demo: boolean; entries: LogEntry[] };
export const reportVersion = (report: ReportView) => createHash("sha256").update(JSON.stringify(report.document)).digest("hex");
export async function getReviewer(id: string, token: string): Promise<Reviewer | null> {
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  return access ? intakeRpc("get_site_report_reviewer", { p_id: id, p_telegram_id: access.telegramId }) : null;
}
const errors: Record<string, [string, number]> = {
  forbidden: ["Only the project manager can approve this report.", 403], unavailable: ["Report unavailable.", 404],
  draft_required: ["Create the draft report before approval.", 409], stale: ["This draft changed. Reopen and rebuild it before approving.", 409],
  confirmation_required: ["Confirm the site note before approval.", 409], pending: ["Wait for your audio and photos to finish saving.", 409],
  empty: ["Record confirmed work before approving.", 409], locked_required: ["Amendments belong to locked reports.", 409],
  invalid_note: ["Enter a correction of up to 5,000 characters.", 422], request_conflict: ["This amendment was already saved with different text. Reopen the report.", 409],
};
function checked(result: Record<string, unknown>) {
  if (result.error) {
    const [message, status] = errors[String(result.error)] ?? ["Could not save this record. Try again.", 503];
    throw new ReportStateError(message, status);
  }
  return result;
}
export async function approveReport(id: string, token: string, version: string) {
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  if (!access) throw new ReportStateError("Open a fresh review button from Telegram.", 401);
  const [input, reviewer] = await Promise.all([readReportInput(id, token), getReviewer(id, token)]);
  if (!input || !reviewer) throw new ReportStateError("Report unavailable.", 404);
  if (reviewer.role !== "pm") throw new ReportStateError(errors.forbidden[0], 403);
  const report = reportFromInput(input);
  if (!report) throw new ReportStateError(errors.draft_required[0]);
  if (report.stale || reportVersion(report) !== version) throw new ReportStateError(errors.stale[0]);
  return checked(await intakeRpc("approve_site_report", { p_id: id, p_telegram_id: access.telegramId, p_document: report.document }));
}
export async function addAmendment(id: string, token: string, note: string, requestId: string) {
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  if (!access) throw new ReportStateError("Open a fresh review button from Telegram.", 401);
  const report = await getReport(id, token);
  if (!report) throw new ReportStateError("Report unavailable.", 404);
  if (report.status !== "locked") throw new ReportStateError(errors.locked_required[0]);
  return checked(await intakeRpc("append_site_amendment", { p_id: id, p_telegram_id: access.telegramId, p_note: note, p_request_id: requestId }));
}
export async function getDisputeLog(id: string, token: string): Promise<DisputeLog | null> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "", access = verifyReviewToken(token, id, secret);
  if (!access) return null;
  const log = await intakeRpc<DisputeLog | null>("get_site_dispute_log", { p_id: id, p_telegram_id: access.telegramId });
  if (!log) return null;
  for (const entry of log.entries) {
    // Links retain the original capability's expiry; reading a log cannot renew it.
    const child = createReviewToken(entry.submission_id, access.telegramId, secret, (access.expires - 7 * 86400) * 1000);
    entry.href = `/reports/${entry.submission_id}?access=${encodeURIComponent(child)}`;
  }
  return log;
}
export async function getDemoDisputeLog(): Promise<DisputeLog | null> {
  const log = await intakeRpc<DisputeLog | null>("get_demo_dispute_log", {});
  if (log) for (const entry of log.entries) if (entry.submission_id === "30000000-0000-4000-8000-000000000004") entry.href = "/reports/demo";
  return log;
}
