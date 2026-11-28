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
  assert.match(navigation, /router\.push\("\/projects\/mock\?view=today"\)/);
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
  assert.match(editor, /className="text-link stitch-boq-adjust mt-3"[^>]*onClick=\{\(\) => edit\(row\)\}[^>]*>Adjust item<\/button>/);
});

test("BoQ version history is a small button opening a sheet, never an inline expansion", () => {
  // Regression: the version list was a <details> disclosure whose summary
  // row filled the BoQ page width and expanded inline, pushing the whole
  // page down. The trigger is a small button now; the list opens in a
  // bottom sheet over the intact page (background locked by showModal),
  // and a version's rows open in the same sheet.
  const versions = read("components", "boq-versions.tsx");
  assert.ok(!versions.includes("<details"), "The version list must not be a <details> expansion");
  assert.ok(!versions.includes("<summary"), "The version list must not use a <summary> row");
  assert.match(versions, /<button type="button" className="boq-versions__trigger" data-tour="boq-history"/);
  assert.match(versions, /<dialog ref=\{sheet\} className="action-dialog stitch-sheet"/);
  assert.match(versions, /if \(dialog && !dialog\.open\) dialog\.showModal\(\);/);
  assert.match(versions, /<button type="button" className="boq-versions__row"/);
  assert.match(versions, /Back to versions/);
  const css = read("app", "globals.css");
  assert.match(css, /\.boq-versions__trigger \{[^}]*min-height: 40px;/);
  assert.ok(!css.includes(".boq-versions > summary"), "No summary-row styles may remain");
  const page = read("app", "projects", "[id]", "boq", "page.tsx");
  assert.match(page, /<BoqVersions versions=\{versions\} currency=\{currency\}\/>/);
  assert.ok(!page.includes("boq-versions__rows"), "Version rows render only inside the sheet, not inline on the BoQ page");
  const mock = read("components", "mock-project.tsx");
  assert.match(mock, /export function MockBoqActions/);
  assert.match(mock, /<dialog ref=\{sheet\} className="action-dialog stitch-sheet" aria-label="Demo BoQ is read-only"/);
});

test("the mock Add today's work never leaves the mock", () => {
  // Regression: the mock's "Add today's work" linked to /today, whose
  // server-side active project is the real one (the mock has no
  // server-side active state), so tapping it right after switching to
  // the mock snapped the user back to the real project. The mock button
  // opens a sheet on the mock instead; leaving for the real diary is an
  // explicit choice inside that sheet.
  const mock = read("app", "projects", "mock", "page.tsx");
  assert.ok(!mock.includes('href="/today"'), "The mock page must not link to /today");
  assert.match(mock, /<MockAddWork\/>/);
  const project = read("components", "mock-project.tsx");
  assert.match(project, /export function MockAddWork/);
  assert.match(project, /<dialog ref=\{sheet\} className="action-dialog stitch-sheet" aria-label="Record work in your own project"/);
  assert.match(project, /<Link href="\/today" className="stitch-button" data-primary>Open your diary<\/Link>/);
});

test("the mock explore card shows only when no project is selected", () => {
  // Regression: "New here? See a full project first" appeared on real
  // projects' Today tab too, because the explore card rendered in the
  // main Today view as well as the no-project gate. It must render only
  // in the gate view, so only users yet to pick a project see it; old
  // users reach the mock through the normal switcher.
  const diary = read("components", "capture-diary.tsx");
  const renders = diary.match(/<MockProjectControl person=\{person\} explore\/>/g) ?? [];
  assert.equal(renders.length, 1, "The explore card must render in exactly one place");
  const gateStart = diary.indexOf("gate&&!context?<section");
  const mainStart = diary.indexOf("{context&&<>");
  const renderAt = diary.indexOf("<MockProjectControl person={person} explore/>");
  assert.ok(gateStart >= 0 && mainStart > gateStart, "The gate and main views must exist");
  assert.ok(renderAt > gateStart && renderAt < mainStart, "The single explore render must sit inside the no-project gate view, not the main Today view");
  const project = read("components", "mock-project.tsx");
  assert.match(project, /if\(explore\)return <section className="stitch-card stitch-explore">/);
});

test("percentages are formatted at one decimal like the mock", () => {
  assert.equal(displayRatio("100"), "100");
  assert.equal(displayRatio("45.74"), "45.7");
});

test("the company chip updates when switching to the mock", () => {
  // Regression: the switcher button kept showing the previous real
  // project's company ("ADEBAYO FAM…") after switching to the mock,
  // because the chip read selected.client — and on the mock page the
  // navigation project id is still the last real project. The mock has
  // no company, so its chip must show the mock's own label, never a
  // stale real one.
  const navigation = read("components", "app-navigation.tsx");
  assert.match(navigation, /\{isMock \? <span className="stitch-kicker">Demo data<\/span> : selected\?\.client &&/);
});

test("the mock Today renders the new design with no old tabs in the DOM", () => {
  // Regression: /projects/mock showed the old project page and the top
  // text tabs (Today / Report / Log / BoQ / Team) appeared in the DOM on
  // first load. The mock views are switched by the bottom navigation —
  // the views list is data only (validation + dock area) and renders no
  // tab row anywhere, and the old section-tab strings must not exist.
  const mock = read("app", "projects", "mock", "page.tsx");
  assert.ok(!mock.includes('role="tab'), "The mock page must not render a tab list");
  assert.ok(!mock.includes("Project sections"), "The mock page must not render the old section tabs");
  assert.match(mock, /const headerTitle = "Mock project";/);
  assert.match(mock, /title=\{headerTitle\} project=\{headerTitle\}/);
  // The demo Today is the mock's Today: three notes in the three states,
  // each with a timestamp, photos and a playable voice note.
  assert.match(mock, /demoTodayNotes\.map\(note =>/);
  assert.match(mock, /<MockNoteDetail note=\{demoTodayNotes\[1\]\}/);
  assert.match(mock, /<MockConfirmView note=\{demoTodayNotes\[2\]\}/);
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry: string) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  for (const file of [...walk(join(dirname(fileURLToPath(import.meta.url)), "..", "app")), ...walk(join(dirname(fileURLToPath(import.meta.url)), "..", "components"))]) {
    if (!file.endsWith(".tsx")) continue;
    const source = readFileSync(file, "utf8");
    assert.ok(!source.includes("Project sections"), `${file} must not render the old section tabs`);
    assert.ok(!source.includes("Mock project sections"), `${file} must not render the old mock section tabs`);
  }
});

test("the page-change loader shows the skeleton bars at once", () => {
  // Regression: during bottom-tab page changes the app showed a mostly
  // blank loader (header + heading only), not a loading skeleton — the
  // grey bars only appeared during project switches. The loader now
  // renders the same prominent skeleton stack first, then the shaped
  // diary rows below it.
  const loading = read("components", "page-loading.tsx");
  assert.match(loading, /<div className="stitch-skeleton-stack" aria-hidden="true"><i \/><i \/><i \/><\/div>/);
  assert.match(loading, /<div className=\{`diary-skeleton diary-skeleton--\$\{variant\}`\}/);
});

test("the Awaiting review count is strictly this project's", () => {
  // Regression: the count changed 1 → 0 on Ajah with no submission — the
  // only draft belonged to Lekki. The chip rendered a count even while
  // the summary was loading, and the capture context can still name the
  // previous project right after a switch, so local sent rows were
  // counted for the wrong project. The count is gated on the summary's
  // project and shows "—" until the summary arrives.
  const diary = read("components", "capture-diary.tsx");
  assert.match(diary, /const reviewProjectId=currentSummary\?\.projectId\?\?context\?\.project_id;/);
  assert.match(diary, /row\.manifest\.project_id===reviewProjectId/);
  assert.match(diary, /\{!currentSummary&&online\?"—":drafts\.length\+localReviews\.length\}/);
  // Real Today notes show date + time, like the mock — the daily list
  // showed time only.
  assert.match(diary, /new Intl\.DateTimeFormat\("en-GB",\{dateStyle:"medium",timeStyle:"short",timeZone:context\.timezone\}\)\.format\(new Date\(note\.capturedAt\)\):note\.date\}/);
});

test("BoQ money never breaks mid-number and version sheets fit", () => {
  // Regression: a BoQ line total wrapped mid-number ("₦6,090,00" / "0")
  // at phone width, and the version-details sheet overflowed
  // horizontally. Money amounts are no-wrap; the version sheet splits
  // quantity and rate into wrapping parts instead of one unbreakable span.
  const stitch = read("app", "stitch.css");
  assert.match(stitch, /\.stitch-boq-values dd \{ white-space: nowrap;/);
  const versions = read("components", "boq-versions.tsx");
  assert.match(versions, /<span className="boq-versions__value">/);
  assert.match(versions, /<span className="boq-versions__description">/);
  const css = read("app", "globals.css");
  assert.match(css, /\.boq-versions__value span \{ white-space: nowrap; \}/);
  // BoQ versions show their timestamp (created_at from the new migration),
  // not just the effective date.
  assert.match(versions, /selected\.created_at \? <>Saved \{displayTimestamp\(selected\.created_at\)\}/);
});

test("public Help page has no tour button; the tour routes by sign-in state", () => {
  // Regression: the public Help & FAQ page (signed-out visitors) showed
  // "Take the tour again". Tapping it pushed /today, which renders the
  // sign-in gate for a signed-out user — and the tour never plays there,
  // because DiaryTour only mounts when a person exists. The button is a
  // signed-in feature, so it must not appear on the public page at all,
  // and ReplayTour must send signed-out users to the sign-in page
  // (/account) instead of /today.
  const help = read("app", "help", "page.tsx");
  const publicStart = help.indexOf("function PublicHelp");
  const publicEnd = help.indexOf("const topics", publicStart);
  assert.ok(publicStart >= 0 && publicEnd > publicStart, "PublicHelp must exist");
  assert.ok(!help.slice(publicStart, publicEnd).includes("ReplayTour"), "PublicHelp must not render the tour button");
  assert.ok(help.slice(publicEnd).includes("ReplayTour"), "the signed-in Help branch still offers the tour");
  const tour = read("components", "diary-tour.tsx");
  assert.match(tour, /signedIn: boolean/, "ReplayTour must take a required signedIn prop");
  assert.ok(!tour.includes("signedIn?:"), "signedIn must be required, not optional");
  assert.match(tour, /router\.push\(signedIn \? "\/today" : "\/account"\)/, "signed-out users go to the sign-in page, signed-in users to Today");
  // Every call site declares its sign-in state; the account page and the
  // mock-project explore card only render for signed-in users.
  assert.ok(read("app", "account", "page.tsx").includes("<ReplayTour signedIn/>"), "account page tour declares signedIn");
  assert.ok(read("components", "mock-project.tsx").includes("<ReplayTour label=\"Replay the intro tour\" inPlace signedIn/>"), "mock-project tour declares signedIn");
});

test("opening screens show a skeleton, never a bare notice", () => {
  // Regression (live audit 2026-11-28): several navigations showed a
  // mostly-blank "Opening <thing>…" screen — header + heading only —
  // because their Suspense fallbacks were a bare DiaryNotice with no
  // skeleton. Every opening fallback is now the PageLoading skeleton
  // (same "Opening…" title, shaped like the destination), and no page
  // may keep a bare DiaryNotice opening fallback.
  const openingPages: [string[], string][] = [
    [["app", "account", "page.tsx"], "Opening your account…"],
    [["app", "account", "feedback", "page.tsx"], "Opening feedback…"],
    [["app", "projects", "page.tsx"], "Opening your projects…"],
    [["app", "projects", "[id]", "team", "page.tsx"], "Opening the project team…"],
    [["app", "account", "deletion", "page.tsx"], "Opening account deletion…"],
    [["app", "shared", "[id]", "page.tsx"], "Opening shared report…"],
    [["app", "invite", "page.tsx"], "Opening your account…"],
    [["app", "trial", "page.tsx"], "Opening your private trial…"],
    [["app", "trial", "original", "[id]", "page.tsx"], "Opening preserved trial work…"],
    [["app", "trial", "report", "page.tsx"], "Opening your private draft…"],
  ];
  for (const [parts, title] of openingPages) {
    const source = read(...parts);
    assert.ok(source.includes(`<PageLoading title="${title}"`), `${parts.join("/")} must load with the PageLoading skeleton titled "${title}"`);
    assert.ok(!source.includes('DiaryNotice busy title="Opening'), `${parts.join("/")} must not keep a bare DiaryNotice opening fallback`);
  }
});

test("Today's connecting state renders the skeleton, not a bare notice", () => {
  // Regression: while Today connected, the diary showed a bare
  // "Opening your diary…" notice with no skeleton. The opening state
  // now renders the PageLoading rows skeleton under the header.
  const diary = read("components", "capture-diary.tsx");
  assert.match(diary, /<PageLoading title="Opening your diary…" variant="rows"\/>/);
  assert.ok(!diary.includes('<DiaryNotice busy title="Opening your diary…"'), "Today must not keep the bare opening notice");
});

test("Help loads with a skeleton instead of a blank flash", () => {
  // Regression: Help's Suspense fallback was null, so navigating to Help
  // flashed blank. It now shows the PageLoading skeleton.
  const help = read("app", "help", "page.tsx");
  assert.ok(!help.includes("fallback={null}"), "Help must not have a null loading fallback");
  assert.ok(help.includes('<PageLoading title="Opening help…"'), "Help must load with the PageLoading skeleton");
});

test("skeleton bars are a clearly visible warm taupe on paper", () => {
  // Regression: the skeleton bars were a pale taupe (#d8cbb4 on #faf7f2
  // paper) that read as nearly blank in the live audit, even on pages
  // that already used PageLoading. The bars are now a deeper warm taupe
  // with taller bars, so the screen reads as a skeleton at once.
  const css = read("app", "globals.css");
  assert.match(css, /--skeleton: #b9a583;/);
  assert.match(css, /--skeleton-light: #dccfb4;/);
  assert.match(css, /\.stitch-skeleton-stack i \{[^}]*height: 20px;/);
  assert.match(css, /\.diary-skeleton i \{[^}]*height: 16px;/);
});
