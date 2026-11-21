# Task 10A2 — public website and desktop presentation

Builder approved the six-page public set and the existing account/project/report
desktop pass on 21 November 2026. Implemented by Codex with the frontend-design
skill, using PROJECT_BRIEF.md section 12's paper-ledger direction. No Kiro review,
hook execution or Crew run is claimed.

## Public pages

- `/`: product introduction, deterministic illustrated record, four-step workflow,
  labelled synthetic site photo, role explanations and account/sample-report paths.
- `/about`: the recordkeeping problem, human review, builder identity and demo provenance.
- `/help`: account/Telegram onboarding, slash commands, voice intake, offline queue,
  permission, amendment and recovery FAQs using native keyboard-accessible disclosures.
- `/contact`: verified CodeFlowX portfolio and GitHub links. No invented mailbox or
  unsupported contact form; private questions are directed away from public GitHub posts.
- `/privacy`: actual account/media/queue handling, essential cookies, external providers,
  access boundaries and retained evidence.
- `/terms`: current development release, authorized use, human/price-list responsibility,
  demonstrations, approval and record-integrity limits.

Public navigation, mobile disclosure menu, footer, page metadata, skip link and visible
keyboard focus are shared. Source Serif and Public Sans use existing locally hosted
licensed fonts. Creator credit remains CodeFlowX / Kamarudeen Balogun with verified links.

The illustration uses example quantities 18 m² and 2 m³. Rates are read from the frozen
section 10 seed and passed to the existing pure costReport function; amounts use
formatMoney. It is labelled fictional and is never saved as a submission/report.
The landing page does not read live financial totals or private data.

## Existing work screens

Shared workspace navigation, two-column desktop account profile/connections and
project selection/creation, wider team administration and ruled project history rows.
Report screens widen their readable tables while preserving the document/PDF design.
Mobile layouts keep the same work order and 48px controls.

Private account/project/team metadata excludes search indexing. Authentication,
permissions, confirmation, approval and append-only storage remain unchanged.
Guest upload, dashboards/BoQ editor and production deployment remain later tasks.

## Verification

- Production build, full lint and TypeScript pass. An initial independent typecheck
  overlapped generated route updates during build; the final check after generation passed.
- Six public routes pass at 390, 768 and 1440px: 200 responses, one h1, no horizontal
  overflow, valid internal links, loaded labelled photo and the supplied-rate illustration.
- Keyboard skip navigation, mobile menu navigation and Enter-operated FAQ controls pass.
- Native disposable account/report acceptance passed after layout changes. Screenshot
  review found the first desktop team fixture selected a non-owner; the test now uses
  the accepted owner and explicitly requires the Active team heading. Final rerun passed,
  including genuine owner team rendering at 1440px in the disposable fixture.
- Desktop account/project/report and public landing/help screenshots were inspected.
  Artifacts live under ignored supabase/.temp/task-10a2 and task-10a/browser.

Fixtures use separate local Auth/SMTP and labelled test data. No hosted emails, real
submissions or historical evidence were changed. This is the existing development
tunnel preview, not production deployment. No legal review is claimed for the factual
Privacy/Terms text.

Task 10A2 acceptance is complete. The unrelated .kiro/hooks/sessionstart-probe.json
is untouched and excluded. Task 10B has not started.
