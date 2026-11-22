# Task 12 — site diary polish

Implemented and checked by Codex on 22 November 2026. No new Kiro review,
hook execution or Crew run is claimed. Task 13 deployment has not begun.

## Screens and states

- Today uses the shared workspace navigation, an 88px recording control and
  separate capture/device-queue columns on desktop. Phone layouts stay stacked.
  Keyboard focus on the hidden file input is visible on its clickable label.
- Confirmation has readable 16px controls, ruled rows, clearer field spacing
  and amber low-confidence highlights. Unclear fields remain blank. Loading,
  manual entry and failed requests give plain guidance; failed confirmation
  keeps the edited quantity and observations for retry.
- Shared paper notices identify actual loading work. Their indeterminate line
  does not imply a completion percentage. Reduced motion disables animation
  and confirmation-feedback smooth scrolling.
- Account, invitation, project, team, BoQ, report, log and trial pages use the
  same navigation and loading presentation. The active trial capture/review
  has a main landmark with expiry and account handover inside its work flow.
- Forms use a paper tint, square controls, visible focus and text-labelled
  actions. Account mode selection is visible. Report observations, progress
  and signature text are readable on phones; print text retains its compact
  document sizing. Existing lock stamps and ruled money tables remain.
- Help now describes implemented BoQ entry and the exact existing-Telegram
  email/password connection steps. Two separate test users need different
  emails; one website profile has one active Telegram connection.

## Acceptance

- 110 unit/API checks pass. Lint and the final production build, including
  TypeScript, pass. A temporary JSX typo found by TypeScript was corrected.
- Six public pages pass at 390/768/1440px with keyboard navigation, loaded
  imagery, creator links, supplied-rate illustration and no page overflow.
- The expanded disposable native browser suite passes loading/reduced-motion
  checks, blank amber low-confidence inputs, 48px/16px review controls,
  preserved quantity after a simulated failed request, an 88px recording
  target, visible file-input focus and Today layouts at all three widths.
- Existing signup/recovery, invitations, role/access denial, BoQ editing,
  exact KWD costing/PDF, unchanged locked PDF after price edits, offline
  persistence/retry, removal/archive, Telegram linking and one-use verified
  trial handover still pass.
- Desktop Today, mobile loading/low-confidence/retry states and the public
  pages were visually inspected. Saved artifacts are under the ignored
  supabase/.temp/task-10a/browser and supabase/.temp/task-10a2 directories.

No database migration, pricing/AI change or genuine evidence mutation is part
of this task. Browser fixtures use separate native Auth/SMTP/media; no hosted
emails or real-site speech/photo accuracy are claimed. Old rates, names,
permissions, signatures and private-media authorization remain protected.

## Builder decisions and next work

The builder explicitly keeps the supplied labelled synthetic images for this
milestone because real photos are not available yet. Their disclosures and
provenance are retained. This exception is recorded in the brief and AGENTS.md;
these images are not genuine evidence and are not inserted into locked history.

The expanded README gallery, Telegram conversation/voice captures and narrated
demo belong to task 14 after deployment checks. The video target is 2:50,
within the under-three-minute rule. Actual captures or labelled illustrations
must be used. No fabricated conversation, successful Kiro hook or Crew run is
claimed. The unrelated sessionstart-probe hook stays untouched and unstaged.
