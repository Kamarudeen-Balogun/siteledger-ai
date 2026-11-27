"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { Turnstile } from "./turnstile";
const roles = ["Foreman", "Site Engineer", "Project Manager / QS", "Client", "Viewer", "Other — custom role"] as const;
const topics = ["Product question", "Feedback or improvement", "Report a problem", "Something else"] as const;
const field = "mt-2 min-h-14 w-full border border-ink/60 bg-transparent px-4 py-3";
export function ContactForm({ siteKey }: { siteKey: string }) {
  const [role, setRole] = useState("");
  const [token, setToken] = useState(""), [reset, setReset] = useState(0);
  const [error, setError] = useState(""), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), role: form.get("role"), custom_role: form.get("custom_role"), topic: form.get("topic"), message: form.get("message"), captcha_token: token }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Could not send your message.");
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send your message."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  if (sent) return <section className="stitch-card"><h2>Message sent</h2><p className="mt-3 leading-7">Thank you. Your message is on its way to the builder.</p></section>;
  return <section className="stitch-card"><h2>Send a message</h2><form className="mt-5" onSubmit={submit}>
    <label className="mt-4 block">Your name<input className={field} name="name" required maxLength={120} autoComplete="name" /></label>
    <label className="mt-4 block">Your email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false} /></label>
    <label className="mt-4 block">Role on site (optional)<select className={field} name="role" value={role} onChange={event => setRole(event.target.value)}><option value="">Not given</option>{roles.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    {role === "Other — custom role" && <label className="mt-4 block">Your role<input className={field} name="custom_role" required maxLength={120} placeholder="For example: Safety officer" /></label>}
    <label className="mt-4 block">What is this about?<select className={field} name="topic" required defaultValue="">{["", ...topics].map(value => <option key={value} value={value} disabled={value === ""}>{value === "" ? "Choose a topic" : value}</option>)}</select></label>
    <label className="mt-4 block">Message<textarea className={`${field} min-h-32`} name="message" required minLength={10} maxLength={5000} /></label>
    <Turnstile siteKey={siteKey} onToken={setToken} reset={reset} />
    {error && <p role="alert" className="my-4 border-l-4 border-accent pl-4 leading-7">{error}</p>}
    <button className="work-button work-button-primary" disabled={busy || !token}>{busy ? "Sending…" : "Send message"}</button>
  </form></section>;
}
