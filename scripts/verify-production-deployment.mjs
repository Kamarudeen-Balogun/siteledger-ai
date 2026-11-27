import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Read-only deployment checks. Real phone, CAPTCHA, email ownership and voice
// acceptance must still be exercised by the builder; this script bypasses none.
const origin = "https://siteledger-ai.vercel.app";
const out = "supabase/.temp/task-13";
const checks = [];
async function request(path, options = {}) {
  const response = await fetch(origin + path, {
    ...options, redirect: "error", signal: AbortSignal.timeout(30000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  checks.push({ path, status: response.status, bytes: bytes.length,
    type: response.headers.get("content-type"), cache: response.headers.get("cache-control"),
    edge_cache: response.headers.get("x-vercel-cache"), matched_path: response.headers.get("x-matched-path") });
  return { response, bytes };
}
await mkdir(out, { recursive: true });
for (const path of ["/", "/help", "/contact", "/privacy", "/terms", "/reports/demo", "/log/demo", "/account"]) {
  const { response, bytes } = await request(path);
  assert.equal(response.status, 200, path);
  assert.match(bytes.toString(), /SiteLedger/);
}
const expectedPdf = await readFile("public/demo/siteledger-demo.pdf");
for (const path of ["/api/reports/demo/pdf", "/demo/siteledger-demo.pdf"]) {
  const { response, bytes } = await request(path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.match(response.headers.get("cache-control"), /public/);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), createHash("sha256").update(expectedPdf).digest("hex"));
}
const { response: accountResponse, bytes: accountBody } = await request("/api/account");
assert.equal(accountResponse.status, 200);
assert.equal(JSON.parse(accountBody).account, null);
assert.match(accountResponse.headers.get("cache-control"), /private, no-store/);
for (const [path, status] of [
  ["/api/projects/private", 401],
  ["/api/reports/40000000-0000-4000-8000-000000000004/pdf", 404],
  ["/api/confirm/30000000-0000-4000-8000-000000000004/media/audio", 404],
  ["/api/trial/media/audio", 404],
]) {
  const { response } = await request(path);
  assert.equal(response.status, status, path);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
}
for (const [path, body, headers, status] of [
  ["/api/telegram/webhook", {}, { "Content-Type": "application/json" }, 401],
  ["/api/trial/finish", {}, { "Content-Type": "application/json", Origin: origin }, 401],
  ["/api/account/signin", {}, { "Content-Type": "application/json", Origin: "https://example.invalid" }, 403],
]) {
  const { response } = await request(path, { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(response.status, status, path);
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/", "/reports/demo", "/log/demo"]) {
      const response = await page.goto(origin + path);
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator("h1").count(), 1, path);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflow at ${width}`);
      await page.screenshot({ path: `${out}/production-${path === "/" ? "landing" : path.replaceAll("/", "-")}-${width}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
await writeFile(`${out}/production-checks.json`, JSON.stringify(checks, null, 2) + "\n");
console.log(`Passed ${checks.length} production HTTP checks and public browser layouts at 390/768/1440px. No accounts, uploads or reports were created.`);
