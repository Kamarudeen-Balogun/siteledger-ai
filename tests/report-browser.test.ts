import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createReviewToken } from "../lib/confirm/access";

// Requires a production local preview started with:
// node scripts/configure-local-env.mjs --serve --report-preview
const base = "http://127.0.0.1:3010", id = "70000000-0000-4000-8000-000000000072";
const boq = "20000000-0000-4000-8000-000000000006", reviewer = 7000710;
function sql(input: string) {
  const result = spawnSync("docker", ["exec", "-i", "supabase_db_siteledger-ai", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    { input, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
test("mobile confirmation creates a draft, weather survives corrections, PDF downloads and private access is enforced", async () => {
  const token = createReviewToken(id, reviewer, "local-report-preview");
  await mkdir("supabase/.temp/task-7", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
  sql(`begin;
    insert into public.telegram_users(telegram_id,display_name,project_id,role) values(${reviewer},'Report browser test foreman','10000000-0000-4000-8000-000000000001','foreman');
    insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status,created_at)
    values('${id}','10000000-0000-4000-8000-000000000001',${reviewer},'Report browser test foreman','telegram','Original browser test transcript',
      '{"work_items":[{"description":"Blockwork — East elevation","matched_boq_hint":null,"quantity":null,"unit":"m2","crew":6,"confidence":0.3}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Pidgin"}',
      'extracted','2026-11-18 16:00:00+01'); commit;`);
    await page.goto(`${base}/confirm/${id}?access=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
    console.info("Browser check: private confirmation opened");
    await page.locator('[name="w0.description"]').fill("Blockwork — East elevation");
    await page.locator('[name="w0.quantity"]').fill("18");
    await page.locator('[name="w0.boq"]').selectOption(boq);
    await page.locator('[name="w0.unit"]').fill("m2");
    await page.locator('[name="w0.crew"]').fill("6");
    await page.getByRole("button", { name: "Confirm and cost it", exact: true }).click();
    await page.waitForURL(url => url.pathname === `/reports/${id}`, { waitUntil: "domcontentloaded" });
    await page.getByText("₦261,000", { exact: true }).first().waitFor();
    console.info("Browser check: confirmed work became a draft");
    assert.equal(await page.locator(".report-stamp").count(), 0);
    assert.ok((await page.locator(".report-document").innerText()).includes("Perkins Limited"));
    assert.ok((await page.locator(".report-document").innerText()).includes("Draft — awaiting approval"));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: "supabase/.temp/task-7/mobile-report.png", fullPage: true });
    await page.getByText("Change weather or rebuild this draft", { exact: true }).click();
    await page.locator('[name="weather"]').fill("Rain stopped work, 2 hrs");
    await page.getByRole("button", { name: "Rebuild draft report", exact: true }).click();
    await page.locator(".report-document").getByText("Rain stopped work, 2 hrs", { exact: true }).waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download PDF", exact: true }).click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    await download.saveAs("supabase/.temp/task-7/browser-report.pdf");
    await page.getByRole("link", { name: "Correct site note", exact: true }).click();
    await page.locator('[name="w0.quantity"]').fill("19");
    await page.getByRole("button", { name: "Confirm changes and rebuild report", exact: true }).click();
    await page.waitForURL(url => url.pathname === `/reports/${id}`, { waitUntil: "domcontentloaded" });
    await page.getByText("₦275,500", { exact: true }).first().waitFor();
    assert.ok((await page.locator(".report-document").innerText()).includes("Rain stopped work, 2 hrs"));
    assert.equal(sql(`select count(*) from public.reports where submission_id='${id}';`), "1");
    assert.equal(sql(`select transcript from public.submissions where id='${id}';`), "Original browser test transcript");
    assert.equal((await page.request.get(`${base}/api/reports/${id}/pdf`)).status(), 404);
    const stranger = createReviewToken(id, reviewer + 1, "local-report-preview");
    assert.equal((await page.request.get(`${base}/api/reports/${id}/pdf?access=${encodeURIComponent(stranger)}`)).status(), 404);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "supabase/.temp/task-7/desktop-report.png", fullPage: true });
    await page.goto(`${base}/reports/demo`, { waitUntil: "domcontentloaded" });
    await page.getByText("Over BoQ quantity — check this item.", { exact: true }).waitFor();
    assert.equal(await page.locator(".report-stamp").count(), 1);
    assert.equal(await page.locator(".report-variance").first().evaluate(element => getComputedStyle(element).color), "rgb(185, 28, 28)");
    await page.screenshot({ path: "supabase/.temp/task-7/demo-web.png", fullPage: true });
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: "supabase/.temp/task-7/browser-failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
    sql(`begin; delete from public.report_items where submission_id='${id}'; delete from public.reports where submission_id='${id}' and status='draft';
      delete from public.submissions where id='${id}' and telegram_id=${reviewer}; delete from public.telegram_users where telegram_id=${reviewer}; commit;`);
  }
});
