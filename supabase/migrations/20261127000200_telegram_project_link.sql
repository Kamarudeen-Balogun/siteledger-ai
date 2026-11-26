begin;

alter table public.account_link_challenges
  add column project_id uuid references public.account_projects(project_id) on delete restrict;

create function public.account_start_project_link(p_hash text,p_secret_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; access jsonb; challenge public.account_link_challenges%rowtype;
begin
  actor:=public.account_session(p_hash,true);
  if actor is null then return jsonb_build_object('error','reauthenticate'); end if;
  if not (actor->>'email_verified')::boolean then return jsonb_build_object('error','verify_email'); end if;
  if not public.account_limit('link:'||(actor->>'profile_id'),10,3600) then return jsonb_build_object('error','rate_limited'); end if;
  if p_project is not null then
    access:=public.account_project_access(p_hash,p_project,true);
    if access is null or access ? 'error' then return jsonb_build_object('error','project_unavailable'); end if;
  end if;
  -- account_session's update locks this browser session while the code is rotated.
  update public.account_link_challenges set consumed_at=clock_timestamp()
    where session_hash=p_hash and consumed_at is null and expires_at>clock_timestamp();
  insert into public.account_link_challenges(secret_hash,session_hash,profile_id,project_id,expires_at)
    values(p_secret_hash,p_hash,(actor->>'profile_id')::uuid,p_project,clock_timestamp()+interval '10 minutes')
    returning * into challenge;
  return jsonb_build_object('id',challenge.id,'expires_at',challenge.expires_at);
end; $$;

create or replace function public.account_prove_telegram(p_secret_hash text,p_telegram bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.account_link_challenges%rowtype; linked_person uuid;
begin
  if not public.account_limit('link-proof:'||p_telegram,20,3600) then return jsonb_build_object('error','unavailable'); end if;
  select * into c from public.account_link_challenges where secret_hash=p_secret_hash for update;
  if not found or c.expires_at<=clock_timestamp() or c.consumed_at is not null or c.proved_at is not null
    or not coalesce((public.account_session(c.session_hash,false,false)->>'email_verified')::boolean,false) then
    return jsonb_build_object('error','unavailable');
  end if;
  select profile_id into linked_person from public.account_telegram_links where telegram_id=p_telegram and active;
  update public.account_link_challenges set telegram_id=p_telegram,telegram_profile_id=linked_person,proved_at=clock_timestamp() where id=c.id;
  insert into public.account_identity_events(actor_profile_id,subject_profile_id,action)
    values(public.account_person(c.profile_id),public.account_person(c.profile_id),'telegram_proved');
  return jsonb_build_object('proved',true);
end; $$;

create or replace function public.account_link_status(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.account_link_challenges%rowtype; actor jsonb; person uuid;
begin
  actor:=public.account_session(p_hash,false,false);
  if actor is null or not (actor->>'email_verified')::boolean then return null; end if;
  select * into c from public.account_link_challenges where id=p_id and session_hash=p_hash;
  if not found or c.expires_at<=clock_timestamp() or c.consumed_at is not null then return null; end if;
  person:=public.account_person(c.telegram_profile_id);
  return jsonb_build_object('id',c.id,'proved',c.proved_at is not null,'telegram_id',c.telegram_id,
    'combining_profiles',person is not null and person<>(actor->>'profile_id')::uuid,
    'other_browser_proof_required',exists(select 1 from public.account_browser_identities b where b.auth_user_id is not null
      and public.account_person(b.profile_id)=person and b.auth_user_id<>(actor->>'auth_user_id')::uuid));
end; $$;

create or replace function public.account_finish_link(p_hash text,p_id uuid,p_combine boolean,p_other_user uuid default null,p_other_auth_session uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; access jsonb; c public.account_link_challenges%rowtype; target uuid; source uuid;
  old_link public.account_telegram_links%rowtype; existing_browser uuid; next_project uuid; new_link uuid;
begin
  actor:=public.account_session(p_hash,true);
  if actor is null then return jsonb_build_object('error','reauthenticate'); end if;
  if not (actor->>'email_verified')::boolean then return jsonb_build_object('error','verify_email'); end if;
  select * into c from public.account_link_challenges where id=p_id and session_hash=p_hash for update;
  if not found or c.expires_at<=clock_timestamp() or c.consumed_at is not null or c.proved_at is null then return jsonb_build_object('error','unavailable'); end if;
  target:=(actor->>'profile_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('siteledger-account-merge',0));
  target:=public.account_person(target);
  source:=public.account_person(c.telegram_profile_id);
  if c.project_id is not null then
    access:=public.account_project_access(p_hash,c.project_id,true);
    if access is null or access ? 'error' then return jsonb_build_object('error','project_unavailable'); end if;
  end if;
  select * into old_link from public.account_telegram_links where telegram_id=c.telegram_id and active for update;
  if old_link.profile_id is distinct from c.telegram_profile_id then return jsonb_build_object('error','changed'); end if;
  if source is not null and source<>target then
    if not p_combine then return jsonb_build_object('error','combine_required'); end if;
    for existing_browser in select auth_user_id from public.account_browser_identities where auth_user_id is not null and public.account_person(profile_id)=source loop
      if existing_browser<>(actor->>'auth_user_id')::uuid and (existing_browser is distinct from p_other_user or not exists(
        select 1 from auth.sessions a where a.id=p_other_auth_session and a.user_id=p_other_user and a.created_at>clock_timestamp()-interval '10 minutes'
          and (a.not_after is null or a.not_after>clock_timestamp())
      )) then return jsonb_build_object('error','other_browser_proof_required'); end if;
    end loop;
    insert into public.account_profile_aliases(profile_id,canonical_id) values(source,target);
    insert into public.account_identity_events(actor_profile_id,subject_profile_id,action,details)
      values(target,source,'profiles_combined',jsonb_build_object('canonical_profile_id',target));
  end if;
  next_project:=coalesce(c.project_id,old_link.active_project_id);
  update public.account_telegram_links set active=false,revoked_at=clock_timestamp()
    where active and (telegram_id=c.telegram_id or public.account_person(profile_id)=target);
  insert into public.account_telegram_links(telegram_id,profile_id) values(c.telegram_id,target) returning id into new_link;
  if next_project is not null then
    update public.account_telegram_links set active_project_id=next_project where id=new_link;
  end if;
  update public.account_sessions set revoked_at=clock_timestamp() where public.account_person(profile_id)=target and secret_hash<>p_hash and revoked_at is null;
  update public.account_link_challenges set consumed_at=clock_timestamp() where id=c.id;
  insert into public.account_identity_events(actor_profile_id,subject_profile_id,action,details)
    values(target,target,'telegram_linked',case when c.project_id is null then '{}'::jsonb else jsonb_build_object('project_id',c.project_id) end);
  return public.account_session(p_hash);
end; $$;

revoke all on function public.account_start_project_link(text,text,uuid) from public,anon,authenticated;
grant execute on function public.account_start_project_link(text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
