// word_study — deep dive on a Hebrew or Greek word within a verse.
import { allRows, getRow } from "../db.js";
import { parseRef, formatRef } from "../verse-id.js";
import type { ToolResult } from "./types.js";

interface WordStudyArgs {
  reference: string;
  word?: string;
  strongs?: string;
}

/** Strip trailing lowercase letter variant: "H1254a" → "H1254". */
function stripStrongsVariant(s: string): string {
  return s.replace(/([A-Z]\d+)[a-z]$/, "$1");
}

function lookupLexicon(strongs: string): Record<string, unknown> | undefined {
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

export function runWordStudy(args: WordStudyArgs): ToolResult {
  const ref = parseRef(args.reference);
  if (!ref) {
    return {
      content: [{
        type: "text",
        text: `구절을 찾지 못했습니다: "${args.reference}".`,
      }],
    };
  }

  const verseId = ref.start;

  // Load all tokens for this verse.
  const allTokens = allRows(
    `SELECT surface, lemma, strongs, morph, lang, position
     FROM original_tokens WHERE verse_id = ? ORDER BY position`,
    verseId
  );

  if (allTokens.length === 0) {
    return {
      content: [{
        type: "text",
        text: `${formatRef(verseId)}에 대한 원문 데이터가 없습니다. 원문 데이터가 포함된 번역본을 확인하세요.`,
      }],
    };
  }

  // Select target tokens.
  let targetTokens: Record<string, unknown>[];

  if (args.strongs) {
    const base = stripStrongsVariant(args.strongs);
    targetTokens = allTokens.filter(
      (t) =>
        t.strongs === args.strongs ||
        t.strongs === base ||
        (t.strongs && stripStrongsVariant(String(t.strongs)) === base)
    );
  } else if (args.word) {
    const needle = args.word.toLowerCase();
    targetTokens = allTokens.filter(
      (t) =>
        (t.surface && String(t.surface).toLowerCase().includes(needle)) ||
        (t.lemma && String(t.lemma).toLowerCase().includes(needle))
    );
  } else {
    // No filter — list all tokens and ask the user.
    const tokenLines = allTokens.map(
      (t) =>
        `  [${t.position}] ${t.surface}  strongs=${t.strongs ?? "–"}  morph=${t.morph ?? "–"}  lemma=${t.lemma ?? "–"}`
    );
    const text = [
      `${formatRef(verseId)} 원문 단어 목록 (${allTokens.length}개):`,
      "",
      tokenLines.join("\n"),
      "",
      "조사할 단어를 지정하려면 word 또는 strongs 파라미터를 사용하세요.",
    ].join("\n");
    return { content: [{ type: "text", text }] };
  }

  if (targetTokens.length === 0) {
    return {
      content: [{
        type: "text",
        text: `${formatRef(verseId)}에서 지정한 단어를 찾지 못했습니다 (strongs=${args.strongs ?? "–"}, word=${args.word ?? "–"}).`,
      }],
    };
  }

  const parts: string[] = [`${formatRef(verseId)} (${verseId}) 단어 연구\n`];

  // Collect distinct Strongs for the matched tokens.
  const distinctStrongs = new Set<string>();
  for (const t of targetTokens) {
    if (t.strongs) distinctStrongs.add(String(t.strongs));
  }

  for (const s of distinctStrongs) {
    parts.push(`## ${s}`);

    const lex = lookupLexicon(s);
    if (lex) {
      const translit = lex.translit ? ` (${lex.translit})` : "";
      parts.push(`  표제어: ${lex.lemma ?? "–"}${translit}`);
      if (lex.gloss) parts.push(`  간략 뜻: ${lex.gloss}`);
      if (lex.definition) {
        const def = String(lex.definition);
        parts.push(`  정의: ${def.slice(0, 300)}${def.length > 300 ? "…" : ""}`);
      }
    } else {
      parts.push("  [어휘 미등록]");
    }

    // Occurrence count.
    const base = stripStrongsVariant(s);
    const countRow = getRow(
      "SELECT count(*) AS cnt FROM original_tokens WHERE strongs = ? OR strongs = ?",
      s, base
    );
    const count = countRow ? Number(countRow.cnt) : 0;
    parts.push(`\n  성경 전체 출현 횟수: ${count}회`);

    // Sample verses.
    const sampleRows = allRows(
      `SELECT DISTINCT verse_id FROM original_tokens
       WHERE strongs = ? OR strongs = ?
       LIMIT 5`,
      s, base
    );
    if (sampleRows.length > 0) {
      parts.push("  출현 예시:");
      for (const r of sampleRows) {
        const vid = String(r.verse_id);
        parts.push(`    ${formatRef(vid)} (${vid})`);
      }
    }

    parts.push("");
  }

  // Show matched token details.
  parts.push("이 구절에서 매칭된 단어:");
  for (const t of targetTokens) {
    const morphTag = t.morph ? `  형태: ${t.morph}` : "";
    parts.push(`  [위치 ${t.position}] ${t.surface}  [${t.strongs ?? "–"}]${morphTag}`);
  }

  return { content: [{ type: "text", text: parts.join("\n") }] };
}
