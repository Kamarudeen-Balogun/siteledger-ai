import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Access = { id: string; telegramId: number; expires: number };
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update("siteledger-confirm:v1:" + payload).digest();
}
export function createReviewToken(id: string, telegramId: number, secret: string, now = Date.now()) {
  if (!UUID.test(id) || !Number.isSafeInteger(telegramId) || telegramId <= 0 || !secret) throw new Error("Review access unavailable.");
  const payload = Buffer.from(JSON.stringify({ id, telegramId, expires: Math.floor(now / 1000) + 7 * 86400 })).toString("base64url");
  return payload + "." + signature(payload, secret).toString("base64url");
}
export function verifyReviewToken(token: string, id: string, secret: string, now = Date.now()): Access | null {
  try {
    if (!UUID.test(id) || !secret || token.length > 1000 || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token)) return null;
    const [payload, signed] = token.split(".");
    const supplied = Buffer.from(signed, "base64url"), expected = signature(payload, secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    if (value.id !== id || !Number.isSafeInteger(value.telegramId) || value.telegramId <= 0
      || !Number.isSafeInteger(value.expires) || value.expires <= seconds || value.expires > seconds + 7 * 86400) return null;
    return value;
  } catch { return null; }
}
export function reviewUrl(id: string, telegramId: number, secret: string): string | null {
  try {
    const origin = new URL(process.env.SITELEDGER_APP_URL ?? "");
    if (origin.protocol !== "https:" || origin.username || origin.password) return null;
    const url = new URL(`/confirm/${id}`, origin.origin);
    url.searchParams.set("access", createReviewToken(id, telegramId, secret));
    return url.toString();
  } catch { return null; }
}
