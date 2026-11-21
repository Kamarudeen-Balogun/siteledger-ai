-- Task 9: bounded photo analysis, suggestions separate from human observations.
-- Only newly uploaded photos enqueue. Existing photos and locked records are untouched.
begin;
create table public.photo_analysis_jobs (
  photo_id uuid primary key references public.submission_photos(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','processing','analysed','manual_entry')),
  claim_owner uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 2),
  error_code text check (error_code in ('invalid_photo','analysis_failed','analysis_invalid','photo_unavailable')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.photo_analysis_jobs enable row level security;
revoke all on public.photo_analysis_jobs from public, anon, authenticated, service_role;
grant select on public.photo_analysis_jobs to service_role;

create function public.valid_photo_analysis(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare finding jsonb; list jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object'
    or (select count(*) from jsonb_object_keys(value)) <> 4
    or not(value ?& array['likely_work_item','defects','safety_concerns','confidence']) then return false; end if;
  if value->'likely_work_item' <> 'null'::jsonb and (jsonb_typeof(value->'likely_work_item') <> 'string'
    or nullif(btrim(value->>'likely_work_item'),'') is null or length(value->>'likely_work_item') > 500) then return false; end if;
  if jsonb_typeof(value->'confidence') <> 'number' or (value->>'confidence')::numeric not between 0 and 1 then return false; end if;
  foreach list in array array[value->'defects',value->'safety_concerns'] loop
    if jsonb_typeof(list) <> 'array' or jsonb_array_length(list) > 6 then return false; end if;
    for finding in select item from jsonb_array_elements(list) item loop
      if jsonb_typeof(finding) <> 'object' or (select count(*) from jsonb_object_keys(finding)) <> 2
        or not(finding ?& array['description','confidence']) or jsonb_typeof(finding->'description') <> 'string'
        or nullif(btrim(finding->>'description'),'') is null or length(finding->>'description') > 500
        or jsonb_typeof(finding->'confidence') <> 'number' or (finding->>'confidence')::numeric not between 0 and 1 then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;

create function public.enqueue_photo_analysis() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ai_findings is null and exists(select 1 from public.submissions
    where id = new.submission_id and status in ('received','extracted')) then
    insert into public.photo_analysis_jobs(photo_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger enqueue_photo_analysis after insert on public.submission_photos
for each row execute function public.enqueue_photo_analysis();

create function public.pending_photo_analysis(p_submission_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(id order by created_at,id),'[]'::jsonb) from (
    select p.id,p.created_at from public.photo_analysis_jobs j
      join public.submission_photos p on p.id = j.photo_id
      join public.submissions s on s.id = p.submission_id
    where s.id = p_submission_id and s.status in ('received','extracted')
      and j.status in ('queued','processing') and (j.lease_until is null or j.lease_until <= clock_timestamp())
    order by p.created_at,p.id limit 5
  ) photos;
$$;

create function public.claim_photo_analysis(p_photo_id uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare photo public.submission_photos%rowtype; job public.photo_analysis_jobs%rowtype;
begin
  if p_owner is null then raise exception 'Photo processing needs an owner'; end if;
  -- Submission first, then job, then photo, matching the confirmation guards.
  perform 1 from public.submissions s join public.submission_photos p on p.submission_id = s.id
    where p.id = p_photo_id and s.status in ('received','extracted') for update of s;
  if not found then return null; end if;
  select * into job from public.photo_analysis_jobs where photo_id = p_photo_id for update;
  if not found or job.status in ('analysed','manual_entry') or job.lease_until > clock_timestamp() then return null; end if;
  if job.attempts >= 2 then
    update public.photo_analysis_jobs set status = 'manual_entry', error_code = 'analysis_failed',
      claim_owner = null, lease_until = null, finished_at = clock_timestamp() where photo_id = p_photo_id;
    return null;
  end if;
  select * into photo from public.submission_photos where id = p_photo_id;
  if photo.ai_findings is not null then return null; end if;
  update public.photo_analysis_jobs set status = 'processing', claim_owner = p_owner,
    lease_until = clock_timestamp() + interval '60 seconds', attempts = attempts + 1 where photo_id = p_photo_id;
  return jsonb_build_object('photo_id',photo.id,'submission_id',photo.submission_id,'storage_url',photo.storage_url);
end;
$$;

create function public.finish_photo_analysis(p_photo_id uuid,p_owner uuid,p_findings jsonb,p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.submissions s join public.submission_photos p on p.submission_id = s.id
    where p.id = p_photo_id and s.status in ('received','extracted') for update of s;
  if not found then raise exception 'Photo processing requires unconfirmed evidence'; end if;
  perform 1 from public.photo_analysis_jobs where photo_id = p_photo_id and status = 'processing'
    and claim_owner = p_owner and lease_until > clock_timestamp() for update;
  if not found then raise exception 'Photo processing lease is not owned'; end if;
  if p_findings is not null then
    if p_error is not null or not public.valid_photo_analysis(p_findings) then raise exception 'Invalid photo findings'; end if;
    update public.submission_photos set ai_findings = p_findings where id = p_photo_id;
  elsif p_error is null or p_error not in ('invalid_photo','analysis_failed','analysis_invalid','photo_unavailable') then
    raise exception 'Manual photo review needs a failure reason';
  end if;
  update public.photo_analysis_jobs set status = case when p_findings is null then 'manual_entry' else 'analysed' end,
    error_code = p_error, claim_owner = null, lease_until = null, finished_at = clock_timestamp() where photo_id = p_photo_id;
end;
$$;

create function public.release_photo_analysis(p_photo_id uuid,p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.submissions s join public.submission_photos p on p.submission_id = s.id
    where p.id = p_photo_id and s.status in ('received','extracted') for update of s;
  if not found then return; end if;
  update public.photo_analysis_jobs set status = case when attempts >= 2 then 'manual_entry' else 'queued' end,
    error_code = case when attempts >= 2 then 'analysis_failed' else null end,
    finished_at = case when attempts >= 2 then clock_timestamp() else null end,
    claim_owner = null, lease_until = null
  where photo_id = p_photo_id and status = 'processing' and claim_owner = p_owner;
end;
$$;

create function public.guard_photo_findings() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ai_findings is distinct from old.ai_findings then
    if old.ai_findings is not null or exists(select 1 from public.submissions
      where id in (old.submission_id,new.submission_id) and status in ('confirmed','locked')) then
      raise exception 'Original photo suggestions are immutable; edit confirmed observations';
    end if;
    if not public.valid_photo_analysis(new.ai_findings) then raise exception 'Invalid photo findings'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_photo_findings before update of ai_findings on public.submission_photos
for each row execute function public.guard_photo_findings();

create function public.guard_pending_photo_analysis() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('confirmed','locked') and exists(select 1 from public.photo_analysis_jobs j
    join public.submission_photos p on p.id = j.photo_id
    where p.submission_id = new.id and j.status in ('queued','processing')) then
    raise exception 'Wait for photo analysis before confirmation';
  end if;
  return new;
end;
$$;
create trigger guard_pending_photo_analysis before update of status on public.submissions
for each row execute function public.guard_pending_photo_analysis();

create or replace function public.get_confirmation_record(p_id uuid,p_telegram_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.submissions%rowtype; actor text; project_name text;
begin
  select submission.* into s from public.submissions submission join public.telegram_users u
    on u.telegram_id = p_telegram_id and u.project_id = submission.project_id
  where submission.id = p_id and (submission.telegram_id = p_telegram_id or u.role = 'pm');
  if not found then return null; end if;
  select u.display_name,p.name into actor,project_name from public.telegram_users u
    join public.projects p on p.id = u.project_id where u.telegram_id = p_telegram_id and p.id = s.project_id;
  return jsonb_build_object('id',s.id,'project_name',project_name,'submitted_by',s.submitted_by,
    'actor',actor,'created_at',s.created_at,'status',s.status,'transcript',s.transcript,
    'extraction',s.extraction,'confirmed_extraction',s.confirmed_extraction,
    'confirmed_boq_ids',s.confirmed_boq_ids,'confirmed_by',s.confirmed_by,'confirmed_at',s.confirmed_at,
    'audio_url',s.audio_url,'job_status',(select status from public.submission_ai_jobs where submission_id = s.id),
    'pending_media',exists(select 1 from public.telegram_updates where submission_id = s.id and status = 'pending'),
    'pending_photo_analysis',exists(select 1 from public.photo_analysis_jobs j join public.submission_photos p on p.id = j.photo_id
      where p.submission_id = s.id and j.status in ('queued','processing')),
    'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'storage_url',p.storage_url,
      'ai_findings',p.ai_findings,'confirmed_findings',p.confirmed_findings,'analysis_status',j.status) order by p.created_at,p.id),'[]'::jsonb)
      from public.submission_photos p left join public.photo_analysis_jobs j on j.photo_id = p.id where p.submission_id = s.id),
    'boq',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,
      'unit',unit,'section',section,'item_code',item_code) order by item_code),'[]'::jsonb) from public.boq_items where project_id = s.project_id));
end;
$$;

revoke all on function public.valid_photo_analysis(jsonb), public.enqueue_photo_analysis(),
  public.pending_photo_analysis(uuid), public.claim_photo_analysis(uuid,uuid),
  public.finish_photo_analysis(uuid,uuid,jsonb,text), public.release_photo_analysis(uuid,uuid),
  public.guard_photo_findings(), public.guard_pending_photo_analysis() from public, anon, authenticated;
grant execute on function public.valid_photo_analysis(jsonb), public.pending_photo_analysis(uuid), public.claim_photo_analysis(uuid,uuid),
  public.finish_photo_analysis(uuid,uuid,jsonb,text), public.release_photo_analysis(uuid,uuid) to service_role;
commit;
