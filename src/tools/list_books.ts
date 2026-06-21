// list_books — return all 66 canonical books in canonical order.
import { allRows } from "../db.js";
import type { ToolResult } from "./types.js";

export function runListBooks(): ToolResult {
  const rows = allRows(
    "SELECT book_id, ord, name_en, name_ko, testament, chapters FROM books ORDER BY ord"
  );

  if (rows.length === 0) {
    return { content: [{ type: "text", text: "성경 목록을 불러올 수 없습니다." }] };
  }

  const lines = rows.map((r) => {
    const ord = String(r.ord).padStart(2, " ");
    return `${ord}. ${r.name_ko} / ${r.name_en} (${r.book_id}, ${r.testament}, ${r.chapters}장)`;
  });

  const text = `성경 목록 (총 ${rows.length}권)\n\n${lines.join("\n")}`;
  return { content: [{ type: "text", text }] };
}
