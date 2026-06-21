/**
 * build-db.test.js — Smoke test for the produced data/bible.sqlite.
 * Skips with a clear message if the DB file is absent.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = join(process.cwd(), "data", "bible.sqlite");

if (!existsSync(DB_PATH)) {
  console.log(`SKIP build-db.test.js: ${DB_PATH} not found. Run 'npm run build:db' first.`);
  process.exit(0);
}

const db = new DatabaseSync(DB_PATH, { open: true });

test("versions = 5", () => {
  const row = db.prepare("SELECT count(*) as n FROM versions").get();
  assert.strictEqual(row.n, 5);
});

test("books = 66", () => {
  const row = db.prepare("SELECT count(*) as n FROM books").get();
  assert.strictEqual(row.n, 66);
});

// 3 text versions (~31k each) + Greek NT (~8k) + WLC OT (~23k) = ~124k total
test("verses > 120000", () => {
  const row = db.prepare("SELECT count(*) as n FROM verses").get();
  assert.ok(row.n > 120000, `Expected >120000 verses, got ${row.n}`);
});

test("original_tokens > 400000", () => {
  const row = db.prepare("SELECT count(*) as n FROM original_tokens").get();
  assert.ok(row.n > 400000, `Expected >400000 tokens, got ${row.n}`);
});

test("lexicon > 13000", () => {
  const row = db.prepare("SELECT count(*) as n FROM lexicon").get();
  assert.ok(row.n > 13000, `Expected >13000 lexemes, got ${row.n}`);
});

test("cross_refs > 300000", () => {
  const row = db.prepare("SELECT count(*) as n FROM cross_refs").get();
  assert.ok(row.n > 300000, `Expected >300000 xrefs, got ${row.n}`);
});

// Note: FTS5 is not compiled into Node 22's node:sqlite on Windows. verses_fts is a plain
// table; full-text search uses LIKE (with % wildcards for substring match).
test("FTS: Korean '사랑' matches > 0", () => {
  const row = db.prepare("SELECT count(*) as n FROM verses_fts WHERE text LIKE '%사랑%'").get();
  assert.ok(row.n > 0, `Expected >0 Korean FTS matches for '사랑', got ${row.n}`);
});

test("FTS: English 'love' matches > 0", () => {
  const row = db.prepare("SELECT count(*) as n FROM verses_fts WHERE text LIKE '%love%'").get();
  assert.ok(row.n > 0, `Expected >0 English FTS matches for 'love', got ${row.n}`);
});
