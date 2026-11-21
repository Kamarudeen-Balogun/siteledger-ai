"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function ApprovalForm({ id, version, reviewer }: { id: string; version: string; reviewer: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!navigator.onLine) { setError("Reconnect before approving. Your draft is saved."); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/reports/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_version: version }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Could not approve. Reopen the draft and try again."); return; }
      router.refresh();
    } catch { setError("Could not reach SiteLedger. Reopen the report to check its approval status before retrying."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={approve} className="mb-6 border-t border-rule py-5">
    <h2 className="font-serif text-2xl">Approve this daily record</h2>
    <p className="mt-3">Approval by {reviewer} locks the report, quantities and evidence. Later corrections become amendments.</p>
    <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" required disabled={saving} className="size-5 shrink-0" />I have reviewed this report and confirm it is ready to lock.</label>
    {error && <p role="alert" className="mb-4 text-[#B91C1C]">{error}</p>}
    <button disabled={saving} className="min-h-12 bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Locking the report…" : "Approve and lock report"}</button>
  </form>;
}
