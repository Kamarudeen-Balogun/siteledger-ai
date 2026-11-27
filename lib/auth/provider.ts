import "server-only";
import { UUID } from "../confirm/access";
export class AccountError extends Error { constructor(message: string, public status = 400) { super(message); } }
type NativeSession = { access_token: string; user: { id: string }; auth_session_id: string };
export async function authRequest(path: string, body?: Record<string, unknown>, access?: string, method = "POST"): Promise<Record<string, unknown>> {
  const base = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL") as string | undefined, key = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_ANON_KEY") as string | undefined;
  if (!base || !key) throw new AccountError("Account access is temporarily unavailable.", 503);
  let origin: URL;
  try { origin = new URL(base); } catch { throw new AccountError("Account access is temporarily unavailable.", 503); }
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname))) throw new AccountError("Account access is temporarily unavailable.", 503);
  // A fetch failure or timeout is a plain Error (DOMException), not an
  // AccountError — convert it here so callers never see the generic catch-all.
  let response: Response;
  try {
    response = await fetch(new URL(`/auth/v1/${path}`, origin), { method, headers: { apikey: key, "Content-Type": "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch { throw new AccountError("Account access is temporarily unavailable. Try again.", 503); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new AccountError("Too many attempts. Wait a little and try again.", 429);
    if (String(data.error_code ?? data.code).includes("captcha")) throw new AccountError("Complete a new bot check and try again.", 422);
    if (path === "verify" && body?.type === "signup" && data.error_code === "otp_expired") throw new AccountError("That code is invalid or expired. Request a fresh code and use the latest email.", 400);
    if (path === "signup" && [data.message,data.msg,data.error_description].includes("This email cannot be used for 30 days after account deletion.")) throw new AccountError("This email cannot be used for 30 days after account deletion.",403);
    throw new AccountError("Could not complete this account request. Check your details or try again later.", response.status >= 500 ? 503 : 400);
  }
  return data;
}
export async function nativeSession(data: Record<string, unknown>): Promise<NativeSession> {
  if (typeof data.access_token !== "string" || !data.user || typeof data.user !== "object") throw new AccountError("Account access is temporarily unavailable. Confirm your email or sign in again.", 503);
  const user = await authRequest("user", undefined, data.access_token, "GET");
  let claims: Record<string, unknown>;
  try { claims = JSON.parse(Buffer.from(data.access_token.split(".")[1], "base64url").toString()); } catch { throw new AccountError("Sign in again.", 401); }
  // /user validates the native access token; SQL also checks the real native session.
  if (typeof user.id !== "string" || !UUID.test(user.id) || claims.sub !== user.id || typeof claims.session_id !== "string" || !UUID.test(claims.session_id)) throw new AccountError("Sign in again.", 401);
  return { access_token: data.access_token, user: { id: user.id }, auth_session_id: claims.session_id };
}
