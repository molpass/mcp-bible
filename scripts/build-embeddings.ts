/**
 * build-embeddings.ts — Precompute BGE-M3 embeddings for embedded=1 versions.
 *
 * Dry mode: prints what would be embedded, makes no API calls, writes no files.
 * Real mode: embeds verse texts, writes <vid>.bin + <vid>.idx.json; skips if both exist.
 *
 * Run: node dist-scripts/build-embeddings.js [--dry]
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { embedBatch, EMBED_DIM } from "../dist/embeddings.js";

interface VerseRow {
  verse_id: string;
  text: string;
}

export async function buildEmbeddings(
  dbPath: string,
  outDir: string,
  opts?: { dry?: boolean }
): Promise<void> {
  const dry =
    opts?.dry === true ||
    process.argv.includes("--dry") ||
    !process.env.DEEPINFRA_TOKEN;

  if (!existsSync(dbPath)) {
    throw new Error(`DB not found: ${dbPath}`);
  }

  const db = new DatabaseSync(dbPath, { open: true });

  // Select versions with embedded=1 ordered for stable output
  const versions = db
    .prepare("SELECT version_id FROM versions WHERE embedded=1 ORDER BY version_id")
    .all() as unknown as { version_id: string }[];

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  console.log(`build-embeddings: mode=${dry ? "DRY" : "REAL"}  outDir=${outDir}`);
  console.log(`  Versions with embedded=1: ${versions.map((v) => v.version_id).join(", ")}`);

  for (const { version_id: vid } of versions) {
    const rows = db
      .prepare(
        "SELECT verse_id, text FROM verses WHERE version_id=? ORDER BY verse_id"
      )
      .all(vid) as unknown as VerseRow[];

    if (dry) {
      console.log(`  would embed ${vid}: ${rows.length} verses`);
      continue;
    }

    // Resume: skip if both output files already exist
    const binPath = join(outDir, `${vid}.bin`);
    const idxPath = join(outDir, `${vid}.idx.json`);
    if (existsSync(binPath) && existsSync(idxPath)) {
      console.log(`  ${vid}: skipped (files exist)`);
      continue;
    }

    console.log(`  ${vid}: embedding ${rows.length} verses...`);
    const texts = rows.map((r) => r.text);
    const embeddings = await embedBatch(texts);

    // Write binary: N × EMBED_DIM float32 little-endian
    const buf = Buffer.alloc(rows.length * EMBED_DIM * 4);
    for (let i = 0; i < embeddings.length; i++) {
      const arr = embeddings[i];
      for (let j = 0; j < EMBED_DIM; j++) {
        buf.writeFloatLE(arr[j], (i * EMBED_DIM + j) * 4);
      }
    }
    writeFileSync(binPath, buf);

    // Write index: verse_id[] in row order
    writeFileSync(idxPath, JSON.stringify(rows.map((r) => r.verse_id)));
    console.log(`  ${vid}: wrote ${binPath} + ${idxPath}`);
  }

  db.close();
  console.log("build-embeddings: done.");
}

// CLI entry point
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("build-embeddings.js") ||
    process.argv[1].endsWith("build-embeddings.ts"));

if (isMain) {
  buildEmbeddings(
    join(process.cwd(), "data", "bible.sqlite"),
    join(process.cwd(), "data", "embeddings"),
    { dry: !process.env.DEEPINFRA_TOKEN || process.argv.includes("--dry") }
  ).catch((err) => {
    console.error("build-embeddings fatal:", err);
    process.exit(1);
  });
}
