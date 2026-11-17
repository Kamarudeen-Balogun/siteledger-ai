-- SiteLedger data foundation: PROJECT_BRIEF.md sections 8, 10, and 12.
-- Application access uses trusted server routes; browser roles have no writes.
begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  name text not null,
  client text not null,
  location text not null,
  contract_sum numeric(18, 2) not null default 0 check (contract_sum >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  item_code text not null,
  section text not null,
  description text not null,
  unit text not null check (unit in ('m3', 'm2', 'tonne', 'point', 'day')),
  boq_quantity numeric(14, 4) not null check (boq_quantity > 0),
  rate numeric(18, 2) not null check (rate >= 0),
  unique (project_id, item_code)
);

create table public.telegram_users (
  telegram_id bigint primary key,
  display_name text not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  role text not null check (role in ('foreman', 'pm')),
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  telegram_id bigint references public.telegram_users(telegram_id) on delete restrict,
  submitted_by text not null,
  source text not null check (source in ('telegram', 'web')),
  audio_url text,
  transcript text,
  extraction jsonb,
  materials jsonb not null default '[]'::jsonb check (jsonb_typeof(materials) = 'array'),
  delays jsonb not null default '[]'::jsonb check (jsonb_typeof(delays) = 'array'),
  issues jsonb not null default '[]'::jsonb check (jsonb_typeof(issues) = 'array'),
  status text not null default 'received' check (status in ('received', 'extracted', 'confirmed', 'locked')),
  created_at timestamptz not null default now()
);

create table public.submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  storage_url text not null,
  ai_findings jsonb,
  confirmed_findings jsonb,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  submission_id uuid not null unique references public.submissions(id) on delete restrict,
  date date not null,
  weather text,
  status text not null default 'draft' check (status in ('draft', 'locked')),
  total_cost numeric(24, 6) not null default 0 check (total_cost >= 0),
  pdf_url text,
  approved_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, date),
  check (
    (status = 'draft' and locked_at is null and approved_by is null)
    or (status = 'locked' and locked_at is not null and nullif(btrim(approved_by), '') is not null)
  )
);

create table public.report_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  report_id uuid references public.reports(id) on delete restrict,
  boq_item_id uuid not null references public.boq_items(id) on delete restrict,
  description text not null,
  quantity_done numeric(14, 4) not null check (quantity_done >= 0),
  crew integer check (crew > 0),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  confirmed_by text not null check (nullif(btrim(confirmed_by), '') is not null),
  confirmed_at timestamptz not null default now(),
  -- The database captures the supplied BoQ's rate, never a caller's invented price.
  rate_snapshot numeric(18, 2) not null check (rate_snapshot >= 0),
  description_snapshot text not null,
  unit_snapshot text not null,
  section_snapshot text not null,
  cost_snapshot numeric(24, 6) generated always as (quantity_done * rate_snapshot) stored
);

create table public.amendments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  author text not null check (nullif(btrim(author), '') is not null),
  note text not null check (nullif(btrim(note), '') is not null),
  created_at timestamptz not null default now()
);

create index boq_items_project_idx on public.boq_items(project_id);
create index submissions_project_created_idx on public.submissions(project_id, created_at);
create index submission_photos_submission_idx on public.submission_photos(submission_id);
create index reports_project_date_idx on public.reports(project_id, date);
create index report_items_report_idx on public.report_items(report_id);
create index report_items_submission_idx on public.report_items(submission_id);
create index report_items_boq_idx on public.report_items(boq_item_id);
create index amendments_report_created_idx on public.amendments(report_id, created_at);

create function public.guard_submission_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.status = 'locked' then
    raise exception 'Locked submission evidence cannot be changed or deleted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and old.transcript is not null and new.transcript is distinct from old.transcript then
    raise exception 'The raw transcript is immutable; corrections belong in confirmed values';
  end if;
  if new.status = 'locked' and not exists (
    select 1 from public.reports where submission_id = new.id and status = 'locked'
  ) then
    raise exception 'A submission can only lock with its approved report';
  end if;
  return new;
end;
$$;

create trigger guard_submission_record before insert or update or delete on public.submissions
for each row execute function public.guard_submission_record();

create function public.guard_submission_child() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Serialize evidence writes with approval, including concurrent requests.
  if tg_op <> 'INSERT' then
    perform 1 from public.submissions where id = old.submission_id for update;
  end if;
  if tg_op <> 'DELETE' then
    perform 1 from public.submissions where id = new.submission_id for update;
  end if;
  if tg_op <> 'INSERT' and exists (
    select 1 from public.submissions where id = old.submission_id and status = 'locked'
  ) then raise exception 'Evidence belonging to a locked report cannot be changed or deleted'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if exists (select 1 from public.submissions where id = new.submission_id and status = 'locked') then
    raise exception 'Evidence cannot be added or moved into a locked submission';
  end if;
  return new;
end;
$$;

create trigger guard_photo_record before insert or update or delete on public.submission_photos
for each row execute function public.guard_submission_child();
create trigger guard_item_record before insert or update or delete on public.report_items
for each row execute function public.guard_submission_child();

create function public.capture_boq_snapshot() returns trigger
language plpgsql set search_path = '' as $$
declare
  selected_boq public.boq_items%rowtype;
  submission_project uuid;
begin
  select * into strict selected_boq from public.boq_items where id = new.boq_item_id;
  select project_id into strict submission_project from public.submissions where id = new.submission_id;
  if selected_boq.project_id <> submission_project then
    raise exception 'A confirmed work item must use its project BoQ';
  end if;
  if new.report_id is not null and not exists (
    select 1 from public.reports
    where id = new.report_id and submission_id = new.submission_id
      and project_id = submission_project and status = 'draft'
  ) then raise exception 'A work item must belong to a matching draft report'; end if;

  if tg_op = 'INSERT' or new.boq_item_id is distinct from old.boq_item_id then
    new.rate_snapshot := selected_boq.rate;
    new.description_snapshot := selected_boq.description;
    new.unit_snapshot := selected_boq.unit;
    new.section_snapshot := selected_boq.section;
  else
    new.rate_snapshot := old.rate_snapshot;
    new.description_snapshot := old.description_snapshot;
    new.unit_snapshot := old.unit_snapshot;
    new.section_snapshot := old.section_snapshot;
  end if;
  return new;
end;
$$;

create trigger snapshot_item_boq before insert or update on public.report_items
for each row execute function public.capture_boq_snapshot();

create function public.guard_report_record() returns trigger
language plpgsql set search_path = '' as $$
declare
  approved_cost numeric(24, 6);
  item_count bigint;
begin
  if tg_op <> 'INSERT' and old.status = 'locked' then
    raise exception 'Locked reports cannot be changed or deleted; append an amendment';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and (
    new.project_id is distinct from old.project_id or new.submission_id is distinct from old.submission_id
  ) then raise exception 'A report project and submission cannot be reassigned'; end if;
  perform 1 from public.submissions where id = new.submission_id for update;
  if not exists (
    select 1 from public.submissions where id = new.submission_id and project_id = new.project_id
  ) then raise exception 'The report and submission must belong to the same project'; end if;
  if tg_op = 'INSERT' and new.status = 'locked' then
    raise exception 'Create a draft, attach confirmed items, then approve it';
  end if;
  if new.status = 'locked' then
    if not exists (select 1 from public.submissions where id = new.submission_id and status = 'confirmed') then
      raise exception 'Human confirmation is required before report locking';
    end if;
    select count(*), coalesce(sum(cost_snapshot), 0) into item_count, approved_cost
    from public.report_items where report_id = new.id and submission_id = new.submission_id;
    if item_count = 0 then raise exception 'A locked report needs confirmed work items'; end if;
    if approved_cost <> new.total_cost then
      raise exception 'The approved total must equal the stored BoQ item costs';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_report_record before insert or update or delete on public.reports
for each row execute function public.guard_report_record();

create function public.lock_report_submission() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'locked' and old.status <> 'locked' then
    update public.submissions set status = 'locked' where id = new.submission_id;
  end if;
  return new;
end;
$$;

create trigger lock_report_submission after update on public.reports
for each row execute function public.lock_report_submission();

create function public.guard_amendment_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Amendments are append-only'; end if;
  if not exists (select 1 from public.reports where id = new.report_id and status = 'locked') then
    raise exception 'An amendment must refer to a locked report';
  end if;
  return new;
end;
$$;

create trigger guard_amendment_record before insert or update or delete on public.amendments
for each row execute function public.guard_amendment_record();

-- Query existing approved records without introducing the task 6 costing engine.
create view public.boq_progress with (security_invoker = true) as
select b.id as boq_item_id, b.project_id, b.item_code, b.section, b.description,
       b.unit, b.boq_quantity, b.rate,
       coalesce(h.cumulative_quantity, 0) as cumulative_quantity,
       coalesce(h.recorded_cost, 0) as recorded_cost,
       coalesce(h.cumulative_quantity, 0) / b.boq_quantity * 100 as percentage_complete,
       coalesce(h.cumulative_quantity, 0) > b.boq_quantity as is_overrun
from public.boq_items b
left join (
  select i.boq_item_id, sum(i.quantity_done) as cumulative_quantity,
         sum(i.cost_snapshot) as recorded_cost
  from public.report_items i join public.reports r on r.id = i.report_id
  where r.status = 'locked'
  group by i.boq_item_id
) h on h.boq_item_id = b.id;

create view public.project_summary with (security_invoker = true) as
select p.id, p.project_code, p.name, p.client, p.location, p.contract_sum, p.is_demo,
       coalesce(h.locked_report_count, 0) as locked_report_count,
       coalesce(h.cumulative_cost, 0) as cumulative_cost,
       h.latest_report_date,
       (select count(*) from public.boq_progress b where b.project_id = p.id and b.is_overrun) as overrun_item_count,
       (select count(*) from public.amendments a join public.reports r on r.id = a.report_id where r.project_id = p.id) as amendment_count
from public.projects p
left join (
  select project_id, count(*) as locked_report_count, sum(total_cost) as cumulative_cost,
         max(date) as latest_report_date
  from public.reports where status = 'locked' group by project_id
) h on h.project_id = p.id;

alter table public.projects enable row level security;
alter table public.boq_items enable row level security;
alter table public.telegram_users enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_photos enable row level security;
alter table public.reports enable row level security;
alter table public.report_items enable row level security;
alter table public.amendments enable row level security;

revoke all on public.projects, public.boq_items, public.telegram_users, public.submissions,
  public.submission_photos, public.reports, public.report_items, public.amendments,
  public.boq_progress, public.project_summary from anon, authenticated;
grant select, insert, update, delete on public.projects, public.boq_items, public.telegram_users,
  public.submissions, public.submission_photos, public.reports, public.report_items,
  public.amendments to service_role;
grant select on public.boq_progress, public.project_summary to service_role;

revoke all on function public.guard_submission_record(), public.guard_submission_child(),
  public.capture_boq_snapshot(), public.guard_report_record(), public.lock_report_submission(),
  public.guard_amendment_record() from public, anon, authenticated;

commit;
