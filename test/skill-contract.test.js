import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const skill = readFileSync(fileURLToPath(new URL("../skill/bible.skill.md", import.meta.url)), "utf8");

test("frontmatter name is bible", () => {
  assert.match(skill, /^---[\s\S]*?\nname:\s*bible\b/);
});

test("triggers on 성경/기독교", () => {
  assert.match(skill, /성경/);
  assert.match(skill, /기독교/);
});

test("interpretive frame = Wesleyan quadrilateral", () => {
  assert.match(skill, /사변형/);
  assert.match(skill, /성경.*전통.*이성.*경험/);
});

test("pastoral tone: empathy, no condemnation/coercion", () => {
  assert.match(skill, /공감/);
  assert.match(skill, /정죄/); // appears in a prohibition
  assert.match(skill, /강요/);
});

test("conduct judgment = evidence verse first", () => {
  assert.match(skill, /근거 구절/);
});

test("single-synthesis call rule, no multi-chaining", () => {
  assert.match(skill, /단일/); // 단일 답 / single synthesis
  assert.match(skill, /다중 체이닝/);
});

test("references the 6 tools", () => {
  for (const t of ["lookup", "search", "cross_references", "word_study", "list_versions", "list_books"]) {
    assert.ok(skill.includes(t), `skill should mention ${t}`);
  }
});
