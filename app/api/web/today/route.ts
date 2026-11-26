import { privateHeaders } from "@/lib/auth/api";
import { requestSessionHash } from "@/lib/auth/session";
import { costReport } from "@/lib/costing/cost-report";
import { decimal } from "@/lib/costing/decimal";
import { formatMoney } from "@/lib/costing/format-money";
import { projectDashboard, type DashboardInput } from "@/lib/projects/dashboard";
import type { ProjectHistory } from "@/lib/projects/data";
import { recordAction, recordStage } from "@/lib/projects/journey";
import { displayRatio, displayUnit } from "@/lib/reports/model";
import { intakeRpc } from "@/lib/telegram/storage";

export async function GET(request: Request) {
  const hash = requestSessionHash(request);
  if (!hash) return Response.json(null, { status: 401, headers: privateHeaders });
  try {
    const list = await intakeRpc<{ active_project_id: string | null } | null>("account_list_projects", { p_hash: hash });
    if (!list?.active_project_id) return Response.json(null, { headers: privateHeaders });
    const args = { p_hash: hash, p_project: list.active_project_id };
    const [input, history] = await Promise.all([
      intakeRpc<DashboardInput | null>("account_dashboard_input", args),
      intakeRpc<ProjectHistory | null>("account_project_history", args),
    ]);
    if (!history || !input) return Response.json(null, { headers: privateHeaders });
    const dashboard = projectDashboard(input);
    const overallCost = (measured: boolean) => costReport(dashboard.rows.map(row => ({
      boq_item_id: row.id, unit: row.unit, confirmed_by: input.access.professional_name,
      quantity_done: measured && decimal(row.progress.cumulative_quantity, "locked quantity").lt(row.boq_quantity) ? row.progress.cumulative_quantity : row.boq_quantity,
    })), dashboard.boq.map(row => ({ ...row, cumulative_locked_quantity: "0" }))).total_cost;
    const scope = decimal(overallCost(false), "BoQ scope");
    const percentage = scope.gt(0) ? Number(decimal(overallCost(true), "completed scope").times(100).div(scope).toFixed(1)) : null;
    const siteDate = new Intl.DateTimeFormat("en-CA", { timeZone: input.access.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const today = history.submissions.filter(note => note.date === siteDate && note.total_cost != null);
    const total = today.reduce((sum, note) => sum.plus(decimal(note.total_cost!, "report total")), decimal("0", "daily total"));
    return Response.json({
      projectId: list.active_project_id,
      readScope: "From locked reports",
      percentage,
      earned: formatMoney(dashboard.earned, input.access.currency),
      dayTotal: today.length ? formatMoney(total.toFixed(), input.access.currency) : null,
      rows: dashboard.rows.slice(0, 3).map(row => ({
        id: row.id, description: row.description, unit: displayUnit(row.unit),
        done: row.progress.cumulative_quantity, scope: row.boq_quantity,
        percentage: displayRatio(row.progress.percentage_complete),
      })),
      notes: history.submissions.filter((note,index)=>index<40||note.date===siteDate).map(note => ({ id: note.id, date: note.date, capturedAt: note.captured_at, today: note.date===siteDate, amount: note.total_cost==null?null:formatMoney(note.total_cost,input.access.currency), items:note.summary_items, status: note.status, stage: recordStage(note), ...recordAction(note) })),
    }, { headers: privateHeaders });
  } catch {
    return Response.json(null, { status: 503, headers: privateHeaders });
  }
}
