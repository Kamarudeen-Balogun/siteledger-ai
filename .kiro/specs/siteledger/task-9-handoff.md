# Task 9 — photo suggestions (acceptance complete)

Source: `PROJECT_BRIEF.md` sections 4, 8, 9, 12 and section 16 task 9.
Implementation and manual verification: Codex, 21 November 2026.

Task 8's Kiro review and hook notes have been read and preserved. The builder
reports that their initial 50 Kiro credits are exhausted and their requested
4,000 credits have not arrived. This document prepares a later review; it is
not a Kiro review, observed hook run or Crew execution.

## Implementation

- `lib/ai/analyse-photo.ts` is the only entry for vision generations. It uses
  the existing configured Gemini account and `gemini-3.5-flash-lite`, checks
  JPEG/PNG/WebP type/signature and a 1 MiB limit, validates an exact JSON schema,
  retries invalid JSON once and falls back to manual notes on transport,
  quota/configuration or repeated schema failure. No paid fallback, billing
  upgrade, external model tools or automatic model substitutions are configured.
- Output contains likely work item, possible defects, possible safety concerns
  and confidence. No quantities, crew, dimensions, progress, rate or currency
  fields are accepted. The prompt requires visible evidence, distinguishes
  materials-testing photos from site work, and treats image text as evidence
  rather than instructions. Confidence is an estimate, not verified accuracy.
- New uploads enqueue private `photo_analysis_jobs`. Existing photos are not
  backfilled. Workers run after Telegram acknowledgement; an authorized review
  refresh can resume an interrupted job. Up to five photos are processed with
  three workers. Each photo uses an owned 60-second lease, at most two worker
  claims and at most two generations per claim. Exhausted leases/persistence
  retries become manual entry. Provider failures end the current job immediately.
- Confirmation waits for new photo jobs. A database guard enforces this even
  for direct updates; photo workers cannot write after human confirmation.
  Original `ai_findings` cannot be overwritten. No worker changes transcripts,
  human observations, quantities, reports or costs.
- `components/photo-observations.tsx` shows every finding as **Possible** with
  confidence. Findings below 0.6 are amber and omitted from default notes; the
  person types their own observation if they agree. Higher-confidence defaults
  stay editable. Dismissal removes only an unchanged suggestion line and
  preserves human text. Arrival of analysis never replaces typed or previously
  confirmed notes. Notes are bounded to the existing 5,000-character contract.
- Reports and PDFs continue to use `confirmed_findings.note`, so dismissed and
  unaccepted raw findings do not reappear in the client document.

## Migration and access boundary

`supabase/migrations/20261121000100_photo_analysis.sql` is applied to the
SiteLedger local Docker database and scoped hosted project. The hosted migration
is `20261121111650_photo_analysis`, applied on 21 November 2026 after inspecting
the existing schema, with the tested preservation guards described below.
The new table has RLS and no browser access; mutation RPCs are service-only.
Private review/media access uses the current authorized foreman/PM boundary.
Task 10A's authenticated identity and immediate revocation remain future work.

Before/after whole-table hashes for the original local submissions, photos,
reports, report items and amendments are identical. The local originals remain
12 submissions, 12 locked reports, 65 report items, one amendment and no photos.
Transactional fixtures roll back; browser fixtures use a disposable database.

The earlier MCP OAuth failure was resolved by reauthentication and a VS Code
restart. Hosted whole-table hashes for submissions, photos, reports, report
items and amendments match before and after migration. All ten existing tables
also passed the migration's transaction-scoped preservation checks. No existing
photo was backfilled. The hosted photo SQL suite passed with disposable rows
and `ROLLBACK`; browser roles cannot read jobs or run mutation RPCs. Read-only
checks of existing owner/PM review and private media passed, while unsigned,
unlinked-account and public-media access were denied. No database was reset.

## Verification evidence

- **76 unit/API tests pass**, including 12 photo checks for exact schemas,
  missing/invalid/oversized images, unchanged bytes, possible language,
  confidence defaults, maximum note length, bounded retries, provider request
  configuration, ownership, unavailable media and failed persistence.
- Photo, confirmation, AI, Telegram, report and dispute-log SQL suites pass in
  the local SiteLedger container with `ROLLBACK`. The photo suite additionally
  checks expired leases, stale owners, retry exhaustion and separate raw versus
  confirmed observations. The base database integrity suite also passes: seven
  SQL suites in total, all with rolled-back fixtures.
- The disposable photo browser check passes at 390px and 1280px. It holds a
  photo lease, types observations and corrects 18 to 19 m², then completes the
  held job and exercises the real polling refresh. Typed fields survive;
  dismissing a finding preserves human text; low-confidence notes remain
  unaccepted; missing-provider analysis becomes manual entry. Confirmation
  produces the correct seed-rate cost of NGN 275,500 and a valid PDF. The report
  includes the human notes and excludes the dismissed defect and low-confidence
  safety text. Unauthenticated media access is denied; no browser errors occur.
- The original browser check uses deliberately tiny PNG plumbing fixtures. Its findings
  are scripted test input, **not live detector evidence**. Screenshots are in
  ignored `supabase/.temp/task-9/photo-confirm-mobile.png` and
  `photo-confirm-desktop.png`; the mobile screenshot was visually inspected.
- A separate live, read-only check used the four existing materials-testing
  photos. Two returned manual entry (`analysis_failed`); two returned valid
  analysis identifying lab/materials work, no defects, and possible footwear
  or hand-protection concerns. These suggestions were not written to the
  original records. Results are in ignored
  `supabase/.temp/task-9/read-only-photo-analysis.json`. This is limited provider
  evidence, not proof of defect detection or general accuracy.
- Lint, TypeScript and production build pass. Commands were run by Codex,
  independently of Kiro hooks.

Run from the workspace root:

```sh
npm run test:photos
npm run db:check-photos
npm run test:photos-browser
npm run test:photos-demo-browser
npm run lint
npm run typecheck
npm run build
```

The browser command requires the running local SiteLedger Docker stack and free
loopback ports 3013, 55425 and 55426. The shared browser runner explicitly clones
the local database, disables AI/Telegram keys for its test process, and removes
only its uniquely named disposable API/database when finished.

## Actual task 9 acceptance

The builder supplied three externally generated images on 21 November 2026.
Original PNG bytes and compressed demo JPEGs are saved in `public/demo/photos/`;
see `public/demo/photos/PROVENANCE.md`. The JPEGs are 1200 × 800 and under 1 MiB
each. Their **SYNTHETIC DEMO - NOT SITE EVIDENCE** disclosures were visually
checked after compression. The website/model was not supplied and must not be
invented. Saving the assets did not run AI or write to any database.

Actual `analysePhoto()` requests succeeded for all three JPEGs. The column
response describes "An area of rough texture and exposed aggregate is visible
on the surface of the concrete column" with confidence 0.9. The blockwork
response has no defect/safety finding. The slab-edge response suggests visible
absence of guardrails or barriers, with confidence 0.85. These are suggestions
about synthetic scenes, not diagnoses or verified accuracy on real sites.

The original `gemini-3.1-flash-lite` requests hit a timeout and high-demand 503s.
`gemini-2.5-flash-lite` returned 404 because it is unavailable to this account;
Google directed the account to `gemini-3.5-flash-lite`, whose documented free
tier supports image analysis. The primary photo model was deliberately updated
to 3.5. Its first column request also hit 503, then a separate manual processing
attempt succeeded. Other images succeeded once. There is no automatic model
fallback or billing change. All failed and successful responses are retained
under ignored `supabase/.temp/task-9/actual-demo-analysis-20261121*.json`.

`tests/photos-demo-browser.test.ts` validates the recorded response model,
successful HTTP status, exact schema and source image hashes. A disposable
database uses those actual findings and saved JPEGs. At 390px and 1280px,
dismissing the column suggestion preserves typed human text and original raw
findings; confirmation uses the edited quantity and existing BoQ rate. The
report shows the human note and NGN 275,500, excluding the dismissed defect.
PDF text extraction verifies the same exclusion, retained human/safety notes,
three embedded photos and A4 dimensions. Mobile confirmation and PDF pages
were visually inspected. Browser errors and unauthenticated media access checks
pass. The separate scripted browser check still covers polling, low confidence
and missing-provider manual entry. Neither test writes genuine records.

Screenshots/PDF: ignored `supabase/.temp/task-9/actual-photo-confirm-*.png`,
`actual-photo-report.pdf`, `actual-photo-report-page-*.png`. Hosted access and
preservation evidence is retained in the same ignored directory.

To reproduce the actual provider acceptance with configured Gemini access:

```sh
npm run ai:analyse-demo-photos
# If one image fails, retry it deliberately as a separate processing attempt:
npm run ai:analyse-demo-photos -- --photo=synthetic-column-voids
npm run test:photos-demo-browser
```

The explicit analysis helper writes no database records, preserves each attempt
and maintains `supabase/.temp/task-9/demo-photo-analysis.json`. The browser test
requires genuine successful responses in that manifest and never manufactures
one. It can fail during provider outages. Core confirmation retains its durable
manual-entry fallback in that situation.

Task 9 acceptance is complete. Task 10 has not started. A later Kiro review and
hook/Crew evidence remain separate from this Codex implementation milestone.

## Follow-up — provider access and guarded migration, 21 November 2026

At the builder's request, Codex checked image generation with the existing
Gemini and Groq accounts. Gemini's model list includes image models, but one
request to `gemini-3.1-flash-lite-image` using the saved column prompt returned
HTTP 429 `RESOURCE_EXHAUSTED`, with a free-tier quota of zero. No billing settings
were changed, no alternate image model was called, and no image was produced.
Groq lists text/speech models and no image-generation model. Sanitized response:
ignored `supabase/.temp/task-9/image-generation-access.json`. Provider references:
[Gemini image pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite-image)
and [Groq models](https://console.groq.com/docs/models).

The builder may generate the three images on a third-party website and attach
the originals or save them under `public/demo/photos/`. Preserve the visible
synthetic disclosure and record the website/model, date and prompt. Inspect
the outputs before running actual analysis; generation is not detector evidence.

Before restart, the configured SiteLedger REST API was reachable but the photo
table was absent. The default Supabase CLI account did not contain SiteLedger
and was not used for writes. `codex mcp login supabase_siteledger` succeeded,
but the running MCP client retained its startup failure. After restart the
scoped connection loaded and the migration/verification completed as recorded above.

`node scripts/prepare-photo-migration.mjs` prepares the outstanding migration
only, under ignored `supabase/.temp/task-9/apply-photo-analysis.sql`. It includes
the correct project URL, prior-schema and duplicate-application guards, short
lock/statement timeouts, and before/after whole-row hashes for ten existing
tables. A mismatch or backfill aborts the transaction. It does not execute SQL,
seed data or reset a database; the SQL checks do not replace selecting the
correct hosted project.

Codex verified that generated SQL against a uniquely named disposable local
database built from the prior migrations and fictional seed. The upgrade
preserved all ten tables and left the new job table empty. An intentionally
injected project row caused the entire upgrade and fixture to roll back;
reapplication was rejected. The photo SQL suite passed after the upgrade.
The disposable database was removed; original local and hosted records were
not used for writes. This was manual Codex verification, not Kiro hook evidence.

## Future Kiro prompt — use when credits return

```text
Read PROJECT_BRIEF.md before the task. Review task 9 only, using this handoff,
lib/ai/analyse-photo.ts, photo-schema.ts and process-photos.ts,
components/photo-observations.tsx, the confirmation/Telegram integration,
20261121000100_photo_analysis.sql and the photo tests.

Check supported visible observations, schema and request bounds, failure/manual
entry, durable leases, private access, confirmation races, immutable originals,
low-confidence handling, human edits surviving refresh, dismissal and report/PDF
notes. Distinguish scripted browser findings from actual provider responses and
synthetic scenes from genuine site evidence. Review the actual successful and
failed response records, the photos-demo browser check, and the hosted migration
and preservation evidence. Do not describe synthetic success as real-site accuracy.

Save your own review to .kiro/specs/siteledger/task-9-review.md. Do not rewrite
historical reviews, alter genuine records, start task 10 or claim a Crew run.
Run appropriate checks and record exact outcomes. Keep manual commands separate
from any observed hook execution; the earlier hook diagnostic remains pending.
```
