import { accountForHash, requestSessionHash } from "@/lib/auth/session";
import { privateHeaders } from "@/lib/auth/api";
export async function GET(request: Request) {
  try { return Response.json({ account: await accountForHash(requestSessionHash(request)) }, { headers: privateHeaders }); }
  catch { return Response.json({ error: "Account access is temporarily unavailable." }, { status: 503, headers: privateHeaders }); }
}
