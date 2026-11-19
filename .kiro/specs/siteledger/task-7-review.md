# Task 7 review — daily reports and PDF

Scope: `PROJECT_BRIEF.md` section 16 task 7, read against sections 4, 7, 10 and
12. Task 7 is the costed draft report (web view + A4 PDF) after human
confirmation. Approval/lock and the amendment/dispute-log UI are task 8; photo
analysis is task 9. The builder chose **Perkins Limited** for the report heading.

Files reviewed (application code, written by Codex, not modified by this review):

- `lib/reports/model.ts` — source/document contracts, `buildDocument`,
  `reportFromInput`, formatting, stale-draft detection, exact stored-total
  verification.
- `lib/reports/data.ts` — private reads and creation via the existing server RPC
  adapter; no caller money, rates or identity is trusted.
- `supabase/migrations/20261118000400_daily_reports.sql` — captured documents, one
  report per submission, private source/read/save RPCs and a narrow fictional
  demo read; browser roles cannot execute the RPCs.
- `app/reports/[id]/page.tsx`, `app/reports/demo/page.tsx` — private and public
  report views.
- `app/api/reports/[id]/route.ts`, `app/api/reports/[id]/pdf/route.ts`,
  `app/api/reports/demo/pdf/route.ts` — draft/weather action and private/public
  PDF routes.
- `components/report-document.tsx`, `components/report-actions.tsx` — the web
  document and the draft/weather action.
- `lib/pdf/report-template.tsx`, `lib/pdf/export.ts` — server-generated A4 PDF
  with real images, all-page footers, reproducible timestamps, bundled fonts.
- `tests/reports.test.ts` (8 tests) and `tests/reports.sql` — the unit/API tests
  and the transactional SQL suite.

This review owns only `.kiro/specs/siteledger/task-7-review.md`. No application
code and no historical reviews are changed. Task 8 and account/currency features
are not started.

## Requirements check

1. **Private report/media access.** Met. `readReportInput(id, token)` calls
   `verifyReviewToken(token, id, secret)` before any RPC; the token binds the
   submission id and a telegram id, is HMAC-signed with `TELEGRAM_WEBHOOK_SECRET`,
   and expires in seven days. `get_site_report_input` joins `telegram_users` on
   `project_id` and returns the row only when `s.telegram_id = p_telegram_id or
   u.role = 'pm'`, so a foreman sees only their own notes and a linked PM sees
   their project's. The web report renders photos through the existing
   token-gated media route (`/api/confirm/<sub>/media/<photo>?access=<token>`),
   and the PDF reads photos server-side via `readEvidence(storage_url, false)`
   using the service-role key with a strict path check — no public bucket URL is
   handed to the client. The RPCs are `revoke`d from `public, anon,
   authenticated` and granted only to `service_role`; `tests/reports.sql` asserts
   the `anon` role raises `insufficient_privilege` and that another project
   foreman gets `null`.

2. **Confirmed-only exact costing.** Met. `buildDocument` throws
   `ReportStateError` unless the source is `locked` or (`confirmed` with both
   `confirmed_at` and `confirmed_by`), and also throws while `pending_media` or
   `processing`. Costing is the pure `costReport(source.items, source.price_list)`
   from task 6. `save_site_draft` requires `status = 'confirmed'` with a
   non-null `confirmed_at`, re-reads the source under database locks and rejects
   if it changed, then validates each line: `rate` equals the chosen BoQ rate,
   `cost_today` equals `quantity × rate`, the quantity is rounded to 4 dp, and the
   document total equals `sum(cost_snapshot)`. `reportFromInput` separately throws
   503 if `document.costing.total_cost` is not exactly equal to `stored.total_cost`.
   The API sends only `{ p_id, p_telegram_id, p_source, p_document }` — no price
   or identity from the caller; the author comes from `telegram_users`. The tests
   assert caller money (`total_cost`) and currency relabel (`"USD"`) are rejected,
   and that the saved `document.source.confirmed_by` is the server-derived author.

3. **Retry-safe drafts.** Met. A unique index `reports_submission_unique` on
   `reports(submission_id)` enforces one report per submission. `save_site_draft`
   reuses the existing `report_uuid` when present, deletes and re-inserts that
   report's item rows, and recomputes the total, so a retry rebuilds the same
   draft rather than duplicating it. `tests/reports.sql` confirms a second save
   returns the same id with still one item row, and that a failed (rejected) save
   leaves the draft's `total_cost` unchanged.

4. **Stale export prevention.** Met. `reportFromInput` sets
   `stale = status === "draft" && JSON.stringify(document.source) !== JSON.stringify(input.source)`
   — comparing the saved document's source (drafts always store `content_snapshot`)
   against the current source. The private report page hides the Download PDF
   link and shows an amber "Rebuild this draft before downloading it" message when
   stale, and `pdfResponse` throws `ReportStateError` if `report.stale`, so the
   API blocks a stale export even on a direct request. `tests/reports.sql`
   confirms a save with a stale source (re-confirmed to a different quantity) is
   rejected before any export.

5. **Weather preservation.** Met. `createReport` passes
   `weather === undefined ? input.report?.weather ?? null : weather` to
   `buildDocument`, so an omitted weather key preserves the existing draft's
   weather. The API maps an absent `weather` key to `undefined` (distinct from an
   explicit `null`, which clears it), trims non-empty strings, and enforces a
   500-char limit. `tests/reports.test.ts` confirms `{}` (no weather) preserves
   `"Rain, 2 hrs"` while `"  Rain  "` saves `"Rain"`.

6. **Locked snapshots.** Met. `assemble_report_input` uses the stored
   `content_snapshot->'source'` for a locked report that has one; for a legacy
   locked report without a snapshot it rebuilds the source from `report_items`
   using the captured `rate_snapshot`/`description_snapshot`/`section_snapshot`/
   `unit_snapshot` (never the current rate). `reportFromInput` uses the stored
   document for locked records, and the base-schema `guard_report_record`
   trigger raises "Locked reports cannot be changed or deleted; append an
   amendment" on any update/delete of a locked report. `report_items.cost_snapshot`
   is a generated `quantity_done * rate_snapshot` column and `capture_boq_snapshot`
   copies the BoQ rate into `rate_snapshot` at insert, so a locked record is never
   silently repriced. `tests/reports.test.ts` confirms a locked document is
   unchanged (byte-identical) when the project name and all rates change, and
   `tests/reports.sql` confirms the seeded locked demo report's hash is unchanged.

7. **Narrow public demo.** Met. `get_demo_report_input` returns a row only when a
   report with the exact id `40000000-…0004`, submission `30000000-…0004`,
   project code `LEKKI-DEMO-01`, `is_demo`, `telegram_id is null` and
   `status = 'locked'` all match — i.e. only the original fictional 6 November
   seeded report, never a real Telegram note or its media. The seed inserts no
   `submission_photos` for that report ("No generated audio or photo URLs are
   claimed as real evidence"), so the public demo exposes no private media; both
   its web view and PDF show "No photos were attached to this record."
   `tests/reports.sql` confirms the demo read returns the seeded submission id,
   not the test submission, and that `anon` cannot call the RPC.

8. **Bundled fonts.** Met. `public/fonts/` contains `PublicSans-Regular.ttf`,
   `PublicSans-Bold.ttf`, `SourceSerif4-Regular.ttf` plus `PublicSans-LICENSE.md`
   and `SourceSerif-LICENSE.md`. The PDF registers them as `PublicSans` and
   `SourceSerif` via `@react-pdf/renderer`'s `Font.register`; the web report
   loads the same files through `@font-face` aliases `"Report Sans"` /
   `"Report Serif"` in `globals.css`, so web and PDF use identical font files.

9. **A4 PDF pagination/images.** Met. The PDF uses `<Page size="A4">` with a
   `fixed` footer rendered on every page via
   `render={({ pageNumber, totalPages }) => …}`. Atomic blocks (the total, the
   table header, each work row's progress lines, signature blocks, and each
   photo with its caption) use `wrap={false}` so they do not split across pages;
   react-pdf flows overflowing content to further pages, which matches the
   handoff's observed two/three-page outputs. Images are real: `pdfResponse`
   base64-encodes each photo from `readEvidence` and the template throws if
   `photos.length !== source.photos.length`, so a missing image fails rather
   than silently omitting one.

## Test results (manual runs, this session)

- `npm run test:reports` — 8 tests, 8 pass, 0 fail (exit 0).
- `npm run db:check-reports` — PASS against the local Docker stack
  (`supabase_db_siteledger-ai`): "PASS: private access, exact costs, snapshots,
  retry, evidence, stale/forged saves and read-only demo" and "PASS: report RPCs
  unavailable to browser database roles", then `ROLLBACK` (exit 0). The script
  targets only the local container via `docker exec`, never a hosted database.
- `npm run lint` — `eslint .`, exit 0, no output.
- `npm run typecheck` — `tsc --noEmit`, exit 0, no output.

The browser integration check (`npm run test:report-browser`) was not run. It
is optional in the prompt, requires the isolated local preview, and the handoff
already documents a 390px pass covering confirm→draft, ₦261,000, weather, PDF
download, correction to 19 m² / ₦275,500, weather preservation, retry-safe
persistence and denied stranger PDF requests. Running it here would add no new
finding and risks the hosted records the prompt says to preserve.

These are manual runs, distinct from hook execution below.

## Risks and observations

- **Public demo with photos would be inconsistent.** Today the demo report has no
  photos, so its web view and PDF agree. If the demo ever gained photos, the
  public web view (no access token) could not load them through the token-gated
  media route while the PDF (service-role) could. Keep the public demo
  photo-free, or give it a dedicated public media path. Moot now; flagged for the
  future.
- **`reportFromInput` 503 on a snapshot-less stale draft.** A draft created via
  the API always has `content_snapshot`, so `document = stored.document` and the
  total check passes before `stale` is computed. The 503 "Report costs could not
  be verified" is a safety net for a draft missing its snapshot (not produced by
  the API); it would surface as an error rather than a stale flag. Acceptable as a
  guard.
- **Single `<Page>` relies on auto-pagination.** The template renders one
  `<Page>` and lets react-pdf flow content across pages; the handoff's visual
  check (normal rows not splitting, every page footered) confirms this behaves.
  Design-verified here; visually confirmed by the handoff.
- **Reproducible timestamps.** The PDF's `creationDate`/`modificationDate` are
  `report.locked_at ?? source.confirmed_at ?? source.date+T12:00`, so a document's
  metadata reflects when it was confirmed/locked, not export time — matching the
  handoff's "reproducible document timestamps."
- **Money stays exact end to end.** `report_items` store `quantity_done` numeric,
  `rate_snapshot numeric(18,2)` (copied from the BoQ rate), and
  `cost_snapshot numeric(24,6)` generated as `quantity_done * rate_snapshot`;
  `reports.total_cost` is numeric and verified against `sum(cost_snapshot)`. The
  document carries decimal strings; nearest-₦10 rounding is display-only. No
  precision is lost between PostgreSQL and the PDF.

## Lint-on-save hook (observed execution)

The hook at `.kiro/hooks/lint-on-save.json` is unchanged: schema `v1`, one hook,
trigger `PostFileSave`, matcher `\.(ts|tsx|md)$`, action
`command: npm run lint` (no `--fix`). It matches this review file (`.md`).

Baseline before the save: `npm run lint` exits 0 with no output on this tree, so
if the hook fires its command reports clean.

### What was done this session

This review file was saved through the agent's file-write tool to exercise the
hook — a `.md` save matching the matcher.

### What actually happened

The save produced no `HOOK_INSTRUCTION` block — only the single file-write
confirmation line. This matches the outcome the task-4, task-5 and task-6 reviews
recorded for the same hook: the agent's file-write tool does not raise the IDE's
`PostFileSave` event, which is raised on an editor save (Ctrl+S in an open file).
The hook is correctly configured and present from session start, so it should
fire on a real editor save, but an agent-initiated write is not that event.

One ambiguity that cannot be resolved within this review's single-file
constraint: the hook command is `npm run lint` (`eslint .`), which exits 0 with
no stdout on this clean tree (verified independently before the save). If Kiro
surfaces a `HOOK_INSTRUCTION` block only when a hook command produces output, a
clean run looks identical to a non-run, and `eslint .` does not read this `.md`
file in any case. Either way the practical result is the same: saving this file
through the agent did not surface any lint output, and on this clean tree there
is none to surface.

Recorded state: hook configured and valid, loaded from session start, not
observed to fire on an agent save. It should be re-observed on a genuine editor
save and recorded in the build evidence then — the same open item the task-4,
task-5 and task-6 reviews left.
