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
    for(const path of ["/","/help","/contact","/privacy","/terms"]){
      const response=await page.goto(origin+path);assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
      await page.getByRole("heading",{level:1}).waitFor();
      assert.equal(await page.getByRole("heading",{level:1}).count(),1,`${path} needs one main heading`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} overflows at ${width}`);
      const broken=await page.locator('a[href^="/"]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
      for(const target of new Set(broken))if(!checkedLinks.has(target)){assert.ok((await page.request.get(origin+target)).ok(),`${target} is unavailable`);checkedLinks.add(target);}
      if(path==="/"){
        assert.deepEqual(await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link").allTextContents(),["How it works","Sign in"]);
        assert.equal(await page.locator('#about').count(),1,"About is a section of the landing page");
        assert.equal(await page.getByRole("link",{name:"SiteLedger AI home"}).count(),1);
        assert.equal(await page.locator('a[href="/reports/demo"],a[href="/log/demo"],.sample-total,.ada-launch').count(),0);
        await page.getByRole("link",{name:"Try a private site record",exact:true}).waitFor();
      }
      if(width===390&&path==="/"){await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement.textContent),"Skip to content");await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>document.activeElement.id),"content");await page.evaluate(()=>document.activeElement.blur());}
      if(path==="/help"){const question=page.locator(".faq-list summary").first();await question.focus();await page.keyboard.press("Enter");assert.equal(await question.evaluate(node=>node.parentElement.open),true);}
      await page.screenshot({path:`${out}/${path==="/"?"landing":path.slice(1)}-${width}.png`,fullPage:true});
      if(path==="/"&&width===1440)await page.screenshot({path:`${out}/landing-desktop.png`,fullPage:false});
    }
  }
  assert.deepEqual(errors,[]);console.log("Five public pages pass at 390/768/1440px, with working links, keyboard skip/FAQ, and the private trial on the homepage.");
}finally{await browser.close();}
