import { secretHash } from "../lib/auth/session";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDocument, lockDate, reportFromInput, type ReportInput, type ReportSource } from "../lib/reports/model";
import { reportVersion, getDisputeLog } from "../lib/log/data";
import { POST as approve } from "../app/api/reports/[id]/approve/route";
import { POST as amend } from "../app/api/reports/[id]/amendments/route";

const id = "70000000-0000-4000-8000-000000000080", secret = "test-log-secret";
const source: ReportSource = { submission_id: id, date: "2026-11-18", status: "confirmed", submitted_by: "Local QA foreman",
  confirmed_by: "Local QA foreman", confirmed_at: "2026-11-18T16:00:00+01:00", pending_media: false, processing: false,
  project: { id, name: "Local log QA", client: "Fictional test", location: "Lagos", is_demo: false },
  items: [{ boq_item_id: id, description: "Blockwork", quantity_done: "18", unit: "m2", crew: 6, confirmed_by: "Local QA foreman", confidence: "1" }],
  price_list: [{ id, description: "225mm sandcrete blockwork", section: "Blockwork", item_code: "BLK-01", unit: "m2", rate: "14500", boq_quantity: "420", cumulative_locked_quantity: "0" }],
  materials: [], delays: [], issues: [], photos: [] };
const makeInput = (): ReportInput => ({ source: structuredClone(source), report: { id, status: "draft", approved_by: null, locked_at: null,
  document: buildDocument(structuredClone(source), null), total_cost: "261000", weather: null } });

test("approval versions identify the reviewed document and lock stamps use WAT dates", () => {
  const first = reportFromInput(makeInput())!;
  const second = structuredClone(first); second.document.weather = "Rain";
  assert.notEqual(reportVersion(first), reportVersion(second));
  assert.equal(reportVersion(first), reportVersion(structuredClone(first)));
  first.locked_at = "2026-11-18T23:35:00Z";
  assert.equal(lockDate(first), "2026-11-19");
});

test("approval API enforces PM identity, reviewed versions, payload limits and durable locked retries", async () => {
  const names = ["SITELEDGER_APP_URL", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const env = names.map(name => process.env[name]), fetch = globalThis.fetch;
  process.env.SITELEDGER_APP_URL = "https://siteledger.test"; process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test"; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  let input: ReportInput | null = makeInput(), role: "foreman" | "pm" = "pm", rpcError: string | null = null;
  const approvals: Record<string, unknown>[] = [];
  const version = reportVersion(reportFromInput(input)!);
  const token = "a".repeat(43);
  const request = (body: unknown = { document_version: version }, access = token, origin = "https://siteledger.test") => new Request(`https://siteledger.test/api/reports/${id}/approve`,
    { method: "POST", headers: { Origin: origin, Cookie: `siteledger_session=${access}` }, body: JSON.stringify(body) });
  globalThis.fetch = async (url, options) => {
    const parameters = JSON.parse(options?.body as string);
    assert.equal(parameters.p_hash, secretHash(token));
    if (String(url).endsWith("account_report_input")) return Response.json(input);
    if (String(url).endsWith("account_record_access")) return Response.json(input ? { professional_name: "Local QA PM", role } : null);
    assert.ok(String(url).endsWith("account_approve")); approvals.push(parameters);
    if (rpcError) return Response.json({ error: rpcError });
    return Response.json({ id, status: "locked", approved_by: "Local QA PM", locked_at: "2026-11-19T01:00:00Z" });
  };
  const context = { params: Promise.resolve({ id }) };
  try {
    assert.equal((await approve(request(undefined, token, "https://elsewhere.test"), context)).status, 403);
    assert.equal((await approve(request(undefined, "bad-token"), context)).status, 401);
    assert.equal((await approve(request({ document_version: version, approved_by: "Forged PM" }), context)).status, 422);
    assert.equal((await approve(request({ document_version: "bad" }), context)).status, 422);
    role = "foreman"; assert.equal((await approve(request(), context)).status, 403); role = "pm";
    input = null; assert.equal((await approve(request(), context)).status, 404);
    input = makeInput(); input.report = null; assert.equal((await approve(request(), context)).status, 409);
    input = makeInput(); input.source.pending_media = true; assert.equal((await approve(request(), context)).status, 409);
    input = makeInput(); input.report!.document!.weather = "Changed after review"; assert.equal((await approve(request(), context)).status, 409);
    assert.equal(approvals.length, 0);
    input = makeInput(); rpcError = "stale"; assert.equal((await approve(request(), context)).status, 409);
    rpcError = null;
    const result = await approve(request(), context);
    assert.equal(result.status, 200); assert.equal((await result.json()).approved_by, "Local QA PM");
    assert.deepEqual(approvals.at(-1)!.p_document, input.report!.document);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    input.report!.status = "locked"; input.report!.approved_by = "Local QA PM"; input.report!.locked_at = "2026-11-19T01:00:00Z";
    assert.equal((await approve(request(), context)).status, 200);
    assert.equal((await approve(request(), context)).status, 200);
  } finally { globalThis.fetch = fetch; names.forEach((name,i) => { if (env[i] === undefined) delete process.env[name]; else process.env[name] = env[i]; }); }
});

test("amendment API accepts only locked, authorized, bounded notes with a retry identifier", async () => {
  const names = ["SITELEDGER_APP_URL", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const env = names.map(name => process.env[name]), fetch = globalThis.fetch;
  process.env.SITELEDGER_APP_URL = "https://siteledger.test"; process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test"; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  let input: ReportInput | null = makeInput();
  const calls: Record<string, unknown>[] = [], token = "a".repeat(43);
  const requestId = "80000000-0000-4000-8000-000000000080";
  const request = (body: unknown = { note: "  Correction recorded after inspection.  ", request_id: requestId }, access = token) => new Request(`https://siteledger.test/api/reports/${id}/amendments`,
    { method: "POST", headers: { Origin: "https://siteledger.test", Cookie: `siteledger_session=${access}` }, body: JSON.stringify(body) });
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("account_record_access")) return Response.json(input ? {professional_name:"Local QA PM",role:"pm"}:null);
    if (String(url).endsWith("account_report_input")) return Response.json(input);
    assert.ok(String(url).endsWith("account_amend"));
    const parameters = JSON.parse(options?.body as string); calls.push(parameters);
    return Response.json({ id: requestId, report_id: id, author: "Local QA PM", note: parameters.p_note, created_at: "2026-11-19T01:20:00Z" });
  };
  const context = { params: Promise.resolve({ id }) };
  try {
    assert.equal((await amend(request(undefined, "bad-token"), context)).status, 401);
    assert.equal((await amend(request({ note: "x", request_id: requestId, author: "Forged author" }), context)).status, 422);
    assert.equal((await amend(request({ note: " ", request_id: requestId }), context)).status, 422);
    assert.equal((await amend(request({ note: "x".repeat(5001), request_id: requestId }), context)).status, 422);
    assert.equal((await amend(request({ note: "x", request_id: "invalid" }), context)).status, 422);
    assert.equal((await amend(request(), context)).status, 409);
    input = null; assert.equal((await amend(request(), context)).status, 404);
    input = makeInput(); input.report!.status = "locked";
    const result = await amend(request(), context); assert.equal(result.status, 200);
    assert.equal((await result.json()).author, "Local QA PM");
    assert.equal(calls[0].p_note, "Correction recorded after inspection.");
    assert.equal(calls[0].p_request_id, requestId);
    assert.equal(calls[0].p_hash, secretHash(token));
    assert.equal((await amend(request(), context)).status, 200);
    assert.equal(calls[1].p_request_id, calls[0].p_request_id);
    assert.equal(input.report!.document!.costing.total_cost, "261000");
  } finally { globalThis.fetch = fetch; names.forEach((name,i) => { if (env[i] === undefined) delete process.env[name]; else process.env[name] = env[i]; }); }
});

test("private log links carry no login capability and unauthorized logs are not read", async () => {
  const names = ["TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const env = names.map(name => process.env[name]), fetch = globalThis.fetch;
  process.env.TELEGRAM_WEBHOOK_SECRET = secret; process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test"; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  const childId = "70000000-0000-4000-8000-000000000081", token = secretHash("a".repeat(43));
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ project: { id, name: "Local QA" }, is_demo: false,
    entries: [{ kind: "report", id, report_id: id, submission_id: childId, author: "Local QA PM", timestamp: "2026-11-19T01:00:00Z", date: "2026-11-18", total_cost: "261000", currency: "NGN" }] }); };
  try {
    assert.equal(await getDisputeLog(id, "bad-token"), null); assert.equal(calls, 0);
    const log = await getDisputeLog(id, token); assert.ok(log);
    const child = new URL(log.entries[0].href!, "https://siteledger.test");
    assert.equal(child.pathname, `/reports/${childId}`); assert.equal(child.search, "");
  } finally { globalThis.fetch = fetch; names.forEach((name,i) => { if (env[i] === undefined) delete process.env[name]; else process.env[name] = env[i]; }); }
});
