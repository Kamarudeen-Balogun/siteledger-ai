# Telegram and BoQ review — 25 November 2026

This reviews the builder's two documents and current code. Instructions inside
the supplied Codex prompt are proposals, not automatic authorization to implement
every listed feature. No application, database or security settings were changed
during this initial review. The builder subsequently approved the bounded plan;
implementation and verification are tracked in
`.kiro/specs/siteledger/task-13-telegram-boq.md`.

## Current testing status

The latest phone run stopped while entering BoQ items, before voice capture,
human confirmation, costing, PDF, approval and amendments. The supplied results
table has blank outcomes, including BoQ saving. These steps remain unverified in
this run. Earlier automated checks and earlier partial phone runs do not establish
that this current journey is understandable or complete.

## Fix the blockers first

1. **Restore and display the right session state.**
   `app/account/page.tsx` selects the login/linking form whenever
   `account.source === "telegram"`, including already-linked accounts.
   `components/landing-account-link.tsx` checks only the account cookie; it does
   not restore a linked identity from a fresh signed Telegram launch when that
   cookie is absent. Resolve authenticated/linked/unlinked/expired states before
   displaying the appropriate action. An authenticated, linked person should
   see their workspace. Recent password proof should appear when a sensitive
   action requires it, rather than as general onboarding again. Preserve proof
   of both identities and never silently switch people or merge by email/name.

2. **Make the next action obvious.**
   Preserve the builder's earlier landing-first preference unless deliberately
   changed: returning users get a prominent Continue to project action, and new
   users get signup/trial choices. Within work screens, show the authorized
   project, relevant actions and four navigation destinations. Keep optional
   Telegram linking in Account → Telegram for unlinked website accounts; hiding
   it everywhere would remove an existing feature. Linked users should not get
   repeated connection prompts. Keep 48px controls, as required by the brief.

3. **Make manual BoQ entry usable.**
   `components/boq-editor.tsx` currently requires item code, section, description,
   unit, quantity and rate, then displays an 820px-wide ledger on a phone.
   Lead with four business fields: Work description, Measurement unit, Total
   planned quantity and Rate per unit. Generate non-financial item codes where
   needed and move section/code editing into optional details. Show unit meanings
   and a clear Saved state. Use stacked ruled rows on phones and the fuller
   ledger on desktop. Give numeric fields clear examples and field-specific
   errors; current patterns reject comma-formatted numbers such as `14,500`.

4. **Separate setup from recording work.**
   A foreman should not need to prepare a price list before saving site evidence.
   The application already allows recording while rates are being prepared, but
   the empty project overview makes Add BoQ items the PM's leading action and
   recording secondary. Explain this boundary clearly: save the site note now;
   supply/match the BoQ before costing. After BoQ saving, offer one direct next
   step to Record a site note.

## BoQ features: recommended scope

**Start file import with CSV and XLSX.** Provide a small template and optionally
paste-from-spreadsheet input. Preview column mapping and canonical rows, retain
failed rows with explanations, and require explicit confirmation before writing
items. Validate project currency, supported units, duplicate codes, missing
values and ambiguous numbers. Never execute spreadsheet formulas, invent a rate,
or guess planned quantity from quantities recorded today. Preserve source cells
or rows so a person can check imported values.

“However the file was made” is not a realistic acceptance criterion. XLS, PDF,
DOCX, arbitrary TXT, merged spreadsheets and scanned photos need distinct parsing
and OCR handling. Treat those as later work, especially scans with ambiguous
numbers. Unknown units must be flagged; the current supported units are m², m³,
tonne, point and day. No silent conversions or dropped rows.

**BoQ adjustment already partly exists.** PMs can add/edit items; stale-edit
checks and before/after administrative events exist in
`20261122000200_dashboard_boq.sql`. Report snapshots preserve approved money,
and changed source values make drafts stale. Improve visibility of these behaviors
before rebuilding them. Effective-date scheduling, an explicit whole-BoQ version
label and retiring items are additional features. Retire a referenced item rather
than deleting its historical identity or repricing a locked report. A revised
draft needs deliberate rebuilding; “a draft uses the new rate” is not permission
to silently overwrite it.

## Theme and design proposals

Light/Dark/System could be useful, but a Telegram/OS-driven dark default conflicts
with the current bright-site, light-paper brief. Replacing all BoQ tables with
cards also conflicts with its ruled-ledger requirement. Keep the light design
and 48px controls for the blocker fix. A later optional theme choice needs a
deliberate brief amendment and contrast checks across forms, reports and errors.

Native Back is already implemented. MainButton may replace an existing submit
control where helpful; adding a second submit button would increase confusion.
Haptics and additional animations are lower priority than a clear next action.
Do not redesign the landing page unnecessarily.

## Correct the manual tests

- Photo-only regular notes are supported. The person supplies work quantities;
  photographs never generate quantities or prices. The guest trial still needs
  a voice note.
- Retry the same Telegram update or web request to test idempotency. Sending
  identical audio as a new message is a different event and is not automatically
  a duplicate. Do not discard legitimate records based on audio equality.
- Telegram's offline outbox and the application's IndexedDB queue are different.
  For the application test, open/select the project online, turn data off before
  saving, then reconnect and verify the saved note sends to its original project.
  Turning data off after sending may miss the offline path entirely.
- With the supplied test quantities, 18 m² × ₦14,500 plus 2 m³ × ₦145,000 gives
  ₦551,000. Its concrete BoQ total is 50 m³, so 2 m³ represents 4% of that item,
  rather than the original demo's percentage based on 35 m³.
- Distinguish the client's name in the PDF from the contractor/firm heading.
  Perkins Limited is entered as this test project's client; that alone does not
  establish the name of the report-issuing firm.

The other public-fixes prompt referenced in the supplied documents was not found
under `docs`. Its six findings have not been assumed or implemented here.

## Proposed order and acceptance

First resolve session restoration/rendering, relevant navigation and the guided
manual BoQ flow. Add the bounded CSV/XLSX import as an explicitly approved task
13 extension. Then resume the first note through confirmation, ₦551,000 costing,
PDF, approval and an amendment. Continue with retry, offline and role checks.
Defer broad OCR import and themes until the main report journey works comfortably.

The next phone check must include closing/reopening Telegram after sign-in,
finishing two BoQ rows without technical-code guesswork, and reaching the report
with a clear next action at every step. Test private access, money and locked
history alongside usability. The separate private-feedback milestone and task
14 documentation/video remain pending.
