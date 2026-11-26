// Local navigation checks use an anonymous Telegram launch and a fixture account response.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:3011", out = "supabase/.temp/task-13/navigation";
await mkdir(out, { recursive: true });
const startupDeadline=Date.now()+30000;
while(true){try{if((await fetch(origin+"/reports/demo",{signal:AbortSignal.timeout(2000)})).ok)break;}catch{/* Preview may still be starting. */}if(Date.now()>startupDeadline)throw new Error("Start the local preview on port 3011 before checking navigation.");await new Promise(resolve=>setTimeout(resolve,250));}
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("https://telegram.org/js/telegram-web-app.js", route => route.fulfill({ contentType: "application/javascript", body: `
    window.navigationBackCallbacks = new Set(); window.navigationBackVisible = false;
    window.Telegram = {WebApp:{initData:'invalid-navigation-fixture',ready(){},expand(){},BackButton:{
      show(){window.navigationBackVisible=true},hide(){window.navigationBackVisible=false},
      onClick(callback){window.navigationBackCallbacks.add(callback)},offClick(callback){window.navigationBackCallbacks.delete(callback)}
    }}};` }));
  await context.route("https://challenges.cloudflare.com/turnstile/**", route => route.fulfill({ contentType: "application/javascript", body: "window.turnstile={render(){return 'navigation-only'},remove(){},reset(){}};" }));
  let signedIn = false;
  await context.route("**/api/account", route => route.fulfill({ json: { account: signedIn ? { profile_id: "navigation-fixture" } : null } }));
  await context.route("**/api/projects/private", route => route.fulfill({ json: { active_project_id: null } }));
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/reports/demo?source=navigation-test");
  await page.waitForFunction(() => window.navigationBackVisible && window.navigationBackCallbacks?.size === 1);
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile workspace navigation" });
  assert.equal(await mobileNavigation.count(),0);
  await page.getByRole("link", { name: "Open demo dispute log", exact: true }).click();
  await page.waitForURL(origin + "/log/demo");
  await page.waitForFunction(() => window.navigationBackCallbacks?.size === 1);
  await page.evaluate(() => [...window.navigationBackCallbacks][0]());
  await page.waitForURL(origin + "/reports/demo?source=navigation-test");
  await page.getByRole("link", { name: "Open demo dispute log", exact: true }).click();
  await page.waitForURL(origin + "/log/demo");
  await page.goBack();
  await page.waitForURL(origin + "/reports/demo?source=navigation-test");
  await page.goForward(); await page.waitForURL(origin + "/log/demo");
  assert.deepEqual(Object.keys(await page.evaluate(() => window.history.state.siteledgerNavigation)), ["depth"]);
  await page.getByRole("link", { name: "Open locked report", exact: true }).first().click();
  await page.waitForURL(origin + "/reports/demo");
  await page.goBack(); await page.waitForURL(origin + "/log/demo");
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.waitForURL(origin + "/account");
  await page.getByRole("link", { name: "Forgot your password?", exact: true }).click();
  await page.waitForURL(origin + "/account/recover");
  assert.equal(await page.locator('[name="token"]').count(),0,"Recovery starts with one request step");
  await page.getByRole("button",{name:"I already have a recovery code",exact:true}).click();
  const code = page.locator('[name="token"]');
  await code.fill("01234567"); assert.equal(await code.inputValue(), "01234567");
  assert.equal(await code.evaluate(node => node.checkValidity()), true);
  await code.fill("12345"); assert.equal(await code.evaluate(node => node.checkValidity()), false);
  await page.goBack(); await page.waitForURL(origin + "/account");
  const direct = await context.newPage(); await direct.goto(origin + "/account/confirm");
  await direct.locator('[name="token"]').fill("01234567");
  assert.equal(await direct.locator('[name="token"]').inputValue(), "01234567");
  await direct.waitForFunction(() => window.navigationBackVisible && window.navigationBackCallbacks?.size === 1);
  await direct.evaluate(() => [...window.navigationBackCallbacks][0]()); await direct.waitForURL(origin + "/account");
  signedIn = true;
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + "/log/demo");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width < 1024) { await mobileNavigation.waitFor(); assert.equal(await mobileNavigation.getByRole("link").count(),4); }
    else {
      assert.equal(await mobileNavigation.isVisible(), false);
      assert.equal(await page.getByRole("navigation", { name: "Workspace navigation" }).isVisible(), true);
      assert.ok(await page.getByRole("button", { name: "Back", exact: true }).evaluate(node => node.getBoundingClientRect().height >= 48));
    }
    await page.screenshot({ path: `${out}/workspace-${width}.png`, fullPage: false });
  }
  assert.deepEqual(errors, []);
  console.log("Back/Forward, direct-link fallback, native Telegram Back, persistent mobile navigation, full eight-digit form entry and 390/768/1440px navigation pass. No account or evidence created.");
} finally { await browser.close(); }
