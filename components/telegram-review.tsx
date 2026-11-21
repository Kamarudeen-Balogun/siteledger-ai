"use client";
import Script from "next/script";
import Link from "next/link";
import { useState } from "react";

type TelegramWindow = Window & { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } };
export function TelegramReview() {
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(true);
  async function openNote() {
    const app = (window as TelegramWindow).Telegram?.WebApp;
    if (!app?.initData) { setError("Open SiteLedger using the menu button in @SiteLedgerNGbot, or send /today and tap Review site note."); setOpening(false); return; }
    app.ready(); app.expand(); setOpening(true); setError("");
    try {
      const response = await fetch("/api/confirm/access", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: app.initData }), cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error); return; }
      // Stay in Telegram's webview; the private URL is never shown in chat.
      if (typeof result.url !== "string" || !result.url.startsWith("/confirm/")) throw new Error("Invalid review");
      window.location.replace(result.url);
    } catch { setError("Could not connect. Your voice note is saved; try again when data returns."); }
    finally { setOpening(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10">
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => { void openNote(); }} onError={() => { setError("Telegram could not load. Close and reopen SiteLedger, or use /today in the bot chat."); setOpening(false); }} />
    <p className="font-mono text-sm">SITELEDGER / SITE DIARY</p>
    <h1 className="mt-6 font-serif text-3xl">{opening ? "Opening your site note…" : "Your site diary"}</h1>
    <p className="mt-5 text-base leading-7" role={error ? "alert" : "status"}>{error || "Connecting your Telegram account to today’s voice note and photos."}</p>
    {!opening && <button type="button" className="mt-6 min-h-12 bg-accent px-5 py-3 text-white" onClick={openNote}>Try again</button>}
    <Link href="/today" className="mt-5 flex min-h-12 items-center underline">Record a new note in the web diary</Link>
  </main>;
}
