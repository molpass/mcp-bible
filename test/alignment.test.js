/**
 * alignment.test.js — Unit tests for verifyAlignment() using in-memory fixtures.
 * Does NOT load any real source data.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// Import compiled verifyAlignment from dist-scripts
const { verifyAlignment } = await import("../dist-scripts/verify-alignment.js");

// Minimal verse fixture helper
function verse(version_id, verse_id) {
  const [book_id, ch, vs] = verse_id.split(".");
  return {
    version_id,
    verse_id,
    book_id,
    chapter: Number(ch),
    verse: Number(vs),
    text: "sample text",
  };
}

// ── PASSING FIXTURE ──────────────────────────────────────────────────────────

test("verifyAlignment: consistent ids → ok=true", () => {
  // A minimal OT + NT set that should pass all checks
  // Text: krv+kjv+bsb covering all 66 books is complex; instead we test the logic
  // with a controlled subset. We must satisfy book-coverage for all 66, so we
  // build full coverage using all book ids from BOOKS.

  // We'll supply one verse per book per version, using valid chapter 1 verse 1.
  const BOOKS_DATA = [
    // OT 39 books (id, chapters)
    ["GEN",50],["EXO",40],["LEV",27],["NUM",36],["DEU",34],
    ["JOS",24],["JDG",21],["RUT",4],["1SA",31],["2SA",24],
    ["1KI",22],["2KI",25],["1CH",29],["2CH",36],["EZR",10],
    ["NEH",13],["EST",10],["JOB",42],["PSA",150],["PRO",31],
    ["ECC",12],["SNG",8],["ISA",66],["JER",52],["LAM",5],
    ["EZK",48],["DAN",12],["HOS",14],["JOL",3],["AMO",9],
    ["OBA",1],["JON",4],["MIC",7],["NAM",3],["HAB",3],
    ["ZEP",3],["HAG",2],["ZEC",14],["MAL",4],
    // NT 27 books
    ["MAT",28],["MRK",16],["LUK",24],["JHN",21],["ACT",28],
    ["ROM",16],["1CO",16],["2CO",13],["GAL",6],["EPH",6],
    ["PHP",4],["COL",4],["1TH",5],["2TH",3],["1TI",6],
    ["2TI",4],["TIT",3],["PHM",1],["HEB",13],["JAS",5],
    ["1PE",5],["2PE",3],["1JN",5],["2JN",1],["3JN",1],
    ["JUD",1],["REV",22],
  ];

  const OT_BOOKS = BOOKS_DATA.slice(0, 39);
  const NT_BOOKS = BOOKS_DATA.slice(39);

  // Build text verses (krv covers all 66, kjv covers all 66, bsb covers all 66)
  const text = [];
  for (const [id] of BOOKS_DATA) {
    text.push(verse("krv", `${id}.1.1`));
    text.push(verse("kjv", `${id}.1.1`));
    text.push(verse("bsb", `${id}.1.1`));
  }

  // Greek: NT only
  const greekVerses = NT_BOOKS.map(([id]) => verse("berean-grk", `${id}.1.1`));
  const greekTokens = NT_BOOKS.map(([id], i) => ({
    verse_id: `${id}.1.1`,
    lang: "grc",
    position: 0,
    surface: "word",
    strongs: `G${i + 1}`,
  }));

  // WLC: OT only
  const wlcVerses = OT_BOOKS.map(([id]) => verse("wlc", `${id}.1.1`));
  const wlcTokens = OT_BOOKS.map(([id], i) => ({
    verse_id: `${id}.1.1`,
    lang: "he",
    position: 0,
    surface: "word",
    strongs: `H${i + 1}`,
  }));

  // Lexemes for all strongs used
  const lexemes = [
    ...NT_BOOKS.map((_, i) => ({ strongs: `G${i + 1}`, lang: "grc", gloss: "word" })),
    ...OT_BOOKS.map((_, i) => ({ strongs: `H${i + 1}`, lang: "he", gloss: "word" })),
  ];

  // Xrefs with valid endpoints
  const xrefs = [
    { from_verse: "GEN.1.1", to_start: "JHN.1.1", votes: 10 },
    { from_verse: "MAT.1.1", to_start: "GEN.1.1", votes: 5 },
  ];

  const result = verifyAlignment({ text, greekVerses, greekTokens, wlcVerses, wlcTokens, lexemes, xrefs });

  assert.strictEqual(result.ok, true, `Expected ok=true, errors: ${result.errors.join("; ")}`);
  assert.strictEqual(result.errors.length, 0, `Unexpected errors: ${result.errors.join("; ")}`);
});

// ── FAILING FIXTURE ──────────────────────────────────────────────────────────

test("verifyAlignment: chapter out of range + token orphan → ok=false with matching errors", () => {
  const BOOKS_DATA = [
    ["GEN",50],["EXO",40],["LEV",27],["NUM",36],["DEU",34],
    ["JOS",24],["JDG",21],["RUT",4],["1SA",31],["2SA",24],
    ["1KI",22],["2KI",25],["1CH",29],["2CH",36],["EZR",10],
    ["NEH",13],["EST",10],["JOB",42],["PSA",150],["PRO",31],
    ["ECC",12],["SNG",8],["ISA",66],["JER",52],["LAM",5],
    ["EZK",48],["DAN",12],["HOS",14],["JOL",3],["AMO",9],
    ["OBA",1],["JON",4],["MIC",7],["NAM",3],["HAB",3],
    ["ZEP",3],["HAG",2],["ZEC",14],["MAL",4],
    ["MAT",28],["MRK",16],["LUK",24],["JHN",21],["ACT",28],
    ["ROM",16],["1CO",16],["2CO",13],["GAL",6],["EPH",6],
    ["PHP",4],["COL",4],["1TH",5],["2TH",3],["1TI",6],
    ["2TI",4],["TIT",3],["PHM",1],["HEB",13],["JAS",5],
    ["1PE",5],["2PE",3],["1JN",5],["2JN",1],["3JN",1],
    ["JUD",1],["REV",22],
  ];

  const OT_BOOKS = BOOKS_DATA.slice(0, 39);
  const NT_BOOKS = BOOKS_DATA.slice(39);

  // Valid text covering all 66 books
  const text = [];
  for (const [id] of BOOKS_DATA) {
    text.push(verse("krv", `${id}.1.1`));
    text.push(verse("kjv", `${id}.1.1`));
    text.push(verse("bsb", `${id}.1.1`));
  }

  // Greek: NT only (valid)
  const greekVerses = NT_BOOKS.map(([id]) => verse("berean-grk", `${id}.1.1`));

  // Token with chapter out of range: GEN only has 50 chapters, use chapter 99
  const greekTokens = [
    {
      verse_id: "GEN.99.1",   // chapter 99 > 50 → out of range
      lang: "grc",
      position: 0,
      surface: "bad",
      strongs: "G1",
    },
    // Also an orphan: verse_id not in greekVerses set
    {
      verse_id: "REV.99.1",  // chapter 99 > 22 → out of range AND not in greekVerses
      lang: "grc",
      position: 1,
      surface: "orphan",
      strongs: "G2",
    },
  ];

  // WLC: OT only (valid)
  const wlcVerses = OT_BOOKS.map(([id]) => verse("wlc", `${id}.1.1`));
  const wlcTokens = OT_BOOKS.map(([id], i) => ({
    verse_id: `${id}.1.1`,
    lang: "he",
    position: 0,
    surface: "word",
    strongs: `H${i + 1}`,
  }));

  const lexemes = [
    { strongs: "G1", lang: "grc", gloss: "word" },
    { strongs: "G2", lang: "grc", gloss: "word" },
    ...OT_BOOKS.map((_, i) => ({ strongs: `H${i + 1}`, lang: "he", gloss: "word" })),
  ];

  const xrefs = [];

  const result = verifyAlignment({ text, greekVerses, greekTokens, wlcVerses, wlcTokens, lexemes, xrefs });

  assert.strictEqual(result.ok, false, "Expected ok=false");
  assert.ok(result.errors.length > 0, "Expected at least one error");

  // Should have a chapter-range error mentioning GEN.99.1
  const chapterRangeErr = result.errors.find(
    (e) => e.includes("chapter-range") && e.includes("GEN.99.1")
  );
  assert.ok(chapterRangeErr, `Expected chapter-range error for GEN.99.1, got errors: ${result.errors.join("; ")}`);

  // Should have a token-orphan error (GEN.99.1 and/or REV.99.1 not in greekVerses)
  const orphanErr = result.errors.find((e) => e.includes("token-orphan"));
  assert.ok(orphanErr, `Expected token-orphan error, got errors: ${result.errors.join("; ")}`);
});
