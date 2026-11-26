import "server-only";
import { randomUUID } from "node:crypto";
import { intakeRpc } from "../telegram/storage";
import { transcribeAndExtract, type AudioInput, type PipelineResult, type Transcription } from "./transcribe-and-extract";
import type { BoqHint } from "./extraction-schema";

export type VoiceJob = {
  submission_id: string;
  audio_url: string;
  content_type: string;
  transcript: string | null;
  detected_languages: string[];
  boq_hints: BoqHint[];
};
export type ProcessingDependencies = {
  claim: (id: string, owner: string) => Promise<VoiceJob | null>;
  download: (job: VoiceJob) => Promise<AudioInput>;
  saveTranscript: (id: string, owner: string, transcript: Transcription) => Promise<void>;
  pipeline: typeof transcribeAndExtract;
  finish: (id: string, owner: string, result: PipelineResult | { error: "audio_unavailable"; extraction: null }) => Promise<void>;
  release: (id: string, owner: string) => Promise<void>;
};

async function downloadAudio(job: VoiceJob): Promise<AudioInput> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^site-evidence\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:\d+|[a-f0-9-]{36})\.(ogg|mp3|m4a|webm|wav)$/.test(job.audio_url))
    throw new Error("Stored audio is unavailable.");
  const response = await fetch(new URL(`/storage/v1/object/authenticated/${job.audio_url}`, url), {
    headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 20 * 1024 * 1024)
    throw new Error("Stored audio is unavailable.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Stored audio is unavailable.");
  return { bytes, filename: job.audio_url.split("/").at(-1)!, contentType: job.content_type };
}

const processingDependencies: ProcessingDependencies = {
  claim: (id, owner) => intakeRpc("claim_ai_submission", { p_submission_id: id, p_owner: owner }),
  download: downloadAudio,
  saveTranscript: (id, owner, transcript) => intakeRpc("save_ai_transcript", {
    p_submission_id: id, p_owner: owner, p_transcript: transcript.text, p_languages: transcript.detectedLanguages,
  }),
  pipeline: transcribeAndExtract,
  finish: (id, owner, result) => intakeRpc("finish_ai_submission", { p_submission_id: id, p_owner: owner,
    p_extraction: result.extraction, p_error: "error" in result ? result.error : null }),
  release: (id, owner) => intakeRpc("release_ai_submission", { p_submission_id: id, p_owner: owner }),
};

export async function processSubmission(id: string, dependencies: ProcessingDependencies = processingDependencies) {
  const owner = randomUUID();
  try {
    const job = await dependencies.claim(id, owner);
    if (!job) return "skipped";
    let audio: AudioInput | null = null;
    if (job.transcript === null) {
      try { audio = await dependencies.download(job); }
      catch {
        await dependencies.finish(id, owner, { error: "audio_unavailable", extraction: null });
        return "manual_entry";
      }
    }
    const result = await dependencies.pipeline(audio, job.boq_hints, {
      existingTranscript: job.transcript, detectedLanguages: job.detected_languages,
      onTranscript: (transcript) => dependencies.saveTranscript(id, owner, transcript),
    });
    await dependencies.finish(id, owner, result);
    return result.status;
  } catch {
    await dependencies.release(id, owner).catch(() => undefined);
    // The durable queued record can resume from its saved raw transcript.
    // Never log provider responses, credentials, source audio, or transcripts.
    return "queued";
  }
}
