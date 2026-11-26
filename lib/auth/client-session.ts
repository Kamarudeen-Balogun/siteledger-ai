"use client";
import type { Account } from "./types";

// One bootstrap across landing links, work navigation and account entry.
// A Telegram launch is proof only after the existing server verifier accepts it.
let pending: Promise<Account | null> | null = null;
export function resolveClientAccount(): Promise<Account | null> {
  pending ??= (async () => {
    const response = await fetch("/api/account", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Account access is temporarily unavailable. Try again.");
    const existing = (await response.json()).account as Account | null;
    if (existing?.profile_id) return existing;
    const app = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (!app?.initData) return null;
    const restored = await fetch("/api/account/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ init_data: app.initData }), cache: "no-store", signal: AbortSignal.timeout(10000) });
    const result = await restored.json();
    if (!restored.ok) throw new Error(result.error ?? "Reopen SiteLedger from the Telegram bot.");
    return result.account?.profile_id ? result.account : null;
  })().finally(() => { pending = null; });
  return pending;
}
