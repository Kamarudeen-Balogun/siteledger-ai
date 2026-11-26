begin;
create table public.project_boq_versions (
  project_id uuid not null references public.account_projects(project_id),
  version integer not null check (version>0),
  effective_date date not null,
  created_at timestamptz not null default clock_timestamp(),
  rows jsonb not null,
  primary key(project_id,version)
);
alter table public.project_boq_versions enable row level security;
revoke all on public.project_boq_versions from public,anon,authenticated;
create trigger project_boq_versions_no_edit before update or delete on public.project_boq_versions for each row execute function public.account_append_only();

create function public.capture_project_boq_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare project uuid; next integer; zone text;
begin
  if NEW.action not in ('boq_item_added','boq_item_updated') then return NEW; end if;
  project:=NEW.project_id;
  select timezone into zone from public.account_projects where project_id=project;
  select coalesce(max(version),0)+1 into next from public.project_boq_versions where project_id=project;
  insert into public.project_boq_versions(project_id,version,effective_date,rows)
    select project,next,(clock_timestamp() at time zone zone)::date,coalesce(jsonb_agg(to_jsonb(b) order by item_code,id),'[]'::jsonb)
    from public.boq_items b where b.project_id=project and b.retired_at is null;
  return NEW;
end; $$;
create trigger project_boq_version_after_change after insert on public.account_project_events for each row execute function public.capture_project_boq_version();

create function public.account_boq_versions(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if public.account_project_access(p_hash,p_project) is null then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('version',version,'effective_date',effective_date) order by version desc),'[]'::jsonb)
    from (select version,effective_date from public.project_boq_versions where project_id=p_project order by version desc limit 50) v);
end; $$;

create function public.account_retire_boq_item(p_hash text,p_project uuid,p_item uuid,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; prior public.boq_items%rowtype; current public.boq_items%rowtype;
begin
  perform 1 from public.account_projects where project_id=p_project for update;
  actor:=public.account_project_access(p_hash,p_project,true);
  if actor is null or not public.account_has_project_permission(actor,'edit_boq') then return null; end if;
  select * into prior from public.boq_items where id=p_item and project_id=p_project for update;
  if not found then return null; end if;
  if prior.retired_at is not null then return jsonb_build_object('retired',true); end if;
  if md5(to_jsonb(prior)::text) is distinct from p_revision then return jsonb_build_object('error','stale'); end if;
  update public.boq_items set retired_at=clock_timestamp() where id=p_item returning * into current;
  insert into public.account_project_events(project_id,actor_profile_id,action,details)
    values(p_project,(actor->>'profile_id')::uuid,'boq_item_updated',jsonb_build_object('item_id',p_item,'currency',actor->>'currency','before',to_jsonb(prior),'after',to_jsonb(current)));
  return jsonb_build_object('retired',true);
end; $$;

create or replace function public.account_assemble_report(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare input jsonb; r public.reports%rowtype; s public.submissions%rowtype; people public.account_submission_people%rowtype;
  confirmation public.account_confirmations%rowtype; source jsonb; currency text; timezone text; boq_version integer;
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
  select max(version) into boq_version from public.project_boq_versions where project_id=s.project_id;
  if boq_version is not null then
    source:=source||jsonb_build_object('boq_version',boq_version);
    source:=jsonb_set(source,'{price_list}',(select coalesce(jsonb_agg(prices.price order by prices.position),'[]'::jsonb)
      from jsonb_array_elements(source->'price_list') with ordinality prices(price,position)
      join public.boq_items item on item.id=(prices.price->>'id')::uuid and item.retired_at is null));
  end if;
  source := jsonb_set(source,'{project}',source->'project'||jsonb_build_object('currency',coalesce(people.currency,currency,'NGN'),'timezone',coalesce(people.timezone,timezone,'Africa/Lagos')));
  source := source || jsonb_build_object('date',coalesce(r.date,people.site_date,s.site_date),'submitted_profile_id',people.profile_id,'submitted_role',people.role,
    'confirmed_profile_id',confirmation.profile_id,'confirmed_role',confirmation.role,'received_at',people.received_at);
  return jsonb_set(input,'{source}',source);
end; $$;

revoke all on function public.capture_project_boq_version(),public.account_boq_versions(text,uuid),public.account_retire_boq_item(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.account_boq_versions(text,uuid),public.account_retire_boq_item(text,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
