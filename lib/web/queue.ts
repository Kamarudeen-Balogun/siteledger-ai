import type { CaptureContext, QueueEntry } from "./types";
const NAME="siteledger-web-queue", STORE="notes", SETTINGS="settings";
let opened:Promise<IDBDatabase>|undefined;
function database() {
  if(!opened) opened=new Promise((resolve,reject)=>{
    const request=indexedDB.open(NAME,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore(STORE,{keyPath:"manifest.id"});request.result.createObjectStore(SETTINGS);};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opened=undefined;};resolve(request.result);};
    request.onerror=()=>{opened=undefined;reject(new Error("Device storage is unavailable. Keep this page open and try saving again."));};
  });
  return opened;
}
async function transaction<T>(store:string,mode:IDBTransactionMode,action:(object:IDBObjectStore,set:(value:T)=>void)=>void):Promise<T> {
  const db=await database();return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);let value:T;
    tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(new Error("Could not save on this device. Your files are still on this page."));
    action(tx.objectStore(store),result=>{value=result;});
  });
}
export const listQueue=()=>transaction<QueueEntry[]>(STORE,"readonly",(store,set)=>{const r=store.getAll();r.onsuccess=()=>set(r.result);});
export const loadContext=()=>transaction<CaptureContext|undefined>(SETTINGS,"readonly",(store,set)=>{const r=store.get("active");r.onsuccess=()=>set(r.result);});
export const saveContext=(context:CaptureContext)=>transaction<void>(SETTINGS,"readwrite",store=>{store.put(context,"active");});
export async function enqueue(entry:QueueEntry) {
  return transaction<void>(STORE,"readwrite",(store)=>{
    const r=store.getAll();r.onsuccess=()=>{
      if(r.result.filter((row:QueueEntry)=>row.status!=="sent").length>=10){store.transaction.abort();return;}
      store.add(entry);
    };
  });
}
export async function claimQueue(id:string,owner:string,context:CaptureContext) {
  return transaction<QueueEntry|null>(STORE,"readwrite",(store,set)=>{
    const r=store.get(id);r.onsuccess=()=>{
      const row:QueueEntry|undefined=r.result;
      if(!row || row.status==="sent" || row.context.actor_id!==context.actor_id || row.manifest.project_id!==context.project_id
        || (row.lease_until??0)>Date.now() || (row.status==="blocked" && row.context.access===context.access)){set(null);return;}
      const claimed={...row,context,status:"sending" as const,owner,lease_until:Date.now()+180000,message:"Sending saved files…"};
      store.put(claimed);set(claimed);
    };
  });
}
export async function updateQueue(id:string,owner:string,patch:Partial<QueueEntry>) {
  return transaction<boolean>(STORE,"readwrite",(store,set)=>{
    const r=store.get(id);r.onsuccess=()=>{const row:QueueEntry|undefined=r.result;
      if(!row || row.owner!==owner){set(false);return;} store.put({...row,...patch});set(true);};
  });
}
class SendError extends Error {constructor(message:string,public blocked:boolean){super(message);}}
async function call(url:string,context:CaptureContext,options:RequestInit) {
  const response=await fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer ${context.access}`},cache:"no-store",signal:AbortSignal.timeout(60000)});
  const body=await response.json();
  if(!response.ok)throw new SendError(body.error??"Could not send yet. Files stay queued.",[400,401,403,404,413].includes(response.status));
  return body;
}
export async function drainQueue(context:CaptureContext,onChange:()=>Promise<void>,online=()=>navigator.onLine) {
  if(!online())return;
  const rows=await listQueue();
  for(const entry of rows.sort((a,b)=>a.manifest.captured_at.localeCompare(b.manifest.captured_at))) {
    if(!online())break;
    const owner=crypto.randomUUID(),row=await claimQueue(entry.manifest.id,owner,context);if(!row)continue;
    await onChange();
    try {
      if(!row.files)throw new SendError("Saved files are missing from this device. Keep the queued record for recovery.",true);
      let result=await call("/api/web/submissions",context,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(row.manifest)});
      if(result.id!==row.manifest.id)throw new SendError("The server returned a different note. Your files are kept.",true);
      if(result.status!=="saved") {
        if(!Array.isArray(result.missing) || result.missing.some((index:unknown)=>!Number.isInteger(index)||Number(index)<0||Number(index)>=row.files!.length))throw new SendError("Could not verify the saved files. Your note stays queued.",true);
        for(const index of result.missing as number[]) {
          if(!online())throw new Error("Offline");
          await call(`/api/web/submissions/${row.manifest.id}/media/${index}`,context,{method:"PUT",headers:{"Content-Type":row.manifest.assets[index].content_type},body:row.files[index]});
          if(!await updateQueue(row.manifest.id,owner,{lease_until:Date.now()+180000}))throw new Error("Another window resumed this note");
        }
        if(!online())throw new Error("Original project context changed");
        result=await call(`/api/web/submissions/${row.manifest.id}/finish`,context,{method:"POST"});
      } else {
        // A lost final response may leave a durable voice job to resume.
        if(!online())throw new Error("Original project context changed");
        result=await call(`/api/web/submissions/${row.manifest.id}/finish`,context,{method:"POST"});
      }
      if(result.id!==row.manifest.id || result.status!=="saved" || typeof result.review_url!=="string" || !result.review_url.startsWith(`/confirm/${row.manifest.id}?access=`))
        throw new SendError("Could not verify receipt. Your saved files will retry.",false);
      await updateQueue(row.manifest.id,owner,{status:"sent",message:"Saved on the server — review and confirm your note.",files:undefined,review_url:result.review_url,lease_until:0,owner:undefined});
    } catch(error) {
      await updateQueue(row.manifest.id,owner,{status:error instanceof SendError && error.blocked ? "blocked":"queued",message:error instanceof SendError ? error.message:"Queued — will send when data returns.",lease_until:0,owner:undefined});
      if(!(error instanceof SendError && error.blocked))break;
    }
    await onChange();
  }
}
