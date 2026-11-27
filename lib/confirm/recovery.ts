import { extractWorkCandidates } from "../ai/number-words";
import type { SiteExtraction } from "../ai/extraction-schema";
import type { BoqChoice } from "./validation";

// Recover work items for a stored extraction that recorded none, using
// only the saved transcript and the project's BoQ hints. The extraction
// fallback added in PR #5 runs at processing time, so drafts processed
// before it existed still show an empty Confirm screen even though their
// transcript states quantities. This runs at read time instead: nothing
// is rewritten, no AI call is made, and locked or already-confirmed
// records are untouched — the caller only applies it to an unconfirmed
// extraction with no work items. When the transcript states no work,
// the candidates are empty and the Confirm screen stays empty, exactly
// as before.
export function recoverWorkItems(
  extraction: SiteExtraction | null,
  transcript: string | null,
  boq: BoqChoice[],
): SiteExtraction | null {
  if (!extraction || extraction.work_items.length > 0 || !transcript?.trim()) return extraction;
  const candidates = extractWorkCandidates(
    transcript,
    boq.map((item) => ({ description: item.description, unit: item.unit })),
  );
  if (!candidates.length) return extraction;
  return { ...extraction, work_items: candidates };
}
