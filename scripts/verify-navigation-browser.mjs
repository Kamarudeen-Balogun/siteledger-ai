// Local navigation/UI checks; the SDK stub supplies no authenticated identity.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:3011", out = "supabase/.temp/task-13/navigation";
await mkdir(out, { recursive: true });
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
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/reports/demo?source=navigation-test");
  await page.waitForFunction(() => window.navigationBackVisible && window.navigationBackCallbacks?.size === 1);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click(); await page.getByRole("navigation", { name: "Workspace menu" }).waitFor();
  await page.keyboard.press("Escape"); assert.equal(await menu.getAttribute("aria-expanded"), "false");
  assert.equal(await menu.evaluate(node => node === document.activeElement), true);
  await menu.click(); await page.locator("h1").click(); assert.equal(await menu.getAttribute("aria-expanded"), "false");
  await page.getByRole("link", { name: "Open demo dispute log", exact: true }).click();
  await page.waitForURL(origin + "/log/demo");
  await page.waitForFunction(() => window.navigationBackCallbacks?.size === 1);
  await page.evaluate(() => [...window.navigationBackCallbacks][0]());
  await page.waitForURL(origin + "/reports/demo?source=navigation-test");
  await page.getByRole("link", { name: "Open demo dispute log", exact: true }).click();
  await page.waitForURL(origin + "/log/demo");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForURL(origin + "/reports/demo?source=navigation-test");
  await page.goForward(); await page.waitForURL(origin + "/log/demo");
  assert.deepEqual(Object.keys(await page.evaluate(() => window.history.state.siteledgerNavigation)), ["depth"]);
  await page.getByRole("link", { name: "Open locked report", exact: true }).first().click();
  await page.waitForURL(origin + "/reports/demo");
  await page.getByRole("button", { name: "Back", exact: true }).click(); await page.waitForURL(origin + "/log/demo");
  await menu.click(); await page.getByRole("navigation", { name: "Workspace menu" }).getByRole("link", { name: "Account", exact: true }).click();
  await page.waitForURL(origin + "/account");
  await page.getByRole("link", { name: "Forgot your password?", exact: true }).click();
  await page.waitForURL(origin + "/account/recover");
  const code = page.locator('[name="token"]');
  await code.fill("01234567"); assert.equal(await code.inputValue(), "01234567");
  assert.equal(await code.evaluate(node => node.checkValidity()), true);
  await code.fill("12345"); assert.equal(await code.evaluate(node => node.checkValidity()), false);
  await page.getByRole("button", { name: "Back", exact: true }).click(); await page.waitForURL(origin + "/account");
  const direct = await context.newPage(); await direct.goto(origin + "/account/confirm");
  await direct.locator('[name="token"]').fill("01234567");
  assert.equal(await direct.locator('[name="token"]').inputValue(), "01234567");
  await direct.getByRole("button", { name: "Back", exact: true }).click(); await direct.waitForURL(origin + "/account");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + "/reports/demo");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.getByRole("button", { name: "Back", exact: true }).evaluate(node => node.getBoundingClientRect().height >= 48));
    if (width < 1024) assert.equal(await menu.isVisible(), true);
    else { assert.equal(await menu.isVisible(), false); assert.equal(await page.getByRole("navigation", { name: "Workspace navigation" }).isVisible(), true); }
    await page.screenshot({ path: `${out}/workspace-${width}.png`, fullPage: false });
  }
  assert.deepEqual(errors, []);
  console.log("Back/Forward, direct-link fallback, native Telegram Back, mobile menu keyboard/outside closure, full eight-digit form entry and 390/768/1440px navigation pass. No account or evidence created.");
} finally { await browser.close(); }
