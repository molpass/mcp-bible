/**
 * verify-alignment.ts — G1 gate: cross-source verse-id alignment checks.
 *
 * Pure function; no side effects, no file I/O. Call with all normalized data
 * and receive AlignResult: ok + errors (CRITICAL) + info (benign / expected).
 */

import { BOOKS, bookById } from "../dist/verse-id.js";
import type { Verse, OriginalToken, Lexeme, XRef } from "../dist/corpus-loader/types.js";

export interface AlignInput {
  text: Verse[];          // krv + kjv + bsb combined
  greekVerses: Verse[];
  greekTokens: OriginalToken[];
  wlcVerses: Verse[];
  wlcTokens: OriginalToken[];
  lexemes: Lexeme[];
  xrefs: XRef[];
}

export interface AlignResult {
  ok: boolean;
  errors: string[];
  info: string[];
}

// OT book ids (indices 0..38 in BOOKS)
const OT_IDS = new Set(BOOKS.filter((b) => b.testament === "OT").map((b) => b.id));
// NT book ids (indices 39..65)
const NT_IDS = new Set(BOOKS.filter((b) => b.testament === "NT").map((b) => b.id));

export function verifyAlignment(d: AlignInput): AlignResult {
  const errors: string[] = [];
  const info: string[] = [];

  // -----------------------------------------------------------------------
  // 1. Chapter-in-range for ALL verses and tokens
  // -----------------------------------------------------------------------
  function checkChapterRange(verseId: string, source: string): boolean {
    const parts = verseId.split(".");
    if (parts.length !== 3) {
      errors.push(`[chapter-range] Malformed verse_id "${verseId}" in ${source}`);
      return false;
    }
    const [bookCode, chStr] = parts;
    const book = bookById(bookCode);
    if (!book) {
      errors.push(`[chapter-range] Unknown book code "${bookCode}" in "${verseId}" (${source})`);
      return false;
    }
    const ch = Number(chStr);
    if (ch < 1 || ch > book.chapters) {
      errors.push(`[chapter-range] Chapter ${ch} out of range (1..${book.chapters}) in "${verseId}" (${source})`);
      return false;
    }
    return true;
  }

  // Collect all verse ids per version for subsequent checks
  const textVerseIds = new Set<string>();
  const greekVerseIdSet = new Set<string>();
  const wlcVerseIdSet = new Set<string>();

  // Check text verses
  for (const v of d.text) {
    checkChapterRange(v.verse_id, `text[${v.version_id}]`);
    textVerseIds.add(v.verse_id);
  }
  // Check greek verses
  for (const v of d.greekVerses) {
    checkChapterRange(v.verse_id, "greekVerses");
    greekVerseIdSet.add(v.verse_id);
  }
  // Check wlc verses
  for (const v of d.wlcVerses) {
    checkChapterRange(v.verse_id, "wlcVerses");
    wlcVerseIdSet.add(v.verse_id);
  }
  // Check token verse_ids for chapter-range
  for (const tok of d.greekTokens) {
    checkChapterRange(tok.verse_id, "greekTokens");
  }
  for (const tok of d.wlcTokens) {
    checkChapterRange(tok.verse_id, "wlcTokens");
  }

  // U = union of all text version verse ids
  const U = textVerseIds;

  // -----------------------------------------------------------------------
  // 2. Token orphans — token verse_id must exist in its verse set
  // -----------------------------------------------------------------------
  let greekOrphanCount = 0;
  const greekOrphanExamples: string[] = [];
  for (const tok of d.greekTokens) {
    if (!greekVerseIdSet.has(tok.verse_id)) {
      greekOrphanCount++;
      if (greekOrphanExamples.length < 5) greekOrphanExamples.push(tok.verse_id);
    }
  }
  if (greekOrphanCount > 0) {
    errors.push(
      `[token-orphan] ${greekOrphanCount} Greek token(s) reference verse_ids not in greekVerses. Examples: ${greekOrphanExamples.join(", ")}`
    );
  }

  let wlcOrphanCount = 0;
  const wlcOrphanExamples: string[] = [];
  for (const tok of d.wlcTokens) {
    if (!wlcVerseIdSet.has(tok.verse_id)) {
      wlcOrphanCount++;
      if (wlcOrphanExamples.length < 5) wlcOrphanExamples.push(tok.verse_id);
    }
  }
  if (wlcOrphanCount > 0) {
    errors.push(
      `[token-orphan] ${wlcOrphanCount} WLC token(s) reference verse_ids not in wlcVerses. Examples: ${wlcOrphanExamples.join(", ")}`
    );
  }

  // -----------------------------------------------------------------------
  // 3. Original verses ⊆ U — check how many original verses are not in text U
  // -----------------------------------------------------------------------
  const LARGE_DIFF_THRESHOLD = 300;

  // Group by book to detect whole-book missing
  const greekNotInU = [...greekVerseIdSet].filter((id) => !U.has(id));
  const wlcNotInU = [...wlcVerseIdSet].filter((id) => !U.has(id));

  // Check for whole-book missing
  const greekMissingBooks = new Set(greekNotInU.map((id) => id.split(".")[0]));
  const wlcMissingBooks = new Set(wlcNotInU.map((id) => id.split(".")[0]));

  if (greekNotInU.length > LARGE_DIFF_THRESHOLD) {
    errors.push(
      `[original-subset] ${greekNotInU.length} Greek verse_ids not in text U (>300 threshold, possible systematic mismapping). Missing books: ${[...greekMissingBooks].join(", ")}`
    );
  } else if (greekNotInU.length > 0) {
    info.push(
      `[original-subset] ${greekNotInU.length} Greek verse_ids not in text U (versification difference, expected). Missing books: ${[...greekMissingBooks].join(", ")}`
    );
  }

  if (wlcNotInU.length > LARGE_DIFF_THRESHOLD) {
    errors.push(
      `[original-subset] ${wlcNotInU.length} WLC verse_ids not in text U (>300 threshold, possible systematic mismapping). Missing books: ${[...wlcMissingBooks].join(", ")}`
    );
  } else if (wlcNotInU.length > 0) {
    info.push(
      `[original-subset] ${wlcNotInU.length} WLC verse_ids not in text U (versification difference, expected). Missing books: ${[...wlcMissingBooks].join(", ")}`
    );
  }

  // -----------------------------------------------------------------------
  // 4. Book coverage
  // -----------------------------------------------------------------------
  // Text versions should cover all 66 books
  const textBooksCovered = new Set([...U].map((id) => id.split(".")[0]));
  const ALL_IDS = new Set(BOOKS.map((b) => b.id));

  const textMissingBooks = [...ALL_IDS].filter((id) => !textBooksCovered.has(id));
  if (textMissingBooks.length > 0) {
    errors.push(`[book-coverage] Text versions missing whole book(s): ${textMissingBooks.join(", ")}`);
  }

  // WLC should cover exactly 39 OT books
  const wlcBooksCovered = new Set([...wlcVerseIdSet].map((id) => id.split(".")[0]));
  const wlcMissingOT = [...OT_IDS].filter((id) => !wlcBooksCovered.has(id));
  const wlcUnexpectedNT = [...wlcBooksCovered].filter((id) => NT_IDS.has(id));
  if (wlcMissingOT.length > 0) {
    errors.push(`[book-coverage] WLC missing OT book(s): ${wlcMissingOT.join(", ")}`);
  }
  if (wlcUnexpectedNT.length > 0) {
    errors.push(`[book-coverage] WLC has unexpected NT book(s): ${wlcUnexpectedNT.join(", ")}`);
  }

  // Greek should cover exactly 27 NT books
  const greekBooksCovered = new Set([...greekVerseIdSet].map((id) => id.split(".")[0]));
  const greekMissingNT = [...NT_IDS].filter((id) => !greekBooksCovered.has(id));
  const greekUnexpectedOT = [...greekBooksCovered].filter((id) => OT_IDS.has(id));
  if (greekMissingNT.length > 0) {
    errors.push(`[book-coverage] Greek NT missing book(s): ${greekMissingNT.join(", ")}`);
  }
  if (greekUnexpectedOT.length > 0) {
    errors.push(`[book-coverage] Greek NT has unexpected OT book(s): ${greekUnexpectedOT.join(", ")}`);
  }

  // -----------------------------------------------------------------------
  // 5. xref endpoints in U
  // -----------------------------------------------------------------------
  const totalXrefs = d.xrefs.length;
  let xrefBadCount = 0;
  for (const xref of d.xrefs) {
    const fromOk = U.has(xref.from_verse);
    const toOk = U.has(xref.to_start);
    const toEndOk = !xref.to_end || U.has(xref.to_end);
    if (!fromOk || !toOk || !toEndOk) xrefBadCount++;
  }

  if (totalXrefs > 0) {
    const badPct = xrefBadCount / totalXrefs;
    if (badPct > 0.001) {
      errors.push(
        `[xref-endpoints] ${xrefBadCount}/${totalXrefs} (${(badPct * 100).toFixed(2)}%) xrefs have endpoints not in text U`
      );
    } else if (xrefBadCount > 0) {
      info.push(
        `[xref-endpoints] ${xrefBadCount}/${totalXrefs} xrefs have endpoints not in text U (<0.1%, expected versification diff)`
      );
    } else {
      info.push(`[xref-endpoints] All ${totalXrefs} xref endpoints found in text U`);
    }
  }

  // -----------------------------------------------------------------------
  // 6. Lexicon coverage for token strongs
  // -----------------------------------------------------------------------
  const lexemeStrongs = new Set(d.lexemes.map((l) => l.strongs));

  // Collect distinct strongs from tokens, normalized (strip trailing lowercase letter for lookup)
  const allTokenStrongs = new Set<string>();
  for (const tok of d.greekTokens) {
    if (tok.strongs) allTokenStrongs.add(tok.strongs);
  }
  for (const tok of d.wlcTokens) {
    if (tok.strongs) allTokenStrongs.add(tok.strongs);
  }

  let missingLexCount = 0;
  for (const s of allTokenStrongs) {
    // Strip trailing lowercase letter for lookup (e.g. "H1254a" -> "H1254")
    const base = s.replace(/([A-Z]\d+)[a-z]$/, "$1");
    if (!lexemeStrongs.has(s) && !lexemeStrongs.has(base)) {
      missingLexCount++;
    }
  }

  const totalDistinctStrongs = allTokenStrongs.size;
  if (totalDistinctStrongs > 0) {
    const missingPct = ((missingLexCount / totalDistinctStrongs) * 100).toFixed(1);
    info.push(
      `[lexicon-coverage] ${missingLexCount}/${totalDistinctStrongs} (${missingPct}%) distinct token strongs missing a lexeme (augmented suffixes expected)`
    );
  }

  // -----------------------------------------------------------------------
  // 7. Versification overlap (INFO only, unless pairwise diff > 500)
  // -----------------------------------------------------------------------
  // Split text by version
  const byVersion = new Map<string, Set<string>>();
  for (const v of d.text) {
    if (!byVersion.has(v.version_id)) byVersion.set(v.version_id, new Set());
    byVersion.get(v.version_id)!.add(v.verse_id);
  }

  const versionIds = [...byVersion.keys()];
  for (let i = 0; i < versionIds.length; i++) {
    for (let j = i + 1; j < versionIds.length; j++) {
      const a = byVersion.get(versionIds[i])!;
      const b = byVersion.get(versionIds[j])!;
      // symmetric diff
      let diffCount = 0;
      for (const id of a) { if (!b.has(id)) diffCount++; }
      for (const id of b) { if (!a.has(id)) diffCount++; }

      const label = `${versionIds[i]}↔${versionIds[j]}`;
      if (diffCount > 500) {
        errors.push(`[versification-overlap] Pairwise diff ${label} = ${diffCount} (>500, possible systematic mismapping)`);
      } else {
        info.push(`[versification-overlap] Pairwise diff ${label} = ${diffCount} verse_ids`);
      }
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, info };
}
