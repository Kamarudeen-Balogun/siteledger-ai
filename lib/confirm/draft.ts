export type ReviewDraft = {
  work: number; materials: number; delays: number;
  fields: Record<string, string>;
};

const field = /^(?:issues|language_notes|photo\.[a-f0-9-]{36}|w\d{1,2}\.(?:description|quantity|hint|unit|boq|crew|confidence)|m\d{1,2}\.(?:name|quantity|unit|action|confidence)|d\d{1,2}\.(?:reason|hours|confidence))$/;
export function validReviewDraft(input: unknown): input is ReviewDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as ReviewDraft;
  return Object.keys(value).length === 4 && [value.work,value.materials,value.delays].every(count => Number.isInteger(count) && count >= 0 && count <= 50)
    && Boolean(value.fields) && typeof value.fields === "object" && !Array.isArray(value.fields)
    && Object.entries(value.fields).every(([name,text]) => field.test(name) && typeof text === "string" && text.length <= 20000);
}
