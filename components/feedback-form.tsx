"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { displayTimestamp } from "@/lib/reports/model";
import type { FeedbackItem } from "@/lib/feedback/data";
import { DiaryIcon } from "./diary-icon";

import { useActionConfirmation } from "./action-confirmation";

async function send(input: object) {
  const response=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const data=await response.json(); if(!response.ok)throw new Error(data.error);return data;
}
export function FeedbackForm({ name,email,project }: { name:string;email:string|null;project?:string }) {
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
  const [attached,setAttached]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const form=new FormData(event.currentTarget),file=form.get("photo");
      if(file instanceof File&&file.size>2*1024*1024)throw new Error("Choose a screenshot up to 2 MB.");
      let photo={};
      if(file instanceof File&&file.size){
        const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
        photo={name:file.name,data};
      }
      await send({kind:form.get("kind"),message:form.get("message"),...photo});setSent(true);
    }catch(error){setError(error instanceof Error?error.message:"Could not send feedback.");}finally{setBusy(false);}
  }
  if(sent)return <section className="diary-panel"><h2>Sent</h2><p>Feedback sent. You can follow replies in your feedback history.</p><Link href="/account" className="work-button work-button-primary mt-4">Back to profile</Link><Link href="/account/feedback?view=history" className="text-link ml-4">My feedback</Link></section>;
  return <form onSubmit={submit} className="stitch-feedback max-w-xl"><h1 className="sr-only">Send feedback</h1>
    <p>Tell us what happened, or what would make SiteLedger better. Your account details are filled in below.</p>
    <fieldset><legend className="stitch-kicker">Type</legend><div className="stitch-feedback-types">{["Bug","Improvement","Complaint"].map(kind=><label key={kind} className="stitch-button"><input className="sr-only" name="kind" type="radio" value={kind} required/>{kind}</label>)}</div></fieldset>
    <label className="block"><span className="stitch-kicker">Your message</span><textarea placeholder="What happened? What did you expect instead?" className="stitch-feedback-message" name="message" required maxLength={5000}/></label>
    <label className="block"><span className="stitch-kicker">Screenshot (optional)</span><span className="stitch-button w-full"><DiaryIcon name="attach" size={18}/>{attached?"Screenshot attached":"Attach a screenshot"}</span><input className="sr-only" type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={event=>setAttached(Boolean(event.target.files?.length))}/></label>
    <dl className="stitch-card stitch-profile-values">{[["Your name",name],["Email",email??"Not provided"],["Project",project??"No active project"]].map(([key,value])=><div key={key}><dt className="stitch-kicker">{key}</dt><dd>{value}</dd></div>)}</dl>
    {error&&<p role="alert" className="stitch-review-warning">{error}</p>}<button className="stitch-button w-full" data-primary disabled={busy}><DiaryIcon name="send" size={19}/>{busy?"Sending…":"Send feedback"}</button>
  </form>;
}
function FeedbackAdmin({ item }: { item:FeedbackItem }) {
  const router=useRouter(),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const { confirm, confirmation } = useActionConfirmation();
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget,data=new FormData(form),reply=String(data.get("reply")??"").trim();setBusy(true);setMessage("");
    try {const result=await send({id:item.id,status:data.get("status"),...(reply?{reply}:{})});form.querySelector("textarea")!.value="";setMessage(reply?result.emailSent?"Reply saved and emailed.":"Reply saved. Email could not be sent.":"Status saved.");router.refresh();}
    catch(error){setMessage(error instanceof Error?error.message:"Could not save feedback changes.");}finally{setBusy(false);}
  }
  async function remove() {
    if(!await confirm({title:"Delete this feedback?",description:"The entry and its replies are removed for everyone. This cannot be undone.",confirmLabel:"Delete feedback",danger:true,detail:<p>{item.message}</p>}))return;
    setBusy(true);setMessage("");
    try {await send({id:item.id,delete:true});router.refresh();}
    catch(error){setMessage(error instanceof Error?error.message:"Could not delete this feedback.");}finally{setBusy(false);}
  }
  return <>{confirmation}<form onSubmit={save} className="mt-4 border-t border-rule pt-4"><label className="block">Status<select name="status" className="min-h-12 w-full border border-rule bg-background px-3" defaultValue={item.status}><option>New</option><option>In progress</option><option>Resolved</option></select></label><label className="mt-4 block">Reply<textarea name="reply" maxLength={5000} className="min-h-24 w-full border border-rule bg-background p-3"/></label><button className="work-button work-button-primary mt-4" disabled={busy}>Save update</button>{message&&<p role="status" className="mt-3">{message}</p>}</form>
  <button type="button" className="text-link mt-4" disabled={busy} onClick={()=>void remove()}>Delete this feedback</button></>;
}
export function FeedbackHistory({ items,admin }: { items:FeedbackItem[];admin:boolean }) {
  // Admin actions sit on the card itself — the old inbox hid every action
  // behind opening the item, so the card showed nothing to do. "My
  // feedback" lists only the signed-in user's own entries (p_mine).
  const open=items.filter(item=>item.status!=="Resolved").length;
  return <section className="stitch-feedback-inbox"><h1 className="sr-only">{admin?"Feedback inbox":"My feedback"}</h1>
    {admin&&<p>{open} open · {items.length} total.</p>}
    {!items.length?<div className="stitch-card"><h2 className="stitch-section-title">{admin?"No feedback yet":"You have not sent feedback yet"}</h2><p className="mt-3 leading-7">{admin?"New feedback from the team will appear here, with the author and project on each entry.":"Tell us what happened, or what would make SiteLedger better."}</p><Link href="/account/feedback" className="stitch-button mt-4" data-primary>Send feedback</Link></div>:
    items.map(item=><article key={item.id} className="stitch-card">
      <div className="stitch-title-row"><span className="stitch-kicker stitch-chip" data-tone={item.status==="In progress"?"red":item.status==="Resolved"?"green":undefined}>{item.status}</span><strong>{item.kind}</strong><small>{displayTimestamp(item.date)}</small></div>
      <p className="mt-3 whitespace-pre-wrap leading-7">{item.message}</p>
      <small>{[admin?item.name:null,item.project].filter(Boolean).join(" · ")}</small>
      {item.has_photo&&<Image src={`/api/feedback?photo=${item.id}`} width={800} height={600} className="mt-3 w-full h-auto" unoptimized alt="Screenshot attached to feedback"/>}
      {item.replies.map((reply,index)=><div className="mt-4 border-t border-rule pt-3" key={index}><p className="eyebrow">Reply · {displayTimestamp(reply.date)}</p><p className="whitespace-pre-wrap">{reply.text}</p></div>)}
      {admin&&<FeedbackAdmin item={item}/>}
    </article>)}
  </section>;
}
