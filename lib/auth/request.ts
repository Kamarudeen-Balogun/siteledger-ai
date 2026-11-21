import { AccountError } from "./provider";
/** Bound actual streamed bytes, including requests without Content-Length. */
export async function smallJson(request: Request, limit = 16000): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new AccountError("The request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return {};
  const parts: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > limit) throw new AccountError("The request is too large.", 413);
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts)); }
  catch { throw new AccountError("Check the submitted text.", 422); }
  let value: unknown;
  try { value = JSON.parse(text.trim() || "{}"); } catch { throw new AccountError("Check the submitted fields.", 422); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountError("Check the submitted fields.", 422);
  return value as Record<string, unknown>;
}
