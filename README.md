# SiteLedger AI

SiteLedger turns a foreman's voice note and site photos into a human-confirmed daily report, costed in naira against a Bill of Quantities. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the specification and ordered build tasks.

## Current state

Task 1 is the foundation: a Next.js App Router application with TypeScript, Tailwind CSS, a simple site-diary placeholder, the project folder structure, and tracked `.kiro` preparation files.

Telegram intake, Supabase data, AI extraction, costing, PDF reports, and locking are later tasks. They are not implemented yet. The costing engine will only ever run on confirmed values.

The planned project **4-Bedroom Duplex, Lekki Phase 1, Lagos** and its client and report history are fictional demo data. Rates in the brief are illustrative demo rates, not live market prices.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```sh
git clone https://github.com/Kamarudeen-Balogun/siteledger-ai.git
cd siteledger-ai
npm ci
npm run dev
```

Open <http://localhost:3000>. The scaffold runs without credentials.

Before implementing integrations, copy `.env.example` to `.env.local` and fill the relevant values locally. Real `.env` files must not be committed.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

Costing tests will be introduced before the engine at task 6.

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

The initial requirements, design, steering, task list, hook notes, and four agent role specifications were prepared with Codex during scaffolding. They are preparation for Kiro use, not evidence of executed Kiro hooks or Crew work.

Open this folder in Kiro, review the specifications there, and configure hooks using the installed version. Record real examples and commits as Voice, Vision, Costing, and Safety work happens. MCP integration and the full Kiro write-up are later work. `.kiro` must remain tracked.

## Schedule

The brief's submission target is **3 December 2026 (Thursday)**; its deadline is **4 December 2026 (Friday), 23:00 WAT**. Some weekday labels in the brief differ from the 2026 calendar; the original brief has been preserved. Check official competition resources before relying on the stated credit-request terms.
