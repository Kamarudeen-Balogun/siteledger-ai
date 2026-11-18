import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { downloadTelegramFile, telegramCall } from "./api";
import { intakeRpc, uploadEvidence, type IntakeReceipt } from "./storage";
import { MAX_PHOTO_BYTES, MAX_VOICE_BYTES, parseTelegramUpdate, type IntakePayload } from "./update";

export type IntakeDependencies = {
  prepare: (id: number, payload: IntakePayload, owner: string) => Promise<IntakeReceipt | { busy: true }>;
  download: (fileId: string, limit: number) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  finishMedia: (id: number, owner: string) => Promise<void>;
  sendReply: (chatId: number, text: string) => Promise<void>;
  finishReply: (id: number, owner: string, sent: boolean) => Promise<void>;
};

export const intakeDependencies: IntakeDependencies = {
  prepare: (id, payload, owner) => intakeRpc("prepare_telegram_intake", { p_update_id: id, p_payload: payload, p_owner: owner }),
  download: downloadTelegramFile,
  upload: uploadEvidence,
  finishMedia: (id, owner) => intakeRpc("finish_telegram_media", { p_update_id: id, p_owner: owner }),
  sendReply: async (chatId, text) => { await telegramCall("sendMessage", { chat_id: chatId, text }); },
  finishReply: (id, owner, sent) => intakeRpc("finish_telegram_reply", { p_update_id: id, p_owner: owner, p_sent: sent }),
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
  try { parsed = parseTelegramUpdate(JSON.parse(raw)); }
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
    if (receipt.status === "pending") {
      if (!receipt.storage_path || !receipt.payload.file_id || !receipt.payload.content_type) throw new Error("Media missing.");
      const bytes = await dependencies.download(receipt.payload.file_id,
        receipt.payload.kind === "voice" ? MAX_VOICE_BYTES : MAX_PHOTO_BYTES);
      await dependencies.upload(receipt.storage_path, bytes, receipt.payload.content_type);
      await dependencies.finishMedia(parsed.updateId, owner);
    }
    await dependencies.sendReply(receipt.payload.chat_id, receipt.reply_text);
    await dependencies.finishReply(parsed.updateId, owner, true);
    if (receipt.submission_id) onSubmissionSaved?.(receipt.submission_id);
    return Response.json({ ok: true });
  } catch {
    await dependencies.finishReply(parsed.updateId, owner, false).catch(() => undefined);
    // A non-2xx response tells Telegram to retry. Never return/log provider errors
    // because Telegram file URLs contain the token and database errors contain details.
    return Response.json({ error: "Could not save the site note yet. Telegram will retry." }, { status: 503 });
  }
}
