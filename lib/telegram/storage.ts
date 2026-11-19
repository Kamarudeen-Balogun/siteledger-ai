import "server-only";
import type { IntakePayload } from "./update";

export type IntakeReceipt = {
  update_id: number;
  payload: IntakePayload;
  status: "pending" | "saved";
  storage_path: string | null;
  submission_id: string | null;
  reply_text: string;
  reply_sent_at: string | null;
};
export class IntakeUnavailableError extends Error {
  constructor() { super("Site note storage is temporarily unavailable."); }
}
function configuration() {
  // Server configuration must stay runtime-resolved: a local preview must not
  // combine a build-time hosted URL with its isolated local service credentials.
  const url = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL") as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new IntakeUnavailableError();
  return { url, headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) } };
}

export async function intakeRpc<T>(name: string, parameters: Record<string, unknown>): Promise<T> {
  try {
    const { url, headers } = configuration();
    const response = await fetch(new URL(`/rest/v1/rpc/${name}`, url), {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(parameters), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new IntakeUnavailableError();
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch { throw new IntakeUnavailableError(); }
}

export async function uploadEvidence(path: string, bytes: Uint8Array, contentType: string) {
  try {
    const { url, headers } = configuration();
    const objectPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(new URL(`/storage/v1/object/site-evidence/${objectPath}`, url), {
      method: "POST", headers: { ...headers, "Content-Type": contentType, "x-upsert": "false" },
      body: Buffer.from(bytes), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return;
    // A retry may follow a successful upload whose DB finalization failed.
    // The path is reserved per immutable update, and uploads never overwrite it.
    const error = await response.json().catch(() => ({}));
    if (String(error.statusCode) === "409" || error.error === "Duplicate") return;
    throw new IntakeUnavailableError();
  } catch { throw new IntakeUnavailableError(); }
}
