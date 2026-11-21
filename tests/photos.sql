begin;
set local role service_role;
do $$
declare project uuid := '10000000-0000-4000-8000-000000000001';
  sid uuid := '79000000-0000-4000-8000-000000000001';
  photo uuid := '79000000-0000-4000-8000-000000000002';
  second_photo uuid := '79000000-0000-4000-8000-000000000003';
  lease uuid := gen_random_uuid(); other_lease uuid := gen_random_uuid(); chosen uuid;
  result jsonb; stored jsonb; before_cost bigint; before_source text; before_photo text;
  findings jsonb := '{"likely_work_item":"Concrete column","defects":[{"description":"Surface voids and coarse aggregate visible","confidence":0.8}],"safety_concerns":[],"confidence":0.7}';
  confirmed jsonb := '{"work_items":[{"description":"Blockwork","matched_boq_hint":null,"quantity":18,"unit":"m2","crew":6,"confidence":1}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Pidgin"}';
begin
  insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7900001,'Photo QA foreman',project,'foreman');
  insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,status)
    values(sid,project,7900001,'Photo QA foreman','telegram','Original photo QA voice note','extracted');
  before_source := (select row_to_json(s)::text from public.submissions s where id = sid);
  select count(*) into before_cost from public.report_items;
  insert into public.submission_photos(id,submission_id,storage_url) values
    (photo,sid,'site-evidence/10000000-0000-4000-8000-000000000001/79000000-0000-4000-8000-000000000001/7900002.jpg'),
    (second_photo,sid,'site-evidence/10000000-0000-4000-8000-000000000001/79000000-0000-4000-8000-000000000001/7900003.jpg');
  before_photo := (select storage_url from public.submission_photos where id = photo);
  if not exists(select 1 from public.photo_analysis_jobs where photo_id = photo and status = 'queued') then raise exception 'Photo not queued'; end if;
  if jsonb_array_length(public.pending_photo_analysis(sid)) <> 2 then raise exception 'Queue missing photo'; end if;
  if public.get_confirmation_record(sid,7900001)->>'pending_photo_analysis' <> 'true' then raise exception 'Review missing pending state'; end if;
  if public.get_confirmation_record(sid,7900999) is not null then raise exception 'Private findings visible to stranger'; end if;
  result := public.claim_photo_analysis(photo,lease);
  if result->>'photo_id' <> photo::text or result->>'storage_url' <> before_photo then raise exception 'Incorrect photo claim'; end if;
  if public.claim_photo_analysis(photo,other_lease) is not null or public.claim_photo_analysis(photo,lease) is not null then raise exception 'Busy job was claimed'; end if;
  begin perform public.finish_photo_analysis(photo,other_lease,findings,null); raise exception 'FAIL: wrong owner';
  exception when raise_exception then if sqlerrm <> 'Photo processing lease is not owned' then raise; end if; end;
  begin perform public.finish_photo_analysis(photo,lease,findings || '{"rate":1}',null); raise exception 'FAIL: invented price';
  exception when raise_exception then if sqlerrm <> 'Invalid photo findings' then raise; end if; end;
  begin update public.submissions set status = 'confirmed' where id = sid; raise exception 'FAIL: pending confirmed';
  exception when raise_exception then if sqlerrm <> 'Wait for photo analysis before confirmation' then raise; end if; end;
  perform public.finish_photo_analysis(photo,lease,findings,null);
  if not exists(select 1 from public.submission_photos where id = photo and ai_findings = findings and confirmed_findings is null and storage_url = before_photo) then raise exception 'Raw suggestion or media changed'; end if;
  if public.claim_photo_analysis(photo,lease) is not null then raise exception 'Finished photo repeated'; end if;
  begin update public.submission_photos set ai_findings = '{}' where id = photo; raise exception 'FAIL: raw overwrite';
  exception when raise_exception then if sqlerrm <> 'Original photo suggestions are immutable; edit confirmed observations' then raise; end if; end;
  if before_source <> (select row_to_json(s)::text from public.submissions s where id = sid)
    or before_cost <> (select count(*) from public.report_items) then raise exception 'Analysis changed source or costed work'; end if;

  perform public.claim_photo_analysis(second_photo,lease);
  perform public.release_photo_analysis(second_photo,lease);
  if not exists(select 1 from public.photo_analysis_jobs where photo_id = second_photo and status = 'queued' and attempts = 1) then raise exception 'First release not resumable'; end if;
  perform public.claim_photo_analysis(second_photo,other_lease);
  perform public.release_photo_analysis(second_photo,other_lease);
  if not exists(select 1 from public.photo_analysis_jobs where photo_id = second_photo and status = 'manual_entry' and attempts = 2) then raise exception 'Retries unbounded'; end if;
  if public.claim_photo_analysis(second_photo,lease) is not null then raise exception 'Exhausted job repeated'; end if;
  if public.get_confirmation_record(sid,7900001)->>'pending_photo_analysis' <> 'false' then raise exception 'Failure blocks manual notes'; end if;

  select id into chosen from public.boq_items where project_id = project and item_code = 'BLK-01';
  perform public.confirm_site_submission(sid,7900001,confirmed,jsonb_build_array(chosen),jsonb_build_array(
    jsonb_build_object('id',photo,'note','Human checked the photo: investigate the surface voids.'),
    jsonb_build_object('id',second_photo,'note','')));
  stored := public.get_confirmation_record(sid,7900001);
  if stored->'photos'->0->'ai_findings' <> findings or stored->'photos'->0->'confirmed_findings'->>'note' <> 'Human checked the photo: investigate the surface voids.' then raise exception 'Confirmation did not preserve raw findings and edited note'; end if;
  if public.get_site_report_input(sid,7900001)->'source'->'photos'->0->>'note' <> 'Human checked the photo: investigate the surface voids.' then raise exception 'Report ignores confirmed photo note'; end if;
  perform public.confirm_site_submission(sid,7900001,confirmed,jsonb_build_array(chosen),jsonb_build_array(
    jsonb_build_object('id',photo,'note',''),jsonb_build_object('id',second_photo,'note','')));
  if (select ai_findings from public.submission_photos where id = photo) <> findings
    or public.get_site_report_input(sid,7900001)->'source'->'photos'->0->>'note' <> '' then raise exception 'Dismissal lost original findings or leaked them to report'; end if;
  raise notice 'PASS: private claims, bounded retries, raw evidence, no photo pricing, pending guard, human edits and dismissal';
end;
$$;
-- Expiry checks use disposable transaction rows and explicit test-only clock changes.
set local role postgres;
do $$
declare sid uuid := '79000000-0000-4000-8000-000000000096';
  photo uuid := '79000000-0000-4000-8000-000000000097';
  lease uuid := gen_random_uuid(); replacement uuid := gen_random_uuid();
begin
  insert into public.submissions(id,project_id,submitted_by,source) values(sid,'10000000-0000-4000-8000-000000000001','Expiry QA','web');
  insert into public.submission_photos(id,submission_id,storage_url) values(photo,sid,'Disposable expiry fixture');
  perform public.claim_photo_analysis(photo,lease);
  update public.photo_analysis_jobs set lease_until = clock_timestamp() - interval '1 second' where photo_id = photo;
  if public.claim_photo_analysis(photo,replacement) is null then raise exception 'Expired job did not resume'; end if;
  begin perform public.finish_photo_analysis(photo,lease,null,'analysis_failed'); raise exception 'FAIL: stale owner finished';
  exception when raise_exception then if sqlerrm <> 'Photo processing lease is not owned' then raise; end if; end;
  update public.photo_analysis_jobs set lease_until = clock_timestamp() - interval '1 second' where photo_id = photo;
  if public.claim_photo_analysis(photo,lease) is not null then raise exception 'Expired retries exceeded limit'; end if;
  if not exists(select 1 from public.photo_analysis_jobs where photo_id = photo and attempts = 2 and status = 'manual_entry') then raise exception 'Expired failure did not become manual entry'; end if;
  raise notice 'PASS: expired leases resume safely, stale owners fail and exhausted jobs unblock manual review';
end;
$$;
set local role anon;
do $$
begin
  begin perform public.pending_photo_analysis('79000000-0000-4000-8000-000000000001'); raise exception 'FAIL: public queue'; exception when insufficient_privilege then null; end;
  begin perform public.claim_photo_analysis('79000000-0000-4000-8000-000000000002',gen_random_uuid()); raise exception 'FAIL: public claim'; exception when insufficient_privilege then null; end;
  begin perform public.finish_photo_analysis('79000000-0000-4000-8000-000000000002',gen_random_uuid(),null,'analysis_failed'); raise exception 'FAIL: public finish'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.photo_analysis_jobs; raise exception 'FAIL: public table'; exception when insufficient_privilege then null; end;
end;
$$;
set local role authenticated;
do $$
begin
  begin perform public.release_photo_analysis('79000000-0000-4000-8000-000000000002',gen_random_uuid()); raise exception 'FAIL: browser mutation'; exception when insufficient_privilege then null; end;
  raise notice 'PASS: photo jobs and mutation RPCs unavailable to browser database roles';
end;
$$;
rollback;
