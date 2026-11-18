import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

// Original migrations and seed remain the source of truth. No credentials here.
const migrations = (await readdir("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sources = [
  ...migrations.map((name) => `supabase/migrations/${name}`),
  "supabase/seed/demo.sql",
];
const parts = [];
for (const source of sources) {
  const sql = await readFile(source, "utf8");
  parts.push(`-- Source: ${source}\n${sql.replace(/^(begin|commit);\s*$/gim, "")}`);
}
await mkdir("supabase/.temp", { recursive: true });
await writeFile(
  "supabase/.temp/hosted-setup.sql",
  `-- Fresh SiteLedger project only. Run once; existing databases are rejected.\n` +
    `-- Codex MCP target: tfpxfxzawcjqjwrchlky.\n` +
    `begin;\n` +
    `do $$ begin\n` +
    `  if to_regclass('public.projects') is not null then\n` +
    `    raise exception 'A projects table already exists. Apply only outstanding migrations instead.';\n` +
    `  end if;\n` +
    `end $$;\n\n` +
    parts.join("\n\n") +
    `\n\nnotify pgrst, 'reload schema';\ncommit;\n`,
);
console.log("Prepared supabase/.temp/hosted-setup.sql from the migrations and demo seed.");
console.log("The new hosted database has not been changed by this command.");
