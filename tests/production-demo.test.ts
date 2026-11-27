import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoBoq, demoNote2Report, demoReport, demoLog, demoTeam, demoTodayNotes, demoVersions } from "../lib/data/demo-documents";
import { costReport } from "../lib/costing/cost-report";
import { decimal } from "../lib/costing/decimal";
test("static public demonstration contains only the original fictional seed", () => {
  assert.equal(demoReport.id, "40000000-0000-4000-8000-000000000004");
  assert.equal(demoReport.status, "locked"); assert.equal(demoReport.document.source.project.is_demo, true);
  // The locked report carries its three photos, each with a timestamp —
  // the same photos the demo Today note shows, never real evidence.
  assert.equal(demoReport.document.source.photos.length, 3);
  for (const photo of demoReport.document.source.photos) {
    assert.ok(photo.storage_url.startsWith("/demo/photos/"));
    assert.ok(photo.captured_at && photo.captured_at.startsWith("2026-11-06T"));
  }
  assert.equal(demoReport.document.source.guest_origin, undefined);
  assert.equal(demoLog.is_demo, true);
  assert.ok(demoLog.entries.every(entry => /^40000000-0000-4000-8000-0000000000(0[1-9]|1[0-2])$/.test(entry.report_id)));
});
test("the demo Today has three notes in the three states", () => {
  // The demo is the mock: Today shows work as if done today — two
  // checked and costed (one of them locked), the third not yet costed.
  // Each note has a timestamp, a photo with its timestamp, and playable
  // demo audio.
  assert.equal(demoTodayNotes.length, 3);
  const [locked, costed, draft] = demoTodayNotes;
  assert.equal(locked.state, "locked"); assert.equal(locked.total_cost, "1495300");
  assert.equal(locked.id, demoReport.document.source.submission_id);
  assert.equal(costed.state, "costed"); assert.equal(costed.total_cost, "551000");
  assert.equal(draft.state, "draft"); assert.equal(draft.total_cost, null);
  for (const note of demoTodayNotes) {
    assert.ok(note.captured_at.startsWith("2026-11-06T"));
    assert.ok(note.audio_url.startsWith("/demo/audio/") && note.audio_url.endsWith(".mp3"));
    assert.ok(note.photos.length >= 2);
    for (const photo of note.photos) {
      assert.ok(photo.storage_url.startsWith("/demo/photos/"));
      assert.ok(photo.captured_at.startsWith("2026-11-06T"));
    }
  }
  const dayTotal = demoTodayNotes.reduce((sum, note) => note.total_cost ? sum.plus(decimal(note.total_cost, "demo day total")) : sum, decimal("0", "day total"));
  assert.equal(dayTotal.toFixed(), "2046300");
  // The costed draft's costing reproduces from the frozen BoQ rates.
  assert.equal(costReport(costed.items.map(item => ({ ...item, confirmed_by: "Engr. Tola Adeyemi (demo PM)" })), demoReport.document.source.price_list).total_cost, "551000");
  // The locked view of the costed draft is a real locked report.
  assert.equal(demoNote2Report.status, "locked");
  assert.equal(demoNote2Report.document.costing.total_cost, "551000");
  // The demo BoQ is version 1 with all 16 items, and the demo team has
  // its four members with roles.
  assert.equal(demoVersions.length, 1);
  assert.equal(demoVersions[0].version, 1);
  assert.equal(demoVersions[0].items, 16);
  assert.equal(demoVersions[0].rows.length, 16);
  assert.ok(demoVersions[0].created_at?.startsWith("2026-11-27T"));
  assert.equal(demoTeam.length, 4);
  assert.ok(demoTeam.some(member => member.role === "Foreman"));
  assert.ok(demoTeam.some(member => member.role === "PM/QS"));
  assert.ok(demoTeam.some(member => member.role === "Client"));
  assert.ok(demoTeam.some(member => member.status === "pending"));
  // The demo BoQ allocation is the contract sum — no invented figures.
  const allocation = demoBoq.reduce((sum, row) => sum + row.rate * row.boq_quantity, 0);
  assert.equal(allocation, 52328000);
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
