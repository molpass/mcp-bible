/**
 * build-db.ts — Assemble data/bible.sqlite from all normalized sources.
 *
 * G1 gate: verifyAlignment must pass before any DB is written.
 * Run from repo root: node dist-scripts/build-db.js
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { BOOKS } from "../dist/verse-id.js";
import type { Verse, OriginalToken, Lexeme, XRef } from "../dist/corpus-loader/types.js";
import { verifyAlignment } from "./verify-alignment.js";
import { normalizeKrv } from "./normalize/krv.js";
import { normalizeKjv } from "./normalize/kjv.js";
import { normalizeBsb } from "./normalize/bsb.js";
import { normalizeBereanGreek } from "./normalize/berean-greek.js";
import { normalizeWlc } from "./normalize/wlc.js";
import { normalizeLexicon } from "./normalize/lexicon.js";
import { normalizeCrossRefs } from "./normalize/cross-refs.js";

// Note: FTS5 is not compiled into Node 22's built-in node:sqlite on Windows (SQLite 3.47.2,
// no ENABLE_FTS5 in compile options). The verses_fts table is implemented as a plain table
// with a text index; full-text search uses LIKE queries instead of MATCH.
const SCHEMA = `
PRAGMA journal_mode=WAL;
CREATE TABLE versions(version_id TEXT PRIMARY KEY, name TEXT, lang TEXT, license TEXT, source TEXT DEFAULT 'bundled', direction TEXT DEFAULT 'ltr', has_original INTEGER DEFAULT 0, embedded INTEGER DEFAULT 0);
CREATE TABLE books(book_id TEXT PRIMARY KEY, ord INTEGER, name_en TEXT, name_ko TEXT, testament TEXT, chapters INTEGER);
CREATE TABLE verses(version_id TEXT, verse_id TEXT, book_id TEXT, chapter INTEGER, verse INTEGER, text TEXT, PRIMARY KEY(version_id, verse_id));
CREATE INDEX idx_verses_ref ON verses(version_id, book_id, chapter, verse);
CREATE TABLE verses_fts(verse_id TEXT, version_id TEXT, text TEXT);
CREATE INDEX idx_fts_text ON verses_fts(text);
CREATE TABLE original_tokens(verse_id TEXT, lang TEXT, position INTEGER, surface TEXT, lemma TEXT, strongs TEXT, morph TEXT, PRIMARY KEY(verse_id, lang, position));
CREATE INDEX idx_tokens_strongs ON original_tokens(strongs);
CREATE TABLE lexicon(strongs TEXT PRIMARY KEY, lang TEXT, lemma TEXT, translit TEXT, gloss TEXT, definition TEXT);
CREATE TABLE cross_refs(from_verse TEXT, to_start TEXT, to_end TEXT NOT NULL DEFAULT '', votes INTEGER DEFAULT 0, PRIMARY KEY(from_verse, to_start, to_end));
CREATE INDEX idx_xref_from ON cross_refs(from_verse, votes DESC);
`;

export async function buildDb(srcDir: string, outPath: string): Promise<void> {
  // ── 1. Load all normalized data ─────────────────────────────────────────
  console.log("Loading KRV...");
  const krvVerses = normalizeKrv(srcDir);
  console.log(`  KRV: ${krvVerses.length} verses`);

  console.log("Loading KJV...");
  const kjvVerses = normalizeKjv(srcDir);
  console.log(`  KJV: ${kjvVerses.length} verses`);

  console.log("Loading BSB...");
  const bsbVerses = normalizeBsb(srcDir);
  console.log(`  BSB: ${bsbVerses.length} verses`);

  console.log("Loading Berean Greek...");
  const { verses: greekVerses, tokens: greekTokens } = normalizeBereanGreek(srcDir);
  console.log(`  Greek: ${greekVerses.length} verses, ${greekTokens.length} tokens`);

  console.log("Loading WLC...");
  const { verses: wlcVerses, tokens: wlcTokens } = normalizeWlc(srcDir);
  console.log(`  WLC: ${wlcVerses.length} verses, ${wlcTokens.length} tokens`);

  console.log("Loading Lexicon...");
  const lexemes = normalizeLexicon(srcDir);
  console.log(`  Lexicon: ${lexemes.length} entries`);

  console.log("Loading Cross-refs...");
  const { xrefs, skipped: xrefSkipped } = normalizeCrossRefs(srcDir);
  console.log(`  Xrefs: ${xrefs.length} (skipped ${xrefSkipped})`);

  // ── 2. G1 alignment gate ─────────────────────────────────────────────────
  console.log("\n── G1 Alignment Gate ──────────────────────────────────────");
  const textVerses: Verse[] = [...krvVerses, ...kjvVerses, ...bsbVerses];

  const align = verifyAlignment({
    text: textVerses,
    greekVerses,
    greekTokens,
    wlcVerses,
    wlcTokens,
    lexemes,
    xrefs,
  });

  if (align.info.length > 0) {
    console.log("INFO:");
    for (const msg of align.info) console.log(`  ${msg}`);
  }

  if (!align.ok) {
    console.error("\nERRORS (alignment gate FAILED):");
    for (const msg of align.errors) console.error(`  ${msg}`);
    console.error("\nDB build aborted — fix alignment errors first.");
    process.exit(1);
  }

  console.log("Alignment gate PASSED.\n");

  // ── 3. Create DB (delete if exists) ─────────────────────────────────────
  if (existsSync(outPath)) {
    unlinkSync(outPath);
    console.log(`Deleted existing ${outPath}`);
  }

  const db = new DatabaseSync(outPath);
  db.exec(SCHEMA);

  // ── 4. Insert versions ───────────────────────────────────────────────────
  db.exec("BEGIN");
  const insVersion = db.prepare(
    "INSERT INTO versions(version_id, name, lang, license, source, direction, has_original, embedded) VALUES(?,?,?,?,?,?,?,?)"
  );
  insVersion.run("krv",         "개역한글",              "ko",  "PD",                       "bundled", "ltr", 0, 1);
  insVersion.run("kjv",         "KJV",                   "en",  "PD",                       "bundled", "ltr", 0, 1);
  insVersion.run("bsb",         "Berean Standard Bible", "en",  "CC0",                      "bundled", "ltr", 0, 1);
  insVersion.run("berean-grk",  "Berean Greek NT",       "grc", "CC0",                      "bundled", "ltr", 1, 0);
  insVersion.run("wlc",         "Hebrew WLC",            "he",  "PD + morphology CC BY",    "bundled", "rtl", 1, 0);
  db.exec("COMMIT");

  // ── 5. Insert books ──────────────────────────────────────────────────────
  db.exec("BEGIN");
  const insBook = db.prepare(
    "INSERT INTO books(book_id, ord, name_en, name_ko, testament, chapters) VALUES(?,?,?,?,?,?)"
  );
  for (const b of BOOKS) {
    insBook.run(b.id, b.ord, b.en, b.ko, b.testament, b.chapters);
  }
  db.exec("COMMIT");

  // ── 6. Insert verses + FTS ───────────────────────────────────────────────
  console.log("Inserting verses...");
  const allVerses: Verse[] = [...krvVerses, ...kjvVerses, ...bsbVerses, ...greekVerses, ...wlcVerses];

  db.exec("BEGIN");
  const insVerse = db.prepare(
    "INSERT INTO verses(version_id, verse_id, book_id, chapter, verse, text) VALUES(?,?,?,?,?,?)"
  );
  const insFts = db.prepare(
    "INSERT INTO verses_fts(verse_id, version_id, text) VALUES(?,?,?)"
  );

  for (const v of allVerses) {
    insVerse.run(v.version_id, v.verse_id, v.book_id, v.chapter, v.verse, v.text);
    insFts.run(v.verse_id, v.version_id, v.text);
  }
  db.exec("COMMIT");
  console.log(`  Inserted ${allVerses.length} verses`);

  // ── 7. Insert original_tokens ────────────────────────────────────────────
  console.log("Inserting original tokens...");
  const allTokens: OriginalToken[] = [...wlcTokens, ...greekTokens];

  db.exec("BEGIN");
  const insTok = db.prepare(
    "INSERT OR IGNORE INTO original_tokens(verse_id, lang, position, surface, lemma, strongs, morph) VALUES(?,?,?,?,?,?,?)"
  );
  let tokIgnored = 0;
  for (const tok of allTokens) {
    const r = insTok.run(
      tok.verse_id,
      tok.lang,
      tok.position,
      tok.surface,
      tok.lemma ?? null,
      tok.strongs ?? null,
      tok.morph ?? null
    );
    if (r.changes === 0) tokIgnored++;
  }
  db.exec("COMMIT");
  console.log(`  Inserted ${allTokens.length - tokIgnored} tokens (${tokIgnored} ignored duplicate PKs)`);

  // ── 8. Insert lexicon ────────────────────────────────────────────────────
  console.log("Inserting lexicon...");
  db.exec("BEGIN");
  const insLex = db.prepare(
    "INSERT OR IGNORE INTO lexicon(strongs, lang, lemma, translit, gloss, definition) VALUES(?,?,?,?,?,?)"
  );
  let lexIgnored = 0;
  for (const l of lexemes) {
    const r = insLex.run(
      l.strongs,
      l.lang,
      l.lemma ?? null,
      l.translit ?? null,
      l.gloss ?? null,
      l.definition ?? null
    );
    if (r.changes === 0) lexIgnored++;
  }
  db.exec("COMMIT");
  console.log(`  Inserted ${lexemes.length - lexIgnored} lexemes (${lexIgnored} ignored duplicates)`);

  // ── 9. Insert cross_refs ─────────────────────────────────────────────────
  console.log("Inserting cross-refs...");
  db.exec("BEGIN");
  const insXref = db.prepare(
    "INSERT OR IGNORE INTO cross_refs(from_verse, to_start, to_end, votes) VALUES(?,?,?,?)"
  );
  let xrefIgnored = 0;
  for (const x of xrefs) {
    const r = insXref.run(x.from_verse, x.to_start, x.to_end ?? "", x.votes);
    if (r.changes === 0) xrefIgnored++;
  }
  db.exec("COMMIT");
  console.log(`  Inserted ${xrefs.length - xrefIgnored} xrefs (${xrefIgnored} ignored duplicate PKs)`);

  // ── 11. Final row counts + file size ────────────────────────────────────
  console.log("\n── Row Counts ──────────────────────────────────────────────");
  const tables = ["versions", "books", "verses", "original_tokens", "lexicon", "cross_refs"];
  for (const t of tables) {
    const row = db.prepare(`SELECT count(*) as n FROM ${t}`).get() as { n: number };
    console.log(`  ${t.padEnd(16)} ${row.n.toLocaleString()}`);
  }

  db.close();

  const stat = statSync(outPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  console.log(`\n  DB file: ${outPath}`);
  console.log(`  Size:    ${stat.size.toLocaleString()} bytes (${sizeMB} MB)`);
}

// CLI entry point
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("build-db.js") || process.argv[1].endsWith("build-db.ts"));

if (isMain) {
  const srcDir = join(process.cwd(), "data", "sources");
  const outPath = join(process.cwd(), "data", "bible.sqlite");
  buildDb(srcDir, outPath).catch((err) => {
    console.error("build-db fatal error:", err);
    process.exit(1);
  });
}
