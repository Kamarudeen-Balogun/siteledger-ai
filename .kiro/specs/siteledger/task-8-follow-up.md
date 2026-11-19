# Task 8 follow-up — newest records and authorized access

Builder request and Codex implementation: 19 November 2026. Source of truth:
`PROJECT_BRIEF.md` sections 5, 8, 12 and section 16 task 8. This supplements
the original task 8 handoff; historical reviews and their results remain intact.

## Builder's real acceptance test

The builder approved report `c8e4b4d7-8e62-4e43-8abc-40ecf29df790` through the
separate PM account and added the suggested test amendment. Read-only hosted
verification confirmed the exact NGN 551,000 total, lock at 02:59:05 WAT and
amendment at 03:00:42 WAT on 19 November. The unchanged original transcript
and extraction hashes match the preceding handoff. The note explicitly states
that quantities, costs and site observations are unchanged. Codex performed no
approval or amendment on genuine records.

## Changes

- The dispute log renders a reversed copy of the database's chronological
  entries: newest events first, with stable timestamp/ID ties. Stored reports,
  timestamps and amendments are unchanged.
- Review found that knowing the public demo code could enroll a stranger or
  reassign an existing account. The authorized-start migration removes that
  automatic grant. Only an existing builder-authorized link can use the bot;
  `/start` cannot change project, role or stored name. Unapproved media intake
  yields an access-required reply without reserving media or a submission.
- The old public summary aggregated real records on the demo project. It now
  reads `lib/data/demo-summary.json`, a frozen export of the original isolated
  local seed, verified as 12 reports, one amendment, 16 BoQ items and NGN
  14,360,800 cumulative cost. No hosted identity/media data was exported. The
  endpoint makes no database call and returns 404 for unrelated project codes.
- The brief, matching AGENTS copy and Kiro requirements/design/tasks now include
  the builder-authorized task 10A team, professional identity, multi-project
  roles and solo owner/PM scope, plus concrete access acceptance scenarios.

## Limits and next milestone

Professional-name collection, self-service invitations, memberships per
project, browser sessions, ownership transfer and archive/restore are specified
for task 10A after photo analysis and web upload/offline work; they are not
implemented by this follow-up. Current private review links remain seven-day
bearer credentials, checked against the linked account/project on each request.
Possession of a valid copied link still represents that actor until expiry;
task 10A must replace this with authenticated identity and revocable access,
including PDF/media delivery. Do not claim full team security before those tests.

## Verification

The existing Telegram SQL check now verifies known-code denial, trusted grants,
stored-name and role preservation, rejected self-promotion and forbidden project
reassignment. Existing intake, AI and log SQL checks preserve their original
guards. The disposable log browser check verifies newest-first ordering and
identical public summary before/after a private demo-project amendment. No test
writes reach the hosted database or the original local records.

Final verification passed: 64 unit/API tests; the expanded disposable log browser
check; Telegram, AI and log transactional SQL suites; lint, TypeScript and
production build. The authorized-start migration was applied locally first and
then to the SiteLedger-scoped hosted database. Before/after whole-table hashes
for reports, amendments, submissions, photos and linked accounts are identical;
both existing authorized accounts remain linked. The restarted phone-test app
was checked read-only: the real test amendment appears first, the foreman sees
the locked NGN 551,000 report, and the HTTPS public summary remains the original
12-report/one-amendment fictional history. The 390px log was visually checked.
Ignored evidence: `supabase/.temp/task-8/real-newest-first.png` and the
disposable browser screenshots. No task 8 Kiro review, editor hook run or Crew execution is
claimed. Kiro should review both this follow-up and the original handoff, save
findings to `task-8-review.md`, and keep manual checks distinct from observed
editor-save events. Photo analysis remains the next ordered task.
