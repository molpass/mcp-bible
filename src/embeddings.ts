/**
 * embeddings.ts — BGE-M3 embedding client via DeepInfra OpenAI-compatible API.
 * Used at runtime by semantic.ts and at build-time by scripts/build-embeddings.ts.
 */

export const EMBED_DIM = 1024;

const ENDPOINT = "https://api.deepinfra.com/v1/openai/embeddings";
const MODEL = "BAAI/bge-m3";
const DEFAULT_BATCH = 64;

/** L2-normalize a Float32Array in place. Guards against zero norm. */
function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) v[i] /= norm;
  }
  return v;
}

/**
 * Embed a list of texts using DeepInfra BGE-M3.
 * Splits into batches, calls one fetch per batch, returns L2-normalized Float32Array[].
 * Uses globalThis.fetch so tests can stub it.
 */
export async function embedBatch(
  texts: string[],
  opts?: { token?: string; batchSize?: number }
): Promise<Float32Array[]> {
  const token = opts?.token ?? process.env.DEEPINFRA_TOKEN;
  if (!token) throw new Error("DEEPINFRA_TOKEN required for embeddings");

  const batchSize = opts?.batchSize ?? DEFAULT_BATCH;
  const results: Float32Array[] = new Array(texts.length);

  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize);

    const res = await globalThis.fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model: MODEL, input: batch }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Embedding API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data: { embedding: number[] }[] };

    for (let i = 0; i < json.data.length; i++) {
      const vec = new Float32Array(json.data[i].embedding);
      results[start + i] = l2Normalize(vec);
    }
  }

  return results;
}
