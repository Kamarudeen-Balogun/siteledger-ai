"use client";
import { useState } from "react";
import { DiaryIcon } from "./diary-icon";

export function ContactDesk() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText("kamarudeen@codeflowx.dev"); setCopied(true); setTimeout(() => setCopied(false), 3000); }
    catch { /* Clipboard unavailable — the address is shown in full below. */ }
  }
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm" aria-labelledby="desk-title">
    <p className="font-stamp-label text-[11px] uppercase tracking-wider text-on-surface-variant">Desk hours · WAT 07:00–18:00</p>
    <h2 id="desk-title" className="mt-2 font-headline-md text-headline-md text-on-surface">Direct Site &amp; Engineering Desk</h2>
    <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Get in touch directly with the builder in Lagos for tally-sheet audits, BoQ questions, or site issues.</p>
    <div className="mt-4 rounded-lg bg-surface-container-low p-3">
      <p className="font-stamp-label text-[11px] uppercase tracking-wider text-on-surface-variant">Primary direct inbox</p>
      <p className="mt-1 font-code-entry text-[15px] text-on-surface">kamarudeen@codeflowx.dev</p>
      <button type="button" className="mt-2 flex min-h-12 items-center gap-1.5 rounded-lg bg-surface-container-lowest px-4 font-label-ledger text-label-ledger text-on-surface shadow-sm hover:bg-surface-container" onClick={copy}><DiaryIcon name="copy" size={18}/>{copied ? "Email copied" : "Copy"}</button>
    </div>
    <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-surface-container-low p-3">
      <DiaryIcon name="history" size={20} />
      <p className="font-body-md text-body-md text-on-surface">Replies during Lagos site hours, <strong>7:00 AM – 6:00 PM WAT</strong>. Messages go straight to the builder.</p>
    </div>
    <h3 className="mt-5 font-headline-sm text-headline-sm text-on-surface">Builder channels</h3>
    <ul className="mt-2 divide-y divide-outline-variant">
      <li><a className="flex min-h-12 items-center gap-2.5 py-2 font-body-md text-body-md text-on-surface" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer"><DiaryIcon name="send" size={20} /><span><strong>Telegram @SiteLedgerNGbot</strong> — send a voice note or site photos to the bot.</span></a></li>
      <li><a className="flex min-h-12 items-center gap-2.5 py-2 font-body-md text-body-md text-on-surface" href="https://github.com/Kamarudeen-Balogun/siteledger-ai" target="_blank" rel="noreferrer"><DiaryIcon name="reports" size={20} /><span><strong>GitHub — SiteLedger AI</strong> — public source code and build documentation.</span></a></li>
      <li><a className="flex min-h-12 items-center gap-2.5 py-2 font-body-md text-body-md text-on-surface" href="https://codeflowx.dev" target="_blank" rel="noreferrer"><DiaryIcon name="team" size={20} /><span><strong>Balogun Kamarudeen Ayomide — CodeFlowX</strong> — Civil Engineer &amp; AI Automation Specialist.</span></a></li>
    </ul>
  </section>;
}
