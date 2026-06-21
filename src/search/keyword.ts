// keyword.ts — LIKE-based full-text search (no FTS5 required).
import { allRows } from "../db.js";

/** Escape LIKE special characters in the user query. */
function escapeLike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

export function keywordSearch(
  query: string,
  limit: number,
  versions?: string[]
): { verse_id: string; version_id: string; text: string }[] {
  const escaped = escapeLike(query.trim());
  if (!escaped) return [];

  const pattern = `%${escaped}%`;

  let sql: string;
  let params: unknown[];

  if (versions && versions.length > 0) {
    const placeholders = versions.map(() => "?").join(",");
    sql = `SELECT verse_id, version_id, text
           FROM verses
           WHERE text LIKE ? ESCAPE '\\'
             AND version_id IN (${placeholders})
           ORDER BY version_id, verse_id
           LIMIT ?`;
    params = [pattern, ...versions, limit];
  } else {
    sql = `SELECT verse_id, version_id, text
           FROM verses
           WHERE text LIKE ? ESCAPE '\\'
           ORDER BY version_id, verse_id
           LIMIT ?`;
    params = [pattern, limit];
  }

  const rows = allRows(sql, ...params);
  return rows.map((r) => ({
    verse_id: String(r.verse_id),
    version_id: String(r.version_id),
    text: String(r.text),
  }));
}
