/**
 * normalize-lex-xref.test.js — node:test suite for lexicon + cross-ref normalizers.
 *
 * Run: node --test C:/Users/zeone/work/mcp-bible/test/normalize-lex-xref.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLexicon } from "../dist-scripts/normalize/lexicon.js";
import { normalizeCrossRefs } from "../dist-scripts/normalize/cross-refs.js";

// Absolute path — cwd-independent
const SRC = "C:/Users/zeone/work/mcp-bible/data/sources";

const STRONGS_RE = /^[HG]\d+$/;
const VERSE_ID_RE = /^[A-Z0-9]{3}\.\d+\.\d+$/;

// Load once for all tests
const lexemes = normalizeLexicon(SRC);
const hebrew = lexemes.filter((l) => l.lang === "he");
const greek = lexemes.filter((l) => l.lang === "grc");

const { xrefs, skipped } = normalizeCrossRefs(SRC);

// ---------------------------------------------------------------------------
// Lexicon tests — Hebrew
// ---------------------------------------------------------------------------

test("lexicon: Hebrew entries > 8000", () => {
  assert.ok(
    hebrew.length > 8000,
    `Hebrew entries ${hebrew.length} is not > 8000`
  );
  console.log(`Hebrew entries: ${hebrew.length}`);
});

test("lexicon: Greek entries > 5000", () => {
  assert.ok(
    greek.length > 5000,
    `Greek entries ${greek.length} is not > 5000`
  );
  console.log(`Greek entries: ${greek.length}`);
});

test("lexicon: every strongs matches /^[HG]\\d+$/", () => {
  const bad = lexemes.filter((l) => !STRONGS_RE.test(l.strongs));
  assert.equal(
    bad.length,
    0,
    `${bad.length} entries have invalid strongs: ${JSON.stringify(bad.slice(0, 5))}`
  );
});

test("lexicon: H7225 exists and gloss/def mentions 'begin'", () => {
  const entry = lexemes.find((l) => l.strongs === "H7225");
  assert.ok(entry, "H7225 not found in lexemes");
  const combined = ((entry.gloss ?? "") + " " + (entry.definition ?? "")).toLowerCase();
  assert.ok(
    combined.includes("begin") || combined.includes("first"),
    `H7225 gloss/def does not mention 'begin' or 'first': "${combined.slice(0, 100)}"`
  );
  console.log(`H7225 gloss: "${entry.gloss ?? ""}"`);
  console.log(`H7225 def snippet: "${(entry.definition ?? "").slice(0, 80)}"`);
});

test("lexicon: G3056 exists with Greek lemma and gloss/def mentioning word/speech/reason", () => {
  const entry = lexemes.find((l) => l.strongs === "G3056");
  assert.ok(entry, "G3056 not found in lexemes");
  assert.ok(entry.lemma, "G3056 has no lemma");
  // lemma should be Greek characters
  assert.ok(
    /[Ͱ-Ͽἀ-῿]/.test(entry.lemma ?? ""),
    `G3056 lemma "${entry.lemma}" does not look like Greek`
  );
  const combined = ((entry.gloss ?? "") + " " + (entry.definition ?? "")).toLowerCase();
  assert.ok(
    combined.includes("word") || combined.includes("speech") || combined.includes("reason"),
    `G3056 gloss/def does not mention word/speech/reason: "${combined.slice(0, 100)}"`
  );
  console.log(`G3056 lemma: "${entry.lemma}", gloss: "${entry.gloss ?? ""}"`);
  console.log(`G3056 def snippet: "${(entry.definition ?? "").slice(0, 80)}"`);
});

// ---------------------------------------------------------------------------
// Cross-ref tests
// ---------------------------------------------------------------------------

test("xrefs: total > 300000", () => {
  assert.ok(
    xrefs.length > 300000,
    `xrefs count ${xrefs.length} is not > 300000`
  );
  console.log(`Total xrefs: ${xrefs.length}, skipped: ${skipped}`);
});

test("xrefs: GEN.1.1 appears as from_verse in at least 1 row", () => {
  const gen11 = xrefs.filter((x) => x.from_verse === "GEN.1.1");
  assert.ok(gen11.length >= 1, "GEN.1.1 not found as from_verse");
  console.log(`GEN.1.1 xref sample: ${JSON.stringify(gen11[0])}`);
});

test("xrefs: all to_start match verse_id regex", () => {
  const bad = xrefs.filter((x) => !VERSE_ID_RE.test(x.to_start));
  assert.equal(
    bad.length,
    0,
    `${bad.length} xrefs have invalid to_start: ${JSON.stringify(bad.slice(0, 5))}`
  );
});

test("xrefs: at least one row has to_end (range xref)", () => {
  const rangeRow = xrefs.find((x) => x.to_end !== undefined);
  assert.ok(rangeRow, "No range xref found (to_end is undefined for all rows)");
  console.log(`Range xref sample: ${JSON.stringify(rangeRow)}`);
});

test("xrefs: votes are integers", () => {
  const bad = xrefs.filter((x) => !Number.isInteger(x.votes));
  assert.equal(
    bad.length,
    0,
    `${bad.length} xrefs have non-integer votes`
  );
});
