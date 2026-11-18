import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Only Telegram's signed initData is trusted; initDataUnsafe and browser user IDs are not.
export function verifyTelegramAccess(initData: string, botToken: string, now = Date.now()): number | null {
  try {
    if (!botToken || !initData || initData.length > 10000) return null;
    const fields = new URLSearchParams(initData);
    const entries = [...fields.entries()];
    if (new Set(entries.map(([name]) => name)).size !== entries.length) return null;
    const hash = fields.get("hash") ?? "";
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    fields.delete("hash");
    const check = [...fields.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([name, value]) => `${name}=${value}`).join("\n");
    const key = createHmac("sha256", "WebAppData").update(botToken).digest();
    const expected = createHmac("sha256", key).update(check).digest();
    if (!timingSafeEqual(Buffer.from(hash, "hex"), expected)) return null;
    const date = fields.get("auth_date") ?? "";
    if (!/^\d{1,12}$/.test(date)) return null;
    const age = Math.floor(now / 1000) - Number(date);
    if (age < -30 || age > 3600) return null;
    const user = JSON.parse(fields.get("user") ?? "null");
    return user && Number.isSafeInteger(user.id) && user.id > 0 && !user.is_bot ? user.id : null;
  } catch { return null; }
}
