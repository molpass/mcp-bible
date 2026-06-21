// local-module.test.js — end-to-end tests for the local translation module.
// Requires data/bible.sqlite to be present (same guard as tools.test.js).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "data", "bible.sqlite");
const LOCAL_DIR = join(ROOT, "data", "local");
const FIXTURE_PATH = join(LOCAL_DIR, "krv-rev.json");

const SKIP = !existsSync(DB_PATH);
const SKIP_MSG = "data/bible.sqlite not present — skipping local-module tests";

const FIXTURE = {
  version_id: "krv-rev",
  version_name: "개역개정",
  license_note: "private/local only — do not redistribute",
  verses: {
    "JHN.3.16": "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 (개역개정 테스트)",
  },
};

function writeFixture() {
  writeFileSync(FIXTURE_PATH, JSON.stringify(FIXTURE, null, 2), "utf8");
}

function deleteFixture() {
  try {
    unlinkSync(FIXTURE_PATH);
  } catch {
    // already gone — fine
  }
}

// Dynamic imports of dist/ so missing DB doesn't crash at import time.
async function loadModules() {
  const [
    { localVersionIds, isLocalVersion, getLocalVerse, clearLocalCache },
    { defaultVersion },
    { getDb, getLocalDir },
    { runListVersions },
    { runLookup },
  ] = await Promise.all([
    import("../dist/corpus-loader/local.js"),
    import("../dist/corpus-loader/registry.js"),
    import("../dist/db.js"),
    import("../dist/tools/list_versions.js"),
    import("../dist/tools/lookup.js"),
  ]);
  return { localVersionIds, isLocalVersion, getLocalVerse, clearLocalCache, defaultVersion, getDb, getLocalDir, runListVersions, runLookup };
}

// Write fixture before tests, clear it after all tests.
before(() => {
  if (!SKIP) writeFixture();
});

after(() => {
  deleteFixture();
});

test("gitignore contains data/local/*.json pattern", () => {
  const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
  assert.ok(
    gitignore.includes("data/local/*.json"),
    ".gitignore must exclude data/local/*.json"
  );
});

test("localVersionIds() includes krv-rev", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { localVersionIds, clearLocalCache } = await loadModules();
  clearLocalCache();
  const ids = localVersionIds();
  assert.ok(ids.includes("krv-rev"), `Expected krv-rev in localVersionIds, got: ${ids}`);
});

test("isLocalVersion('krv-rev') returns true", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { isLocalVersion, clearLocalCache } = await loadModules();
  clearLocalCache();
  assert.equal(isLocalVersion("krv-rev"), true);
});

test("getLocalVerse returns fixture text for JHN.3.16", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { getLocalVerse, clearLocalCache } = await loadModules();
  clearLocalCache();
  const text = getLocalVerse("krv-rev", "JHN.3.16");
  assert.equal(text, FIXTURE.verses["JHN.3.16"]);
});

test("getLocalVerse returns null for missing verse", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { getLocalVerse, clearLocalCache } = await loadModules();
  clearLocalCache();
  const text = getLocalVerse("krv-rev", "JHN.3.17");
  assert.equal(text, null);
});

test("runListVersions() includes krv-rev marked as local", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runListVersions } = await loadModules();
  const result = runListVersions();
  const text = result.content[0].text;
  assert.ok(text.includes("krv-rev"), `Expected krv-rev in list_versions output, got: ${text.slice(0, 400)}`);
  assert.ok(
    text.includes("로컬 설치") || text.includes("local"),
    `Expected local tag in list_versions output, got: ${text.slice(0, 400)}`
  );
});

test("defaultVersion() returns krv-rev when fixture present", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { defaultVersion, getDb, getLocalDir } = await loadModules();
  const db = { prepare: (sql) => getDb().prepare(sql) };
  const ver = defaultVersion(db, getLocalDir());
  assert.equal(ver, "krv-rev");
});

test("runLookup John 3:16 (default) — returns fixture text", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup, clearLocalCache } = await loadModules();
  clearLocalCache();
  const result = runLookup({ reference: "John 3:16" });
  const text = result.content[0].text;
  assert.ok(
    text.includes("개역개정 테스트"),
    `Expected fixture string '개역개정 테스트' in output, got: ${text.slice(0, 400)}`
  );
});

test("runLookup John 3:17 with krv-rev — fallback to krv with label", async (t) => {
  if (SKIP) return t.skip(SKIP_MSG);
  const { runLookup, clearLocalCache } = await loadModules();
  clearLocalCache();
  const result = runLookup({ reference: "John 3:17", versions: ["krv-rev"] });
  const text = result.content[0].text;
  // Should contain fallback label.
  assert.ok(
    text.includes("개역한글 본문"),
    `Expected fallback label '개역한글 본문' in output, got: ${text.slice(0, 400)}`
  );
  // Should contain actual krv text (John 3:17 mentions 정죄/심판/구원 area).
  // We just verify it's not empty and contains some Korean characters.
  const hasKorean = /[가-힣]/.test(text);
  assert.ok(hasKorean, `Expected Korean fallback text, got: ${text.slice(0, 400)}`);
});
