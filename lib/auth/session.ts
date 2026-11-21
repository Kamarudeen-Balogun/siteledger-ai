import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { intakeRpc } from "../telegram/storage";
import type { Account } from "./types";

export const ACCOUNT_COOKIE = "siteledger_session";
export const secretHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const sessionToken = () => randomBytes(32).toString("base64url");
export function requestSessionHash(request: Request): string {
  const value = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(ACCOUNT_COOKIE + "="))?.slice(ACCOUNT_COOKIE.length + 1) ?? "";
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? secretHash(value) : "";
}
export async function currentSessionHash(): Promise<string> {
  const value = (await cookies()).get(ACCOUNT_COOKIE)?.value ?? "";
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? secretHash(value) : "";
}
export async function accountForHash(hash: string, recent = false): Promise<Account | null> {
  return hash ? intakeRpc("account_session", { p_hash: hash, p_recent: recent }) : null;
}
export async function currentAccount(): Promise<Account | null> { return accountForHash(await currentSessionHash()); }
export function accountCookie(token: string, clear = false): string {
  const secure = process.env.SITELEDGER_APP_URL?.startsWith("https:") ? "; Secure" : "";
  return `${ACCOUNT_COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 43200}${secure}`;
}
