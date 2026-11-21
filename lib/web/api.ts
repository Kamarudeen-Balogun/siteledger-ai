import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { verifyCaptureAccess } from "./access";
import { validManifest, validMedia, MAX_WEB_AUDIO } from "./types";
import { intakeRpc, uploadEvidence } from "../telegram/storage";
import { createReviewToken } from "../confirm/access";
export const webHeaders = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
type Result = {error?: string; id?: string; status?: string; missing?: number[]; path?: string; asset?: {bytes:number;sha256:string;content_type:string}; busy?: boolean};
export type WebDependencies = {rpc:typeof intakeRpc;upload:typeof uploadEvidence};
export const webDependencies: WebDependencies = {rpc:intakeRpc,upload:uploadEvidence};
function authorize(request: Request) {
  if(request.headers.get("origin") !== process.env.SITELEDGER_APP_URL) return null;
  return verifyCaptureAccess(request.headers.get("authorization")?.replace(/^Bearer /,"")??"",process.env.TELEGRAM_WEBHOOK_SECRET??"");
}
function reply(result: Result, actor: number) {
  if(result.error) return Response.json({error:result.error === "rate_limited" ? "Too many site notes. Keep this queued note and try later." : "Project access or this queued note is unavailable. Reopen its original project."},
    {status:result.error === "rate_limited" ? 429 : result.error === "invalid" ? 400 : 403,headers:webHeaders});
  if(result.busy) return Response.json({error:"Upload is still saving. It will retry."},{status:503,headers:webHeaders});
  const url=result.status === "saved" && result.id ? `/confirm/${result.id}?access=${encodeURIComponent(createReviewToken(result.id,actor,process.env.TELEGRAM_WEBHOOK_SECRET??""))}` : undefined;
  return Response.json({...result,review_url:url},{headers:webHeaders});
}
export async function reserveWeb(request: Request, deps: WebDependencies=webDependencies) {
  const actor=authorize(request); if(!actor)return Response.json({error:"Capture access expired. Reopen your authorized site diary; the queued files are kept."},{status:401,headers:webHeaders});
  if(Number(request.headers.get("content-length")??0)>16000)return Response.json({error:"The site note is too large."},{status:413,headers:webHeaders});
  try {
    const text=await request.text();if(text.length>16000)return Response.json({error:"The site note is too large."},{status:413,headers:webHeaders});
    const manifest=JSON.parse(text);
    if(!validManifest(manifest) || manifest.project_id !== actor.project_id || manifest.timezone !== actor.timezone)
      return Response.json({error:"Use the original project and saved files for this queued note."},{status:400,headers:webHeaders});
    return reply(await deps.rpc<Result>("reserve_web_intake",{p_actor:actor.actor_id,p_project:actor.project_id,p_manifest:manifest}),actor.actor_id);
  } catch {return Response.json({error:"Could not save yet. Your queued files will retry."},{status:503,headers:webHeaders});}
}
export async function uploadWeb(request: Request,id:string,index:number,deps:WebDependencies=webDependencies) {
  const actor=authorize(request);if(!actor)return Response.json({error:"Capture access expired. Reopen your authorized site diary."},{status:401,headers:webHeaders});
  const owner=randomUUID();
  try {
    const claim=await deps.rpc<Result>("claim_web_asset",{p_id:id,p_actor:actor.actor_id,p_project:actor.project_id,p_index:index,p_owner:owner});
    if(claim.error || claim.busy || claim.status === "saved" || claim.status === "uploaded")return reply(claim,actor.actor_id);
    const asset=claim.asset;
    if(!asset || !claim.path)throw new Error("Upload unavailable");
    if(request.headers.get("content-type")?.split(";")[0] !== asset.content_type || Number(request.headers.get("content-length")??0)>asset.bytes)
      return Response.json({error:"Use the saved file for this queued note."},{status:400,headers:webHeaders});
    const chunks:Uint8Array[]=[];let length=0;const reader=request.body?.getReader();if(!reader)throw new Error("No file");
    try {while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;
      if(length>asset.bytes || length>MAX_WEB_AUDIO)return Response.json({error:"The file is too large."},{status:413,headers:webHeaders});chunks.push(item.value);}}
    finally {await reader.cancel().catch(()=>undefined);}
    const bytes=Buffer.concat(chunks);
    if(bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256 || !validMedia(bytes,asset.content_type))
      return Response.json({error:"This file does not match the queued note. The original files are kept."},{status:400,headers:webHeaders});
    await deps.upload(claim.path,bytes,asset.content_type);
    return reply(await deps.rpc<Result>("finish_web_asset",{p_id:id,p_actor:actor.actor_id,p_project:actor.project_id,p_index:index,p_owner:owner}),actor.actor_id);
  } catch {return Response.json({error:"Upload interrupted. Your queued files will retry."},{status:503,headers:webHeaders});}
  finally {await deps.rpc("release_web_asset",{p_id:id,p_actor:actor.actor_id,p_project:actor.project_id,p_index:index,p_owner:owner}).catch(()=>undefined);}
}
export async function finishWeb(request:Request,id:string,deps:WebDependencies=webDependencies,onSaved?:(id:string)=>void) {
  const actor=authorize(request);if(!actor)return Response.json({error:"Capture access expired. Reopen your authorized site diary."},{status:401,headers:webHeaders});
  try {
    const result=await deps.rpc<Result>("finalize_web_intake",{p_id:id,p_actor:actor.actor_id,p_project:actor.project_id});
    if(result.status === "saved" && result.id)onSaved?.(result.id);
    return reply(result,actor.actor_id);
  } catch {return Response.json({error:"Could not finish saving. Your queued files will retry."},{status:503,headers:webHeaders});}
}
