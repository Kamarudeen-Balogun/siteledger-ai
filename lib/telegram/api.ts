import "server-only";

export class TelegramUnavailableError extends Error {
  constructor() { super("Telegram is temporarily unavailable."); }
}

export async function telegramCall<T>(method: "getFile" | "sendMessage" | "answerCallbackQuery" | "sendChatAction", body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramUnavailableError();
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new TelegramUnavailableError();
    return result.result as T;
  } catch { throw new TelegramUnavailableError(); }
}

export async function downloadTelegramFile(fileId: string, limit: number): Promise<Uint8Array> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramUnavailableError();
  try {
    const file = await telegramCall<{ file_path: string; file_size?: number }>("getFile", { file_id: fileId });
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(file.file_path)
      || file.file_path.includes("..") || (file.file_size ?? 0) > limit) throw new TelegramUnavailableError();
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > limit)
      throw new TelegramUnavailableError();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) throw new TelegramUnavailableError();
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    if (!length) throw new TelegramUnavailableError();
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    return data;
  } catch { throw new TelegramUnavailableError(); }
}
