// OSIS-style verse identifiers for mcp-bible.
// Verse id format: "<BOOK>.<chapter>.<verse>" with 3-letter USFM book codes (e.g. "GEN.1.1", "JHN.3.16").
// parseRef accepts OSIS ids, English ("John 3:16", "1 John 2:1"), and Korean ("요 3:16", "요한복음 3장 16절").

export interface Book {
  id: string; // USFM code, e.g. "GEN"
  ord: number; // 1..66
  en: string;
  ko: string;
  testament: "OT" | "NT";
  chapters: number;
  enAbbr: string[];
  koAbbr: string[];
}

export interface RefResult {
  start: string;
  end?: string;
}

// [id, en, ko, chapters, enAbbr[], koAbbr[]]
type Raw = [string, string, string, number, string[], string[]];

const RAW: Raw[] = [
  ["GEN", "Genesis", "창세기", 50, ["Gen", "Ge"], ["창"]],
  ["EXO", "Exodus", "출애굽기", 40, ["Exod", "Ex"], ["출"]],
  ["LEV", "Leviticus", "레위기", 27, ["Lev", "Lv"], ["레"]],
  ["NUM", "Numbers", "민수기", 36, ["Num", "Nm"], ["민"]],
  ["DEU", "Deuteronomy", "신명기", 34, ["Deut", "Dt"], ["신"]],
  ["JOS", "Joshua", "여호수아", 24, ["Josh", "Jos"], ["수"]],
  ["JDG", "Judges", "사사기", 21, ["Judg", "Jdg"], ["삿"]],
  ["RUT", "Ruth", "룻기", 4, ["Ruth", "Ru"], ["룻"]],
  ["1SA", "1 Samuel", "사무엘상", 31, ["1Sam", "1Sa"], ["삼상"]],
  ["2SA", "2 Samuel", "사무엘하", 24, ["2Sam", "2Sa"], ["삼하"]],
  ["1KI", "1 Kings", "열왕기상", 22, ["1Kgs", "1Ki"], ["왕상"]],
  ["2KI", "2 Kings", "열왕기하", 25, ["2Kgs", "2Ki"], ["왕하"]],
  ["1CH", "1 Chronicles", "역대상", 29, ["1Chr", "1Ch"], ["대상"]],
  ["2CH", "2 Chronicles", "역대하", 36, ["2Chr", "2Ch"], ["대하"]],
  ["EZR", "Ezra", "에스라", 10, ["Ezra", "Ezr"], ["스"]],
  ["NEH", "Nehemiah", "느헤미야", 13, ["Neh", "Ne"], ["느"]],
  ["EST", "Esther", "에스더", 10, ["Esth", "Est"], ["에"]],
  ["JOB", "Job", "욥기", 42, ["Job"], ["욥"]],
  ["PSA", "Psalms", "시편", 150, ["Ps", "Psa", "Psalm"], ["시"]],
  ["PRO", "Proverbs", "잠언", 31, ["Prov", "Pr"], ["잠"]],
  ["ECC", "Ecclesiastes", "전도서", 12, ["Eccl", "Ec"], ["전"]],
  ["SNG", "Song of Songs", "아가", 8, ["Song", "SoS", "Canticles"], ["아"]],
  ["ISA", "Isaiah", "이사야", 66, ["Isa", "Is"], ["사"]],
  ["JER", "Jeremiah", "예레미야", 52, ["Jer", "Je"], ["렘"]],
  ["LAM", "Lamentations", "예레미야애가", 5, ["Lam", "La"], ["애"]],
  ["EZK", "Ezekiel", "에스겔", 48, ["Ezek", "Eze"], ["겔"]],
  ["DAN", "Daniel", "다니엘", 12, ["Dan", "Da"], ["단"]],
  ["HOS", "Hosea", "호세아", 14, ["Hos", "Ho"], ["호"]],
  ["JOL", "Joel", "요엘", 3, ["Joel", "Joe"], ["욜"]],
  ["AMO", "Amos", "아모스", 9, ["Amos", "Am"], ["암"]],
  ["OBA", "Obadiah", "오바댜", 1, ["Obad", "Ob"], ["옵"]],
  ["JON", "Jonah", "요나", 4, ["Jonah", "Jon"], ["욘"]],
  ["MIC", "Micah", "미가", 7, ["Mic", "Mi"], ["미"]],
  ["NAM", "Nahum", "나훔", 3, ["Nah", "Na"], ["나"]],
  ["HAB", "Habakkuk", "하박국", 3, ["Hab", "Hb"], ["합"]],
  ["ZEP", "Zephaniah", "스바냐", 3, ["Zeph", "Zep"], ["습"]],
  ["HAG", "Haggai", "학개", 2, ["Hag", "Hg"], ["학"]],
  ["ZEC", "Zechariah", "스가랴", 14, ["Zech", "Zec"], ["슥"]],
  ["MAL", "Malachi", "말라기", 4, ["Mal", "Ml"], ["말"]],
  ["MAT", "Matthew", "마태복음", 28, ["Matt", "Mt"], ["마"]],
  ["MRK", "Mark", "마가복음", 16, ["Mark", "Mk"], ["막"]],
  ["LUK", "Luke", "누가복음", 24, ["Luke", "Lk"], ["눅"]],
  ["JHN", "John", "요한복음", 21, ["John", "Jn"], ["요"]],
  ["ACT", "Acts", "사도행전", 28, ["Acts", "Ac"], ["행"]],
  ["ROM", "Romans", "로마서", 16, ["Rom", "Ro"], ["롬"]],
  ["1CO", "1 Corinthians", "고린도전서", 16, ["1Cor", "1Co"], ["고전"]],
  ["2CO", "2 Corinthians", "고린도후서", 13, ["2Cor", "2Co"], ["고후"]],
  ["GAL", "Galatians", "갈라디아서", 6, ["Gal", "Ga"], ["갈"]],
  ["EPH", "Ephesians", "에베소서", 6, ["Eph", "Ep"], ["엡"]],
  ["PHP", "Philippians", "빌립보서", 4, ["Phil", "Php"], ["빌"]],
  ["COL", "Colossians", "골로새서", 4, ["Col", "Co"], ["골"]],
  ["1TH", "1 Thessalonians", "데살로니가전서", 5, ["1Thess", "1Th"], ["살전"]],
  ["2TH", "2 Thessalonians", "데살로니가후서", 3, ["2Thess", "2Th"], ["살후"]],
  ["1TI", "1 Timothy", "디모데전서", 6, ["1Tim", "1Ti"], ["딤전"]],
  ["2TI", "2 Timothy", "디모데후서", 4, ["2Tim", "2Ti"], ["딤후"]],
  ["TIT", "Titus", "디도서", 3, ["Titus", "Tit"], ["딛"]],
  ["PHM", "Philemon", "빌레몬서", 1, ["Phlm", "Phm"], ["몬"]],
  ["HEB", "Hebrews", "히브리서", 13, ["Heb"], ["히"]],
  ["JAS", "James", "야고보서", 5, ["Jas", "Jm"], ["약"]],
  ["1PE", "1 Peter", "베드로전서", 5, ["1Pet", "1Pe"], ["벧전"]],
  ["2PE", "2 Peter", "베드로후서", 3, ["2Pet", "2Pe"], ["벧후"]],
  ["1JN", "1 John", "요한일서", 5, ["1John", "1Jn"], ["요일"]],
  ["2JN", "2 John", "요한이서", 1, ["2John", "2Jn"], ["요이"]],
  ["3JN", "3 John", "요한삼서", 1, ["3John", "3Jn"], ["요삼"]],
  ["JUD", "Jude", "유다서", 1, ["Jude", "Jud"], ["유"]],
  ["REV", "Revelation", "요한계시록", 22, ["Rev", "Re", "Apocalypse"], ["계"]],
];

export const BOOKS: Book[] = RAW.map(([id, en, ko, chapters, enAbbr, koAbbr], i) => ({
  id,
  ord: i + 1,
  en,
  ko,
  testament: i < 39 ? "OT" : "NT",
  chapters,
  enAbbr,
  koAbbr,
}));

const BOOK_BY_ID = new Map<string, Book>(BOOKS.map((b) => [b.id, b]));

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s.\-]/g, "");
}

// normalized alias -> book id
const ALIAS = new Map<string, string>();
for (const b of BOOKS) {
  const add = (s: string) => {
    const k = norm(s);
    if (k && !ALIAS.has(k)) ALIAS.set(k, b.id);
  };
  add(b.id);
  add(b.en);
  add(b.ko);
  b.enAbbr.forEach(add);
  b.koAbbr.forEach(add);
}

export function bookById(id: string): Book | undefined {
  return BOOK_BY_ID.get(id);
}

const OSIS_RE = /^([A-Za-z0-9]{3})\.(\d+)\.(\d+)(?:-(\d+))?$/;
// book text + chapter + (":" or "장") + verse + optional "절" + optional range
const NL_RE = /^(.+?)\s*(\d+)\s*[:장]\s*(\d+)\s*절?(?:\s*[-~]\s*(\d+)\s*절?)?$/;

export function parseRef(input: string): RefResult | null {
  if (!input || typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  let m = OSIS_RE.exec(s);
  if (m) {
    const id = m[1].toUpperCase();
    if (!BOOK_BY_ID.has(id)) return null;
    const ch = Number(m[2]);
    const start = `${id}.${ch}.${Number(m[3])}`;
    if (m[4] !== undefined) return { start, end: `${id}.${ch}.${Number(m[4])}` };
    return { start };
  }

  m = NL_RE.exec(s);
  if (m) {
    const id = ALIAS.get(norm(m[1]));
    if (!id) return null;
    const ch = Number(m[2]);
    const start = `${id}.${ch}.${Number(m[3])}`;
    if (m[4] !== undefined) return { start, end: `${id}.${ch}.${Number(m[4])}` };
    return { start };
  }

  return null;
}

export function formatRef(verseId: string, lang: "en" | "ko" = "en"): string {
  const parts = verseId.split(".");
  if (parts.length !== 3) return verseId;
  const b = BOOK_BY_ID.get(parts[0]);
  if (!b) return verseId;
  const name = lang === "ko" ? b.ko : b.en;
  return `${name} ${parts[1]}:${parts[2]}`;
}

// --- OSIS interop (for normalizing external datasets: morphhb, OpenBible xrefs, etc.) ---
// OSIS standard book codes, parallel to BOOKS order. Differ from our USFM ids (e.g. Ps↔PSA, 1Cor↔1CO).
const OSIS_CODES = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam",
  "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov",
  "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos",
  "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Matt",
  "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil",
  "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet",
  "2Pet", "1John", "2John", "3John", "Jude", "Rev",
];

const OSIS_TO_ID = new Map<string, string>();
OSIS_CODES.forEach((code, i) => OSIS_TO_ID.set(code.toLowerCase(), BOOKS[i].id));
for (const b of BOOKS) OSIS_TO_ID.set(b.id.toLowerCase(), b.id); // USFM id self-maps too

// OSIS book code (e.g. "Gen", "1Cor", "Ps") or USFM id → USFM id ("GEN","1CO","PSA").
export function osisBookToId(osisBook: string): string | undefined {
  return OSIS_TO_ID.get(osisBook.toLowerCase());
}

// "Gen.1.1" / "1Cor.13.4" / "Ps.23.1" → "GEN.1.1" / "1CO.13.4" / "PSA.23.1". null if unknown book.
export function osisToVerseId(osisRef: string): string | null {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)/.exec(osisRef.trim());
  if (!m) return null;
  const id = OSIS_TO_ID.get(m[1].toLowerCase());
  if (!id) return null;
  return `${id}.${Number(m[2])}.${Number(m[3])}`;
}

// Book ordinal (1..66, as used by getbible "nr") → USFM id. undefined if out of range.
export function ordToId(ord: number): string | undefined {
  return BOOKS[ord - 1]?.id;
}
