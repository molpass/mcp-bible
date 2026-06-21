/**
 * krv.ts — Normalize Korean 개역한글 (getbible v2 format) to Verse[].
 *
 * Source: data/sources/krv/korean.json
 * Schema: { translation, ..., books: [ { nr, name, chapters: [ { chapter, name, verses: [ { chapter, verse, name, text } ] } ] } ] }
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ordToId, idByName } from "../../dist/verse-id.js";
import type { Verse } from "../../dist/corpus-loader/types.js";

interface KrvRawVerse {
  chapter: number;
  verse: number;
  name: string;
  text: string;
}

interface KrvRawChapter {
  chapter: number;
  name: string;
  verses: KrvRawVerse[];
}

interface KrvRawBook {
  nr: number;
  name: string;
  chapters: KrvRawChapter[];
}

interface KrvRaw {
  books: KrvRawBook[];
}

export function normalizeKrv(sourcesDir: string): Verse[] {
  const filePath = join(sourcesDir, "krv", "korean.json");
  const raw: KrvRaw = JSON.parse(readFileSync(filePath, "utf-8"));

  const verses: Verse[] = [];
  let skipped = 0;

  for (const book of raw.books) {
    // Resolve book id: prefer ordToId(book.nr), fall back to idByName(book.name)
    let bookId: string | undefined;
    if (typeof book.nr === "number" && book.nr >= 1 && book.nr <= 66) {
      bookId = ordToId(book.nr);
    }
    if (!bookId) {
      bookId = idByName(book.name);
    }
    if (!bookId) {
      throw new Error(`[normalizeKrv] Cannot resolve book id for: "${book.name}" (nr=${book.nr})`);
    }

    for (const chapter of book.chapters) {
      const chNum = chapter.chapter;

      for (const v of chapter.verses) {
        const text = v.text.trim();
        if (!text) {
          skipped++;
          continue;
        }
        const verseId = `${bookId}.${chNum}.${v.verse}`;
        verses.push({
          version_id: "krv",
          verse_id: verseId,
          book_id: bookId,
          chapter: chNum,
          verse: v.verse,
          text,
        });
      }
    }
  }

  if (skipped > 0) {
    console.warn(`[normalizeKrv] Skipped ${skipped} empty-text verse(s).`);
  }

  return verses;
}
