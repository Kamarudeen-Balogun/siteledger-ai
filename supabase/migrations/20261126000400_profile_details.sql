begin;
alter table public.account_profiles add column phone text check (phone is null or length(phone) between 3 and 40), add column photo_path text;

create function public.account_profile_details(p_hash text,p_update jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; person uuid; old_path text; result jsonb;
begin
  actor:=public.account_session(p_hash);
  if actor is null then return null; end if;
  person:=(actor->>'profile_id')::uuid;
  if p_update is not null then
    select photo_path into old_path from public.account_profiles where id=person for update;
    update public.account_profiles set
      phone=case when p_update ? 'phone' then p_update->>'phone' else phone end,
      photo_path=case when p_update ? 'photo_path' then p_update->>'photo_path' else photo_path end
    where id=person;
  end if;
  select jsonb_build_object('phone',phone,'photo_path',photo_path,'old_path',old_path) into result from public.account_profiles where id=person;
  return result;
end; $$;
revoke all on function public.account_profile_details(text,jsonb) from public,anon,authenticated;
grant execute on function public.account_profile_details(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
