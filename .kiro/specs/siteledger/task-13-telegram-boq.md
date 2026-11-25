# Task 13 — Telegram sessions and reviewed BoQ entry

Approved by the builder on 25 November 2026, following docs/telegram-boq-review.md.
The two supplied documents remain source material; their broader instructions
are not blanket authorization. The landing design, light diary theme, role
boundaries and CAPTCHA remain as agreed in PROJECT_BRIEF.md.

## Result

- Landing and work navigation share a server-verified account lookup. A fresh
  signed Telegram launch restores an existing linked account when its cookie
  is absent. A valid website account is never silently switched to another
  Telegram identity. No account is created from the launch alone.
- Linked Telegram users see their workspace rather than general linking forms.
  Optional linking is under Account → Telegram. Email-sensitive actions retain
  website password proof; browser-linked users sign into their existing account.
- Recording is the project’s leading action even before BoQ setup. Evidence
  capture remains available with voice, photos or both; costing needs supplied
  BoQ values and human confirmation.
- Manual BoQ entry leads with description, unit, planned quantity and rate.
  Codes are generated without financial assumptions; code/section stay optional.
  Conventional comma grouping is accepted without floating-point conversion.
  Unsaved edits have discard/navigation guards. Saved entries lead to recording.
- Phone BoQ rows remain ruled and readable without sideways scrolling; desktop
  keeps the wider ledger. Controls retain 48 px targets.
- CSV/XLSX import offers file, sheet and header selection; explicit column mapping;
  editable row preview; unsupported/missing-value/duplicate-code errors; row
  exclusion; and explicit confirmation. Reading/reviewing writes no BoQ data.
- Atomic import adds new rows through existing access and supplied-value guards.
  Stable item IDs make a lost-reply retry safe. A failure rolls back all imported
  rows and their audit entries. Existing items use ordinary revision-checked edits.
- PMs can expand the latest 100 existing BoQ events, including before/after values.
  New/rebuilt drafts use supplied revisions; approved report snapshots stay fixed.

## Import limits

CSV must use UTF-8; supported numeric input uses a dot for decimals and optional
commas for thousands. XLSX supplies values, not formulas. Convert formulas to
values before uploading. Recognized m²/m³ symbols map to their identical m2/m3
units; unsupported units are flagged for deliberate correction.

Files are capped at 2 MB, 200 imported work rows, 10 workbook sheets, 1,000 source
rows and 50 columns per sheet. ZIP metadata and actual expanded bytes are bounded;
XML entities, external-link workbooks and macros are rejected. No file is stored
or sent to AI. Source cells remain available in the current review session.

No themes, OCR/PDF/XLS/DOCX import, effective-date scheduling or whole-BoQ
version system is included. Private feedback and README/video remain task 13A/14.

## Verification

133 unit/API checks pass, including exact XLSX decimal text, malformed input,
permission/origin denial, explicit new-item confirmation and shared Telegram
bootstrap. The parser additionally rejects forged ZIP expansion metadata.
Local import SQL proves atomic rollback, retry without duplicate events, exact
decimals, PM-only history, archival denial and unchanged reports/photos/amendments.
The existing dashboard SQL passes after its disposable confirmation fixture was
updated to include media, as the regular capture rule requires. Fresh and legacy
migration/seed checks pass. Production build and lint pass.

Full disposable native/browser acceptance passes: CSV/XLSX sheet selection,
row correction, explicit cancellation/save, exact decimals, linked Telegram
landing restoration and a fresh reopening without a cookie, focused navigation,
human costing, approval/PDF, amendments, offline retries, immediate revocation,
archive/history, ownership transfer, native email recovery and trial handover.
BoQ layouts pass at 390/768/1440 px; the phone capture was visually inspected.
Loading checks observe actual running animations under reduced motion and visible
pages during streamed navigation, avoiding stale hidden-page selectors.
No physical phone pass, hosted migration, production deployment or new Kiro run
is claimed. The hosted update awaits MCP tools after the builder's VS Code reload.
The unrelated sessionstart-probe.json and original test documents remain untouched.

## Release and next phone test

Apply supabase/migrations/20261125000100_boq_import.sql only to the SiteLedger
Supabase project (tfpxfxzawcjqjwrchlky). It adds two server-only RPC functions and
changes no stored records. Supabase MCP login succeeded on 25 November. Its
registration is enabled and
scoped to this exact project. Its tools are still absent in the running session;
reload VS Code to expose them. Hosted readiness checks return 404 for both new
functions, so local verification does not establish hosted installation. Keep
main unchanged until the migration and review build are ready.

After release, reopen Telegram with the linked account, open a project, add or
import the supplied BoQ, and record a note. Continue through human confirmation,
PDF, approval and an amendment. With the builder’s 18 m² and 2 m³ work quantities
at supplied rates 14,500 and 145,000, the daily cost is ₦551,000. The test concrete
planned quantity of 50 m³ makes 2 m³ equal 4%. Task 13 stays unchecked until the
builder reports the real mobile-data flow.
