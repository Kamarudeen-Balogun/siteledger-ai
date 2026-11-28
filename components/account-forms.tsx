"use client";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Turnstile } from "./turnstile";
import { useActionConfirmation } from "./action-confirmation";
import type { Account } from "@/lib/auth/types";
import { clearCachedContext } from "@/lib/web/queue";
import { EMAIL_CODE_MIN_LENGTH, EMAIL_CODE_MAX_LENGTH, EMAIL_CODE_PATTERN } from "@/lib/auth/email-code";
import { WorkDisclosure } from "./work-flow";
import { resolveClientAccount } from "@/lib/auth/client-session";
import { DiaryIcon } from "./diary-icon";

const field = "mt-1 h-12 w-full rounded-lg bg-surface-container-low px-3.5 font-body-lg text-[16px] text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary";
const button = "flex min-h-12 items-center justify-center gap-2 rounded-lg border border-ink px-5 py-3 font-label-ledger text-label-ledger disabled:opacity-50";
const primary = `${button} border-primary-container bg-primary-container text-on-primary shadow hover:bg-primary active:translate-y-0.5`;
const secondary = `${button} border-transparent bg-surface-container-low text-on-surface hover:bg-surface-container active:translate-y-0.5`;
export async function accountAction(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch(`/api/account/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not complete this account action.");
  if (data.account || action === "logout") window.dispatchEvent(new Event("siteledger-account-change"));
  return data;
}
function Feedback({ error, message }: { error: string; message?: string }) { return error || message ? <p role={error ? "alert" : "status"} className={`my-4 rounded-lg border-l-4 p-4 leading-7 ${error ? "border-error bg-error-container text-on-error-container" : "border-secondary bg-secondary-container text-on-secondary-container"}`}>{error || message}</p> : null; }
function Label({ children, title }: { children: ReactNode; title: string }) { return <label className="mt-4 block font-label-ledger text-label-ledger text-on-surface">{title}{children}</label>; }
function BotCheck({ siteKey, onToken, reset, action, unlocks }: { siteKey: string; onToken: (token: string) => void; reset: number; action?: string; unlocks: string }) {
  return <div className="mt-4 rounded-lg bg-surface-container-low p-3">
    <div className="flex items-center gap-2"><DiaryIcon name="check" size={18} /><span className="font-label-ledger text-label-ledger text-on-surface">Verify you are human</span><span className="ml-auto font-stamp-label text-[10px] uppercase text-on-surface-variant">Cloudflare Turnstile</span></div>
    <Turnstile siteKey={siteKey} onToken={onToken} reset={reset} action={action} />
    <p className="mt-1 flex items-start gap-1.5 font-body-sm text-[12px] leading-snug text-on-surface-variant"><DiaryIcon name="verified" size={16} />Turnstile check — the {unlocks} button unlocks once it passes.</p>
  </div>;
}
function PasswordField({ name, label, autoComplete, value, onChange, describedBy }: { name: string; label: string; autoComplete: string; value?: string; onChange?: (value: string) => void; describedBy?: string }) {
  const [shown, setShown] = useState(false);
  return <div className="mt-4">
    <div className="flex items-center justify-between"><label htmlFor={name} className="font-label-ledger text-label-ledger text-on-surface">{label}</label></div>
    <div className="relative">
      <input id={name} className={`${field} pr-20`} name={name} type={shown ? "text" : "password"} required minLength={12} maxLength={128} autoComplete={autoComplete} aria-describedby={describedBy} value={value} onChange={onChange ? event => onChange(event.target.value) : undefined} />
      <button type="button" onClick={() => setShown(value => !value)} aria-label={shown ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded font-label-ledger text-[13px] text-on-surface-variant hover:text-on-surface">{shown ? "Hide" : "Show"}</button>
    </div>
  </div>;
}
function PasswordRules({ value }: { value: string }) {
  const rules = [
    { label: "At least 12 characters in length", ok: value.length >= 12 },
    { label: "Includes at least one numeral (0-9)", ok: /[0-9]/.test(value) },
    { label: "A mix of letters, numbers or symbols", ok: /[a-zA-Z]/.test(value) && (/[0-9]/.test(value) || /[^a-zA-Z0-9]/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value))) },
  ];
  return <div className="mt-2.5 space-y-1.5 rounded-lg bg-surface-container-low p-2.5">
    {rules.map(rule => <div key={rule.label} className="flex items-center gap-2 font-label-ledger text-[12px] text-on-surface-variant">
      {rule.ok ? <DiaryIcon name="check" size={16} /> : <span aria-hidden="true" className="mx-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-outline" />}
      <span className={rule.ok ? "text-secondary" : undefined}>{rule.label}</span>
    </div>)}
  </div>;
}
function codeProblem(code: string) {
  if (!code) return "Enter the code from your email.";
  if (/[^0-9]/.test(code)) return "Enter digits only — the code is 6–10 numbers.";
  if (code.length < EMAIL_CODE_MIN_LENGTH) return "That code is too short — enter all 6–10 digits.";
  if (code.length > EMAIL_CODE_MAX_LENGTH) return "That code is too long — enter 6–10 digits.";
  return "";
}
function EmailCodeInput({ onCodeError }: { onCodeError?: (message: string) => void }) {
  return <input className={field} name="token" required inputMode="numeric" pattern={EMAIL_CODE_PATTERN} minLength={EMAIL_CODE_MIN_LENGTH} maxLength={EMAIL_CODE_MAX_LENGTH} autoComplete="one-time-code" spellCheck={false} onInvalid={event => { const message = codeProblem(event.currentTarget.value); if (message && onCodeError) { event.preventDefault(); onCodeError(message); } }} />;
}
export function AccountLogin({ siteKey, telegramAccount, nextPath, purpose="email" }: { siteKey: string; telegramAccount?: Account; nextPath?: string; purpose?: "email" | "security" }) {
  const router = useRouter(), [signup, setSignup] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""), [reset, setReset] = useState(0), [validation,setValidation]=useState<Record<string,string>>({});
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<{ email: string; name: string; company: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      // The server still requires confirm_name for signup; the name typed here
      // is the account name, and the professional name is confirmed separately
      // on the profile screen (ProfessionalProfile). No checkbox is shown here.
      const result = await accountAction(signup ? "signup" : "signin", { email: form.get("email"), password: form.get("password"), captcha_token: token,
        ...(signup ? { name: form.get("name"), confirm_name: true, company: form.get("company") } : {}),
        ...(telegramAccount ? { link_existing: true, ...(!signup ? { combine_profiles: form.get("combine_profiles") === "yes" } : {}) } : {}) });
      if (result.pending_confirmation) setPending({ email: String(form.get("email")), name: String(form.get("name")), company: String(form.get("company") ?? "") });
      else { await clearCachedContext().catch(()=>undefined); router.refresh(); }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  if (pending) return <SignupConfirmation pending={pending} siteKey={siteKey} telegramAccount={telegramAccount} nextPath={nextPath} />;
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
    <div className="flex items-start gap-2.5 rounded-lg bg-surface-container-low p-3">
      <DiaryIcon name="verified" size={20} />
      <div>
        <div className="font-label-ledger text-label-ledger text-on-surface">{telegramAccount?.browser_linked ? purpose==="security"?"Confirm website access":"Sign in to manage email" : telegramAccount ? "Connect website access" : "Your account"}</div>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{telegramAccount?.browser_linked ? "Your projects are already available. Use your linked website login for email and sensitive account settings." : telegramAccount ? "Use your existing website account, or add email access to this Telegram account." : "Sign in or create an account with your email — that’s all you need."}</p>
      </div>
    </div>
    <div className="mb-5 mt-4 flex items-center justify-between rounded-xl bg-surface-container-high p-1 shadow-sm" role="tablist" aria-label="Account access">
      <button type="button" role="tab" aria-selected={!signup} onClick={() => { setSignup(false); setError(""); }} className={`h-12 flex-1 rounded-lg font-label-ledger text-[13px] transition-all ${!signup ? "bg-surface-container-lowest font-semibold text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>Sign In</button>
      {!telegramAccount?.browser_linked && <button type="button" role="tab" aria-selected={signup} onClick={() => { setSignup(true); setError(""); }} className={`h-12 flex-1 rounded-lg font-label-ledger text-[13px] transition-all ${signup ? "bg-surface-container-lowest font-semibold text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>Register</button>}
    </div>
    <form onSubmit={submit}>
      {signup && <h2 className="font-headline-sm text-headline-sm text-on-surface">Create your account</h2>}
      {signup && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">All you need is your name, your email and a password.</p>}
      <div className="flex flex-col">
        {signup && <Label title="Full name"><input className={field} name="name" type="text" required maxLength={120} autoComplete="name" defaultValue={telegramAccount?.professional_name ?? ""} /></Label>}
        <Label title="Email"><input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false} aria-describedby="auth-email-error" onInvalid={event=>{const message=event.currentTarget.validationMessage;setValidation(value=>({...value,email:message}));}} onChange={()=>setValidation(value=>({...value,email:""}))}/><span id="auth-email-error" className="mt-1 block font-body-sm text-body-sm text-error" aria-live="polite">{validation.email}</span></Label>
        <div>
          <PasswordField name="password" label="Password" autoComplete={signup ? "new-password" : "current-password"} value={signup ? password : undefined} onChange={signup ? setPassword : undefined} />
          {!signup && <div className="mt-1 text-right"><Link href="/account/recover" className="inline-flex min-h-[44px] items-center font-label-ledger text-[12px] text-primary hover:underline">Forgot password?</Link></div>}
          {signup && <PasswordRules value={password} />}
        </div>
        {signup && <><Label title="Company / Firm (optional)"><input className={field} name="company" maxLength={120} autoComplete="organization" spellCheck={false} /></Label><p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Optional — leave it empty if you don’t have one. Your account works exactly the same.</p>
        <label className="mt-4 flex min-h-12 cursor-pointer items-start gap-2.5"><input className="mt-1 h-5 w-5 shrink-0 rounded accent-primary" type="checkbox" required /><span className="font-body-sm text-[12px] leading-snug text-on-surface-variant">I agree to the <Link href="/terms" className="text-primary underline">Terms of Service</Link> &amp; <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.</span></label>
        <p className="mt-3 leading-7">We’ll send an email code before your first login. Enter the full code from the email.</p></>}
        {telegramAccount && !telegramAccount.browser_linked && !signup && <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" name="combine_profiles" value="yes" required className="h-6 w-6 shrink-0 accent-primary" />Connect this Telegram profile and the website account I sign into, keeping their project records.</label>}
      </div>
      <BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks={signup ? "Create account" : "Sign in"} />
      <Feedback error={error} />
      <button type="submit" disabled={busy || !token} className={`${primary} mt-4`}>{busy ? "Connecting…" : signup ? "Create account" : telegramAccount && !telegramAccount.browser_linked ? "Sign in and connect" : "Sign in"}{!busy && <DiaryIcon name={signup ? "review" : "chevron"} size={18} />}</button>
    </form>
    {!signup && <>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-container-low p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container"><DiaryIcon name="send" size={18} /></div>
        <p className="flex-1 font-body-sm text-body-sm text-on-surface">Foreman on weak connectivity? <a className="font-label-ledger text-primary underline" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer">Connect via Telegram Bot</a></p>
      </div>
      <Link href="/trial" className="mt-2 flex min-h-[48px] items-center gap-2 px-2 font-label-ledger text-label-ledger text-on-surface-variant hover:text-primary"><DiaryIcon name="explore" size={16} />Try it without an account</Link>
    </>}
    <WorkDisclosure title="Have a signup code already?"><Link href="/account/confirm" className="flex min-h-12 items-center underline">Enter your signup email code</Link></WorkDisclosure>
  </section>;
}
export function SignupConfirmation({ pending, siteKey, telegramAccount, nextPath }: { pending?: { email: string; name: string; company: string }; siteKey: string; telegramAccount?: Account; nextPath?: string }) {
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [message,setMessage]=useState("");
  const [token, setToken] = useState(""), [reset, setReset] = useState(0), [codeError, setCodeError] = useState("");
  async function resend(form:HTMLFormElement|null) {
    if(!form)return;
    const email=new FormData(form).get("email");setBusy(true);setError("");setMessage("");
    try{const data=await accountAction("resend_signup",{email});setMessage(data.message);}
    catch(error){setError(error instanceof Error?error.message:"Could not resend the code.");}finally{setBusy(false);}
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setCodeError(""); const form = new FormData(event.currentTarget);
    const code = String(form.get("token") ?? "");
    const problem = codeProblem(code);
    if (problem) { setCodeError(problem); setBusy(false); return; }
    try {
      // The server still requires confirm_name; the professional name is
      // confirmed separately on the profile screen. No checkbox is shown here.
      await accountAction("verify_signup", { email: form.get("email"), token: code, name: form.get("name"), confirm_name: true, company: form.get("company"), captcha_token: token, ...(telegramAccount ? { link_existing: true } : {}) });
      await clearCachedContext().catch(()=>undefined); if (!nextPath) router.push("/projects"); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not confirm your email."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
    <div className="flex items-start gap-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed"><DiaryIcon name="email" size={22} /></div>
      <div><h2 className="font-headline-sm text-headline-sm text-on-surface">Enter your code</h2>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{pending?`We sent a code to ${pending.email}. Enter it below to continue.`:"Enter the code we sent to your email, then continue."}</p></div>
    </div>
    <form onSubmit={submit} className="mt-2 flex flex-col">
    {pending?<input name="email" type="hidden" value={pending.email}/>:<Label title="Email"><input className={field} type="email" name="email" required autoComplete="email" spellCheck={false} /></Label>}
    <Label title="Verification code"><EmailCodeInput onCodeError={setCodeError} /></Label>
    <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Enter the code we sent you (6–10 characters).</p>
    {codeError && <p role="alert" className="mt-2 rounded-lg bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">{codeError}</p>}
    {pending?<><input name="name" type="hidden" value={pending.name}/><input name="company" type="hidden" value={pending.company}/><p className="mt-4 font-body-md text-body-md text-on-surface">Your record name: <strong>{pending.name}</strong></p></>:<Label title="Full name"><input className={field} name="name" required maxLength={120} defaultValue={telegramAccount?.professional_name ?? ""} autoComplete="name" /></Label>}
    <BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Verify code" />
    <Feedback error={error} message={message}/><button className={`${primary} mt-4`} disabled={busy || !token}>{busy ? "Working…" : "Verify code"}</button><button type="button" className="mt-3 inline-flex min-h-[48px] items-center justify-center gap-1.5 font-label-ledger text-label-ledger text-on-surface-variant hover:text-on-surface" disabled={busy} onClick={event=>void resend(event.currentTarget.form)}><DiaryIcon name="history" size={18} />Resend code</button></form>
    <p className="mt-3 text-center font-body-sm text-body-sm text-on-surface-variant">Didn’t get it? Check your spam folder, or go back and check the email address you used.</p>
    <Link href="/account" className="mt-3 inline-flex min-h-12 items-center font-label-ledger text-label-ledger text-primary hover:underline">Back to sign in</Link></section>;
}
export function TelegramAccountEntry() {
  const router = useRouter(), [error, setError] = useState("");
  async function connect() {
    const api = (window as Window & { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } }).Telegram?.WebApp;
    if (!api?.initData) return;
    api.ready(); api.expand();
    try { const account = await resolveClientAccount(); if (account) router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Reopen from Telegram."); }
  }
  return <><Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => { void connect(); }} /><Feedback error={error} />{error && <button className={button} onClick={connect}>Reconnect Telegram</button>}</>;
}
export function TelegramConnect({ account, siteKey }: { account: Account; siteKey: string }) {
  const { confirm, confirmation } = useActionConfirmation();
  const router = useRouter(), [initData, setInitData] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [other, setOther] = useState(false), [token, setToken] = useState(""), [reset, setReset] = useState(0);
  function ready() {
    const app = (window as Window & { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } }).Telegram?.WebApp;
    if (app?.initData) { app.ready(); app.expand(); setInitData(app.initData); }
  }
  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (!await confirm({title:"Connect these Telegram and website accounts?",description:"The accounts must both be yours. Their existing records and permissions stay preserved; earlier names and signatures will not change.",confirmLabel:"Connect Telegram",detail:<p>{account.professional_name ?? account.email}</p>})) return;
    setBusy(true); setError("");
    try {
      await accountAction("connect_telegram", { init_data: initData, combine_profiles: form.get("confirm") === "yes",
        ...(other ? { other_email: form.get("other_email"), other_password: form.get("other_password"), captcha_token: token } : {}) });
      router.refresh();
    } catch (error) { const text = error instanceof Error ? error.message : "Could not connect Telegram."; setError(text); if (text.includes("already has website access")) setOther(true); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  return <>{confirmation}<Script src="https://telegram.org/js/telegram-web-app.js" onReady={ready} />{initData && !account.telegram_linked && account.source === "browser" && <section className="telegram-connect-required my-7 max-w-md border-y border-rule py-6">
    <h2 className="font-serif text-2xl">Connect this Telegram account</h2><p className="my-4 leading-7">You are signed in as {account.professional_name ?? "your website account"}. Connect the Telegram account you opened this Mini App from, keeping your project records together.</p>
    <form onSubmit={connect}><label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" name="confirm" value="yes" required className="h-6 w-6 shrink-0" />I confirm that both accounts are mine and want to connect them.</label>
      {other && <><p className="my-4 leading-7">Telegram is already connected to another website login. Prove that login too.</p><Label title="Other website email"><input className={field} name="other_email" type="email" required autoComplete="email"/></Label><Label title="Other website password"><input className={field} name="other_password" type="password" required minLength={12} maxLength={128} autoComplete="current-password"/></Label><BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Connect Telegram" /></>}
      <Feedback error={error} /><button className={primary} disabled={busy || (other && !token)}>{busy ? "Connecting…" : "Connect Telegram"}</button></form>
  </section>}</>;
}
export function ProfessionalProfile({ account }: { account: Account }) {
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [dirty,setDirty]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await accountAction("profile", { name: form.get("name"), confirm_name: form.get("confirm_name") === "yes" }); setDirty(false); setMessage("Professional name saved. Earlier recorded names remain unchanged."); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save your name."); }
    finally { setBusy(false); }
  }
  return <section className="settings-panel"><h2 className="font-serif text-2xl">Your professional name</h2><p className="mt-3 leading-7">This name appears on new confirmations, approvals and amendments. Earlier records keep their original names.</p>
    <form onSubmit={submit} onChange={()=>setDirty(true)} data-unsaved={dirty&&!busy}><Label title="Name"><input className={field} name="name" defaultValue={account.professional_name ?? ""} required maxLength={120} autoComplete="name" /></Label><label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" required name="confirm_name" value="yes" className="h-6 w-6 shrink-0" />I confirm this professional name.</label><button className={primary} disabled={busy}>{busy?"Saving name…":"Confirm name"}</button></form>
    <Feedback error={error} message={message} />
  </section>;
}
export function AccountSignOut({ account }: { account: Account }) {
  const { confirm, confirmation } = useActionConfirmation();
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function logout() {
    if (!await confirm({title:"Sign out of SiteLedger?",description:"Your records stay preserved. Queued files remain on this device, and you will need to sign in again to send them.",confirmLabel:"Sign out",detail:<p>{account.professional_name ?? account.email}</p>})) return;
    setBusy(true); setError("");
    try { await accountAction("logout"); await clearCachedContext().catch(()=>undefined); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not sign out."); }
    finally { setBusy(false); }
  }
  return <div className="settings-signout">{confirmation}<Feedback error={error}/><button type="button" className={button} onClick={logout} disabled={busy}>{busy?"Signing out…":"Sign out"}</button></div>;
}
export function TelegramLink({ siteKey, account, project }: { siteKey: string; account: Account; project?: { id: string; name: string } }) {
  const router = useRouter();
  const { confirm, confirmation } = useActionConfirmation();
  const [token, setToken] = useState(""), [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false), [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [link, setLink] = useState<{ id: string; url: string; code: string; expires_at: string } | null>(null);
  const [status, setStatus] = useState<{ proved: boolean; combining_profiles: boolean; other_browser_proof_required: boolean } | null>(null);
  const [seconds, setSeconds] = useState(0), [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!link) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((Date.parse(link.expires_at) - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) { setLink(null); setStatus(null); setExpired(true); setMessage(""); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [link]);

  async function run(action: string, input: Record<string, unknown> = {}) {
    if (action === "link_finish" || action === "unlink_telegram") {
      const disconnect = action === "unlink_telegram";
      if (!await confirm({
        title: disconnect ? "Disconnect Telegram?" : "Confirm this Telegram connection?",
        description: disconnect ? "You’ll need to reconnect before sending work in Telegram again." : project ? `New site notes in Telegram will go to ${project.name}.` : "SiteLedger will use this Telegram identity for your account.",
        confirmLabel: disconnect ? "Disconnect Telegram" : "Confirm connection",
        danger: disconnect, detail: <p>{account.professional_name ?? account.email}</p>,
      })) return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await accountAction(action, input);
      if (action === "link_create") {
        setLink(data); setSeconds(Math.max(0, Math.ceil((Date.parse(data.expires_at) - Date.now()) / 1000)));
        setStatus(null); setExpired(false);
      } else if (action === "link_status") {
        setStatus(data);
        if (!data.proved) setMessage("Waiting for Telegram. Send the code to @SiteLedgerNGbot, then check again.");
      } else if (action === "reauthenticate") {
        setNeedsPassword(false);
        setMessage("Password confirmed. You can continue.");
      } else {
        setLink(null); setStatus(null); setExpired(false);
        setMessage(action === "unlink_telegram" ? "Telegram disconnected." : project ? `Telegram connected to ${project.name}.` : "Telegram connected.");
        router.refresh();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not connect Telegram.";
      if (action === "link_status" && reason.includes("expired or was replaced")) {
        setLink(null); setStatus(null); setExpired(true);
      } else {
        if (reason.includes("Confirm your password again") || (action === "unlink_telegram" && reason.includes("Sign in again"))) setNeedsPassword(true);
        setError(reason);
      }
    } finally {
      setBusy(false);
      if (input.captcha_token) { setToken(""); setReset(value => value + 1); }
    }
  }

  function generate() { void run("link_create", project ? { project_id: project.id } : {}); }
  async function copyCode() {
    if (!link || Date.now() >= Date.parse(link.expires_at)) return;
    try {
      await navigator.clipboard.writeText(link.code);
      setMessage("Code copied. Paste it into your chat with @SiteLedgerNGbot.");
    } catch { setMessage("Select and copy the code, or use Open in Telegram."); }
  }
  function reauthenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run("reauthenticate", { password: form.get("password"), captcha_token: token });
  }
  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run("link_finish", { id: link?.id, combine_profiles: form.get("combine_profiles") === "yes",
      ...(status?.other_browser_proof_required ? { other_email: form.get("other_email"), other_password: form.get("other_password"), captcha_token: token } : {}) });
  }

  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return <section className="stitch-card stitch-team-telegram" data-tour="team-telegram">{confirmation}
    <div className="stitch-telegram-heading">
      <span className="stitch-telegram-icon"><DiaryIcon name="telegram"/></span>
      <div><h2>{project || !account.telegram_linked ? "Connect Telegram" : "Telegram connection"}</h2><p>{project ? "Link your Telegram so site notes sync to this project. Keep this code private." : account.telegram_linked ? "Your website and Telegram use the same account." : "Connect Telegram to keep your chat and website records together."}</p></div>
      {!status?.proved && <button type="button" className="stitch-button" data-white disabled={busy || needsPassword} onClick={link ? () => void copyCode() : generate}><DiaryIcon name="copy" size={16}/>{link ? "Copy" : "Reveal"}</button>}
    </div>
    <div className="stitch-telegram-code">
      <code>{expired ? "Expired — regenerate" : link && !status?.proved ? link.code : "•••• •••• ••••"}</code>
      <span className="stitch-kicker">{expired ? "Code expired" : link ? `${status?.proved ? "Received · " : ""}Expires in ${countdown}` : "Hidden — tap Reveal"}</span>
    </div>
    {(link || expired) && <div className="stitch-telegram-actions">
      {link && !status?.proved && <><a href={link.url} className="stitch-button" data-primary target="_blank" rel="noreferrer">Open in Telegram</a><button type="button" className="stitch-button" disabled={busy} onClick={() => void run("link_status", { id: link.id })}>Check connection</button></>}
      <button type="button" className="stitch-button" disabled={busy || needsPassword} onClick={generate}>Regenerate</button>
    </div>}
    {link && !status?.proved && <p className="mt-3">Open Telegram or paste the code in your chat with @SiteLedgerNGbot. Return here after the bot acknowledges it.</p>}
    {/* The submit button is required: without it the password form has no
        way to send — the Turnstile widget alone cannot complete the step,
        which left Reveal dead-ended behind the password gate. */}
    {needsPassword && <form onSubmit={reauthenticate}><Label title="Confirm your current password"><input className={field} name="password" type="password" minLength={12} maxLength={128} required autoComplete="current-password"/></Label><BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Confirm password" /><button className={`${primary} mt-4`} disabled={busy || !token}>{busy ? "Confirming…" : "Confirm password"}</button></form>}
    {link && status?.proved && <form onSubmit={finish} className="max-w-md"><p className="my-4">Confirm after you receive the acknowledgment from @SiteLedgerNGbot.</p><label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" name="combine_profiles" value="yes" required className="h-6 w-6 shrink-0"/>{status.combining_profiles ? "Connect Telegram and combine its existing profile with this account." : "Connect this Telegram identity to my account."}</label>
      {status.other_browser_proof_required && <><Label title="Other website email"><input className={field} name="other_email" type="email" required autoComplete="email"/></Label><Label title="Other website password"><input className={field} name="other_password" type="password" required minLength={12} maxLength={128} autoComplete="current-password"/></Label>{!needsPassword && <BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Confirm connection" />}</>}
      <button className="stitch-button" data-primary disabled={busy || needsPassword || (status.other_browser_proof_required && !token)}>Confirm connection</button></form>}
    {!project && account.telegram_linked && <button type="button" className="stitch-button mt-3" disabled={busy || needsPassword} onClick={() => void run("unlink_telegram")}>Disconnect Telegram</button>}
    <Feedback error={error} message={message}/>
  </section>;
}
export function EmailProof({ siteKey, account }: { siteKey: string; account: Account }) {
  const router = useRouter(), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [token, setToken] = useState(""), [reset, setReset] = useState(0);
  async function run(action: string, input: Record<string, unknown>) {
    setError(""); setBusy(true);
    try { const data = await accountAction(action, input); setMessage(data.message ?? "Email ownership verified. You can accept an invitation addressed to this email."); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not check your email."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  if (account.email_verified) return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"><h2 className="font-headline-sm text-headline-sm text-on-surface">Email &amp; password</h2><dl className="mt-4 flex flex-col gap-3"><div className="border-b border-surface-container-high pb-4"><dt className="font-body-sm text-body-sm text-on-surface-variant">Email</dt><dd className="mt-1 font-body-md text-body-md text-on-surface">{account.email}<span className="mt-1 block font-body-sm text-body-sm text-secondary">Ownership verified</span></dd></div></dl><p className="mt-3 leading-7">You can accept invitations addressed to this email.</p><Link href="/account/recover" className={`${secondary} mt-4`}>Reset your password</Link><WorkDisclosure title="Confirm current password" description="For ownership transfers and sensitive account actions"><PasswordConfirmation siteKey={siteKey}/></WorkDisclosure></section>;
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"><h2 className="font-headline-sm text-headline-sm text-on-surface">Email for project invitations</h2><p className="my-4 leading-7">Verify {account.email} to accept invitations addressed to it. Enter the full code from your email.</p><BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Send email code" /><button className={secondary} disabled={busy || !token} onClick={() => void run("request_email_proof", { captcha_token: token })}>Send email code</button><form className="mt-5" onSubmit={event => { event.preventDefault(); void run("verify_email", { token: new FormData(event.currentTarget).get("token"), captcha_token: token }); }}><Label title="Email code"><EmailCodeInput /></Label><p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Enter the code we sent you (6–10 characters).</p><button className={`${primary} mt-4`} disabled={busy || !token}>Verify email ownership</button></form><Feedback error={error} message={message} /></section>;
}
function PasswordConfirmation({siteKey}:{siteKey:string}) {
  const [busy,setBusy]=useState(false),[token,setToken]=useState(""),[reset,setReset]=useState(0),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;setBusy(true);setError("");try{await accountAction("reauthenticate",{password:new FormData(form).get("password"),captcha_token:token});form.reset();setMessage("Password confirmed. Return to the action you were completing.");}catch(error){setError(error instanceof Error?error.message:"Could not confirm your password.");}finally{setBusy(false);setReset(value=>value+1);}}
  return <form onSubmit={submit}><Label title="Current password"><input className={field} name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password"/></Label><BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Confirm password" /><button className={`${primary} mt-4`} disabled={busy||!token}>{busy?"Confirming…":"Confirm password"}</button><Feedback error={error} message={message}/></form>;
}
export function PasswordRecovery({ siteKey }: { siteKey: string }) {
  const { confirm, confirmation } = useActionConfirmation();
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [token, setToken] = useState(""), [reset, setReset] = useState(0);
  const [step,setStep]=useState<"request"|"verify"|"new-password"|"done">("request");
  const [newPassword, setNewPassword] = useState(""), [codeError, setCodeError] = useState("");
  async function run(action: string, input: Record<string, unknown>) {
    if (action === "reset_password" && !await confirm({title:"Change your account password?",description:"Your current password will be replaced. Site records stay preserved; sign in again with the new password after the reset.",confirmLabel:"Change password",detail:<p>{email}</p>})) return;
    setError(""); setBusy(true);
    try { const data = await accountAction(action, input); setMessage(data.message); setStep(action==="recover"?"verify":"done"); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not reset your password."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const enteredEmail = String(form.get("email") ?? "").trim(), enteredCode = String(form.get("token") ?? "");
    const problem = !enteredEmail ? "Enter the email address for the account you are recovering." : codeProblem(enteredCode);
    if (problem) { setCodeError(problem); return; }
    if (!token) { setError("Complete the bot check first."); return; }
    // The code itself is checked by the server when the new password is saved:
    // recovery codes are one-use, so they cannot be spent on a separate check.
    setEmail(enteredEmail); setCode(enteredCode); setCaptchaToken(token); setError(""); setCodeError(""); setStep("new-password");
  }
  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? ""), confirmPassword = String(form.get("confirm_password") ?? "");
    if (password !== confirmPassword) { setError("The two passwords don’t match. Type the same new password in both boxes."); return; }
    void run("reset_password", { email, token: code, password, captcha_token: captchaToken });
  }
  const title = step==="request" ? "Reset your ledger access" : step==="verify" ? "Enter your code" : step==="new-password" ? "Create a new password" : "Password changed";
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">{confirmation}
    <div className="flex items-start gap-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed"><DiaryIcon name="lock" size={22} /></div>
      <div><h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{step==="request" ? "Enter your registered project email. We will send a recovery code to restore your access." : step==="verify" ? "We sent a code to your email. Enter it below to continue." : step==="new-password" ? `Your code checked out. Set a new password for ${email} — your old password stops working as soon as you save this one.` : "Your password has been changed. Sign in with your new password to get back into your account."}</p></div>
    </div>
    {step==="request"&&<div className="mt-2 flex flex-col">
      <Label title="Work email address"><input className={field} name="email" type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" spellCheck={false} disabled={busy}/></Label>
      <BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Send recovery code" />
      <Feedback error={error} message={message}/>
      <button className={`${primary} mt-4`} disabled={busy||!token||!email} onClick={()=>void run("recover",{email,captcha_token:token})}>{busy?"Sending code…":"Send recovery code"}<DiaryIcon name="send" size={18} /></button>
      <div className="relative flex items-center justify-center py-2"><div className="h-px w-full bg-surface-container-highest" /><span className="absolute bg-surface-container-lowest px-3 font-stamp-label text-[10px] uppercase tracking-wider text-outline">OR</span></div>
      <button type="button" className={secondary} onClick={()=>{setStep("verify");setError("");setCodeError("");setReset(value=>value+1);}}><DiaryIcon name="lock" size={18} />I already have a recovery code</button>
      <Link href="/account" className="mt-2 flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg font-label-ledger text-label-ledger text-on-surface-variant hover:text-on-surface"><DiaryIcon name="back" size={18} />Return to sign in</Link>
    </div>}
    {step==="verify"&&<form onSubmit={verifyCode} className="mt-2 flex flex-col">
      <Label title="Email you are recovering"><input className={field} name="email" type="email" defaultValue={email} required autoComplete="email" spellCheck={false} disabled={busy}/></Label>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">A code on its own can’t tell us which account it belongs to — we need the email too.</p>
      <Label title="Verification code"><EmailCodeInput onCodeError={setCodeError} /></Label>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Enter the code we sent you (6–10 characters).</p>
      {codeError && <p role="alert" className="mt-2 rounded-lg bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">{codeError}</p>}
      <BotCheck siteKey={siteKey} onToken={setToken} reset={reset} unlocks="Verify code" />
      <Feedback error={error} message={message}/>
      <button className={`${primary} mt-4`} disabled={busy||!token}>{busy?"Checking…":"Verify code"}</button>
      <button type="button" className="mt-3 inline-flex min-h-[48px] items-center justify-center gap-1.5 font-label-ledger text-label-ledger text-on-surface-variant hover:text-on-surface" disabled={busy} onClick={()=>{setStep("request");setError("");setCodeError("");setMessage("");}}>Request another code</button>
      <p className="mt-3 text-center font-body-sm text-body-sm text-on-surface-variant">Didn’t get it? Check your spam folder, or go back and check the email address you used.</p>
    </form>}
    {step==="new-password"&&<form onSubmit={changePassword} className="mt-2 flex flex-col">
      <PasswordField name="password" label="New password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
      <PasswordRules value={newPassword} />
      <PasswordField name="confirm_password" label="Confirm new password" autoComplete="new-password" />
      <Feedback error={error} message={message}/>
      <button className={`${primary} mt-4`} disabled={busy}>{busy?"Changing password…":"Set new password"}</button>
    </form>}
    {step==="done"&&<div className="mt-4 flex flex-col items-start gap-3">
      <div className="flex items-center gap-2 text-secondary"><DiaryIcon name="seal" size={24} /><span className="font-label-ledger text-label-ledger">Password changed</span></div>
      <Feedback error={error} message={message}/>
      <Link href="/account" className={`${primary} w-full`}>Go to sign in</Link>
    </div>}
    {step!=="done" && <Link href="/account" className="mt-4 inline-flex min-h-12 items-center font-label-ledger text-label-ledger text-primary hover:underline">Back to sign in</Link>}
  </section>;
}
