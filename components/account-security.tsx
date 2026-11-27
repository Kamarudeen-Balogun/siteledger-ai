"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { accountAction } from "./account-forms";
import { Turnstile } from "./turnstile";
import { DiaryIcon } from "./diary-icon";
export function AccountSecurity({ siteKey, recent, projectId }: { siteKey: string; recent: boolean; projectId?: string }) {
  const router=useRouter(),[ready,setReady]=useState(recent),[busy,setBusy]=useState(false),[error,setError]=useState(""),[token,setToken]=useState(""),[reset,setReset]=useState(0);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");try{await accountAction("reauthenticate",{password:new FormData(event.currentTarget).get("password"),captcha_token:token});setReady(true);router.refresh();}catch(error){setError(error instanceof Error?error.message:"Could not confirm your password.");}finally{setBusy(false);setReset(value=>value+1);}}
  const button="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-ink px-5 py-3 font-label-ledger text-label-ledger disabled:opacity-50";
  const primary=`${button} border-primary-container bg-primary-container text-on-primary shadow hover:bg-primary active:translate-y-0.5`;
  return <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"><p className="font-stamp-label text-[11px] uppercase tracking-wider text-primary">Confirm it’s you</p><h2 className="mt-2 font-headline-md text-headline-md text-on-surface">{ready?"Website access confirmed":"Confirm your current password"}</h2><p className="mt-3 font-body-md text-body-md leading-relaxed text-on-surface-variant">{ready?"You can return to your sensitive project action. Password confirmation lasts for a short period.":"Confirm website access before changing ownership or other sensitive settings."}</p>{!ready&&<form onSubmit={submit} className="mt-4 flex flex-col"><label className="block font-label-ledger text-label-ledger text-on-surface">Current password<input aria-label="Current password" className="mt-1 h-12 w-full rounded-lg bg-surface-container-low px-3.5 font-body-lg text-[16px] text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128}/></label>
    <div className="mt-4 rounded-lg bg-surface-container-low p-3">
      <div className="flex items-center gap-2"><DiaryIcon name="check" size={18} /><span className="font-label-ledger text-label-ledger text-on-surface">Verify you are human</span><span className="ml-auto font-stamp-label text-[10px] uppercase text-on-surface-variant">Cloudflare Turnstile</span></div>
      <Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/>
      <p className="mt-1 flex items-start gap-1.5 font-body-sm text-[12px] leading-snug text-on-surface-variant"><DiaryIcon name="verified" size={16} />Turnstile check — the Confirm password button unlocks once it passes.</p>
    </div>
    {error&&<p role="alert" className="my-4 rounded-lg border-l-4 border-error bg-error-container p-4 font-body-md text-body-md text-on-error-container">{error}</p>}<button className={`${primary} mt-4`} disabled={busy||!token}>{busy?"Confirming…":"Confirm password"}</button></form>}{ready&&<Link href={projectId?`/projects/${projectId}/team?section=settings`:"/account"} prefetch={false} className={`${primary} mt-5`}>{projectId?"Return to project settings":"Return to your account"}</Link>}</section>;
}
