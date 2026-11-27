import "server-only";
import { AccountError } from "../auth/provider";
import { appOrigin, isAllowedAppHostname } from "../app-url";
export async function verifyTrialCaptcha(token:unknown,fetcher:typeof fetch=fetch){
  const secret=process.env.TURNSTILE_SECRET_KEY;
  if(!secret||!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||!appOrigin())throw new AccountError("The private trial is waiting for its bot-check setup.",503);
  if(typeof token!=="string"||!token||token.length>2048)throw new AccountError("Complete a fresh bot check.",422);
  const response=await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret,response:token}),redirect:"error",signal:AbortSignal.timeout(10000)});
  const result=await response.json();
  if(!response.ok||result.success!==true||!isAllowedAppHostname(result.hostname)||result.action!=="siteledger-trial")throw new AccountError("Complete a fresh bot check before starting the trial.",422);
}
