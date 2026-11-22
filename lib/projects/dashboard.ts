import { costReport } from "../costing/cost-report";
import { decimal } from "../costing/decimal";
import type { BoqUnit } from "../costing/types";
import type { BoqRow } from "./boq-types";
export type DashboardInput = {
  project: { id: string; name: string; client: string; location: string; contract_sum: string; is_demo: boolean };
  access: { role: "foreman" | "pm"; owner: boolean; currency: string; timezone: string; archived_at: string | null; professional_name: string };
  as_of: string; boq: BoqRow[]; locked_count: number; draft_count: number;
  locked_items: { id: string; boq_item_id: string; quantity: string; unit: BoqUnit; rate: string; confirmed_by: string; currency: string }[];
};
/** Locked quantities and rates are human-confirmed snapshots. No draft is counted. */
export function projectDashboard(input: DashboardInput) {
  if (input.locked_items.some(row => row.currency !== input.access.currency)) throw new Error("Recorded currencies do not match this project.");
  const recordedValue = (rows: DashboardInput["locked_items"]) => costReport(
    rows.map(row => ({ boq_item_id: row.id, quantity_done: row.quantity, unit: row.unit, confirmed_by: row.confirmed_by })),
    rows.map(row => ({ id: row.id, rate: row.rate, unit: row.unit, boq_quantity: "1", cumulative_locked_quantity: "0" })),
  ).total_cost;
  const byItem = new Map<string, DashboardInput["locked_items"]>();
  for (const row of input.locked_items) { const group = byItem.get(row.boq_item_id) ?? []; group.push(row); byItem.set(row.boq_item_id, group); }
  const progress = costReport(input.boq.map(row => ({ boq_item_id: row.id, quantity_done: "0", unit: row.unit, confirmed_by: input.access.professional_name })),
    input.boq.map(row => ({ ...row, cumulative_locked_quantity: (byItem.get(row.id) ?? []).reduce((sum, entry) => sum.plus(decimal(entry.quantity, "locked quantity")), decimal("0", "zero")).toFixed() })));
  const rows = input.boq.map((row, index) => ({ ...row, progress: progress.items[index], recorded_value: recordedValue(byItem.get(row.id) ?? []) }));
  return { ...input, rows, earned: recordedValue(input.locked_items), flagged: rows.filter(row => row.progress.variance_color === "red").length };
}
export type ProjectDashboard = ReturnType<typeof projectDashboard>;
