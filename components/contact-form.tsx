"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { Turnstile } from "./turnstile";
import { DiaryIcon } from "./diary-icon";
const roles = ["Foreman", "Site Engineer", "Project Manager / QS", "Client", "Viewer", "Other — custom role"] as const;
const topics = ["Product question", "Feedback or improvement", "Report a problem", "Something else"] as const;
const field = "mt-1 h-12 w-full rounded-lg bg-surface-container-low px-3.5 font-body-lg text-[16px] text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary";
const button = "flex min-h-12 items-center justify-center gap-2 rounded-lg border border-ink px-5 py-3 font-label-ledger text-label-ledger disabled:opacity-50";
const primary = `${button} border-primary-container bg-primary-container text-on-primary shadow hover:bg-primary active:translate-y-0.5`;
export function ContactForm({ siteKey }: { siteKey: string }) {
  const [role, setRole] = useState("");
  const [token, setToken] = useState(""), [reset, setReset] = useState(0);
  const [error, setError] = useState(""), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const project = String(form.get("project") ?? "").trim();
    const message = String(form.get("message") ?? "");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), role: form.get("role"), custom_role: form.get("custom_role"), topic: form.get("topic"), message: project ? `Project / Organization: ${project}\n\n${message}` : message, captcha_token: token }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Could not send your message.");
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send your message."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  if (sent) return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"><div className="flex items-center gap-2 text-secondary"><DiaryIcon name="seal" size={24} /><h2 className="font-headline-md text-headline-md text-on-surface">Message sent</h2></div><p className="mt-3 font-body-md text-body-md text-on-surface-variant">Thank you. Your message is on its way to the builder.</p><button type="button" className={`${button} mt-4 border-transparent bg-surface-container-low text-on-surface hover:bg-surface-container`} onClick={() => { setSent(false); setRole(""); setToken(""); setReset(value => value + 1); }}>Send another message</button></section>;
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"><h2 className="font-headline-md text-headline-md text-on-surface">Dispatch Message</h2><p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Direct channel into the builder’s triage queue.</p><form className="mt-2 flex flex-col" onSubmit={submit}>
    <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Your name<input className={field} name="name" required maxLength={120} autoComplete="name" /></label>
    <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Work email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false} /></label>
    <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Project / Organization<input className={field} name="project" maxLength={120} autoComplete="organization" /></label>
    <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Role on site (optional)<select className={field} name="role" value={role} onChange={event => setRole(event.target.value)}><option value="">Not given</option>{roles.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    {role === "Other — custom role" && <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Your role<input className={field} name="custom_role" required maxLength={120} placeholder="For example: Safety officer" /></label>}
    <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Inquiry topic<select className={field} name="topic" required defaultValue="">{["", ...topics].map(value => <option key={value} value={value} disabled={value === ""}>{value === "" ? "Choose a topic" : value}</option>)}</select></label>
    <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">Message<textarea className={`${field} h-auto min-h-32 py-3`} name="message" required minLength={10} maxLength={5000} /></label>
    <div className="mt-4 rounded-lg bg-surface-container-low p-3">
      <div className="flex items-center gap-2"><DiaryIcon name="check" size={18} /><span className="font-label-ledger text-label-ledger text-on-surface">Verify you are human</span><span className="ml-auto font-stamp-label text-[10px] uppercase text-on-surface-variant">Cloudflare Turnstile</span></div>
      <Turnstile siteKey={siteKey} onToken={setToken} reset={reset} />
      <p className="mt-1 flex items-start gap-1.5 font-body-sm text-[12px] leading-snug text-on-surface-variant"><DiaryIcon name="verified" size={16} />Turnstile check — the Send message button unlocks once it passes.</p>
    </div>
    {error && <p role="alert" className="my-4 rounded-lg border-l-4 border-error bg-error-container p-4 font-body-md text-body-md text-on-error-container">{error}</p>}
    <button className={`${primary} mt-4`} disabled={busy || !token}>{busy ? "Sending…" : "Send message"}<DiaryIcon name="send" size={18} /></button>
  </form></section>;
}
