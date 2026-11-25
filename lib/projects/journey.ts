import type { ProjectHistory } from "./data";

export type ProjectRecord = ProjectHistory["submissions"][number];
export type RecordStage = "review" | "draft" | "approved";
export function recordStage(note: ProjectRecord): RecordStage {
  if (note.report_status === "locked") return "approved";
  if (note.report_id || note.status === "confirmed") return "draft";
  return "review";
}
export function recordAction(note: ProjectRecord) {
  const stage = recordStage(note);
  return stage === "review"
    ? { href: `/confirm/${note.id}`, label: note.status === "received" ? "Open site note" : "Review site note" }
    : { href: `/reports/${note.id}`, label: stage === "approved" ? "View approved report" : note.report_id ? "Open draft report" : "Create costed report" };
}
export type ProjectStep = {
  kind: "record" | "review" | "draft" | "archived";
  title: string; description: string; href?: string; label: string; note?: ProjectRecord;
};
export function projectStep(notes: ProjectRecord[], role: "pm" | "foreman", archived: boolean): ProjectStep {
  if (archived) return { kind: "archived", title: "This project is archived", description: "Your previous notes and approved reports remain available.", label: "Open site records" };
  const review = notes.find(note => recordStage(note) === "review");
  const draft = notes.find(note => recordStage(note) === "draft");
  const next = role === "pm" ? draft ?? review : review ?? draft;
  if (!next) return { kind: "record", title: notes.length ? "Ready for your next note" : "Start with a site note", description: "Save a voice note, photos or both. You’ll review the details before costing.", label: "Record a site note" };
  if (next.status === "confirmed" && !next.report_id) return { kind: "draft", title: "Your note is confirmed", description: "Create the costed report from the quantities you reviewed.", ...recordAction(next), note: next };
  if (recordStage(next) === "draft") return { kind: "draft", title: role === "pm" ? "Review the draft report" : "Your draft report", description: role === "pm" ? "Review the report. Approval is a separate action." : "Check your draft. Your PM handles approval.", ...recordAction(next), note: next };
  return { kind: "review", title: next.status === "received" ? "Processing your note" : "Review the site note", description: next.status === "received" ? "Open it to check progress or enter details manually." : "Check the work and quantities before costing.", ...recordAction(next), note: next };
}
