import { mkdir, readFile, writeFile } from "node:fs/promises";

// Prepares SQL for SiteLedger's existing hosted database; never executes it.
const source = "supabase/migrations/20261121000100_photo_analysis.sql";
const sql = await readFile(source, "utf8");
if ((sql.match(/^begin;\s*$/gm) ?? []).length !== 1
  || (sql.match(/^commit;\s*$/gm) ?? []).length !== 1) {
  throw new Error("Expected one migration transaction.");
}
const body = sql.replace(/^begin;\s*$/gm, "").replace(/^commit;\s*$/gm, "");
const tables = ["projects", "boq_items", "telegram_users", "submissions",
  "submission_photos", "reports", "report_items", "amendments",
  "telegram_updates", "submission_ai_jobs"];
const names = tables.map(name => `'${name}'`).join(",");
const hashQuery = "select count(*), md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), '')) from public.%I r";
const prepared = `-- Existing SiteLedger development database ONLY: tfpxfxzawcjqjwrchlky.
-- Open its SQL editor: https://supabase.com/dashboard/project/tfpxfxzawcjqjwrchlky/sql/new
-- Generated from ${source}; no seed, reset or backfill.
-- Existing records are locked briefly and checked before COMMIT.
-- Any failed statement aborts this transaction. Do not execute fragments.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if not exists(select 1 from public.projects
    where id = '10000000-0000-4000-8000-000000000001'
      and project_code = 'LEKKI-DEMO-01' and is_demo) then
    raise exception 'Expected existing SiteLedger demo project';
  end if;
  if to_regclass('public.photo_analysis_jobs') is not null then
    raise exception 'Photo analysis already exists; do not reapply';
  end if;
  if to_regprocedure('public.get_confirmation_record(uuid,bigint)') is null then
    raise exception 'Prior confirmation migration is required';
  end if;
end $$;
lock table ${tables.map(name => `public.${name}`).join(",")} in share mode;
create temp table siteledger_photo_before(table_name text primary key, rows_before bigint, digest text) on commit drop;
do $$ declare name text; total bigint; fingerprint text; begin
  foreach name in array array[${names}] loop
    execute format($siteledger_hash$${hashQuery}$siteledger_hash$, name) into total, fingerprint;
    insert into pg_temp.siteledger_photo_before values(name,total,fingerprint);
  end loop;
end $$;
${body}
do $$ declare original record; total bigint; fingerprint text; begin
  for original in select * from pg_temp.siteledger_photo_before loop
    execute format($siteledger_hash$${hashQuery}$siteledger_hash$, original.table_name) into total, fingerprint;
    if total is distinct from original.rows_before or fingerprint is distinct from original.digest then
      raise exception 'Photo migration changed existing % records; rolling back', original.table_name;
    end if;
  end loop;
  if exists(select 1 from public.photo_analysis_jobs) then
    raise exception 'Existing photos must not be backfilled';
  end if;
end $$;
select table_name, rows_before, 'unchanged' as preservation_check from pg_temp.siteledger_photo_before order by table_name;
notify pgrst, 'reload schema';
commit;
`;
await mkdir("supabase/.temp/task-9", { recursive: true });
await writeFile("supabase/.temp/task-9/apply-photo-analysis.sql", prepared);
console.info("Prepared supabase/.temp/task-9/apply-photo-analysis.sql.");
console.info("No database was changed. Select only the SiteLedger project before running the entire file.");
