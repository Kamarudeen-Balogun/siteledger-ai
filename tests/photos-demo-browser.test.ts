import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { createReviewToken } from "../lib/confirm/access";
import { PHOTO_MODEL } from "../lib/ai/analyse-photo";
import { parsePhotoAnalysis, photoSuggestions, suggestedPhotoNote } from "../lib/ai/photo-schema";

const database = process.env.SITELEDGER_PHOTO_QA_DATABASE;
if (!database || !/^siteledger_photo_qa_[a-f0-9]{8}$/.test(database)) throw new Error("Use the disposable photos-demo browser runner.");
const base = "http://127.0.0.1:3013", id = "79000000-0000-4000-8000-000000000091";
const project = "10000000-0000-4000-8000-000000000001", boq = "20000000-0000-4000-8000-000000000006";
const photos = ["79000000-0000-4000-8000-000000000092", "79000000-0000-4000-8000-000000000093", "79000000-0000-4000-8000-000000000094"];
const lease = "79000000-0000-4000-8000-000000000095";
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
function sql(input: string) {
  const result = spawnSync("docker",["exec","-i","supabase_db_siteledger-ai","psql","-U","postgres","-d",database!,"-v","ON_ERROR_STOP=1","-At"],
    { input, encoding:"utf8", windowsHide:true });
  assert.equal(result.status,0,result.stderr); return result.stdout.trim();
}

test("actual synthetic-photo provider response can be dismissed without losing human notes or leaking into the report", {timeout:90000}, async () => {
  // These files retain actual responses from analysePhoto(). This check makes no
  // AI request and must fail if the recorded provider acceptance is absent.
  const manifest = JSON.parse(await readFile("supabase/.temp/task-9/demo-photo-analysis.json","utf8"));
  assert.equal(manifest.model,PHOTO_MODEL);
  const records = ["synthetic-column-voids","synthetic-blockwork","synthetic-unprotected-edge"]
    .map(name=>manifest.results.find((record: {path:string})=>record.path === `public/demo/photos/${name}.jpg`));
  const findings = [];
  for(const record of records) {
    assert.ok(record,"Actual provider response is missing.");
    assert.equal(record.status,"analysed");
    assert.ok(record.calls.some((call: {http_status?:number}) => call.http_status === 200));
    assert.equal(createHash("sha256").update(await readFile(record.path)).digest("hex"),record.sha256);
    findings.push(parsePhotoAnalysis(JSON.stringify(record.findings)));
  }
  const defect = photoSuggestions(findings[0]).find(finding => finding.key.startsWith("defect") && finding.confidence >= 0.6);
  assert.ok(defect,"Actual column analysis must contain a dismissible defect suggestion.");
  sql(`insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7900091,'Synthetic photo QA','${project}','foreman');
    insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status,created_at)
      values('${id}','${project}',7900091,'Synthetic photo QA','telegram','Disposable synthetic photo acceptance; original transcript',
      '{"work_items":[{"description":"Blockwork — East elevation","matched_boq_hint":null,"quantity":18,"unit":"m2","crew":6,"confidence":1}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Disposable synthetic-image QA"}','extracted','2026-11-21 16:00:00+01');`);
  for(const [i,photo] of photos.entries()) sql(`insert into public.submission_photos(id,submission_id,storage_url)
    values('${photo}','${id}','site-evidence/${project}/${id}/790009${i+1}.jpg');
    select public.claim_photo_analysis('${photo}','${lease}');
    select public.finish_photo_analysis('${photo}','${lease}',${literal(JSON.stringify(findings[i]))}::jsonb,null);`);
  const token = createReviewToken(id,7900091,"local-photo-preview");
  const browser = await chromium.launch({headless:true}), page = await browser.newPage({viewport:{width:390,height:844}});
  const errors: string[] = []; page.on("pageerror",error => errors.push(error.message));
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(20000);
  try {
    await page.goto(`${base}/confirm/${id}?access=${encodeURIComponent(token)}`,{waitUntil:"domcontentloaded"});
    const note = page.locator(`[name="photo.${photos[0]}"]`);
    assert.equal(await note.inputValue(),suggestedPhotoNote(findings[0]));
    await page.getByRole("button",{name:`Dismiss ${defect.note}`,exact:true}).waitFor();
    await page.locator('[name="w0.quantity"]').fill("19");
    await page.locator('[name="w0.boq"]').selectOption(boq);
    const human = "Engineer observation: check this area on site. Synthetic demonstration only.";
    await note.fill((await note.inputValue()) + "\n" + human);
    await page.screenshot({path:"supabase/.temp/task-9/actual-photo-confirm-before-mobile.png",fullPage:true});
    await page.getByRole("button",{name:`Dismiss ${defect.note}`,exact:true}).click();
    assert.ok((await note.inputValue()).includes(human)); assert.equal((await note.inputValue()).includes(defect.note),false);
    assert.equal(await page.getByRole("button",{name:`Dismiss ${defect.note}`,exact:true}).count(),0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path:"supabase/.temp/task-9/actual-photo-confirm-after-mobile.png",fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:"supabase/.temp/task-9/actual-photo-confirm-after-desktop.png",fullPage:true});
    await page.getByRole("button",{name:"Confirm and cost it",exact:true}).click();
    await page.waitForURL(url=>url.pathname === `/reports/${id}`,{waitUntil:"domcontentloaded"});
    const report = await page.locator(".report-document").innerText();
    assert.ok(report.includes("₦275,500")); assert.ok(report.includes(human));
    assert.equal(report.includes(findings[0].defects[0].description),false);
    assert.ok(report.includes("Possible safety"));
    await page.screenshot({path:"supabase/.temp/task-9/actual-photo-report.png",fullPage:true});
    const pdf = await page.request.get(`${base}/api/reports/${id}/pdf?access=${encodeURIComponent(token)}`);
    assert.equal(pdf.status(),200); const bytes = await pdf.body(); assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
    await writeFile("supabase/.temp/task-9/actual-photo-report.pdf",bytes);
    assert.equal(sql(`select ai_findings::text from public.submission_photos where id='${photos[0]}';`),sql(`select ${literal(JSON.stringify(findings[0]))}::jsonb::text;`));
    assert.equal(sql(`select transcript from public.submissions where id='${id}';`),"Disposable synthetic photo acceptance; original transcript");
    assert.equal((await page.request.get(`${base}/api/confirm/${id}/media/${photos[0]}`)).status(),404);
    assert.equal(errors.length,0,errors.join("\n"));
  } finally { await browser.close(); }
});
