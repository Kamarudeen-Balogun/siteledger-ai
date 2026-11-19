# Task 8 — approval and append-only dispute log

Source: `PROJECT_BRIEF.md` sections 4, 8 and 12, and section 16 task 8.
Implementation/verification: Codex, 19 November 2026. The completed Kiro reviews
of tasks 6 and 7 and Codex's clarifications were committed separately first.

## Delivered behavior

- The authorized PM reviews a costed draft, acknowledges locking and chooses
  **Approve and lock report**. Foremen have no approval control and cannot
  approve through the API. The author is resolved from the linked account.
- The request identifies the reviewed document version. The server/database
  reject changed confirmation, weather/document, rates, history or pending
  evidence. Project-level serialization prevents two approvals from ignoring
  each other's newly locked quantities. Retries preserve the original lock.
- Existing database triggers atomically lock the submission and protect its
  transcript, confirmed values, item snapshots and photos alongside the report.
  The captured document is unchanged; approval metadata is stored separately.
- Corrections become new amendment notes linked to the original, with author
  and timestamp. No quantities, money, original text or PDF are rewritten.
  Request IDs make retries safe; changed text with a reused ID is rejected.
- Private logs list only the foreman's own or the PM's project records in
  timestamp order. Links retain the anchor capability's expiry. The public
  demo is restricted to the original 12 fictional reports and original amendment.
- PM Mini App navigation prioritizes pending drafts, including earlier days,
  then today's notes and existing locked history. Foreman navigation remains
  today-only. This fixes the newly linked PM's access to the 18 November draft.
- The lock stamp uses the approval date in WAT, independently of the report date.

## Files and migrations

`lib/log/data.ts` handles authorized access, document versions, approval,
amendments and log links; `api.ts` validates bounded request bodies and origin.
`app/api/reports/[id]/approve` and `/amendments` expose POST operations only.
`components/approval-form.tsx`, `amendment-form.tsx`, `dispute-log.tsx` and
`app/log/` provide the workflow inside the existing report/log screen scope.
Report pages and the PDF/web stamp were integrated with this flow.

`20261119000100_dispute_log.sql` adds server-only approval/amendment/log RPCs,
a nullable amendment request ID and unique retry index. Existing rows are not
rewritten. `20261119000200_pm_review_navigation.sql` updates PM discovery with
unchanged project/role authorization. Both were applied locally and to the
SiteLedger-scoped hosted database after verification.

## Evidence

Four new unit/API tests pass, covering PM authorization, exact reviewed
versions, missing/stale drafts, rejected caller identity, note bounds, retries,
private log access, retained capability expiry and WAT stamp dates. With the
existing tests, **64 unit/API tests pass**. The report browser regression and
new log browser integration pass, bringing the automated total to **66**.
All six transactional SQL suites pass, as do lint, TypeScript and production build.

The log SQL suite verifies PM discovery of a prior-day draft, correct priority,
PM-only approval, stale history after another approval, unchanged snapshots and
evidence, duplicate amendment retries, note conflicts, server-resolved authors,
ordered logs and denied foreign access. It also directly attempts report,
quantity, photo, confirmed-submission and amendment edits/deletes. All are
blocked. Browser database roles cannot execute the new RPCs. Everything rolls back.

The browser check uses a disposable clone of the local database, its own REST
API/gateway and the production build. It confirms work as a foreman, opens the
PM view, locks the draft, downloads its PDF, adds amendments and retries them,
then checks the original document/hash, forbidden API methods, absent editing
controls, stranger access and mobile/desktop logs. The original local database
and hosted records receive no browser writes. The clone/API/gateway are removed
afterwards without disabling the application guards.

One timestamp bug was found and corrected by the SQL test: a transaction-start
timestamp could place an amendment before the approval it waited on. The insert
now uses the actual clock time, bounded after the original lock timestamp.

The locked test PDF is one A4 page with Perkins Limited, the correct ₦261,000
amount, PM identity, 19 November lock stamp, signatures and footer. It was
visually checked along with the 390px log. Ignored artifacts are in
`supabase/.temp/task-8/`, including `locked-report.pdf`, `locked-page-1.png`,
`mobile-log.png`, `desktop-log.png` and the real read-only `pm-draft.png`.

The builder authorized using a separate Telegram account as PM and identified
the newly linked **Kamarudeen Balogun** account. It was assigned PM; the original
account remains foreman. Read-only browser verification against hosted data
shows PM approval, no foreman approval and the unchanged **₦551,000 draft**.
The configured HTTPS phone-test origin serves the current app. PM navigation
now resolves that prior-day draft. The agent did not approve any real report.

Before/after checks show unchanged contents of all 12 locked reports, the
original amendment (excluding only the new nullable schema field), all photo
rows/associations, and the real note's transcript/extraction hashes. The real
submission remains confirmed with its exact `551000.000000` draft total.

## Reproduce and Kiro review

Run `npm run test:log`, `npm run db:check-log`, lint and TypeScript. For the
browser check, build first, install Playwright Chromium if needed, then run
`npm run test:log-browser`. It needs Docker, the SiteLedger local Supabase stack,
and free ports 3012, 55423 and 55424. It preserves `.env.local` and suppresses
credentials. Do not run a build while a production browser check is active.

Kiro prompt:

> Read PROJECT_BRIEF.md section 16 task 8 and this handoff. Review approval,
> mandatory human acknowledgement, PM identity/project access, reviewed-version
> and stale-history checks, atomic locks, unchanged snapshots, amendment retry
> handling/timestamps, private log links/expiry, the narrow public demo and PM
> navigation across dates. Save findings only to
> `.kiro/specs/siteledger/task-8-review.md`. Run the log unit/API and transactional
> SQL checks, lint and TypeScript. Use the documented disposable browser check
> if needed. Do not approve or amend the builder's real records, change application
> code, rewrite historical reviews or start task 9 during the review. Keep manual
> runs distinct from genuinely observed editor-save hook execution.

No task 8 Kiro review, hook run or Crew execution is claimed. Task 9 is photo
analysis; account/project and currency features remain tasks 10A–11.
