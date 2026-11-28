-- Fix 20261127000300: the rewritten account_accept_invite inserted the
-- invite_accepted event with values(p_project, ...) but the function
-- declares no p_project (it declares p, the project row). The function
-- was created without error, so the bug only surfaces when an invite is
-- actually accepted. Replace the body with the corrected project id.
begin;

create or replace function public.account_accept_invite(p_hash text,p_secret_hash text) returns jsonb
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
  insert into public.account_memberships(project_id,profile_id,role,role_label,permissions)
    values(p.project_id,(actor->>'profile_id')::uuid,invitation.role,invitation.role_label,
      case when invitation.role_label is null then null else public.account_project_role_defaults(invitation.role_label) end)
    on conflict(project_id,profile_id) do update set role=excluded.role,role_label=excluded.role_label,permissions=excluded.permissions,active=true,revoked_at=null returning id into member;
  update public.account_invitations set consumed_at=clock_timestamp(),accepted_profile_id=(actor->>'profile_id')::uuid where id=invitation.id;
  -- The fix: make the joined project the member's active project, so
  -- Today, the header switcher and Reports & Log show it at once.
  update public.account_sessions set active_project_id=p.project_id where secret_hash=p_hash;
  update public.account_telegram_links set active_project_id=p.project_id where active and public.account_person(profile_id)=(actor->>'profile_id')::uuid;
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p.project_id,(actor->>'profile_id')::uuid,'invite_accepted',jsonb_build_object('invitation_id',invitation.id,'membership_id',member,'role',invitation.role));
  return jsonb_build_object('project_id',p.project_id,'membership_id',member,'role',invitation.role);
end; $$;

notify pgrst,'reload schema';
commit;
