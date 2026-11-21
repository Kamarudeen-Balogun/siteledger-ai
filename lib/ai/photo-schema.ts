export type PhotoFinding = { description: string; confidence: number };
export type PhotoAnalysis = {
  likely_work_item: string | null;
  defects: PhotoFinding[];
  safety_concerns: PhotoFinding[];
  confidence: number;
};
export type PhotoSuggestion = { key: string; note: string; confidence: number };
export function photoSuggestions(value: PhotoAnalysis): PhotoSuggestion[] {
  const suggestions: PhotoSuggestion[] = [];
  const line = (text: string) => text.replace(/\s+/g, " ").trim();
  if (value.likely_work_item) suggestions.push({ key: "work", note: `Possible work item: ${line(value.likely_work_item)}`, confidence: value.confidence });
  value.defects.forEach((finding, i) => suggestions.push({ key: `defect-${i}`, note: `Possible defect: ${line(finding.description)}`, confidence: finding.confidence }));
  value.safety_concerns.forEach((finding, i) => suggestions.push({ key: `safety-${i}`, note: `Possible safety issue: ${line(finding.description)}`, confidence: finding.confidence }));
  return suggestions;
}

const findingSchema = { type: "object", properties: {
  description: { type: "string", minLength: 1, maxLength: 500 },
  confidence: { type: "number", minimum: 0, maximum: 1 },
}, required: ["description", "confidence"], additionalProperties: false };
export const photoJsonSchema = { type: "object", properties: {
  likely_work_item: { type: ["string", "null"], maxLength: 500 },
  defects: { type: "array", maxItems: 6, items: findingSchema },
  safety_concerns: { type: "array", maxItems: 6, items: findingSchema },
  confidence: { type: "number", minimum: 0, maximum: 1 },
}, required: ["likely_work_item", "defects", "safety_concerns", "confidence"], additionalProperties: false };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const score = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const description = (value: unknown) => typeof value === "string" && !!value.trim() && value.length <= 500
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
export function validatePhotoAnalysis(value: unknown): value is PhotoAnalysis {
  if (!record(value) || Object.keys(value).length !== 4
    || !["likely_work_item", "defects", "safety_concerns", "confidence"].every(key => key in value)
    || (value.likely_work_item !== null && !description(value.likely_work_item)) || !score(value.confidence)) return false;
  return [value.defects, value.safety_concerns].every(list => Array.isArray(list) && list.length <= 6
    && list.every(item => record(item) && Object.keys(item).length === 2 && description(item.description) && score(item.confidence)));
}
export function parsePhotoAnalysis(text: string): PhotoAnalysis {
  if (text.length > 20_000) throw new Error("Photo response is invalid.");
  const result: unknown = JSON.parse(text);
  if (!validatePhotoAnalysis(result)) throw new Error("Photo response is invalid.");
  return result;
}
export function suggestedPhotoNote(value: PhotoAnalysis): string {
  let note = "";
  for (const finding of photoSuggestions(value).filter(finding => finding.confidence >= 0.6)) {
    const next = [note, finding.note].filter(Boolean).join("\n");
    if (next.length <= 5000) note = next;
  }
  return note;
}
