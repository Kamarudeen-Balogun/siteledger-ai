import "server-only";
import { accountForHash, requestSessionHash } from "../auth/session";
import { privateHeaders } from "../auth/api";
import { AccountError } from "../auth/provider";
import { smallJson } from "../auth/request";
import { intakeRpc } from "../telegram/storage";
import { UUID } from "../confirm/access";
import { validBoqEdit } from "./boq-types";
export async function boqApi(request: Request) {
  try {
    if (!process.env.SITELEDGER_APP_URL || request.headers.get("origin") !== new URL(process.env.SITELEDGER_APP_URL).origin) throw new AccountError("Open this action on SiteLedger.", 403);
    const input = await smallJson(request);
    if (Object.keys(input).length !== 2 || typeof input.project_id !== "string" || !UUID.test(input.project_id) || !validBoqEdit(input.item)) throw new AccountError("Check the BoQ fields. Use a positive quantity and a supplied decimal rate.", 422);
    const hash = requestSessionHash(request), actor = await accountForHash(hash);
    if (!actor) throw new AccountError("Sign in to continue.", 401);
    if (!await intakeRpc("account_limit", { p_key: "boq-edit:" + actor.profile_id, p_max: 100, p_seconds: 600 })) throw new AccountError("Too many changes. Wait a little and try again.", 429);
    const result = await intakeRpc<{ error?: string; id: string } | null>("account_boq_save", { p_hash: hash, p_project: input.project_id, p_item: input.item });
    if (!result) throw new AccountError("Project unavailable.", 404);
    if (result.error) {
      const errors: Record<string, [string, number]> = {
        archived: ["This project is archived. Its BoQ is read-only until the owner restores it.", 409],
        stale: ["This item changed in another session. Reload its current values before saving.", 409],
        unit_in_use: ["This unit is already used in confirmed work. Add a separate BoQ item for a different unit.", 409],
        duplicate_code: ["That item code is already used in this project.", 409],
        invalid: ["Check the BoQ description, unit, quantity and supplied rate.", 422],
      };
      const [message, status] = errors[result.error] ?? ["Project unavailable.", 404]; throw new AccountError(message, status);
    }
    return Response.json(result, { headers: privateHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof AccountError ? error.message : "The BoQ change could not finish. Retry with the same item; existing records are preserved." }, { status: error instanceof AccountError ? error.status : 503, headers: privateHeaders });
  }
}
