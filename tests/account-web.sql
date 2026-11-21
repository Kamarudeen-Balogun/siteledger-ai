begin;
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
insert into auth.users(id,email,created_at,updated_at,aud,role,is_anonymous) values
 ('85000000-0000-4000-8000-000000000001','capture-owner@example.test',now(),now(),'authenticated','authenticated',false),
 ('85000000-0000-4000-8000-000000000002','capture-foreman@example.test',now(),now(),'authenticated','authenticated',false);
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001',now(),now()),
 ('85000000-0000-4000-8000-000000000012','85000000-0000-4000-8000-000000000002',now(),now());
do $$ declare owner_id uuid; foreman_id uuid; a uuid; b uuid; invitation jsonb; captured_manifest jsonb; ctx jsonb; result jsonb; captured timestamptz:=now()-interval '10 hours';
  note uuid:='85000000-0000-4000-8000-000000000021'; lease uuid:='85000000-0000-4000-8000-000000000031';
begin
  owner_id:=(public.account_browser_session('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000011',repeat('a',64),'Capture Owner')->>'profile_id')::uuid;
  foreman_id:=(public.account_browser_session('85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000012',repeat('b',64),'Capture Foreman')->>'profile_id')::uuid;
  perform public.account_verified_email(repeat('b',64),'85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000012');
  a:=(public.account_create_project(repeat('a',64),'Capture A','Fixture','Fixture','0','NGN','America/Los_Angeles')->>'id')::uuid;
  b:=(public.account_create_project(repeat('b',64),'Capture B','Fixture','Fixture','0','KWD','Asia/Kuwait')->>'id')::uuid;
  invitation:=public.account_invite(repeat('a',64),a,'capture-foreman@example.test','foreman',repeat('c',64));
  perform public.account_accept_invite(repeat('b',64),repeat('c',64));
  perform public.account_select_project(repeat('b',64),a);
  ctx:=public.account_capture_context(repeat('b',64));
  perform pg_temp.check_true(ctx->>'actor_id'=foreman_id::text and ctx->>'role'='foreman' and ctx->>'timezone'='America/Los_Angeles','Capture uses selected project and authenticated professional identity');
  captured_manifest:=jsonb_build_object('id',note,'project_id',a,'captured_at',captured,'timezone','America/Los_Angeles','assets',jsonb_build_array(
    jsonb_build_object('index',0,'bytes',10,'content_type','audio/wav','sha256',repeat('d',64)),
    jsonb_build_object('index',1,'bytes',10,'content_type','image/jpeg','sha256',repeat('e',64))));
  perform pg_temp.check_true(public.account_reserve_web('',a,captured_manifest)->>'error'='forbidden','Unauthenticated queue cannot reserve intake');
  result:=public.account_reserve_web(repeat('b',64),a,captured_manifest);
  perform pg_temp.check_true(result->>'status'='pending','Authorized queue reserves original manifest');
  perform pg_temp.check_true(public.account_reserve_web(repeat('a',64),a,captured_manifest)->>'error'='forbidden','PM cannot resume another person''s queued capture');
  perform public.account_select_project(repeat('b',64),b);
  perform pg_temp.check_true(public.account_reserve_web(repeat('b',64),b,jsonb_set(captured_manifest,'{project_id}',to_jsonb(b)))->>'error'='invalid','Queue timezone cannot be reassigned to the newly selected project');
  perform pg_temp.check_true(public.account_reserve_web(repeat('b',64),a,captured_manifest)->>'status'='pending','Resuming rechecks the original project despite changed active selection');
  perform public.account_archive_project(repeat('a',64),a,true);
  perform pg_temp.check_true(public.account_claim_web(repeat('b',64),note,0,lease)->>'error'='archived','Archive blocks pending media before upload');
  perform pg_temp.check_true((select w.manifest=captured_manifest from public.web_intakes w where id=note),'Blocked intake retains stored manifest');
  perform public.account_archive_project(repeat('a',64),a,false);
  perform public.account_claim_web(repeat('b',64),note,0,lease);
  perform public.account_finish_web(repeat('b',64),note,0,lease);
  perform public.account_claim_web(repeat('b',64),note,1,lease);
  perform public.account_finish_web(repeat('b',64),note,1,lease);
  result:=public.account_finalize_web(repeat('b',64),note);
  perform pg_temp.check_true(result->>'status'='saved','Complete upload finalizes exactly once');
  perform pg_temp.check_true((select project_id=a from public.submissions where id=note),'Final submission retains original project');
  perform pg_temp.check_true((select profile_id=foreman_id and role='foreman' and timezone='America/Los_Angeles' and currency='NGN' and site_date=(captured at time zone 'America/Los_Angeles')::date from public.account_submission_people where submission_id=note),'Final record snapshots original project timezone/date/currency and professional identity');
  perform pg_temp.check_true(public.account_finalize_web(repeat('b',64),note)->>'id'=note::text,'Lost final response returns the original receipt');
  perform public.account_manage_member(repeat('a',64),a,foreman_id,null,true);
  perform pg_temp.check_true(public.account_finalize_web(repeat('b',64),note)->>'error'='forbidden','Removed member cannot retry old capture');
  perform pg_temp.check_true((select count(*)=1 from public.submissions where id=note),'Revocation and retries preserve existing evidence');
end $$;
rollback;
