// semantic.ts — BGE-M3 cosine similarity search over precomputed embedding files.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { allRows, getRow } from "../db.js";
import { embedBatch, EMBED_DIM } from "../embeddings.js";

/** Thrown when embedding files or token are unavailable — tool falls back to keyword. */
export class SemanticUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticUnavailable";
  }
}

const EMBED_DIR = fileURLToPath(new URL("../../data/embeddings", import.meta.url));

interface LoadedVersion {
  version_id: string;
  vectors: Float32Array; // flat, length = N * EMBED_DIM
  idx: string[];         // verse_id for each row
  count: number;
}

function loadVersionEmbeddings(versionId: string, dir: string): LoadedVersion | null {
  const binPath = join(dir, `${versionId}.bin`);
  const idxPath = join(dir, `${versionId}.idx.json`);
  if (!existsSync(binPath) || !existsSync(idxPath)) return null;

  const buf = readFileSync(binPath);
  const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const idx: string[] = JSON.parse(readFileSync(idxPath, "utf8"));
  const count = idx.length;
  if (vectors.length !== count * EMBED_DIM) return null; // corrupt — skip

  return { version_id: versionId, vectors, idx, count };
}

/** Dot product of two Float32Arrays of same length (= cosine for L2-normalized). */
function dot(a: Float32Array, b: Float32Array, bOffset: number): number {
  let s = 0;
  for (let i = 0; i < EMBED_DIM; i++) s += a[i] * b[bOffset + i];
  return s;
}

export async function semanticSearch(
  query: string,
  limit: number,
  embeddingsDir: string = EMBED_DIR
): Promise<{ verse_id: string; version_id: string; score: number; text: string }[]> {
  // Check token early (before loading files) to give a clear error.
  if (!process.env.DEEPINFRA_TOKEN) {
    throw new SemanticUnavailable("DEEPINFRA_TOKEN not set");
  }

  // Find versions with embeddings=1 in DB.
  const embeddedRows = allRows("SELECT version_id FROM versions WHERE embedded=1");
  const loaded: LoadedVersion[] = [];
  for (const row of embeddedRows) {
    const lv = loadVersionEmbeddings(String(row.version_id), embeddingsDir);
    if (lv) loaded.push(lv);
  }

  if (loaded.length === 0) {
    throw new SemanticUnavailable("No embedding files found");
  }

  // Embed the query.
  const [qVec] = await embedBatch([query]);

  // Brute-force cosine over all loaded versions.
  const hits: { verse_id: string; version_id: string; score: number }[] = [];

  for (const lv of loaded) {
    for (let i = 0; i < lv.count; i++) {
      const score = dot(qVec, lv.vectors, i * EMBED_DIM);
      hits.push({ verse_id: lv.idx[i], version_id: lv.version_id, score });
    }
  }

  // Sort desc by score and take top limit.
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, limit);

  // Fetch text from DB for each hit.
  return top.map((h) => {
    const row = getRow(
      "SELECT text FROM verses WHERE version_id=? AND verse_id=?",
      h.version_id,
      h.verse_id
    );
    return { ...h, text: row ? String(row.text) : "" };
  });
}
