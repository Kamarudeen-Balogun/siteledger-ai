// Native Auth, SMTP and browser acceptance in a disposable local database.
// No hosted credentials, real emails or original evidence are changed.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { createServer as smtpServer } from "node:net";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd(), suffix = randomUUID().slice(0,8);
const database = `siteledger_accounts_qa_${suffix}`, dbContainer = "supabase_db_siteledger-ai";
const restName = `${database}_rest`, authName = `${database}_auth`;
const base = "http://127.0.0.1:3016", restUrl = "http://127.0.0.1:55531", authUrl = "http://127.0.0.1:55533", gateway = "http://127.0.0.1:55534";
const smtpPort = 55532, captchaToken = "XXXX.DUMMY.TOKEN.XXXX", dummyBot = "account-acceptance-dummy-bot";
const out = join(root,"supabase/.temp/task-10a/browser"), mail = [], media = new Map();
let created = false, restStarted = false, authStarted = false, preview, proxy, smtp, browser, forceAccountError = false, slowReview = false;
const keepAlive = setInterval(()=>{},1000);
function command(name,args,input) {
  const result=spawnSync(name,args,{cwd:root,input,encoding:"utf8",windowsHide:true,maxBuffer:30*1024*1024});
  if(result.status!==0) throw new Error(`Local QA command failed: ${name}: ${(result.stderr??"").replace(/postgres(?:ql)?:\/\/\S+/g,"[database connection]").replace(/eyJ[A-Za-z0-9_.-]+/g,"[credential]").slice(0,700)}`);
  return result.stdout;
}
const sql = text => command("docker",["exec","-i",dbContainer,"psql","-U","supabase_admin","-d",database,"-v","ON_ERROR_STOP=1","-tA"],text).trim();
const inspect = name=>JSON.parse(command("docker",["inspect",name]))[0];
const rest=inspect("supabase_rest_siteledger-ai"), auth=inspect("supabase_auth_siteledger-ai");
const environment=data=>Object.fromEntries(data.Config.Env.map(value=>{const i=value.indexOf("=");return [value.slice(0,i),value.slice(i+1)];}));
const restEnv=environment(rest),authEnv=environment(auth),network=Object.keys(rest.NetworkSettings.Networks).find(name=>name.includes("siteledger-ai"));
if(!network)throw new Error("Start the SiteLedger local Supabase stack first.");
const cli=spawnSync(process.env.ComSpec??"cmd.exe",["/d","/s","/c","supabase.cmd status -o json"],{cwd:root,env:{...process.env,SUPABASE_HOME:join(root,"supabase/.temp/cli-home"),SUPABASE_PROFILE:"supabase"},encoding:"utf8",windowsHide:true});
if(cli.status!==0)throw new Error("Local SiteLedger settings unavailable.");
const settings=JSON.parse(cli.stdout);
if(settings.API_URL!=="http://127.0.0.1:55421"||!settings.SERVICE_ROLE_KEY)throw new Error("Unexpected local project.");
function dockerEnv(values){return Object.entries(values).flatMap(([key,value])=>["--env",`${key}=${value}`]);}
function dbUri(value){const url=new URL(value);url.pathname=`/${database}`;return url.toString();}
async function ready(url){const end=Date.now()+45000;while(Date.now()<end){try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,300));}throw new Error("Disposable service failed to start.");}
function signedTelegram(id,query=randomUUID()) {
  const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,is_bot:false,first_name:"Untrusted metadata"}),query_id:query});
  const text=[...fields].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join("\n");
  fields.set("hash",createHmac("sha256",createHmac("sha256","WebAppData").update(dummyBot).digest()).update(text).digest("hex"));return fields.toString();
}
async function action(context,group,name,input,expected=200) {
  const response=await context.request.post(`${base}/api/${group}/${name}`,{headers:{Origin:base},data:input});
  const data=await response.json();assert.equal(response.status(),expected,`${group}/${name}: ${JSON.stringify(data)}`);return data;
}
async function codeFor(email,start=0) {
  const end=Date.now()+10000;
  while(Date.now()<end){const message=mail.slice(start).find(value=>value.includes(email));if(message){let body=message.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/=\r\n/g,"").replace(/=([0-9A-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)));const code=body.match(/\b\d{6,10}\b/);if(code){assert.equal(code[0].length,8,"Native QA Auth must issue eight-digit email codes");return code[0];}}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error("Disposable signup/recovery email code was not delivered.");
}
async function queuedNotes(page) {
  return page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open("siteledger-web-queue",1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const read=open.result.transaction("notes").objectStore("notes").getAll();read.onsuccess=()=>{resolve(read.result.map(row=>({id:row.manifest.id,status:row.status,project:row.manifest.project_id,captured:row.manifest.captured_at,actor:row.context.actor_id,name:row.context.actor_name,bytes:row.files?.map(file=>file.size)??[]})));open.result.close();};};}));
}
async function eventually(check,label) {const end=Date.now()+15000;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,200));}throw new Error(label);}
try {
  await mkdir(out,{recursive:true});
  command("docker",["exec",dbContainer,"createdb","-U","postgres","--template=template0",database]);created=true;
  sql("drop schema public cascade;");
  const dump=command("docker",["exec",dbContainer,"pg_dump","-U","postgres","-d","postgres","--schema=auth","--schema=public","--schema=extensions","--no-owner","--no-acl"]);
  sql(dump);
  sql("alter schema auth owner to supabase_auth_admin; do $$ declare item record; begin for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind in ('r','p') loop execute format('alter table auth.%I owner to supabase_auth_admin',item.relname); end loop; for item in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' loop execute format('alter function %s owner to supabase_auth_admin',item.signature); end loop; end $$;");
  sql("grant usage on schema auth to postgres; grant select on all tables in schema auth to postgres;");
  sql("grant usage on schema public to anon,authenticated,service_role,supabase_auth_admin; grant usage on schema auth to supabase_auth_admin; grant all on all tables in schema auth to supabase_auth_admin; grant all on all sequences in schema auth to supabase_auth_admin; grant execute on all functions in schema auth to supabase_auth_admin; revoke all on all tables in schema public from public,anon,authenticated; grant select,insert,update,delete on all tables in schema public to service_role; revoke all on all functions in schema public from public,anon,authenticated; grant execute on all functions in schema public to service_role; grant execute on function public.account_signup_hook(jsonb) to supabase_auth_admin;");
  smtp=smtpServer(socket=>{
    socket.setEncoding("utf8");socket.write("220 SiteLedger disposable SMTP\r\n");let buffer="",data=false,message=[];
    socket.on("data",chunk=>{buffer+=chunk;while(buffer.includes("\r\n")){const end=buffer.indexOf("\r\n"),line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(data){if(line==="."){mail.push(message.join("\r\n"));message=[];data=false;socket.write("250 Received\r\n");}else message.push(line.replace(/^\.\./,"."));}
      else if(/^EHLO|^HELO/.test(line))socket.write("250-local.test\r\n250 8BITMIME\r\n");
      else if(/^DATA/.test(line)){data=true;socket.write("354 End with dot\r\n");}
      else if(/^QUIT/.test(line)){socket.end("221 Bye\r\n");}else socket.write("250 OK\r\n");
    }});socket.on("error",()=>{});
  });
  await new Promise((resolve,reject)=>{smtp.once("error",reject);smtp.listen(smtpPort,"0.0.0.0",resolve);});
  proxy=createServer(async(request,response)=>{
    try {
      if(request.url?.startsWith("/templates/")){const name=request.url.split("/").pop();if(!["signup.html","magic-link.html","recovery.html"].includes(name)){response.writeHead(404);response.end();return;}response.writeHead(200,{"Content-Type":"text/html"});response.end(await readFile(join(root,"supabase/templates",name)));return;}
      const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>4*1024*1024){response.writeHead(413);response.end();return;}chunks.push(chunk);}
      const body=Buffer.concat(chunks),path=request.url??"/";
      if (forceAccountError && path === "/rest/v1/rpc/account_session") { response.writeHead(503,{"Content-Type":"application/json"});response.end('{"error":"private-fixture-details-must-not-appear"}');return; }
      if (slowReview && path === "/rest/v1/rpc/account_review") await new Promise(resolve=>setTimeout(resolve,1500));
      if(path.startsWith("/storage/v1/object/")){
        const object=path.slice("/storage/v1/object/".length).replace(/^authenticated\//,"");
        if(request.headers.apikey!==settings.SERVICE_ROLE_KEY){response.writeHead(404);response.end();return;}
        if(request.method==="POST"){if(media.has(object)){response.writeHead(409,{"Content-Type":"application/json"});response.end('{"statusCode":"409"}');return;}media.set(object,{bytes:body,type:request.headers["content-type"]});response.writeHead(200,{"Content-Type":"application/json"});response.end("{}");return;}
        const file=media.get(object);if(file){response.writeHead(200,{"Content-Type":file.type});response.end(file.bytes);return;}response.writeHead(404);response.end();return;
      }
      const target=path.startsWith("/rest/v1/")?restUrl:path.startsWith("/auth/v1/")?authUrl:null;
      if(!target){response.writeHead(404);response.end();return;}
      const headers=Object.fromEntries(Object.entries(request.headers).filter(([key])=>!["host","connection","content-length"].includes(key)).map(([key,value])=>[key,Array.isArray(value)?value.join(","):value]));
      const result=await fetch(new URL(path.replace(/^\/(rest|auth)\/v1/,""),target),{method:request.method,headers,body:body.length?body:undefined,redirect:"error",signal:AbortSignal.timeout(15000)});
      response.writeHead(result.status,{"Content-Type":result.headers.get("content-type")??"application/json"});response.end(Buffer.from(await result.arrayBuffer()));
    }catch{response.writeHead(503);response.end();}
  });
  await new Promise((resolve,reject)=>{proxy.once("error",reject);proxy.listen(55534,"0.0.0.0",resolve);});
  command("docker",["run","--detach","--name",restName,"--network",network,"--publish","127.0.0.1:55531:3000",...dockerEnv({...restEnv,PGRST_DB_URI:dbUri(restEnv.PGRST_DB_URI),PGRST_DB_SCHEMAS:"public",PGRST_DB_EXTRA_SEARCH_PATH:"public"}),rest.Config.Image]);restStarted=true;
  const templateHost="http://host.docker.internal:55534/templates/";
  command("docker",["run","--detach","--name",authName,"--network",network,"--publish","127.0.0.1:55533:9999",...dockerEnv({...authEnv,
    GOTRUE_DB_DATABASE_URL:dbUri(authEnv.GOTRUE_DB_DATABASE_URL),GOTRUE_SITE_URL:base,GOTRUE_URI_ALLOW_LIST:base,API_EXTERNAL_URL:gateway,
    GOTRUE_DISABLE_SIGNUP:"false",GOTRUE_MAILER_AUTOCONFIRM:"false",GOTRUE_MAILER_OTP_LENGTH:"8",GOTRUE_SMTP_HOST:"host.docker.internal",GOTRUE_SMTP_PORT:String(smtpPort),GOTRUE_SMTP_USER:"",GOTRUE_SMTP_PASS:"",GOTRUE_SMTP_ADMIN_EMAIL:"noreply@siteledger.example.test",GOTRUE_SMTP_SENDER_NAME:"SiteLedger QA",GOTRUE_SMTP_MAX_FREQUENCY:"1s",
    GOTRUE_MAILER_TEMPLATES_CONFIRMATION:templateHost+"signup.html",GOTRUE_MAILER_TEMPLATES_MAGIC_LINK:templateHost+"magic-link.html",GOTRUE_MAILER_TEMPLATES_RECOVERY:templateHost+"recovery.html",
    GOTRUE_SECURITY_CAPTCHA_ENABLED:"true",GOTRUE_SECURITY_CAPTCHA_PROVIDER:"turnstile",GOTRUE_SECURITY_CAPTCHA_SECRET:"1x0000000000000000000000000000000AA",
    GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED:"true",GOTRUE_HOOK_BEFORE_USER_CREATED_URI:"pg-functions://postgres/public/account_signup_hook",
  }),auth.Config.Image]);authStarted=true;
  await ready(authUrl+"/health");await ready(restUrl+"/");
  const denied=await fetch(gateway+"/auth/v1/signup",{method:"POST",headers:{apikey:settings.ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:`denied-${suffix}@example.test`,password:"native-qa-password"})});
  assert.equal(denied.status,400,"Direct native signup must require CAPTCHA");
  assert.equal(sql(`select count(*) from auth.users where email='denied-${suffix}@example.test';`),"0");
  const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:gateway,NEXT_PUBLIC_SUPABASE_ANON_KEY:settings.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:settings.SERVICE_ROLE_KEY,SITELEDGER_APP_URL:base,NEXT_PUBLIC_TURNSTILE_SITE_KEY:"1x00000000000000000000AA",TURNSTILE_SECRET_KEY:"trial-qa-secret",TELEGRAM_BOT_TOKEN:dummyBot,TELEGRAM_WEBHOOK_SECRET:"disposable-account-webhook",GROQ_API_KEY:"",GEMINI_API_KEY:"",GONKAROUTER_API_KEY:""};
  preview=spawn(process.execPath,["--require",join(root,"scripts/fixtures/trial-siteverify.cjs"),join(root,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3016"],{cwd:root,env,windowsHide:true,stdio:"ignore"});
  await ready(base+"/account");browser=await chromium.launch({headless:true});
  const [owner,other,foreman,pm]=await Promise.all(Array.from({length:4},()=>browser.newContext({viewport:{width:390,height:844}})));
  const errors=[];
  const page=await owner.newPage();page.on("pageerror",error=>errors.push(error.message));
  // Mock only the browser widget; native Auth calls Cloudflare's official test secret.
  await owner.route("https://challenges.cloudflare.com/turnstile/**",route=>route.fulfill({contentType:"application/javascript",body:`window.turnstile={render:(node,options)=>{setTimeout(()=>options.callback(${JSON.stringify(captchaToken)}),10);return 'qa';},remove:()=>{},reset:()=>{}};`}));
  const emails=["owner","other","foreman","pm"].map(name=>`${name}-${suffix}@example.test`),password="native-qa-password";
  await page.goto(base+"/account");await page.getByRole("button",{name:"Create account",exact:true}).first().click();
  await page.locator('[name="email"]').fill(emails[0]);await page.locator('[name="password"]').fill(password);await page.locator('[name="name"]').fill("Ọlá Owner");await page.locator('[name="confirm_name"]').check();
  await page.getByRole("button",{name:"Create account",exact:true}).last().click();await page.getByRole("heading",{name:"Confirm your email",exact:true}).waitFor();
  assert.equal((await owner.cookies()).some(cookie=>cookie.name==="siteledger_session"),false);
  await page.screenshot({path:join(out,"signup-confirmation-mobile.png"),fullPage:true});
  await page.locator('[name="token"]').fill(await codeFor(emails[0]));await page.locator('[name="confirm_name"]').check();await page.getByRole("button",{name:"Confirm email and continue"}).click();await page.waitForURL(base+"/projects");
  const accounts=[];
  const ownerCookie=(await owner.cookies()).find(cookie=>cookie.name==="siteledger_session");assert.ok(ownerCookie?.httpOnly);assert.equal(ownerCookie.sameSite,"Lax");
  accounts.push(JSON.parse(sql(`select public.account_session('${createHash("sha256").update(ownerCookie.value).digest("hex")}');`)));
  for(const [i,context] of [[1,other],[2,foreman],[3,pm]]){const start=mail.length;assert.equal((await action(context,"account","signup",{email:emails[i],password,name:["","Independent Owner","Foreman Original","Reviewing PM"][i],confirm_name:true,captcha_token:captchaToken})).pending_confirmation,true);
    accounts.push((await action(context,"account","verify_signup",{email:emails[i],token:await codeFor(emails[i],start),name:["","Independent Owner","Foreman Original","Reviewing PM"][i],confirm_name:true})).account);
  }
  console.log("Native verified signup, private cookie and direct CAPTCHA denial pass.");
  const project=await action(owner,"projects/actions","create",{name:"Disposable Site A",client:"Fictional client",location:"Lagos",contract_sum:"1000000",currency:"NGN",timezone:"Africa/Lagos"});
  const projectB=await action(other,"projects/actions","create",{name:"Disposable Site B",client:"Fictional client",location:"Kuwait",contract_sum:"1.123",currency:"KWD",timezone:"Asia/Kuwait"});
  await page.goto(`${base}/projects/${project.id}`);await page.getByRole("heading",{name:"Site records",exact:true}).waitFor();
  const invitations=[];
  for(const [i,role,context] of [[2,"foreman",foreman],[3,"pm",pm]]){const invitation=await action(owner,"projects/actions","invite",{project_id:project.id,email:emails[i],role});invitations.push(invitation);const secret=new URL(invitation.url).hash.slice(8);
    await action(other,"projects/actions","accept_invite",{secret},404);
    if (i===2) {const acceptance=await context.newPage();await acceptance.goto(invitation.url);await acceptance.getByRole("checkbox").check();await acceptance.getByRole("button",{name:"Accept invitation",exact:true}).click();await acceptance.getByRole("dialog").getByRole("button",{name:"Accept invitation",exact:true}).click();await acceptance.waitForURL(`${base}/projects/${project.id}`);}
    else await action(context,"projects/actions","accept_invite",{secret});
    await action(context,"projects/actions","accept_invite",{secret},404);
  }
  const crossInvite=await action(other,"projects/actions","invite",{project_id:projectB.id,email:emails[2],role:"pm"});
  await action(foreman,"projects/actions","accept_invite",{secret:new URL(crossInvite.url).hash.slice(8)});
  await action(foreman,"projects/actions","change_role",{project_id:project.id,profile_id:accounts[2].profile_id,role:"pm"},404);
  await action(owner,"projects/actions","remove_member",{project_id:project.id,profile_id:accounts[0].profile_id},409);
  const cancelled=await action(owner,"projects/actions","invite",{project_id:project.id,email:emails[1],role:"foreman"});
  await action(owner,"projects/actions","cancel_invite",{project_id:project.id,invitation_id:cancelled.id});await action(other,"projects/actions","accept_invite",{secret:new URL(cancelled.url).hash.slice(8)},404);
  await page.goto(`${base}/projects/${project.id}/team`);await page.getByRole("heading",{name:"Active team",exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:join(out,"project-team-mobile.png"),fullPage:true});
  await page.getByRole("button",{name:"Archive project",exact:true}).click();
  const modal=page.getByRole("dialog");await modal.waitFor();assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"Cancel");
  await page.keyboard.press("Tab");assert.ok(await page.evaluate(()=>Boolean(document.activeElement?.closest("dialog"))),"Focus stays in the modal");
  await page.screenshot({path:join(out,"archive-confirmation-mobile.png"),fullPage:true});
  await page.keyboard.press("Escape");await modal.waitFor({state:"hidden"});assert.equal(sql(`select archived_at is null from public.account_projects where project_id='${project.id}';`),"t","Escape makes no archive mutation");
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"Archive project","Focus returns to the triggering action");
  await page.getByRole("button",{name:"Archive project",exact:true}).click();await modal.getByRole("button",{name:"Cancel",exact:true}).click();assert.equal(sql(`select archived_at is null from public.account_projects where project_id='${project.id}';`),"t");
  await page.getByRole("button",{name:"Archive project",exact:true}).click();await modal.getByRole("button",{name:"Archive project",exact:true}).click();await page.getByRole("button",{name:"Restore project",exact:true}).waitFor();
  assert.equal(sql(`select count(*) from public.account_project_events where project_id='${project.id}' and action='archived';`),"1","Explicit confirmation performs the existing action once");
  await page.getByRole("button",{name:"Restore project",exact:true}).click();await modal.getByRole("button",{name:"Restore project",exact:true}).click();await page.getByRole("button",{name:"Archive project",exact:true}).waitFor();
  console.log("Independent owners, targeted invites, replay/cancellation and different roles on two projects pass.");
  // Supply only the brief's NGN demo rate. A foreign decimal is a labelled fixture.
  await page.goto(`${base}/projects/${project.id}/boq`);await page.getByRole("button",{name:"Add BoQ item",exact:true}).click();
  for(const [name,value] of [["item_code","BLK-QA"],["section","Blockwork"],["description","Sandcrete blocks 225mm hollow, laid"],["boq_quantity","420"],["rate","14500"]])await page.locator(`[name="${name}"]:visible`).fill(value);
  await page.getByRole("button",{name:"Review and save",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();assert.equal(sql(`select count(*) from public.boq_items where project_id='${project.id}';`),"0","Cancelling BoQ review makes no item");
  await page.getByRole("button",{name:"Review and save",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Save BoQ item",exact:true}).click();await page.getByRole("status").filter({hasText:"BoQ item saved"}).waitFor();
  const boq=sql(`select id from public.boq_items where project_id='${project.id}' and item_code='BLK-QA';`);
  const readOnlyBoq=await foreman.newPage();await readOnlyBoq.goto(`${base}/projects/${project.id}/boq`);await readOnlyBoq.getByText("Read-only BoQ.",{exact:false}).waitFor();assert.equal(await readOnlyBoq.getByRole("button",{name:"Add BoQ item",exact:true}).count(),0);
  await action(foreman,"projects/actions","select",{project_id:project.id});
  const audio=Buffer.from("RIFF1234WAVEdisposable"),photo=await readFile(join(root,"public/demo/photos/synthetic-blockwork.jpg"));
  const noteId=randomUUID(),manifest={id:noteId,project_id:project.id,captured_at:new Date().toISOString(),timezone:"Africa/Lagos",assets:[audio,photo].map((bytes,index)=>({index,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),content_type:index===0?"audio/wav":"image/jpeg"}))};
  await action(foreman,"web","submissions",manifest);
  for(const [index,bytes] of [audio,photo].entries()){const response=await foreman.request.put(`${base}/api/web/submissions/${noteId}/media/${index}`,{headers:{Origin:base,"Content-Type":manifest.assets[index].content_type},data:bytes});assert.equal(response.status(),200);}
  await action(foreman,"web/submissions",`${noteId}/finish`,{});
  // Failed free providers leave a manual-confirm record. No real AI network calls.
  sql(`update public.submission_ai_jobs set status='manual_entry',claim_owner=null,lease_until=null where submission_id='${noteId}'; update public.submissions set status='extracted' where id='${noteId}' and status='received'; update public.photo_analysis_jobs set status='manual_entry',claim_owner=null,lease_until=null where photo_id in (select id from public.submission_photos where submission_id='${noteId}');`);
  const mediaId=sql(`select id from public.submission_photos where submission_id='${noteId}';`);
  const scripted={likely_work_item:"Blockwork",confidence:0.8,defects:[{description:"Surface voids — scripted QA fixture",confidence:0.8}],safety_concerns:[]};
  const photoLease=randomUUID();sql(`update public.photo_analysis_jobs set status='queued' where photo_id='${mediaId}'; select public.claim_photo_analysis('${mediaId}','${photoLease}'); select public.finish_photo_analysis('${mediaId}','${photoLease}','${JSON.stringify(scripted)}'::jsonb,null);`);
  const values={work_items:[{description:"Blockwork QA",matched_boq_hint:null,quantity:18,unit:"m2",crew:6,confidence:1}],materials:[],delays:[],issues:[],raw_language_notes:""};
  // Task 12: genuine loading UI, blank low-confidence values and intact retries.
  const uncertain={...values,work_items:[{...values.work_items[0],confidence:0.4}]};sql(`update public.submissions set extraction='${JSON.stringify(uncertain)}'::jsonb where id='${noteId}';`);
  const statePage=await foreman.newPage();await statePage.emulateMedia({reducedMotion:"reduce"});slowReview=true;await statePage.goto(`${base}/confirm/${noteId}`,{waitUntil:"commit"});
  await statePage.getByRole("heading",{name:"Opening your site note…",exact:true}).waitFor();assert.equal(await statePage.locator('.diary-loading-line').evaluate(node=>getComputedStyle(node,'::after').animationName),"none");await statePage.screenshot({path:join(out,"loading-review-mobile.png"),fullPage:true});slowReview=false;
  await statePage.locator('[data-confidence="low"]').waitFor();assert.equal(await statePage.locator('[name="w0.quantity"]').inputValue(),"");const warningColor=await statePage.locator('[name="w0.quantity"]').evaluate(node=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.fillStyle=getComputedStyle(node).backgroundColor;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);});assert.deepEqual(warningColor,[255,251,235]);
  for(const width of [390,768,1440]){await statePage.setViewportSize({width,height:900});assert.ok(await statePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const small=await statePage.locator('main button:visible, main input:not([type="checkbox"]):not([type="hidden"]):visible, main select:visible, main textarea:visible').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().height<48||parseFloat(getComputedStyle(node).fontSize)<16).map(node=>node.getAttribute('name')??node.textContent));assert.deepEqual(small,[],"Review controls need readable type and 48px targets");await statePage.screenshot({path:join(out,`review-low-${width}.png`),fullPage:true});}await statePage.close();
  await action(foreman,"confirm",noteId,{human_confirmed:true,values,boq_ids:[boq],photo_notes:[{id:mediaId,note:"Human QA observation"}]});
  const confirmPage=await foreman.newPage();await confirmPage.goto(`${base}/confirm/${noteId}`);await confirmPage.getByText("Possible findings — check against the photo",{exact:true}).waitFor();
  await confirmPage.locator('[name="w0.quantity"]').fill("19");await foreman.route(`${base}/api/confirm/${noteId}`,route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:'{"error":"Connection interrupted for QA"}'}):route.continue());
  await confirmPage.getByRole("button",{name:"Confirm changes and rebuild report",exact:true}).click();await confirmPage.getByRole("alert").filter({hasText:"Connection interrupted for QA"}).waitFor();assert.equal(await confirmPage.locator('[name="w0.quantity"]').inputValue(),"19");await confirmPage.screenshot({path:join(out,"review-retry-mobile.png"),fullPage:true});await foreman.unroute(`${base}/api/confirm/${noteId}`);await confirmPage.locator('[name="w0.quantity"]').fill("18");
  await confirmPage.getByRole("button",{name:/Dismiss.*Surface voids/}).click();assert.equal(await confirmPage.locator(`[name="photo.${mediaId}"]`).inputValue(),"Human QA observation");
  await confirmPage.getByRole("button",{name:"Confirm changes and rebuild report",exact:true}).click();await confirmPage.waitForURL(`${base}/reports/${noteId}`);
  assert.equal((await confirmPage.locator(".report-document").innerText()).includes("scripted QA fixture"),false);
  await action(foreman,"reports",noteId,{weather:"Dry"});
  await action(foreman,"confirm",noteId,{human_confirmed:true,values:{...values,issues:["QA review complete"]},boq_ids:[boq],photo_notes:[{id:mediaId,note:"Human QA observation"}]});
  await action(foreman,"reports",noteId,{});
  const report=JSON.parse(sql(`select public.account_assemble_report('${noteId}');`));
  assert.equal(report.report.document.costing.total_cost,"261000");
  assert.equal(report.report.document.weather,"Dry","Rebuilding a correction retains existing weather");
  const version=createHash("sha256").update(JSON.stringify(report.report.document)).digest("hex");
  // Read the rendered version from the actual page; JSONB order is not JS source order.
  const reviewPage=await pm.newPage();await reviewPage.goto(`${base}/reports/${noteId}`);await reviewPage.getByRole("heading",{name:"Approve this daily record"}).waitFor();
  await reviewPage.locator('form input[type="checkbox"]').check();await reviewPage.getByRole("button",{name:"Approve and lock report",exact:true}).click();await reviewPage.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();assert.equal(sql(`select status from public.reports where submission_id='${noteId}';`),"draft");
  await reviewPage.getByRole("button",{name:"Approve and lock report",exact:true}).click();await reviewPage.getByRole("dialog").getByRole("button",{name:"Approve and lock report",exact:true}).click();await reviewPage.locator(".report-stamp").waitFor();
  await reviewPage.screenshot({path:join(out,"locked-report-mobile.png"),fullPage:true});
  assert.equal(sql(`select status from public.reports where submission_id='${noteId}';`),"locked");
  await action(foreman,"reports",`${noteId}/approve`,{document_version:version},403);
  const routes=[`/api/reports/${noteId}/pdf`,`/api/confirm/${noteId}/media/${mediaId}`];
  for(const path of routes)assert.equal((await other.request.get(base+path)).status(),404);
  const pdf=await pm.request.get(`${base}/api/reports/${noteId}/pdf`);assert.equal(pdf.status(),200);
  const {writeFile}=await import("node:fs/promises");await writeFile(join(out,"locked-report.pdf"),await pdf.body());
  const original=sql(`select content_snapshot::text from public.reports where submission_id='${noteId}';`);
  // PM rate edits affect future work; existing locked web/PDF money is unchanged.
  await page.goto(`${base}/projects/${project.id}/boq`);await page.getByRole("button",{name:"Edit BLK-QA",exact:true}).click();assert.equal(await page.locator('select[name="unit"]').isDisabled(),true);
  await page.locator('[name="rate"]').fill("11800");await page.locator('[name="boq_quantity"]').fill("2");await page.getByRole("button",{name:"Review and save",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Save BoQ item",exact:true}).click();await page.getByRole("status").filter({hasText:"BoQ item saved"}).waitFor();
  assert.equal(sql(`select content_snapshot::text from public.reports where submission_id='${noteId}';`),original);assert.deepEqual(await (await pm.request.get(`${base}/api/reports/${noteId}/pdf`)).body(),await pdf.body(),"Locked PDF keeps original prices after BoQ edits");
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await page.goto(`${base}/projects/${project.id}`);await page.locator('[data-earned]').waitFor();assert.ok((await page.locator('[data-earned]').innerText()).includes("₦261,000"));assert.equal(await page.locator('[data-variance]').innerText(),"1");assert.ok((await page.locator(`[data-boq-row="${boq}"]`).innerText()).includes("900%"));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,`dashboard-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:390,height:844});
  const foreignBoq=randomUUID();await action(foreman,"projects","boq",{project_id:projectB.id,item:{id:foreignBoq,revision:null,item_code:"DECIMAL-QA",section:"Fixture",description:"Supplied KWD decimal fixture",unit:"m2",boq_quantity:"1",rate:"0.123"}});
  await action(other,"projects","boq",{project_id:projectB.id,item:{id:boq,revision:null,item_code:"BLK-QA",section:"Fixture",description:"Forbidden reassignment",unit:"m2",boq_quantity:"1",rate:"0.123"}},404);
  const foreignNote=randomUUID(),foreignManifest={...manifest,id:foreignNote,project_id:projectB.id,timezone:"Asia/Kuwait"};await action(foreman,"web","submissions",foreignManifest);
  for(const [index,bytes] of [audio,photo].entries())assert.equal((await foreman.request.put(`${base}/api/web/submissions/${foreignNote}/media/${index}`,{headers:{Origin:base,"Content-Type":foreignManifest.assets[index].content_type},data:bytes})).status(),200);
  await action(foreman,"web/submissions",`${foreignNote}/finish`,{});await eventually(()=>sql(`select status from public.submission_ai_jobs where submission_id='${foreignNote}';`)==="manual_entry","Foreign fixture processing did not finish");
  const foreignPhoto=sql(`select id from public.submission_photos where submission_id='${foreignNote}';`);await action(foreman,"confirm",foreignNote,{human_confirmed:true,values:{...values,work_items:[{...values.work_items[0],quantity:0.1234}]},boq_ids:[foreignBoq],photo_notes:[{id:foreignPhoto,note:"Supplied foreign currency fixture"}]});
  await action(foreman,"reports",foreignNote,{});
  const foreignReport=await foreman.newPage();await foreignReport.goto(`${base}/reports/${foreignNote}`);await foreignReport.getByRole("heading",{name:"Approve this daily record"}).waitFor();assert.ok((await foreignReport.locator('.report-total').innerText()).includes("KWD 0.015"));await foreignReport.locator('form input[type="checkbox"]').check();await foreignReport.getByRole("button",{name:"Approve and lock report",exact:true}).click();await foreignReport.getByRole("dialog").getByRole("button",{name:"Approve and lock report",exact:true}).click();await foreignReport.locator('.report-stamp').waitFor();assert.equal((await foreman.request.get(`${base}/api/reports/${foreignNote}/pdf`)).status(),200);
  await foreignReport.goto(`${base}/projects/${projectB.id}`);await foreignReport.locator('[data-earned]').waitFor();assert.ok((await foreignReport.locator('[data-earned]').innerText()).includes("KWD 0.015"));assert.equal(sql(`select total_cost from public.reports where submission_id='${foreignNote}';`),"0.0151782");
  console.log("BoQ creation/cancellation, PM editing, foreman read-only, exact KWD costing/PDF and 390/768/1440px immutable dashboard figures pass.");
  await reviewPage.locator('[name="note"]').fill("A correction for dialog cancellation QA.");await reviewPage.getByRole("button",{name:"Save amendment",exact:true}).click();await reviewPage.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();
  assert.equal(await reviewPage.locator('[name="note"]').inputValue(),"A correction for dialog cancellation QA.");assert.equal(sql(`select count(*) from public.amendments a join public.reports r on r.id=a.report_id where r.submission_id='${noteId}';`),"0");
  // Browser offline emulation tests the real IndexedDB queue and service worker.
  await foreman.route("https://telegram.org/js/telegram-web-app.js",route=>route.fulfill({contentType:"application/javascript",body:"window.Telegram={WebApp:{initData:'',ready(){},expand(){}}};"}));
  const diary=await foreman.newPage();await diary.goto(base+"/today");await diary.getByRole("button",{name:"Record voice note",exact:true}).waitFor();
  await eventually(()=>diary.getByRole("button",{name:"Record voice note",exact:true}).isEnabled(),"Diary did not finish opening");assert.ok(await diary.getByRole("button",{name:"Record voice note",exact:true}).evaluate(node=>node.getBoundingClientRect().height>=88));await diary.getByRole("button",{name:"Record voice note",exact:true}).focus();await diary.keyboard.press("Tab");assert.equal(await diary.locator('input[type="file"][accept^="audio/"]').evaluate(node=>getComputedStyle(node.closest('label')).outlineWidth),"2px");
  for(const width of [390,768,1440]){await diary.setViewportSize({width,height:900});assert.ok(await diary.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await diary.screenshot({path:join(out,`today-empty-${width}.png`),fullPage:true});}await diary.setViewportSize({width:390,height:844});
  await diary.evaluate(()=>navigator.serviceWorker.ready);
  await eventually(()=>diary.evaluate(async()=>Boolean(await (await caches.open("siteledger-today-v1")).match("/today"))),"Offline public shell was not cached.");
  await foreman.setOffline(true);await diary.locator('input[type="file"][accept^="audio/"]').setInputFiles({name:"qa.wav",mimeType:"audio/wav",buffer:audio});await diary.locator('input[type="file"][accept^="image/"]').setInputFiles({name:"synthetic.jpg",mimeType:"image/jpeg",buffer:photo});await diary.getByRole("button",{name:"Queue this site note",exact:true}).click();
  await diary.getByText("Queued — will send when data returns.",{exact:true}).waitFor();const queued=(await queuedNotes(diary))[0];assert.equal(queued.bytes.length,2);assert.equal(queued.project,project.id);
  await diary.screenshot({path:join(out,"offline-queue-mobile.png"),fullPage:true});await diary.reload();await diary.getByText("Queued — will send when data returns.",{exact:true}).waitFor();assert.deepEqual((await queuedNotes(diary))[0],queued);
  await foreman.setOffline(false);await eventually(async()=> (await queuedNotes(diary))[0]?.status==="sent","Offline note did not send on reconnect.");assert.equal(sql(`select count(*) from public.submissions where id='${queued.id}';`),"1");assert.equal((await queuedNotes(diary))[0].bytes.length,0);
  // A second pending note must survive membership removal without reassignment.
  await foreman.setOffline(true);await diary.locator('input[type="file"][accept^="audio/"]').setInputFiles({name:"qa.wav",mimeType:"audio/wav",buffer:audio});await diary.locator('input[type="file"][accept^="image/"]').setInputFiles({name:"synthetic.jpg",mimeType:"image/jpeg",buffer:photo});await diary.getByRole("button",{name:"Queue this site note",exact:true}).click();
  await eventually(async()=> (await queuedNotes(diary)).filter(row=>row.status!=="sent").length===1,"Second queue was not saved.");const blocked=(await queuedNotes(diary)).find(row=>row.status!=="sent");
  await action(foreman,"account","profile",{name:"Foreman Updated",confirm_name:true});assert.equal(sql(`select content_snapshot::text from public.reports where submission_id='${noteId}';`),original);
  await action(foreman,"reports",`${noteId}/amendments`,{note:"QA correction",request_id:randomUUID()});
  await action(owner,"projects/actions","remove_member",{project_id:project.id,profile_id:accounts[2].profile_id});
  await foreman.setOffline(false);
  await diary.getByRole("button",{name:"Reconnect authorized project",exact:true}).click();
  const retained=(await queuedNotes(diary)).find(row=>row.id===blocked.id);assert.deepEqual(retained.bytes,blocked.bytes);assert.equal(retained.project,project.id);assert.equal(sql(`select count(*) from public.submissions where id='${blocked.id}';`),"0");
  for(const path of routes)assert.equal((await foreman.request.get(base+path)).status(),404);
  await action(owner,"projects/actions","archive",{project_id:project.id});
  assert.equal((await pm.request.get(`${base}/api/reports/${noteId}/pdf`)).status(),200);
  await action(pm,"reports",`${noteId}/amendments`,{note:"Blocked archive",request_id:randomUUID()},409);
  await action(owner,"projects/actions","restore",{project_id:project.id});
  console.log("Upload → manual confirmation → costing → approval/PDF, snapshots, revocation and archive history pass.");
  // Linking is explicit and requires the verified website session plus signed launch.
  const launch=signedTelegram(990001);await action(owner,"account","connect_telegram",{init_data:launch,combine_profiles:true});
  const telegram=await browser.newContext();const connected=(await action(telegram,"account","telegram",{init_data:signedTelegram(990001)})).account;
  assert.equal(connected.profile_id,accounts[0].profile_id);
  const direct=await browser.newContext(),directPage=await direct.newPage(),directProof=signedTelegram(990001);
  await direct.route("https://telegram.org/js/telegram-web-app.js",route=>route.fulfill({contentType:"application/javascript",body:`window.Telegram={WebApp:{initData:${JSON.stringify(directProof)},ready(){},expand(){}}};`}));
  await directPage.goto(`${base}/reports/${noteId}`);await directPage.locator(".report-document").waitFor();
  assert.ok((await direct.cookies()).some(cookie=>cookie.name==="siteledger_session"),"Linked Telegram record buttons authenticate a fresh Mini App session");
  await action(owner,"account","unlink_telegram",{});
  assert.equal((await direct.request.get(`${base}/api/reports/${noteId}/pdf`)).status(),404);
  assert.equal((await action(telegram,"account","telegram",{init_data:signedTelegram(990001)})).needs_login,true);
  assert.equal(sql(`select count(*) from public.account_profiles where id='${accounts[0].profile_id}';`),"1");
  const transfer=await action(owner,"projects/actions","start_transfer",{project_id:project.id,profile_id:accounts[3].profile_id});
  const history=await pm.newPage();await history.goto(`${base}/projects/${project.id}`);await history.getByRole("heading",{name:"Ownership offered to you"}).waitFor();
  await action(pm,"projects/actions","accept_transfer",{project_id:project.id,transfer_id:transfer.id});
  assert.equal(sql(`select owner_profile_id from public.account_projects where project_id='${project.id}';`),accounts[3].profile_id);
  const newBrowser=await browser.newContext();const login=(await action(newBrowser,"account","signin",{email:emails[3],password,captcha_token:captchaToken})).account;assert.equal(login.profile_id,accounts[3].profile_id);
  const reopened=await newBrowser.newPage();await reopened.goto(`${base}/projects/${project.id}`);await reopened.getByRole("heading",{name:"Site records"}).waitFor();await reopened.screenshot({path:join(out,"project-history-mobile.png"),fullPage:true});
  const mailStart=mail.length;await action(other,"account","recover",{email:emails[1],captcha_token:captchaToken});
  await action(other,"account","reset_password",{email:emails[1],token:await codeFor(emails[1],mailStart),password:"changed-native-qa-password"});
  await action(other,"account","signin",{email:emails[1],password,captcha_token:captchaToken},400);
  const recovered=(await action(other,"account","signin",{email:emails[1],password:"changed-native-qa-password",captcha_token:captchaToken})).account;assert.equal(recovered.profile_id,accounts[1].profile_id);
  const statusPage=await owner.newPage();const missing=await statusPage.goto(base+"/missing-acceptance-route");assert.equal(missing.status(),404);await statusPage.getByRole("heading",{name:"This page isn’t available."}).waitFor();assert.ok(await statusPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await statusPage.screenshot({path:join(out,"not-found-mobile.png"),fullPage:true});
  forceAccountError=true;await statusPage.goto(base+"/account");await statusPage.getByRole("heading",{name:"We couldn’t open this page."}).waitFor();assert.equal((await statusPage.locator("body").innerText()).includes("private-fixture-details"),false);await statusPage.screenshot({path:join(out,"application-error-mobile.png"),fullPage:true});
  forceAccountError=false;await statusPage.getByRole("button",{name:"Try again",exact:true}).click();await statusPage.getByRole("heading",{name:"Your account",exact:true}).waitFor();
  const checkContext=await browser.newContext(),checkPage=await checkContext.newPage();
  await checkContext.route("https://challenges.cloudflare.com/turnstile/**",route=>route.fulfill({contentType:"application/javascript",body:`window.failCheck=true;window.turnstile={render:(node,options)=>{window.expireCheck=options['expired-callback'];setTimeout(()=>window.failCheck?options['error-callback']('110200'):options.callback(${JSON.stringify(captchaToken)}),10);return 'qa';},remove:()=>{}};`}));
  await checkPage.goto(base+"/account");await checkPage.getByRole("alert").filter({hasText:"not authorized for the bot check"}).waitFor();assert.equal(await checkPage.getByRole("button",{name:"Sign in",exact:true}).last().isDisabled(),true);
  await checkPage.evaluate(()=>{window.failCheck=false;});await checkPage.getByRole("button",{name:"Retry bot check",exact:true}).click();await eventually(async()=>await checkPage.getByRole("button",{name:"Sign in",exact:true}).last().isEnabled(),"Retry did not obtain a fresh bot token");
  await checkPage.evaluate(()=>window.expireCheck());assert.equal(await checkPage.getByRole("button",{name:"Sign in",exact:true}).last().isDisabled(),true,"Expired bot tokens cannot submit authentication");
  for (const [context,path,name] of [[owner,"/account","account"],[owner,"/projects","projects"],[pm,`/projects/${project.id}/team`,"team"],[pm,`/reports/${noteId}`,"report"]]) {
    const desktop=await context.newPage();await desktop.setViewportSize({width:1440,height:1000});await desktop.goto(base+path);await desktop.locator("main").waitFor();await desktop.evaluate(()=>document.fonts.ready);
    assert.ok(await desktop.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} desktop layout overflows`);
    if(name==="account"||name==="projects")await desktop.locator(name==="account"?".account-columns":".project-columns").waitFor();
    if(name==="team")await desktop.getByRole("heading",{name:"Active team",exact:true}).waitFor();
    if(name==="report")await desktop.locator(".report-stamp").waitFor();
    await desktop.screenshot({path:join(out,`${name}-desktop.png`),fullPage:true});await desktop.close();
  }
  // Task 10B uses the real local account service and server routes. Only the
  // browser widget + exact server Siteverify transport are disposable fixtures.
  const guest=await browser.newContext({viewport:{width:390,height:844}}),trialPage=await guest.newPage();
  await guest.route("https://challenges.cloudflare.com/turnstile/**",route=>route.fulfill({contentType:"application/javascript",body:`window.turnstile={render:(node,options)=>{const token=options.action==='siteledger-trial'?'trial-qa-'+crypto.randomUUID():${JSON.stringify(captchaToken)};window.__trialQaToken=token;setTimeout(()=>options.callback(token),10);return crypto.randomUUID();},remove:()=>{}};`}));
  await trialPage.goto(base+"/trial");await trialPage.getByRole("checkbox").check();
  await eventually(()=>trialPage.getByRole("button",{name:"Start private trial",exact:true}).isEnabled(),"Trial widget did not finish");
  const trialProof=await trialPage.evaluate(()=>window.__trialQaToken);
  await trialPage.getByRole("button",{name:"Start private trial",exact:true}).click();await trialPage.getByRole("heading",{name:"Your trial voice note and photos"}).waitFor();
  await action(guest,"trial","start",{captcha_token:trialProof,accept_trial:true},422);
  const guestCookie=(await guest.cookies()).find(cookie=>cookie.name==="siteledger_trial");assert.ok(guestCookie?.httpOnly);
  const guestHash=createHash("sha256").update(guestCookie.value).digest("hex"),trialState=JSON.parse(sql(`select public.trial_read('${guestHash}');`));
  await trialPage.locator('[name="audio"]').setInputFiles({name:"trial-voice.ogg",mimeType:"audio/ogg",buffer:Buffer.from("OggS-native-trial-voice-qa")});
  await trialPage.locator('[name="photos"]').setInputFiles(join(root,"public/demo/photos/synthetic-column-voids.jpg"));
  await trialPage.getByRole("button",{name:"Upload and review",exact:true}).click();await trialPage.getByRole("heading",{name:"Review your site note"}).waitFor();
  await trialPage.getByRole("button",{name:"Add work item",exact:true}).waitFor();
  const trialNote=trialState.note_id,trialBid=sql("select id from public.trial_prices where item_code='BLK-01';");
  assert.equal((await owner.request.get(`${base}/api/trial/media/audio`)).status(),404,"Forwarded trial media needs its guest cookie");
  assert.equal((await guest.request.get(`${base}/api/reports/${trialNote}/pdf`)).status(),404,"Guest cannot export a client PDF");
  await action(guest,"reports",`${trialNote}/approve`,{document_version:"a".repeat(64)},401);
  await trialPage.getByRole("button",{name:"Add work item",exact:true}).click();
  for(const [field,value] of [["description","Guest checked blockwork"],["quantity","18"],["crew","6"],["confidence","1"]])await trialPage.locator(`[name="w0.${field}"]`).fill(value);
  await trialPage.locator('[name="w0.unit"]').fill("m2");await trialPage.locator('[name="w0.boq"]').selectOption(trialBid);
  await trialPage.locator('textarea[name^="photo."]').fill("Human guest observation, retained after handover.");
  await trialPage.getByRole("button",{name:"Confirm and cost it",exact:true}).click();await trialPage.waitForURL(base+"/trial/report");
  await trialPage.getByRole("heading",{name:"Daily site report",exact:true}).waitFor();assert.ok((await trialPage.locator(".report-total").innerText()).includes("₦261,000"));
  assert.equal(await trialPage.getByRole("button",{name:"Approve and lock report",exact:true}).count(),0);
  await trialPage.screenshot({path:join(out,"trial-draft-mobile.png"),fullPage:true});
  const originalTrial=sql(`select jsonb_build_object('manifest',manifest,'transcript',transcript,'extraction',extraction,'confirmed_values',confirmed_values,'draft',draft,'confirmed_at',confirmed_at)::text from public.trial_sessions where note_id='${trialNote}';`);
  const trialEmail=`trial-owner-${suffix}@example.test`;await trialPage.getByRole("button",{name:"Create account",exact:true}).first().click();
  await trialPage.locator('[name="email"]:visible').fill(trialEmail);await trialPage.locator('[name="password"]:visible').fill(password);await trialPage.locator('[name="name"]:visible').fill("Verified Trial Person");await trialPage.locator('[name="confirm_name"]:visible').check();const trialMailStart=mail.length;
  await trialPage.getByRole("button",{name:"Create account",exact:true}).last().click();await trialPage.getByRole("heading",{name:"Confirm your email",exact:true}).waitFor();
  assert.equal((await guest.cookies()).some(cookie=>cookie.name==="siteledger_session"),false);
  await trialPage.locator('[name="token"]:visible').fill(await codeFor(trialEmail,trialMailStart));await trialPage.locator('[name="confirm_name"]:visible').check();await trialPage.getByRole("button",{name:"Confirm email and continue",exact:true}).click();
  await trialPage.getByRole("button",{name:"Save this work",exact:true}).waitFor();
  await trialPage.getByRole("button",{name:"Save this work",exact:true}).click();await trialPage.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();
  assert.equal(sql(`select claimed_at is null from public.trial_sessions where note_id='${trialNote}';`),"t","Cancel does not hand over trial work");
  await trialPage.getByRole("button",{name:"Save this work",exact:true}).click();await trialPage.getByRole("dialog").getByRole("button",{name:"Save this work",exact:true}).click();await trialPage.waitForURL(base+`/confirm/${trialNote}`);
  assert.equal((await guest.cookies()).some(cookie=>cookie.name==="siteledger_trial"),false);
  assert.equal(sql(`select public.account_dashboard_input('${createHash("sha256").update((await guest.cookies()).find(cookie=>cookie.name==="siteledger_session").value).digest("hex")}',(select project_id from public.trial_sessions where note_id='${trialNote}'))->'project'->>'is_demo';`),"true","Saved trial retains the illustrative-rate warning in its dashboard");
  assert.equal(await trialPage.locator('[name="w0.quantity"]:visible').inputValue(),"18","Guest edit is carried into verified confirmation");
  assert.equal(sql(`select confirmed_at is null from public.submissions where id='${trialNote}';`),"t");
  assert.equal(sql(`select jsonb_build_object('manifest',manifest,'transcript',transcript,'extraction',extraction,'confirmed_values',confirmed_values,'draft',draft,'confirmed_at',confirmed_at)::text from public.trial_sessions where note_id='${trialNote}';`),originalTrial);
  assert.equal((await guest.request.get(base+`/trial/original/${trialNote}`)).status(),200);
  const deniedOriginal=await other.request.get(base+`/trial/original/${trialNote}`),deniedBody=await deniedOriginal.text();
  // Next's streamed notFound may retain HTTP 200 after its public shell flushes.
  // Require the safe unavailable page and absence of the private record itself.
  assert.ok(deniedBody.includes("This page isn’t available"));assert.equal(deniedBody.includes("Guest checked blockwork"),false);
  await trialPage.getByRole("button",{name:"Confirm and cost it",exact:true}).click();await trialPage.waitForURL(base+`/reports/${trialNote}`);
  await trialPage.locator('form input[type="checkbox"]:visible').check();await trialPage.getByRole("button",{name:"Approve and lock report",exact:true}).click();await trialPage.getByRole("dialog").getByRole("button",{name:"Approve and lock report",exact:true}).click();await trialPage.locator(".report-stamp").waitFor();
  assert.equal((await guest.request.get(base+`/api/reports/${trialNote}/pdf`)).status(),200);
  console.log("Private trial CAPTCHA replay denial, upload/draft, native signup, explicit handover, preserved edits and verified approval/PDF pass.");
  assert.deepEqual(errors,[]);
  console.log("Telegram same-profile linking/unlinking, accepted ownership, second-browser history and native email recovery pass.");
  console.log("Task 10A disposable native/browser acceptance passed. Artifacts: supabase/.temp/task-10a/browser.");
} catch (error) {
  for (const name of [authName,restName]) {
    const result=spawnSync("docker",["logs",name],{encoding:"utf8",windowsHide:true});
    const errors=(result.stderr??"").split("\n").filter(line=>/error|fatal|panic/i.test(line)).join("\n").replace(/postgres(?:ql)?:\/\/\S+/g,"[connection]").replace(/eyJ[A-Za-z0-9_.-]+/g,"[credential]");
    if(errors)console.error(errors.slice(-1800));
  }
  throw error;
} finally {
  await browser?.close().catch(()=>{});
  if(preview)spawnSync("taskkill",["/PID",String(preview.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});
  for(const name of [authStarted?authName:null,restStarted?restName:null].filter(Boolean))spawnSync("docker",["rm","--force",name],{windowsHide:true,stdio:"ignore"});
  await new Promise(resolve=>proxy?proxy.close(resolve):resolve());await new Promise(resolve=>smtp?smtp.close(resolve):resolve());
  if(created)command("docker",["exec",dbContainer,"dropdb","-U","postgres","--force",database]);
  clearInterval(keepAlive);
}
