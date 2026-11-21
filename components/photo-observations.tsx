"use client";
import { useEffect, useRef, useState } from "react";
import { photoSuggestions, suggestedPhotoNote, validatePhotoAnalysis } from "@/lib/ai/photo-schema";
import type { ReviewRecord } from "@/lib/confirm/data";

type Photo = ReviewRecord["photos"][number];
export function PhotoObservations({ photo, number, onEdit }: { photo: Photo; number: number; onEdit: () => void }) {
  const analysis = validatePhotoAnalysis(photo.ai_findings) ? photo.ai_findings : null;
  const [note, setNote] = useState(() => photo.confirmed_findings?.note ?? (analysis ? suggestedPhotoNote(analysis) : ""));
  const edited = useRef(photo.confirmed_findings !== null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    // A polling refresh may deliver analysis after the person has started typing.
    // Only untouched, unconfirmed observations receive suggestion defaults.
    if (!edited.current && analysis) setNote(suggestedPhotoNote(analysis));
  }, [analysis]);
  const suggestions = analysis ? photoSuggestions(analysis) : [];
  const pending = ["queued", "processing"].includes(photo.analysis_status ?? "");
  const edit = () => { edited.current = true; onEdit(); };
  return <div className="mt-3">
    {pending && <p role="status" className="mb-3">Checking photo {number}… Your photo is saved.</p>}
    {photo.analysis_status === "manual_entry" && <p role="status" className="mb-3 border-l-2 border-amber-700 pl-3">Photo analysis is unavailable. Your photo is saved; add your observations below.</p>}
    {analysis && <>
      <p className="font-semibold">Possible findings — check against the photo</p>
      <p className="mt-2 leading-6">AI suggestions may be wrong or miss issues. Edit or dismiss them before confirming.</p>
      {!suggestions.length && <p className="mt-3">No supported finding was suggested. Add anything you observe.</p>}
      <ul className="mt-3 border-t border-rule">{suggestions.filter(finding => !dismissed.includes(finding.key)).map(finding => <li key={finding.key} className={"border-b border-rule py-3 " + (finding.confidence < 0.6 ? "border-l-2 border-l-amber-700 bg-amber-50 pl-3" : "")}>
        <p className="whitespace-pre-wrap">{finding.note}</p>
        <p className="mt-1 text-sm">AI confidence: {Math.round(finding.confidence * 100)}%</p>
        {finding.confidence < 0.6 ? <p className="mt-2 text-amber-900">Check this one — type your own observation if you agree.</p>
          : <button type="button" className="mr-4 min-h-12 underline" onClick={() => {
            edit();
            if (note.split("\n").includes(finding.note)) return;
            const next = [note, finding.note].filter(Boolean).join("\n");
            if (next.length > 5000) { setError("Shorten your observations before adding another finding."); return; }
            setError(""); setNote(next);
          }}>Add to observations</button>}
        <button type="button" className="min-h-12 underline" aria-label={`Dismiss ${finding.note}`} onClick={() => {
          edit(); setDismissed(current => [...current, finding.key]);
          // Remove only the unchanged suggestion, preserving any human text.
          setNote(current => current.split("\n").filter(line => line !== finding.note).join("\n"));
        }}>Dismiss suggestion</button>
      </li>)}</ul>
    </>}
    <label className="mt-3 block">Photo {number} observations
      <textarea className="mt-2 min-h-24 w-full rounded-none border border-rule bg-white/50 px-3 py-2 text-base outline-offset-2 focus:outline-accent"
        name={`photo.${photo.id}`} maxLength={5000} value={note} onChange={event => { edit(); setError(""); setNote(event.target.value); }}
        placeholder="Add a note or clear any suggestion you disagree with." />
    </label>
    {error && <p role="alert" className="mt-2 text-amber-900">{error}</p>}
  </div>;
}
