# Hooks to configure in Kiro

This directory is tracked from day one. No hook execution is claimed yet.

Configure and verify these hooks in the installed Kiro version:

1. Run costing tests when files in `lib/costing/` change, after task 6 introduces the test command.
2. Run `npm run lint` when application code changes.
3. Warn before committing real `.env` files or ignore rules that exclude `.kiro`.
4. Remind the builder to update the README when completed functionality changes.

Commit the hook configurations that Kiro actually creates. Add dated outcomes and any failures to the build evidence rather than reconstructing them later.
