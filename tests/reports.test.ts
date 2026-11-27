import { secretHash } from "../lib/auth/session";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDocument, reportFromInput, displayProductivity, truncateAtWord, ReportStateError, type ReportSource, type ReportInput } from "../lib/reports/model";
import { POST } from "../app/api/reports/[id]/route";

const id = "70000000-0000-4000-8000-000000000071", secret = "test-report-secret";
const source: ReportSource = {
  submission_id: id, date: "2026-11-18", status: "confirmed", submitted_by: "Demo foreman",
  confirmed_by: "Demo PM", confirmed_at: "2026-11-18T16:00:00+01:00", pending_media: false, processing: false,
  project: { id: "10000000-0000-4000-8000-000000000001", name: "4-Bedroom Duplex, Lekki Phase 1, Lagos", client: "Fictional demo client", location: "Lekki, Lagos", is_demo: true },
  items: [{ boq_item_id: "blockwork", description: "Blockwork — East elevation", quantity_done: "18", crew: 6, unit: "m2", confidence: "1", confirmed_by: "Demo PM" },
    { boq_item_id: "concrete", description: "Columns and beams", quantity_done: "2", crew: 4, unit: "m3", confidence: "1", confirmed_by: "Demo PM" }],
  price_list: [{ id: "blockwork", description: "Sandcrete blocks 225mm hollow, laid", section: "Blockwork", item_code: "BLK-01", unit: "m2", boq_quantity: "420", rate: "14500", cumulative_locked_quantity: "168" },
    { id: "concrete", description: "In-situ concrete, columns and beams", section: "Concrete", item_code: "CON-01", unit: "m3", boq_quantity: "35", rate: "145000", cumulative_locked_quantity: "14" }],
  materials: [{ name: "Cement", quantity: 40, unit: "bags", action: "delivered", confidence: 1 }],
  delays: [{ reason: "Rain stopped external work", hours: 2, confidence: 1 }], issues: ["Check curing"], photos: [],
};
function stored(input = source): ReportInput {
  const document = buildDocument(input, "Rain, 2 hrs");
  return { source: input, report: { id: "80000000-0000-4000-8000-000000000071", status: "draft", weather: document.weather,
    total_cost: document.costing.total_cost, approved_by: null, locked_at: null, document } };
}
test("report costs confirmed work using BoQ and preserves materials, delays and the chosen firm", () => {
  const document = buildDocument(source, null);
  assert.equal(document.costing.total_cost, "551000");
  assert.equal(document.firm_name, "Perkins Limited");
  assert.equal(document.currency, "NGN");
  assert.equal(document.weather, null);
  assert.deepEqual(document.source.materials, source.materials);
  assert.deepEqual(document.source.delays, source.delays);
});
test("unconfirmed, unfinished and pending-media inputs never produce a report", () => {
  for (const change of [{ status: "received" }, { status: "extracted" }, { confirmed_by: null }, { confirmed_at: null }, { processing: true }, { pending_media: true }]) {
    assert.throws(() => buildDocument({ ...source, ...change }, null), ReportStateError);
  }
});
test("existing locked snapshots remain unchanged when current prices or metadata change", () => {
  const input = stored(), before = JSON.stringify(input.report!.document);
  input.report!.status = "locked";
  input.report!.approved_by = "Demo PM";
  input.report!.locked_at = "2026-11-18T17:00:00+01:00";
  input.source = { ...source, project: { ...source.project, name: "Changed project name" }, price_list: source.price_list.map(price => ({ ...price, rate: "145000" })) };
  const view = reportFromInput(input)!;
  assert.equal(view.document.costing.total_cost, "551000");
  assert.equal(view.document.source.project.name, source.project.name);
  assert.equal(JSON.stringify(view.document), before);
  assert.equal(view.stale, false);
});
test("drafts become stale after confirmation, rates or photo observations change", () => {
  for (const change of [
    { confirmed_at: "2026-11-18T17:00:00+01:00" },
    { price_list: source.price_list.map(price => ({ ...price, rate: "145000" })) },
    { photos: [{ id, storage_url: "site-evidence/test.jpg", note: "Updated observation" }] },
  ]) { const input = stored(); input.source = { ...source, ...change }; assert.equal(reportFromInput(input)!.stale, true); }
});
test("legacy locked reports use captured rates and verify stored money with exact decimals", () => {
  const input = stored(); input.report!.document = null; input.report!.status = "locked";
  assert.equal(reportFromInput(input)!.document.costing.total_cost, "551000");
  const large = stored({ ...source, items: [{ ...source.items[0], quantity_done: "9999999999.9999" }] });
  large.report!.total_cost = "144999999999998.56";
  assert.throws(() => reportFromInput(large), ReportStateError);
});
test("a missing report remains an empty state without inventing a draft or approval", () => {
  assert.equal(reportFromInput({ source, report: null }), null);
  assert.equal(stored().report!.approved_by, null);
});
test("small nonzero crew productivity is displayed without rounding it to zero", () => {
  assert.equal(displayProductivity("0.016666666666666666666666666667"), "0.0167");
  assert.notEqual(displayProductivity("0.0000000001"), "0");
});
test("report API gates access, rejects caller money, blocks unfinished work, and saves server-derived costing", async () => {
  const names = ["SITELEDGER_APP_URL", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const savedEnv = names.map(name => process.env[name]), originalFetch = globalThis.fetch;
  process.env.SITELEDGER_APP_URL = "https://siteledger.test"; process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test"; process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  let input: ReportInput | null = { source, report: null };
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options?.body as string);
    if (String(url).endsWith("account_record_access")) return Response.json(input ? {role:"pm",professional_name:"Demo PM"} : null);
    if (String(url).endsWith("account_report_input")) { assert.equal(body.p_hash, secretHash(token)); return Response.json(input); }
    assert.ok(String(url).endsWith("account_save_draft")); saves.push(body); return Response.json("80000000-0000-4000-8000-000000000071");
  };
  const token = "a".repeat(43);
  const request = (body: unknown = { weather: "  Rain  " }, access = token, origin = "https://siteledger.test") => new Request(`https://siteledger.test/api/reports/${id}`, {
    method: "POST", headers: { Origin: origin, Cookie: `siteledger_session=${access}` }, body: JSON.stringify(body),
  });
  const context = { params: Promise.resolve({ id }) };
  try {
    assert.equal((await POST(request(undefined, token, "https://elsewhere.test"), context)).status, 403);
    assert.equal((await POST(request(undefined, "bad-token"), context)).status, 401);
    assert.equal((await POST(request({ weather: null, total_cost: "0" }), context)).status, 422);
    assert.equal((await POST(request({ weather: "x".repeat(501) }), context)).status, 422);
    input = { source: { ...source, status: "extracted" }, report: null };
    assert.equal((await POST(request(), context)).status, 409);
    input = { source: { ...source, pending_media: true }, report: null };
    assert.equal((await POST(request(), context)).status, 409);
    input = stored(); input.report!.status = "locked";
    assert.equal((await POST(request(), context)).status, 409);
    input = null;
    assert.equal((await POST(request(), context)).status, 404);
    assert.equal(saves.length, 0);
    input = { source, report: null };
    const result = await POST(request(), context);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).status, "draft");
    const document = saves[0].p_document as ReturnType<typeof buildDocument>;
    assert.equal(document.weather, "Rain");
    assert.equal(document.costing.total_cost, "551000");
    assert.deepEqual(saves[0].p_source, source);
    assert.equal(document.source.confirmed_by, "Demo PM");
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    input = stored();
    assert.equal((await POST(request({}), context)).status, 200);
    assert.equal((saves[1].p_document as ReturnType<typeof buildDocument>).weather, "Rain, 2 hrs");
  } finally { globalThis.fetch = originalFetch; names.forEach((name,i) => { if (savedEnv[i] === undefined) delete process.env[name]; else process.env[name] = savedEnv[i]; }); }
});
test("display text shortens at a word boundary, never mid-word", () => {
  assert.equal(truncateAtWord("Blockwork on the east elevation", 20), "Blockwork on the…");
  assert.equal(truncateAtWord("eighteen square metres of blockwork", 18), "eighteen square…");
  assert.equal(truncateAtWord("Short text", 20), "Short text");
  assert.equal(truncateAtWord("Blockwork", 5), "Block…");
});
