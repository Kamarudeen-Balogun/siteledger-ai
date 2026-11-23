# Task 13 — production deployment

Implemented and verified by Codex on 22 November 2026. No new Kiro review,
hook execution or Crew run is claimed. Task 14 has not started.

## Deployment and configuration

- App: https://siteledger-ai.vercel.app, Vercel project `siteledger-ai` in
  `kamarudeens-projects`, Hobby plan and Node 22.
- Initial production deployment: `dpl_WGaQPiPfsCYn83TnW5nuzUUZGQXR`, status READY.
- Eleven production environment variables are saved. Server credentials are
  sensitive; public configuration is encrypted configuration. No key was printed.
- Builder confirms the production Turnstile hostname and Supabase Site URL saved.
  Native Auth's public settings confirm signup and email confirmation enabled.
- Telegram webhook points to production, validates its secret and preserves
  pending updates. All seven slash commands are verified in default/private-chat
  and English scopes; the account Mini App opens the production account page.
- Local development origin remains unchanged. Vercel CLI's login was updated
  to its device-code flow. No billing upgrade or Git auto-deploy was configured.

## CPU restraint and evidence

Public `/reports/demo` and `/log/demo` use checked-in original-fiction snapshots.
The public PDF rewrites to a static file with cache/download headers. Live
responses show PRERENDER for public pages and HIT for the PDF asset. Private
reports, media and account/project requests retain authorization and no-store.

Snapshot preparation verifies original seed IDs, demo provenance, absent
genuine photos/guest attribution and seed-only log report IDs. The original
6 November seed costs ₦1,495,300; it differs from the builder's earlier live
₦551,000 note. A mistaken test expectation was corrected after checking seed
quantities/rates. No stored money, rates, evidence or identity was changed.

Processing routes and confirmation allow 300 seconds within the Hobby Fluid
wall-time ceiling. This is a timeout, not an active-CPU reservation. Waiting
on an external AI provider and public static delivery avoid needless CPU work;
genuine processing and private PDF generation still consume their actual CPU.

## Acceptance completed

- Local and Vercel production builds, including TypeScript, pass; the report
  and log are static in both build listings. Lint passes.
- The prior 110 unit/API checks pass, plus three production-demo checks after
  correcting the expectation: seed privacy, exact reproducible costing and PDF.
- Nineteen live HTTP checks pass: six public pages, public report/log/account,
  both identical cached PDF paths, empty unauthenticated account, private project
  denial, private PDF/media denial, missing webhook secret, absent guest session
  and cross-origin account rejection. The verifier makes no evidence writes.
- Public landing/report/log pass at 390/768/1440px with loaded fonts, one main
  heading, no horizontal page overflow and no browser page errors. Phone report
  capture was visually inspected. Artifacts: ignored `supabase/.temp/task-13`.
- All deployment inputs were scanned against configured server credentials.
  Environment/temp files and the unrelated session-start probe were excluded.
  `.env.example` and `.kiro` remain tracked; `.env.local` and `.vercel` ignored.

## Pending acceptance

The builder must exercise the complete Telegram voice/photo, editable review,
costing, PDF, approval, amendment and `/today` flow on a real phone over mobile
data. The async question is pending; no physical-phone success is claimed.
Use the separate test project and supplied-rate steps in
`docs/production-deployment.md` to preserve old evidence.

Keep task 13 unchecked until this required result passes. At the builder's
request, publish the tested source as an interim checkpoint on
`task-13-production`; this does not certify the remaining phone acceptance.
After that acceptance, commit `Ship: production deploy` and proceed to task 14's README gallery,
Telegram/voice captures, evidence-based Kiro write-up and 2:50 narrated video.
The unrelated `.kiro/hooks/sessionstart-probe.json` remains unstaged/untouched.

The builder's first production signup check found an eight-digit email code
rejected by the six-digit form. The builder also requests Back/menu navigation
across work screens and Telegram. See `task-13-account-navigation.md` for the
fixes and their acceptance; the full mobile-data flow remains pending.

## GitHub checkpoint

The builder's 22–23 November work-screen feedback and optional-media revision
are recorded in [task-13-work-ui.md](task-13-work-ui.md). The redesigned work
views preserve the landing page and the existing report/PDF branding.

The builder requested a GitHub push on 22 November. All tested deployment,
email-code and navigation changes are published on `task-13-production`, with
a draft pull request against `main`. The final milestone is still open until
the real-phone flow passes. Environment files, local artifacts and the unrelated
session-start probe are excluded. At the builder’s 23 November request, GitHub is now connected to Vercel.
Review branches produce previews; main triggers production after acceptance.
