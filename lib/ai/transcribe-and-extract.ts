import "server-only";
import { extractionJsonSchema, parseExtraction, type BoqHint, type SiteExtraction } from "./extraction-schema";
import { extractWorkCandidates, normalizeDescription } from "./number-words";
import { extractionPrompt, transcriptionPrompt, whisperContext } from "./prompts";

export type AudioInput = { bytes: Uint8Array; filename: string; contentType: string };
export type Transcription = { text: string; detectedLanguages: string[] };
export type PipelineResult =
  | { status: "extracted"; transcript: string; detectedLanguages: string[]; extraction: SiteExtraction }
  | { status: "manual_entry"; transcript: string | null; detectedLanguages: string[]; extraction: null;
      error: "transcription_failed" | "extraction_invalid" | "extraction_failed" };
export type PipelineOptions = {
  existingTranscript?: string | null;
  detectedLanguages?: string[];
  onTranscript?: (transcription: Transcription) => Promise<void>;
};
type Transcriber = (audio: AudioInput) => Promise<Transcription>;
type Extractor = (transcript: string, hints: BoqHint[], retry: boolean) => Promise<string>;
export type PipelineDependencies = {
  transcribe: Transcriber;
  extract: Extractor;
  transcriptionFallback?: Transcriber;
  extractionFallback?: Extractor;
};

export const WHISPER_MODEL = "whisper-large-v3-turbo";
export const EXTRACTION_MODEL = "openai/gpt-oss-120b";
export const GONKAROUTER_MODEL = "zai-org/GLM-5.3-Flash";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function apiKey(name: string) {
  const key = process.env[name]?.trim();
  if (!key) throw new Error("AI configuration is missing.");
  return key;
}
async function checkedResponse(url: string, init: RequestInit, provider: string, timeout: number) {
  const response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout) });
  if (!response.ok) {
    // Never log response bodies, credentials, or source data.
    console.warn(provider + " request failed (HTTP " + response.status + ").");
    throw new Error("AI request failed.");
  }
  return response.json();
}
async function transcribeGroq(audio: AudioInput): Promise<Transcription> {
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(audio.bytes)], { type: audio.contentType }), audio.filename);
  body.set("model", WHISPER_MODEL);
  body.set("response_format", "verbose_json");
  body.set("prompt", whisperContext);
  // Omit language for automatic detection; use transcription, never translation.
  const result = await checkedResponse("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: "Bearer " + apiKey("GROQ_API_KEY") }, body,
  }, "Groq Whisper", 25_000);
  if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 60_000)
    throw new Error("No usable speech transcript.");
  // Keep the provider's detected language name. An English label does not prove
  // Pidgin language detection or accuracy.
  const detectedLanguages = typeof result.language === "string" && result.language.length <= 64 ? [result.language] : [];
  return { text: result.text, detectedLanguages };
}
async function generateGeminiJson(input: unknown, system: string, schema: unknown, timeout: number): Promise<string> {
  const parts = typeof input === "string" ? [{ text: input }]
    : (input as { type: string; text?: string; data?: string; mime_type?: string }[]).map((part) =>
      part.type === "audio" ? { inlineData: { data: part.data, mimeType: part.mime_type } } : { text: part.text });
  const result = await checkedResponse("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent", {
    method: "POST", headers: { "x-goog-api-key": apiKey("GEMINI_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], systemInstruction: { parts: [{ text: system }] },
      generationConfig: { maxOutputTokens: 4_000, responseMimeType: "application/json", responseJsonSchema: schema },
    }),
  }, "Gemini", timeout);
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== "STOP" || !Array.isArray(candidate.content?.parts)) throw new Error("AI output incomplete.");
  const blocks = candidate.content.parts.filter((part: { thought?: boolean; text?: unknown }) =>
    part.thought !== true && typeof part.text === "string");
  const text = blocks.map((part: { text: string }) => part.text).join("");
  if (!text || text.length > 100_000) throw new Error("AI output missing.");
  return text;
}
async function transcribeGemini(audio: AudioInput): Promise<Transcription> {
  const schema = { type: "object", properties: { text: { type: "string" },
    detected_languages: { type: "array", items: { type: "string" } } },
    required: ["text", "detected_languages"], additionalProperties: false };
  const content = await generateGeminiJson([
    { type: "audio", data: Buffer.from(audio.bytes).toString("base64"),
      mime_type: audio.contentType === "audio/mp4" ? "audio/m4a" : audio.contentType },
    { type: "text", text: "Transcribe only the speech in this recording, in its original language. Return text and detected_languages (ISO language identifiers where possible, [] if uncertain). If no intelligible speech is present, return empty text. Never invent a transcript." },
  ], transcriptionPrompt, schema, 25_000);
  const result = JSON.parse(content);
  if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 60_000
    || !Array.isArray(result.detected_languages)
    || !result.detected_languages.every((value: unknown) => typeof value === "string" && value.length <= 64))
    throw new Error("No usable speech transcript.");
  return { text: result.text, detectedLanguages: result.detected_languages };
}
function extractionInstructions(hints: BoqHint[], retry: boolean) {
  return extractionPrompt(hints) + "\nExact JSON schema:\n" + JSON.stringify(extractionJsonSchema)
    + (retry ? "\nPrevious attempt failed. Return exactly the schema, no extra fields. Missing quantities/durations must be null with confidence below 0.6." : "");
}
async function extractChat(provider: "Groq" | "GonkaRouter", transcript: string, hints: BoqHint[], retry: boolean): Promise<string> {
  const groq = provider === "Groq";
  const result = await checkedResponse(groq ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.gonkarouter.io/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey(groq ? "GROQ_API_KEY" : "GONKAROUTER_API_KEY"),
      // Disable router substitutions so our two-attempt limit stays explicit.
      ...(!groq ? { "X-Gonka-No-Fallback": "true" } : {}),
    },
    body: JSON.stringify({ model: groq ? EXTRACTION_MODEL : GONKAROUTER_MODEL,
      messages: [{ role: "system", content: extractionInstructions(hints, retry) },
        { role: "user", content: JSON.stringify({ raw_transcript: transcript }) }],
      ...(groq ? { max_completion_tokens: 4_000, reasoning_effort: "low", response_format: {
        type: "json_schema", json_schema: { name: "site_extraction", strict: true, schema: extractionJsonSchema },
      } } : { max_tokens: 4_000 }),
    }),
  }, provider, 15_000);
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string"
    || !choice.message.content || choice.message.content.length > 100_000) throw new Error("AI output incomplete.");
  // This router can wrap a JSON document in one Markdown fence. Decode only
  // that complete envelope; never remove prose, repair JSON, or change values.
  // parseExtraction still validates every field and rejects extra money fields.
  const content: string = choice.message.content;
  const envelope = !groq && content.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return envelope ? envelope[1] : content;
}
const extractGroq: Extractor = (text, hints, retry) => extractChat("Groq", text, hints, retry);
const extractGonka: Extractor = (text, hints, retry) => extractChat("GonkaRouter", text, hints, retry);
const extractGemini: Extractor = (text, hints, retry) =>
  generateGeminiJson(JSON.stringify({ raw_transcript: text }), extractionInstructions(hints, retry), extractionJsonSchema, 15_000);

function configuredDependencies(): PipelineDependencies {
  // Keys must belong to Free-tier / starter-credit accounts. No billing change,
  // paid-provider configuration, tools, or top-up API is present here.
  const transcribers = [process.env.GROQ_API_KEY?.trim() ? transcribeGroq : null,
    process.env.GEMINI_API_KEY?.trim() ? transcribeGemini : null].filter((value) => value !== null);
  const extractors = [process.env.GROQ_API_KEY?.trim() ? extractGroq : null,
    process.env.GONKAROUTER_API_KEY?.trim() ? extractGonka : null,
    process.env.GEMINI_API_KEY?.trim() ? extractGemini : null].filter((value) => value !== null);
  const missing = async (): Promise<never> => { throw new Error("AI configuration is missing."); };
  return { transcribe: transcribers[0] ?? missing, transcriptionFallback: transcribers[1],
    extract: extractors[0] ?? missing, extractionFallback: extractors[1] };
}

// All speech/extraction AI requests enter here. Provider failures give manual
// entry; persistence failures propagate so saved transcripts are never replaced.
export async function transcribeAndExtract(
  audio: AudioInput | null,
  hints: BoqHint[],
  options: PipelineOptions = {},
  dependencies: PipelineDependencies = configuredDependencies(),
): Promise<PipelineResult> {
  let transcript = options.existingTranscript ?? null;
  let detectedLanguages = options.detectedLanguages ?? [];
  if (transcript === null) {
    if (!audio || !audio.bytes.length || audio.bytes.length > 20 * 1024 * 1024)
      return { status: "manual_entry", transcript: null, detectedLanguages, extraction: null, error: "transcription_failed" };
    let transcription: Transcription | null = null;
    for (const transcriber of [dependencies.transcribe, dependencies.transcriptionFallback]) {
      if (!transcriber) continue;
      try {
        const value = await transcriber(audio);
        if (!value.text.trim()) throw new Error("No speech.");
        transcription = value;
        break;
      } catch { /* At most one alternate provider; no request loop. */ }
    }
    if (!transcription) return { status: "manual_entry", transcript: null, detectedLanguages, extraction: null, error: "transcription_failed" };
    await options.onTranscript?.(transcription);
    transcript = transcription.text;
    detectedLanguages = transcription.detectedLanguages;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    let content: string;
    const extract = attempt === 1 ? dependencies.extractionFallback ?? dependencies.extract : dependencies.extract;
    try { content = await extract(transcript, hints, attempt === 1); }
    catch {
      if (attempt === 0 && dependencies.extractionFallback) continue;
      return { status: "manual_entry", transcript, detectedLanguages, extraction: null, error: "extraction_failed" };
    }
    const extraction = parseExtraction(content);
    if (extraction) {
      // Spoken numbers become digits and standard units in descriptions, so
      // a locked report reads "18 m² of 225mm blockwork" instead of the
      // spoken words. If the model missed the work entirely while the
      // transcript states a quantity, recover it deterministically from the
      // transcript itself — the Confirm screen still requires a human to
      // verify the quantity before anything is costed.
      extraction.work_items = extraction.work_items.map((item) => ({ ...item, description: normalizeDescription(item.description) }));
      if (extraction.work_items.length === 0) extraction.work_items = extractWorkCandidates(transcript, hints);
      return { status: "extracted", transcript, detectedLanguages, extraction };
    }
  }
  return { status: "manual_entry", transcript, detectedLanguages, extraction: null, error: "extraction_invalid" };
}
