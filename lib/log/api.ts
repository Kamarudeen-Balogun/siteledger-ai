import "server-only";
import { UUID } from "../confirm/access";
import { ReportStateError } from "../reports/model";
import { addAmendment, approveReport } from "./data";
import { requestSessionHash } from "../auth/session";
import { smallJson } from "../auth/request";
import { AccountError } from "../auth/provider";
import { isAllowedAppOrigin } from "../app-url";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function logAction(request: Request, context: { params: Promise<{ id: string }> }, action: "approve" | "amend") {
  if (!isAllowedAppOrigin(request.headers.get("origin")))
    return Response.json({ error: "Open your private report link." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 32000)
    return Response.json({ error: "The amendment is too long." }, { status: 413, headers });
  try {
    const input:unknown=await smallJson(request,32000);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ReportStateError("Check the submitted record.", 422);
    const keys = Object.keys(input), { id } = await context.params;
    const token = requestSessionHash(request);
    let result;
    if (action === "approve") {
      if (keys.length !== 1 || !("document_version" in input) || typeof input.document_version !== "string" || !/^[a-f0-9]{64}$/.test(input.document_version))
        throw new ReportStateError("Reopen the report before approving.", 422);
      result = await approveReport(id, token, input.document_version);
    } else {
      if (keys.length !== 2 || !("note" in input) || typeof input.note !== "string" || !input.note.trim() || input.note.trim().length > 5000
        || !("request_id" in input) || typeof input.request_id !== "string" || !UUID.test(input.request_id))
        throw new ReportStateError("Enter a correction of up to 5,000 characters.", 422);
      result = await addAmendment(id, token, input.note.trim(), input.request_id);
    }
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ReportStateError || error instanceof AccountError ? error.message : "Could not save. Your original report is preserved; try again." },
      { status: error instanceof ReportStateError || error instanceof AccountError ? error.status : 503, headers });
  }
}
