# Synthetic demo photo prompts — task 9

Prepared by Codex on 21 November 2026. The builder requested generated site
pictures and selected **save prompts for an image-capable session** because
the built-in image tool is unavailable in this session. Codex did not generate
these images. The builder later supplied three externally generated attachments
on 21 November 2026. Originals and compressed JPEGs are now saved under
`public/demo/photos/`; see [their provenance](../public/demo/photos/PROVENANCE.md).
Actual photo-analysis and dismissal acceptance passed on 21 November 2026;
see the task 9 handoff for actual provider responses and disposable checks.

Follow-up, 21 November 2026: at the builder's request, Codex checked the
configured Gemini and Groq accounts. Gemini lists image-generation models,
but one request to `gemini-3.1-flash-lite-image` using the column prompt returned
HTTP 429 `RESOURCE_EXHAUSTED`, explicitly reporting a free-tier image quota of
zero. Groq's available models cover text and speech, with no image-generation
model. No billing settings were changed and that request produced no image. The
sanitized response is in ignored `supabase/.temp/task-9/image-generation-access.json`.

The four existing Telegram photos depict materials-testing work. Keep their
originals and records unchanged. They are useful for checking whether vision
distinguishes a lab from construction, not for claiming a site defect.

## Copy into an image-capable session

```text
Read PROJECT_BRIEF.md before working. Continue task 9 only. Use the imagegen
skill and the built-in image tool to generate each of the three images below
separately. These are fictional construction demonstration scenes, never
real evidence of Perkins Limited's work or of a real Lekki site.

Inspect each output: plausible construction details, the intended visible
observation, and the exact synthetic label clearly readable. If the label is
wrong, correct it before selecting the output. Keep the label visible after
compression. Save selected JPEGs under public/demo/photos/ at the paths below,
each under 1 MiB, ideally 1200 pixels on its longest edge. Preserve the original
generation files and record the actual tool/model/date in a provenance note.
Do not overwrite existing assets or change real submissions, photos, reports,
amendments, prices or identities. Do not invent findings to satisfy a test.

Run analysePhoto() on the saved images without writing to genuine records.
Record the actual responses and provider status. The column image must yield
a supported possible finding that can be dismissed in a disposable submission.
Test human edits in the confirm screen and their report/PDF output. A failure
or empty result is evidence to investigate, not permission to fabricate success.
Use the three prompts below verbatim, with the filename for each output.
```

## 1. Blockwork — scene and control image

Saved demo copy: `public/demo/photos/synthetic-blockwork.jpg`

```text
Use case: photorealistic-natural
Asset type: clearly labelled synthetic construction demo photograph
Primary request: a believable phone photograph of sandcrete blockwork during
construction of a fictional two-storey duplex in a Lagos residential setting.
Scene/backdrop: unfinished ground-floor walls, an ordinary doorway opening,
stacked spare hollow sandcrete blocks, mortar board and sandy ground.
Subject: a partially completed wall, its block courses and mortar joints
clearly visible. This is the work-progress scene, with no deliberately depicted
defect or safety hazard. Do not add workers.
Style/medium: ordinary documentary phone photo, natural material textures,
slight handheld perspective, no architectural render or advertising treatment.
Composition/framing: landscape 3:2, medium-wide eye-level view, enough context
to recognise masonry under construction. No dimensions or progress markers.
Lighting/mood: soft daylight after a passing shower, neutral and unpolished.
Text (verbatim): "SYNTHETIC DEMO - NOT SITE EVIDENCE"
Constraints: render that exact text in a clearly readable dark sans-serif on a
solid light strip along the lower edge, large enough to read in a phone preview.
The strip is a disclosure overlay, not signage at a real construction site.
Avoid: company logos, real addresses, dates, signatures, quantities, prices,
extra text, catastrophic damage, cinematic lighting or glossy stock imagery.
```

## 2. Concrete column — possible honeycombing

Saved demo copy: `public/demo/photos/synthetic-column-voids.jpg`

```text
Use case: photorealistic-natural
Asset type: clearly labelled synthetic defect demonstration photograph
Primary request: an ordinary phone photograph of a recently exposed reinforced
concrete column in a fictional unfinished duplex, showing a local patch of
surface voids and visible coarse aggregate after formwork removal.
Scene/backdrop: unfinished sandcrete wall and timber formwork pieces behind
the column. No people, test laboratory, text annotations or inspection tools.
Subject: a small irregular patch of rough porous concrete surface near the
column's lower-middle face, with aggregate and shallow voids visibly exposed.
Surrounding concrete is intact. Keep the portrayal plausible, not dramatic.
Style/medium: natural documentary phone photography, realistic concrete grain.
Composition/framing: landscape 3:2, close enough to see the surface texture,
while showing enough of the column and background to establish construction.
Lighting/mood: indirect daylight, sharp focus on the visible surface.
Text (verbatim): "SYNTHETIC DEMO - NOT SITE EVIDENCE"
Constraints: exact readable disclosure on a solid light strip along the lower
edge. Depict the observation only; no diagnosis text, measurements, structural
failure, invented severity, price or implied engineering certification.
Avoid: collapsed columns, large cracks, exposed steel, lab specimens, arrows,
circles, branded signage, real project names, dates or extra text.
```

## 3. Work at an edge — possible safety concern

Saved demo copy: `public/demo/photos/synthetic-unprotected-edge.jpg`

```text
Use case: photorealistic-natural
Asset type: clearly labelled synthetic construction safety demo photograph
Primary request: an ordinary phone photograph of an unfinished upper-floor
slab in a fictional two-storey duplex, showing a visibly open perimeter edge
without a temporary guardrail. A worker is standing several steps back from
the edge, carrying no load, with helmet and work boots clearly visible.
Scene/backdrop: unfinished concrete and blockwork, ordinary neighbouring
residential construction in soft focus. No company branding or real address.
Subject: the open slab edge and the area around it, with enough context to
recognise a possible need for fall protection. No person falling or injured.
Style/medium: candid documentary phone photo, plausible construction details,
natural clothing and materials, no heroic or promotional pose.
Composition/framing: landscape 3:2, medium-wide view from within the slab area.
Show the lack of a rail clearly without inventing an exact fall height.
Lighting/mood: neutral cloudy daylight.
Text (verbatim): "SYNTHETIC DEMO - NOT SITE EVIDENCE"
Constraints: exact readable disclosure on a solid light strip along the lower
edge. Depict a visible situation; no hazard labels, compliance claims, dimensions
or claims about hidden harness attachments. The worker is fictional.
Avoid: injury, imminent fall, gratuitous unsafe behaviour, missing helmets,
company logos, dates, arrows, measurements, prices or extra text.
```

## Completion evidence to retain

For each selected output, record its saved path, prompt, actual generation
tool/model/date, compression and visible disclosure. Keep the provider response
and test screenshots under the ignored `supabase/.temp/task-9/` directory;
summarise observed findings in the task handoff. Show uncertainty and allow
dismissal. Never infer quantities or costs from any image.

These synthetic scenes can demonstrate the workflow. They do not validate
accuracy on real sites or replace the real voice-note tests. Task 9's live
defect-photo acceptance passed with actual analysis and human-dismissal checks
on 21 November 2026; see the task 9 handoff. This does not establish real-site accuracy.
