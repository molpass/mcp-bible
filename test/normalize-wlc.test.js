/**
 * normalize-wlc.test.js — node:test suite for the WLC (Hebrew OT) normalizer.
 *
 * Run: node --test C:/Users/zeone/work/mcp-bible/test/normalize-wlc.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWlc } from "../dist-scripts/normalize/wlc.js";
import { BOOKS } from "../dist/verse-id.js";

// Absolute path — cwd-independent
const SRC = "C:/Users/zeone/work/mcp-bible/data/sources";

const VERSE_ID_RE = /^[A-Z0-9]{3}\.\d+\.\d+$/;
const OT_BOOK_IDS = new Set(BOOKS.filter((b) => b.testament === "OT").map((b) => b.id));

// Load once for all tests
const { verses, tokens } = normalizeWlc(SRC);

// ---------------------------------------------------------------------------
// Verse tests
// ---------------------------------------------------------------------------

test("wlc: OT verse count in expected range (22000–24000)", () => {
  assert.ok(
    verses.length > 22000 && verses.length < 24000,
    `WLC verse count ${verses.length} out of expected range (22000, 24000)`
  );
});

test("wlc: only OT book_ids present (≤39 distinct)", () => {
  const bookIds = new Set(verses.map((v) => v.book_id));
  const nonOT = [...bookIds].filter((id) => !OT_BOOK_IDS.has(id));
  assert.equal(
    nonOT.length,
    0,
    `Found non-OT book_id(s): ${nonOT.join(", ")}`
  );
  assert.ok(
    bookIds.size <= 39,
    `Expected ≤39 OT book_ids, got ${bookIds.size}: ${[...bookIds].join(", ")}`
  );
});

test("wlc: GEN.1.1 has non-empty Hebrew text", () => {
  const v = verses.find((v) => v.verse_id === "GEN.1.1");
  assert.ok(v, "GEN.1.1 not found in WLC verses");
  assert.ok(v.text.length > 0, "GEN.1.1 text is empty");
  // Log first 30 chars for the report
  console.log(`GEN.1.1 sample: "${v.text.slice(0, 30)}"`);
});

test("wlc: all verse_ids match expected format", () => {
  const bad = verses.filter((v) => !VERSE_ID_RE.test(v.verse_id));
  assert.equal(
    bad.length,
    0,
    `${bad.length} verse_ids don't match format: ${bad.slice(0, 5).map((v) => v.verse_id).join(", ")}`
  );
});

// ---------------------------------------------------------------------------
// Token tests
// ---------------------------------------------------------------------------

test("wlc: tokens array is non-empty", () => {
  assert.ok(tokens.length > 0, "WLC tokens array is empty");
  console.log(`Total tokens: ${tokens.length}`);
});

test("wlc: GEN.1.1 has at least one token", () => {
  const gen11 = tokens.filter((t) => t.verse_id === "GEN.1.1");
  assert.ok(gen11.length >= 1, "No tokens for GEN.1.1");
  console.log(`GEN.1.1 token count: ${gen11.length}`);
});

test("wlc: GEN.1.1 tokens include H7225 (רֵאשִׁית — beginning)", () => {
  const gen11 = tokens.filter((t) => t.verse_id === "GEN.1.1");
  const hasH7225 = gen11.some((t) => t.strongs === "H7225");
  assert.ok(
    hasH7225,
    `GEN.1.1 tokens do not include H7225. Tokens: ${JSON.stringify(gen11)}`
  );
});

test("wlc: every strongs (when present) matches /^H\\d+[a-z]?$/", () => {
  const STRONGS_RE = /^H\d+[a-z]?$/;
  const bad = tokens.filter((t) => t.strongs !== undefined && !STRONGS_RE.test(t.strongs));
  assert.equal(
    bad.length,
    0,
    `${bad.length} tokens have invalid strongs format: ${JSON.stringify(bad.slice(0, 5))}`
  );
});
