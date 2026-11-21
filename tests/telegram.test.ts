import assert from "node:assert/strict";
import { test } from "node:test";
import { handleTelegramWebhook, validWebhookSecret, type IntakeDependencies } from "../lib/telegram/webhook";
import { parseTelegramUpdate, MAX_PHOTO_BYTES } from "../lib/telegram/update";
import { downloadTelegramFile } from "../lib/telegram/api";
import { uploadEvidence } from "../lib/telegram/storage";

const secret = "test-webhook-secret";
const update = {
  update_id: 1,
  message: { date: 1794958200, from: { id: 42, first_name: "Test" },
    chat: { id: 42, type: "private" }, voice: { file_id: "voice-id", file_size: 120, mime_type: "audio/ogg" } },
};
function request(value: unknown = update, header: string | null = secret) {
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST", headers: header ? { "X-Telegram-Bot-Api-Secret-Token": header } : {},
    body: JSON.stringify(value),
  });
}
function fixture() {
  const events: string[] = [];
  let saved = false;
  let replied = false;
  const dependencies: IntakeDependencies = {
    prepare: async (id, payload) => { events.push("prepare"); return {
      update_id: id, payload, status: saved ? "saved" : "pending",
      storage_path: "project/submission/1.ogg", submission_id: "submission", reply_text: "Voice note saved.",
      reply_sent_at: replied ? "2026-11-18T00:00:00Z" : null,
    }; },
    download: async () => { events.push("download"); return new Uint8Array([1, 2, 3]); },
    upload: async () => { events.push("upload"); },
    finishMedia: async () => { events.push("save"); saved = true; },
    sendReply: async () => { events.push("reply"); },
    finishReply: async (_id, _owner, sent) => { events.push(sent ? "reply-saved" : "release"); replied = sent; },
  };
  return { dependencies, events };
}

test("secret is required before any database or provider access", async () => {
  const { dependencies, events } = fixture();
  for (const header of [null, "wrong", "a much longer wrong secret"]) {
    assert.equal((await handleTelegramWebhook(request(update, header), dependencies, secret)).status, 401);
  }
  assert.equal((await handleTelegramWebhook(request(), dependencies, undefined)).status, 503);
  assert.deepEqual(events, []);
  assert.equal(validWebhookSecret(secret, secret), true);
});
test("professional commands never save supplied passwords as notes", () => {
  for (const command of ["start","account","projects","today","reports","help","logout"]) {
    const parsed=parseTelegramUpdate({update_id:2,message:{...update.message,voice:undefined,text:`/${command}`}});
    assert.equal(parsed?.payload.kind,command);
  }
  for (const command of ["signin","signup","reset","unknown"]) {
    const parsed=parseTelegramUpdate({update_id:2,message:{...update.message,voice:undefined,text:`/${command} secret-password`}});
    assert.equal(parsed?.payload.text,undefined);
  }
});
test("blocked media receipts never download, upload or finalize evidence", async () => {
  const {dependencies,events}=fixture();
  dependencies.prepare=async(id,payload)=>({update_id:id,payload,status:"blocked",storage_path:null,submission_id:null,reply_text:"Project access changed.",reply_sent_at:null,reply_path:"/projects"});
  assert.equal((await handleTelegramWebhook(request(),dependencies,secret)).status,200);
  assert.deepEqual(events,["reply"]);
});
test("a fresh command resumes media against its original receipt and submission", async () => {
  const {dependencies,events}=fixture(),saved:string[]=[];
  dependencies.prepare=async(id,payload)=>({update_id:id,payload,status:"saved",storage_path:null,submission_id:null,reply_text:"Open your latest note.",reply_sent_at:null});
  dependencies.resumePending=async()=>({update_id:99,payload:{user_id:42,chat_id:42,display_name:"Metadata",sent_at:1794958200,kind:"voice",file_id:"original-file",content_type:"audio/ogg"},status:"pending",storage_path:"original-project/original-note/99.ogg",submission_id:"original-note",reply_text:"Saved",reply_sent_at:null});
  dependencies.download=async(file)=>{assert.equal(file,"original-file");events.push("download");return new Uint8Array([1]);};
  dependencies.upload=async(path)=>{assert.equal(path,"original-project/original-note/99.ogg");events.push("upload");};
  dependencies.finishMedia=async(id)=>{assert.equal(id,99);events.push("save");};
  const requestValue={...update,message:{...update.message,voice:undefined,text:"/today"}};
  assert.equal((await handleTelegramWebhook(request(requestValue),dependencies,secret,id=>saved.push(id))).status,200);
  assert.deepEqual(saved,["original-note"]);
  assert.deepEqual(events,["download","upload","save","reply-saved","reply","reply-saved"]);
});
test("private original updates only; start parsing and compressed photo selection", () => {
  assert.equal(parseTelegramUpdate({ update_id: 1, edited_message: update.message }), null);
  assert.equal(parseTelegramUpdate({ ...update, message: { ...update.message, chat: { id: 42, type: "group" } } }), null);
  assert.equal(parseTelegramUpdate({ ...update, message: { ...update.message, text: "/start LEKKI-DEMO-01" } })?.payload.project_code, "LEKKI-DEMO-01");
  const photo = parseTelegramUpdate({ update_id: 2, message: { ...update.message, voice: undefined, photo: [
    { file_id: "tiny", width: 100, height: 100, file_size: 1000 },
    { file_id: "best", width: 1000, height: 1000, file_size: 900000 },
    { file_id: "too-large", width: 3000, height: 3000, file_size: MAX_PHOTO_BYTES + 1 },
  ] } });
  assert.equal(photo?.payload.file_id, "best");
});
test("saved evidence is acknowledged; completed replay makes no duplicate writes", async () => {
  const { dependencies, events } = fixture();
  assert.equal((await handleTelegramWebhook(request(), dependencies, secret)).status, 200);
  assert.deepEqual(events, ["prepare", "download", "upload", "save", "reply", "reply-saved"]);
  events.length = 0;
  assert.equal((await handleTelegramWebhook(request(), dependencies, secret)).status, 200);
  assert.deepEqual(events, ["prepare"]);
});
test("upload failure asks Telegram to retry and never acknowledges missing evidence", async () => {
  const { dependencies, events } = fixture();
  dependencies.upload = async () => { throw new Error("provider-url-with-secret"); };
  const response = await handleTelegramWebhook(request(), dependencies, secret);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("provider-url-with-secret"));
  assert.deepEqual(events, ["prepare", "download", "release"]);
});
test("reply failure retries the reply without re-saving media", async () => {
  const { dependencies, events } = fixture();
  const reply = dependencies.sendReply;
  dependencies.sendReply = async () => { throw new Error("network down"); };
  assert.equal((await handleTelegramWebhook(request(), dependencies, secret)).status, 503);
  events.length = 0;
  dependencies.sendReply = reply;
  assert.equal((await handleTelegramWebhook(request(), dependencies, secret)).status, 200);
  assert.deepEqual(events, ["prepare", "reply", "reply-saved"]);
});
test("busy and malformed requests cause no evidence writes", async () => {
  const { dependencies, events } = fixture();
  dependencies.prepare = async () => ({ busy: true });
  assert.equal((await handleTelegramWebhook(request(), dependencies, secret)).status, 503);
  const invalid = new Request("http://localhost", { method: "POST", body: "{",
    headers: { "X-Telegram-Bot-Api-Secret-Token": secret } });
  assert.equal((await handleTelegramWebhook(invalid, dependencies, secret)).status, 400);
  assert.equal((await handleTelegramWebhook(request({ padding: "x".repeat(65536) }), dependencies, secret)).status, 413);
  assert.deepEqual(events, []);
});
test("Telegram download blocks unexpected paths and bounds streamed bytes", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ ok: true, result: { file_path: "../secret" } }); };
    await assert.rejects(downloadTelegramFile("id", 2), /Telegram is temporarily unavailable/);
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async () => ++calls === 1
      ? Response.json({ ok: true, result: { file_path: "voice/file.ogg" } })
      : new Response(new Uint8Array([1, 2, 3]));
    await assert.rejects(downloadTelegramFile("id", 2), /Telegram is temporarily unavailable/);
  } finally { globalThis.fetch = originalFetch; if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken; }
});
test("existing evidence is never overwritten; other upload errors remain retryable", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:55421";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)["x-upsert"], "false");
      assert.equal((init?.headers as Record<string, string>).Authorization, undefined);
      return Response.json({ error: "Duplicate", statusCode: "409" }, { status: 400 });
    };
    await uploadEvidence("project/submission/1.ogg", new Uint8Array([1]), "audio/ogg");
    globalThis.fetch = async () => Response.json({ error: "InvalidJwt" }, { status: 401 });
    await assert.rejects(uploadEvidence("project/submission/1.ogg", new Uint8Array([1]), "audio/ogg"), /storage is temporarily unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
