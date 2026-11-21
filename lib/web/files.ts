import { WEB_AUDIO_TYPES, MAX_WEB_AUDIO, MAX_WEB_PHOTO, type Asset, type AudioType } from "./types";
export async function photoForUpload(file:File):Promise<Blob> {
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>20*1024*1024)throw new Error("Choose JPEG, PNG or WebP photos below 20 MB.");
  const source=await createImageBitmap(file);
  try {
    const scale=Math.min(1,1200/Math.max(source.width,source.height));const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
    const context=canvas.getContext("2d");if(!context)throw new Error("Photo could not be prepared.");
    context.fillStyle="#ffffff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);
    for(const quality of [0.85,0.7,0.55]) {
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
      if(blob && blob.size<=MAX_WEB_PHOTO)return blob;
    }
    throw new Error("This photo is still too large. Choose a smaller photo.");
  } finally {source.close();}
}
export function audioType(file:File|Blob):AudioType {
  const raw=file.type.split(";")[0].toLowerCase();
  const type=raw==="audio/x-m4a" ? "audio/mp4" : ["audio/x-wav","audio/wave"].includes(raw) ? "audio/wav" : raw;
  if(!Object.hasOwn(WEB_AUDIO_TYPES,type)||!file.size||file.size>MAX_WEB_AUDIO)throw new Error("Choose an Ogg, MP3, M4A, WAV or WebM voice file below 3 MB.");
  return type as AudioType;
}
export async function describeFiles(files:Blob[]):Promise<Asset[]> {
  const assets:Asset[]=[];
  for(const [index,file] of files.entries()) {
    const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest("SHA-256",bytes);
    assets.push({index,content_type:index===0 ? audioType(file):"image/jpeg",bytes:file.size,sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("")});
  }
  return assets;
}
