import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function read(...parts: string[]) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ...parts), "utf8");
}

test("admin inbox lists all feedback, My feedback lists only mine", () => {
  // Regression: both views called the same query and returned the same
  // list. The RPC takes p_mine; the history view passes true, the admin
  // inbox passes false (all users' entries, author + project each).
  const migration = read("supabase", "migrations", "20261127000900_feedback_mine_and_delete.sql");
  assert.match(migration, /p_mine boolean default false/);
  assert.match(migration, /where \(admin and not p_mine\) or public\.account_person\(profile_id\)=person/);
  const data = read("lib", "feedback", "data.ts");
  assert.match(data, /export function feedbackData\(hash:string, mine=false\)/);
  assert.match(data, /p_mine:mine/);
  const page = read("app", "account", "feedback", "page.tsx");
  assert.match(page, /feedbackData\(hash,params\.view==="history"\)/);
});

test("admin can delete a feedback entry, with a confirm step", () => {
  // Regression: the admin inbox had no delete function anywhere. Delete
  // is admin-only in the RPC (replies first, then the entry), allowlisted
  // in the API route, and confirmed in the UI before it runs.
  const migration = read("supabase", "migrations", "20261127000900_feedback_mine_and_delete.sql");
  assert.match(migration, /if p_input \? 'delete' then/);
  assert.match(migration, /delete from public\.product_feedback_replies where feedback_id=row\.id;/);
  assert.match(migration, /delete from public\.product_feedback where id=row\.id;/);
  const route = read("app", "api", "feedback", "route.ts");
  assert.match(route, /if\(input\.delete===true\)/);
  assert.match(route, /p_input:\{delete:true\}/);
  const form = read("components", "feedback-form.tsx");
  assert.match(form, /Delete this feedback/);
  assert.match(form, /title:"Delete this feedback\?"/);
  assert.match(form, /send\(\{id:item\.id,delete:true\}\)/);
});

test("admin actions are visible on each feedback card", () => {
  // Regression: cards showed no actions at all — status, reply and
  // delete were hidden behind opening the item, and the page below a
  // single card was empty space. Cards now carry the message, replies
  // and the admin form inline, with a real empty state.
  const form = read("components", "feedback-form.tsx");
  assert.ok(!form.includes("<details"), "Feedback cards must not hide their actions behind an expandable item");
  assert.match(form, /<article key=\{item\.id\} className="stitch-card">/);
  assert.match(form, /\{admin&&<FeedbackAdmin item=\{item\}\/>\}/);
  assert.match(form, /No feedback yet/);
  assert.match(form, /You have not sent feedback yet/);
});
