import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createReviewToken } from "../lib/confirm/access";

const database = process.env.SITELEDGER_PHOTO_QA_DATABASE;
if (!database || !/^siteledger_photo_qa_[a-f0-9]{8}$/.test(database)) throw new Error("Use npm run test:photos-browser with its disposable database.");
const base = "http://127.0.0.1:3013", id = "79000000-0000-4000-8000-000000000091";
const project = "10000000-0000-4000-8000-000000000001", boq = "20000000-0000-4000-8000-000000000006";
const first = "79000000-0000-4000-8000-000000000092", second = "79000000-0000-4000-8000-000000000093", third = "79000000-0000-4000-8000-000000000094";
const lease = "79000000-0000-4000-8000-000000000095";
const raw = { likely_work_item: "Concrete column", confidence: 0.8,
  defects: [{ description: "Surface voids visible", confidence: 0.8 }], safety_concerns: [{ description: "PPE is unclear", confidence: 0.3 }] };
function sql(input: string) {
  const result = spawnSync("docker",["exec","-i","supabase_db_siteledger-ai","psql","-U","postgres","-d",database!,"-v","ON_ERROR_STOP=1","-At"],
    { input, encoding: "utf8", windowsHide: true });
  assert.equal(result.status,0,result.stderr); return result.stdout.trim();
}

test("photo refresh preserves human edits; dismissal, low confidence and manual fallback reach the report and PDF", { timeout: 90000 }, async () => {
  await mkdir("supabase/.temp/task-9",{recursive:true});
  sql(`insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7900091,'Photo browser QA', '${project}','foreman');
    insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status,created_at)
      values('${id}','${project}',7900091,'Photo browser QA','telegram','Original photo browser QA transcript',
      '{"work_items":[{"description":"Blockwork — East elevation","matched_boq_hint":null,"quantity":18,"unit":"m2","crew":6,"confidence":1}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Local QA"}', 'extracted','2026-11-19 16:00:00+01');
    insert into public.submission_photos(id,submission_id,storage_url) values
      ('${first}','${id}','site-evidence/${project}/${id}/7900091.jpg'),
      ('${second}','${id}','site-evidence/${project}/${id}/7900092.jpg'),
      ('${third}','${id}','site-evidence/${project}/${id}/7900093.jpg');
    select public.claim_photo_analysis('${first}','${lease}');
    select public.claim_photo_analysis('${second}','${lease}');
    select public.finish_photo_analysis('${second}','${lease}','${JSON.stringify(raw)}',null);`);
  const token = createReviewToken(id,7900091,"local-photo-preview");
  const browser = await chromium.launch({headless:true}), page = await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(20000);
  const errors:string[] = []; page.on("pageerror",error => errors.push(error.message));
  try {
    await page.goto(`${base}/confirm/${id}?access=${encodeURIComponent(token)}`,{waitUntil:"domcontentloaded"});
    assert.equal(await page.getByRole("button",{name:"Confirm and cost it",exact:true}).isDisabled(),true);
    await page.locator('[name="w0.quantity"]').fill("19");
    await page.locator('[name="w0.boq"]').selectOption(boq);
    const firstNote = page.locator(`[name="photo.${first}"]`), secondNote = page.locator(`[name="photo.${second}"]`);
    await firstNote.fill("Engineer observation typed while analysis is pending.");
    assert.equal(await secondNote.inputValue(), "Possible work item: Concrete column\nPossible defect: Surface voids visible");
    await secondNote.fill((await secondNote.inputValue()) + "\nEngineer checked the second image.");
    await page.getByRole("button",{name:"Dismiss Possible defect: Surface voids visible",exact:true}).click();
    assert.equal(await secondNote.inputValue(), "Possible work item: Concrete column\nEngineer checked the second image.");
    assert.equal((await secondNote.inputValue()).includes("PPE"),false);
    await page.getByText("Check this one — type your own observation if you agree.", {exact:true}).waitFor();

    // Complete the held job only after typing, exercising the real polling refresh.
    sql(`select public.finish_photo_analysis('${first}','${lease}','${JSON.stringify(raw)}',null);`);
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled);
    assert.equal(await firstNote.inputValue(), "Engineer observation typed while analysis is pending.");
    assert.equal(await page.locator('[name="w0.quantity"]').inputValue(), "19");
    assert.equal(await secondNote.inputValue(), "Possible work item: Concrete column\nEngineer checked the second image.");
    await page.getByText("Photo analysis is unavailable. Your photo is saved; add your observations below.", {exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Dismiss Possible defect: Surface voids visible",exact:true}).count(),1);
    await page.getByRole("button",{name:"Dismiss Possible defect: Surface voids visible",exact:true}).click();
    assert.equal(await firstNote.inputValue(), "Engineer observation typed while analysis is pending.");
    await page.locator(`[name="photo.${third}"]`).fill("Manual observation after provider failure.");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path:"supabase/.temp/task-9/photo-confirm-mobile.png",fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:"supabase/.temp/task-9/photo-confirm-desktop.png",fullPage:true});
    await page.getByRole("button",{name:"Confirm and cost it",exact:true}).click();
    await page.waitForURL(url => url.pathname === `/reports/${id}`,{waitUntil:"domcontentloaded"});
    const report = await page.locator(".report-document").innerText();
    assert.ok(report.includes("₦275,500"));
    assert.ok(report.includes("Engineer observation typed while analysis is pending."));
    assert.ok(report.includes("Engineer checked the second image."));
    assert.ok(report.includes("Manual observation after provider failure."));
    assert.equal(report.includes("Surface voids visible"),false); assert.equal(report.includes("PPE is unclear"),false);
    const response = await page.request.get(`${base}/api/reports/${id}/pdf?access=${encodeURIComponent(token)}`);
    assert.equal(response.status(),200); assert.equal((await response.body()).subarray(0,5).toString(),"%PDF-");
    assert.equal(sql(`select ai_findings::text from public.submission_photos where id='${first}';`),sql(`select '${JSON.stringify(raw)}'::jsonb::text;`));
    assert.equal(sql(`select transcript from public.submissions where id='${id}';`),"Original photo browser QA transcript");
    assert.equal((await page.request.get(`${base}/api/confirm/${id}/media/${first}`)).status(),404);
    assert.equal(errors.length,0,errors.join("\n"));
  } finally { await browser.close(); }
});
