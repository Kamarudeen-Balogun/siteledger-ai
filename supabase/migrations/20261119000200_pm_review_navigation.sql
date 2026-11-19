-- Task 8: the PM must reach pending drafts, including work submitted yesterday.
begin;
create or replace function public.latest_confirmation_submission(p_telegram_id bigint) returns uuid
language sql security definer set search_path = '' as $$
  select s.id from public.submissions s join public.telegram_users u on u.project_id=s.project_id
  left join public.reports r on r.submission_id=s.id
  where u.telegram_id=p_telegram_id and (s.telegram_id=p_telegram_id or u.role='pm')
    and ((s.created_at at time zone 'Africa/Lagos')::date=(now() at time zone 'Africa/Lagos')::date
      or (u.role='pm' and r.id is not null))
  order by case when u.role='pm' and r.status='draft' then 0
    when (s.created_at at time zone 'Africa/Lagos')::date=(now() at time zone 'Africa/Lagos')::date then 1
    else 2 end, s.created_at desc limit 1;
$$;
revoke all on function public.latest_confirmation_submission(bigint) from public,anon,authenticated;
grant execute on function public.latest_confirmation_submission(bigint) to service_role;
notify pgrst, 'reload schema';
commit;
