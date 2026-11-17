-- Fictional demo history, 3–16 November 2026. Every rate is from brief section 10.
-- No generated audio or photo URLs are claimed as real evidence.
begin;
do $$
declare
  demo_project constant uuid := '10000000-0000-4000-8000-000000000001';
  day_index integer;
  item_index integer;
  submission_uuid uuid;
  report_uuid uuid;
  item_uuid uuid;
  work_quantity numeric;
  report_day date;
  boq_row record;
  report_total numeric;
  dates date[] := array['2026-11-03','2026-11-04','2026-11-05','2026-11-06',
    '2026-11-07','2026-11-09','2026-11-10','2026-11-11','2026-11-12',
    '2026-11-13','2026-11-14','2026-11-16']::date[];
  block225 numeric[] := array[10,12,14,10,16,12,14,18,14,16,14,18];
  block150 numeric[] := array[6,8,8,6,10,6,8,8,6,8,6,6];
  concrete numeric[] := array[1,1.5,1,0.5,1.5,1,1,1.5,1,1.5,1,1.5];
  reinforcement numeric[] := array[0.1,0.15,0.1,0.1,0.15,0.1,0.15,0.15,0.1,0.2,0.1,0.2];
  excavation numeric[] := array[30,28,27,27,0,0,0,0,0,0,0,0];
  hardcore numeric[] := array[20,20,15,15,0,0,0,0,0,0,0,0];
  oversite numeric[] := array[30,35,40,25,30,20,0,0,0,0,0,0];
begin
  if exists (select 1 from public.projects where id = demo_project) then
    raise notice 'SiteLedger demo already exists; existing records were preserved';
    return;
  end if;

  insert into public.projects(id, project_code, name, client, location, is_demo, created_at)
  values (demo_project, 'LEKKI-DEMO-01', '4-Bedroom Duplex, Lekki Phase 1, Lagos',
    'Adebayo Family (fictional demo client)', 'Lekki Phase 1, Lagos, Nigeria', true,
    '2026-11-02 08:00:00+01');

  insert into public.boq_items(id, project_id, item_code, section, description, unit, boq_quantity, rate)
  select ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
         demo_project, code, section, description, unit, quantity, rate
  from (values
    (1,'SUB-01','Substructure','Excavation, foundation trenches','m3',110,8500),
    (2,'SUB-02','Substructure','Hardcore filling, compacted','m3',70,18000),
    (3,'SUB-03','Substructure','Oversite concrete (German floor), 150mm','m2',180,22500),
    (4,'CON-01','Concrete','In-situ concrete, columns and beams','m3',35,145000),
    (5,'CON-02','Concrete','Reinforcement, high-yield bars, cut and fixed','tonne',4.5,1450000),
    (6,'BLK-01','Blockwork','Sandcrete blocks 225mm hollow, laid','m2',420,14500),
    (7,'BLK-02','Blockwork','Sandcrete blocks 150mm hollow, laid','m2',240,11800),
    (8,'ROF-01','Roofing','Timber roof structure, treated','m2',180,28000),
    (9,'ROF-02','Roofing','Aluminium roofing sheets, long span','m2',180,19500),
    (10,'FIN-01','Finishes','Plastering, walls, 12mm','m2',1100,4800),
    (11,'FIN-02','Finishes','Screeding, floors','m2',300,5500),
    (12,'FIN-03','Finishes','Ceramic floor tiles, supplied and laid','m2',280,16000),
    (13,'SER-01','Services','Electrical first fix, conduit and wiring','point',75,35000),
    (14,'SER-02','Services','Plumbing first fix','point',48,42000),
    (15,'LAB-01','Labour (daywork)','Mason, per day','day',40,12000),
    (16,'LAB-02','Labour (daywork)','Labourer, per day','day',80,6000)
  ) as prices(n, code, section, description, unit, quantity, rate);

  update public.projects set contract_sum = (
    select sum(boq_quantity * rate) from public.boq_items where project_id = demo_project
  ) where id = demo_project;

  for day_index in 1..12 loop
    report_day := dates[day_index];
    submission_uuid := ('30000000-0000-4000-8000-' || lpad(day_index::text,12,'0'))::uuid;
    report_uuid := ('40000000-0000-4000-8000-' || lpad(day_index::text,12,'0'))::uuid;

    insert into public.submissions(id, project_id, submitted_by, source, transcript,
      materials, delays, issues, status, created_at)
    values (submission_uuid, demo_project, 'Musa Bello (demo foreman)', 'web',
      format('Demo foreman note: Block setting, east elevation, %s m2 of 225mm blocks. Internal partitions, %s m2 of 150mm blocks. We don cast %s m3 for columns and beams, and fixed %s tonne of high-yield reinforcement. Six boys worked on these items.',
        block225[day_index], block150[day_index], concrete[day_index], reinforcement[day_index])
      || case when excavation[day_index] > 0 then format(' Excavation, %s m3.', excavation[day_index]) else '' end
      || case when hardcore[day_index] > 0 then format(' Hardcore compacted, %s m3.', hardcore[day_index]) else '' end
      || case when oversite[day_index] > 0 then format(' German floor, %s m2.', oversite[day_index]) else '' end
      || case when day_index = 5 then ' Site clearing: three additional labourer days.' else '' end
      || case when day_index >= 11 then ' Electrical first fix, four points.' else '' end
      || case when day_index = 4 then ' Rain stopped external work, two hours.' else '' end
      || case when day_index = 8 then ' Forty bags cement delivered. Possible honeycombing at column C3; PM should inspect.' else '' end,
      case when day_index = 8 then '[{"name":"Cement","quantity":40,"unit":"bags","action":"delivered","confidence":1}]'::jsonb else '[]'::jsonb end,
      case when day_index = 4 then '[{"reason":"Rain stopped external work","hours":2,"confidence":1}]'::jsonb else '[]'::jsonb end,
      case when day_index = 8 then '["Possible honeycombing at column C3 — PM inspection requested"]'::jsonb else '[]'::jsonb end,
      'confirmed', report_day + time '16:20' at time zone 'Africa/Lagos');

    insert into public.reports(id, project_id, submission_id, date, weather, created_at)
    values (report_uuid, demo_project, submission_uuid, report_day,
      case when day_index = 4 then 'Rain, external work stopped for 2 hrs' else 'Warm, partly cloudy' end,
      report_day + time '17:00' at time zone 'Africa/Lagos');

    for item_index in 1..16 loop
      work_quantity := case item_index
        when 1 then excavation[day_index]
        when 2 then hardcore[day_index]
        when 3 then oversite[day_index]
        when 4 then concrete[day_index]
        when 5 then reinforcement[day_index]
        when 6 then block225[day_index]
        when 7 then block150[day_index]
        when 13 then case when day_index >= 11 then 4 else 0 end
        when 16 then case when day_index = 5 then 3 else 0 end
        else 0 end;
      if work_quantity = 0 then continue; end if;
      item_uuid := ('20000000-0000-4000-8000-' || lpad(item_index::text,12,'0'))::uuid;
      select * into strict boq_row from public.boq_items where id = item_uuid;
      insert into public.report_items(submission_id, report_id, boq_item_id, description,
        quantity_done, crew, confidence, confirmed_by, confirmed_at)
      values (submission_uuid, report_uuid, item_uuid,
        case item_index when 6 then 'Blockwork — East elevation'
          when 7 then 'Blockwork — Internal partitions'
          when 16 then 'Site clearing — additional daywork'
          else boq_row.description end,
        work_quantity, case when item_index in (4,5,6,7) then 6 else 4 end, 1,
        'Engr. Tola Adeyemi (demo PM)', report_day + time '16:45' at time zone 'Africa/Lagos');
    end loop;

    select sum(cost_snapshot) into report_total from public.report_items where report_id = report_uuid;
    update public.reports set total_cost = report_total, status = 'locked',
      approved_by = 'Engr. Tola Adeyemi (demo PM)',
      locked_at = report_day + time '17:30' at time zone 'Africa/Lagos'
    where id = report_uuid;
  end loop;

  insert into public.amendments(id, report_id, author, note, created_at)
  values ('60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000008', 'Engr. Tola Adeyemi (demo PM)',
    'Demo follow-up: column C3 inspected on 12 November. Local honeycombing repair completed and reviewed; the original observation remains in the locked record.',
    '2026-11-12 15:40:00+01');
end;
$$;
commit;
