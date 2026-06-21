// db.ts — the ONLY module that imports node:sqlite.
// All other modules call the helpers here; swap this file to change the DB engine.
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// Resolve paths relative to this compiled file (dist/db.js → repo root).
const DEFAULT_DB_PATH = fileURLToPath(new URL("../data/bible.sqlite", import.meta.url));
const DEFAULT_LOCAL_DIR = fileURLToPath(new URL("../data/local", import.meta.url));

// Lazy singleton — opened on first access.
let _db: DatabaseSync | null = null;
let _dbPath: string = DEFAULT_DB_PATH;

/** Return the singleton DB handle. Pass pathOverride once to use a different DB (useful in tests). */
export function getDb(pathOverride?: string): DatabaseSync {
  if (pathOverride && pathOverride !== _dbPath) {
    // Reset singleton when a new path is requested (test isolation).
    _db = null;
    _dbPath = pathOverride;
  }
  if (!_db) {
    _db = new DatabaseSync(_dbPath, { readOnly: true });
  }
  return _db;
}

/** Absolute path to the data/local directory for local translation modules. */
export function getLocalDir(): string {
  return DEFAULT_LOCAL_DIR;
}

/** Run a SELECT and return all rows. */
export function allRows(sql: string, ...params: unknown[]): Record<string, unknown>[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...(params as Parameters<typeof stmt.all>)) as Record<string, unknown>[];
}

/** Run a SELECT and return the first row (or undefined). */
export function getRow(sql: string, ...params: unknown[]): Record<string, unknown> | undefined {
  const stmt = getDb().prepare(sql);
  return stmt.get(...(params as Parameters<typeof stmt.get>)) as Record<string, unknown> | undefined;
}
