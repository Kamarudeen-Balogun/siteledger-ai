"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resolveClientAccount } from "@/lib/auth/client-session";
import { listQueue,loadContext,saveContext,enqueue,drainQueue,belongsToActor } from "@/lib/web/queue";
import { audioType,describeFiles,photoForUpload } from "@/lib/web/files";
import { validManifest,type CaptureContext,type QueueEntry } from "@/lib/web/types";
import { WorkspaceHeader } from "./workspace-header";
import { DiaryNotice } from "./diary-notice";
import { WorkFlow, WorkDisclosure } from "./work-flow";
import { DiaryIcon } from "./diary-icon";
import { MockProjectControl } from "./mock-project";
import { useActionConfirmation } from "./action-confirmation";
import { formatMoneyLabel, formatQuantityWithUnit } from "@/lib/reports/model";

const button="min-h-12 border border-rule px-4 py-3 text-base disabled:opacity-50";
type TodaySummary = {
  projectId: string; readScope: string; percentage: number | null; earned: string; dayTotal: string | null;
  rows: { id: string; description: string; unit: string; done: string; scope: string; percentage: string }[];
  notes: { id: string; date: string; capturedAt?: string; amount?: string | null; items?: string[]; today: boolean; status: string; stage: "review" | "draft" | "approved"; href: string; label: string }[];
};
function Preview({blob,audio=false}:{blob:Blob;audio?:boolean}) {
  const player=useRef<HTMLAudioElement|null>(null),image=useRef<HTMLImageElement|null>(null);
  useEffect(()=>{const value=URL.createObjectURL(blob),element=audio?player.current:image.current;if(element)element.src=value;return()=>URL.revokeObjectURL(value);},[blob,audio]);
  return audio ? <audio ref={player} controls className="my-4 w-full" aria-label="Recorded voice note"/> :
    // This local Blob is not an optimized or remote image.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={image} alt="Photo selected for this site note" width={144} height={108} className="h-auto w-full border border-rule"/>;
}
export function CaptureDiary() {
  const search = useSearchParams();
  const [capturing,setCapturing]=useState(search.get("capture")==="1");
  const [person,setPerson]=useState<string|null>(null);
  const {confirmation}=useActionConfirmation();
  const [gate,setGate]=useState<"sign-in"|"project"|null>(null);
  const [summary,setSummary]=useState<TodaySummary|null>(null),[summaryError,setSummaryError]=useState(false);
  const [readOnly,setReadOnly]=useState(false);
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
  const recordingCancelled=useRef(false);
  const connecting=useRef(false);
  const reconnectQueued=useRef(false);
  const refresh=async()=>{const values=await listQueue();if(alive.current)setRows(values.filter(row=>active.current&&belongsToActor(row,active.current)));};
  const send=async()=>{
    if(!readyToSend.current||sending.current||!active.current||!navigator.onLine)return;
    const current=active.current;
    sending.current=true;try{await drainQueue(current,refresh,()=>navigator.onLine&&readyToSend.current&&active.current?.actor_id===current.actor_id&&active.current?.project_id===current.project_id);}catch{if(alive.current)setError("Device storage is unavailable. Your queued note is kept.");}
    finally{sending.current=false;await refresh().catch(()=>undefined);if(alive.current&&active.current?.project_id===current.project_id)void loadSummary(current.project_id);}
  };
  async function connect() {
    if(!navigator.onLine){setOpening(false);readyToSend.current=!!active.current;return;}
    if(connecting.current)return;
    connecting.current=true;
    try {
      const account=await resolveClientAccount();
      if(!alive.current)return;
      if(!account){setGate("sign-in");setPerson(null);setSummary(null);active.current=null;readyToSend.current=false;setContext(null);setError("");return;}
      setPerson(account.profile_id);
      setGate(null);
      const response=await fetch("/api/web/access",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",cache:"no-store",signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!alive.current)return;
      if(response.status===401||response.status===403){
        setGate(response.status===401?"sign-in":"project");setError("");setSummary(null);active.current=null;readyToSend.current=false;setContext(null);return;
      }
      if(!response.ok)throw new Error(data.error);
      if(data.read_only&&typeof data.project_id==="string"){
        const display={...data,expires:Number.POSITIVE_INFINITY};
        if(active.current?.project_id!==display.project_id){setSummary(null);setSummaryError(false);}
        active.current=display;readyToSend.current=false;setReadOnly(true);setContext(display);setCapturing(false);setError("");void loadSummary(display.project_id);return;
      }
      if(typeof data.access!=="string"||typeof data.project_id!=="string"||typeof data.actor_id!=="string")throw new Error("Project access is unavailable.");
      const authorized={...data};await saveContext(authorized);
      // The previous project's figures must never render under the new
      // project: clear the summary before the new context lands, so the
      // diary shows its loading state instead of stale numbers.
      if(active.current?.project_id!==authorized.project_id){setSummary(null);setSummaryError(false);}
      active.current=authorized;readyToSend.current=true;
      setReadOnly(false);setContext(authorized);setError("");await refresh();void send();
      void loadSummary(authorized.project_id);
    } catch(e){setError(e instanceof Error?e.message:"Could not connect. Your files are kept.");}
    finally{connecting.current=false;if(alive.current)setOpening(false);
      // A project switch that arrived while this connect was in flight
      // was previously dropped by the guard above; run it now instead.
      if(reconnectQueued.current){reconnectQueued.current=false;if(alive.current&&navigator.onLine)void connect();}
    }
  }
  async function loadSummary(projectId:string) {
    try {
      const response=await fetch("/api/web/today",{cache:"no-store",signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error("Could not open the daily ledger.");
      const data:TodaySummary|null=await response.json();
      if(alive.current&&active.current?.project_id===projectId){setSummary(data?.projectId===projectId?data:null);setSummaryError(data?.projectId!==projectId);}
    }catch{if(alive.current&&active.current?.project_id===projectId)setSummaryError(true);}
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
    // A project switch must clear the old project's figures at once —
    // before the new connect resolves — and must not be lost if a
    // connect is already in flight (the queued flag re-runs it).
    const projectChanged=()=>{setOnline(navigator.onLine);setNow(Date.now());setSummary(null);setSummaryError(false);reconnectQueued.current=true;if(navigator.onLine)void connect();};
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
    window.addEventListener("siteledger-project-change",projectChanged);
    const interval=setInterval(retry,15000);
    if("serviceWorker" in navigator)void navigator.serviceWorker.register("/siteledger-worker.js",{scope:"/"}).then(async()=>{
      const registration=await navigator.serviceWorker.ready;
      registration.active?.postMessage({type:"CACHE_STATIC",urls:performance.getEntriesByType("resource").map(resource=>resource.name)});
    }).catch(()=>undefined);
    return()=>{alive.current=false;clearInterval(interval);window.removeEventListener("online",reconnect);window.removeEventListener("offline",retry);window.removeEventListener("focus",reconnect);window.removeEventListener("hashchange",incoming);window.removeEventListener("siteledger-project-change",projectChanged);
      if(timer.current)clearInterval(timer.current);if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop());};
  // Bootstrap once; current authorization is held in active.current for retries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  function bindCapture(){if(!scope.current&&context){scope.current=context;setCaptureProject(context);captured.current=new Date().toISOString();}}
  async function startRecording() {
    if(recording){recorder.current?.stop();return;}
    if(starting)return;setStarting(true);setError("");bindCapture();
    try {
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error("Recording is unavailable on this device. Send the voice note in Telegram instead.");
      const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;
      const type=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"].find(value=>MediaRecorder.isTypeSupported(value));
      if(!type){media.getTracks().forEach(track=>track.stop());throw new Error("Recording is unavailable on this device. Send the voice note in Telegram instead.");}
      const record=new MediaRecorder(media,{mimeType:type,audioBitsPerSecond:64000}),chunks:Blob[]=[];recorder.current=record;recordingCancelled.current=false;
      record.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      record.onstop=()=>{if(timer.current)clearInterval(timer.current);media.getTracks().forEach(track=>track.stop());if(!alive.current)return;
        if(!recordingCancelled.current){const blob=new Blob(chunks,{type:type.split(";")[0]});try{audioType(blob);setAudio(blob);}catch(e){setError((e as Error).message);}}setRecording(false);};
      record.start();setSeconds(0);setRecording(true);const began=Date.now();
      timer.current=setInterval(()=>{const value=Math.floor((Date.now()-began)/1000);setSeconds(value);if(value>=90&&record.state==="recording")record.stop();},500);
    }catch(e){setError(e instanceof Error ? e.message:"Microphone access is unavailable. Send the voice note in Telegram instead.");}finally{setStarting(false);}
  }
  async function choosePhotos(event:ChangeEvent<HTMLInputElement>) {
    const files=[...event.target.files??[]];event.target.value="";if(!files.length)return;
    if(files.length+photos.length>5){setError("Use up to five photos for one site note.");return;}
    setPreparing(true);setError("");bindCapture();try{const converted:Blob[]=[];for(const file of files)converted.push(await photoForUpload(file));setPhotos(current=>[...current,...converted]);}
    catch(e){setError(e instanceof Error ? e.message:"A photo could not be prepared. Your other files are kept.");}finally{setPreparing(false);}
  }
  async function save(finishLater=false) {
    if(savePending.current||(!audio&&!photos.length)||!scope.current)return;
    savePending.current=true;const capturedContext=scope.current,capturedAt=captured.current;
    setSaving(true);setError("");
    try {
      const files=[...(audio?[audio]:[]),...photos],manifest={id:crypto.randomUUID(),project_id:capturedContext.project_id,captured_at:capturedAt,timezone:capturedContext.timezone,assets:await describeFiles(files)};
      if(!validManifest(manifest))throw new Error("Check the saved voice note and photos.");
      await enqueue({manifest,context:capturedContext,files,status:"queued",message:"Queued — will send when data returns."});
      if(finishLater){setFocusedId(null);setCapturing(false);window.scrollTo(0,0);}
      else setFocusedId(manifest.id);
      if(active.current?.project_id!==capturedContext.project_id||active.current?.actor_id!==capturedContext.actor_id)setError("This note is queued for its original project and account. Reopen that authorized diary to send it.");
      setAudio(null);setPhotos([]);scope.current=null;setCaptureProject(null);captured.current="";await refresh();void send();
    }catch(e){setError(e instanceof Error ? e.message:"Could not queue this note. Your files are still on this page.");}finally{savePending.current=false;setSaving(false);}
  }
  async function closeCapture() {
    // Leaving with attachments never discards them: the note is saved
    // as a draft first, so it waits in Awaiting review exactly as left.
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (audio || photos.length) { await save(true); return; }
    recordingCancelled.current=true;
    setAudio(null);setPhotos([]);setCapturing(false);setError("");scope.current=null;setCaptureProject(null);captured.current="";
    window.scrollTo(0,0);
  }
  const visible=rows.filter(row=>context&&belongsToActor(row,context)).sort((a,b)=>b.manifest.captured_at.localeCompare(a.manifest.captured_at));
  const currentSummary=summary?.projectId===context?.project_id?summary:null;
  // The Awaiting review count must be strictly this project's: while the
  // summary is still loading, the capture context can still name the
  // previous project after a switch, so local sent rows are gated on the
  // summary's project whenever one is loaded — and the count chip shows
  // "—" until the summary arrives instead of a stale number.
  const reviewProjectId=currentSummary?.projectId??context?.project_id;
  const pending=visible.filter(row=>row.status!=="sent");
  const localReviews=visible.filter(row=>row.status==="sent"&&row.manifest.project_id===reviewProjectId&&!currentSummary?.notes.some(note=>note.id===row.manifest.id)).slice(0,5);
  const drafts=currentSummary?.notes.filter(note=>note.amount==null)??[];
  const lastLocked=currentSummary?.notes.find(note=>note.stage==="approved");
  const daily=currentSummary?.notes.filter(note=>note.today).toReversed()??[];
  const focused=visible.find(row=>row.manifest.id===focusedId);
  useEffect(()=>{if(focusedId){receipt.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});receipt.current?.focus({preventScroll:true});}},[focusedId,focused?.manifest.id]);
  const busy=opening||saving||preparing||starting||!context||context.expires<=now/1000;
  const project=(captureProject??context)?.project_name;
  const date= context&&now ? new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"short",year:"numeric",timeZone:context.timezone}).format(now):"";
  return <main className="mx-auto min-h-svh max-w-7xl px-5 py-7 sm:px-10 today-workspace stitch-today">
    <WorkspaceHeader current="today" title={capturing?"Add Today's Work":undefined} project={project} projectId={context?.project_id} detail={capturing} hideProfile={capturing} onBack={capturing?()=>void closeCapture():undefined}/>
    {confirmation}
    {opening?<DiaryNotice busy title="Opening your diary…"/>:gate&&!context?<section className="diary-panel diary-gate">
      <h1>{gate==="sign-in"?"Sign in to open your diary":"Choose a project"}</h1>
      <p>{gate==="sign-in"?"Open your account to record work and review your site notes.":"Open a project to record work or check its reports."}</p>
      <Link href={gate==="sign-in"?"/account":"/projects"} className="work-button work-button-primary">{gate==="sign-in"?"Sign in":"Your projects"}</Link>
      {person&&<MockProjectControl person={person} explore/>}
    </section>:<>
      {!online&&<DiaryNotice tone="warning" title="You’re offline">{context?"Saved notes stay on this device and will send when data returns.":"Reconnect once to open the project diary on this device."}</DiaryNotice>}
      {context&&context.expires<=now/1000&&<DiaryNotice tone="warning" title="Your session expired">Sign in and select the original project. Queued files are kept.</DiaryNotice>}
      {error&&<DiaryNotice tone="error" title="Could not finish this step">{error}{(!context||context.expires<=now/1000)&&<button className="work-button mt-3" onClick={()=>void connect()}>Try again</button>}</DiaryNotice>}
      {context&&<>
        {focused?<section ref={receipt} tabIndex={-1} className="diary-panel diary-gate capture-receipt" aria-label="Saved note next step">
          <p className="eyebrow">{focused.status==="sent"?"Saved to your project":focused.status==="blocked"?"Needs attention":"Saved on this device"}</p>
          <h1>{focused.status==="sent"?"Your note is ready to review":focused.status==="sending"?"Uploading attachments…":"Your note is queued"}</h1>
          <p role="status">{focused.message}</p>
          {focused.status==="sent"&&focused.review_url&&<Link href={focused.review_url} prefetch={false} className="work-button work-button-primary">Review site note</Link>}
          <button type="button" className="work-button" onClick={()=>{setFocusedId(null);setCapturing(false);void loadSummary(context.project_id);}}>Back to Today</button>
        </section>:capturing?<section aria-label="New site note" data-unsaved={!!(audio||photos.length||recording)&&!saving} className="diary-record">
          <WorkFlow step="capture"/>
          {recording ? <div className="stitch-card stitch-recording" role="status">
            <p className="stitch-kicker"><i/>Recording — speak now</p><strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</strong>
            <div className="stitch-wave" aria-hidden="true">{[14,25,18,32,24,38,16,26,19,31,13,23].map((height,index)=><i key={index} style={{height,animationDelay:`${index*45}ms`}}/>)}</div>
            <p>Mention work items, quantities, materials and delays.</p>
            <div className="stitch-two-actions"><button type="button" className="stitch-button" onClick={()=>{recordingCancelled.current=true;recorder.current?.stop();}}>Cancel</button><button type="button" className="stitch-button" data-primary onClick={()=>recorder.current?.stop()}><DiaryIcon name="stop"/>Stop</button></div>
          </div> : <div className="diary-capture-options">
            <button type="button" disabled={busy} onClick={()=>void startRecording()} className="diary-capture-option" data-tour="record"><span><DiaryIcon name="mic" size={30}/></span><strong>Record voice note</strong><small>Tap to talk — Pidgin is fine</small></button>
            <label className="diary-capture-option diary-capture-photo" data-tour="photos"><span><DiaryIcon name="camera" size={30}/></span><strong>{preparing?"Preparing photos…":"Add photos"}</strong><small>Tap to add site photos</small><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event=>void choosePhotos(event)}/></label>
          </div>}
          <p className="diary-capture-hint">Add a voice note, photos, or both — either one on its own is enough.</p>
          {audio&&<div className="diary-panel"><div className="diary-panel-heading"><strong>Voice note ready</strong><button type="button" className="diary-icon-button" aria-label="Remove voice note" disabled={saving||recording} onClick={()=>setAudio(null)}><DiaryIcon name="close"/></button></div><Preview blob={audio} audio/></div>}
          {!!photos.length&&<div className="diary-panel"><div className="diary-panel-heading"><strong>Site photos</strong><small>{photos.length} attached</small></div><div className="diary-photo-grid">{photos.map((photo,index)=><div key={index}><Preview blob={photo}/><button className="diary-icon-button" type="button" aria-label={`Remove photo ${index+1}`} disabled={saving} onClick={()=>setPhotos(current=>current.filter((_,i)=>i!==index))}><DiaryIcon name="close" size={17}/></button></div>)}</div></div>}
          <button type="button" disabled={busy||recording||(!audio&&!photos.length)} onClick={()=>void save()} className="stitch-button stitch-review-button" data-primary><DiaryIcon name="check" size={20}/>{saving?"Saving…":online?"Review & cost it":"Save offline"}</button>
          <p className="diary-capture-hint">{!audio&&!photos.length?"Add a voice note or at least one photo to continue.":"You can check quantities and observations before costing."}</p>
          <button type="button" disabled={busy||recording||(!audio&&!photos.length)} onClick={()=>void save(true)} className="stitch-button"><DiaryIcon name="bookmark" size={20}/>Save draft — finish later</button>
        </section>:<>
          <div className="stitch-status"><span className="stitch-kicker"><i/>{pending.length?`${pending.length} waiting to send`:online?"All changes saved":"Offline"}</span><DiaryIcon name="saved" size={18}/></div>
          {!readOnly&&<div className="diary-today-actions"><button type="button" className="diary-primary" onClick={()=>{setCapturing(true);setError("");window.scrollTo(0,0);}} data-tour="add-work"><DiaryIcon name="plus" size={26}/>Add today&apos;s work</button><a href="https://t.me/SiteLedgerNGbot" className="diary-row-link" target="_blank" rel="noreferrer"><DiaryIcon name="send" size={20}/><strong>Send via Telegram</strong><span className="stitch-chip">@SiteLedgerNGbot</span></a></div>}
          {person&&<MockProjectControl person={person} explore/>}
          <section className="stitch-card stitch-drafts" aria-labelledby="today-drafts" data-tour="drafts"><div className="stitch-title-row">
            <h2 id="today-drafts"><DiaryIcon name="pending" size={20}/>Awaiting review <span className="stitch-chip">{!currentSummary&&online?"—":drafts.length+localReviews.length}</span></h2><span className="stitch-kicker">Not costed yet</span></div>
            <p>Open a draft to check the details, edit quantities, or finish costing it later.</p>
            {summaryError?<div><p>Could not open the daily ledger.</p><button type="button" className="text-link" onClick={()=>void loadSummary(context.project_id)}>Try again</button></div>:!currentSummary&&online?<div className="stitch-skeleton-stack" role="status" aria-label="Loading drafts"><i/><i/><i/></div>:!drafts.length&&!localReviews.length?<p>No notes waiting for review.</p>:<ul className="diary-list">
              {drafts.map(note=><li key={note.id}><Link href={note.href} prefetch={false}><span><strong>{note.label}</strong><small>{note.capturedAt?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:context.timezone}).format(new Date(note.capturedAt)):note.date}</small></span><DiaryIcon name="chevron" size={18}/></Link></li>)}
              {localReviews.map(row=>row.review_url&&<li key={row.manifest.id}><Link href={row.review_url} prefetch={false}><span><strong>Review site note</strong><small>{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:row.manifest.timezone}).format(new Date(row.manifest.captured_at))}</small></span><DiaryIcon name="chevron" size={18}/></Link></li>)}
            </ul>}
          </section>
          <section className="stitch-card stitch-drafts" data-tour="day-submissions"><div className="stitch-title-row"><h2><DiaryIcon name="receipt" size={20}/>Today&apos;s submissions</h2></div>
            <p>{daily.length?"Every note and upload from today, in time order.":"No site notes have been submitted today."}</p>
            <ul className="diary-list">{daily.map(note=><li key={note.id}><Link href={note.href} prefetch={false}><span><strong>{note.stage==="approved"?"Locked report":note.amount?"Draft report":"Awaiting review"}</strong><small>{note.capturedAt?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:context.timezone}).format(new Date(note.capturedAt)):note.date}</small>{note.items?.map((item,index)=><small key={index}>{item}</small>)}</span><strong>{note.amount}</strong></Link></li>)}</ul>
            <div className="stitch-day-total"><span className="stitch-kicker">Day total (costed so far)</span><strong>{currentSummary?.dayTotal??"—"}</strong></div>
          </section>
          <section className="stitch-card stitch-ledger"><span className="stitch-kicker" data-ink="orange">Daily ledger entry</span><h2>Today{date?`, ${date}`:""}</h2>{lastLocked&&<Link href={lastLocked.href} className="stitch-menu-row"><DiaryIcon name="lock"/>Open last locked report<DiaryIcon name="chevron" size={18}/></Link>}</section>
          <section className="stitch-card diary-progress" data-tour="measured-progress"><div className="stitch-title-row"><h2><DiaryIcon name="progress" size={20}/>Work Progress — Measured</h2></div><p className="stitch-kicker" data-ink="green">{currentSummary?.readScope??"Locked reports"}</p>
            {currentSummary?.percentage==null?(currentSummary||summaryError||!online?<p>{currentSummary?"Add a BoQ with rates to measure project progress.":summaryError?"Measured progress is unavailable.":"Reconnect to see measured progress."}</p>:<div className="stitch-skeleton-stack" role="status" aria-label="Loading measured progress"><i/><i/><i/></div>):<>
              <div className="diary-progress-summary"><strong>{currentSummary.percentage}% complete</strong><span>{formatMoneyLabel(currentSummary.earned, "earned")}</span></div>
              <progress max={100} value={currentSummary.percentage} aria-label="Measured project progress"/>
              <dl>{currentSummary.rows.map(row=><div key={row.id}><dt>{row.description}</dt><dd>{formatQuantityWithUnit(row.done, row.unit)} / {formatQuantityWithUnit(row.scope, row.unit)} · {row.percentage}%</dd></div>)}</dl>
              <Link className="text-link" href={`/projects/${context.project_id}?view=progress`}>View all work progress</Link>
            </>}
          </section>
          <details className="work-disclosure" data-tour="bot-example">
            <summary>How the Telegram bot works — example<small>Example only — the real chat is in Telegram</small></summary>
            <div className="work-disclosure-body">
              <div className="stitch-bot-example" aria-label="Example Telegram chat">
                <p className="stitch-bot-bubble" data-from="foreman"><strong>Voice note</strong>“We don cast 2 cube concrete, 18 square metre blockwork, 40 bags cement.”</p>
                <p className="stitch-bot-bubble" data-from="bot">Got it — working on your report.</p>
                <div className="stitch-bot-card"><p><strong>Check the quantities</strong></p><p>18 m² blockwork · 2 m³ concrete · 40 bags cement</p><p><span className="stitch-chip">Confirm</span> <span className="stitch-chip">Edit</span></p></div>
                <p className="stitch-bot-bubble" data-from="foreman">Confirm</p>
                <p className="stitch-bot-bubble" data-from="bot">Report locked — ₦551,000. Share the link or download the PDF.</p>
              </div>
              <p className="mt-4 leading-7">The bot follows the same steps as this diary: send, confirm, cost, lock, share. <a className="text-link" href="https://t.me/SiteLedgerNGbot" target="_blank" rel="noreferrer">Open the Telegram bot — @SiteLedgerNGbot</a></p>
            </div>
          </details>
        </>}
        {pending.length>0&&<WorkDisclosure title="Notes on this device" description={`${pending.length} waiting to send`} open>
          {pending.filter(row=>row.manifest.id!==focusedId).map(row=><article key={row.manifest.id} className="diary-queue-entry" data-status={row.status}><strong>{row.context.project_name}</strong><p>{row.manifest.project_id!==context.project_id?"Reopen the original project to send this note.":row.message}</p></article>)}
          {online&&<button type="button" className={button+" mt-4"} onClick={()=>void send()}>Retry queued notes</button>}
        </WorkDisclosure>}
      </>}
    </>}
  </main>;
}
