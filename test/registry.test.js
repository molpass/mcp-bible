import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listVersions, defaultVersion } from "../dist/corpus-loader/registry.js";

function fixtureDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE versions(version_id TEXT PRIMARY KEY, name TEXT, lang TEXT, license TEXT, source TEXT DEFAULT 'bundled', direction TEXT DEFAULT 'ltr', has_original INTEGER DEFAULT 0, embedded INTEGER DEFAULT 0)"
  );
  db.exec(
    "INSERT INTO versions(version_id,name,lang,license,source,direction,has_original,embedded) VALUES " +
      "('krv','개역한글','ko','PD','bundled','ltr',0,1)," +
      "('bsb','Berean Standard Bible','en','CC0','bundled','ltr',0,1)," +
      "('wlc','Hebrew WLC','he','PD','bundled','rtl',1,0)"
  );
  return db;
}
function tmpLocal() {
  return mkdtempSync(join(tmpdir(), "mcpb-local-"));
}
function writeKrvRev(dir) {
  writeFileSync(
    join(dir, "krv-rev.json"),
    JSON.stringify({ version_id: "krv-rev", version_name: "개역개정", license_note: "private/local only", verses: { "GEN.1.1": "..." } })
  );
}

test("bundled versions listed", () => {
  const db = fixtureDb();
  const dir = tmpLocal();
  try {
    const v = listVersions(db, dir);
    assert.equal(v.length, 3);
    assert.ok(v.find((x) => x.version_id === "krv"));
    assert.equal(v.find((x) => x.version_id === "wlc").direction, "rtl");
    assert.equal(v.find((x) => x.version_id === "wlc").has_original, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("local module merged with source=local", () => {
  const db = fixtureDb();
  const dir = tmpLocal();
  writeKrvRev(dir);
  try {
    const v = listVersions(db, dir);
    assert.equal(v.length, 4);
    const lv = v.find((x) => x.version_id === "krv-rev");
    assert.ok(lv);
    assert.equal(lv.source, "local");
    assert.equal(lv.name, "개역개정");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("default = krv-rev when local present", () => {
  const db = fixtureDb();
  const dir = tmpLocal();
  writeKrvRev(dir);
  try {
    assert.equal(defaultVersion(db, dir), "krv-rev");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("default = krv when no local module", () => {
  const db = fixtureDb();
  const dir = tmpLocal();
  try {
    assert.equal(defaultVersion(db, dir), "krv");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed local file is skipped", () => {
  const db = fixtureDb();
  const dir = tmpLocal();
  writeFileSync(join(dir, "broken.json"), "{ not valid json");
  try {
    const v = listVersions(db, dir);
    assert.equal(v.length, 3); // broken file ignored
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
