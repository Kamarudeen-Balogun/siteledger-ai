import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isWorkspacePath, navigationFallback } from "../lib/navigation/routes";
import { displayRatio } from "../lib/reports/model";

function read(...parts: string[]) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ...parts), "utf8");
}


test("direct work links have useful local parents without retaining supplied secrets", () => {
  for (const [path, parent] of [
    ["/account/confirm", "/account"], ["/account/recover", "/account"],
    ["/projects/site/boq", "/projects/site"], ["/projects/site/team", "/projects/site"],
    ["/projects/site", "/projects"], ["/log/report", "/reports/report"],
    ["/log/demo", "/reports/demo"], ["/confirm/note", "/today"],
    ["/trial/report", "/trial"], ["/trial/original/note", "/reports/note"],
    ["/reports/note", "/projects"], ["/reports/demo", "/"],
    ["/invite?secret=untrusted", "/"], ["https://example.invalid", "/"],
  ]) assert.equal(navigationFallback(path), parent);
  assert.equal(isWorkspacePath("/account/recover"), true);
  assert.equal(isWorkspacePath("/reports/demo"), true);
  assert.equal(isWorkspacePath("/about"), false);
  assert.equal(isWorkspacePath("/accounts-other"), false);
});

test("public menu dialog is portalled out of the blurred header", () => {
  // Regression: the header has backdrop-blur-xl, and a backdrop-filter makes
  // it the containing block for fixed-position descendants, so a `fixed
  // inset-0` dialog rendered inside the header is only the header's ~64px
  // box and its solid background covers just the top strip (the drawer
  // looked transparent). The dialog must be portalled to document.body.
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "components", "public-site.tsx"), "utf8");
  assert.ok(source.includes('createPortal(<div className="transplant fixed inset-0 z-50"'), "Menu dialog must be rendered through createPortal with the transplant class on its root");
  assert.ok(source.includes("document.body)"), "Menu dialog portal target must be document.body");
  // Second half of the same regression: every Stitch token utility in
  // transplant-public.css is scoped under `.transplant`
  // (`.transplant .bg-surface { background-color: var(--sl-surface); }`) and
  // the --sl-* variables live on `.transplant`, so a portal rendered outside
  // that root matches no background rule and the panel is fully transparent
  // (page text legible through it) even though the dialog covers the viewport.
  // The `transplant` class on the dialog root keeps the panel solid #fff8f5.
  const headerStart = source.indexOf("<header");
  const headerEnd = source.indexOf("</header>", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart, "Public header must exist");
  assert.ok(!source.slice(headerStart, headerEnd).includes('role="dialog"'), "No dialog may be nested inside the blurred header");
  assert.ok(source.slice(headerStart, headerEnd).includes("<PublicMenu />"), "Menu button stays in the header");
});

test("amendment dialogs are bottom sheets at every width, not centred modals", () => {
  // The audit found the amendment form as a centred modal on wider
  // viewports: the base .action-dialog rule was centred and only the
  // <=640px media query docked it to the bottom. The stitch-sheet rule
  // must anchor it to the bottom at all widths.
  const css = read("app", "globals.css");
  assert.match(css, /\.action-dialog\.stitch-sheet\s*\{[^}]*inset:\s*auto 0 0;/);
  assert.match(css, /\.action-dialog\.stitch-sheet\s*\{[^}]*width:\s*min\(100%, 640px\);/);
});

test("the Telegram reveal reauth form has a working submit button", () => {
  // The audit dead-ended here: the password gate had a field and a bot
  // check but no submit button at all, so the code could never be
  // revealed. The button must exist and be enabled once the bot check
  // passes.
  const source = read("components", "account-forms.tsx");
  assert.match(source, /disabled=\{busy \|\| !token\}>[\s\S]*?Confirm password[\s\S]*?<\/button>/);
});

test("Ada docks above the pinned dispute-log actions instead of covering them", () => {
  // The floating Ada button overlapped the pinned "+ Add Amendment to
  // Locked Record" bar, truncating its label. On pages with a pinned log
  // action bar the Ada reserve must clear the bar.
  const css = read("app", "stitch.css");
  assert.match(css, /body:has\(\.stitch-header \.workspace-dock\):has\(\.stitch-log-actions\) \.ada-help\s*\{[^}]*--ada-reserve:\s*calc\(140px/);
});

test("the project switcher labels the current project in text", () => {
  const source = read("components", "app-navigation.tsx");
  assert.match(source, /stitch-switch-current[\s\S]*?>\s*Current\s*<\/span>/);
});

test("headers do not flash a signed-out Sign in while the session resolves", () => {
  // Signed-in users briefly saw a "Sign in" link (and public pages showed
  // the logged-out header). Both header components now stay in an
  // unresolved state until the session check settles instead of
  // defaulting to signed-out.
  const navigation = read("components", "app-navigation.tsx");
  assert.match(navigation, /const \[ready, setReady\] = useState\(false\);/);
  // Desktop nav renders no links at all until the session check settles.
  assert.match(navigation, /navigation\?\.ready \? navigation\.active \?/);
  assert.match(navigation, /function WorkspaceProfile[\s\S]*?if \(!navigation\.ready\) return null;/);
  const landing = read("components", "landing-account-link.tsx");
  assert.match(landing, /useState<boolean \| null>\(null\)/);
  assert.match(landing, /if \(active === null\) return/);
});

test("percentages are formatted at one decimal like the mock", () => {
  assert.equal(displayRatio("100"), "100");
  assert.equal(displayRatio("45.74"), "45.7");
});
