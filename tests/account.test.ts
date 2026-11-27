import test from "node:test";
import assert from "node:assert/strict";
import { accountApi } from "../lib/auth/api";
import { emailAddress, professionalName } from "../lib/auth/types";
import { accountCookie, secretHash } from "../lib/auth/session";
import { AccountError, authRequest, nativeSession } from "../lib/auth/provider";
import { validEmailCode } from "../lib/auth/email-code";

process.env.SITELEDGER_APP_URL = "https://siteledger.example.test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-publishable";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
const request = (input: Record<string, unknown>, origin = process.env.SITELEDGER_APP_URL!) => new Request("https://siteledger.example.test/api/account/signup", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(input) });

test("professional attribution accepts Unicode and single-word names, rejecting blank/control input", () => {
  assert.equal(professionalName("  Ọlá  "), "Ọlá");
  assert.equal(professionalName("李"), "李");
  assert.equal(professionalName("   "), null);
  assert.equal(professionalName("Name\nOther"), null);
  assert.equal(professionalName("Name\u202eOther"), null);
  assert.equal(professionalName("a".repeat(121)), null);
  assert.equal(emailAddress("Person@Example.test"), "person@example.test");
});
test("account actions deny cross-origin requests and caller-supplied identity/privilege", async () => {
  const denied = await accountApi(request({ email: "x@example.test" }, "https://unrelated.example.test"), "signup");
  assert.equal(denied.status, 403);
  const injection = await accountApi(request({ email: "x@example.test", telegram_id: 123, role: "pm" }), "signup");
  assert.equal(injection.status, 422);
  assert.equal((await accountApi(request({}), "make_owner")).status, 404);
});
test("signup stays closed while the site CAPTCHA key is missing", async context => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const calls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo) => {
    const path = new URL(String(url)).pathname; calls.push(path);
    assert.equal(path, "/rest/v1/rpc/account_limit");
    return Response.json(true);
  });
  const result = await accountApi(request({ email: "foreman@example.test", password: "long-test-password", name: "Amina", confirm_name: true, captcha_token: "untrusted" }), "signup");
  assert.equal(result.status, 503);
  assert.equal(calls.some(path => path.startsWith("/auth/")), false);
});
test("signup enforces native CAPTCHA and keeps access pending until email confirmation", async context => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-public-site-key";
  let signups = 0;
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("account_limit")) return Response.json(true);
    if (path === "/auth/v1/settings") return Response.json({ mailer_autoconfirm: false, disable_signup: false });
    assert.equal(path, "/auth/v1/signup"); signups++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.gotrue_meta_security, { captcha_token: "captcha-proof" });
    assert.equal("role" in body, false);
    return Response.json({ user: { id: "81000000-0000-4000-8000-000000000001" } });
  });
  const result = await accountApi(request({ email: "foreman@example.test", password: "long-test-password", name: "Amina", confirm_name: true, captcha_token: "captcha-proof" }), "signup");
  assert.equal(result.status, 200); assert.equal(signups, 1);
  assert.equal((await result.json()).pending_confirmation, true);
  assert.equal(result.headers.get("set-cookie"), null);
});
for (const code of ["123456", "01234567", "0123456789"]) test(`successful ${code.length}-digit signup code proves ownership without truncation or native-token exposure`, async context => {
  const user = "81000000-0000-4000-8000-000000000001", nativeId = "81000000-0000-4000-8000-000000000011";
  const nativeToken = "test." + Buffer.from(JSON.stringify({ sub: user, session_id: nativeId })).toString("base64url") + ".test";
  const account = { profile_id: user, source: "browser", professional_name: "Amina", email_verified: true };
  let proved = false;
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(url)).pathname, body = init?.body ? JSON.parse(String(init.body)) : null;
    if (path.endsWith("account_limit")) return Response.json(true);
    if (path === "/auth/v1/verify") { assert.deepEqual(body, {email:"foreman@example.test",token:code,type:"signup"}); return Response.json({ access_token: nativeToken, user: { id: user }, refresh_token: "native-refresh" }); }
    if (path === "/auth/v1/user") return Response.json({ id: user });
    if (path.endsWith("account_browser_session")) { assert.equal(body.p_user,user);assert.equal(body.p_auth_session,nativeId);assert.match(body.p_hash,/^[a-f0-9]{64}$/);return Response.json(account); }
    if (path.endsWith("account_verified_email")) { proved = true; assert.equal(body.p_user,user); return Response.json(account); }
    assert.ok(path.endsWith("account_session")); return Response.json(account);
  });
  const result=await accountApi(request({email:"foreman@example.test",token:code,name:"Amina",confirm_name:true,captcha_token:"captcha-proof"}),"verify_signup");
  assert.equal(result.status,200);assert.ok(proved);
  const output=JSON.stringify(await result.json());assert.equal(output.includes(nativeToken),false);assert.equal(output.includes("native-refresh"),false);
  assert.match(result.headers.get("set-cookie")!,/HttpOnly; SameSite=Lax.*Secure/);
});

test("email code validation rejects shortened, overlong, non-numeric and converted codes before native verification", async context => {
  context.mock.method(globalThis, "fetch", async () => { throw new Error("Malformed code must not reach Auth"); });
  for (const token of ["12345", "12345678901", "1234ABCD", "１２３４５６７８", "123456\n", " 12345678", 12345678, null]) {
    assert.equal(validEmailCode(token), false);
    for (const action of ["verify_signup", "reset_password"]) {
      const result = await accountApi(request({ email: "foreman@example.test", token,
        ...(action === "verify_signup" ? { name: "Amina", confirm_name: true } : { password: "long-test-password" }) }), action);
      assert.equal(result.status, 422, `${action}: malformed code`);
      assert.equal(result.headers.get("set-cookie"), null);
    }
  }
});

test("eight-digit recovery and invitation email codes reach native verification intact", async context => {
  const user = "81000000-0000-4000-8000-000000000001", nativeId = "81000000-0000-4000-8000-000000000011";
  const nativeToken = "test." + Buffer.from(JSON.stringify({ sub: user, session_id: nativeId })).toString("base64url") + ".test";
  const account = { profile_id: user, source: "browser", email: "foreman@example.test" };
  const verified: string[] = [];
  let revoked = false, emailProved = false;
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(url)).pathname, body = init?.body ? JSON.parse(String(init.body)) : null;
    if (path.endsWith("account_limit")) return Response.json(true);
    if (path.endsWith("account_session")) return Response.json(account);
    if (path === "/auth/v1/verify") {
      assert.deepEqual(body, { email: account.email, token: "01234567", type: body.type });
      verified.push(body.type);
      return Response.json({ access_token: nativeToken, user: { id: user } });
    }
    if (path === "/auth/v1/user") {
      if (init?.method === "PUT") assert.deepEqual(body, { password: "long-test-password" });
      return Response.json({ id: user });
    }
    if (path.endsWith("account_revoke_user")) { revoked = true; return Response.json(null); }
    if (path.endsWith("account_verified_email")) { emailProved = true; return Response.json(account); }
    assert.equal(path, "/auth/v1/logout"); return Response.json({});
  });
  const recovered = await accountApi(request({ email: account.email, token: "01234567", password: "long-test-password", captcha_token: "captcha-proof" }), "reset_password");
  assert.equal(recovered.status, 200); assert.ok(revoked);
  assert.match(recovered.headers.get("set-cookie")!, /Max-Age=0/);
  const invitation = request({ token: "01234567", captcha_token: "captcha-proof" });
  invitation.headers.set("cookie", accountCookie("a".repeat(43)));
  assert.equal((await accountApi(invitation, "verify_email")).status, 200);
  assert.ok(emailProved); assert.deepEqual(verified, ["recovery", "email"]);
});

test("a correctly shaped but invalid native code cannot create account access", async context => {
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("account_limit")) return Response.json(true);
    assert.equal(path, "/auth/v1/verify");
    return Response.json({ error_code: "otp_expired" }, { status: 403 });
  });
  const result = await accountApi(request({ email: "foreman@example.test", token: "01234567", name: "Amina", confirm_name: true, captcha_token: "captcha-proof" }), "verify_signup");
  assert.equal(result.status, 400); assert.equal(result.headers.get("set-cookie"), null);
});
test("signup detects hosted confirmation settings before creating a native account", async context => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-public-site-key";
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("account_limit")) return Response.json(true);
    assert.equal(path, "/auth/v1/settings"); return Response.json({ mailer_autoconfirm: true });
  });
  const result = await accountApi(request({ email: "foreman@example.test", password: "long-test-password", name: "Amina", confirm_name: true, captcha_token: "captcha-proof" }), "signup");
  assert.equal(result.status, 503);
});
test("native token claims cannot choose a different person from the provider-verified user", async context => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ id: "81000000-0000-4000-8000-000000000001" }));
  const token = "test." + Buffer.from(JSON.stringify({ sub: "81000000-0000-4000-8000-000000000002", session_id: "81000000-0000-4000-8000-000000000011" })).toString("base64url") + ".test";
  await assert.rejects(nativeSession({ access_token: token, user: { id: "81000000-0000-4000-8000-000000000002" } }), /Sign in again/);
  assert.match(secretHash("opaque-random-session"), /^[a-f0-9]{64}$/);
  assert.match(accountCookie("", true), /Max-Age=0/);
});
test("sign-in survives a Supabase RPC transport failure with the generic message", async context => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-public-site-key";
  context.mock.method(globalThis, "fetch", async () => { throw new Error("network down"); });
  const result = await accountApi(request({ email: "foreman@example.test", password: "long-test-password", captcha_token: "captcha-proof" }), "signin");
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error, "Account access is temporarily unavailable. Try again; your records are preserved.");
});
test("sign-in names a missing service-role key instead of the generic message", async context => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-public-site-key";
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    context.mock.method(globalThis, "fetch", async () => { throw new Error("fetch must not be reached without service credentials"); });
    const result = await accountApi(request({ email: "foreman@example.test", password: "long-test-password", captcha_token: "captcha-proof" }), "signin");
    assert.equal(result.status, 503);
    assert.equal((await result.json()).error, "Account access is not set up on this deployment yet. Your records are preserved — try the main SiteLedger website.");
  } finally { process.env.SUPABASE_SERVICE_ROLE_KEY = saved; }
});
test("authRequest converts a fetch failure into an AccountError, not a plain throw", async context => {
  context.mock.method(globalThis, "fetch", async () => { throw new DOMException("The operation timed out.", "TimeoutError"); });
  await assert.rejects(authRequest("token?grant_type=password", { email: "foreman@example.test", password: "long-test-password" }), (error: unknown) => {
    assert.ok(error instanceof AccountError);
    assert.equal((error as AccountError).status, 503);
    return true;
  });
});
