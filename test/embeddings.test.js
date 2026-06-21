/**
 * embeddings.test.js — Unit tests for src/embeddings.ts (mocked fetch, no real API calls).
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { embedBatch, EMBED_DIM } from "../dist/embeddings.js";

// ── Fetch stub helpers ──────────────────────────────────────────────────────

let fetchCallCount = 0;
const originalFetch = globalThis.fetch;

/** Install a mock fetch that returns N embeddings (one per input text). */
function mockFetch(overrideFn) {
  fetchCallCount = 0;
  globalThis.fetch = async (url, init) => {
    fetchCallCount++;
    if (overrideFn) return overrideFn(url, init);

    const body = JSON.parse(init.body);
    const n = body.input.length;
    return {
      ok: true,
      json: async () => ({
        data: Array.from({ length: n }, () => ({
          embedding: Array(EMBED_DIM).fill(0.5),
        })),
      }),
    };
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("embedBatch returns N Float32Arrays of length EMBED_DIM", async () => {
  mockFetch();
  try {
    const result = await embedBatch(["hello", "world", "test"], { token: "tok" });
    assert.strictEqual(result.length, 3);
    for (const v of result) {
      assert.ok(v instanceof Float32Array, "expected Float32Array");
      assert.strictEqual(v.length, EMBED_DIM);
    }
  } finally {
    restoreFetch();
  }
});

test("each vector is L2-normalized (norm ≈ 1, tolerance 1e-5)", async () => {
  mockFetch();
  try {
    const result = await embedBatch(["a", "b"], { token: "tok" });
    for (const v of result) {
      let sum = 0;
      for (const x of v) sum += x * x;
      const norm = Math.sqrt(sum);
      assert.ok(
        Math.abs(norm - 1) < 1e-5,
        `Expected norm≈1, got ${norm}`
      );
    }
  } finally {
    restoreFetch();
  }
});

test("batching: >64 texts triggers multiple fetch calls", async () => {
  mockFetch();
  try {
    const texts = Array.from({ length: 130 }, (_, i) => `text${i}`);
    const result = await embedBatch(texts, { token: "tok", batchSize: 64 });
    assert.strictEqual(result.length, 130);
    // 64 + 64 + 2 = 130 → 3 fetch calls (but default batchSize is 64)
    // Actually 130 / 64 = ceil(2.03) = 3 calls (batches: 0-63, 64-127, 128-129)
    assert.strictEqual(fetchCallCount, 3, `Expected 3 fetch calls, got ${fetchCallCount}`);
  } finally {
    restoreFetch();
  }
});

test("order is preserved across batches", async () => {
  // Each batch returns embeddings where value = batch-index for identification
  let batchIndex = 0;
  globalThis.fetch = async (url, init) => {
    const idx = batchIndex++;
    const body = JSON.parse(init.body);
    const n = body.input.length;
    return {
      ok: true,
      json: async () => ({
        data: Array.from({ length: n }, (_, i) => ({
          // First element encodes batch*100 + position
          embedding: Array(EMBED_DIM).fill(0).map((_, j) => (j === 0 ? idx * 100 + i : 0.1)),
        })),
      }),
    };
  };
  try {
    const texts = Array.from({ length: 3 }, (_, i) => `t${i}`);
    const result = await embedBatch(texts, { token: "tok", batchSize: 2 });
    assert.strictEqual(result.length, 3);
    // batch 0 → positions 0,1 → values 0,1; batch 1 → position 0 → value 100
    // After normalization the sign/relative magnitude of element 0 identifies order
    // Batch 0: idx=0, pos=0 → raw[0]=0  (all zeros except j>0: 0.1)
    // Batch 0: idx=0, pos=1 → raw[0]=1
    // Batch 1: idx=1, pos=0 → raw[0]=100
    // We just check the three results are distinct (order preserved)
    const v0 = result[0][0];
    const v1 = result[1][0];
    const v2 = result[2][0];
    // v0 came from batch0/pos0 (raw[0]=0), v1 from batch0/pos1 (raw[0]=1), v2 from batch1/pos0 (raw[0]=100)
    // After normalization v0[0] < v1[0] < v2[0] because 0 < 1 < 100 scaled equally
    assert.ok(v0 <= v1, `Expected result[0][0] <= result[1][0]: ${v0} vs ${v1}`);
    assert.ok(v1 < v2, `Expected result[1][0] < result[2][0]: ${v1} vs ${v2}`);
  } finally {
    restoreFetch();
    batchIndex = 0;
  }
});

test("missing token throws DEEPINFRA_TOKEN error", async () => {
  const saved = process.env.DEEPINFRA_TOKEN;
  delete process.env.DEEPINFRA_TOKEN;
  try {
    await assert.rejects(
      () => embedBatch(["hello"]),
      (err) => {
        assert.ok(err.message.includes("DEEPINFRA_TOKEN"), `Unexpected message: ${err.message}`);
        return true;
      }
    );
  } finally {
    if (saved !== undefined) process.env.DEEPINFRA_TOKEN = saved;
  }
});

test("non-ok response throws with status", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    text: async () => "rate limit exceeded",
  });
  try {
    await assert.rejects(
      () => embedBatch(["hello"], { token: "tok" }),
      (err) => {
        assert.ok(err.message.includes("429"), `Unexpected message: ${err.message}`);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test("EMBED_DIM constant equals 1024", () => {
  assert.strictEqual(EMBED_DIM, 1024);
});
