import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { resolveClientAccount } from "../lib/auth/client-session";
function launch(context: TestContext, initData: string) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://siteledger.example.test" }, Telegram:{WebApp:{initData}}} });
  context.after(() => { if(original) Object.defineProperty(globalThis,"window",original); else Reflect.deleteProperty(globalThis,"window"); });
}
test("landing restores linked signed Telegram access with one shared bootstrap",async context=>{
  launch(context,"signed-proof");
  let calls=0;context.mock.method(globalThis,"fetch",async(url:URL|RequestInfo,init?:RequestInit)=>{calls++;if(new URL(String(url),"https://siteledger.example.test").pathname==="/api/account")return Response.json({account:null});assert.equal(JSON.parse(String(init?.body)).init_data,"signed-proof");return Response.json({account:{profile_id:"linked-person",source:"telegram",browser_linked:true}});});
  const [first,second]=await Promise.all([resolveClientAccount(),resolveClientAccount()]);assert.equal(first?.profile_id,"linked-person");assert.deepEqual(first,second);assert.equal(calls,2);
});
test("existing website session wins over a different Telegram launch",async context=>{
  launch(context,"other-person-proof");
  let calls=0;context.mock.method(globalThis,"fetch",async()=>{calls++;return Response.json({account:{profile_id:"website-person",source:"browser"}});});
  assert.equal((await resolveClientAccount())?.profile_id,"website-person");assert.equal(calls,1);
});
test("unlinked Telegram launch grants no account and invalid proof stays an error",async context=>{
  launch(context,"signed-proof");
  let invalid=false;context.mock.method(globalThis,"fetch",async(url:URL|RequestInfo)=>new URL(String(url),"https://siteledger.example.test").pathname==="/api/account"?Response.json({account:null}):Response.json(invalid?{error:"Reopen Telegram"}:{account:null,needs_login:true},{status:invalid?401:200}));
  assert.equal(await resolveClientAccount(),null);invalid=true;await assert.rejects(resolveClientAccount(),/Reopen Telegram/);
});
