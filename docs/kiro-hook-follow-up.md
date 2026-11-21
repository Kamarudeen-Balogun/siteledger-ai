# Focused Kiro hook diagnostic

Prepared by Codex on 21 November 2026 after reading the task 8 review and
`kiro-hook-test.md`. Task 8 has no application blocker. This prompt investigates
the remaining hook-loading/save-event issue without repeating the review.

Paste into Kiro:

```text
Read PROJECT_BRIEF.md section 14, docs/kiro-hook-test.md and
.kiro/specs/siteledger/task-8-resolutions.md. Diagnose the unproven hook execution.
Do not repeat the task 8 review or start another implementation task.

1. Confirm the active workspace is D:\SiteLedger AI and identify its Kiro version,
   trusted/enabled state and loaded hooks. The installed v1 JSON hook format and
   PostFileSave trigger are supported; do not guess a replacement schema or
   rename files to .kiro.hook. Use createHook or Kiro's supported hook UI.

2. Create a temporary SessionStart command hook WITHOUT a matcher. Have it emit
   a unique SiteLedger marker and UTC timestamp, and write a corresponding trace
   under the ignored supabase/.temp directory. Avoid recursive triggers and do
   not log secrets, private URLs or full session context. Preserve the original
   lint/costing hooks. Ask me to start a genuinely new Kiro session, then verify
   automatic execution from the marker and trace. Running the command manually
   may check syntax but cannot count as a hook run.

3. If SessionStart fails, inspect hook loading, enablement/trust, workspace scope
   and Kiro's hook logs. Record the concrete errors and stop repeating Ctrl+S
   tests until loading is understood. Do not infer that PostFileSave is unsupported.

4. If SessionStart works, create a temporary PostFileSave probe WITHOUT a matcher.
   Capture its timestamp and only the event/path fields needed for diagnosis.
   Start a fresh session if required. Have me add a comment-only line in the open
   lib/costing/decimal.ts editor and press Ctrl+S. Watch the actual hook activity
   and trace. A successful save hook's stdout does not reach the agent, so an
   absent HOOK_INSTRUCTION block is inconclusive.

5. If the save probe works, verify the lint and costing commands execute via
   their hooks, capturing command output, exit status and timestamp. Use the
   observed event path to restrict costing to lib/costing .ts files on Windows
   and Unix paths. Keep lint free of --fix. If execution is denied or fails,
   report the actual cause rather than changing settings broadly.

6. Restore only the temporary comment and remove only this test's probe hooks
   and trace artifacts after recording the evidence. Preserve original review
   files. Append dated results to docs/kiro-hook-test.md, distinguishing manual
   commands from automatic events and listing any unverified conclusions.

Do not alter prices, costing behavior, genuine records, credentials, account
permissions, previous review text or unrelated settings. Do not claim success
without observed automatic execution. Explain which step failed if unresolved.
```
