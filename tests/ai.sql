-- Dedicated disposable local database; all fixture writes roll back.
begin;
set local role service_role;
do $$
declare
  sid uuid := '72000000-0000-4000-8000-000000000001';
  failure_sid uuid := '72000000-0000-4000-8000-000000000002';
  owner_id uuid := gen_random_uuid();
  next_owner uuid := gen_random_uuid();
  job jsonb;
  photo jsonb;
  extraction jsonb := '{"work_items":[{"description":"we don set blockwork","matched_boq_hint":"Sandcrete blocks 225mm hollow, laid","quantity":18,"unit":"m2","crew":6,"confidence":0.9}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Pidgin"}';
  audio text := 'site-evidence/10000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/920001.ogg';
  raw text := '  We don set eighteen square metres, six boys.' || chr(10);
  payload jsonb := '{"user_id":920000001,"chat_id":920000001,"display_name":"Test foreman","sent_at":1794958200,"kind":"photo","file_id":"test-photo","content_type":"image/jpeg"}';
begin
  insert into public.telegram_users(telegram_id, display_name, project_id, role)
  values (920000001, 'Test foreman', '10000000-0000-4000-8000-000000000001', 'foreman');
  insert into public.submissions(id, project_id, telegram_id, submitted_by, source, created_at)
  values (sid, '10000000-0000-4000-8000-000000000001', 920000001, 'Test foreman', 'telegram', to_timestamp(1794958200));
  update public.submissions set audio_url = audio where id = sid;
  if (select status from public.submission_ai_jobs where submission_id = sid) <> 'queued' then
    raise exception 'Saved voice must enqueue processing in the same transaction';
  end if;
  job := public.claim_ai_submission(sid, owner_id);
  if job is null or jsonb_array_length(job->'boq_hints') <> 16
    or (job->'boq_hints'->0) ? 'rate' then raise exception 'Job must use only descriptions/units, never BoQ prices'; end if;
  if public.claim_ai_submission(sid, next_owner) is not null then raise exception 'Concurrent worker repeated AI work'; end if;
  begin
    perform public.save_ai_transcript(sid, next_owner, raw, array['en','pcm']);
    raise exception 'FAIL: another worker wrote transcript';
  exception when raise_exception then
    if sqlerrm <> 'Voice processing lease is not owned' then raise; end if;
  end;
  perform public.save_ai_transcript(sid, owner_id, raw, array['en','pcm']);
  perform public.release_ai_submission(sid, owner_id);
  job := public.claim_ai_submission(sid, next_owner);
  if job->>'transcript' <> raw or job->'detected_languages' <> '["en","pcm"]' then
    raise exception 'Recovery must resume from the unchanged transcript/language checkpoint';
  end if;
  begin
    perform public.save_ai_transcript(sid, next_owner, 'Rewritten history', array['en']);
    raise exception 'FAIL: raw transcript rewritten';
  exception when raise_exception then
    if sqlerrm not like 'The raw transcript is immutable%' then raise; end if;
  end;
  begin
    perform public.finish_ai_submission(sid, next_owner, extraction || '{"total_cost":1}', null);
    raise exception 'FAIL: extra monetary field accepted';
  exception when raise_exception then
    if sqlerrm <> 'Extraction must use exactly the section 9 fields' then raise; end if;
  end;
  perform public.finish_ai_submission(sid, next_owner, extraction, null);
  if (select status from public.submissions where id = sid) <> 'extracted'
    or (select transcript from public.submissions where id = sid) <> raw
    or (select count(*) from public.reports) <> 12
    or public.claim_ai_submission(sid, owner_id) is not null then
    raise exception 'Extraction must preserve raw evidence and never confirm, cost or create reports';
  end if;
  raise notice 'PASS: durable queue, leases, transcript recovery/immutability, no prices, no auto-confirm/cost';

  photo := public.prepare_telegram_intake(920001, payload, owner_id);
  if (photo->>'submission_id')::uuid <> sid then raise exception 'Late photo must join extracted voice'; end if;
  begin
    update public.submissions set status = 'confirmed' where id = sid;
    raise exception 'FAIL: confirmation while photo pending';
  exception when raise_exception then
    if sqlerrm not like 'Wait for pending site evidence%' then raise; end if;
  end;
  perform public.finish_telegram_media(920001, owner_id);
  -- Photo processing finishes independently before the human can confirm.
  perform public.claim_photo_analysis(id,owner_id) from public.submission_photos where submission_id = sid;
  perform public.finish_photo_analysis(id,owner_id,null,'analysis_failed') from public.submission_photos where submission_id = sid;
  update public.submissions set status = 'confirmed' where id = sid;
  photo := public.prepare_telegram_intake(920002, payload, owner_id);
  if (photo->>'submission_id')::uuid = sid then raise exception 'Confirmed evidence received another photo'; end if;
  raise notice 'PASS: late photos attach until confirmation; pending media prevents human confirmation';

  insert into public.submissions(id, project_id, submitted_by, source)
  values (failure_sid, '10000000-0000-4000-8000-000000000001', 'Test foreman', 'web');
  update public.submissions set audio_url = audio where id = failure_sid;
  job := public.claim_ai_submission(failure_sid, owner_id);
  perform public.save_ai_transcript(failure_sid, owner_id, raw, array['en']);
  perform public.finish_ai_submission(failure_sid, owner_id, null, 'extraction_invalid');
  if (select status from public.submission_ai_jobs where submission_id = failure_sid) <> 'manual_entry'
    or (select audio_url from public.submissions where id = failure_sid) <> audio
    or (select transcript from public.submissions where id = failure_sid) <> raw
    or (select s.extraction from public.submissions s where s.id = failure_sid) is not null
    or public.claim_ai_submission(failure_sid, next_owner) is not null then
    raise exception 'Manual fallback must preserve media/transcript and not repeatedly consume quota';
  end if;
  if has_table_privilege('anon','public.submission_ai_jobs','select')
    or has_function_privilege('authenticated','public.claim_ai_submission(uuid,uuid)','execute') then
    raise exception 'Voice processing must be server-only';
  end if;
  raise notice 'PASS: failed extraction retains media/raw transcript; fallback and job access are private';
end;
$$;
rollback;
