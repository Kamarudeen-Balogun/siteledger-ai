Read `PROJECT_BRIEF.md` before every task. Build only what the current task in section 16 asks for. Never invent prices — all money comes from the price list in section 10. Never add a feature on the cut list. If a task is ambiguous, stop and ask the builder instead of guessing.

# SiteLedger AI — Project Brief

**Category:** Kiroween 2026 — Frankenstein
**Deadline:** Friday 4 December 2026, 11:00pm WAT — submit on **Wednesday 3 December**
**Builder:** Kamarudeen Balogun — CodeFlowX, civil engineer, certified AI & Automation, portfolio codeflowx.dev, GitHub github.com/Kamarudeen-Balogun
**Build environment:** VS Code with Codex as the coding agent, plus Kiro for the hackathon evidence trail (see section 14)

SiteLedger AI turns a foreman's voice note and site photos into a costed daily site report in naira. It matches what was done on site against a Bill of Quantities (BoQ), calculates percentage complete and budget variance per work item, flags defects and safety issues from photos, and produces a client-ready PDF. Every report is locked into an append-only dispute log that can be amended but never silently edited.

This brief is the single source of truth for the build. If Codex, Kiro, or any other agent suggests something that conflicts with this brief, this brief wins until the builder changes it deliberately.

---

## How to use this brief in VS Code with Codex

Do this once, before any code is written.

1. Create a brand-new GitHub repository named `siteledger-ai`. It must be public. Do not reuse code, repos, or assets from IMAT, LeadFlowX, WaterCheck, or any earlier project — those are inspiration only (see the new-project rule in section 2).
2. Clone the repo and open it in VS Code.
3. Save this brief in the repo as `PROJECT_BRIEF.md` at the root.
4. Create an `AGENTS.md` at the root containing exactly this instruction, then paste the full brief below it:

> Read `PROJECT_BRIEF.md` before every task. Build only what the current task in section 16 asks for. Never invent prices — all money comes from the price list in section 10. Never add a feature on the cut list. If a task is ambiguous, stop and ask the builder instead of guessing.

5. Create the `/.kiro` folder structure from section 14 on day one, even if it starts almost empty. Judges inspect it.
6. Work through section 16 in order. One task at a time. Commit after each task passes its acceptance criteria, using the commit message given in that task.
7. Use the ready-made prompts in section 20 to start each Codex session. Do not paste the whole brief into every prompt — `AGENTS.md` already points Codex to it.

A note on tools: Kiroween requires visible use of Kiro. Building mainly in VS Code with Codex is fine for speed, but the builder must also open the project in Kiro, write specs and steering there, and let Kiro hooks run, so the `/.kiro` directory shows genuine use. A repo built entirely elsewhere with an empty `/.kiro` folder risks disqualification for insufficient Kiro use.

---

## 1. The mission is money, not transcription

**Win condition:** a judge watches a 90-second demo, understands that a Nigerian contractor loses money every week because site records are verbal, late, and uncosted, and sees SiteLedger turn one voice note into a costed, signed-off report they could send to a client that evening.

Voice-to-report tools already exist. Transcription is not the product. The product is:

- Money: every activity costed in ₦ against the BoQ, with variance shown the same day, not at month-end.
- Proof: photos, quantities, and an append-only log that holds up in a payment dispute.
- Fit for the site: Pidgin and Nigerian English understood, Telegram-first because foremen already live in chat apps, and an offline queue because site data is unreliable.

If a feature does not strengthen money, proof, or fit, it does not belong in the MVP.


---

## 2. Hackathon hard rules — breaking any of these ends the entry

These facts come from the official Kiroween 2026 Devpost page. Treat them as non-negotiable.

- **New projects only.** The project must be built during the window 30 October to 4 December 2026. Projects started before 30 October, including Kiroween 2025 entries, are not eligible. New repo, new code.
- **Kiro must be used, visibly.** Build a working app using Kiro (IDE, CLI, Web, and/or Kiro Crew). Insufficient use of Kiro can result in disqualification at the judges' sole discretion.
- **Public GitHub only, with `/.kiro` at the root.** The repository must contain all source code and a `/.kiro` directory at the root showing specs, hooks, and steering. **Never add `/.kiro` to `.gitignore`.**
- **Demo video under 3 minutes**, public on YouTube, plus a working app URL, a text description, and a write-up of how Kiro was used.
- **One category.** SiteLedger enters **Frankenstein** — stitching together technologies that do not usually work together: voice AI, photo vision, quantity surveying, a BoQ price engine, Telegram, and PDF reporting.
- **Judging is five criteria at 20% each:** Potential Impact, Technological Implementation (with Kiro), Design, Innovation / Idea, and Presentation.
- **Prizes:** one Overall prize ($30,000 / $20,000 / $10,000) *or* one Category prize ($5,000) per entry, plus any number of bonuses, including Best Startup $10,000, Best Student $1,500, Best Kiro Crew App $1,000, and Best Demo $1,000. SiteLedger is built to also be credible for Best Startup and Best Kiro Crew App.
- **Free Kiro credits:** request the 4,000 free Kiro credits before **1 December 2026**. Do not leave this to deadline week.
- **No extensions.** Submit on 3 December. 4 December is buffer for a failed upload or a broken link, nothing else.

What judges are actually looking for, in plain terms: a real problem for a real audience that someone would pay to solve; thoughtful, deep use of Kiro (specs, hooks, steering, MCP, Crew, property-based testing — not just autocomplete); clean design; an idea they have not seen ten times that day; and a demo that works end to end without excuses.

---

## 3. Product specification

### One-sentence description

Foremen send a voice note and photos; SiteLedger returns a costed daily report — work done, quantities, ₦ cost against BoQ, percentage complete, defects, and a client PDF — in under two minutes.

### Who it is for

- **Primary user — the site foreman / site engineer.** Low patience, gloves on, bright sun, poor data. He will not learn a dashboard. He talks and takes photos.
- **Secondary user — the project manager / quantity surveyor (QS).** Reviews, confirms quantities, checks variance, approves the report. Works on desktop.
- **Reader — the client / consultant.** Receives the PDF. Never logs in. The PDF must look like it came from a serious firm.

### The problem, stated for the Devpost description

On Nigerian building sites, the daily record lives in a foreman's head, a paper diary, and scattered phone photos. By the time anyone costs the work, the money argument has already started: the contractor says a floor was cast, the client says it was half done, and neither side has dated, costed proof. SiteLedger makes the daily record costed, photographic, and unchangeable — on the day it happens.


---

## 4. Core flow — end to end

1. **Intake.** The foreman sends a voice note (30–90 seconds) and 1–5 photos to the Telegram bot, or records and uploads inside the web app. Offline submissions queue and send when data returns.
2. **Transcription.** The voice note is transcribed. Nigerian English and common Pidgin site terms are preserved, not "corrected" into American English (see the glossary in section 9).
3. **Extraction.** An AI model extracts a structured record: work items mentioned, quantities, unit, crew size, materials delivered or used, delays, and issues. Every extracted field carries a confidence score.
4. **Photo analysis.** Each photo is checked for: work item it likely shows, visible defects (honeycombing, cracks, poor curing, exposed reinforcement), and safety issues (no helmet, no harness, unshored excavation). Photo findings are suggestions, never facts.
5. **Human confirm — mandatory.** The foreman or PM sees a simple confirm screen: extracted items, quantities, and photo findings, each editable. Nothing is costed or locked until a human confirms. This step is the safety net against AI error and a selling point in the demo.
6. **Costing — deterministic, never AI-invented.** The costing engine matches each confirmed item to the BoQ price list (section 10) and calculates cost, cumulative quantity, percentage complete, and variance. The AI never sets a price.
7. **Report.** A daily report is generated: web view plus a downloadable, client-ready PDF with the firm's name, project, date, weather field, work done, costs, photos, defects, and signatures block.
8. **Lock and log.** On approval, the report is locked into the append-only dispute log. Later changes are new amendment entries linked to the original — the original is never edited or deleted.
9. **Summary back to chat.** The Telegram bot replies with a short summary: total cost today in ₦, top item, percentage complete, and a link to the report.

### The 3-minute demo script

Record exactly this flow. Rehearse it. The video must be under 3 minutes.

| Time | On screen | What to say / do |
| --- | --- | --- |
| 0:00–0:20 | A paper site diary and a phone photo gallery | State the problem: records are verbal and uncosted, payment disputes follow |
| 0:20–0:50 | Telegram: send a real voice note + 3 site photos | Speak naturally, include one Pidgin term and real quantities |
| 0:50–1:20 | Confirm screen appears | Show extracted items, fix one quantity by hand — prove the human is in charge |
| 1:20–1:50 | Costed report | Point to ₦ cost per BoQ item, % complete, and one variance flagged red |
| 1:50–2:15 | Photo defect + PDF | Show one defect flagged from a photo, then open the client PDF |
| 2:15–2:40 | Dispute log | Try to edit a locked entry — you cannot; add an amendment instead |
| 2:40–3:00 | Kiro screen | Show `/.kiro` specs, hooks, and the Crew agents; close with who pays for this |


---

## 5. Feature scope — build the MVP, protect the deadline

### Must have — the entry is not submittable without these

- Telegram bot intake for voice notes and photos, plus in-app upload as fallback
- Transcription that handles Nigerian English and Pidgin site terms
- Structured extraction into the JSON schema in section 9, with confidence scores
- Human-confirm screen — editable before anything is costed or locked
- BoQ price list (seed data, section 10) and a deterministic costing engine
- Daily report web view and client-ready PDF export
- Append-only dispute log with amendments
- One demo project fully seeded with realistic Nigerian site data (section 12)
- Public GitHub repo with a genuine `/.kiro` directory (section 14)
- Deployed working app URL (Vercel or equivalent)

### Should have — build only after every must-have works end to end

- Photo defect and safety flagging
- Offline queue for submissions made without data
- Kiro Crew: four agents (Voice, Vision, Costing, Safety) — also the Best Kiro Crew App play
- MCP connection from Kiro to the price list
- Project dashboard: cumulative cost, percentage complete by section, variance chart
- Blog post about building with Kiro (bonus prize)

### Cut list — do not build these, even if an agent suggests them

**Builder amendment — 18 November 2026 (browser accounts and project management):** Finish the core report flow first, then add email/password browser access and project creation/management before submission. Implement this as task 10A after the core intake, confirmation, costing, PDF, dispute log and web upload flow passes, before dashboard integration and production deployment. Include password recovery, linking the same account to Telegram, creating/selecting/archiving projects, access to old project records, and private account/project dashboards using the existing BoQ progress and variance formulas. Preserve every locked report and amendment when archiving a project. Independent users must not access each other's private projects. This amendment allows the account/project ownership needed for that flow; company administration, billing and complex roles remain excluded. Project invitations and team management are allowed only by the 19 November amendment below. Keep the two existing roles, foreman and PM. This milestone is required before submission, not a phase 2 promise; do not implement it during tasks 6–10.

- WhatsApp bot as the primary channel (see section 11 — phase 2 only)
- Payments, subscriptions, or billing of any kind
**Builder amendment — 19 November 2026 (authorized project teams and professional identity):** Task 10A must include owner-controlled project invitations, membership management, explicit professional names and roles per project. One account may belong to several projects with different roles. A one-person project may use a PM account for intake, confirmation and approval, with separate explicit actions and honest attribution. This deliberately lifts the exclusion of project invitations and team management, while keeping only foreman and PM work roles. The project creator is its owner and initially a PM; ownership grants project administration, rather than introducing another work role. Follow the access requirements in section 8. Implement these features in task 10A after tasks 9–10; close confirmed access leaks in the current flow immediately without building the membership UI early.

- Multi-company administration or complex roles — one demo company, two work roles (foreman, PM); project invitations and membership management are allowed under the amendment above
- Native mobile apps — the web app must be mobile-first and installable-feeling, nothing more
- Real-time chat, comments, or notifications beyond the Telegram summary
- A marketplace, a materials-ordering feature, or supplier integrations
- Payroll, attendance biometrics, or equipment tracking
- Editing or deleting a locked report — this is forbidden by design, not a missing feature

---

## 6. The edge — prior art and how SiteLedger is different

Plain voice-to-report is already done. Judges may have seen these, so the demo and description must name the difference without naming competitors aggressively.

| Existing tool | What it already does | SiteLedger's difference |
| --- | --- | --- |
| SiteReport AI | Voice + photos → structured report, US OSHA / ASTM safety checks | No costing, no BoQ, US-focused. SiteLedger costs every item in ₦ against a BoQ |
| FieldScribe | Voice + photos → home-inspection report, branded PDF | Inspection, not construction progress or payment. No quantities, no variance |
| Oxolo and similar | Voice + photos + notes → reports, tasks, minutes | General field work. No Nigerian QS practice, no Pidgin, no dispute log |

SiteLedger's five edges, which must all be visible in the demo:

1. **BoQ costing in ₦** — percentage complete and variance per work item, the language of Nigerian quantity surveying.
2. **Pidgin and Nigerian English** — the way foremen actually speak on site.
3. **Telegram-first** — no new app to learn, no dashboard forced on the foreman.
4. **Append-only dispute log** — records built for payment arguments, not just for filing.
5. **Offline queue** — built for sites where data drops for hours.

---

## 7. Recommended architecture

Keep it boring and shippable. One repo, one web app, one bot webhook, one database.

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js (App Router) + TypeScript + Tailwind CSS | Fast to build with AI help, deploys cleanly to Vercel |
| Database + storage | Supabase (Postgres + Storage) | Auth, tables, and photo storage in one place, generous free tier |
| Hosting | Vercel | One-click Next.js deploys, stable demo URL |
| Transcription | OpenAI Whisper API, or faster-whisper self-hosted if cost bites | Best handling of Nigerian English; keep the provider behind one function so it can be swapped |
| Vision + extraction | One multimodal LLM API (GPT-4o class or Gemini class) | Photo analysis and structured extraction; provider behind one function |
| PDF | Server-side HTML-to-PDF (for example `@react-pdf/renderer` or Puppeteer) | The PDF is a client document — it must look designed, not screenshotted |
| Telegram | Telegram Bot API via a Next.js webhook route | No app review, no verified business number needed (section 11) |
| Offline queue | IndexedDB queue in the web app, retry on reconnect | Simple, demonstrable, no native app needed |

Rules for the coding agent:

- All AI calls go through two server functions only: `transcribeAndExtract()` and `analysePhoto()`. No AI calls scattered through UI components.
- All money calculations go through one pure function: `costReport(items, priceList)`. It must be unit-testable without any AI or network call.
- Secrets live only in environment variables (section 8). Never commit a key. Never put a key in client-side code.
- Prefer server components and API routes; keep client JavaScript small so the app stays fast on cheap Android phones.

### Repository structure

```text
siteledger-ai/
  .kiro/                  # specs, hooks, steering — NEVER gitignored
  PROJECT_BRIEF.md        # this brief
  AGENTS.md               # pointer instruction for Codex / agents
  README.md               # what it is, how to run it, how Kiro was used
  app/                    # Next.js routes: dashboard, reports, confirm, log
  components/             # UI components
  lib/
    ai/                   # transcribeAndExtract, analysePhoto
    costing/              # costReport + price list types (pure, tested)
    telegram/             # bot webhook handlers
    pdf/                  # report PDF template
  supabase/
    migrations/           # SQL schema
    seed/                 # demo project + BoQ seed data
  tests/                  # costing tests at minimum
  public/                 # real site photos for the demo project
```


---

## 8. Environment variables and data model

### Environment variables — names only, values never in the repo

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=                 # primary transcription and extraction, Free plan
GEMINI_API_KEY=               # optional transcription fallback, Free tier
GONKAROUTER_API_KEY=          # optional extraction fallback, starter tokens
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SITELEDGER_APP_URL=           # HTTPS application origin for private Telegram review links
```

Add a `.env.example` with these names and empty values. Add `.env.local` to `.gitignore` — and confirm, twice, that `/.kiro` is **not** in `.gitignore`.

### Data model — minimum tables

| Table | Key fields | Notes |
| --- | --- | --- |
| `projects` | id, name, client, location, contract_sum | One seeded demo project is enough |
| `boq_items` | id, project_id, section, description, unit, boq_quantity, rate | The price list lives here (section 10) |
| `submissions` | id, project_id, source (telegram / web), audio_url, transcript, status, created_at | Status: received → extracted → confirmed → locked |
| `submission_photos` | id, submission_id, storage_url, ai_findings (jsonb) | Findings are suggestions until confirmed |
| `report_items` | id, submission_id, boq_item_id, quantity_done, crew, confidence, confirmed_by | One row per confirmed work item |
| `reports` | id, project_id, date, status (draft / locked), total_cost, pdf_url | Locked reports cannot be updated or deleted at the database level if possible |
| `amendments` | id, report_id, author, note, created_at | The dispute log: append-only, no update or delete |
| `telegram_users` | telegram_id, display_name, project_id, role | Current prototype link; task 10A separates stable identity/profile from per-project memberships |

Enforce append-only behaviour in code and, where Supabase allows, with row-level policies that block update and delete on `reports` once locked and on `amendments` always.

---

### Account and project access — task 10A (builder amendment, 19 November 2026)

**Builder amendment — 21 November 2026 (immediate signup and shared identity):** Browser email/password signup must not require an initial confirmation email. Use Cloudflare Turnstile on the website with Supabase-native CAPTCHA enforcement and rate limits to reduce automated account creation. This does not establish email ownership: check ownership separately before accepting an email-addressed project invitation, and retain email password recovery. Telegram-first users and browser-first users must be able to link their existing account in either direction without creating a second person profile. Require proof of both identities, recent browser authentication and an expiring single-use link challenge. If both identities already have profiles, combine them only through a deliberate operation proving both accounts, preserving all original evidence and project permissions. Never merge based on names, email equality or a supplied Telegram ID. No paid Supabase upgrade is required.

**Builder amendment — 21 November 2026 (creator attribution):** Add a visible app credit: Built by CodeFlowX — Kamarudeen Balogun, linking codeflowx.dev and github.com/Kamarudeen-Balogun. This identifies the software creator; project ownership still comes only from authorized membership and ownership records. Do not rename historical evidence or signatures to match the public creator credit.

**Builder revision — later 21 November 2026 (confirmed signup with free Resend SMTP):** Supersede the earlier immediate-signup instruction above. The builder has configured custom Resend SMTP and now requests initial signup email confirmation. New browser users must prove email ownership before their first login. Keep Turnstile and native/server signup limits, password recovery, secure linking in both directions and all project-access requirements. The successful native signup email challenge may also establish invitation email ownership; never treat an old automatically confirmed timestamp as proof. Use a matching Confirm Signup email design with CodeFlowX attribution. No paid Supabase upgrade or automatic billing is authorized.

**Builder revision — later 21 November 2026 (professional Telegram onboarding):** First-time or unlinked Telegram users open the same website email/password signup, sign-in and password recovery inside an HTTPS Telegram Mini App. Passwords must never be requested, stored or echoed as chat messages. The bot cannot force-open a form: provide a clear button. Do not create new Telegram-only person profiles; explicitly link signed Telegram identity after authenticated website access, preserving existing legacy records. Already-linked users may continue through their authorized identity. Provide a concise menu for start, account, projects, today, reports, help and logout, with one clear next action and honest processing/access errors. Keep project ownership, memberships, professional names, human confirmation, role limits and immutable evidence requirements. Owner/team administration stays in the authorized web flow; no additional messaging channel, billing or notification system.

- **Private by default.** A project code identifies a project; knowing it never grants access. The public demonstration exposes only the original fictional seed, excluding real submissions, amendments, media and live financial totals, even when testing on that demo project. Until task 10A, only accounts explicitly authorized by the builder may use the live bot.
- **Professional identity.** Ask the person to type and confirm the name to appear on records when they start the bot, or reuse their confirmed browser profile. Telegram display names are metadata, not professional attribution. Support Unicode and single-word names; validate length and reject blank/control-character input. A name alone never authenticates someone or grants a role. Store stable identity IDs and snapshot the name and role at each confirmation, approval and amendment; profile edits never rename old evidence.
- **One account, several projects.** Store profiles separately from project memberships. Each membership has a project, person, foreman/PM role and active/revoked state. Link browser and Telegram identities through expiring, single-use challenges requiring proof of both accounts; a display name, supplied Telegram ID or email match alone is insufficient. Relinking revokes the old connection without changing historical attribution.
- **Owner-controlled team access.** Only the owner can invite, change roles, remove members, transfer ownership or archive a project. Owners choose foreman or PM per invitation; invitees cannot promote themselves. PMs can submit and confirm, review project records, approve and manage the BoQ. Foremen can submit, confirm and amend their own records but cannot approve or read another foreman's private records. Existing report approval and immutable evidence rules remain in force.
- **Invitations.** Provide a copyable invite link addressed to a verified email identity, with a selected project and role, an expiry, one successful use and owner cancellation. Store only a hash of the secret. A forwarded, expired, cancelled or already consumed invitation cannot grant another person access. Re-check the owner's authority and project status during atomic acceptance. Show plain errors without revealing a project's private details. Do not add company administration or notification infrastructure.
- **One-person projects.** A creator starts as owner/PM and may perform intake, confirmation and approval themselves. Keep confirmation and approval as separate deliberate actions; label the submitter and approver truthfully, including when they are the same person. Do not imply independent review or bypass confirmation.
- **Authorization on every request.** Check active project membership and the required role for web/bot actions, reports, PDFs, media, BoQ, summaries and logs. Check referenced resources belong to that authorized project. A forwarded old bearer link must not replace authenticated membership. Revoke active sessions/capabilities on account unlinking or membership removal; a role downgrade immediately removes approval/admin permissions. Media delivery must also respect revocation; avoid durable publicly accessible storage URLs.
- **Safe project selection and site dates.** Show the active project clearly before capture and allow switching only among authorized projects. Capture the project and its timezone with each queued submission; reconnecting must never send it to whichever project is now active. Default the demo to Africa/Lagos. Re-check access, archival and original project before retry; retain a blocked queued submission and explain the required action. Never silently reassign audio, photos or reports.
- **Account recovery.** Use email ownership verification for invitations, password recovery, safe login/logout and session expiry. Require recent authentication for ownership transfer, identity relinking and other account-sensitive actions. Rate-limit authentication, invite acceptance and intake; validate files and request sizes, keep secrets out of client code/logs and do not expose whether an unrelated private project exists.
- **Ownership continuity.** Exactly one active owner must remain. Transfer only to an existing active member who accepts; the new owner is a PM. Prevent removing or downgrading the current owner until transfer succeeds. A PM's review rights alone do not grant team administration.
- **Archive and history.** Archiving blocks new intake, confirmation, approvals, amendments, invites and BoQ edits while preserving authorized read access to every old record. Memberships may still be revoked and owners may restore a project. Preserve locked reports, original media, amendments, names, rates, currency and timestamps; account removal must never cascade-delete evidence.
- **Audit trail.** Record grants, invitation acceptance/cancellation, role changes, removal, relinking, ownership transfer and archive/restore events with server-derived actor, project and timestamp. Keep this append-only administrative history separate from report amendments. Audit retention must not expose private project data to former members.
- **Worldwide money.** Use each project's selected currency and supplied BoQ rates, with display precision appropriate to that currency. Keep decimal calculations exact and money snapshots immutable. Do not apply naira rounding rules to other currencies or sum different currencies together; no exchange-rate service or invented foreign rates.
- **Acceptance evidence.** Exercise two independent owners, an invited foreman/PM, one account with different roles on two projects, and a solo owner/PM. Verify stranger and forwarded-link denial, invite replay/expiry/cancellation, privilege escalation rejection, immediate revocation on report/PDF/media routes, blocked offline retries after removal/archive, professional-name snapshots and preserved locked history after profile edits, ownership transfer and archive/restore. Use disposable fixtures; do not modify genuine evidence merely to demonstrate denial.

---

**Builder amendment — 21 November 2026 (limited private trial, task 10B):** After task 10A account and access acceptance passes, add a website-only private guest trial: one voice note, up to three photos and a draft costed report using the labelled section 10 demo BoQ. Guest access must be expiring, server-scoped, CAPTCHA-protected and rate-limited; it must grant no access to anyone else's project. Show the expiry before upload. Approval, locking, project invitations and team access require a verified account. Provide an explicit Save this work to your account action after signup or sign-in. Atomically prove ownership of the still-active guest session and the verified account, preserve media and original attribution, and consume the handover once. Never claim guest records by name, email equality, a supplied ID or an expired session. Do not promise recovery after the required session is lost. Build this as task 10B before task 11, not during unfinished task 10A.

**Builder clarification — 22 November 2026 (trial duration and handover):** Use a 24-hour guest session. Handover creates its own private, demo-labelled NGN project rather than mixing sample rates into an existing real project. Keep original guest capture, edits, media and attribution preserved; the verified person confirms under their professional name before ordinary approval. Use the existing Cloudflare widget with server-side Siteverify and the matching secret in the ignored application environment, in addition to Supabase-native account CAPTCHA. Do not replace the widget or disable native CAPTCHA.

## 9. The AI pipeline — extract structure, never invent money

### Step 1 — Transcribe

Send the audio to the transcription provider. Keep the raw transcript unchanged and stored. Do not let any later step rewrite history — corrections happen at the confirm screen and are stored as the confirmed values.

**Builder amendment — 18 November 2026:** Task 4 must support multilingual voice transcription with automatic language detection, covering widely used languages supported by the selected provider so people outside Nigeria can submit voice notes. Publish the provider-supported language list and identify which languages have been tested with site recordings. Nigerian English and Pidgin remain required demo tests. Do not claim universal language coverage or verified accuracy for untested languages.

**Builder amendment — 18 November 2026 (free providers and fallback):** For task 4, use Groq Free-plan Whisper for transcription and Groq Free-plan text extraction. Where configured, try Gemini Free-tier transcription or GonkaRouter starter-token extraction as an alternate. GonkaRouter offers a limited 1 million starter tokens, not an unlimited free plan. Use at most two transcription requests and two extraction generations per processing attempt, preserve the unchanged transcript and media, and return a durable manual-entry result when those attempts fail. Never configure billing upgrades, paid-provider fallback, or automatic top-ups. All requests remain behind `transcribeAndExtract()`; this amendment adds no other task or screen.

### Step 2 — Extract into this exact JSON shape

```json
{
  "work_items": [
    {
      "description": "Blockwork, ground floor, east elevation",
      "matched_boq_hint": "Blockwork 225mm hollow sandcrete",
      "quantity": 18,
      "unit": "m2",
      "crew": 6,
      "confidence": 0.82
    }
  ],
  "materials": [
    { "name": "Cement", "quantity": 40, "unit": "bags", "action": "delivered", "confidence": 0.9 }
  ],
  "delays": [
    { "reason": "Rain stopped external work", "hours": 2, "confidence": 0.7 }
  ],
  "issues": ["Curing not done on yesterday's slab"],
  "raw_language_notes": "Speaker used Pidgin: 'we don cast' = concrete pour completed"
}
```

Extraction rules to give the model in its system prompt:

- Extract only what the speaker actually said. If a quantity is not stated, leave it null and set confidence low — never estimate a quantity.
- Preserve the speaker's terms in the description, then add a `matched_boq_hint` separately. Matching to the BoQ happens in the costing step, where a human can override it.
- Return valid JSON only, matching the schema exactly. Validate the response in code and retry once on invalid JSON, then fail gracefully to a manual-entry confirm screen.

### Step 3 — Analyse photos

For each photo, return: likely work item, visible defects with a plain-language description, safety concerns, and a confidence score. Frame every finding as "possible" in the UI. A wrong defect claim presented as fact will destroy trust in the demo and with real users.

### Pidgin and site glossary — seed the prompts with these

| Term heard | Meaning |
| --- | --- |
| cast / don cast | Concrete pour done |
| decking | Formwork / slab deck preparation |
| lintel | Beam over openings |
| german floor | Ground floor oversite concrete |
| screeding | Levelling floor finish |
| block setting | Laying sandcrete blocks |
| gbodo / sharp sand | Sharp sand (do not "correct" material names) |
| boys | Site labour crew (record as crew count, keep the term in the transcript) |

### Confidence and the human-confirm rule

- Confidence below 0.6: highlight the field in amber on the confirm screen and require the user to type the value.
- Confidence 0.6–0.85: pre-filled, editable, shown normally.
- Confidence above 0.85: pre-filled, still editable. Nothing is ever uneditable before locking.
- The costing engine only ever runs on confirmed values. This sentence belongs in the README and the demo narration.

---

## 10. BoQ and costing — the heart of the product

### Seed price list — illustrative starting rates, verify locally before any real use

These rates exist so the demo calculates real-looking totals on day one. They are seed data for a hackathon demo, labelled as such in the app settings, and must be replaced with a QS-verified price list before any real project uses SiteLedger. Never present them in the demo or description as live market prices.

**Builder amendment — 18 November 2026 (project currency):** Add currency selection during project creation in task 10A. Each project uses BoQ rates supplied in its selected currency; never convert the naira demo rates or invent foreign prices. The existing demo remains NGN. Keep `costReport()` currency-independent and preserve exact decimal amounts. Retain the original currency on existing reports and amendments; changing a setting must never relabel locked money. Integrate currency labels in reports, PDFs, Telegram summaries, project dashboards and BoQ settings as part of tasks 10A–11. Show totals from projects with different currencies separately. Exchange rates and automatic currency conversion are excluded.

| Section | Item | Unit | Rate (₦) |
| --- | --- | ---: | ---: |
| Substructure | Excavation, foundation trenches | m³ | 8,500 |
| Substructure | Hardcore filling, compacted | m³ | 18,000 |
| Substructure | Oversite concrete (German floor), 150mm | m² | 22,500 |
| Concrete | In-situ concrete, columns and beams | m³ | 145,000 |
| Concrete | Reinforcement, high-yield bars, cut and fixed | tonne | 1,450,000 |
| Blockwork | Sandcrete blocks 225mm hollow, laid | m² | 14,500 |
| Blockwork | Sandcrete blocks 150mm hollow, laid | m² | 11,800 |
| Roofing | Timber roof structure, treated | m² | 28,000 |
| Roofing | Aluminium roofing sheets, long span | m² | 19,500 |
| Finishes | Plastering, walls, 12mm | m² | 4,800 |
| Finishes | Screeding, floors | m² | 5,500 |
| Finishes | Ceramic floor tiles, supplied and laid | m² | 16,000 |
| Services | Electrical first fix, conduit and wiring | point | 35,000 |
| Services | Plumbing first fix | point | 42,000 |
| Labour (daywork) | Mason, per day | day | 12,000 |
| Labour (daywork) | Labourer, per day | day | 6,000 |

Seed each item with a plausible BoQ quantity for the demo project (for example, Blockwork 225mm: 420 m²) so percentage complete moves visibly across several seeded daily reports.

### Costing formulas — implement exactly these, in the pure `costReport` function

- **Cost today (per item)** = quantity confirmed today × BoQ rate
- **Cumulative quantity** = sum of confirmed quantities for that BoQ item across all locked reports, including today
- **Percentage complete** = cumulative quantity ÷ BoQ quantity × 100
- **Value earned** = cumulative quantity × BoQ rate
- **Variance flag** = percentage complete minus the planned percentage for that date, if a planned percentage is set; otherwise flag any item where cumulative quantity exceeds BoQ quantity (overrun) — show it red, never hide it
- **Productivity (show where crew is recorded)** = quantity done ÷ crew count, stated as units per person per day, for example "18 m² ÷ 6 crew = 3.0 m² per person"
- **Report total** = sum of cost today across all items. Round to the nearest ₦10 in display; keep exact values in the database.

Write unit tests for `costReport` first (section 17). If the money maths is wrong in the demo, nothing else matters.

---

## 11. Messaging — Telegram first, WhatsApp later

**Decision: build on Telegram. Do not block the MVP on WhatsApp.**

Why: a WhatsApp bot needs a verified Meta business account, an approved phone number, and template-message approval. That process can take days to weeks and can stall with no warning — a deadline risk SiteLedger cannot afford. A Telegram bot is created in minutes with BotFather, accepts voice notes and photos natively, and needs no business verification. Foremen in the demo story can be onboarded with one link.

WhatsApp stays in the product story as **phase 2**: the intake layer is deliberately channel-agnostic (a submission is a submission, whatever app it came from), so WhatsApp can be added after the hackathon without rebuilding. Say exactly that in the Devpost description — it shows judgement, not a missing feature.

### Telegram setup — step by step

1. In Telegram, open **@BotFather**, send `/newbot`, name it (display name: *SiteLedger*; username must end in `bot`, for example `SiteLedgerSiteBot` — pick an available variant).
2. Copy the bot token into `TELEGRAM_BOT_TOKEN` in `.env.local` and in Vercel. Never paste the token into code, chat screenshots, or the demo video.
3. Set the webhook to the deployed app: `https://<your-domain>/api/telegram/webhook`, with the secret in `TELEGRAM_WEBHOOK_SECRET`, and verify the webhook route checks that secret on every request.
4. Create a deep link for onboarding: `https://t.me/<bot-username>?start=<project-code>`. Opening it connects an already authorized account; the code itself must not grant access. Task 10A uses owner-controlled invitations and collects a confirmed professional name before intake.
5. Test with a real phone before building anything else on top of it: voice note in, acknowledgement back, within 10 seconds.

### Bot behaviour

| User sends | Bot does |
| --- | --- |
| `/start <project-code>` | Checks granted project access and replies with one next step; task 10A collects the professional name and allows selection among authorized projects |
| Voice note | Saves it, replies "Got it — working on your report", starts transcription |
| Photo (with or without the voice note) | Attaches it to today's open submission for that user |
| `/today` | Replies with today's summary: total ₦, items, % complete link |
| `/help` | One short message: send a voice note + photos, that is all |
| Anything else (text) | Treats it as a note on today's submission; never replies with an error stack or a confusing menu |

Bot copy rules: short, warm, plain English with light Pidgin where natural ("Report don ready" is fine; forced slang everywhere is not). No walls of text. No emoji in every line. One clear next action per message.

### Fallback that must always work

The web app's in-app record-and-upload flow is not a lesser version — it is the guaranteed path for the demo video if Telegram, data, or the webhook fails on recording day. Build it early, test it weekly.

---

## 12. UI and UX — an interface that does not look AI-generated

This section matters commercially, not just for the 20% Design score. Judges see dozens of identical AI-built dashboards. SiteLedger must look like a tool designed by someone who has stood on a site in Lagos.

### The design idea: a digital site diary

Take visual cues from the real objects of site life: the ruled site diary, the printed BoQ, the engineer's stamp, a clipboard, a delivery note. The interface should feel like well-made paper records, digitised — not like a Silicon Valley SaaS template.

### Palette and type — use these, not defaults

| Element | Choice | Notes |
| --- | --- | --- |
| Background | Warm off-white `#FAF7F2` (paper) | Not pure white, not grey-blue |
| Ink | Near-black warm `#1C1917` | Body text, headings |
| Primary accent | Deep construction orange `#C2410C` used sparingly | Buttons, the stamp, key figures only |
| Secondary | Muted olive / sage for "confirmed / on track" | Not bright SaaS green |
| Danger | Brick red `#B91C1C` | Variance and defects only |
| Lines | Hairline rules like a diary page, `#E7E0D4` | Tables ruled, not boxed in cards |
| Headings | A serif or slab with character, for example Fraunces or Source Serif | Gives the "ledger" feel |
| Body and numbers | A clean grotesque, for example Inter or Public Sans; tabular figures for all ₦ amounts | Numbers must align in tables |
| Mono | A monospace for report IDs, timestamps, and the dispute log | Reinforces the record-keeping feel |

Use one accent colour. If everything is orange, nothing is. Currency is always formatted as `₦1,450,000` with tabular numerals, never as plain text typed by hand.

### Layout rules

- **Mobile first, always.** The foreman's view is a phone view. Design every screen at 390px wide first, then widen.
- **Glove-friendly targets:** minimum 48px tap height on the foreman-facing screens, one primary action per screen, record button large and reachable by thumb.
- **Tables look like a BoQ,** because they are one: ruled rows, right-aligned ₦ columns, section headings in small caps. Do not turn BoQ data into floating cards.
- **The locked report gets a visual stamp** — a rotated, bordered "LOCKED — [date]" mark in the accent colour, like a QS stamp on paper. Small, human, memorable.
- **Dashboard restraint:** three numbers lead — contract sum, value earned to date, variance — then the BoQ progress table. No chart zoo.

### What makes an interface look AI-generated — avoid all of these

- Purple or blue gradient hero sections, glowing orbs, and glassmorphism panels
- Generic stock illustrations of smiling teams, 3D blobs, or robot mascots
- Lorem ipsum, "John Doe", "$1,234.56" sample data, or a project called "Project Alpha"
- Identical rounded cards in a grid for every kind of information
- Emoji as icons, or a different icon style on every screen
- Centre-aligned everything, huge empty hero text, and marketing copy inside a work tool ("Unlock the power of…", "Supercharge your site")
- Dark mode as the default for a tool used in bright sunlight
- Perfect, implausible data — every project at 100%, no delays, no defects

### What to do instead — concrete replacements

- Use **real Nigerian site photos** in the demo project (the builder's own site photos where possible), real Lagos project names, real material names, and imperfect data: one rainy-day delay, one defect, one item overrunning.
- Write copy the way a site talks: "Blockwork — East elevation", "Rain stopped work, 2 hrs", "40 bags cement delivered". Short, factual, no marketing voice inside the app.
- Show the seams of real work: timestamps, who confirmed, amendment history. Records look real because they behave like records.
- Keep one consistent icon set (for example Lucide), line icons only, one stroke weight.
- Let whitespace and ruled lines do the design work. If a screen needs a gradient to look finished, the layout is not finished.

**Builder amendment — 21 November 2026 (public website and desktop presentation):** Add a public landing page, About, Help/FAQ, Contact, Privacy and Terms in task 10A2 before task 10B. Improve the desktop presentation of existing account, project and report screens without changing permissions, costing or immutable evidence. Public content uses labelled fictional examples and describes implemented behavior honestly. Contact uses the builder's confirmed portfolio/GitHub links; do not invent a contact address, testimonials, customer figures or prices. Keep the paper-ledger visual language and verify phone, tablet and desktop widths.

**Builder revision — 22 November 2026 (work UI and optional capture media):** During task 13 acceptance, redesign all existing work screens into focused views with a clear next action. Separate account settings, project overview/progress/records and team administration; distinguish attachments ready on the device, uploaded notes, human review and approved reports. Preserve the paper-ledger design, permissions, exact money and immutable history. Regular site notes may contain a voice note, one to five photos, or both; reject empty capture. Photo-only work quantities are entered and confirmed by a human, never inferred from images. Incoming Telegram files may still save independently into the same draft. The private trial retains its agreed required voice note and zero to three photos. Use relevant public GitHub design guidance without copying another product or earlier project. This is a task 13 follow-up; the remaining deployed report/PDF/approval/amendment phone test still precedes task 14.

**Builder clarification — 23 November 2026 (Telegram landing and active sessions):** The ordinary /start button and the bot’s persistent main Mini App button open the existing landing page first. Keep contextual account, project, report and expiring identity-challenge links direct. Initialize the Telegram SDK before landing-page navigation so signed launch data survives opening account access. A valid active account sees “Open your projects” in place of the landing sign-in action. Keep the public page body static and validate the session through the existing private endpoint; a link label never grants access.

### Core work screens

**Builder clarification — 22 November 2026 (task 12 imagery):** Keep the three existing builder-supplied synthetic demo images for this milestone, with their visible synthetic disclosures and provenance. The builder has no real site photos available yet and will find suitable replacements later. Do not claim these are genuine site evidence, replace historical media, or silently alter locked records.

1. **Today (foreman, mobile):** big record button, today's submission status, link to send via Telegram instead.
2. **Confirm:** extracted items as an editable BoQ-style table, photo findings below, one "Confirm and cost it" button.
3. **Report (web + PDF share the same design):** the daily report, stamped when locked.
4. **Project dashboard:** three lead numbers, BoQ progress table, variance flags.
5. **Dispute log:** newest locked reports and amendments first, ordered by recording timestamp with stable ties, mono type, nothing editable; chronology in storage remains unchanged.
6. **Price list / BoQ settings:** the seed rates, clearly labelled "Demo rates — verify before real use", editable by the PM.
7. **Onboarding:** check project access and confirm a professional name when connecting Telegram. Task 10A adds browser account/recovery, project selection/creation and owner team management; keep each step short and show the selected project.

### States every screen must handle

- **Empty:** no report yet today — say so plainly and show the one action to start.
- **Loading:** transcription and extraction take seconds — show honest progress ("Listening to your note…", "Costing against the BoQ…"), never a frozen screen or a fake instant result.
- **Error:** AI or network failure drops the user into manual entry with their audio and photos preserved. Never lose a submission.
- **Offline:** a visible "Queued — will send when data returns" state, and the queue actually sends on reconnect.
- **Low confidence:** amber highlight with "Check this one" — see section 9.

### Accessibility and field conditions

- Minimum body text 16px on foreman screens; contrast that survives bright sunlight (dark ink on paper background, no light-grey body text).
- Every action usable one-handed; no hover-only interactions anywhere.
- Photos compress before upload (target under 1MB each) — site data is expensive.
- All buttons have plain text labels; never icon-only for a critical action.

### The seeded demo project — make it feel lived-in

Seed one project and use it in every screenshot and the demo video:

- **Project:** "4-Bedroom Duplex, Lekki Phase 1, Lagos" — client name fictional, stated as a demo project in the README.
- **Report firm:** Perkins Limited — builder-selected on 18 November 2026 for task 7's report and PDF heading.
- **History:** 10–14 prior locked daily reports across two weeks, with cumulative progress already at roughly 35–45% on blockwork, one rain delay, one defect that was later amended, and one BoQ item slightly overrunning.
- **Today's demo submission:** the voice note from the demo script — blockwork progress, a concrete pour, a cement delivery, and one visible defect in a photo.

A judge should feel they have opened a working firm's records, not a fresh template.

---

## 13. Advice — what good looks like

- **Demo first, features second.** From day three, the exact demo flow in section 4 must work end to end, even if ugly. Improve a working demo; never build features hoping a demo will assemble itself later.
- **One project, done deeply, beats five shallow ones.** All polish goes into the single seeded project.
- **Record the demo early.** A rough full recording by 28 November exposes every weak step while there is still time to fix it.
- **Keep the human-confirm step centre stage.** It is the honest answer to "but AI makes mistakes" and judges will ask exactly that.
- **Talk like a builder, write like a QS.** The builder's civil engineering background is the credibility moat — the Devpost text, video narration, and PDF should sound like they come from the industry, because they do.

---

## 14. The Kiro evidence plan — 20% of the score lives here

The `/.kiro` directory is not paperwork. It is scored evidence of Technological Implementation. Build it as you go; never reconstruct it in the final week.

### Structure to create on day one

```text
.kiro/
  specs/
    siteledger/
      requirements.md     # user stories from sections 3–4, in EARS-style plain language
      design.md           # architecture from section 7, data model from section 8
      tasks.md            # the build order from section 16, ticked off as done
  steering/
    product.md            # what SiteLedger is, who it serves, the money-not-transcription rule
    tech.md               # stack, the two AI functions rule, the pure costing rule
    costing-rules.md      # formulas from section 10, the never-invent-a-price rule
  hooks/
    # agent hooks: run tests on save of lib/costing, lint on save, README reminder
  agents/                 # or the Crew configuration your Kiro version uses
    voice-agent.md
    vision-agent.md
    costing-agent.md
    safety-agent.md
```

### Kiro Crew — four agents, one job each

| Agent | Job | Input → output |
| --- | --- | --- |
| Voice | Own transcription and extraction quality | Audio → JSON matching the section 9 schema |
| Vision | Own photo analysis | Photos → defect and safety suggestions |
| Costing | Own the price list and `costReport` | Confirmed items → costed report; the only agent allowed near money |
| Safety | Own safety flagging language | Photo findings → plain, careful "possible issue" wording |

Document in the README what each agent did during the build, with one concrete example each. That paragraph is the Best Kiro Crew App ($1,000) case.

### MCP and hooks

- Connect Kiro to the BoQ price list via MCP if your Kiro setup supports it (for example, a small local MCP server reading the seed price list), so the Costing agent works from the same source of truth as the app. If MCP proves unstable by 27 November, drop it and say the Crew used the shared steering file instead — a working entry beats a broken integration.
- Hooks to configure: run costing tests on save, run lint on save, and a hook that warns if a commit touches `/.kiro` ignore rules or `.env` files.
- Commit little and often with plain messages ("Costing: percentage complete tested", "Telegram: voice note intake"). A clean, dated commit history across the build window is itself evidence the project was built in the window.

---

## 15. Build plan — 18 November to 4 December

Submit target: **Wednesday 3 December**. Every phase ends with the demo flow still working.

| Dates | Phase | Done when |
| --- | --- | --- |
| Tue 18 – Thu 20 Nov | Foundation | Repo public, `/.kiro` skeleton committed, Kiro credits requested, Supabase schema live, Telegram bot replies to a voice note |
| Fri 21 – Sun 23 Nov | Core pipeline | Voice → transcript → extraction → confirm screen works in the web app, ugly is fine |
| Mon 24 – Thu 27 Nov | The money edge | Costing engine tested, BoQ seeded, report + PDF, dispute log locked and amendable |
| Fri 28 – Sun 30 Nov | Kiro story + polish | Crew agents documented, MCP attempted, UI pass against section 12, rough demo recorded |
| Mon 1 – Tue 2 Dec | Ship | Final demo video recorded and uploaded public, Devpost text complete, blog post drafted |
| Wed 3 Dec | Submit | Submission sent before evening WAT; all links clicked and tested in a private browser window |
| Thu 4 Dec | Buffer only | Fix a broken link if needed. No new features. No exceptions |

---

## 16. Step-by-step build order for the coding agent

Work in this order. Do not start a task until the previous task's acceptance criteria pass. Each task ends with a commit.

1. **Scaffold.** Create the Next.js + TypeScript + Tailwind app, the folder structure in section 7, `PROJECT_BRIEF.md`, `AGENTS.md`, `.env.example`, and the `/.kiro` skeleton. *Accept:* app runs locally; `/.kiro` is committed and visible on GitHub. Commit: `Scaffold: app, brief, kiro skeleton`.
2. **Schema and seed.** Write the Supabase migrations for section 8 and seed the demo project, BoQ items, and prior reports from section 12. *Accept:* dashboard query returns the seeded project with cumulative figures. Commit: `Data: schema and demo seed`.
3. **Telegram intake.** Bot webhook, `/start` linking, voice and photo saving to storage and `submissions`. *Accept:* a real phone voice note appears as a submission within 10 seconds. Commit: `Telegram: voice and photo intake`.
4. **Transcription and extraction.** Implement `transcribeAndExtract()` with the section 9 schema, glossary, and JSON validation with one retry. *Accept:* the demo voice note produces valid JSON with quantities matching what was said. Commit: `AI: transcription and extraction`.
5. **Confirm screen.** Editable BoQ-style table, confidence highlighting, photo display. *Accept:* every extracted field can be edited; nothing costs before confirm. Commit: `UI: human confirm screen`.
6. **Costing engine.** Write tests for the section 10 formulas first, then `costReport()` until tests pass. *Accept:* all costing tests green; overrun case flags red. Commit: `Costing: engine with tests`.
7. **Report and PDF.** Report web view with the locked stamp; PDF export in the same design. *Accept:* PDF of the seeded demo day looks like a firm's document when printed. Commit: `Report: web view and PDF`.
8. **Dispute log.** Locking, amendment flow, blocked edit/delete. *Accept:* attempting to edit a locked report is impossible in UI and API. Commit: `Log: append-only dispute log`.
9. **Photo analysis.** Implement `analysePhoto()` and show findings as suggestions on the confirm screen. *Accept:* the demo defect photo produces a "possible" finding a human can dismiss. Commit: `AI: photo findings`.
10. **In-app upload and offline queue.** Record/upload in the web app; IndexedDB queue with retry. *Accept:* a submission made in airplane mode sends itself when reconnected. Commit: `Web: upload and offline queue`.
10A. **Browser accounts, project management and authorized teams (builder amendments, 18–19 November 2026).** After the core flow passes, add email/password sign-in, verification and recovery; professional profiles and securely linked Telegram identity; project creation/selection/archive/restore with currency/timezone; owner-controlled targeted invitations, membership removal and role changes per project. Keep foreman and PM work roles and support one-person owner/PM projects. Implement all section 8 access requirements and preserve locked evidence and currency. *Accept:* the section 8 identity, multi-project, solo-project, invitation, authorization/revocation, offline queue, ownership and archive checks pass; a user signs in from another browser and opens only their authorized projects/history. Integrate project dashboards in task 11. Commit: `Accounts: browser access and project management`.
10A1. **Account resilience and action UI (builder request, 21 November 2026).** Before task 10B, fix the reported Cloudflare Turnstile failure, provide custom not-found/application error pages in the site-diary design, and accessible confirmation dialogs describing consequential access, ownership, identity and immutable-record actions. Verify Telegram slash suggestions in private chats as well as the default menu. Preserve server authorization, native CAPTCHA enforcement, human confirmation, locked evidence and all supplied prices. *Accept:* widget failures are diagnosed with recovery guidance; cancellation/Escape makes no mutation, confirmation invokes the existing authorized action once; error pages preserve privacy and provide clear navigation; seven slash commands are verified in default/private and English scopes. Commit: `Fix: account checks and action confirmations`.
10A2. **Public website and desktop presentation (builder request, 21 November 2026).** Add the landing, About, Help/FAQ, Contact, Privacy and Terms pages, shared public navigation/footer and clear signup/demo paths. Apply desktop layouts to existing account, project and report screens. *Accept:* public content is factual and uses labelled fictional examples with supplied BoQ rates; navigation and keyboard access work at phone/tablet/desktop widths; private access and report flows still pass. Commit: `Web: public pages and desktop layouts`.
10B. **Limited private guest trial (builder amendment, 21 November 2026).** After task 10A passes, implement its bounded private upload/draft trial, visible expiry, abuse limits and atomic handover to a verified account with proof of the active guest session. Keep guest approval, locking and team access disabled. *Accept:* strangers cannot read trial work, active-session handover preserves media/attribution exactly once, and expired/forwarded/guessed sessions cannot claim data. Commit: `Trial: private guest capture and account handover`.
11. **Dashboard and price list screens.** Three lead numbers, BoQ progress, variance; editable demo rates with the verify-before-use label, and user-supplied project BoQ rates in the selected currency. Apply section 10's project currency amendment across money displays; never combine totals in different currencies. *Accept:* figures match the costing tests and all money uses the correct project/report currency. Commit: `UI: dashboard and price list`.
12. **UI polish pass.** Apply section 12 fully: palette, type, ruled tables, stamp, real photos, states for empty/loading/error/offline. *Accept:* no item from the "looks AI-generated" list remains on any screen. Commit: `Design: site diary polish`.
13. **Deploy.** Production deploy, environment variables set, Telegram webhook pointed at production, working URL tested on a phone over mobile data. *Accept:* the full demo flow works on the deployed URL, not just locally. Commit: `Ship: production deploy`.

**Builder amendment — 25 November 2026 (approved Telegram and BoQ usability):** Within task 13, restore already-linked Telegram sessions through signed launch verification, preserve landing-first entry and show state-aware navigation. Keep optional linking in account settings and recent website authentication for sensitive actions. Make voice/photo capture prominent before rates exist; missing BoQ prices block costing, not evidence capture. Simplify manual BoQ entry to description, measurement unit, total planned quantity and supplied rate; generate non-financial codes and place code/section in optional details. Add bounded CSV/XLSX import with sheet/header/column selection, editable validated preview, row errors and explicit atomic confirmation. Imports add new items; existing items retain their identities and are edited through the guarded change flow. Show existing BoQ change history and explain stale drafts, preserving locked snapshots. Themes, OCR/PDF/XLS/DOCX import, effective-date scheduling and whole-BoQ versioning remain deferred. Task 13 stays open until the builder's real phone report/approval/amendment flow passes.

13A. **Private product feedback (builder request, 23 November 2026).** After task 13 acceptance, add a private problem/suggestion form reachable from Help and Account, with message and optional reply email. Save submissions in Supabase and track New, Reviewing and Resolved through Supabase Studio; replies are manual. Protect guest submission with CAPTCHA and rate limits, validate input and keep all feedback private. Do not automatically attach site records, passwords, email codes or raw logs. No public review feed, support-chat system, extra app administrator role or notification infrastructure. *Accept:* guest and account submissions work, invalid/abusive requests are rejected, other users cannot read feedback, and the builder can review and mark it through Studio. Commit: `Feedback: private issues and suggestions`.
14. **Kiro write-up and README.** Include product screenshots with captions and alt text, an illustrated workflow, and clear setup/use instructions (builder request, 21 November 2026). How Kiro was used — specs, hooks, steering, Crew, MCP — with one example per Crew agent. *Accept:* a stranger could run the project from the README alone. Commit: `Docs: README and Kiro write-up`.

---

## 17. Testing and QA checklist

**Builder clarification — 22 November 2026 (README coverage and demo video):** After the app and deployment checks are complete, task 14 must give readers the full product flow through useful desktop/mobile screenshots, Telegram bot conversation and voice-note intake captures, human confirmation, BoQ costing, PDF and dispute-log views. Use actual product captures or clearly labelled illustrations; do not present staged conversations as real usage. Prepare a narrated demo video targeting 2:50, within the existing under-three-minute submission rule.

Run this full list on 1 December and again on the morning of 3 December, on the deployed app, on a real Android phone, over mobile data.

- [ ] Full demo flow (section 4) completes in under 2 minutes with no manual database help
- [ ] Costing tests pass; hand-check three items against a calculator, including the overrun item
- [ ] A voice note with Pidgin terms transcribes with the glossary terms intact
- [ ] A low-confidence extraction forces manual entry instead of guessing
- [ ] Invalid AI JSON fails into manual entry; audio and photos are not lost
- [ ] Locked report cannot be edited or deleted from the UI, the API, or a direct request
- [ ] An amendment appears linked to its original, with author and timestamp
- [ ] PDF opens cleanly, prints on A4 without cut-off tables, and shows ₦ figures correctly
- [ ] Telegram: `/start`, voice, photo, `/today`, and stray text all behave per section 11
- [ ] Offline submission queues visibly and sends on reconnect
- [ ] Every screen shows its empty, loading, and error states without breaking layout
- [ ] No API key, bot token, or secret appears anywhere in the GitHub repo — search the repo for `sk-`, `TELEGRAM`, and `SERVICE_ROLE` before submitting
- [ ] `/.kiro` is present at the repo root on GitHub and is not ignored
- [ ] All Devpost links (repo, live app, video) open in a private/incognito window

---

## 18. Risks, watch-outs, and what to avoid

### Disqualifiers and near-disqualifiers

- Reusing an old repo or old project code — the new-project rule is absolute.
- `/.kiro` missing, empty, gitignored, or created in the final week with no history.
- A demo video over 3 minutes, set to private, or showing a flow that does not match the live app.
- Missing the deadline by trusting the countdown over the clock — submit 3 December, in WAT, well before evening.

### Product risks

- **AI-invented prices or quantities.** The fastest way to lose a QS-minded judge and a real user. Prices come only from the price list; quantities come only from the speaker, confirmed by a human.
- **Overclaiming photo AI.** One confidently wrong "defect" in the demo undermines everything. Findings are always "possible", always dismissible.
- **Accent and Pidgin failures.** Test transcription with real site speech early (task 4), not with clean studio recordings in deadline week.
- **Scope creep.** Every "one small feature" in the final week costs demo quality. The cut list in section 5 is final.
- **Secrets in the repo or the video.** One visible bot token means rotating keys under deadline pressure. Check before every recording and before submitting.
- **Cloning prior art.** Use libraries such as Whisper or faster-whisper (MIT) inside this new codebase. Never copy SiteReport AI, FieldScribe, or any existing product's code, text, or design — it breaks the new-project rule and the Innovation score at once.
- **Cloning this brief's demo data into a fake success story.** The seeded project is a demo, labelled as such. Never claim real users, real revenue, or real sites in the submission that do not exist.

### Process risks

- Building in VS Code only and forgetting Kiro until the end — open the project in Kiro weekly at minimum (see section 14).
- Letting the coding agent refactor working code unasked. One task at a time, commit between tasks, revert a task that breaks the demo flow.
- Recording the final video on 4 December. Record on 1–2 December; the 3rd is for submitting, the 4th is buffer.

---

## 19. Submission checklist

### Devpost fields — prepare all of these by 2 December

- [ ] Project name: SiteLedger AI
- [ ] Category: Frankenstein
- [ ] Tagline (one line): "A voice note in. A costed site report out — in ₦, against the BoQ, the same day."
- [ ] Description covering: the problem (section 3), how it works (section 4), the five edges (section 6), the human-confirm rule, Telegram-first with WhatsApp as phase 2, and who would pay for it (small and mid-size Nigerian contractors and QS firms)
- [ ] How Kiro was used: specs, steering, hooks, Crew agents with one example each, MCP note — pulled from the README write-up, not written from memory
- [ ] Built with: Next.js, TypeScript, Supabase, Telegram Bot API, Whisper, Kiro, Kiro Crew
- [ ] GitHub link: public repo, `/.kiro` visible at root
- [ ] Live app link: deployed URL, tested in a private window
- [ ] Video link: public YouTube, under 3 minutes, following the section 4 script
- [ ] Screenshots: confirm screen, costed report, dispute log with the LOCKED stamp, dashboard — all from the seeded demo project

### Blog post outline — bonus prize, draft on 1 December

1. The site problem I kept seeing as an engineer
2. Why voice + Telegram, and why not a dashboard or WhatsApp first
3. Building with Kiro specs and steering instead of prompting blind
4. The Crew split: Voice, Vision, Costing, Safety — and the rule that only Costing touches money
5. The hardest bug and what fixed it (use a real one from the build)
6. What I would build next: WhatsApp intake, QS-verified live price lists, multi-project firms

---

## 20. Ready-made prompts for Codex

Paste one at the start of the relevant session. `AGENTS.md` already points Codex to this brief, so keep prompts short and task-bound.

**Prompt 1 — Scaffold (task 1)**

> Read PROJECT_BRIEF.md sections 2, 7, 8 and 14. Scaffold the project exactly as described: Next.js + TypeScript + Tailwind, the folder structure in section 7, .env.example with only the variable names from section 8, AGENTS.md, and the /.kiro skeleton from section 14. Do not build any feature yet. Show me the file tree and confirm /.kiro is not gitignored before committing.

**Prompt 2 — Costing engine (task 6)**

> Read PROJECT_BRIEF.md section 10. First write unit tests for every formula there, including percentage complete, the overrun flag, and productivity. Then implement the pure costReport function in lib/costing until all tests pass. No AI calls, no network, no database inside this function. Never invent a rate — rates come only from the boq_items data passed in.

**Prompt 3 — Telegram bot (task 3)**

> Read PROJECT_BRIEF.md section 11. Implement the Telegram webhook: /start linking via project code, voice note and photo intake saved to Supabase storage and the submissions table, and the acknowledgement replies using the copy rules in section 11. Verify the webhook secret on every request. Use only TELEGRAM_BOT_TOKEN from the environment — never print or commit it.

**Prompt 4 — UI polish (task 12)**

> Read PROJECT_BRIEF.md section 12 in full. Audit every screen against its "looks AI-generated" list and fix what you find: apply the paper palette and type, ruled BoQ-style tables, tabular ₦ figures, the LOCKED stamp, 48px tap targets on foreman screens, and the empty, loading, error and offline states. No gradients, no glassmorphism, no lorem ipsum, no emoji icons. Show me before-and-after screenshots.

**Prompt 5 — README and Kiro write-up (task 14)**

> Read PROJECT_BRIEF.md sections 14 and 19. Write the README: what SiteLedger is, how to run it from a clean clone, the architecture in section 7, and a "How Kiro was used" section covering specs, steering, hooks, the four Crew agents with one real example each from this repo's history, and the MCP decision. Do not claim features, users, or results that are not in this codebase.

---

## 21. Definition of done

SiteLedger AI is done when all of the following are true at once:

- An invited user can verify their account, confirm a professional name, join only an authorized project, connect Telegram, send a voice note, confirm the extraction, and receive a costed report and PDF without manual database help. An uninvited stranger can view the fictional public demo but cannot access private projects.
- Task 10A's team, multi-project role, solo-project, revocation and archive requirements pass before submission.
- The money maths is tested, hand-checked, and sourced only from the price list.
- A locked report demonstrably cannot be edited, and an amendment can be added.
- The GitHub repo is public, runs from its README, contains a genuine and populated `/.kiro` directory, and contains no secrets.
- The demo video is public, under 3 minutes, and shows the real deployed app doing exactly what the Devpost description claims.
- The submission was sent on **3 December 2026**, with every link verified in a private browser window.

Anything beyond this list is phase 2 — starting with WhatsApp intake, once there is a verified business number and no deadline on the line.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
