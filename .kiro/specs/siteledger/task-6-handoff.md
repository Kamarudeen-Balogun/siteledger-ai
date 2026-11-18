# Task 6 — costing engine

Source: `PROJECT_BRIEF.md`, section 10 and section 16 task 6. Implementation and
verification below were performed by Codex on 18 November 2026.

## Implementation

- `lib/costing/cost-report.ts`: pure `costReport(items, priceList)` with no AI,
  network, database or clock access. Prices come only from the supplied BoQ.
- `lib/costing/types.ts`: confirmed item, price and result contracts. All computed
  amounts are decimal strings so JSON serialization preserves exact values.
- `lib/costing/decimal.ts`: isolated `big.js` configuration. Addition and
  multiplication are exact; division for completion/productivity uses 30 decimal
  places. Unsafe JavaScript numbers must be supplied as decimal strings.
- `lib/costing/format-naira.ts`: the current NGN demo's nearest-₦10 display rule,
  with exact grouping for large values. Display values must never be stored as costs.

The trusted caller must load saved `confirmed_extraction`, `confirmed_boq_ids`
and `confirmed_by`, authorize the project, and supply its BoQ. Passing raw AI
extraction is forbidden. An author is required by the pure function; that field
does not replace server authentication or prove identity by itself.

`cumulative_locked_quantity` is required for every BoQ row: explicitly supply
zero when no locked work exists. Aggregate only locked reports, excluding the
report being calculated. Supply the plan for that report's date if one exists;
null/absent means no plan. Read database numeric values as strings before JSON
parsing can lose precision.

Repeated confirmed lines for one BoQ item retain separate costs and crew
productivity, while all show the same final cumulative quantity and completion.
Their repeated earned values are per-item progress information; do not sum them
to calculate project earned value. The report total sums only today's line costs.

Overrun detection uses exact cumulative quantities, does not cap percentages at
100, and returns `variance_color: "red"`. Negative planned variance also returns
red. A positive planned variance cannot hide an overrun.

Missing quantities, unknown BoQ IDs, mismatched units, absent confirmation,
invalid rates/history/BoQ quantities, duplicate price IDs, invalid plans and
non-positive/non-integer crew counts raise `CostingValidationError`. A missing
crew is allowed and leaves productivity null. Work-item money fields cannot
override the BoQ rate.

## Tests and acceptance evidence

`tests/costing.test.ts` was written first. `npm run test:costing` initially failed
because the engine module did not exist. After implementation, all 21 tests pass.
They cover every section 10 formula, partial/full/overrun progress, a zero plan,
crew productivity, repeated BoQ lines, exact fractional and large costs, total
rounding, bad inputs, deterministic results and frozen input objects. A separate
scaled-integer oracle checks all five supported units at several quantities.
Every rate in the tests is from the brief's seed list.

Read-only hosted verification used the builder's existing saved human confirmation
and textual PostgreSQL numeric values, through the SiteLedger-scoped Supabase MCP.
It compared the actual `costReport` output with PostgreSQL multiplication:

| Work | Confirmed today | BoQ rate (NGN) | Cost today (NGN) | Cumulative quantity | Completion | Productivity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 225mm blockwork | 18 m² | 14,500 | 261,000 | 186 m² | 44.285714…% | 3 m²/person/day |
| Columns and beams | 2 m³ | 145,000 | 290,000 | 16 m³ | 45.714285…% | 0.5 m³/person/day |

The exact total is NGN 551,000. The earlier AI extraction and original media were
not changed, and no report or report item was created. This check made no AI
requests and no database writes.

Regression checks pass: 8 Telegram tests, 18 AI tests, 5 confirmation tests,
`npm run lint`, `npm run typecheck`, and `npm run build`. The new package-lock
entries are only `big.js` and its TypeScript definitions.

## Currency amendment and next task

During task 6, the builder requested project currency selection and chose rates
supplied in that currency rather than exchange-rate conversion. The amendment
is recorded in the brief, AGENTS, README and build order. Task 10A will add the
selector during project creation; tasks 10A–11 will carry currency labels through
records and displays. The existing demo remains NGN. Locked records retain their
original currency and totals in different currencies remain separate.

The engine already has no currency assumption. The existing NGN display helper
is specifically for the current demo; it is not a worldwide currency formatter.
Currency selection is planned, not implemented during task 6.

Task 7 is report creation, the web report and PDF. Integrate the costing engine
only after loading saved confirmation, and preserve exact amounts and snapshots.
Lock/approval and amendment UI remain task 8.

## Kiro review prompt

Read `PROJECT_BRIEF.md` section 10 and section 16 task 6, including the currency
amendment. Review the pure engine and tests. Write findings only to
`.kiro/specs/siteledger/task-6-review.md`. Check exact arithmetic, locked-history
inputs, duplicate BoQ lines, planned variance, uncapped red overruns, confirmation
validation and nearest-₦10 display rounding. Run `npm run test:costing`, lint and
type checking. If the installed Kiro version supports it, configure a costing
test-on-save hook and observe a real save; distinguish manual test runs from hook
execution. Do not modify application code, the original evidence, historical
reviews, or implement task 7 or account/currency screens during this review.

No task 6 Kiro review, costing hook execution or Costing Crew work is claimed yet.
