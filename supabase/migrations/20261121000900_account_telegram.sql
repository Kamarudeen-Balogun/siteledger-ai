-- Task 10A Telegram uses the shared verified account and project memberships.
begin;
alter table public.account_telegram_links add column active_project_id uuid references public.account_projects(project_id) on delete restrict;
alter table public.telegram_updates add column reply_path text,add column payload_digest text;

create function public.account_bot_context(p_telegram bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.account_telegram_links%rowtype; person uuid; profile public.account_profiles%rowtype; p public.account_projects%rowtype; work_role text;
begin
  select * into link from public.account_telegram_links where telegram_id=p_telegram and active;
  if not found then return null; end if;
  person := public.account_person(link.profile_id);
  if not exists(select 1 from public.account_browser_identities b join auth.users u on u.id=b.auth_user_id where public.account_person(b.profile_id)=person
    and b.email_verified=lower(u.email) and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())) then return null; end if;
  select * into profile from public.account_profiles where id=person;
  select * into p from public.account_projects where project_id=link.active_project_id;
  select role into work_role from public.account_memberships where project_id=p.project_id and active and public.account_person(profile_id)=person order by (role='pm') desc limit 1;
  if not found then return jsonb_build_object('profile_id',person,'professional_name',profile.professional_name,'name_confirmed_at',profile.name_confirmed_at); end if;
  return jsonb_build_object('profile_id',person,'professional_name',profile.professional_name,'name_confirmed_at',profile.name_confirmed_at,
    'project_id',p.project_id,'project_name',(select name from public.projects where id=p.project_id),'role',work_role,'currency',p.currency,'timezone',p.timezone,'archived_at',p.archived_at);
end; $$;

create function public.account_bot_default_project() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid; person uuid;
begin
  person := public.account_person(new.profile_id);
  select s.active_project_id into project from public.account_sessions s where s.source='browser' and s.revoked_at is null and s.expires_at>now() and public.account_person(s.profile_id)=person
    and exists(select 1 from public.account_memberships where project_id=s.active_project_id and active and public.account_person(profile_id)=person) order by s.created_at desc limit 1;
  if project is null and (select count(distinct project_id) from public.account_memberships where active and public.account_person(profile_id)=person)=1 then
    select project_id into project from public.account_memberships where active and public.account_person(profile_id)=person limit 1;
  end if;
  new.active_project_id:=project;return new;
end; $$;
create trigger account_bot_project_on_link before insert on public.account_telegram_links for each row execute function public.account_bot_default_project();
update public.account_telegram_links l set active_project_id=m.project_id from public.account_memberships m where l.active and m.active
  and public.account_person(l.profile_id)=public.account_person(m.profile_id) and (select count(distinct project_id) from public.account_memberships where active and public.account_person(profile_id)=public.account_person(l.profile_id))=1;

create or replace function public.account_select_project(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor:=public.account_project_access(p_hash,p_project);
  if actor is null then return jsonb_build_object('error','unavailable'); end if;
  update public.account_sessions set active_project_id=p_project where secret_hash=p_hash;
  update public.account_telegram_links set active_project_id=p_project where active and public.account_person(profile_id)=(actor->>'profile_id')::uuid;
  return actor;
end; $$;

create function public.account_bot_latest(p_telegram bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; note uuid;
begin
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null then return null; end if;
  select s.id into note from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
    where s.project_id=(ctx->>'project_id')::uuid and (ctx->>'role'='pm' or public.account_person(coalesce(sp.profile_id,l.profile_id))=(ctx->>'profile_id')::uuid)
    order by s.created_at desc,s.id desc limit 1;
  return note;
end; $$;

create function public.account_bot_today(p_telegram bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; note uuid;
begin
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null or ctx->>'name_confirmed_at' is null then return null; end if;
  select s.id into note from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
    where s.project_id=(ctx->>'project_id')::uuid and coalesce(sp.site_date,s.site_date)=(clock_timestamp() at time zone (ctx->>'timezone'))::date
      and (ctx->>'role'='pm' or public.account_person(coalesce(sp.profile_id,l.profile_id))=(ctx->>'profile_id')::uuid)
    order by s.created_at desc,s.id desc limit 1;
  return jsonb_build_object('project_name',ctx->>'project_name','currency',ctx->>'currency','note_id',note,'input',case when note is not null then public.account_assemble_report(note) else null end);
end; $$;

create function public.account_telegram_media_allowed(p_update_id bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.telegram_updates%rowtype; ctx jsonb; project uuid; person uuid;
begin
  select * into r from public.telegram_updates where update_id=p_update_id;
  if not found then return false; end if;
  ctx:=public.account_bot_context((r.payload->>'user_id')::bigint);
  select s.project_id,coalesce(sp.profile_id,l.profile_id) into project,person from public.submissions s
    left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id where s.id=r.submission_id;
  perform 1 from public.account_projects where project_id=project and archived_at is null for share;
  if not found or ctx is null or public.account_person(person) is distinct from (ctx->>'profile_id')::uuid then return false; end if;
  perform 1 from public.account_memberships where project_id=project and active and public.account_person(profile_id)=(ctx->>'profile_id')::uuid for share;
  return found;
end; $$;

create function public.account_resume_telegram(p_telegram bigint,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; r public.telegram_updates%rowtype;
begin
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null or ctx->>'archived_at' is not null then return null; end if;
  select u.* into r from public.telegram_updates u join public.submissions s on s.id=u.submission_id
    where (u.payload->>'user_id')::bigint=p_telegram and u.status='pending' and u.storage_path is not null
      and s.project_id=(ctx->>'project_id')::uuid and (u.lease_until is null or u.lease_until<=now() or u.claim_owner=p_owner)
    order by u.update_id limit 1 for update of u skip locked;
  if not found or not public.account_telegram_media_allowed(r.update_id) then return null; end if;
  update public.telegram_updates set claim_owner=p_owner,lease_until=now()+interval '90 seconds' where update_id=r.update_id returning * into r;
  return to_jsonb(r);
end; $$;

create function public.account_prepare_telegram(p_update_id bigint,p_payload jsonb,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.telegram_updates%rowtype; ctx jsonb; sanitized jsonb:=p_payload; fingerprint text;
  kind text:=p_payload->>'kind'; tg bigint:=(p_payload->>'user_id')::bigint; reply text; path text; selected uuid; project uuid; source_day date;
begin
  fingerprint:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  ctx:=public.account_bot_context(tg);
  if ctx is null or ctx->>'project_id' is null or ctx->>'archived_at' is not null then sanitized:=p_payload-array['text','file_id','content_type']; end if;
  insert into public.telegram_updates(update_id,payload,payload_digest) values(p_update_id,sanitized,fingerprint) on conflict(update_id) do nothing;
  select * into strict r from public.telegram_updates where update_id=p_update_id for update;
  if r.payload_digest is not null and r.payload_digest<>fingerprint then raise exception 'Telegram replay payload changed'; end if;
  if r.payload_digest is null and r.payload<>p_payload then raise exception 'Telegram replay payload changed'; end if;
  if r.status='pending' and r.storage_path is not null and not public.account_telegram_media_allowed(p_update_id) then
    -- Keep the reserved receipt and media reference, but deny all further downloads.
    return to_jsonb(r)||jsonb_build_object('status','blocked','submission_id',null,'storage_path',null,'reply_sent_at',null,
      'reply_text','This saved upload is blocked by changed project access. After access is restored, select its original project and use /today to resume saved media.','reply_path','/projects');
  end if;
  if r.reply_sent_at is not null then return to_jsonb(r); end if;
  if r.lease_until>now() and r.claim_owner is distinct from p_owner then return jsonb_build_object('busy',true); end if;
  update public.telegram_updates set claim_owner=p_owner,lease_until=now()+interval '90 seconds' where update_id=p_update_id returning * into r;
  if r.reply_text is not null then return to_jsonb(r); end if;
  perform pg_advisory_xact_lock(tg);
  path:='/account';
  if not public.account_limit('bot-global',1000,60) or not public.account_limit('bot:'||tg,30,60) then reply:='Too many messages just now. Wait a little; your saved site notes are preserved.';
  elsif p_payload ? 'link_hash' then
    if (public.account_prove_telegram(p_payload->>'link_hash',tg)->>'proved')::boolean then reply:='Telegram ownership proved. Return to the website account that created this link and confirm the connection.';
    else reply:='This connection link expired or was already used. Start a new link from your website account.'; end if;
  elsif kind='logout' then
    update public.account_telegram_links set active=false,revoked_at=clock_timestamp() where telegram_id=tg and active;
    update public.account_sessions set revoked_at=clock_timestamp() where source='telegram' and telegram_link_id in(select id from public.account_telegram_links where telegram_id=tg) and revoked_at is null;
    if ctx is not null then insert into public.account_identity_events(actor_profile_id,subject_profile_id,action,details) values((ctx->>'profile_id')::uuid,(ctx->>'profile_id')::uuid,'telegram_unlinked',jsonb_build_object('channel','bot_logout'));end if;
    reply:='Telegram access signed out. Your records are preserved. Open SiteLedger and sign in to reconnect.';
  elsif kind='help' then reply:='1. Open SiteLedger and sign in. 2. Choose your project. 3. Send a voice note, then up to 5 photos. 4. Review and confirm the quantities. Passwords belong only in the secure form.';
  elsif ctx is null then reply:='Welcome to SiteLedger AI. Open the secure form to sign in or create your account. Use the same email on the website and in Telegram. Never send passwords in chat.';
  elsif ctx->>'name_confirmed_at' is null then reply:='Confirm your professional name in SiteLedger before sending site records.';
  elsif kind='account' then reply:='Open your account to manage your name, email and Telegram connection. Password recovery is on the sign-in page.';
  elsif kind='projects' then path:='/projects';reply:='Open your authorized projects and choose where to record work. Your queued notes keep their original project.';
  elsif kind='start' and p_payload ? 'project_code' then
    select p.id into project from public.projects p join public.account_projects a on a.project_id=p.id where p.project_code=p_payload->>'project_code'
      and exists(select 1 from public.account_memberships m where m.project_id=p.id and m.active and public.account_person(m.profile_id)=(ctx->>'profile_id')::uuid);
    if project is null then reply:='This project is unavailable to your account. Open your authorized projects or ask its owner for an invitation.';path:='/projects';
    else update public.account_telegram_links set active_project_id=project where telegram_id=tg and active;ctx:=public.account_bot_context(tg);reply:='Active project: '||(ctx->>'project_name')||'. Signed in as '||(ctx->>'professional_name')||' / '||(ctx->>'role')||'. Send a voice note and site photos.';path:='/projects/'||project;end if;
  elsif ctx->>'project_id' is null then reply:='You are signed in as '||(ctx->>'professional_name')||'. Choose an authorized project before sending site records.';path:='/projects';
  elsif kind='reports' then reply:='Open the saved records for '||(ctx->>'project_name')||'. Foremen see their own records; PMs review project work.';path:='/projects/'||(ctx->>'project_id');
  elsif kind='start' then reply:='Active project: '||(ctx->>'project_name')||'. Signed in as '||(ctx->>'professional_name')||' / '||(ctx->>'role')||'. Send a voice note, then up to 5 photos.';path:='/projects/'||(ctx->>'project_id');
  elsif kind='today' then selected:=public.account_bot_latest(tg);reply:=(ctx->>'project_name')||': '||case when selected is null then 'No site note yet. Send a voice note to begin.' else 'Open your latest site note to review its quantities and progress.' end;path:=case when selected is null then '/today' else '/confirm/'||selected end;selected:=null;
  elsif ctx->>'archived_at' is not null then reply:='This project is archived. Its existing records are preserved. Ask the owner to restore it before sending new work.';path:='/projects/'||(ctx->>'project_id');
  elsif kind='unsupported' then reply:='Use the microphone for a voice note or send a compressed site photo. Open /help for the steps.';
  elsif kind='too_large' then reply:='That file is too large. Send a shorter voice note or a compressed Telegram photo.';
  else
    project:=(ctx->>'project_id')::uuid;
    perform 1 from public.account_projects where project_id=project and archived_at is null for share;
    source_day:=(to_timestamp((p_payload->>'sent_at')::bigint) at time zone (ctx->>'timezone'))::date;
    select s.id into selected from public.submissions s join public.account_submission_people sp on sp.submission_id=s.id
      where s.project_id=project and public.account_person(sp.profile_id)=(ctx->>'profile_id')::uuid and sp.site_date=source_day and s.source='telegram' and s.status in('received','extracted')
        and (kind<>'voice' or (s.status='received' and s.audio_url is null and not exists(select 1 from public.telegram_updates where submission_id=s.id and payload->>'kind'='voice' and storage_path is not null))) order by s.created_at desc,s.id desc limit 1 for update;
    if selected is null then
      insert into public.submissions(project_id,submitted_by,source,created_at) values(project,ctx->>'professional_name','telegram',to_timestamp((p_payload->>'sent_at')::bigint)) returning id into selected;
      insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date) values(selected,(ctx->>'profile_id')::uuid,ctx->>'role',ctx->>'professional_name',ctx->>'currency',ctx->>'timezone',source_day);
    end if;
    if kind='photo' and (select count(*) from public.telegram_updates where submission_id=selected and payload->>'kind'='photo' and storage_path is not null)>=5 then reply:='This site note already has 5 photos saved or queued.';selected:=null;
    else
      if nullif(p_payload->>'text','') is not null then update public.submissions set notes=notes||jsonb_build_array(jsonb_build_object('text',p_payload->>'text','update_id',p_update_id,'sent_at',p_payload->>'sent_at')) where id=selected;end if;
      if kind in('voice','photo') then
        update public.telegram_updates set storage_path=project::text||'/'||selected::text||'/'||p_update_id::text||case when kind='photo' then '.jpg' when p_payload->>'content_type'='audio/mpeg' then '.mp3' when p_payload->>'content_type'='audio/mp4' then '.m4a' else '.ogg' end where update_id=p_update_id;
        reply:=(ctx->>'project_name')||': '||case when kind='voice' then 'Got it — working on your site note. Send the photos next.' else 'Photo saved with your site note.' end;
      else reply:=(ctx->>'project_name')||': Note saved with today''s work.';end if;
      path:='/confirm/'||selected;
    end if;
  end if;
  update public.telegram_updates set submission_id=selected,reply_text=reply,reply_path=path,status=case when storage_path is null then 'saved' else 'pending' end,saved_at=case when storage_path is null then now() else null end where update_id=p_update_id returning * into r;
  return to_jsonb(r);
end; $$;

create function public.account_finish_telegram_media(p_update_id bigint,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.telegram_updates%rowtype; person uuid; project uuid;
begin
  if not public.account_telegram_media_allowed(p_update_id) then raise exception 'Project access unavailable'; end if;
  select * into strict r from public.telegram_updates where update_id=p_update_id;
  select public.account_person(profile_id) into person from public.account_telegram_links where telegram_id=(r.payload->>'user_id')::bigint and active;
  select project_id into project from public.submissions where id=r.submission_id;
  perform 1 from public.account_projects where project_id=project and archived_at is null for share;
  if not found or person is null or not exists(select 1 from public.account_memberships where project_id=project and active and public.account_person(profile_id)=person) then raise exception 'Project access unavailable';end if;
  perform public.finish_telegram_media(p_update_id,p_owner);
end; $$;
revoke all on function public.account_bot_context(bigint),public.account_bot_latest(bigint),public.account_prepare_telegram(bigint,jsonb,uuid),public.account_finish_telegram_media(bigint,uuid),public.account_bot_default_project() from public,anon,authenticated;
revoke all on function public.account_bot_today(bigint),public.account_telegram_media_allowed(bigint),public.account_resume_telegram(bigint,uuid) from public,anon,authenticated;
grant execute on function public.account_bot_context(bigint),public.account_bot_latest(bigint),public.account_bot_today(bigint),public.account_resume_telegram(bigint,uuid),public.account_prepare_telegram(bigint,jsonb,uuid),public.account_finish_telegram_media(bigint,uuid) to service_role;
notify pgrst,'reload schema';
commit;
