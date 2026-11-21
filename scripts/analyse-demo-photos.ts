import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { analysePhoto, PHOTO_MODEL } from "../lib/ai/analyse-photo";

// Explicit read-only acceptance helper. Every generation goes through the same
// server function as intake; there are no database writes or model fallbacks.
const names = ["synthetic-column-voids", "synthetic-blockwork", "synthetic-unprotected-edge"];
const option = process.argv.slice(2);
if (option.length > 1 || (option.length === 1 && !option[0].startsWith("--photo="))) {
  throw new Error("Use no arguments or --photo=<saved demo image name>.");
}
const selected = option[0]?.slice("--photo=".length);
if (option.length && (!selected || !names.includes(selected))) throw new Error("Unknown demo image.");
const output = "supabase/.temp/task-9/demo-photo-analysis.json";
type Call = { http_status?: number; response?: unknown; error?: string };
type Record = { path: string; sha256: string; calls: Call[] } & Awaited<ReturnType<typeof analysePhoto>>;
let records: Record[] = [];
try {
  const prior = JSON.parse(await readFile(output,"utf8"));
  if (prior.model === PHOTO_MODEL && Array.isArray(prior.results)) records = prior.results;
} catch { /* A first run starts a new manifest. The browser validates it. */ }
await mkdir("supabase/.temp/task-9",{recursive:true});
const nativeFetch = globalThis.fetch;
let calls: Call[] = [];
globalThis.fetch = async (...args) => {
  try {
    const response = await nativeFetch(...args);
    const body = await response.clone().json().catch(() => null);
    const redacted = JSON.stringify(body)?.split(process.env.GEMINI_API_KEY ?? "__missing_key__").join("[credential]");
    calls.push({http_status:response.status,response:redacted ? JSON.parse(redacted) : null});
    return response;
  } catch(error) {
    calls.push({error:error instanceof Error ? error.name : "request_failed"});
    throw error;
  }
};
try {
  for(const name of selected ? [selected] : names) {
    const path = `public/demo/photos/${name}.jpg`, bytes = new Uint8Array(await readFile(path));
    calls = [];
    const result = await analysePhoto({bytes,contentType:"image/jpeg"});
    const record = {path,sha256:createHash("sha256").update(bytes).digest("hex"),...result,calls};
    await writeFile(`supabase/.temp/task-9/demo-analysis-attempt-${randomUUID()}.json`,JSON.stringify({at:new Date().toISOString(),model:PHOTO_MODEL,...record},null,2),{flag:"wx"});
    records = [...records.filter(item=>item.path !== path),record];
    await writeFile(output,JSON.stringify({at:new Date().toISOString(),model:PHOTO_MODEL,
      mode:"Actual analysis of labelled synthetic demo images; no database writes",results:records},null,2));
    console.info(`${name}: ${result.status}; ${result.findings?.defects.length ?? 0} possible defects, ${result.findings?.safety_concerns.length ?? 0} possible safety concerns.`);
    if(result.status !== "analysed") process.exitCode = 1;
  }
} finally { globalThis.fetch = nativeFetch; }
