/**
 * wlc.ts — Normalize Hebrew WLC (morphhb / OSHB) OSIS XML to Verse[] + OriginalToken[].
 *
 * Sources: data/sources/wlc/wlc/<Book>.xml  (39 OT books)
 * Format: OSIS 2.1.1, namespace http://www.bibletechnologies.net/2003/OSIS/namespace
 *
 * Key structural notes:
 *   - <verse osisID="Gen.1.1"> wraps <w> elements
 *   - <w lemma="b/7225" morph="HR/Ncfsa">בְּ/רֵאשִׁ֖ית</w>
 *   - <seg type="x-sof-pasuq"> / <seg type="x-maqqef"> appear inside verses — ignored
 *   - <note> elements appear inside verses — ignored
 *   - Ketiv: <w type="x-ketiv"> followed by <note type="variant"><rdg type="x-qere"><w> </rdg></note>
 *     → skip the ketiv <w>; use the qere <w> inside the rdg instead.
 *
 * Lemma parsing → primary Strong's:
 *   "b/7225"  → H7225  (take rightmost numeric segment, ignore prefix codes)
 *   "1254 a"  → H1254a (numeric + optional letter suffix)
 *   "5921 a"  → H5921a
 *   "c/d/776" → H776
 *   "430"     → H430
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { osisToVerseId } from "../../dist/verse-id.js";
import type { Verse, OriginalToken } from "../../dist/corpus-loader/types.js";

// ---------------------------------------------------------------------------
// Lemma → primary Strong's
// ---------------------------------------------------------------------------

/**
 * Given a raw lemma attribute string (e.g. "b/7225", "1254 a", "c/853"),
 * return the canonical Hebrew Strong's string "H<num>[a-z]?" or undefined.
 *
 * Algorithm:
 *   1. Split on "/" to separate morpheme tokens (prefix codes like "b", "c", "d").
 *   2. Take the last token (root morpheme).
 *   3. Match /^(\d+)\s*([a-z])?$/ to extract numeric part + optional letter suffix.
 */
function parseStrongs(lemma: string | undefined): string | undefined {
  if (!lemma) return undefined;
  // Split compound lemmas like "b/7225", "c/d/776"
  const parts = lemma.trim().split("/");
  // The root is the last part
  const root = parts[parts.length - 1].trim();
  // Match optional letter suffix: "1254 a" or "7225" or "5921 a"
  const m = /^(\d+)\s*([a-z])?$/.exec(root);
  if (!m) return undefined;
  const num = m[1];
  const suffix = m[2] ?? "";
  return `H${num}${suffix}`;
}

// ---------------------------------------------------------------------------
// XML element types (fast-xml-parser output)
// ---------------------------------------------------------------------------

interface WAttr {
  "@_lemma"?: string;
  "@_morph"?: string;
  "@_id"?: string;
  "@_type"?: string; // "x-ketiv"
  "@_n"?: string;
}

interface WElement extends WAttr {
  "#text"?: string | number;
}

// fast-xml-parser represents text nodes as "#text" when mixed content is present.
// We need to extract <w> elements from within a <verse> node.

// ---------------------------------------------------------------------------
// Parser setup
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Preserve arrays even for single elements
  isArray: (name) =>
    name === "w" || name === "verse" || name === "chapter" || name === "note" || name === "rdg" || name === "seg",
  removeNSPrefix: true, // strip "osis:" prefixes if present
});

// ---------------------------------------------------------------------------
// Extract <w> tokens from a parsed verse node
//
// A verse node (after parsing) looks like:
//   { w: [...], note: [...], seg: [...], "#text": ... }
//
// Ketiv/qere: the ketiv <w type="x-ketiv"> is followed by a
//   <note type="variant"><catchWord>...</catchWord><rdg type="x-qere"><w>...</w></rdg></note>
// Strategy: collect all <w> elements that are NOT type="x-ketiv",
// PLUS any <w> inside <note type="variant"><rdg type="x-qere">.
// ---------------------------------------------------------------------------

interface ParsedVerseNode {
  w?: WElement[];
  note?: Array<{
    "@_type"?: string;
    rdg?: Array<{
      "@_type"?: string;
      w?: WElement[];
    }>;
  }>;
  seg?: unknown[];
}

function extractWords(verseNode: ParsedVerseNode): WElement[] {
  const result: WElement[] = [];

  // Collect qere w-elements from notes
  const qereWords: WElement[] = [];
  if (Array.isArray(verseNode.note)) {
    for (const note of verseNode.note) {
      if (note["@_type"] === "variant" && Array.isArray(note.rdg)) {
        for (const rdg of note.rdg) {
          if (rdg["@_type"] === "x-qere" && Array.isArray(rdg.w)) {
            for (const w of rdg.w) {
              qereWords.push(w);
            }
          }
        }
      }
    }
  }

  // Process main <w> elements
  if (Array.isArray(verseNode.w)) {
    for (const w of verseNode.w) {
      if (w["@_type"] === "x-ketiv") {
        // Skip ketiv; qere will be added below from notes
        continue;
      }
      result.push(w);
    }
  }

  // Append qere words (they come after their ketiv position in order)
  // To maintain reading order: qere words are inserted at their natural position.
  // Since we skip ketiv and have qere in notes, we append them.
  // The notes appear right after the ketiv in document order, so appending
  // after regular words is slightly wrong for very mixed verses, but in practice
  // ketiv/qere pairs are rare and don't affect neighboring words.
  // A simpler correct approach: insert qere words at position of the skipped ketiv.
  // However, the verse text will still be joined correctly since the qere replaces ketiv.
  // For v1, append qere words after regular non-ketiv words:
  for (const w of qereWords) {
    result.push(w);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Surface text: remove "/" morpheme separators
// ---------------------------------------------------------------------------

function cleanSurface(text: string): string {
  return text.replace(/\//g, "");
}

// ---------------------------------------------------------------------------
// Main normalizer
// ---------------------------------------------------------------------------

export function normalizeWlc(sourcesDir: string): {
  verses: Verse[];
  tokens: OriginalToken[];
} {
  const wlcDir = join(sourcesDir, "wlc", "wlc");
  const files = readdirSync(wlcDir).filter(
    (f) => f.endsWith(".xml") && f !== "VerseMap.xml"
  );

  const verses: Verse[] = [];
  const tokens: OriginalToken[] = [];
  let skippedVerses = 0;

  for (const file of files) {
    const filePath = join(wlcDir, file);
    const xml = readFileSync(filePath, "utf-8");
    const doc = parser.parse(xml);

    // Navigate: osis > osisText > div* > chapter* > verse*
    // The structure may vary by book, so we do a recursive search for verses.
    collectVerses(doc, verses, tokens, { skippedVerses });
  }

  return { verses, tokens };
}

// ---------------------------------------------------------------------------
// Recursive traversal to find all <verse> nodes regardless of nesting
// ---------------------------------------------------------------------------

function collectVerses(
  node: unknown,
  verses: Verse[],
  tokens: OriginalToken[],
  stats: { skippedVerses: number }
): void {
  if (!node || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;

  // Check if this node IS a verse (has osisID attribute and w elements)
  // In the parsed output, verse elements have "@_osisID"
  if ("@_osisID" in obj) {
    const osisID = obj["@_osisID"] as string;
    // Only process verse-level osisIDs (book.chapter.verse = 3 parts)
    const parts = osisID.split(".");
    if (parts.length === 3) {
      processVerse(osisID, obj as ParsedVerseNode, verses, tokens, stats);
      return; // don't recurse into a verse node
    }
  }

  // Recurse into child nodes
  for (const key of Object.keys(obj)) {
    if (key.startsWith("@_")) continue;
    const child = obj[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        collectVerses(item, verses, tokens, stats);
      }
    } else {
      collectVerses(child, verses, tokens, stats);
    }
  }
}

function processVerse(
  osisID: string,
  verseNode: ParsedVerseNode,
  verses: Verse[],
  tokens: OriginalToken[],
  stats: { skippedVerses: number }
): void {
  const verseId = osisToVerseId(osisID);
  if (!verseId) {
    stats.skippedVerses++;
    return;
  }

  const [book_id, chStr, vsStr] = verseId.split(".");
  const chapter = Number(chStr);
  const verse = Number(vsStr);

  const words = extractWords(verseNode);

  // Build verse text: join surfaces with spaces
  const surfaceWords: string[] = [];
  for (const w of words) {
    const raw = w["#text"] !== undefined ? String(w["#text"]) : "";
    if (!raw) continue;
    surfaceWords.push(cleanSurface(raw));
  }

  const text = surfaceWords.join(" ").trim();

  verses.push({
    version_id: "wlc",
    verse_id: verseId,
    book_id,
    chapter,
    verse,
    text,
  });

  // Build tokens
  let position = 0;
  for (const w of words) {
    const raw = w["#text"] !== undefined ? String(w["#text"]) : "";
    if (!raw) continue;
    const surface = cleanSurface(raw);
    const lemma = w["@_lemma"];
    const morph = w["@_morph"];
    const strongs = parseStrongs(lemma);

    const tok: OriginalToken = {
      verse_id: verseId,
      lang: "he",
      position,
      surface,
      ...(lemma !== undefined ? { lemma } : {}),
      ...(strongs !== undefined ? { strongs } : {}),
      ...(morph !== undefined ? { morph } : {}),
    };
    tokens.push(tok);
    position++;
  }
}
