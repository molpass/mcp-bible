// local.ts — lazy-load and cache local translation JSON files from data/local/*.json.
// These files are private (gitignored); only their metadata is read by registry.ts.
// This module provides verse-level access to their content.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getLocalDir } from "../db.js";

// Module-level cache: versionId → verse map (verseId → text).
const _cache = new Map<string, Map<string, string>>();

function loadVersion(versionId: string, localDir: string): Map<string, string> | null {
  const cached = _cache.get(versionId);
  if (cached) return cached;

  const filePath = join(localDir, `${versionId}.json`);
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    if (typeof data.verses !== "object" || data.verses === null) return null;

    const verses = new Map<string, string>();
    for (const [k, v] of Object.entries(data.verses as Record<string, unknown>)) {
      if (typeof v === "string") verses.set(k, v);
    }
    _cache.set(versionId, verses);
    return verses;
  } catch {
    return null; // file missing or malformed
  }
}

/** List all version_ids found in data/local/*.json (default dir = getLocalDir()). */
export function localVersionIds(localDir?: string): string[] {
  const dir = localDir ?? getLocalDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>;
      if (typeof data.version_id === "string") ids.push(data.version_id);
    } catch {
      // skip malformed
    }
  }
  return ids;
}

/** True if versionId corresponds to a local JSON file. */
export function isLocalVersion(versionId: string, localDir?: string): boolean {
  return localVersionIds(localDir ?? getLocalDir()).includes(versionId);
}

/**
 * Return the verse text for the given versionId and verseId, or null if absent.
 * Lazy-loads and caches the JSON on first access per versionId.
 */
export function getLocalVerse(versionId: string, verseId: string, localDir?: string): string | null {
  const dir = localDir ?? getLocalDir();
  const verses = loadVersion(versionId, dir);
  if (!verses) return null;
  return verses.get(verseId) ?? null;
}

/** Clear the in-memory cache (useful for tests that write/delete local files). */
export function clearLocalCache(): void {
  _cache.clear();
}
