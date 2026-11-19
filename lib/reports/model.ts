import { costReport } from "../costing/cost-report";
import { decimal } from "../costing/decimal";
import type { BoqPrice, ConfirmedCostItem, CostedReport } from "../costing/types";
import type { SiteExtraction } from "../ai/extraction-schema";

export const REPORT_FIRM_NAME = "Perkins Limited";
export type ReportSource = {
  submission_id: string; date: string; status: string;
  project: { id: string; name: string; client: string; location: string; is_demo: boolean };
  submitted_by: string; confirmed_by: string | null; confirmed_at: string | null;
  pending_media: boolean; processing: boolean;
  items: (ConfirmedCostItem & { description: string; confidence: string })[];
  price_list: (BoqPrice & { item_code: string; description: string; section: string })[];
  materials: SiteExtraction["materials"]; delays: SiteExtraction["delays"]; issues: string[];
  photos: { id: string; storage_url: string; note: string }[];
};
export type ReportDocument = { source: ReportSource; costing: CostedReport; firm_name: string; currency: "NGN"; weather: string | null };
export type ReportInput = { source: ReportSource; report: {
  id: string; status: "draft" | "locked"; weather: string | null; total_cost: string;
  approved_by: string | null; locked_at: string | null; document: ReportDocument | null;
} | null };
export type ReportView = { id: string; status: "draft" | "locked"; approved_by: string | null;
  locked_at: string | null; stale: boolean; document: ReportDocument };
export class ReportStateError extends Error {
  constructor(message: string, public status = 409) { super(message); this.name = "ReportStateError"; }
}
export function buildDocument(source: ReportSource, weather: string | null): ReportDocument {
  if (source.status !== "locked" && (source.status !== "confirmed" || !source.confirmed_at || !source.confirmed_by))
    throw new ReportStateError("Confirm the quantities before creating a report.");
  if (source.pending_media || source.processing) throw new ReportStateError("Wait for your audio and photos to finish saving.");
  return { source, costing: costReport(source.items, source.price_list), firm_name: REPORT_FIRM_NAME, currency: "NGN", weather };
}
export function reportFromInput(input: ReportInput): ReportView | null {
  if (!input.report) return null;
  const stored = input.report;
  const document = stored.document ?? buildDocument(input.source, stored.weather);
  // Legacy seeded records use their captured rates. Never use a current rate to
  // silently reprice a locked record, and never rewrite one while exporting it.
  if (!decimal(document.costing.total_cost, "document total").eq(decimal(stored.total_cost, "stored total"))) throw new ReportStateError("Report costs could not be verified.", 503);
  return { id: stored.id, status: stored.status, approved_by: stored.approved_by, locked_at: stored.locked_at,
    stale: stored.status === "draft" && JSON.stringify(document.source) !== JSON.stringify(input.source), document };
}
export const displayUnit = (unit: string) => ({ m2: "m²", m3: "m³" }[unit] ?? unit);
export const displayDate = (date: string) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(date + "T12:00:00+01:00"));
export const displayTimestamp = (date: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(date)) + " WAT";
export const lockDate = (report: ReportView) => report.locked_at ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(report.locked_at)) : report.document.source.date;
export const displayRatio = (value: string, digits = 1) => new Intl.NumberFormat("en-NG", { maximumFractionDigits: digits }).format(Number(value));
export const displayProductivity = (value: string) => new Intl.NumberFormat("en-NG", { maximumSignificantDigits: 3 }).format(Number(value));
