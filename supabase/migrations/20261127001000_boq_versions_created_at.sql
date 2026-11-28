-- BoQ version history shows only the effective date, so a version saved
-- today and one saved last week can look identical when their effective
-- dates match. project_boq_versions already stores created_at (the moment
-- the snapshot was taken); the account_boq_versions RPC just never
-- returned it. Expose it so version rows and sheets can show the full
-- timestamp, like every other record in the app. Read-only change — no
-- rows are written and no version is created.
begin;

create or replace function public.account_boq_versions(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if public.account_project_access(p_hash,p_project) is null then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('version',version,'effective_date',effective_date,
    'created_at',created_at,'items',jsonb_array_length(rows),'rows',rows) order by version desc),'[]'::jsonb)
    from (select version,effective_date,created_at,rows from public.project_boq_versions where project_id=p_project order by version desc limit 50) v);
end; $$;

revoke all on function public.account_boq_versions(text,uuid) from public,anon,authenticated;
grant execute on function public.account_boq_versions(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
