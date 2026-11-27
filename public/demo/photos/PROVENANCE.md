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

## Added 27 November 2026 — demo Today photos and voice notes

Four further synthetic test photos from the builder's test-photo set
(`siteledger-test-photos`, November 2026), compressed with ffmpeg to 1200 px
wide WebP quality 70 for the demo Today notes. They are synthetic test
images, never real site evidence, and are labelled as demo photos in the app.

| Scene | Demo WebP | Size | SHA-256 |
| --- | --- | ---: | --- |
| Blockwork | `demo-blockwork.webp` | 136,206 bytes | `fcf7abc03ed3e6ecda735b8cf3cd20bab8b23ba517cbb686bc8d342aa4b2726d` |
| Concrete pour | `demo-concrete-pour.webp` | 182,722 bytes | `916eee4766c7dfb0244a8b377a2666a995cfb9dfbdb46ea041b970cc0eda76a0` |
| Cement bags | `demo-cement-bags.webp` | 148,062 bytes | `1fd90bb8fa1018a88d001aaa33d32a633be9af32da5fc50fc7071e8068abc636` |
| Excavation | `demo-excavation.webp` | 213,932 bytes | `290ff2ddc0b2f8e83e3ebb9af9b00af61ae47213f8cad294517e6229b3d9dd51` |

Three demo voice notes in `public/demo/audio/`, generated 27 November 2026
with gTTS (Nigerian English, `com.ng`) reading the demo notes' transcripts.
They are synthetic demo recordings, clearly labelled as demo audio in the app,
and are never presented as real site recordings.

| Note | File | Duration | SHA-256 |
| --- | --- | ---: | --- |
| Locked report, 6 Nov 2026 | `note-1-locked.mp3` | 39.2 s | `a5b0e72de3f2c6e735d8745603b38a41b18b7ffef912a16bcca17e584356b414` |
| Costed draft, 6 Nov 2026 | `note-2-costed.mp3` | 26.5 s | `37cf321e668e09ff019d539b74faad53cc0b65e4cd44b7b273498c314a81caa2` |
| Uncosted draft, 6 Nov 2026 | `note-3-draft.mp3` | 19.3 s | `f2af605f3f752d21e1ece5b70f323d577b7de45e8ad1fdd8f83ac610854b9b1c` |
