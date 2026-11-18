-- Task 4: durable voice processing and immutable transcript checkpoints.
begin;

create table public.submission_ai_jobs (
  submission_id uuid primary key references public.submissions(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'processing', 'extracted', 'manual_entry')),
  claim_owner uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  detected_languages text[] not null default '{}',
  error_code text check (error_code in ('transcription_failed', 'extraction_invalid', 'extraction_failed', 'audio_unavailable')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.submission_ai_jobs enable row level security;
revoke all on public.submission_ai_jobs from public, anon, authenticated, service_role;
grant select on public.submission_ai_jobs to service_role;

create function public.enqueue_voice_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.audio_url is null and new.audio_url is not null and new.status = 'received' then
    insert into public.submission_ai_jobs(submission_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger enqueue_voice_submission after update of audio_url on public.submissions
for each row execute function public.enqueue_voice_submission();
insert into public.submission_ai_jobs(submission_id)
select id from public.submissions where status = 'received' and audio_url is not null and transcript is null;

create function public.claim_ai_submission(p_submission_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.submission_ai_jobs%rowtype; submission public.submissions%rowtype; mime text;
begin
  select * into job from public.submission_ai_jobs where submission_id = p_submission_id for update;
  if not found or job.status in ('extracted', 'manual_entry')
    or (job.lease_until > now() and job.claim_owner is distinct from p_owner) then return null; end if;
  select * into submission from public.submissions where id = p_submission_id for update;
  if submission.status not in ('received', 'extracted') or submission.audio_url is null then return null; end if;
  update public.submission_ai_jobs set status = 'processing', claim_owner = p_owner,
    lease_until = now() + interval '3 minutes', attempts = attempts + 1 where submission_id = p_submission_id;
  select payload->>'content_type' into mime from public.telegram_updates
  where submission_id = p_submission_id and payload->>'kind' = 'voice' and status = 'saved' limit 1;
  return jsonb_build_object('submission_id', submission.id, 'audio_url', submission.audio_url,
    'transcript', submission.transcript, 'content_type', coalesce(mime, 'audio/ogg'),
    'detected_languages', job.detected_languages, 'boq_hints', (
      select coalesce(jsonb_agg(jsonb_build_object('description', description, 'unit', unit) order by item_code), '[]'::jsonb)
      from public.boq_items where project_id = submission.project_id
    ));
end;
$$;

create function public.save_ai_transcript(p_submission_id uuid, p_owner uuid, p_transcript text, p_languages text[])
returns void language plpgsql security definer set search_path = '' as $$
declare saved_transcript text;
begin
  perform 1 from public.submission_ai_jobs where submission_id = p_submission_id
    and status = 'processing' and claim_owner = p_owner for update;
  if not found then raise exception 'Voice processing lease is not owned'; end if;
  select transcript into saved_transcript from public.submissions where id = p_submission_id
    and status in ('received', 'extracted') for update;
  if not found then raise exception 'Voice processing requires unconfirmed evidence'; end if;
  if nullif(btrim(p_transcript), '') is null then raise exception 'Raw transcript is required'; end if;
  if saved_transcript is not null and saved_transcript <> p_transcript then
    raise exception 'The raw transcript is immutable; corrections belong in confirmed values';
  end if;
  if saved_transcript is null then update public.submissions set transcript = p_transcript where id = p_submission_id; end if;
  update public.submission_ai_jobs set detected_languages = p_languages where submission_id = p_submission_id;
end;
$$;

create function public.finish_ai_submission(p_submission_id uuid, p_owner uuid, p_extraction jsonb, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
declare saved_transcript text;
begin
  perform 1 from public.submission_ai_jobs where submission_id = p_submission_id
    and status = 'processing' and claim_owner = p_owner for update;
  if not found then raise exception 'Voice processing lease is not owned'; end if;
  select transcript into saved_transcript from public.submissions where id = p_submission_id
    and status in ('received', 'extracted') for update;
  if not found then raise exception 'Voice processing requires unconfirmed evidence'; end if;
  if p_extraction is not null then
    if saved_transcript is null then raise exception 'Save the raw transcript before extraction'; end if;
    if p_error is not null or jsonb_typeof(p_extraction) <> 'object'
      or not (p_extraction ?& array['work_items', 'materials', 'delays', 'issues', 'raw_language_notes'])
      or (select count(*) from jsonb_object_keys(p_extraction)) <> 5 then
      raise exception 'Extraction must use exactly the section 9 fields';
    end if;
    update public.submissions set extraction = p_extraction, status = 'extracted' where id = p_submission_id;
  elsif p_error is null then raise exception 'A manual-entry result needs its failure reason'; end if;
  update public.submission_ai_jobs set status = case when p_extraction is null then 'manual_entry' else 'extracted' end,
    error_code = p_error, lease_until = null, claim_owner = null, finished_at = now()
  where submission_id = p_submission_id;
end;
$$;

create function public.release_ai_submission(p_submission_id uuid, p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.submission_ai_jobs set status = 'queued', claim_owner = null, lease_until = null
  where submission_id = p_submission_id and status = 'processing' and claim_owner = p_owner;
end;
$$;

-- Audio extraction can complete while photos upload; confirmation must wait.
create or replace function public.guard_pending_telegram_media() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('confirmed', 'locked') and exists (
    select 1 from public.telegram_updates where submission_id = new.id and status = 'pending'
  ) then raise exception 'Wait for pending site evidence before confirmation'; end if;
  return new;
end;
$$;

revoke all on function public.enqueue_voice_submission(), public.claim_ai_submission(uuid, uuid),
  public.save_ai_transcript(uuid, uuid, text, text[]), public.finish_ai_submission(uuid, uuid, jsonb, text),
  public.release_ai_submission(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_submission(uuid, uuid), public.save_ai_transcript(uuid, uuid, text, text[]),
  public.finish_ai_submission(uuid, uuid, jsonb, text), public.release_ai_submission(uuid, uuid) to service_role;

-- Intake functions are updated below to accept photos/notes until confirmation.
create or replace function public.prepare_telegram_intake(p_update_id bigint, p_payload jsonb, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  receipt public.telegram_updates%rowtype;
  linked_user public.telegram_users%rowtype;
  selected_project uuid;
  selected_submission uuid;
  site_day date := (to_timestamp((p_payload->>'sent_at')::bigint) at time zone 'Africa/Lagos')::date;
  user_id bigint := (p_payload->>'user_id')::bigint;
  kind text := p_payload->>'kind';
  reply text;
  object_path text;
begin
  insert into public.telegram_updates(update_id, payload) values (p_update_id, p_payload)
  on conflict (update_id) do nothing;
  select * into strict receipt from public.telegram_updates where update_id = p_update_id for update;
  if receipt.payload <> p_payload then raise exception 'Telegram update payload cannot change on replay'; end if;
  if receipt.reply_sent_at is not null then return to_jsonb(receipt); end if;
  if receipt.lease_until > now() and receipt.claim_owner is distinct from p_owner then
    return jsonb_build_object('busy', true);
  end if;
  update public.telegram_updates set claim_owner = p_owner, lease_until = now() + interval '90 seconds'
  where update_id = p_update_id returning * into receipt;
  if receipt.reply_text is not null then return to_jsonb(receipt); end if;

  -- Serialize all messages from one foreman, including photo albums.
  perform pg_advisory_xact_lock(user_id);
  select * into linked_user from public.telegram_users where telegram_id = user_id for update;
  if kind = 'start' then
    select id into selected_project from public.projects
    where project_code = p_payload->>'project_code' and is_demo;
    if selected_project is null then
      reply := 'Open the SiteLedger project link to connect, then send your voice note.';
    else
      insert into public.telegram_users(telegram_id, display_name, project_id, role)
      values (user_id, p_payload->>'display_name', selected_project, 'foreman')
      on conflict (telegram_id) do update set display_name = excluded.display_name,
        project_id = excluded.project_id,
        role = case when public.telegram_users.project_id = excluded.project_id
          then public.telegram_users.role else 'foreman' end;
      reply := 'You are linked to the Lekki demo site. Send a voice note and up to 5 site photos.';
    end if;
  elsif kind = 'help' then
    reply := 'Send a voice note about today''s work, then up to 5 site photos. Use the project link first if you have not connected.';
  elsif linked_user.telegram_id is null then
    reply := 'Connect to the site first: https://t.me/SiteLedgerNGbot?start=LEKKI-DEMO-01';
  elsif kind = 'unsupported' then
    reply := 'Send a voice note or site photos using Telegram''s microphone and camera buttons.';
  elsif kind = 'too_large' then
    reply := 'That file is too large. Send a shorter voice note or send the photo as a compressed Telegram photo.';
  elsif kind = 'today' then
    if exists (select 1 from public.submissions where telegram_id = user_id
      and project_id = linked_user.project_id and site_date = site_day) then
      reply := 'Your site note is saved. You can send photos or another note about today''s work.';
    else reply := 'No site note yet today. Send a voice note to start.'; end if;
  else
    select s.id into selected_submission from public.submissions s
    where s.telegram_id = user_id and s.project_id = linked_user.project_id
      and s.site_date = site_day and s.status in ('received', 'extracted') and s.source = 'telegram'
      and (kind <> 'voice' or (s.status = 'received' and s.audio_url is null and not exists (
        select 1 from public.telegram_updates u where u.submission_id = s.id
          and u.payload->>'kind' = 'voice' and u.storage_path is not null
      )))
    order by s.created_at desc, s.id desc limit 1 for update;
    if selected_submission is null then
      insert into public.submissions(project_id, telegram_id, submitted_by, source, created_at)
      values (linked_user.project_id, user_id, linked_user.display_name, 'telegram',
        to_timestamp((p_payload->>'sent_at')::bigint))
      returning id into selected_submission;
    end if;
    if kind = 'photo' and (
      select count(*) from public.telegram_updates where submission_id = selected_submission
        and payload->>'kind' = 'photo' and storage_path is not null
    ) >= 5 then
      reply := 'This site note already has 5 photos saved or queued.';
      selected_submission := null;
    else
      if nullif(p_payload->>'text', '') is not null then
        update public.submissions set notes = notes || jsonb_build_array(jsonb_build_object(
          'text', p_payload->>'text', 'update_id', p_update_id, 'sent_at', p_payload->>'sent_at'
        )) where id = selected_submission;
      end if;
      if kind in ('voice', 'photo') then
        object_path := linked_user.project_id::text || '/' || selected_submission::text
          || '/' || p_update_id::text || case when kind = 'photo' then '.jpg'
            when p_payload->>'content_type' = 'audio/mpeg' then '.mp3'
            when p_payload->>'content_type' = 'audio/mp4' then '.m4a' else '.ogg' end;
        reply := case when kind = 'voice' then 'Got it — your voice note is saved. Send the site photos next.'
          else 'Photo saved with your site note.' end;
      else reply := 'Note saved with today''s submission.'; end if;
    end if;
  end if;
  update public.telegram_updates set submission_id = selected_submission,
    storage_path = object_path, reply_text = reply,
    status = case when object_path is null then 'saved' else 'pending' end,
    saved_at = case when object_path is null then now() else null end
  where update_id = p_update_id returning * into receipt;
  return to_jsonb(receipt);
end;
$$;

create or replace function public.finish_telegram_media(p_update_id bigint, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.telegram_updates%rowtype;
begin
  select * into strict receipt from public.telegram_updates where update_id = p_update_id for update;
  if receipt.claim_owner is distinct from p_owner then raise exception 'Intake lease is not owned'; end if;
  if receipt.status = 'saved' then return; end if;
  perform 1 from public.submissions where id = receipt.submission_id and status in ('received', 'extracted')
    and (receipt.payload->>'kind' <> 'voice' or status = 'received') for update;
  if not found then raise exception 'Intake requires an open submission'; end if;
  if receipt.storage_path is null then raise exception 'No media was reserved'; end if;
  if receipt.payload->>'kind' = 'voice' then
    update public.submissions set audio_url = 'site-evidence/' || receipt.storage_path
    where id = receipt.submission_id and audio_url is null;
    if not found then raise exception 'Original audio cannot be overwritten'; end if;
  else
    insert into public.submission_photos(submission_id, storage_url)
    values (receipt.submission_id, 'site-evidence/' || receipt.storage_path);
  end if;
  update public.telegram_updates set status = 'saved', saved_at = now() where update_id = p_update_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
