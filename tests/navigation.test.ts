import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isWorkspacePath, navigationFallback } from "../lib/navigation/routes";

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
  assert.ok(source.includes('createPortal(<div className="fixed inset-0 z-50"'), "Menu dialog must be rendered through createPortal");
  assert.ok(source.includes("document.body)"), "Menu dialog portal target must be document.body");
  const headerStart = source.indexOf("<header");
  const headerEnd = source.indexOf("</header>", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart, "Public header must exist");
  assert.ok(!source.slice(headerStart, headerEnd).includes('role="dialog"'), "No dialog may be nested inside the blurred header");
  assert.ok(source.slice(headerStart, headerEnd).includes("<PublicMenu />"), "Menu button stays in the header");
});
