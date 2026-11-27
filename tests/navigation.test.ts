import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
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

test("switching projects never renders the previous project's figures", () => {
  // Regression: after a project switch, Today first rendered the old
  // project's figures (Lekki 28.5% / ₦14,911,800 on Ajah's diary) before
  // the new summary arrived. The diary must clear its summary the moment
  // the switch lands, and again when a connect resolves to a different
  // project — the loading state renders instead of stale numbers.
  const diary = read("components", "capture-diary.tsx");
  assert.match(diary, /const projectChanged=\(\)=>\{[^}]*setSummary\(null\);[^}]*setSummaryError\(false\);/);
  assert.match(diary, /window\.addEventListener\("siteledger-project-change",projectChanged\)/);
  assert.match(diary, /if\(active\.current\?\.\project_id!==authorized\.project_id\)\{setSummary\(null\);setSummaryError\(false\);\}/);
  // A switch that arrives while a connect is in flight was dropped by the
  // connecting guard, so the diary kept the old project until the next
  // 15s retry. The queued flag re-runs the connect when it finishes.
  assert.match(diary, /const reconnectQueued=useRef\(false\);/);
  assert.match(diary, /if\(reconnectQueued\.current\)\{reconnectQueued\.current=false;if\(alive\.current&&navigator\.onLine\)void connect\(\);\}/);
});

test("switching to the mock makes the mock the current project", () => {
  // Regression: the switcher row for the mock was a plain link — it never
  // ran a select, so the header kept showing the previous real project
  // with the CURRENT badge while the mock page was open, and switching
  // back landed on the old project page. Mock-current is derived from
  // the path (the session check would overwrite stored state with the
  // real active project), the mock row runs a real select, and switching
  // back from the mock lands on the new Today.
  const navigation = read("components", "app-navigation.tsx");
  assert.match(navigation, /const isMock = \(navigation\?\.\pathname \?\? ""\)\.startsWith\("\/projects\/mock"\);/);
  assert.match(navigation, /function selectMock\(\) \{/);
  assert.match(navigation, /router\.push\("\/projects\/mock"\)/);
  assert.match(navigation, /id===item\.id && !isMock \? <span className="stitch-switch-current">/);
  assert.match(navigation, /const fromMock = \(navigation\?\.\pathname \?\? ""\)\.startsWith\("\/projects\/mock"\);/);
  assert.match(navigation, /const path = fromMock \? "\/today" :/);
  // The bottom dock stays on the mock: its tabs are the mock views, never
  // the real project's BoQ or team pages.
  assert.match(navigation, /const isMock = path\.startsWith\("\/projects\/mock"\);/);
  assert.match(navigation, /href: isMock \? "\/projects\/mock\?view=boq" : projectHref/);
  assert.match(navigation, /href: isMock \? "\/projects\/mock\?view=team" : projectHref/);
});

test("no route renders the old design", () => {
  // The legacy project pages, their tab bar and their components were
  // deleted outright. If any of them comes back, the old design can
  // render again — this test fails the build until it is gone.
  assert.ok(!existsSync(join(dirname(fileURLToPath(import.meta.url)), "..", "components", "project-navigation.tsx")), "project-navigation.tsx must stay deleted");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry: string) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  for (const file of [...walk(join(dirname(fileURLToPath(import.meta.url)), "..", "app")), ...walk(join(dirname(fileURLToPath(import.meta.url)), "..", "components"))]) {
    if (!file.endsWith(".tsx")) continue;
    const source = readFileSync(file, "utf8");
    assert.ok(!source.includes("ProjectNavigation"), `${file} must not use the deleted ProjectNavigation`);
    assert.ok(!source.includes("WorkIntro"), `${file} must not use the deleted WorkIntro`);
    assert.ok(!source.includes('className="work-tabs"'), `${file} must not render the old tab bar`);
  }
  const css = read("app", "globals.css");
  for (const selector of [".project-navigation", ".project-next", ".project-home", ".project-breadcrumb", ".work-intro", ".project-tabs"]) {
    assert.ok(!css.includes(selector), `globals.css must not keep the legacy ${selector} rules`);
  }
});

test("BoQ add and adjust open as bottom sheets, not inline forms", () => {
  // Regression: "+ Add item" opened an inline form that pushed the page
  // down, and "Adjust item" opened the same form at the top of the page —
  // far above the tapped row, so it looked dead. Both now open the same
  // bottom sheet in view, and Adjust is a compact text action per row.
  const editor = read("components", "boq-editor.tsx");
  assert.match(editor, /const formDialog = useRef<HTMLDialogElement>\(null\);/);
  assert.match(editor, /<dialog ref=\{formDialog\} className="action-dialog stitch-sheet"/);
  assert.ok(!editor.includes('className="my-7 max-w-3xl diary-panel"'), "The add/edit form must not render inline on the page");
  assert.match(editor, /className="text-link mt-3"[^>]*onClick=\{\(\) => edit\(row\)\}[^>]*>Adjust item<\/button>/);
});

test("BoQ version history is compact rows with a version sheet", () => {
  // Regression: the Previous versions card expanded inline into a giant
  // card that buried the BoQ page. Versions are slim rows now; a version's
  // rows open in a bottom sheet over the intact page.
  const versions = read("components", "boq-versions.tsx");
  assert.match(versions, /<button type="button" className="boq-versions__row"/);
  assert.match(versions, /<dialog ref=\{sheet\} className="action-dialog stitch-sheet"/);
  const page = read("app", "projects", "[id]", "boq", "page.tsx");
  assert.match(page, /<BoqVersions versions=\{versions\} currency=\{currency\}\/>/);
  assert.ok(!page.includes("boq-versions__rows"), "Version rows render only inside the sheet, not inline on the BoQ page");
  const mock = read("components", "mock-project.tsx");
  assert.match(mock, /export function MockBoqActions/);
  assert.match(mock, /<dialog ref=\{sheet\} className="action-dialog stitch-sheet" aria-label="Demo BoQ is read-only"/);
});

test("percentages are formatted at one decimal like the mock", () => {
  assert.equal(displayRatio("100"), "100");
  assert.equal(displayRatio("45.74"), "45.7");
});
