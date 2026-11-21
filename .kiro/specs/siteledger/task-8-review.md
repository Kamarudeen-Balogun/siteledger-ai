# Task 8 review — approval and append-only dispute log

Scope: `PROJECT_BRIEF.md` section 16 task 8, read against sections 4, 8 and 12,
plus the task-8 follow-up (newest-first logs and authorized access). Task 8 is
PM approval/lock and the append-only amendment/dispute log. Photo analysis is
task 9; account/project and currency work is task 10A–11.

Files reviewed (application code, written by Codex, not modified by this
review):

- `lib/log/data.ts` — `getReviewer`, `approveReport`, `addAmendment`,
  `getDisputeLog`, `getDemoDisputeLog`, `reportVersion`.
- `lib/log/api.ts` — `logAction`: origin check, bounded bodies, version/note
  validation; rejects caller identity and extra keys.
- `app/api/reports/[id]/approve/route.ts`, `app/api/reports/[id]/amendments/route.ts`
  — POST-only entry points delegating to `logAction`.
- `app/reports/[id]/page.tsx` — report page integrated with approval/amendment
  forms and the dispute-log link.
- `components/approval-form.tsx`, `components/amendment-form.tsx`,
  `components/dispute-log.tsx`, `app/log/[id]/page.tsx`, `app/log/demo/page.tsx`.
- `supabase/migrations/20261119000100_dispute_log.sql`,
  `20261119000200_pm_review_navigation.sql`,
  `20261119000300_authorized_telegram_start.sql`.
- `lib/data/project-summary.ts`, `lib/data/demo-summary.json`,
  `app/api/projects/[projectCode]/summary/route.ts` — public preview isolation.
- `lib/reports/model.ts` (`lockDate`), `components/report-document.tsx`,
  `lib/pdf/report-template.tsx` — WAT lock stamp.
- `tests/log.test.ts` (4 tests), `tests/log.sql`, `tests/telegram.sql`.

This review owns only `.kiro/specs/siteledger/task-8-review.md` (and the
separate `docs/kiro-hook-test.md` for hook evidence). No application code or
genuine records were changed; no approval or amendment was performed on real
records; historical reviews are untouched. A temporary comment-only edit in
`lib/costing/decimal.ts` was added and reverted during the hook test.

## Requirements check

1. **PM-only approval.** Met. `approve_site_report` resolves the actor from
   `telegram_users` with `role = 'pm'` and the same project; otherwise it returns
   `forbidden` (403). The report page renders `ApprovalForm` only when
   `reviewer.role === "pm"`; a foreman sees "Awaiting project manager approval.
   Your draft remains correctable until it is locked" and no approve control.
   `log.test.ts` confirms a foreman token gets 403 and that 0 approvals reach
   the RPC before the success path. The API sends only
   `{ document_version }`; the server supplies the reviewed document and the
   author — a caller-supplied `approved_by` is rejected (422).

2. **Immutable locked evidence.** Met. `approve_site_report` does not rewrite
   `content_snapshot`; it sets `status='locked'`, `approved_by`, `locked_at`.
   The base-schema `guard_report_record` trigger blocks any update or delete of
   a locked report ("Locked reports cannot be changed or deleted; append an
   amendment") and verifies the locked total equals `sum(cost_snapshot)` with a
   confirmed submission; `lock_report_submission` atomically sets the submission
   to `locked`; `guard_submission_child`/`capture_boq_snapshot` protect the
   transcript, confirmed values, item snapshots and photos. `tests/log.sql`
   directly attempts report, quantity, photo, confirmed-submission and amendment
   edits/deletes — all blocked — and confirms snapshot/evidence hashes are
   unchanged. `reportFromInput` still throws if a stored total diverges from the
   recomputed document total.

3. **Amendment retries.** Met. A unique index on
   `amendments(report_id, request_id)` makes a retry idempotent: a repeat with
   the same `request_id`, note and author returns the existing amendment; the
   same `request_id` with different text returns `request_conflict` (409). New
   amendments insert with
   `created_at = greatest(clock_timestamp(), r.locked_at + interval '1 microsecond')`,
   which fixes the timestamp bug (an amendment can never be timestamped before
   the lock it depends on). The API requires a UUID `request_id` and a 1–5000
   char note; `log.test.ts` confirms retries return 200 with the same id and that
   the document total stays `261000` (no rewrite). `guard_amendment_record`
   enforces append-only (INSERT only) and a locked parent.

4. **Newest-first logs.** Met. `assemble_dispute_log` returns entries
   chronologically (`order by event_time, event_id`) and `dispute-log.tsx`
   renders `log.entries.toReversed()`, so the UI shows newest events first with
   stable timestamp/ID ties. The header states "Newest records first. Original
   entries cannot be changed or deleted." Private logs list only the foreman's
   own or the PM's project locked reports (`u.role='pm' or s.telegram_id=…`),
   ordered by lock/amendment time.

5. **Authorized bot access.** Met. The `20261119000300` migration rewrites
   `prepare_telegram_intake` so `/start` no longer inserts or updates
   `telegram_users`: a known code identifies a site, but only a previously
   authorized account (`linked_user` exists and is already on that project) may
   use it; otherwise the reply is "Ask the project owner to grant you access
   before sending site records." A stranger with the public demo code cannot
   enroll or reassign. Unapproved media intake yields that access-required
   reply without reserving media or creating a submission (`object_path` stays
   null). `db:check-telegram` passes: "known code cannot enroll or reassign
   accounts; authorized roles/names preserved."

6. **Exclusion of live records from public previews.** Met.
   `get_demo_report_input` and `get_demo_dispute_log` expose only the 12
   fictional seeded reports (id pattern `40000000-…0001..0012`, submission
   `30000000-…0001..0012`, `is_demo`, `LEKKI-DEMO-01`, `telegram_id is null`,
   `status='locked'`) and the single original amendment
   (`60000000-…0001`); no real Telegram note or its media is visible. The public
   summary route reads the frozen `lib/data/demo-summary.json` via
   `getDemoProjectSummary`, which makes **no database call** and returns `null`
   (→ 404) for any code other than `LEKKI-DEMO-01`; the file is a verified export
   of the seed (12 reports, 1 amendment, 16 BoQ items, NGN 14,360,800, 1 overrun).
   The demo report itself has no seeded photos, so no private media is exposed.

Also verified against the handoff's broader prompt:

- **Mandatory human acknowledgement.** `approval-form.tsx` requires a checked
  checkbox ("I have reviewed this report and confirm it is ready to lock") before
  the "Approve and lock report" button submits, with clear copy that locking is
  irreversible and corrections become amendments.
- **Reviewed-version and stale-history checks.** `reportVersion` is the SHA-256
  of the reviewed document; `approve_site_report` rejects if
  `r.content_snapshot is distinct from p_document` (the PM's reviewed version)
  or if `current_input->'source'` differs from the snapshot's source, and
  re-verifies the stored total. Project-level serialization (project → AI job →
  submission → report lock order) means a second approval that locked new
  quantities makes another reviewed draft stale. `log.test.ts` confirms a
  post-review document change returns 409 and 0 approvals precede the success.
- **Atomic locks.** Approval locks project, job, submission and report in order
  and relies on the existing triggers to lock the submission and its child
  evidence in the same transaction; the snapshot is not rewritten.
- **WAT lock stamp.** `lockDate(report)` formats `locked_at` in `Africa/Lagos`
  (`en-CA`), so the LOCKED stamp shows the approval date in WAT, independent of
  the report date (the "Date" field still shows the report date). The test
  confirms `locked_at` of `2026-11-18T23:35:00Z` stamps `2026-11-19`.
- **Private log links/expiry.** `getDisputeLog` mints child review tokens with
  the parent's expiry (`(access.expires - 7*86400)*1000`), so reading a log cannot
  renew access; `log.test.ts` confirms the child token's expiry equals the
  parent's and that an unrelated submission id is rejected.
- **PM navigation across dates.** `latest_confirmation_submission` (rewritten in
  `20261119000200`) lets a PM reach submissions that already have a report,
  prioritizing drafts (priority 0), then today (1), then older locked (2); a
  foreman stays today-only. This fixes the newly linked PM's access to a
  prior-day draft.

## Test results (manual runs, this session)

- `npm run test:log` — 4 pass / 0 fail.
- `npm run db:check-log` — PASS ("PM-only reviewed approval, atomic evidence
  locks, retries, stale history, amendments, direct protections and private
  ordered logs"; "browser database roles cannot call log/approval/amendment
  RPCs"), then `ROLLBACK`, exit 0. Targets only the local Docker container
  (`supabase_db_siteledger-ai`); no hosted writes.
- `npm run db:check-telegram` — PASS (four NOTICE lines covering authorized
  start, WAT dates/leases, photo intake, service-only RPCs/private bucket),
  then `ROLLBACK`, exit 0.
- `npm run typecheck` — `tsc --noEmit`, exit 0.
- `npm run lint` — `eslint .`, exit 0.

The disposable browser check (`npm run test:log-browser`) was not run. It is
optional, needs Docker plus free ports 3012/55423/55424, and the handoff already
documents a disposable-clone pass covering foreman work, PM view, lock, PDF,
amendments, retries, forbidden methods, stranger access and newest-first
ordering with identical public summary before/after. Running it here adds no new
finding and risks the records the prompt says to preserve.

These are manual runs, distinct from hook execution. See `docs/kiro-hook-test.md`
for the full test: a side-effect probe verified that the configured `PostFileSave`
hooks (lint and costing, created via `createHook`) **did not execute on a genuine
editor save** in this Kiro setup — the probe command works when run by hand but
wrote nothing when the builder saved `lib/costing/decimal.ts` after a session
restart. `PostFileSave` stdout is not forwarded to the agent (per `createHook`
semantics), so only the file-side-effect probe could confirm this. Hook execution
on save is therefore not occurring here; root cause (not-loaded vs
`PostFileSave`-unsupported vs matcher mismatch) is undetermined.

## Risks and observations

- **Seven-day bearer links are still the access model.** The follow-up states
  this explicitly: possession of a valid copied review link represents that actor
  until expiry, including for PDF/media delivery. This is acceptable for the
  hackathon demo but is the largest remaining security gap.
- **Enrollment is now builder-manual.** Removing auto-enroll closes the
  stranger-enrollment hole, but new users can only be linked by the builder
  until task 10A adds self-service invitations.
- **Dispute-log API returns chronological; the UI reverses.** A future consumer
  reading the `get_site_dispute_log`/`get_demo_dispute_log` JSON directly gets
  oldest-first; only the `dispute-log.tsx` component presents newest-first. Not a
  defect (the UI contract is newest-first), but a consistency note for any
  later dashboard.
- **`demo-summary.json` is a frozen snapshot, not live.** If `supabase/seed/
  demo.sql` changes, the export must be regenerated; it does not auto-sync.
- **Costing hook matcher scope.** `costing.*\.ts$` also matches
  `tests/costing.test.ts`; noted in `docs/kiro-hook-test.md`.

## Blockers

None for task 8's scope. All six review criteria are met; the unit/API,
transactional SQL, lint and typecheck checks pass; the public preview is
isolated to fictional data with no database call; locked evidence is protected
by triggers and verified unchanged by `tests/log.sql`. The agent made no
approval or amendment on any real record; the only code touch was a temporary
comment in `lib/costing/decimal.ts` that was reverted.

## Remaining task 10A security work

Per the follow-up, task 10A (after photo analysis and web upload/offline) must:
replace the seven-day bearer review links with authenticated identity and
revocable access, including PDF and media delivery; collect professional names;
add self-service invitations; implement memberships per project; add browser
sessions; support ownership transfer and archive/restore (preserving locked
evidence and its original currency); and keep foreman/PM roles with multi-project
scope and a solo owner/PM. Do not claim full team security before those tests.

## Task 9 readiness

Task 9 (photo analysis, `analysePhoto()`) is ready to start. Task 8 is complete
and committed (`796c3d6` and `b2b557d`). The confirm screen already treats any
supplied photo findings as dismissible "possible" suggestions and stores
`confirmed_findings` (task 5), and the report/PDF render the human-confirmed
photo notes; no `ai_findings` are generated yet and the seed claims none. Nothing
in task 8 blocks task 9. Per the build order and this review's constraints, task
9 is not started here — only assessed as ready.
