import { getReview } from "@/lib/confirm/data";
import { isAllowedAppOrigin } from "@/lib/app-url";
import { requestSessionHash } from "@/lib/auth/session";
import { smallJson } from "@/lib/auth/request";
import { AccountError } from "@/lib/auth/provider";
import { validateConfirmation } from "@/lib/confirm/validation";
import { intakeRpc } from "@/lib/telegram/storage";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isAllowedAppOrigin(request.headers.get("origin")))
    return Response.json({ error: "Open the private review button from Telegram." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 100000)
    return Response.json({ error: "The review is too large." }, { status: 413, headers });
  const access = requestSessionHash(request);
  if (!access) return Response.json({ error: "Review access has expired. Open a fresh button from Telegram." }, { status: 401, headers });
  try {
    const record = await getReview(id, access);
    if (!record) return Response.json({ error: "Site note unavailable." }, { status: 404, headers });
    if (record.archived_at) return Response.json({ error: "This project is archived. Its original records are preserved." }, { status: 409, headers });
    if (record.status === "locked" || record.pending_media || record.pending_photo_analysis || ["queued", "processing"].includes(record.job_status ?? ""))
      return Response.json({ error: record.status === "locked" ? "This report is locked." : "Wait for your audio and photos to finish processing." }, { status: 409, headers });
    if (!record.audio_url && !record.photos.length) return Response.json({ error: "Add a voice note or site photo before confirming this note." }, { status: 422, headers });
    const input: unknown = await smallJson(request,100000);
    if (!validateConfirmation(input, record.boq, record.photos.map(photo => photo.id)))
      return Response.json({ error: "Enter missing quantities, select each BoQ item, and check units before confirming." }, { status: 422, headers });
    const result = await intakeRpc<{error?:string}>("account_confirm", { p_id: id, p_hash: access,
      p_values: input.values, p_boq_ids: input.boq_ids, p_photo_notes: input.photo_notes });
    if(result.error)return Response.json({error:result.error==="media_required"?"Add a voice note or site photo before confirming this note.":result.error==="archived"?"This project is archived. Its original records are preserved.":"Site note access changed. Your edits are kept; check your project access."},{status:result.error==="media_required"?422:result.error==="archived"?409:403,headers});
    await intakeRpc("account_clear_review_draft", { p_hash: access, p_id: id }).catch(() => undefined);
    return Response.json(result, { headers });
  } catch(error) { return Response.json({ error: error instanceof AccountError?error.message:"Could not save your confirmation. Your edits are still here; try again." }, { status: error instanceof AccountError?error.status:503, headers }); }
}
