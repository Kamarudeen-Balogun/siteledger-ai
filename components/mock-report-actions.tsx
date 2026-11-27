"use client";

import { useState } from "react";
import { DiaryIcon } from "./diary-icon";

// Action buttons for the mock project's locked report. The mock report is
// demo data, not a real locked report, so it has no share record to enable:
// Share copies the link to the public sample report, which anyone can open,
// and Download serves the demo PDF.
export function MockReportActions() {
  const [message, setMessage] = useState("");
  async function share() {
    const url = new URL("/reports/demo", location.origin).href;
    try { await navigator.clipboard.writeText(url); setMessage("Link copied."); }
    catch { setMessage("Copy this link: " + url); }
  }
  return <nav aria-label="Report actions" className="stitch-report-actions report-toolbar">
    <button type="button" className="stitch-button" data-primary onClick={() => void share()}><DiaryIcon name="share" size={18}/>Share Report Link</button>
    <a download href="/api/reports/demo/pdf" className="stitch-button"><DiaryIcon name="pdf" size={19}/>Download Client PDF</a>
    {message && <p role="status">{message}</p>}
  </nav>;
}
