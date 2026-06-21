/**
 * build-embeddings-dry.test.js — Dry-run test for scripts/build-embeddings.ts.
 * Reads real data/bible.sqlite; skips with clear message if DB is absent.
 * Asserts: returns without throwing, 3 embedded versions (krv/bsb/kjv),
 * verse counts >30000 each, and no .bin files written.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildEmbeddings } from "../dist-scripts/build-embeddings.js";

const DB_PATH = join(process.cwd(), "data", "bible.sqlite");
const EMB_DIR = join(process.cwd(), "data", "embeddings");

if (!existsSync(DB_PATH)) {
  console.log(`SKIP build-embeddings-dry.test.js: ${DB_PATH} not found. Run 'npm run build:db' first.`);
  process.exit(0);
}

test("dry-run completes and writes NO new .bin (pre-existing real embeddings untouched)", async () => {
  const listBins = () =>
    (existsSync(EMB_DIR) ? readdirSync(EMB_DIR) : []).filter((f) => f.endsWith(".bin")).sort();
  const before = listBins();
  await assert.doesNotReject(() => buildEmbeddings(DB_PATH, EMB_DIR, { dry: true }));
  const added = listBins().filter((f) => !before.includes(f));
  assert.deepStrictEqual(added, [], `dry run must not write .bin; newly added: ${added.join(", ")}`);
});

test("exactly 3 versions have embedded=1 (krv, bsb, kjv)", () => {
  const db = new DatabaseSync(DB_PATH, { open: true });
  try {
    const rows = db
      .prepare("SELECT version_id FROM versions WHERE embedded=1 ORDER BY version_id")
      .all();
    const ids = rows.map((r) => r.version_id).sort();
    assert.deepStrictEqual(ids, ["bsb", "kjv", "krv"]);
  } finally {
    db.close();
  }
});

test("each embedded version has >30000 verses", () => {
  const db = new DatabaseSync(DB_PATH, { open: true });
  try {
    const versions = db
      .prepare("SELECT version_id FROM versions WHERE embedded=1")
      .all();
    for (const { version_id } of versions) {
      const row = db
        .prepare("SELECT count(*) as n FROM verses WHERE version_id=?")
        .get(version_id);
      assert.ok(
        row.n > 30000,
        `${version_id}: expected >30000 verses, got ${row.n}`
      );
    }
  } finally {
    db.close();
  }
});
