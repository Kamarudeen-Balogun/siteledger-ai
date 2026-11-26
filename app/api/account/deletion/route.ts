import { createHmac, randomInt } from "node:crypto";
import { requestSessionHash } from "@/lib/auth/session";
import { privateHeaders } from "@/lib/auth/api";
import { smallJson } from "@/lib/auth/request";
import { AccountError } from "@/lib/auth/provider";
import { UUID } from "@/lib/confirm/access";
import { intakeRpc, profileImage } from "@/lib/telegram/storage";
import { sendProductEmail } from "@/lib/email/send";

type Result={email?:string;requested?:boolean;notified?:boolean;until_at?:string;photo_path?:string;error?:string};
const messages:Record<string,[string,number]>={
  verify_email:["Sign in with your verified email before requesting deletion.",403],
  admin_account:["The administrator account cannot be deleted here.",409],
  owned_projects:["Transfer or archive projects you own before requesting deletion.",409],
  already_requested:["Your deletion request is already awaiting review.",409],
  expired_code:["That code expired. Request a new one.",422],
  invalid_code:["That code doesn’t match. Check the latest email.",422],
  account_changed:["The account changed after this request. Ask the user to confirm a new request.",409],
  rate_limited:["You’ve tried too many times. Wait a little and try again.",429],
};
function hashCode(session:string,code:string) {
  return createHmac("sha256",session).update(`siteledger:deletion:${code}`).digest("hex");
}
export async function POST(request:Request) {
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
  if(request.headers.get("origin")!==process.env.SITELEDGER_APP_URL)return reply({error:"Open your account in SiteLedger."},403);
  const hash=requestSessionHash(request);
  if(!hash)return reply({error:"Sign in to continue."},401);
  const admin=process.env.SITELEDGER_FEEDBACK_OWNER_EMAIL??"";
  function deletion(action:string,value?:string) {return intakeRpc<Result|null>("account_deletion",{p_hash:hash,p_admin_email:admin,p_action:action,p_value:value??null});}
  function checked(result:Result|null) {
    if(!result)throw new AccountError("This request is unavailable.",404);
    if(result.error){const [message,status]=messages[result.error]??["Could not finish this request.",409];throw new AccountError(message,status);}
    return result;
  }
  try {
    const input=await smallJson(request,300);
    if(input.action==="start"&&Object.keys(input).length===1){
      if(!process.env.SITELEDGER_RESEND_API_KEY||!(process.env.SITELEDGER_FEEDBACK_FROM||process.env.SITELEDGER_EMAIL_FROM))return reply({error:"Email delivery is unavailable. Try again later."},503);
      const code=randomInt(0,100000000).toString().padStart(8,"0");
      const result=checked(await deletion("start",hashCode(hash,code)));
      await sendProductEmail(result.email!,"Confirm your SiteLedger account deletion request",`Enter this code in your signed-in SiteLedger account to submit your deletion request:\n\n${code}\n\nThe code expires in 10 minutes. After administrator approval, your account will be deleted and this email cannot register again for 30 days. Locked project records are retained. If you did not request this, ignore this email.`,"feedback");
      return reply({sent:true});
    }
    if(input.action==="verify"&&Object.keys(input).length===2&&typeof input.code==="string"&&/^\d{8}$/.test(input.code))return reply(checked(await deletion("verify",hashCode(hash,input.code))));
    if(input.action==="approve"&&Object.keys(input).length===2&&typeof input.id==="string"&&UUID.test(input.id)){
      const result=checked(await deletion("approve",input.id));
      if(result.notified)return reply({approved:true,emailSent:true});
      if(result.photo_path)await profileImage(result.photo_path,"DELETE").catch(()=>null);
      if(!result.email||!result.until_at)return reply({approved:true,emailSent:false});
      try{
        const date=new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:"UTC"}).format(new Date(result.until_at));
        await sendProductEmail(result.email,"Your SiteLedger account was deleted",`Your SiteLedger account has been deleted. You can register with this email again after the 30-day waiting period ends on ${date} (UTC). Your old account will not be restored. Previously locked project records and their original attribution remain in the project ledger.`,"feedback",input.id);
        checked(await deletion("notified",input.id));
        return reply({approved:true,emailSent:true});
      }catch{return reply({approved:true,emailSent:false});}
    }
    return reply({error:"Check the deletion request and try again."},422);
  }catch(error){return reply({error:error instanceof AccountError?error.message:"Could not complete this request. Try again."},error instanceof AccountError?error.status:503);}
}
