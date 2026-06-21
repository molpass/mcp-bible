// Phase 2 deterministic tools test — requires data/bible.sqlite to be present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "bible.sqlite");

const SKIP = !existsSync(DB_PATH);
const SKIP_MSG = "data/bible.sqlite not present — skipping tool tests";

// Dynamic imports (post-build dist/) so that missing DB doesn't crash at import time.
async function loadTools() {
  const [
    { runListBooks },
    { runListVersions },
    { runLookup },
    { runCrossReferences },
    { runWordStudy },
  ] = await Promise.all([
    import("../dist/tools/list_books.js"),
    import("../dist/tools/list_versions.js"),
    import("../dist/tools/lookup.js"),
    import("../dist/tools/cross_references.js"),
    import("../dist/tools/word_study.js"),
  ]);
  return { runListBooks, runListVersions, runLookup, runCrossReferences, runWordStudy };
}

test("list_books — 66 books, GEN and REV present", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runListBooks } = await loadTools();
  const result = runListBooks();
  const text = result.content[0].text;
  const lines = text.split("\n").filter((l) => l.match(/^\s*\d+\./));
  assert.equal(lines.length, 66, `Expected 66 books, got ${lines.length}`);
  assert.ok(text.includes("GEN"), "Should contain GEN");
  assert.ok(text.includes("REV"), "Should contain REV");
});

test("list_versions — includes expected versions", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runListVersions } = await loadTools();
  const result = runListVersions();
  const text = result.content[0].text;
  assert.ok(text.includes("krv"), "Should include krv");
  assert.ok(text.includes("kjv"), "Should include kjv");
  assert.ok(text.includes("bsb"), "Should include bsb");
  assert.ok(text.includes("berean-grk"), "Should include berean-grk");
  assert.ok(text.includes("wlc"), "Should include wlc");
});

test("lookup John 3:16 (default krv) — Korean text with 사랑", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup } = await loadTools();
  const result = runLookup({ reference: "John 3:16" });
  const text = result.content[0].text;
  assert.ok(text.includes("사랑"), `Expected Korean text with '사랑', got: ${text.slice(0, 200)}`);
});

test("lookup John 3:16 in bsb + kjv — loved and version names", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup } = await loadTools();
  const result = runLookup({ reference: "John 3:16", versions: ["bsb", "kjv"] });
  const text = result.content[0].text;
  assert.ok(text.toLowerCase().includes("loved"), `Expected 'loved' in text, got: ${text.slice(0, 200)}`);
  assert.ok(text.toLowerCase().includes("bsb") || text.toLowerCase().includes("berean"), "Should mention bsb");
  assert.ok(text.toLowerCase().includes("kjv") || text.toLowerCase().includes("king"), "Should mention kjv");
});

test("lookup John 3:16 include_original — Greek tokens present", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup } = await loadTools();
  const result = runLookup({ reference: "John 3:16", include_original: true });
  const text = result.content[0].text;
  const hasGreekStrongs = /G\d+/.test(text);
  // Check for Greek script characters or G-strongs.
  const hasGreek = hasGreekStrongs || /[Ͱ-Ͽἀ-῿]/.test(text);
  assert.ok(hasGreek, `Expected Greek tokens or G-strongs, got: ${text.slice(0, 300)}`);
});

test("lookup Genesis 1:1 include_original+lexicon — H7225 with 'begin'", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup } = await loadTools();
  const result = runLookup({
    reference: "Genesis 1:1",
    include_original: true,
    include_lexicon: true,
  });
  const text = result.content[0].text;
  assert.ok(text.includes("H7225"), `Expected H7225 in text, got: ${text.slice(0, 300)}`);
  assert.ok(
    text.toLowerCase().includes("begin"),
    `Expected 'begin' gloss, got: ${text.slice(0, 400)}`
  );
});

test("lookup range John 3:16-17 — v16 and v17 both present", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup } = await loadTools();
  const result = runLookup({ reference: "John 3:16-17" });
  const text = result.content[0].text;
  assert.ok(
    text.includes("JHN.3.16") || text.includes("3:16"),
    "Should contain v16"
  );
  assert.ok(
    text.includes("JHN.3.17") || text.includes("3:17"),
    "Should contain v17"
  );
});

test("cross_references Genesis 1:1 — includes John 1:1 area with votes", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runCrossReferences } = await loadTools();
  const result = runCrossReferences({ reference: "Genesis 1:1" });
  const text = result.content[0].text;
  assert.ok(
    text.includes("JHN.1.1") || text.includes("John 1:1"),
    `Expected John 1:1 in cross refs, got: ${text.slice(0, 400)}`
  );
  assert.ok(text.includes("votes"), "Should show vote counts");
});

test("word_study John 1:1 strongs G3056 — λόγος / word gloss", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runWordStudy } = await loadTools();
  const result = runWordStudy({ reference: "John 1:1", strongs: "G3056" });
  const text = result.content[0].text;
  // Should contain the lemma (λόγος) or transliteration or gloss mentioning word/speech.
  const hasLemmaOrGloss =
    text.includes("λόγος") ||
    text.toLowerCase().includes("logos") ||
    text.toLowerCase().includes("word") ||
    text.toLowerCase().includes("speech");
  assert.ok(hasLemmaOrGloss, `Expected λόγος lemma or word/speech gloss, got: ${text.slice(0, 400)}`);
});

test("word_study Genesis 1:1 strongs H7225 — beginning gloss", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runWordStudy } = await loadTools();
  const result = runWordStudy({ reference: "Genesis 1:1", strongs: "H7225" });
  const text = result.content[0].text;
  assert.ok(text.includes("H7225"), `Expected H7225, got: ${text.slice(0, 300)}`);
  assert.ok(
    text.toLowerCase().includes("begin"),
    `Expected 'begin' in gloss, got: ${text.slice(0, 400)}`
  );
});
