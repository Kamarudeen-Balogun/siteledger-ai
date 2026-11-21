# Task 10A1 — account resilience and action UI

Builder-requested maintenance before task 10B, implemented by Codex on
21 November 2026. Source: PROJECT_BRIEF.md section 16. No new Kiro review,
hook execution or Crew run is claimed.

## Telegram menu resolution

The default seven-command list was already saved, but an older
`all_private_chats` override contained only `/start`, `/today` and `/help`.
It hid the expanded list in private chats. The configuration script now
publishes and reads back all four default/private-chat and default-language/
English combinations. The live @SiteLedgerNGbot menu verification passed for
`/start`, `/account`, `/projects`, `/today`, `/reports`, `/help` and `/logout`.
The account Mini App menu button was also verified.

`setMyCommands` changes the same command settings as BotFather's
`/setcommands`; the builder does not need to set them manually. Individual
Telegram clients may need to reopen the chat to refresh cached suggestions.
No private user messages were sent and no webhook updates were dropped.

## Error pages and deliberate actions

- Shared paper/orange site-diary design for not-found, application and root
  application failures. Generic text preserves private error details. Links
  lead to authorized projects, account access and home.
- Error retry reloads the current GET page after reset. It does not resubmit a
  mutation; text tells users to check recent submission/approval status first.
- Native modal dialogs describe project creation, invitations, role/removal
  changes, ownership offers/acceptance, archive/restore, identity linking/
  unlinking, logout, password changes, permanent approval and amendments.
- Cancel receives initial focus; Escape cancels, native modal focus remains
  inside the dialog, and focus returns to its trigger. Cancellation and
  unmount resolve false. Only an explicit confirmation starts the existing
  authorized action. Passwords never appear in review details.
- Approval includes the report's project, date, recorded value and reviewer.
  Amendment review displays the exact note; cancellation preserves its text.

Server authorization, CAPTCHA enforcement, human confirmation, supplied rates
and immutable evidence protections are unchanged.

## Turnstile diagnosis and recovery

The widget now loads its SDK with guarded transport/render/removal, retries
after script failure, clears failed/expired tokens, and ignores callbacks from
an old widget. Async loading resolves from script `load`; it does not call
Cloudflare's incompatible non-async `ready()` API.

On the actual local and public account pages, Cloudflare returned `110200`:
the hostname is not authorized. The app displays that diagnosis with a Retry
button while sign-in remains disabled. The builder was asked to add
`chip-chaplain-tapeless.ngrok-free.dev`, `localhost` and `127.0.0.1` to the
widget's Hostname Management and save. The builder confirmed all three saved.
Subsequent real-widget checks on local/public pages no longer return `110200`
and show the challenge. Automated Chromium did not receive a response token
within 45 seconds. The builder then confirmed **Success appears and Sign in
is enabled** in their regular-browser check. This is builder-observed live
success; Codex's automated check establishes removal of the hostname failure.
No connected Cloudflare settings tool is available.

The public key is present and is not an official test key. Native production
CAPTCHA was never disabled or replaced with a test secret. Hosted Resend
delivery has not been exercised.

## Verification

- 95 existing unit/API tests pass after the final SDK loader correction.
- Production compilation and TypeScript build pass.
- Expanded disposable browser acceptance passes. It exercises initial Cancel
  focus, modal keyboard focus, Escape/Cancel with no archive mutation,
  returned trigger focus, one archive event after explicit confirmation,
  restore, approval cancellation, preserved amendment text, custom 404,
  private-error suppression and successful GET retry. Mocked domain failure
  blocks sign-in; retry obtains a fresh token and expiry blocks sign-in again.
- Final full lint and TypeScript checks pass.
- Previously inspected 390px artifacts show the archive dialog, custom 404
  and safe application error without horizontal overflow. Latest screenshots
  remain under ignored `supabase/.temp/task-10a/browser` and `turnstile`.

Browser fixtures use separate local GoTrue/SMTP, labelled data and a test
CAPTCHA secret only in disposable Auth. Mocked challenge failures verify
recovery and expiry behavior; they do not prove production challenge success.

Task 10A1 acceptance is complete; task 10B has not started. The unrelated `.kiro/hooks/sessionstart-probe.json`
remains untouched and excluded from this maintenance change.
