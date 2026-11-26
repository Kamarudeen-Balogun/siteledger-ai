import { accountForHash, requestSessionHash } from "@/lib/auth/session";
import { privateHeaders } from "@/lib/auth/api";
import { intakeRpc } from "@/lib/telegram/storage";
export async function GET(request: Request) {
  try { const hash=requestSessionHash(request), account=await accountForHash(hash);const profile=account?await intakeRpc<{photo_path:string|null}|null>("account_profile_details",{p_hash:hash,p_update:null}).catch(()=>null):null;return Response.json({ account: account?{...account,has_photo:Boolean(profile?.photo_path)}:null }, { headers: privateHeaders }); }
  catch { return Response.json({ error: "Account access is temporarily unavailable." }, { status: 503, headers: privateHeaders }); }
}
