-- Task 10A: resumable uploads bind to the authenticated person and original project.
begin;
alter table public.web_intakes alter column telegram_id drop not null;
alter table public.web_intakes add column profile_id uuid references public.account_profiles(id) on delete restrict,
  add column submitter_name text,add column submitter_role text,add column currency text;
create function public.account_intake_access(p_hash text,p_id uuid,p_write boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.web_intakes%rowtype; actor jsonb; owner_id uuid;
begin
  select * into w from public.web_intakes where id=p_id;
  if not found then return null; end if;
  actor:=public.account_project_access(p_hash,w.project_id,p_write);
  if actor is null or actor ? 'error' then return actor; end if;
  select coalesce(w.profile_id,l.profile_id) into owner_id from (select 1) x left join public.account_legacy_actors l on l.telegram_id=w.telegram_id;
  if public.account_person(owner_id) is distinct from (actor->>'profile_id')::uuid then return null; end if;
  return actor;
end; $$;
create function public.account_intake_status(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if public.account_intake_access(p_hash,p_id,false) is null then return jsonb_build_object('error','forbidden'); end if;
  return (select jsonb_build_object('id',w.id,'status',case when w.submission_id is null then 'pending' else 'saved' end,
    'missing',(select coalesce(jsonb_agg(asset_index order by asset_index),'[]'::jsonb) from public.web_intake_assets where intake_id=w.id and status='pending')) from public.web_intakes w where w.id=p_id);
end; $$;
create function public.account_capture_context(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare project uuid; actor jsonb;
begin
  select active_project_id into project from public.account_sessions where secret_hash=p_hash;
  actor:=public.account_project_access(p_hash,project,true);
  if actor is null then return jsonb_build_object('error','select_project'); end if;
  if actor ? 'error' then return actor; end if;
  return jsonb_build_object('project_id',project,'project_name',(select name from public.projects where id=project),'actor_id',actor->>'profile_id','actor_name',actor->>'professional_name',
    'role',actor->>'role','currency',actor->>'currency','timezone',actor->>'timezone','expires',(extract(epoch from (actor->>'expires_at')::timestamptz))::bigint,
    'actor_aliases',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.account_profiles where public.account_person(id)=(actor->>'profile_id')::uuid)||
      (select coalesce(jsonb_agg(telegram_id::text),'[]'::jsonb) from public.account_legacy_actors where public.account_person(profile_id)=(actor->>'profile_id')::uuid));
end; $$;
create function public.account_reserve_web(p_hash text,p_project uuid,p_manifest jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; uid uuid; saved public.web_intakes%rowtype; asset jsonb; idx integer := 0; bytes numeric; captured timestamptz;
begin
  ctx:=public.account_project_access(p_hash,p_project,true);
  if ctx is null then return '{"error":"forbidden"}'::jsonb; end if;
  if ctx ? 'error' then return ctx; end if;
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
  if not public.account_limit('web-note:'||(ctx->>'profile_id'),20,3600) then
    return '{"error":"rate_limited"}'::jsonb; end if;
  insert into public.web_intakes(id,project_id,profile_id,submitter_name,submitter_role,currency,manifest) values(uid,p_project,(ctx->>'profile_id')::uuid,ctx->>'professional_name',ctx->>'role',ctx->>'currency',p_manifest);
  insert into public.web_intake_assets(intake_id,asset_index) select uid,generate_series(0,idx-1);
  return public.account_intake_status(p_hash,uid);
end;
$$;

create function public.account_claim_web(p_hash text,p_id uuid,p_index integer,p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare saved public.web_intakes%rowtype; row public.web_intake_assets%rowtype; asset jsonb; ext text;
begin
  if public.account_intake_access(p_hash,p_id,true) is null then return '{"error":"forbidden"}'::jsonb; end if;
  if public.account_intake_access(p_hash,p_id,true) ? 'error' then return public.account_intake_access(p_hash,p_id,true); end if;

  select * into saved from public.web_intakes where id=p_id for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  if saved.submission_id is not null then return public.account_intake_status(p_hash,p_id); end if;
  select * into row from public.web_intake_assets where intake_id=p_id and asset_index=p_index for update;
  if not found or p_owner is null then return '{"error":"invalid"}'::jsonb; end if;
  if row.status='saved' then return '{"status":"uploaded"}'::jsonb; end if;
  if row.lease_until > clock_timestamp() then return '{"busy":true}'::jsonb; end if;
  update public.web_intake_assets set claim_owner=p_owner,lease_until=clock_timestamp()+interval '120 seconds' where intake_id=p_id and asset_index=p_index;
  asset:=saved.manifest->'assets'->p_index;
  ext:=case asset->>'content_type' when 'audio/ogg' then 'ogg' when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/wav' then 'wav' when 'audio/webm' then 'webm' else 'jpg' end;
  return jsonb_build_object('asset',asset,'path',saved.project_id::text||'/'||p_id::text||'/'||p_index::text||'.'||ext);
end;
$$;

create function public.account_finish_web(p_hash text,p_id uuid,p_index integer,p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if public.account_intake_access(p_hash,p_id,true) is null then return '{"error":"forbidden"}'::jsonb; end if;
  if public.account_intake_access(p_hash,p_id,true) ? 'error' then return public.account_intake_access(p_hash,p_id,true); end if;

  perform 1 from public.web_intakes where id=p_id for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  update public.web_intake_assets set status='saved',claim_owner=null,lease_until=null
    where intake_id=p_id and asset_index=p_index and status='pending' and claim_owner=p_owner and lease_until>clock_timestamp();
  if not found then return '{"busy":true}'::jsonb; end if;
  return '{"status":"uploaded"}'::jsonb;
end;
$$;

create function public.account_release_web(p_hash text,p_id uuid,p_index integer,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor jsonb; own_id uuid;
begin
  actor:=public.account_session(p_hash,false,false);
  if actor is null then return; end if;
  select coalesce(w.profile_id,l.profile_id) into own_id from public.web_intakes w left join public.account_legacy_actors l on l.telegram_id=w.telegram_id where w.id=p_id;
  if public.account_person(own_id) is distinct from (actor->>'profile_id')::uuid then return; end if;
  update public.web_intake_assets set claim_owner=null,lease_until=null where intake_id=p_id and asset_index=p_index and claim_owner=p_owner;
end; $$;

create function public.account_finalize_web(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; p_project uuid; saved public.web_intakes%rowtype; actor text; asset jsonb; idx integer; ext text;
begin
  ctx:=public.account_intake_access(p_hash,p_id,true);
  if ctx is null then return '{"error":"forbidden"}'::jsonb; end if;
  if ctx ? 'error' then return ctx; end if;
  p_project:=(ctx->>'project_id')::uuid;
  select * into saved from public.web_intakes where id=p_id for update;
  if not found then return '{"error":"forbidden"}'::jsonb; end if;
  if saved.submission_id is not null then return public.account_intake_status(p_hash,p_id); end if;
  if exists(select 1 from public.web_intake_assets where intake_id=p_id and status <> 'saved') then return '{"busy":true}'::jsonb; end if;
  insert into public.submissions(id,project_id,telegram_id,submitted_by,source,created_at)
    values(p_id,p_project,saved.telegram_id,coalesce(saved.submitter_name,ctx->>'professional_name'),'web',(saved.manifest->>'captured_at')::timestamptz);
  insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date,received_at) values(p_id,coalesce(saved.profile_id,(ctx->>'profile_id')::uuid),coalesce(saved.submitter_role,ctx->>'role'),coalesce(saved.submitter_name,ctx->>'professional_name'),coalesce(saved.currency,ctx->>'currency'),saved.manifest->>'timezone',((saved.manifest->>'captured_at')::timestamptz at time zone (saved.manifest->>'timezone'))::date,saved.created_at);
  for idx in 1..jsonb_array_length(saved.manifest->'assets')-1 loop
    insert into public.submission_photos(submission_id,storage_url) values(p_id,'site-evidence/'||p_project::text||'/'||p_id::text||'/'||idx::text||'.jpg');
  end loop;
  asset:=saved.manifest->'assets'->0;
  ext:=case asset->>'content_type' when 'audio/ogg' then 'ogg' when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/wav' then 'wav' else 'webm' end;
  update public.submissions set audio_url='site-evidence/'||p_project::text||'/'||p_id::text||'/0.'||ext where id=p_id;
  update public.web_intakes set submission_id=p_id where id=p_id;
  return public.account_intake_status(p_hash,p_id);
end;
$$;
revoke all on function public.account_intake_access(text,uuid,boolean),public.account_intake_status(text,uuid),public.account_capture_context(text),public.account_reserve_web(text,uuid,jsonb),public.account_claim_web(text,uuid,integer,uuid),public.account_finish_web(text,uuid,integer,uuid),public.account_release_web(text,uuid,integer,uuid),public.account_finalize_web(text,uuid) from public,anon,authenticated;
grant execute on function public.account_intake_access(text,uuid,boolean),public.account_intake_status(text,uuid),public.account_capture_context(text),public.account_reserve_web(text,uuid,jsonb),public.account_claim_web(text,uuid,integer,uuid),public.account_finish_web(text,uuid,integer,uuid),public.account_release_web(text,uuid,integer,uuid),public.account_finalize_web(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
