"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function ReportActions({ id, weather = null, exists = false }: { id: string; weather?: string | null; exists?: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!navigator.onLine) { setError("You’re offline. Reconnect to create your report; your site note is saved."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/reports/${id}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weather: String(form.get("weather") ?? "").trim() || null }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Your note is saved. Try again."); return; }
      router.refresh();
    } catch { setError("Could not reach SiteLedger. Your confirmed note is saved; try again."); }
    finally { setSaving(false); }
  }
  const form = <form onSubmit={save} className="py-4"><label className="block">Weather for this record (optional)
    <textarea name="weather" defaultValue={weather ?? ""} maxLength={500} className="mt-2 min-h-24 w-full border border-rule bg-white/50 px-3 py-2" /></label>
    {error && <p className="mt-3 text-[#B91C1C]" role="alert">{error}</p>}
    <button className="stitch-button mt-4" data-primary disabled={saving}>{saving ? "Costing against the BoQ…" : exists ? "Rebuild draft report" : "Create costed report"}</button>
  </form>;
  return exists ? <details className="mb-5 border-b border-rule"><summary className="min-h-12 cursor-pointer py-3 underline">Change weather or rebuild this draft</summary>{form}</details> : form;
}
