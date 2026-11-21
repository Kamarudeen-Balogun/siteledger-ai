import "server-only";
import { intakeRpc } from "../telegram/storage";
import { UUID } from "../confirm/access";
import { currentSessionHash } from "../auth/session";
import { recordActor } from "../auth/record";
import { buildDocument, reportFromInput, ReportStateError, type ReportInput } from "./model";

export async function readReportInput(id: string, hash?: string): Promise<ReportInput | null> {
  const access=hash??await currentSessionHash();
  if (!UUID.test(id) || !/^[a-f0-9]{64}$/.test(access)) return null;
  return intakeRpc("account_report_input", { p_id: id, p_hash: access });
}
export async function getReport(id: string, hash?: string) {
  const input = await readReportInput(id, hash);
  return input ? reportFromInput(input) : null;
}
export async function getDemoReport() {
  const input = await intakeRpc<ReportInput | null>("get_demo_report_input", {});
  return input ? reportFromInput(input) : null;
}
export async function createReport(id: string, hash: string, weather?: string | null) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new ReportStateError("Sign in to create your report.", 401);
  const actor=await recordActor(id,hash,true);
  if (!actor) throw new ReportStateError("Site note unavailable.",404);
  if (actor.error) throw new ReportStateError("This project is archived. Its records are preserved.");
  const input = await readReportInput(id, hash);
  if (!input) throw new ReportStateError("Site note unavailable.", 404);
  if (input.report?.status === "locked") throw new ReportStateError("This report is locked.");
  const document = buildDocument(input.source, weather === undefined ? input.report?.weather ?? null : weather);
  const reportId = await intakeRpc<string>("account_save_draft", { p_id: id, p_hash: hash,
    p_source: input.source, p_document: document });
  return { id: reportId, status: "draft" };
}
