# Task 7 — daily reports and PDF

Source: `PROJECT_BRIEF.md` sections 4, 7, 10 and 12, and section 16 task 7.
Implementation and verification were performed by Codex on 18–19 November 2026.
The builder chose **Perkins Limited** for the report and PDF heading.

## Delivered behavior

`Confirm and cost it` saves human-confirmed values, creates a costed draft and
opens its private report. Correction saves rebuild the same draft and preserve
weather. Failed costing leaves the saved confirmation available for retry. The
confirmation API itself still saves confirmation only.

The report and A4 PDF use the site-diary palette, ruled BoQ rows, right-aligned
naira figures, materials, delays, issues, progress, crew productivity, attached
photos, weather and signature blocks. The existing locked demo shows its stamp
and red excavation overrun. Photo notes are the human-confirmed observations;
task 7 makes no vision calls or inferred findings.

The public preview exposes only the original fictional report of 6 November
2026, not real Telegram notes sent to that project. Private reports and media
use the existing signed review access with owner/PM checks. Route IDs are
submission IDs; the report's own UUID is displayed inside the document.

## Implementation and integrity

- `lib/reports/model.ts`: source/document contracts, confirmed-only costing,
  exact stored-total verification, formatting and stale draft detection.
- `lib/reports/data.ts`: private reads and creation, using the existing server
  RPC adapter. No caller money, rates or identity is trusted.
- `supabase/migrations/20261118000400_daily_reports.sql`: captured documents,
  one report per submission, private source/read/save RPCs and narrow fictional
  demo reads. Browser roles cannot execute the RPCs. Saves revalidate the
  source under database locks and compare quantities, rates and totals exactly.
- `components/report-document.tsx`, `report-actions.tsx`, `app/reports/` and
  `app/api/reports/`: web document, draft/weather action and private PDF routes.
- `lib/pdf/report-template.tsx` and `export.ts`: server-generated A4 PDF with
  real attached images, all-page footers and reproducible document timestamps.
  Public Sans and Source Serif fonts are bundled with their upstream licenses.
  Next output tracing includes those fonts for the PDF routes.

Draft saves change generated draft rows only. Export does not modify records.
Locked documents use their snapshots, or the captured seed rates for legacy
reports; they are never silently repriced. Stale drafts cannot export until
rebuilt. Money remains exact decimal strings in the document and PostgreSQL
numeric values in tables; nearest-₦10 rounding occurs only in display.

Server Supabase URL reads are resolved at runtime so a production local preview
cannot combine a build-time hosted URL with local credentials. This adjustment
in the existing storage/evidence adapters passed their regression checks.

## Acceptance evidence

Eight report model/API tests pass, in addition to the existing 52 tests:
8 Telegram, 18 AI, 5 confirmation and 21 costing. One browser integration test
brings the automated total to **61**. All five local SQL suites pass, as do
lint, TypeScript and the production build.

The isolated production browser check at 390px covered confirmation to draft,
₦261,000 for 18 m² blockwork, weather recording, PDF download, correction to
19 m² and ₦275,500, weather preservation, retry-safe single-report persistence,
original transcript retention and denied unsigned/stranger PDF requests.
Desktop and locked demo layout checks passed, with red overrun and no browser
errors. Temporary records were removed from the local database.

The final fictional demo PDF has two A4 pages. Both were visually checked:
normal work rows do not split, the naira glyph is present, the overrun remains
red, signature blocks are visible and every page carries its footer/number.

The builder's existing confirmed note was costed through the actual private
API and saved as a **draft only**. PostgreSQL and the exported PDF agree:

| Confirmed work | Quantity | BoQ rate (NGN) | Cost today (NGN) |
| --- | ---: | ---: | ---: |
| 225mm blockwork | 18 m² | 14,500 | 261,000 |
| Columns and beams | 2 m³ | 145,000 | 290,000 |
| Total | | | 551,000 |

The note has no attached photos. The four uploaded photos belong to the earlier
unconfirmed note and were preserved there. They were read privately and passed
to the actual PDF renderer in an ignored local fixture clearly labelled as a
rendering test. All four images appeared across three A4 pages, with footers.
No photo association, quantity, confirmation or finding was invented.

Before/after database comparisons confirmed unchanged transcript and extraction
hashes, all photo rows/associations, the 12 locked reports and the existing
amendment. The real note remains confirmed, with two generated draft items and
an exact stored total of `551000.000000` NGN.

The report migration was applied successfully to both the local SiteLedger
stack and its scoped hosted database. The normal hosted-development app is
available on port 3011; isolated local test preview uses port 3010. Generated
PDFs/screenshots are ignored artifacts under `supabase/.temp/task-7/`, including
`confirmed-report.pdf`, `demo-report.pdf` and `photo-rendering-check.pdf`.
No private bearer URL or environment value belongs in this evidence file.

## Scope and next task

Task 8 owns the approval/lock action, amendment flow and dispute-log interface.
Task 7 does not approve the builder's draft. Project currency selection remains
scheduled for task 10A, with BoQ rates supplied in that currency. The current
demo and its captured report documents are NGN; no exchange conversion exists.

## Kiro review prompt

Read `PROJECT_BRIEF.md` section 16 task 7 and sections 4, 7, 10 and 12. Review
the implementation above and write findings only to
`.kiro/specs/siteledger/task-7-review.md`. Check private report/media access,
confirmed-only exact costing, retry-safe drafts, stale export prevention,
weather preservation, locked snapshots, the narrow public demo, bundled fonts
and A4 PDF pagination/images. Run `npm run test:reports`,
`npm run db:check-reports`, lint and TypeScript. If running the browser check,
use the documented isolated local preview and preserve all real hosted records.
Do not modify historical reviews or implement task 8/account/currency features
during the review. Distinguish manual checks from observed hook execution.

No task 7 Kiro review, hook execution or Crew work has been observed or claimed.
