-- Task 10A identity foundation. No existing evidence rows are rewritten.
begin;

create table public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  professional_name text,
  name_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((professional_name is null and name_confirmed_at is null) or
    (name_confirmed_at is not null and length(btrim(professional_name)) between 1 and 120
     and professional_name !~ '[[:cntrl:]]' and professional_name ~ '[^[:space:]]'))
);
create table public.account_profile_aliases (
  profile_id uuid primary key references public.account_profiles(id) on delete restrict,
  canonical_id uuid not null references public.account_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (profile_id <> canonical_id)
);
create table public.account_browser_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  email_verified text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  check ((email_verified is null) = (email_verified_at is null))
);
create table public.account_telegram_links (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null check (telegram_id between 1 and 9007199254740991),
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (active = (revoked_at is null))
);
create unique index account_one_telegram_link on public.account_telegram_links(telegram_id) where active;
create unique index account_one_telegram_profile on public.account_telegram_links(profile_id) where active;
create table public.account_sessions (
  secret_hash text primary key check (secret_hash ~ '^[a-f0-9]{64}$'),
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  source text not null check (source in ('browser','telegram','recovery')),
  auth_user_id uuid references auth.users(id) on delete set null,
  auth_session_id uuid,
  telegram_link_id uuid references public.account_telegram_links(id) on delete restrict,
  created_at timestamptz not null default now(),
  authenticated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check ((source in ('browser','recovery') and auth_session_id is not null and telegram_link_id is null)
    or (source='telegram' and auth_user_id is null and auth_session_id is null and telegram_link_id is not null)),
  check (expires_at > created_at and expires_at <= created_at + interval '12 hours')
);
create table public.account_limits (
  key text primary key check (length(key) <= 200),
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
create table public.account_identity_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.account_profiles(id) on delete restrict,
  subject_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  action text not null check (action in ('telegram_created','browser_created','professional_name','telegram_proved','telegram_linked','telegram_unlinked','profiles_combined')),
  created_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}'::jsonb
);
create table public.account_link_challenges (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  session_hash text not null references public.account_sessions(secret_hash) on delete restrict,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  telegram_id bigint,
  telegram_profile_id uuid references public.account_profiles(id) on delete restrict,
  proved_at timestamptz,
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.account_telegram_proofs (
  proof_hash text primary key check (proof_hash ~ '^[a-f0-9]{64}$'),
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  consumed_at timestamptz not null default clock_timestamp()
);

create function public.account_person(p_profile uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_id uuid := p_profile; next_id uuid; hops integer := 0;
begin
  loop
    select canonical_id into next_id from public.account_profile_aliases where profile_id=current_id;
    if not found then return current_id; end if;
    current_id := next_id; hops := hops + 1;
    if hops > 32 then raise exception 'Identity unavailable'; end if;
  end loop;
end; $$;

create function public.account_limit(p_key text,p_max integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare count_now integer;
begin
  if p_key is null or length(p_key)>200 or p_max not between 1 and 10000 or p_seconds not between 1 and 86400 then return false; end if;
  insert into public.account_limits(key,window_start,attempts) values(p_key,clock_timestamp(),1)
  on conflict(key) do update set
    attempts=case when account_limits.window_start + make_interval(secs=>p_seconds) <= clock_timestamp() then 1 else least(account_limits.attempts+1,p_max+1) end,
    window_start=case when account_limits.window_start + make_interval(secs=>p_seconds) <= clock_timestamp() then clock_timestamp() else account_limits.window_start end
  returning attempts into count_now;
  return count_now<=p_max;
end; $$;

create function public.account_session(p_hash text,p_recent boolean default false,p_touch boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.account_sessions%rowtype; person uuid; profile public.account_profiles%rowtype; identity public.account_browser_identities%rowtype;
begin
  select * into s from public.account_sessions where secret_hash=p_hash;
  if not found or s.revoked_at is not null or s.expires_at<=clock_timestamp()
    or s.last_used_at + interval '2 hours' <= clock_timestamp() or s.source='recovery'
    or (p_recent and (s.source<>'browser' or s.authenticated_at + interval '10 minutes' <= clock_timestamp())) then return null; end if;
  person := public.account_person(s.profile_id);
  if s.source='browser' then
    select * into identity from public.account_browser_identities where auth_user_id=s.auth_user_id;
    if not found or public.account_person(identity.profile_id)<>person or not exists(
      select 1 from auth.sessions a join auth.users u on u.id=a.user_id
      where a.id=s.auth_session_id and a.user_id=s.auth_user_id and (a.not_after is null or a.not_after>clock_timestamp())
        and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<clock_timestamp())
    ) then return null; end if;
  elsif not exists(select 1 from public.account_telegram_links l where l.id=s.telegram_link_id and l.active
    and public.account_person(l.profile_id)=person) or not exists(select 1 from public.account_browser_identities b join auth.users u on u.id=b.auth_user_id
      where public.account_person(b.profile_id)=person and b.email_verified=lower(u.email) and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<clock_timestamp())) then return null; end if;
  select * into profile from public.account_profiles where id=person;
  if p_touch then update public.account_sessions set last_used_at=clock_timestamp() where secret_hash=p_hash and revoked_at is null; end if;
  return jsonb_build_object('profile_id',person,'professional_name',profile.professional_name,'name_confirmed_at',profile.name_confirmed_at,
    'source',s.source,'auth_user_id',s.auth_user_id,'authenticated_at',s.authenticated_at,'expires_at',s.expires_at,
    'email',case when s.source='browser' then (select email from auth.users where id=s.auth_user_id) end,
    'email_verified',case when s.source='browser' then coalesce(identity.email_verified=(select lower(email) from auth.users where id=s.auth_user_id),false) else false end,
    'aliases',(select coalesce(jsonb_agg(p.id),'[]'::jsonb) from public.account_profiles p where public.account_person(p.id)=person),
    'telegram_linked',exists(select 1 from public.account_telegram_links l where l.active and public.account_person(l.profile_id)=person),
    'browser_linked',exists(select 1 from public.account_browser_identities b where b.auth_user_id is not null and public.account_person(b.profile_id)=person));
end; $$;

create function public.account_browser_session(p_user uuid,p_auth_session uuid,p_hash text,p_name text default null,p_recovery boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare person uuid; identity public.account_browser_identities%rowtype;
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_auth_session and s.user_id=p_user
    and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())) then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select * into identity from public.account_browser_identities where auth_user_id=p_user;
  if not found then
    insert into public.account_profiles default values returning id into person;
    insert into public.account_browser_identities(auth_user_id,profile_id) values(p_user,person);
    insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values(person,person,'browser_created');
  else person := public.account_person(identity.profile_id); end if;
  if p_name is not null then
    update public.account_profiles set professional_name=btrim(p_name),name_confirmed_at=clock_timestamp() where id=person;
    insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values(person,person,'professional_name');
  end if;
  insert into public.account_sessions(secret_hash,profile_id,source,auth_user_id,auth_session_id,expires_at)
    values(p_hash,person,case when p_recovery then 'recovery' else 'browser' end,p_user,p_auth_session,
      now()+case when p_recovery then interval '10 minutes' else interval '12 hours' end);
  return case when p_recovery then jsonb_build_object('profile_id',person,'source','recovery') else public.account_session(p_hash) end;
end; $$;

create function public.account_telegram_session(p_telegram bigint,p_hash text,p_proof_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.account_telegram_links%rowtype; person uuid;
begin
  if not public.account_limit('telegram-session:'||p_telegram,30,3600) then return jsonb_build_object('error','rate_limited'); end if;
  perform pg_advisory_xact_lock(p_telegram);
  select * into link from public.account_telegram_links where telegram_id=p_telegram and active;
  if not found then return jsonb_build_object('needs_login',true); end if;
  person := public.account_person(link.profile_id);
  if not exists(select 1 from public.account_browser_identities b join auth.users u on u.id=b.auth_user_id where public.account_person(b.profile_id)=person
    and b.email_verified=lower(u.email) and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())) then return jsonb_build_object('needs_login',true); end if;
  if p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('needs_login',true); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_proof_hash,0));
  if exists(select 1 from public.account_telegram_proofs where proof_hash=p_proof_hash) then return jsonb_build_object('needs_login',true); end if;
  insert into public.account_telegram_proofs(proof_hash,profile_id) values(p_proof_hash,person);
  insert into public.account_sessions(secret_hash,profile_id,source,telegram_link_id,expires_at)
    values(p_hash,public.account_person(link.profile_id),'telegram',link.id,clock_timestamp()+interval '1 hour');
  return public.account_session(p_hash);
end; $$;

create function public.account_profile_name(p_hash text,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; person uuid;
begin
  actor := public.account_session(p_hash);
  if actor is null then return null; end if;
  person := (actor->>'profile_id')::uuid;
  update public.account_profiles set professional_name=btrim(p_name),name_confirmed_at=clock_timestamp() where id=person;
  insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values(person,person,'professional_name');
  return public.account_session(p_hash);
end; $$;

create function public.account_attach_browser(p_hash text,p_user uuid,p_auth_session uuid,p_new_hash text,p_combine boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; source uuid; target uuid; identity public.account_browser_identities%rowtype;
begin
  actor := public.account_session(p_hash,false,false);
  if actor is null or actor->>'source'<>'telegram' or not exists(select 1 from auth.sessions a join auth.users u on u.id=a.user_id
    where a.id=p_auth_session and a.user_id=p_user and a.created_at>clock_timestamp()-interval '10 minutes'
      and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())) then return jsonb_build_object('error','unavailable'); end if;
  perform pg_advisory_xact_lock(hashtextextended('siteledger-account-merge',0));
  source := public.account_person((actor->>'profile_id')::uuid);
  if exists(select 1 from public.account_browser_identities b where b.auth_user_id is not null and public.account_person(b.profile_id)=source and b.auth_user_id<>p_user) then
    return jsonb_build_object('error','other_browser_proof_required'); end if;
  select * into identity from public.account_browser_identities where auth_user_id=p_user;
  if not found then
    insert into public.account_browser_identities(auth_user_id,profile_id) values(p_user,source);
    insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values(source,source,'browser_created');
    target := source;
  else
    target := public.account_person(identity.profile_id);
    if target<>source then
      if not p_combine then return jsonb_build_object('error','combine_required'); end if;
      insert into public.account_profile_aliases(profile_id,canonical_id) values(source,target);
      insert into public.account_identity_events(actor_profile_id,subject_profile_id,action,details) values(target,source,'profiles_combined',jsonb_build_object('canonical_profile_id',target));
    end if;
  end if;
  update public.account_sessions set revoked_at=clock_timestamp() where public.account_person(profile_id)=target and revoked_at is null;
  return public.account_browser_session(p_user,p_auth_session,p_new_hash);
end; $$;

create function public.account_reauthenticate(p_hash text,p_user uuid,p_auth_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_session(p_hash,false,false);
  if actor is null or actor->>'source'<>'browser' or (actor->>'auth_user_id')::uuid<>p_user or not exists(
    select 1 from auth.sessions a where a.id=p_auth_session and a.user_id=p_user and a.created_at>clock_timestamp()-interval '10 minutes'
  ) then return null; end if;
  update public.account_sessions set auth_session_id=p_auth_session,authenticated_at=clock_timestamp() where secret_hash=p_hash;
  return public.account_session(p_hash);
end; $$;

create function public.account_revoke_user(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare person uuid;
begin
  select public.account_person(profile_id) into person from public.account_browser_identities where auth_user_id=p_user;
  if person is not null then update public.account_sessions set revoked_at=clock_timestamp() where public.account_person(profile_id)=person and revoked_at is null; end if;
end; $$;

create function public.account_logout(p_hash text,p_all boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_session(p_hash,false,false);
  if p_all and actor is not null then
    update public.account_sessions set revoked_at=clock_timestamp() where public.account_person(profile_id)=(actor->>'profile_id')::uuid and revoked_at is null;
  else update public.account_sessions set revoked_at=clock_timestamp() where secret_hash=p_hash and revoked_at is null; end if;
end; $$;

create function public.account_start_link(p_hash text,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; challenge public.account_link_challenges%rowtype;
begin
  actor := public.account_session(p_hash,true);
  if actor is null then return jsonb_build_object('error','reauthenticate'); end if;
  if not coalesce((actor->>'email_verified')::boolean,false) then return jsonb_build_object('error','verify_email'); end if;
  if not public.account_limit('link:'||(actor->>'profile_id'),10,3600) then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.account_link_challenges(secret_hash,session_hash,profile_id)
    values(p_secret_hash,p_hash,(actor->>'profile_id')::uuid) returning * into challenge;
  return jsonb_build_object('id',challenge.id,'expires_at',challenge.expires_at);
end; $$;

create function public.account_prove_telegram(p_secret_hash text,p_telegram bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.account_link_challenges%rowtype; linked_person uuid;
begin
  if not public.account_limit('link-proof:'||p_telegram,20,3600) then return jsonb_build_object('error','unavailable'); end if;
  select * into c from public.account_link_challenges where secret_hash=p_secret_hash for update;
  if not found or c.expires_at<=clock_timestamp() or c.consumed_at is not null or c.proved_at is not null
    or public.account_session(c.session_hash,true,false) is null then return jsonb_build_object('error','unavailable'); end if;
  select profile_id into linked_person from public.account_telegram_links where telegram_id=p_telegram and active;
  update public.account_link_challenges set telegram_id=p_telegram,telegram_profile_id=linked_person,proved_at=clock_timestamp() where id=c.id;
  insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values(public.account_person(c.profile_id),public.account_person(c.profile_id),'telegram_proved');
  return jsonb_build_object('proved',true);
end; $$;

create function public.account_link_status(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.account_link_challenges%rowtype; actor jsonb; person uuid;
begin
  actor := public.account_session(p_hash,true);
  select * into c from public.account_link_challenges where id=p_id and session_hash=p_hash;
  if actor is null or not found or c.expires_at<=clock_timestamp() or c.consumed_at is not null then return null; end if;
  person := public.account_person(c.telegram_profile_id);
  return jsonb_build_object('id',c.id,'proved',c.proved_at is not null,'telegram_id',c.telegram_id,'combining_profiles',person is not null and person<>(actor->>'profile_id')::uuid,
    'other_browser_proof_required',exists(select 1 from public.account_browser_identities b where b.auth_user_id is not null
      and public.account_person(b.profile_id)=person and b.auth_user_id<>(actor->>'auth_user_id')::uuid));
end; $$;

create function public.account_finish_link(p_hash text,p_id uuid,p_combine boolean,p_other_user uuid default null,p_other_auth_session uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; c public.account_link_challenges%rowtype; target uuid; source uuid; old_link public.account_telegram_links%rowtype; existing_browser uuid;
begin
  actor := public.account_session(p_hash,true);
  select * into c from public.account_link_challenges where id=p_id and session_hash=p_hash for update;
  if actor is null or not found or c.expires_at<=clock_timestamp() or c.consumed_at is not null or c.proved_at is null then return jsonb_build_object('error','unavailable'); end if;
  target := (actor->>'profile_id')::uuid; source := public.account_person(c.telegram_profile_id);
  -- All identity merges acquire the same global lock before resolving roots.
  perform pg_advisory_xact_lock(hashtextextended('siteledger-account-merge',0));
  target := public.account_person(target); source := public.account_person(source);
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
    insert into public.account_identity_events(actor_profile_id,subject_profile_id,action,details) values(target,source,'profiles_combined',jsonb_build_object('canonical_profile_id',target));
  end if;
  update public.account_telegram_links set active=false,revoked_at=clock_timestamp()
    where active and (telegram_id=c.telegram_id or public.account_person(profile_id)=target);
  insert into public.account_telegram_links(telegram_id,profile_id) values(c.telegram_id,target);
  update public.account_sessions set revoked_at=clock_timestamp() where public.account_person(profile_id)=target and secret_hash<>p_hash and revoked_at is null;
  update public.account_link_challenges set consumed_at=clock_timestamp() where id=c.id;
  insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values(target,target,'telegram_linked');
  return public.account_session(p_hash);
end; $$;

create function public.account_unlink_telegram(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_session(p_hash,true);
  if actor is null then return jsonb_build_object('error','reauthenticate'); end if;
  update public.account_telegram_links set active=false,revoked_at=clock_timestamp() where active and public.account_person(profile_id)=(actor->>'profile_id')::uuid;
  update public.account_sessions set revoked_at=clock_timestamp() where public.account_person(profile_id)=(actor->>'profile_id')::uuid and secret_hash<>p_hash and revoked_at is null;
  update public.account_link_challenges set consumed_at=clock_timestamp() where public.account_person(profile_id)=(actor->>'profile_id')::uuid and consumed_at is null;
  insert into public.account_identity_events(actor_profile_id,subject_profile_id,action) values((actor->>'profile_id')::uuid,(actor->>'profile_id')::uuid,'telegram_unlinked');
  return public.account_session(p_hash);
end; $$;

create function public.account_link_miniapp(p_hash text,p_telegram bigint,p_proof_hash text,p_combine boolean,p_other_user uuid default null,p_other_session uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; challenge jsonb; proved jsonb; result jsonb;
begin
  actor := public.account_session(p_hash,true,false);
  if actor is null then return jsonb_build_object('error','reauthenticate'); end if;
  if not coalesce((actor->>'email_verified')::boolean,false) then return jsonb_build_object('error','verify_email'); end if;
  if p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','unavailable'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_proof_hash,0));
  if exists(select 1 from public.account_telegram_proofs where proof_hash=p_proof_hash) then return jsonb_build_object('error','launch_used'); end if;
  challenge := public.account_start_link(p_hash,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'));
  if challenge ? 'error' then return challenge; end if;
  proved := public.account_prove_telegram((select secret_hash from public.account_link_challenges where id=(challenge->>'id')::uuid),p_telegram);
  if proved ? 'error' then return proved; end if;
  result := public.account_finish_link(p_hash,(challenge->>'id')::uuid,p_combine,p_other_user,p_other_session);
  if result ? 'error' then return result; end if;
  insert into public.account_telegram_proofs(proof_hash,profile_id) values(p_proof_hash,(result->>'profile_id')::uuid);
  return result;
end; $$;

create function public.account_verified_email(p_hash text,p_user uuid,p_auth_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; address text;
begin
  actor := public.account_session(p_hash,false,false);
  if actor is null or (actor->>'auth_user_id')::uuid is distinct from p_user or not exists(
    select 1 from auth.sessions a where a.id=p_auth_session and a.user_id=p_user and a.created_at>clock_timestamp()-interval '10 minutes'
  ) then return null; end if;
  select lower(email) into address from auth.users where id=p_user and deleted_at is null;
  -- Only the trusted server calls this after a successful native email OTP.
  -- Signup's auto-confirmed email timestamp is deliberately never consulted.
  update public.account_browser_identities set email_verified=address,email_verified_at=clock_timestamp() where auth_user_id=p_user;
  return public.account_session(p_hash);
end; $$;

create function public.account_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Account evidence is append-only'; end; $$;
create trigger account_identity_append_only before update or delete on public.account_identity_events for each row execute function public.account_append_only();
create trigger account_alias_append_only before update or delete on public.account_profile_aliases for each row execute function public.account_append_only();

do $$ declare tab text; f record; begin
  foreach tab in array array['account_profiles','account_profile_aliases','account_browser_identities','account_telegram_links','account_sessions','account_limits','account_identity_events','account_link_challenges','account_telegram_proofs'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',tab);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'account_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.signature::text not like '%account_append_only%' then execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
