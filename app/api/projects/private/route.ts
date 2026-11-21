import { requestSessionHash } from "@/lib/auth/session";
import { privateHeaders } from "@/lib/auth/api";
import { intakeRpc } from "@/lib/telegram/storage";
export async function GET(request: Request) {
  try { const data=await intakeRpc("account_list_projects",{p_hash:requestSessionHash(request)});return Response.json(data??{error:"Sign in to open your projects."},{status:data?200:401,headers:privateHeaders}); }
  catch { return Response.json({error:"Could not open projects just now."},{status:503,headers:privateHeaders}); }
}
