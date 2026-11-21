// This irreversible-flow check uses a disposable clone, never the live app DB.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
const root = process.cwd(), suffix = randomUUID().slice(0,8);
const demoPhotoCheck = process.argv[2] === "photos-demo";
const webCheck = process.argv[2] === "web";
const photoCheck = process.argv[2] === "photos" || demoPhotoCheck, kind = webCheck ? "web" : photoCheck ? "photo" : "log";
const database = `siteledger_${kind}_qa_${suffix}`, container = database;
const previewPort = webCheck ? 3014 : photoCheck ? 3013 : 3012, restPort = webCheck ? 55427 : photoCheck ? 55425 : 55423, gatewayPort = webCheck ? 55428 : photoCheck ? 55426 : 55424;
const dbContainer = "supabase_db_siteledger-ai", base = `http://127.0.0.1:${previewPort}`, api = `http://127.0.0.1:${restPort}`, gateway = `http://127.0.0.1:${gatewayPort}`;
function command(name, args, input) {
  const result = spawnSync(name, args, { cwd: root, input, encoding: "utf8", windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) {
    const detail = (result.stderr ?? "").replace(/postgres(?:ql)?:\/\/\S+/g,"[database connection]")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,"[credential]").slice(0,700);
    throw new Error(`Local QA command failed: ${name} (${result.status}): ${detail}`);
  }
  return result.stdout;
}
const inspect = JSON.parse(command("docker", ["inspect", "supabase_rest_siteledger-ai"]))[0];
const restEnv = Object.fromEntries(inspect.Config.Env.map(value => { const i=value.indexOf("="); return [value.slice(0,i),value.slice(i+1)]; }));
const network = Object.keys(inspect.NetworkSettings.Networks).find(value => value.includes("siteledger-ai"));
if (!network || !restEnv.PGRST_DB_URI) throw new Error("SiteLedger local REST configuration is required.");
const localCliEnv = { ...process.env, SUPABASE_HOME: join(root,"supabase/.temp/cli-home"), SUPABASE_PROFILE: "supabase" };
const status = spawnSync(process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "supabase",
  process.platform === "win32" ? ["/d","/s","/c","supabase.cmd status -o json"] : ["status","-o","json"],
  { cwd: root, env: localCliEnv, encoding: "utf8", windowsHide: true });
if (status.status !== 0) throw new Error("Start SiteLedger local Supabase first.");
const settings = JSON.parse(status.stdout);
if (settings.API_URL !== "http://127.0.0.1:55421" || !settings.SERVICE_ROLE_KEY) throw new Error("Expected SiteLedger local credentials.");
const uri = new URL(restEnv.PGRST_DB_URI); uri.pathname = `/${database}`;
let created = false, started = false, preview, proxy;
const webMedia = new Map();
// Keep startup deadlines alive even if an idle fetch socket is unreferenced.
const keepAlive=setInterval(()=>{},1000);
async function ready(url, expected, authenticated = false) {
  const end = Date.now() + 30000;
  let last = "no response";
  while (Date.now() < end) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(3000),
      method: authenticated ? "POST" : "GET", body: authenticated ? "{}" : undefined,
      headers: authenticated ? { Authorization: `Bearer ${settings.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" } : {} });
      last = `HTTP ${response.status}`;
      if (response.ok && (!expected || (await response.text()).includes(expected))) return; } catch(error) { last = error.name; }
    await new Promise(resolve => setTimeout(resolve,250));
  }
  throw new Error(`Local QA preview did not become ready (${last}).`);
}
try {
  command("docker", ["exec",dbContainer,"createdb","-U","postgres","--template=template0",database]); created = true;
  command("docker",["exec",dbContainer,"psql","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-c","drop schema public cascade;"]);
  const dump = command("docker", ["exec",dbContainer,"pg_dump","-U","postgres","-d","postgres","--schema=public","--no-owner","--no-acl"]);
  command("docker", ["exec","-i",dbContainer,"psql","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1"], dump);
  // Recreate the server-only access boundary inside this fresh test database;
  // hosted platform default ACLs are owned by roles the local restore cannot alter.
  command("docker",["exec",dbContainer,"psql","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-c",
    "grant usage on schema public to anon,authenticated,service_role; revoke all on all tables in schema public from public,anon,authenticated; grant select,insert,update,delete on all tables in schema public to service_role; revoke all on all functions in schema public from public,anon,authenticated; grant execute on all functions in schema public to service_role;"]);
  const envArgs = Object.entries(restEnv).filter(([key]) => key.startsWith("PGRST_") && !["PGRST_DB_URI","PGRST_DB_SCHEMAS","PGRST_DB_EXTRA_SEARCH_PATH","PGRST_DB_PRE_REQUEST"].includes(key))
    .flatMap(([key,value]) => ["--env",`${key}=${value}`]);
  command("docker", ["run","--detach","--rm","--name",container,"--network",network,"--publish",`127.0.0.1:${restPort}:3000`,
    ...envArgs,"--env",`PGRST_DB_URI=${uri}`,"--env","PGRST_DB_SCHEMAS=public","--env","PGRST_DB_EXTRA_SEARCH_PATH=public",inspect.Config.Image]); started = true;
  await ready(api + "/rpc/get_demo_dispute_log", undefined, true);
  // The application uses Supabase's /rest/v1 prefix. A local loopback gateway
  // strips that prefix for the disposable REST server; no external URL is used.
  proxy = createServer(async (request,response) => {
    if(webCheck && request.url?.startsWith("/storage/v1/object/")) {
      const authorized=request.headers.apikey===settings.SERVICE_ROLE_KEY||request.headers.authorization===`Bearer ${settings.SERVICE_ROLE_KEY}`;
      const path=request.url.slice("/storage/v1/object/".length).replace(/^authenticated\//,"");
      if(!authorized||!/^site-evidence\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[0-5]\.(jpg|webm|wav|ogg|m4a|mp3)$/.test(path)){response.writeHead(404);response.end();return;}
      if(request.method==="POST") {
        const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>3*1024*1024){response.writeHead(413);response.end();return;}chunks.push(chunk);}
        if(webMedia.has(path)){response.writeHead(409,{"Content-Type":"application/json"});response.end(JSON.stringify({statusCode:"409",error:"Duplicate"}));return;}
        webMedia.set(path,{bytes:Buffer.concat(chunks),type:request.headers["content-type"]});response.writeHead(200,{"Content-Type":"application/json"});response.end("{}");return;
      }
      const stored=webMedia.get(path);
      if(request.method==="GET"&&stored){response.writeHead(200,{"Content-Type":stored.type});response.end(stored.bytes);return;}
      response.writeHead(404);response.end();return;
    }
    // A tiny PNG fixture tests media/report plumbing. It is not a site photo
    // and the scripted findings in this browser test are not provider evidence.
    if (photoCheck && /^\/storage\/v1\/object\/authenticated\/site-evidence\/10000000-0000-4000-8000-000000000001\/79000000-0000-4000-8000-000000000091\/790009[123]\.jpg$/.test(request.url ?? "")) {
      if (demoPhotoCheck) {
        const index = Number(request.url.match(/790009([123])\.jpg$/)[1]) - 1;
        const name = ["synthetic-column-voids", "synthetic-blockwork", "synthetic-unprotected-edge"][index];
        response.writeHead(200,{"Content-Type":"image/jpeg"});
        response.end(await readFile(join(root,`public/demo/photos/${name}.jpg`))); return;
      }
      response.writeHead(200,{"Content-Type":"image/png"});
      response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64")); return;
    }
    if (!request.url?.startsWith("/rest/v1/")) { response.writeHead(404);response.end();return; }
    try {
      const chunks=[];let length=0;
      for await(const chunk of request) { length+=chunk.length;if(length>1024*1024){response.writeHead(413);response.end();return;}chunks.push(chunk); }
      const headers=Object.fromEntries(Object.entries(request.headers).filter(([key])=>!["host","connection","content-length"].includes(key))
        .map(([key,value])=>[key,Array.isArray(value)?value.join(","):value]));
      const result=await fetch(new URL(request.url.slice("/rest/v1".length),api),{method:request.method,headers,
        body:chunks.length?Buffer.concat(chunks):undefined,redirect:"error",signal:AbortSignal.timeout(10000)});
      response.writeHead(result.status,{"Content-Type":result.headers.get("content-type")??"application/json"});
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {response.writeHead(503);response.end();}
  });
  await new Promise((resolve,reject)=>{proxy.once("error",reject);proxy.listen(gatewayPort,"127.0.0.1",resolve);});
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: gateway, NEXT_PUBLIC_SUPABASE_ANON_KEY: settings.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY, TELEGRAM_WEBHOOK_SECRET: `local-${kind}-preview`, SITELEDGER_APP_URL: base,
    // The web check signs local initData with a dummy token, never a live bot.
    TELEGRAM_BOT_TOKEN: webCheck ? "test-web-bot-token" : "", GROQ_API_KEY: "", GEMINI_API_KEY: "", GONKAROUTER_API_KEY: "" };
  preview = spawn(process.execPath, ["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(previewPort)],
    { cwd: root, env, stdio: "ignore", windowsHide: true });
  await ready(base + "/reports/demo", "Perkins Limited");
  console.info("Isolated local clone ready; hosted data and the normal local stack are not used for browser writes.");
  const check = spawn(process.execPath, ["--conditions=react-server","--import","tsx","--test",`tests/${webCheck ? "web" : demoPhotoCheck ? "photos-demo" : photoCheck ? "photos" : "log"}-browser.test.ts`],
    { cwd: root, env: { ...env, [webCheck ? "SITELEDGER_WEB_QA_DATABASE" : photoCheck ? "SITELEDGER_PHOTO_QA_DATABASE" : "SITELEDGER_LOG_QA_DATABASE"]: database }, stdio: "inherit", windowsHide: true });
  const code = await new Promise(resolve => check.on("exit",resolve));
  process.exitCode = code ?? 1;
} catch(error) {
  if (started) {
    const logs = spawnSync("docker",["logs","--tail","6",container],{encoding:"utf8",windowsHide:true});
    let detail = String(logs.stdout ?? "") + String(logs.stderr ?? "");
    for (const value of [settings.SERVICE_ROLE_KEY,settings.ANON_KEY,restEnv.PGRST_JWT_SECRET]) if(value) detail=detail.split(value).join("[credential]");
    console.error(detail.replace(/postgres(?:ql)?:\/\/\S+/g,"[database connection]"));
  }
  throw error;
} finally {
  clearInterval(keepAlive);
  if (preview) {
    preview.kill();
    await Promise.race([new Promise(resolve => preview.once("exit",resolve)), new Promise(resolve => setTimeout(resolve,3000))]);
  }
  if(proxy){proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
  if (!/^siteledger_(?:log|photo|web)_qa_[a-f0-9]{8}$/.test(database) || container !== database) throw new Error("Unsafe QA cleanup target.");
  if (started) command("docker",["rm","--force",container]);
  if (created) command("docker",["exec",dbContainer,"dropdb","-U","postgres","--force",database]);
  console.info("Disposable QA API and database removed. Original records preserved.");
}
