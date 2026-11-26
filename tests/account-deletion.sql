begin;

insert into auth.users(id,email,created_at,updated_at,aud,role,is_anonymous)
values ('89000000-0000-4000-8000-000000000001','deletion-admin@example.test',now(),now(),'authenticated','authenticated',false),
       ('89000000-0000-4000-8000-000000000002','deletion-user@example.test',now(),now(),'authenticated','authenticated',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
values ('89000000-0000-4000-8000-000000000011','89000000-0000-4000-8000-000000000001',now(),now()),
       ('89000000-0000-4000-8000-000000000012','89000000-0000-4000-8000-000000000002',now(),now());

do $$
declare admin constant text:='deletion-admin@example.test'; recipient constant text:='deletion-user@example.test';
  user_id constant uuid:='89000000-0000-4000-8000-000000000002';
  project uuid; person uuid; req uuid; result jsonb; before_report jsonb; signup_event jsonb;
begin
  perform public.account_browser_session('89000000-0000-4000-8000-000000000001','89000000-0000-4000-8000-000000000011',repeat('a',64),'Deletion review fixture');
  person:=(public.account_browser_session(user_id,'89000000-0000-4000-8000-000000000012',repeat('b',64),'Deletion request fixture')->>'profile_id')::uuid;
  update public.account_browser_identities b set email_verified=u.email,email_verified_at=now() from auth.users u where u.id=b.auth_user_id and u.id::text like '89000000-%';
  project:=(public.account_create_project(repeat('b',64),'Deletion owner fixture','Test client','Test site','0','NGN','Africa/Lagos')->>'id')::uuid;
  if public.account_deletion(repeat('b',64),admin,'start',repeat('1',64))->>'error' is distinct from 'owned_projects' then raise exception 'Active project owner requires archive or ownership transfer'; end if;
  perform public.account_archive_project(repeat('b',64),project,true);
  if public.account_deletion(repeat('b',64),admin,'start',repeat('1',64))->>'email' is distinct from recipient then raise exception 'Email code must go to verified account'; end if;
  if public.account_deletion(repeat('b',64),admin,'verify',repeat('2',64))->>'error' is distinct from 'invalid_code' then raise exception 'Wrong deletion code must fail'; end if;
  if public.account_deletion(repeat('b',64),admin,'verify',repeat('1',64))->>'requested' is distinct from 'true' then raise exception 'Valid deletion code submits a request'; end if;
  req:=(public.account_deletion(repeat('a',64),admin,'list')->0->>'id')::uuid;
  if req is null or public.account_deletion(repeat('b',64),admin,'approve',req::text) is not null then raise exception 'Only the admin can approve'; end if;
  if public.account_session(repeat('b',64)) is null then raise exception 'Pending request must leave the account available'; end if;
  before_report:=public.get_demo_report_input();
  result:=public.account_deletion(repeat('a',64),admin,'approve',req::text);
  if result->>'email' is distinct from recipient or (result->>'until_at')::timestamptz<clock_timestamp()+interval '29 days' then raise exception 'Approval returns the original recipient and block date'; end if;
  if exists(select 1 from auth.users where id=user_id) or public.account_session(repeat('b',64)) is not null then raise exception 'Approval removes Auth user and sessions'; end if;
  if before_report is distinct from public.get_demo_report_input() or not exists(select 1 from public.account_projects where project_id=project and archived_at is not null and owner_profile_id=person) then raise exception 'Approval changed preserved project history'; end if;
  signup_event:=jsonb_build_object('user',jsonb_build_object('email',upper(recipient)),'metadata',jsonb_build_object('name','before-user-created'));
  if public.account_signup_hook(signup_event)->'error'->>'http_code' is distinct from '403' then raise exception 'Native signup blocks the same address during the wait'; end if;
  update public.account_signup_blocks set until_at=clock_timestamp()-interval '1 second';
  if public.account_signup_hook(signup_event) is distinct from '{}'::jsonb then raise exception 'Signup works after the waiting period'; end if;
  perform public.account_deletion(repeat('a',64),admin,'notified',req::text);
  if public.account_deletion(repeat('a',64),admin,'list')->0->>'email' is not null then raise exception 'Delivery removes the recipient from the queue'; end if;
end; $$;

rollback;
