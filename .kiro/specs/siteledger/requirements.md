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
    The log shall display newest recording timestamps first without changing stored evidence.
11. When photo analysis is available, the system shall label findings as possible issues and allow human dismissal or confirmation.
12. While the web app is offline, the system shall preserve submissions in a visible queue and retry after reconnection.
13. When a project code is supplied, the system shall require granted access before accepting private records; public previews shall exclude live test records even on the demo project.
14. In task 10A, the system shall collect a confirmed professional name, verify browser identity and prove both accounts when linking Telegram, independently of Telegram display names.
15. When an owner invites a member, the system shall require a targeted, expiring, single-use invitation, atomically accepted by the verified intended identity with an owner-selected foreman/PM role.
16. When a person works on several projects, the system shall enforce each project's active membership and role independently on every action and record/media read.
17. When one person manages a small project, the owner/PM shall be able to submit, confirm and approve through separate explicit actions with truthful attribution.
18. When membership is removed, roles change or accounts unlink, the system shall revoke affected access and reject previously issued or forwarded links, including report, PDF and media access.
19. When an offline submission retries, the system shall preserve its original project/timezone and re-check access and archival; blocked retries shall retain the media and show a recoverable state.
20. When profiles, ownership or archival change, the system shall preserve locked names, quantities, currency, rates, evidence and amendments, and append server-attributed administration events.
21. Before task 10A passes, the system shall meet brief section 8's recovery, ownership, invitation, multi-project, solo-project, revocation, archival and currency acceptance scenarios.

Acceptance criteria and implementation order are in `.kiro/specs/siteledger/tasks.md`.
Features on the brief's cut list are excluded.
