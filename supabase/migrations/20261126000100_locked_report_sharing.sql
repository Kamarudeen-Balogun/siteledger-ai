begin;

create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports(id),
  created_by uuid not null references public.account_profiles(id),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.report_shares enable row level security;
revoke all on public.report_shares from anon,authenticated;

create function public.account_report_share(p_hash text,p_submission uuid,p_enable boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; report uuid; share uuid;
begin
  actor:=public.account_record_access(p_hash,p_submission);
  if actor is null or not coalesce((actor->'permissions'->>'approve_lock')::boolean and (actor->'permissions'->>'view_reports')::boolean,actor->>'role'='pm') then return null; end if;
  select id into report from public.reports where submission_id=p_submission and status='locked';
  if report is null then return null; end if;
  if p_enable is true then
    insert into public.report_shares(report_id,created_by) values(report,(actor->>'profile_id')::uuid)
      on conflict(report_id) do nothing;
  elsif p_enable is false then
    delete from public.report_shares where report_id=report;
  end if;
  select id into share from public.report_shares where report_id=report;
  return jsonb_build_object('share_id',share);
end; $$;

create function public.shared_locked_report(p_share uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.account_assemble_report(r.submission_id)
  from public.report_shares s join public.reports r on r.id=s.report_id
  where s.id=p_share and r.status='locked';
$$;

revoke all on function public.account_report_share(text,uuid,boolean),public.shared_locked_report(uuid) from public,anon,authenticated;
grant execute on function public.account_report_share(text,uuid,boolean),public.shared_locked_report(uuid) to service_role;
notify pgrst,'reload schema';
commit;
