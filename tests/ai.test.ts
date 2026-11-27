import assert from "node:assert/strict";
import { test } from "node:test";
import { parseExtraction, type SiteExtraction } from "../lib/ai/extraction-schema";
import { extractWorkCandidates, normalizeDescription, wordsToNumber } from "../lib/ai/number-words";
import { transcribeAndExtract, type PipelineDependencies } from "../lib/ai/transcribe-and-extract";
import { processSubmission, type ProcessingDependencies } from "../lib/ai/process-submission";
import { extractionPrompt } from "../lib/ai/prompts";

const transcript = "We don set eighteen square metres of 225mm blockwork, six boys. Forty bags cement delivered. Rain stopped work two hours.";
const valid: SiteExtraction = {
  work_items: [{ description: "We don set blockwork", matched_boq_hint: "Sandcrete blocks 225mm hollow, laid",
    quantity: 18, unit: "m2", crew: 6, confidence: 0.9 }],
  materials: [{ name: "Cement", quantity: 40, unit: "bags", action: "delivered", confidence: 0.9 }],
  delays: [{ reason: "Rain stopped work", hours: 2, confidence: 0.9 }], issues: [],
  raw_language_notes: "Pidgin: 'we don set'; 'boys' means crew.",
};
const audio = { bytes: new Uint8Array([1, 2, 3]), filename: "voice.ogg", contentType: "audio/ogg" };
const hints = [{ description: "Sandcrete blocks 225mm hollow, laid", unit: "m2" }];

test("exact schema rejects extra money fields, wrong types and invalid confidence", () => {
  assert.deepEqual(parseExtraction(JSON.stringify(valid)), valid);
  for (const changed of [
    { ...valid, total_cost: 261000 },
    { ...valid, work_items: [{ ...valid.work_items[0], rate: 14500 }] },
    { ...valid, work_items: [{ ...valid.work_items[0], quantity: "18" }] },
    { ...valid, work_items: [{ ...valid.work_items[0], confidence: 1.1 }] },
    { ...valid, work_items: [{ ...valid.work_items[0], crew: 0 }] },
    { ...valid, work_items: [{ ...valid.work_items[0], quantity: -1 }] },
  ]) assert.equal(parseExtraction(JSON.stringify(changed)), null);
  assert.equal(parseExtraction("```json\n" + JSON.stringify(valid) + "\n```"), null);
});
test("missing spoken values remain null and require low confidence", () => {
  const missing = { ...valid, work_items: [{ ...valid.work_items[0], quantity: null, unit: null, crew: null, confidence: 0.3 }] };
  assert.ok(parseExtraction(JSON.stringify(missing)));
  missing.work_items[0].confidence = 0.8;
  assert.equal(parseExtraction(JSON.stringify(missing)), null);
});
test("spoken numbers become digits and standard units in descriptions", () => {
  assert.equal(wordsToNumber("eighteen"), 18);
  assert.equal(wordsToNumber("two hundred and twenty-five"), 225);
  assert.equal(wordsToNumber("forty"), 40);
  assert.equal(wordsToNumber("1,800"), 1800);
  assert.equal(wordsToNumber("and"), null);
  assert.equal(wordsToNumber("some"), null);
  assert.equal(normalizeDescription("eighteen square metres of two hundred and twenty-five millimetre blockwork on the east elevation"),
    "18 m² of 225mm blockwork on the east elevation");
  assert.equal(normalizeDescription("Two cubic metres of concrete cast today."), "2 m³ of concrete cast today.");
  assert.equal(normalizeDescription("Blockwork — East elevation"), "Blockwork — East elevation");
});
test("a transcript that states a quantity the model missed still produces a checkable work item", async () => {
  const spoken = "We don set eighteen square metres of 225mm blockwork on the east elevation. Forty bags cement delivered. Rain stopped work two hours.";
  const empty: SiteExtraction = { ...valid, work_items: [], raw_language_notes: "" };
  const result = await transcribeAndExtract(null, hints, { existingTranscript: spoken }, {
    transcribe: async () => { throw new Error("must reuse transcript"); },
    extract: async () => JSON.stringify(empty),
  });
  assert.equal(result.status, "extracted");
  assert.deepEqual(result.extraction?.work_items, [{ description: "18 m² of 225mm blockwork on the east elevation",
    matched_boq_hint: "Sandcrete blocks 225mm hollow, laid", quantity: 18, unit: "m2", crew: null, confidence: 0.7 }]);
  assert.equal(result.extraction?.materials[0].quantity, 40);
});
test("no stated quantity means no recovered work item", async () => {
  const spoken = "Rain stopped work two hours. Clearing was not done on yesterday's slab.";
  const empty: SiteExtraction = { ...valid, work_items: [], materials: [],
    delays: [{ reason: "Rain stopped work", hours: 2, confidence: 0.9 }],
    issues: ["Clearing was not done on yesterday's slab."], raw_language_notes: "" };
  const result = await transcribeAndExtract(null, hints, { existingTranscript: spoken }, {
    transcribe: async () => { throw new Error("must reuse transcript"); },
    extract: async () => JSON.stringify(empty),
  });
  assert.equal(result.status, "extracted");
  assert.deepEqual(result.extraction?.work_items, []);
});
test("a bare dimension never becomes a work quantity", () => {
  assert.deepEqual(extractWorkCandidates("The 225 millimetre blockwork is on the east elevation.", hints), []);
  assert.deepEqual(extractWorkCandidates("We did 18 square metres of 225mm blockwork on the east elevation.", hints),
    [{ description: "18 m² of 225mm blockwork on the east elevation", matched_boq_hint: "Sandcrete blocks 225mm hollow, laid",
      quantity: 18, unit: "m2", crew: null, confidence: 0.7 }]);
});
test("a number-words dimension stays in the description instead of truncating it", () => {
  assert.deepEqual(extractWorkCandidates("For the leaky site, we don't set 18 square meters of two hundred and twenty-five millimetre blockwork on the east elevation and cast 2 cubic metres of concrete for the columns.",
    [...hints, { description: "In-situ concrete, columns and beams", unit: "m3" }]),
    [{ description: "18 m² of 225mm blockwork on the east elevation", matched_boq_hint: "Sandcrete blocks 225mm hollow, laid",
      quantity: 18, unit: "m2", crew: null, confidence: 0.7 },
     { description: "2 m³ of concrete for the columns", matched_boq_hint: "In-situ concrete, columns and beams",
      quantity: 2, unit: "m3", crew: null, confidence: 0.7 }]);
  assert.deepEqual(extractWorkCandidates("We did 18 square metres of 225 millimetre blockwork on the east elevation.", hints),
    [{ description: "18 m² of 225mm blockwork on the east elevation", matched_boq_hint: "Sandcrete blocks 225mm hollow, laid",
      quantity: 18, unit: "m2", crew: null, confidence: 0.7 }]);
});
test("digit quantities with superscript units are recovered and a trailing preposition is dropped", () => {
  assert.deepEqual(extractWorkCandidates("We set 18 m² of 225mm blockwork on the east elevation and cast 2 m³ of concrete for the columns.",
    [...hints, { description: "In-situ concrete, columns and beams", unit: "m3" }]),
    [{ description: "18 m² of 225mm blockwork on the east elevation", matched_boq_hint: "Sandcrete blocks 225mm hollow, laid",
      quantity: 18, unit: "m2", crew: null, confidence: 0.7 },
     { description: "2 m³ of concrete for the columns", matched_boq_hint: "In-situ concrete, columns and beams",
      quantity: 2, unit: "m3", crew: null, confidence: 0.7 }]);
  assert.deepEqual(extractWorkCandidates("We set 18 m² of 225mm blockwork on.", hints),
    [{ description: "18 m² of 225mm blockwork", matched_boq_hint: "Sandcrete blocks 225mm hollow, laid",
      quantity: 18, unit: "m2", crew: null, confidence: 0.7 }]);
});
test("transcript is checkpointed unchanged before extraction and BoQ prompt strips rates", async () => {
  const events: string[] = [];
  const dependencies: PipelineDependencies = {
    transcribe: async () => ({ text: "  " + transcript + "\n", detectedLanguages: ["en", "pcm"] }),
    extract: async (text) => { assert.equal(text, "  " + transcript + "\n"); events.push("extract"); return JSON.stringify(valid); },
  };
  const result = await transcribeAndExtract(audio, hints, { onTranscript: async (value) => {
    assert.equal(value.text, "  " + transcript + "\n"); events.push("checkpoint");
  } }, dependencies);
  assert.equal(result.status, "extracted");
  assert.deepEqual(events, ["checkpoint", "extract"]);
  const withRate = { ...hints[0], rate: 14500 };
  assert.ok(!extractionPrompt([withRate]).includes("14500"));
});
test("invalid JSON retries once; success uses the identical raw transcript", async () => {
  let calls = 0;
  const result = await transcribeAndExtract(audio, hints, {}, {
    transcribe: async () => ({ text: transcript, detectedLanguages: ["en"] }),
    extract: async (text, _hints, retry) => {
      assert.equal(text, transcript); assert.equal(retry, calls > 0);
      return ++calls === 1 ? "{" : JSON.stringify(valid);
    },
  });
  assert.equal(result.status, "extracted"); assert.equal(calls, 2);
});
test("two invalid outputs give manual entry without losing the raw transcript", async () => {
  let calls = 0;
  const result = await transcribeAndExtract(audio, hints, {}, {
    transcribe: async () => ({ text: transcript, detectedLanguages: ["en"] }),
    extract: async () => { calls++; return JSON.stringify({ ...valid, total_cost: 1 }); },
  });
  assert.equal(result.status, "manual_entry"); assert.equal(result.transcript, transcript);
  assert.equal(result.extraction, null); assert.equal(calls, 2);
});
test("provider failure without a configured alternate does not trigger repeated requests", async () => {
  let calls = 0;
  const result = await transcribeAndExtract(audio, hints, {}, {
    transcribe: async () => { calls++; throw new Error("quota exceeded, secret provider URL"); },
    extract: async () => { throw new Error("should never run"); },
  });
  assert.deepEqual(result, { status: "manual_entry", transcript: null, detectedLanguages: [], extraction: null, error: "transcription_failed" });
  assert.equal(calls, 1);
});
test("voice fallback runs once and its unchanged transcript is saved before extraction", async () => {
  const events: string[] = [];
  const result = await transcribeAndExtract(audio, hints, { onTranscript: async (value) => {
    assert.equal(value.text, transcript); events.push("save");
  } }, {
    transcribe: async () => { events.push("primary voice"); throw new Error("503"); },
    transcriptionFallback: async () => { events.push("alternate voice"); return { text: transcript, detectedLanguages: ["english"] }; },
    extract: async () => { events.push("extract"); return JSON.stringify(valid); },
  });
  assert.equal(result.status, "extracted");
  assert.deepEqual(events, ["primary voice", "alternate voice", "save", "extract"]);
});
test("extraction uses at most two generations across failure and invalid JSON", async () => {
  for (const primaryOutput of ["http failure", "invalid JSON"]) {
    const events: string[] = [];
    const result = await transcribeAndExtract(null, hints, { existingTranscript: transcript }, {
      transcribe: async () => { throw new Error("must reuse transcript"); },
      extract: async (text, _hints, retry) => {
        assert.equal(text, transcript); assert.equal(retry, false); events.push("primary");
        if (primaryOutput === "http failure") throw new Error("429");
        return "{";
      },
      extractionFallback: async (text, _hints, retry) => {
        assert.equal(text, transcript); assert.equal(retry, true); events.push("alternate"); return JSON.stringify(valid);
      },
    });
    assert.equal(result.status, "extracted"); assert.deepEqual(events, ["primary", "alternate"]);
  }
});
test("exhausted alternates preserve transcript and never make a third extraction call", async () => {
  let calls = 0;
  const result = await transcribeAndExtract(null, hints, { existingTranscript: transcript }, {
    transcribe: async () => { throw new Error("must reuse transcript"); },
    extract: async () => { calls++; throw new Error("503"); },
    extractionFallback: async () => { calls++; return "{}"; },
  });
  assert.equal(result.status, "manual_entry"); assert.equal(result.transcript, transcript);
  assert.equal(result.extraction, null); assert.equal(calls, 2);
});
test("failed voice alternates stop without extraction; empty audio never calls providers", async () => {
  let calls = 0;
  const dependencies: PipelineDependencies = {
    transcribe: async () => { calls++; throw new Error("503"); },
    transcriptionFallback: async () => { calls++; throw new Error("429"); },
    extract: async () => { throw new Error("must not run"); },
  };
  assert.equal((await transcribeAndExtract(audio, hints, {}, dependencies)).status, "manual_entry");
  assert.equal(calls, 2);
  assert.equal((await transcribeAndExtract({ ...audio, bytes: new Uint8Array() }, hints, {}, dependencies)).status, "manual_entry");
  assert.equal(calls, 2);
});
test("existing multilingual transcript skips audio transcription and preserves the language", async () => {
  const spanish = "Colocamos dieciocho metros cuadrados de bloques con seis trabajadores.";
  const result = await transcribeAndExtract(null, hints, { existingTranscript: spanish, detectedLanguages: ["es"] }, {
    transcribe: async () => { throw new Error("must not retranscribe"); },
    extract: async (text) => { assert.equal(text, spanish); return JSON.stringify({ ...valid,
      work_items: [{ ...valid.work_items[0], description: "Colocamos bloques" }], raw_language_notes: "Spanish site note" }); },
  });
  assert.equal(result.transcript, spanish); assert.deepEqual(result.detectedLanguages, ["es"]);
});
test("transcript persistence failure propagates before any extraction", async () => {
  let extracted = false;
  await assert.rejects(transcribeAndExtract(audio, hints, { onTranscript: async () => { throw new Error("database unavailable"); } }, {
    transcribe: async () => ({ text: transcript, detectedLanguages: [] }),
    extract: async () => { extracted = true; return JSON.stringify(valid); },
  }), /database unavailable/);
  assert.equal(extracted, false);
});
test("Gemini request uses header credentials, automatic detection and the documented JSON response", async () => {
  const savedFetch = globalThis.fetch, savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], "test-gemini-key");
    const body = JSON.parse(init?.body as string);
    assert.equal(body.generationConfig.responseMimeType, "application/json"); assert.equal(body.tools, undefined);
    const content = calls++ === 0 ? JSON.stringify({ text: transcript, detected_languages: ["en", "pcm"] }) : JSON.stringify(valid);
    if (calls === 1) assert.equal(body.contents[0].parts[0].inlineData.mimeType, "audio/ogg");
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: content }] } }] });
  };
  try { assert.equal((await transcribeAndExtract(audio, hints)).status, "extracted"); assert.equal(calls, 2); }
  finally { globalThis.fetch = savedFetch; if (savedKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedKey; }
});

async function withProviders(keys: Record<string, string>, callback: () => Promise<void>) {
  const names = ["GROQ_API_KEY", "GEMINI_API_KEY", "GONKAROUTER_API_KEY"];
  const savedKeys = names.map((name) => process.env[name]);
  const savedFetch = globalThis.fetch;
  for (const name of names) {
    if (keys[name]) process.env[name] = keys[name]; else delete process.env[name];
  }
  try { await callback(); }
  finally {
    globalThis.fetch = savedFetch;
    names.forEach((name, i) => { if (savedKeys[i] === undefined) delete process.env[name]; else process.env[name] = savedKeys[i]; });
  }
}
test("Groq sends multilingual Whisper audio and strict extraction with credentials only in headers", async () => {
  await withProviders({ GROQ_API_KEY: "test-groq" }, async () => {
    const requests: string[] = [];
    globalThis.fetch = async (url, init) => {
      requests.push(String(url));
      assert.ok(!String(url).includes("test-groq"));
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-groq");
      if (String(url).endsWith("audio/transcriptions")) {
        const body = init?.body as FormData;
        assert.equal(body.get("model"), "whisper-large-v3-turbo"); assert.equal(body.get("language"), null);
        assert.equal(body.get("response_format"), "verbose_json");
        assert.equal((body.get("file") as Blob).type, "audio/ogg");
        return Response.json({ text: "  " + transcript + "\n", language: "english" });
      }
      const body = JSON.parse(init?.body as string);
      assert.equal(body.model, "openai/gpt-oss-120b"); assert.equal(body.tools, undefined);
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.messages[1].content, JSON.stringify({ raw_transcript: "  " + transcript + "\n" }));
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(valid) } }] });
    };
    const result = await transcribeAndExtract(audio, hints);
    assert.equal(result.status, "extracted"); assert.equal(result.transcript, "  " + transcript + "\n");
    assert.deepEqual(result.detectedLanguages, ["english"]);
    assert.deepEqual(requests, ["https://api.groq.com/openai/v1/audio/transcriptions", "https://api.groq.com/openai/v1/chat/completions"]);
  });
});
test("GonkaRouter fallback follows a Groq quota failure without invoking a third provider", async () => {
  await withProviders({ GROQ_API_KEY: "test-groq", GONKAROUTER_API_KEY: "test-gonka", GEMINI_API_KEY: "test-gemini" }, async () => {
    const requests: string[] = [];
    globalThis.fetch = async (url, init) => {
      requests.push(String(url));
      if (requests.length === 1) return new Response("private error body", { status: 429 });
      assert.equal(String(url), "https://api.gonkarouter.io/v1/chat/completions");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer test-gonka"); assert.equal(headers["X-Gonka-No-Fallback"], "true");
      const body = JSON.parse(init?.body as string);
      assert.equal(body.model, "zai-org/GLM-5.3-Flash"); assert.equal(body.max_tokens, 4000);
      assert.equal(body.response_format, undefined);
      assert.equal(body.messages[1].content, JSON.stringify({ raw_transcript: transcript }));
      assert.ok(body.messages[0].content.includes('"additionalProperties":false'));
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(valid) } }] });
    };
    assert.equal((await transcribeAndExtract(null, hints, { existingTranscript: transcript })).status, "extracted");
    assert.equal(requests.length, 2);
  });
});
test("a truncated GonkaRouter response becomes manual entry without accepting partial JSON", async () => {
  await withProviders({ GONKAROUTER_API_KEY: "test-gonka" }, async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(valid) } }] }); };
    const result = await transcribeAndExtract(null, hints, { existingTranscript: transcript });
    assert.equal(result.status, "manual_entry"); assert.equal(calls, 1); assert.equal(result.transcript, transcript);
  });
});
test("GonkaRouter decodes one whole JSON fence, while strict validation still rejects prose and extra money", async () => {
  await withProviders({ GONKAROUTER_API_KEY: "test-gonka" }, async () => {
    for (const [content, expected] of [
      ["```json\n" + JSON.stringify(valid) + "\n```", "extracted"],
      ["Here is your result:\n```json\n" + JSON.stringify(valid) + "\n```", "manual_entry"],
      ["```json\n" + JSON.stringify({ ...valid, total_cost: 1 }) + "\n```", "manual_entry"],
      ["```json\n{\n```", "manual_entry"],
    ]) {
      globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
      const result = await transcribeAndExtract(null, hints, { existingTranscript: transcript });
      assert.equal(result.status, expected); assert.equal(result.transcript, transcript);
    }
  });
});
test("processor leases prevent duplicate AI work and releases failed persistence for recovery", async () => {
  const events: string[] = [];
  const dependencies: ProcessingDependencies = {
    claim: async () => ({ submission_id: "id", audio_url: "stored", content_type: "audio/ogg", transcript, detected_languages: ["en"], boq_hints: hints }),
    download: async () => { throw new Error("must reuse transcript"); },
    saveTranscript: async () => { throw new Error("not needed"); },
    pipeline: async () => ({ status: "extracted", transcript, detectedLanguages: ["en"], extraction: valid }),
    finish: async () => { events.push("finish"); throw new Error("temporary database failure"); },
    release: async () => { events.push("release"); },
  };
  assert.equal(await processSubmission("id", dependencies), "queued"); assert.deepEqual(events, ["finish", "release"]);
  dependencies.claim = async () => null;
  events.length = 0;
  assert.equal(await processSubmission("id", dependencies), "skipped"); assert.deepEqual(events, []);
});
