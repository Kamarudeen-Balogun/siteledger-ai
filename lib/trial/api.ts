import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { intakeRpc, uploadEvidence } from "../telegram/storage";
import { AccountError } from "../auth/provider";
import { smallJson } from "../auth/request";
import { requestSessionHash, sessionToken, secretHash } from "../auth/session";
import { trialCookie, trialHash } from "./session";
import { verifyTrialCaptcha } from "./captcha";
import { cleanExpiredTrials } from "./cleanup";
import { validTrialManifest, type TrialState } from "./types";
import { validMedia, MAX_WEB_AUDIO } from "../web/types";
import { validateConfirmation } from "../confirm/validation";
import { trialDocument } from "./data";
import { isAllowedAppOrigin } from "../app-url";
export const trialHeaders={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
export type TrialDependencies={rpc:typeof intakeRpc;upload:typeof uploadEvidence;verify:typeof verifyTrialCaptcha;cleanup:typeof cleanExpiredTrials};
export const trialDependencies:TrialDependencies={rpc:intakeRpc,upload:uploadEvidence,verify:verifyTrialCaptcha,cleanup:cleanExpiredTrials};
function checked<T>(value:T|null):T {if(!value)throw new AccountError("Trial access is unavailable or expired. Only work already saved to an account can be recovered.",401);if(typeof value==="object"&&"error" in value){const errors:Record<string,[string,number]>={rate_limited:["The trial limit has been reached. Try later or sign in for your private project.",429],busy:["Wait for the saved files and processing to finish, then retry.",409],one_note:["This trial already has a voice note. Reattach the original files to finish it.",409],invalid:["Check the trial files and confirmed quantities.",422],reauthenticate:["Sign in again or confirm your password on the account page before saving this work.",401],verify_account:["Confirm your account email and professional name before saving this work.",403]};const [message,status]=errors[String(value.error)]??["Trial access is unavailable.",403];throw new AccountError(message,status);}return value;}
function origin(request:Request){if(!isAllowedAppOrigin(request.headers.get("origin")))throw new AccountError("Open this action on SiteLedger.",403);}
export async function trialApi(request:Request,action:string,deps:TrialDependencies=trialDependencies,onSaved?:(hash:string)=>void){
  try{
    origin(request);const input=await smallJson(request,action==="confirm"?100000:16000),hash=trialHash(request);
    if(action==="start"){
      if(Object.keys(input).some(key=>!["captcha_token","accept_trial"].includes(key))||input.accept_trial!==true)throw new AccountError("Confirm the trial expiry and data notice before starting.",422);
      // Attempt cap precedes network work; accepted trial caps are atomic in SQL.
      if(!await deps.rpc("account_limit",{p_key:"trial-challenge-global",p_max:60,p_seconds:600}))throw new AccountError("Too many trial attempts. Try later.",429);
      await deps.verify(input.captcha_token);await deps.cleanup();
      const existing=hash?await deps.rpc<TrialState|null>("trial_read",{p_hash:hash}):null;if(existing)return Response.json(existing,{headers:trialHeaders});
      const token=sessionToken(),ip=(request.headers.get("x-vercel-forwarded-for")??request.headers.get("x-forwarded-for")??"local").split(",")[0].trim().slice(0,100);
      const result=checked(await deps.rpc<TrialState|null>("trial_start",{p_hash:secretHash(token),p_ip:secretHash(ip)}));
      return Response.json(result,{headers:{...trialHeaders,"Set-Cookie":trialCookie(token)}});
    }
    if(!hash)throw new AccountError("Open your active trial in this browser.",401);
    if(action==="reserve"){
      if(!validTrialManifest(input))throw new AccountError("Use one voice note and up to three photos, with the original saved files.",422);
      return Response.json(checked(await deps.rpc("trial_reserve",{p_hash:hash,p_manifest:input})),{headers:trialHeaders});
    }
    if(action==="finish"){
      if(Object.keys(input).length)throw new AccountError("Check the trial request.",422);
      const result=checked(await deps.rpc<TrialState|null>("trial_finalize",{p_hash:hash}));onSaved?.(hash);return Response.json(result,{headers:trialHeaders});
    }
    if(action==="confirm"){
      const state=checked(await deps.rpc<TrialState|null>("trial_read",{p_hash:hash}));
      if(!state.record||state.status!=="ready")throw new AccountError("Wait for upload and processing to finish.",409);
      if(!validateConfirmation(input,state.record.boq,state.record.photos.map(photo=>photo.id)))throw new AccountError("Review every quantity, unit, BoQ item and photo before confirming.",422);
      const draft=trialDocument(state,input);
      return Response.json(checked(await deps.rpc("trial_confirm",{p_hash:hash,p_values:input.values,p_boq_ids:input.boq_ids,p_notes:input.photo_notes,p_draft:draft})),{headers:trialHeaders});
    }
    if(action==="handover"){
      if(Object.keys(input).length!==1||input.confirm_handover!==true)throw new AccountError("Confirm that you want to save this trial work to your account.",422);
      const account=requestSessionHash(request);if(!account)throw new AccountError("Sign in to your verified account first.",401);
      const result=checked(await deps.rpc("trial_handover",{p_guest_hash:hash,p_account_hash:account}));
      return Response.json(result,{headers:{...trialHeaders,"Set-Cookie":trialCookie("",true)}});
    }
    throw new AccountError("Trial action unavailable.",404);
  }catch(error){return Response.json({error:error instanceof AccountError?error.message:"The trial request could not finish. Your saved files remain private; retry while the session is active."},{status:error instanceof AccountError?error.status:503,headers:trialHeaders});}
}
export async function uploadTrial(request:Request,index:number,deps:TrialDependencies=trialDependencies){
  let hash="";const owner=randomUUID();
  try{
    origin(request);hash=trialHash(request);if(!hash)throw new AccountError("Open your active trial.",401);
    const claim=checked(await deps.rpc<{asset?:{bytes:number;sha256:string;content_type:string};path?:string;uploaded?:boolean}|null>("trial_claim_asset",{p_hash:hash,p_index:index,p_owner:owner}));
    if(claim.uploaded)return Response.json(claim,{headers:trialHeaders});
    const asset=claim.asset;if(!asset||!claim.path)throw new AccountError("Trial file unavailable.",404);
    if(request.headers.get("content-type")?.split(";")[0]!==asset.content_type)throw new AccountError("Use the original file type.",422);
    const reader=request.body?.getReader();if(!reader)throw new AccountError("Choose the original file.",422);const chunks:Uint8Array[]=[];let length=0;
    try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>asset.bytes||length>MAX_WEB_AUDIO)throw new AccountError("This file exceeds the trial limit.",413);chunks.push(part.value);}}finally{await reader.cancel().catch(()=>undefined);}
    const bytes=Buffer.concat(chunks);
    if(bytes.length!==asset.bytes||createHash("sha256").update(bytes).digest("hex")!==asset.sha256||!validMedia(bytes,asset.content_type))throw new AccountError("This file does not match the original trial upload.",422);
    checked(await deps.rpc("trial_read",{p_hash:hash}));
    await deps.upload(claim.path,bytes,asset.content_type);
    return Response.json(checked(await deps.rpc("trial_finish_asset",{p_hash:hash,p_index:index,p_owner:owner})),{headers:trialHeaders});
  }catch(error){return Response.json({error:error instanceof AccountError?error.message:"Upload interrupted. Retry with the original files while this trial is active."},{status:error instanceof AccountError?error.status:503,headers:trialHeaders});}
  finally{if(hash)await deps.rpc("trial_release_asset",{p_hash:hash,p_index:index,p_owner:owner}).catch(()=>undefined);}
}
