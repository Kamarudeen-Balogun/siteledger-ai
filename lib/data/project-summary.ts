import "server-only";
import demoSummary from "./demo-summary.json";

export type ProjectSummary = {
  id: string;
  project_code: string;
  name: string;
  client: string;
  location: string;
  contract_sum: number;
  is_demo: boolean;
  locked_report_count: number;
  cumulative_cost: number;
  latest_report_date: string | null;
  overrun_item_count: number;
  amendment_count: number;
};

export type BoqProgress = {
  boq_item_id: string;
  project_id: string;
  item_code: string;
  section: string;
  description: string;
  unit: "m3" | "m2" | "tonne" | "point" | "day";
  boq_quantity: number;
  rate: number;
  cumulative_quantity: number;
  recorded_cost: number;
  percentage_complete: number;
  is_overrun: boolean;
};

// Frozen export of supabase/seed/demo.sql, verified in the isolated local database.
// Public previews must never query live project records, even on the demo site.
export async function getDemoProjectSummary(projectCode: string) {
  if (projectCode !== demoSummary.project.project_code) return null;
  return demoSummary as { project: ProjectSummary; boq_items: BoqProgress[] };
}
