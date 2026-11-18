export type WorkItem = {
  description: string;
  matched_boq_hint: string | null;
  quantity: number | null;
  unit: string | null;
  crew: number | null;
  confidence: number;
};
export type SiteExtraction = {
  work_items: WorkItem[];
  materials: { name: string; quantity: number | null; unit: string | null; action: "delivered" | "used" | null; confidence: number }[];
  delays: { reason: string; hours: number | null; confidence: number }[];
  issues: string[];
  raw_language_notes: string;
};
export type BoqHint = { description: string; unit: string };

const nullableNumber = { type: ["number", "null"] };
const nullableString = { type: ["string", "null"] };
const confidence = { type: "number" };
const object = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

// Exact section 9 shape. Missing spoken values are explicitly nullable.
export const extractionJsonSchema = object({
  work_items: { type: "array", items: object({ description: { type: "string" }, matched_boq_hint: nullableString,
    quantity: nullableNumber, unit: nullableString, crew: { type: ["integer", "null"] }, confidence }) },
  materials: { type: "array", items: object({ name: { type: "string" }, quantity: nullableNumber,
    unit: nullableString, action: { type: ["string", "null"], enum: ["delivered", "used", null] }, confidence }) },
  delays: { type: "array", items: object({ reason: { type: "string" }, hours: nullableNumber, confidence }) },
  issues: { type: "array", items: { type: "string" } },
  raw_language_notes: { type: "string" },
});

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function keys(value: unknown, expected: string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === expected.length
    && expected.every((key) => Object.hasOwn(value, key));
}
function string(value: unknown, empty = false): value is string {
  return typeof value === "string" && value.length <= 20_000 && (empty || value.trim().length > 0);
}
function nullableText(value: unknown) { return value === null || string(value); }
function quantity(value: unknown) { return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0); }
function score(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
function array(value: unknown): value is unknown[] { return Array.isArray(value) && value.length <= 100; }
function lowWhenMissing(value: unknown, confidence: number) { return value !== null || confidence < 0.6; }

export function validateExtraction(value: unknown): value is SiteExtraction {
  if (!keys(value, ["work_items", "materials", "delays", "issues", "raw_language_notes"])) return false;
  return array(value.work_items) && value.work_items.every((item) =>
    keys(item, ["description", "matched_boq_hint", "quantity", "unit", "crew", "confidence"])
    && string(item.description) && nullableText(item.matched_boq_hint)
    && quantity(item.quantity) && nullableText(item.unit)
    && (item.crew === null || (Number.isSafeInteger(item.crew) && Number(item.crew) > 0))
    && score(item.confidence) && lowWhenMissing(item.quantity, item.confidence))
    && array(value.materials) && value.materials.every((item) =>
      keys(item, ["name", "quantity", "unit", "action", "confidence"])
      && string(item.name) && quantity(item.quantity) && nullableText(item.unit)
      && ["delivered", "used", null].includes(item.action as string | null)
      && score(item.confidence) && lowWhenMissing(item.quantity, item.confidence))
    && array(value.delays) && value.delays.every((item) =>
      keys(item, ["reason", "hours", "confidence"]) && string(item.reason)
      && quantity(item.hours) && score(item.confidence) && lowWhenMissing(item.hours, item.confidence))
    && array(value.issues) && value.issues.every((issue) => string(issue))
    && string(value.raw_language_notes, true);
}

export function parseExtraction(text: string): SiteExtraction | null {
  if (text.length > 100_000) return null;
  try { const value: unknown = JSON.parse(text); return validateExtraction(value) ? value : null; }
  catch { return null; }
}
