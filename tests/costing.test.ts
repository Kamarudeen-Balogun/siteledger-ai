import assert from "node:assert/strict";
import { test } from "node:test";
import { costReport, CostingValidationError } from "../lib/costing/cost-report";
import { formatNaira, roundNairaForDisplay } from "../lib/costing/format-naira";
import type { BoqPrice, ConfirmedCostItem } from "../lib/costing/types";

// Rates and BoQ quantities come from section 10 and supabase/seed/demo.sql.
const blockwork: BoqPrice = {
  id: "20000000-0000-4000-8000-000000000006", unit: "m2",
  boq_quantity: "420", rate: "14500", cumulative_locked_quantity: "168",
};
const concrete: BoqPrice = {
  id: "20000000-0000-4000-8000-000000000004", unit: "m3",
  boq_quantity: "35", rate: "145000", cumulative_locked_quantity: "14",
};
const excavation: BoqPrice = {
  id: "20000000-0000-4000-8000-000000000001", unit: "m3",
  boq_quantity: "110", rate: "8500", cumulative_locked_quantity: "112",
};
const reinforcement: BoqPrice = {
  id: "20000000-0000-4000-8000-000000000005", unit: "tonne",
  boq_quantity: "4.5", rate: "1450000", cumulative_locked_quantity: "1.7",
};
function confirmed(boq: BoqPrice, quantity_done: ConfirmedCostItem["quantity_done"] = "18", crew: number | null = 6): ConfirmedCostItem {
  return { boq_item_id: boq.id, quantity_done, unit: boq.unit, crew, confirmed_by: "Musa Bello (demo foreman)" };
}
function rejects(items: unknown, priceList: unknown) {
  assert.throws(() => costReport(items as ConfirmedCostItem[], priceList as BoqPrice[]), CostingValidationError);
}

test("demo day costs only human-confirmed quantities at the selected BoQ rates", () => {
  const result = costReport([confirmed(blockwork), confirmed(concrete, 2, 4)], [blockwork, concrete]);
  assert.equal(result.items[0].cost_today, "261000");
  assert.equal(result.items[1].cost_today, "290000");
  assert.equal(result.total_cost, "551000");
  assert.equal(result.items[0].rate, "14500");
});

test("cumulative quantity adds locked history and today's quantity exactly once", () => {
  const item = costReport([confirmed(blockwork)], [blockwork]).items[0];
  assert.equal(item.cumulative_quantity, "186");
  assert.ok(Math.abs(Number(item.percentage_complete) - 186 / 420 * 100) < 1e-12);
  assert.equal(item.value_earned, "2697000");
});

test("zero and full completion follow the section 10 formulas without capping overruns", () => {
  const fresh = { ...blockwork, cumulative_locked_quantity: "0" };
  const zero = costReport([confirmed(fresh, 0)], [fresh]).items[0];
  assert.equal(zero.cost_today, "0");
  assert.equal(zero.percentage_complete, "0");
  assert.equal(zero.value_earned, "0");
  const complete = costReport([confirmed(fresh, 420)], [fresh]).items[0];
  assert.equal(complete.percentage_complete, "100");
  assert.equal(complete.is_overrun, false);
  assert.equal(complete.variance_color, null);
});

test("quantity above BoQ is flagged red, including an overrun already in locked history", () => {
  const item = costReport([confirmed(excavation, 0, null)], [excavation]).items[0];
  assert.equal(item.cumulative_quantity, "112");
  assert.ok(Number(item.percentage_complete) > 100);
  assert.equal(item.is_overrun, true);
  assert.equal(item.variance_color, "red");
  assert.equal(item.variance_percentage_points, null);
  assert.equal(item.value_earned, "952000");
});

test("variance subtracts the plan for the report date; negative variance is red", () => {
  const price = { ...blockwork, boq_quantity: "100", cumulative_locked_quantity: "22", planned_percentage: "50" };
  const item = costReport([confirmed(price)], [price]).items[0];
  assert.equal(item.percentage_complete, "40");
  assert.equal(item.variance_percentage_points, "-10");
  assert.equal(item.is_behind_plan, true);
  assert.equal(item.is_overrun, false);
  assert.equal(item.variance_color, "red");
});

test("zero plan is a real plan; ahead/on-plan work is not flagged red", () => {
  const price = { ...blockwork, boq_quantity: "100", cumulative_locked_quantity: "22" };
  for (const [plan, variance] of [[0, "40"], [30, "10"], [40, "0"]] as const) {
    const item = costReport([confirmed(price)], [{ ...price, planned_percentage: plan }]).items[0];
    assert.equal(item.variance_percentage_points, variance);
    assert.equal(item.variance_color, null);
  }
});

test("a plan does not hide a quantity overrun", () => {
  const price = { ...excavation, boq_quantity: "100", planned_percentage: "90" };
  const item = costReport([confirmed(price, 0)], [price]).items[0];
  assert.equal(item.variance_percentage_points, "22");
  assert.equal(item.is_overrun, true);
  assert.equal(item.variance_color, "red");
});

test("productivity is the day's quantity per person; absent crew stays absent", () => {
  const result = costReport([confirmed(blockwork), confirmed(concrete, 2, 4)], [blockwork, concrete]);
  assert.equal(result.items[0].productivity, "3");
  assert.equal(result.items[0].unit, "m2");
  assert.equal(result.items[1].productivity, "0.5");
  assert.equal(costReport([confirmed(blockwork, 18, null)], [blockwork]).items[0].productivity, null);
  assert.equal(costReport([confirmed(blockwork, 0)], [blockwork]).items[0].productivity, "0");
});

test("repeated BoQ lines share cumulative progress but retain each line's crew and cost", () => {
  const result = costReport([confirmed(blockwork, 10, 5), confirmed(blockwork, 8, 4)], [blockwork]);
  assert.equal(result.total_cost, "261000");
  assert.deepEqual(result.items.map(item => item.cost_today), ["145000", "116000"]);
  assert.deepEqual(result.items.map(item => item.cumulative_quantity), ["186", "186"]);
  assert.deepEqual(result.items.map(item => item.productivity), ["2", "2"]);
});

test("decimal quantities, costs and sums do not acquire binary floating-point errors", () => {
  const fresh = { ...blockwork, cumulative_locked_quantity: "0.0001" };
  const result = costReport([confirmed(fresh, "0.0001"), confirmed(fresh, "0.0002")], [fresh]);
  assert.equal(result.total_cost, "4.35");
  assert.equal(result.items[0].cumulative_quantity, "0.0004");
  assert.deepEqual(result.items.map(item => item.cost_today), ["1.45", "2.9"]);
  assert.equal(result.items[0].value_earned, "5.8");
});

test("decimal strings preserve exact database-sized costs beyond JS fractional precision", () => {
  const fresh = { ...blockwork, cumulative_locked_quantity: "0" };
  const result = costReport([confirmed(fresh, "9999999999.9999")], [fresh]);
  assert.equal(result.total_cost, "144999999999998.55");
  assert.equal(result.items[0].value_earned, "144999999999998.55");
  assert.equal(JSON.parse(JSON.stringify(result)).total_cost, "144999999999998.55");
});

test("display rounds the report total to nearest NGN 10 while exact costs remain unchanged", () => {
  const result = costReport([confirmed(concrete, "0.0001")], [concrete]);
  assert.equal(result.total_cost, "14.5");
  assert.equal(roundNairaForDisplay(result.total_cost), "10");
  assert.equal(roundNairaForDisplay("15"), "20");
  assert.equal(roundNairaForDisplay("25"), "30");
  assert.equal(formatNaira("144999999999998.55"), "₦145,000,000,000,000");
  assert.equal(formatNaira("551000"), "₦551,000");
  assert.equal(result.total_cost, "14.5");
});

test("sum exact costs before display rounding, never individually round lines to build the total", () => {
  const result = costReport([confirmed(concrete, "0.0001"), confirmed(blockwork, "0.0001")], [concrete, blockwork]);
  assert.equal(result.total_cost, "15.95");
  assert.equal(roundNairaForDisplay(result.total_cost), "20");
});

test("empty confirmed work produces an exact zero total", () => {
  assert.deepEqual(costReport([], [blockwork]), { items: [], total_cost: "0" });
  assert.deepEqual(costReport([], []), { items: [], total_cost: "0" });
});

test("missing, negative, non-finite and unsafe quantities are rejected instead of estimated", () => {
  for (const quantity_done of [null, undefined, "", " ", -1, "-1", NaN, Infinity, "NaN", "Infinity", "0x10", true, {}, Number.MAX_SAFE_INTEGER + 1]) {
    rejects([{ ...confirmed(blockwork), quantity_done }], [blockwork]);
  }
});

test("unknown BoQ IDs, mismatched units and unconfirmed work are rejected", () => {
  for (const change of [
    { boq_item_id: "unknown" }, { boq_item_id: null }, { unit: "m3" }, { unit: null },
    { confirmed_by: "" }, { confirmed_by: " " }, { confirmed_by: undefined },
  ]) rejects([{ ...confirmed(blockwork), ...change }], [blockwork]);
});

test("invalid prices, BoQ quantities, locked history, plans and duplicate IDs are rejected", () => {
  for (const change of [
    { rate: null }, { rate: -1 }, { rate: Infinity }, { rate: "" },
    { boq_quantity: 0 }, { boq_quantity: null }, { boq_quantity: -1 },
    { cumulative_locked_quantity: undefined }, { cumulative_locked_quantity: -1 },
    { planned_percentage: -1 }, { planned_percentage: 101 }, { planned_percentage: NaN },
    { unit: "bags" }, { id: "" },
  ]) rejects([confirmed(blockwork)], [{ ...blockwork, ...change }]);
  rejects([confirmed(blockwork)], [blockwork, blockwork]);
  rejects(null, [blockwork]);
  rejects([confirmed(blockwork)], null);
});

test("zero, fractional, negative and unsafe crew counts are rejected", () => {
  for (const crew of [0, 1.5, -1, NaN, Infinity, "6", Number.MAX_SAFE_INTEGER + 1]) {
    rejects([{ ...confirmed(blockwork), crew }], [blockwork]);
  }
});

test("a caller's extra rate or cost fields never replace the supplied BoQ rate", () => {
  const item = { ...confirmed(blockwork), rate: concrete.rate, cost_today: "0" };
  assert.equal(costReport([item], [blockwork]).total_cost, "261000");
});

test("inputs are immutable and repeated calculations are deterministic without AI or network", () => {
  const price = Object.freeze({ ...blockwork });
  const item = Object.freeze(confirmed(blockwork));
  const prices = Object.freeze([price]);
  const items = Object.freeze([item]);
  const before = JSON.stringify({ prices, items });
  assert.deepEqual(costReport(items, prices), costReport(items, prices));
  assert.equal(JSON.stringify({ prices, items }), before);
});

test("all demo units use their supplied rates, checked against a scaled-integer money oracle", () => {
  const prices: BoqPrice[] = [blockwork, concrete, reinforcement,
    { id: "electrical", unit: "point", rate: "35000", boq_quantity: "75", cumulative_locked_quantity: "0" },
    { id: "labourer", unit: "day", rate: "6000", boq_quantity: "80", cumulative_locked_quantity: "0" },
  ];
  for (const price of prices) {
    for (const tenThousandths of [0, 1, 3, 1000, 180000]) {
      const quantity = `${Math.floor(tenThousandths / 10000)}.${String(tenThousandths % 10000).padStart(4, "0")}`;
      const result = costReport([confirmed(price, quantity)], [price]);
      const integerCost = BigInt(tenThousandths) * BigInt(String(price.rate));
      const expected = `${integerCost / BigInt(10000)}.${String(integerCost % BigInt(10000)).padStart(4, "0")}`.replace(/\.?0+$/, "");
      assert.equal(result.total_cost, expected || "0");
    }
  }
});
