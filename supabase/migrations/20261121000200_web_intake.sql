-- Task 10 only: private, resumable web intake before account/project UI in 10A.
begin;
create table public.web_intakes (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  telegram_id bigint not null references public.telegram_users(telegram_id) on delete restrict,
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  submission_id uuid references public.submissions(id) on delete restrict,
  check(submission_id is null or submission_id = id)
);
create index web_intakes_actor_date on public.web_intakes(telegram_id,created_at);
create table public.web_intake_assets (
  intake_id uuid not null references public.web_intakes(id) on delete restrict,
  asset_index smallint not null check(asset_index between 0 and 5),
  status text not null default 'pending' check(status in ('pending','saved')),
  claim_owner uuid,
  lease_until timestamptz,
  primary key(intake_id,asset_index)
);
alter table public.web_intakes enable row level security;
alter table public.web_intake_assets enable row level security;
revoke all on public.web_intakes,public.web_intake_assets from public,anon,authenticated,service_role;
grant select on public.web_intakes,public.web_intake_assets to service_role;

create function public.web_capture_context(p_actor bigint) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('project_id',p.id,'project_name',p.name,'actor_id',u.telegram_id,
    'actor_name',u.display_name,'timezone','Africa/Lagos')
  from public.telegram_users u join public.projects p on p.id = u.project_id
  where u.telegram_id = p_actor and u.role in ('foreman','pm');
$$;
create function public.web_intake_status(p_id uuid,p_actor bigint,p_project uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('id',w.id,'status',case when w.submission_id is null then 'pending' else 'saved' end,
    'missing',(select coalesce(jsonb_agg(asset_index order by asset_index),'[]'::jsonb) from public.web_intake_assets where intake_id=w.id and status='pending'))
    from public.web_intakes w join public.telegram_users u on u.telegram_id=w.telegram_id and u.project_id=w.project_id
    where w.id=p_id and w.telegram_id=p_actor and w.project_id=p_project),' {"error":"forbidden"}'::jsonb);
$$;
create function public.web_capture_context_from_review(p_actor bigint,p_review uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('project_id',p.id,'project_name',p.name,'actor_id',u.telegram_id,
    'actor_name',u.display_name,'timezone','Africa/Lagos')
  from public.submissions s join public.telegram_users u on u.telegram_id=p_actor and u.project_id=s.project_id
    join public.projects p on p.id=s.project_id
  where s.id=p_review and (s.telegram_id=p_actor or u.role='pm');
$$;
create function public.reserve_web_intake(p_actor bigint,p_project uuid,p_manifest jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; saved public.web_intakes%rowtype; asset jsonb; idx integer := 0; bytes numeric; captured timestamptz;
begin
  perform 1 from public.telegram_users where telegram_id=p_actor and project_id=p_project and role in ('foreman','pm') for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  if jsonb_typeof(p_manifest) <> 'object' or (select count(*) from jsonb_object_keys(p_manifest)) <> 5
    or not(p_manifest ?& array['id','project_id','captured_at','timezone','assets']) then return '{"error":"invalid"}'::jsonb; end if;
  begin uid:=(p_manifest->>'id')::uuid; captured:=(p_manifest->>'captured_at')::timestamptz;
  exception when others then return '{"error":"invalid"}'::jsonb; end;
  if uid is null or captured is null or p_manifest->>'project_id' is distinct from p_project::text
    or p_manifest->>'timezone' is distinct from 'Africa/Lagos' then return '{"error":"invalid"}'::jsonb; end if;
  select * into saved from public.web_intakes where id=uid for update;
  if found then
    if saved.telegram_id <> p_actor or saved.project_id <> p_project then return '{"error":"forbidden"}'::jsonb; end if;
    if saved.manifest <> p_manifest then return '{"error":"invalid"}'::jsonb; end if;
    return public.web_intake_status(uid,p_actor,p_project);
  end if;
  if exists(select 1 from public.submissions where id=uid) then return '{"error":"forbidden"}'::jsonb; end if;
  if captured < now()-interval '7 days' or captured > now()+interval '5 minutes'
    or jsonb_typeof(p_manifest->'assets') <> 'array' or jsonb_array_length(p_manifest->'assets') not between 2 and 6 then return '{"error":"invalid"}'::jsonb; end if;
  for asset in select value from jsonb_array_elements(p_manifest->'assets') loop
    if jsonb_typeof(asset) <> 'object' or (select count(*) from jsonb_object_keys(asset)) <> 4
      or not(asset ?& array['index','bytes','content_type','sha256']) or asset->'index' <> to_jsonb(idx)
      or jsonb_typeof(asset->'bytes') <> 'number' or jsonb_typeof(asset->'sha256') <> 'string' or jsonb_typeof(asset->'content_type') <> 'string'
      or (asset->>'sha256') !~ '^[a-f0-9]{64}$' then return '{"error":"invalid"}'::jsonb; end if;
    bytes := (asset->>'bytes')::numeric;
    if bytes <> trunc(bytes) or bytes <= 0 or bytes > (case when idx=0 then 3145728 else 1048576 end)
      or (idx=0 and asset->>'content_type' not in ('audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/webm'))
      or (idx>0 and asset->>'content_type' is distinct from 'image/jpeg') then return '{"error":"invalid"}'::jsonb; end if;
    idx:=idx+1;
  end loop;
  if (select count(*) from public.web_intakes where telegram_id=p_actor and created_at>now()-interval '1 hour') >= 20 then
    return '{"error":"rate_limited"}'::jsonb; end if;
  insert into public.web_intakes(id,project_id,telegram_id,manifest) values(uid,p_project,p_actor,p_manifest);
  insert into public.web_intake_assets(intake_id,asset_index) select uid,generate_series(0,idx-1);
  return public.web_intake_status(uid,p_actor,p_project);
end;
$$;
create function public.claim_web_asset(p_id uuid,p_actor bigint,p_project uuid,p_index integer,p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare saved public.web_intakes%rowtype; row public.web_intake_assets%rowtype; asset jsonb; ext text;
begin
  perform 1 from public.telegram_users where telegram_id=p_actor and project_id=p_project for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  select * into saved from public.web_intakes where id=p_id and telegram_id=p_actor and project_id=p_project for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  if saved.submission_id is not null then return public.web_intake_status(p_id,p_actor,p_project); end if;
  select * into row from public.web_intake_assets where intake_id=p_id and asset_index=p_index for update;
  if not found or p_owner is null then return '{"error":"invalid"}'::jsonb; end if;
  if row.status='saved' then return '{"status":"uploaded"}'::jsonb; end if;
  if row.lease_until > clock_timestamp() then return '{"busy":true}'::jsonb; end if;
  update public.web_intake_assets set claim_owner=p_owner,lease_until=clock_timestamp()+interval '120 seconds' where intake_id=p_id and asset_index=p_index;
  asset:=saved.manifest->'assets'->p_index;
  ext:=case asset->>'content_type' when 'audio/ogg' then 'ogg' when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/wav' then 'wav' when 'audio/webm' then 'webm' else 'jpg' end;
  return jsonb_build_object('asset',asset,'path',p_project::text||'/'||p_id::text||'/'||p_index::text||'.'||ext);
end;
$$;
create function public.finish_web_asset(p_id uuid,p_actor bigint,p_project uuid,p_index integer,p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.telegram_users where telegram_id=p_actor and project_id=p_project for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  perform 1 from public.web_intakes where id=p_id and telegram_id=p_actor and project_id=p_project for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  update public.web_intake_assets set status='saved',claim_owner=null,lease_until=null
    where intake_id=p_id and asset_index=p_index and status='pending' and claim_owner=p_owner and lease_until>clock_timestamp();
  if not found then return '{"busy":true}'::jsonb; end if;
  return '{"status":"uploaded"}'::jsonb;
end;
$$;
create function public.release_web_asset(p_id uuid,p_actor bigint,p_project uuid,p_index integer,p_owner uuid) returns void
language sql security definer set search_path = '' as $$
  update public.web_intake_assets set claim_owner=null,lease_until=null where intake_id=p_id and asset_index=p_index and claim_owner=p_owner
    and exists(select 1 from public.web_intakes w join public.telegram_users u on u.telegram_id=w.telegram_id and u.project_id=w.project_id
      where w.id=p_id and w.telegram_id=p_actor and w.project_id=p_project);
$$;
create function public.finalize_web_intake(p_id uuid,p_actor bigint,p_project uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare saved public.web_intakes%rowtype; actor text; asset jsonb; idx integer; ext text;
begin
  select display_name into actor from public.telegram_users where telegram_id=p_actor and project_id=p_project for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  select * into saved from public.web_intakes where id=p_id and telegram_id=p_actor and project_id=p_project for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  if saved.submission_id is not null then return public.web_intake_status(p_id,p_actor,p_project); end if;
  if exists(select 1 from public.web_intake_assets where intake_id=p_id and status <> 'saved') then return '{"busy":true}'::jsonb; end if;
  insert into public.submissions(id,project_id,telegram_id,submitted_by,source,created_at)
    values(p_id,p_project,p_actor,actor,'web',(saved.manifest->>'captured_at')::timestamptz);
  for idx in 1..jsonb_array_length(saved.manifest->'assets')-1 loop
    insert into public.submission_photos(submission_id,storage_url) values(p_id,'site-evidence/'||p_project::text||'/'||p_id::text||'/'||idx::text||'.jpg');
  end loop;
  asset:=saved.manifest->'assets'->0;
  ext:=case asset->>'content_type' when 'audio/ogg' then 'ogg' when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/wav' then 'wav' else 'webm' end;
  update public.submissions set audio_url='site-evidence/'||p_project::text||'/'||p_id::text||'/0.'||ext where id=p_id;
  update public.web_intakes set submission_id=p_id where id=p_id;
  return public.web_intake_status(p_id,p_actor,p_project);
end;
$$;
create or replace function public.claim_ai_submission(p_submission_id uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.submission_ai_jobs%rowtype; submission public.submissions%rowtype; mime text;
begin
  select * into job from public.submission_ai_jobs where submission_id=p_submission_id for update;
  if not found or job.status in ('extracted','manual_entry') or (job.lease_until>now() and job.claim_owner is distinct from p_owner) then return null; end if;
  select * into submission from public.submissions where id=p_submission_id for update;
  if submission.status not in ('received','extracted') or submission.audio_url is null then return null; end if;
  update public.submission_ai_jobs set status='processing',claim_owner=p_owner,lease_until=now()+interval '3 minutes',attempts=attempts+1 where submission_id=p_submission_id;
  if submission.source='web' then select manifest->'assets'->0->>'content_type' into mime from public.web_intakes where submission_id=p_submission_id;
  else select payload->>'content_type' into mime from public.telegram_updates where submission_id=p_submission_id and payload->>'kind'='voice' and status='saved' limit 1; end if;
  return jsonb_build_object('submission_id',submission.id,'audio_url',submission.audio_url,'transcript',submission.transcript,'content_type',coalesce(mime,'audio/ogg'),
    'detected_languages',job.detected_languages,'boq_hints',(select coalesce(jsonb_agg(jsonb_build_object('description',description,'unit',unit) order by item_code),'[]'::jsonb) from public.boq_items where project_id=submission.project_id));
end;
$$;
update storage.buckets set allowed_mime_types=(select array_agg(distinct value) from unnest(allowed_mime_types||array['audio/webm','audio/wav']) value) where id='site-evidence';
revoke all on function public.web_capture_context(bigint),public.web_capture_context_from_review(bigint,uuid),public.web_intake_status(uuid,bigint,uuid),public.reserve_web_intake(bigint,uuid,jsonb),
  public.claim_web_asset(uuid,bigint,uuid,integer,uuid),public.finish_web_asset(uuid,bigint,uuid,integer,uuid),public.release_web_asset(uuid,bigint,uuid,integer,uuid),public.finalize_web_intake(uuid,bigint,uuid)
  from public,anon,authenticated;
grant execute on function public.web_capture_context(bigint),public.web_capture_context_from_review(bigint,uuid),public.web_intake_status(uuid,bigint,uuid),public.reserve_web_intake(bigint,uuid,jsonb),
  public.claim_web_asset(uuid,bigint,uuid,integer,uuid),public.finish_web_asset(uuid,bigint,uuid,integer,uuid),public.release_web_asset(uuid,bigint,uuid,integer,uuid),public.finalize_web_intake(uuid,bigint,uuid) to service_role;
commit;
