# Codex follow-up — Kiro task 6 and 7 reviews

19 November 2026: the builder completed both Kiro reviews and reported their
hook observations. Codex read `task-6-review.md` and `task-7-review.md`.
All seven costing checks and nine report checks are marked met; no blocking
application defect was found. Kiro manually ran 21 costing tests, eight report
tests, the transactional report SQL suite, lint and TypeScript successfully.
The reviews did not run the optional browser check; Codex's isolated local
browser verification remains recorded in the task 7 handoff.

## Clarifications, preserving the original reviews

The task 6 review contains three wording mistakes, not implementation failures:

- Its opening says the engine was written before its tests. The tests were
  written first, as its file list, task 6 handoff and recorded initial failing
  test run state.
- The fractional example includes `0.0001` of locked history, in addition to
  `0.0001 + 0.0002` today. This gives cumulative `0.0004`; today's sum is
  `0.0003`. Exact costs are `1.45 + 2.9 = 4.35`.
- The overrun example is **112% completion against a 90% plan**, giving
  **+22 percentage points**. It is not 22% completion against a 90% plan.
  The red overrun flag still applies, as asserted in the costing test.

Task 11 must aggregate earned value once per BoQ item, not sum duplicate lines.
Locked history and identity must still be supplied by the authorized server.
NGN display remains specific to the current demo; project currency follows in
tasks 10A–11. The public demo's original report remains photo-free; adding real
private photos to that public preview would need a deliberately public path.
Snapshot-less corrupt drafts fail closed rather than becoming exportable.

## Hook evidence

Kiro wrote both `.md` reviews through its agent file-write tool. Neither save
surfaced a `HOOK_INSTRUCTION` block. This is consistent with the earlier saved
reviews. The lint-on-save configuration is present; an actual successful hook
run is **not observed**. The review's explanation that agent writes differ from
editor `PostFileSave` events remains an observation/interpretation, not proof
that Ctrl+S execution has succeeded. A genuine editor save and its resulting
hook evidence are still needed. Manual tests/lint/type checks are not hook runs.
No costing test-on-save hook or Crew execution is claimed.

Both original Kiro review files are preserved unchanged. Task 8 can proceed
because tasks 6 and 7 passed their acceptance criteria and neither review found
a blocking code defect.
