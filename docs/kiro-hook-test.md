# Kiro hook execution test — task 8 review

Date: 19 November 2026. Scope: verify that the lint-on-save and a new
costing-test-on-save hook are genuinely recognized and executed by Kiro, not
merely present as JSON. Application code and genuine records were not modified
except a temporary comment-only edit in `lib/costing/decimal.ts` (added during
the test and removed afterwards).

## 1. Recognized configuration

Both hooks were created through Kiro's supported tool, `tool::createHook`,
which writes `.kiro/hooks/<id>.json` in the v1 hook format. `createHook` accepted
both and wrote the files.

- `.kiro/hooks/lint-on-save.json` (recreated via `createHook`): trigger
  `PostFileSave`; matcher `\.(ts|tsx|md)$`; command `npm run lint` (`eslint .`).
  **No `--fix`** — reports only, never auto-fixes. Runs in the workspace root.
- `.kiro/hooks/costing-test-on-save.json` (new, via `createHook`): trigger
  `PostFileSave`; matcher `costing.*\.ts$`; command `npm run test:costing`.
  **Read-only** — `node:test` writes/fixes nothing.

Neither hook auto-fixes application code.

## 2. Configuration changes

- `lint-on-save.json` recreated through `createHook` (was hand-edited v1; now
  `createHook`-managed, same trigger/matcher/command, description preserved).
- `costing-test-on-save.json` added through `createHook`.
- A temporary `save-trace` probe hook was added during the test and removed
  afterwards (section 4c).
- All changes are `.kiro/hooks` configuration, not application code.

## 3. Recognition caveat

`createHook` returned "active on the next session start" for every hook. So a
hook created mid-session loads at the next session start. `createHook` accepting
a file proves Kiro's tooling recognizes the format; it does not prove the hook
is loaded, and it does not prove it fires. Only an observed side-effect proves
firing.

## 4. Test and observations

### 4a. Agent file-write (not an editor-save event)

A comment-only `//` line was added to `lib/costing/decimal.ts` via the agent's
file-write tool, then reverted. No `HOOK_INSTRUCTION` block appeared. The edit
was comment-only (no formula/validation/quantity/rate change); `lint`,
`typecheck` and `test:costing` still passed with it. This is consistent with
prior reviews but, per 4b, inconclusive.

### 4b. Why HOOK_INSTRUCTION cannot show PostFileSave

The builder performed a genuine editor save: opened `lib/costing/decimal.ts`,
added a comment-only line, and pressed Ctrl+S. No `HOOK_INSTRUCTION` block
appeared. This is expected, not evidence of failure: `createHook`'s exit-code
semantics forward command **stdout only for** `SessionStart`, `UserPromptSubmit`,
`PreTaskExec`, `PreCompact` and `PostCompact` — **`PostFileSave` is excluded**.
So a `PostFileSave` hook's stdout never reaches the agent, whether the save is
an agent write or a real Ctrl+S. The `HOOK_INSTRUCTION` channel cannot verify
`PostFileSave` execution. (This reframes the task-4–7 reviews: the absence of a
`HOOK_INSTRUCTION` on save was inconclusive all along.)

### 4c. Side-effect probe — result

To verify `PostFileSave` execution, a temporary probe hook `save-trace` was
added via `createHook`: trigger `PostFileSave`, matcher `costing.*\.ts$`
(matches `decimal.ts`), command
`node -e "const fs=require('fs');fs.appendFileSync('.kiro/hooks/.save-trace.log',new Date().toISOString()+'\n')"`
— appending an ISO timestamp to `.kiro/hooks/.save-trace.log` on each costing
`.ts` save (a file write the agent can read, unlike stdout).

The builder **restarted the Kiro session** (so the `createHook` hooks load at
session start), then opened `lib/costing/decimal.ts`, made a comment-only
change, and pressed Ctrl+S. **The trace file was not created by the save.**

The probe command was then run **by hand** in the workspace root: it created
`.kiro/hooks/.save-trace.log` with timestamp `2026-11-19T02:55:08.844Z`. So the
command is valid; the hook simply did not execute on the editor save.

### 4d. Conclusion

**`PostFileSave` hooks, as configured via `createHook`, did not execute on a
genuine editor save in this Kiro setup.** The configuration is recognized by
`createHook` (files written and accepted; the probe command works when run by
hand), but the IDE did not fire `PostFileSave` on Ctrl+S. Genuine hook
execution on save is therefore **not occurring** here. This is the verified
observation, not a guess; no execution evidence was invented.

Possible causes this test could not distinguish: (a) the hooks were not loaded
at session start despite `createHook`'s "next session start" message; (b)
`PostFileSave` is not supported or not triggered on save in this Kiro version;
(c) the matcher/file-path format did not match. A `SessionStart` probe (which
fires at session start and whose stdout **is** forwarded) would distinguish
"hooks not loaded at all" from "`PostFileSave` specifically not firing"; that
was not run.

## 5. Manual runs (kept separate from hook execution)

Run by hand from the workspace root, not by any hook:

- `npm run lint` — `eslint .`, exit 0, no output.
- `npm run typecheck` — `tsc --noEmit`, exit 0, no output.
- `npm run test:costing` — 21 pass / 0 fail.
- `npm run test:log` — 4 pass / 0 fail.
- `npm run db:check-log` — PASS (two NOTICE lines), then `ROLLBACK`, exit 0.
- `npm run db:check-telegram` — PASS (four NOTICE lines), then `ROLLBACK`, exit 0.
- The probe command run by hand created the trace file once
  (`2026-11-19T02:55:08.844Z`), proving the command itself works.

## 6. Remaining issues

1. **`PostFileSave` hooks do not fire on save in this setup** (verified via the
   probe). The configured lint and costing hooks are present and valid but are
   not executed by Kiro on save.
2. **Root cause undetermined.** Not-loaded vs `PostFileSave`-unsupported vs
   matcher mismatch. Optional next step: a `SessionStart` probe (one more
   restart) to test whether any hook loads/fires at session start.
3. **`PostFileSave` stdout is not forwarded to the agent**, so even if such a
   hook fired, its lint/test output would not reach the agent — only a
   file side-effect can confirm it.
4. **Costing matcher scope.** `costing.*\.ts$` matches `tests/costing.test.ts`
   too (broader than `lib/costing` only). Tighten if a strict scope is required.
5. **Cleanup done.** The `save-trace` probe and the trace file were removed;
   `lib/costing/decimal.ts` was reverted to its committed content. `lint-on-save.json`
   (recreated) and `costing-test-on-save.json` remain as the configured hooks.
