// Demo assets (synthetic voice notes + test photos) and the landing-page
// sample screenshot are stored in the repo as base64 text under assets/
// and decoded into public/ by this script, because the push route for this
// repo cannot carry binary files.
// The decoded files are the assets the app serves; the .b64 sources are
// the tracked source of truth. Idempotent: re-decodes every run, so a
// changed source always wins over a stale decoded file. Run automatically
// before `next build` and `next dev` (package.json prebuild / predev).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  ["assets/demo/audio/note-1-locked.mp3.b64", "public/demo/audio/note-1-locked.mp3"],
  ["assets/demo/audio/note-2-costed.mp3.b64", "public/demo/audio/note-2-costed.mp3"],
  ["assets/demo/audio/note-3-draft.mp3.b64", "public/demo/audio/note-3-draft.mp3"],
  ["assets/demo/photos/demo-blockwork.webp.b64", "public/demo/photos/demo-blockwork.webp"],
  ["assets/demo/photos/demo-concrete-pour.webp.b64", "public/demo/photos/demo-concrete-pour.webp"],
  ["assets/demo/photos/demo-cement-bags.webp.b64", "public/demo/photos/demo-cement-bags.webp"],
  ["assets/demo/photos/demo-excavation.webp.b64", "public/demo/photos/demo-excavation.webp"],
  // Landing-page sample record (README screenshot, cropped): served at
  // /sample-record.webp by app/page.tsx.
  ["assets/sample-record.webp.b64", "public/sample-record.webp"],
];

for (const [source, target] of sources) {
  const encoded = readFileSync(join(root, source), "utf8").replace(/\s/g, "");
  const bytes = Buffer.from(encoded, "base64");
  const targetPath = join(root, target);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, bytes);
  console.log(`demo assets: decoded ${source} -> ${target} (${bytes.length} bytes)`);
}

// Fail loudly if any expected source is missing so a broken demo never
// ships silently (readFileSync above already throws, this is the guard
// for a truncated source list).
const missing = sources.filter(([source]) => !existsSync(join(root, source)));
if (missing.length) throw new Error(`demo assets: missing sources: ${missing.map(([s]) => s).join(", ")}`);
