# SiteLedger AI

SiteLedger turns a foreman's voice note and site photos into a human-confirmed daily report, costed in naira against a Bill of Quantities. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the specification and ordered build tasks.

## Current state

The foundation is a Next.js App Router application with TypeScript, Tailwind CSS, a site-diary placeholder, and tracked `.kiro` preparation files. Task 2 adds the eight database tables, protected record snapshots, the fictional demo history, and a read-only demo summary query. Task 3 implements Telegram account linking and private voice/photo storage, with retry protection and WAT daily grouping.

Task 4 implements server-side transcription and extraction and passes its real-voice acceptance check. The costing engine, report/PDF screens, and the approval/amendment UI are later tasks. The costing engine will only ever run on confirmed values. The builder's 18 November amendments add multilingual voice input, automatic language detection, and bounded free-provider fallback; [language coverage](docs/voice-languages.md) distinguishes model vocabulary from tested recordings.

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

Costing tests will be introduced before the engine at task 6.

## Database setup

SiteLedger uses its own Supabase project. An MCP connection to another account is not used to provision or migrate this project. Local development does not consume a hosted project slot.

The local project ID is `siteledger-ai`. API and Postgres use ports **55421** and **55422** so the stack can coexist with other projects. Install Docker and Supabase CLI, then:

```sh
supabase start --exclude edge-runtime,imgproxy,mailpit,postgres-meta,realtime,studio,supavisor,logflare,vector
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
  costing/             pure costing function and types
  telegram/            intake handlers
  pdf/                 report template
supabase/
  migrations/          database schema
  seed/                demo records and BoQ
tests/                 costing tests from task 6
public/                demo assets
```

Empty implementation directories are tracked with `.gitkeep` files.

## Architecture and rules

The planned stack uses Supabase Postgres and Storage, a Next.js Telegram webhook, server-side transcription and vision, and server-generated PDFs. All AI requests go through `transcribeAndExtract()` or `analysePhoto()`. All calculations go through the pure `costReport(items, priceList)` function, with rates supplied by the BoQ.

Human confirmation precedes costing and locking. Locked records cannot be edited or deleted; corrections are appended as amendments. Follow section 16 one task at a time and exclude features on the cut list.

## Kiro build evidence

The requirements, design, steering, task list, hook notes, and four agent role specifications were prepared with Codex. They are preparation for Kiro use, not evidence of executed Kiro hooks or Crew work. On 18 November 2026, the builder confirmed successful Kiro sign-in and submission of the credit request. Credit approval has not been confirmed. The builder has since completed two real Kiro task 4 reviews; [the saved review](.kiro/specs/siteledger/task-4-review.md) records Gemini-era findings and manual lint/type checks. Its hook was created, but actual hook execution was not observed. The final Groq/GonkaRouter changes were written by Codex; the earlier Kiro review does not cover them. Crew execution and hook-run evidence remain later work.

Open this folder in Kiro, review the specifications there, and configure hooks using the installed version. Record real examples and commits as Voice, Vision, Costing, and Safety work happens. MCP integration and the full Kiro write-up are later work. `.kiro` must remain tracked.

## Schedule

The brief's submission target is **3 December 2026 (Thursday)**; its deadline is **4 December 2026 (Friday), 23:00 WAT**. Some weekday labels in the brief differ from the 2026 calendar; the original brief has been preserved. Check official competition resources before relying on the stated credit-request terms.
