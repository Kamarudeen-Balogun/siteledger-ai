"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DiaryIcon } from "./diary-icon";

async function update(input: object) {
  const response = await fetch("/api/account/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
export function ProfilePhoto({ name, hasPhoto }: { name: string; hasPhoto: boolean }) {
  const router = useRouter(), dialog = useRef<HTMLDialogElement>(null);
  const [preview,setPreview]=useState<string|null>(null),[file,setFile]=useState<File|null>(null),[zoom,setZoom]=useState(1);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[version,setVersion]=useState(0);
  const initials=name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join("").toLocaleUpperCase();
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);const timer=setTimeout(()=>setPreview(url));return()=>{clearTimeout(timer);URL.revokeObjectURL(url);};},[file]);
  async function save(remove=false) {
    setBusy(true);setError("");
    try {
      if(remove)await update({remove:true});
      else if(file&&preview){
        const picture=new window.Image();picture.src=preview;await picture.decode();
        const side=Math.min(picture.naturalWidth,picture.naturalHeight)/zoom;
        const canvas=document.createElement("canvas");canvas.width=480;canvas.height=480;
        const context=canvas.getContext("2d");if(!context)throw new Error("Could not crop this photo.");
        context.drawImage(picture,(picture.naturalWidth-side)/2,(picture.naturalHeight-side)/2,side,side,0,0,480,480);
        const original=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
        await update({name:file.name,data:original,crop:canvas.toDataURL("image/jpeg",.85).split(",")[1]});
      }
      setVersion(value=>value+1);window.dispatchEvent(new Event("siteledger-avatar-change"));dialog.current?.close();router.refresh();
    }catch(error){setError(error instanceof Error?error.message:"Could not save your profile photo.");}finally{setBusy(false);}
  }
  function pick(file?:File) {
    setError("");setFile(null);setPreview(null);setZoom(1);
    if(!file)return;
    if(file.size>2*1024*1024){setError("Photo must be 2 MB or smaller.");return;}
    if(!/\.(jpe?g|png|webp)$/i.test(file.name)){setError("Choose a JPEG, PNG or WebP photo.");return;}
    setFile(file);
  }
  return <>
    <button type="button" className="profile-avatar" onClick={()=>{setError("");setPreview(null);setFile(null);dialog.current?.showModal();}} aria-label="Edit profile photo" data-tour="avatar">{hasPhoto?<Image unoptimized src={`/api/account/avatar?v=${version}`} width={68} height={68} alt=""/>:initials||<DiaryIcon name="profile" size={30}/>}<span className="avatar-camera"><DiaryIcon name="camera" size={16}/></span></button>
    <dialog ref={dialog} className="action-dialog" aria-labelledby="profile-photo-title"><div className="action-dialog__body p-5"><h2 id="profile-photo-title" className="font-serif text-2xl">Profile photo</h2>
      {preview?<><div className="avatar-preview"><Image unoptimized src={preview} width={240} height={240} alt="Square crop preview" style={{transform:`scale(${zoom})`}}/></div><label className="permission-toggle">Zoom<input type="range" min={1} max={2.5} step={.1} value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label></>:<div className="mt-4 grid gap-3"><label className="work-button cursor-pointer">Choose from gallery<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={event=>pick(event.target.files?.[0])}/></label><label className="work-button cursor-pointer">Use camera<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" capture="user" onChange={event=>pick(event.target.files?.[0])}/></label></div>}
      {error&&<p role="alert" className="mt-4 text-amber-900">{error}</p>}
    </div><div className="action-dialog__actions flex flex-wrap justify-end gap-2 border-t border-rule p-4"><button type="button" className="work-button" disabled={busy} onClick={()=>dialog.current?.close()}>Cancel</button>{preview?<button type="button" className="work-button work-button-primary" disabled={busy} onClick={()=>void save()}>Save photo</button>:hasPhoto&&<button type="button" className="work-button" disabled={busy} onClick={()=>void save(true)}>Remove photo</button>}</div></dialog>
  </>;
}

export function ProfilePhone({ value }: { value: string }) {
  const router=useRouter(),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try { await update({phone:String(new FormData(event.currentTarget).get("phone")??"")});setMessage("Phone number saved.");router.refresh(); }
    catch(error){setError(error instanceof Error?error.message:"Could not save the phone number.");}finally{setBusy(false);}
  }
  return <form onSubmit={save} className="diary-panel"><label>Phone number<input type="tel" name="phone" autoComplete="tel" maxLength={40} defaultValue={value} className="my-3 min-h-12 w-full border border-rule bg-background px-3"/></label><button className="work-button" disabled={busy}>Save phone number</button>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</form>;
}
