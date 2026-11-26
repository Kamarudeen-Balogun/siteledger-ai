import { createHash } from "node:crypto";

export const MAX_VOICE_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 1024 * 1024;

export type IntakePayload = {
  user_id: number;
  chat_id: number;
  display_name: string;
  sent_at: number;
  kind: "start" | "help" | "today" | "account" | "projects" | "reports" | "logout" | "note" | "voice" | "photo" | "unsupported" | "too_large";
  project_code?: string;
  link_hash?: string;
  link_help?: true;
  text?: string;
  file_id?: string;
  content_type?: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>) : null;
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function text(value: unknown, limit: number): string | undefined {
  return typeof value === "string" && value.length <= limit ? value : undefined;
}

// Accept original private messages only; edits never rewrite the source record.
export function parseTelegramUpdate(value: unknown): { updateId: number; payload: IntakePayload; callbackId?: string } | null {
  const update = record(value);
  const callback = record(update?.callback_query);
  const callbackData = text(callback?.data,64);
  const callbackId = text(callback?.id,128);
  const project = callbackId && callbackData ? /^slp:([A-Z0-9-]{1,60})$/.exec(callbackData)?.[1] : undefined;
  const message = record(project ? callback?.message : update?.message);
  const from = record(project ? callback?.from : message?.from);
  const chat = record(message?.chat);
  if (!update || !integer(update.update_id) || !message || !from || !chat
    || !integer(from.id) || !integer(chat.id) || chat.type !== "private"
    || from.id !== chat.id || from.is_bot === true || !integer(message.date)
    || message.date > 253402214400) return null;

  const displayName = [text(from.first_name, 128), text(from.last_name, 128)].filter(Boolean).join(" ")
    || text(from.username, 128) || "Site foreman";
  const payload: IntakePayload = {
    user_id: from.id, chat_id: chat.id, display_name: displayName,
    sent_at: message.date, kind: "unsupported",
  };
  if(project)return {updateId:update.update_id,callbackId,payload:{...payload,kind:"start",project_code:project}};
  const note = text(message.text, 4096);
  if (note !== undefined) {
    const command = /^\/(start|help|today|account|projects|reports|logout|signin|signup|reset|link|project)(?:@SiteLedgerNGbot)?(?:\s|$)/i.exec(note);
    const name = command?.[1].toLowerCase();
    const argument = command ? note.slice(command[0].length).trim() : note.trim();
    const secret = name === "start" ? /^link_([A-Za-z0-9_-]{24}|[A-Za-z0-9_-]{43})$/.exec(argument)?.[1] :
      name === "link" || !command ? /^TG-([A-Za-z0-9_-]{24})$/.exec(argument)?.[1] : undefined;
    if (secret) {
      payload.kind = "start";
      payload.link_hash = createHash("sha256").update(secret).digest("hex");
      return { updateId: update.update_id, payload };
    }
    if (command) {
      if ((name === "start" || name === "project") && /^[A-Z0-9-]{1,64}$/i.test(argument)) {
        payload.kind = "start";
        payload.project_code = argument.toUpperCase();
      } else if (name === "project") payload.kind = "projects";
      else if (name === "link") { payload.kind = "account"; payload.link_help = true; }
      else if (name === "signin" || name === "signup" || name === "reset") payload.kind = "account";
      else payload.kind = name as IntakePayload["kind"];
    } else if (note.startsWith("/") || /^TG-[A-Za-z0-9_-]{20,}$/.test(argument)) { payload.kind="help"; }
    else { payload.kind = "note"; payload.text = note; }
    return { updateId: update.update_id, payload };
  }
  const caption = text(message.caption, 1024);
  if (caption) payload.text = caption;
  const voice = record(message.voice);
  if (voice && text(voice.file_id, 512)) {
    const mime = text(voice.mime_type, 100) ?? "audio/ogg";
    if (!["audio/ogg", "audio/mpeg", "audio/mp4"].includes(mime)) return { updateId: update.update_id, payload };
    payload.kind = integer(voice.file_size) && voice.file_size > MAX_VOICE_BYTES ? "too_large" : "voice";
    payload.file_id = voice.file_id as string;
    payload.content_type = mime;
  } else if (Array.isArray(message.photo)) {
    const variants = message.photo.map(record).filter((photo) => photo && text(photo.file_id, 512)
      && integer(photo.width) && integer(photo.height));
    // Telegram supplies compressed renditions. Pick the largest under 1 MB;
    // unknown sizes use the smallest rendition, then enforce the download limit.
    const eligible = variants.filter((photo) => integer(photo!.file_size) && photo!.file_size <= MAX_PHOTO_BYTES);
    eligible.sort((a, b) => Number(b!.width) * Number(b!.height) - Number(a!.width) * Number(a!.height));
    const unknown = variants.filter((photo) => photo!.file_size === undefined)
      .sort((a, b) => Number(a!.width) * Number(a!.height) - Number(b!.width) * Number(b!.height));
    const photo = eligible[0] ?? unknown[0];
    payload.kind = photo ? "photo" : "too_large";
    if (photo) { payload.file_id = photo.file_id as string; payload.content_type = "image/jpeg"; }
  }
  return { updateId: update.update_id, payload };
}
