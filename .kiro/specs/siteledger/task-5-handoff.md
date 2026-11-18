# Task 5 — human confirmation

Task 4 is committed as `bfeeb1d AI: transcription and extraction`. Read `PROJECT_BRIEF.md` before task 5. Build only section 16 task 5: the editable confirmation screen, confidence highlighting, and existing photo display. Costing is task 6; photo analysis is task 9.

The builder explicitly requested asking for confirmation whenever information is unclear. That strengthens the brief's existing mandatory human-confirm rule rather than adding a separate chat feature.

## Behaviour to implement

- Show the unchanged raw transcript and preserved audio for reference.
- Let the human edit every extracted work field, material, delay, issue and language note. Keep the raw transcript and original AI extraction intact; store corrections as confirmed values.
- Present work items as a ruled BoQ-style table with an explicit human BoQ choice. Quantity, unit, crew, description, and the BoQ suggestion remain editable before confirmation.
- Leave missing quantities blank. Fields with confidence below 0.6 show amber “Check this one” and require manual input; higher confidence never makes a field uneditable.
- Display real attached photos. No findings are generated during this task. Any already supplied findings must remain possible suggestions that a human can dismiss.
- Handle listening/loading, empty, manual-entry failure, validation error, and network error states without losing edits or media. Pending media must block confirmation.
- Use paper background, warm ink, construction orange, ruled rows, 16px body text and at least 48px controls on a 390px phone layout.
- Record who confirmed and when. Confirmation must be one explicit human action. No cost, report generation, approval, or lock before it.

## Access decision and implementation

The builder approved a private link and then explicitly requested a Mini App menu after finding that URL buttons opened externally. New “Review site note” buttons now use Telegram's `web_app` field. The SiteLedger menu opens `/confirm`, loads Telegram’s SDK, and sends signed `initData` to the server. HMAC validation, duplicate-field rejection and a one-hour session age limit precede resolution of the linked reviewer’s note. No browser identity is trusted. Ngrok HTTPS works for testing; production deployment stays in task 13. Old messages retain their original URL buttons.

Seven-day signed bearer links bind the submission and linked Telegram reviewer. Foremen can review their own records; a linked project PM can review that project's records. The database resolves the author from the linked account. Link possession grants access, so do not share, log or commit the full URL. A fresh `/today` button uses `SITELEDGER_APP_URL`, the configured HTTPS application origin. Expired and invalid links reveal no private record. Media is served through the same authorized access boundary, never public bucket URLs.

The task 5 migration stores `confirmed_extraction`, BoQ choices, author and time separately from the original transcript/extraction. Pending media and queued/processing AI jobs block saves, and locked records cannot be changed. The form requires explicit quantities and matching project BoQ units. The API accepts no prices or caller-provided identity. Confirmation creates no cost, report or report item in this task.

The builder reported that successful confirmation lacked clear visual feedback and measurement units were unclear. The revised form brings a prominent saved message, author and timestamp into view, persists the message when reopened, and marks later edits as unconfirmed. A BoQ choice fills the unit; quantities show m²/m³ and plain area/volume explanations. Three review steps explain the next action. Review these refinements as part of task 5 rather than deferring the builder’s reported usability problems to task 12.

The revised browser checks verify visible/focused success after a real API save, unlocked correction, persisted confirmation on reload, clear m²/m³ measurement labels and simulated signed Mini App access through the real Telegram SDK. The menu and all three slash commands were configured and read back through the Bot API. The builder then verified on the phone that it opens inside Telegram and looks clear. Temporary QA data was removed again after these refinement checks. The task 5 Kiro review remains in progress; no hook execution or completed review is claimed yet.

Automated confirmation, API and local database checks pass. A 390px browser check typed the required low-confidence fields, saved through the real API, and corrected an unlocked test record. The loading-state check verified automatic refresh into editable extracted fields. Four real private photos and original audio load correctly; unsigned media access is denied and mobile/desktop layouts fit. Temporary QA records were removed. On 18 November 2026, the builder confirmed the real note with blockwork corrected from 1 to 18 m²; its original extraction still contains 1, and no cost, report or report item was created. The task 5 Kiro review is pending.

## Useful real test record

The builder's final recording was checked with the final default Whisper Turbo pipeline: 18 m² blockwork / six crew, 2 m³ concrete / four crew, 40 cement bags, two-hour rain delay, and a curing issue. The original earlier stored extraction misheard eighteen as 1 m² and was preserved. It is a useful real correction case for the confirm screen. Do not overwrite its raw transcript to make the demo look correct.

## Kiro review prompt

After implementation and the access decision, review task 5 against sections 4, 9, 12 and 16. Write findings to `.kiro/specs/siteledger/task-5-review.md` only. Check that all fields can be corrected, low-confidence values require input, raw evidence stays unchanged, private records are protected, and costing does not run before confirmation. Try the existing lint-on-save hook and record only execution that is actually observed. Do not modify application code or the historical task 4 review.
