import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeKrv } from "../dist-scripts/normalize/krv.js";
import { normalizeKjv } from "../dist-scripts/normalize/kjv.js";

// Absolute path so the test is cwd-independent
const SRC = "C:/Users/zeone/work/mcp-bible/data/sources";

const VERSE_ID_RE = /^[A-Z0-9]{3}\.\d+\.\d+$/;
const PROTESTANT_CANON_MIN = 30_000;
const PROTESTANT_CANON_MAX = 31_600;

// ---------------------------------------------------------------------------
// KRV
// ---------------------------------------------------------------------------

test("krv: verse count in Protestant canon range", () => {
  const verses = normalizeKrv(SRC);
  assert.ok(
    verses.length > PROTESTANT_CANON_MIN && verses.length < PROTESTANT_CANON_MAX,
    `KRV verse count ${verses.length} out of expected range [${PROTESTANT_CANON_MIN}, ${PROTESTANT_CANON_MAX}]`
  );
});

test("krv: 66 distinct book_ids", () => {
  const verses = normalizeKrv(SRC);
  const bookIds = new Set(verses.map((v) => v.book_id));
  assert.equal(bookIds.size, 66, `Expected 66 book_ids, got ${bookIds.size}: ${[...bookIds].join(", ")}`);
});

test("krv: GEN.1.1 exists and has non-empty text", () => {
  const verses = normalizeKrv(SRC);
  const gen11 = verses.find((v) => v.verse_id === "GEN.1.1");
  assert.ok(gen11, "GEN.1.1 not found in KRV");
  assert.ok(gen11.text.length > 0, "GEN.1.1 text is empty");
});

test("krv: JHN.3.16 exists and has non-empty text", () => {
  const verses = normalizeKrv(SRC);
  const jhn316 = verses.find((v) => v.verse_id === "JHN.3.16");
  assert.ok(jhn316, "JHN.3.16 not found in KRV");
  assert.ok(jhn316.text.length > 0, "JHN.3.16 text is empty");
});

test("krv: all verse_ids match expected format", () => {
  const verses = normalizeKrv(SRC);
  const bad = verses.filter((v) => !VERSE_ID_RE.test(v.verse_id));
  assert.equal(bad.length, 0, `${bad.length} verse_ids don't match format: ${bad.slice(0, 5).map((v) => v.verse_id).join(", ")}`);
});

test("krv: GEN.1.1 text contains Korean '태초'", () => {
  const verses = normalizeKrv(SRC);
  const gen11 = verses.find((v) => v.verse_id === "GEN.1.1");
  assert.ok(gen11, "GEN.1.1 not found in KRV");
  assert.ok(gen11.text.includes("태초"), `GEN.1.1 text does not contain '태초': "${gen11.text}"`);
});

// ---------------------------------------------------------------------------
// KJV
// ---------------------------------------------------------------------------

test("kjv: verse count in Protestant canon range", () => {
  const verses = normalizeKjv(SRC);
  assert.ok(
    verses.length > PROTESTANT_CANON_MIN && verses.length < PROTESTANT_CANON_MAX,
    `KJV verse count ${verses.length} out of expected range [${PROTESTANT_CANON_MIN}, ${PROTESTANT_CANON_MAX}]`
  );
});

test("kjv: 66 distinct book_ids", () => {
  const verses = normalizeKjv(SRC);
  const bookIds = new Set(verses.map((v) => v.book_id));
  assert.equal(bookIds.size, 66, `Expected 66 book_ids, got ${bookIds.size}: ${[...bookIds].join(", ")}`);
});

test("kjv: GEN.1.1 exists and has non-empty text", () => {
  const verses = normalizeKjv(SRC);
  const gen11 = verses.find((v) => v.verse_id === "GEN.1.1");
  assert.ok(gen11, "GEN.1.1 not found in KJV");
  assert.ok(gen11.text.length > 0, "GEN.1.1 text is empty");
});

test("kjv: JHN.3.16 exists and has non-empty text", () => {
  const verses = normalizeKjv(SRC);
  const jhn316 = verses.find((v) => v.verse_id === "JHN.3.16");
  assert.ok(jhn316, "JHN.3.16 not found in KJV");
  assert.ok(jhn316.text.length > 0, "JHN.3.16 text is empty");
});

test("kjv: all verse_ids match expected format", () => {
  const verses = normalizeKjv(SRC);
  const bad = verses.filter((v) => !VERSE_ID_RE.test(v.verse_id));
  assert.equal(bad.length, 0, `${bad.length} verse_ids don't match format: ${bad.slice(0, 5).map((v) => v.verse_id).join(", ")}`);
});

test("kjv: JHN.3.16 text contains 'loved'", () => {
  const verses = normalizeKjv(SRC);
  const jhn316 = verses.find((v) => v.verse_id === "JHN.3.16");
  assert.ok(jhn316, "JHN.3.16 not found in KJV");
  assert.ok(jhn316.text.includes("loved"), `JHN.3.16 text does not contain 'loved': "${jhn316.text}"`);
});
