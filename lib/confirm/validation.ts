import { validateExtraction, type SiteExtraction } from "../ai/extraction-schema";
export type BoqChoice = { id: string; description: string; unit: string; section: string; item_code: string };
export type Confirmation = { values: SiteExtraction; boq_ids: string[]; photo_notes: { id: string; note: string }[]; human_confirmed: true };
export function validateConfirmation(value: unknown, boq: BoqChoice[], photoIds: string[]): value is Confirmation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 4 || input.human_confirmed !== true || !validateExtraction(input.values)
    || !Array.isArray(input.boq_ids) || input.boq_ids.length !== input.values.work_items.length
    || !Array.isArray(input.photo_notes) || input.photo_notes.length !== photoIds.length) return false;
  const units = new Map(boq.map(item => [item.id, item.unit]));
  const ids = input.boq_ids as unknown[];
  return input.values.work_items.every((item, i) => item.quantity !== null && typeof ids[i] === "string"
      && item.unit === units.get(ids[i] as string))
    && input.values.materials.every(item => item.quantity !== null && item.unit !== null && item.action !== null)
    && input.values.delays.every(item => item.hours !== null)
    && input.photo_notes.every(note => note && typeof note === "object" && Object.keys(note).length === 2
      && photoIds.includes(note.id) && typeof note.note === "string" && note.note.length <= 5000)
    && new Set(input.photo_notes.map(note => note.id)).size === photoIds.length;
}
