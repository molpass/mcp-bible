// list_versions — enumerate all available Bible translations.
import { getDb, getLocalDir } from "../db.js";
import { listVersions } from "../corpus-loader/registry.js";
import type { ToolResult } from "./types.js";

export function runListVersions(): ToolResult {
  const db = {
    prepare: (sql: string) => getDb().prepare(sql),
  };
  const versions = listVersions(db as Parameters<typeof listVersions>[0], getLocalDir());

  if (versions.length === 0) {
    return { content: [{ type: "text", text: "사용 가능한 번역본이 없습니다." }] };
  }

  const lines = versions.map((v) => {
    const localTag = v.source === "local" ? " [로컬 설치]" : "";
    return `${v.version_id} — ${v.name} [${v.lang}]${localTag} (${v.source}; license ${v.license})`;
  });

  const text = `사용 가능한 번역본 (총 ${versions.length}개)\n\n${lines.join("\n")}`;
  return { content: [{ type: "text", text }] };
}
