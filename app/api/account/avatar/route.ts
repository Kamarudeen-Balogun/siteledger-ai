import { randomUUID } from "node:crypto";
import { requestSessionHash, accountForHash } from "@/lib/auth/session";
import { privateHeaders } from "@/lib/auth/api";
import { smallJson } from "@/lib/auth/request";
import { imageExtension, normalizedImage } from "@/lib/media/images";
import { intakeRpc, profileImage, uploadEvidence } from "@/lib/telegram/storage";

const limit = 2 * 1024 * 1024;
type Details = { phone: string | null; photo_path: string | null; old_path: string | null };

export async function GET(request: Request) {
  try {
    const hash = requestSessionHash(request);
    const data = hash ? await intakeRpc<Details | null>("account_profile_details",{p_hash:hash,p_update:null}) : null;
    if (!data?.photo_path) return new Response(null,{status:404,headers:privateHeaders});
    const photo = await profileImage(data.photo_path);
    if (!photo?.ok || !await accountForHash(hash)) return new Response(null,{status:404,headers:privateHeaders});
    return new Response(photo.body,{headers:{...privateHeaders,"Content-Type":"image/jpeg","X-Content-Type-Options":"nosniff"}});
  } catch { return new Response(null,{status:503,headers:privateHeaders}); }
}

export async function POST(request: Request) {
  const reply = (body: unknown,status=200) => Response.json(body,{status,headers:privateHeaders});
  if (request.headers.get("origin") !== process.env.SITELEDGER_APP_URL) return reply({ error:"Open your profile in SiteLedger." },403);
  const hash = requestSessionHash(request);
  let path: string | undefined;
  try {
    const actor = await accountForHash(hash);
    if (!actor) return reply({error:"Sign in to edit your profile."},401);
    if (!await intakeRpc("account_limit",{p_key:`profile-photo:${actor.profile_id}`,p_max:20,p_seconds:3600})) return reply({error:"Wait before updating your photo again."},429);
    const input = await smallJson(request,3650000);
    let update: Record<string,string | null>;
    if (Object.keys(input).length===1&&input.remove===true) update={photo_path:null};
    else if (Object.keys(input).length===1&&typeof input.phone==="string"&&input.phone.length<=40&&(!input.phone.trim()||/^[+\d(). -]{3,40}$/.test(input.phone.trim()))) update={phone:input.phone.trim()||null};
    else if (Object.keys(input).length===3&&typeof input.name==="string"&&input.name.length<=200&&typeof input.data==="string"&&input.data.length<=Math.ceil(limit/3)*4&&/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)&&typeof input.crop==="string"&&input.crop.length<=800000&&/^[A-Za-z0-9+/]+={0,2}$/.test(input.crop)) {
      let bytes: Uint8Array;
      try { await normalizedImage(Buffer.from(input.data,"base64"),imageExtension(input.name),limit,512);bytes=await normalizedImage(Buffer.from(input.crop,"base64"),"jpeg",limit,512); }
      catch (error) { return reply({error:error instanceof Error?error.message:"That file is not a real image."},422); }
      path=`account/${randomUUID()}.jpg`;
      await uploadEvidence(path,bytes,"image/jpeg"); update={photo_path:path};
    } else return reply({error:"Choose a JPEG, PNG or WebP photo up to 2 MB, or enter a valid phone number."},422);
    const result=await intakeRpc<Details|null>("account_profile_details",{p_hash:hash,p_update:update});
    if(!result)throw new Error("Expired session");
    if(result.old_path&&result.old_path!==result.photo_path)await profileImage(result.old_path,"DELETE").catch(()=>null);
    return reply({phone:result.phone,hasPhoto:Boolean(result.photo_path)});
  } catch {if(path)await profileImage(path,"DELETE").catch(()=>null);return reply({error:"Could not save your profile. Try again."},503);}
}
