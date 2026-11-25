# Task 13 — focused project journey

Builder request, 25 November 2026: make project work easier to understand and
show a clear next action without crowding each screen. This continues the existing
work-screen UI scope. The landing design and all access/money/evidence rules stay
in place. No database schema change or new business feature is introduced.

## Project flow

1. Projects lists active sites with a single Open project action; archived sites
   have their own view. Opening a project selects it for subsequent capture.
2. New project is a focused two-step view: site name/client/location, then supplied
   contract amount/currency/timezone. Back retains fields, grouped decimal input
   stays exact, unsaved navigation is guarded and creation is explicitly reviewed.
3. Project home leads with the next existing work step. Foremen see unconfirmed
   notes first; PMs see draft review first. Confirmed notes lead to deliberate
   costing; approved work leads to a new note; archived sites lead to history.
4. Site records filters review, draft and approved work. Each row has one action;
   report-level corrections and dispute logs remain on their report screens.
5. BoQ and Progress are dedicated views. Project listing/home no longer fetch
   dashboard summaries for every project or display financial detail by default.
6. Members, invitations and settings remain focused owner views. Access controls
   stay collapsed, invitations are opened deliberately, and ownership transfer
   lives in Settings. An existing password-confirmation action is available on
   Account → security without requiring a Telegram connection.

The main home action precedes supporting copy and project tabs on phones. Duplicate shortcut rows
were removed after inspecting the first capture. Both recording and draft-review actions fit above
the phone dock at 390×700. Current fonts, light paper palette, ruled rows, 48 px
targets and native/browser Back behavior are retained.

## Verification status

138 unit/API checks, lint, typecheck and the production build pass. Native guided
creation, retained values, exact supplied budget, explicit cancellation, project
selection, collapsed membership controls, invitation/share/reissue/cancellation
and an expired recent-auth check followed by password confirmation pass.
The complete disposable native/browser suite passes, including role-specific
next steps, record filtering, exact NGN/KWD costing and PDFs, locked snapshots,
amendments, offline retries, immediate revocation, archive/restore, Telegram
linking/reopening, account recovery and verified trial handover. Screens are
checked at 390/768/1440 px; compact-home actions are checked at 390×700.
Phone captures were visually inspected and led to moving the next action ahead
of navigation and supporting copy. Old tests expecting financial figures on Home
were updated to the dedicated Progress route. No financial logic changed.

GitHub/Vercel publication is in progress. No new physical-phone acceptance or
Kiro execution is claimed. The existing Supabase schema and Auth settings are
unchanged; this is a presentation update using existing authorised actions.

Original builder documents and the unrelated session-start probe are preserved.
Task 13 remains open for the real-phone report/approval/amendment flow. Feedback
13A and the README/video task 14 remain scheduled separately.
