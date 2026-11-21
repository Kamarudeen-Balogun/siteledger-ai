import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { chromium,type Page,type BrowserContext } from "@playwright/test";
import { createReviewToken } from "../lib/confirm/access";
import { createHmac } from "node:crypto";
const database=process.env.SITELEDGER_WEB_QA_DATABASE;
if(!database||!/^siteledger_web_qa_[a-f0-9]{8}$/.test(database))throw new Error("Use npm run test:web-browser with its disposable database.");
const base="http://127.0.0.1:3014",project="10000000-0000-4000-8000-000000000001",source="7a000000-0000-4000-8000-000000000090";
function sql(input:string) {
  const result=spawnSync("docker",["exec","-i","supabase_db_siteledger-ai","psql","-U","postgres","-d",database!,"-v","ON_ERROR_STOP=1","-At"],{input,encoding:"utf8",windowsHide:true});
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
async function state(page:Page) {
  return page.evaluate(async()=>new Promise<Array<{id:string;status:string;bytes:number[];project:string;captured:string}>>((resolve,reject)=>{
    const request=indexedDB.open("siteledger-web-queue",1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{
      const db=request.result,read=db.transaction("notes").objectStore("notes").getAll();read.onsuccess=()=>{resolve(read.result.map(row=>({id:row.manifest.id,status:row.status,
        bytes:row.files?.map((file:Blob)=>file.size)??[],project:row.manifest.project_id,captured:row.manifest.captured_at})));db.close();};};
  }));
}
async function sdk(context:BrowserContext) {
  await context.route("https://telegram.org/js/telegram-web-app.js",route=>route.fulfill({contentType:"application/javascript",body:"window.Telegram={WebApp:{initData:'',ready(){},expand(){}}};"}));
}
const voice=()=>{const value=Buffer.alloc(32044);value.write("RIFF",0);value.writeUInt32LE(value.length-8,4);value.write("WAVEfmt ",8);value.writeUInt32LE(16,16);value.writeUInt16LE(1,20);value.writeUInt16LE(1,22);value.writeUInt32LE(16000,24);value.writeUInt32LE(32000,28);value.writeUInt16LE(2,32);value.writeUInt16LE(16,34);value.write("data",36);value.writeUInt32LE(32000,40);return value;};
test("offline recording survives reload, automatically sends on reconnection, and lost replies/two tabs do not duplicate a note",{timeout:150000},async()=>{
  await mkdir("supabase/.temp/task-10",{recursive:true});
  sql(`insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7700090,'Offline web QA','${project}','foreman');
    insert into public.submissions(id,project_id,telegram_id,submitted_by,source,status) values('${source}','${project}',7700090,'Offline web QA','telegram','received');`);
  const token=createReviewToken(source,7700090,"local-web-preview");
  const browser=await chromium.launch({headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:["microphone"],serviceWorkers:"allow"});await sdk(context);
  const page=await context.newPage();const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));page.setDefaultTimeout(25000);
  try {
    await page.goto(`${base}/today#from=${source}&access=${encodeURIComponent(token)}`,{waitUntil:"networkidle"});
    await page.getByRole("button",{name:"Record voice note",exact:true}).waitFor();
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.waitForFunction(async()=>{const cache=await caches.open("siteledger-today-v1");return !!await cache.match("/today");});
    await context.setOffline(true);await page.getByText("Offline. Saved notes stay on this device and will send when data returns.",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Record voice note",exact:true}).click();
    await page.getByRole("button",{name:/Stop recording/}).waitFor();await new Promise(resolve=>setTimeout(resolve,1300));
    await page.evaluate(()=>{const original=window.createImageBitmap;window.createImageBitmap=async image=>{await new Promise(resolve=>setTimeout(resolve,750));return original(image);};});
    const image=await readFile("public/demo/photos/synthetic-column-voids.jpg");
    await page.locator('input[type="file"][accept^="image/"]').setInputFiles({name:"synthetic-column.jpg",mimeType:"image/jpeg",buffer:image});
    await page.getByText("Preparing photos…",{exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:/Stop recording/}).isEnabled(),true);
    await page.getByRole("button",{name:/Stop recording/}).click();await page.getByText("Voice note ready",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Queue this site note",exact:true}).click();
    await page.getByText("Queued — will send when data returns.",{exact:true}).waitFor();const queued=(await state(page))[0];
    assert.equal(queued.bytes.length,2);assert.ok(queued.bytes[0]>12);assert.ok(queued.bytes[1]<1024*1024);assert.equal(queued.project,project);
    assert.equal(sql(`select count(*) from public.submissions where id='${queued.id}';`),"0");
    await page.screenshot({path:"supabase/.temp/task-10/offline-queued-mobile.png",fullPage:true});
    await page.reload({waitUntil:"domcontentloaded"});await page.getByText("Queued — will send when data returns.",{exact:true}).waitFor();
    assert.deepEqual((await state(page))[0],queued);
    const cacheContents=await page.evaluate(async()=>{const cache=await caches.open("siteledger-today-v1");return {urls:(await cache.keys()).map(request=>request.url),shell:await (await cache.match("/today"))!.text()};});
    assert.ok(cacheContents.urls.every(url=>{const path=new URL(url).pathname;return path==="/today"||path.startsWith("/_next/static/")||path.startsWith("/fonts/");}));
    assert.equal(cacheContents.shell.includes("Offline web QA"),false);assert.equal(cacheContents.urls.some(url=>url.includes("access=")),false);
    let lost=false;
    await context.route("**/api/web/submissions/*/media/1",async route=>{
      if(!lost){lost=true;await route.fetch();await route.abort("failed");}else await route.continue();
    });
    await context.setOffline(false);
    const second=await context.newPage();await second.goto(`${base}/today`,{waitUntil:"domcontentloaded"});
    await page.getByRole("link",{name:"Review site note",exact:true}).waitFor({timeout:65000});
    assert.ok(lost);const sent=(await state(page))[0];assert.equal(sent.id,queued.id);assert.equal(sent.status,"sent");assert.equal(sent.bytes.length,0);
    assert.equal(sql(`select count(*) from public.submissions where id='${queued.id}';`),"1");
    assert.equal(sql(`select count(*) from public.submission_photos where submission_id='${queued.id}';`),"1");
    assert.equal(sql(`select created_at=(select (manifest->>'captured_at')::timestamptz from public.web_intakes where id='${queued.id}') from public.submissions where id='${queued.id}';`),"t");
    assert.equal(sql(`select count(*) from public.reports where submission_id='${queued.id}';`),"0");
    await page.screenshot({path:"supabase/.temp/task-10/sent-mobile.png",fullPage:true});
    await second.close();await page.getByRole("link",{name:"Review site note",exact:true}).click();
    await page.getByText("We couldn’t read this note reliably. Your audio and photos are saved. Enter what happened below.",{exact:true}).waitFor();
    assert.equal((await page.locator("audio").count()),1);assert.equal((await page.locator("img").count()),1);
    await page.getByRole("button",{name:"Add work item",exact:true}).click();
    await page.locator('[name="w0.description"]').fill("Blockwork — East elevation");
    await page.locator('[name="w0.quantity"]').fill("18");await page.locator('[name="w0.crew"]').fill("6");
    await page.locator('[name="w0.boq"]').selectOption("20000000-0000-4000-8000-000000000006");
    await page.locator('[name="w0.confidence"]').fill("1");
    await page.getByRole("button",{name:"Confirm and cost it",exact:true}).click();
    await page.waitForURL(url=>url.pathname===`/reports/${queued.id}`,{waitUntil:"domcontentloaded"});
    assert.ok((await page.locator(".report-document").innerText()).includes("₦261,000"));
    await page.screenshot({path:"supabase/.temp/task-10/web-report.png",fullPage:true});
    const pdf=await page.getByRole("link",{name:/PDF/}).getAttribute("href");assert.ok(pdf);
    const document=await page.request.get(new URL(pdf,base).toString());assert.equal(document.status(),200);await writeFile("supabase/.temp/task-10/web-report.pdf",await document.body());
    assert.equal(errors.length,0,errors.join("\n"));
  }finally{await browser.close();}
});
test("file uploads remain queued after project access is removed; switching projects never reassigns media",{timeout:90000},async()=>{
  const sid="7a000000-0000-4000-8000-000000000091",other="7a000000-0000-4000-8000-000000000093";
  sql(`insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7700091,'Blocked web QA','${project}','foreman');
    insert into public.submissions(id,project_id,telegram_id,submitted_by,source) values('${sid}','${project}',7700091,'Blocked web QA','telegram');`);
  const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844}});await sdk(context);const page=await context.newPage();
  try {
    const token=createReviewToken(sid,7700091,"local-web-preview");await page.goto(`${base}/today#from=${sid}&access=${encodeURIComponent(token)}`,{waitUntil:"networkidle"});
    await context.setOffline(true);
    await page.locator('input[type="file"][accept^="audio/"]').setInputFiles({name:"voice.wav",mimeType:"audio/wav",buffer:voice()});
    await page.locator('input[type="file"][accept^="image/"]').setInputFiles({name:"synthetic-blockwork.jpg",mimeType:"image/jpeg",buffer:await readFile("public/demo/photos/synthetic-blockwork.jpg")});
    await page.getByRole("button",{name:"Queue this site note",exact:true}).click();await page.getByText("Queued — will send when data returns.",{exact:true}).waitFor();const saved=(await state(page))[0];
    sql(`insert into public.projects(id,project_code,name,client,location) values('${other}','WEB-BLOCKED-QA','Other authorized QA project','Fictional','Local QA');
      update public.telegram_users set project_id='${other}' where telegram_id=7700091;`);
    await context.setOffline(false);await page.getByText("Project access or this queued note is unavailable. Reopen its original project.",{exact:true}).waitFor();
    const blocked=(await state(page))[0];assert.equal(blocked.status,"blocked");assert.deepEqual(blocked.bytes,saved.bytes);assert.equal(blocked.project,project);
    assert.equal(sql(`select count(*) from public.submissions where id='${saved.id}';`),"0");
    const newSource="7a000000-0000-4000-8000-000000000094";
    sql(`insert into public.submissions(id,project_id,telegram_id,submitted_by,source) values('${newSource}','${other}',7700091,'Blocked web QA','telegram');`);
    const newToken=createReviewToken(newSource,7700091,"local-web-preview");
    await page.goto(`${base}/today#from=${newSource}&access=${encodeURIComponent(newToken)}`,{waitUntil:"networkidle"});
    await page.getByText("Queued for its original project. Reopen that authorized project to send it.",{exact:true}).waitFor();
    assert.equal((await state(page))[0].project,project);assert.equal((await state(page))[0].id,saved.id);assert.deepEqual((await state(page))[0].bytes,saved.bytes);
    await page.screenshot({path:"supabase/.temp/task-10/blocked-original-project.png",fullPage:true});
    assert.equal(sql(`select count(*) from public.submissions where id='${saved.id}';`),"0");
  }finally{await browser.close();}
});
test("Telegram launch data survives SDK loading; a first note needs no old submission and an unlinked account sees no cached project",{timeout:60000},async()=>{
  sql(`insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7700092,'First web note QA','${project}','foreman');`);
  function signed(actor:number) {
    const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:actor,is_bot:false})});
    const check=[...fields].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join("\n");
    fields.set("hash",createHmac("sha256",createHmac("sha256","WebAppData").update("test-web-bot-token").digest()).update(check).digest("hex"));return fields.toString();
  }
  const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route("https://telegram.org/js/telegram-web-app.js",route=>route.fulfill({contentType:"application/javascript",
    body:"window.Telegram={WebApp:{initData:new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData')||'',ready(){},expand(){}}};"}));
  try {
    const page=await context.newPage();await page.goto(`${base}/today#tgWebAppData=${encodeURIComponent(signed(7700092))}`,{waitUntil:"networkidle"});
    await page.getByText("First web note QA · Africa/Lagos",{exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Record voice note",exact:true}).isDisabled(),false);
    assert.equal(sql("select count(*) from public.submissions where telegram_id=7700092;"),"0");
    const stranger=await context.newPage();await stranger.goto(`${base}/today#tgWebAppData=${encodeURIComponent(signed(7700999))}`,{waitUntil:"networkidle"});
    await stranger.getByText("Project access is unavailable. Your queued notes stay on this device.",{exact:true}).waitFor();
    assert.equal(await stranger.getByRole("button",{name:"Record voice note",exact:true}).count(),0);
    assert.equal((await stranger.locator("main").innerText()).includes("4-Bedroom Duplex"),false);
    assert.equal(sql("select count(*) from public.telegram_users where telegram_id=7700999;"),"0");
  }finally{await browser.close();}
});
