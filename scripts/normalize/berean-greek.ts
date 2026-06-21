/**
 * berean-greek.ts — Normalize Berean Interlinear Greek (NT) to Verse[] + OriginalToken[].
 *
 * Source: data/sources/bsb/bsb_tables.xlsx, sheet "biblosinterlinear96"
 * (Also available at data/sources/berean-greek/bsb_tables_interlinear.xlsx — same file.)
 *
 * NT rows have Language (col 4) = "Greek".
 * Col 3 ("Verse"): global verse sequence counter — all rows of a verse share the same value.
 * Col 5 ("WLC / Nestle Base..."): Greek surface word.
 * Col 11 ("Str Grk"): Strong's number as integer (e.g. 3056 → "G3056").
 * Col 12 ("VerseId"): "Matthew 1:1" style ref, only on first row of each verse.
 * Col 18 (" BSB version "): BSB English gloss (not used here).
 *
 * Output:
 *   verses  — one Verse per NT verse: Greek text = Greek words joined with spaces, trimmed.
 *   tokens  — one OriginalToken per Greek word row (non-empty surface), 0-based position.
 */

import { join } from "node:path";
import { idByName } from "../../dist/verse-id.js";
import type { Verse, OriginalToken } from "../../dist/corpus-loader/types.js";

import XLSX from "xlsx";

// Column indices (0-based)
const COL_VERSE_SEQ = 3;   // global verse counter
const COL_LANG = 4;        // "Hebrew" | "Greek"
const COL_SURFACE = 5;     // Greek word (Nestle base form)
const COL_MORPH = 8;       // parsing / morphology code (first parsing column)
const COL_STR_GRK = 11;    // Strong's Greek number (integer)
const COL_VERSE_ID = 12;   // "John 1:1" on first row of verse, else ""

/**
 * Parse "John 1:1", "1 Corinthians 2:3" etc. to { bookId, chapter, verse }.
 */
function parseVerseRef(ref: string): { bookId: string; chapter: number; verse: number } | null {
  const m = /^(.+?)\s+(\d+):(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const bookId = idByName(m[1].trim());
  if (!bookId) return null;
  return { bookId, chapter: Number(m[2]), verse: Number(m[3]) };
}

export function normalizeBereanGreek(sourcesDir: string): {
  verses: Verse[];
  tokens: OriginalToken[];
} {
  const filePath = join(sourcesDir, "bsb", "bsb_tables.xlsx");
  const wb = XLSX.readFile(filePath, { sheetRows: 0 });
  const ws = wb.Sheets["biblosinterlinear96"];
  if (!ws) throw new Error("[normalizeBereanGreek] Sheet 'biblosinterlinear96' not found");

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

  const verses: Verse[] = [];
  const tokens: OriginalToken[] = [];

  let curVerseSeq: number | null = null;
  let curRef: { bookId: string; chapter: number; verse: number } | null = null;
  let greekWords: string[] = [];
  let tokenBuf: OriginalToken[] = [];

  function flushVerse(): void {
    if (!curRef || greekWords.length === 0) return;
    const verseId = `${curRef.bookId}.${curRef.chapter}.${curRef.verse}`;
    verses.push({
      version_id: "berean-grk",
      verse_id: verseId,
      book_id: curRef.bookId,
      chapter: curRef.chapter,
      verse: curRef.verse,
      text: greekWords.join(" "),
    });
    for (const tok of tokenBuf) tokens.push(tok);
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const lang = row[COL_LANG] as string;
    if (lang !== "Greek") continue; // skip OT / Hebrew rows

    const verseSeq = row[COL_VERSE_SEQ] as number;
    const verseIdStr = String(row[COL_VERSE_ID] ?? "");
    const surface = String(row[COL_SURFACE] ?? "").trim();
    const morph = String(row[COL_MORPH] ?? "").trim() || undefined;
    const strNum = row[COL_STR_GRK];

    // New verse
    if (verseSeq !== curVerseSeq) {
      flushVerse();
      curVerseSeq = verseSeq;
      greekWords = [];
      tokenBuf = [];

      if (verseIdStr && verseIdStr !== "") {
        curRef = parseVerseRef(verseIdStr);
      } else {
        curRef = null;
      }
    }

    if (!curRef) continue;
    if (!surface) continue; // skip empty/filler rows

    const position = greekWords.length;
    greekWords.push(surface);

    const verseId = `${curRef.bookId}.${curRef.chapter}.${curRef.verse}`;
    const strongs: string | undefined =
      strNum !== "" && strNum !== null && strNum !== undefined
        ? `G${strNum}`
        : undefined;

    const tok: OriginalToken = {
      verse_id: verseId,
      lang: "grc",
      position,
      surface,
      strongs,
      morph: morph || undefined,
    };
    tokenBuf.push(tok);
  }

  // Flush last verse
  flushVerse();

  return { verses, tokens };
}
