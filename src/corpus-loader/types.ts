// Shared domain types for mcp-bible. The build pipeline (scripts/) produces rows of these
// shapes and the runtime (src/) reads them back. Multi-religion-ready boundary: a future
// corpus (sutra/quran) reuses Version/Verse/verse-id; only the normalizers differ.

export interface Version {
  version_id: string; // e.g. "krv", "bsb", "krv-rev"
  name: string;
  lang: string; // "ko" | "en" | "he" | "grc"
  license: string;
  source: "bundled" | "local";
  direction: "ltr" | "rtl";
  has_original: boolean; // carries original-language tokens
  embedded: boolean; // has a semantic embedding index
}

export interface Verse {
  version_id: string;
  verse_id: string; // "GEN.1.1"
  book_id: string; // "GEN"
  chapter: number;
  verse: number;
  text: string;
}

export interface OriginalToken {
  verse_id: string;
  lang: "he" | "grc";
  position: number; // word order within the verse, 0-based
  surface: string; // the word form as written
  lemma?: string;
  strongs?: string; // "H7225" | "G3056"
  morph?: string; // morphology code
}

export interface Lexeme {
  strongs: string; // "H7225"
  lang: "he" | "grc";
  lemma?: string; // original-language headword
  translit?: string;
  gloss?: string; // short definition
  definition?: string; // fuller definition
}

export interface XRef {
  from_verse: string; // "GEN.1.1"
  to_start: string; // "JHN.1.1"
  to_end?: string; // range end, if any
  votes: number; // relevance score (OpenBible)
}
