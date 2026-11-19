# SiteLedger AI

SiteLedger turns a foreman's voice note and site photos into a human-confirmed daily report, costed in naira against a Bill of Quantities. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the specification and ordered build tasks.

## Current state

The builder approved an additional pre-submission milestone on 18 November 2026: finish the core report flow, then add email/password browser access, recovery, linked Telegram identity and private project creation/selection/archive in task 10A. Projects will select a currency and use BoQ rates supplied in that currency; the demo stays NGN, without exchange-rate conversion. Existing reports retain their original currency. Per-project dashboards and analysis follow in task 11, with totals kept separate for different currencies. These capabilities are planned and not yet implemented.

The foundation is a Next.js App Router application with TypeScript, Tailwind CSS, a site-diary placeholder, and tracked `.kiro` preparation files. Task 2 adds the eight database tables, protected record snapshots, the fictional demo history, and a read-only demo summary query. Task 3 implements Telegram account linking and private voice/photo storage, with retry protection and WAT daily grouping.

Task 4 implements server-side transcription and extraction and passes its real-voice acceptance check. The costing engine only ever runs on confirmed values. The builder's 18 November amendments add multilingual voice input, automatic language detection, and bounded free-provider fallback; [language coverage](docs/voice-languages.md) distinguishes model vocabulary from tested recordings.

Task 5 adds the private mobile confirmation screen. Work items, materials, delays, issues, language notes and photo observations are editable. Missing quantities and low-confidence fields require human input. Corrections are stored separately from the unchanged transcript and original extraction; no cost or report is created by this task. On 18 November 2026, the builder corrected the real note's blockwork quantity from 1 to 18 m² and confirmed it through the web screen.

Task 6 adds the pure `costReport(items, priceList)` engine with 21 tests. It calculates exact costs, cumulative quantities, completion, earned value, planned variance, overruns and crew productivity. Money uses decimal arithmetic and returns decimal strings; only the NGN display formatter rounds to the nearest ₦10. A read-only check of the builder's saved confirmation matches PostgreSQL: 18 m² blockwork costs ₦261,000 and 2 m³ concrete costs ₦290,000, totalling ₦551,000.

Task 7 adds private daily reports and server-generated A4 PDFs headed **Perkins Limited**, the builder's chosen firm name. **Confirm and cost it** saves the human confirmation, costs it against the BoQ and opens a draft report. The document includes weather, work, progress, red variance, materials, delays, issues, attached photos and signature blocks. The builder's confirmed note now has a verified ₦551,000 draft and PDF; original evidence and locked history were preserved.

Task 8 adds PM approval, immutable locked reports, append-only amendment notes and private timestamp-ordered dispute logs. The PM must review the current draft and acknowledge locking. Changed drafts cannot be approved through an old view. Amendments retain the original report and resolve the author from the linked account; retries do not duplicate approval or amendments. The builder's separate **Kamarudeen Balogun** Telegram account was assigned PM with their authorization; the original account remains foreman. A read-only live check verified both interfaces and preserved the real draft for the builder's own approval.

The planned project **4-Bedroom Duplex, Lekki Phase 1, Lagos** and its client and report history are fictional demo data. Rates in the brief are illustrative demo rates, not live market prices.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```sh
git clone https://github.com/Kamarudeen-Balogun/siteledger-ai.git
cd siteledger-ai
npm ci
npm run dev
```

Open <http://localhost:3000>. The placeholder runs without credentials; the demo summary endpoint needs a configured database.

Before implementing integrations, copy `.env.example` to `.env.local` and fill the relevant values locally. Real `.env` files must not be committed.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

```sh
npm run test:costing
```

The costing tests were written and run before the engine existed, then passed after implementation. See [the task 6 handoff](.kiro/specs/siteledger/task-6-handoff.md) for the input contract and validation evidence.

## Database setup

SiteLedger uses its own Supabase project. An MCP connection to another account is not used to provision or migrate this project. Local development does not consume a hosted project slot.

The local project ID is `siteledger-ai`. API and Postgres use ports **55421** and **55422** so the stack can coexist with other projects. Install Docker and Supabase CLI, then:

```sh
supabase start --exclude "analytics,edge-runtime,functions,imgproxy,inbucket,meta,realtime,studio,vector"
node scripts/configure-local-env.mjs
npm run db:check
```

Initial startup applies the files in `supabase/migrations/` and `supabase/seed/demo.sql`. The seed preserves an existing demo rather than modifying locked history. The checks run only inside `supabase_db_siteledger-ai` and roll back their test changes. If this local stack was started with Storage excluded, stop and restart only the SiteLedger stack with the command above to enable media storage. Apply outstanding migrations to an existing stack before testing.

If a pre-existing CLI profile causes `Unsupported Config Type`, isolate the CLI state in the current PowerShell session:

```powershell
$env:SUPABASE_HOME = Join-Path $PWD 'supabase/.temp/cli-home'
$env:SUPABASE_PROFILE = 'supabase'
```

The local environment helper reads only SiteLedger's local stack and creates `.env.local` without printing credentials. It preserves an existing file, so if you already have one, fill its three Supabase fields yourself. Leave AI and Telegram variables empty until their tasks. `node scripts/configure-local-env.mjs --serve` starts a local-only production preview on port 3010 after `npm run build`, even if the existing environment file contains hosted credentials.

For the builder's new hosted account, create a fresh SiteLedger project and use that project's credentials. Apply the migration first and the seed second through its SQL editor or a CLI explicitly linked to that project. Do not reset or migrate another project's database.

### Project-specific Codex MCP

This workspace's [.codex/config.toml](.codex/config.toml) enables `supabase_siteledger`, scoped to the new SiteLedger development project `tfpxfxzawcjqjwrchlky`. It disables the unrelated user-level `supabase` and `supabase_portfolio` connections for this workspace. Other workspaces retain their own settings. Codex loads project configuration only for trusted folders; the CLI and IDE extension share these configuration layers.

On 18 November 2026, Codex confirmed successful OAuth login after the builder authorized the new Supabase account. Credentials are kept by Codex, outside the repository. Reload the VS Code window after changing MCP configuration so the editor loads the new tools. Reauthenticate on another computer with `codex mcp login supabase_siteledger` from this trusted project folder.

On 18 November, the schema, seed, and task 3 migration were applied through `supabase_siteledger`. The hosted query returns the 12 seeded locked reports and their cumulative figures. `node scripts/prepare-hosted-setup.mjs` prepares one transaction in the ignored `supabase/.temp/hosted-setup.sql` for another fresh database; it does not execute SQL. Use individual outstanding migrations for an existing database. `node scripts/verify-setup.mjs` checks the configured database and `@SiteLedgerNGbot` without printing credentials; a missing schema or seed fails the check.

Configuration references: [Codex project configuration](https://developers.openai.com/codex/config-basic/) and [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp).

### Demo summary

`GET /api/projects/LEKKI-DEMO-01/summary` returns the demo project's contract sum, stored cumulative cost, report count, amendment count, and BoQ progress. Only projects marked `is_demo` are exposed by this endpoint. Database reads use the service-role key on the server; browser roles cannot access the tables directly. Missing configuration or a database outage returns a plain 503 response.

The seed includes 12 approved reports dated 3–16 November 2026, 168 / 420 m² of 225mm blockwork, one rain delay, one defect follow-up amendment, and an excavation overrun. Stored costs capture the BoQ rate at confirmation; later rate edits preserve locked history. The summary aggregates stored records; it is not the task 6 costing engine or the task 11 dashboard.

No site photo or audio assets are fabricated. Telegram media is stored privately; photo analysis comes in task 9.

Task 2 validation: migrations and seed pass on PostgreSQL 17; `npm run db:check` verifies confirmation, snapshots, locked records, amendments, BoQ matching, totals, and database access. The live local Next.js endpoint returns the expected seed figures, hides existing non-demo projects, rejects invalid codes, and returns a plain 503 during an API outage before recovering on reconnection. The new hosted project returns the same seeded cumulative figures.

### Telegram intake — task 3

The bot is [@SiteLedgerNGbot](https://t.me/SiteLedgerNGbot?start=LEKKI-DEMO-01). Open the project link and tap **Start**, then send a voice note and 1–5 photos. `/help` describes intake; `/today` reports whether a site note is saved at this build stage. Other text and photo captions are preserved as notes. Reports and costed summaries follow the later tasks.

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in the ignored `.env.local`. The webhook secret must contain 1–256 letters, digits, underscores, or hyphens. Run the app on an HTTPS origin (a temporary tunnel works during development), then register the webhook:

```sh
npm run telegram:set-webhook -- https://your-app-origin
npm run setup:verify
npm run test:telegram
npm run db:check-telegram
```

The setup command checks the bot identity and the route's rejection of unsigned requests, sets `https://your-app-origin/api/telegram/webhook`, preserves pending Telegram updates, and limits delivery concurrency to one. It never prints the token or secret. A temporary tunnel requires the local server and tunnel to remain running; production hosting is task 13.

The webhook checks `X-Telegram-Bot-Api-Secret-Token` before database access. Each original private-chat update reserves a server-only receipt and deterministic media path. Failed saves return 503 so Telegram retries; replay does not create duplicate evidence. A failed acknowledgement can retry after the evidence is saved. Telegram does not support idempotent `sendMessage`, so a reply may repeat if the process stops after sending but before recording acknowledgement.

The private `site-evidence` bucket holds media. Database references contain `site-evidence/<path>`, rather than public or expiring signed URLs. Pick the largest Telegram photo rendition below 1 MB; voice downloads are limited to 20 MB. Photos sent before voice join the open submission for that user/project/WAT day. An additional voice note creates a new submission and preserves the earlier audio. Pending media blocks confirmation; task 4 allows extraction while photos arrive and lets photos attach to received or extracted submissions. Confirmed and locked evidence is never reused for intake.

Task 3 validation: eight handler/provider checks, database checks for onboarding, replay/leases, photos-first grouping, five-photo limits, pending evidence, additional audio, and private access, plus the task 2 protection suite, lint, TypeScript, and production build. On 18 November 2026, the builder's real-phone voice note was saved in hosted Supabase in **7.85 seconds** from Telegram's sent timestamp; the bot acknowledged it and four photos attached to the same submission. The stored voice retrieves with server credentials and is blocked through the public download endpoint. Replaying that completed update returns 200 and preserves its original submission/audio.

Scaffold validation: lint, TypeScript, production build, and local HTTP checks pass. The production dependency audit is clean. The full development audit currently reports [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) in `picomatch` through lint tooling; the latest published version, 4.0.7, is affected. Recheck when a patched release is available.

## Transcription and extraction — task 4

Task 4 voice processing uses Groq Free-plan `whisper-large-v3-turbo` and `openai/gpt-oss-120b`. With all three keys configured, Gemini Free-tier audio is the transcription alternate and GonkaRouter `zai-org/GLM-5.3-Flash` is the extraction alternate. Missing keys are skipped. Only the first two configured extraction providers are used: Groq, GonkaRouter, then Gemini. GonkaRouter supplies 1 million starter tokens, consumed before any paid balance; it is not an unlimited free plan. Use Free-tier/starter accounts without top-ups. The application does not configure billing upgrades or automatic top-ups.

Set `GROQ_API_KEY` in `.env.local`; optional alternates use `GEMINI_API_KEY` and `GONKAROUTER_API_KEY`. Restart the server after changes. Create keys at [Groq](https://console.groq.com/keys), [Google AI Studio](https://aistudio.google.com/api-keys), or [GonkaRouter](https://gonkarouter.io/dashboard). Free quotas can change and provider outages are handled as failures. [GonkaRouter pricing](https://gonkarouter.io/pricing), [Groq free limits](https://console.groq.com/docs/rate-limits), and [Groq structured outputs](https://console.groq.com/docs/structured-outputs) were checked on 18 November 2026.

The audio-save trigger creates a private durable job. The webhook schedules processing after acknowledging the saved note. `transcribeAndExtract()` preserves the unchanged provider transcript before extraction, strips prices from BoQ hints, validates the exact section 9 schema, and makes at most two transcription requests and two extraction generations. Invalid JSON gets one retry; a configured alternate is used for that second generation. Quota, timeout, invalid-output, and provider failures ultimately leave a private `manual_entry` result with media preserved. The manual-entry screen is task 5. Persistence failures release the job to `queued` and reuse the saved transcript on recovery. No result confirms quantities, runs costing, or creates a report.

```sh
npm run test:ai
npm run db:check-ai
npm run ai:process
```

The processing script can also take a specific queued submission UUID. It processes up to ten jobs and exits nonzero if a job remains queued or falls into manual entry. A failed/manual job is not automatically retried forever. New photos and notes can attach until confirmation; pending media still blocks confirmation and locking.

Task 4 acceptance on 18 November 2026: the final default Groq Whisper Turbo pipeline processed the builder’s real Telegram recording in a read-only recheck and returned 18 m² blockwork / six crew, 2 m³ concrete / four crew, 40 cement bags, a two-hour rain delay, and the curing issue. Pidgin `don` was preserved and English was detected. A live ambiguous-quantity test returned null with confidence below 0.6. A simulated Groq outage reached the real GonkaRouter extraction endpoint and returned the expected quantities. Eighteen AI tests, eight Telegram tests, local database checks, lint, TypeScript, and production build pass.

The earlier saved transcript from that submission was produced by the original Whisper model and misheard eighteen; its original extraction contains 1 m². The acceptance recheck does not overwrite that evidence. Task 5 must let the human correct that existing record. Future notes use Turbo. This is a tested demo recording, not a guarantee of accuracy across all speech or languages.

## Human confirmation (task 5)

Apply `supabase/migrations/20261118000300_human_confirmation.sql` after the earlier migrations. Set `SITELEDGER_APP_URL` in `.env.local` to the exact HTTPS application origin, without a trailing slash or path. During local phone testing, point ngrok at the Next.js port and use its HTTPS origin for both this setting and the Telegram webhook. Restart Next.js when changing environment variables. Use the production origin when deploying in task 13.

Run `npm run telegram:configure-menu` after starting the HTTPS app. It verifies @SiteLedgerNGbot, sets `/start`, `/today` and `/help`, and installs a **SiteLedger** Mini App menu button. Open that menu or send `/today` and tap a new **Review site note** button. Earlier bot messages retain their old external URL buttons.

The menu uses Telegram’s Web App SDK and sends signed `initData` to the server. The server verifies its HMAC and age before resolving the linked reviewer’s latest note; browser-supplied user IDs are not trusted. Ngrok HTTPS supports local Mini App testing; Vercel remains the later production deployment task. If ngrok displays its free browser notice, tap Visit Site.

The note’s seven-day signed review link grants access to its holder. Keep full review URLs out of logs, screenshots and Git, and request a fresh button when a link expires. Foremen review their own notes; linked PMs may review notes on their project. The server resolves who confirmed from the linked Telegram account, and private audio/photos require the same valid review link.

Listen to the original audio, choose each work item's BoQ entry, enter the quantities and matching units, review the attached photos, then tap **Confirm and cost it**. Selecting a BoQ item fills its unit, displayed beside the quantity and explained as area, volume, weight, points or days. Units `m²`/`m³` are normalized to BoQ units `m2`/`m3`. Unknown quantities stay blank instead of being estimated. Confirmation remains visible when reopening; task 7 now opens the generated draft report after saving. Later edits are marked **Changes not yet confirmed**. Network errors keep current edits on the page; queued AI and pending photo uploads block confirmation. Confirmed values remain correctable until a later task locks the report. Keep the page open if disconnected; persistent offline submission storage is task 10.

```sh
npm run test:confirm
npm run db:check-confirm
```

Confirmation checks cover token expiry/tampering, authorization, required quantities, BoQ units, immutable raw evidence, pending jobs/media, server-resolved authors, and absence of new costs/reports. A mobile browser check at 390px saved an isolated test fixture through the API and corrected it again before locking. A waiting page refreshes into extracted fields automatically. Four real private photos and audio load; unsigned media requests are denied and mobile/desktop layouts fit. Temporary QA records were removed. These checks do not silently confirm the builder's real records.

After the builder reported unclear save feedback and units, browser checks verified the revised visible success state and simulated signed menu access through the real Telegram SDK. The builder then confirmed that the Mini App opens inside Telegram and looks clear. Five confirmation/security tests, the Telegram tests, local database checks, lint, TypeScript and production build pass. The completed task 5 Kiro review and its follow-up are linked below.

## Daily reports and PDF (task 7)

Apply `supabase/migrations/20261118000400_daily_reports.sql` after the earlier migrations. It adds captured report documents and server-only read/save functions; the migration has been applied to SiteLedger's local and hosted databases. Requests use the same private review access as confirmation. The route `/reports/<submission-id>` opens that note's report, whose persisted report UUID appears inside the document. Keep private URLs out of logs and Git.

After confirmation, open **Download PDF**. **Correct site note** lets you change confirmed work before approval and rebuild the same draft, preserving its weather. Weather can also be recorded or cleared through **Change weather or rebuild this draft**. A changed confirmation or BoQ makes the draft stale and blocks PDF export until it is rebuilt. Retry-safe saves do not create duplicate reports. Exact costs are stored, and caller-supplied rates, totals and identities are rejected. Draft generation does not approve or lock a report.

The public `/reports/demo` preview and `/api/reports/demo/pdf` export expose only the original fictional seeded report dated 6 November 2026. They never include real Telegram notes or their private media, even when those notes belong to the demo project. Legacy locked reports use captured rates; exporting does not update them. The bundled Public Sans and Source Serif fonts, with their licenses in `public/fonts/`, support the naira glyph without remote font downloads.

```sh
npm run test:reports
npm run db:check-reports
```

For the isolated production browser check, run `npm run build`, then `node scripts/configure-local-env.mjs --serve --report-preview` in one terminal and `npm run test:report-browser` in another. This uses the local SiteLedger database on port 55421 and a local-only review secret without changing `.env.local`. Avoid rebuilding while this preview is serving; restart it after a build. The browser check creates and removes its own temporary draft fixture.

Verification covers 61 automated tests across intake, AI, confirmation, costing, reports and the mobile browser flow, plus five local SQL suites, lint, TypeScript and the production build. The final demo PDF was visually checked on both A4 pages, with footer/page numbers, signature blocks, naira figures and red overrun. The builder's confirmed draft exports the exact ₦551,000 total. Its note has no attached photos: the four photos remain on the earlier unconfirmed note. The actual renderer included all four in a clearly labelled local PDF fixture without moving them, confirming that note or inventing findings. See [task 7 evidence and Kiro review prompt](.kiro/specs/siteledger/task-7-handoff.md).

## Approval and dispute log (task 8)

Apply `supabase/migrations/20261119000100_dispute_log.sql` and `20261119000200_pm_review_navigation.sql` after the report migration. Both have been applied to SiteLedger's local and scoped hosted databases. Existing locked reports, original transcripts, extractions, photos and amendment contents remain unchanged.

In the PM Telegram account, open the **SiteLedger** Mini App menu. PM navigation prioritizes pending drafts across dates, then today's notes, and otherwise allows reopening the latest existing report. This makes a prior-day draft reviewable and its locked dispute log reachable. Foreman navigation keeps its existing today-only behavior. The same project/role checks protect every private read.

Open **Open costed report**, review the document, tick the acknowledgement and choose **Approve and lock report**. The server verifies the reviewed document version and rechecks the confirmation, BoQ, pending evidence and locked history under database locks. Approval stores the server-resolved PM name and lock time, and existing triggers lock the source evidence atomically. A retry retains the original approval and timestamp. The web/PDF stamp shows the lock date in WAT, even for a prior-day report. Foremen cannot approve.

Locked reports show **Add an amendment** and **Dispute log**. A correction is a new note linked to the original, with its author and timestamp; it does not rewrite quantities, totals or the original PDF. Amendment timestamps are recorded after the report lock even when a request waits on approval. Reusing the same request ID/text returns the existing amendment; changing the text for that ID is rejected. Neither reports nor amendments have edit/delete actions. APIs and database triggers also enforce the protection.

Private logs show a foreman's own locked records or the linked PM's project records. Links to earlier reports retain the original review link's expiry. The public `/log/demo` contains only the 12 original fictional seeded reports and their original amendment, excluding real Telegram work and new private corrections.

```sh
npm run test:log
npm run db:check-log
npm run build
npx playwright install chromium
npm run test:log-browser
```

The last command starts a disposable database clone, a private test REST server/gateway and a production preview on port 3012; ports 55423 and 55424 must be free. It requires SiteLedger's local Docker/Supabase stack. It never changes `.env.local` or writes browser fixtures into the original local/hosted application databases. Its locked QA records disappear with the disposable database, without disabling the application guards. It removes the temporary API, gateway and database when finished. PDFs/screenshots remain ignored under `supabase/.temp/task-8/`.

Task 8 verification totals **66 automated tests**: 64 unit/API tests and both report/log browser tests, plus six transactional SQL suites, lint, TypeScript and the production build. The browser check covers foreman-to-PM handoff, prior-day PM navigation, approval, a locked PDF, absent edit/rebuild controls, blocked API methods, amendments, retry conflicts, unchanged original documents, denied stranger access and mobile/desktop logs. The locked A4 PDF was visually checked. A live read-only check verified the builder's PM/foreman screens, ₦551,000 draft and configured HTTPS phone-test origin. No real report was approved by the agent. See [task 8 evidence and Kiro review prompt](.kiro/specs/siteledger/task-8-handoff.md).

## Project structure

```text
.kiro/
  specs/siteledger/     requirements, design, ordered tasks
  steering/            product, technical, and costing rules
  hooks/               hook setup notes
  agents/              four prepared Crew role specifications
app/                   Next.js routes and base styles
components/            shared interface components
lib/
  ai/                  server AI functions
  confirm/             private review access, validation and evidence reads
  costing/             pure costing function and types
  reports/             verified report sources, snapshots and private draft creation
  log/                 PM approval, append-only amendments and private dispute-log access
  telegram/            intake handlers
  pdf/                 report template
supabase/
  migrations/          database schema
  seed/                demo records and BoQ
tests/                 intake, AI, confirmation, costing, reports and database checks
public/                demo assets
```

Empty implementation directories are tracked with `.gitkeep` files.

## Architecture and rules

The planned stack uses Supabase Postgres and Storage, a Next.js Telegram webhook, server-side transcription and vision, and server-generated PDFs. All AI requests go through `transcribeAndExtract()` or `analysePhoto()`. All calculations go through the pure `costReport(items, priceList)` function, with rates supplied by the BoQ.

Human confirmation precedes costing and locking. Locked records cannot be edited or deleted; corrections are appended as amendments. Follow section 16 one task at a time and exclude features on the cut list.

## Kiro build evidence

The requirements, design, steering, task list, hook notes, and four agent role specifications were prepared with Codex. They are preparation for Kiro use, not evidence of executed Kiro hooks or Crew work. On 18 November 2026, the builder confirmed successful Kiro sign-in and submission of the credit request. Credit approval has not been confirmed. The builder has since completed two real Kiro task 4 reviews; [the saved review](.kiro/specs/siteledger/task-4-review.md) records Gemini-era findings and manual lint/type checks. The completed [task 5 review](.kiro/specs/siteledger/task-5-review.md) covers the committed confirmation screen and reports all five requirement checks met. Codex read it and recorded [the follow-up](.kiro/specs/siteledger/task-5-resolutions.md). Its lint hook exists, but execution during agent saves was not observed. The final Groq/GonkaRouter changes and task 6 costing engine were written by Codex; those changes are not covered by the historical reviews. Crew execution and hook-run evidence remain later work.

Open this folder in Kiro, review the specifications there, and configure hooks using the installed version. Record real examples and commits as Voice, Vision, Costing, and Safety work happens. MCP integration and the full Kiro write-up are later work. `.kiro` must remain tracked.

On 19 November 2026, the builder completed Kiro reviews of [task 6](.kiro/specs/siteledger/task-6-review.md) and [task 7](.kiro/specs/siteledger/task-7-review.md). Every requirement check was met and no blocking defect was reported. Kiro's manual costing/report/SQL/lint/type checks passed. [Codex's follow-up](.kiro/specs/siteledger/task-6-7-resolutions.md) clarifies review wording and records the future dashboard/currency observations. Neither review's agent save surfaced hook execution; an actual editor save and hook output remain unverified. These reviews are evidence of Kiro use, while Crew execution remains unobserved.

## Schedule

The brief's submission target is **3 December 2026 (Thursday)**; its deadline is **4 December 2026 (Friday), 23:00 WAT**. Some weekday labels in the brief differ from the 2026 calendar; the original brief has been preserved. Check official competition resources before relying on the stated credit-request terms.
