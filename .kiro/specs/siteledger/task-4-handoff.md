# Task 4 — Kiro review handoff

Prepared with Codex on 18 November 2026. This prompt is a request for real Kiro
work, not a claim that Kiro has executed it. Paste the prompt below into Kiro's
chat with this project open.

```text
Read PROJECT_BRIEF.md, especially sections 7, 9, 14 and task 4 in section 16,
including the builder's multilingual amendment. Read the existing .kiro specs
and steering. Review task 4's requirements: multilingual voice transcription
with automatic language detection, an unchanged raw transcript, extraction into
the exact section 9 JSON schema, confidence scores, missing quantities as null,
one retry for invalid JSON, and preserved media on failure. Prices never come
from AI, and human confirmation/costing UI belongs to later tasks.

Codex is implementing the application code at the same time. You own only:
  .kiro/specs/siteledger/task-4-review.md
  .kiro/hooks/lint-on-save.json
Do not modify other files or undo Codex's work.

Create a real Kiro lint-on-save hook in the format supported by this IDE.
Use a command action running npm run lint (no auto-fix), triggered by saving
TypeScript or Markdown files. Create the hook before saving the review file so
the review save can exercise it. The installed IDE is Kiro 1.4.215; official
docs describe the standalone .kiro/hooks/*.json v1 schema with PostFileSave.

Write your review, any risks or corrections, and the precise hook-run outcome
in .kiro/specs/siteledger/task-4-review.md. Record only what actually happened;
if the hook did not run or lint failed, say so. Keep this to task 4 and suggest
no features from the cut list. Tell me when the review and hook check are done.
```

Official hook documentation: https://kiro.dev/docs/hooks/
