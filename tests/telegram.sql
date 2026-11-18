-- Isolated local database only. No test media or users survive this transaction.
begin;
set local role service_role;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_owner uuid := gen_random_uuid();
  payload jsonb := jsonb_build_object('user_id', 910000001, 'chat_id', 910000001,
    'display_name', 'Test foreman', 'sent_at', 1794958200);
  receipt jsonb;
  voice_payload jsonb;
  photo_payload jsonb;
  first_submission uuid;
  next_submission uuid;
  first_audio text;
  i integer;
begin
  receipt := public.prepare_telegram_intake(910001, payload || '{"kind":"start","project_code":"WRONG"}', owner_id);
  if exists (select 1 from public.telegram_users where telegram_id = 910000001) then
    raise exception 'Invalid project linked a user';
  end if;
  receipt := public.prepare_telegram_intake(910002, payload || '{"kind":"voice","file_id":"test-voice","content_type":"audio/ogg"}', owner_id);
  if receipt->>'submission_id' is not null or receipt->>'status' <> 'saved' then
    raise exception 'Unlinked user created evidence';
  end if;
  receipt := public.prepare_telegram_intake(910003, payload || '{"kind":"start","project_code":"LEKKI-DEMO-01"}', owner_id);
  if (select role from public.telegram_users where telegram_id = 910000001) <> 'foreman' then
    raise exception 'Start must link the foreman';
  end if;
  update public.telegram_users set role = 'pm' where telegram_id = 910000001;
  receipt := public.prepare_telegram_intake(910004, payload || '{"kind":"start","project_code":"LEKKI-DEMO-01"}', owner_id);
  if (select role from public.telegram_users where telegram_id = 910000001) <> 'pm' then
    raise exception 'Start must preserve an existing PM role on the same project';
  end if;
  raise notice 'PASS: invalid/unlinked intake refused; start links and preserves existing PM';

  photo_payload := payload || '{"kind":"photo","file_id":"test-photo","content_type":"image/jpeg","text":"East elevation"}';
  receipt := public.prepare_telegram_intake(910005, photo_payload, owner_id);
  first_submission := (receipt->>'submission_id')::uuid;
  if (select site_date from public.submissions where id = first_submission) <> '2026-11-18' then
    raise exception 'Messages after 23:00 UTC must group into the next WAT day';
  end if;
  if public.prepare_telegram_intake(910005, photo_payload, other_owner)->>'busy' <> 'true' then
    raise exception 'Concurrent delivery did not respect its lease';
  end if;
  begin
    update public.submissions set status = 'confirmed' where id = first_submission;
    raise exception 'FAIL: pending media was confirmed';
  exception when raise_exception then
    if sqlerrm not like 'Wait for pending site evidence%' then raise; end if;
  end;
  begin
    perform public.finish_telegram_media(910005, other_owner);
    raise exception 'FAIL: another lease finalized media';
  exception when raise_exception then
    if sqlerrm <> 'Intake lease is not owned' then raise; end if;
  end;
  perform public.finish_telegram_media(910005, owner_id);
  perform public.finish_telegram_media(910005, owner_id);
  perform public.finish_telegram_reply(910005, owner_id, false);
  receipt := public.prepare_telegram_intake(910005, photo_payload, other_owner);
  if receipt->>'status' <> 'saved' or (receipt->>'submission_id')::uuid <> first_submission
    or (select count(*) from public.submission_photos where submission_id = first_submission) <> 1
    or (select jsonb_array_length(notes) from public.submissions where id = first_submission) <> 1 then
    raise exception 'Retry duplicated photo evidence or captions';
  end if;
  perform public.finish_telegram_reply(910005, other_owner, true);
  if public.prepare_telegram_intake(910005, photo_payload, owner_id)->>'reply_sent_at' is null then
    raise exception 'Completed update should skip acknowledgement on replay';
  end if;
  begin
    perform public.prepare_telegram_intake(910005, photo_payload || '{"text":"Rewritten source"}', owner_id);
    raise exception 'FAIL: replay changed original payload';
  exception when raise_exception then
    if sqlerrm <> 'Telegram update payload cannot change on replay' then raise; end if;
  end;
  raise notice 'PASS: WAT dates, leases, pending guard, repeat finalization and immutable replay';

  voice_payload := payload || '{"kind":"voice","file_id":"test-voice","content_type":"audio/ogg"}';
  receipt := public.prepare_telegram_intake(910006, voice_payload, owner_id);
  if (receipt->>'submission_id')::uuid <> first_submission then raise exception 'Photos-first did not join voice'; end if;
  perform public.finish_telegram_media(910006, owner_id);
  select audio_url into first_audio from public.submissions where id = first_submission;
  if first_audio not like 'site-evidence/%/910006.ogg' then raise exception 'Audio reference is not stable'; end if;

  for i in 1..4 loop
    receipt := public.prepare_telegram_intake(910010 + i, photo_payload, owner_id);
    perform public.finish_telegram_media(910010 + i, owner_id);
  end loop;
  receipt := public.prepare_telegram_intake(910015, photo_payload, owner_id);
  if receipt->>'storage_path' is not null or (select count(*) from public.submission_photos
    where submission_id = first_submission) <> 5 then raise exception 'More than 5 photos accepted'; end if;

  receipt := public.prepare_telegram_intake(910016, voice_payload, owner_id);
  next_submission := (receipt->>'submission_id')::uuid;
  perform public.finish_telegram_media(910016, owner_id);
  if first_submission = next_submission or (select audio_url from public.submissions where id = first_submission) <> first_audio then
    raise exception 'An additional voice note overwrote original audio';
  end if;
  update public.submissions set status = 'confirmed' where id = next_submission;
  receipt := public.prepare_telegram_intake(910017, photo_payload, owner_id);
  if (receipt->>'submission_id')::uuid = next_submission then raise exception 'Confirmed evidence was changed'; end if;
  raise notice 'PASS: photos-first, stable audio, 5-photo limit, extra voice preserved, confirmed evidence untouched';

  if has_table_privilege('anon', 'public.telegram_updates', 'select')
    or has_table_privilege('authenticated', 'public.telegram_updates', 'select')
    or has_function_privilege('anon', 'public.prepare_telegram_intake(bigint,jsonb,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.finish_telegram_media(bigint,uuid)', 'execute')
    or (select public from storage.buckets where id = 'site-evidence') then
    raise exception 'Intake receipts or media are accessible publicly';
  end if;
  raise notice 'PASS: receipt RPCs are service-only and evidence bucket is private';
end;
$$;
rollback;
