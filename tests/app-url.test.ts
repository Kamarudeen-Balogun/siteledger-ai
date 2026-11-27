import test from "node:test";
import assert from "node:assert/strict";
import { accountApi } from "../lib/auth/api";
import { appOrigin, allowedAppOrigins, isAllowedAppOrigin, isAllowedAppHostname } from "../lib/app-url";

const saved = { app: process.env.SITELEDGER_APP_URL, vercel: process.env.VERCEL_URL, branch: process.env.VERCEL_BRANCH_URL, production: process.env.VERCEL_PROJECT_PRODUCTION_URL };
function setEnv(app?: string, vercel?: string, production?: string, branch?: string) {
  if (app === undefined) delete process.env.SITELEDGER_APP_URL; else process.env.SITELEDGER_APP_URL = app;
  if (vercel === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = vercel;
  if (production === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = production;
  if (branch === undefined) delete process.env.VERCEL_BRANCH_URL; else process.env.VERCEL_BRANCH_URL = branch;
}
test.after(() => {
  if (saved.app === undefined) delete process.env.SITELEDGER_APP_URL; else process.env.SITELEDGER_APP_URL = saved.app;
  if (saved.vercel === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = saved.vercel;
  if (saved.branch === undefined) delete process.env.VERCEL_BRANCH_URL; else process.env.VERCEL_BRANCH_URL = saved.branch;
  if (saved.production === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.production;
});

test("appOrigin prefers the configured origin, then the Vercel deployment URL, then the branch URL", () => {
  setEnv("https://siteledger-ai.vercel.app/", "siteledger-ai-git-branch-team.vercel.app");
  assert.equal(appOrigin(), "https://siteledger-ai.vercel.app");
  setEnv(undefined, "siteledger-ai-git-branch-team.vercel.app");
  assert.equal(appOrigin(), "https://siteledger-ai-git-branch-team.vercel.app");
  setEnv(undefined, undefined, undefined, "siteledger-ai-git-branch-team.vercel.app");
  assert.equal(appOrigin(), "https://siteledger-ai-git-branch-team.vercel.app");
  setEnv(undefined, undefined);
  assert.equal(appOrigin(), "");
});

test("allowedAppOrigins is a closed allowlist of deployment-controlled origins", () => {
  setEnv("https://siteledger-ai.vercel.app", "siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app", "siteledger-ai.vercel.app");
  assert.deepEqual(allowedAppOrigins(), ["https://siteledger-ai.vercel.app", "https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"]);
  setEnv("not a url", "also not a url");
  assert.deepEqual(allowedAppOrigins(), []);
  setEnv(undefined, undefined);
  assert.deepEqual(allowedAppOrigins(), []);
});

test("the branch-alias origin is allowed even when VERCEL_URL is a different unique deployment URL", () => {
  // VERCEL_URL is the deployment's unique URL, not the branch alias the
  // browser visits. A preview request from the branch alias must pass.
  setEnv("https://siteledger-ai.vercel.app", "siteledger-ai-git-rebuild-stitch-ui-abc1234-kamarudeens-projects.vercel.app", undefined, "siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app");
  assert.deepEqual(allowedAppOrigins(), ["https://siteledger-ai.vercel.app", "https://siteledger-ai-git-rebuild-stitch-ui-abc1234-kamarudeens-projects.vercel.app", "https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"]);
  assert.equal(isAllowedAppOrigin("https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"), true);
  assert.equal(isAllowedAppOrigin("https://siteledger-ai-git-rebuild-stitch-ui-abc1234-kamarudeens-projects.vercel.app"), true);
  assert.equal(isAllowedAppOrigin("https://unrelated.example.test"), false);
  assert.equal(isAllowedAppHostname("siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"), true);
});

test("preview origin is allowed while the configured origin stays production; unrelated origins are rejected", () => {
  setEnv("https://siteledger-ai.vercel.app", "siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app");
  assert.equal(isAllowedAppOrigin("https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"), true);
  assert.equal(isAllowedAppOrigin("https://siteledger-ai.vercel.app"), true);
  assert.equal(isAllowedAppOrigin("https://unrelated.example.test"), false);
  assert.equal(isAllowedAppOrigin(null), false);
  assert.equal(isAllowedAppHostname("siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"), true);
  assert.equal(isAllowedAppHostname("unrelated.example.test"), false);
  setEnv("https://siteledger-ai.vercel.app", undefined);
  assert.equal(isAllowedAppOrigin("https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"), false);
});

test("an account action from the branch-alias origin passes the origin check; an unrelated origin still gets 403", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-publishable";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  setEnv("https://siteledger-ai.vercel.app", "siteledger-ai-git-rebuild-stitch-ui-abc1234-kamarudeens-projects.vercel.app", undefined, "siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app");
  const request = (origin: string) => new Request("https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app/api/account/signin", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "x@example.test" }) });
  const preview = await accountApi(request("https://siteledger-ai-git-rebuild-stitch-ui-kamarudeens-projects.vercel.app"), "signin");
  assert.notEqual(preview.status, 403);
  const unrelated = await accountApi(request("https://unrelated.example.test"), "signin");
  assert.equal(unrelated.status, 403);
});
