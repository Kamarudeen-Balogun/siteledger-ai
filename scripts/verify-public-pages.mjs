import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin=process.env.SITELEDGER_PUBLIC_QA_URL??"http://127.0.0.1:3011";
assert.ok(["127.0.0.1","localhost"].includes(new URL(origin).hostname),"Use a local preview for page verification");
const out="supabase/.temp/task-10a2",browser=await chromium.launch();
try {
  await mkdir(out,{recursive:true});const page=await browser.newPage(),errors=[],checkedLinks=new Set();
  page.on("pageerror",error=>errors.push(error.message));
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});
    for(const path of ["/","/about","/help","/contact","/privacy","/terms"]){
      const response=await page.goto(origin+path);assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator("h1").count(),1,`${path} needs one main heading`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} overflows at ${width}`);
      assert.equal(await page.getByRole("contentinfo",{name:"Creator credit"}).count(),1);
      const broken=await page.locator('a[href^="/"]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
      for(const target of new Set(broken))if(!checkedLinks.has(target)){assert.ok((await page.request.get(origin+target)).ok(),`${target} is unavailable`);checkedLinks.add(target);}
      if(path==="/"){assert.ok((await page.locator(".sample-total").innerText()).includes("₦551,000"));await page.locator(".site-photo img").scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const img=document.querySelector('.site-photo img');return img.complete&&img.naturalWidth>0;});await page.evaluate(()=>window.scrollTo(0,0));}
      if(width===390&&path==="/"){await page.getByText("Menu",{exact:true}).click();await page.getByRole("navigation",{name:"Mobile navigation"}).getByRole("link",{name:"About",exact:true}).click();await page.waitForURL(origin+"/about");await page.goto(origin);await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement.textContent),"Skip to content");await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>document.activeElement.id),"content");await page.evaluate(()=>document.activeElement.blur());}
      if(path==="/help"){const question=page.locator(".faq-list summary").first();await question.focus();await page.keyboard.press("Enter");assert.equal(await question.evaluate(node=>node.parentElement.open),true);}
      await page.screenshot({path:`${out}/${path==="/"?"landing":path.slice(1)}-${width}.png`,fullPage:true});
      if(path==="/"&&width===1440)await page.screenshot({path:`${out}/landing-desktop.png`,fullPage:false});
    }
  }
  assert.deepEqual(errors,[]);console.log("Six public pages pass at 390/768/1440px, with working links, keyboard menu/FAQ, loaded image and supplied-rate illustration.");
}finally{await browser.close();}
