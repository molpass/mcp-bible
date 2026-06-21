/**
 * bsb.ts — Normalize Berean Standard Bible (BSB) English text to Verse[].
 *
 * Source: data/sources/bsb/bsb_tables.xlsx, sheet "biblosinterlinear96"
 * One row per original-language word; BSB English is in col 18 (" BSB version ").
 * Verse boundaries: col 3 ("Verse") is a global verse counter — same value for all
 * rows of one verse, increments at each new verse.
 * Col 12 ("VerseId") holds the human reference ("Genesis 1:1") on the FIRST row only.
 * Col 19 ("pnc") holds punctuation to append after the BSB word.
 * Col 4 ("Language") is "Hebrew" (OT) or "Greek" (NT); both carry BSB text.
 *
 * BSB text reconstruction: concatenate col18 + col19 for rows with non-empty col18,
 * then trim and collapse internal double-spaces.
 */

import { join } from "node:path";
import { idByName } from "../../dist/verse-id.js";
import type { Verse } from "../../dist/corpus-loader/types.js";

// xlsx is a devDependency (build-time only)
// Using dynamic import to avoid bundling into runtime dist
import XLSX from "xlsx";

// Column indices (0-based) in the biblosinterlinear96 sheet
const COL_VERSE_SEQ = 3;   // global verse counter
const COL_LANG = 4;        // "Hebrew" | "Greek"
const COL_VERSE_ID = 12;   // "Genesis 1:1" on first row of verse, else ""
const COL_BSB = 18;        // " BSB version " — English word(s), may have spaces
const COL_PNC = 19;        // punctuation appended after BSB word

/**
 * Parse "Genesis 1:1", "1 Corinthians 2:3", "Psalm 23:1" etc.
 * Returns { bookId, chapter, verse } or null if unresolvable.
 */
function parseVerseRef(ref: string): { bookId: string; chapter: number; verse: number } | null {
  // Format: "<Book Name> <chapter>:<verse>"
  // Book name may contain spaces and leading digits (e.g. "1 Corinthians")
  const m = /^(.+?)\s+(\d+):(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const bookId = idByName(m[1].trim());
  if (!bookId) return null;
  return { bookId, chapter: Number(m[2]), verse: Number(m[3]) };
}

export function normalizeBsb(sourcesDir: string): Verse[] {
  const filePath = join(sourcesDir, "bsb", "bsb_tables.xlsx");
  const wb = XLSX.readFile(filePath, { sheetRows: 0 });
  const ws = wb.Sheets["biblosinterlinear96"];
  if (!ws) throw new Error("[normalizeBsb] Sheet 'biblosinterlinear96' not found");

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

  const verses: Verse[] = [];

  // Current verse accumulator
  let curVerseSeq: number | null = null;
  let curRef: { bookId: string; chapter: number; verse: number } | null = null;
  let bsbParts: string[] = [];

  function flushVerse(): void {
    if (!curRef || bsbParts.length === 0) return;
    // Join parts, collapse runs of whitespace, trim
    const text = bsbParts.join("").replace(/\s{2,}/g, " ").trim();
    if (!text) return;
    const verseId = `${curRef.bookId}.${curRef.chapter}.${curRef.verse}`;
    verses.push({
      version_id: "bsb",
      verse_id: verseId,
      book_id: curRef.bookId,
      chapter: curRef.chapter,
      verse: curRef.verse,
      text,
    });
  }

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const verseSeq = row[COL_VERSE_SEQ] as number;
    const verseIdStr = String(row[COL_VERSE_ID] ?? "");
    const bsbWord = String(row[COL_BSB] ?? "");
    const pnc = String(row[COL_PNC] ?? "");

    // New verse when verseSeq changes
    if (verseSeq !== curVerseSeq) {
      flushVerse();
      curVerseSeq = verseSeq;
      bsbParts = [];

      // The reference is in col12 on the first row of the verse
      if (verseIdStr && verseIdStr !== "") {
        curRef = parseVerseRef(verseIdStr);
        if (!curRef) {
          // unresolvable — skip entire verse
          curRef = null;
        }
      } else {
        // verseSeq changed but no VerseId present (shouldn't happen in well-formed data)
        curRef = null;
      }
    } else if (!curRef && verseIdStr && verseIdStr !== "") {
      // verseSeq unchanged but a VerseId appeared (edge case)
      curRef = parseVerseRef(verseIdStr);
    }

    // Accumulate BSB text — skip empty/placeholder rows
    // "-" = untranslated particle marker; "vvv" = formatting placeholder in source
    if (!curRef) continue;
    const bsbTrimmed = bsbWord.trim();
    if (!bsbTrimmed || bsbTrimmed === "-" || bsbTrimmed === "vvv") continue;
    // Append: BSB word (keep its surrounding spaces) + punctuation
    bsbParts.push(bsbWord + (pnc && pnc !== "" ? pnc : ""));
  }

  // Flush last verse
  flushVerse();

  return verses;
}
