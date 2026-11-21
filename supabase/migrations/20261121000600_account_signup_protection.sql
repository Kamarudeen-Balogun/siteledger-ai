-- Native Auth hook: CAPTCHA cannot be bypassed by using only the direct API.
-- The hook also caps creation independently of the website's request limits.
begin;
create function public.account_signup_hook(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ip_key text;
begin
  if event->'metadata'->>'name' is distinct from 'before-user-created' or coalesce((event->'user'->>'is_anonymous')::boolean,false)
    or not public.account_limit('native-signup-global',200,3600) then
    return jsonb_build_object('error',jsonb_build_object('http_code',429,'message','Account creation is busy. Try again later.'));
  end if;
  ip_key := encode(sha256(convert_to(coalesce(event->'metadata'->>'ip_address','unknown'),'UTF8')),'hex');
  if not public.account_limit('native-signup-ip:'||ip_key,20,3600) then
    return jsonb_build_object('error',jsonb_build_object('http_code',429,'message','Account creation is busy. Try again later.'));
  end if;
  return '{}'::jsonb;
end; $$;
revoke all on function public.account_signup_hook(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.account_signup_hook(jsonb) to supabase_auth_admin;
commit;
