begin;
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
insert into auth.users(id,email,created_at,updated_at,aud,role,is_anonymous) values
 ('86000000-0000-4000-8000-000000000001','media-owner@example.test',now(),now(),'authenticated','authenticated',false);
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('86000000-0000-4000-8000-000000000011','86000000-0000-4000-8000-000000000001',now(),now());
do $$ declare person uuid; project uuid; note uuid; lease uuid:=gen_random_uuid(); asset jsonb; manifest jsonb; result jsonb; kind text;
begin
  person:=(public.account_browser_session('86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000011',repeat('f',64),'Media Owner')->>'profile_id')::uuid;
  project:=(public.account_create_project(repeat('f',64),'Optional media fixture','Fixture','Fixture','0','NGN','Africa/Lagos')->>'id')::uuid;
  for kind in select unnest(array['audio/wav','image/jpeg']) loop
    note:=gen_random_uuid();
    asset:=jsonb_build_object('index',0,'bytes',16,'content_type',kind,'sha256',repeat('a',64));
    manifest:=jsonb_build_object('id',note,'project_id',project,'captured_at',now(),'timezone','Africa/Lagos','assets',jsonb_build_array(asset));
    result:=public.account_reserve_web(repeat('f',64),project,manifest);
    perform pg_temp.check_true(result->>'status'='pending','One available media type reserves safely');
    perform pg_temp.check_true(public.account_finalize_web(repeat('f',64),note)->>'busy'='true','Incomplete upload cannot finalize');
    perform public.account_claim_web(repeat('f',64),note,0,lease);
    perform public.account_finish_web(repeat('f',64),note,0,lease);
    perform pg_temp.check_true(public.account_finalize_web(repeat('f',64),note)->>'status'='saved','Single attachment finalizes');
    perform pg_temp.check_true(public.account_finalize_web(repeat('f',64),note)->>'id'=note::text,'Single-media retry stays idempotent');
    if kind='audio/wav' then
      perform pg_temp.check_true((select audio_url is not null from public.submissions where id=note),'Voice-only note keeps original audio');
      perform pg_temp.check_true((select count(*)=0 from public.submission_photos where submission_id=note),'Voice-only note invents no photo');
    else
      perform pg_temp.check_true((select audio_url is null and transcript is null from public.submissions where id=note),'Photo-only note invents no audio or transcript');
      perform pg_temp.check_true((select count(*)=1 from public.submission_photos where submission_id=note),'Photo at index zero becomes evidence');
      perform pg_temp.check_true((select count(*)=0 from public.submission_ai_jobs where submission_id=note),'Photo-only note starts no voice transcription job');
    end if;
    perform pg_temp.check_true((select count(*)=1 from public.submissions where id=note),'No duplicate note after retry');
  end loop;
  manifest:=jsonb_set(manifest,'{id}',to_jsonb(gen_random_uuid()));
  perform pg_temp.check_true(public.account_reserve_web(repeat('f',64),project,jsonb_set(manifest,'{assets}','[]'::jsonb))->>'error'='invalid','Empty upload denied by SQL');
  perform pg_temp.check_true(public.account_reserve_web(repeat('f',64),project,jsonb_set(manifest,'{assets,0,bytes}','1048577'::jsonb))->>'error'='invalid','First photo has the photo byte limit');
  note:=gen_random_uuid();
  insert into public.submissions(id,project_id,submitted_by,source) values(note,project,'Media Owner','web');
  insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date) values(note,person,'pm','Media Owner','NGN','Africa/Lagos',current_date);
  perform pg_temp.check_true(public.account_confirm(repeat('f',64),note,'{"work_items":[],"materials":[],"delays":[],"issues":[],"raw_language_notes":""}'::jsonb,'[]'::jsonb,'[]'::jsonb)->>'error'='media_required','No-media note cannot be confirmed');
end $$;
rollback;
