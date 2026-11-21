-- Task 10A: retain supplied decimals for currencies with different precisions.
-- Every existing value must match its original representation after the upgrade.
begin;
create temporary table account_money_before(name text primary key,digest text) on commit drop;
do $$ declare tab text; digest text; begin
  foreach tab in array array['projects','boq_items','report_items','reports','submissions','amendments'] loop
    execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' order by id),'''')) from public.%I t',tab) into digest;
    insert into account_money_before values(tab,digest);
  end loop;
end $$;
create temporary table account_money_views(name text primary key,definition text) on commit drop;
insert into account_money_views select c.relname,pg_get_viewdef(c.oid,true) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='v' and c.relname in ('project_summary','boq_progress');
drop view public.project_summary,public.boq_progress;
alter table public.report_items drop column cost_snapshot;
alter table public.projects alter column contract_sum type numeric;
alter table public.boq_items alter column rate type numeric;
alter table public.report_items alter column rate_snapshot type numeric;
alter table public.reports alter column total_cost type numeric;
alter table public.report_items add column cost_snapshot numeric generated always as (quantity_done * rate_snapshot) stored;
-- Several authorized foremen may each have a daily report; submission remains unique.
alter table public.reports drop constraint reports_project_id_date_key;
do $$ declare v record; definition text; begin
  for v in select * from account_money_views loop
    execute format('create view public.%I with (security_invoker=true) as %s',v.name,v.definition);
    execute format('revoke all on public.%I from public,anon,authenticated',v.name);
    execute format('grant select on public.%I to service_role',v.name);
  end loop;
  select pg_get_functiondef('public.guard_report_record()'::regprocedure) into definition;
  definition := regexp_replace(definition,'approved_cost numeric\([^)]*\);','approved_cost numeric;');
  execute definition;
end $$;
do $$ declare baseline record; digest text; begin
  for baseline in select * from account_money_before loop
    execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' order by id),'''')) from public.%I t',baseline.name) into digest;
    if digest is distinct from baseline.digest then raise exception 'Existing money/evidence changed in %; upgrade rolled back',baseline.name; end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
