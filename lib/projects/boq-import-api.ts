import "server-only";
import { accountForHash, requestSessionHash } from "../auth/session";
import { privateHeaders } from "../auth/api";
import { AccountError } from "../auth/provider";
import { smallJson } from "../auth/request";
import { intakeRpc } from "../telegram/storage";
import { UUID } from "../confirm/access";
import { validBoqEdit } from "./boq-types";
import { MAX_IMPORT_ROWS, MAX_FILE_BYTES } from "./boq-input";
import type { ProjectPermissions } from "./permissions";

export async function boqImportApi(request: Request, commit = false) {
  try {
    if (!process.env.SITELEDGER_APP_URL || request.headers.get("origin") !== new URL(process.env.SITELEDGER_APP_URL).origin) throw new AccountError("Open this action on SiteLedger.", 403);
    const hash = requestSessionHash(request), account = await accountForHash(hash);
    if (!account) throw new AccountError("Sign in to continue.", 401);
    const input = await smallJson(request, commit ? 750000 : 2900000);
    const fields = commit ? ["project_id", "items", "confirmed"] : ["project_id", "name", "data"];
    if (Object.keys(input).length !== fields.length || Object.keys(input).some(key => !fields.includes(key)) || typeof input.project_id !== "string" || !UUID.test(input.project_id)) throw new AccountError("Check the import details.", 422);
    const access = await intakeRpc<{ role?: string; archived_at?: string; permissions?: ProjectPermissions } | null>("account_project_access", { p_hash: hash, p_project: input.project_id });
    if (!access || !(access.permissions?.edit_boq ?? access.role === "pm")) throw new AccountError("Project unavailable.", 404);
    if (access.archived_at) throw new AccountError("This project is archived. Its BoQ is read-only.", 409);
    if (!await intakeRpc("account_limit", { p_key: "boq-import:" + account.profile_id, p_max: 20, p_seconds: 600 })) throw new AccountError("Too many imports. Wait a little and try again.", 429);
    if (!commit) {
      if (typeof input.name !== "string" || input.name.length > 200 || typeof input.data !== "string" || input.data.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data)) throw new AccountError("Choose a CSV or XLSX file up to 2 MB.", 422);
      try { const { parseBoqFile } = await import("./boq-import-parser"); return Response.json({ sheets: await parseBoqFile(input.name, Buffer.from(input.data, "base64")) }, { headers: privateHeaders }); }
      catch (error) { throw new AccountError(error instanceof Error ? error.message : "Could not read this file. Export it as CSV or XLSX.", 422); }
    }
    if (input.confirmed !== true || !Array.isArray(input.items) || !input.items.length || input.items.length > MAX_IMPORT_ROWS || input.items.some(item => !validBoqEdit(item) || item.revision !== null)
      || new Set(input.items.map(item => item.id)).size !== input.items.length || new Set(input.items.map(item => item.item_code.trim())).size !== input.items.length) throw new AccountError("Review 1–200 new items with unique codes and supplied quantities and rates before saving.", 422);
    const result = await intakeRpc<{ error?: string; row?: number; saved?: number; already_saved?: boolean } | null>("account_boq_import", { p_hash: hash, p_project: input.project_id, p_items: input.items });
    if (!result) throw new AccountError("Project unavailable.", 404);
    if (result.error) {
      const errors: Record<string, string> = { archived: "The project was archived. No items were imported.", duplicate_code: "This code is already in use. Change it or edit the existing item.", stale: "An item changed since review. Refresh the BoQ before retrying.", invalid: "Check the supplied row values." };
      throw new AccountError(`${result.row ? `Row ${result.row}: ` : ""}${errors[result.error] ?? "Import unavailable."} All existing records are preserved; no partial import was saved.`, 409);
    }
    return Response.json(result, { headers: privateHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof AccountError ? error.message : "Import could not finish. Keep this preview and retry with the same rows." }, { status: error instanceof AccountError ? error.status : 503, headers: privateHeaders });
  }
}
