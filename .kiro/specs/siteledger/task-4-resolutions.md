# Task 4 implementation and review resolutions

Recorded by Codex on 18 November 2026. The builder completed the two real Kiro chats documented in `task-4-review.md`. That Kiro-owned file and its hook are preserved. This file records subsequent implementation and verification; it is not another Kiro review.

## Changes following the Kiro review

- The builder requires a free build. OpenAI was removed from the configured providers and `.env.example`. Two Gemini audio attempts returned HTTP 503; the builder subsequently provided Groq Free-plan and GonkaRouter starter-account keys.
- The final task 4 pipeline uses Groq `whisper-large-v3-turbo` and `openai/gpt-oss-120b`, with optional Gemini audio and GonkaRouter `zai-org/GLM-5.3-Flash` alternates. Both new accounts authenticated and returned the selected model IDs. Each stage has at most two requests/generations; extraction's invalid-JSON retry is included in that budget. No top-up or billing API is configured. GonkaRouter has a limited one-million-token starter allowance.
- Groq extraction uses documented strict JSON Schema. GonkaRouter uses its documented chat endpoint with a schema in the prompt; JSON-object mode timed out in live checks, so it is not configured. A whole Markdown JSON fence is decoded as a provider envelope, followed by the same strict local validation. Prose, broken JSON, unknown fields, and invented money remain invalid. The raw speech transcript is never changed by this decoding.
- The job lease, transcript checkpoint, finalization, and recovery RPCs are applied to the SiteLedger hosted project and checked locally. Provider failures preserve media and a private manual-entry result; the confirm/manual-entry UI is task 5. Nothing is automatically confirmed, costed, or locked.
- [Published language coverage](../../../docs/voice-languages.md) now lists upstream Whisper's language vocabulary and separates it from actual speech tests. The detected language label can be wrong; no universal accuracy claim is made.
- A real Pidgin recording exposed `don` being transcribed as `don't`. Whisper now receives short vocabulary/style context rather than chat instructions. A read-only recheck recovered the spoken work quantities while preserving the original saved transcript. The original model still struggled with curing, crew punctuation and eighteen. On the final recording, Turbo captured all expected quantities and crew, preserved curing and `don`, and detected English. It is now the default. The original persisted transcript/extraction are retained; their misheard field requires human correction at task 5.

## Verification

- 18 AI unit tests cover schema validation, missing quantities, unchanged checkpoints, retries, provider fallback and exhaustion, request formats, whole-fence decoding, private recovery, and truncated responses.
- Eight Telegram tests, local AI database checks, existing record-protection checks, TypeScript, lint, and the production build pass.
- Groq successfully extracted the original saved no-quantity transcript without inventing work.
- A synthetic known-quantity text test simulated a Groq HTTP 503 and used the real GonkaRouter endpoint. It returned valid extraction with quantities 18/2, crews 6/4, 40 cement bags, and a two-hour delay. This is a real extraction fallback test with a simulated primary outage; it is not a GonkaRouter voice test.
- The updated production preview runs on port 3011 behind the existing ngrok tunnel. The webhook rejects an unsigned request with HTTP 401, and Telegram's configured webhook matches that tunnel.
- Task 4 acceptance passed: the final default provider processed the builder’s saved Telegram audio in a read-only check, returning quantities 18/2, crews 6/4, 40 cement bags, a two-hour delay, and curing. This check changed no original evidence. A separate live ambiguous-quantity test returned null with low confidence instead of inventing 1. The task is marked complete in `tasks.md` and uses commit message `AI: transcription and extraction`.

## Kiro evidence limits

The Kiro review records creation of the lint-on-save hook and manual lint/type checks. It does not establish an actual hook run. Preserve that distinction; a configured hook alone is not an executed hook. Current official hook documentation describes `PostFileSave` as an agent-save event, so the review's editor-save explanation is a hypothesis rather than a verified cause.

The review's statement that only the scaffold was committed is corrected by repository history: tasks 1–3 are committed, including `4d011ec Telegram: voice and photo intake`. The final provider change postdates Kiro's Gemini review and must not be attributed to Kiro. Credit approval, Crew execution, and the full hackathon evidence write-up remain outstanding later work.
