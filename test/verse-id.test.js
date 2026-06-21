import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRef, formatRef, BOOKS, bookById } from "../dist/verse-id.js";

test("66 books in canonical order", () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS[0].id, "GEN");
  assert.equal(BOOKS[65].id, "REV");
  assert.equal(BOOKS[0].ord, 1);
  assert.equal(BOOKS[65].ord, 66);
});

test("testament split 39/27", () => {
  assert.equal(BOOKS.filter((b) => b.testament === "OT").length, 39);
  assert.equal(BOOKS.filter((b) => b.testament === "NT").length, 27);
});

test("OSIS passthrough (single)", () => {
  assert.deepEqual(parseRef("GEN.1.1"), { start: "GEN.1.1" });
  assert.deepEqual(parseRef("JHN.3.16"), { start: "JHN.3.16" });
});

test("OSIS range (same chapter)", () => {
  assert.deepEqual(parseRef("JHN.3.16-18"), { start: "JHN.3.16", end: "JHN.3.18" });
});

test("English full name", () => {
  assert.deepEqual(parseRef("John 3:16"), { start: "JHN.3.16" });
  assert.deepEqual(parseRef("Genesis 1:1"), { start: "GEN.1.1" });
});

test("English range", () => {
  assert.deepEqual(parseRef("John 3:16-18"), { start: "JHN.3.16", end: "JHN.3.18" });
});

test("English numbered book (1 John)", () => {
  assert.deepEqual(parseRef("1 John 2:1"), { start: "1JN.2.1" });
});

test("Korean abbreviation", () => {
  assert.deepEqual(parseRef("요 3:16"), { start: "JHN.3.16" });
  assert.deepEqual(parseRef("창 1:1"), { start: "GEN.1.1" });
});

test("Korean full name with 장/절", () => {
  assert.deepEqual(parseRef("요한복음 3장 16절"), { start: "JHN.3.16" });
  assert.deepEqual(parseRef("창세기 1장 1절"), { start: "GEN.1.1" });
});

test("Korean numbered book (고린도전서)", () => {
  assert.deepEqual(parseRef("고전 13:4"), { start: "1CO.13.4" });
});

test("invalid returns null", () => {
  assert.equal(parseRef("zzz"), null);
  assert.equal(parseRef(""), null);
  assert.equal(parseRef("Nope 1:1"), null);
});

test("bookById lookup", () => {
  assert.equal(bookById("JHN").ko, "요한복음");
  assert.equal(bookById("XXX"), undefined);
});

test("formatRef", () => {
  assert.equal(formatRef("JHN.3.16"), "John 3:16");
  assert.equal(formatRef("JHN.3.16", "ko"), "요한복음 3:16");
});
