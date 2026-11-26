"use client";

import { useState } from "react";
import { useActionConfirmation } from "./action-confirmation";
import { DiaryIcon } from "./diary-icon";

export function ReportShare({ id }: { id: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { confirm, confirmation } = useActionConfirmation();
  const endpoint = `/api/reports/${id}/share`;

  async function request(enable?: boolean) {
    const response = await fetch(endpoint, enable === undefined ? { cache: "no-store" } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enable }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.path as string | null;
  }

  async function share() {
    setBusy(true); setMessage(""); setError("");
    try {
      let shared = await request();
      if (!shared) {
        if (!await confirm({ title: "Share this locked report?", description: "Anyone with the link can open this report, its photos and the PDF. You can turn off the link later.", confirmLabel: "Create share link" })) return;
        shared = await request(true);
      }
      setPath(shared);
      if (shared) await navigator.clipboard.writeText(new URL(shared, location.origin).href).then(() => setMessage("Link copied.")).catch(() => setMessage("Select the link below to copy it."));
    } catch { setError("Could not share this report. Try again."); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!await confirm({ title: "Turn off this share link?", description: "Anyone using the link will lose access to the report and PDF.", confirmLabel: "Turn off link" })) return;
    setBusy(true); setError(""); setMessage("");
    try { await request(false); setPath(null); setMessage("Share link turned off."); }
    catch { setError("Could not turn off the link. Try again."); }
    finally { setBusy(false); }
  }

  return <div className="report-share" data-tour="share">{confirmation}
    <button type="button" className="work-button" disabled={busy} onClick={() => void share()}><DiaryIcon name="send" size={18}/>Share</button>
    {path && <div className="report-share-details"><label>Client link<input className="my-2 min-h-12 w-full border border-rule bg-background px-3" readOnly value={new URL(path, location.origin).href} onFocus={event => event.currentTarget.select()} /></label><button type="button" className="text-link" disabled={busy} onClick={() => void revoke()}>Turn off link</button></div>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
