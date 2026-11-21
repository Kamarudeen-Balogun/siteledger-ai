-- Task 10A current membership and immutable professional attribution.
-- Parent reports, amendments and original media are never rewritten.
begin;
create table public.account_submission_people (
  submission_id uuid primary key references public.submissions(id) on delete restrict,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  role text not null check (role in ('foreman','pm')),
  name text not null,
  currency text not null,
  timezone text not null,
  site_date date not null,
  received_at timestamptz not null default clock_timestamp()
);
create table public.account_confirmations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  role text not null check (role in ('foreman','pm')),
  name text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.account_approvals (
  report_id uuid primary key references public.reports(id) on delete restrict,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  role text not null check (role='pm'),
  name text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.account_amendment_people (
  amendment_id uuid primary key references public.amendments(id) on delete restrict,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  role text not null check (role in ('foreman','pm')),
  name text not null,
  currency text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.account_legacy_report_sources (
  report_id uuid primary key references public.reports(id) on delete restrict,
  source jsonb not null,
  preserved_at timestamptz not null default clock_timestamp()
);
-- Freeze the existing displayed inputs for legacy locked documents that predate
-- content_snapshot. Later BoQ edits/backdated work cannot reprice their history.
insert into public.account_legacy_report_sources(report_id,source)
  select r.id,public.assemble_report_input(r.submission_id)->'source' from public.reports r where r.status='locked' and r.content_snapshot is null;
create function public.account_submission_project_guard() returns trigger language plpgsql set search_path='' as $$
begin if new.project_id is distinct from old.project_id then raise exception 'Captured submissions cannot change project'; end if; return new; end; $$;
create trigger account_submission_fixed_project before update of project_id on public.submissions for each row execute function public.account_submission_project_guard();
do $$ declare tab text; begin
  foreach tab in array array['account_submission_people','account_confirmations','account_approvals','account_amendment_people','account_legacy_report_sources'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',tab);
    execute format('create trigger account_record_append_only before update or delete on public.%I for each row execute function public.account_append_only()',tab);
  end loop;
end $$;

create function public.account_record_access(p_hash text,p_id uuid,p_write boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; project uuid; person uuid;
begin
  select s.project_id,coalesce(sp.profile_id,l.profile_id) into project,person from public.submissions s
    left join public.account_submission_people sp on sp.submission_id=s.id
    left join public.account_legacy_actors l on l.telegram_id=s.telegram_id where s.id=p_id;
  if not found then return null; end if;
  actor := public.account_project_access(p_hash,project,p_write);
  if actor is null or actor ? 'error' then return actor; end if;
  if actor->>'role'<>'pm' and public.account_person(person) is distinct from (actor->>'profile_id')::uuid then return null; end if;
  return actor || jsonb_build_object('submission_id',p_id);
end; $$;

create function public.account_review(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; s public.submissions%rowtype;
begin
  actor := public.account_record_access(p_hash,p_id);
  if actor is null then return null; end if;
  select * into s from public.submissions where id=p_id;
  return jsonb_build_object('id',s.id,'project_id',s.project_id,'project_name',(select name from public.projects where id=s.project_id),
    'submitted_by',s.submitted_by,'actor',actor->>'professional_name','actor_role',actor->>'role','timezone',actor->>'timezone','currency',actor->>'currency',
    'archived_at',actor->>'archived_at','created_at',s.created_at,'status',s.status,'transcript',s.transcript,
    'extraction',s.extraction,'confirmed_extraction',s.confirmed_extraction,'confirmed_boq_ids',s.confirmed_boq_ids,
    'confirmed_by',s.confirmed_by,'confirmed_at',s.confirmed_at,'audio_url',s.audio_url,
    'job_status',(select status from public.submission_ai_jobs where submission_id=s.id),
    'pending_media',exists(select 1 from public.telegram_updates where submission_id=s.id and status='pending'),
    'pending_photo_analysis',exists(select 1 from public.photo_analysis_jobs j join public.submission_photos p on p.id=j.photo_id where p.submission_id=s.id and j.status in ('queued','processing')),
    'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'storage_url',p.storage_url,'ai_findings',p.ai_findings,'confirmed_findings',p.confirmed_findings,'analysis_status',j.status) order by p.created_at,p.id),'[]'::jsonb)
      from public.submission_photos p left join public.photo_analysis_jobs j on j.photo_id=p.id where p.submission_id=s.id),
    'boq',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,'unit',unit,'section',section,'item_code',item_code) order by item_code),'[]'::jsonb) from public.boq_items where project_id=s.project_id));
end; $$;

create function public.account_assemble_report(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare input jsonb; r public.reports%rowtype; s public.submissions%rowtype; people public.account_submission_people%rowtype;
  confirmation public.account_confirmations%rowtype; source jsonb; currency text; timezone text;
begin
  input := public.assemble_report_input(p_id);
  if input is null then return null; end if;
  select * into r from public.reports where submission_id=p_id;
  if r.status='locked' then
    if r.content_snapshot is not null then return input; end if;
    select legacy.source into source from public.account_legacy_report_sources legacy where legacy.report_id=r.id;
    if found then return jsonb_set(input,'{source}',source); end if;
    return input;
  end if;
  select * into s from public.submissions where id=p_id;
  select * into people from public.account_submission_people where submission_id=p_id;
  select * into confirmation from public.account_confirmations where submission_id=p_id order by created_at desc,id desc limit 1;
  select p.currency,p.timezone into currency,timezone from public.account_projects p where p.project_id=s.project_id;
  source := input->'source';
  source := jsonb_set(source,'{project}',source->'project'||jsonb_build_object('currency',coalesce(people.currency,currency,'NGN'),'timezone',coalesce(people.timezone,timezone,'Africa/Lagos')));
  source := source || jsonb_build_object('date',coalesce(r.date,people.site_date,s.site_date),'submitted_profile_id',people.profile_id,'submitted_role',people.role,
    'confirmed_profile_id',confirmation.profile_id,'confirmed_role',confirmation.role,'received_at',people.received_at);
  return jsonb_set(input,'{source}',source);
end; $$;

create function public.account_report_input(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin if public.account_record_access(p_hash,p_id) is null then return null; end if; return public.account_assemble_report(p_id); end; $$;

create function public.account_project_history(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null then return null; end if;
  return jsonb_build_object('access',actor,
    'project',(select jsonb_build_object('id',id,'name',name,'client',client,'location',location,'project_code',project_code,'contract_sum',contract_sum::text) from public.projects where id=p_project),
    'submissions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'date',coalesce(sp.site_date,s.site_date),'submitted_by',s.submitted_by,'status',s.status,'report_id',r.id,'report_status',r.status) order by s.created_at desc,s.id),'[]'::jsonb)
      from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id left join public.reports r on r.submission_id=s.id
      where s.project_id=p_project and (actor->>'role'='pm' or public.account_person(coalesce(sp.profile_id,l.profile_id))=(actor->>'profile_id')::uuid)),
    'transfers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at) order by created_at desc),'[]'::jsonb) from public.account_owner_transfers
      where project_id=p_project and accepted_at is null and expires_at>clock_timestamp() and public.account_person(target_profile_id)=(actor->>'profile_id')::uuid));
end; $$;

-- Public demonstration uses only the original fictional seed and preserved source.
create or replace function public.get_demo_report_input() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.reports r join public.submissions s on s.id=r.submission_id join public.projects p on p.id=r.project_id
    where r.id='40000000-0000-4000-8000-000000000004' and r.submission_id='30000000-0000-4000-8000-000000000004'
      and p.project_code='LEKKI-DEMO-01' and p.is_demo and s.telegram_id is null and r.status='locked'
      and (r.content_snapshot is not null or exists(select 1 from public.account_legacy_report_sources frozen where frozen.report_id=r.id))) then return null; end if;
  return public.account_assemble_report('30000000-0000-4000-8000-000000000004');
end; $$;

-- Confirmation and draft/approval operations follow in the same scoped module.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'account_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.signature::text !~ 'account_(append_only|owner_guard|project_money_guard|submission_project_guard|signup_hook|assemble_report)' then execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
