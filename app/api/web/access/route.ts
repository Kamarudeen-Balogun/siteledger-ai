import { requestSessionHash, sessionToken } from "@/lib/auth/session";
import { smallJson } from "@/lib/auth/request";
import { intakeRpc } from "@/lib/telegram/storage";
import type { CaptureContext } from "@/lib/web/types";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
export async function POST(request:Request){
  if(request.headers.get("origin")!==process.env.SITELEDGER_APP_URL)return Response.json({error:"Open your site diary on SiteLedger."},{status:403,headers});
  const hash=requestSessionHash(request);
  if(!hash)return Response.json({error:"Sign in and select the original project. Your queued files stay on this device."},{status:401,headers});
  try{
    const input = await smallJson(request,12000);
    if (Object.keys(input).length) return Response.json({error:"Capture uses your signed-in account and selected project."},{status:422,headers});
    const data=await intakeRpc<CaptureContext & {error?:string}|null>("account_capture_context",{p_hash:hash});
    if(!data || data.error)return Response.json({error:data?.error==="archived"?"This project is archived. Its queued files are kept.":"Select an authorized project before recording. Your saved files are kept."},{status:403,headers});
    // This retry nonce is not a login credential; every send checks the account.
    return Response.json({...data,access:sessionToken()},{headers});
  }catch{return Response.json({error:"Could not open capture. Your saved files are kept; try again."},{status:503,headers});}
}
