# Synthetic demonstration images

Received from the builder as three chat image attachments on 21 November 2026.
These are fictional demonstration scenes, not evidence of a real site or of
Perkins Limited's work. Every image visibly includes:

**SYNTHETIC DEMO - NOT SITE EVIDENCE**

The builder generated these outside Codex. The website, model and original
generation date were not supplied; do not attribute them to a specific provider.
[The supplied prompt set](../../../docs/demo-photo-prompts.md) describes the
intended scenes, but exact use of those prompts has not been confirmed.

## Saved files

| Scene | Demo JPEG | Size | Original PNG |
| --- | --- | ---: | --- |
| Blockwork | `synthetic-blockwork.jpg` | 184,310 bytes | `originals/synthetic-blockwork.png` |
| Column surface voids | `synthetic-column-voids.jpg` | 118,308 bytes | `originals/synthetic-column-voids.png` |
| Open slab edge | `synthetic-unprotected-edge.jpg` | 112,041 bytes | `originals/synthetic-unprotected-edge.png` |

The received PNG bytes are preserved unchanged at 2496 × 1664 pixels. Codex
created 1200 × 800 JPEG copies using Sharp, quality 85 with mozjpeg, without
cropping or removing the disclosure. All three copies are below 1 MiB. Their
disclosures and intended scenes were visually checked after compression.
Saving and inspection involved no AI generation or database writes.

## SHA-256 of received originals

| Original | SHA-256 |
| --- | --- |
| `synthetic-blockwork.png` | `5200ec19561d786fb7d849e3092774e8ca73c9e187a9c7f055d8f93968c9c089` |
| `synthetic-column-voids.png` | `80fb6c65fb7b5f700d05603246a40e7c770c13cffb1901cd92acf612bf475d7e` |
| `synthetic-unprotected-edge.png` | `ca6ff7f4ab6dc7348e13848f1ce639e5f21d972660501b5951347851daae5fb2` |

## SHA-256 of demo copies

| JPEG | SHA-256 |
| --- | --- |
| `synthetic-blockwork.jpg` | `63f1f417ce1c684abcd88274ac5a2a3ae2cf33e0ee90e255056a3209f3434164` |
| `synthetic-column-voids.jpg` | `7cf5ee0367d9c258a3cfbb1e2305709bf63999faa520ee5a28a4e7abcaf9433b` |
| `synthetic-unprotected-edge.jpg` | `e57ed7248c160956c19da14864a1a245a50d7363dc9b7556c2ad7201f4a62d77` |

Actual `analysePhoto()` calls using Gemini 3.5 Flash-Lite and mobile/desktop
dismissal acceptance passed on 21 November 2026; see the task 9 handoff for
responses, preserved failure evidence and the disposable report/PDF checks.
Synthetic scenes can demonstrate the workflow; they do not establish detector
accuracy on real sites. Keep them separate from genuine submissions and records.
