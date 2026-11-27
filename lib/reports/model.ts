import { costReport } from "../costing/cost-report";
import { decimal } from "../costing/decimal";
import type { BoqPrice, ConfirmedCostItem, CostedReport } from "../costing/types";
import type { SiteExtraction } from "../ai/extraction-schema";
import { normalizeDescription } from "../ai/number-words";

export const REPORT_FIRM_NAME = "Perkins Limited";
export type ReportSource = {
  guest_origin?: {id:string;created_at:string;confirmed_at:string|null;handover_at:string;recorded_by:string};
  submission_id: string; date: string; status: string; received_at?: string; boq_version?: number;
  project: { id: string; name: string; client: string; location: string; is_demo: boolean; currency?: string; timezone?: string };
  submitted_by: string; confirmed_by: string | null; confirmed_at: string | null;
  submitted_profile_id?: string; submitted_role?: "foreman" | "pm";
  confirmed_profile_id?: string; confirmed_role?: "foreman" | "pm";
  pending_media: boolean; processing: boolean;
  items: (ConfirmedCostItem & { description: string; confidence: string })[];
  price_list: (BoqPrice & { item_code: string; description: string; section: string })[];
  materials: SiteExtraction["materials"]; delays: SiteExtraction["delays"]; issues: string[];
  photos: { id: string; storage_url: string; note: string }[];
};
export type ReportDocument = { source: ReportSource; costing: CostedReport; firm_name: string; currency: string; weather: string | null };
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
  return { source, costing: costReport(source.items, source.price_list), firm_name: source.project.is_demo ? REPORT_FIRM_NAME : "SiteLedger AI", currency: source.project.currency ?? "NGN", weather };
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
export const displayDate = (date: string) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
export const displayTimestamp = (date: string, timezone = "Africa/Lagos") => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: timezone }).format(new Date(date));
export const lockDate = (report: ReportView) => report.locked_at ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: report.document.source.project.timezone ?? "Africa/Lagos" }).format(new Date(report.locked_at)) : report.document.source.date;
export const moneyDisplayNote = (currency: string) => currency === "NGN" ? "Amounts rounded to the nearest ₦10 for display. Exact values retained in the record." : `Amounts displayed at ${currency} currency precision. Exact values retained in the record.`;
export const displayRatio = (value: string, digits = 1) => new Intl.NumberFormat("en-NG", { maximumFractionDigits: digits }).format(Number(value));
// Quantities are stored as numeric(14,4), so the database hands back
// "420.0000". Display trims the trailing zeros ("420 m²", "35 m³") while
// keeping real decimals ("4.5 tonne"). Non-numeric input is shown as-is.
export function formatQuantity(value: string | number): string {
  if (typeof value === "string" && value.trim() === "") return value;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 4 }).format(numeric);
}
// Work-item titles come from the structured record, never from the raw
// spoken description: a mis-heard transcript ("thin square metre…") can
// never be recovered by normalising words, but the BoQ item it was costed
// against is exact. Unmatched items fall back to the normalised spoken
// description so digits and units still read correctly.
export function displayWorkTitle(boqDescription: string | undefined | null, storedDescription: string): string {
  return boqDescription?.trim() ? boqDescription : normalizeDescription(storedDescription);
}
// Shorten display text at a word boundary, never mid-word. A truncated
// value always ends with an ellipsis so the reader knows more was there.
export const truncateAtWord = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength).replace(/\s+\S*$/, "").trimEnd();
  return (cut || value.slice(0, maxLength)) + "…";
};
export const displayProductivity = (value: string) => new Intl.NumberFormat("en-NG", { maximumSignificantDigits: 3 }).format(Number(value));
