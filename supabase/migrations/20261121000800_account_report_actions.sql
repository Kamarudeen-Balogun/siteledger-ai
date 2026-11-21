-- Task 10A: human confirmation, deterministic draft, PM approval and amendments.
begin;

create function public.account_confirm(p_hash text, p_id uuid, p_values jsonb,
  p_boq_ids jsonb, p_photo_notes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; s public.submissions%rowtype; actor text; actor_role text; item jsonb; chosen public.boq_items%rowtype;
  i integer; job_status text;
begin
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null then return jsonb_build_object('error','unavailable'); end if;
  if ctx ? 'error' then return ctx; end if;
  -- Same lock order as the AI worker; confirmation cannot race a running job.
  select status into job_status from public.submission_ai_jobs where submission_id = p_id for update;
  if job_status in ('queued', 'processing') then raise exception 'Wait for voice processing'; end if;
  select * into s from public.submissions where id = p_id for update;
  if not found or s.status = 'locked' then raise exception 'This site note cannot be confirmed'; end if;
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
    select * into chosen from public.boq_items where id = (p_boq_ids->>i)::uuid and project_id = s.project_id;
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

create function public.account_save_draft(p_hash text,p_id uuid,p_source jsonb,p_document jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; current_input jsonb; s public.submissions%rowtype; report_uuid uuid; row jsonb; cost jsonb;
  n integer; stored_total numeric; chosen public.boq_items%rowtype;
begin
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null or ctx ? 'error' then raise exception 'Report access unavailable'; end if;
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

create function public.account_approve(p_hash text,p_id uuid,p_document jsonb) returns jsonb
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
  if ctx->>'role'<>'pm' then return jsonb_build_object('error','forbidden'); end if;
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

create function public.account_amend(p_hash text,p_id uuid,p_note text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; r public.reports%rowtype; a public.amendments%rowtype; previous_person uuid;
begin
  ctx := public.account_record_access(p_hash,p_id,true);
  if ctx is null then return jsonb_build_object('error','unavailable'); end if;
  if ctx ? 'error' then return ctx; end if;
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

create function public.account_dispute_log(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb;
begin
  ctx := public.account_record_access(p_hash,p_id);
  if ctx is null then return null; end if;
  return jsonb_build_object('project',jsonb_build_object('id',ctx->>'project_id','name',(select name from public.projects where id=(ctx->>'project_id')::uuid)),'is_demo',false,
    'entries',(with visible as (
      select r.* from public.reports r join public.submissions s on s.id=r.submission_id left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
      where r.project_id=(ctx->>'project_id')::uuid and r.status='locked' and (ctx->>'role'='pm' or public.account_person(coalesce(sp.profile_id,l.profile_id))=(ctx->>'profile_id')::uuid)
    ), entries as (
      select r.locked_at event_time,r.id event_id,jsonb_build_object('kind','report','id',r.id,'report_id',r.id,'submission_id',r.submission_id,'date',r.date,'timestamp',r.locked_at,'author',r.approved_by,'total_cost',r.total_cost::text,'currency',coalesce(r.content_snapshot->>'currency','NGN'),'timezone',coalesce(r.content_snapshot->'source'->'project'->>'timezone','Africa/Lagos')) entry from visible r
      union all select a.created_at,a.id,jsonb_build_object('kind','amendment','id',a.id,'report_id',r.id,'submission_id',r.submission_id,'date',r.date,'timestamp',a.created_at,'author',a.author,'note',a.note,'currency',coalesce(r.content_snapshot->>'currency','NGN'),'timezone',coalesce(r.content_snapshot->'source'->'project'->>'timezone','Africa/Lagos')) from public.amendments a join visible r on r.id=a.report_id
    ) select coalesce(jsonb_agg(entry order by event_time desc,event_id),'[]'::jsonb) from entries));
end; $$;

revoke all on function public.account_confirm(text,uuid,jsonb,jsonb,jsonb),public.account_save_draft(text,uuid,jsonb,jsonb),public.account_approve(text,uuid,jsonb),public.account_amend(text,uuid,text,uuid),public.account_dispute_log(text,uuid) from public,anon,authenticated;
grant execute on function public.account_confirm(text,uuid,jsonb,jsonb,jsonb),public.account_save_draft(text,uuid,jsonb,jsonb),public.account_approve(text,uuid,jsonb),public.account_amend(text,uuid,text,uuid),public.account_dispute_log(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
