import test from "node:test";
import assert from "node:assert/strict";
import { projectDashboard, type DashboardInput } from "../lib/projects/dashboard";
import { validBoqEdit } from "../lib/projects/boq-types";
import { boqApi } from "../lib/projects/boq-api";
import { formatMoney } from "../lib/costing/format-money";
import { intakeDependencies } from "../lib/telegram/webhook";
import { buildDocument, type ReportSource } from "../lib/reports/model";
const id = "88000000-0000-4000-8000-000000000001";
const edit = { id, revision: null, item_code: "BLK", section: "Blockwork", description: "Supplied blockwork", unit: "m2", boq_quantity: "420", rate: "14500" };
const source = (): DashboardInput => ({ project: { id, name: "Disposable", client: "Fixture", location: "Lagos", contract_sum: "1000000", is_demo: false }, access: { role: "pm", owner: true, currency: "NGN", timezone: "Africa/Lagos", archived_at: null, professional_name: "Confirmed PM" }, as_of: "2026-11-22T09:00:00Z", boq: [{ ...edit, unit: "m2", revision: "a".repeat(32), used: true }], locked_count: 1, draft_count: 1, locked_items: [{ id: "snapshot-1", boq_item_id: id, quantity: "18", unit: "m2", rate: "14500", confirmed_by: "Confirmed Person", currency: "NGN" }] });
test("dashboard matches confirmed BoQ costing and excludes drafts", () => {
  const data = projectDashboard(source()); assert.equal(data.earned, "261000"); assert.equal(data.rows[0].progress.cumulative_quantity, "18"); assert.equal(data.rows[0].progress.percentage_complete.slice(0, 7), "4.28571"); assert.equal(data.flagged, 0); assert.equal(data.draft_count, 1);
});
test("editing current rates never reprices the dashboard's locked value", () => {
  const input = source(); input.boq[0].rate = "11800"; input.locked_items.push({ ...input.locked_items[0], id: "snapshot-2", quantity: "2", rate: "11800" });
  const data = projectDashboard(input); assert.equal(data.earned, "284600"); assert.equal(data.rows[0].recorded_value, "284600"); assert.equal(data.rows[0].progress.cumulative_quantity, "20"); assert.equal(input.locked_items[0].rate, "14500");
});
test("quantity overruns stay visible beyond 100 percent and empty BoQs remain empty", () => {
  const input = source(); input.boq[0].boq_quantity = "2"; const data = projectDashboard(input); assert.equal(data.rows[0].progress.percentage_complete, "900"); assert.equal(data.flagged, 1); assert.equal(data.rows[0].progress.variance_color, "red");
  input.boq = []; input.locked_items = []; assert.equal(projectDashboard(input).earned, "0"); assert.deepEqual(projectDashboard(input).rows, []);
});
test("foreign supplied costs retain exact decimals and reject mixed recorded currencies", () => {
  const input = source(); input.access.currency = "KWD"; input.boq[0].rate = "0.123"; input.locked_items[0] = { ...input.locked_items[0], currency: "KWD", rate: "0.123", quantity: "0.1234" }; const data = projectDashboard(input); assert.equal(data.earned, "0.0151782"); assert.equal(formatMoney(data.earned, "KWD"), "KWD 0.015");
  input.locked_items[0].currency = "NGN"; assert.throws(() => projectDashboard(input), /currencies/);
});
test("BoQ edits accept supplied decimal strings and deny rounded quantities or identity injection", () => {
  assert.equal(validBoqEdit(edit), true); for (const change of [{ rate: "-1" }, { rate: 14500 }, { boq_quantity: "0" }, { boq_quantity: "1.00001" }, { unit: "bags" }, { revision: "invalid" }, { description: "\u202eHidden" }, { owner: true }]) assert.equal(validBoqEdit({ ...edit, ...change }), false);
  assert.equal(validBoqEdit({ ...edit, rate: "0.123", boq_quantity: "0.1234" }), true);
});
process.env.SITELEDGER_APP_URL = "https://siteledger.example.test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
const request = (input: unknown, origin = process.env.SITELEDGER_APP_URL!) => new Request("https://siteledger.example.test/api/projects/boq", { method: "POST", headers: { Origin: origin, Cookie: "siteledger_session=" + "s".repeat(43), "Content-Type": "application/json" }, body: JSON.stringify(input) });
test("BoQ API denies cross-origin or caller-supplied permissions before any network call", async () => {
  assert.equal((await boqApi(request({ project_id: id, item: edit }, "https://other.example.test"))).status, 403);
  assert.equal((await boqApi(request({ project_id: id, item: edit, role: "pm" }))).status, 422);
});
test("BoQ API uses server-derived authentication and reports stale/access failures", async context => {
  let failure: string | null = "stale";
  context.mock.method(globalThis, "fetch", async (url: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(url)).pathname; if (path.endsWith("account_session")) return Response.json({ profile_id: id }); if (path.endsWith("account_limit")) return Response.json(true);
    assert.ok(path.endsWith("account_boq_save")); const body = JSON.parse(String(init?.body)); assert.equal(body.p_project, id); assert.equal(body.p_hash.length, 64); assert.deepEqual(body.p_item, edit); return Response.json(failure ? { error: failure } : null);
  });
  assert.equal((await boqApi(request({ project_id: id, item: edit }))).status, 409); failure = "archived"; assert.equal((await boqApi(request({ project_id: id, item: edit }))).status, 409); failure = null; assert.equal((await boqApi(request({ project_id: id, item: edit }))).status, 404);
});
test("Telegram summaries use the locked report currency and exact recorded cost", async context => {
  const source: ReportSource = { submission_id: id, date: "2026-11-22", status: "locked", project: { id, name: "Foreign fixture", client: "Fixture", location: "Kuwait", is_demo: false, currency: "KWD", timezone: "Asia/Kuwait" }, submitted_by: "Confirmed PM", confirmed_by: "Confirmed PM", confirmed_at: "2026-11-22T09:00:00Z", pending_media: false, processing: false,
    items: [{ boq_item_id: id, quantity_done: "0.1234", unit: "m2", confirmed_by: "Confirmed PM", description: "Supplied fixture", confidence: "1" }], price_list: [{ id, item_code: "DECIMAL", section: "Fixture", description: "Supplied fixture", unit: "m2", boq_quantity: "1", rate: "0.123", cumulative_locked_quantity: "0" }], materials: [], delays: [], issues: [], photos: [] };
  const document = buildDocument(source, null);
  context.mock.method(globalThis, "fetch", async () => Response.json({ project_name: "Foreign fixture", currency: "KWD", note_id: id, input: { source, report: { id, status: "locked", total_cost: document.costing.total_cost, document, approved_by: "Confirmed PM", locked_at: source.confirmed_at } } }));
  const result = await intakeDependencies.todaySummary!({ user_id: 42 } as Parameters<NonNullable<typeof intakeDependencies.todaySummary>>[0]);
  assert.ok(result?.text.includes("KWD 0.015 KWD")); assert.equal(result?.text.includes("₦"), false);
});
