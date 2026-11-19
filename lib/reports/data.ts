import "server-only";
import { intakeRpc } from "../telegram/storage";
import { verifyReviewToken } from "../confirm/access";
import { buildDocument, reportFromInput, ReportStateError, type ReportInput } from "./model";

export async function readReportInput(id: string, token: string): Promise<ReportInput | null> {
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  if (!access) return null;
  return intakeRpc("get_site_report_input", { p_id: id, p_telegram_id: access.telegramId });
}
export async function getReport(id: string, token: string) {
  const input = await readReportInput(id, token);
  return input ? reportFromInput(input) : null;
}
export async function getDemoReport() {
  const input = await intakeRpc<ReportInput | null>("get_demo_report_input", {});
  return input ? reportFromInput(input) : null;
}
export async function createReport(id: string, token: string, weather?: string | null) {
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  if (!access) throw new ReportStateError("Open a fresh review button from Telegram.", 401);
  const input = await readReportInput(id, token);
  if (!input) throw new ReportStateError("Site note unavailable.", 404);
  if (input.report?.status === "locked") throw new ReportStateError("This report is locked.");
  const document = buildDocument(input.source, weather === undefined ? input.report?.weather ?? null : weather);
  const reportId = await intakeRpc<string>("save_site_draft", { p_id: id, p_telegram_id: access.telegramId,
    p_source: input.source, p_document: document });
  return { id: reportId, status: "draft" };
}
