import { secretHash } from "../lib/auth/session";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createReviewToken, verifyReviewToken } from "../lib/confirm/access";
import { validateConfirmation } from "../lib/confirm/validation";
import { POST } from "../app/api/confirm/[id]/route";
import { createHmac } from "node:crypto";
import { verifyTelegramAccess } from "../lib/confirm/telegram-access";
import { POST as openTelegramReview } from "../app/api/confirm/access/route";

const id = "70000000-0000-4000-8000-000000000005", secret = "test-review-secret", now = 1795000000000;
const boq = [{ id: "70000000-0000-4000-8000-000000000006", description: "Blockwork", unit: "m2", section: "Blockwork", item_code: "B01" }];
const input = { human_confirmed: true, values: {
  work_items: [{ description: "East elevation", matched_boq_hint: "Blockwork", quantity: 18, unit: "m2", crew: 6, confidence: 0.3 }],
  materials: [{ name: "Cement", quantity: 40, unit: "bags", action: "delivered", confidence: 0.9 }],
  delays: [{ reason: "Rain", hours: 2, confidence: 0.9 }], issues: ["Check curing"], raw_language_notes: "Pidgin: don cast",
}, boq_ids: [boq[0].id], photo_notes: [] };
function signedTelegramData(token: string, at: number) {
  const fields = new URLSearchParams({ user: JSON.stringify({ id: 42, first_name: "Demo foreman" }), auth_date: String(Math.floor(at / 1000)), query_id: "test-query" });
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  const data = [...fields.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([a, b]) => `${a}=${b}`).join("\n");
  fields.set("hash", createHmac("sha256", key).update(data).digest("hex"));
  return fields.toString();
}
test("Telegram menu access trusts signed fresh data and rejects altered users, duplicates and old sessions", () => {
  const token = "test-bot-token", signed = signedTelegramData(token, now);
  assert.equal(verifyTelegramAccess(signed, token, now), 42);
  assert.equal(verifyTelegramAccess(signed, "wrong-bot", now), null);
  assert.equal(verifyTelegramAccess(signed, token, now + 3601000), null);
  assert.equal(verifyTelegramAccess(signed, token, now - 31000), null);
  const altered = new URLSearchParams(signed); altered.set("user", JSON.stringify({ id: 99 }));
  assert.equal(verifyTelegramAccess(altered.toString(), token, now), null);
  assert.equal(verifyTelegramAccess(signed + "&user=%7B%22id%22%3A99%7D", token, now), null);
  assert.equal(verifyTelegramAccess("user=%7B%22id%22%3A42%7D", token, now), null);
});
test("old Telegram menu uses current linked identity and never mints a bearer review link", async context => {
  process.env.SITELEDGER_APP_URL="https://siteledger.test";process.env.TELEGRAM_BOT_TOKEN="test-bot-token";
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://supabase.test";process.env.SUPABASE_SERVICE_ROLE_KEY="sb_secret_test";
  let linked=true,calls=0;
  context.mock.method(globalThis,"fetch",async (url: URL | RequestInfo,options?: RequestInit)=>{
    calls++; const path=new URL(String(url)).pathname;
    if(path.endsWith("account_limit"))return Response.json(true);
    assert.ok(path.endsWith("account_telegram_session"));const body=JSON.parse(String(options?.body));assert.equal(body.p_telegram,42);assert.match(body.p_proof_hash,/^[a-f0-9]{64}$/);
    return Response.json(linked?{profile_id:id,source:"telegram"}:{needs_login:true});
  });
  const request=(data:unknown,origin="https://siteledger.test")=>new Request(origin+"/api/confirm/access",{method:"POST",headers:{Origin:origin},body:JSON.stringify(data)});
  const signed=signedTelegramData(process.env.TELEGRAM_BOT_TOKEN,Date.now());
  assert.equal((await openTelegramReview(request({init_data:signed},"https://elsewhere.test"))).status,403);
  assert.equal((await openTelegramReview(request({init_data:"fake"}))).status,401);
  assert.equal((await openTelegramReview(request({init_data:signed,telegram_id:99}))).status,422);assert.equal(calls,0);
  const response=await openTelegramReview(request({init_data:signed}));assert.equal(response.status,200);assert.match(response.headers.get("set-cookie")!,/HttpOnly/);
  assert.equal("url" in await response.json(),false);
  linked=false;const unknown=await openTelegramReview(request({init_data:signed}));assert.equal((await unknown.json()).needs_login,true);assert.equal(unknown.headers.get("set-cookie"),null);
});
test("private review links expire and reject tampering, another submission and a wrong key", () => {
  const token = createReviewToken(id, 42, secret, now);
  assert.equal(verifyReviewToken(token, id, secret, now)?.telegramId, 42);
  assert.equal(verifyReviewToken(token, id, secret, now + 7 * 86400000), null);
  assert.equal(verifyReviewToken(token + "x", id, secret, now), null);
  assert.equal(verifyReviewToken(token, boq[0].id, secret, now), null);
  assert.equal(verifyReviewToken(token, id, "wrong", now), null);
});
test("confirmation requires known numbers and matching BoQ units; callers cannot supply money or identity", () => {
  assert.ok(validateConfirmation(input, boq, []));
  for (const changed of [
    { ...input, human_confirmed: false }, { ...input, confirmed_by: "Forged" },
    { ...input, values: { ...input.values, total_cost: 261000 } },
    { ...input, boq_ids: [id] },
    { ...input, values: { ...input.values, work_items: [{ ...input.values.work_items[0], quantity: null }] } },
    { ...input, values: { ...input.values, work_items: [{ ...input.values.work_items[0], unit: "m3" }] } },
    { ...input, values: { ...input.values, work_items: [{ ...input.values.work_items[0], crew: 1.5 }] } },
    { ...input, values: { ...input.values, delays: [{ ...input.values.delays[0], hours: null, confidence: 0.3 }] } },
  ]) assert.equal(validateConfirmation(changed, boq, []), false);
  assert.equal(validateConfirmation({ ...input, photo_notes: [{ id, note: "Wrong photo" }] }, boq, [boq[0].id]), false);
});
test("API denies unsigned/foreign-origin reviews, blocks unfinished evidence, and saves confirmed values only", async () => {
  const names = ["SITELEDGER_APP_URL", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const saved = names.map(name => process.env[name]); const savedFetch = globalThis.fetch;
  process.env.SITELEDGER_APP_URL = "https://siteledger.test"; process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test"; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  const token = "a".repeat(43);
  let state = "extracted", pending = false, pendingPhotos = false;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options?.body as string); calls.push({ url: String(url), body });
    if (String(url).endsWith("account_review")) return Response.json({ status: state, pending_media: pending, pending_photo_analysis: pendingPhotos, job_status: "extracted", audio_url:"site-evidence/fixture/voice.wav", boq, photos: [] });
    assert.ok(String(url).endsWith("account_confirm"));
    assert.equal(body.p_hash, secretHash(token)); assert.deepEqual(body.p_values, input.values);
    assert.equal(body.p_transcript, undefined); assert.equal(body.p_price, undefined); assert.equal(body.p_confirmed_by, undefined);
    return Response.json({ status: "confirmed", confirmed_by: "Demo foreman" });
  };
  const request = (origin: string, access: string, body: unknown = input) => new Request(`https://siteledger.test/api/confirm/${id}`, {
    method: "POST", headers: { Origin: origin, Cookie: `siteledger_session=${access}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const context = { params: Promise.resolve({ id }) };
  try {
    assert.equal((await POST(request("https://elsewhere.test", token), context)).status, 403);
    assert.equal((await POST(request("https://siteledger.test", "bad"), context)).status, 401); assert.equal(calls.length, 0);
    state = "locked"; assert.equal((await POST(request("https://siteledger.test", token), context)).status, 409);
    state = "extracted"; pending = true; assert.equal((await POST(request("https://siteledger.test", token), context)).status, 409);
    pending = false; pendingPhotos = true; assert.equal((await POST(request("https://siteledger.test", token), context)).status, 409);
    pendingPhotos = false; assert.equal((await POST(request("https://siteledger.test", token, { ...input, total_cost: 1 }), context)).status, 422);
    assert.equal((await POST(request("https://siteledger.test", token), context)).status, 200);
    assert.equal(calls.filter(call => call.url.endsWith("account_confirm")).length, 1);
  } finally { globalThis.fetch = savedFetch; names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; }); }
});
