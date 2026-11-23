import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoReport, demoLog } from "../lib/data/demo-documents";
import { costReport } from "../lib/costing/cost-report";
test("static public demonstration contains only the original fictional seed", () => {
  assert.equal(demoReport.id, "40000000-0000-4000-8000-000000000004");
  assert.equal(demoReport.status, "locked"); assert.equal(demoReport.document.source.project.is_demo, true);
  assert.deepEqual(demoReport.document.source.photos, []); assert.equal(demoReport.document.source.guest_origin, undefined);
  assert.equal(demoLog.is_demo, true);
  assert.ok(demoLog.entries.every(entry => /^40000000-0000-4000-8000-0000000000(0[1-9]|1[0-2])$/.test(entry.report_id)));
});
test("prebuilt public money remains reproducible from confirmed seed quantities and frozen rates", () => {
  const doc = demoReport.document;
  assert.equal(costReport(doc.source.items, doc.source.price_list).total_cost, doc.costing.total_cost);
  assert.equal(doc.currency, "NGN"); assert.equal(doc.costing.total_cost, "1495300");
});
test("public sample PDF is a bounded static document", () => {
  const pdf = readFileSync("public/demo/siteledger-demo.pdf");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF"); assert.ok(pdf.length < 4500000);
});
