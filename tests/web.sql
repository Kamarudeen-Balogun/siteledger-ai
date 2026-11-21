begin;
set local role service_role;
do $$
declare project uuid := '10000000-0000-4000-8000-000000000001';
  sid uuid := '7a000000-0000-4000-8000-000000000001'; actor bigint := 7700001;
  lease uuid := gen_random_uuid(); other uuid := gen_random_uuid(); result jsonb; manifest jsonb; captured timestamptz:=now()-interval '1 day';
  before_reports bigint; before_items bigint;
begin
  insert into public.telegram_users(telegram_id,display_name,project_id,role) values(actor,'Web fixture',project,'foreman');
  select count(*) into before_reports from public.reports;select count(*) into before_items from public.report_items;
  manifest:=jsonb_build_object('id',sid,'project_id',project,'captured_at',to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'timezone','Africa/Lagos','assets',jsonb_build_array(
      jsonb_build_object('index',0,'content_type','audio/webm','bytes',50,'sha256',repeat('a',64)),
      jsonb_build_object('index',1,'content_type','image/jpeg','bytes',40,'sha256',repeat('b',64))));
  if public.web_capture_context(7700999) is not null then raise exception 'Stranger got capture context';end if;
  if public.reserve_web_intake(7700999,project,manifest)->>'error' <> 'forbidden' then raise exception 'Stranger reserved a note';end if;
  result:=public.reserve_web_intake(actor,project,manifest);
  if result->>'status' <> 'pending' or jsonb_array_length(result->'missing')<>2 then raise exception 'Incorrect reservation';end if;
  if exists(select 1 from public.submissions where id=sid) then raise exception 'Incomplete upload published';end if;
  if public.reserve_web_intake(actor,project,manifest||'{"rate":1}')->>'error' <> 'invalid' then raise exception 'Caller money accepted';end if;
  if public.reserve_web_intake(actor,project,manifest)->>'id' <> sid::text then raise exception 'Replay changed ID';end if;
  if public.finalize_web_intake(sid,actor,project)->>'busy' <> 'true' then raise exception 'Partial bundle finalized';end if;
  result:=public.claim_web_asset(sid,actor,project,0,lease);
  if result->>'path' <> project::text||'/'||sid::text||'/0.webm' then raise exception 'Wrong private path';end if;
  if public.claim_web_asset(sid,actor,project,0,other)->>'busy' <> 'true' then raise exception 'Concurrent asset claim allowed';end if;
  if public.finish_web_asset(sid,actor,project,0,other)->>'busy' <> 'true' then raise exception 'Wrong owner saved media';end if;
  perform public.finish_web_asset(sid,actor,project,0,lease);
  if public.claim_web_asset(sid,actor,project,0,lease)->>'status' <> 'uploaded' then raise exception 'Saved object overwritten on retry';end if;
  perform public.claim_web_asset(sid,actor,project,1,lease);
  perform public.finish_web_asset(sid,actor,project,1,lease);
  result:=public.finalize_web_intake(sid,actor,project);
  if result->>'status'<>'saved' then raise exception 'Complete bundle not finalized';end if;
  if not exists(select 1 from public.submissions where id=sid and source='web' and created_at=captured and submitted_by='Web fixture') then
    -- The manifest intentionally records milliseconds; PostgreSQL can have finer precision.
    if not exists(select 1 from public.submissions where id=sid and source='web' and created_at=(manifest->>'captured_at')::timestamptz and submitted_by='Web fixture') then raise exception 'Capture time/source/actor changed';end if;
  end if;
  if public.finalize_web_intake(sid,actor,project)->>'id' <> sid::text then raise exception 'Finalize replay changed ID';end if;
  if (select count(*) from public.submission_photos where submission_id=sid)<>1 then raise exception 'Photos lost or duplicated';end if;
  if public.claim_ai_submission(sid,lease)->>'content_type'<>'audio/webm' then raise exception 'Web audio MIME lost';end if;
  if not exists(select 1 from public.photo_analysis_jobs j join public.submission_photos p on p.id=j.photo_id where p.submission_id=sid) then raise exception 'Photo job missing';end if;
  if before_reports<>(select count(*) from public.reports) or before_items<>(select count(*) from public.report_items) then raise exception 'Upload costed unconfirmed work';end if;
  raise notice 'PASS: private reservation, partial/duplicate recovery, captured date, MIME, jobs and no pre-confirm costs';
end $$;
-- Only disposable rows are changed to demonstrate revocation, lease expiry and rate limiting.
set local role postgres;
do $$
declare actor bigint:=7700001;project uuid:='10000000-0000-4000-8000-000000000001';sid uuid:='7a000000-0000-4000-8000-000000000001';other_project uuid:='7a000000-0000-4000-8000-000000000002';
begin
  insert into public.projects(id,project_code,name,client,location) values(other_project,'WEB-QA-OTHER','Disposable web QA','Fictional','Local QA');
  update public.telegram_users set project_id=other_project where telegram_id=actor;
  if public.finalize_web_intake(sid,actor,project)->>'error'<>'forbidden' or public.claim_web_asset(sid,actor,project,0,gen_random_uuid())->>'error'<>'forbidden' then raise exception 'Removed project access remained active';end if;
  update public.telegram_users set project_id=project where telegram_id=actor;
  if not exists(select 1 from public.submissions where id=sid) then raise exception 'Revocation deleted original evidence';end if;
  raise notice 'PASS: project reassignment denies capabilities without deleting saved records';
end $$;
do $$
declare actor bigint:=7700001;project uuid:='10000000-0000-4000-8000-000000000001';
  sid uuid:='7a000000-0000-4000-8000-000000000003';old_owner uuid:=gen_random_uuid();new_owner uuid:=gen_random_uuid();
  original jsonb;manifest jsonb;new_id uuid;i integer;
begin
  select w.manifest into original from public.web_intakes w where w.id='7a000000-0000-4000-8000-000000000001';
  manifest:=jsonb_set(original,'{id}',to_jsonb(sid::text));
  perform public.reserve_web_intake(actor,project,manifest);perform public.claim_web_asset(sid,actor,project,0,old_owner);
  update public.web_intake_assets set lease_until=clock_timestamp()-interval '1 second' where intake_id=sid and asset_index=0;
  if public.claim_web_asset(sid,actor,project,0,new_owner)->'asset' is null then raise exception 'Expired asset did not resume';end if;
  if public.finish_web_asset(sid,actor,project,0,old_owner)->>'busy'<>'true' then raise exception 'Stale lease owner finished';end if;
  perform public.finish_web_asset(sid,actor,project,0,new_owner);
  for i in 1..18 loop new_id:=gen_random_uuid();manifest:=jsonb_set(original,'{id}',to_jsonb(new_id::text));perform public.reserve_web_intake(actor,project,manifest);end loop;
  new_id:=gen_random_uuid();manifest:=jsonb_set(original,'{id}',to_jsonb(new_id::text));
  if public.reserve_web_intake(actor,project,manifest)->>'error'<>'rate_limited' then raise exception 'Intake rate limit missing';end if;
  raise notice 'PASS: expired media leases resume, stale owners fail and server intake is rate limited';
end $$;
set local role anon;
do $$ begin
  begin perform public.web_capture_context(7700001);raise exception 'FAIL public context';exception when insufficient_privilege then null;end;
  begin perform 1 from public.web_intakes;raise exception 'FAIL public records';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
  begin perform public.finalize_web_intake('7a000000-0000-4000-8000-000000000001',7700001,'10000000-0000-4000-8000-000000000001');raise exception 'FAIL browser mutation';exception when insufficient_privilege then null;end;
end $$;
rollback;
