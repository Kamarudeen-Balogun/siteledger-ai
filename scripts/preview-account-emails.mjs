// Render labelled, synthetic previews. No SMTP, Auth or recipient is contacted.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
const folder=resolve("supabase/.temp/task-10a/email-previews");
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for(const kind of ["signup","magic-link","recovery"]) {
    const template=await readFile(`supabase/templates/${kind}.html`,"utf8");
    const html=template.replaceAll("{{ .Token }}","482619").replaceAll("{{ .Email }}","you@example.test").replaceAll("{{ .SiteURL }}","https://siteledger-preview.example.test")
      .replace('<body style=', '<body data-preview="synthetic" style=')
      .replace(/(<body[^>]*>)/,'$1<div style="background:#1C1917;color:#FAF7F2;padding:10px 16px;font:12px Verdana,sans-serif;text-align:center;">DESIGN PREVIEW · SAMPLE CODE · NO EMAIL SENT</div>');
    await writeFile(join(folder,`${kind}-preview.html`),html);
    for(const width of [390,840]) {
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
      await page.setContent(html,{waitUntil:"load"});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(overflow)throw new Error(`${kind} overflows at ${width}px`);
      await page.screenshot({path:join(folder,`${kind}-${width}.png`),fullPage:true});
      console.log(`${kind}: ${width}px preview rendered without horizontal overflow.`);
      await page.close();
    }
  }
  console.log("Labelled HTML and PNG previews saved in supabase/.temp/task-10a/email-previews.");
} finally { await browser.close(); }
