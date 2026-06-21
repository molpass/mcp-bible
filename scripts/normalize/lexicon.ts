/**
 * lexicon.ts — Normalize Strong's lexicons (Hebrew + Greek) to Lexeme[].
 *
 * Sources:
 *   Hebrew: data/sources/lexicon/hebrew/StrongHebrewG.xml
 *     <div type="entry" n="1">
 *       <w ID="H1" lemma="אָב" xlit="ʼâb" xml:lang="heb">אב</w>
 *       <list><item>...</item></list>
 *       <note type="explanation">...</note>
 *       <note type="translation">...</note>
 *     </div>
 *
 *   Greek: data/sources/lexicon/greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml
 *     <entry strongs="00001">
 *       <greek unicode="Α" translit="A"/>
 *       <strongs_def>...</strongs_def>
 *       <kjv_def>--Alpha.</kjv_def>
 *     </entry>
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Lexeme } from "../../dist/corpus-loader/types.js";

// ---------------------------------------------------------------------------
// XML parser setup
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) =>
    name === "div" || name === "item" || name === "note" || name === "w" || name === "entry",
  removeNSPrefix: true,
});

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a node that may be a string, number, or object with #text */
function extractText(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if ("#text" in obj) return extractText(obj["#text"]);
  }
  return "";
}

/** Join all text from an array of items */
function joinItems(items: unknown[]): string {
  return items
    .map((item) => extractText(item))
    .filter(Boolean)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Hebrew lexicon
// ---------------------------------------------------------------------------

interface HebrewWAttr {
  "@_ID"?: string;
  "@_lemma"?: string;
  "@_xlit"?: string;
  "#text"?: string;
}

interface HebrewNoteAttr {
  "@_type"?: string;
  "#text"?: unknown;
  hi?: unknown;
}

interface HebrewDivNode {
  "@_type"?: string;
  "@_n"?: string | number;
  w?: HebrewWAttr | HebrewWAttr[];
  list?: { item?: unknown[] } | Array<{ item?: unknown[] }>;
  note?: HebrewNoteAttr | HebrewNoteAttr[];
}

function normalizeHebrewLexicon(sourcesDir: string): Lexeme[] {
  const filePath = join(
    sourcesDir,
    "lexicon",
    "hebrew",
    "StrongHebrewG.xml"
  );
  const xml = readFileSync(filePath, "utf-8");
  const doc = parser.parse(xml);

  // Navigate: osis > osisText > div (type=lexicon) > div (type=entry)
  const entries: HebrewDivNode[] = [];
  collectDivEntries(doc, entries);

  const lexemes: Lexeme[] = [];

  for (const entry of entries) {
    if (entry["@_type"] !== "entry") continue;

    const n = entry["@_n"];
    if (n === undefined) continue;

    // Get the <w> element (head word)
    const wArr = Array.isArray(entry.w) ? entry.w : entry.w ? [entry.w] : [];
    const headW = wArr[0];
    if (!headW) continue;

    const rawID = headW["@_ID"];
    if (!rawID) continue;

    // strongs: already "H1", "H7225", etc.
    const strongs = rawID;
    if (!/^H\d+$/.test(strongs)) continue;

    const lemma = headW["@_lemma"];
    const translit = headW["@_xlit"];

    // Definition: gather list items + explanation/translation notes
    const listNode = Array.isArray(entry.list) ? entry.list[0] : entry.list;
    const items = listNode?.item ?? [];
    const itemsArr = Array.isArray(items) ? items : [items];
    const listText = joinItems(itemsArr);

    // Notes
    const notesArr = Array.isArray(entry.note)
      ? entry.note
      : entry.note
      ? [entry.note]
      : [];
    const explanationNote = notesArr.find((n) => n["@_type"] === "explanation");
    const translationNote = notesArr.find((n) => n["@_type"] === "translation");

    // Extract text from notes (may have <hi> children)
    const explanationText = explanationNote
      ? extractNoteText(explanationNote)
      : "";
    const translationText = translationNote
      ? extractNoteText(translationNote)
      : "";

    // Build gloss (short) and definition (fuller)
    // gloss = first list item; definition = all list items + explanation
    const gloss = itemsArr.length > 0 ? extractText(itemsArr[0]) : explanationText || translationText;
    const definitionParts = [listText, explanationText, translationText].filter(Boolean);
    const definition = definitionParts.join(" | ") || gloss;

    const lexeme: Lexeme = {
      strongs,
      lang: "he",
      ...(lemma ? { lemma } : {}),
      ...(translit ? { translit } : {}),
      ...(gloss ? { gloss } : {}),
      ...(definition ? { definition } : {}),
    };
    lexemes.push(lexeme);
  }

  return lexemes;
}

/** Recursively extract text from a note node that may contain <hi> child elements */
function extractNoteText(note: HebrewNoteAttr): string {
  const parts: string[] = [];
  const text = extractText(note["#text"]);
  if (text) parts.push(text);
  if (note.hi) {
    const hiArr = Array.isArray(note.hi) ? note.hi : [note.hi];
    for (const hi of hiArr) {
      const t = extractText(hi);
      if (t) parts.push(t);
    }
  }
  return parts.join(" ").trim();
}

function collectDivEntries(node: unknown, result: HebrewDivNode[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if ("@_type" in obj && obj["@_type"] === "entry") {
    result.push(obj as HebrewDivNode);
    return; // don't recurse further into entries
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith("@_") || key === "#text") continue;
    const child = obj[key];
    if (Array.isArray(child)) {
      for (const item of child) collectDivEntries(item, result);
    } else {
      collectDivEntries(child, result);
    }
  }
}

// ---------------------------------------------------------------------------
// Greek lexicon
// ---------------------------------------------------------------------------

interface GreekEntryNode {
  "@_strongs"?: string;
  greek?: { "@_unicode"?: string; "@_translit"?: string } | Array<{ "@_unicode"?: string; "@_translit"?: string }>;
  strongs_def?: unknown;
  kjv_def?: unknown;
}

function normalizeGreekLexicon(sourcesDir: string): Lexeme[] {
  const filePath = join(
    sourcesDir,
    "lexicon",
    "greek",
    "StrongsGreekDictionaryXML_1.4",
    "strongsgreek.xml"
  );
  const xml = readFileSync(filePath, "utf-8");
  const doc = parser.parse(xml);

  const entries: GreekEntryNode[] = [];
  collectGreekEntries(doc, entries);

  const lexemes: Lexeme[] = [];

  for (const entry of entries) {
    const rawStrongs = entry["@_strongs"];
    if (!rawStrongs) continue;

    // Strip leading zeros: "00001" -> "G1"
    const num = parseInt(rawStrongs, 10);
    if (isNaN(num)) continue;
    const strongs = `G${num}`;

    // Greek head word
    const greekNode = Array.isArray(entry.greek) ? entry.greek[0] : entry.greek;
    const lemma = greekNode?.["@_unicode"];
    const translit = greekNode?.["@_translit"];

    // strongs_def: may contain mixed text with child elements (greek, latin, strongsref, etc.)
    const defText = extractMixedText(entry.strongs_def);

    // kjv_def: strip leading "--" and trailing "."
    const rawKjv = extractMixedText(entry.kjv_def);
    const kjvClean = rawKjv
      .replace(/^[:\s–—-]+/, "") // strip leading "--" or ":" variants
      .replace(/\.\s*$/, "")     // strip trailing period
      .trim();

    // gloss = cleaned kjv_def; if empty, use first phrase of strongs_def
    const gloss = kjvClean || defText.split(";")[0].trim();
    const definition = defText || gloss;

    const lexeme: Lexeme = {
      strongs,
      lang: "grc",
      ...(lemma ? { lemma } : {}),
      ...(translit ? { translit } : {}),
      ...(gloss ? { gloss } : {}),
      ...(definition ? { definition } : {}),
    };
    lexemes.push(lexeme);
  }

  return lexemes;
}

/** Extract text from a mixed-content node (may have child elements interspersed) */
function extractMixedText(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const parts: string[] = [];
    // Collect #text
    if ("#text" in obj) {
      const t = extractText(obj["#text"]);
      if (t) parts.push(t);
    }
    // Collect child element text (skip attribute keys)
    for (const key of Object.keys(obj)) {
      if (key.startsWith("@_") || key === "#text") continue;
      const child = obj[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          const t = extractMixedText(item);
          if (t) parts.push(t);
        }
      } else {
        const t = extractMixedText(child);
        if (t) parts.push(t);
      }
    }
    return parts.join(" ").trim();
  }
  return "";
}

function collectGreekEntries(node: unknown, result: GreekEntryNode[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if ("@_strongs" in obj) {
    result.push(obj as GreekEntryNode);
    return;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith("@_") || key === "#text") continue;
    const child = obj[key];
    if (Array.isArray(child)) {
      for (const item of child) collectGreekEntries(item, result);
    } else {
      collectGreekEntries(child, result);
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function normalizeLexicon(sourcesDir: string): Lexeme[] {
  const hebrew = normalizeHebrewLexicon(sourcesDir);
  const greek = normalizeGreekLexicon(sourcesDir);
  return [...hebrew, ...greek];
}
