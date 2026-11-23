-- Builder revision: regular capture accepts one voice note, 1–5 photos, or both.
-- Original evidence, actor/project binding, leases and replay checks are preserved.
begin;
create or replace function public.account_reserve_web(p_hash text,p_project uuid,p_manifest jsonb) returns jsonb
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

create or replace function public.account_finalize_web(p_hash text,p_id uuid) returns jsonb
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
  for idx in 0..jsonb_array_length(saved.manifest->'assets')-1 loop
    asset:=saved.manifest->'assets'->idx;
    if asset->>'content_type'='image/jpeg' then
      insert into public.submission_photos(submission_id,storage_url)
        values(p_id,'site-evidence/'||p_project::text||'/'||p_id::text||'/'||idx::text||'.jpg');
    else
      ext:=case asset->>'content_type' when 'audio/ogg' then 'ogg' when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/wav' then 'wav' else 'webm' end;
      update public.submissions set audio_url='site-evidence/'||p_project::text||'/'||p_id::text||'/'||idx::text||'.'||ext where id=p_id;
    end if;
  end loop;
  update public.web_intakes set submission_id=p_id where id=p_id;
  return public.account_intake_status(p_hash,p_id);
end;
$$;

create or replace function public.account_confirm(p_hash text, p_id uuid, p_values jsonb,
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

create or replace function public.account_prepare_telegram(p_update_id bigint,p_payload jsonb,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.telegram_updates%rowtype; ctx jsonb; sanitized jsonb:=p_payload; fingerprint text;
  kind text:=p_payload->>'kind'; tg bigint:=(p_payload->>'user_id')::bigint; reply text; path text; selected uuid; project uuid; source_day date;
begin
  fingerprint:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  ctx:=public.account_bot_context(tg);
  if ctx is null or ctx->>'project_id' is null or ctx->>'archived_at' is not null then sanitized:=p_payload-array['text','file_id','content_type']; end if;
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
  elsif kind='start' then reply:='Active project: '||(ctx->>'project_name')||'. Signed in as '||(ctx->>'professional_name')||' / '||(ctx->>'role')||'. Send a voice note, up to 5 photos, or both.';path:='/projects/'||(ctx->>'project_id');
  elsif kind='today' then selected:=public.account_bot_latest(tg);reply:=(ctx->>'project_name')||': '||case when selected is null then 'No site note yet. Send a voice note to begin.' else 'Open your latest site note to review its quantities and progress.' end;path:=case when selected is null then '/today' else '/confirm/'||selected end;selected:=null;
  elsif ctx->>'archived_at' is not null then reply:='This project is archived. Its existing records are preserved. Ask the owner to restore it before sending new work.';path:='/projects/'||(ctx->>'project_id');
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
        update public.telegram_updates set storage_path=project::text||'/'||selected::text||'/'||p_update_id::text||case when kind='photo' then '.jpg' when p_payload->>'content_type'='audio/mpeg' then '.mp3' when p_payload->>'content_type'='audio/mp4' then '.m4a' else '.ogg' end where update_id=p_update_id;
        reply:=(ctx->>'project_name')||': '||case when kind='voice' then 'Voice note saved. Add photos if helpful, or review the details.' else 'Photo saved. Add voice if helpful, or review and enter the work details.' end;
      else reply:=(ctx->>'project_name')||': Note saved with today''s work.';end if;
      path:='/confirm/'||selected;
    end if;
  end if;
  update public.telegram_updates set submission_id=selected,reply_text=reply,reply_path=path,status=case when storage_path is null then 'saved' else 'pending' end,saved_at=case when storage_path is null then now() else null end where update_id=p_update_id returning * into r;
  return to_jsonb(r);
end; $$;

revoke all on function public.account_reserve_web(text,uuid,jsonb),public.account_finalize_web(text,uuid) from public,anon,authenticated;
grant execute on function public.account_reserve_web(text,uuid,jsonb),public.account_finalize_web(text,uuid) to service_role;
revoke all on function public.account_confirm(text,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.account_confirm(text,uuid,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.account_prepare_telegram(bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.account_prepare_telegram(bigint,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
