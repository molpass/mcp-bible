// Version registry: bundled versions (from the SQLite `versions` table) merged with
// locally-installed translation modules scanned from data/local/*.json.
// DB access is kept behind a minimal handle interface so the engine (node:sqlite) lives in db.ts.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Version } from "./types.js";

export interface DbLike {
  prepare(sql: string): { all(...params: unknown[]): unknown[] };
}

export function listVersions(db: DbLike, localDir: string): Version[] {
  const rows = db
    .prepare(
      "SELECT version_id, name, lang, license, source, direction, has_original, embedded FROM versions ORDER BY version_id"
    )
    .all() as Array<Record<string, unknown>>;

  const versions: Version[] = rows.map((r) => ({
    version_id: String(r.version_id),
    name: String(r.name),
    lang: String(r.lang),
    license: String(r.license),
    source: r.source === "local" ? "local" : "bundled",
    direction: r.direction === "rtl" ? "rtl" : "ltr",
    has_original: !!r.has_original,
    embedded: !!r.embedded,
  }));

  const ids = new Set(versions.map((v) => v.version_id));
  for (const lv of scanLocal(localDir)) {
    if (!ids.has(lv.version_id)) versions.push(lv);
  }
  return versions;
}

function scanLocal(localDir: string): Version[] {
  let files: string[];
  try {
    files = readdirSync(localDir).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // no local dir / unreadable → no local versions
  }
  const out: Version[] = [];
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(localDir, f), "utf8")) as Record<string, unknown>;
      if (typeof data.version_id === "string" && typeof data.version_name === "string") {
        out.push({
          version_id: data.version_id,
          name: data.version_name,
          lang: "ko", // local modules are Korean translations (개역개정 계보)
          license: typeof data.license_note === "string" ? data.license_note : "private/local only",
          source: "local",
          direction: "ltr",
          has_original: false,
          embedded: false,
        });
      }
    } catch {
      // skip malformed local file
    }
  }
  return out;
}

// Deployment-aware default: local 개역개정 (krv-rev) if installed, else public 개역한글 (krv),
// else the first available version.
export function defaultVersion(db: DbLike, localDir: string): string {
  const versions = listVersions(db, localDir);
  if (versions.some((v) => v.source === "local" && v.version_id === "krv-rev")) return "krv-rev";
  if (versions.some((v) => v.version_id === "krv")) return "krv";
  return versions[0]?.version_id ?? "krv";
}
