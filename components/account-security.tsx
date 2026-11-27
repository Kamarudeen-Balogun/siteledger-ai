"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { accountAction } from "./account-forms";
import { Turnstile } from "./turnstile";
export function AccountSecurity({ siteKey, recent, projectId }: { siteKey: string; recent: boolean; projectId?: string }) {
  const router=useRouter(),[ready,setReady]=useState(recent),[busy,setBusy]=useState(false),[error,setError]=useState(""),[token,setToken]=useState(""),[reset,setReset]=useState(0);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");try{await accountAction("reauthenticate",{password:new FormData(event.currentTarget).get("password"),captcha_token:token});setReady(true);router.refresh();}catch(error){setError(error instanceof Error?error.message:"Could not confirm your password.");}finally{setBusy(false);setReset(value=>value+1);}}
  return <section className="auth-panel"><p className="eyebrow">Confirm it’s you</p><h2 className="font-serif text-2xl mt-3">{ready?"Website access confirmed":"Confirm your current password"}</h2><p className="mt-4 leading-7">{ready?"You can return to your sensitive project action. Password confirmation lasts for a short period.":"Confirm website access before changing ownership or other sensitive settings."}</p>{!ready&&<form onSubmit={submit} className="mt-5"><label className="block">Current password<input aria-label="Current password" className="mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128}/></label><Turnstile siteKey={siteKey} onToken={setToken} reset={reset}/>{error&&<p role="alert" className="my-5 border-l-4 border-amber-700 p-4">{error}</p>}<button className="work-button work-button-primary" disabled={busy||!token}>{busy?"Confirming…":"Confirm password"}</button></form>}{ready&&<Link href={projectId?`/projects/${projectId}/team?section=settings`:"/account"} prefetch={false} className="work-button work-button-primary mt-5">{projectId?"Return to project settings":"Return to your account"}</Link>}</section>;
}
