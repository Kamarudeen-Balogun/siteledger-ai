-- Task 8 security follow-up, builder request of 19 November 2026.
-- Existing explicitly authorized accounts remain linked; codes cannot enroll or reassign people.
-- Self-service invitations and project memberships follow in task 10A.
begin;

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
    -- A known code identifies a site; only a previously authorized account may use it.
    if selected_project is null or linked_user.telegram_id is null
      or linked_user.project_id is distinct from selected_project then
      reply := 'Ask the project owner to grant you access before sending site records.';
    else
      reply := 'You are connected to your authorized site. Send a voice note and up to 5 site photos.';
    end if;
  elsif kind = 'help' then
    reply := 'Send a voice note about today''s work, then up to 5 site photos. Use the project link first if you have not connected.';
  elsif linked_user.telegram_id is null then
    reply := 'Ask the project owner to grant you access before sending site records.';
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

commit;
