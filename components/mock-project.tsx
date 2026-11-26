"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useActionConfirmation } from "./action-confirmation";
import { DiaryIcon } from "./diary-icon";
import { ReplayTour } from "./diary-tour";

const key="siteledger-mock-hidden:";
const event="siteledger-mock-change";
const listen=(notify:()=>void)=>{window.addEventListener(event,notify);window.addEventListener("storage",notify);return()=>{window.removeEventListener(event,notify);window.removeEventListener("storage",notify);};};

export function MockProjectControl({person,restore=false,explore=false}:{person:string;restore?:boolean;explore?:boolean}) {
  const hidden=useSyncExternalStore(listen,()=>{try{return localStorage.getItem(key+person)==="yes";}catch{return false;}},()=>false);
  const {confirm,confirmation}=useActionConfirmation();
  async function remove() {
    if(!await confirm({title:"Delete the mock project?",description:"You can restore the demo data from Help or your profile settings.",confirmLabel:"Delete mock project",danger:true}))return;
    try{localStorage.setItem(key+person,"yes");window.dispatchEvent(new Event(event));}catch{ /* The project stays available. */ }
  }
  if(restore)return hidden?<button type="button" className="work-button mt-3" onClick={()=>{try{localStorage.removeItem(key+person);window.dispatchEvent(new Event(event));}catch{ /* Keep current settings. */ }}}>Restore the mock project</button>:null;
  if(hidden)return null;
  if(explore)return <section className="stitch-card stitch-explore">
    <h2><DiaryIcon name="explore" size={20}/>New here? See a full project first</h2>
    <p>The mock project is filled in with demo reports, a BoQ, site photos, work progress and a team. It is always marked as demo data, and you can delete it whenever you like.</p>
    <Link href="/projects/mock" className="stitch-button" data-primary><DiaryIcon name="flask" size={19}/>Open the mock project <span className="stitch-kicker stitch-chip">Demo</span></Link>
    <ReplayTour label="Replay the intro tour" inPlace/>
  </section>;
  return <section className="diary-panel mt-6">{confirmation}<h2>Mock project — demo data</h2><p>Explore the BoQ, locked work and photos in a fictional project.</p><Link href="/projects/mock" className="work-button work-button-primary mt-4">Open mock project</Link><button type="button" className="text-link mt-2 block" onClick={()=>void remove()}>Delete mock project</button></section>;
}
