begin;

alter table public.account_memberships add column role_label text, add column permissions jsonb;
alter table public.account_invitations add column role_label text;
alter table public.boq_items add column retired_at timestamptz;
create table public.account_project_roles (
  project_id uuid not null references public.account_projects(project_id),
  label text not null check(length(label) between 1 and 40),
  primary key(project_id,label)
);
alter table public.account_project_roles enable row level security;
revoke all on public.account_project_roles from public,anon,authenticated;

create function public.account_project_permissions(p_role text,p_owner boolean,p_permissions jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select case
    when p_owner then '{"view_reports":true,"record_notes":true,"edit_boq":true,"approve_lock":true,"invite_members":true}'::jsonb
    when p_permissions is not null then p_permissions
    else jsonb_build_object('view_reports',true,'record_notes',true,'edit_boq',p_role='pm','approve_lock',p_role='pm','invite_members',false)
  end;
$$;

create function public.account_project_role_defaults(p_label text) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('view_reports',true,'record_notes',p_label in ('PM/QS','Foreman','Site Engineer'),
    'edit_boq',p_label='PM/QS','approve_lock',p_label='PM/QS','invite_members',false);
$$;

create function public.account_has_project_permission(p_actor jsonb,p_permission text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce((p_actor->'permissions'->>p_permission)::boolean,false);
$$;

create or replace function public.account_project_access(p_hash text,p_project uuid,p_write boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; m public.account_memberships%rowtype; p public.account_projects%rowtype;
begin
  actor := public.account_session(p_hash);
  if actor is null or actor->>'name_confirmed_at' is null then return null; end if;
  select * into p from public.account_projects where project_id=p_project for share;
  if not found then return null; end if;
  select * into m from public.account_memberships where project_id=p_project and active
    and public.account_person(profile_id)=(actor->>'profile_id')::uuid order by (profile_id=(actor->>'profile_id')::uuid) desc,(role='pm') desc,created_at,id limit 1 for share;
  if not found then return null; end if;
  if p_write and p.archived_at is not null then return jsonb_build_object('error','archived'); end if;
  return actor || jsonb_build_object('project_id',p.project_id,'role',m.role,'membership_id',m.id,'currency',p.currency,'timezone',p.timezone,
    'owner',public.account_person(p.owner_profile_id)=(actor->>'profile_id')::uuid,'archived_at',p.archived_at,
    'role_label',case when public.account_person(p.owner_profile_id)=(actor->>'profile_id')::uuid then 'Owner' else coalesce(m.role_label,case when m.role='pm' then 'PM/QS' else 'Foreman' end) end,
    'permissions',public.account_project_permissions(m.role,public.account_person(p.owner_profile_id)=(actor->>'profile_id')::uuid,m.permissions));
end; $$;

create or replace function public.account_list_projects(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; projects jsonb;
begin
  actor := public.account_session(p_hash);
  if actor is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'client',p.client,'location',p.location,'project_code',p.project_code,
    'contract_sum',p.contract_sum::text,'currency',a.currency,'timezone',a.timezone,'archived_at',a.archived_at,'role',m.role,
    'owner',public.account_person(a.owner_profile_id)=(actor->>'profile_id')::uuid,'role_label',case when public.account_person(a.owner_profile_id)=(actor->>'profile_id')::uuid then 'Owner' else coalesce(m.role_label,case when m.role='pm' then 'PM/QS' else 'Foreman' end) end,
    'permissions',public.account_project_permissions(m.role,public.account_person(a.owner_profile_id)=(actor->>'profile_id')::uuid,m.permissions)) order by p.created_at desc,p.id),'[]'::jsonb)
  into projects from public.projects p join public.account_projects a on a.project_id=p.id
    join lateral (select role,role_label,permissions from public.account_memberships m where m.project_id=p.id and m.active and public.account_person(m.profile_id)=(actor->>'profile_id')::uuid order by (m.profile_id=(actor->>'profile_id')::uuid) desc,(role='pm') desc,m.created_at,m.id limit 1) m on true;
  return jsonb_build_object('account',actor,'projects',projects,'active_project_id',(select s.active_project_id from public.account_sessions s where s.secret_hash=p_hash and projects @> jsonb_build_array(jsonb_build_object('id',s.active_project_id))));
end; $$;

create or replace function public.account_record_access(p_hash text,p_id uuid,p_write boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; project uuid; person uuid; own_record boolean; has_report boolean; can_record boolean;
begin
  select s.project_id,coalesce(sp.profile_id,l.profile_id) into project,person from public.submissions s
    left join public.account_submission_people sp on sp.submission_id=s.id
    left join public.account_legacy_actors l on l.telegram_id=s.telegram_id where s.id=p_id;
  if not found then return null; end if;
  actor := public.account_project_access(p_hash,project,p_write);
  if actor is null or actor ? 'error' then return actor; end if;
  own_record:=public.account_person(person) is not distinct from (actor->>'profile_id')::uuid;
  can_record:=public.account_has_project_permission(actor,'record_notes') and (own_record or public.account_has_project_permission(actor,'approve_lock'));
  has_report:=public.account_has_project_permission(actor,'view_reports') and exists(
    select 1 from public.reports where submission_id=p_id and status='locked');
  if not (can_record or has_report) then return null; end if;
  return actor || jsonb_build_object('submission_id',p_id,'can_review',can_record,'can_view_report',public.account_has_project_permission(actor,'view_reports'));
end; $$;

create or replace function public.account_project_history(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null then return null; end if;
  return jsonb_build_object('access',actor,
    'project',(select jsonb_build_object('id',id,'name',name,'client',client,'location',location,'project_code',project_code,'contract_sum',contract_sum::text) from public.projects where id=p_project),
    'submissions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'date',coalesce(sp.site_date,s.site_date),'captured_at',s.created_at,'total_cost',r.total_cost::text,'summary_items',(select coalesce(jsonb_agg(i.description order by i.id),'[]'::jsonb) from public.report_items i where i.report_id=r.id),'submitted_by',s.submitted_by,'status',s.status,'report_id',r.id,'report_status',r.status) order by s.created_at desc,s.id),'[]'::jsonb)
      from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id left join public.reports r on r.submission_id=s.id
      where s.project_id=p_project and ((public.account_has_project_permission(actor,'view_reports') and r.status='locked') or
        (public.account_has_project_permission(actor,'record_notes') and (public.account_has_project_permission(actor,'approve_lock') or public.account_person(coalesce(sp.profile_id,l.profile_id))=(actor->>'profile_id')::uuid)))),
    'transfers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at) order by created_at desc),'[]'::jsonb) from public.account_owner_transfers
      where project_id=p_project and accepted_at is null and expires_at>clock_timestamp() and public.account_person(target_profile_id)=(actor->>'profile_id')::uuid));
end; $$;

create or replace function public.account_dashboard_input(p_hash text,p_project uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor jsonb; notes uuid[];
begin
 actor:=public.account_project_access(p_hash,p_project); if actor is null then return null; end if;
 select coalesce(array_agg(s.id),'{}'::uuid[]) into notes from public.submissions s
 join public.reports r on r.submission_id=s.id
 left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
 where s.project_id=p_project and public.account_has_project_permission(actor,'view_reports')
   and (r.status='locked' or (public.account_has_project_permission(actor,'record_notes') and
     (public.account_has_project_permission(actor,'approve_lock') or public.account_person(coalesce(sp.profile_id,l.profile_id))=(actor->>'profile_id')::uuid)));
 return jsonb_build_object('access',actor,'as_of',clock_timestamp(),
  'project',(select jsonb_build_object('id',id,'name',name,'client',client,'location',location,'contract_sum',contract_sum::text,'is_demo',is_demo or exists(select 1 from public.trial_sessions t where t.project_id=p_project and t.claimed_at is not null)) from public.projects where id=p_project),
  'boq',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'item_code',b.item_code,'section',b.section,'description',b.description,'unit',b.unit,'boq_quantity',b.boq_quantity::text,'rate',b.rate::text,'revision',md5(to_jsonb(b)::text),'used',
    exists(select 1 from public.report_items where boq_item_id=b.id) or exists(select 1 from public.submissions where project_id=p_project and confirmed_boq_ids ? b.id::text)) order by b.section,b.item_code,b.id),'[]'::jsonb) from public.boq_items b where b.project_id=p_project and b.retired_at is null),
  'locked_count',(select count(*) from public.reports where submission_id=any(notes) and status='locked'),
  'draft_count',(select count(*) from public.reports where submission_id=any(notes) and status='draft'),
  'locked_items',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'boq_item_id',i.boq_item_id,'quantity',i.quantity_done::text,'rate',i.rate_snapshot::text,'unit',i.unit_snapshot,'confirmed_by',i.confirmed_by,'currency',coalesce(r.content_snapshot->>'currency',sp.currency,actor->>'currency')) order by r.date,i.id),'[]'::jsonb)
    from public.report_items i join public.reports r on r.id=i.report_id left join public.account_submission_people sp on sp.submission_id=r.submission_id
    where r.project_id=p_project and r.status='locked' and r.submission_id=any(notes)));
end; $$;

create or replace function public.account_approve(p_hash text,p_id uuid,p_document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; s public.submissions%rowtype; r public.reports%rowtype; actor text; current_input jsonb; project_uuid uuid;
begin
  select project_id into project_uuid from public.submissions where id=p_id;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  -- Serialize approvals in the project: a new locked quantity may make another
  -- reviewed draft stale. Keep the existing job -> submission lock order.
  perform 1 from public.projects where id=project_uuid for update;
  perform 1 from public.submission_ai_jobs where submission_id=p_id for update;
  select * into s from public.submissions where id=p_id for update;
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null then return jsonb_build_object('error','unavailable'); end if;
  if ctx ? 'error' then return ctx; end if;
  if not (public.account_has_project_permission(ctx,'approve_lock') and public.account_has_project_permission(ctx,'view_reports')) then return jsonb_build_object('error','forbidden'); end if;
  actor := ctx->>'professional_name';
  select * into r from public.reports where submission_id=p_id for update;
  if not found or r.content_snapshot is null then return jsonb_build_object('error','draft_required'); end if;
  if r.content_snapshot is distinct from p_document then return jsonb_build_object('error','stale'); end if;
  if r.status='locked' then
    return jsonb_build_object('id',r.id,'status','locked','approved_by',r.approved_by,'locked_at',r.locked_at);
  end if;
  perform 1 from public.boq_items where project_id=s.project_id for share;
  current_input := public.account_report_input(p_hash,p_id);
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
  insert into public.account_approvals(report_id,profile_id,role,name,created_at) values(r.id,(ctx->>'profile_id')::uuid,'pm',actor,r.locked_at);
  return jsonb_build_object('id',r.id,'status','locked','approved_by',r.approved_by,'locked_at',r.locked_at);
end;
$$;

create or replace function public.account_review(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; s public.submissions%rowtype; result jsonb; trial public.trial_sessions%rowtype; ids jsonb;
begin
  actor := public.account_record_access(p_hash,p_id);
  if actor is null or not coalesce((actor->>'can_review')::boolean,false) then return null; end if;
  select * into s from public.submissions where id=p_id;
  result:=jsonb_build_object('id',s.id,'project_id',s.project_id,'project_name',(select name from public.projects where id=s.project_id),
    'submitted_by',s.submitted_by,'actor',actor->>'professional_name','actor_role',actor->>'role','timezone',actor->>'timezone','currency',actor->>'currency',
    'archived_at',actor->>'archived_at','created_at',s.created_at,'status',s.status,'transcript',s.transcript,
    'extraction',s.extraction,'confirmed_extraction',s.confirmed_extraction,'confirmed_boq_ids',s.confirmed_boq_ids,
    'confirmed_by',s.confirmed_by,'confirmed_at',s.confirmed_at,'audio_url',s.audio_url,
    'job_status',(select status from public.submission_ai_jobs where submission_id=s.id),
    'pending_media',exists(select 1 from public.telegram_updates where submission_id=s.id and status='pending'),
    'pending_photo_analysis',exists(select 1 from public.photo_analysis_jobs j join public.submission_photos p on p.id=j.photo_id where p.submission_id=s.id and j.status in ('queued','processing')),
    'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'storage_url',p.storage_url,'ai_findings',p.ai_findings,'confirmed_findings',p.confirmed_findings,'analysis_status',j.status) order by p.created_at,p.id),'[]'::jsonb)
      from public.submission_photos p left join public.photo_analysis_jobs j on j.photo_id=p.id where p.submission_id=s.id),
    'boq',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,'unit',unit,'section',section,'item_code',item_code) order by item_code),'[]'::jsonb) from public.boq_items where project_id=s.project_id and retired_at is null));
select * into trial from public.trial_sessions where note_id=p_id and claimed_at is not null;
 if found then
  select coalesce(jsonb_agg(b.id order by x.ordinality),'[]'::jsonb) into ids from jsonb_array_elements_text(trial.confirmed_boq_ids) with ordinality x(id,ordinality) join public.trial_prices t on t.id=x.id::uuid join public.boq_items b on b.project_id=trial.project_id and b.item_code=t.item_code;
  result:=result||jsonb_build_object('guest_origin',public.trial_origin(p_id),'trial_values',trial.confirmed_values,'trial_boq_ids',ids);
 end if; return result;
end; $$;

create or replace function public.account_confirm(p_hash text, p_id uuid, p_values jsonb,
  p_boq_ids jsonb, p_photo_notes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; s public.submissions%rowtype; actor text; actor_role text; item jsonb; chosen public.boq_items%rowtype;
  i integer; job_status text;
begin
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null then return jsonb_build_object('error','unavailable'); end if;
  if ctx ? 'error' then return ctx; end if;
  if not (ctx->>'can_review')::boolean then return jsonb_build_object('error','unavailable'); end if;
  -- Same lock order as the AI worker; confirmation cannot race a running job.
  select status into job_status from public.submission_ai_jobs where submission_id = p_id for update;
  if job_status in ('queued', 'processing') then raise exception 'Wait for voice processing'; end if;
  select * into s from public.submissions where id = p_id for update;
  if not found or s.status = 'locked' then raise exception 'This site note cannot be confirmed'; end if;
  if nullif(s.audio_url,'') is null and not exists(select 1 from public.submission_photos where submission_id=s.id) then return jsonb_build_object('error','media_required'); end if;
  actor := ctx->>'professional_name';
  if exists(select 1 from public.telegram_updates where submission_id = s.id and status = 'pending') then
    raise exception 'Wait for pending evidence'; end if;
  if jsonb_typeof(p_values) <> 'object' or (select count(*) from jsonb_object_keys(p_values)) <> 5
    or not(p_values ?& array['work_items','materials','delays','issues','raw_language_notes'])
    or jsonb_typeof(p_values->'work_items') <> 'array' or jsonb_typeof(p_values->'materials') <> 'array'
    or jsonb_typeof(p_values->'delays') <> 'array' or jsonb_typeof(p_values->'issues') <> 'array'
    or jsonb_typeof(p_values->'raw_language_notes') <> 'string'
    or jsonb_typeof(p_boq_ids) <> 'array' or jsonb_typeof(p_photo_notes) <> 'array' then
    raise exception 'Invalid confirmation shape'; end if;
  if jsonb_array_length(p_values->'work_items') <> jsonb_array_length(p_boq_ids)
    or jsonb_array_length(p_values->'work_items') > 100 then raise exception 'Choose each BoQ item'; end if;
  for item, i in select value, ordinality::integer - 1 from jsonb_array_elements(p_values->'work_items') with ordinality loop
    if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 6
      or not(item ?& array['description','matched_boq_hint','quantity','unit','crew','confidence'])
      or jsonb_typeof(item->'quantity') <> 'number' or (item->>'quantity')::numeric < 0
      or nullif(btrim(item->>'description'), '') is null
      or jsonb_typeof(item->'confidence') <> 'number' or (item->>'confidence')::numeric not between 0 and 1
      or (item->'crew' <> 'null'::jsonb and (jsonb_typeof(item->'crew') <> 'number'
        or (item->>'crew')::numeric <= 0 or (item->>'crew')::numeric <> trunc((item->>'crew')::numeric))) then
      raise exception 'Enter confirmed work quantities'; end if;
    select * into chosen from public.boq_items where id = (p_boq_ids->>i)::uuid and project_id = s.project_id and retired_at is null;
    if not found or jsonb_typeof(item->'unit') <> 'string' or item->>'unit' is null or item->>'unit' <> chosen.unit then raise exception 'Use matching project BoQ units'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_values->'materials') loop
    if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 5
      or not(item ?& array['name','quantity','unit','action','confidence'])
      or jsonb_typeof(item->'quantity') <> 'number' or (item->>'quantity')::numeric < 0
      or nullif(btrim(item->>'name'),'') is null or nullif(btrim(item->>'unit'),'') is null
      or item->>'action' is null or (item->>'action') not in ('delivered','used')
      or jsonb_typeof(item->'confidence') <> 'number' or (item->>'confidence')::numeric not between 0 and 1 then
      raise exception 'Enter confirmed materials'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_values->'delays') loop
    if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 3
      or not(item ?& array['reason','hours','confidence'])
      or jsonb_typeof(item->'hours') <> 'number' or (item->>'hours')::numeric < 0
      or nullif(btrim(item->>'reason'),'') is null
      or jsonb_typeof(item->'confidence') <> 'number' or (item->>'confidence')::numeric not between 0 and 1 then
      raise exception 'Enter confirmed delays'; end if;
  end loop;
  if jsonb_array_length(p_photo_notes) <> (select count(*) from public.submission_photos where submission_id = s.id)
    or (select count(distinct value->>'id') from jsonb_array_elements(p_photo_notes)) <> jsonb_array_length(p_photo_notes) then
    raise exception 'Review each photo'; end if;
  for item in select value from jsonb_array_elements(p_photo_notes) loop
    if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 2
      or jsonb_typeof(item->'note') <> 'string' or length(item->>'note') > 5000
      or not exists(select 1 from public.submission_photos where id = (item->>'id')::uuid and submission_id = s.id) then
      raise exception 'Use this submission photos'; end if;
    update public.submission_photos set confirmed_findings = jsonb_build_object('note', item->>'note') where id = (item->>'id')::uuid;
  end loop;
  update public.submissions set confirmed_extraction = p_values, confirmed_boq_ids = p_boq_ids,
    materials = p_values->'materials', delays = p_values->'delays', issues = p_values->'issues',
    confirmed_by = actor, confirmed_at = now(), status = 'confirmed' where id = s.id;
  insert into public.account_confirmations(submission_id,profile_id,role,name) values(s.id,(ctx->>'profile_id')::uuid,ctx->>'role',actor);
  -- Confirmation records human values; costing remains a separate action.
  return jsonb_build_object('status', 'confirmed', 'confirmed_by', actor, 'confirmed_at', now());
end;
$$;

create or replace function public.account_save_draft(p_hash text,p_id uuid,p_source jsonb,p_document jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; current_input jsonb; s public.submissions%rowtype; report_uuid uuid; row jsonb; cost jsonb;
  n integer; stored_total numeric; chosen public.boq_items%rowtype;
begin
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null or ctx ? 'error' or not (ctx->>'can_review')::boolean then raise exception 'Report access unavailable'; end if;
  perform 1 from public.submission_ai_jobs where submission_id=p_id for update;
  select * into s from public.submissions where id=p_id for update;
  if not found or s.status <> 'confirmed' or s.confirmed_at is null then raise exception 'Human confirmation is required'; end if;
  perform 1 from public.boq_items where project_id=s.project_id for share;
  current_input := public.account_report_input(p_hash,p_id);
  if current_input is null then raise exception 'Report access unavailable'; end if;
  if (current_input->'source') is distinct from p_source or (p_source->>'pending_media')::boolean
    or (p_source->>'processing')::boolean then raise exception 'Report inputs changed; try again'; end if;
  if p_document->'source' is distinct from p_source or p_document->>'currency' is distinct from coalesce(p_source->'project'->>'currency','NGN')
    or nullif(btrim(p_document->>'firm_name'),'') is null
    or length(p_document->>'firm_name') > 200 or length(p_document->>'weather') > 500
    or jsonb_typeof(p_document->'costing'->'items') is distinct from 'array'
    or jsonb_array_length(p_document->'costing'->'items') <> jsonb_array_length(p_source->'items') then
    raise exception 'Invalid report document'; end if;
  select id into report_uuid from public.reports where submission_id=p_id;
  if report_uuid is null then
    insert into public.reports(project_id,submission_id,date) values(s.project_id,s.id,(p_source->>'date')::date)
      returning id into report_uuid;
  end if;
  -- Rebuilding an unlocked draft replaces only its generated item rows. Original
  -- transcript/extraction/photos and every locked record remain untouched.
  delete from public.report_items where report_id=report_uuid;
  for row,n in select value,ordinality::integer-1 from jsonb_array_elements(p_source->'items') with ordinality loop
    cost := p_document->'costing'->'items'->n;
    select * into strict chosen from public.boq_items where id=(row->>'boq_item_id')::uuid and project_id=s.project_id;
    if cost->>'boq_item_id' is distinct from row->>'boq_item_id' or cost->>'unit' is distinct from chosen.unit
      or (cost->>'quantity_done')::numeric is distinct from (row->>'quantity_done')::numeric
      or (cost->>'rate')::numeric is distinct from chosen.rate
      or (cost->>'cost_today')::numeric is distinct from (row->>'quantity_done')::numeric*chosen.rate
      or (row->>'quantity_done')::numeric <> round((row->>'quantity_done')::numeric,4) then
      raise exception 'Costing must match confirmed quantities and BoQ'; end if;
    insert into public.report_items(submission_id,report_id,boq_item_id,description,quantity_done,crew,confidence,confirmed_by,confirmed_at)
      values(s.id,report_uuid,chosen.id,row->>'description',(row->>'quantity_done')::numeric,
        (row->>'crew')::integer,(row->>'confidence')::numeric,s.confirmed_by,s.confirmed_at);
  end loop;
  select coalesce(sum(cost_snapshot),0) into stored_total from public.report_items where report_id=report_uuid;
  if (p_document->'costing'->>'total_cost')::numeric is distinct from stored_total then raise exception 'Report total mismatch'; end if;
  update public.reports set total_cost=stored_total,weather=p_document->>'weather',content_snapshot=p_document where id=report_uuid;
  return report_uuid;
end;
$$;

create or replace function public.account_amend(p_hash text,p_id uuid,p_note text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; r public.reports%rowtype; a public.amendments%rowtype; previous_person uuid;
begin
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null then return jsonb_build_object('error','unavailable'); end if;
  if ctx ? 'error' then return ctx; end if;
  if not (ctx->>'can_review')::boolean then return jsonb_build_object('error','unavailable'); end if;
  if p_request_id is null or p_note is null or length(btrim(p_note)) not between 1 and 5000 then return jsonb_build_object('error','invalid_note'); end if;
  select * into r from public.reports where submission_id=p_id for update;
  if not found or r.status<>'locked' then return jsonb_build_object('error','locked_required'); end if;
  select * into a from public.amendments where report_id=r.id and request_id=p_request_id;
  if found then
    select profile_id into previous_person from public.account_amendment_people where amendment_id=a.id;
    if a.note is distinct from btrim(p_note) or public.account_person(previous_person) is distinct from (ctx->>'profile_id')::uuid then return jsonb_build_object('error','request_conflict'); end if;
  else
    insert into public.amendments(report_id,author,note,request_id,created_at) values(r.id,ctx->>'professional_name',btrim(p_note),p_request_id,greatest(clock_timestamp(),r.locked_at+interval '1 microsecond')) returning * into a;
    insert into public.account_amendment_people(amendment_id,profile_id,role,name,currency,created_at) values(a.id,(ctx->>'profile_id')::uuid,ctx->>'role',a.author,coalesce(r.content_snapshot->>'currency','NGN'),a.created_at);
  end if;
  return jsonb_build_object('id',a.id,'report_id',r.id,'author',a.author,'note',a.note,'created_at',a.created_at);
end; $$;

create or replace function public.account_dispute_log(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb;
begin
  ctx := public.account_record_access(p_hash,p_id);
  if ctx is null or not public.account_has_project_permission(ctx,'view_reports') then return null; end if;
  return jsonb_build_object('project',jsonb_build_object('id',ctx->>'project_id','name',(select name from public.projects where id=(ctx->>'project_id')::uuid)),'is_demo',false,
    'entries',(with visible as (
      select r.* from public.reports r join public.submissions s on s.id=r.submission_id left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
      where r.project_id=(ctx->>'project_id')::uuid and r.status='locked'
    ), entries as (
      select r.locked_at event_time,r.id event_id,jsonb_build_object('kind','report','id',r.id,'report_id',r.id,'submission_id',r.submission_id,'date',r.date,'timestamp',r.locked_at,'author',r.approved_by,'total_cost',r.total_cost::text,'currency',coalesce(r.content_snapshot->>'currency','NGN'),'timezone',coalesce(r.content_snapshot->'source'->'project'->>'timezone','Africa/Lagos')) entry from visible r
      union all select a.created_at,a.id,jsonb_build_object('kind','amendment','id',a.id,'report_id',r.id,'submission_id',r.submission_id,'date',r.date,'timestamp',a.created_at,'author',a.author,'note',a.note,'currency',coalesce(r.content_snapshot->>'currency','NGN'),'timezone',coalesce(r.content_snapshot->'source'->'project'->>'timezone','Africa/Lagos')) from public.amendments a join visible r on r.id=a.report_id
    ) select coalesce(jsonb_agg(entry order by event_time desc,event_id),'[]'::jsonb) from entries));
end; $$;

create or replace function public.account_boq_save(p_hash text,p_project uuid,p_item jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor jsonb; item public.boq_items%rowtype; identifier uuid; qty numeric; supplied_rate numeric; is_new boolean;
begin
 perform 1 from public.account_projects where project_id=p_project for update;
 actor:=public.account_project_access(p_hash,p_project,true);
 if actor is null then return null; end if; if actor ? 'error' then return actor; end if; if not public.account_has_project_permission(actor,'edit_boq') then return null; end if;
 if jsonb_typeof(p_item) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_item))<>8 or not(p_item ?& array['id','revision','item_code','section','description','unit','boq_quantity','rate']) then return jsonb_build_object('error','invalid'); end if;
 if p_item->>'id' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' or (p_item->'revision'<>'null'::jsonb and p_item->>'revision' !~ '^[a-f0-9]{32}$')
  or p_item->>'unit' not in ('m3','m2','tonne','point','day') or coalesce(p_item->>'boq_quantity','') !~ '^[0-9]{1,10}(\.[0-9]{1,4})?$' or coalesce(p_item->>'rate','') !~ '^[0-9]+(\.[0-9]+)?$' or length(p_item->>'rate')>40
  or exists(select 1 from unnest(array[p_item->>'item_code',p_item->>'section',p_item->>'description']) value where nullif(btrim(value),'') is null or length(value)>200 or value ~ '[[:cntrl:]]') then return jsonb_build_object('error','invalid'); end if;
 identifier:=(p_item->>'id')::uuid; qty:=(p_item->>'boq_quantity')::numeric; supplied_rate:=(p_item->>'rate')::numeric;
 if qty<=0 or qty>=10000000000 then return jsonb_build_object('error','invalid'); end if;
 select * into item from public.boq_items where id=identifier for update; is_new:=not found;
 if not is_new then
  if item.project_id<>p_project then return null; end if;
  if item.retired_at is not null then return jsonb_build_object('error','stale'); end if;
  if item.item_code=btrim(p_item->>'item_code') and item.section=btrim(p_item->>'section') and item.description=btrim(p_item->>'description') and item.unit=p_item->>'unit' and item.boq_quantity=qty and item.rate=supplied_rate then return jsonb_build_object('id',item.id,'already_saved',true); end if;
  if p_item->>'revision' is distinct from md5(to_jsonb(item)::text) then return jsonb_build_object('error','stale'); end if;
  if item.unit<>p_item->>'unit' and (exists(select 1 from public.report_items where boq_item_id=item.id) or exists(select 1 from public.submissions where project_id=p_project and confirmed_boq_ids ? item.id::text)) then return jsonb_build_object('error','unit_in_use'); end if;
 else
  if p_item->'revision' is distinct from 'null'::jsonb then return jsonb_build_object('error','stale'); end if;
 end if;
 if exists(select 1 from public.boq_items where project_id=p_project and item_code=btrim(p_item->>'item_code') and id<>identifier) then return jsonb_build_object('error','duplicate_code'); end if;
 if is_new then
  insert into public.boq_items(id,project_id,item_code,section,description,unit,boq_quantity,rate) values(identifier,p_project,btrim(p_item->>'item_code'),btrim(p_item->>'section'),btrim(p_item->>'description'),p_item->>'unit',qty,supplied_rate);
 else
  update public.boq_items set item_code=btrim(p_item->>'item_code'),section=btrim(p_item->>'section'),description=btrim(p_item->>'description'),unit=p_item->>'unit',boq_quantity=qty,rate=supplied_rate where id=identifier;
 end if;
 insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,case when is_new then 'boq_item_added' else 'boq_item_updated' end,jsonb_build_object('item_id',identifier,'currency',actor->>'currency','before',case when is_new then null else to_jsonb(item) end,'after',(select to_jsonb(b) from public.boq_items b where id=identifier)));
 return jsonb_build_object('id',identifier);
end; $$;

create or replace function public.account_boq_import(p_hash text,p_project uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; item jsonb; result jsonb; failure jsonb; row_number integer:=0; saved integer:=0;
begin
 perform 1 from public.account_projects where project_id=p_project for update;
 actor:=public.account_project_access(p_hash,p_project,true);
 if actor is null then return null; end if;
 if actor ? 'error' then return actor; end if;
 if not public.account_has_project_permission(actor,'edit_boq') then return null; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then return jsonb_build_object('error','invalid'); end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then return jsonb_build_object('error','invalid'); end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items)
 or (select count(distinct btrim(value->>'item_code')) from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then return jsonb_build_object('error','invalid'); end if;
 -- The subtransaction rolls back both rows and audit entries on any failure.
 begin
  for item in select value from jsonb_array_elements(p_items) loop
   row_number:=row_number+1;
   if item->'revision' is distinct from 'null'::jsonb then failure:=jsonb_build_object('error','invalid'); raise sqlstate 'P0002'; end if;
   result:=public.account_boq_save(p_hash,p_project,item);
   if result is null or result ? 'error' then failure:=coalesce(result,jsonb_build_object('error','unavailable')); raise sqlstate 'P0002'; end if;
   if not coalesce((result->>'already_saved')::boolean,false) then saved:=saved+1; end if;
  end loop;
 exception when sqlstate 'P0002' then return failure||jsonb_build_object('row',row_number);
 end;
 return jsonb_build_object('saved',saved,'already_saved',saved=0);
end; $$;

create or replace function public.account_boq_history(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
 actor:=public.account_project_access(p_hash,p_project);
 if actor is null or not public.account_has_project_permission(actor,'edit_boq') then return null; end if;
 return (select coalesce(jsonb_agg(entry order by created_at desc,id desc),'[]'::jsonb) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'timestamp',e.created_at,'action',e.action,
    'actor',coalesce(p.professional_name,'Project member'),'currency',e.details->>'currency',
    'before',e.details->'before','after',e.details->'after') entry
   from public.account_project_events e left join public.account_profiles p on p.id=e.actor_profile_id
   where e.project_id=p_project and e.action in ('boq_item_added','boq_item_updated') order by e.created_at desc,e.id desc limit 100) recent);
end; $$;

create or replace function public.account_intake_access(p_hash text,p_id uuid,p_write boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.web_intakes%rowtype; actor jsonb; owner_id uuid;
begin
  select * into w from public.web_intakes where id=p_id;
  if not found then return null; end if;
  actor:=public.account_project_access(p_hash,w.project_id,p_write);
  if actor is null or actor ? 'error' then return actor; end if;
  if p_write and not public.account_has_project_permission(actor,'record_notes') then return null; end if;
  select coalesce(w.profile_id,l.profile_id) into owner_id from (select 1) x left join public.account_legacy_actors l on l.telegram_id=w.telegram_id;
  if public.account_person(owner_id) is distinct from (actor->>'profile_id')::uuid then return null; end if;
  return actor;
end; $$;

create or replace function public.account_capture_context(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare project uuid; actor jsonb;
begin
  select active_project_id into project from public.account_sessions where secret_hash=p_hash;
  actor:=public.account_project_access(p_hash,project,true);
  if actor is null then return jsonb_build_object('error','select_project'); end if;
  if actor ? 'error' then return actor; end if;
  if not public.account_has_project_permission(actor,'record_notes') then return jsonb_build_object('error','read_only','project_name',(select name from public.projects where id=project),'project_id',project,'timezone',actor->>'timezone'); end if;
  return jsonb_build_object('project_id',project,'project_name',(select name from public.projects where id=project),'actor_id',actor->>'profile_id','actor_name',actor->>'professional_name',
    'role',actor->>'role','currency',actor->>'currency','timezone',actor->>'timezone','expires',(extract(epoch from (actor->>'expires_at')::timestamptz))::bigint,
    'actor_aliases',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.account_profiles where public.account_person(id)=(actor->>'profile_id')::uuid)||
      (select coalesce(jsonb_agg(telegram_id::text),'[]'::jsonb) from public.account_legacy_actors where public.account_person(profile_id)=(actor->>'profile_id')::uuid));
end; $$;

create or replace function public.account_reserve_web(p_hash text,p_project uuid,p_manifest jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; uid uuid; saved public.web_intakes%rowtype; asset jsonb; idx integer := 0; bytes numeric; captured timestamptz;
begin
  ctx:=public.account_project_access(p_hash,p_project,true);
  if ctx is null then return '{"error":"forbidden"}'::jsonb; end if;
  if ctx ? 'error' then return ctx; end if;
  if not public.account_has_project_permission(ctx,'record_notes') then return jsonb_build_object('error','forbidden'); end if;
  if jsonb_typeof(p_manifest) <> 'object' or (select count(*) from jsonb_object_keys(p_manifest)) <> 5
    or not(p_manifest ?& array['id','project_id','captured_at','timezone','assets']) then return '{"error":"invalid"}'::jsonb; end if;
  begin uid:=(p_manifest->>'id')::uuid; captured:=(p_manifest->>'captured_at')::timestamptz;
  exception when others then return '{"error":"invalid"}'::jsonb; end;
  if uid is null or captured is null or p_manifest->>'project_id' is distinct from p_project::text
    or p_manifest->>'timezone' is distinct from (ctx->>'timezone') then return '{"error":"invalid"}'::jsonb; end if;
  select * into saved from public.web_intakes where id=uid for update;
  if found then
    if public.account_intake_access(p_hash,uid,false) is null or saved.project_id<>p_project then return '{"error":"forbidden"}'::jsonb; end if;
    if saved.manifest <> p_manifest then return '{"error":"invalid"}'::jsonb; end if;
    return public.account_intake_status(p_hash,uid);
  end if;
  if exists(select 1 from public.submissions where id=uid) then return '{"error":"forbidden"}'::jsonb; end if;
  if captured < now()-interval '7 days' or captured > now()+interval '5 minutes'
    or jsonb_typeof(p_manifest->'assets') <> 'array' or jsonb_array_length(p_manifest->'assets') not between 1 and 6
    or (p_manifest->'assets'->0->>'content_type'='image/jpeg' and jsonb_array_length(p_manifest->'assets')>5) then return '{"error":"invalid"}'::jsonb; end if;
  for asset in select value from jsonb_array_elements(p_manifest->'assets') loop
    if jsonb_typeof(asset) <> 'object' or (select count(*) from jsonb_object_keys(asset)) <> 4
      or not(asset ?& array['index','bytes','content_type','sha256']) or asset->'index' <> to_jsonb(idx)
      or jsonb_typeof(asset->'bytes') <> 'number' or jsonb_typeof(asset->'sha256') <> 'string' or jsonb_typeof(asset->'content_type') <> 'string'
      or (asset->>'sha256') !~ '^[a-f0-9]{64}$' then return '{"error":"invalid"}'::jsonb; end if;
    bytes := (asset->>'bytes')::numeric;
    if bytes <> trunc(bytes) or bytes <= 0 or bytes > (case when asset->>'content_type'='image/jpeg' then 1048576 else 3145728 end)
      or (idx=0 and asset->>'content_type' not in ('audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/webm','image/jpeg'))
      or (idx>0 and asset->>'content_type' is distinct from 'image/jpeg') then return '{"error":"invalid"}'::jsonb; end if;
    idx:=idx+1;
  end loop;
  if not public.account_limit('web-note:'||(ctx->>'profile_id'),20,3600) then
    return '{"error":"rate_limited"}'::jsonb; end if;
  insert into public.web_intakes(id,project_id,profile_id,submitter_name,submitter_role,currency,manifest) values(uid,p_project,(ctx->>'profile_id')::uuid,ctx->>'professional_name',ctx->>'role',ctx->>'currency',p_manifest);
  insert into public.web_intake_assets(intake_id,asset_index) select uid,generate_series(0,idx-1);
  return public.account_intake_status(p_hash,uid);
end;
$$;

create or replace function public.account_bot_context(p_telegram bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.account_telegram_links%rowtype; person uuid; profile public.account_profiles%rowtype; p public.account_projects%rowtype; work public.account_memberships%rowtype;
begin
  select * into link from public.account_telegram_links where telegram_id=p_telegram and active;
  if not found then return null; end if;
  person := public.account_person(link.profile_id);
  if not exists(select 1 from public.account_browser_identities b join auth.users u on u.id=b.auth_user_id where public.account_person(b.profile_id)=person
    and b.email_verified=lower(u.email) and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())) then return null; end if;
  select * into profile from public.account_profiles where id=person;
  select * into p from public.account_projects where project_id=link.active_project_id;
  select * into work from public.account_memberships where project_id=p.project_id and active and public.account_person(profile_id)=person order by (profile_id=person) desc,(role='pm') desc,created_at,id limit 1;
  if not found then return jsonb_build_object('profile_id',person,'professional_name',profile.professional_name,'name_confirmed_at',profile.name_confirmed_at); end if;
  return jsonb_build_object('profile_id',person,'professional_name',profile.professional_name,'name_confirmed_at',profile.name_confirmed_at,
    'project_id',p.project_id,'project_name',(select name from public.projects where id=p.project_id),'role',work.role,'permissions',public.account_project_permissions(work.role,public.account_person(p.owner_profile_id)=person,work.permissions),'currency',p.currency,'timezone',p.timezone,'archived_at',p.archived_at);
end; $$;

create or replace function public.account_bot_latest(p_telegram bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; note uuid;
begin
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null then return null; end if;
  select s.id into note from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
    where s.project_id=(ctx->>'project_id')::uuid and ((public.account_has_project_permission(ctx,'view_reports') and exists(select 1 from public.reports r where r.submission_id=s.id and r.status='locked')) or (public.account_has_project_permission(ctx,'record_notes') and (public.account_has_project_permission(ctx,'approve_lock') or public.account_person(coalesce(sp.profile_id,l.profile_id))=(ctx->>'profile_id')::uuid)))
    order by s.created_at desc,s.id desc limit 1;
  return note;
end; $$;

create or replace function public.account_bot_today(p_telegram bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; note uuid;
begin
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null or ctx->>'name_confirmed_at' is null then return null; end if;
  select s.id into note from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
    where s.project_id=(ctx->>'project_id')::uuid and coalesce(sp.site_date,s.site_date)=(clock_timestamp() at time zone (ctx->>'timezone'))::date
      and ((public.account_has_project_permission(ctx,'view_reports') and exists(select 1 from public.reports r where r.submission_id=s.id and r.status='locked')) or (public.account_has_project_permission(ctx,'record_notes') and (public.account_has_project_permission(ctx,'approve_lock') or public.account_person(coalesce(sp.profile_id,l.profile_id))=(ctx->>'profile_id')::uuid)))
    order by s.created_at desc,s.id desc limit 1;
  return jsonb_build_object('project_name',ctx->>'project_name','currency',ctx->>'currency','note_id',note,'input',case when note is not null then public.account_assemble_report(note) else null end);
end; $$;

create or replace function public.account_prepare_telegram(p_update_id bigint,p_payload jsonb,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.telegram_updates%rowtype; ctx jsonb; sanitized jsonb:=p_payload; fingerprint text;
  kind text:=p_payload->>'kind'; tg bigint:=(p_payload->>'user_id')::bigint; reply text; path text; selected uuid; project uuid; source_day date;
begin
  fingerprint:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  ctx:=public.account_bot_context(tg);
  if ctx is null or ctx->>'project_id' is null or ctx->>'archived_at' is not null or not public.account_has_project_permission(ctx,'record_notes') then sanitized:=p_payload-array['text','file_id','content_type']; end if;
  insert into public.telegram_updates(update_id,payload,payload_digest) values(p_update_id,sanitized,fingerprint) on conflict(update_id) do nothing;
  select * into strict r from public.telegram_updates where update_id=p_update_id for update;
  if r.payload_digest is not null and r.payload_digest<>fingerprint then raise exception 'Telegram replay payload changed'; end if;
  if r.payload_digest is null and r.payload<>p_payload then raise exception 'Telegram replay payload changed'; end if;
  if r.status='pending' and r.storage_path is not null and not public.account_telegram_media_allowed(p_update_id) then
    -- Keep the reserved receipt and media reference, but deny all further downloads.
    return to_jsonb(r)||jsonb_build_object('status','blocked','submission_id',null,'storage_path',null,'reply_sent_at',null,
      'reply_text','This saved upload is blocked by changed project access. After access is restored, select its original project and use /today to resume saved media.','reply_path','/projects');
  end if;
  if r.reply_sent_at is not null then return to_jsonb(r); end if;
  if r.lease_until>now() and r.claim_owner is distinct from p_owner then return jsonb_build_object('busy',true); end if;
  update public.telegram_updates set claim_owner=p_owner,lease_until=now()+interval '90 seconds' where update_id=p_update_id returning * into r;
  if r.reply_text is not null then return to_jsonb(r); end if;
  perform pg_advisory_xact_lock(tg);
  path:='/account';
  if not public.account_limit('bot-global',1000,60) or not public.account_limit('bot:'||tg,30,60) then reply:='Too many messages just now. Wait a little; your saved site notes are preserved.';
  elsif p_payload ? 'link_hash' then
    if (public.account_prove_telegram(p_payload->>'link_hash',tg)->>'proved')::boolean then reply:='Telegram ownership proved. Return to the website account that created this link and confirm the connection.';
    else reply:='This connection link expired or was already used. Start a new link from your website account.'; end if;
  elsif kind='logout' then
    update public.account_telegram_links set active=false,revoked_at=clock_timestamp() where telegram_id=tg and active;
    update public.account_sessions set revoked_at=clock_timestamp() where source='telegram' and telegram_link_id in(select id from public.account_telegram_links where telegram_id=tg) and revoked_at is null;
    if ctx is not null then insert into public.account_identity_events(actor_profile_id,subject_profile_id,action,details) values((ctx->>'profile_id')::uuid,(ctx->>'profile_id')::uuid,'telegram_unlinked',jsonb_build_object('channel','bot_logout'));end if;
    reply:='Telegram access signed out. Your records are preserved. Open SiteLedger and sign in to reconnect.';
  elsif kind='help' then reply:='1. Open SiteLedger and sign in. 2. Choose your project. 3. Send a voice note, up to 5 photos, or both. 4. Review and confirm the quantities. Passwords belong only in the secure form.';
  elsif ctx is null then reply:='Welcome to SiteLedger AI. Open the secure form to sign in or create your account. Use the same email on the website and in Telegram. Never send passwords in chat.';
  elsif ctx->>'name_confirmed_at' is null then reply:='Confirm your professional name in SiteLedger before sending site records.';
  elsif kind='account' then reply:='Open your account to manage your name, email and Telegram connection. Password recovery is on the sign-in page.';
  elsif kind='projects' then path:='/projects';reply:='Open your authorized projects and choose where to record work. Your queued notes keep their original project.';
  elsif kind='start' and p_payload ? 'project_code' then
    select p.id into project from public.projects p join public.account_projects a on a.project_id=p.id where p.project_code=p_payload->>'project_code'
      and exists(select 1 from public.account_memberships m where m.project_id=p.id and m.active and public.account_person(m.profile_id)=(ctx->>'profile_id')::uuid);
    if project is null then reply:='This project is unavailable to your account. Open your authorized projects or ask its owner for an invitation.';path:='/projects';
    else update public.account_telegram_links set active_project_id=project where telegram_id=tg and active;ctx:=public.account_bot_context(tg);reply:='Active project: '||(ctx->>'project_name')||'. Signed in as '||(ctx->>'professional_name')||' / '||(ctx->>'role')||'. Send a voice note and site photos.';path:='/projects/'||project;end if;
  elsif ctx->>'project_id' is null then reply:='You are signed in as '||(ctx->>'professional_name')||'. Choose an authorized project before sending site records.';path:='/projects';
  elsif kind='reports' then reply:='Open the saved records for '||(ctx->>'project_name')||'. Foremen see their own records; PMs review project work.';path:='/projects/'||(ctx->>'project_id');
  elsif kind='start' then reply:='Active project: '||(ctx->>'project_name')||'. Signed in as '||(ctx->>'professional_name')||' / '||(ctx->>'role')||'. Send a voice note, up to 5 photos, or both.';path:='/today';
  elsif kind='today' then selected:=public.account_bot_latest(tg);reply:=(ctx->>'project_name')||': '||case when selected is null then 'No site note yet. Send a voice note to begin.' else 'Open your latest site note to review its quantities and progress.' end;path:=case when selected is null then '/today' else '/confirm/'||selected end;selected:=null;
  elsif ctx->>'archived_at' is not null then reply:='This project is archived. Its existing records are preserved. Ask the owner to restore it before sending new work.';path:='/projects/'||(ctx->>'project_id');
  elsif not public.account_has_project_permission(ctx,'record_notes') then reply:='You do not have access to add site notes to this project.';path:='/projects/'||(ctx->>'project_id');
  elsif kind='unsupported' then reply:='Use the microphone for a voice note or send a compressed site photo. Open /help for the steps.';
  elsif kind='too_large' then reply:='That file is too large. Send a shorter voice note or a compressed Telegram photo.';
  else
    project:=(ctx->>'project_id')::uuid;
    perform 1 from public.account_projects where project_id=project and archived_at is null for share;
    source_day:=(to_timestamp((p_payload->>'sent_at')::bigint) at time zone (ctx->>'timezone'))::date;
    select s.id into selected from public.submissions s join public.account_submission_people sp on sp.submission_id=s.id
      where s.project_id=project and public.account_person(sp.profile_id)=(ctx->>'profile_id')::uuid and sp.site_date=source_day and s.source='telegram' and s.status in('received','extracted')
        and (kind<>'voice' or (s.status='received' and s.audio_url is null and not exists(select 1 from public.telegram_updates where submission_id=s.id and payload->>'kind'='voice' and storage_path is not null))) order by s.created_at desc,s.id desc limit 1 for update;
    if selected is null then
      insert into public.submissions(project_id,submitted_by,source,created_at) values(project,ctx->>'professional_name','telegram',to_timestamp((p_payload->>'sent_at')::bigint)) returning id into selected;
      insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date) values(selected,(ctx->>'profile_id')::uuid,ctx->>'role',ctx->>'professional_name',ctx->>'currency',ctx->>'timezone',source_day);
    end if;
    if kind='photo' and (select count(*) from public.telegram_updates where submission_id=selected and payload->>'kind'='photo' and storage_path is not null)>=5 then reply:='This site note already has 5 photos saved or queued.';selected:=null;
    else
      if nullif(p_payload->>'text','') is not null then update public.submissions set notes=notes||jsonb_build_array(jsonb_build_object('text',p_payload->>'text','update_id',p_update_id,'sent_at',p_payload->>'sent_at')) where id=selected;end if;
      if kind in('voice','photo') then
        update public.telegram_updates set storage_path=project::text||'/'||selected::text||'/'||gen_random_uuid()::text||case when kind='photo' then '.jpg' when p_payload->>'content_type'='audio/mpeg' then '.mp3' when p_payload->>'content_type'='audio/mp4' then '.m4a' else '.ogg' end where update_id=p_update_id;
        reply:=(ctx->>'project_name')||': '||case when kind='voice' then 'Voice note saved. Add photos if helpful, or review the details.' else 'Photo saved. Add voice if helpful, or review and enter the work details.' end;
      else reply:=(ctx->>'project_name')||': Note saved with today''s work.';end if;
      path:='/confirm/'||selected;
    end if;
  end if;
  update public.telegram_updates set submission_id=selected,reply_text=reply,reply_path=path,status=case when storage_path is null then 'saved' else 'pending' end,saved_at=case when storage_path is null then now() else null end where update_id=p_update_id returning * into r;
  return to_jsonb(r);
end; $$;

create or replace function public.account_telegram_media_allowed(p_update_id bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.telegram_updates%rowtype; ctx jsonb; project uuid; person uuid;
begin
  select * into r from public.telegram_updates where update_id=p_update_id;
  if not found then return false; end if;
  ctx:=public.account_bot_context((r.payload->>'user_id')::bigint);
  select s.project_id,coalesce(sp.profile_id,l.profile_id) into project,person from public.submissions s
    left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id where s.id=r.submission_id;
  perform 1 from public.account_projects where project_id=project and archived_at is null for share;
  if not found or ctx is null or public.account_person(person) is distinct from (ctx->>'profile_id')::uuid then return false; end if;
  perform 1 from public.account_memberships where project_id=project and active and public.account_person(profile_id)=(ctx->>'profile_id')::uuid and
    (public.account_project_permissions(role,false,permissions)->>'record_notes')::boolean for share;
  return found;
end; $$;

create or replace function public.account_team(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null then return null; end if;
  return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('profile_id',m.person,'name',p.professional_name,'role',m.role,
      'owner',m.person=(select public.account_person(owner_profile_id) from public.account_projects where project_id=p_project),
      'role_label',coalesce(m.role_label,case when m.role='pm' then 'PM/QS' else 'Foreman' end),
      'permissions',public.account_project_permissions(m.role,m.person=(select public.account_person(owner_profile_id) from public.account_projects where project_id=p_project),m.permissions)) order by p.professional_name,m.person),'[]'::jsonb)
    from (select distinct on (public.account_person(profile_id)) public.account_person(profile_id) person,role,role_label,permissions from public.account_memberships where project_id=p_project and active order by public.account_person(profile_id),(role='pm') desc) m join public.account_profiles p on p.id=m.person),
    'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',coalesce(role_label,role),'expires_at',expires_at,'expired',expires_at<=clock_timestamp(),'cancelled_at',cancelled_at,'consumed_at',consumed_at) order by created_at desc),'[]'::jsonb) from public.account_invitations where project_id=p_project and public.account_has_project_permission(actor,'invite_members')),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'actor_profile_id',actor_profile_id,'action',action,'timestamp',created_at,'details',details) order by created_at desc,id),'[]'::jsonb) from public.account_project_events where project_id=p_project and (actor->>'owner')::boolean),
    'roles',(select coalesce(jsonb_agg(label order by label),'[]'::jsonb) from public.account_project_roles where project_id=p_project));
end; $$;

create or replace function public.account_invite(p_hash text,p_project uuid,p_email text,p_role text,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; invitation public.account_invitations%rowtype;
begin
  actor := public.account_project_access(p_hash,p_project,true);
  if actor is null then return jsonb_build_object('error','unavailable'); end if;
  if actor ? 'error' then return actor; end if;
  if not public.account_has_project_permission(actor,'invite_members') then return jsonb_build_object('error','unavailable'); end if;
  if p_role not in ('foreman','pm') or length(p_email) not between 3 and 254 or p_secret_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_invite'); end if;
  if not public.account_limit('invite:'||p_project,30,3600) then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.account_invitations(project_id,owner_profile_id,email,role,secret_hash) values(p_project,
    (select owner_profile_id from public.account_projects where project_id=p_project),lower(p_email),p_role,p_secret_hash) returning * into invitation;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'invited',jsonb_build_object('invitation_id',invitation.id,'role',p_role));
  return jsonb_build_object('id',invitation.id,'expires_at',invitation.expires_at);
end; $$;

create or replace function public.account_cancel_invite(p_hash text,p_project uuid,p_invite uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null or not public.account_has_project_permission(actor,'invite_members') then return jsonb_build_object('error','unavailable'); end if;
  update public.account_invitations set cancelled_at=clock_timestamp() where id=p_invite and project_id=p_project and consumed_at is null and cancelled_at is null;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'invite_cancelled',jsonb_build_object('invitation_id',p_invite));
  return jsonb_build_object('cancelled',true);
end; $$;

create or replace function public.account_accept_invite(p_hash text,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; invitation public.account_invitations%rowtype; p public.account_projects%rowtype; member uuid;
begin
  actor := public.account_session(p_hash);
  if actor is null or actor->>'name_confirmed_at' is null or not coalesce((actor->>'email_verified')::boolean,false) then return jsonb_build_object('error','verify_email'); end if;
  if not public.account_limit('accept-invite:'||(actor->>'profile_id'),20,3600) then return jsonb_build_object('error','rate_limited'); end if;
  select * into invitation from public.account_invitations where secret_hash=p_secret_hash;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  select * into p from public.account_projects where project_id=invitation.project_id for update;
  select * into invitation from public.account_invitations where id=invitation.id for update;
  if invitation.cancelled_at is not null or invitation.consumed_at is not null or invitation.expires_at<=clock_timestamp() or p.archived_at is not null
    or public.account_person(invitation.owner_profile_id)<>public.account_person(p.owner_profile_id) or invitation.email<>lower(actor->>'email')
    or not exists(select 1 from public.account_memberships m where m.project_id=p.project_id and m.active and m.role='pm' and public.account_person(m.profile_id)=public.account_person(p.owner_profile_id)) then return jsonb_build_object('error','unavailable'); end if;
  if exists(select 1 from public.account_memberships m where m.project_id=p.project_id and m.active and public.account_person(m.profile_id)=(actor->>'profile_id')::uuid) then return jsonb_build_object('error','already_member'); end if;
  insert into public.account_memberships(project_id,profile_id,role,role_label,permissions)
    values(p.project_id,(actor->>'profile_id')::uuid,invitation.role,invitation.role_label,
      case when invitation.role_label is null then null else public.account_project_role_defaults(invitation.role_label) end)
    on conflict(project_id,profile_id) do update set role=excluded.role,role_label=excluded.role_label,permissions=excluded.permissions,active=true,revoked_at=null returning id into member;
  update public.account_invitations set consumed_at=clock_timestamp(),accepted_profile_id=(actor->>'profile_id')::uuid where id=invitation.id;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p.project_id,(actor->>'profile_id')::uuid,'invite_accepted',jsonb_build_object('invitation_id',invitation.id,'membership_id',member,'role',invitation.role));
  return jsonb_build_object('project_id',p.project_id,'membership_id',member,'role',invitation.role);
end; $$;

create function public.account_set_member_permissions(p_hash text,p_project uuid,p_member uuid,p_role text,p_permissions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  perform 1 from public.account_projects where project_id=p_project for update;
  actor:=public.account_project_access(p_hash,p_project,true);
  if actor is null or not coalesce((actor->>'owner')::boolean,false) then return null; end if;
  if p_member=(actor->>'profile_id')::uuid or not public.account_limit('team-edit:'||p_project::text,100,3600) then return null; end if;
  if not (p_role in ('PM/QS','Site Engineer','Foreman','Client','Viewer') or exists(select 1 from public.account_project_roles where project_id=p_project and label=p_role)) then return null; end if;
  if jsonb_typeof(p_permissions)<>'object' or not p_permissions ?& array['view_reports','record_notes','edit_boq','approve_lock','invite_members']
    or (select count(*) from jsonb_each(p_permissions))<>5 or exists(select 1 from jsonb_each(p_permissions) where jsonb_typeof(value)<>'boolean') then return null; end if;
  update public.account_memberships set role=case when p_role='PM/QS' then 'pm' else 'foreman' end,role_label=p_role,permissions=p_permissions
    where project_id=p_project and active and public.account_person(profile_id)=p_member;
  if not found then return null; end if;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'role_changed',jsonb_build_object('profile_id',p_member,'role',p_role,'permissions',p_permissions));
  return jsonb_build_object('updated',true);
end; $$;

create function public.account_add_project_role(p_hash text,p_project uuid,p_label text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  perform 1 from public.account_projects where project_id=p_project for update;
  actor:=public.account_project_access(p_hash,p_project,true);
  if actor is null or not coalesce((actor->>'owner')::boolean,false) then return null; end if;
  if length(p_label) not between 1 and 40 or lower(p_label) in ('owner','pm/qs','site engineer','foreman','client','viewer')
    or (select count(*) from public.account_project_roles where project_id=p_project)>=20 then return null; end if;
  insert into public.account_project_roles(project_id,label) values(p_project,p_label) on conflict do nothing;
  return jsonb_build_object('saved',true);
end; $$;

create function public.account_invite_with_role(p_hash text,p_project uuid,p_email text,p_label text,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation jsonb;
begin
  if not (p_label in ('PM/QS','Site Engineer','Foreman','Client','Viewer') or exists(select 1 from public.account_project_roles where project_id=p_project and label=p_label)) then return null; end if;
  invitation:=public.account_invite(p_hash,p_project,p_email,case when p_label='PM/QS' then 'pm' else 'foreman' end,p_secret_hash);
  if invitation ? 'id' then update public.account_invitations set role_label=p_label where id=(invitation->>'id')::uuid; end if;
  return invitation;
end; $$;

create function public.account_resend_invite(p_hash text,p_project uuid,p_invite uuid,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; invitation public.account_invitations%rowtype;
begin
  actor:=public.account_project_access(p_hash,p_project,true);
  if actor is null or not public.account_has_project_permission(actor,'invite_members') then return null; end if;
  if not public.account_limit('invite:'||p_project,30,3600) then return jsonb_build_object('error','rate_limited'); end if;
  update public.account_invitations set secret_hash=p_secret_hash,expires_at=clock_timestamp()+interval '7 days'
    where id=p_invite and project_id=p_project and cancelled_at is null and consumed_at is null returning * into invitation;
  if not found then return null; end if;
  return jsonb_build_object('id',invitation.id,'email',invitation.email,'expires_at',invitation.expires_at);
end; $$;

revoke all on function public.account_set_member_permissions(text,uuid,uuid,text,jsonb),public.account_add_project_role(text,uuid,text),public.account_invite_with_role(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.account_set_member_permissions(text,uuid,uuid,text,jsonb),public.account_add_project_role(text,uuid,text),public.account_invite_with_role(text,uuid,text,text,text) to service_role;
revoke all on function public.account_resend_invite(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.account_resend_invite(text,uuid,uuid,text) to service_role;
revoke all on function public.account_project_permissions(text,boolean,jsonb),public.account_project_role_defaults(text),public.account_has_project_permission(jsonb,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
