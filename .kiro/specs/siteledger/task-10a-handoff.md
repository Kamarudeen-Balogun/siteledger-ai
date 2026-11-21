# Task 10A — accounts, projects and authorized teams

Implemented and verified by Codex on 21 November 2026. Source: PROJECT_BRIEF.md sections 8, 10 and 16, including the later confirmed-signup and Telegram onboarding revisions. No new Kiro execution is claimed.

## Accepted setup and identity decisions

- Signup requires native email confirmation. Supabase's public Auth settings were read and confirmation was enabled.
- Builder reports Resend SMTP, native Turnstile CAPTCHA, the Before User Created PostgreSQL hook, all three code templates and the HTTPS Site URL saved.
- Sender recommendation: SiteLedger AI <noreply@mail.siteledger.codeflowx.dev>, separate from the existing LeadFlowX sender. No LeadFlowX code, assets or credentials are reused; no billing upgrade is configured.
- First-time/unlinked Telegram users open the same HTTPS email/password signup, sign-in and recovery form. No new standalone Telegram profiles or chat password collection.
- Linking requires proof of both identities, explicit consent, recent browser authentication and a single-use challenge. Existing combinations preserve original identity IDs, snapshots and permissions; an existing browser identity also requires its credentials.
- The existing authorized Lekki PM's profile is reserved as demo owner. Access requires email/Telegram proof and a typed, confirmed professional name; display-name equality never grants ownership.
- Public credit: Built by CodeFlowX — Kamarudeen Balogun, linked to codeflowx.dev and github.com/Kamarudeen-Balogun. Credit is separate from project ownership and historical signatures.

## Implementation

- Native Auth boundary, recovery, email proof and opaque 32-byte app cookies. Only cookie hashes are stored. Cookies are HttpOnly, Secure on HTTPS and SameSite=Lax; browser sessions expire after 12 hours/2 hours idle, Telegram sessions after one hour.
- Stable profiles, browser identities, Telegram connections and project memberships. Only foreman and PM are work roles; an owner has project administration.
- Private project creation/selection, currency/timezone, history, targeted invitations, role/removal controls, accepted ownership transfer and archive/restore. Administrative history is append-only and separate from report amendments.
- Invitations use hashed secrets, verified recipient email, seven-day expiry, one successful use, cancellation and an atomic owner/project recheck. Exactly one active PM owner remains.
- Every record, confirmation, costing, PDF, media and log operation checks current membership and resource/project association. Old bearer links are ignored. PDF/media access is checked again before returning bytes.
- Confirmation, approval and amendments snapshot stable person ID, professional name and project role. Solo PM confirmation and approval remain separate deliberate actions.
- Capture and retries use cookie authentication. IndexedDB retains original actor, project, timezone/date and files; aliases support proven legacy identity combinations. Removal/archive blocks retry without reassignment.
- Money remains exact supplied decimals. Reports, PDFs and logs use the snapshotted currency and timezone; only NGN display rounds to the nearest ₦10. No exchange rates or invented foreign prices.
- Seed sources are frozen on both upgrade and fresh installation so public demonstrations cannot include later private work or live BoQ edits.
- Account, invitation, team and project-history screens are mobile-first. The creator footer, code emails and illustrated README are included.

## Telegram expansion

Live menu configured and verified on @SiteLedgerNGbot: /start, /account, /projects, /today, /reports, /help and /logout. The Mini App opens /account.

/today identifies the latest report for the project's local site day and shows its recorded currency, cost, top item and that item's BoQ progress only when costed. Unconfirmed/stale notes get a review action. /reports opens authorized history; /projects selects only authorized projects. Unsupported slash commands guide the user; password arguments are not retained as notes.

Pending media is reauthorized against its original person/project before download and finalization. Access changes block it without deleting its receipt. Fresh authorized commands resume one pending original-project file at a time with a lease; retries do not overwrite evidence. Already-linked record buttons can authenticate a fresh Mini App session through signed Telegram identity. Unlinking revokes those sessions.

The seven-command configuration script checks the HTTPS account page, matching webhook and account schema before publishing. The existing preview was restarted on port 3011, with the same configured ngrok origin. This is development hosting, not task 13 production deployment.

## Acceptance evidence

- 95 unit/API checks pass, including confirmed signup, Native CAPTCHA forwarding, opaque cookies, role/identity injection denial, record boundaries, exact currency display, timezones and interrupted bot recovery.
- Five rollback SQL suites pass: account identity, projects/invitations/ownership, records/snapshots, Telegram and web capture.
- Empty installation and seeded two-account legacy upgrade pass. They exercise PM owner import, 12 frozen seed sources, preserved data and denial of private-rate changes entering the public demo.
- The full browser suite passes on a disposable local DB with real GoTrue, a local SMTP inbox and REST/media fixtures. It covers verified signup, targeted invitation UI/API, two owners, different roles across two projects, photo dismissal, confirmation/costing, corrected-draft weather retention, approval/PDF, profile snapshots, offline reload/retry and retained files after removal, archive/restore, accepted transfer, second-browser history, secure linking/unlinking and native recovery.
- Direct native signup without CAPTCHA is denied. Native Before User Created hook runs were observed in the disposable Auth service.
- Lint, TypeScript and production build pass. Signup/Magic Link/Recovery designs render at 390/840px without overflow; signup and project screens/PDF were inspected.
- README has labelled fixture screenshots and a Mermaid workflow, plus clear setup/use instructions. Local links/images were checked.

Artifacts are ignored under supabase/.temp/task-10a/browser and email-previews. Native fixtures use fake example.test emails, fake audio, labelled synthetic photos and scripted findings. They do not send Resend emails or prove real-site detection accuracy. Gmail/Outlook rendering and actual hosted Resend delivery remain unobserved.

## Hosted preservation

Eight account migrations (20261121000300 through 20261121001000) were applied to scoped project tfpxfxzawcjqjwrchlky as accounts_browser_project_management. The guarded transaction compares every original column/row of projects, BoQ, submissions/photos, report items/reports, amendments, Telegram receipts/users and web staging. Additional nullable metadata cannot mask an original value change.

The first import failed on a PL/pgSQL alias conflict and rolled back completely. A legacy upgrade test then caught deferred owner-trigger events before RLS ALTER TABLE. Both issues were fixed, covered by the legacy fixture and validated before retry. The final guarded upgrade succeeded.

Hosted verification: 13 locked reports, 2 amendments, 15 submissions and 4 photos remain; 2 legacy profiles, one foreman membership, one PM membership and one valid owner exist. Anonymous profile reads are denied; the frozen demo and hook execution grant are ready. Genuine evidence was not modified for denial demonstrations.

## Scope and next milestone

Task 10B follows only after this milestone is committed: website-only private trial with one voice note/three photos, labelled demo BoQ, visible expiry, abuse limits and atomic one-use handover to a verified account with proof of the active guest session. Guest approval/locking/teams remain disabled. Task 11 dashboards/BoQ editing and task 13 production hosting are separate.

Keep .kiro tracked. The unrelated .kiro/hooks/sessionstart-probe.json remains untouched and excluded from this commit. Task 14 will add final demonstration and genuine Kiro execution evidence; do not invent hook/Crew runs.
