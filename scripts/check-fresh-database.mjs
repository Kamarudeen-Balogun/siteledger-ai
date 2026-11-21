// Check migration order and seed on an empty disposable database.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
const source="supabase_db_siteledger-ai",database=`siteledger_fresh_qa_${randomUUID().slice(0,8)}`;
const legacy = process.argv.includes("--legacy");
function run(args,input){const result=spawnSync("docker",args,{input,encoding:"utf8",windowsHide:true,maxBuffer:25*1024*1024});if(result.status!==0)throw new Error(result.stderr?.slice(-1200)??"Local database check failed.");return result.stdout;}
const sql=text=>run(["exec","-i",source,"psql","-U","supabase_admin","-d",database,"-v","ON_ERROR_STOP=1"],text);
let created=false;
try {
  run(["exec",source,"createdb","-U","postgres","--template=template0",database]);created=true;
  // Native platform schemas/roles are prerequisites, with no copied account data.
  sql(run(["exec",source,"pg_dump","-U","postgres","-d","postgres","--schema=auth","--schema=storage","--schema=extensions","--schema-only","--no-owner","--no-acl"]));
  for(const name of (await readdir("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort()) {
    if (legacy && name === "20261121000300_account_identity.sql") {
      sql(await readFile("supabase/seed/demo.sql","utf8"));
      sql("insert into public.telegram_users(telegram_id,display_name,project_id,role) values(991000,'Authorized fixture foreman','10000000-0000-4000-8000-000000000001','foreman'),(991001,'Authorized fixture PM','10000000-0000-4000-8000-000000000001','pm');");
    }
    sql(await readFile(`supabase/migrations/${name}`,"utf8"));
  }
  sql(await readFile("supabase/seed/demo.sql","utf8"));
  sql(await readFile("tests/database.sql","utf8"));
  if (legacy) sql("do $$ begin if (select count(*) from public.account_memberships)<>2 or not exists(select 1 from public.account_projects p join public.account_legacy_actors l on l.profile_id=p.owner_profile_id where l.telegram_id=991001) then raise exception 'Legacy authorized PM ownership import failed'; end if; if exists(select 1 from public.account_profiles where name_confirmed_at is not null) then raise exception 'Legacy metadata must not confirm professional identity'; end if; end $$;");
  sql(`do $$ declare original jsonb; begin
    original:=public.get_demo_report_input();
    if original is null or (select count(*) from public.account_legacy_report_sources)<>12 then raise exception 'Fresh demo snapshots missing'; end if;
    update public.boq_items set rate=rate+1 where project_id='10000000-0000-4000-8000-000000000001';
    if public.get_demo_report_input() is distinct from original then raise exception 'Current private rates entered public demo'; end if;
  end $$;`);
  console.log(`${legacy ? "Legacy two-account upgrade and PM owner import" : "Fresh install"}: migrations, seed, frozen sources and private-rate isolation pass.`);
} finally {
  if(created&&/^siteledger_fresh_qa_[a-f0-9]{8}$/.test(database))run(["exec",source,"dropdb","-U","postgres","--force",database]);
}
