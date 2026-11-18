# SiteLedger requirements

Source of truth: `PROJECT_BRIEF.md`, sections 3–5 and 9–12.
Prepared during scaffolding; review and refine these requirements in Kiro.

1. When a foreman sends a voice note and up to five photos through Telegram or the web app, the system shall preserve the submission and its source.
2. When audio is transcribed, the system shall store the raw transcript unchanged and preserve Nigerian English and Pidgin site terms.
   Builder amendment, 18 November 2026: voice transcription shall automatically detect and support widely used languages offered by the chosen provider. Publish supported and site-tested coverage separately; Nigerian English and Pidgin remain mandatory demo tests.
3. When extraction succeeds, the system shall return the exact section 9 schema with confidence scores and no invented quantities or prices.
4. If extraction fails validation after one retry, the system shall preserve the audio and photos and offer manual entry.
5. Before costing or locking, the system shall require a human to confirm every work item and quantity.
6. If an extracted field has confidence below 0.6, the confirm screen shall highlight it and require manual entry.
7. When confirmed items are costed, the system shall use only the supplied BoQ rates and the section 10 formulas.
8. When a report is generated, the system shall provide a web view and an A4 client PDF containing the confirmed record and costs in naira.
9. When a report is approved, the system shall lock it and prevent subsequent updates or deletion.
10. When a correction to a locked report is needed, the system shall append an amendment linked to the original report, author, and timestamp.
11. When photo analysis is available, the system shall label findings as possible issues and allow human dismissal or confirmation.
12. While the web app is offline, the system shall preserve submissions in a visible queue and retry after reconnection.

Acceptance criteria and implementation order are in `.kiro/specs/siteledger/tasks.md`.
Features on the brief's cut list are excluded.
