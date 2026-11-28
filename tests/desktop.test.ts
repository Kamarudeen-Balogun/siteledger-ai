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

test("BoQ rows are a 12-column grid on desktop (item 5, values 4, progress 3)", () => {
  const css = read("components", "transplant-desktop.css");
  // Stitch boq_mock_project: each row is a 12-column grid — item 5,
  // values 4, measured progress 3. The rows stay cards; only the
  // inside is gridded.
  assert.match(css, /\.stitch-boq-items > li\.stitch-card \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.stitch-boq-items > li > \.stitch-boq-item-head,\s*\.stitch-boq-items > li > \.stitch-boq-item-open \{ grid-column: 1 \/ span 5; \}/);
  assert.match(css, /\.stitch-boq-items > li > dl\.stitch-boq-values \{ grid-column: 6 \/ span 4;/);
  assert.match(css, /\.stitch-boq-items > li > \.stitch-boq-progress \{[^}]*grid-column: 10 \/ span 3;[^}]*border-left: 1px solid var\(--rule\);/);
  assert.match(css, /\.stitch-boq-items > li > \.stitch-boq-adjust \{ grid-column: 10 \/ span 3;/);
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
  // were flex-col stacks. The hooks are now on the markup.
  for (const hook of ["landing-principles", "workflow-list", "landing-legal-items", "landing-roles"]) {
    assert.match(page, new RegExp(`className="[^"]*${hook}`), `landing must carry ${hook}`);
  }
  assert.match(css, /\.landing-principles,\s*\.landing-roles \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.workflow-list \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.landing-legal-items \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  // Section headings span the full width above their grids.
  assert.match(css, /\.landing-principles > div:first-child,\s*\.landing-roles > div:first-child \{ grid-column: 1 \/ -1; \}/);
  // Copy and figures are untouched: the four routine steps and the
  // four legal items are all still in the page.
  assert.equal((page.match(/"0[1-4]",/g) ?? []).length, 4);
  assert.match(page, /"Registered Professional Names & Roles"/);
  assert.match(page, /"Private, Encrypted Site Repositories"/);
});

test("Team is 8+4, Account is 7+5 and Project detail is 7+5 on Stitch's 12-column grid", () => {
  const css = read("components", "transplant-desktop.css");
  // Team (team_ajah): members 8 left, Current Site + Reports & Log
  // + Connect Telegram 4 right.
  assert.match(css, /\.team-workspace \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.team-workspace > section\.stitch-team-members \{ grid-column: 1 \/ span 8; \}/);
  assert.match(css, /\.team-workspace > section\.stitch-team-overview,\s*\.team-workspace > a\.stitch-team-report,\s*\.team-workspace > section\.stitch-team-telegram \{ grid-column: 9 \/ span 4; \}/);
  const team = read("app", "projects", "[id]", "team", "page.tsx");
  assert.match(team, /className="team-workspace /);
  // Account (account_profile_settings): profile card 5 left,
  // Settings 7 right, sign-out full-width below. The grid only
  // applies to the overview; edit forms keep their single column.
  assert.match(css, /\.stitch-profile:has\(> section\.stitch-profile-card\) \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.stitch-profile:has\(> section\.stitch-profile-card\) > section\.stitch-profile-card \{ grid-column: 1 \/ span 5; \}/);
  assert.match(css, /\.stitch-profile:has\(> section\.stitch-profile-card\) > section\.stitch-profile-settings \{ grid-column: 6 \/ span 7;/);
  // Project detail (project_detail): Next step + links 5 left,
  // Project summary dashboard 7 right. The grid only applies to
  // the overview view; records and progress stay single-column.
  assert.match(css, /\.project-workspace:has\(> section\[data-project-step\]\) \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.project-workspace:has\(> section\[data-project-step\]\) > section\[data-project-step\],\s*\.project-workspace:has\(> section\[data-project-step\]\) > \.stitch-menu-list \{ grid-column: 1 \/ span 5;/);
  assert.match(css, /\.project-workspace:has\(> section\[data-project-step\]\) > section\.project-ledger \{ grid-column: 6 \/ span 7;/);
  const detail = read("app", "projects", "[id]", "page.tsx");
  assert.match(detail, /className="project-workspace /);
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
