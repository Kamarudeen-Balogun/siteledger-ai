-- Run only against this project's disposable local database. All changes roll back.
begin;
set local role service_role;

do $$
declare
  project_summary public.project_summary%rowtype;
  block_progress public.boq_progress%rowtype;
  excavation_progress public.boq_progress%rowtype;
  saved_cost numeric;
  draft_submission uuid := '70000000-0000-4000-8000-000000000001';
  draft_report uuid := '70000000-0000-4000-8000-000000000002';
  test_item uuid := '70000000-0000-4000-8000-000000000003';
  test_project uuid := '70000000-0000-4000-8000-000000000004';
  test_boq uuid := '70000000-0000-4000-8000-000000000005';
begin
  select * into strict project_summary from public.project_summary where project_code = 'LEKKI-DEMO-01';
  if project_summary.contract_sum <> 52328000 or project_summary.cumulative_cost <> 14360800
    or project_summary.locked_report_count <> 12 or project_summary.overrun_item_count <> 1
    or project_summary.amendment_count <> 1 or project_summary.latest_report_date <> '2026-11-16'::date then
    raise exception 'Demo summary must contain 12 locked reports, one overrun, and one amendment';
  end if;
  if (select count(*) from public.boq_items where project_id = project_summary.id) <> 16 then
    raise exception 'All 16 brief rates must be seeded';
  end if;
  select * into strict block_progress from public.boq_progress where item_code = 'BLK-01';
  if block_progress.rate <> 14500 or block_progress.boq_quantity <> 420
    or block_progress.cumulative_quantity <> 168 or block_progress.percentage_complete <> 40 then
    raise exception '225mm blockwork must match the brief rate and 40 percent seeded progress';
  end if;
  select * into strict excavation_progress from public.boq_progress where item_code = 'SUB-01';
  if excavation_progress.cumulative_quantity <> 112 or not excavation_progress.is_overrun then
    raise exception 'Excavation must expose its 112 / 110 m3 overrun';
  end if;
  if exists (
    select 1 from public.reports r
    where r.total_cost <> (select sum(cost_snapshot) from public.report_items where report_id = r.id)
  ) then raise exception 'Every approved total must match its captured item costs'; end if;
  raise notice 'PASS: demo project, all rates, locked totals, cumulative progress, and overrun';

  begin
    update public.reports set status = 'draft', locked_at = null, approved_by = null
    where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: locked report was unlocked';
  exception when raise_exception then
    if sqlerrm not like 'Locked reports cannot%' then raise; end if;
  end;
  begin
    delete from public.reports where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: locked report was deleted';
  exception when raise_exception then
    if sqlerrm not like 'Locked reports cannot%' then raise; end if;
  end;
  begin
    update public.report_items set quantity_done = quantity_done + 1
    where report_id = '40000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: locked quantity was changed';
  exception when raise_exception then
    if sqlerrm not like 'Evidence belonging to a locked%' then raise; end if;
  end;
  begin
    update public.submissions set transcript = 'Rewritten history'
    where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: locked transcript was changed';
  exception when raise_exception then
    if sqlerrm not like 'Locked submission evidence%' then raise; end if;
  end;
  begin
    insert into public.submission_photos(submission_id, storage_url)
    values ('30000000-0000-4000-8000-000000000001', 'test://late-evidence');
    raise exception 'FAIL: evidence was appended to a locked report';
  exception when raise_exception then
    if sqlerrm not like 'Evidence cannot be added%' then raise; end if;
  end;
  begin
    delete from public.amendments where id = '60000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: amendment was deleted';
  exception when raise_exception then
    if sqlerrm <> 'Amendments are append-only' then raise; end if;
  end;
  begin
    update public.amendments set note = 'Rewritten correction'
    where id = '60000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: amendment was edited';
  exception when raise_exception then
    if sqlerrm <> 'Amendments are append-only' then raise; end if;
  end;
  insert into public.amendments(report_id, author, note)
  values ('40000000-0000-4000-8000-000000000001', 'Test PM', 'An appended correction is allowed.');
  raise notice 'PASS: locked reports, quantities, transcripts, photos, and amendments protected under service_role';

  select sum(total_cost) into saved_cost from public.reports where status = 'locked';
  update public.boq_items set rate = rate + 1000 where id = block_progress.boq_item_id;
  if (select rate_snapshot from public.report_items where boq_item_id = block_progress.boq_item_id limit 1) <> 14500
    or (select sum(total_cost) from public.reports where status = 'locked') <> saved_cost then
    raise exception 'Rate changes must not rewrite captured costs';
  end if;
  update public.boq_items set rate = 14500 where id = block_progress.boq_item_id;
  raise notice 'PASS: rate edits preserve approved historical costs';

  insert into public.submissions(id, project_id, submitted_by, source, transcript)
  values (draft_submission, project_summary.id, 'Test foreman', 'web', '18 m2 block setting, six crew.');
  insert into public.reports(id, project_id, submission_id, date)
  values (draft_report, project_summary.id, draft_submission, '2026-11-17');
  insert into public.report_items(id, submission_id, report_id, boq_item_id, description,
    quantity_done, crew, confidence, confirmed_by, rate_snapshot)
  values (test_item, draft_submission, draft_report, block_progress.boq_item_id,
    'Test blockwork', 18, 6, 1, 'Test PM', 1);
  if (select rate_snapshot from public.report_items where id = test_item) <> 14500
    or (select cost_snapshot from public.report_items where id = test_item) <> 261000 then
    raise exception 'Caller-supplied prices must be replaced by the BoQ snapshot';
  end if;
  begin
    update public.reports set status = 'locked', total_cost = 261000,
      approved_by = 'Test PM', locked_at = now() where id = draft_report;
    raise exception 'FAIL: unconfirmed submission was locked';
  exception when raise_exception then
    if sqlerrm <> 'Human confirmation is required before report locking' then raise; end if;
  end;
  begin
    update public.submissions set transcript = 'A changed raw transcript' where id = draft_submission;
    raise exception 'FAIL: original transcript was rewritten before confirmation';
  exception when raise_exception then
    if sqlerrm not like 'The raw transcript is immutable%' then raise; end if;
  end;
  update public.submissions set status = 'confirmed' where id = draft_submission;
  begin
    update public.reports set status = 'locked', total_cost = 1,
      approved_by = 'Test PM', locked_at = now() where id = draft_report;
    raise exception 'FAIL: invented total was locked';
  exception when raise_exception then
    if sqlerrm <> 'The approved total must equal the stored BoQ item costs' then raise; end if;
  end;

  insert into public.projects(id, project_code, name, client, location)
  values (test_project, 'TEST-OTHER', 'Other test project', 'Test client', 'Lagos');
  insert into public.boq_items(id, project_id, item_code, section, description, unit, boq_quantity, rate)
  values (test_boq, test_project, 'OTHER-01', 'Blockwork', 'Other project blockwork', 'm2', 10, 14500);
  begin
    update public.report_items set boq_item_id = test_boq where id = test_item;
    raise exception 'FAIL: another project BoQ was used';
  exception when raise_exception then
    if sqlerrm <> 'A confirmed work item must use its project BoQ' then raise; end if;
  end;
  begin
    update public.reports set project_id = test_project where id = draft_report;
    raise exception 'FAIL: report was reassigned to a different project';
  exception when raise_exception then
    if sqlerrm <> 'A report project and submission cannot be reassigned' then raise; end if;
  end;
  begin
    insert into public.amendments(report_id, author, note) values (draft_report, 'Test PM', 'Invalid draft amendment');
    raise exception 'FAIL: draft amendment was accepted';
  exception when raise_exception then
    if sqlerrm <> 'An amendment must refer to a locked report' then raise; end if;
  end;
  update public.reports set status = 'locked', total_cost = 261000,
    approved_by = 'Test PM', locked_at = now() where id = draft_report;
  if (select status from public.submissions where id = draft_submission) <> 'locked' then
    raise exception 'Approval must lock the associated submission evidence';
  end if;
  raise notice 'PASS: confirmation, project matching, BoQ rate capture, totals, and approval';
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.project_summary;
    raise exception 'FAIL: anonymous database access was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.amendments(report_id, author, note)
    values ('40000000-0000-4000-8000-000000000001', 'Anonymous', 'Invalid write');
    raise exception 'FAIL: anonymous write was accepted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: browser roles cannot read private tables or write records';
end;
$$;
reset role;
rollback;
