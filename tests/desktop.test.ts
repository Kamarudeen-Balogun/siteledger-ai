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

test("Today goes two-column and BoQ tables go full-width on desktop", () => {
  const css = read("components", "transplant-desktop.css");
  assert.match(css, /\.stitch-today \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /\.stitch-today > section\.diary-progress,[^}]*grid-column: 2;/);
  assert.match(css, /\.ledger-scroll \{ overflow-x: visible; \}/);
  assert.match(css, /\.report-table-scroll \{ overflow-x: visible; \}/);
});
