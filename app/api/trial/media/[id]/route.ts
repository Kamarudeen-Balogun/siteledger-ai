import { trialHash } from "@/lib/trial/session";
import { intakeRpc } from "@/lib/telegram/storage";
import { readEvidence } from "@/lib/confirm/data";
import { trialHeaders } from "@/lib/trial/api";
import type { TrialState } from "@/lib/trial/types";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
  const {id}=await params,hash=trialHash(request),state=hash?await intakeRpc<TrialState|null>("trial_read",{p_hash:hash}):null;
  const path=id==="audio"?state?.record?.audio_url:state?.record?.photos.find(photo=>photo.id===id)?.storage_url;
  if(!path)return new Response("Trial media unavailable.",{status:404,headers:trialHeaders});
  const file=await readEvidence(path,id==="audio");if(!await intakeRpc("trial_read",{p_hash:hash}))return new Response("Trial media unavailable.",{status:404,headers:trialHeaders});
  return new Response(file.bytes,{headers:{...trialHeaders,"Content-Type":file.contentType}});
}catch{return new Response("Trial media unavailable.",{status:503,headers:trialHeaders});}}
