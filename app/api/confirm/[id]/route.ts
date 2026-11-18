import { getReview } from "@/lib/confirm/data";
import { verifyReviewToken } from "@/lib/confirm/access";
import { validateConfirmation } from "@/lib/confirm/validation";
import { intakeRpc } from "@/lib/telegram/storage";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (request.headers.get("origin") !== process.env.SITELEDGER_APP_URL)
    return Response.json({ error: "Open the private review button from Telegram." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 100000)
    return Response.json({ error: "The review is too large." }, { status: 413, headers });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  if (!access) return Response.json({ error: "Review access has expired. Open a fresh button from Telegram." }, { status: 401, headers });
  try {
    const record = await getReview(id, token);
    if (!record) return Response.json({ error: "Site note unavailable." }, { status: 404, headers });
    if (record.status === "locked" || record.pending_media || ["queued", "processing"].includes(record.job_status ?? ""))
      return Response.json({ error: record.status === "locked" ? "This report is locked." : "Wait for your audio and photos to finish saving." }, { status: 409, headers });
    const text = await request.text();
    if (text.length > 100000) return Response.json({ error: "The review is too large." }, { status: 413, headers });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return Response.json({ error: "Check the review fields." }, { status: 422, headers }); }
    if (!validateConfirmation(input, record.boq, record.photos.map(photo => photo.id)))
      return Response.json({ error: "Enter missing quantities, select each BoQ item, and check units before confirming." }, { status: 422, headers });
    const result = await intakeRpc("confirm_site_submission", { p_id: id, p_telegram_id: access.telegramId,
      p_values: input.values, p_boq_ids: input.boq_ids, p_photo_notes: input.photo_notes });
    return Response.json(result, { headers });
  } catch { return Response.json({ error: "Could not save your confirmation. Your edits are still here; try again." }, { status: 503, headers }); }
}
