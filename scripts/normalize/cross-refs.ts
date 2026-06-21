/**
 * cross-refs.ts — Normalize OpenBible cross-references TSV to XRef[].
 *
 * Source: data/sources/xrefs/cross_references.txt
 *   Format: TSV, first line is header/comment.
 *   Columns: From Verse (OSIS) | To Verse (OSIS, may be a RANGE) | Votes (integer)
 *
 * Example lines:
 *   From Verse\tTo Verse\tVotes\t#www.openbible.info ...
 *   Gen.1.1\tJer.10.12\t76
 *   Gen.1.1\tJohn.1.1-John.1.3\t369
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { osisToVerseId } from "../../dist/verse-id.js";
import type { XRef } from "../../dist/corpus-loader/types.js";

export function normalizeCrossRefs(
  sourcesDir: string
): { xrefs: XRef[]; skipped: number } {
  const filePath = join(sourcesDir, "xrefs", "cross_references.txt");
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split("\n");

  const xrefs: XRef[] = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header/comment lines
    const cols = line.split("\t");
    const fromCol = cols[0];
    const toCol = cols[1];
    const votesCol = cols[2];

    // Skip header line (non-OSIS text in col 0) or comment lines
    if (
      !fromCol ||
      fromCol.startsWith("#") ||
      fromCol === "From Verse" ||
      !toCol
    ) {
      continue;
    }

    // Resolve from_verse
    const from_verse = osisToVerseId(fromCol);
    if (!from_verse) {
      skipped++;
      continue;
    }

    // Resolve to_start / to_end (handle ranges like "Gen.1.1-Gen.1.5")
    let to_start: string | undefined;
    let to_end: string | undefined;

    if (toCol.includes("-")) {
      // Split on the first "-" that separates two OSIS refs
      // OSIS refs are like "Book.ch.vs" — find the dash between two refs
      // Strategy: find "-" that is followed by an uppercase letter (next book/chapter ref)
      const dashIdx = toCol.search(/-[A-Z]/);
      if (dashIdx !== -1) {
        const startPart = toCol.slice(0, dashIdx);
        const endPart = toCol.slice(dashIdx + 1);
        to_start = osisToVerseId(startPart) ?? undefined;
        to_end = osisToVerseId(endPart) ?? undefined;
      } else {
        // Fallback: treat as single ref
        to_start = osisToVerseId(toCol) ?? undefined;
      }
    } else {
      to_start = osisToVerseId(toCol) ?? undefined;
    }

    if (!to_start) {
      skipped++;
      continue;
    }

    const votes = parseInt(votesCol ?? "0", 10);

    const xref: XRef = {
      from_verse,
      to_start,
      ...(to_end ? { to_end } : {}),
      votes: isNaN(votes) ? 0 : votes,
    };
    xrefs.push(xref);
  }

  return { xrefs, skipped };
}
