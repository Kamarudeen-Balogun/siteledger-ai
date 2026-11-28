import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function read(...parts: string[]) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ...parts), "utf8");
}

// Desktop layer — Stitch desktop adaptation (preview branch). The layer
// must restyle the mobile diary pages only at wide widths, using diary
// tokens only, and must never reintroduce the old design.

test("the desktop layer applies only at min-width 1024px", () => {
  const css = read("components", "transplant-desktop.css");
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Nothing but whitespace may precede the single media query, and the
  // braces must balance (one @media block holding every rule).
  assert.match(withoutComments, /^\s*@media \(min-width: 1024px\) \{/);
  assert.equal((withoutComments.match(/@media/g) ?? []).length, 1);
  assert.equal((withoutComments.match(/\{/g) ?? []).length, (withoutComments.match(/\}/g) ?? []).length);
});

test("the desktop layer carries no old-design tokens", () => {
  const css = read("components", "transplant-desktop.css");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Inter/Roboto/Playfair/Newsreader fonts, any blue palette, gradients
  // and stock-photo hosts are old-design tells and must not appear.
  for (const token of ["Inter", "Roboto", "Playfair", "Newsreader", "blue-", "#2563eb", "#3b82f6", "gradient", "lh3.googleusercontent"]) {
    assert.equal(rules.includes(token), false, `desktop CSS must not contain ${token}`);
  }
  // Rules use diary var() tokens only — no raw hex colours outside the
  // header comment (which is stripped above).
  assert.equal(/#[0-9a-fA-F]{3,6}/.test(rules), false, "desktop rules must use var() diary tokens, not raw hex");
});

test("the desktop top nav carries the Stitch workspace items", () => {
  const navigation = read("components", "app-navigation.tsx");
  // Desktop tab bar: Today / Projects / BoQ & Rates / Reports & Log /
  // Team / Settings (the old Account/Help desktop nav is gone).
  for (const label of ["Today", "Projects", "BoQ & Rates", "Reports & Log", "Team", "Settings"]) {
    assert.match(navigation, new RegExp(`"${label}"`));
  }
  assert.doesNotMatch(navigation, /"Account", "Help"/);
  // The session-settle guard is unchanged: no nav links render until
  // the session check settles.
  assert.match(navigation, /navigation\?\.ready \? navigation\.active \?/);
  // The mobile dock keeps its four tabs and its mock handling.
  assert.match(navigation, /className="workspace-dock"/);
  assert.match(navigation, /href: isMock \? "\/projects\/mock\?view=boq" : projectHref/);
  assert.match(navigation, /href: isMock \? "\/projects\/mock\?view=team" : projectHref/);
});

test("the project switcher keeps the name and org badge on one clean row on desktop", () => {
  const css = read("components", "transplant-desktop.css");
  // The switcher's row rules (button align-items/gap/padding, name
  // flex:1 + nowrap + ellipsis, badge max-width + nowrap + ellipsis
  // + pill) live in stitch.css inside @media (max-width: 1023px),
  // so at desktop the button was a bare flex row (align-items:
  // stretch, gap: 0, padding: 0) and the name and badge were plain
  // wrapping text crowding each other at the top edge ("Test Duplex
  // — Ajah" / "PERKINS LIMITED", "Mock project" / "DEMO DATA").
  // The desktop layer re-asserts the row here; mobile is untouched.
  assert.match(css, /\.workspace-header \.stitch-project-switch \{[^}]*align-items: center;[^}]*gap: 8px;[^}]*padding: 0 16px;/);
  assert.match(css, /\.workspace-header \.stitch-project-switch strong \{[^}]*flex: 1;[^}]*white-space: nowrap;[^}]*\}/);
  assert.match(css, /\.workspace-header \.stitch-project-switch \.stitch-kicker \{[^}]*flex: none;[^}]*max-width: 32%;[^}]*white-space: nowrap;[^}]*background: var\(--stitch-inset\);[^}]*\}/);
  // The markup still renders the name and the org badge in the
  // switcher (real client, or "Demo data" on the mock).
  const navigation = read("components", "app-navigation.tsx");
  assert.match(navigation, /<strong>\{project \?\? selected\?\.name/);
  assert.match(navigation, /<span className="stitch-kicker">Demo data<\/span>/);
  assert.match(navigation, /selected\?\.client && <span className="stitch-kicker">/);
});

test("the desktop layer is imported after the transplant styles", () => {
  const layout = read("app", "layout.tsx");
  assert.match(layout, /import "@\/components\/transplant-desktop\.css";/);
  assert.ok(layout.indexOf("transplant-public.css") < layout.indexOf("transplant-desktop.css"));
});

test("the mock project uses the workspace width on desktop", () => {
  const mock = read("app", "projects", "mock", "page.tsx");
  assert.match(mock, /<main className="mx-auto max-w-7xl px-5 py-7/);
});

test("Today goes two-column on Stitch's 12-column grid and BoQ tables go full-width on desktop", () => {
  const css = read("components", "transplant-desktop.css");
  // Stitch Today: two lg:col-span-6 halves on a 12-column grid.
  assert.match(css, /\.stitch-today \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  // Left column (1 / span 6): Awaiting review, Today's submissions,
  // Daily ledger entry. Right column (7 / span 6): Work Progress,
  // Telegram example. Explicit lines, not bare `span 6`, so the left
  // items stack in the left column instead of filling the row.
  assert.match(css, /\.stitch-today > section\.stitch-drafts,\s*\.stitch-today > section\.stitch-ledger \{ grid-column: 1 \/ span 6; \}/);
  assert.match(css, /\.stitch-today > section\.diary-progress,\s*\.stitch-today > details\.work-disclosure\[data-tour="bot-example"\] \{ grid-column: 7 \/ span 6; \}/);
  // The header spans the full width so it never steals a grid cell.
  assert.match(css, /\.stitch-today > \.workspace-header,/);
  assert.match(css, /\.ledger-scroll \{ overflow-x: visible; \}/);
  assert.match(css, /\.report-table-scroll \{ overflow-x: visible; \}/);
});

test("the mock Today is a stitch-today grid and its demo day is pinned to Lagos", () => {
  const mock = read("app", "projects", "mock", "page.tsx");
  // The mock <main> has no stitch-today class, so the Today view
  // carries the grid itself — without it none of the Today desktop
  // rules applied and the mock stayed a single-column stack.
  assert.match(mock, /<div className="stitch-today">/);
  // The demo day is midnight +01:00; without a pinned timezone it
  // formats as 5 Nov in UTC and west of it, while the submissions
  // are dated 6 Nov.
  assert.match(mock, /timeZone: "Africa\/Lagos"/);
  assert.match(mock, /new Date\("2026-11-06T00:00:00\+01:00"\)/);
});

test("BoQ rows are a 12-column grid on desktop (item 4, values 5, progress 3) and the values never overlap", () => {
  const css = read("components", "transplant-desktop.css");
  // Stitch boq_mock_project: each row is a 12-column grid — item 5,
  // values 4, measured progress 3. The values column is widened to
  // 5 here (item 4): at 1024px the three nowrap money figures need
  // ~120px each and a 4-wide column only gives ~110px, so the Unit
  // Rate ran over the Line Total. The rows stay cards; only the
  // inside is gridded.
  assert.match(css, /\.stitch-boq-items > li\.stitch-card \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.stitch-boq-items > li > \.stitch-boq-item-head,\s*\.stitch-boq-items > li > \.stitch-boq-item-open \{ grid-column: 1 \/ span 4; \}/);
  assert.match(css, /\.stitch-boq-items > li > dl\.stitch-boq-values \{ grid-column: 5 \/ span 5;/);
  assert.match(css, /\.stitch-boq-items > li > \.stitch-boq-progress \{[^}]*grid-column: 10 \/ span 3;[^}]*border-left: 1px solid var\(--rule\);/);
  assert.match(css, /\.stitch-boq-items > li > \.stitch-boq-adjust \{ grid-column: 10 \/ span 3;/);
  // The row's three values share one `dl` whose shared rule uses
  // auto-fit minmax(80px, 1fr) with nowrap `dd`s — a long rate
  // overflowed its track into the Line Total. In a row the Unit
  // rate's track sizes to its content (`auto`) and its `dd` never
  // wraps, so "₦145,000 per m³" stays on one line instead of
  // breaking between "per" and "m³"; the Scope qty and Line total
  // keep flexible tracks. Scoped to the row `dl` only.
  assert.match(css, /\.stitch-boq-items > li > dl\.stitch-boq-values \{ grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\); \}/);
  assert.match(css, /\.stitch-boq-items > li > dl\.stitch-boq-values > div \{ min-width: 0; \}/);
  assert.match(css, /\.stitch-boq-items > li > dl\.stitch-boq-values dd \{ white-space: normal; \}/);
  assert.match(css, /\.stitch-boq-items > li > dl\.stitch-boq-values > div:nth-child\(2\) dd \{ white-space: nowrap; \}/);
  // Both BoQ lists carry the hooks the grid places.
  const editor = read("components", "boq-editor.tsx");
  assert.match(editor, /className="stitch-boq-item-head"/);
  assert.match(editor, /className="stitch-boq-progress"/);
  assert.match(editor, /stitch-boq-adjust/);
  const demo = read("components", "mock-demo.tsx");
  assert.match(demo, /className="text-link stitch-boq-item-open"/);
  assert.match(demo, /className="stitch-boq-progress"/);
});

test("the landing sections go multi-column on desktop", () => {
  const css = read("components", "transplant-desktop.css");
  const page = read("app", "page.tsx");
  // The earlier layer only gridded `.workflow-list` (which matched
  // nothing — the landing used no such class) and claimed
  // principles/roles were "already three columns at 1024px". They
  // were flex-col stacks. The hooks are now on the markup, and the
  // selectors are qualified (section./div.) so they beat Tailwind's
  // layered `.flex` — an unlayered rule wins only when it is at
  // least as specific.
  for (const hook of ["landing-principles", "workflow-list", "landing-legal-items", "landing-roles", "landing-hero-grid", "landing-hero-actions", "landing-legal-card"]) {
    assert.match(page, new RegExp(`className="[^"]*${hook}`), `landing must carry ${hook}`);
  }
  assert.match(css, /section\.landing-principles,\s*section\.landing-roles \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /div\.workflow-list \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  // The legal section is Stitch's 5+7 split (heading + intro + log
  // link left, checklist card right), not a 2-column items grid.
  assert.match(css, /\.landing-legal-card \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.landing-legal-card > div:first-child,\s*\.landing-legal-card > p,\s*\.landing-legal-card > div:last-child \{ grid-column: 1 \/ span 5; \}/);
  assert.match(css, /\.landing-legal-card > \.landing-legal-items \{ grid-column: 6 \/ span 7; grid-row: 1 \/ span 2; \}/);
  assert.doesNotMatch(css, /\.landing-legal-items \{[^}]*grid-template-columns: repeat\(2,/);
  // Hero: Stitch's 6+6 — headline + CTAs left, the sample-record
  // preview card right. The CTAs are an inline row at desktop, not
  // full-width buttons.
  assert.match(css, /\.landing-hero-grid \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.landing-hero-grid > section:first-child \{ grid-column: 1 \/ span 6;/);
  assert.match(css, /\.landing-hero-grid > section:last-child \{ grid-column: 7 \/ span 6;/);
  assert.match(css, /\.landing-hero-actions \{ flex-direction: row;/);
  assert.match(css, /\.landing-hero-actions > a \{ width: auto; \}/);
  // Section headings span the full width above their grids.
  assert.match(css, /section\.landing-principles > div:first-child,\s*section\.landing-roles > div:first-child \{ grid-column: 1 \/ -1; \}/);
  // Copy and figures are untouched: the four routine steps and the
  // four legal items are all still in the page.
  assert.equal((page.match(/"0[1-4]",/g) ?? []).length, 4);
  assert.match(page, /"Registered Professional Names & Roles"/);
  assert.match(page, /"Private, Encrypted Site Repositories"/);
});

test("Team is 8+4, Account is 5+7 and Project detail is 5+7 on Stitch's 12-column grid", () => {
  const css = read("components", "transplant-desktop.css");
  // Team (team_ajah): members 8 left, Current Site + Reports & Log
  // + Connect Telegram 4 right. Dense flow: the members section
  // comes AFTER the overview/report/telegram in the DOM, so sparse
  // placement would strand it below them; dense backfills it to the
  // top of the left column, beside the overview.
  assert.match(css, /\.team-workspace \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)[^}]*grid-auto-flow: dense;/);
  assert.match(css, /\.team-workspace > section\.stitch-team-members \{ grid-column: 1 \/ span 8; \}/);
  assert.match(css, /\.team-workspace > section\.stitch-team-overview,\s*\.team-workspace > a\.stitch-team-report,\s*\.team-workspace > section\.stitch-team-telegram \{ grid-column: 9 \/ span 4; \}/);
  // The overview card sits in the narrow 4-column rail and its
  // metrics `dl` uses the shared auto-fit rule with nowrap `dd`s:
  // three figures in ~380px overflowed their 80px-min tracks
  // into each other ("₦52,328,000₦14,360,80012"). Stitch's card
  // shows its two metrics in a 2-column grid, so this `dl` is
  // 2 columns too — each figure gets half the card and stays on
  // one line, and a third figure (Locked reports, mock only)
  // wraps to a second row instead of colliding.
  assert.match(css, /\.stitch-team-overview \.stitch-boq-values \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.stitch-team-overview \.stitch-boq-values > div \{ min-width: 0; \}/);
  const team = read("app", "projects", "[id]", "team", "page.tsx");
  assert.match(team, /className="team-workspace /);
  // The mock team view gets the same 8+4 (it never had the wrapper
  // or the hooks, so round-2's rule matched nothing there). The
  // 8+4 also moves the members' "Pending" chip out of the
  // bottom-right corner, so Ada no longer clips it.
  const mock = read("app", "projects", "mock", "page.tsx");
  assert.match(mock, /<div className="team-workspace">/);
  assert.match(mock, /className="stitch-card stitch-team-telegram"/);
  const demo = read("components", "mock-demo.tsx");
  assert.match(demo, /className="stitch-card stitch-team-members"/);
  // Account (account_profile_settings): the spans in code.html, DOM
  // order, are profile card 5 and Settings 7 — profile left (5),
  // Settings right (7), sign-out full-width below. The grid only
  // applies to the overview; edit forms keep their single column.
  assert.match(css, /\.stitch-profile:has\(> section\.stitch-profile-card\) \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.stitch-profile:has\(> section\.stitch-profile-card\) > section\.stitch-profile-card \{ grid-column: 1 \/ span 5; \}/);
  assert.match(css, /\.stitch-profile:has\(> section\.stitch-profile-card\) > section\.stitch-profile-settings \{ grid-column: 6 \/ span 7;/);
  // Project detail (project_detail): the spans in code.html, DOM
  // order, are Next step 5 and dashboard 7 — Next step + links 5
  // left, Project summary dashboard 7 right. The dashboard spans
  // two rows so it fills the right side beside both the step and
  // the links. The grid only applies to the overview view; records
  // and progress stay single-column.
  assert.match(css, /\.project-workspace:has\(> section\[data-project-step\]\) \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.project-workspace:has\(> section\[data-project-step\]\) > section\[data-project-step\],\s*\.project-workspace:has\(> section\[data-project-step\]\) > \.stitch-menu-list \{ grid-column: 1 \/ span 5;/);
  assert.match(css, /\.project-workspace:has\(> section\[data-project-step\]\) > section\.project-ledger \{ grid-column: 6 \/ span 7; grid-row: span 2;/);
  const detail = read("app", "projects", "[id]", "page.tsx");
  assert.match(detail, /className="project-workspace /);
  // The dashboard's lead figures broke mid-number ("₦25,000,000")
  // because `overflow-wrap: anywhere` lets them split anywhere.
  // At desktop they stay on one line and shrink to fit the column.
  assert.match(css, /\.project-ledger \.ledger-totals dd \{ overflow-wrap: normal; white-space: nowrap; font-size: clamp\(20px, 2vw, 30px\); \}/);
});

test("Today's Work Progress backfills to the top of the right column (dense flow)", () => {
  const css = read("components", "transplant-desktop.css");
  // The right-column items (Work Progress, Telegram example) come
  // AFTER the left-column items in the DOM. Sparse auto-placement
  // put Work Progress beside the LAST left item (Daily Ledger
  // Entry), leaving the right half empty beside Awaiting review
  // and Today's submissions. Dense backfills it to the top-right,
  // beside Awaiting review — where Stitch puts it.
  assert.match(css, /\.stitch-today \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)[^}]*grid-auto-flow: dense;/);
  // The placement lines are unchanged: left items 1 / span 6,
  // right items 7 / span 6.
  assert.match(css, /\.stitch-today > section\.stitch-drafts,\s*\.stitch-today > section\.stitch-ledger \{ grid-column: 1 \/ span 6; \}/);
  assert.match(css, /\.stitch-today > section\.diary-progress,\s*\.stitch-today > details\.work-disclosure\[data-tour="bot-example"\] \{ grid-column: 7 \/ span 6; \}/);
});

test("the sample report takes Stitch's 7+5 on desktop; the sealed record stays single-column", () => {
  const css = read("components", "transplant-desktop.css");
  const demo = read("app", "reports", "demo", "page.tsx");
  // sample_locked_report: report document 7 left, photo evidence 5
  // right. The figure is placed by explicit line beside the items
  // table, not dense flow, so it cannot backfill beside the back
  // link. Every other child stays in the left column.
  assert.match(demo, /className="sample-report-layout /);
  assert.match(css, /\.sample-report-layout \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.sample-report-layout > \* \{ grid-column: 1 \/ span 7; \}/);
  assert.match(css, /\.sample-report-layout > figure \{ grid-column: 8 \/ span 5; \}/);
  // ReportDocument (the sealed record) is untouched: Stitch's mock
  // locked report is itself single-column, and the 7+5 is only the
  // sample page's inspection split.
  assert.doesNotMatch(css, /\.report-document \{[^}]*display: grid;/);
  // Content, figures and signatures are unchanged: the page renders
  // the total from the demo data (total_cost 1495300) and the
  // signatures are literals in the page.
  const data = read("lib", "data", "demo-documents.json");
  assert.match(data, /"total_cost": "1495300"/);
  assert.match(demo, /Recorded by Musa Bello/);
  assert.match(demo, /Approved by Engr\. Tola Adeyemi/);
});

test("Contact takes Stitch's 5+7 on desktop (desk left, form right)", () => {
  const css = read("components", "transplant-desktop.css");
  const contact = read("app", "contact", "page.tsx");
  // contact_desktop: contact desk 5 left, Dispatch Message form 7
  // right. The "next step" section stays full-width below the grid.
  assert.match(contact, /<div className="contact-layout">/);
  assert.match(contact, /<ContactDesk\/>/);
  assert.match(contact, /<ContactForm siteKey=/);
  assert.match(css, /\.contact-layout \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.contact-layout > section:first-child \{ grid-column: 1 \/ span 5; \}/);
  assert.match(css, /\.contact-layout > section:last-child \{ grid-column: 6 \/ span 7; \}/);
});

test("Trial takes Stitch's 7+5 on desktop and keeps its signed-in redirect", () => {
  const css = read("components", "transplant-desktop.css");
  const forms = read("components", "trial-forms.tsx");
  const page = read("app", "trial", "page.tsx");
  // trial_desktop: start form 7 left, "What's included" sidebar 5
  // right. The sidebar lists only what the trial actually offers,
  // in the trial's own words.
  assert.match(forms, /<div className="trial-start-layout">/);
  assert.match(forms, /aria-label="What's included in the sandbox"/);
  assert.match(forms, /One voice note/);
  assert.match(forms, /Up to three photos/);
  assert.match(forms, /Human review and draft costing/);
  assert.match(forms, /24-hour session/);
  assert.match(css, /\.trial-start-layout \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.trial-start-layout > form \{ grid-column: 1 \/ span 7;/);
  assert.match(css, /\.trial-start-layout > aside \{ grid-column: 8 \/ span 5;/);
  // Signed-in users with no trial state are still redirected to
  // /today by design — /trial opening Today is that redirect, and
  // the gap it showed is the Today empty-right-column issue, fixed
  // by the dense flow above.
  assert.match(page, /if\(!state&&account\)redirect\("\/today"\);/);
});

test("every public page shows the shared footer", () => {
  const site = read("components", "public-site.tsx");
  // The footer is one shared component, not a copy per page.
  assert.match(site, /export function PublicFooter\(\{ current \}/);
  assert.match(site, /Built by Balogun Kamarudeen Ayomide/);
  assert.match(site, /<PublicFooter current=\{current\} \/>/);
  // PublicSite (landing, sample report, trial, sign-in, invite)
  // and InformationPage (About, Contact, Privacy, Terms) both
  // render it, so those pages have it by construction.
  for (const page of [["app", "about", "page.tsx"], ["app", "contact", "page.tsx"], ["app", "privacy", "page.tsx"], ["app", "terms", "page.tsx"]]) {
    assert.match(read(...page), /InformationPage/);
  }
  for (const page of [["app", "trial", "page.tsx"], ["app", "account", "page.tsx"], ["app", "invite", "page.tsx"], ["app", "reports", "demo", "page.tsx"]]) {
    assert.match(read(...page), /PublicSite/);
  }
  // The two public pages that do NOT go through PublicSite — the
  // signed-in Help view and the Log demo — render it directly,
  // wrapped in `.transplant` so the token classes resolve (the
  // workspace layout has no `.transplant` ancestor).
  const help = read("app", "help", "page.tsx");
  assert.match(help, /PublicFooter/);
  assert.match(help, /<div className="transplant"><PublicFooter current="\/help" \/><\/div>/);
  const log = read("app", "log", "demo", "page.tsx");
  assert.match(log, /PublicFooter/);
  assert.match(log, /<div className="transplant"><PublicFooter current="\/log\/demo" \/><\/div>/);
});

test("every desktop grid column uses minmax(0, 1fr) so content cannot force overflow", () => {
  const css = read("components", "transplant-desktop.css");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Any grid-template-columns in the desktop layer must use
  // minmax(0, 1fr) tracks — a bare `1fr` lets a long ₦ figure or
  // label force its track wider and overlap its neighbour at
  // 1024px, 1280px or 1838px.
  for (const match of rules.matchAll(/grid-template-columns: ([^;]+);/g)) {
    assert.ok(match[1].includes("minmax(0, 1fr)"), `grid-template-columns must use minmax(0, 1fr): ${match[1]}`);
  }
  // No desktop rule lives outside the single @media block (covered
  // by the first test) and no grid track is a bare `fr` without a
  // minmax guard.
  assert.doesNotMatch(rules, /repeat\(\d+, 1fr\)/);
});

test("the BoQ item label no longer runs into the item name, and the mock project actions are spaced", () => {
  // The mock BoQ opener was an inline-flex row, so "ITEM 01 ·
  // BLOCKWORK" and the description sat side by side with no gap.
  // It now stacks the label above the name.
  const stitch = read("app", "stitch.css");
  assert.match(stitch, /\.stitch-boq-items \.stitch-boq-item-open \{[^}]*flex-direction: column;[^}]*gap: 2px;/);
  // "Delete mock project" was inline-flex (.text-link beats
  // Tailwind's block), so it sat flush against "Open mock project".
  // The two actions are now a flex column with a gap.
  const mockProject = read("components", "mock-project.tsx");
  assert.match(mockProject, /<div className="mt-4 flex flex-col items-start gap-3"><Link href="\/projects\/mock" className="work-button work-button-primary">Open mock project<\/Link><button type="button" className="text-link" onClick=\{\(\)=>void remove\(\)\}>Delete mock project<\/button><\/div>/);
});

test("the reload skeleton takes the shape of the page it loads and spans the full page on desktop", () => {
  const loading = read("components", "page-loading.tsx");
  // A "split" variant renders two skeleton columns on the
  // destination page's split (Today 6+6, Team 8+4, Account and
  // Project detail 5+7), with an entry count mirroring the real
  // page's blocks — not a generic single-column stack of rows.
  assert.match(loading, /export type PageLoadingVariant = "rows" \| "report" \| "form" \| "table" \| "split";/);
  assert.match(loading, /export type PageLoadingSplit = "6-6" \| "8-4" \| "5-7";/);
  assert.match(loading, /"6-6": \[3, 2\]/);
  assert.match(loading, /"8-4": \[3, 3\]/);
  assert.match(loading, /"5-7": \[2, 2\]/);
  assert.match(loading, /variant === "split"/);
  assert.match(loading, /data-split=\{split\}/);
  // The two-column pages carry the split variant on their split;
  // the sealed logs carry the report shape; BoQ keeps the table
  // and forms keep the form shape.
  assert.match(read("app", "today", "page.tsx"), /variant="split" split="6-6"/);
  assert.match(read("app", "projects", "[id]", "team", "page.tsx"), /variant="split" split="8-4"/);
  assert.match(read("app", "account", "page.tsx"), /variant="split" split="5-7"/);
  assert.match(read("app", "projects", "[id]", "page.tsx"), /variant="split" split="5-7"/);
  // The mock's fallback cannot know its view (searchParams is a
  // promise), so it takes the default view's split — Today 6+6.
  assert.match(read("app", "projects", "mock", "page.tsx"), /variant="split" split="6-6"/);
  assert.match(read("app", "reports", "page.tsx"), /variant="report"/);
  assert.match(read("app", "log", "[id]", "page.tsx"), /variant="report"/);
  assert.match(read("app", "projects", "[id]", "boq", "page.tsx"), /variant="table"/);
  // The desktop layer grids the split skeleton on the same
  // 12-column grid as the real pages, per data-split.
  const css = read("components", "transplant-desktop.css");
  assert.match(css, /\.diary-skeleton--split \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.diary-skeleton--split\[data-split="6-6"\] > \.diary-skeleton__column:first-child \{ grid-column: 1 \/ span 6; \}/);
  assert.match(css, /\.diary-skeleton--split\[data-split="6-6"\] > \.diary-skeleton__column:last-child \{ grid-column: 7 \/ span 6; \}/);
  assert.match(css, /\.diary-skeleton--split\[data-split="8-4"\] > \.diary-skeleton__column:first-child \{ grid-column: 1 \/ span 8; \}/);
  assert.match(css, /\.diary-skeleton--split\[data-split="8-4"\] > \.diary-skeleton__column:last-child \{ grid-column: 9 \/ span 4; \}/);
  assert.match(css, /\.diary-skeleton--split\[data-split="5-7"\] > \.diary-skeleton__column:first-child \{ grid-column: 1 \/ span 5; \}/);
  assert.match(css, /\.diary-skeleton--split\[data-split="5-7"\] > \.diary-skeleton__column:last-child \{ grid-column: 6 \/ span 7; \}/);
  // Below 1024px the columns stack (base rule in globals.css), so
  // mobile is untouched: the split has no top rule of its own
  // (each column carries one, like a card) and a 24px gap.
  const globals = read("app", "globals.css");
  assert.match(globals, /\.diary-skeleton--split \{ border-top: 0; gap: 24px; \}/);
  assert.match(globals, /\.diary-skeleton__column \{ display: grid; gap: 4px; align-content: start; border-top: 3px solid var\(--accent\); \}/);
  // The top-left-corner causes are fixed: the root loading (shown
  // on every navigation first) spans the workspace width instead
  // of a narrower 5xl column, and the Help fallback — the only
  // one with no <main> wrapper at all, so its skeleton rendered
  // flush to the top-left edge — now renders inside the same
  // max-w-5xl main the signed-in Help content uses.
  const rootLoading = read("app", "loading.tsx");
  assert.match(rootLoading, /<main className="mx-auto min-h-svh max-w-7xl px-5 py-7 sm:px-10">/);
  assert.doesNotMatch(rootLoading, /max-w-5xl/);
  const help = read("app", "help", "page.tsx");
  assert.match(help, /<Suspense fallback=\{<main className="mx-auto min-h-svh max-w-5xl px-5 py-7"><PageLoading title="Opening help…" header=\{<div className="diary-skeleton__nav"/);
  // The loading copy is unchanged.
  assert.match(read("app", "today", "page.tsx"), /title="Opening your diary…"/);
  assert.match(read("app", "help", "page.tsx"), /title="Opening help…"/);
});

test("the Add Amendment bar docks to the bottom edge on desktop instead of floating 64px up", () => {
  const css = read("components", "transplant-desktop.css");
  // .stitch-log-actions sits 64px above the viewport bottom to
  // clear the mobile dock (stitch.css). On desktop the dock is
  // hidden, so the 64px is dead space: the bar floats above the
  // bottom edge and covers page content. At desktop it docks to
  // the bottom edge — which also clears Ada's 78px desktop rest
  // position (dock-height 68px + 10px) — and the page gets bottom
  // clearance so the last content scrolls fully above the bar.
  assert.match(css, /\.stitch-log-actions \{ bottom: 0; \}/);
  assert.match(css, /main:has\(\.stitch-log-actions\) \{ padding-bottom: 120px; \}/);
  // The button itself, its label and the mobile rule are untouched.
  const stitch = read("app", "stitch.css");
  assert.match(stitch, /\.stitch-log-actions \{ position: sticky; bottom: calc\(64px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(stitch, /\.stitch-log-actions > \.stitch-button \{ width: 100%; \}/);
  const form = read("components", "amendment-form.tsx");
  assert.match(form, /\+ Add Amendment/);
});

test("the Team page's right half is filled by the menu list (members view only)", () => {
  const css = read("components", "transplant-desktop.css");
  // The members view's bottom links and the "What can each role
  // do?" disclosure were full-width grid items below the two
  // columns, so the right half ended at the Telegram card and
  // sat empty for the rest of the page. Stitch puts both in the
  // LEFT column (team_ajah: under the members, inside the 8-col
  // div) — but Stitch's own right column is the same three short
  // cards, so its right half is empty too. To fill the right half
  // with existing content, the menu list moves into the right
  // rail below the Telegram card and the role explainer moves
  // into the left column where Stitch has it. Both are scoped
  // with :has(> section.stitch-team-members) so the
  // invitations/settings views keep their full-width layout; the
  // mock has no menu list, so it is unaffected.
  assert.match(css, /\.team-workspace:has\(> section\.stitch-team-members\) > \.stitch-menu-list \{ grid-column: 9 \/ span 4; margin-top: 0; \}/);
  assert.match(css, /\.team-workspace:has\(> section\.stitch-team-members\) > details\.work-disclosure \{ grid-column: 1 \/ span 8; \}/);
  // The 8+4 split itself is unchanged.
  assert.match(css, /\.team-workspace > section\.stitch-team-members \{ grid-column: 1 \/ span 8; \}/);
  assert.match(css, /\.team-workspace > section\.stitch-team-overview,\s*\.team-workspace > a\.stitch-team-report,\s*\.team-workspace > section\.stitch-team-telegram \{ grid-column: 9 \/ span 4; \}/);
  // The menu list and the explainer are still rendered by the
  // team page / TeamManagement (real content, nothing invented).
  const team = read("app", "projects", "[id]", "team", "page.tsx");
  assert.match(team, /className="stitch-menu-list mt-4"/);
  const forms = read("components", "project-forms.tsx");
  assert.match(forms, /What can each role do\?/);
});
