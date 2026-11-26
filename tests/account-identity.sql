-- Disposable identity fixtures only; every change rolls back.
begin;
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
insert into auth.users(id,email,created_at,updated_at,aud,role,is_anonymous) values
  ('81000000-0000-4000-8000-000000000001','identity-owner@example.test',now(),now(),'authenticated','authenticated',false),
  ('81000000-0000-4000-8000-000000000002','identity-other@example.test',now(),now(),'authenticated','authenticated',false);
insert into auth.sessions(id,user_id,created_at,updated_at) values
  ('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000001',now(),now()),
  ('81000000-0000-4000-8000-000000000012','81000000-0000-4000-8000-000000000002',now(),now());
do $$ declare browser jsonb; telegram jsonb; result jsonb; person uuid; tg_person uuid; challenge uuid; other_challenge uuid; count_before integer;
begin
  select count(*) into count_before from public.account_profiles;
  browser := public.account_browser_session('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',repeat('a',64),'Ọlá');
  person := (browser->>'profile_id')::uuid;
  perform pg_temp.check_true(browser->>'professional_name'='Ọlá','Unicode single-word professional name');
  perform pg_temp.check_true(not (browser->>'email_verified')::boolean,'Signup timestamp never proves email ownership');
  update auth.users set email_confirmed_at=now() where id='81000000-0000-4000-8000-000000000001';
  perform pg_temp.check_true(not (public.account_session(repeat('a',64))->>'email_verified')::boolean,'Native auto-confirm is not invitation proof');
  select count(*) into count_before from public.account_profiles;
  telegram := public.account_telegram_session(810001,repeat('b',64),repeat('0',64));
  perform pg_temp.check_true((telegram->>'needs_login')::boolean,'Unlinked Telegram requires website signup/signin');
  perform pg_temp.check_true((select count(*) from public.account_profiles)=count_before,'Bot startup creates no standalone profile');
  -- Existing pre-account identity fixture; no new bot registration creates this.
  insert into public.account_profiles(professional_name,name_confirmed_at) values('Ayọ',now()) returning id into tg_person;
  insert into public.account_telegram_links(telegram_id,profile_id) values(810001,tg_person);
  perform public.account_verified_email(repeat('a',64),'81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011');
  other_challenge := (public.account_start_project_link(repeat('a',64),repeat('5',64),null)->>'id')::uuid;
  challenge := (public.account_start_project_link(repeat('a',64),repeat('c',64),null)->>'id')::uuid;
  perform pg_temp.check_true(public.account_link_status(repeat('a',64),other_challenge) is null and public.account_prove_telegram(repeat('5',64),810001)->>'error'='unavailable','Regenerating immediately invalidates the old code');
  perform pg_temp.check_true((select expires_at between clock_timestamp()+interval '9 minutes 59 seconds' and clock_timestamp()+interval '10 minutes' from public.account_link_challenges where id=challenge),'Code expires in ten minutes');
  perform pg_temp.check_true(public.account_finish_link(repeat('a',64),challenge,true)->>'error'='unavailable','Browser cannot finish without Telegram proof');
  perform pg_temp.check_true((public.account_prove_telegram(repeat('c',64),810001)->>'proved')::boolean,'Signed Telegram boundary can prove challenge');
  perform pg_temp.check_true(public.account_prove_telegram(repeat('c',64),810001)->>'error'='unavailable','Telegram proof replay denied');
  perform pg_temp.check_true(public.account_link_status(repeat('b',64),challenge) is null,'Another session cannot inspect browser challenge');
  perform pg_temp.check_true(public.account_finish_link(repeat('a',64),challenge,false)->>'error'='combine_required','Existing profile merge needs deliberate confirmation');
  result := public.account_finish_link(repeat('a',64),challenge,true);
  perform pg_temp.check_true(result->>'profile_id'=person::text,'Browser-first linking retains browser person');
  perform pg_temp.check_true(public.account_person(tg_person)=person,'Historical Telegram person resolves through alias');
  perform pg_temp.check_true((select professional_name='Ayọ' from public.account_profiles where id=tg_person),'Original profile name remains intact');
  telegram := public.account_telegram_session(810001,repeat('b',64),repeat('0',64));
  perform pg_temp.check_true(telegram->>'profile_id'=person::text,'Already linked Telegram resolves website person');
  perform pg_temp.check_true((public.account_telegram_session(810001,repeat('8',64),repeat('0',64))->>'needs_login')::boolean,'Forwarded native launch cannot replay login');
  perform pg_temp.check_true(public.account_finish_link(repeat('a',64),challenge,true)->>'error'='unavailable','Link consumption replay denied');
  perform public.account_verified_email(repeat('a',64),'81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011');
  perform pg_temp.check_true((public.account_session(repeat('a',64))->>'email_verified')::boolean,'Separate successful email proof recorded');
  update auth.users set email='changed@example.test' where id='81000000-0000-4000-8000-000000000001';
  perform pg_temp.check_true(not (public.account_session(repeat('a',64))->>'email_verified')::boolean,'Changed address cannot reuse old email proof');
  perform public.account_verified_email(repeat('a',64),'81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011');
  other_challenge := (public.account_start_link(repeat('a',64),repeat('d',64))->>'id')::uuid;
  update public.account_link_challenges set expires_at=now()-interval '1 second' where id=other_challenge;
  perform pg_temp.check_true(public.account_prove_telegram(repeat('d',64),810002)->>'error'='unavailable','Expired link denied');
  perform public.account_unlink_telegram(repeat('a',64));
  perform pg_temp.check_true(not (public.account_session(repeat('a',64))->>'telegram_linked')::boolean,'Explicit unlink revokes connection');
  result := public.account_browser_session('81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000012',repeat('f',64),'Amina');
  tg_person := (result->>'profile_id')::uuid;
  perform public.account_verified_email(repeat('f',64),'81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000012');
  select count(*) into count_before from public.account_profiles;
  result := public.account_link_miniapp(repeat('f',64),810003,repeat('7',64),true);
  perform pg_temp.check_true(result->>'profile_id'=tg_person::text,'Mini App uses the already authenticated website profile');
  perform pg_temp.check_true((select count(*) from public.account_profiles)=count_before,'Connecting Telegram creates no duplicate person');
  perform pg_temp.check_true(public.account_link_miniapp(repeat('f',64),810003,repeat('7',64),true)->>'error'='launch_used','Connection proof is single-use');
  telegram := public.account_telegram_session(810003,repeat('1',64),repeat('9',64));
  other_challenge := (public.account_start_link(repeat('a',64),repeat('2',64))->>'id')::uuid;
  perform public.account_prove_telegram(repeat('2',64),810003);
  perform pg_temp.check_true((public.account_link_status(repeat('a',64),other_challenge)->>'other_browser_proof_required')::boolean,'Existing other website login needs independent proof');
  perform pg_temp.check_true(public.account_finish_link(repeat('a',64),other_challenge,true)->>'error'='other_browser_proof_required','Telegram proof cannot take over another website login');
  result := public.account_finish_link(repeat('a',64),other_challenge,true,'81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000012');
  perform pg_temp.check_true(result->>'profile_id'=person::text,'Both proven browser accounts and Telegram can deliberately combine');
  perform pg_temp.check_true(public.account_session(repeat('f',64)) is null,'Combined old website session revoked');
  begin update public.account_profile_aliases set canonical_id=profile_id where profile_id=tg_person; raise exception 'Alias update unexpectedly passed'; exception when raise_exception then if sqlerrm<>'Account evidence is append-only' then raise; end if; end;
  begin delete from public.account_identity_events where subject_profile_id=person; raise exception 'Audit delete unexpectedly passed'; exception when raise_exception then if sqlerrm<>'Account evidence is append-only' then raise; end if; end;
  update public.account_sessions set authenticated_at=now()-interval '11 minutes' where secret_hash=repeat('a',64);
  perform pg_temp.check_true(public.account_session(repeat('a',64),true) is null,'Sensitive actions need recent browser authentication');
  perform pg_temp.check_true(public.account_session(repeat('a',64)) is not null,'Normal reads remain available before session expiry');
  update public.account_sessions set last_used_at=now()-interval '3 hours' where secret_hash=repeat('a',64);
  perform pg_temp.check_true(public.account_session(repeat('a',64)) is null,'Idle session expires');
  perform pg_temp.check_true(public.account_limit('identity-fixture-limit',1,600),'First bounded attempt accepted');
  perform pg_temp.check_true(not public.account_limit('identity-fixture-limit',1,600),'Further attempts rate limited');
  delete from auth.sessions where id='81000000-0000-4000-8000-000000000012';
  perform pg_temp.check_true(public.account_browser_session('81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000012',repeat('3',64)) is null,'Deleted native Auth session cannot authenticate');
end $$;
set local role authenticated;
do $$ begin
  begin perform public.account_session(repeat('a',64)); raise exception 'Browser RPC unexpectedly passed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.account_profiles; raise exception 'Browser table read unexpectedly passed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
