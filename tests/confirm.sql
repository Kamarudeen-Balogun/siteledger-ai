begin;
set local role service_role;
do $$
declare sid uuid := '70000000-0000-4000-8000-000000000005';
  project uuid := '10000000-0000-4000-8000-000000000001';
  chosen uuid; raw jsonb; confirmed jsonb; result jsonb; photo uuid;
  before_reports bigint; before_items bigint; photo_lease uuid := gen_random_uuid();
begin
  select id into chosen from public.boq_items where project_id = project and item_code = 'BLK-225';
  if chosen is null then select id into chosen from public.boq_items where project_id = project and unit = 'm2' limit 1; end if;
  insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7000005,'Confirmation test foreman',project,'foreman');
  insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7000006,'Other test foreman',project,'foreman'),(7000007,'Confirmation test PM',project,'pm');
  raw := jsonb_build_object('work_items',jsonb_build_array(jsonb_build_object('description','Some blockwork',
    'matched_boq_hint',null,'quantity',null,'unit','m2','crew',6,'confidence',0.3)),
    'materials','[]'::jsonb,'delays','[]'::jsonb,'issues','[]'::jsonb,'raw_language_notes','Pidgin');
  insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status)
    values(sid,project,7000005,'Confirmation test foreman','telegram','We don set some blockwork.',raw,'extracted');
  insert into public.submission_photos(submission_id,storage_url) values(sid,'site-evidence/test.jpg') returning id into photo;
  -- This suite exercises confirmation, using a completed manual photo review.
  perform public.claim_photo_analysis(photo,photo_lease);
  perform public.finish_photo_analysis(photo,photo_lease,null,'photo_unavailable');
  if public.get_confirmation_record(sid,7000006) is not null then raise exception 'Other users can read a private note'; end if;
  result := public.get_confirmation_record(sid,7000005);
  if (result->'boq'->0) ? 'rate' then raise exception 'Confirmation leaked rates'; end if;
  select count(*) into before_reports from public.reports; select count(*) into before_items from public.report_items;
  begin
    perform public.confirm_site_submission(sid,7000005,raw,jsonb_build_array(chosen),jsonb_build_array(jsonb_build_object('id',photo,'note','')));
    raise exception 'Null work quantity was accepted';
  exception when others then if sqlerrm = 'Null work quantity was accepted' then raise; end if; end;
  confirmed := jsonb_set(raw,'{work_items,0,quantity}','18'::jsonb);
  perform public.confirm_site_submission(sid,7000005,confirmed,jsonb_build_array(chosen),jsonb_build_array(jsonb_build_object('id',photo,'note','Possible curing issue')));
  if not exists(select 1 from public.submissions where id=sid and status='confirmed' and transcript='We don set some blockwork.'
    and extraction=raw and confirmed_extraction=confirmed and confirmed_by='Confirmation test foreman' and confirmed_at is not null) then
    raise exception 'Confirmation rewrote history or lost confirmed values'; end if;
  if before_reports <> (select count(*) from public.reports) or before_items <> (select count(*) from public.report_items) then
    raise exception 'Confirmation prematurely costed or created a report'; end if;
  confirmed := jsonb_set(confirmed,'{work_items,0,quantity}','19'::jsonb);
  perform public.confirm_site_submission(sid,7000005,confirmed,jsonb_build_array(chosen),jsonb_build_array(jsonb_build_object('id',photo,'note','')));
  if not exists(select 1 from public.submissions where id=sid and confirmed_extraction=confirmed) then raise exception 'Unlocked values cannot be corrected'; end if;
  if public.get_confirmation_record(sid,7000007)->>'actor' <> 'Confirmation test PM' then raise exception 'Project PM cannot review'; end if;
  perform public.confirm_site_submission(sid,7000007,confirmed,jsonb_build_array(chosen),jsonb_build_array(jsonb_build_object('id',photo,'note','')));
  if not exists(select 1 from public.submissions where id=sid and confirmed_by='Confirmation test PM') then raise exception 'PM identity was not recorded'; end if;
  raise notice 'PASS: private owner, typed quantities, original evidence, confirmed actor, no costing, unlocked corrections';
end;
$$;
set local role anon;
do $$
begin
  begin
    perform public.get_confirmation_record('70000000-0000-4000-8000-000000000005',7000005);
    raise exception 'Anonymous RPC access accepted';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: confirmation RPCs unavailable to browser database roles';
end;
$$;
rollback;
