/**
 * search.test.js — Tests for keyword + semantic search tools.
 * Requires data/bible.sqlite for keyword tests.
 * Semantic happy-path uses fixture .bin/.idx + mocked fetch.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "bible.sqlite");
const EMBED_DIR = join(__dirname, "..", "data", "embeddings");

const SKIP = !existsSync(DB_PATH);
const SKIP_MSG = "data/bible.sqlite not present — skipping search tests";

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMBED_DIM = 1024;

/** Build a unit vector with 1.0 at position `pos` and 0 elsewhere. */
function unitVec(pos) {
  const v = new Float32Array(EMBED_DIM);
  v[pos] = 1.0;
  return v;
}

/** Write fixture .bin (N × 1024 Float32 LE) and .idx.json for a version. */
function writeFixture(versionId, verseIds, vecs) {
  const flat = new Float32Array(verseIds.length * EMBED_DIM);
  for (let i = 0; i < vecs.length; i++) flat.set(vecs[i], i * EMBED_DIM);
  const buf = Buffer.from(flat.buffer);
  writeFileSync(join(EMBED_DIR, `${versionId}.bin`), buf);
  writeFileSync(join(EMBED_DIR, `${versionId}.idx.json`), JSON.stringify(verseIds));
}

/** Delete fixture files if they exist. */
function deleteFixture(versionId) {
  const bin = join(EMBED_DIR, `${versionId}.bin`);
  const idx = join(EMBED_DIR, `${versionId}.idx.json`);
  if (existsSync(bin)) unlinkSync(bin);
  if (existsSync(idx)) unlinkSync(idx);
}

const originalFetch = globalThis.fetch;
let savedToken;

afterEach(() => {
  // Restore fetch and token after each test.
  globalThis.fetch = originalFetch;
  if (savedToken === undefined) {
    delete process.env.DEEPINFRA_TOKEN;
  } else {
    process.env.DEEPINFRA_TOKEN = savedToken;
  }
  deleteFixture("krv");
});

// ── Import tools (dynamic, post-build) ───────────────────────────────────────

async function loadSearch() {
  return import("../dist/tools/search.js");
}
async function loadSemantic() {
  return import("../dist/search/semantic.js");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("keyword search '사랑' returns krv results containing '사랑'", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runSearch } = await loadSearch();
  const result = await runSearch({ query: "사랑", mode: "keyword" });
  const text = result.content[0].text;
  assert.ok(text.includes("사랑"), `Expected '사랑' in results, got: ${text.slice(0, 300)}`);
});

test("keyword search 'love' (default mode) returns English verse", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runSearch } = await loadSearch();
  const result = await runSearch({ query: "love" });
  const text = result.content[0].text;
  assert.ok(text.toLowerCase().includes("love"), `Expected 'love' in results, got: ${text.slice(0, 300)}`);
});

test("keyword search respects limit", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runSearch } = await loadSearch();
  const limit = 3;
  const result = await runSearch({ query: "사랑", mode: "keyword", limit });
  const text = result.content[0].text;
  // Count non-empty result lines (each has a verse ref).
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  assert.ok(
    lines.length <= limit,
    `Expected at most ${limit} result lines, got ${lines.length}: ${text}`
  );
});

test("semantic fallback (no .bin, no token) prepends notice and returns keyword results", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  savedToken = process.env.DEEPINFRA_TOKEN;
  delete process.env.DEEPINFRA_TOKEN;
  // No fixture files written — embedding files absent.
  const { runSearch } = await loadSearch();
  const result = await runSearch({ query: "사랑", mode: "semantic" });
  const text = result.content[0].text;
  const NOTICE = "ⓘ 의미 검색 인덱스/토큰이 준비되지 않아 키워드 검색으로 대체했습니다.";
  assert.ok(text.startsWith(NOTICE), `Expected fallback notice at start, got: ${text.slice(0, 200)}`);
  assert.ok(text.includes("사랑"), `Expected keyword results after notice, got: ${text.slice(0, 300)}`);
});

test("semantic happy path (fixture + mocked fetch) ranks target verse first", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);

  // Three known verse_ids that exist in DB (KRV: John 3:16, Gen 1:1, Psa 23:1).
  const verseIds = ["JHN.3.16", "GEN.1.1", "PSA.23.1"];
  // vec at pos=0 for JHN.3.16, pos=1 for GEN.1.1, pos=2 for PSA.23.1.
  const vecs = [unitVec(0), unitVec(1), unitVec(2)];
  writeFixture("krv", verseIds, vecs);

  // Set up env & mock fetch so embedBatch returns a vector closest to JHN.3.16 (pos=0).
  savedToken = process.env.DEEPINFRA_TOKEN;
  process.env.DEEPINFRA_TOKEN = "test-token";

  // Query vector = unit vec at pos=0 → highest dot product with JHN.3.16's vec.
  const queryVec = Array.from(unitVec(0));
  globalThis.fetch = async (_url, _init) => ({
    ok: true,
    json: async () => ({
      data: [{ embedding: queryVec }],
    }),
  });

  const { runSearch } = await loadSearch();
  // Force module cache miss isn't needed since semantic.ts re-reads files each call.
  const result = await runSearch({ query: "요한복음 3장 16절", mode: "semantic", limit: 3 });
  const text = result.content[0].text;

  // Should NOT start with fallback notice.
  const NOTICE = "ⓘ 의미 검색 인덱스/토큰이 준비되지 않아 키워드 검색으로 대체했습니다.";
  assert.ok(!text.startsWith(NOTICE), `Should not have fallback notice, got: ${text.slice(0, 200)}`);

  // First line should reference JHN.3.16.
  const firstLine = text.split("\n")[0];
  assert.ok(
    firstLine.includes("JHN.3.16") || firstLine.includes("John 3:16") || firstLine.includes("3:16"),
    `Expected JHN.3.16 as top result, got first line: ${firstLine}`
  );
});
