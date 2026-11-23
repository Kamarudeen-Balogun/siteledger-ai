"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { listQueue,loadContext,saveContext,enqueue,drainQueue,belongsToActor } from "@/lib/web/queue";
import { audioType,describeFiles,photoForUpload } from "@/lib/web/files";
import { validManifest,type CaptureContext,type QueueEntry } from "@/lib/web/types";
import { WorkspaceHeader } from "./workspace-header";
import { DiaryNotice } from "./diary-notice";
import { WorkFlow, WorkIntro, WorkDisclosure } from "./work-flow";

const button="min-h-12 border border-rule px-4 py-3 text-base disabled:opacity-50";
function Preview({blob,audio=false}:{blob:Blob;audio?:boolean}) {
  const player=useRef<HTMLAudioElement|null>(null),image=useRef<HTMLImageElement|null>(null);
  useEffect(()=>{const value=URL.createObjectURL(blob),element=audio?player.current:image.current;if(element)element.src=value;return()=>URL.revokeObjectURL(value);},[blob,audio]);
  return audio ? <audio ref={player} controls className="my-4 w-full" aria-label="Recorded voice note"/> :
    // This local Blob is not an optimized or remote image.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={image} alt="Photo selected for this site note" width={144} height={108} className="h-auto w-full border border-rule"/>;
}
export function CaptureDiary() {
  const [context,setContext]=useState<CaptureContext|null>(null),[rows,setRows]=useState<QueueEntry[]>([]);
  const [online,setOnline]=useState(true),[opening,setOpening]=useState(true),[error,setError]=useState("");
  const [audio,setAudio]=useState<Blob|null>(null),[photos,setPhotos]=useState<Blob[]>([]),[preparing,setPreparing]=useState(false);
  const [recording,setRecording]=useState(false),[starting,setStarting]=useState(false),[seconds,setSeconds]=useState(0),[saving,setSaving]=useState(false);
  const [now,setNow]=useState(0),[captureProject,setCaptureProject]=useState<CaptureContext|null>(null);
  const [focusedId,setFocusedId]=useState<string|null>(null),receipt=useRef<HTMLElement|null>(null);
  const scope=useRef<CaptureContext|null>(null),captured=useRef(""),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null),sending=useRef(false),active=useRef<CaptureContext|null>(null),alive=useRef(true);
  const readyToSend=useRef(false);
  const telegramLaunch=useRef(false);
  const savePending=useRef(false);
  const refresh=async()=>{const values=await listQueue();if(alive.current)setRows(values.filter(row=>active.current&&belongsToActor(row,active.current)));};
  const send=async()=>{
    if(!readyToSend.current||sending.current||!active.current||!navigator.onLine)return;
    const current=active.current;
    sending.current=true;try{await drainQueue(current,refresh,()=>navigator.onLine&&readyToSend.current&&active.current?.actor_id===current.actor_id&&active.current?.project_id===current.project_id);}catch{if(alive.current)setError("Device storage is unavailable. Your queued note is kept.");}
    finally{sending.current=false;await refresh().catch(()=>undefined);}
  };
  async function connect() {
    if(!navigator.onLine){setOpening(false);readyToSend.current=!!active.current;return;}
    const app=(window as Window & {Telegram?:{WebApp?:{initData:string;ready:()=>void;expand:()=>void}}}).Telegram?.WebApp;
    readyToSend.current=false;app?.ready();app?.expand();setOpening(true);
    try {
      const load=()=>fetch("/api/web/access",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",cache:"no-store",signal:AbortSignal.timeout(15000)});
      let response=await load();
      if(response.status===401&&app?.initData){
        const login=await fetch("/api/account/telegram",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({init_data:app.initData}),cache:"no-store"});
        const account=await login.json();if(account.account)response=await load();
      }
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      if(typeof data.access!=="string"||typeof data.project_id!=="string"||typeof data.actor_id!=="string")throw new Error("Project access is unavailable.");
      const authorized={...data};await saveContext(authorized);active.current=authorized;readyToSend.current=true;
      window.history.replaceState(null,"","/today");setContext(authorized);setError("");await refresh();void send();
    } catch(e){setError(e instanceof Error?e.message:"Could not connect. Your files are kept.");}
    finally{setOpening(false);}
  }
  useEffect(()=>{
    alive.current=true;
    const query=new URLSearchParams(window.location.hash.slice(1)||window.location.search);
    telegramLaunch.current=query.has("tgWebAppData");
    void (async()=>{
      try{await refresh();setOnline(navigator.onLine);setNow(Date.now());const cached=await loadContext();
        if(cached&&!navigator.onLine&&!active.current&&!telegramLaunch.current){active.current=cached;setContext(cached);await refresh();}
        if(navigator.onLine)await connect();else setOpening(false);}
      catch{setError("Device storage is unavailable. Keep this page open and try again.");setOpening(false);}
    })();
    const retry=()=>{setOnline(navigator.onLine);setNow(Date.now());if(navigator.onLine)void send();};
    const reconnect=()=>{setOnline(navigator.onLine);setNow(Date.now());if(navigator.onLine)void connect();};
    const incoming=()=>{
      const parameters=new URLSearchParams(window.location.hash.slice(1));
      if(parameters.has("tgWebAppData")){
        if(scope.current)setError("Save the current note on this device before opening another authorized diary.");
        else window.location.reload();
        return;
      }

    };
    window.addEventListener("online",reconnect);window.addEventListener("offline",retry);window.addEventListener("focus",reconnect);
    window.addEventListener("hashchange",incoming);
    const interval=setInterval(retry,15000);
    if("serviceWorker" in navigator)void navigator.serviceWorker.register("/siteledger-worker.js",{scope:"/"}).then(async()=>{
      const registration=await navigator.serviceWorker.ready;
      registration.active?.postMessage({type:"CACHE_STATIC",urls:performance.getEntriesByType("resource").map(resource=>resource.name)});
    }).catch(()=>undefined);
    return()=>{alive.current=false;clearInterval(interval);window.removeEventListener("online",reconnect);window.removeEventListener("offline",retry);window.removeEventListener("focus",reconnect);window.removeEventListener("hashchange",incoming);
      if(timer.current)clearInterval(timer.current);if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop());};
  // Bootstrap once; current authorization is held in active.current for retries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  function bindCapture(){if(!scope.current&&context){scope.current=context;setCaptureProject(context);captured.current=new Date().toISOString();}}
  async function startRecording() {
    if(recording){recorder.current?.stop();return;}
    if(starting)return;setStarting(true);setError("");bindCapture();
    try {
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error("Recording is unavailable. Choose a saved voice file instead.");
      const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;
      const type=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"].find(value=>MediaRecorder.isTypeSupported(value));
      if(!type){media.getTracks().forEach(track=>track.stop());throw new Error("Recording is unavailable. Choose a saved voice file instead.");}
      const record=new MediaRecorder(media,{mimeType:type,audioBitsPerSecond:64000}),chunks:Blob[]=[];recorder.current=record;
      record.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      record.onstop=()=>{if(timer.current)clearInterval(timer.current);media.getTracks().forEach(track=>track.stop());if(!alive.current)return;
        const blob=new Blob(chunks,{type:type.split(";")[0]});try{audioType(blob);setAudio(blob);}catch(e){setError((e as Error).message);}setRecording(false);};
      record.start();setSeconds(0);setRecording(true);const began=Date.now();
      timer.current=setInterval(()=>{const value=Math.floor((Date.now()-began)/1000);setSeconds(value);if(value>=90&&record.state==="recording")record.stop();},500);
    }catch(e){setError(e instanceof Error ? e.message:"Microphone access is unavailable. Choose a saved voice file instead.");}finally{setStarting(false);}
  }
  async function chooseAudio(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];if(!file)return;setError("");try{const type=audioType(file);bindCapture();setAudio(new Blob([file],{type}));}catch(e){setError((e as Error).message);}event.target.value="";
  }
  async function choosePhotos(event:ChangeEvent<HTMLInputElement>) {
    const files=[...event.target.files??[]];event.target.value="";if(!files.length)return;
    if(files.length+photos.length>5){setError("Use up to five photos for one site note.");return;}
    setPreparing(true);setError("");bindCapture();try{const converted:Blob[]=[];for(const file of files)converted.push(await photoForUpload(file));setPhotos(current=>[...current,...converted]);}
    catch(e){setError(e instanceof Error ? e.message:"A photo could not be prepared. Your other files are kept.");}finally{setPreparing(false);}
  }
  async function save() {
    if(savePending.current||(!audio&&!photos.length)||!scope.current)return;
    savePending.current=true;const capturedContext=scope.current,capturedAt=captured.current;
    setSaving(true);setError("");
    try {
      const files=[...(audio?[audio]:[]),...photos],manifest={id:crypto.randomUUID(),project_id:capturedContext.project_id,captured_at:capturedAt,timezone:capturedContext.timezone,assets:await describeFiles(files)};
      if(!validManifest(manifest))throw new Error("Check the saved voice note and photos.");
      await enqueue({manifest,context:capturedContext,files,status:"queued",message:"Queued — will send when data returns."});
      setFocusedId(manifest.id);
      if(active.current?.project_id!==capturedContext.project_id||active.current?.actor_id!==capturedContext.actor_id)setError("This note is queued for its original project and account. Reopen that authorized diary to send it.");
      setAudio(null);setPhotos([]);scope.current=null;setCaptureProject(null);captured.current="";await refresh();void send();
    }catch(e){setError(e instanceof Error ? e.message:"Could not queue this note. Your files are still on this page.");}finally{savePending.current=false;setSaving(false);}
  }
  const visible=rows.filter(row=>context&&belongsToActor(row,context)).sort((a,b)=>b.manifest.captured_at.localeCompare(a.manifest.captured_at));
  const pending=visible.filter(row=>row.status!=="sent"),sent=visible.filter(row=>row.status==="sent").slice(0,3);
  const focused=visible.find(row=>row.manifest.id===focusedId);
  useEffect(()=>{if(focusedId){receipt.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});receipt.current?.focus({preventScroll:true});}},[focusedId,focused?.manifest.id]);
  const busy=opening||saving||preparing||starting||!context||context.expires<=now/1000;
  return <main className="mx-auto min-h-svh max-w-7xl px-5 py-7 text-base sm:px-10">
    <Script src="https://telegram.org/js/telegram-web-app.js" onReady={()=>{void connect();}} onError={()=>{setOpening(false);if(!active.current)setError("Sign in and select an authorized project to use the web diary.");else{readyToSend.current=true;void send();}}}/>
    <WorkspaceHeader current="today" />
    <WorkIntro label="Site diary" title="Today on site">{context&&<p>{(captureProject??context).project_name} · {(captureProject??context).actor_name}</p>}</WorkIntro>
    {context ? <p className="font-mono text-sm">{new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:context.timezone}).format(new Date(now))}</p>:
      <p className="mt-5 leading-7">{opening ? "Opening your authorized project…":"Sign in and choose one of your authorized projects to open this diary."}</p>}
    <Link href="/projects" className="mt-4 inline-flex min-h-12 items-center underline">{context ? "Switch project" : "Choose a project"}</Link>
    {opening && <DiaryNotice busy title="Opening your project…">Checking your account and the selected project.</DiaryNotice>}
    {!online&&<DiaryNotice tone="warning" title="You’re offline">Saved notes stay on this device and will send when data returns.</DiaryNotice>}
    {context&&context.expires<=now/1000&&<p role="alert" className="mt-5 border-l-4 border-amber-700 p-4">Your session expired. Sign in and select the original project. Queued files are kept.</p>}
    {error&&<DiaryNotice tone="error" title="Could not finish this step">{error}</DiaryNotice>}
    <WorkFlow step={focused?.status==="sent"?"review":"capture"}/>
    {focused&&<section ref={receipt} tabIndex={-1} className="work-state capture-receipt" aria-label="Saved note next step"><p className="eyebrow">{focused.status==="sent"?"Saved to your project":focused.status==="blocked"?"Needs attention":"Saved on this device"}</p><h2>{focused.status==="sent"?"Your note is ready to review":focused.status==="sending"?"Uploading your attachments…":"Your note is safely queued"}</h2><p role="status">{focused.message}</p>{focused.status==="sent"&&focused.review_url&&<Link href={focused.review_url} prefetch={false} className="work-button work-button-primary mt-5">Review site note</Link>}<button type="button" className="text-link mt-4 block" onClick={()=>setFocusedId(null)}>Start another note</button></section>}
    <div className="diary-capture-layout">{context&&!focused&&<section aria-label="New site note" data-unsaved={!!(audio||photos.length||recording)&&!saving} className="border-b border-rule pb-7">
      <p className="mb-5 leading-7">Add a voice note, photos, or both. Save once, then review the details.</p>
      <div className="attachment-heading"><h2>Voice note</h2><span className="attachment-status" data-ready={!!audio}>{audio?"Attached":"Optional"}</span></div>
      <button type="button" disabled={busy&&!recording} onClick={()=>void startRecording()} className={"record-control w-full px-6 py-5 font-semibold disabled:opacity-50 "+((audio||photos.length)&&!recording?"border border-accent text-accent":"bg-accent text-white")}>{recording?`Stop recording · ${seconds}s`:"Record voice note"}</button>
      <label className={button+" mt-4 block cursor-pointer text-center"}>Choose a saved voice file<input className="sr-only" type="file" accept="audio/ogg,audio/mpeg,audio/mp4,audio/webm,audio/wav,.m4a,.mp3,.ogg,.webm,.wav" disabled={busy||recording} onChange={event=>void chooseAudio(event)}/></label>
      <p className="mt-3 text-sm leading-6">30–90 seconds · up to 3 MB</p>
      {audio&&<><p className="mt-5 font-semibold">Voice note ready</p><Preview blob={audio} audio/></>}
      <div className="attachment-heading"><h2>Site photos</h2><span className="attachment-status" data-ready={photos.length>0}>{photos.length?`${photos.length} attached`:"Optional"}</span></div>
      <label className={button+" block cursor-pointer text-center"}>{preparing?"Preparing photos…":"Add site photos"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple disabled={busy} onChange={event=>void choosePhotos(event)}/></label>
      <p className="mt-3 text-sm leading-6">Up to 5 photos · compressed before upload</p>
      <div className="capture-photo-strip mt-4">{photos.map((photo,index)=><div key={index}><Preview blob={photo}/><button className={button+" mt-2 w-full"} disabled={saving} onClick={()=>setPhotos(current=>current.filter((_,i)=>i!==index))}>Remove photo {index+1}</button></div>)}</div>
      <button type="button" disabled={busy||recording||(!audio&&!photos.length)} onClick={()=>void save()} className="mt-7 min-h-14 w-full bg-accent px-5 py-4 font-semibold text-white disabled:opacity-50">{saving?"Saving on this device…":online?"Save site note":"Save offline"}</button>
      <p className="mt-3 leading-6">{audio||photos.length?"Attachments are ready. Tap Save site note to store them together.":"Add at least one attachment to save."}</p>
    </section>}
    <section className="py-3" aria-label="Saved site notes"><WorkDisclosure title="Recent notes on this device" description={`${pending.length} waiting to send · ${sent.length} uploaded`} open={pending.length>0}>
      {!visible.length&&<p className="mt-4 leading-7">No saved notes yet. Add a voice note or photos to start.</p>}
      {[...pending,...sent].filter(row=>row.manifest.id!==focusedId).map(row=><article key={row.manifest.id} className="diary-queue-entry" data-status={row.status}>
        <p className="font-semibold">{row.context.project_name}</p><p className="mt-2 font-mono text-sm">{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:row.manifest.timezone}).format(new Date(row.manifest.captured_at))} · {row.manifest.assets.filter(asset=>asset.content_type==="image/jpeg").length} photos</p>
        <p className="mt-3 leading-7" role="status">{row.manifest.project_id!==context?.project_id?"Queued for its original project. Reopen that authorized project to send it.":row.message}</p>
        {row.status==="sent"&&row.review_url&&<Link className={button+" mt-3 inline-block"} href={row.review_url}>Review site note</Link>}
      </article>)}
      {pending.length>0&&online&&<button className={button+" mt-4"} onClick={()=>void send()}>Retry queued notes</button>}
    </WorkDisclosure></section>
    </div><footer className="border-t border-rule py-5"><a className="inline-flex min-h-12 items-center underline" href="https://t.me/SiteLedgerNGbot">Send through Telegram instead</a>
      {!opening&&(!context||error||context.expires<=now/1000)&&<button className={button+" mt-3 block w-full"} onClick={()=>void connect()}>Reconnect authorized project</button>}</footer>
  </main>;
}
