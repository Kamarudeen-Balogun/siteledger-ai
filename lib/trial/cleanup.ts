import "server-only";
import { intakeRpc } from "../telegram/storage";
export async function cleanExpiredTrials(){try{
  const paths=await intakeRpc<string[]>("trial_cleanup_claim",{});
  if(!paths.length||paths.some(path=>!/^[-a-f0-9]{36}\/[-a-f0-9]{36}\/[0-3]\.(ogg|mp3|m4a|webm|wav|jpg)$/.test(path)))return;
  const base=Reflect.get(process.env,"NEXT_PUBLIC_SUPABASE_URL") as string|undefined,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return;
  const response=await fetch(new URL("/storage/v1/object/site-evidence",base),{method:"DELETE",headers:{apikey:key,...(key.startsWith("eyJ")?{Authorization:`Bearer ${key}`}:{ }),"Content-Type":"application/json"},body:JSON.stringify({prefixes:paths}),signal:AbortSignal.timeout(10000)});
  if(response.ok)await intakeRpc("trial_cleanup_finish",{p_paths:paths});
}catch{/* Temporary objects remain eligible for the next cleanup attempt. */}}
