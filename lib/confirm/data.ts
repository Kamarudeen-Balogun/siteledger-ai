import "server-only";
import { intakeRpc } from "../telegram/storage";
import { UUID } from "./access";
import { currentSessionHash } from "../auth/session";
import type { SiteExtraction } from "../ai/extraction-schema";
import type { BoqChoice } from "./validation";
export type ReviewRecord = {
  guest_origin?: {id:string;created_at:string;confirmed_at:string|null;handover_at:string;recorded_by:string};
  trial_values?: SiteExtraction|null; trial_boq_ids?: string[];
  id: string; project_name: string; submitted_by: string; actor: string; created_at: string;
  project_id?: string; actor_role?: "foreman"|"pm"; currency?: string; timezone?: string; archived_at?: string|null;
  status: "received" | "extracted" | "confirmed" | "locked";
  transcript: string | null; extraction: SiteExtraction | null; confirmed_extraction: SiteExtraction | null;
  confirmed_boq_ids: string[] | null; confirmed_by: string | null; confirmed_at: string | null;
  audio_url: string | null; job_status: string | null; pending_media: boolean; pending_photo_analysis?: boolean;
  photos: { id: string; storage_url: string; ai_findings: unknown; confirmed_findings: { note?: string } | null;
    analysis_status?: "queued" | "processing" | "analysed" | "manual_entry" | null }[];
  boq: BoqChoice[];
};
export async function getReview(id: string, hash?: string): Promise<ReviewRecord | null> {
  const access=hash??await currentSessionHash();
  if (!UUID.test(id) || !/^[a-f0-9]{64}$/.test(access)) return null;
  return intakeRpc("account_review", { p_id: id, p_hash: access });
}
export async function readEvidence(path: string, audio: boolean) {
  if (!/^site-evidence\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:\d+|[a-f0-9-]{36})\.(ogg|mp3|m4a|webm|wav|jpg)$/.test(path)) throw new Error("Evidence unavailable.");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY, base = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL") as string | undefined;
  if (!key || !base) throw new Error("Evidence unavailable.");
  const limit = (audio ? 20 : 1) * 1024 * 1024;
  const response = await fetch(new URL(`/storage/v1/object/authenticated/${path}`, base), {
    headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > limit) throw new Error("Evidence unavailable.");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > limit) throw new Error("Evidence unavailable.");
  return { bytes, contentType: response.headers.get("content-type") ?? (audio ? "audio/ogg" : "image/jpeg") };
}
