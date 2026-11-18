import { verifyTelegramAccess } from "@/lib/confirm/telegram-access";
import { createReviewToken } from "@/lib/confirm/access";
import { intakeRpc } from "@/lib/telegram/storage";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request) {
  if (request.headers.get("origin") !== process.env.SITELEDGER_APP_URL)
    return Response.json({ error: "Open SiteLedger from the Telegram bot menu." }, { status: 403, headers });
  try {
    const text = await request.text();
    if (text.length > 12000) return Response.json({ error: "Telegram access is invalid." }, { status: 413, headers });
    const input = JSON.parse(text);
    if (!input || Object.keys(input).length !== 1 || typeof input.init_data !== "string")
      return Response.json({ error: "Telegram access is invalid." }, { status: 401, headers });
    const telegramId = verifyTelegramAccess(input.init_data, process.env.TELEGRAM_BOT_TOKEN ?? "");
    if (!telegramId) return Response.json({ error: "Close this window and reopen SiteLedger from the bot menu." }, { status: 401, headers });
    const id = await intakeRpc<string | null>("latest_confirmation_submission", { p_telegram_id: telegramId });
    if (!id) return Response.json({ error: "No site note today. Send a voice note and photos in the bot chat, then open SiteLedger again." }, { status: 404, headers });
    const token = createReviewToken(id, telegramId, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
    return Response.json({ url: `/confirm/${id}?access=${encodeURIComponent(token)}` }, { headers });
  } catch { return Response.json({ error: "Could not open your site note. Try again; your voice note is saved." }, { status: 503, headers }); }
}
