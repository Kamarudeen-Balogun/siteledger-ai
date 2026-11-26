begin;

create table public.account_deletion_codes (
  profile_id uuid primary key references public.account_profiles(id),
  session_hash text not null references public.account_sessions(secret_hash),
  code_hash text not null,
  expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
  attempts integer not null default 0
);
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.account_profiles(id),
  user_id uuid not null,
  email text,
  name text,
  requested_at timestamptz not null default clock_timestamp(),
  approved_at timestamptz,
  approved_by uuid references public.account_profiles(id),
  blocked_until timestamptz,
  notified_at timestamptz
);
create table public.account_signup_blocks (
  email_hash text primary key,
  until_at timestamptz not null
);
alter table public.account_deletion_codes enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.account_signup_blocks enable row level security;
revoke all on public.account_deletion_codes,public.account_deletion_requests,public.account_signup_blocks from public,anon,authenticated,service_role;

create or replace function public.account_signup_hook(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ip_key text;
begin
  if event->'metadata'->>'name' is distinct from 'before-user-created' or coalesce((event->'user'->>'is_anonymous')::boolean,false)
    or not public.account_limit('native-signup-global',200,3600) then
    return jsonb_build_object('error',jsonb_build_object('http_code',429,'message','Account creation is busy. Try again later.'));
  end if;
  ip_key:=encode(sha256(convert_to(coalesce(event->'metadata'->>'ip_address','unknown'),'UTF8')),'hex');
  if not public.account_limit('native-signup-ip:'||ip_key,20,3600) then
    return jsonb_build_object('error',jsonb_build_object('http_code',429,'message','Account creation is busy. Try again later.'));
  end if;
  if exists(select 1 from public.account_signup_blocks where email_hash=encode(sha256(convert_to(lower(btrim(event->'user'->>'email')),'UTF8')),'hex') and until_at>clock_timestamp()) then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','This email cannot be used for 30 days after account deletion.'));
  end if;
  return '{}'::jsonb;
end; $$;

create function public.account_deletion(p_hash text,p_admin_email text,p_action text,p_value text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; person uuid; verified boolean; admin boolean; address text; current_user_id uuid;
  code public.account_deletion_codes%rowtype; choice public.account_deletion_requests%rowtype; at_time timestamptz; photo text;
begin
  actor:=public.account_session(p_hash);
  if actor is null then return null; end if;
  person:=(actor->>'profile_id')::uuid;
  address:=actor->>'email';
  verified:=coalesce((actor->>'email_verified')::boolean and actor->>'source'='browser',false);
  admin:=coalesce(verified and lower(address)=lower(nullif(p_admin_email,'')),false);
  if p_action in ('start','verify','status') then
    if p_action='status' then return (select jsonb_build_object('requested',exists(select 1 from public.account_deletion_requests where profile_id=person and approved_at is null))); end if;
    if not verified then return '{"error":"verify_email"}'::jsonb; end if;
    if admin then return '{"error":"admin_account"}'::jsonb; end if;
    perform 1 from public.account_profiles where id=person for update;
    if exists(select 1 from public.account_deletion_requests where profile_id=person and approved_at is null) then return '{"error":"already_requested"}'::jsonb; end if;
    if exists(select 1 from public.account_projects p where p.archived_at is null and public.account_person(p.owner_profile_id)=person) then return '{"error":"owned_projects"}'::jsonb; end if;
    if not public.account_limit('deletion-'||p_action||':'||person::text,case when p_action='start' then 4 else 10 end,3600) then return '{"error":"rate_limited"}'::jsonb; end if;
    if p_value is null or p_value !~ '^[a-f0-9]{64}$' then return '{"error":"invalid_code"}'::jsonb; end if;
    if p_action='start' then
      insert into public.account_deletion_codes(profile_id,session_hash,code_hash) values(person,p_hash,p_value)
        on conflict(profile_id) do update set session_hash=excluded.session_hash,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0;
      return jsonb_build_object('email',address);
    end if;
    select * into code from public.account_deletion_codes where profile_id=person for update;
    if not found or code.session_hash<>p_hash or code.expires_at<=clock_timestamp() or code.attempts>=5 then return '{"error":"expired_code"}'::jsonb; end if;
    if code.code_hash<>p_value then
      update public.account_deletion_codes set attempts=attempts+1 where profile_id=person;
      return '{"error":"invalid_code"}'::jsonb;
    end if;
    delete from public.account_deletion_codes where profile_id=person;
    insert into public.account_deletion_requests(profile_id,user_id,email,name) values(person,(actor->>'auth_user_id')::uuid,address,actor->>'professional_name');
    return '{"requested":true}'::jsonb;
  end if;
  if not admin then return null; end if;
  if p_action='list' then
    return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email,'requested_at',requested_at,'approved_at',approved_at,'notified_at',notified_at) order by requested_at desc),'[]'::jsonb)
      from (select * from public.account_deletion_requests order by requested_at desc limit 200) requests);
  end if;
  if p_action not in ('approve','notified') or p_value is null then return null; end if;
  select * into choice from public.account_deletion_requests where id=p_value::uuid for update;
  if not found then return null; end if;
  if p_action='notified' then
    if choice.approved_at is null then return null; end if;
    update public.account_deletion_requests set email=null,name=null,notified_at=coalesce(notified_at,clock_timestamp()) where id=choice.id;
    return '{"notified":true}'::jsonb;
  end if;
  if choice.approved_at is not null then return jsonb_build_object('email',choice.email,'until_at',choice.blocked_until,'notified',choice.notified_at is not null); end if;
  if choice.profile_id=person or lower(choice.email)=lower(p_admin_email) then return '{"error":"admin_account"}'::jsonb; end if;
  perform 1 from public.account_profiles where id=choice.profile_id for update;
  perform 1 from public.account_projects where public.account_person(owner_profile_id)=choice.profile_id for update;
  if exists(select 1 from public.account_projects p where p.archived_at is null and public.account_person(p.owner_profile_id)=choice.profile_id) then return '{"error":"owned_projects"}'::jsonb; end if;
  select id into current_user_id from auth.users where id=choice.user_id and lower(email)=lower(choice.email) for update;
  if not found or not exists(select 1 from public.account_browser_identities b where b.auth_user_id=current_user_id and public.account_person(b.profile_id)=choice.profile_id)
    or exists(select 1 from public.account_browser_identities b where b.auth_user_id is not null and b.auth_user_id<>current_user_id and public.account_person(b.profile_id)=choice.profile_id) then
    return '{"error":"account_changed"}'::jsonb;
  end if;
  at_time:=clock_timestamp();
  insert into public.account_signup_blocks(email_hash,until_at) values(encode(sha256(convert_to(lower(btrim(choice.email)),'UTF8')),'hex'),at_time+interval '30 days')
    on conflict(email_hash) do update set until_at=excluded.until_at;
  update public.account_sessions set revoked_at=at_time where public.account_person(profile_id)=choice.profile_id and revoked_at is null;
  update public.account_telegram_links set active=false,revoked_at=at_time where public.account_person(profile_id)=choice.profile_id and active;
  update public.account_memberships m set active=false,revoked_at=at_time where public.account_person(m.profile_id)=choice.profile_id and m.active
    and not exists(select 1 from public.account_projects p where p.project_id=m.project_id and public.account_person(p.owner_profile_id)=choice.profile_id);
  delete from public.account_review_drafts where public.account_person(profile_id)=choice.profile_id;
  delete from public.account_deletion_codes where profile_id=choice.profile_id;
  select photo_path into photo from public.account_profiles where id=choice.profile_id;
  update public.account_profiles set photo_path=null,phone=null,professional_name=null,name_confirmed_at=null where public.account_person(id)=choice.profile_id;
  update public.product_feedback set email=null,name='Deleted account' where public.account_person(profile_id)=choice.profile_id;
  update public.account_browser_identities set email_verified=null,email_verified_at=null where auth_user_id=current_user_id;
  delete from auth.users where id=current_user_id;
  update public.account_deletion_requests set approved_at=at_time,approved_by=person,blocked_until=at_time+interval '30 days' where id=choice.id;
  return jsonb_build_object('email',choice.email,'until_at',at_time+interval '30 days','photo_path',photo);
end; $$;

revoke all on function public.account_deletion(text,text,text,text) from public,anon,authenticated;
grant execute on function public.account_deletion(text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
