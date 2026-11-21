export const MAX_WEB_AUDIO = 3 * 1024 * 1024;
export const MAX_WEB_PHOTO = 1024 * 1024;
export const WEB_AUDIO_TYPES = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/webm": "webm", "audio/wav": "wav" } as const;
export type AudioType = keyof typeof WEB_AUDIO_TYPES;
export type CaptureContext = { project_id: string; project_name: string; actor_id: number; actor_name: string; timezone: string; access: string; expires: number; source_key?: string };
export type Asset = { index: number; content_type: AudioType | "image/jpeg"; bytes: number; sha256: string };
export type WebManifest = { id: string; project_id: string; captured_at: string; timezone: string; assets: Asset[] };
export type QueueEntry = { manifest: WebManifest; context: CaptureContext; files?: Blob[]; status: "queued" | "sending" | "blocked" | "sent";
  message: string; owner?: string; lease_until?: number; review_url?: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function validManifest(value: unknown): value is WebManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as WebManifest;
  if (Object.keys(v).length !== 5 || !["id","project_id","captured_at","timezone","assets"].every(key=>key in v)
    || !uuid.test(v.id) || !uuid.test(v.project_id) || typeof v.timezone !== "string" || v.timezone.length > 64
    || typeof v.captured_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.captured_at)
    || !Number.isFinite(Date.parse(v.captured_at)) || !Array.isArray(v.assets) || v.assets.length < 2 || v.assets.length > 6) return false;
  return v.assets.every((a,i)=>a && Object.keys(a).length === 4 && a.index === i
    && typeof a.sha256 === "string" && /^[a-f0-9]{64}$/.test(a.sha256) && Number.isSafeInteger(a.bytes) && a.bytes > 0
    && (i === 0 ? Object.hasOwn(WEB_AUDIO_TYPES,a.content_type) && a.bytes <= MAX_WEB_AUDIO : a.content_type === "image/jpeg" && a.bytes <= MAX_WEB_PHOTO));
}
export function validMedia(bytes: Uint8Array, type: string) {
  if(bytes.length < 12) return false;
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start,end));
  if(type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if(type === "audio/ogg") return text(0,4) === "OggS";
  if(type === "audio/webm") return [26,69,223,163].every((n,i)=>bytes[i] === n);
  if(type === "audio/wav") return text(0,4) === "RIFF" && text(8,12) === "WAVE";
  if(type === "audio/mp4") return text(4,8) === "ftyp";
  return type === "audio/mpeg" && (text(0,3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224));
}
