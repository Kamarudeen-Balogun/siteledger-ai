"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useActionConfirmation } from "./action-confirmation";
import { displayTimestamp } from "@/lib/reports/model";
import { DiaryIcon } from "./diary-icon";

async function request(input:object) {
  const response=await fetch("/api/account/deletion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const result=await response.json();if(!response.ok)throw new Error(result.error);return result;
}

export function RequestDeletion({email,pending}:{email:string;pending:boolean}) {
  const [sent,setSent]=useState(false),[requested,setRequested]=useState(pending),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function send() {
    setError("");setBusy(true);
    try{await request({action:"start"});setSent(true);}
    catch(error){setError(error instanceof Error?error.message:"Could not send the confirmation code.");}finally{setBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError("");setBusy(true);
    try{await request({action:"verify",code:new FormData(event.currentTarget).get("code")});setRequested(true);}
    catch(error){setError(error instanceof Error?error.message:"Could not submit your request.");}finally{setBusy(false);}
  }
  return <section className="stitch-card max-w-xl stitch-deletion"><h1 className="stitch-section-title"><DiaryIcon name="trash" size={20}/> Delete your account</h1>
    {requested?<><p role="status">Your request is awaiting administrator review. We’ll email you after deletion.</p><Link className="text-link" href="/account">Back to profile</Link></>:<>
      <p>An administrator reviews your request. After approval, you lose access to this account and cannot sign up with {email} again for 30 days.</p>
      <p>Locked project reports, original attribution and amendments remain in the project history. Transfer or archive projects you own before requesting deletion.</p>
      {sent?<form onSubmit={submit} className="mt-4"><p>We sent an eight-digit code to {email}. The code expires in 10 minutes.</p><label className="mt-4 block">Email code<input name="code" className="mt-2 min-h-12 w-full border border-rule bg-background px-3" required inputMode="numeric" autoComplete="one-time-code" minLength={8} maxLength={8} pattern="[0-9]{8}"/></label><label className="permission-toggle my-3"><span>I understand the account will be deleted after approval.</span><input type="checkbox" required/></label><button className="work-button work-button-primary" disabled={busy}>Submit deletion request</button><button type="button" className="text-link ml-4" disabled={busy} onClick={()=>void send()}>Send another code</button></form>:<button type="button" className="work-button mt-4" disabled={busy} onClick={()=>void send()}>{busy?"Sending…":"Send confirmation code"}</button>}
    </>}
    {error&&<p className="mt-3 text-amber-900" role="alert">{error}</p>}
  </section>;
}

export type DeletionItem={id:string;email:string|null;name:string|null;requested_at:string;approved_at:string|null;notified_at:string|null};

export function ReviewDeletions({items}:{items:DeletionItem[]}) {
  const router=useRouter(),{confirm,confirmation}=useActionConfirmation();
  const [busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function approve(item:DeletionItem) {
    if(!item.approved_at&&!await confirm({title:"Approve account deletion?",description:"The account will be removed and its email blocked from registering for 30 days. Locked project records stay available to their project members.",confirmLabel:"Approve deletion",danger:true,detail:<p>{item.email}</p>}))return;
    setBusy(item.id);setError("");setMessage("");
    try{const result=await request({action:"approve",id:item.id});setMessage(result.emailSent?"Account deleted and confirmation emailed.":"Account deleted. Confirmation email could not be sent. You can retry it here.");router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Could not approve deletion.");}finally{setBusy("");}
  }
  return <section className="stitch-card stitch-deletion">{confirmation}<h1 className="stitch-section-title">Account deletion requests</h1><p>{items.filter(item=>!item.approved_at).length} pending</p>
    {message&&<p className="my-4" role="status">{message}</p>}{error&&<p className="my-4 text-amber-900" role="alert">{error}</p>}
    {!items.length&&<p>No deletion requests yet.</p>}
    <ol>{items.map(item=><li key={item.id} className="border-b border-rule py-4"><h2>{item.name||item.email||"Deleted account"}</h2>{item.email&&<p>{item.email}</p>}<p>{displayTimestamp(item.requested_at)} · {item.approved_at?item.notified_at?"Deleted · email sent":"Deleted · email pending":"Awaiting approval"}</p>{!item.notified_at&&<button type="button" className="work-button mt-3" disabled={Boolean(busy)} onClick={()=>void approve(item)}>{busy===item.id?"Saving…":item.approved_at?"Retry email":"Review and approve"}</button>}</li>)}</ol>
  </section>;
}
