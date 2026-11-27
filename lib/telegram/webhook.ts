import "server-only";
import { appOrigin } from "../app-url";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { downloadTelegramFile, telegramCall } from "./api";
import { intakeRpc, uploadEvidence, type IntakeReceipt } from "./storage";
import { MAX_PHOTO_BYTES, MAX_VOICE_BYTES, parseTelegramUpdate, type IntakePayload } from "./update";
import { reportFromInput, displayRatio, type ReportInput } from "../reports/model";
import { formatMoney } from "../costing/format-money";
import { decimal } from "../costing/decimal";
import { handleChatReview, parseChatReview, sendTelegramProjectList, sendTelegramReports, telegramReviewButton } from "./chat-review";

export type IntakeDependencies = {
  prepare: (id: number, payload: IntakePayload, owner: string) => Promise<IntakeReceipt | { busy: true }>;
  download: (fileId: string, limit: number) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  finishMedia: (id: number, owner: string) => Promise<void>;
  sendReply: (chatId: number, text: string, reviewLink?: string) => Promise<void>;
  finishReply: (id: number, owner: string, sent: boolean) => Promise<void>;
  reviewSubmission?: (payload: IntakePayload) => Promise<string | null>;
  todaySummary?: (payload: IntakePayload) => Promise<{ text: string; path: string } | null>;
  resumePending?: (payload: IntakePayload, owner: string) => Promise<IntakeReceipt | null>;
};

export const intakeDependencies: IntakeDependencies = {
  prepare: (id, payload, owner) => intakeRpc("account_prepare_telegram", { p_update_id: id, p_payload: payload, p_owner: owner }),
  download: downloadTelegramFile,
  upload: uploadEvidence,
  finishMedia: (id, owner) => intakeRpc("account_finish_telegram_media", { p_update_id: id, p_owner: owner }),
  sendReply: async (chatId, text, reviewLink) => {
    const id=reviewLink&&/\/(confirm|reports)\/([a-f0-9-]{36})$/.exec(reviewLink);
    const chatButton=id?await telegramReviewButton(chatId,id[2]).catch(()=>null):null;
    await telegramCall("sendMessage", { chat_id: chatId, text,
      ...(reviewLink ? { reply_markup: { inline_keyboard: [...(chatButton?[ [{...chatButton,text:id?.[1]==="reports"?"View in Telegram":chatButton.text}] ]:[]),[{ text:id?.[1]==="confirm"?"Open full review":id?"Open full report":"Open SiteLedger", web_app: { url: reviewLink } }]] } } : {}) });
  },
  finishReply: (id, owner, sent) => intakeRpc("finish_telegram_reply", { p_update_id: id, p_owner: owner, p_sent: sent }),
  reviewSubmission: payload => intakeRpc("account_bot_latest", { p_telegram: payload.user_id }),
  resumePending: (payload,owner) => intakeRpc("account_resume_telegram", {p_telegram:payload.user_id,p_owner:owner}),
  todaySummary: async payload => {
    const data = await intakeRpc<{project_name: string; currency: string; note_id: string | null; input: ReportInput | null} | null>("account_bot_today", {p_telegram: payload.user_id});
    if (!data) return null;
    if (!data.note_id || !data.input) return {text: `${data.project_name}: No site note today. Send a voice note to begin.`, path: "/today"};
    const report = reportFromInput(data.input);
    if (!report || report.stale) return {text: `${data.project_name}: Today's latest note is saved. Review and confirm the quantities before relying on its cost.`, path: `/confirm/${data.note_id}`};
    const doc = report.document;
    const top = doc.costing.items.reduce<typeof doc.costing.items[number] | null>((best,item) => !best || decimal(item.cost_today, "cost").gt(decimal(best.cost_today, "cost")) ? item : best, null);
    const title = top ? doc.source.price_list.find(item=>item.id===top.boq_item_id)?.description : undefined;
    return {text: `${data.project_name} — today's latest ${report.status === "locked" ? "locked report" : "draft"}\nValue of work: ${formatMoney(doc.costing.total_cost, doc.currency)} ${doc.currency}${top ? `\nTop item: ${(title ?? "Confirmed work").slice(0,180)}\nBoQ progress for this item: ${displayRatio(top.percentage_complete)}%` : ""}`, path: `/reports/${data.note_id}`};
  },
};

export function validWebhookSecret(supplied: string | null, expected: string): boolean {
  if (!supplied || !expected) return false;
  // Hash both values to fixed lengths before the constant-time comparison.
  return timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(expected).digest());
}

export async function handleTelegramWebhook(request: Request, dependencies: IntakeDependencies, secret: string | undefined,
  onSubmissionSaved?: (id: string) => void) {
  if (!secret) return Response.json({ error: "Intake is not configured." }, { status: 503 });
  if (!validWebhookSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), secret))
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  // Only small Telegram JSON updates belong on this route; media is fetched from Telegram.
  if (Number(request.headers.get("content-length") ?? 0) > 64 * 1024)
    return Response.json({ error: "Update too large." }, { status: 413 });
  let raw: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Invalid update." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 64 * 1024) return Response.json({ error: "Update too large." }, { status: 413 });
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    raw = Buffer.concat(chunks).toString("utf8");
  } catch { return Response.json({ error: "Invalid update." }, { status: 400 }); }
  let parsed;
  try {
    const input:unknown=JSON.parse(raw),chat=parseChatReview(input);
    if(chat&&dependencies===intakeDependencies){await handleChatReview(chat);return Response.json({ok:true});}
    parsed = parseTelegramUpdate(input);
    if(parsed?.callbackId&&dependencies===intakeDependencies) await telegramCall("answerCallbackQuery",{callback_query_id:parsed.callbackId}).catch(()=>undefined);
  }
  catch { return Response.json({ error: "Invalid update." }, { status: 400 }); }
  if (!parsed) return Response.json({ ok: true });
  const owner = randomUUID();
  try {
    const receipt = await dependencies.prepare(parsed.updateId, parsed.payload, owner);
    if ("busy" in receipt) return Response.json({ error: "Intake is busy. Please retry." }, { status: 503 });
    if (receipt.reply_sent_at) {
      if (receipt.submission_id) onSubmissionSaved?.(receipt.submission_id);
      return Response.json({ ok: true });
    }
    let resumed = false;
    if (["start","today","projects","reports"].includes(receipt.payload.kind) && receipt.status !== "blocked") {
      const pending = await dependencies.resumePending?.(receipt.payload, owner);
      if (pending?.storage_path && pending.payload.file_id && pending.payload.content_type) {
        try {
          const bytes = await dependencies.download(pending.payload.file_id, pending.payload.kind === "voice" ? MAX_VOICE_BYTES : MAX_PHOTO_BYTES);
          await dependencies.upload(pending.storage_path, bytes, pending.payload.content_type);
          await dependencies.finishMedia(pending.update_id, owner);
          await dependencies.finishReply(pending.update_id, owner, true);
          if (pending.submission_id) onSubmissionSaved?.(pending.submission_id);
          resumed = true;
        } catch {
          await dependencies.finishReply(pending.update_id, owner, false).catch(()=>undefined);
          throw new Error("Saved media retry interrupted");
        }
      }
    }
    if (receipt.status === "pending") {
      if (!receipt.storage_path || !receipt.payload.file_id || !receipt.payload.content_type) throw new Error("Media missing.");
      const bytes = await dependencies.download(receipt.payload.file_id,
        receipt.payload.kind === "voice" ? MAX_VOICE_BYTES : MAX_PHOTO_BYTES);
      await dependencies.upload(receipt.storage_path, bytes, receipt.payload.content_type);
      await dependencies.finishMedia(parsed.updateId, owner);
    }
    const summary = receipt.payload.kind === "today" && receipt.reply_path !== "/account" && receipt.status !== "blocked" ? await dependencies.todaySummary?.(receipt.payload) : null;
    const reviewId = receipt.submission_id ?? (receipt.payload.kind === "today" && !receipt.reply_path ? await dependencies.reviewSubmission?.(receipt.payload) : null);
    let link:string|undefined;
    const landingStart=receipt.payload.kind==="start"&&!receipt.payload.link_hash&&!receipt.payload.project_code&&receipt.reply_path!=="/today";
    try {const origin=new URL(appOrigin());const path=landingStart?"/":summary?.path??receipt.reply_path??(reviewId?`/confirm/${reviewId}`:"/account");
      if(origin.protocol==="https:" && path.startsWith("/") && !path.startsWith("//"))link=new URL(path,origin.origin).toString();}catch{ /* Saved receipt can be retried when the origin is configured. */ }
    const inChat=dependencies===intakeDependencies&&receipt.status!=="blocked"&&(
      receipt.payload.kind==="projects" ? await sendTelegramProjectList(receipt.payload.chat_id).catch(()=>false) :
      receipt.payload.kind==="reports" ? await sendTelegramReports(receipt.payload.chat_id).catch(()=>false) : false);
    const howToLink = receipt.payload.link_help ? "In SiteLedger, open your project’s Team page and tap Reveal under Connect Telegram. Send /link followed by the code here, then return to that page to confirm." : null;
    const chatOnly = (receipt.payload.project_code && receipt.reply_text.startsWith("Active project:"))
      || (receipt.payload.link_hash && receipt.reply_text.startsWith("Telegram ownership proved."));
    if(!inChat)await dependencies.sendReply(receipt.payload.chat_id,
      (howToLink ?? summary?.text ?? receipt.reply_text) + (resumed ? "\nA saved media file has resumed. Use /today again if more photos are still queued." : ""),
      chatOnly ? undefined : link);
    if (receipt.status !== "blocked") await dependencies.finishReply(parsed.updateId, owner, true);
    if (receipt.submission_id) onSubmissionSaved?.(receipt.submission_id);
    return Response.json({ ok: true });
  } catch {
    await dependencies.finishReply(parsed.updateId, owner, false).catch(() => undefined);
    // A non-2xx response tells Telegram to retry. Never return/log provider errors
    // because Telegram file URLs contain the token and database errors contain details.
    return Response.json({ error: "Could not save the site note yet. Telegram will retry." }, { status: 503 });
  }
}
