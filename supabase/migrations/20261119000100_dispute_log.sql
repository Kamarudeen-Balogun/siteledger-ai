-- Task 8: PM approval and append-only amendments. Existing evidence is preserved.
begin;
alter table public.amendments add column request_id uuid;
create unique index amendments_request_unique on public.amendments(report_id, request_id);

create function public.get_site_report_reviewer(p_id uuid, p_telegram_id bigint) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('name',u.display_name,'role',u.role)
  from public.submissions s join public.telegram_users u on u.project_id=s.project_id
  where s.id=p_id and u.telegram_id=p_telegram_id and (s.telegram_id=p_telegram_id or u.role='pm');
$$;

create function public.approve_site_report(p_id uuid,p_telegram_id bigint,p_document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.submissions%rowtype; r public.reports%rowtype; actor text; current_input jsonb; project_uuid uuid;
begin
  select project_id into project_uuid from public.submissions where id=p_id;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  -- Serialize approvals in the project: a new locked quantity may make another
  -- reviewed draft stale. Keep the existing job -> submission lock order.
  perform 1 from public.projects where id=project_uuid for update;
  perform 1 from public.submission_ai_jobs where submission_id=p_id for update;
  select * into s from public.submissions where id=p_id for update;
  select display_name into actor from public.telegram_users where telegram_id=p_telegram_id and project_id=s.project_id and role='pm';
  if not found then return jsonb_build_object('error','forbidden'); end if;
  select * into r from public.reports where submission_id=p_id for update;
  if not found or r.content_snapshot is null then return jsonb_build_object('error','draft_required'); end if;
  if r.content_snapshot is distinct from p_document then return jsonb_build_object('error','stale'); end if;
  if r.status='locked' then
    return jsonb_build_object('id',r.id,'status','locked','approved_by',r.approved_by,'locked_at',r.locked_at);
  end if;
  perform 1 from public.boq_items where project_id=s.project_id for share;
  current_input := public.get_site_report_input(p_id,p_telegram_id);
  if s.status <> 'confirmed' or s.confirmed_at is null or s.confirmed_by is null then return jsonb_build_object('error','confirmation_required'); end if;
  if (current_input->'source'->>'pending_media')::boolean or (current_input->'source'->>'processing')::boolean then
    return jsonb_build_object('error','pending'); end if;
  if current_input->'source' is distinct from r.content_snapshot->'source' then return jsonb_build_object('error','stale'); end if;
  if not exists(select 1 from public.report_items where report_id=r.id) then return jsonb_build_object('error','empty'); end if;
  if (r.content_snapshot->'costing'->>'total_cost')::numeric is distinct from r.total_cost then
    return jsonb_build_object('error','stale'); end if;
  -- Existing triggers verify the exact item total and lock the submission and
  -- its child evidence in the same transaction. Do not rewrite the snapshot.
  update public.reports set status='locked',approved_by=actor,locked_at=clock_timestamp() where id=r.id
    returning * into r;
  return jsonb_build_object('id',r.id,'status','locked','approved_by',r.approved_by,'locked_at',r.locked_at);
end;
$$;

create function public.append_site_amendment(p_id uuid,p_telegram_id bigint,p_note text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; actor text; a public.amendments%rowtype;
begin
  if p_request_id is null or p_note is null or length(btrim(p_note)) not between 1 and 5000 then
    return jsonb_build_object('error','invalid_note'); end if;
  if public.get_site_report_reviewer(p_id,p_telegram_id) is null then return jsonb_build_object('error','unavailable'); end if;
  select * into r from public.reports where submission_id=p_id for update;
  if not found or r.status <> 'locked' then return jsonb_build_object('error','locked_required'); end if;
  select display_name into actor from public.telegram_users where telegram_id=p_telegram_id and project_id=r.project_id;
  select * into a from public.amendments where report_id=r.id and request_id=p_request_id;
  if found then
    if a.note is distinct from btrim(p_note) or a.author is distinct from actor then return jsonb_build_object('error','request_conflict'); end if;
  else
    insert into public.amendments(report_id,author,note,request_id,created_at)
      values(r.id,actor,btrim(p_note),p_request_id,greatest(clock_timestamp(),r.locked_at + interval '1 microsecond')) returning * into a;
  end if;
  return jsonb_build_object('id',a.id,'report_id',a.report_id,'author',a.author,'note',a.note,'created_at',a.created_at);
end;
$$;

create function public.assemble_dispute_log(p_project_id uuid,p_telegram_id bigint,p_demo boolean) returns jsonb
language sql security definer set search_path = '' as $$
  with visible as (
    select r.* from public.reports r join public.submissions s on s.id=r.submission_id join public.projects p on p.id=r.project_id
    where r.project_id=p_project_id and r.status='locked' and (
      (not p_demo and exists(select 1 from public.telegram_users u where u.telegram_id=p_telegram_id and u.project_id=p.id
        and (u.role='pm' or s.telegram_id=p_telegram_id)))
      or (p_demo and p.is_demo and p.project_code='LEKKI-DEMO-01' and s.telegram_id is null and exists(
        select 1 from generate_series(1,12) n where r.id=('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
        and s.id=('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid))
    )
  ), entries as (
    select r.locked_at as event_time,r.id as event_id,jsonb_build_object('kind','report','id',r.id,'report_id',r.id,
      'submission_id',r.submission_id,'date',r.date,'timestamp',r.locked_at,'author',r.approved_by,
      'total_cost',r.total_cost::text,'currency',coalesce(r.content_snapshot->>'currency','NGN')) as entry from visible r
    union all
    select a.created_at,a.id,jsonb_build_object('kind','amendment','id',a.id,'report_id',r.id,'submission_id',r.submission_id,
      'date',r.date,'timestamp',a.created_at,'author',a.author,'note',a.note)
      from public.amendments a join visible r on r.id=a.report_id
      where not p_demo or a.id='60000000-0000-4000-8000-000000000001'
  )
  select jsonb_build_object('project',jsonb_build_object('id',p.id,'name',p.name),'is_demo',p_demo,
    'entries',coalesce((select jsonb_agg(entry order by event_time,event_id) from entries),'[]'::jsonb))
  from public.projects p where p.id=p_project_id;
$$;

create function public.get_site_dispute_log(p_id uuid,p_telegram_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare project_uuid uuid;
begin
  if public.get_site_report_reviewer(p_id,p_telegram_id) is null then return null; end if;
  select project_id into project_uuid from public.submissions where id=p_id;
  return public.assemble_dispute_log(project_uuid,p_telegram_id,false);
end;
$$;

create function public.get_demo_dispute_log() returns jsonb
language sql security definer set search_path = '' as $$
  select public.assemble_dispute_log(id,null,true) from public.projects where project_code='LEKKI-DEMO-01' and is_demo;
$$;

revoke all on function public.get_site_report_reviewer(uuid,bigint),public.approve_site_report(uuid,bigint,jsonb),
  public.append_site_amendment(uuid,bigint,text,uuid),public.assemble_dispute_log(uuid,bigint,boolean),
  public.get_site_dispute_log(uuid,bigint),public.get_demo_dispute_log() from public,anon,authenticated;
grant execute on function public.get_site_report_reviewer(uuid,bigint),public.approve_site_report(uuid,bigint,jsonb),
  public.append_site_amendment(uuid,bigint,text,uuid),public.get_site_dispute_log(uuid,bigint),public.get_demo_dispute_log() to service_role;
notify pgrst, 'reload schema';
commit;
