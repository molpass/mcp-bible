// search.ts — keyword (LIKE) and semantic (BGE-M3) search tool.
import { keywordSearch } from "../search/keyword.js";
import { semanticSearch, SemanticUnavailable } from "../search/semantic.js";
import { formatRef } from "../verse-id.js";
import type { ToolResult } from "./types.js";

const FALLBACK_NOTICE =
  "ⓘ 의미 검색 인덱스/토큰이 준비되지 않아 키워드 검색으로 대체했습니다.";

function formatKeywordResults(
  rows: { verse_id: string; version_id: string; text: string }[]
): string {
  if (rows.length === 0) return "검색 결과가 없습니다.";
  return rows.map((r) => `${formatRef(r.verse_id)} (${r.version_id}): ${r.text}`).join("\n");
}

export async function runSearch(
  args: {
    query: string;
    mode?: "keyword" | "semantic";
    limit?: number;
  },
  opts: { embeddingsDir?: string } = {}
): Promise<ToolResult> {
  const limit = args.limit ?? 10;
  const mode = args.mode ?? "keyword";

  if (mode === "keyword") {
    const rows = keywordSearch(args.query, limit);
    return { content: [{ type: "text", text: formatKeywordResults(rows) }] };
  }

  // semantic
  try {
    const rows = await semanticSearch(args.query, limit, opts.embeddingsDir);
    const text =
      rows.length === 0
        ? "검색 결과가 없습니다."
        : rows
            .map(
              (r) => `${formatRef(r.verse_id)} (${r.version_id}): ${r.text}`
            )
            .join("\n");
    return { content: [{ type: "text", text }] };
  } catch (err) {
    if (err instanceof SemanticUnavailable) {
      const fallback = keywordSearch(args.query, limit);
      const text = `${FALLBACK_NOTICE}\n${formatKeywordResults(fallback)}`;
      return { content: [{ type: "text", text }] };
    }
    throw err;
  }
}
