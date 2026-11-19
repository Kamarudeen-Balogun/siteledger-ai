import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createReviewToken } from "../lib/confirm/access";
const base = "http://127.0.0.1:3012", id = "90000000-0000-4000-8000-000000000082";
const project = "90000000-0000-4000-8000-000000000080", boq = "90000000-0000-4000-8000-000000000081";
const database = process.env.SITELEDGER_LOG_QA_DATABASE;
if (!database || !/^siteledger_log_qa_[a-f0-9]{8}$/.test(database)) throw new Error("Use npm run test:log-browser to create a disposable test database.");
function sql(input: string) {
  const result = spawnSync("docker", ["exec","-i","supabase_db_siteledger-ai","psql","-U","postgres","-d",database!,"-v","ON_ERROR_STOP=1","-At"],
    { input, encoding: "utf8", windowsHide: true });
  assert.equal(result.status,0,result.stderr); return result.stdout.trim();
}
test("PM locks reviewed work; UI/API/database protect originals while linked amendments remain append-only", { timeout: 90000 }, async () => {
  await mkdir("supabase/.temp/task-8",{recursive:true});
  sql(`insert into public.projects(id,project_code,name,client,location) values('${project}','LOCAL-BROWSER-LOG','Local approval QA','Fictional test','Lagos');
    insert into public.boq_items(id,project_id,item_code,description,section,unit,boq_quantity,rate) values('${boq}','${project}','BLK-01','225mm sandcrete blockwork','Blockwork','m2',420,14500);
    insert into public.telegram_users(telegram_id,display_name,project_id,role) values(800090,'QA foreman','${project}','foreman'),(800091,'QA PM','${project}','pm'),(800092,'Other foreman','${project}','foreman');
    insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status,created_at) values('${id}','${project}',800090,'QA foreman','telegram','Original browser QA transcript',
      '{"work_items":[{"description":"Blockwork — East elevation","matched_boq_hint":null,"quantity":18,"unit":"m2","crew":6,"confidence":1}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Local QA"}', 'extracted','2026-11-18 16:00:00+01');`);
  const token = createReviewToken(id,800090,"local-log-preview"), pm = createReviewToken(id,800091,"local-log-preview");
  const browser = await chromium.launch({headless:true}), page = await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  try {
    await page.goto(`${base}/confirm/${id}?access=${encodeURIComponent(token)}`,{waitUntil:"domcontentloaded"});
    await page.locator('[name="w0.boq"]').selectOption(boq);
    await page.getByRole("button",{name:"Confirm and cost it",exact:true}).click();
    await page.waitForURL(url=>url.pathname===`/reports/${id}`,{waitUntil:"domcontentloaded"});
    await page.getByText("₦261,000",{exact:true}).first().waitFor();
    assert.equal(sql(`select public.latest_confirmation_submission(800091);`),id);
    assert.equal(await page.getByRole("button",{name:"Approve and lock report",exact:true}).count(),0);
    await page.getByText("Awaiting project manager approval.",{exact:false}).waitFor();
    await page.goto(`${base}/reports/${id}?access=${encodeURIComponent(pm)}`,{waitUntil:"domcontentloaded"});
    await page.getByRole("checkbox").check();
    await page.getByRole("button",{name:"Approve and lock report",exact:true}).click();
    await page.locator(".report-stamp").waitFor();
    assert.equal(sql(`select public.latest_confirmation_submission(800091);`),id);
    assert.equal(await page.getByRole("link",{name:"Correct site note",exact:true}).count(),0);
    assert.equal(await page.getByRole("button",{name:"Rebuild draft report",exact:true}).count(),0);
    assert.equal(await page.getByRole("button",{name:"Approve and lock report",exact:true}).count(),0);
    const before = sql(`select md5(to_jsonb(r)::text) from public.reports r where submission_id='${id}';`);
    const documentBefore = await page.locator(".report-document").innerText();
    for(const method of ["PUT","PATCH","DELETE"]) assert.equal((await page.request.fetch(`${base}/api/reports/${id}`,{method})).status(),405);
    assert.equal((await page.request.post(`${base}/api/reports/${id}`,{headers:{Origin:base,Authorization:`Bearer ${pm}`},data:{weather:"Edited"}})).status(),409);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link",{name:"Download PDF",exact:true}).click();
    const download = await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs("supabase/.temp/task-8/locked-report.pdf");
    await page.locator('[name="note"]').fill("QA inspection completed; original observation retained.");
    await page.getByRole("button",{name:"Save amendment",exact:true}).click();
    await page.getByText("Amendment saved. The original report is preserved.",{exact:true}).waitFor();
    assert.equal(await page.locator(".report-document").innerText(),documentBefore);
    assert.equal(sql(`select md5(to_jsonb(r)::text) from public.reports r where submission_id='${id}';`),before);
    const nonce="90000000-0000-4000-8000-000000000083";
    const payload={note:"A second QA correction for retry verification.",request_id:nonce};
    const endpoint=`${base}/api/reports/${id}/amendments`, headers={Origin:base,Authorization:`Bearer ${pm}`};
    const first=await page.request.post(endpoint,{headers,data:payload}),second=await page.request.post(endpoint,{headers,data:payload});
    assert.equal(first.status(),200);assert.equal(second.status(),200);assert.deepEqual(await first.json(),await second.json());
    assert.equal((await page.request.post(endpoint,{headers,data:{...payload,note:"Changed retry"}})).status(),409);
    assert.equal((await page.request.delete(endpoint,{headers})).status(),405);
    assert.equal(sql(`select count(*) from public.amendments a join public.reports r on r.id=a.report_id where r.submission_id='${id}';`),"2");
    await page.getByRole("link",{name:"Dispute log",exact:true}).click();
    await page.getByText("QA inspection completed; original observation retained.",{exact:true}).waitFor();
    assert.equal(await page.getByRole("link",{name:"Open original report",exact:true}).count(),2);
    await page.screenshot({path:"supabase/.temp/task-8/mobile-log.png",fullPage:true});
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:"supabase/.temp/task-8/desktop-log.png",fullPage:true});
    const stranger=createReviewToken(id,800092,"local-log-preview");
    await page.goto(`${base}/log/${id}?access=${encodeURIComponent(stranger)}`,{waitUntil:"domcontentloaded"});
    await page.getByText("Open the private dispute log",{exact:false}).waitFor();
    assert.equal(await page.getByText("QA inspection completed; original observation retained.",{exact:true}).count(),0);
    await page.goto(`${base}/log/demo`,{waitUntil:"domcontentloaded"});
    await page.getByText("Fictional demo history and illustrative NGN rates.",{exact:true}).waitFor();
    assert.equal(await page.locator("ol > li").count(),13);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    assert.deepEqual(errors,[]);
    console.info("PASS: PM handoff, locked UI/API, PDF, preserved source, amendment retries, private ordered log and public demo.");
  } catch(error) {await page.screenshot({path:"supabase/.temp/task-8/browser-failure.png",fullPage:true}).catch(()=>{});throw error;}
  finally {await browser.close();}
});
