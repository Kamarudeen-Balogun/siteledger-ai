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

const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
const button = "min-h-12 border border-ink px-5 py-3 text-base disabled:opacity-50";
const primary = `${button} bg-accent text-white border-accent`;
export async function accountAction(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch(`/api/account/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not complete this account action.");
  if (data.account || action === "logout") window.dispatchEvent(new Event("siteledger-account-change"));
  return data;
}
function Feedback({ error, message }: { error: string; message?: string }) { return error || message ? <p role={error ? "alert" : "status"} className={`my-5 border-l-4 p-4 leading-7 ${error ? "border-amber-700 bg-amber-50 text-amber-900" : "border-[#657055] bg-[#eef0e7]"}`}>{error || message}</p> : null; }
function Label({ children, title }: { children: ReactNode; title: string }) { return <label className="my-4 block">{title}{children}</label>; }
function EmailCodeInput() {
  return <input className={field} name="token" required inputMode="numeric" pattern={EMAIL_CODE_PATTERN} minLength={EMAIL_CODE_MIN_LENGTH} maxLength={EMAIL_CODE_MAX_LENGTH} autoComplete="one-time-code" spellCheck={false} />;
}
export function AccountLogin({ siteKey, telegramAccount, nextPath, purpose="email" }: { siteKey: string; telegramAccount?: Account; nextPath?: string; purpose?: "email" | "security" }) {
  const router = useRouter(), [signup, setSignup] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""), [reset, setReset] = useState(0), [validation,setValidation]=useState<Record<string,string>>({});
  const [pending, setPending] = useState<{ email: string; name: string; company: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await accountAction(signup ? "signup" : "signin", { email: form.get("email"), password: form.get("password"), captcha_token: token,
        ...(signup ? { name: form.get("name"), confirm_name: form.get("confirm_name") === "yes", company: form.get("company") } : {}),
        ...(telegramAccount ? { link_existing: true, ...(!signup ? { combine_profiles: form.get("combine_profiles") === "yes" } : {}) } : {}) });
      if (result.pending_confirmation) setPending({ email: String(form.get("email")), name: String(form.get("name")), company: String(form.get("company") ?? "") });
      else { await clearCachedContext().catch(()=>undefined); router.refresh(); }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  if (pending) return <SignupConfirmation pending={pending} siteKey={siteKey} telegramAccount={telegramAccount} nextPath={nextPath} />;
  return <section className="auth-panel">
    <h2 className="font-serif text-2xl">{telegramAccount?.browser_linked ? purpose==="security"?"Confirm website access":"Sign in to manage email" : telegramAccount ? "Connect website access" : signup ? "Create your account" : "Sign in to your site diary"}</h2>
    <p className="mt-4 leading-7">{telegramAccount?.browser_linked ? "Your projects are already available. Use your linked website login for email and sensitive account settings." : telegramAccount ? "Use your existing website account, or add email access to this Telegram account." : "Access your private projects and site records."}</p>
    <div className="auth-mode"><button type="button" aria-pressed={!signup} disabled={busy} onClick={() => { setSignup(false); setError(""); }}>Sign in</button>{!telegramAccount?.browser_linked && <button type="button" aria-pressed={signup} disabled={busy} onClick={() => { setSignup(true); setError(""); }}>Create account</button>}</div>
    <form onSubmit={submit}>
      <Label title="Email address"><input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false} aria-describedby="auth-email-error" onInvalid={event=>{const message=event.currentTarget.validationMessage;setValidation(value=>({...value,email:message}));}} onChange={()=>setValidation(value=>({...value,email:""}))}/><span id="auth-email-error" className="block text-amber-900" aria-live="polite">{validation.email}</span></Label>
      <Label title="Password"><input className={field} name="password" type="password" required minLength={12} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} aria-describedby="auth-password-error" onInvalid={event=>{const message=event.currentTarget.validationMessage;setValidation(value=>({...value,password:message}));}} onChange={()=>setValidation(value=>({...value,password:""}))}/><span id="auth-password-error" className="block text-amber-900" aria-live="polite">{validation.password}</span></Label>
      {signup && <p className="text-sm leading-6">Use 12–128 characters.</p>}
      {signup && <><Label title="Professional name for site records"><input className={field} name="name" required maxLength={120} autoComplete="name" defaultValue={telegramAccount?.professional_name ?? ""} /></Label><Label title="Company / Firm (optional)"><input className={field} name="company" maxLength={120} autoComplete="organization" spellCheck={false} /></Label><p className="text-sm leading-6">Leave this empty if you work on your own — your account works exactly the same.</p><label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" name="confirm_name" value="yes" required className="h-6 w-6 shrink-0" />I confirm this is the name to appear on my records.</label><p className="leading-7">We’ll send an email code before your first login. Enter the full code from the email.</p></>}
      {telegramAccount && !telegramAccount.browser_linked && !signup && <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" name="combine_profiles" value="yes" required className="h-6 w-6 shrink-0" />Connect this Telegram profile and the website account I sign into, keeping their project records.</label>}
      <Turnstile siteKey={siteKey} onToken={setToken} reset={reset} /><Feedback error={error} />
      <button type="submit" disabled={busy || !token} className={primary}>{busy ? "Connecting…" : signup ? "Create account" : telegramAccount && !telegramAccount.browser_linked ? "Sign in and connect" : "Sign in"}</button>
    </form>
    <Link href="/account/recover" className="mt-5 inline-flex min-h-12 items-center underline">Forgot your password?</Link>
    <WorkDisclosure title="Have a signup code already?"><Link href="/account/confirm" className="flex min-h-12 items-center underline">Enter your signup email code</Link></WorkDisclosure>
  </section>;
}
export function SignupConfirmation({ pending, siteKey, telegramAccount, nextPath }: { pending?: { email: string; name: string; company: string }; siteKey: string; telegramAccount?: Account; nextPath?: string }) {
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [message,setMessage]=useState("");
  const [token, setToken] = useState(""), [reset, setReset] = useState(0);
  async function resend(form:HTMLFormElement|null) {
    if(!form)return;
    const email=new FormData(form).get("email");setBusy(true);setError("");setMessage("");
    try{const data=await accountAction("resend_signup",{email});setMessage(data.message);}
    catch(error){setError(error instanceof Error?error.message:"Could not resend the code.");}finally{setBusy(false);}
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      await accountAction("verify_signup", { email: form.get("email"), token: form.get("token"), name: form.get("name"), confirm_name: form.get("confirm_name") === "yes", company: form.get("company"), captcha_token: token, ...(telegramAccount ? { link_existing: true } : {}) });
      await clearCachedContext().catch(()=>undefined); if (!nextPath) router.push("/projects"); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not confirm your email."); }
    finally { setBusy(false); setReset(value => value + 1); }
  }
  return <section className="auth-panel"><h2 className="font-serif text-2xl">Confirm your email</h2><p className="my-5 leading-7">{pending?`Enter the code sent to ${pending.email}.`:"Enter the full signup code from your email, including leading zeros."}</p><form onSubmit={submit}>
    {pending?<input name="email" type="hidden" value={pending.email}/>:<Label title="Signup email"><input className={field} type="email" name="email" required autoComplete="email" spellCheck={false} /></Label>}
    <Label title="Signup code"><EmailCodeInput /></Label><p className="text-sm leading-6">Enter the code we sent you (6–10 characters).</p>
    {pending?<><input name="name" type="hidden" value={pending.name}/><input name="company" type="hidden" value={pending.company}/><p className="mt-5">Your record name: <strong>{pending.name}</strong></p></>:<Label title="Professional name"><input className={field} name="name" required maxLength={120} defaultValue={telegramAccount?.professional_name ?? ""} autoComplete="name" /></Label>}
    <label className="my-4 flex min-h-12 items-center gap-3"><input name="confirm_name" type="checkbox" value="yes" required className="h-6 w-6 shrink-0" />I confirm this name for site records.</label>
    <Turnstile siteKey={siteKey} onToken={setToken} reset={reset} />
    <Feedback error={error} message={message}/><button className={primary} disabled={busy || !token}>{busy ? "Working…" : "Confirm email and continue"}</button><button type="button" className="text-link mt-3" disabled={busy} onClick={event=>void resend(event.currentTarget.form)}>Resend signup code</button></form><Link href="/account" className="mt-3 inline-flex min-h-12 items-center underline">Return to sign in</Link></section>;
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
      {other && <><p className="my-4 leading-7">Telegram is already connected to another website login. Prove that login too.</p><Label title="Other website email"><input className={field} name="other_email" type="email" required autoComplete="email" /></Label><Label title="Other website password"><input className={field} name="other_password" type="password" required minLength={12} maxLength={128} autoComplete="current-password" /></Label><Turnstile siteKey={siteKey} onToken={setToken} reset={reset} /></>}
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
    {needsPassword && <form onSubmit={reauthenticate}><Label title="Confirm your current password"><input className={field} name="password" type="password" minLength={12} maxLength={128} required autoComplete="current-password"/></Label><Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/><button className="stitch-button" disabled={busy || !token}>Confirm password</button></form>}
    {link && status?.proved && <form onSubmit={finish} className="max-w-md"><p className="my-4">Confirm after you receive the acknowledgment from @SiteLedgerNGbot.</p><label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" name="combine_profiles" value="yes" required className="h-6 w-6 shrink-0"/>{status.combining_profiles ? "Connect Telegram and combine its existing profile with this account." : "Connect this Telegram identity to my account."}</label>
      {status.other_browser_proof_required && <><Label title="Other website email"><input className={field} name="other_email" type="email" required autoComplete="email"/></Label><Label title="Other website password"><input className={field} name="other_password" type="password" required minLength={12} maxLength={128} autoComplete="current-password"/></Label>{!needsPassword && <Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/>}</>}
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
  if (account.email_verified) return <section className="settings-panel"><h2 className="font-serif text-2xl">Email & password</h2><dl className="settings-summary"><div><dt>Email</dt><dd>{account.email}<span>Ownership verified</span></dd></div></dl><p className="leading-7">You can accept invitations addressed to this email.</p><Link href="/account/recover" className="work-button mt-5">Reset your password</Link><WorkDisclosure title="Confirm current password" description="For ownership transfers and sensitive account actions"><PasswordConfirmation siteKey={siteKey}/></WorkDisclosure></section>;
  return <section className="settings-panel"><h2 className="font-serif text-2xl">Email for project invitations</h2><p className="my-4 leading-7">Verify {account.email} to accept invitations addressed to it. Enter the full code from your email.</p><Turnstile siteKey={siteKey} onToken={setToken} reset={reset} /><button className={button} disabled={busy || !token} onClick={() => void run("request_email_proof", { captcha_token: token })}>Send email code</button><form className="mt-5" onSubmit={event => { event.preventDefault(); void run("verify_email", { token: new FormData(event.currentTarget).get("token"), captcha_token: token }); }}><Label title="Email code"><EmailCodeInput /></Label><p className="text-sm leading-6">Enter the code we sent you (6–10 characters).</p><button className={primary} disabled={busy || !token}>Verify email ownership</button></form><Feedback error={error} message={message} /></section>;
}
function PasswordConfirmation({siteKey}:{siteKey:string}) {
  const [busy,setBusy]=useState(false),[token,setToken]=useState(""),[reset,setReset]=useState(0),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;setBusy(true);setError("");try{await accountAction("reauthenticate",{password:new FormData(form).get("password"),captcha_token:token});form.reset();setMessage("Password confirmed. Return to the action you were completing.");}catch(error){setError(error instanceof Error?error.message:"Could not confirm your password.");}finally{setBusy(false);setReset(value=>value+1);}}
  return <form onSubmit={submit}><Label title="Current password"><input className={field} name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password"/></Label><Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/><button className={primary} disabled={busy||!token}>{busy?"Confirming…":"Confirm password"}</button><Feedback error={error} message={message}/></form>;
}
export function PasswordRecovery({ siteKey }: { siteKey: string }) {
  const { confirm, confirmation } = useActionConfirmation();
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [token, setToken] = useState(""), [reset, setReset] = useState(0);
  const [step,setStep]=useState<"request"|"verify"|"new-password"|"done">("request");
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
    if (!enteredEmail || enteredCode.length < EMAIL_CODE_MIN_LENGTH || enteredCode.length > EMAIL_CODE_MAX_LENGTH || /[^0-9]/.test(enteredCode)) { setError("Enter the recovery email and the full 6–10 digit code."); return; }
    if (!token) { setError("Complete the bot check first."); return; }
    // The code itself is checked by the server when the new password is saved:
    // recovery codes are one-use, so they cannot be spent on a separate check.
    setEmail(enteredEmail); setCode(enteredCode); setCaptchaToken(token); setError(""); setStep("new-password");
  }
  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? ""), confirmPassword = String(form.get("confirm_password") ?? "");
    if (password !== confirmPassword) { setError("The two passwords don't match. Type the same new password in both boxes."); return; }
    void run("reset_password", { email, token: code, password, captcha_token: captchaToken });
  }
  const title = step==="request" ? "Get a recovery code" : step==="verify" ? "Enter your recovery code" : step==="new-password" ? "Choose your new password" : "Password updated";
  return <section className="auth-panel">{confirmation}<h2 className="font-serif text-2xl">{title}</h2>
    {step==="request"&&<><p className="my-5 leading-7">We’ll email a code so you can reset your password.</p><Label title="Account email"><input className={field} name="email" type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" spellCheck={false} disabled={busy}/></Label><Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/><button className={primary} disabled={busy||!token||!email} onClick={()=>void run("recover",{email,captcha_token:token})}>{busy?"Sending code…":"Send recovery code"}</button><button className="text-link mt-4 block" onClick={()=>{setStep("verify");setError("");setReset(value=>value+1);}}>I already have a recovery code</button></>}
    {step==="verify"&&<form onSubmit={verifyCode}><p className="my-5 leading-7">Enter the email you are recovering and the code from your email. A code alone cannot identify an account.</p><Label title="Account email"><input className={field} name="email" type="email" defaultValue={email} required autoComplete="email" spellCheck={false} disabled={busy}/></Label><Label title="Recovery code"><EmailCodeInput/></Label><p className="text-sm leading-6">Enter the code we sent you (6–10 characters).</p><Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/><button className={primary} disabled={busy||!token}>{busy?"Checking…":"Verify code"}</button><button type="button" className="text-link mt-4 block" disabled={busy} onClick={()=>{setStep("request");setError("");setMessage("");}}>Request another code</button></form>}
    {step==="new-password"&&<form onSubmit={changePassword}><p className="my-5 leading-7">Choose a new password for {email}. Use 12–128 characters. The code is checked when you save.</p><Label title="New password"><input className={field} name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></Label><Label title="Confirm new password"><input className={field} name="confirm_password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></Label><button className={primary} disabled={busy}>{busy?"Changing password…":"Change password"}</button></form>}
    <Feedback error={error} message={message}/><Link href="/account" className={step==="done"?"work-button work-button-primary mt-5":"mt-5 inline-flex min-h-12 items-center underline"}>Return to sign in</Link>
  </section>;
}
