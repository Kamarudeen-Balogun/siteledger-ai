# SiteLedger design

Source of truth: `PROJECT_BRIEF.md`, sections 7–10 and 12.
This is the foundation design, prepared for review in Kiro. Integrations are not implemented yet.

## Stack and boundaries

- Next.js App Router, TypeScript, and Tailwind CSS in one web application.
- Supabase Postgres and Storage for project records and submission media.
- Next.js webhook route for Telegram intake.
- Server-side AI entry points: `transcribeAndExtract()` and `analysePhoto()` only.
- Pure, network-free costing entry point: `costReport(items, priceList)`.
- Server-side PDF rendering; IndexedDB for the later offline queue.
- Environment variables hold secrets. Server keys never enter client code.

## Record flow

Intake → unchanged transcript → validated extraction → mandatory human confirmation → deterministic BoQ costing → daily report and PDF → approval and lock → linked amendments.

Nothing is costed before human confirmation. Locked records retain the original quantities, rates, evidence, and approval record. Code and database constraints must block prohibited edits.

## Data model

Task 2 will create the section 8 tables: `projects`, `boq_items`, `submissions`, `submission_photos`, `report_items`, `reports`, `amendments`, and `telegram_users`.

The sole demo project is **4-Bedroom Duplex, Lekki Phase 1, Lagos**. Seeded names and history are fictional demo data. Rates come from section 10 and are illustrative rather than live market prices.

## Interface

Use the section 12 digital site diary: warm paper, dark ink, construction orange, serif headings, ruled tables, tabular naira figures, and monospace identifiers. Foreman screens start at 390px with 16px body text and 48px action targets.

Only the seven screens listed in section 12 are in scope. Each implemented screen must handle its applicable empty, loading, error, offline, and low-confidence states honestly.
