-- Invited members must land on the project they just joined.
-- account_accept_invite used to insert the membership and mark the
-- invite consumed but never set the member's active project, so Today
-- (driven by account_sessions.active_project_id) showed nothing until
-- the member manually opened /projects and selected it. This replaces
-- that function with the active project set on acceptance, and adds
-- account_pending_invites so a signed-in user can discover invitations
-- addressed to their email without digging through their inbox.
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
  insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,'invite_accepted',jsonb_build_object('invitation_id',invitation.id,'membership_id',member,'role',invitation.role));
  return jsonb_build_object('project_id',p.project_id,'membership_id',member,'role',invitation.role);
end; $$;

create or replace function public.account_pending_invites(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; invites jsonb;
begin
  actor := public.account_session(p_hash);
  if actor is null or actor->>'email' is null then return jsonb_build_object('invites','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('project_id',i.project_id,'project_name',p.name,'client',p.client,
    'role_label',i.role_label,'expires_at',i.expires_at,'created_at',i.created_at) order by i.created_at desc),'[]'::jsonb)
  into invites from public.account_invitations i join public.projects p on p.id=i.project_id
  where i.email=lower(actor->>'email') and i.consumed_at is null and i.cancelled_at is null and i.expires_at>clock_timestamp();
  return jsonb_build_object('invites',invites);
end; $$;

revoke all on function public.account_pending_invites(text) from public,anon,authenticated;
grant execute on function public.account_pending_invites(text) to service_role;

-- BoQ version history must show what each version contained, not just
-- "Version N · date". The snapshot rows already exist in
-- project_boq_versions.rows; expose them (plus an item count) so the
-- BoQ page can list a version's items.
create or replace function public.account_boq_versions(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if public.account_project_access(p_hash,p_project) is null then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('version',version,'effective_date',effective_date,
    'items',jsonb_array_length(rows),'rows',rows) order by version desc),'[]'::jsonb)
    from (select version,effective_date,rows from public.project_boq_versions where project_id=p_project order by version desc limit 50) v);
end; $$;

revoke all on function public.account_boq_versions(text,uuid) from public,anon,authenticated;
grant execute on function public.account_boq_versions(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
