-- Task 7: draft documents after human confirmation; no approval/lock operation.
begin;
alter table public.reports add column content_snapshot jsonb;
create unique index reports_submission_unique on public.reports(submission_id);

create function public.assemble_report_input(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.submissions%rowtype; p public.projects%rowtype; r public.reports%rowtype;
  report_day date; source jsonb; work jsonb; prices jsonb;
begin
  select * into s from public.submissions where id = p_id;
  if not found then return null; end if;
  select * into p from public.projects where id = s.project_id;
  select * into r from public.reports where submission_id = s.id;
  report_day := coalesce(r.date, (s.created_at at time zone 'Africa/Lagos')::date);
  if r.status = 'locked' and r.content_snapshot is not null then
    source := r.content_snapshot->'source';
  else
    if r.status = 'locked' then
      select coalesce(jsonb_agg(jsonb_build_object('boq_item_id', i.boq_item_id,
        'description', i.description, 'quantity_done', i.quantity_done::text,
        'unit', i.unit_snapshot, 'crew', i.crew, 'confidence', i.confidence::text,
        'confirmed_by', i.confirmed_by) order by i.created_at, i.id), '[]'::jsonb)
      into work from (select ri.*, ri.confirmed_at as created_at from public.report_items ri where report_id = r.id) i;
    else
      select coalesce(jsonb_agg(jsonb_build_object('boq_item_id', s.confirmed_boq_ids->>(w.n::integer - 1),
        'description', w.item->>'description', 'quantity_done', w.item->>'quantity',
        'unit', w.item->>'unit', 'crew', (w.item->>'crew')::integer,
        'confidence', w.item->>'confidence', 'confirmed_by', s.confirmed_by) order by w.n), '[]'::jsonb)
      into work from jsonb_array_elements(coalesce(s.confirmed_extraction->'work_items', '[]'::jsonb)) with ordinality w(item,n);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'item_code', b.item_code,
      'description', coalesce(i.description_snapshot,b.description), 'section', coalesce(i.section_snapshot,b.section),
      'unit', coalesce(i.unit_snapshot,b.unit), 'boq_quantity', b.boq_quantity::text,
      'rate', (case when r.status = 'locked' then coalesce(i.rate_snapshot,b.rate) else b.rate end)::text,
      'cumulative_locked_quantity', coalesce(h.quantity,0)::text) order by b.item_code), '[]'::jsonb)
    into prices from public.boq_items b
    left join lateral (select ri.rate_snapshot, ri.description_snapshot, ri.section_snapshot, ri.unit_snapshot
      from public.report_items ri where ri.report_id = r.id and ri.boq_item_id = b.id order by ri.id limit 1) i on true
    left join lateral (select sum(ri.quantity_done) as quantity from public.report_items ri
      join public.reports history on history.id = ri.report_id
      where ri.boq_item_id = b.id and history.project_id = p.id and history.status = 'locked'
        and history.date <= report_day and history.submission_id <> s.id) h on true
    where b.project_id = p.id;
    source := jsonb_build_object('submission_id',s.id,'date',report_day,'status',s.status,
      'project',jsonb_build_object('id',p.id,'name',p.name,'client',p.client,'location',p.location,'is_demo',p.is_demo),
      'submitted_by',s.submitted_by,'confirmed_by',s.confirmed_by,'confirmed_at',s.confirmed_at,
      'pending_media',exists(select 1 from public.telegram_updates where submission_id=s.id and status='pending'),
      'processing',exists(select 1 from public.submission_ai_jobs where submission_id=s.id and status in ('queued','processing')),
      'items',work,'price_list',prices,
      'materials',coalesce(s.confirmed_extraction->'materials',s.materials),
      'delays',coalesce(s.confirmed_extraction->'delays',s.delays),'issues',coalesce(s.confirmed_extraction->'issues',s.issues),
      'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'storage_url',storage_url,
        'note',coalesce(confirmed_findings->>'note','')) order by created_at,id),'[]'::jsonb)
        from public.submission_photos where submission_id=s.id));
  end if;
  return jsonb_build_object('source',source,'report',case when r.id is null then null else
    jsonb_build_object('id',r.id,'status',r.status,'weather',r.weather,'total_cost',r.total_cost::text,
      'approved_by',r.approved_by,'locked_at',r.locked_at,'document',r.content_snapshot) end);
end;
$$;

create function public.get_site_report_input(p_id uuid,p_telegram_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.submissions s join public.telegram_users u on u.project_id=s.project_id
    where s.id=p_id and u.telegram_id=p_telegram_id and (s.telegram_id=p_telegram_id or u.role='pm')) then return null; end if;
  return public.assemble_report_input(p_id);
end;
$$;

-- Public preview exposes only this original fictional seeded report, never real
-- Telegram notes sent to the demo project or their private media.
create function public.get_demo_report_input() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.reports r join public.submissions s on s.id=r.submission_id
    join public.projects p on p.id=r.project_id where r.id='40000000-0000-4000-8000-000000000004'
    and r.submission_id='30000000-0000-4000-8000-000000000004' and p.project_code='LEKKI-DEMO-01'
    and p.is_demo and s.telegram_id is null and r.status='locked') then return null; end if;
  return public.assemble_report_input('30000000-0000-4000-8000-000000000004');
end;
$$;

create function public.save_site_draft(p_id uuid,p_telegram_id bigint,p_source jsonb,p_document jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare current_input jsonb; s public.submissions%rowtype; report_uuid uuid; row jsonb; cost jsonb;
  n integer; stored_total numeric; chosen public.boq_items%rowtype;
begin
  perform 1 from public.submission_ai_jobs where submission_id=p_id for update;
  select * into s from public.submissions where id=p_id for update;
  if not found or s.status <> 'confirmed' or s.confirmed_at is null then raise exception 'Human confirmation is required'; end if;
  perform 1 from public.boq_items where project_id=s.project_id for share;
  current_input := public.get_site_report_input(p_id,p_telegram_id);
  if current_input is null then raise exception 'Report access unavailable'; end if;
  if (current_input->'source') is distinct from p_source or (p_source->>'pending_media')::boolean
    or (p_source->>'processing')::boolean then raise exception 'Report inputs changed; try again'; end if;
  if p_document->'source' is distinct from p_source or p_document->>'currency' is distinct from 'NGN'
    or nullif(btrim(p_document->>'firm_name'),'') is null
    or length(p_document->>'firm_name') > 200 or length(p_document->>'weather') > 500
    or jsonb_typeof(p_document->'costing'->'items') is distinct from 'array'
    or jsonb_array_length(p_document->'costing'->'items') <> jsonb_array_length(p_source->'items') then
    raise exception 'Invalid report document'; end if;
  select id into report_uuid from public.reports where submission_id=p_id;
  if report_uuid is null then
    insert into public.reports(project_id,submission_id,date) values(s.project_id,s.id,(p_source->>'date')::date)
      returning id into report_uuid;
  end if;
  -- Rebuilding an unlocked draft replaces only its generated item rows. Original
  -- transcript/extraction/photos and every locked record remain untouched.
  delete from public.report_items where report_id=report_uuid;
  for row,n in select value,ordinality::integer-1 from jsonb_array_elements(p_source->'items') with ordinality loop
    cost := p_document->'costing'->'items'->n;
    select * into strict chosen from public.boq_items where id=(row->>'boq_item_id')::uuid and project_id=s.project_id;
    if cost->>'boq_item_id' is distinct from row->>'boq_item_id' or cost->>'unit' is distinct from chosen.unit
      or (cost->>'quantity_done')::numeric is distinct from (row->>'quantity_done')::numeric
      or (cost->>'rate')::numeric is distinct from chosen.rate
      or (cost->>'cost_today')::numeric is distinct from (row->>'quantity_done')::numeric*chosen.rate
      or (row->>'quantity_done')::numeric <> round((row->>'quantity_done')::numeric,4) then
      raise exception 'Costing must match confirmed quantities and BoQ'; end if;
    insert into public.report_items(submission_id,report_id,boq_item_id,description,quantity_done,crew,confidence,confirmed_by,confirmed_at)
      values(s.id,report_uuid,chosen.id,row->>'description',(row->>'quantity_done')::numeric,
        (row->>'crew')::integer,(row->>'confidence')::numeric,s.confirmed_by,s.confirmed_at);
  end loop;
  select coalesce(sum(cost_snapshot),0) into stored_total from public.report_items where report_id=report_uuid;
  if (p_document->'costing'->>'total_cost')::numeric is distinct from stored_total then raise exception 'Report total mismatch'; end if;
  update public.reports set total_cost=stored_total,weather=p_document->>'weather',content_snapshot=p_document where id=report_uuid;
  return report_uuid;
end;
$$;

revoke all on function public.assemble_report_input(uuid),public.get_site_report_input(uuid,bigint),
  public.get_demo_report_input(),public.save_site_draft(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.get_site_report_input(uuid,bigint),public.get_demo_report_input(),
  public.save_site_draft(uuid,bigint,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
