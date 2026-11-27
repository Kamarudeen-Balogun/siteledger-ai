-- Locked-report sharing was gated on approve_lock, so a foreman who can open
-- a locked report could not share it with a client, and the Share button
-- never appeared for them. Sharing distributes a report that is already
-- locked and already visible to the sharer; it approves nothing. Widen the
-- gate to view_reports. The per-record access check
-- (account_record_access) and the locked-only requirement are unchanged, so
-- a foreman still cannot share another foreman's private records, and an
-- unlocked report still cannot be shared.
begin;

create or replace function public.account_report_share(p_hash text,p_submission uuid,p_enable boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; report uuid; share uuid;
begin
  actor:=public.account_record_access(p_hash,p_submission);
  if actor is null or not coalesce((actor->'permissions'->>'view_reports')::boolean,true) then return null; end if;
  select id into report from public.reports where submission_id=p_submission and status='locked';
  if report is null then return null; end if;
  if p_enable is true then
    insert into public.report_shares(report_id,created_by) values(report,(actor->>'profile_id')::uuid)
      on conflict(report_id) do nothing;
  elsif p_enable is false then
    delete from public.report_shares where report_id=report;
  end if;
  select id into share from public.report_shares where report_id=report;
  return jsonb_build_object('share_id',share);
end; $$;

notify pgrst,'reload schema';
commit;
