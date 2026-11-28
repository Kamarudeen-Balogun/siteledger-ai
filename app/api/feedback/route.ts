import { randomUUID } from "node:crypto";
import { isAllowedAppOrigin } from "@/lib/app-url";
import { requestSessionHash, accountForHash } from "@/lib/auth/session";
import { privateHeaders } from "@/lib/auth/api";
import { smallJson } from "@/lib/auth/request";
import { UUID } from "@/lib/confirm/access";
import { normalizedImage, imageExtension } from "@/lib/media/images";
import { intakeRpc, profileImage, uploadEvidence } from "@/lib/telegram/storage";
import { sendProductEmail } from "@/lib/email/send";

const limit=2*1024*1024;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
const admin=()=>process.env.SITELEDGER_FEEDBACK_OWNER_EMAIL??"";

export async function GET(request:Request) {
  const id=new URL(request.url).searchParams.get("photo"),hash=requestSessionHash(request);
  if(!hash||!id||!UUID.test(id))return new Response(null,{status:404,headers:privateHeaders});
  try {
    const data=await intakeRpc<{photo_path:string|null}|null>("account_feedback",{p_hash:hash,p_admin_email:admin(),p_id:id});
    const photo=data?.photo_path?await profileImage(data.photo_path):null;
    return photo?.ok?new Response(photo.body,{headers:{...privateHeaders,"Content-Type":"image/jpeg","X-Content-Type-Options":"nosniff"}}):new Response(null,{status:404,headers:privateHeaders});
  }catch{return new Response(null,{status:503,headers:privateHeaders});}
}
export async function POST(request:Request) {
  if(!isAllowedAppOrigin(request.headers.get("origin")))return reply({error:"Open the feedback form in SiteLedger."},403);
  const hash=requestSessionHash(request);let path:string|undefined;
  try {
    const account=await accountForHash(hash);if(!account)return reply({error:"Sign in to send feedback."},401);
    if(!await intakeRpc("account_limit",{p_key:`feedback:${account.profile_id}`,p_max:25,p_seconds:3600}))return reply({error:"Wait before sending more feedback."},429);
    const input=await smallJson(request,2850000);
    const text=(value:unknown)=>typeof value==="string"&&value.trim().length>0&&value.length<=5000?value.trim():null;
    if(typeof input.id==="string"&&UUID.test(input.id)){
      if(input.delete===true){
        if(Object.keys(input).some(key=>!["id","delete"].includes(key)))return reply({error:"Check the delete request."},422);
        const result=await intakeRpc<{deleted:boolean}|null>("account_feedback",{p_hash:hash,p_admin_email:admin(),p_id:input.id,p_input:{delete:true}});
        if(!result)return reply({error:"Feedback unavailable."},404);
        return reply({saved:true,deleted:true});
      }
      const message=text(input.reply),status=input.status;
      if(Object.keys(input).some(key=>!["id","status","reply"].includes(key))||(!message&&typeof status!=="string")||(status!==undefined&&!(["New","In progress","Resolved"] as unknown[]).includes(status)))return reply({error:"Check the reply or select a status."},422);
      const result=await intakeRpc<{recipient:string|null}|null>("account_feedback",{p_hash:hash,p_admin_email:admin(),p_id:input.id,p_input:{...(message?{reply:message}:{}),...(status?{status}:{})}});
      if(!result)return reply({error:"Feedback unavailable."},404);
      let emailSent=false;
      if(message&&result.recipient)try{await sendProductEmail(result.recipient,"A reply from SiteLedger",message,"feedback");emailSent=true;}catch{ /* The saved reply remains available in Account. */ }
      return reply({saved:true,emailSent});
    }
    const message=text(input.message);
    if(!message||!(["Bug","Improvement","Complaint"] as unknown[]).includes(input.kind)||Object.keys(input).some(key=>!["kind","message","name","data"].includes(key)))return reply({error:"Select a feedback type and enter a message."},422);
    if(input.data!==undefined){
      if(typeof input.name!=="string"||input.name.length>200||typeof input.data!=="string"||input.data.length>Math.ceil(limit/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))return reply({error:"Choose a screenshot up to 2 MB."},422);
      let image:Uint8Array;try{image=await normalizedImage(Buffer.from(input.data,"base64"),imageExtension(input.name),limit,1200);}catch{return reply({error:"That file is not a real image or exceeds 2 MB."},422);}
      path=`account/${randomUUID()}.jpg`;await uploadEvidence(path,image,"image/jpeg");
    }
    const result=await intakeRpc("account_feedback",{p_hash:hash,p_admin_email:admin(),p_input:{kind:input.kind,message,photo_path:path??null}});
    if(!result)throw new Error("Cannot save feedback");return reply({saved:true},201);
  }catch{if(path)await profileImage(path,"DELETE").catch(()=>null);return reply({error:"Could not send feedback. Try again."},503);}
}
