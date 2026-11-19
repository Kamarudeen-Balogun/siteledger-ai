-- Local-only transactional checks; no lasting fixture or locked-record changes.
begin;
set local role service_role;
do $$
declare sid uuid := '70000000-0000-4000-8000-000000000071'; project uuid := '10000000-0000-4000-8000-000000000001';
  chosen uuid := '20000000-0000-4000-8000-000000000006'; values_json jsonb; src jsonb; doc jsonb;
  rid uuid; original_seed text; result jsonb;
begin
  select md5(to_jsonb(r)::text) into original_seed from public.reports r where id='40000000-0000-4000-8000-000000000004';
  insert into public.telegram_users(telegram_id,display_name,project_id,role) values(7000071,'Report test foreman',project,'foreman'),(7000072,'Other report foreman',project,'foreman'),(7000073,'Report test PM',project,'pm');
  values_json := jsonb_build_object('work_items',jsonb_build_array(jsonb_build_object('description','Blockwork — East elevation','matched_boq_hint',null,
    'quantity',18,'unit','m2','crew',6,'confidence',1)), 'materials','[]'::jsonb,'delays','[]'::jsonb,'issues','[]'::jsonb,'raw_language_notes','Pidgin');
  insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status,created_at)
    values(sid,project,7000071,'Report test foreman','telegram','Original voice note',values_json,'extracted','2026-11-18 16:00:00+01');
  if public.get_site_report_input(sid,7000072) is not null then raise exception 'Other foreman accessed report'; end if;
  perform public.confirm_site_submission(sid,7000071,values_json,jsonb_build_array(chosen),'[]'::jsonb);
  src := public.get_site_report_input(sid,7000071)->'source';
  if src->'items'->0->>'quantity_done' <> '18' then raise exception 'Confirmed quantity missing'; end if;
  doc := jsonb_build_object('source',src,'firm_name','Perkins Limited','currency','NGN','weather','Rain',
    'costing',jsonb_build_object('total_cost','261000','items',jsonb_build_array(jsonb_build_object('boq_item_id',chosen,'unit','m2','quantity_done','18','rate','14500','cost_today','261000',
      'cumulative_quantity','186','percentage_complete','44.285714285714285714285714285714','value_earned','2697000','productivity','3','crew',6,'confirmed_by','Report test foreman',
      'planned_percentage',null,'variance_percentage_points',null,'is_overrun',false,'is_behind_plan',false,'variance_color',null))));
  rid := public.save_site_draft(sid,7000071,src,doc);
  if not exists(select 1 from public.reports where id=rid and status='draft' and total_cost=261000 and approved_by is null and weather='Rain') then raise exception 'Draft was not saved correctly'; end if;
  if not exists(select 1 from public.report_items where report_id=rid and quantity_done=18 and rate_snapshot=14500 and cost_snapshot=261000) then raise exception 'Snapshots differ from BoQ'; end if;
  if not exists(select 1 from public.submissions where id=sid and transcript='Original voice note' and extraction=values_json and status='confirmed') then raise exception 'Source evidence changed'; end if;
  if public.save_site_draft(sid,7000071,src,doc) <> rid or (select count(*) from public.report_items where report_id=rid) <> 1 then raise exception 'Retry duplicated draft'; end if;
  begin
    perform public.save_site_draft(sid,7000071,src,jsonb_set(doc,'{costing,total_cost}','"0"'));
    raise exception 'FAIL: forged total accepted';
  exception when raise_exception then if sqlerrm='FAIL: forged total accepted' then raise; end if; end;
  begin
    perform public.save_site_draft(sid,7000071,src,jsonb_set(doc,'{currency}','"USD"'));
    raise exception 'FAIL: currency relabel accepted';
  exception when raise_exception then if sqlerrm='FAIL: currency relabel accepted' then raise; end if; end;
  values_json := jsonb_set(values_json,'{work_items,0,quantity}','19');
  perform public.confirm_site_submission(sid,7000071,values_json,jsonb_build_array(chosen),'[]'::jsonb);
  begin
    perform public.save_site_draft(sid,7000071,src,doc);
    raise exception 'FAIL: stale source accepted';
  exception when raise_exception then if sqlerrm='FAIL: stale source accepted' then raise; end if; end;
  if (select total_cost from public.reports where id=rid) <> 261000 then raise exception 'Failed save altered draft'; end if;
  result := public.get_demo_report_input();
  if result->'source'->>'submission_id' <> '30000000-0000-4000-8000-000000000004' then raise exception 'Demo exposed private submission'; end if;
  if original_seed <> (select md5(to_jsonb(r)::text) from public.reports r where id='40000000-0000-4000-8000-000000000004') then raise exception 'Seeded locked report changed'; end if;
  raise notice 'PASS: private access, exact costs, snapshots, retry, evidence, stale/forged saves and read-only demo';
end;
$$;
set local role anon;
do $$ begin
  begin perform public.get_demo_report_input(); raise exception 'Anonymous database RPC accepted'; exception when insufficient_privilege then null; end;
  raise notice 'PASS: report RPCs unavailable to browser database roles';
end $$;
rollback;
