# Task 13 follow-up — email codes and navigation

Builder-reported production issues, 22 November 2026. Implemented by Codex;
no Kiro review, hook execution or Crew run is claimed.

## Email code mismatch

The builder received an eight-digit signup code while the browser form and
all three server verification actions enforced exactly six digits. Local
acceptance had explicitly configured six-digit native Auth, hiding this mismatch.

Signup, invitation email proof and recovery now share the supported 6–10 digit
range. Inputs retain leading zeros and send the full string unchanged. Supabase
still verifies the actual issued code, expiry and single use. Invalid types,
non-digits, control characters and out-of-range lengths are rejected. Native
CAPTCHA, rate limits, email ownership and recovery session revocation remain.

Copy now says to enter the full email code. Existing email templates already
display `{{ .Token }}` unchanged and need no dashboard recopy. Eight-digit
email previews pass at 390/840px. Native browser acceptance now explicitly
issues eight-digit codes, rather than assuming six.

## Navigation scope and behavior

The builder explicitly chose all existing work screens and Telegram, with a
visible Back control, compact phone menu and native Telegram Back button.
Workspace headers now include those controls, including signup/recovery and
the legacy Telegram entry screen. Desktop keeps visible workspace links.

Back uses known application history and has useful direct-link parents: account
for recovery/signup confirmation, project for BoQ/team, report for dispute logs,
and site diary for a direct review. The browser's own history retains the actual
previous URL; only a depth is added to history state, without query secrets,
account details or record content. Next's existing state is preserved.

Internal report/review/log links now use client navigation with prefetch disabled.
This retains application history while avoiding background private-page requests.
The phone menu closes on selection, Escape and an outside click; Escape returns
focus to its button. Native Telegram Back has one registered callback with cleanup.
It appears when the SDK supplies Mini App launch data; no SDK identity grants access.

A small Suspense boundary contains the runtime pathname hook. Public pages,
demo report and log remain static; private requests continue through their
existing authorization. No saved rate, evidence, role or identity is modified.

## Verification

- Twelve account tests pass, covering full 6/8/10 digit codes, leading zeros,
  malformed inputs, provider rejection, ownership proof and recovery revocation.
- Navigation fallback and three public-snapshot checks pass. Lint and final
  local production build, including TypeScript, pass.
- Local browser Back/Forward, preserved previous query URL, direct-link fallback,
  log-to-report return, Telegram SDK Back callback, keyboard/outside menu closure,
  eight-digit form input and layouts at 390/768/1440px pass.
- The combined disposable native browser run passes eight-digit signup and
  recovery, targeted invitations, project roles, solo approval/PDF, locked
  history, revocation/archive, offline queue, Telegram linking and trial handover.

Both fixes are deployed to https://siteledger-ai.vercel.app as
`dpl_ATMpG2rjP12oS7f2bWktSgEttbNW`, status READY. Nineteen live HTTP checks and
public layouts at 390/768/1440px pass again. Production additionally accepts
all eight input digits, denies a deliberately invalid native code without a
session, and passes direct-link Back, phone menu and previous-page return.
No hosted account, email or evidence was created by these checks. Public demo
pages remain PRERENDER and the static PDF serves from cache.

Artifacts stay in ignored `supabase/.temp/task-13`. The builder's full mobile-data
flow is still pending. Keep task 13 open; task 14's README gallery and narrated
video have not begun. The unrelated session-start probe remains untouched and
unstaged.

Builder update, 22 November: signup now works after the deployed fix, and the
builder is starting project creation. Project setup, voice/photo intake,
confirmation, costing, PDF, approval/amendment and the complete mobile-data
flow still need the builder's result.
