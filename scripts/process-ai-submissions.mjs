import nextEnv from "@next/env";
import { processSubmission } from "../lib/ai/process-submission.ts";

nextEnv.loadEnvConfig(process.cwd());
try {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)) throw new Error("Missing configuration.");
  const requestedId = process.argv[2];
  if (requestedId && !/^[a-f0-9-]{36}$/.test(requestedId)) throw new Error("Invalid submission ID.");
  const query = new URLSearchParams({ select: "submission_id", status: "in.(queued,processing)", order: "created_at.asc", limit: "10" });
  if (requestedId) query.set("submission_id", `eq.${requestedId}`);
  const url = new URL("/rest/v1/submission_ai_jobs", base);
  url.search = query.toString();
  const response = await fetch(url, { headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Queue unavailable.");
  const jobs = await response.json();
  for (const job of jobs) {
    const status = await processSubmission(job.submission_id);
    console.log(`${job.submission_id}: ${status}`);
    if (status !== "extracted" && status !== "skipped") process.exitCode = 1;
  }
  if (!jobs.length) console.log("No queued voice submissions.");
} catch {
  console.error("Voice processing could not start. Check the SiteLedger schema and free-provider configuration. No credentials were printed.");
  process.exitCode = 1;
}
