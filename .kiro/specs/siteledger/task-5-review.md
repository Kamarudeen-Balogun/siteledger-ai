# Task 5 review — human confirm screen

Scope: task 5 of `PROJECT_BRIEF.md` section 16, read against sections 4, 9, 12 and
16. Task 5 is the editable confirmation screen, confidence highlighting, and
existing photo display. Costing is task 6; photo analysis is task 9; locking the
dispute log is task 8.

## Review timing

The codebase was committed while this review ran. At session start the task 5
files were staged but uncommitted (`HEAD` at `bfeeb1d`, the task 4 commit), and
the first draft of this review was written against that snapshot. The builder
then committed task 5 as `f185f43 UI: human confirm screen` (observed in the
reflog) — a strictly larger change set than the snapshot, adding a Telegram
menu-button access path and refining `confirm-form.tsx`. This review was then
corrected to match the committed tree. All baseline checks below
(`npm run lint`, `npm run typecheck`, `npm run test:confirm`) were re-run on the
committed tree and pass.

Files reviewed (committed application code, written by Codex, not modified by
this review):

- `app/confirm/[id]/page.tsx` — server component that resolves a private review
  link into a `ReviewRecord`, gates on the signed token, and renders
  `ConfirmForm` (or a listening / empty / expired message).
- `app/confirm/page.tsx` + `components/telegram-review.tsx` — the Telegram
  menu-button landing page: loads the Mini App SDK, reads `WebApp.initData`, and
  posts it to `/api/confirm/access` to obtain a private review URL.
- `components/confirm-form.tsx` — the client form: editable BoQ-style table,
  confidence highlighting, photo display, loading / error / offline states, the
  single confirm action, and a `dirty`/saved banner. It renders
  `<TelegramFrame />`.
- `components/telegram-frame.tsx` — loads the Mini App SDK on the review page
  and calls `ready()` / `expand()` (presentation only; no auth read here).
- `lib/confirm/access.ts` — HMAC-signed seven-day bearer tokens
  (`createReviewToken` / `verifyReviewToken` / `reviewUrl`).
- `lib/confirm/telegram-access.ts` — `verifyTelegramAccess`: validates
  Telegram's signed `initData` with the bot token, checks `auth_date` freshness,
  rejects bots, and trusts only `initData` (never `initDataUnsafe` or a
  browser-supplied id).
- `lib/confirm/data.ts` — `getReview()` (token-gated, DB-resolved) and
  `readEvidence()` (authenticated storage fetch, path-validated).
- `lib/confirm/validation.ts` — `validateConfirmation()`: shape, quantities,
  matching BoQ units, photo notes; rejects caller-supplied money or identity.
- `app/api/confirm/[id]/route.ts` — the confirm POST: origin check, token
  verification, pending-media / locked / processing guards, validation, and the
  RPC call.
- `app/api/confirm/access/route.ts` — the menu-button POST: origin check,
  verifies `initData`, resolves the account's latest note, issues a review
  token, returns the private URL.
- `app/api/confirm/[id]/media/[mediaId]/route.ts` — token-gated media serving
  for audio and photos.
- `lib/telegram/webhook.ts` — the `/today` inline `Review site note` button
  with a pre-signed `web_app` URL.
- `scripts/configure-telegram-menu.mjs` — sets the bot's chat menu button to a
  `web_app` pointing at `/confirm`, plus `/start`, `/today`, `/help` commands.
- `supabase/migrations/20261118000300_human_confirmation.sql` — adds
  `confirmed_extraction`, `confirmed_boq_ids`, `confirmed_by`, `confirmed_at`;
  the `get_confirmation_record`, `confirm_site_submission`, and
  `latest_confirmation_submission` functions; revokes browser roles.
- `tests/confirm.test.ts` (5 tests) and `tests/confirm.sql` — the unit/API tests
  and the SQL database check.

This review owns only `.kiro/specs/siteledger/task-5-review.md`. No application
code and no part of the task 4 review is changed.

## Requirements check

1. **Unclear quantities force manual input.** Met. In the form,
   `low = (confidence) => !record.confirmed_extraction && confidence < 0.6`. The
   `Field` component blanks the value
   (`defaultValue={low ? "" : value ?? ""}`) and sets `required` when low, so a
   low-confidence field cannot be submitted empty. Quantity is treated as low
   when `low(confidence) || value.quantity === null`, so a missing quantity is
   always blanked and required even if the AI returned a high confidence. When
   low, the BoQ `<select>` and the unit field start empty, forcing an explicit
   human choice. The DB function rejects `jsonb_typeof(item->'quantity') <>
   'number'`, and `tests/confirm.sql` confirms a null quantity raises before
   any confirm is saved. The brief's "if a quantity is not stated, leave it null
   and set confidence low" is enforced upstream by `lowWhenMissing` in the
   extraction schema, and the confirm screen treats both signals as "must type."

   Subtlety: the amber flag fires only before the first confirmation. Once
   `confirmed_extraction` is set, `low` is always false, so a reviewer re-opening
   an unlocked record sees no amber even for items the AI originally flagged.
   This is defensible — the values are now human-confirmed, not AI guesses — and
   the confidence field stays editable so the score is still visible. Noted,
   not a defect.

2. **Every extracted field is editable; nothing is uneditable before locking.**
   Met. Work items (description, matched_boq_hint, quantity, unit, crew,
   confidence, BoQ choice), materials (name, quantity, unit, action,
   confidence), delays (reason, hours, confidence), issues, and language notes
   are all inputs / selects / textareas with add/remove controls. The whole
   fieldset is `disabled={locked || saving}` — `locked` only after the report
   is locked (task 8); until then everything is editable, matching "nothing is
   ever uneditable before locking." The form tracks `dirty` and lets a saved,
   unlocked record be edited again ("Confirm changes"), and the DB test
   confirms an unlocked confirmed record can be corrected a second time
   (`confirmed_extraction` updates to quantity 19) and that the PM's identity
   is recorded when a PM re-confirms.

3. **Private access; no public bucket URLs.** Met, across two entry points
   that both end at the same token-gated read. **Path A** (`/today` inline
   button): `webhook.ts` builds a pre-signed `web_app` URL via `reviewUrl()`,
   opening `/confirm/[id]?access=<token>` directly. **Path B** (chat menu
   button): `scripts/configure-telegram-menu.mjs` sets the bot's menu button to
   a `web_app` pointing at `/confirm`; that page (`telegram-review.tsx`) loads
   the Mini App SDK, reads `WebApp.initData`, and posts it to
   `/api/confirm/access`, which verifies the initData and redirects to
   `/confirm/[id]?access=<token>`. Both tokens are created by
   `createReviewToken(id, telegramId, secret)` — HMAC-signed with
   `TELEGRAM_WEBHOOK_SECRET`, binding the submission id and a telegram id,
   expiring in seven days, with the verifier rejecting far-future expiry.
   `verifyTelegramAccess` (Path B) validates Telegram's `initData` HMAC with
   the bot token, rejects `auth_date` outside roughly ±(30s / 1h), rejects bots,
   and trusts only `initData`, never `initDataUnsafe` or a caller-supplied id
   (the test asserts `{ init_data, telegram_id: 99 }` is rejected because the
   body must have exactly one key). The database resolves identity, not the
   caller: `get_confirmation_record` joins `telegram_users` on `project_id` and
   returns the row only when `submission.telegram_id = p_telegram_id or
   u.role = 'pm'`; `latest_confirmation_submission` likewise limits to the
   signed account's own or PM-project notes. So a foreman sees only their own
   notes and a linked PM sees their project's notes. The media route also calls
   `getReview(id, access)`, so audio and photos are served only through the
   authorized boundary; `readEvidence()` fetches the Supabase object via the
   authenticated storage endpoint (service-role key) and validates the path
   against `site-evidence/<uuid>/<uuid>/<digits>.(ogg|mp3|m4a|jpg)`. The
   functions are `revoke`d from `public, anon, authenticated` and granted only
   to `service_role`; `tests/confirm.sql` asserts the `anon` role raises
   `insufficient_privilege` and that another project foreman gets `null`. No
   public bucket URL is ever handed to the client.

   Residual: the access token is passed in the URL query string for media
   (`?access=…`), because `<img>` / `<audio>` src cannot set headers. A bearer
   token in a URL can surface in server access logs or browser history. This is
   mitigated by `Cache-Control: private, no-store` and `Referrer-Policy:
   no-referrer` on the media response, and the handoff already instructs not to
   share, log, or commit the full URL. Consistent with the documented decision;
   server-side log exposure on the media route is the one place the private
   link is weakest.

4. **Original evidence stays unchanged.** Met. The base schema makes
   `transcript` immutable by trigger (raising if an update changes a non-null
   transcript), and `confirm_site_submission` never writes `transcript` or
   `extraction`; it writes only `confirmed_extraction`, `confirmed_boq_ids`,
   `confirmed_by`, `confirmed_at`, `status`, and the denormalised `materials` /
   `delays` / `issues` columns. The full original AI extraction is preserved in
   the `extraction` jsonb column; the confirm screen seeds from
   `confirmed_extraction ?? extraction` so a re-open shows the human's confirmed
   values while the original is still queryable. `tests/confirm.sql` asserts
   that after confirm `transcript='We don set some blockwork.'` and
   `extraction=raw` (the original) while `confirmed_extraction=confirmed`. The
   builder's real note is the cited case: the original extraction misheard
   eighteen as 1 m², and that original is preserved; the confirm screen lets
   the human correct it to 18 without rewriting history.

   One nuance stated plainly: the denormalised `materials`, `delays`, `issues`
   columns on `submissions` are overwritten with the confirmed values on
   confirm. They are convenience copies; the authoritative original is the
   `extraction` jsonb, which is untouched. A future task that reads those
   denormalised columns after confirm reads confirmed values, and a task that
   needs the original must read `extraction`. Consistent with the brief
   ("corrections are stored as the confirmed values") — a future task should
   be deliberate about which column it reads.

5. **No costing, report, or lock before confirmation.** Met. The confirm POST
   sends only `{ p_id, p_telegram_id, p_values, p_boq_ids, p_photo_notes }` to
   `confirm_site_submission`; the API test asserts `p_transcript`, `p_price`,
   and `p_confirmed_by` are `undefined` in the RPC body, so a caller cannot
   supply a price or identity. `confirm_site_submission` resolves the author
   from `telegram_users`, sets `status = 'confirmed'` (not `locked`), and
   creates no `reports` or `report_items` row — its inline comment states so, and
   `tests/confirm.sql` counts `reports` and `report_items` before and after
   confirm and raises if either changed. Rates never reach the screen:
   `get_confirmation_record` builds the BoQ list as
   `{id, description, unit, section, item_code}` with no `rate` or
   `boq_quantity`, and `tests/confirm.sql` asserts the returned object has no
   `rate` key. Costing (the pure `costReport`, task 6) is not yet wired.
   Confirmation is one explicit human action — the single submit button is the
   only thing that calls the confirm API, and it is disabled while `saving`,
   `locked`, `pending_media`, or saved-and-not-dirty.

## Risks and observations

- **The handoff's access wording no longer matches the code (flag for the
  builder).** `task-5-handoff.md` says the review link is "an ordinary private
  web link, without a Telegram Mini App SDK or additional email sign-in." The
  committed code adds Path B, which loads `https://telegram.org/js/telegram-
  web-app.js` (the Telegram Web App SDK) in `telegram-review.tsx` and
  `telegram-frame.tsx`, and authenticates via `WebApp.initData`. So there is now
  a Mini App SDK path. There is still no email sign-in. The SDK use is
  legitimate (it is the standard way to open a web app inside Telegram and get
  server-verified user data, and `verifyTelegramAccess` is correct), but the
  handoff's "without a Telegram Mini App SDK" line is now inaccurate and should
  be updated to describe both entry points. This is a documentation drift, not
  a code defect; the brief, not the handoff, is the source of truth, and the
  brief does not forbid the SDK.
- **Amber highlighting is one-shot (see requirement 1).** After the first
  confirm, low-confidence items lose their amber cue on re-open. Acceptable for
  a human-verified record; flag only if a reviewer is expected to re-scrutinise
  confidence after confirm.
- **Unit field now derives from the BoQ choice (improved over the snapshot).**
  The committed `confirm-form.tsx` holds a controlled `unitValue` and, on BoQ
  select, sets it to the chosen item's unit, with `unitLabel` / `unitMeaning`
  helpers ("m2 = m² · m3 = m³", "Measure in m²: Square metres — area"). This
  removes the unit/BoQ redundancy noted in the earlier snapshot. The unit input
  stays editable, and validation still requires the typed unit to equal the
  chosen BoQ item's unit, so a hand-typed mismatch is still rejected with a
  clear message.
- **Confidence is human-editable.** The `Score` component (now labelled "AI
  confidence (0–1)") lets a human change the AI's confidence value. Consistent
  with "nothing uneditable before locking," and harmless to money because
  costing uses confirmed quantities and BoQ matches, not confidence. Noted for
  completeness.
- **Media token in URL (see requirement 3).** The 7-day bearer token appears in
  the media URL query string. Mitigated as above; the residual is server-side
  log exposure on the media route specifically.
- **Origin check assumes the header is present.** Both `/api/confirm/[id]` and
  `/api/confirm/access` reject any request whose `Origin` is not
  `SITELEDGER_APP_URL`. The app's own fetches always send `Origin`, so the
  legitimate flow passes; a browser that strips `Origin` would be rejected.
  Not a defect for the in-app flow.
- **Two confirmation banners when saved and clean.** When a note is saved and
  not dirty, both the top feedback block ("Site note confirmed") and the
  lower static line ("Site note confirmed. Your changes are saved.") render.
  Cosmetic repetition, not a functional issue.
- **External script on confirm pages.** `telegram-web-app.js` is loaded from
  `telegram.org` on both `/confirm` and `/confirm/[id]`. It is the official,
  small Telegram script and is needed for the in-Telegram presentation; it adds
  a little client JavaScript, mildly against the "keep phone-side JavaScript
  small" steering, but an acceptable trade-off for the in-Telegram UX.
- **Code is committed.** Task 5 is committed as `f185f43 UI: human confirm
  screen`, matching the task 5 acceptance commit message. At session start it
  was uncommitted (`HEAD` at `bfeeb1d`); the builder committed it during the
  review (reflog: `commit: UI: human confirm screen`). The "uncommitted" risk
  from the first draft is resolved.

## Out of scope

No cut-list features suggested. Costing, the report / PDF, the dispute log lock,
photo analysis, the offline queue, the dashboard, and deployment are tasks
6–13 and are not reviewed here. The task 4 review is unchanged.

## Lint-on-save hook

The hook at `.kiro/hooks/lint-on-save.json` is unchanged: schema `v1`, one
hook, trigger `PostFileSave`, matcher `\.(ts|tsx|md)$`, action
`command: npm run lint` (no `--fix`). It matches this review file (`.md`).

Baseline on the committed tree (`f185f43`): `npm run lint` (`eslint .`) exits 0
with no output, `npm run typecheck` (`tsc --noEmit`) exits 0, and
`npm run test:confirm` runs 5 tests, all pass. So if the hook fires, its command
should report clean.

### What was done this session

This review file was saved through the agent's file-write tool to exercise the
hook — a `.md` save that matches the hook matcher. It was saved more than once
during the session (initial write, an edit, and a rewrite after the mid-review
commit), each a `.md` save matching the matcher. The hook pre-existed this
session, so it is loaded at session start rather than created mid-session.

### What actually happened

Every save produced only the single file-write confirmation line — no
`HOOK_INSTRUCTION` block appeared on any of them. This matches the outcome the
task 4 review recorded for the same hook. The most likely reason is the same:
the agent's file-write tool does not raise the IDE's `PostFileSave` event;
that event is raised when a file is saved through the editor (Ctrl+S in an open
file), which an agent save does not perform. The hook is correctly configured
and is present from session start, so it should fire on a real editor save —
but an agent-initiated write is not that event.

One ambiguity that cannot be fully resolved within this task's single-file
constraint: the hook command is `npm run lint` (`eslint .`), which exits 0 with
no stdout on this clean tree (verified independently before the saves). If Kiro
emits a `HOOK_INSTRUCTION` block only when a hook command produces output, a
clean run would look identical to a non-run. This cannot be distinguished here
because `eslint .` lints the TypeScript / JavaScript tree and this task allows
editing only this `.md` file, which the linter does not read. Either way the
practical result is the same: saving this file through the agent did not
surface any lint output, and on this clean tree there is no lint output to
surface.

Recorded state: hook configured and valid, loaded from session start, not
observed to fire on an agent save across multiple writes. It should be
re-observed on a genuine editor save (the builder saving the file by hand in
the IDE) and recorded in the build evidence then — the same open item the task
4 review left.
