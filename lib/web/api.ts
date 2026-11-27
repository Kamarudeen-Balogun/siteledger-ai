import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { requestSessionHash } from "../auth/session";
import { smallJson } from "../auth/request";
import { AccountError } from "../auth/provider";
import { validManifest, validMedia, MAX_WEB_AUDIO } from "./types";
import { intakeRpc, uploadEvidence } from "../telegram/storage";
import { isAllowedAppOrigin } from "../app-url";
export const webHeaders = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
type Result = {error?: string; id?: string; status?: string; missing?: number[]; path?: string; asset?: {bytes:number;sha256:string;content_type:string}; busy?: boolean};
export type WebDependencies = {rpc:typeof intakeRpc;upload:typeof uploadEvidence};
export const webDependencies: WebDependencies = {rpc:intakeRpc,upload:uploadEvidence};
function authorize(request: Request) {
  if(!isAllowedAppOrigin(request.headers.get("origin"))) return null;
  return requestSessionHash(request)||null;
}
function reply(result: Result) {
  if(result.error) return Response.json({error:result.error === "rate_limited" ? "Too many site notes. Keep this queued note and try later." : "Project access or this queued note is unavailable. Reopen its original project."},
    {status:result.error === "rate_limited" ? 429 : result.error === "invalid" ? 400 : 403,headers:webHeaders});
  if(result.busy) return Response.json({error:"Upload is still saving. It will retry."},{status:503,headers:webHeaders});
  const url=result.status === "saved" && result.id ? `/confirm/${result.id}` : undefined;
  return Response.json({...result,review_url:url},{headers:webHeaders});
}
export async function reserveWeb(request: Request, deps: WebDependencies=webDependencies) {
  const actor=authorize(request); if(!actor)return Response.json({error:"Capture access expired. Reopen your authorized site diary; the queued files are kept."},{status:401,headers:webHeaders});
  if(Number(request.headers.get("content-length")??0)>16000)return Response.json({error:"The site note is too large."},{status:413,headers:webHeaders});
  try {
    const manifest=await smallJson(request);
    if(!validManifest(manifest))
      return Response.json({error:"Use the original project and saved files for this queued note."},{status:400,headers:webHeaders});
    return reply(await deps.rpc<Result>("account_reserve_web",{p_hash:actor,p_project:manifest.project_id,p_manifest:manifest}));
  } catch(error) {return Response.json({error:error instanceof AccountError?error.message:"Could not save yet. Your queued files will retry."},{status:error instanceof AccountError?error.status:503,headers:webHeaders});}
}
export async function uploadWeb(request: Request,id:string,index:number,deps:WebDependencies=webDependencies) {
  const actor=authorize(request);if(!actor)return Response.json({error:"Capture access expired. Reopen your authorized site diary."},{status:401,headers:webHeaders});
  const owner=randomUUID();
  try {
    const claim=await deps.rpc<Result>("account_claim_web",{p_hash:actor,p_id:id,p_index:index,p_owner:owner});
    if(claim.error || claim.busy || claim.status === "saved" || claim.status === "uploaded")return reply(claim);
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
    return reply(await deps.rpc<Result>("account_finish_web",{p_hash:actor,p_id:id,p_index:index,p_owner:owner}));
  } catch {return Response.json({error:"Upload interrupted. Your queued files will retry."},{status:503,headers:webHeaders});}
  finally {await deps.rpc("account_release_web",{p_hash:actor,p_id:id,p_index:index,p_owner:owner}).catch(()=>undefined);}
}
export async function finishWeb(request:Request,id:string,deps:WebDependencies=webDependencies,onSaved?:(id:string)=>void) {
  const actor=authorize(request);if(!actor)return Response.json({error:"Capture access expired. Reopen your authorized site diary."},{status:401,headers:webHeaders});
  try {
    const result=await deps.rpc<Result>("account_finalize_web",{p_hash:actor,p_id:id});
    if(result.status === "saved" && result.id)onSaved?.(result.id);
    return reply(result);
  } catch {return Response.json({error:"Could not finish saving. Your queued files will retry."},{status:503,headers:webHeaders});}
}
