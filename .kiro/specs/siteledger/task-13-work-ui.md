# Task 13 follow-up: focused work screens

Builder feedback, 22–23 November 2026: signup, project creation and saving a
voice note with an image worked, but work screens exposed too many unrelated
details and actions. The builder requests all existing work screens and account
settings redesigned; the landing-page design stays as it is.

## Implemented behavior

- Account Overview leads to projects. Profile, Telegram and Email settings are
  separate. Sign-out stays on Overview. Password recovery has request, code and
  completion steps; Email provides an expandable current-password confirmation.
- Projects have separate Overview, Site records and Progress views. Creation
  opens on demand after the first project. Team members, invitations and owner
  settings have separate views. Project selection precedes recording.
- Regular capture allows voice-only, one to five photos, or both. Empty capture
  is rejected. A saved receipt replaces attachment controls and leads to review;
  device history is expandable. The private trial still requires a voice note
  and accepts zero to three photos.
- Review keeps work quantities and BoQ selection prominent. Original voice,
  capture metadata, extraction details and optional empty materials/delays are
  expandable. Photo-only quantities require human entry.
- Report approval remains a separate explicit PM action. Amendments use a
  focused view beside their original report; the dispute log expands technical
  references only when needed. Saved evidence and money are unchanged.
- Persistent phone navigation and desktop links share Back behavior, including
  query views and Telegram's native Back. Unsaved attachments, review, profile
  edits and amendments have a leave-page confirmation.

- Ordinary Telegram /start and the main Mini App button open the landing page.
  Active sessions see Open your projects. SDK initialization precedes navigation
  so signed launch data remains available to account access; identity challenge
  and record links still open their proper destinations.

## Evidence

All 122 unit/API checks, lint and local/production builds pass. The JPEG-first file
preparation regression exercises actual Blob hashes and capture validation;
the former helper assumed index zero always contained audio.

The optional-media migration was applied to hosted Supabase on 23 November
after verifying that all four hosted function bodies matched their originals.
A transaction guard compared fingerprints across 36 public tables and Storage
objects. A separate before/after read also found all 37 unchanged, including
13 reports, 2 amendments, 16 submissions and 5 photos. Function permissions
still deny anon/authenticated execution and allow the server role.

The final native browser suite passes, including direct Telegram landing-to-account
proof, active-session project entry, focused settings, cancelled navigation,
voice/photo-only capture, manual costing and verified trial handover/approval/PDF.
Back/Forward, native Telegram Back and 390/768/1440px navigation pass.

The production release is `dpl_4dsen1cmsw78dFfG56MHso4X6rFF`, READY at
https://siteledger-ai.vercel.app. Nineteen public/denial HTTP checks, static PDF
identity, public widths and live eight-digit/Back checks pass. All seven bot
commands remain verified across default/private and English scopes; the main
button is Open SiteLedger and opens the production landing page.

Artifacts stay in ignored `supabase/.temp/task-13` and
`supabase/.temp/task-10a/browser`. Do not claim physical-phone acceptance yet.

## Remaining task 13 acceptance

Builder update, 25 November: the latest Telegram phone run stopped while entering
the BoQ, before voice capture, confirmation, costing, PDF, approval or amendments.
The new test log's outcome cells remain blank. Earlier partial phone runs and
automated passes do not certify this run. The builder requests review of the
session/navigation blockers and BoQ proposals; see
`docs/telegram-boq-review.md`. The supplied Codex prompt is not treated as blanket
authorization to build every feature or change the project's design rules.

Verify the redesigned production flow: review and edit quantities, deterministic
costing, PDF, PM approval and a dated amendment on a real phone over mobile data.
Keep task 13 unchecked until the builder reports this result. Preserve the
existing separate production test project and locked records.

GitHub checkpoint `3a39cfc` was published on `task-13-production`. On 23 November
the builder explicitly authorizes merging the tested update into main now,
before the remaining physical-phone acceptance. This does not close task 13. At the builder’s request, Vercel is connected to the public GitHub repository;
its verified production branch is `main`. Review-branch pushes create previews.
The existing CLI checkpoint is already live; merging accepted changes into main
triggers the Git production deployment.

The Frontend Design skill and pinned Vercel Web Design Guidelines informed the
UI review. No new Kiro review, hook execution or Crew run is claimed. The
unrelated `.kiro/hooks/sessionstart-probe.json` remains untouched and unstaged.
The agreed private-feedback task 13A follows task 13 acceptance. Task 14's full README gallery, Kiro write-up and 2:50 video remain scheduled
after deployment acceptance.

## Git previews

Git push of `3a39cfc` triggered preview deployment
`dpl_FnPTTAwU5PJ4hG7LvSzuGoAiu3WU`, READY with a successful Vercel commit check.
The review-branch alias is
https://siteledger-ai-git-task-13-production-kamarudeens-projects.vercel.app.
Its eleven environment variables are configured for this branch, including its
own app origin. The builder confirms its Cloudflare hostname saved. Vercel
protects previews, so browser testing may require the builder's Vercel login.
Use the stable alias for requests; random deployment URLs have a different
origin. The bot stays on production. Telegram is optional for the complete
email/password website flow.

## Approved follow-up — 25 November 2026

The bounded Telegram session/navigation and BoQ entry/import update is implemented
and passes local unit/API, SQL, fresh/legacy migration, native browser, lint and
build checks. See task-13-telegram-boq.md for evidence and limits. Supabase MCP
is reconnected; hosted migration 20261125024102 adds the new BoQ functions and
preserves all 37 checked table fingerprints. PR #2 is merged into main and the
production release is READY; 19 live HTTP checks, public widths and import-route
privacy checks pass. See task-13-telegram-boq.md. The builder's real
phone acceptance, task 13A feedback and task 14 documentation/video remain pending.

## Project journey redesign — 25 November

The builder requests clearer project management and fewer competing details.
Guided creation, single-action project selection/home, separate financial
Progress, record filters and focused owner/security views are implemented and
verified in task-13-project-journey.md. The complete native browser workflow
passes, including compact 390×700 actions, and 138 unit/API checks pass. This
uses existing APIs and preserves all money, identity and locked evidence rules.
Git publication is in progress; physical-phone acceptance remains pending.
