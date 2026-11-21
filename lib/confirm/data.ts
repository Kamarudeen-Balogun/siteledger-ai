import "server-only";
import { intakeRpc } from "../telegram/storage";
import { verifyReviewToken } from "./access";
import type { SiteExtraction } from "../ai/extraction-schema";
import type { BoqChoice } from "./validation";
export type ReviewRecord = {
  id: string; project_name: string; submitted_by: string; actor: string; created_at: string;
  status: "received" | "extracted" | "confirmed" | "locked";
  transcript: string | null; extraction: SiteExtraction | null; confirmed_extraction: SiteExtraction | null;
  confirmed_boq_ids: string[] | null; confirmed_by: string | null; confirmed_at: string | null;
  audio_url: string | null; job_status: string | null; pending_media: boolean; pending_photo_analysis?: boolean;
  photos: { id: string; storage_url: string; ai_findings: unknown; confirmed_findings: { note?: string } | null;
    analysis_status?: "queued" | "processing" | "analysed" | "manual_entry" | null }[];
  boq: BoqChoice[];
};
export async function getReview(id: string, token: string): Promise<ReviewRecord | null> {
  const access = verifyReviewToken(token, id, process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  if (!access) return null;
  return intakeRpc("get_confirmation_record", { p_id: id, p_telegram_id: access.telegramId });
}
export async function readEvidence(path: string, audio: boolean) {
  if (!/^site-evidence\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/\d+\.(ogg|mp3|m4a|webm|wav|jpg)$/.test(path)) throw new Error("Evidence unavailable.");
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
