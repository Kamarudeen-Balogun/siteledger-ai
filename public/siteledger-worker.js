/* Only the public Today shell, scripts, styles and fonts are cached. Never
   cache private API responses, reports, review links, audio or site photos. */
const CACHE="siteledger-today-v2";
const staticPath=path=>path.startsWith("/_next/static/")||path.startsWith("/fonts/");
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),shell=await fetch("/today",{credentials:"omit",cache:"reload"});
  if(!shell.ok||shell.headers.get("X-SiteLedger-Offline-Shell")!=="public")return;
  const html=await shell.clone().text();await cache.put("/today",shell);
  const assets=[...html.matchAll(/(?:src|href)="([^" ]+)"/g)].map(match=>new URL(match[1],self.location.origin)).filter(url=>url.origin===self.location.origin&&staticPath(url.pathname));
  for(const path of ["/fonts/PublicSans-Regular.ttf","/fonts/PublicSans-Bold.ttf","/fonts/SourceSerif4-Regular.ttf","/fonts/MaterialSymbols-Diary.woff2"])assets.push(new URL(path,self.location.origin));
  await Promise.allSettled(assets.map(async url=>{const result=await fetch(url,{credentials:"omit"});if(result.ok)await cache.put(url,result);}));
  await self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{
  if(event.data?.type!=="CACHE_STATIC"||!Array.isArray(event.data.urls))return;
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled(event.data.urls.slice(0,100).map(async value=>{
    const url=new URL(value,self.location.origin);url.search="";
    if(url.origin!==self.location.origin||!staticPath(url.pathname))return;
    const response=await fetch(url,{credentials:"omit"});if(response.ok)await cache.put(url,response);
  }));})());
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=="GET")return;
  if(event.request.mode==="navigate"&&url.pathname==="/today")event.respondWith((async()=>{
    let network;try{network=await fetch(event.request);if(network.ok)return network;}catch{ /* Use only the public shell during an outage. */ }
    return await (await caches.open(CACHE)).match("/today")||network||Response.error();
  })());
  else if(staticPath(url.pathname))event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(event.request);
    if(saved)return saved;const result=await fetch(event.request);if(result.ok)await cache.put(event.request,result.clone());return result;})());
});
