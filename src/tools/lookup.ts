// lookup — fetch verse text for one or more Bible references.
import { getDb, getLocalDir, allRows, getRow } from "../db.js";
import { parseRef, formatRef } from "../verse-id.js";
import { defaultVersion } from "../corpus-loader/registry.js";
import { isLocalVersion, getLocalVerse } from "../corpus-loader/local.js";
import type { ToolResult } from "./types.js";

interface LookupArgs {
  reference: string;
  versions?: string[];
  include_original?: boolean;
  include_lexicon?: boolean;
}

/** Strip trailing lowercase letter from a Strongs number: "H1254a" → "H1254". */
function stripStrongsVariant(s: string): string {
  return s.replace(/([A-Z]\d+)[a-z]$/, "$1");
}

function lookupLexicon(strongs: string): Record<string, unknown> | undefined {
  // Try exact match first, then base-stripped.
  let row = getRow(
    "SELECT strongs, lang, lemma, translit, gloss, definition FROM lexicon WHERE strongs = ?",
    strongs
  );
  if (!row) {
    const base = stripStrongsVariant(strongs);
    if (base !== strongs) {
      row = getRow(
        "SELECT strongs, lang, lemma, translit, gloss, definition FROM lexicon WHERE strongs = ?",
        base
      );
    }
  }
  return row;
}

/** Build a list of verse_ids in the range [start, end] within the same chapter. */
function expandRange(start: string, end: string | undefined): string[] {
  if (!end) return [start];

  const sp = start.split(".");
  const ep = end.split(".");
  // Same book and chapter — iterate verse numbers.
  if (sp[0] === ep[0] && sp[1] === ep[1]) {
    const startVerse = parseInt(sp[2], 10);
    const endVerse = parseInt(ep[2], 10);
    const ids: string[] = [];
    for (let v = startVerse; v <= endVerse; v++) {
      ids.push(`${sp[0]}.${sp[1]}.${v}`);
    }
    return ids;
  }

  // Cross-chapter range — query DB for verse ordering.
  // Parse book + chapter + verse numerically, return all verses between.
  const bookId = sp[0];
  const startCh = parseInt(sp[1], 10);
  const startVs = parseInt(sp[2], 10);
  const endBookId = ep[0];
  const endCh = parseInt(ep[1], 10);
  const endVs = parseInt(ep[2], 10);

  if (bookId !== endBookId) {
    // Different books — just return start for simplicity.
    return [start, end];
  }

  // Same book, different chapters — query a representative version (bsb, krv, or first available).
  const rows = allRows(
    `SELECT verse_id FROM verses
     WHERE book_id = ?
       AND ((chapter = ? AND verse >= ?) OR (chapter > ? AND chapter < ?) OR (chapter = ? AND verse <= ?))
     GROUP BY verse_id
     ORDER BY chapter, verse`,
    bookId, startCh, startVs, startCh, endCh, endCh, endVs
  );
  if (rows.length > 0) return rows.map((r) => String(r.verse_id));
  return [start, end];
}

export function runLookup(args: LookupArgs): ToolResult {
  const ref = parseRef(args.reference);
  if (!ref) {
    return {
      content: [{
        type: "text",
        text: `구절을 찾지 못했습니다: "${args.reference}". 예시: "John 3:16", "창세기 1:1", "GEN.1.1"`,
      }],
    };
  }

  const db = { prepare: (sql: string) => getDb().prepare(sql) };
  const defaultVer = defaultVersion(db as Parameters<typeof defaultVersion>[0], getLocalDir());
  const requestedVersions =
    args.versions && args.versions.length > 0 ? args.versions : [defaultVer];

  const verseIds = expandRange(ref.start, ref.end);

  const parts: string[] = [];

  for (const verseId of verseIds) {
    const refLabel = formatRef(verseId, "ko");
    parts.push(`\n### ${refLabel} (${verseId})`);

    // Fetch text for each version.
    for (const versionId of requestedVersions) {
      if (isLocalVersion(versionId)) {
        const localText = getLocalVerse(versionId, verseId);
        if (localText !== null) {
          parts.push(`  ${formatRef(verseId)} (${versionId}): ${localText}`);
        } else {
          // Fall back to 개역한글 (krv) for any verse missing from the local file.
          const fallback = getRow(
            `SELECT v.text, ver.name FROM verses v
             JOIN versions ver ON ver.version_id = v.version_id
             WHERE v.version_id = 'krv' AND v.verse_id = ?`,
            verseId
          );
          if (fallback) {
            parts.push(`  ${formatRef(verseId)} (${versionId} → 개역한글 본문): ${fallback.text}`);
          } else {
            parts.push(`  [${versionId}: 해당 구절 없음]`);
          }
        }
      } else {
        const verseRow = getRow(
          `SELECT v.text, ver.name FROM verses v
           JOIN versions ver ON ver.version_id = v.version_id
           WHERE v.version_id = ? AND v.verse_id = ?`,
          versionId, verseId
        );
        if (!verseRow) {
          parts.push(`  [${versionId}: 해당 구절 없음]`);
        } else {
          parts.push(`  ${formatRef(verseId)} (${verseRow.name}): ${verseRow.text}`);
        }
      }
    }

    // Original tokens.
    if (args.include_original) {
      const tokens = allRows(
        `SELECT surface, strongs, morph, lang, lemma, position
         FROM original_tokens WHERE verse_id = ? ORDER BY position`,
        verseId
      );
      if (tokens.length > 0) {
        parts.push("\n  원문:");
        for (const t of tokens) {
          const strongsTag = t.strongs ? `  [${t.strongs}]` : "";
          const morphTag = t.morph ? `  ${t.morph}` : "";
          parts.push(`    ${t.surface}${strongsTag}${morphTag}`);
        }
      }
    }

    // Lexicon entries for distinct Strongs numbers.
    if (args.include_lexicon) {
      const tokens = allRows(
        `SELECT DISTINCT strongs FROM original_tokens
         WHERE verse_id = ? AND strongs IS NOT NULL ORDER BY position`,
        verseId
      );
      if (tokens.length > 0) {
        parts.push("\n  어휘:");
        const seen = new Set<string>();
        for (const t of tokens) {
          const s = String(t.strongs);
          if (seen.has(s)) continue;
          seen.add(s);
          const lex = lookupLexicon(s);
          if (lex) {
            const translit = lex.translit ? ` (${lex.translit})` : "";
            const gloss = lex.gloss ? `: ${lex.gloss}` : "";
            parts.push(`    ${s} ${lex.lemma ?? ""}${translit}${gloss}`);
          } else {
            parts.push(`    ${s} [어휘 미등록]`);
          }
        }
      }
    }
  }

  const text = parts.join("\n").trimStart();
  return { content: [{ type: "text", text }] };
}
