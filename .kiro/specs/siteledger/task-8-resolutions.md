# Task 8 review follow-up

Codex read Kiro's completed `task-8-review.md` and `docs/kiro-hook-test.md` on
21 November 2026. Both original evidence files and Kiro's hook configurations
are preserved. No application code or genuine project records were changed.

## Review outcome

All six task 8 criteria pass: PM approval, immutable evidence, amendment retries,
newest-first presentation, authorized bot access and fictional public previews.
Kiro recorded passing log unit/API tests, transactional log/intake SQL checks,
lint and TypeScript. Codex reran the 21 costing and four log tests: **25 pass,
zero failures**. These were manual commands, not hook execution. The costing
directory matches its committed contents after removal of the temporary comment.

No task 8 application fix is required. Photo analysis is ready to start.
Authenticated accounts, project teams, professional names and revocable report,
PDF/media access remain required task 10A work before submission.

## Hook observations and limits

Kiro recreated the lint hook and added a costing hook through `createHook`.
Its temporary save probe produced no trace after the builder's editor save,
but the probe command created a trace when invoked manually. That establishes
the observed probe failure; it does not independently prove that each separate
lint/costing hook failed, or that this Kiro version lacks the save event. Neither
lint nor costing has proven automatic execution yet. No successful hook run or
Crew execution is claimed.

The installed application is Kiro **1.4.236**, with agent extension **1.1.1056**.
Read-only inspection of the installed `kiro.kiro-agent/dist/extension.js` confirms:

- `StandaloneHookLoader` reads `.json` files and validates the `version: "v1"`
  document containing `hooks`. The misleading internal "v2" schema terminology
  does not mean these files need a different version field or filename suffix.
- `CreateHookTool` writes `.kiro/hooks/<id>.json` and states that the hook becomes
  active at the next session start. Existing project hook files match that format.
- `PostFileSave` is documented as a supported user-save trigger, with its regex
  matched against the file path. `fileEdited` normalizes to the same trigger.
- Successful save-hook stdout is not forwarded to the agent. The lack of a
  `HOOK_INSTRUCTION` block alone cannot establish failure. Persistent event/run
  evidence is needed; manual traces must remain distinguishable.
- Both current matchers match a full Windows path to `lib/costing/decimal.ts`.
  The costing matcher also matches `tests/costing.test.ts` and does not match
  the basename `decimal.ts` alone. Its scope should be tightened after execution
  and the actual event path have been observed.

These are configuration/source observations, not a live hook-loading test.
The next controlled diagnostic is a `SessionStart` probe without a matcher,
followed by a `PostFileSave` probe without a matcher if loading is proven.
`docs/kiro-hook-follow-up.md` contains the focused Kiro prompt.

## Two review wording clarifications

The review's suggestion that the disposable log-browser test risks original
records is inaccurate: the documented script makes a disposable database clone,
uses isolated REST/gateway ports and removes its test environment afterwards.
Skipping a redundant browser rerun is reasonable; the original records do not
need to be put at risk to run it.

Seven-day bearer links are sufficient only for the current development flow.
The brief requires authenticated identity and revocable access in task 10A
before submission. The review's phrase "acceptable for the hackathon demo"
does not waive that milestone or certify complete project security.
