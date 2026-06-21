/**
 * kjv.ts — Normalize King James Version (scrollmapper format) to Verse[].
 *
 * Source: data/sources/kjv/KJV.json
 * Schema: { translation, books: [ { name, chapters: [ { chapter, verses: [ { verse, text } ] } ] } ] }
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { idByName } from "../../dist/verse-id.js";
import type { Verse } from "../../dist/corpus-loader/types.js";

interface KjvRawVerse {
  verse: number;
  text: string;
}

interface KjvRawChapter {
  chapter: number;
  verses: KjvRawVerse[];
}

interface KjvRawBook {
  name: string;
  chapters: KjvRawChapter[];
}

interface KjvRaw {
  books: KjvRawBook[];
}

export function normalizeKjv(sourcesDir: string): Verse[] {
  const filePath = join(sourcesDir, "kjv", "KJV.json");
  const raw: KjvRaw = JSON.parse(readFileSync(filePath, "utf-8"));

  const verses: Verse[] = [];
  let skipped = 0;
  const unresolved: string[] = [];

  for (const book of raw.books) {
    const bookId = idByName(book.name);
    if (!bookId) {
      unresolved.push(book.name);
      continue;
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
          version_id: "kjv",
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
    console.warn(`[normalizeKjv] Skipped ${skipped} empty-text verse(s).`);
  }

  if (unresolved.length > 0) {
    throw new Error(
      `[normalizeKjv] Unresolved book name(s): ${unresolved.map((n) => `"${n}"`).join(", ")}. Add aliases to verse-id.ts.`
    );
  }

  return verses;
}
