# Hooks to configure in Kiro

This directory is tracked from day one. Kiro recreated `lint-on-save.json` and added `costing-test-on-save.json` during the task 8 review. Both use the installed v1 JSON format and `PostFileSave`; automatic execution has not been proved. See [the recorded hook test](../../docs/kiro-hook-test.md) and [focused diagnostic](../../docs/kiro-hook-follow-up.md). A missing save-hook stdout block alone is inconclusive.

Configure and verify these hooks in the installed Kiro version:

1. Run costing tests when files in `lib/costing/` change, after task 6 introduces the test command.
2. Run `npm run lint` when application code changes.
3. Warn before committing real `.env` files or ignore rules that exclude `.kiro`.
4. Remind the builder to update the README when completed functionality changes.

Commit the hook configurations that Kiro actually creates. Add dated outcomes and any failures to the build evidence rather than reconstructing them later.
