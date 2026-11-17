# Build order

Source of truth: `PROJECT_BRIEF.md`, section 16. Complete one task and its acceptance criteria before starting the next. Commit using the specified message.

- [x] 1. Scaffold — local app runs; `.kiro` is committed and visible in the public repository. Commit: `Scaffold: app, brief, kiro skeleton`.
- [ ] 2. Schema and seed — dashboard query returns the demo project and cumulative figures. Commit: `Data: schema and demo seed`.
- [ ] 3. Telegram intake — a real phone voice note appears within 10 seconds. Commit: `Telegram: voice and photo intake`.
- [ ] 4. Transcription and extraction — demo voice note returns valid JSON matching spoken quantities. Commit: `AI: transcription and extraction`.
- [ ] 5. Confirm screen — extracted fields are editable; nothing costs before confirmation. Commit: `UI: human confirm screen`.
- [ ] 6. Costing engine — section 10 tests pass, including the red overrun flag. Commit: `Costing: engine with tests`.
- [ ] 7. Report and PDF — the seeded day's PDF prints as a client document. Commit: `Report: web view and PDF`.
- [ ] 8. Dispute log — locked report edits and deletion are blocked in the UI and API. Commit: `Log: append-only dispute log`.
- [ ] 9. Photo analysis — a possible finding can be dismissed by a human. Commit: `AI: photo findings`.
- [ ] 10. Web upload and offline queue — an offline submission sends after reconnection. Commit: `Web: upload and offline queue`.
- [ ] 11. Dashboard and price list — displayed figures match costing tests. Commit: `UI: dashboard and price list`.
- [ ] 12. UI polish — section 12 design and screen-state checks pass. Commit: `Design: site diary polish`.
- [ ] 13. Deploy — the full demo flow works on production over mobile data. Commit: `Ship: production deploy`.
- [ ] 14. README and Kiro write-up — a stranger can run the app; Kiro claims have real examples. Commit: `Docs: README and Kiro write-up`.

## Kiro evidence

This skeleton was prepared with Codex. Record actual Kiro reviews, hook runs, and Crew work as they happen; the presence of these files alone does not establish Kiro use.
