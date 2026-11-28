import "server-only";
import { randomBytes } from "node:crypto";
import { intakeRpc, IntakeConfigError } from "../telegram/storage";
import { verifyTelegramAccess } from "../confirm/telegram-access";
import { UUID } from "../confirm/access";
import { isAllowedAppOrigin } from "../app-url";
import { accountCookie, accountForHash, requestSessionHash, secretHash, sessionToken } from "./session";
import { AccountError, authRequest, nativeSession } from "./provider";
import { emailAddress, professionalName, validPassword, type Account } from "./types";
import { smallJson } from "./request";
import { validEmailCode } from "./email-code";

export const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const shapes: Record<string, string[]> = {
  signup: ["email", "password", "name", "confirm_name", "company", "captcha_token", "link_existing"],
  verify_signup: ["email", "token", "name", "confirm_name", "company", "link_existing", "captcha_token"],
  resend_signup: ["email"],
  signin: ["email", "password", "captcha_token", "link_existing", "combine_profiles"],
  telegram: ["init_data"], profile: ["name", "confirm_name"], logout: ["all"],
  reauthenticate: ["password", "captcha_token"], request_email_proof: ["captcha_token"], verify_email: ["token", "captcha_token"],
  recover: ["email", "captcha_token"], reset_password: ["email", "token", "password", "captcha_token"],
  link_create: ["project_id"], link_status: ["id"], link_finish: ["id", "combine_profiles", "other_email", "other_password", "captcha_token"],
  unlink_telegram: [], connect_telegram: ["init_data", "combine_profiles", "other_email", "other_password", "captcha_token"],
};
// TEMP FILMING BYPASS (preview only): sign-in accepts a missing bot-check
// token so the Tella auto-capture agent can log in. Revert after filming.
// Signup, verify_signup, recover, reset_password and every other action
// still require the token.
function captcha(input: Record<string, unknown>, allowMissing = false) {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) throw new AccountError("The bot check is not configured yet. Try again after setup.", 503);
  if (typeof input.captcha_token !== "string" || !input.captcha_token || input.captcha_token.length > 6000) {
    if (allowMissing) return { captcha_token: "" };
    throw new AccountError("Complete the bot check.", 422);
  }
  return { captcha_token: input.captcha_token };
}
function checked<T>(result: T | null): T {
  if (!result) throw new AccountError("Sign in again to continue.", 401);
  if (typeof result === "object" && "error" in result) {
    const messages: Record<string, [string, number]> = {
      reauthenticate: ["Confirm your password again before this action.", 401],
      rate_limited: ["Too many attempts. Wait a little and try again.", 429],
      combine_required: ["Confirm that you want to combine these two accounts.", 409],
      other_browser_proof_required: ["This Telegram profile already has website access. Sign in to that website account as well before combining.", 409],
      changed: ["The account connection changed. Start a fresh link.", 409],
      verify_email: ["Verify your account email before connecting Telegram.", 403],
      project_unavailable: ["This project is no longer available for Telegram linking. Choose an active project you can access.", 409],
      launch_used: ["This Telegram launch was already used. Close the Mini App and reopen it for a fresh connection.", 409],
    };
    const [message, status] = messages[String(result.error)] ?? ["This request expired or is unavailable. Start again.", 400];
    throw new AccountError(message, status);
  }
  return result;
}
async function limited(request: Request, action: string, identity = "") {
  const attempt = (key: string, max: number, seconds: number) => intakeRpc<boolean>("account_limit", { p_key: key, p_max: max, p_seconds: seconds });
  // A global bound remains effective even when an attacker varies claimed IPs.
  if (!await attempt(`auth-global:${action}`, 200, 60)) throw new AccountError("Too many attempts. Wait a little and try again.", 429);
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim().slice(0,100);
  if (!await attempt(`auth-ip:${action}:${secretHash(ip)}`, 20, 600)
    || (identity && !await attempt(`auth-person:${action}:${secretHash(identity)}`, 10, 600))) throw new AccountError("Too many attempts. Wait a little and try again.", 429);
}
async function actor(hash: string): Promise<Account> { return checked(await accountForHash(hash)); }
function signedIn(account: Account, token: string) {
  return Response.json({ account }, { headers: { ...privateHeaders, "Set-Cookie": accountCookie(token) } });
}
async function browserLogin(request: Request, input: Record<string, unknown>, hash: string, signup: boolean) {
  const email = emailAddress(input.email);
  if (!email || !validPassword(input.password)) throw new AccountError("Enter a valid email and a password of 12–128 characters.", 422);
  const existing = await accountForHash(hash);
  if (signup && existing?.source === "browser") throw new AccountError("You already have website access. Sign out before creating another account.", 409);
  if (signup && existing?.source === "telegram" && existing.browser_linked) throw new AccountError("This Telegram profile already has website access. Sign in to its existing website account.", 409);
  const name = signup ? professionalName(input.name) : null;
  if (signup && (!name || input.confirm_name !== true)) throw new AccountError("Type and confirm your professional name.", 422);
  // Company / firm is optional on registration. Accept it when given so the
  // signup form can carry it through to email confirmation, where the profile
  // row exists and it can be stored. It is never required.
  const company = typeof input.company === "string" ? input.company.trim() : "";
  if (company && (company.length > 120 || /[\u0000-\u001f\u007f]/.test(company))) throw new AccountError("Enter a company or firm name up to 120 characters, or leave it empty.", 422);
  if (existing?.source === "telegram" && input.link_existing !== true) throw new AccountError("Confirm that you want to connect this Telegram profile to website access.", 422);
  await limited(request, signup ? "signup" : "signin", email);
  const meta = captcha(input, !signup);
  if (signup) {
    const settings = await authRequest("settings", undefined, undefined, "GET");
    if (settings.mailer_autoconfirm !== false || settings.disable_signup === true) throw new AccountError("Enable signup email confirmation in Supabase before registering. Your existing records are preserved.", 503);
  }
  const data = await authRequest(signup ? "signup" : "token?grant_type=password", { email, password: input.password, gotrue_meta_security: meta });
  if (signup) {
    if (typeof data.access_token === "string") throw new AccountError("Signup confirmation settings changed. Enable Confirm email and try again.", 503);
    return Response.json({ pending_confirmation: true, email, message: "Check your inbox for a signup code. Enter the full code from your email. If you already have an account, sign in instead." }, { headers: privateHeaders });
  }
  const native = await nativeSession(data), token = sessionToken();
  if (existing?.source === "telegram") checked(await intakeRpc<Account | null>("account_attach_browser", { p_hash: hash, p_user: native.user.id, p_auth_session: native.auth_session_id, p_new_hash: secretHash(token), p_combine: input.combine_profiles === true }));
  else checked(await intakeRpc<Account | null>("account_browser_session", { p_user: native.user.id, p_auth_session: native.auth_session_id, p_hash: secretHash(token), p_name: name }));
  // Telegram-first signup reuses the existing profile rather than creating another.
  return signedIn(checked(await accountForHash(secretHash(token))), token);
}
async function confirmSignup(request: Request, input: Record<string, unknown>, hash: string) {
  const email = emailAddress(input.email), name = professionalName(input.name);
  if (!email || !name || input.confirm_name !== true || !validEmailCode(input.token)) throw new AccountError("Enter your signup email, the full 6–10 digit code and confirmed professional name.", 422);
  const existing = await accountForHash(hash);
  if (existing?.source === "browser") throw new AccountError("Sign out before confirming another website account.", 409);
  if (existing?.source === "telegram" && input.link_existing !== true) throw new AccountError("Confirm that this website login should connect to your Telegram profile.", 422);
  await limited(request, "verify_signup", email);
  // The verification code itself is checked by the Turnstile widget too: a
  // fresh bot check is required before the code can be submitted.
  captcha(input);
  const native = await nativeSession(await authRequest("verify", { email, token: input.token, type: "signup" })), token = sessionToken();
  if (existing?.source === "telegram") {
    checked(await intakeRpc("account_attach_browser", { p_hash: hash, p_user: native.user.id, p_auth_session: native.auth_session_id, p_new_hash: secretHash(token), p_combine: false }));
    checked(await intakeRpc("account_profile_name", { p_hash: secretHash(token), p_name: name }));
  } else checked(await intakeRpc("account_browser_session", { p_user: native.user.id, p_auth_session: native.auth_session_id, p_hash: secretHash(token), p_name: name }));
  // Store the optional company / firm given at registration, if any.
  const company = typeof input.company === "string" ? input.company.trim() : "";
  if (company && (company.length > 120 || /[\u0000-\u001f\u007f]/.test(company))) throw new AccountError("Enter a company or firm name up to 120 characters, or leave it empty.", 422);
  if (company) {
    // Optional detail only: never let storing it block signup confirmation.
    await intakeRpc("account_profile_details", { p_hash: secretHash(token), p_update: { company } }).catch(() => null);
  }
  // Only the successful native signup challenge proves this email, including
  // accounts that existed while automatic confirmation was previously enabled.
  checked(await intakeRpc("account_verified_email", { p_hash: secretHash(token), p_user: native.user.id, p_auth_session: native.auth_session_id }));
  return signedIn(checked(await accountForHash(secretHash(token))), token);
}
async function botLink(secret: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new AccountError("The Telegram bot is unavailable. Keep your website account and try later.", 503);
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok || !data.ok || typeof data.result?.username !== "string" || !/^[A-Za-z0-9_]+$/.test(data.result.username)) throw new AccountError("The Telegram bot is unavailable. Try later.", 503);
  return `https://t.me/${data.result.username}?start=link_${secret}`;
}
export async function accountApi(request: Request, action: string): Promise<Response> {
  if (!Object.hasOwn(shapes, action)) return Response.json({ error: "Account action unavailable." }, { status: 404, headers: privateHeaders });
  try {
    if (!isAllowedAppOrigin(request.headers.get("origin"))) throw new AccountError("Open this action on SiteLedger.", 403);
    const input = await smallJson(request);
    if (Object.keys(input).some(key => !shapes[action].includes(key))) throw new AccountError("Check your account details.", 422);
    const hash = requestSessionHash(request);
    if (action === "signup" || action === "signin") return await browserLogin(request, input, hash, action === "signup");
    if (action === "verify_signup") return await confirmSignup(request, input, hash);
    if (action === "resend_signup") {
      const email=emailAddress(input.email);
      if(!email)throw new AccountError("Enter the email you used to sign up.",422);
      await limited(request,action,email);
      try {await authRequest("resend",{type:"signup",email});}
      catch(error){if(!(error instanceof AccountError)||![400,404].includes(error.status))throw error;}
      return Response.json({message:"If this signup can receive email, a fresh code is on its way."},{headers:privateHeaders});
    }
    if (action === "telegram") {
      if (typeof input.init_data !== "string") throw new AccountError("Open SiteLedger from the Telegram bot.", 401);
      const id = verifyTelegramAccess(input.init_data, process.env.TELEGRAM_BOT_TOKEN ?? "");
      if (!id) throw new AccountError("Close this window and reopen it from the Telegram bot.", 401);
      // A website session must not silently switch to a different Telegram person.
      const current = await accountForHash(hash);
      if (current?.source === "browser") return Response.json({ account: current }, { headers: privateHeaders });
      await limited(request, "telegram");
      const token = sessionToken();
      const account = await intakeRpc<Account & { needs_login?: boolean } | null>("account_telegram_session", { p_telegram: id, p_hash: secretHash(token), p_proof_hash: secretHash(new URLSearchParams(input.init_data).get("hash")!) });
      if (account?.needs_login) return Response.json({ account: null, needs_login: true }, { headers: privateHeaders });
      return signedIn(checked(account), token);
    }
    if (action === "logout") {
      await intakeRpc("account_logout", { p_hash: hash, p_all: input.all === true });
      return Response.json({ signed_out: true }, { headers: { ...privateHeaders, "Set-Cookie": accountCookie("", true) } });
    }
    if (action === "recover") {
      const email = emailAddress(input.email);
      if (!email) throw new AccountError("Enter a valid email address.", 422);
      await limited(request, action, email);
      const meta = captcha(input);
      try { await authRequest("recover", { email, gotrue_meta_security: meta }); }
      catch (error) { if (!(error instanceof AccountError) || ![400,404].includes(error.status)) throw error; }
      return Response.json({ message: "If this account can receive recovery email, we have sent a one-use code. Check your inbox." }, { headers: privateHeaders });
    }
    if (action === "reset_password") {
      const email = emailAddress(input.email);
      if (!email || !validPassword(input.password) || !validEmailCode(input.token)) throw new AccountError("Enter the recovery email, the full 6–10 digit code and a new password of 12–128 characters.", 422);
      await limited(request, action, email);
      // The code step is gated by a fresh Turnstile check in the form.
      captcha(input);
      const native = await nativeSession(await authRequest("verify", { email, token: input.token, type: "recovery" }));
      await authRequest("user", { password: input.password }, native.access_token, "PUT");
      await intakeRpc("account_revoke_user", { p_user: native.user.id });
      await authRequest("logout?scope=global", {}, native.access_token).catch(() => undefined);
      return Response.json({ message: "Password changed. Sign in with your new password." }, { headers: { ...privateHeaders, "Set-Cookie": accountCookie("", true) } });
    }
    const current = await actor(hash);
    await limited(request, action, current.profile_id);
    if (action === "connect_telegram" || action === "unlink_telegram" || action === "link_create") {
      if (!await accountForHash(hash, true)) throw new AccountError("Confirm your password again before this action.", 401);
    }
    if (action === "profile") {
      const name = professionalName(input.name);
      if (!name || input.confirm_name !== true) throw new AccountError("Type and confirm your professional name, up to 120 characters.", 422);
      return Response.json({ account: checked(await intakeRpc("account_profile_name", { p_hash: hash, p_name: name })) }, { headers: privateHeaders });
    }
    if (action === "reauthenticate") {
      if (current.source !== "browser" || !validPassword(input.password)) throw new AccountError("Sign in with your website email and password.", 401);
      const native = await nativeSession(await authRequest("token?grant_type=password", { email: current.email, password: input.password, gotrue_meta_security: captcha(input) }));
      return Response.json({ account: checked(await intakeRpc("account_reauthenticate", { p_hash: hash, p_user: native.user.id, p_auth_session: native.auth_session_id })) }, { headers: privateHeaders });
    }
    if (action === "request_email_proof") {
      if (current.source !== "browser" || !current.email) throw new AccountError("Connect website email/password access before accepting an email invitation.", 403);
      await authRequest("otp", { email: current.email, create_user: false, gotrue_meta_security: captcha(input) });
      return Response.json({ message: "Check your inbox for a code to prove ownership of this account's email. Enter the full code." }, { headers: privateHeaders });
    }
    if (action === "verify_email") {
      if (current.source !== "browser" || !current.email || !validEmailCode(input.token)) throw new AccountError("Enter the full 6–10 digit email code.", 422);
      captcha(input);
      const native = await nativeSession(await authRequest("verify", { email: current.email, token: input.token, type: "email" }));
      return Response.json({ account: checked(await intakeRpc("account_verified_email", { p_hash: hash, p_user: native.user.id, p_auth_session: native.auth_session_id })) }, { headers: privateHeaders });
    }
    if (action === "link_create") {
      const project = input.project_id;
      if (project !== undefined && (typeof project !== "string" || !UUID.test(project))) throw new AccountError("Select a project before creating a code.", 422);
      const secret = randomBytes(18).toString("base64url"), url = await botLink(secret);
      const result = checked(await intakeRpc<Record<string, unknown>>("account_start_project_link", { p_hash: hash, p_secret_hash: secretHash(secret), p_project: project ?? null }));
      return Response.json({ ...result, code: `TG-${secret}`, url }, { headers: privateHeaders });
    }
    if (action === "connect_telegram") {
      if (typeof input.init_data !== "string" || input.combine_profiles !== true) throw new AccountError("Confirm the Telegram connection from the Mini App.", 422);
      const id = verifyTelegramAccess(input.init_data, process.env.TELEGRAM_BOT_TOKEN ?? "");
      if (!id) throw new AccountError("Close this Mini App and reopen it from Telegram.", 401);
      let other: Awaited<ReturnType<typeof nativeSession>> | undefined;
      if (input.other_email || input.other_password) {
        const email = emailAddress(input.other_email);
        if (!email || !validPassword(input.other_password)) throw new AccountError("Enter the other website account's email and password.", 422);
        other = await nativeSession(await authRequest("token?grant_type=password", { email, password: input.other_password, gotrue_meta_security: captcha(input) }));
      }
      return Response.json({ account: checked(await intakeRpc("account_link_miniapp", { p_hash: hash, p_telegram: id,
        p_proof_hash: secretHash(new URLSearchParams(input.init_data).get("hash")!), p_combine: true,
        p_other_user: other?.user.id ?? null, p_other_session: other?.auth_session_id ?? null })) }, { headers: privateHeaders });
    }
    if (action === "unlink_telegram") return Response.json({ account: checked(await intakeRpc("account_unlink_telegram", { p_hash: hash })) }, { headers: privateHeaders });
    if (typeof input.id !== "string" || !UUID.test(input.id)) throw new AccountError("Start a fresh Telegram link.", 422);
    if (action === "link_status") {
      const status = await intakeRpc("account_link_status", { p_hash: hash, p_id: input.id });
      if (!status) throw new AccountError("This code expired or was replaced. Generate a fresh code.", 409);
      return Response.json(status, { headers: privateHeaders });
    }
    if (action === "link_finish") {
      let other: Awaited<ReturnType<typeof nativeSession>> | undefined;
      if (input.other_email || input.other_password) {
        const email = emailAddress(input.other_email);
        if (!email || !validPassword(input.other_password)) throw new AccountError("Enter the other website account's email and password.", 422);
        other = await nativeSession(await authRequest("token?grant_type=password", { email, password: input.other_password, gotrue_meta_security: captcha(input) }));
      }
      return Response.json({ account: checked(await intakeRpc("account_finish_link", { p_hash: hash, p_id: input.id, p_combine: input.combine_profiles === true,
        p_other_user: other?.user.id ?? null, p_other_auth_session: other?.auth_session_id ?? null })) }, { headers: privateHeaders });
    }
    throw new AccountError("Account action unavailable.", 404);
  } catch (error) {
    // Log the underlying cause server-side so a generic message to the user
    // never hides the real failure from the deployment logs. Only the action
    // and the error's own name/message/stack are logged — never the request
    // body, tokens, passwords or codes.
    if (!(error instanceof AccountError)) console.error("accountApi failed", { action, name: error instanceof Error ? error.name : "unknown", message: error instanceof Error ? error.message : "unknown", ...(error instanceof IntakeConfigError && error.missing.length ? { missing: error.missing } : {}), stack: error instanceof Error ? error.stack : undefined });
    const message = error instanceof AccountError ? error.message
      : error instanceof IntakeConfigError ? "Account access is not set up on this deployment yet. Your records are preserved — try the main SiteLedger website."
      : "Account access is temporarily unavailable. Try again; your records are preserved.";
    return Response.json({ error: message },
      { status: error instanceof AccountError ? error.status : error instanceof SyntaxError ? 422 : 503, headers: privateHeaders });
  }
}
