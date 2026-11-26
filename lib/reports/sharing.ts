import "server-only";
import { UUID } from "../confirm/access";
import { reportFromInput, type ReportInput } from "./model";
import { intakeRpc } from "../telegram/storage";

export async function readSharedReport(id: string) {
  if (!UUID.test(id)) return null;
  const input = await intakeRpc<ReportInput | null>("shared_locked_report", { p_share: id });
  return input?.report?.status === "locked" ? reportFromInput(input) : null;
}
