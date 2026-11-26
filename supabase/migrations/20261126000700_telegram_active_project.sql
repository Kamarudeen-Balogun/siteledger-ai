begin;
create or replace function public.account_telegram_session(p_telegram bigint,p_hash text,p_proof_hash text) returns jsonb
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
  insert into public.account_sessions(secret_hash,profile_id,source,telegram_link_id,expires_at,active_project_id)
    values(p_hash,person,'telegram',link.id,clock_timestamp()+interval '1 hour',
      case when exists(select 1 from public.account_memberships m where m.project_id=link.active_project_id and m.active and public.account_person(m.profile_id)=person) then link.active_project_id end);
  return public.account_session(p_hash);
end; $$;
notify pgrst,'reload schema';
commit;
