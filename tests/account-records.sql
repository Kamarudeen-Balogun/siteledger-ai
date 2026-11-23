-- Disposable report evidence. Supplied BoQ fixtures exercise real boundaries.
begin;
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
insert into auth.users(id,email,created_at,updated_at,aud,role,is_anonymous)
  select ('83000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'record-fixture-'||n||'@example.test',now(),now(),'authenticated','authenticated',false from generate_series(1,4) n;
insert into auth.sessions(id,user_id,created_at,updated_at)
  select ('83000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,('83000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now(),now() from generate_series(1,4) n;
do $$ declare a jsonb; b jsonb; c jsonb; d jsonb; p1 uuid; p2 uuid; owner1 uuid; owner2 uuid; foreman uuid; pm uuid;
  boq uuid; foreign_boq uuid; note uuid; solo uuid; src jsonb; doc jsonb; extraction jsonb; result jsonb; report uuid; amended jsonb; before_doc jsonb;
begin
  a := public.account_browser_session('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000011',repeat('a',64),'Owner One'); owner1 := (a->>'profile_id')::uuid;
  b := public.account_browser_session('83000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000012',repeat('b',64),'Owner Two'); owner2 := (b->>'profile_id')::uuid;
  c := public.account_browser_session('83000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000013',repeat('c',64),'Foreman Original'); foreman := (c->>'profile_id')::uuid;
  d := public.account_browser_session('83000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000014',repeat('d',64),'Reviewing PM'); pm := (d->>'profile_id')::uuid;
  p1 := (public.account_create_project(repeat('a',64),'Record fixture','Fixture client','Fixture site','0','NGN','Africa/Lagos')->>'id')::uuid;
  p2 := (public.account_create_project(repeat('b',64),'Decimal fixture','Fixture client','Fixture site','0','KWD','Asia/Kuwait')->>'id')::uuid;
  insert into public.account_memberships(project_id,profile_id,role) values(p1,foreman,'foreman'),(p1,pm,'pm');
  insert into public.boq_items(project_id,item_code,section,description,unit,boq_quantity,rate)
    select p1,'BW-225',section,description,unit,boq_quantity,rate from public.boq_items where unit='m2' and rate=14500 limit 1 returning id into boq;
  perform pg_temp.check_true(boq is not null,'Fixture takes NGN rate from existing supplied demo BoQ');
  insert into public.boq_items(project_id,item_code,section,description,unit,boq_quantity,rate) values(p2,'DECIMAL','Fixture','Supplied decimal fixture','m2',1,'0.123') returning id into foreign_boq;
  insert into public.submissions(project_id,submitted_by,source,status) values(p1,'Foreman Original','web','extracted') returning id into note;
  update public.submissions set audio_url='site-evidence/'||p1::text||'/'||note::text||'/0.wav' where id=note;
  insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date) values(note,foreman,'foreman','Foreman Original','NGN','Africa/Lagos',(now() at time zone 'Africa/Lagos')::date);
  perform pg_temp.check_true(public.account_review(repeat('b',64),note) is null,'Independent owner cannot read note/photos');
  perform pg_temp.check_true(public.account_report_input(repeat('b',64),note) is null,'Independent owner cannot read report/PDF input');
  perform pg_temp.check_true(public.account_review(repeat('a',64),note) is not null,'Project PM can review foreman record');
  perform pg_temp.check_true((select count(*)=0 from public.reports where submission_id=note),'No cost/report before human confirmation');
  extraction := jsonb_build_object('work_items',jsonb_build_array(jsonb_build_object('description','Confirmed blockwork','matched_boq_hint',null,'quantity',18,'unit','m2','crew',6,'confidence',1)),
    'materials','[]'::jsonb,'delays','[]'::jsonb,'issues','[]'::jsonb,'raw_language_notes','');
  result := public.account_confirm(repeat('c',64),note,extraction,jsonb_build_array(boq),'[]'::jsonb);
  perform pg_temp.check_true(result->>'status'='confirmed','Foreman confirms own values');
  src := public.account_report_input(repeat('c',64),note)->'source';
  doc := jsonb_build_object('source',src,'firm_name','SiteLedger AI','currency','NGN','weather',null,'costing',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('boq_item_id',boq,'unit','m2','quantity_done',18,'rate',14500,'cost_today',261000)),'total_cost',261000));
  report := public.account_save_draft(repeat('c',64),note,src,doc);
  perform pg_temp.check_true((select total_cost=261000 from public.reports where id=report),'Cost uses confirmed quantity times supplied BoQ');
  perform pg_temp.check_true(public.account_approve(repeat('c',64),note,doc)->>'error'='forbidden','Foreman cannot approve');
  result := public.account_approve(repeat('d',64),note,doc);
  perform pg_temp.check_true(result->>'status'='locked','PM explicitly approves after separate confirmation');
  perform pg_temp.check_true((select profile_id=foreman and role='foreman' and name='Foreman Original' from public.account_confirmations where submission_id=note),'Confirmation snapshots person/name/role');
  perform pg_temp.check_true((select profile_id=pm and role='pm' and name='Reviewing PM' from public.account_approvals where report_id=report),'Approval snapshots actual PM');
  before_doc := (select content_snapshot from public.reports where id=report);
  perform public.account_profile_name(repeat('c',64),'Foreman Updated');
  perform public.account_profile_name(repeat('d',64),'PM Updated');
  perform pg_temp.check_true(public.account_report_input(repeat('c',64),note)->'report'->'document'=before_doc,'Profile edits never rename/reprice locked document');
  amended := public.account_amend(repeat('c',64),note,'Confirmed correction fixture','83000000-0000-4000-8000-000000000091');
  perform pg_temp.check_true(amended->>'author'='Foreman Updated','New amendment uses current confirmed name');
  perform public.account_profile_name(repeat('c',64),'Foreman Latest');
  perform pg_temp.check_true(public.account_amend(repeat('c',64),note,'Confirmed correction fixture','83000000-0000-4000-8000-000000000091')->>'author'='Foreman Updated','Retry keeps original amendment attribution');
  perform pg_temp.check_true(public.account_dispute_log(repeat('b',64),note) is null,'Stranger cannot read dispute log');
  perform public.account_manage_member(repeat('a',64),p1,foreman,null,true);
  perform pg_temp.check_true(public.account_review(repeat('c',64),note) is null and public.account_report_input(repeat('c',64),note) is null and public.account_dispute_log(repeat('c',64),note) is null,'Removal immediately blocks all record/media/report inputs');
  perform public.account_archive_project(repeat('a',64),p1,true);
  perform pg_temp.check_true(public.account_report_input(repeat('d',64),note) is not null,'Archive retains authorized locked history');
  perform pg_temp.check_true(public.account_amend(repeat('d',64),note,'Blocked while archived','83000000-0000-4000-8000-000000000092')->>'error'='archived','Archive blocks new amendments');
  perform pg_temp.check_true((select content_snapshot=before_doc from public.reports where id=report),'Archive/removal preserve locked evidence');
  -- A solo owner/PM uses distinct confirmation and approval with the same honest identity.
  insert into public.submissions(project_id,submitted_by,source,status) values(p2,'Owner Two','web','extracted') returning id into solo;
  update public.submissions set audio_url='site-evidence/'||p2::text||'/'||solo::text||'/0.wav' where id=solo;
  insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date) values(solo,owner2,'pm','Owner Two','KWD','Asia/Kuwait',(now() at time zone 'Asia/Kuwait')::date);
  extraction := jsonb_set(extraction,'{work_items,0,quantity}','0.1234');
  perform public.account_confirm(repeat('b',64),solo,extraction,jsonb_build_array(foreign_boq),'[]'::jsonb);
  src := public.account_report_input(repeat('b',64),solo)->'source';
  perform pg_temp.check_true(src->'project'->>'currency'='KWD' and src->'project'->>'timezone'='Asia/Kuwait','Project currency/timezone flow into source snapshot');
  doc := jsonb_build_object('source',src,'firm_name','SiteLedger AI','currency','KWD','weather',null,'costing',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('boq_item_id',foreign_boq,'unit','m2','quantity_done','0.1234','rate','0.123','cost_today','0.0151782')),'total_cost','0.0151782'));
  report := public.account_save_draft(repeat('b',64),solo,src,doc);
  result := public.account_approve(repeat('b',64),solo,doc);
  perform pg_temp.check_true(result->>'approved_by'='Owner Two','Solo owner approval is honestly attributed');
  perform pg_temp.check_true((select total_cost=0.0151782 and content_snapshot->>'currency'='KWD' from public.reports where id=report),'Seven-decimal supplied costs stay exact');
  perform pg_temp.check_true((select name='Owner Two' and role='pm' from public.account_submission_people where submission_id=solo),'PM intake never claims foreman role');
  perform pg_temp.check_true((select profile_id=owner2 from public.account_confirmations where submission_id=solo) and (select profile_id=owner2 from public.account_approvals where report_id=report),'Solo steps retain separate person snapshots');
end $$;
rollback;
