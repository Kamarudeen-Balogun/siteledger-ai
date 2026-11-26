"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { displayTimestamp } from "@/lib/reports/model";
import type { FeedbackItem } from "@/lib/feedback/data";

async function send(input: object) {
  const response=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const data=await response.json(); if(!response.ok)throw new Error(data.error);return data;
}
export function FeedbackForm({ name,email,project }: { name:string;email:string|null;project?:string }) {
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
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
  if(sent)return <section className="diary-panel"><h2>Feedback sent</h2><p>You can follow replies in your feedback history.</p><Link href="/account" className="work-button work-button-primary mt-4">Back to profile</Link><Link href="/account/feedback?view=history" className="text-link ml-4">My feedback</Link></section>;
  return <form onSubmit={submit} className="diary-panel max-w-xl"><h1>Send feedback</h1><p>{name}{email?` · ${email}`:""}{project?` · ${project}`:""}</p>
    <label className="block mt-4">Type<select name="kind" className="mt-2 min-h-12 w-full border border-rule bg-background px-3" required defaultValue=""><option value="" disabled>Choose a type</option><option>Bug</option><option>Improvement</option><option>Complaint</option></select></label>
    <label className="block mt-4">Message<textarea className="mt-2 min-h-32 w-full border border-rule bg-background p-3" name="message" required maxLength={5000}/></label>
    <label className="block mt-4">Screenshot (optional)<input className="mt-2 min-h-12 w-full border border-rule p-2" type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label>
    {error&&<p role="alert" className="mt-3 text-amber-900">{error}</p>}<button className="diary-primary mt-4" disabled={busy}>{busy?"Sending…":"Send feedback"}</button>
  </form>;
}
function FeedbackAdmin({ item }: { item:FeedbackItem }) {
  const router=useRouter(),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget,data=new FormData(form),reply=String(data.get("reply")??"").trim();setBusy(true);setMessage("");
    try {const result=await send({id:item.id,status:data.get("status"),...(reply?{reply}:{})});form.querySelector("textarea")!.value="";setMessage(reply?result.emailSent?"Reply saved and emailed.":"Reply saved. Email could not be sent.":"Status saved.");router.refresh();}
    catch(error){setMessage(error instanceof Error?error.message:"Could not save feedback changes.");}finally{setBusy(false);}
  }
  return <form onSubmit={save} className="mt-4 border-t border-rule pt-4"><label className="block">Status<select name="status" className="min-h-12 w-full border border-rule bg-background px-3" defaultValue={item.status}><option>New</option><option>In progress</option><option>Resolved</option></select></label><label className="mt-4 block">Reply<textarea name="reply" maxLength={5000} className="min-h-24 w-full border border-rule bg-background p-3"/></label><button className="work-button work-button-primary mt-4" disabled={busy}>Save update</button>{message&&<p role="status" className="mt-3">{message}</p>}</form>;
}
export function FeedbackHistory({ items,admin }: { items:FeedbackItem[];admin:boolean }) {
  return <section className="diary-panel"><h1>{admin?"Feedback inbox":"My feedback"}</h1>{admin&&<p>{items.filter(item=>item.status!=="Resolved").length} open</p>}{!items.length&&<p>No feedback yet.</p>}
    {items.map(item=><details key={item.id} className="work-disclosure"><summary><span><strong>{item.kind} · {item.status}</strong><small>{admin?`${item.name} · `:""}{item.project?`${item.project} · `:""}{displayTimestamp(item.date)}</small></span></summary><div className="work-disclosure-body"><p className="whitespace-pre-wrap">{item.message}</p>{item.has_photo&&<Image src={`/api/feedback?photo=${item.id}`} width={800} height={600} className="mt-3 w-full h-auto" unoptimized alt="Screenshot attached to feedback"/>}{item.replies.map((reply,index)=><div className="mt-4 border-t border-rule pt-3" key={index}><p className="eyebrow">Reply · {displayTimestamp(reply.date)}</p><p className="whitespace-pre-wrap">{reply.text}</p></div>)}{admin&&<FeedbackAdmin item={item}/>}</div></details>)}
  </section>;
}
