import test from "node:test";
import assert from "node:assert/strict";
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
