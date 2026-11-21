import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { UUID } from "../confirm/access";
import type { CaptureContext } from "./types";
type Claims = { project_id: string; actor_id: number; timezone: string; expires: number };
const sign = (payload: string, secret: string) => createHmac("sha256",secret).update("siteledger-web:v1:"+payload).digest();
export function captureAccess(context: Omit<CaptureContext,"access"|"expires">, secret: string, now=Date.now()) {
  if(!secret || !UUID.test(context.project_id) || !Number.isSafeInteger(context.actor_id) || context.actor_id <= 0) throw new Error("Capture access unavailable.");
  const claims: Claims = {project_id:context.project_id,actor_id:context.actor_id,timezone:context.timezone,expires:Math.floor(now/1000)+7*86400};
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {...context,expires:claims.expires,access:payload+"."+sign(payload,secret).toString("base64url")};
}
export function verifyCaptureAccess(value: string, secret: string, now=Date.now()): Claims | null {
  try {
    if(!secret || value.length > 1200 || !/^[\w-]+\.[\w-]+$/.test(value)) return null;
    const [payload,signed]=value.split("."), supplied=Buffer.from(signed,"base64url"), expected=sign(payload,secret);
    if(supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) return null;
    const claims = JSON.parse(Buffer.from(payload,"base64url").toString());
    if(Object.keys(claims).length !== 4 || !UUID.test(claims.project_id) || !Number.isSafeInteger(claims.actor_id) || claims.actor_id <= 0
      || typeof claims.timezone !== "string" || claims.timezone.length > 64 || !Number.isSafeInteger(claims.expires)
      || claims.expires <= Math.floor(now/1000) || claims.expires > Math.floor(now/1000)+7*86400) return null;
    return claims;
  } catch {return null;}
}
