"use client";
import { useState } from "react";
import { DiaryIcon } from "./diary-icon";

export function ContactDesk() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText("kamarudeen@codeflowx.dev"); setCopied(true); setTimeout(() => setCopied(false), 3000); }
    catch { /* Clipboard unavailable — the address is shown in full below. */ }
  }
  return <section className="stitch-card" aria-labelledby="desk-title">
    <h2 id="desk-title">Direct site &amp; engineering desk</h2>
    <p className="mt-3 leading-7">Get in touch directly with the builder in Lagos for tally-sheet audits, BoQ questions, or site issues.</p>
    <div className="mt-5">
      <p className="stitch-kicker">Primary direct inbox</p>
      <p className="mt-2 text-lg font-semibold">kamarudeen@codeflowx.dev</p>
      <button type="button" className="work-button mt-3" onClick={copy}><DiaryIcon name="copy" size={18}/>{copied ? "Email copied" : "Copy"}</button>
    </div>
    <p className="mt-5 leading-7">Messages go straight to the builder. Expect a reply during Lagos site hours (7:00 AM – 6:00 PM WAT).</p>
    <h3 className="mt-6 font-serif text-xl">Builder channels</h3>
    <ul className="ruled-points">
      <li><a className="text-link" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer">Telegram @SiteLedgerNGbot</a> — send a voice note or site photos to the bot.</li>
      <li><a className="text-link" href="https://github.com/Kamarudeen-Balogun/siteledger-ai" target="_blank" rel="noreferrer">GitHub — SiteLedger AI</a> — public source code and build documentation.</li>
      <li><a className="text-link" href="https://codeflowx.dev" target="_blank" rel="noreferrer">Balogun Kamarudeen Ayomide — CodeFlowX</a> — Civil Engineer &amp; AI Automation Specialist.</li>
    </ul>
  </section>;
}
