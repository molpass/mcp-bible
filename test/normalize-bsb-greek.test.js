import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBsb } from "../dist-scripts/normalize/bsb.js";
import { normalizeBereanGreek } from "../dist-scripts/normalize/berean-greek.js";
import { BOOKS } from "../dist/verse-id.js";

// Absolute path so the test is cwd-independent
const SRC = "C:/Users/zeone/work/mcp-bible/data/sources";

const VERSE_ID_RE = /^[A-Z0-9]{3}\.\d+\.\d+$/;
const NT_BOOK_IDS = new Set(BOOKS.filter((b) => b.testament === "NT").map((b) => b.id));

// Load once — the xlsx is ~55MB with 754k rows
const bsbVerses = normalizeBsb(SRC);
const { verses: grkVerses, tokens: grkTokens } = normalizeBereanGreek(SRC);

// ---------------------------------------------------------------------------
// BSB
// ---------------------------------------------------------------------------

test("bsb: verse count in Protestant canon range", () => {
  assert.ok(
    bsbVerses.length > 30000 && bsbVerses.length < 31600,
    `BSB verse count ${bsbVerses.length} out of expected range (30000, 31600)`
  );
});

test("bsb: 66 distinct book_ids", () => {
  const bookIds = new Set(bsbVerses.map((v) => v.book_id));
  assert.equal(bookIds.size, 66, `Expected 66 book_ids, got ${bookIds.size}: ${[...bookIds].join(", ")}`);
});

test("bsb: GEN.1.1 exists and has non-empty text", () => {
  const v = bsbVerses.find((v) => v.verse_id === "GEN.1.1");
  assert.ok(v, "GEN.1.1 not found in BSB");
  assert.ok(v.text.length > 0, "GEN.1.1 text is empty");
});

test("bsb: JHN.3.16 exists and contains 'loved'", () => {
  const v = bsbVerses.find((v) => v.verse_id === "JHN.3.16");
  assert.ok(v, "JHN.3.16 not found in BSB");
  assert.ok(v.text.includes("loved"), `JHN.3.16 does not contain 'loved': "${v.text}"`);
});

test("bsb: all verse_ids match expected format", () => {
  const bad = bsbVerses.filter((v) => !VERSE_ID_RE.test(v.verse_id));
  assert.equal(
    bad.length,
    0,
    `${bad.length} verse_ids don't match format: ${bad.slice(0, 5).map((v) => v.verse_id).join(", ")}`
  );
});

// ---------------------------------------------------------------------------
// Berean Greek
// ---------------------------------------------------------------------------

test("berean-grk: NT verse count roughly 7957", () => {
  assert.ok(
    grkVerses.length > 7800 && grkVerses.length < 8100,
    `berean-grk verse count ${grkVerses.length} out of expected range (7800, 8100)`
  );
});

test("berean-grk: only NT book_ids present", () => {
  const nonNT = grkVerses.filter((v) => !NT_BOOK_IDS.has(v.book_id));
  assert.equal(
    nonNT.length,
    0,
    `Found ${nonNT.length} non-NT verse(s): ${nonNT.slice(0, 5).map((v) => v.verse_id).join(", ")}`
  );
});

test("berean-grk: 27 distinct NT book_ids", () => {
  const bookIds = new Set(grkVerses.map((v) => v.book_id));
  assert.equal(bookIds.size, 27, `Expected 27 NT book_ids, got ${bookIds.size}: ${[...bookIds].join(", ")}`);
});

test("berean-grk: JHN.1.1 has non-empty Greek text", () => {
  const v = grkVerses.find((v) => v.verse_id === "JHN.1.1");
  assert.ok(v, "JHN.1.1 not found in berean-grk");
  assert.ok(v.text.length > 0, "JHN.1.1 Greek text is empty");
});

test("berean-grk: tokens are non-empty", () => {
  assert.ok(grkTokens.length > 0, "berean-grk tokens array is empty");
});

test("berean-grk: at least one token with strongs starting 'G'", () => {
  const hasG = grkTokens.some((t) => t.strongs && t.strongs.startsWith("G"));
  assert.ok(hasG, "No token found with strongs starting 'G'");
});

test("berean-grk: JHN.1.1 tokens include G3056 (λόγος)", () => {
  const jhn11Tokens = grkTokens.filter((t) => t.verse_id === "JHN.1.1");
  assert.ok(jhn11Tokens.length > 0, "No tokens for JHN.1.1");
  const hasLogos =
    jhn11Tokens.some((t) => t.strongs === "G3056") ||
    jhn11Tokens.some((t) => t.surface && t.surface.toLowerCase().includes("λόγος".toLowerCase()));
  assert.ok(hasLogos, `JHN.1.1 tokens do not include λόγος/G3056. Tokens: ${JSON.stringify(jhn11Tokens.slice(0, 5))}`);
});
