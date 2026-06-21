#!/usr/bin/env node
// run-examples.mjs — eyeball test for all 6 tool handlers.
// Usage: node examples/run-examples.mjs
// (Run from repo root so dist/ and data/ are found relative to process.cwd())

import { runLookup } from "../dist/tools/lookup.js";
import { runSearch } from "../dist/tools/search.js";
import { runCrossReferences } from "../dist/tools/cross_references.js";
import { runWordStudy } from "../dist/tools/word_study.js";
import { runListVersions } from "../dist/tools/list_versions.js";
import { runListBooks } from "../dist/tools/list_books.js";

function section(title) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + title);
  console.log("=".repeat(60));
}

function printResult(result) {
  const text = result.content[0]?.text ?? "(empty)";
  // Print first 800 chars to keep output manageable.
  const preview = text.length > 800 ? text.slice(0, 800) + "\n…(truncated)" : text;
  console.log(preview);
}

// 1. lookup John 3:16 (default version)
section("1. lookup — John 3:16 (기본 역본)");
printResult(runLookup({ reference: "John 3:16" }));

// 2. lookup Genesis 1:1 with original + lexicon
section("2. lookup — Genesis 1:1 (원문 + 렉시콘)");
printResult(
  runLookup({
    reference: "Genesis 1:1",
    include_original: true,
    include_lexicon: true,
  })
);

// 3. search — 사랑 keyword
section("3. search — '사랑' keyword");
printResult(await runSearch({ query: "사랑", mode: "keyword", limit: 5 }));

// 4. cross_references — Genesis 1:1
section("4. cross_references — Genesis 1:1");
printResult(runCrossReferences({ reference: "Genesis 1:1", limit: 10 }));

// 5. word_study — John 1:1, G3056 (λόγος)
section("5. word_study — John 1:1, strongs G3056");
printResult(runWordStudy({ reference: "John 1:1", strongs: "G3056" }));

// 6. list_versions
section("6. list_versions");
const versResult = runListVersions();
const versText = versResult.content[0]?.text ?? "";
// Print first 5 lines
console.log(versText.split("\n").slice(0, 6).join("\n"));

// 7. list_books
section("7. list_books (first 10 books)");
const booksResult = runListBooks();
const booksText = booksResult.content[0]?.text ?? "";
console.log(booksText.split("\n").slice(0, 12).join("\n"));

console.log("\n" + "=".repeat(60));
console.log("  done — no crash");
console.log("=".repeat(60) + "\n");
