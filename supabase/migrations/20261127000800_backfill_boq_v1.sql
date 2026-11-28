begin;
-- BoQ version snapshots are captured by the trigger on
-- account_project_events, created 26 Nov 2026. BoQ items seeded before
-- that trigger existed (25 Nov) have change-history events but no version
-- row, so Version History read "No BoQ versions have been saved yet"
-- above a change history listing the seeded items. Backfill v1 for every
-- project that has BoQ items but no version snapshot yet. The rows are the
-- project's current non-retired items, captured exactly as the trigger
-- would have captured them, and the effective date is the project's
-- earliest BoQ event — no version is invented, and projects that already
-- have snapshots are untouched. Safe to re-run.
insert into public.project_boq_versions (project_id, version, effective_date, rows)
select p.project_id, 1,
  coalesce(
    (select (min(e.created_at) at time zone coalesce(ap.timezone, 'Africa/Lagos'))::date
       from public.account_project_events e
      where e.project_id = p.project_id
        and e.action in ('boq_item_added', 'boq_item_updated')),
    (clock_timestamp() at time zone coalesce(ap.timezone, 'Africa/Lagos'))::date),
  coalesce(
    (select jsonb_agg(to_jsonb(b) order by b.item_code, b.id)
       from public.boq_items b
      where b.project_id = p.project_id and b.retired_at is null),
    '[]'::jsonb)
from (select distinct project_id from public.boq_items where retired_at is null) p
join public.account_projects ap on ap.project_id = p.project_id
where not exists (
  select 1 from public.project_boq_versions v where v.project_id = p.project_id
);
commit;
