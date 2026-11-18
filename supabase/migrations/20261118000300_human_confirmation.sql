-- Task 5: confirmed values are separate from unchanged AI/source evidence.
begin;
alter table public.submissions
  add column confirmed_extraction jsonb,
  add column confirmed_boq_ids jsonb,
  add column confirmed_by text,
  add column confirmed_at timestamptz;

create function public.get_confirmation_record(p_id uuid, p_telegram_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.submissions%rowtype; actor text; project_name text;
begin
  select submission.* into s
  from public.submissions submission join public.telegram_users u on u.telegram_id = p_telegram_id
    and u.project_id = submission.project_id join public.projects p on p.id = submission.project_id
  where submission.id = p_id and (submission.telegram_id = p_telegram_id or u.role = 'pm');
  if not found then return null; end if;
  select u.display_name, p.name into actor, project_name from public.telegram_users u
    join public.projects p on p.id = u.project_id where u.telegram_id = p_telegram_id and p.id = s.project_id;
  return jsonb_build_object('id', s.id, 'project_name', project_name, 'submitted_by', s.submitted_by,
    'actor', actor, 'created_at', s.created_at, 'status', s.status, 'transcript', s.transcript,
    'extraction', s.extraction, 'confirmed_extraction', s.confirmed_extraction,
    'confirmed_boq_ids', s.confirmed_boq_ids, 'confirmed_by', s.confirmed_by, 'confirmed_at', s.confirmed_at,
    'audio_url', s.audio_url, 'job_status', (select status from public.submission_ai_jobs where submission_id = s.id),
    'pending_media', exists(select 1 from public.telegram_updates where submission_id = s.id and status = 'pending'),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'storage_url', storage_url,
      'ai_findings', ai_findings, 'confirmed_findings', confirmed_findings) order by created_at, id), '[]'::jsonb)
      from public.submission_photos where submission_id = s.id),
    'boq', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'description', description,
      'unit', unit, 'section', section, 'item_code', item_code) order by item_code), '[]'::jsonb)
      from public.boq_items where project_id = s.project_id));
end;
$$;

create function public.confirm_site_submission(p_id uuid, p_telegram_id bigint, p_values jsonb,
  p_boq_ids jsonb, p_photo_notes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.submissions%rowtype; actor text; actor_role text; item jsonb; chosen public.boq_items%rowtype;
  i integer; job_status text;
begin
  -- Same lock order as the AI worker; confirmation cannot race a running job.
  select status into job_status from public.submission_ai_jobs where submission_id = p_id for update;
  if job_status in ('queued', 'processing') then raise exception 'Wait for voice processing'; end if;
  select * into s from public.submissions where id = p_id for update;
  if not found or s.status = 'locked' then raise exception 'This site note cannot be confirmed'; end if;
  select display_name, role into actor, actor_role from public.telegram_users where telegram_id = p_telegram_id
    and project_id = s.project_id and role in ('foreman', 'pm');
  if not found or (actor_role <> 'pm' and s.telegram_id is distinct from p_telegram_id) then raise exception 'Review access is not linked to this project'; end if;
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
  -- No report, price, report_items or cost is created in task 5.
  return jsonb_build_object('status', 'confirmed', 'confirmed_by', actor, 'confirmed_at', now());
end;
$$;
create function public.latest_confirmation_submission(p_telegram_id bigint) returns uuid
language sql security definer set search_path = '' as $$
  select s.id from public.submissions s join public.telegram_users u on u.project_id = s.project_id
  where u.telegram_id = p_telegram_id
    and (s.telegram_id = p_telegram_id or u.role = 'pm')
    and (s.created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date
  order by s.created_at desc limit 1;
$$;
revoke all on function public.latest_confirmation_submission(bigint), public.get_confirmation_record(uuid,bigint),
  public.confirm_site_submission(uuid,bigint,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.latest_confirmation_submission(bigint), public.get_confirmation_record(uuid,bigint),
  public.confirm_site_submission(uuid,bigint,jsonb,jsonb,jsonb) to service_role;
commit;
