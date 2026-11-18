# SiteLedger design

Source of truth: `PROJECT_BRIEF.md`, sections 7–10 and 12.
This design was prepared with Codex for review in Kiro. The Supabase schema, seed, server-side summary query, and Telegram intake are implemented; AI, PDF, and the product screens follow the ordered tasks.

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

Task 2 creates the section 8 tables: `projects`, `boq_items`, `submissions`, `submission_photos`, `report_items`, `reports`, `amendments`, and `telegram_users`. BoQ rate, description, unit, and section snapshots preserve the original approved record. Triggers block locked evidence changes and serialize evidence writes with approval; browser database roles have no direct access.

The `project_summary` and `boq_progress` views aggregate existing locked records. The read-only `/api/projects/[projectCode]/summary` endpoint exposes only the fictional demo and uses a server-only service-role key. The real project will use the builder's new Supabase account; an existing MCP account is excluded.

The sole demo project is **4-Bedroom Duplex, Lekki Phase 1, Lagos**. Seeded names and history are fictional demo data. Rates come from section 10 and are illustrative rather than live market prices.

## Telegram intake (task 3)

`POST /api/telegram/webhook` checks the Telegram secret before access. Original private messages only are accepted; edited-message updates cannot rewrite evidence. `/start LEKKI-DEMO-01` links the foreman to the demo and preserves an existing PM role on that project.

Server-only RPCs reserve an immutable update payload, lease, submission, and media path, then finalize saved media and acknowledgements. Network calls run outside database locks. Telegram retries failures; media writes and captions do not duplicate. A short lease permits recovery after an interrupted process. Telegram may repeat an acknowledgement if sending succeeded immediately before a process stopped.

The `site-evidence` bucket is private. References use bucket/path; the server uploads without overwrite. Intake groups by user/project/day in Africa/Lagos, supports photos before voice, limits photos to five and compressed renditions below 1 MB, and preserves extra voice notes in separate submissions. Text and captions stay in submission notes. Pending media blocks processing/confirmation, and incoming media only joins received submissions.

Supabase schema, seed, and intake migration were applied through the scoped `supabase_siteledger` MCP on 18 November 2026. These changes were built and checked with Codex; actual Kiro execution is recorded separately when it happens.

## Interface

Use the section 12 digital site diary: warm paper, dark ink, construction orange, serif headings, ruled tables, tabular naira figures, and monospace identifiers. Foreman screens start at 390px with 16px body text and 48px action targets.

Only the seven screens listed in section 12 are in scope. Each implemented screen must handle its applicable empty, loading, error, offline, and low-confidence states honestly.
