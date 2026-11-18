-- Task 3: private evidence, daily grouping, and replay-safe Telegram intake.
begin;

alter table public.submissions add column site_date date
  generated always as ((created_at at time zone 'Africa/Lagos')::date) stored;
alter table public.submissions add column notes jsonb not null default '[]'::jsonb
  check (jsonb_typeof(notes) = 'array');
create index submissions_telegram_day_idx on public.submissions(telegram_id, project_id, site_date, created_at desc)
  where source = 'telegram' and status = 'received';

create table public.telegram_updates (
  update_id bigint primary key,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'saved')),
  submission_id uuid references public.submissions(id) on delete restrict,
  storage_path text unique,
  reply_text text,
  reply_sent_at timestamptz,
  claim_owner uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  saved_at timestamptz
);
create index telegram_updates_submission_idx on public.telegram_updates(submission_id);
alter table public.telegram_updates enable row level security;
revoke all on public.telegram_updates from public, anon, authenticated, service_role;
grant select on public.telegram_updates to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('site-evidence', 'site-evidence', false, 20971520,
  array['audio/ogg', 'audio/mpeg', 'audio/mp4', 'image/jpeg']);

-- The server-only RPC reserves evidence before network I/O. Locks last only for
-- this database transaction; a short lease allows interrupted requests to retry.
create function public.prepare_telegram_intake(p_update_id bigint, p_payload jsonb, p_owner uuid)
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
      and s.site_date = site_day and s.status = 'received' and s.source = 'telegram'
      and (kind <> 'voice' or (s.audio_url is null and not exists (
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

create function public.finish_telegram_media(p_update_id bigint, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.telegram_updates%rowtype;
begin
  select * into strict receipt from public.telegram_updates where update_id = p_update_id for update;
  if receipt.claim_owner is distinct from p_owner then raise exception 'Intake lease is not owned'; end if;
  if receipt.status = 'saved' then return; end if;
  perform 1 from public.submissions where id = receipt.submission_id and status = 'received' for update;
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

create function public.finish_telegram_reply(p_update_id bigint, p_owner uuid, p_sent boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.telegram_updates set lease_until = null, claim_owner = null,
    reply_sent_at = case when p_sent and status = 'saved' then now() else reply_sent_at end
  where update_id = p_update_id and claim_owner = p_owner;
end;
$$;

-- Prevent confirmation/locking while an incoming file is still being saved.
create function public.guard_pending_telegram_media() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'received' and exists (
    select 1 from public.telegram_updates where submission_id = new.id and status = 'pending'
  ) then raise exception 'Wait for pending site evidence before processing or confirmation'; end if;
  return new;
end;
$$;
create trigger guard_pending_telegram_media before update of status on public.submissions
for each row execute function public.guard_pending_telegram_media();

revoke all on function public.prepare_telegram_intake(bigint, jsonb, uuid),
  public.finish_telegram_media(bigint, uuid), public.finish_telegram_reply(bigint, uuid, boolean),
  public.guard_pending_telegram_media() from public, anon, authenticated;
grant execute on function public.prepare_telegram_intake(bigint, jsonb, uuid),
  public.finish_telegram_media(bigint, uuid), public.finish_telegram_reply(bigint, uuid, boolean) to service_role;

notify pgrst, 'reload schema';
commit;
