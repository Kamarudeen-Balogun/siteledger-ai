-- Task 10A projects and owner-controlled teams; original evidence stays untouched.
begin;
create table public.account_projects (
  project_id uuid primary key references public.projects(id) on delete restrict,
  owner_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  timezone text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.account_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.account_projects(project_id) on delete restrict,
  profile_id uuid not null references public.account_profiles(id) on delete restrict,
  role text not null check (role in ('foreman','pm')),
  active boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(project_id,profile_id),
  check (active=(revoked_at is null))
);
create table public.account_legacy_actors (
  telegram_id bigint primary key references public.telegram_users(telegram_id) on delete restrict,
  profile_id uuid not null unique references public.account_profiles(id) on delete restrict
);
create table public.account_project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.account_projects(project_id) on delete restrict,
  actor_profile_id uuid references public.account_profiles(id) on delete restrict,
  action text not null check (action in ('created','legacy_authorized_import','invited','invite_cancelled','invite_accepted','role_changed','member_removed','ownership_requested','ownership_transferred','archived','restored')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create table public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.account_projects(project_id) on delete restrict,
  owner_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  email text not null check (length(email) between 3 and 254),
  role text not null check (role in ('foreman','pm')),
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default now()+interval '7 days',
  cancelled_at timestamptz,
  consumed_at timestamptz,
  accepted_profile_id uuid references public.account_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.account_owner_transfers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.account_projects(project_id) on delete restrict,
  owner_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  target_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.account_sessions add column active_project_id uuid references public.account_projects(project_id) on delete restrict;

create function public.account_owner_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid; owner_id uuid;
begin
  if tg_table_name='account_projects' then project := new.project_id; else project := coalesce(new.project_id,old.project_id); end if;
  select owner_profile_id into owner_id from public.account_projects where project_id=project;
  if found and not exists(select 1 from public.account_memberships m where m.project_id=project and m.active and m.role='pm'
    and public.account_person(m.profile_id)=public.account_person(owner_id)) then raise exception 'A project must retain one active owner with the PM role'; end if;
  return null;
end; $$;
create constraint trigger account_project_owner_valid after insert or update on public.account_projects deferrable initially deferred for each row execute function public.account_owner_guard();
create constraint trigger account_membership_owner_valid after insert or update or delete on public.account_memberships deferrable initially deferred for each row execute function public.account_owner_guard();
create function public.account_project_money_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if new.currency is distinct from old.currency or new.timezone is distinct from old.timezone then raise exception 'Project currency and timezone cannot relabel captured evidence'; end if;
  return new;
end; $$;
create trigger account_fixed_money_timezone before update on public.account_projects for each row execute function public.account_project_money_guard();
create trigger account_project_event_append_only before update or delete on public.account_project_events for each row execute function public.account_append_only();
create trigger account_legacy_identity_append_only before update or delete on public.account_legacy_actors for each row execute function public.account_append_only();

-- Builder confirmed the existing authorized Lekki PM as owner on 21 November.
-- No owner is inferred for an unrelated project. Old names/evidence are unchanged.
do $$ declare u record; person uuid; p record; owner_id uuid; begin
  for u in select * from public.telegram_users order by telegram_id loop
    select profile_id into person from public.account_telegram_links where telegram_id=u.telegram_id and active;
    if not found then
      insert into public.account_profiles default values returning id into person;
      insert into public.account_telegram_links(telegram_id,profile_id) values(u.telegram_id,person);
    end if;
    insert into public.account_legacy_actors(telegram_id,profile_id) values(u.telegram_id,person);
  end loop;
  for p in select * from public.projects where project_code='LEKKI-DEMO-01' and is_demo loop
    if (select count(*) from public.telegram_users where project_id=p.id and role='pm')=1 then
      select a.profile_id into owner_id from public.telegram_users member join public.account_legacy_actors a using(telegram_id) where member.project_id=p.id and member.role='pm';
      insert into public.account_projects(project_id,owner_profile_id,currency,timezone) values(p.id,owner_id,'NGN','Africa/Lagos');
      insert into public.account_memberships(project_id,profile_id,role) select member.project_id,a.profile_id,member.role from public.telegram_users member join public.account_legacy_actors a using(telegram_id) where member.project_id=p.id;
      insert into public.account_project_events(project_id,action,details) values(p.id,'legacy_authorized_import',jsonb_build_object('authority','Builder instruction, 21 November 2026'));
    end if;
  end loop;
end $$;

-- Flush valid owner/member imports before later RLS ALTER TABLE statements.
set constraints account_project_owner_valid,account_membership_owner_valid immediate;
set constraints account_project_owner_valid,account_membership_owner_valid deferred;

create function public.account_project_access(p_hash text,p_project uuid,p_write boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; m public.account_memberships%rowtype; p public.account_projects%rowtype;
begin
  actor := public.account_session(p_hash);
  if actor is null or actor->>'name_confirmed_at' is null then return null; end if;
  select * into p from public.account_projects where project_id=p_project for share;
  if not found then return null; end if;
  select * into m from public.account_memberships where project_id=p_project and active
    and public.account_person(profile_id)=(actor->>'profile_id')::uuid order by (role='pm') desc,created_at,id limit 1 for share;
  if not found then return null; end if;
  if p_write and p.archived_at is not null then return jsonb_build_object('error','archived'); end if;
  return actor || jsonb_build_object('project_id',p.project_id,'role',m.role,'membership_id',m.id,'currency',p.currency,'timezone',p.timezone,
    'owner',public.account_person(p.owner_profile_id)=(actor->>'profile_id')::uuid,'archived_at',p.archived_at);
end; $$;

create function public.account_create_project(p_hash text,p_name text,p_client text,p_location text,p_contract text,p_currency text,p_timezone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; id_new uuid; person uuid; code text;
begin
  actor := public.account_session(p_hash);
  if actor is null or actor->>'name_confirmed_at' is null then return jsonb_build_object('error','confirm_name'); end if;
  if not public.account_limit('project-create:'||(actor->>'profile_id'),10,3600) then return jsonb_build_object('error','rate_limited'); end if;
  if length(btrim(p_name)) not between 1 and 200 or length(btrim(p_client)) not between 1 and 200 or length(btrim(p_location)) not between 1 and 200
    or p_contract !~ '^[0-9]+(\.[0-9]+)?$' or length(p_contract)>40 or p_currency !~ '^[A-Z]{3}$'
    or not exists(select 1 from pg_timezone_names where name=p_timezone) then return jsonb_build_object('error','invalid_project'); end if;
  person := (actor->>'profile_id')::uuid;
  code := 'SL-'||upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.projects(project_code,name,client,location,contract_sum) values(code,btrim(p_name),btrim(p_client),btrim(p_location),p_contract::numeric) returning id into id_new;
  insert into public.account_projects(project_id,owner_profile_id,currency,timezone) values(id_new,person,p_currency,p_timezone);
  insert into public.account_memberships(project_id,profile_id,role) values(id_new,person,'pm');
  insert into public.account_project_events(project_id,actor_profile_id,action) values(id_new,person,'created');
  update public.account_sessions set active_project_id=id_new where secret_hash=p_hash;
  update public.account_telegram_links set active_project_id=id_new where active and public.account_person(profile_id)=person;
  return jsonb_build_object('id',id_new,'project_code',code);
end; $$;

create function public.account_list_projects(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; projects jsonb;
begin
  actor := public.account_session(p_hash);
  if actor is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'client',p.client,'location',p.location,'project_code',p.project_code,
    'contract_sum',p.contract_sum::text,'currency',a.currency,'timezone',a.timezone,'archived_at',a.archived_at,'role',m.role,
    'owner',public.account_person(a.owner_profile_id)=(actor->>'profile_id')::uuid) order by p.created_at desc,p.id),'[]'::jsonb)
  into projects from public.projects p join public.account_projects a on a.project_id=p.id
    join lateral (select role from public.account_memberships m where m.project_id=p.id and m.active and public.account_person(m.profile_id)=(actor->>'profile_id')::uuid order by (role='pm') desc limit 1) m on true;
  return jsonb_build_object('account',actor,'projects',projects,'active_project_id',(select active_project_id from public.account_sessions where secret_hash=p_hash));
end; $$;

create function public.account_select_project(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null then return jsonb_build_object('error','unavailable'); end if;
  update public.account_sessions set active_project_id=p_project where secret_hash=p_hash;
  return actor;
end; $$;

create function public.account_archive_project(p_hash text,p_project uuid,p_archive boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  perform 1 from public.account_projects where project_id=p_project for update;
  actor := public.account_project_access(p_hash,p_project);
  if actor is null or not (actor->>'owner')::boolean then return jsonb_build_object('error','unavailable'); end if;
  update public.account_projects set archived_at=case when p_archive then coalesce(archived_at,clock_timestamp()) else null end where project_id=p_project;
  insert into public.account_project_events(project_id,actor_profile_id,action) values(p_project,(actor->>'profile_id')::uuid,case when p_archive then 'archived' else 'restored' end);
  return public.account_project_access(p_hash,p_project);
end; $$;

create function public.account_invite(p_hash text,p_project uuid,p_email text,p_role text,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; invitation public.account_invitations%rowtype;
begin
  actor := public.account_project_access(p_hash,p_project,true);
  if actor is null then return jsonb_build_object('error','unavailable'); end if;
  if actor ? 'error' then return actor; end if;
  if not (actor->>'owner')::boolean then return jsonb_build_object('error','unavailable'); end if;
  if p_role not in ('foreman','pm') or length(p_email) not between 3 and 254 or p_secret_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_invite'); end if;
  if not public.account_limit('invite:'||p_project,30,3600) then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.account_invitations(project_id,owner_profile_id,email,role,secret_hash) values(p_project,(actor->>'profile_id')::uuid,lower(p_email),p_role,p_secret_hash) returning * into invitation;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'invited',jsonb_build_object('invitation_id',invitation.id,'role',p_role));
  return jsonb_build_object('id',invitation.id,'expires_at',invitation.expires_at);
end; $$;

create function public.account_cancel_invite(p_hash text,p_project uuid,p_invite uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null or not (actor->>'owner')::boolean then return jsonb_build_object('error','unavailable'); end if;
  update public.account_invitations set cancelled_at=clock_timestamp() where id=p_invite and project_id=p_project and consumed_at is null and cancelled_at is null;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'invite_cancelled',jsonb_build_object('invitation_id',p_invite));
  return jsonb_build_object('cancelled',true);
end; $$;

create function public.account_accept_invite(p_hash text,p_secret_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; invitation public.account_invitations%rowtype; p public.account_projects%rowtype; member uuid;
begin
  actor := public.account_session(p_hash);
  if actor is null or actor->>'name_confirmed_at' is null or not coalesce((actor->>'email_verified')::boolean,false) then return jsonb_build_object('error','verify_email'); end if;
  if not public.account_limit('accept-invite:'||(actor->>'profile_id'),20,3600) then return jsonb_build_object('error','rate_limited'); end if;
  select * into invitation from public.account_invitations where secret_hash=p_secret_hash;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  select * into p from public.account_projects where project_id=invitation.project_id for update;
  select * into invitation from public.account_invitations where id=invitation.id for update;
  if invitation.cancelled_at is not null or invitation.consumed_at is not null or invitation.expires_at<=clock_timestamp() or p.archived_at is not null
    or public.account_person(invitation.owner_profile_id)<>public.account_person(p.owner_profile_id) or invitation.email<>lower(actor->>'email')
    or not exists(select 1 from public.account_memberships m where m.project_id=p.project_id and m.active and m.role='pm' and public.account_person(m.profile_id)=public.account_person(p.owner_profile_id)) then return jsonb_build_object('error','unavailable'); end if;
  if exists(select 1 from public.account_memberships m where m.project_id=p.project_id and m.active and public.account_person(m.profile_id)=(actor->>'profile_id')::uuid) then return jsonb_build_object('error','already_member'); end if;
  insert into public.account_memberships(project_id,profile_id,role) values(p.project_id,(actor->>'profile_id')::uuid,invitation.role)
    on conflict(project_id,profile_id) do update set role=excluded.role,active=true,revoked_at=null returning id into member;
  update public.account_invitations set consumed_at=clock_timestamp(),accepted_profile_id=(actor->>'profile_id')::uuid where id=invitation.id;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p.project_id,(actor->>'profile_id')::uuid,'invite_accepted',jsonb_build_object('invitation_id',invitation.id,'membership_id',member,'role',invitation.role));
  return jsonb_build_object('project_id',p.project_id,'membership_id',member,'role',invitation.role);
end; $$;

create function public.account_manage_member(p_hash text,p_project uuid,p_profile uuid,p_role text,p_remove boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; target uuid;
begin
  perform 1 from public.account_projects where project_id=p_project for update;
  actor := public.account_project_access(p_hash,p_project);
  if actor is null or not (actor->>'owner')::boolean then return jsonb_build_object('error','unavailable'); end if;
  target := public.account_person(p_profile);
  if target=(actor->>'profile_id')::uuid then return jsonb_build_object('error','owner_transfer_required'); end if;
  if not p_remove and (actor->>'archived_at' is not null or p_role not in ('foreman','pm')) then return jsonb_build_object('error','archived'); end if;
  update public.account_memberships set active=not p_remove,revoked_at=case when p_remove then clock_timestamp() else null end,role=case when p_remove then role else p_role end
    where project_id=p_project and active and public.account_person(profile_id)=target;
  if not found then return jsonb_build_object('error','unavailable'); end if;
  -- A removed active project stays selected: capture must explain the block,
  -- never silently switch a saved note to another authorized project.
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,case when p_remove then 'member_removed' else 'role_changed' end,
    jsonb_build_object('profile_id',target,'role',case when p_remove then null else p_role end));
  return jsonb_build_object('updated',true);
end; $$;

create function public.account_start_transfer(p_hash text,p_project uuid,p_target uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; transfer public.account_owner_transfers%rowtype; target uuid;
begin
  if public.account_session(p_hash,true,false) is null then return jsonb_build_object('error','reauthenticate'); end if;
  actor := public.account_project_access(p_hash,p_project);
  target := public.account_person(p_target);
  if actor is null or not (actor->>'owner')::boolean or target=(actor->>'profile_id')::uuid or not exists(select 1 from public.account_memberships where project_id=p_project and active and public.account_person(profile_id)=target) then return jsonb_build_object('error','unavailable'); end if;
  insert into public.account_owner_transfers(project_id,owner_profile_id,target_profile_id) values(p_project,(actor->>'profile_id')::uuid,target) returning * into transfer;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'ownership_requested',jsonb_build_object('transfer_id',transfer.id,'target_profile_id',target));
  return jsonb_build_object('id',transfer.id,'expires_at',transfer.expires_at);
end; $$;

create function public.account_accept_transfer(p_hash text,p_project uuid,p_transfer uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; p public.account_projects%rowtype; transfer public.account_owner_transfers%rowtype;
begin
  if public.account_session(p_hash,true,false) is null then return jsonb_build_object('error','reauthenticate'); end if;
  select * into p from public.account_projects where project_id=p_project for update;
  actor := public.account_project_access(p_hash,p_project);
  select * into transfer from public.account_owner_transfers where id=p_transfer and project_id=p_project for update;
  if actor is null or not found or transfer.accepted_at is not null or transfer.expires_at<=clock_timestamp()
    or public.account_person(transfer.owner_profile_id)<>public.account_person(p.owner_profile_id)
    or public.account_person(transfer.target_profile_id)<>(actor->>'profile_id')::uuid then return jsonb_build_object('error','unavailable'); end if;
  update public.account_memberships set role='pm' where project_id=p_project and active and public.account_person(profile_id)=(actor->>'profile_id')::uuid;
  update public.account_projects set owner_profile_id=(actor->>'profile_id')::uuid where project_id=p_project;
  update public.account_owner_transfers set accepted_at=clock_timestamp() where id=p_transfer;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'ownership_transferred',jsonb_build_object('transfer_id',p_transfer,'previous_owner_profile_id',p.owner_profile_id));
  return public.account_project_access(p_hash,p_project);
end; $$;

create function public.account_team(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null or not (actor->>'owner')::boolean then return null; end if;
  return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('profile_id',m.person,'name',p.professional_name,'role',m.role,
      'owner',m.person=(actor->>'profile_id')::uuid) order by p.professional_name,m.person),'[]'::jsonb)
    from (select distinct on (public.account_person(profile_id)) public.account_person(profile_id) person,role from public.account_memberships where project_id=p_project and active order by public.account_person(profile_id),(role='pm') desc) m join public.account_profiles p on p.id=m.person),
    'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at,'expired',expires_at<=clock_timestamp(),'cancelled_at',cancelled_at,'consumed_at',consumed_at) order by created_at desc),'[]'::jsonb) from public.account_invitations where project_id=p_project),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'actor_profile_id',actor_profile_id,'action',action,'timestamp',created_at,'details',details) order by created_at desc,id),'[]'::jsonb) from public.account_project_events where project_id=p_project));
end; $$;

do $$ declare tab text; f record; begin
  foreach tab in array array['account_projects','account_memberships','account_legacy_actors','account_project_events','account_invitations','account_owner_transfers'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',tab);
  end loop;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'account_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.signature::text !~ 'account_(append_only|owner_guard|project_money_guard)' then execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
