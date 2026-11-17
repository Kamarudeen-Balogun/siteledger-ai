---
inclusion: always
---

# Technical steering

Use Next.js App Router, TypeScript, Tailwind CSS, Supabase, a Telegram webhook, and server-rendered PDFs. Prefer server components and keep phone-side JavaScript small.

All AI calls belong in the server functions `transcribeAndExtract()` and `analysePhoto()`. All money calculations belong in the pure function `costReport(items, priceList)`.

Keep credentials in environment variables. Never expose server secrets to the client or commit real environment files. Track `.kiro` in Git.

Preserve raw transcripts and submission media. Require human confirmation before costing. Block updates and deletion of locked reports; corrections are linked, append-only amendments.

Run `npm run lint`, `npm run typecheck`, and `npm run build` for scaffold changes. Configure and run costing tests when task 6 is reached.
