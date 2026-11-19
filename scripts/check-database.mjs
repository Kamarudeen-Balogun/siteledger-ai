import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const source = process.argv[2] === "tests/telegram.sql" ? "telegram.sql"
  : process.argv[2] === "tests/ai.sql" ? "ai.sql"
  : process.argv[2] === "tests/confirm.sql" ? "confirm.sql"
  : process.argv[2] === "tests/reports.sql" ? "reports.sql" : "database.sql";
const sql = await readFile(new URL(`../tests/${source}`, import.meta.url), "utf8");
// An explicit container prevents checks from reaching another project or a hosted database.
const result = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_siteledger-ai", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", windowsHide: true },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error("Cannot run database checks. Start this project's local Supabase stack first.");
}
process.exit(result.status ?? 1);
