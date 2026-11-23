# Work-screen review — 23 November 2026

Builder feedback: account/project setup works, but the interface is confusing.
The builder reached saving a voice note and one image and stopped before review.
This is partial task 13 acceptance, not a completed end-to-end phone test.

Approved scope: all existing work screens. The latest correction permits
voice-only, photo-only or combined regular notes; empty submissions are rejected.
The private trial keeps one required voice note and zero to three photos.

## Findings and changes

- components/capture-diary.tsx:154 — voice, photos, device queue and upload receipt share one long screen; show attachment readiness and move the saved note's review action into view.
- components/capture-diary.tsx:150 — save requires both media types despite the builder's revised rule; allow either and validate the same rule on the server.
- components/confirm-form.tsx:140 — confidence and matching hints compete with work quantities; keep primary fields visible and technical details expandable.
- app/projects/[id]/page.tsx:29 — team administration appears before the core recording action; lead with project setup and recording, then records and administration.
- app/projects/page.tsx:23 — a full creation form competes with an existing project list; expose creation on demand and keep project selection prominent.
- app/account/page.tsx:14 — profile editing and identity linking compete with continuing work; lead with account readiness and group settings into labelled sections.
- app/reports/[id]/page.tsx:46 — approval sits after a long document; put the next authorized action beside report status, with human confirmation and approval still separate.
- components/account-forms.tsx — move sign-out to the account overview, use separate password-recovery steps and keep current-password confirmation in Email settings. Collapse Telegram connection changes when already linked.
- components/project-forms.tsx — reduce project-list rows to project identity, role, earned value and opening/recording actions; move administration into the project.
- components/confirm-form.tsx — collapse capture metadata and empty materials/delays; show low-confidence input guidance once per row while retaining field descriptions for assistive technology.
- components/dispute-log.tsx — keep author, date, amount/correction and original-report link visible; expand technical IDs only when needed.
- app/reports/[id]/page.tsx — open amendment entry in a separate query view and warn before leaving an unsaved correction.

## Design direction and sources

Keep the project's warm paper, ruled ledger rows, ink and burnt-orange accent.
Use clear state labels, one leading task action, accessible touch targets and
progressive disclosure. Show the selected project and real save/upload state.
Keep exact project currency displays and every original evidence snapshot.
The builder's 23 November instruction confirms the full work-screen and user
settings redesign; the landing page remains unchanged.

Guidance: existing Frontend Design skill and Vercel's Web Design Guidelines,
installed from `vercel-labs/agent-skills` commit
`5a37a6329fbad3666c3207392a6a7c0110e92efb`. Its bundled interface rules are pinned
to `434b7f91364665f2f733b310ec54809bf8f37937` in
https://github.com/vercel-labs/web-interface-guidelines.

These are code/UI findings and the builder's feedback, not a statistical user
study. No competitor product code or earlier project assets are reused. No
Kiro review, automatic hook execution or Crew run is claimed.
