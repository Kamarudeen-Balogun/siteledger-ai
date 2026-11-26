begin;
create table public.account_review_drafts (
  submission_id uuid not null references public.submissions(id),
  profile_id uuid not null references public.account_profiles(id),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=96000),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(submission_id,profile_id)
);
alter table public.account_review_drafts enable row level security;
revoke all on public.account_review_drafts from anon,authenticated;

create function public.account_review_draft(p_hash text,p_id uuid,p_payload jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; person uuid; current_status text; draft jsonb;
begin
  actor:=public.account_record_access(p_hash,p_id,p_payload is not null);
  if actor is null or actor ? 'error' or not coalesce((actor->>'can_review')::boolean,true) then return null; end if;
  person:=(actor->>'profile_id')::uuid;
  select status into current_status from public.submissions where id=p_id for update;
  if current_status='locked' then return null; end if;
  if p_payload is not null then
    insert into public.account_review_drafts(submission_id,profile_id,payload) values(p_id,person,p_payload)
      on conflict(submission_id,profile_id) do update set payload=excluded.payload,updated_at=clock_timestamp();
  end if;
  select payload into draft from public.account_review_drafts where submission_id=p_id and profile_id=person;
  return jsonb_build_object('draft',draft);
end; $$;

create function public.account_clear_review_draft(p_hash text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor:=public.account_record_access(p_hash,p_id,true);
  if actor is null or actor ? 'error' then return; end if;
  delete from public.account_review_drafts where submission_id=p_id and profile_id=(actor->>'profile_id')::uuid;
end; $$;

revoke all on function public.account_review_draft(text,uuid,jsonb),public.account_clear_review_draft(text,uuid) from public,anon,authenticated;
grant execute on function public.account_review_draft(text,uuid,jsonb),public.account_clear_review_draft(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
