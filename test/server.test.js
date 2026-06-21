// server.test.js — smoke test: real stdio JSON-RPC round-trip via MCP SDK client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DB_PATH = join(REPO_ROOT, "data", "bible.sqlite");
const SERVER_BIN = join(REPO_ROOT, "dist", "index.js");

const SKIP = !existsSync(DB_PATH) || !existsSync(SERVER_BIN);
const SKIP_MSG = "data/bible.sqlite or dist/index.js not present — skipping server smoke test";

const EXPECTED_TOOLS = [
  "lookup",
  "search",
  "cross_references",
  "word_study",
  "list_versions",
  "list_books",
];

test("MCP server stdio smoke test", { timeout: 30_000 }, async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);

  // Dynamic import so missing dist doesn't crash test loader.
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_BIN],
    cwd: REPO_ROOT,
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);

  try {
    // --- tools/list: assert 6 tools with expected names ---
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();
    assert.deepEqual(
      toolNames,
      [...EXPECTED_TOOLS].sort(),
      `Expected tools ${EXPECTED_TOOLS.join(", ")} but got ${toolNames.join(", ")}`
    );

    // --- tools/call lookup John 3:16 — assert Korean 사랑 ---
    const callResult = await client.callTool({
      name: "lookup",
      arguments: { reference: "John 3:16" },
    });
    const text =
      callResult.content?.[0]?.text ?? "";
    assert.ok(
      text.includes("사랑"),
      `lookup John 3:16 should contain '사랑', got: ${text.slice(0, 300)}`
    );
  } finally {
    await client.close();
  }
});
