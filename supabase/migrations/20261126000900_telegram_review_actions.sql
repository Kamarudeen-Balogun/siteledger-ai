begin;

create table public.telegram_review_actions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  submission_id uuid not null references public.submissions(id),
  action text not null check(action in ('review','confirm','edit','lock','share')),
  payload jsonb,
  expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',
  used_at timestamptz
);
alter table public.telegram_review_actions enable row level security;
revoke all on public.telegram_review_actions from public,anon,authenticated,service_role;

create function public.telegram_review_ticket(p_telegram bigint,p_submission uuid,p_action text,p_payload jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; ticket uuid;
begin
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null or not exists(select 1 from public.submissions where id=p_submission and project_id=(ctx->>'project_id')::uuid)
    or (p_action in ('review','confirm','edit') and not public.account_has_project_permission(ctx,'record_notes'))
    or (p_action in ('share','lock') and not public.account_has_project_permission(ctx,'approve_lock')) then return null; end if;
  if not public.account_limit('bot-review-ticket:'||p_telegram,100,600) then return null; end if;
  delete from public.telegram_review_actions where telegram_id=p_telegram and expires_at<clock_timestamp();
  insert into public.telegram_review_actions(telegram_id,submission_id,action,payload) values(p_telegram,p_submission,p_action,p_payload) returning id into ticket;
  return ticket;
end; $$;

create function public.telegram_use_review_ticket(p_telegram bigint,p_ticket uuid,p_hash text,p_edit boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.telegram_review_actions%rowtype; ctx jsonb; link_id uuid; actor jsonb;
begin
  if not public.account_limit('bot-review-action:'||p_telegram,50,600) then return null; end if;
  select * into t from public.telegram_review_actions where id=p_ticket and telegram_id=p_telegram and used_at is null and expires_at>clock_timestamp() for update;
  if not found or (p_edit and t.action<>'edit') then return null; end if;
  ctx:=public.account_bot_context(p_telegram);
  if ctx is null or ctx->>'project_id' is null or not exists(select 1 from public.submissions where id=t.submission_id and project_id=(ctx->>'project_id')::uuid) then return null; end if;
  select id into link_id from public.account_telegram_links where telegram_id=p_telegram and active and public.account_person(profile_id)=(ctx->>'profile_id')::uuid;
  if link_id is null then return null; end if;
  insert into public.account_sessions(secret_hash,profile_id,source,telegram_link_id,expires_at,active_project_id)
    values(p_hash,(ctx->>'profile_id')::uuid,'telegram',link_id,clock_timestamp()+interval '2 minutes',(ctx->>'project_id')::uuid);
  actor:=public.account_record_access(p_hash,t.submission_id);
  if actor is null or (t.action in ('review','confirm','edit') and not (actor->>'can_review')::boolean)
    or (t.action in ('lock','share') and not (public.account_has_project_permission(actor,'approve_lock') and public.account_has_project_permission(actor,'view_reports'))) then
    delete from public.account_sessions where secret_hash=p_hash;
    return null;
  end if;
  if t.action<>'edit' or p_edit then update public.telegram_review_actions set used_at=clock_timestamp() where id=t.id; end if;
  return jsonb_build_object('action',t.action,'id',t.submission_id,'payload',t.payload,'can_approve',public.account_has_project_permission(actor,'approve_lock'));
end; $$;

revoke all on function public.telegram_review_ticket(bigint,uuid,text,jsonb),public.telegram_use_review_ticket(bigint,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.telegram_review_ticket(bigint,uuid,text,jsonb),public.telegram_use_review_ticket(bigint,uuid,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
