import type { BoqHint, WorkItem } from "./extraction-schema";

// Deterministic spoken-number handling for site transcripts. Voice notes
// state quantities in words ("eighteen square metres", "two hundred and
// twenty-five millimetre blockwork"), and the extraction model sometimes
// drops the work item entirely instead of recording the stated number.
// Everything here comes from the transcript itself: no quantity is ever
// estimated or invented, and every candidate it produces is flagged for
// human confirmation on the Confirm screen.

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUMBER_WORDS = new Set([...Object.keys(ONES), ...Object.keys(TENS), "hundred", "thousand", "and"]);
const NUMBER_WORD = Object.keys(ONES).concat(Object.keys(TENS), ["hundred", "thousand", "and"]).join("|");
const NUMBER_RUN = new RegExp(`\\b(?:${NUMBER_WORD})(?:[ -](?:${NUMBER_WORD}))*\\b`, "gi");

function parseNumberWords(words: string[]): number | null {
  let total = 0, current = 0, seen = false;
  for (const word of words) {
    if (word === "and") continue;
    if (word in ONES) { current += ONES[word]; seen = true; }
    else if (word in TENS) { current += TENS[word]; seen = true; }
    else if (word === "hundred") { current = (current || 1) * 100; seen = true; }
    else if (word === "thousand") { total += (current || 1) * 1000; current = 0; seen = true; }
    else return null;
  }
  if (!seen) return null;
  return total + current;
}

// Parse one spoken or written number: digits ("18", "1,800") or words
// ("eighteen", "two hundred and twenty-five"). Returns null when the text
// is not a number.
export function wordsToNumber(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed) || /^\d+(\.\d+)?$/.test(trimmed))
    return Number(trimmed.replace(/,/g, ""));
  const words = trimmed.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (!words.length || !words.every((word) => NUMBER_WORDS.has(word))) return null;
  return parseNumberWords(words);
}

const UNIT_WORDS = new Set(["square", "cubic", "metre", "metres", "meter", "meters",
  "millimetre", "millimetres", "millimeter", "millimeters", "tonne", "tonnes",
  "point", "points", "day", "days", "bag", "bags"]);

// Rewrite spoken numbers and units in a description as digits and standard
// symbols: "eighteen square metres of two hundred and twenty-five
// millimetre blockwork" becomes "18 m² of 225mm blockwork". Words that are
// not numbers are left untouched.
export function normalizeDescription(text: string): string {
  const withDigits = text.replace(NUMBER_RUN, (match) => {
    const value = wordsToNumber(match);
    return value === null ? match : String(value);
  });
  return withDigits
    .replace(/(\d+(?:\.\d+)?)\s+square\s+met(?:er|re)s?\b/gi, "$1 m²")
    .replace(/(\d+(?:\.\d+)?)\s+cubic\s+met(?:er|re)s?\b/gi, "$1 m³")
    .replace(/(\d+(?:\.\d+)?)\s+millimet(?:er|re)s?\b/gi, "$1mm")
    .replace(/(\d+(?:\.\d+)?)\s+met(?:er|re)s?\b/gi, "$1m");
}

type Token = { word: string; endClause: boolean };
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    const endClause = /[.!?;,:\n]$/.test(raw);
    // Keep ² and ³ so a spoken "18 m²" survives as a quantity token.
    const clean = raw.replace(/^[^a-z0-9²³]+|[^a-z0-9²³]+$/gi, "");
    for (const part of clean.split(/-/).filter(Boolean))
      tokens.push({ word: part.toLowerCase(), endClause: false });
    if (tokens.length) tokens[tokens.length - 1].endClause = endClause;
  }
  return tokens;
}

function numberAt(tokens: Token[], start: number): { value: number; end: number } | null {
  const first = tokens[start];
  if (!first) return null;
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(first.word) || /^\d+(\.\d+)?$/.test(first.word))
    return { value: Number(first.word.replace(/,/g, "")), end: start + 1 };
  if (!NUMBER_WORDS.has(first.word) || first.word === "and") return null;
  let end = start;
  const words: string[] = [];
  while (end < tokens.length && NUMBER_WORDS.has(tokens[end].word) && !tokens[end].endClause) {
    words.push(tokens[end].word); end++;
  }
  const value = parseNumberWords(words);
  return value === null ? null : { value, end };
}

const METRE_WORDS = new Set(["metre", "metres", "meter", "meters"]);
const MILLIMETRE_WORDS = new Set(["millimetre", "millimetres", "millimeter", "millimeters"]);
function unitAt(tokens: Token[], start: number): { unit: "m2" | "m3" | "tonne" | "point" | "day"; display: string; end: number } | null {
  const first = tokens[start];
  if (!first) return null;
  if (first.word === "m²") return { unit: "m2", display: "m²", end: start + 1 };
  if (first.word === "m³") return { unit: "m3", display: "m³", end: start + 1 };
  if (first.word === "square" && METRE_WORDS.has(tokens[start + 1]?.word ?? ""))
    return { unit: "m2", display: "m²", end: start + 2 };
  if (first.word === "cubic" && METRE_WORDS.has(tokens[start + 1]?.word ?? ""))
    return { unit: "m3", display: "m³", end: start + 2 };
  if (first.word === "tonne" || first.word === "tonnes") return { unit: "tonne", display: "tonne", end: start + 1 };
  if (first.word === "point" || first.word === "points") return { unit: "point", display: "point", end: start + 1 };
  if (first.word === "day" || first.word === "days") return { unit: "day", display: "day", end: start + 1 };
  // A bare length ("225 millimetre", "18 metre") is a dimension, not a
  // quantity of work done, so it never becomes a work item.
  if (METRE_WORDS.has(first.word) || MILLIMETRE_WORDS.has(first.word)) return null;
  return null;
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "on", "in", "at", "to", "and",
  "east", "west", "north", "south", "elevation", "ground", "floor", "level"]);

// A dimension inside a description ("225 millimetre", "two hundred and
// twenty-five millimetre") belongs to the work described, not to a new
// quantity: consume the whole number run plus its dimension word as one
// "225mm" phrase token, so the block size survives in the description
// instead of truncating it to a bare number. A number followed by a work
// unit ("square", "cubic") is not a dimension and is left for the
// phrase-break rule below.
function dimensionAt(tokens: Token[], start: number): { text: string; end: number } | null {
  const number = numberAt(tokens, start);
  if (!number) return null;
  const word = tokens[number.end]?.word ?? "";
  if (!MILLIMETRE_WORDS.has(word) && !METRE_WORDS.has(word)) return null;
  return { text: `${number.value}${MILLIMETRE_WORDS.has(word) ? "mm" : "m"}`, end: number.end + 1 };
}
function contentWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

// Last-resort recovery for a transcript that states work quantities the
// extraction model missed entirely: scan for "<number> <unit> of <work>"
// phrases and return one candidate per phrase. A candidate is only built
// when the transcript states both a number and a work unit, so nothing is
// estimated; confidence stays below the model's high band because the
// transcript itself may mis-hear a number, and the Confirm screen still
// requires a human to verify the quantity before anything is costed.
export function extractWorkCandidates(transcript: string, hints: BoqHint[]): WorkItem[] {
  const tokens = tokenize(transcript);
  const candidates: WorkItem[] = [];
  let i = 0;
  while (i < tokens.length) {
    const number = numberAt(tokens, i);
    if (!number) { i++; continue; }
    const unit = unitAt(tokens, number.end);
    if (!unit) { i = number.end; continue; }
    let j = unit.end;
    if (tokens[j]?.word === "of") j++;
    const phrase: string[] = [];
    while (j < tokens.length && phrase.length < 8) {
      const token = tokens[j];
      const dimension = dimensionAt(tokens, j);
      if (dimension) { phrase.push(dimension.text); j = dimension.end; if (tokens[j - 1]?.endClause) break; continue; }
      if (phrase.length && (numberAt(tokens, j) || unitAt(tokens, j) || UNIT_WORDS.has(token.word))) break;
      // "…and cast 2 m³…" joins a second item: stop before "and" when a
      // fresh number+unit follows in the same clause, so the next item's
      // verb never lands in this item's description. A plain "and" inside
      // one item's description ("blockwork and concrete") has no quantity
      // after it and is kept.
      if (phrase.length && token.word === "and") {
        let k = j + 1, fresh = false;
        while (k < tokens.length && !tokens[k - 1].endClause) {
          const next = numberAt(tokens, k);
          if (next && unitAt(tokens, next.end)) { fresh = true; break; }
          k++;
        }
        if (fresh) break;
      }
      phrase.push(token.word);
      j++;
      if (token.endClause) break;
    }
    while (phrase.length && ["and", "the", "of", "a", "an", "on", "in", "at", "to"].includes(phrase[phrase.length - 1])) phrase.pop();
    i = Math.max(j, unit.end + 1);
    if (!phrase.length || !phrase.some((word) => word.length >= 4)) continue;
    const detail = normalizeDescription(phrase.join(" "));
    const description = `${number.value} ${unit.display} of ${detail}`;
    if (candidates.some((item) => item.description === description)) continue;
    const words = contentWords(detail);
    let matched: string | null = null;
    let best = 0;
    for (const hint of hints) {
      if (hint.unit !== unit.unit) continue;
      const shared = contentWords(hint.description).filter((word) => words.includes(word)).length;
      if (shared > best) { best = shared; matched = hint.description; }
      else if (shared === best && shared > 0) matched = matched === hint.description ? matched : null;
    }
    if (best < 1) matched = null;
    candidates.push({ description, matched_boq_hint: matched, quantity: number.value,
      unit: unit.unit, crew: null, confidence: 0.7 });
  }
  return candidates;
}
