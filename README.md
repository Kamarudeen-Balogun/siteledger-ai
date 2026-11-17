# SiteLedger AI

SiteLedger turns a foreman's voice note and site photos into a human-confirmed daily report, costed in naira against a Bill of Quantities. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the specification and ordered build tasks.

## Current state

The foundation is a Next.js App Router application with TypeScript, Tailwind CSS, a site-diary placeholder, and tracked `.kiro` preparation files. Task 2 adds the eight database tables, protected record snapshots, the fictional demo history, and a read-only demo summary query.

Telegram intake, AI extraction, the costing engine, report/PDF screens, and the approval/amendment UI are later tasks. They are not implemented yet. The costing engine will only ever run on confirmed values.

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
supabase start --exclude edge-runtime,imgproxy,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,logflare,vector
node scripts/configure-local-env.mjs
npm run db:check
```

Initial startup applies `supabase/migrations/20261117000100_siteledger_schema.sql` and `supabase/seed/demo.sql`. The seed preserves an existing demo rather than modifying locked history. The checks run only inside `supabase_db_siteledger-ai` and roll back their test changes.

If a pre-existing CLI profile causes `Unsupported Config Type`, isolate the CLI state in the current PowerShell session:

```powershell
$env:SUPABASE_HOME = Join-Path $PWD 'supabase/.temp/cli-home'
$env:SUPABASE_PROFILE = 'supabase'
```

The local environment helper reads only SiteLedger's local stack and creates `.env.local` without printing credentials. It preserves an existing file, so if you already have one, fill its three Supabase fields yourself. Leave AI and Telegram variables empty until their tasks. `node scripts/configure-local-env.mjs --serve` starts a local-only production preview on port 3010 after `npm run build`, even if the existing environment file contains hosted credentials.

For the builder's new hosted account, create a fresh SiteLedger project and use that project's credentials. Apply the migration first and the seed second through its SQL editor or a CLI explicitly linked to that project. Do not reset or migrate another project's database.

### Demo summary

`GET /api/projects/LEKKI-DEMO-01/summary` returns the demo project's contract sum, stored cumulative cost, report count, amendment count, and BoQ progress. Only projects marked `is_demo` are exposed by this endpoint. Database reads use the service-role key on the server; browser roles cannot access the tables directly. Missing configuration or a database outage returns a plain 503 response.

The seed includes 12 approved reports dated 3–16 November 2026, 168 / 420 m² of 225mm blockwork, one rain delay, one defect follow-up amendment, and an excavation overrun. Stored costs capture the BoQ rate at confirmation; later rate edits preserve locked history. The summary aggregates stored records; it is not the task 6 costing engine or the task 11 dashboard.

No site photo or audio assets are fabricated. Media upload and actual photo analysis come in their scheduled tasks.

Task 2 validation: migrations and seed pass on PostgreSQL 17; `npm run db:check` verifies confirmation, snapshots, locked records, amendments, BoQ matching, totals, and database access. The live local Next.js endpoint returns the expected seed figures, hides existing non-demo projects, rejects invalid codes, and returns a plain 503 during an API outage before recovering on reconnection. Hosted setup awaits the builder's new account.

Scaffold validation: lint, TypeScript, production build, and local HTTP checks pass. The production dependency audit is clean. The full development audit currently reports [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) in `picomatch` through lint tooling; the latest published version, 4.0.7, is affected. Recheck when a patched release is available.

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

The requirements, design, steering, task list, hook notes, and four agent role specifications were prepared with Codex. They are preparation for Kiro use, not evidence of executed Kiro hooks or Crew work. Kiro is installed, but GitHub, Google, and AWS Builder ID sign-in have failed; account access and the credit request remain unresolved. Development is continuing with the builder's authorization, and genuine Kiro work is still required before submission.

Open this folder in Kiro, review the specifications there, and configure hooks using the installed version. Record real examples and commits as Voice, Vision, Costing, and Safety work happens. MCP integration and the full Kiro write-up are later work. `.kiro` must remain tracked.

## Schedule

The brief's submission target is **3 December 2026 (Thursday)**; its deadline is **4 December 2026 (Friday), 23:00 WAT**. Some weekday labels in the brief differ from the 2026 calendar; the original brief has been preserved. Check official competition resources before relying on the stated credit-request terms.
