# Task 10 — web upload and offline queue (acceptance complete)

Source: `PROJECT_BRIEF.md` sections 4, 7–9, 12 and section 16 task 10.
Work by Codex, 21 November 2026. Task 9 is committed as `b42c184`.
The existing untracked Kiro session-start probe is unrelated to this task.
No Kiro review, hook execution or Crew work is claimed.

## Scope and design

- Build the Today screen, browser voice recording/file selection, 1–5 photos,
  compression, IndexedDB queue and automatic retry after reconnection.
- Reuse current authorized Telegram Mini App or private-review access. Do not
  implement task 10A accounts, project/team UI or new roles. No public enrollment.
- Capture project, actor and Africa/Lagos timezone with each note. Re-check the
  current server link on every upload and finalize request. Never silently send
  a queued note to a different active project or account. Expired/denied access
  retains blocked files for explicit reauthorization.
- Reserve an immutable manifest and UUID before uploading one file at a time.
  Audio is limited to 3 MiB and photos to 1 MiB each, avoiding large bundled
  requests on the later hosting target. Media signatures and exact SHA-256/size
  must match the reserved manifest; storage never overwrites existing objects.
- Publish a web submission atomically after all media is saved. No confirmation,
  costing or locking happens during upload. Use the existing two AI functions
  and durable processing jobs, then the existing confirmation/report flow.
- The client capture timestamp supplies the site date; `web_intakes.created_at`
  separately records server receipt. Original queued timestamps stay fixed.
- IndexedDB stores blobs before any network attempt and releases them only on
  a verified final receipt. Client leases prevent duplicate sends from tabs;
  database media leases and idempotent manifests recover interrupted requests.
- The service worker caches only the public Today shell and static JS/CSS/fonts.
  Never cache private APIs, reports, review links, original audio or site photos.
  Queued media stays in private device storage. Retry runs while the diary is
  open or reopened; no background-send or first-visit-offline claim.

## Current files

`lib/web/` contains protocol types, current access capabilities, upload API,
file preparation and IndexedDB/sending code. `app/today/` and
`components/capture-diary.tsx` implement capture; `app/api/web/` exposes the
authorized access, reservation, per-file and finalize routes.
`20261121000200_web_intake.sql` adds service-only staging tables and RPCs,
supports WebM/WAV alongside existing voice formats, and reuses existing voice
and photo jobs. Existing private-review links open Today via a URL fragment.

## Verification and acceptance

- 83 unit/API checks pass across existing costing, voice, Telegram, confirmation,
  reports, log, photos and seven new web checks. These cover scope/purpose/expiry,
  manifests, input limits, image/audio signatures, hashes, lease release,
  uploaded-file retries, incomplete finalization and denied/rate-limited intake.
- Eight local SQL suites pass with `ROLLBACK`. The new suite verifies immutable
  reservations, no publication before complete media, retry-safe finalization,
  captured site dates, WebM MIME handling, queued voice/photo jobs, no premature
  costing, changed project access, expired/stale media leases, server rate limits
  and browser-role denial. Only disposable rows demonstrate revocation/expiry.
- Three browser checks pass using the real app/API routes and a disposable local
  database. Browser network-offline mode models airplane-mode connectivity.
  Fake microphone recording and supplied WAV file upload are both exercised;
  these do not establish speech accuracy or a physical-phone test.
- The recorded note and photo persist in IndexedDB across an offline page reload.
  Returning online sends automatically. A deliberately lost response after a
  saved photo and a second tab retain one submission/photo, with the original
  capture timestamp. Local blobs clear only after a verified final receipt.
- Removing the fixture actor's project access leaves a blocked note with all
  blobs intact. Opening another authorized project does not change its project,
  timestamp or media. A same-document private-link switch refreshes context;
  an active sender stops before further files/finalization when context changes.
- Telegram launch data remains available until SDK validation. An authorized
  actor with no old submission can open capture. An unlinked signed Telegram
  actor gets no cached project or self-enrollment. Private-review capture lookup
  checks the referenced submission, actor and current project in one SQL snapshot.
- Offline-shell cache checks exclude private responses, access links, voice and
  photos; cached HTML contains no fixture profile. The worker caches only public
  Today HTML, static JS/CSS and local fonts. Microphone Stop remains available
  while a photo is being prepared.
- With AI/Telegram keys disabled in the disposable server, real processing falls
  back durably to manual confirmation with media retained. The browser adds
  confirmed 18 m² blockwork/6 crew, then generates the correct NGN 261,000 report
  and PDF from the existing seed rate. No report/cost exists before confirmation.
- Lint, TypeScript and production build pass. These are Codex-run commands, not
  observed Kiro hook execution. Current capture expires after seven days; expired
  or denied uploads retain their queued files. Interrupted-tab leases recover
  after their bounded expiry. Retry requires the diary open or reopened.

The hosted migration is `20261121122708_web_intake`, applied only to
`tfpxfxzawcjqjwrchlky` after local verification. Transaction-scoped guards protect
all eleven existing public tables plus `storage.objects`; outside hashes of the
five evidence tables and storage metadata match before and after. Web staging
starts empty, RLS is enabled, browser reads/mutations are denied and service-role
direct staging updates are denied. The evidence bucket remains private while
its MIME whitelist adds WebM/WAV. The hosted web SQL suite passed with rollback.

Evidence is under ignored `supabase/.temp/task-10/`: offline/sent/project-blocked
screenshots, `web-report.pdf`, `hosted-upgrade.sql`, preservation data and local
baseline hashes. Browser storage is a private RAM fixture; tests do not upload
phony records/media to the genuine hosted project or claim live detector accuracy.

Run from the root with the local SiteLedger Docker stack running:

```sh
npm run test:web
npm run db:check-web
npm run test:web-browser
npm run lint
npm run typecheck
npm run build
```

The browser check requires free loopback ports 3014, 55427 and 55428. It removes
only its uniquely named disposable API/database. One startup run exited before
its deadline because Node unreferenced an idle fetch; a keep-alive now protects
startup deadlines. Only that verified orphan QA clone was removed. Original
local/hosted records remained unchanged.

Task 10 acceptance is complete. Commit: `Web: upload and offline queue`.

## Future Kiro review — when credits return

Review this task only against the brief: auth source and resource binding,
stable project/timezone/date, file validation/limits, immutable staging, leases,
lost replies, IndexedDB persistence, cross-tab/context changes, no pre-confirm
costs, protected cache, media access and preserved history. Exercise the actual
browser and SQL checks; distinguish network emulation/fake audio/RAM storage
from a physical Android test and genuine hosted evidence. Save your review to
`task-10-review.md` without rewriting historical reviews or claiming a hook/Crew
run. Task 10A remains the next implementation milestone.

Task 10A and task 11 have not started. The current prototype capabilities must
be replaced with authenticated membership/session checks in task 10A.
