-- Local transactional approval/amendment tests. All fixtures and locks roll back.
begin;
set local role service_role;
do $$
declare project_uuid uuid := '70000000-0000-4000-8000-000000000080'; boq_uuid uuid := '70000000-0000-4000-8000-000000000081';
  sid uuid := '70000000-0000-4000-8000-000000000082'; sid2 uuid := '70000000-0000-4000-8000-000000000083';
  photo_uuid uuid := '70000000-0000-4000-8000-000000000084'; nonce uuid := '70000000-0000-4000-8000-000000000085';
  values_json jsonb; src jsonb; doc jsonb; doc2 jsonb; rid uuid; rid2 uuid; result jsonb; saved_amendment jsonb;
  original_doc text; locked_record text; seed_hash text;
begin
  select md5(string_agg(to_jsonb(r)::text,'' order by id)) into seed_hash from public.reports r where status='locked';
  insert into public.projects(id,project_code,name,client,location) values(project_uuid,'LOCAL-LOG-QA','Local dispute log QA','Fictional test','Lagos');
  insert into public.boq_items(id,project_id,item_code,description,section,unit,boq_quantity,rate)
    values(boq_uuid,project_uuid,'BLK-01','Sandcrete blocks 225mm hollow, laid','Blockwork','m2',420,14500);
  insert into public.telegram_users(telegram_id,display_name,project_id,role) values
    (800080,'Local QA foreman',project_uuid,'foreman'),(800081,'Local QA PM',project_uuid,'pm'),(800082,'Other QA foreman',project_uuid,'foreman'),
    (800083,'Unrelated PM','10000000-0000-4000-8000-000000000001','pm');
  values_json := '{"work_items":[{"description":"Blockwork","matched_boq_hint":null,"quantity":18,"unit":"m2","crew":6,"confidence":1}],"materials":[],"delays":[],"issues":[],"raw_language_notes":"Local QA"}';
  insert into public.submissions(id,project_id,telegram_id,submitted_by,source,transcript,extraction,status,created_at) values
    (sid,project_uuid,800080,'Local QA foreman','telegram','Original local QA transcript',values_json,'extracted','2026-11-18 16:00:00+01'),
    (sid2,project_uuid,800082,'Other QA foreman','telegram','Second local QA transcript',values_json,'extracted','2026-11-19 16:00:00+01');
  insert into public.submission_photos(id,submission_id,storage_url) values(photo_uuid,sid,'Local transactional photo fixture');
  perform public.claim_photo_analysis(photo_uuid,nonce);
  perform public.finish_photo_analysis(photo_uuid,nonce,null,'photo_unavailable');
  perform public.confirm_site_submission(sid,800080,values_json,jsonb_build_array(boq_uuid),jsonb_build_array(jsonb_build_object('id',photo_uuid,'note','Original QA observation')));
  perform public.confirm_site_submission(sid2,800082,values_json,jsonb_build_array(boq_uuid),'[]');
  src := public.get_site_report_input(sid,800081)->'source';
  doc := jsonb_build_object('source',src,'firm_name','Perkins Limited','currency','NGN','weather','Rain',
    'costing',jsonb_build_object('total_cost','261000','items',jsonb_build_array(jsonb_build_object('boq_item_id',boq_uuid,
      'unit','m2','quantity_done','18','rate','14500','cost_today','261000'))));
  rid := public.save_site_draft(sid,800080,src,doc);
  if public.latest_confirmation_submission(800081) is distinct from sid then raise exception 'PM did not find pending prior-day draft'; end if;
  src := public.get_site_report_input(sid2,800081)->'source'; doc2 := jsonb_set(doc,'{source}',src);
  rid2 := public.save_site_draft(sid2,800082,src,doc2);
  if public.latest_confirmation_submission(800081) is distinct from sid2 then raise exception 'PM draft priority incorrect'; end if;
  if public.approve_site_report(sid,800080,doc)->>'error' is distinct from 'forbidden' then raise exception 'Foreman approved'; end if;
  if public.approve_site_report(sid,800083,doc)->>'error' is distinct from 'forbidden' then raise exception 'Foreign PM approved'; end if;
  if public.append_site_amendment(sid,800080,'Too early',nonce)->>'error' is distinct from 'locked_required' then raise exception 'Draft amendment accepted'; end if;
  if public.approve_site_report(sid,800081,jsonb_set(doc,'{weather}','"Changed"'))->>'error' is distinct from 'stale' then raise exception 'Wrong reviewed document approved'; end if;
  original_doc := md5(doc::text);
  result := public.approve_site_report(sid,800081,doc);
  if result->>'status' is distinct from 'locked' or result->>'approved_by' is distinct from 'Local QA PM' then raise exception 'PM approval failed'; end if;
  if public.approve_site_report(sid,800081,doc) <> result then raise exception 'Retry changed approval'; end if;
  if not exists(select 1 from public.submissions where id=sid and status='locked' and transcript='Original local QA transcript' and extraction=values_json) then raise exception 'Evidence changed on lock'; end if;
  if original_doc <> (select md5(content_snapshot::text) from public.reports where id=rid) then raise exception 'Locked document rewritten'; end if;
  select md5(to_jsonb(r)::text) into locked_record from public.reports r where id=rid;
  if public.approve_site_report(sid2,800081,doc2)->>'error' is distinct from 'stale' then raise exception 'Concurrent locked history not detected'; end if;
  saved_amendment := public.append_site_amendment(sid,800080,'Correction recorded after inspection.',nonce);
  if saved_amendment->>'author' <> 'Local QA foreman' or (saved_amendment->>'report_id')::uuid <> rid then raise exception 'Wrong amendment identity/link'; end if;
  if public.append_site_amendment(sid,800080,'Correction recorded after inspection.',nonce) <> saved_amendment then raise exception 'Retry duplicated amendment'; end if;
  if public.append_site_amendment(sid,800080,'Different text',nonce)->>'error' is distinct from 'request_conflict' then raise exception 'Retried text overwritten'; end if;
  if public.append_site_amendment(sid,800082,'Other owner',gen_random_uuid())->>'error' is distinct from 'unavailable' then raise exception 'Other foreman amended'; end if;
  if (select count(*) from public.amendments where report_id=rid) <> 1 then raise exception 'Wrong amendment count'; end if;
  if locked_record <> (select md5(to_jsonb(r)::text) from public.reports r where id=rid) then raise exception 'Amendment altered original'; end if;
  begin update public.reports set weather='Edited' where id=rid; raise exception 'FAIL: edit'; exception when raise_exception then if sqlerrm not like 'Locked reports cannot%' then raise; end if; end;
  begin delete from public.reports where id=rid; raise exception 'FAIL: delete'; exception when raise_exception then if sqlerrm not like 'Locked reports cannot%' then raise; end if; end;
  begin update public.report_items set quantity_done=19 where report_id=rid; raise exception 'FAIL: quantity'; exception when raise_exception then if sqlerrm not like 'Evidence belonging to a locked%' then raise; end if; end;
  begin update public.submission_photos set confirmed_findings='{}' where id=photo_uuid; raise exception 'FAIL: photo'; exception when raise_exception then if sqlerrm not like 'Evidence belonging to a locked%' then raise; end if; end;
  begin update public.submissions set confirmed_extraction='{}' where id=sid; raise exception 'FAIL: submission'; exception when raise_exception then if sqlerrm not like 'Locked submission evidence%' then raise; end if; end;
  begin update public.amendments set note='Edited' where report_id=rid; raise exception 'FAIL: amend edit'; exception when raise_exception then if sqlerrm <> 'Amendments are append-only' then raise; end if; end;
  begin delete from public.amendments where report_id=rid; raise exception 'FAIL: amend delete'; exception when raise_exception then if sqlerrm <> 'Amendments are append-only' then raise; end if; end;
  result := public.get_site_dispute_log(sid,800080);
  if jsonb_array_length(result->'entries') <> 2 or result->'entries'->0->>'kind' <> 'report' or result->'entries'->1->>'kind' <> 'amendment' then raise exception 'Wrong log order'; end if;
  if public.get_site_dispute_log(sid,800082) is not null or public.get_site_dispute_log(sid,800083) is not null then raise exception 'Private log leaked'; end if;
  result := public.get_demo_dispute_log();
  if jsonb_array_length(result->'entries') <> 13 then raise exception 'Public demo leaked test entries'; end if;
  if seed_hash <> (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from public.reports r where status='locked' and id<>rid) then raise exception 'Seed history changed'; end if;
  raise notice 'PASS: PM-only reviewed approval, atomic evidence locks, retries, stale history, amendments, direct protections and private ordered logs';
end $$;
set local role anon;
do $$ begin
  begin perform public.get_demo_dispute_log(); raise exception 'FAIL: anonymous log RPC'; exception when insufficient_privilege then null; end;
  begin perform public.approve_site_report(gen_random_uuid(),800081,'{}'); raise exception 'FAIL: anonymous approval'; exception when insufficient_privilege then null; end;
  begin perform public.append_site_amendment(gen_random_uuid(),800081,'Forged',gen_random_uuid()); raise exception 'FAIL: anonymous amendment'; exception when insufficient_privilege then null; end;
  raise notice 'PASS: browser database roles cannot call log/approval/amendment RPCs';
end $$;
rollback;
