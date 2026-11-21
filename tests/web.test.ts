import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { POST as capturePOST } from "../app/api/web/access/route";
import { captureAccess,verifyCaptureAccess } from "../lib/web/access";
import { reserveWeb,uploadWeb,finishWeb,type WebDependencies } from "../lib/web/api";
import { validManifest,validMedia,MAX_WEB_AUDIO,type WebManifest } from "../lib/web/types";
const project="10000000-0000-4000-8000-000000000001",id="7a000000-0000-4000-8000-000000000001";
const voice=Buffer.from("RIFF1234WAVEvoice"),photo=Buffer.from([255,216,255,...Array(20).fill(0)]);
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const context={project_id:project,project_name:"Disposable QA",actor_id:7700001,actor_name:"Web QA",timezone:"Africa/Lagos"};
const manifest:WebManifest={id,project_id:project,captured_at:new Date().toISOString(),timezone:"Africa/Lagos",assets:[
  {index:0,content_type:"audio/wav",bytes:voice.length,sha256:digest(voice)},
  {index:1,content_type:"image/jpeg",bytes:photo.length,sha256:digest(photo)}]};
const secret="local-web-qa",origin="https://siteledger.example";
const request=(path:string,body?:string|Buffer,token="a".repeat(43),type="application/json")=>new Request(origin+path,{method:body instanceof Buffer?"PUT":"POST",
  headers:{Origin:origin,Cookie:"siteledger_session="+token,"Content-Type":type},body:typeof body==="string"?body:body?new Uint8Array(body):undefined});
function deps(run:(name:string,args:Record<string,unknown>)=>unknown,upload:WebDependencies["upload"]=async()=>{}):WebDependencies {
  return {rpc:async<T>(name:string,args:Record<string,unknown>)=>run(name,args) as T,upload};
}
async function configured(run:()=>Promise<void>) {
  const before={secret:process.env.TELEGRAM_WEBHOOK_SECRET,url:process.env.SITELEDGER_APP_URL};
  process.env.TELEGRAM_WEBHOOK_SECRET=secret;process.env.SITELEDGER_APP_URL=origin;
  try{await run();}finally{if(before.secret===undefined)delete process.env.TELEGRAM_WEBHOOK_SECRET;else process.env.TELEGRAM_WEBHOOK_SECRET=before.secret;
    if(before.url===undefined)delete process.env.SITELEDGER_APP_URL;else process.env.SITELEDGER_APP_URL=before.url;}
}
test("capture capabilities bind purpose, project, actor, timezone and expiry",()=>{
  const time=Date.now(),signed=captureAccess(context,secret,time);
  assert.equal(verifyCaptureAccess(signed.access,secret,time)?.actor_id,context.actor_id);
  assert.equal(verifyCaptureAccess(signed.access,secret,time+7*86400000),null);
  assert.equal(verifyCaptureAccess(signed.access,"wrong",time),null);
  assert.equal(verifyCaptureAccess(signed.access.replace(/.$/,"!"),secret,time),null);
});
test("manifest rejects prices, wrong project shape, too many photos, oversized media and unknown formats",()=>{
  assert.ok(validManifest(manifest));
  for(const changed of [{...manifest,rate:123},{...manifest,id:"unknown"},{...manifest,assets:Array(7).fill(manifest.assets[1])},
    {...manifest,assets:[{...manifest.assets[0],bytes:MAX_WEB_AUDIO+1},manifest.assets[1]]},
    {...manifest,assets:[{...manifest.assets[0],content_type:"text/html"},manifest.assets[1]]},
    {...manifest,assets:[manifest.assets[0],{...manifest.assets[1],index:5}]}])assert.equal(validManifest(changed),false);
  assert.ok(validMedia(voice,"audio/wav"));assert.equal(validMedia(voice,"image/jpeg"),false);
});
test("unauthorized, altered and foreign-project reservations cannot reach storage",async()=>configured(async()=>{
  let calls=0;const dependency=deps(()=>{calls++;return {id,status:"pending",missing:[0,1]};});
  assert.equal((await reserveWeb(request("/api/web/submissions",JSON.stringify(manifest),"invalid"),dependency)).status,401);
  const foreign={...manifest,project_id:"10000000-0000-4000-8000-000000000002"};
  const denied=deps(()=>({error:"forbidden"}));
  assert.equal((await reserveWeb(request("/api/web/submissions",JSON.stringify(foreign)),denied)).status,403);
  assert.equal(calls,0);
  const response=await reserveWeb(request("/api/web/submissions",JSON.stringify(manifest)),dependency);assert.equal(response.status,200);assert.equal(calls,1);
}));
test("media hash/type checks prevent replacement; failures release the owned lease",async()=>configured(async()=>{
  let uploaded=0,released=0;
  const dependency=deps(name=>{
    if(name==="account_claim_web")return {path:`${project}/${id}/0.wav`,asset:manifest.assets[0]};
    if(name==="account_release_web"){released++;return;}
    return {status:"uploaded"};
  },async()=>{uploaded++;});
  assert.equal((await uploadWeb(request("/media",Buffer.from("RIFF1234WAVEother"),undefined,"audio/wav"),id,0,dependency)).status,400);
  assert.equal(uploaded,0);assert.equal(released,1);
  assert.equal((await uploadWeb(request("/media",voice,undefined,"audio/wav"),id,0,dependency)).status,200);
  assert.equal(uploaded,1);assert.equal(released,2);
}));
test("lost response retries skip uploaded objects and finalize only complete notes",async()=>configured(async()=>{
  let uploads=0,processing=0;
  const complete=deps(name=>name==="account_claim_web"?{status:"uploaded"}:{id,status:"saved",missing:[]},async()=>{uploads++;});
  assert.equal((await uploadWeb(request("/media",voice,undefined,"audio/wav"),id,0,complete)).status,200);assert.equal(uploads,0);
  const busy=deps(()=>({busy:true}));assert.equal((await finishWeb(request("/finish"),id,busy,()=>processing++)).status,503);assert.equal(processing,0);
  const response=await finishWeb(request("/finish"),id,complete,()=>processing++);
  assert.equal(response.status,200);assert.equal(processing,1);assert.equal((await response.json()).review_url, `/confirm/${id}`);
}));
test("revocation and rate limits preserve a plain retryable result",async()=>configured(async()=>{
  assert.equal((await reserveWeb(request("/reserve",JSON.stringify(manifest)),deps(()=>({error:"forbidden"})))).status,403);
  assert.equal((await reserveWeb(request("/reserve",JSON.stringify(manifest)),deps(()=>({error:"rate_limited"})))).status,429);
}));
test("capture requires an account cookie and derives project and person on the server",async contextTest=>configured(async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://database.example";process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-key";
  let calls=0;
  contextTest.mock.method(globalThis,"fetch",async(url: URL | RequestInfo,options?: RequestInit)=>{calls++;assert.ok(String(url).endsWith("/rpc/account_capture_context"));const args=JSON.parse(String(options?.body));assert.match(args.p_hash,/^[a-f0-9]{64}$/);assert.equal(Object.keys(args).length,1);return Response.json(context);});
  const denied=await capturePOST(request("/api/web/access",JSON.stringify({init_data:"old-launch"}),"invalid"));assert.equal(denied.status,401);assert.equal(calls,0);
  const spoofed=await capturePOST(request("/api/web/access",JSON.stringify({actor_id:7700999})));assert.equal(spoofed.status,422);assert.equal(calls,0);
  const response=await capturePOST(request("/api/web/access","{}"));assert.equal(response.status,200);assert.equal(calls,1);
  const result=await response.json();assert.equal(result.project_id,project);assert.match(result.access,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyCaptureAccess(result.access,secret),null,"retry nonce cannot authenticate old capture routes");
}));
