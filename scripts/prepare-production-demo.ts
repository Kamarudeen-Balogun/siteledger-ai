import { mkdir, writeFile } from "node:fs/promises";
import { getDemoReport } from "../lib/reports/data";
import { getDemoDisputeLog } from "../lib/log/data";

// Read only the original public fiction. Never export genuine uploads or logs.
async function main() {
const [report, log] = await Promise.all([getDemoReport(), getDemoDisputeLog()]);
if (!report || !log || report.status !== "locked" || !report.document.source.project.is_demo || !log.is_demo
  || report.id !== "40000000-0000-4000-8000-000000000004"
  || report.document.source.submission_id !== "30000000-0000-4000-8000-000000000004"
  || report.document.source.photos.length || report.document.source.guest_origin
  || log.entries.some(entry => !/^40000000-0000-4000-8000-0000000000(0[1-9]|1[0-2])$/.test(entry.report_id))) {
  throw new Error("The original fictional demonstration could not be verified. Nothing was exported.");
}
// Use the existing local/HTTPS preview's verified PDF renderer. It avoids a
// second Node module format and consumes no Vercel runtime for this preparation.
const app = process.env.SITELEDGER_APP_URL;
if (!app) throw new Error("Set the trusted application preview origin first.");
const response = await fetch(new URL("/api/reports/demo/pdf", app), { headers: { "ngrok-skip-browser-warning": "true" }, redirect: "error", signal: AbortSignal.timeout(30000) });
if (!response.ok || !response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error("Verified demo PDF unavailable.");
const pdf = Buffer.from(await response.arrayBuffer());
if (!pdf.subarray(0, 4).equals(Buffer.from("%PDF")) || pdf.length > 4500000) throw new Error("Verified demo PDF is invalid.");
await mkdir("public/demo", { recursive: true });
await mkdir("lib/data", { recursive: true });
await writeFile("lib/data/demo-documents.json", JSON.stringify({ report, log }, null, 2) + "\n");
await writeFile("public/demo/siteledger-demo.pdf", pdf);
console.log("Original fictional report, log and PDF prepared as static assets; no genuine evidence changed.");
}
main().catch(() => { console.error("The verified public demonstration could not be prepared. No credentials were printed."); process.exitCode = 1; });
