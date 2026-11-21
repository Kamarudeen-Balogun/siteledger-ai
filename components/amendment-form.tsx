"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useActionConfirmation } from "./action-confirmation";
export function AmendmentForm({ id }: { id: string }) {
  const router = useRouter(), requestId = useRef<string | null>(null);
  const { confirm, confirmation } = useActionConfirmation();
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  async function amend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const note = String(new FormData(form).get("note") ?? "").trim();
    setError(""); setSaved(false);
    if (!navigator.onLine) { setError("Reconnect to save your amendment. Your text is still here."); return; }
    if (!await confirm({title:"Save this permanent amendment?",description:"This note will become an append-only correction linked to the original report. The original quantities, costs and evidence stay unchanged.",confirmLabel:"Save amendment",detail:<p className="whitespace-pre-wrap">{note}</p>})) return;
    requestId.current ??= crypto.randomUUID(); setSaving(true);
    try {
      const response = await fetch(`/api/reports/${id}/amendments`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, request_id: requestId.current }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Could not save. Your correction is still here."); return; }
      form.reset(); requestId.current = null; setSaved(true); router.refresh();
    } catch { setError("Could not reach SiteLedger. Your text is still here; retry to check or save the same amendment."); }
    finally { setSaving(false); }
  }
  return <>{confirmation}<form onSubmit={amend} className="my-6 border-t border-rule py-5">
    <h2 className="font-serif text-2xl">Add an amendment</h2><p className="mt-3">Describe the correction and why it is needed. The original report stays unchanged.</p>
    <label className="mt-4 block">Correction note<textarea name="note" required maxLength={5000} disabled={saving}
      onChange={() => { requestId.current = null; setSaved(false); }} className="mt-2 min-h-32 w-full border border-rule bg-white/50 px-3 py-2" /></label>
    {error && <p role="alert" className="mt-3 text-[#B91C1C]">{error}</p>}
    {saved && <p role="status" className="mt-3 font-semibold text-[#46523B]">Amendment saved. The original report is preserved.</p>}
    <button disabled={saving} className="mt-4 min-h-12 bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving amendment…" : "Save amendment"}</button>
  </form></>;
}
