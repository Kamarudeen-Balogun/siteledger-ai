# Task 6 review — costing engine

Scope: `PROJECT_BRIEF.md` section 10 and section 16 task 6, including the
in-task currency amendment. The engine is the pure `costReport(items, priceList)`
plus its decimal and display helpers, written before its tests.

Files reviewed (application code, written by Codex, not modified by this review):

- `lib/costing/cost-report.ts` — the pure `costReport()`. No AI, network, database
  or clock access; prices come only from the supplied price list.
- `lib/costing/types.ts` — `BoqPrice`, `ConfirmedCostItem`, `CostedItem`,
  `CostedReport`. All computed amounts are decimal strings; inputs accept
  `string | number`.
- `lib/costing/decimal.ts` — isolated `big.js` (`DP = 30`, `roundHalfUp`); `decimal()`
  rejects non-finite, unsafe and malformed values.
- `lib/costing/format-naira.ts` — `roundNairaForDisplay` / `formatNaira`, the NGN
  demo's nearest-₦10 display rule.
- `tests/costing.test.ts` — 21 tests written first.

This review owns only `.kiro/specs/siteledger/task-6-review.md`. No application
code, the original evidence, or historical reviews are changed. Task 7 (already
committed) is not modified; task 8 and account/currency screens are not started.

## Requirements check

1. **Exact arithmetic, no floating-point drift.** Met. `decimal()` parses every
   value through `new Big(String(value))`, so `0.0001 + 0.0002` stays `0.0004`
   and costs `1.45` / `2.9` / total `4.35` (test "decimal quantities…"). A
   database-sized `9999999999.9999 × 14500` yields `144999999999998.55` and
   survives `JSON.parse(JSON.stringify(...))` unchanged (test "decimal strings
   preserve exact database-sized costs"). Addition and multiplication never
   round; only completion/productivity division rounds at 30 dp.

2. **Locked-history inputs.** Met. `cumulative_locked_quantity` is required on
   every `BoqPrice` — `undefined` is rejected — and the handoff rule "supply zero
   when none" is how the tests construct fresh prices. Cumulative is
   `price.locked.plus(today)`, so locked history and today's quantity are added
   once. The function cannot verify the caller's history is correct; that is the
   caller's job (task 7's `assemble_report_input` aggregates only locked reports
   excluding the report being calculated). Correctness therefore depends on
   caller-supplied locked history, which is the intended split.

3. **Duplicate BoQ lines.** Met. Today's quantities are accumulated into a `today`
   map before costing, so two lines for one BoQ item each keep their own
   `cost_today` and `crew`/`productivity` while both show the same final
   `cumulative_quantity` (test: costs `145000` / `116000`, cumulative `186` /
   `186`, productivity `2` / `2`, total `261000`). `value_earned` is computed per
   line as `cumulative × rate` and is project-level progress information; the
   report total sums only `cost_today`, so `value_earned` is never summed into the
   total. A future dashboard that sums `value_earned` across report items would
   double-count duplicate lines — flagged for task 11, not a task-6 defect.

4. **Planned variance.** Met. `variance = plan === null ? null : percentage − plan`.
   Negative variance sets `is_behind_plan` and `variance_color: "red"` (test:
   40% vs 50% plan → `-10`, red). A zero plan is a real plan (`variance "40"`, not
   red); on-plan (`40` vs `40` → `0`) and ahead (`40` vs `30` → `10`) are not red
   (test "zero plan is a real plan"). `planned_percentage > 100` is rejected;
   absent/null means no plan.

5. **Uncapped red overruns.** Met. `overrun = cumulative > quantity` and
   `percentage = cumulative × 100 / quantity` with no cap. An overrun already in
   locked history (excavation `112 / 110`) gives `> 100%`, `is_overrun: true`,
   `variance_color: "red"`, `variance_percentage_points: null` (test). A plan does
   not hide an overrun: `22%` vs a `90%` plan is ahead of plan yet still red
   because cumulative exceeds quantity (test "a plan does not hide a quantity
   overrun").

6. **Confirmation validation.** Met. Every item needs a non-empty string
   `confirmed_by`; `""`, `" "`, `undefined`, and a missing field all raise
   `CostingValidationError` (test). The handoff is explicit that this is a presence
   check, not authentication — the server resolves the author elsewhere (task 7's
   `save_site_draft` reads `confirmed_by` from the submission, never from the
   caller). Unknown BoQ IDs, mismatched/null units, and missing quantities are
   rejected rather than estimated (tests). Crew must be `null` or a safe positive
   integer; `0`, `1.5`, `-1`, `NaN`, `Infinity`, `"6"`, and `MAX_SAFE_INTEGER + 1`
   are rejected; a missing crew leaves `productivity` `null` and `0` quantity
   gives `"0"` (test).

7. **Nearest-₦10 display rounding, never stored.** Met. `roundNairaForDisplay`
   is `decimal(amount).div(10).round(0).times(10).toFixed(0)` (half-up to the
   nearest 10), and `formatNaira` groups with thousands separators (`₦551,000`,
   `₦145,000,000,000,000`). The engine returns exact strings (`total_cost` stays
   `14.5`, not `10`); rounding happens only in the display helper, and the total is
   summed from exact line costs before any display rounding (test "sum exact costs
   before display rounding"). The display value is never written back as a cost.

Also verified: a caller's extra `rate` or `cost_today` fields on a work item do
not replace the BoQ rate — the total is still `261000` (test). Inputs are frozen
and repeated calls are deterministic (test). All five supported units are checked
against a scaled-integer money oracle across several quantities (test). The
engine has no currency field; `formatNaira`'s `₦` is NGN-specific for the demo
only, consistent with the amendment that defers project currency selection to
task 10A/11 with no exchange conversion.

## Test results (manual runs, this session)

- `npm run test:costing` — 21 tests, 21 pass, 0 fail (exit 0).
- `npm run lint` — `eslint .`, exit 0, no output.
- `npm run typecheck` — `tsc --noEmit`, exit 0, no output.

These are manual runs, distinct from hook execution below.

## Risks and observations

- **`value_earned` is project-level per line.** Summing it across report items
  double-counts duplicate BoQ lines. The engine never does this (it sums only
  `cost_today`), but a task-11 dashboard must not either.
- **Locked history is caller-supplied.** The engine cannot detect a wrong
  `cumulative_locked_quantity`; it trusts the caller. Task 7's
  `assemble_report_input` is responsible for aggregating only locked reports and
  excluding the current one.
- **`formatNaira` is NGN-only.** Fine for the demo; multi-currency display is task
  11. The engine itself is currency-independent.
- **`confirmed_by` is presence, not identity.** Correct by design; the server
  authenticates separately.

## Costing test-on-save hook

The task-6 prompt suggests configuring a costing test-on-save hook and observing a
real save if the installed Kiro version supports it. The `PostFileSave` mechanism
is supported (the existing `lint-on-save` hook uses it), but this review did not
add a costing test-on-save hook, for two reasons that follow from the constraints:

1. Agent-initiated file writes do not raise the IDE's `PostFileSave` event (the
   task-4 and task-5 reviews both observed this), so a save-triggered hook cannot
   be observed firing through this agent's tools — only the builder can, via a
   real editor save.
2. Triggering a costing hook would require saving a `.ts` file under
   `lib/costing/` or `tests/`, which the "do not change application code"
   constraint forbids.

If the builder wants it, the hook to add is a second entry in
`.kiro/hooks/lint-on-save.json`:

```json
{ "name": "Costing tests on save", "trigger": "PostFileSave",
  "matcher": "costing.*\\.ts$", "action": { "type": "command", "command": "npm run test:costing" } }
```

The matcher is deliberately narrow (costing source and test files only) so that
saving other files does not run the suite. It should be observed on a real editor
save (Ctrl+S in a costing file), not via an agent write.

## Lint-on-save hook (observed execution)

The existing hook at `.kiro/hooks/lint-on-save.json` is unchanged: schema `v1`,
one hook, trigger `PostFileSave`, matcher `\.(ts|tsx|md)$`, action
`command: npm run lint` (no `--fix`). It matches this review file (`.md`).

Baseline before the save: `npm run lint` exits 0 with no output on this tree, so
if the hook fires its command reports clean.

### What was done this session

This review file was saved through the agent's file-write tool to exercise the
hook — a `.md` save matching the matcher.

### What actually happened

The save produced no `HOOK_INSTRUCTION` block — only the single file-write
confirmation line. This matches the outcome the task-4 and task-5 reviews
recorded for the same hook: the agent's file-write tool does not raise the IDE's
`PostFileSave` event, which is raised on an editor save (Ctrl+S in an open file).
The hook is correctly configured and present from session start, so it should
fire on a real editor save, but an agent-initiated write is not that event.

One ambiguity that cannot be resolved within this review's single-file
constraint: the hook command is `npm run lint` (`eslint .`), which exits 0 with
no stdout on this clean tree (verified independently before the save). If Kiro
surfaces a `HOOK_INSTRUCTION` block only when a hook command produces output, a
clean run looks identical to a non-run, and `eslint .` does not read this `.md`
file in any case. Either way the practical result is the same: saving this file
through the agent did not surface any lint output, and on this clean tree there
is none to surface.

Recorded state: hook configured and valid, loaded from session start, not
observed to fire on an agent save. It should be re-observed on a genuine editor
save and recorded in the build evidence then — the same open item the task-4 and
task-5 reviews left.
