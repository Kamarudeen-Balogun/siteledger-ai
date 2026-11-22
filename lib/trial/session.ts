import "server-only";
import { cookies } from "next/headers";
import { secretHash } from "../auth/session";
import { TRIAL_COOKIE } from "./types";
export function trialHash(request:Request){const token=request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(TRIAL_COOKIE+"="))?.slice(TRIAL_COOKIE.length+1)??"";return /^[A-Za-z0-9_-]{43}$/.test(token)?secretHash(token):"";}
export async function currentTrialHash(){const token=(await cookies()).get(TRIAL_COOKIE)?.value??"";return /^[A-Za-z0-9_-]{43}$/.test(token)?secretHash(token):"";}
export function trialCookie(token:string,clear=false){return `${TRIAL_COOKIE}=${clear?"":token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:86400}${process.env.SITELEDGER_APP_URL?.startsWith("https:")?"; Secure":""}`;}
