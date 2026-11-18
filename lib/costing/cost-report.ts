import type Big from "big.js";
import { decimal, CostingValidationError } from "./decimal";
import type { BoqPrice, ConfirmedCostItem, CostedItem, CostedReport } from "./types";

export { CostingValidationError } from "./decimal";

const units = new Set(["m3", "m2", "tonne", "point", "day"]);
type CheckedPrice = { source: BoqPrice; rate: Big; quantity: Big; locked: Big; plan: Big | null };
const isRecord = (value: unknown) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * PROJECT_BRIEF.md section 10. Pure, currency-independent arithmetic; no AI,
 * network, database or current-time access. The caller authenticates the human,
 * supplies this project's BoQ, and aggregates locked history excluding today.
 */
export function costReport(items: readonly ConfirmedCostItem[], priceList: readonly BoqPrice[]): CostedReport {
  if (!Array.isArray(items) || !Array.isArray(priceList)) throw new CostingValidationError("confirmed items and price list");

  const prices = new Map<string, CheckedPrice>();
  for (const price of priceList) {
    if (!isRecord(price) || typeof price.id !== "string" || !price.id.trim()
      || prices.has(price.id) || !units.has(price.unit)) throw new CostingValidationError("BoQ IDs and units");
    const rate = decimal(price.rate, "BoQ rate");
    const quantity = decimal(price.boq_quantity, "BoQ quantity");
    const locked = decimal(price.cumulative_locked_quantity, "locked cumulative quantity");
    const plan = price.planned_percentage == null ? null : decimal(price.planned_percentage, "planned percentage");
    if (quantity.eq(0) || (plan && plan.gt(100))) throw new CostingValidationError("BoQ quantity and planned percentage");
    prices.set(price.id, { source: price, rate, quantity, locked, plan });
  }

  // Multiple locations may use the same BoQ item. Add today's quantities first
  // so every such line shows the same final progress, without duplicating costs.
  const today = new Map<string, Big>();
  const checked = items.map(item => {
    if (!isRecord(item) || typeof item.confirmed_by !== "string" || !item.confirmed_by.trim()) {
      throw new CostingValidationError("human confirmation");
    }
    const price = prices.get(item.boq_item_id);
    if (!price || item.unit !== price.source.unit) throw new CostingValidationError("selected BoQ item and unit");
    const quantity = decimal(item.quantity_done, "confirmed quantity");
    const crew = item.crew ?? null;
    if (crew !== null && (!Number.isSafeInteger(crew) || crew <= 0)) throw new CostingValidationError("crew count");
    today.set(item.boq_item_id, (today.get(item.boq_item_id) ?? decimal(0, "zero")).plus(quantity));
    return { item, price, quantity, crew };
  });

  let total = decimal(0, "zero");
  const costed: CostedItem[] = checked.map(({ item, price, quantity, crew }) => {
    const cost = quantity.times(price.rate);
    const cumulative = price.locked.plus(today.get(item.boq_item_id)!);
    const percentage = cumulative.times(100).div(price.quantity);
    const variance = price.plan === null ? null : percentage.minus(price.plan);
    const overrun = cumulative.gt(price.quantity);
    const behind = variance !== null && variance.lt(0);
    total = total.plus(cost);
    return {
      boq_item_id: item.boq_item_id,
      quantity_done: quantity.toFixed(),
      unit: price.source.unit,
      crew,
      confirmed_by: item.confirmed_by,
      rate: price.rate.toFixed(),
      cost_today: cost.toFixed(),
      cumulative_quantity: cumulative.toFixed(),
      percentage_complete: percentage.toFixed(),
      value_earned: cumulative.times(price.rate).toFixed(),
      planned_percentage: price.plan?.toFixed() ?? null,
      variance_percentage_points: variance?.toFixed() ?? null,
      is_overrun: overrun,
      is_behind_plan: behind,
      variance_color: overrun || behind ? "red" : null,
      productivity: crew === null ? null : quantity.div(crew).toFixed(),
    };
  });

  return { items: costed, total_cost: total.toFixed() };
}
