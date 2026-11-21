import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../lib/costing/format-money";
import { displayDate, displayTimestamp, lockDate, buildDocument, type ReportSource } from "../lib/reports/model";
test("currency display preserves large decimals and uses each recorded currency's precision", () => {
  assert.equal(formatMoney("9007199254740993.125", "KWD"), "KWD 9,007,199,254,740,993.125");
  assert.equal(formatMoney("0.0151782", "KWD"), "KWD 0.015");
  assert.equal(formatMoney("1025.4", "JPY"), "¥1,025");
  assert.equal(formatMoney("261003", "NGN"), "₦261,000");
  assert.throws(()=>formatMoney("1", "FAKE"));
});
test("site dates remain calendar dates and lock timestamps use the snapshotted timezone", () => {
  assert.equal(displayDate("2026-11-21"), "21 November 2026");
  const source: ReportSource = {submission_id:"fixture",date:"2026-11-21",status:"confirmed",submitted_by:"PM",confirmed_by:"PM",confirmed_at:"2026-11-21T12:00:00Z",pending_media:false,processing:false,project:{id:"fixture",name:"Fixture",client:"Fixture",location:"Fixture",is_demo:false,currency:"JPY",timezone:"America/Los_Angeles"},items:[],price_list:[],materials:[],delays:[],issues:[],photos:[]};
  assert.equal(lockDate({id:"fixture",status:"locked",approved_by:"PM",locked_at:"2026-11-21T02:30:00Z",stale:false,document:buildDocument(source,null)}), "2026-11-20");
  assert.ok(displayTimestamp("2026-11-21T02:30:00Z", "America/Los_Angeles").includes("20 Nov"));
});
