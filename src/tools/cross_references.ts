// cross_references — find related passages via the cross_refs table.
import { getDb, getLocalDir, allRows, getRow } from "../db.js";
import { parseRef, formatRef } from "../verse-id.js";
import { defaultVersion } from "../corpus-loader/registry.js";
import type { ToolResult } from "./types.js";

interface CrossRefsArgs {
  reference: string;
  limit?: number;
}

export function runCrossReferences(args: CrossRefsArgs): ToolResult {
  const ref = parseRef(args.reference);
  if (!ref) {
    return {
      content: [{
        type: "text",
        text: `구절을 찾지 못했습니다: "${args.reference}". 예시: "Genesis 1:1", "창세기 1:1"`,
      }],
    };
  }

  const limit = args.limit ?? 20;
  const fromVerse = ref.start;

  const xrefs = allRows(
    `SELECT from_verse, to_start, to_end, votes FROM cross_refs
     WHERE from_verse = ?
     ORDER BY votes DESC
     LIMIT ?`,
    fromVerse, limit
  );

  if (xrefs.length === 0) {
    return {
      content: [{
        type: "text",
        text: `${formatRef(fromVerse)} (${fromVerse})에 대한 교차 참조가 없습니다.`,
      }],
    };
  }

  const db = { prepare: (sql: string) => getDb().prepare(sql) };
  const defaultVer = defaultVersion(db as Parameters<typeof defaultVersion>[0], getLocalDir());

  const parts: string[] = [
    `${formatRef(fromVerse)} (${fromVerse}) 교차 참조 (상위 ${xrefs.length}개)\n`,
  ];

  for (const xr of xrefs) {
    const toStart = String(xr.to_start);
    const toEnd = xr.to_end ? String(xr.to_end) : undefined;
    const rangeLabel = toEnd
      ? `${formatRef(toStart)}–${formatRef(toEnd)}`
      : formatRef(toStart);
    const verseRow = getRow(
      `SELECT text FROM verses WHERE version_id = ? AND verse_id = ?`,
      defaultVer, toStart
    );
    const preview = verseRow ? ` — ${String(verseRow.text).slice(0, 80)}${String(verseRow.text).length > 80 ? "…" : ""}` : "";
    parts.push(`  ${rangeLabel} [${toStart}${toEnd ? `–${toEnd}` : ""}]  (votes ${xr.votes})${preview}`);
  }

  return { content: [{ type: "text", text: parts.join("\n") }] };
}
