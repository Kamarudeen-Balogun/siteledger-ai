import snapshot from "./demo-documents.json";
import summary from "./demo-summary.json";
import type { ReportView } from "../reports/model";
import type { DisputeLog } from "../log/data";
import type { BoqVersion } from "../projects/boq-data";
import { costReport } from "../costing/cost-report";
import type { BoqUnit } from "../costing/types";
export const demoReport = snapshot.report as unknown as ReportView;
export const demoLog = snapshot.log as unknown as DisputeLog;

export type DemoPhoto = { id: string; storage_url: string; note: string; captured_at: string };
export type DemoTodayNote = {
  id: string; state: "locked" | "costed" | "draft"; captured_at: string;
  audio_url: string; transcript: string; total_cost: string | null; href: string; summary: string;
  photos: DemoPhoto[];
  items: { boq_item_id: string; description: string; quantity_done: string; unit: BoqUnit; crew: number }[];
  suggested_items?: { boq_item_id: string; description: string; quantity: number; unit: BoqUnit; crew: number }[];
  materials: { name: string; quantity: number; unit: string; action?: string; confidence?: number }[];
  delays: { hours: number; reason: string; confidence?: number }[];
  issues: string[];
};
export type DemoTeamMember = { name: string; role: string; access: string; permissions: string; status: "active" | "pending" };
export const demoTodayNotes = (snapshot as unknown as { todayNotes: DemoTodayNote[] }).todayNotes;
export const demoTeam = (snapshot as unknown as { team: DemoTeamMember[] }).team;
// The demo BoQ with measured progress, from the demo summary — the same
// figures the real BoQ screen shows for a project.
export type DemoBoqRow = { item_code: string; description: string; section: string; unit: string; boq_quantity: number; rate: number; cumulative_quantity: number; percentage_complete: number; recorded_cost: number; is_overrun: boolean };
export const demoBoq = summary.boq_items as DemoBoqRow[];

// The demo BoQ is version 1, effective when the live backfill captured it
// (27 Nov 2026) — built from the demo price list, never invented.
export const demoVersions: BoqVersion[] = [{
  version: 1,
  effective_date: "2026-11-27",
  created_at: "2026-11-27T18:32:00Z",
  items: demoReport.document.source.price_list.length,
  rows: demoReport.document.source.price_list.map(row => ({
    description: row.description, unit: row.unit, boq_quantity: row.boq_quantity,
    rate: row.rate, item_code: row.item_code, section: row.section,
  })),
}];

// Note 2 as a locked report: the costed draft (18 m² blockwork + 2 m³
// concrete = ₦551,000) shown sealed after the demo Approve & lock. Its
// costing is costReport's own answer for a note recorded that morning, so
// the totals stay reproducible from the frozen BoQ rates.
const note2 = demoTodayNotes[1];
const note2Items = note2.items.map(item => ({
  ...item, confirmed_by: "Engr. Tola Adeyemi (demo PM)", confidence: "1.000",
}));
export const demoNote2Report: ReportView = {
  id: note2.id,
  status: "locked",
  approved_by: "Engr. Tola Adeyemi (demo PM)",
  locked_at: "2026-11-06T17:15:00Z",
  stale: false,
  document: {
    source: {
      ...demoReport.document.source,
      submission_id: note2.id,
      date: "2026-11-06",
      status: "locked",
      items: note2Items,
      materials: note2.materials.map(material => ({
        name: material.name, quantity: material.quantity, unit: material.unit,
        action: (material.action ?? null) as "delivered" | "used" | null,
        confidence: material.confidence ?? 1,
      })),
      delays: note2.delays.map(delay => ({ reason: delay.reason, hours: delay.hours, confidence: delay.confidence ?? 1 })),
      issues: note2.issues,
      photos: note2.photos,
      confirmed_by: "Engr. Tola Adeyemi (demo PM)",
      confirmed_at: "2026-11-06T17:15:00Z",
    },
    costing: costReport(note2Items, demoReport.document.source.price_list),
    firm_name: demoReport.document.firm_name,
    currency: "NGN",
    weather: "Rain, external work stopped for 2 hrs",
  },
};
