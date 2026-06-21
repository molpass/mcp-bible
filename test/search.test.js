/**
 * search.test.js — Tests for keyword + semantic search tools.
 * Requires data/bible.sqlite for keyword tests.
 * Semantic happy-path writes fixtures to an ISOLATED temp dir (never touches the real
 * data/embeddings/ so precomputed .bin assets are safe) and mocks fetch.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "bible.sqlite");

const SKIP = !existsSync(DB_PATH);
const SKIP_MSG = "data/bible.sqlite not present — skipping search tests";

const EMBED_DIM = 1024;

/** Build a unit vector with 1.0 at position `pos` and 0 elsewhere. */
function unitVec(pos) {
  const v = new Float32Array(EMBED_DIM);
  v[pos] = 1.0;
  return v;
}

/** Write fixture .bin (N × 1024 Float32 LE) and .idx.json into `dir`. */
function writeFixture(dir, versionId, verseIds, vecs) {
  const flat = new Float32Array(verseIds.length * EMBED_DIM);
  for (let i = 0; i < vecs.length; i++) flat.set(vecs[i], i * EMBED_DIM);
  writeFileSync(join(dir, `${versionId}.bin`), Buffer.from(flat.buffer));
  writeFileSync(join(dir, `${versionId}.idx.json`), JSON.stringify(verseIds));
}

const originalFetch = globalThis.fetch;
let savedToken;

afterEach(() => {
  // Restore fetch and token after each test. (No real-dir fixtures are created,
  // so there is nothing in data/embeddings/ to clean up — real .bin stays safe.)
  globalThis.fetch = originalFetch;
  if (savedToken === undefined) {
    delete process.env.DEEPINFRA_TOKEN;
  } else {
    process.env.DEEPINFRA_TOKEN = savedToken;
  }
  savedToken = undefined;
});

async function loadSearch() {
  return import("../dist/tools/search.js");
}

// ── Keyword ────────────────────────────────────────────────────────────────

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
  assert.ok(text.toLowerCase().includes("love"), `Expected 'love', got: ${text.slice(0, 300)}`);
});

test("keyword search respects limit", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runSearch } = await loadSearch();
  const limit = 3;
  const result = await runSearch({ query: "사랑", mode: "keyword", limit });
  const lines = result.content[0].text.split("\n").filter((l) => l.trim().length > 0);
  assert.ok(lines.length <= limit, `Expected ≤ ${limit} lines, got ${lines.length}`);
});

// ── Semantic ───────────────────────────────────────────────────────────────

test("semantic fallback (no token) prepends notice and returns keyword results", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  savedToken = process.env.DEEPINFRA_TOKEN;
  delete process.env.DEEPINFRA_TOKEN; // no token → SemanticUnavailable → keyword fallback
  const { runSearch } = await loadSearch();
  const result = await runSearch({ query: "사랑", mode: "semantic" });
  const text = result.content[0].text;
  const NOTICE = "ⓘ 의미 검색 인덱스/토큰이 준비되지 않아 키워드 검색으로 대체했습니다.";
  assert.ok(text.startsWith(NOTICE), `Expected fallback notice, got: ${text.slice(0, 200)}`);
  assert.ok(text.includes("사랑"), `Expected keyword results after notice`);
});

test("semantic happy path (isolated temp fixture + mocked fetch) ranks target verse first", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);

  // Isolated temp dir — real data/embeddings/ is never touched.
  const tmp = mkdtempSync(join(tmpdir(), "mcpb-emb-"));
  try {
    // krv IS embedded=1 in the DB, so semanticSearch will load krv from our override dir.
    const verseIds = ["JHN.3.16", "GEN.1.1", "PSA.23.1"];
    writeFixture(tmp, "krv", verseIds, [unitVec(0), unitVec(1), unitVec(2)]);

    savedToken = process.env.DEEPINFRA_TOKEN;
    process.env.DEEPINFRA_TOKEN = "test-token";

    // Mock fetch so embedBatch returns a vector closest to JHN.3.16 (pos=0).
    const queryVec = Array.from(unitVec(0));
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [{ embedding: queryVec }] }) });

    const { runSearch } = await loadSearch();
    const result = await runSearch(
      { query: "요한복음 3장 16절", mode: "semantic", limit: 3 },
      { embeddingsDir: tmp }
    );
    const text = result.content[0].text;

    const NOTICE = "ⓘ 의미 검색 인덱스/토큰이 준비되지 않아 키워드 검색으로 대체했습니다.";
    assert.ok(!text.startsWith(NOTICE), `Should not fall back, got: ${text.slice(0, 200)}`);
    const firstLine = text.split("\n")[0];
    assert.ok(
      firstLine.includes("JHN.3.16") || firstLine.includes("John 3:16") || firstLine.includes("3:16"),
      `Expected JHN.3.16 first, got: ${firstLine}`
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
