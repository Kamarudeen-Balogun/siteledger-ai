# Task 11 — private project dashboard and supplied BoQ

Implemented by Codex on 22 November 2026. Task 12 has not begun. No new Kiro
review, hook execution or Crew run is claimed.

## Behavior

The project ledger leads with contract sum, value earned from locked reports
and the number of variance flags. Ruled BoQ rows are grouped by section, with
locked quantities, percentage complete and recorded value. No dated plan is
supplied in the current data model; flags follow the brief's quantity-overrun
rule. Values exceeding 100% stay visible even though the progress line ends at
the supplied target. Draft work is excluded from earned value and progress.

PMs see project-wide authorized records. Foremen see only their own locked
records, explicitly labelled as such. Project cards show their scoped earned
value with the project's currency; different currencies are never combined.

All dashboard costing uses costReport() on human-confirmed locked quantities
and saved rates. Updating a current BoQ rate cannot reprice prior earned value.
Current BoQ quantities determine progress; edited rates apply to new or rebuilt
drafts. Locked web documents and PDFs keep their original snapshots.

The BoQ screen allows a PM to add and edit supplied item codes, sections,
descriptions, units, quantities and decimal-string rates. New projects remain
empty until rates are supplied. Demo and saved-trial projects show the
verify-before-real-use warning. No currency conversion or generated price is
provided. Quantities retain the existing four-decimal storage limit; rates
remain exact in the project's fixed currency.

## Access and edits

Each request rechecks active membership and PM authority. Archive permits
reading and blocks changes; removal revokes access. Direct anonymous or
authenticated RPC execution is denied. BoQ IDs cannot move between projects;
a unit used in confirmed work is fixed. Changes append an owner-visible audit
event. Review dialogs precede saves. Cancel makes no mutation; stable item IDs
make a lost-response retry idempotent. An old revision cannot overwrite a
different saved edit.

## Acceptance evidence

- 110 unit/API tests pass, including exact decimal value, changed-rate history,
  quantity overruns, payload/authentication rejection and a KWD Telegram summary.
- Dashboard SQL passes with independent owners, different project roles,
  foreman scope, repeated writes, stale edits, fixed units, archives, revocation
  and immutable locked snapshots.
- Fresh installation, legacy migration, account-record and trial SQL pass.
- Lint, TypeScript and production build pass.
- The final native browser workflow passes: BoQ creation and cancellation,
  PM rate editing, foreman read-only access, unchanged locked PDF bytes and
  displayed earned value after rate edits, exact KWD report/PDF costing and
  dashboard rendering at 390/768/1440px without page overflow. Existing account,
  invitation, offline queue, linking/recovery, trial handover and approval flows
  also pass. Saved trials retain their illustrative-rate warning.
- Final desktop and phone screenshots were inspected. Quantity overruns show
  red text and a red progress line; the original cost remains visible.
- Hosted migration `20261122081130_dashboard_and_supplied_boq` passes a guarded
  transaction comparing every original row across 36 existing public tables.
  The 13 locked reports, 2 amendments, 15 submissions and 4 photos remain
  unchanged. Anonymous dashboard RPC and direct authenticated BoQ-write RPC
  are denied. An unsigned live-preview write returns HTTP 401.
- The updated development preview opens through the existing HTTPS tunnel.
  This is not task 13 production deployment.

Browser and SQL fixtures are disposable. No real emails, provider calls,
genuine evidence edits or live-market-price claims follow from these checks.
Artifacts remain under ignored supabase/.temp/task-10a/. The README includes
the final desktop ledger screenshot. The unrelated sessionstart-probe hook is
untouched and excluded from this task's commit.
