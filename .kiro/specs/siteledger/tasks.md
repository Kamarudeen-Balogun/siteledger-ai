# Build order

Source of truth: `PROJECT_BRIEF.md`, section 16. Complete one task and its acceptance criteria before starting the next. Commit using the specified message.

- [x] 1. Scaffold — local app runs; `.kiro` is committed and visible in the public repository. Commit: `Scaffold: app, brief, kiro skeleton`.
- [x] 2. Schema and seed — local Supabase and the summary API return the seeded demo with verified cumulative figures; the new hosted project was provisioned and checked through `supabase_siteledger` on 18 November 2026. Commit: `Data: schema and demo seed`.
- [x] 3. Telegram intake — on 18 November 2026, a real phone voice note was saved in hosted Supabase in 7.85 seconds, acknowledged by @SiteLedgerNGbot, and joined by four photos. Automated retry, grouping, private-access, and database-protection checks pass. Commit: `Telegram: voice and photo intake`.
- [x] 4. Transcription and extraction — on 18 November 2026, the final default Groq Whisper Turbo pipeline processed the builder’s real Telegram audio in a read-only check, preserving Pidgin and returning quantities 18/2, crews 6/4, 40 cement bags and a two-hour delay. Eighteen AI tests, existing Telegram/database checks, and build checks pass; live GonkaRouter extraction fallback was verified with a simulated Groq outage. Commit: `AI: transcription and extraction`.
- [x] 5. Confirm screen — private Telegram Mini App review, every extracted field editable, manual input for unclear values, and private photo display. On 18 November 2026, the builder confirmed the real note with blockwork corrected from 1 to 18 m²; original evidence stayed unchanged and no cost/report was created. After the builder's feedback, save status and unit explanations were improved and the Mini App menu added; the builder verified it opens inside Telegram and looks clear. Confirmation/API/database checks, mobile/desktop media checks, listening refresh, signed Mini App access, visible/persisted success, lint, TypeScript and build pass. Commit: `UI: human confirm screen`.
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

18 November 2026: the builder confirmed successful Kiro sign-in and submission of the credit request. Two builder-run Kiro reviews are saved in `task-4-review.md`; manual lint/type checks were recorded. The save hook exists, but execution was not observed. Credit approval and Crew execution are not yet confirmed.
