/**
 * fetch-sources.ts — Download all Bible data sources into data/sources/<key>/
 *
 * Usage: npm run fetch
 *   (builds via tsconfig.scripts.json → dist-scripts/, then runs node dist-scripts/fetch-sources.js)
 *
 * Idempotent: if a source dir already has files it is skipped.
 * Resilient: a single source failure logs and continues.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SOURCES_DIR = path.join(REPO_ROOT, "data", "sources");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[fetch-sources] ${msg}`);
}

function err(msg: string) {
  console.error(`[fetch-sources] ERROR: ${msg}`);
}

/** Return true if the dir exists and has at least one file inside. */
function hasFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = fs.readdirSync(dir, { recursive: true }) as string[];
    return entries.some((e) => {
      const full = path.join(dir, e);
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/** Run a shell command synchronously; throws on non-zero exit. */
function run(cmd: string, cwd?: string) {
  log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: cwd ?? REPO_ROOT, shell: "bash" });
}

/** Download a URL to a local file path using curl. */
function curlDownload(url: string, dest: string) {
  run(`curl -L --fail --silent --show-error -o "${dest}" "${url}"`);
}

/** Unzip a file into a directory. */
function unzipTo(zipFile: string, destDir: string) {
  ensureDir(destDir);
  run(`unzip -q -o "${zipFile}" -d "${destDir}"`);
}

/** git clone --depth 1 into a target directory. */
function gitClone(repoUrl: string, destDir: string) {
  run(`git clone --depth 1 "${repoUrl}" "${destDir}"`);
}

// ---------------------------------------------------------------------------
// Source fetchers
// ---------------------------------------------------------------------------

interface SourceSpec {
  key: string;
  description: string;
  fetch: (dir: string) => void | Promise<void>;
}

const SOURCES: SourceSpec[] = [
  // -------------------------------------------------------------------------
  // krv — Korean 개역한글 (1961), Public Domain
  // getbible.net API v2: translation code is "korean"
  // Full JSON: one file per book (66 files), JSON with chapter/verse structure
  // -------------------------------------------------------------------------
  {
    key: "krv",
    description: "Korean 개역한글 via getbible.net v2 API (PD)",
    fetch: async (dir) => {
      // getbible v2 returns a single complete translation JSON when you request
      // the whole translation; otherwise per-chapter. We use their checksum index
      // to get the list of books then fetch one big JSON file.
      // Translation key: "korean" = 개역한글.
      const translationKey = "korean";

      // Try the single whole-bible JSON first
      const wholeBibleUrl = `https://api.getbible.net/v2/${translationKey}.json`;
      const destFile = path.join(dir, `${translationKey}.json`);

      log(`  Fetching KRV from getbible.net v2 (whole-bible JSON)...`);
      try {
        curlDownload(wholeBibleUrl, destFile);
        log(`  KRV downloaded: ${destFile}`);
      } catch {
        // Fallback: fetch per-book using the checksums list
        log(`  Whole-bible JSON failed, trying per-book approach...`);
        const checksumUrl = `https://api.getbible.net/v2/${translationKey}/checksum.json`;
        const checksumFile = path.join(dir, "checksum.json");
        curlDownload(checksumUrl, checksumFile);

        // The checksum file keys are "1", "2", ... "66" (book order).
        const checksums = JSON.parse(fs.readFileSync(checksumFile, "utf-8")) as Record<string, string>;
        const bookNums = Object.keys(checksums).map(Number).sort((a, b) => a - b);

        for (const bookNum of bookNums) {
          const bookFile = path.join(dir, `book_${String(bookNum).padStart(2, "0")}.json`);
          if (fs.existsSync(bookFile)) continue;
          const bookUrl = `https://api.getbible.net/v2/${translationKey}/${bookNum}.json`;
          try {
            curlDownload(bookUrl, bookFile);
          } catch (e) {
            err(`KRV book ${bookNum} failed: ${e}`);
          }
        }
      }
    },
  },

  // -------------------------------------------------------------------------
  // bsb — Berean Standard Bible (English), CC0
  // bereanbible.com publishes a plain-text TSV. The direct download URL for
  // the BSB table is at https://berean.bible/downloads.htm — we fetch the
  // known static asset URL.
  // -------------------------------------------------------------------------
  {
    key: "bsb",
    description: "Berean Standard Bible TSV from bereanbible.com (CC0)",
    fetch: (dir) => {
      // The BSB table is published at this URL (confirmed stable):
      const bsbUrl = "https://berean.bible/bsb.xlsx";
      // Also the plain TSV/CSV version:
      const bsbTsvUrl = "https://berean.bible/bsb.tsv";

      const xlsxDest = path.join(dir, "bsb.xlsx");
      const tsvDest = path.join(dir, "bsb.tsv");

      // Try TSV first (more parse-friendly)
      let tsvOk = false;
      try {
        curlDownload(bsbTsvUrl, tsvDest);
        tsvOk = true;
        log(`  BSB TSV downloaded: ${tsvDest}`);
      } catch {
        log(`  BSB TSV URL failed, trying XLSX...`);
      }

      if (!tsvOk) {
        try {
          curlDownload(bsbUrl, xlsxDest);
          log(`  BSB XLSX downloaded: ${xlsxDest}`);
        } catch {
          // Try the interlinear table which includes BSB text
          const interlinearUrl =
            "https://bereanbible.com/bsb_tables.xlsx";
          curlDownload(interlinearUrl, path.join(dir, "bsb_tables.xlsx"));
        }
      }
    },
  },

  // -------------------------------------------------------------------------
  // kjv — King James Version (PD)
  // scrollmapper/bible_databases has KJV JSON under json/t_kjv.json
  // -------------------------------------------------------------------------
  {
    key: "kjv",
    description: "KJV from scrollmapper/bible_databases GitHub (PD)",
    fetch: (dir) => {
      // Download only the KJV JSON (single file) rather than cloning entire repo
      // The repo layout is formats/json/KJV.json (not json/t_kjv.json)
      const kjvJsonUrl =
        "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json";
      const dest = path.join(dir, "KJV.json");
      curlDownload(kjvJsonUrl, dest);
      log(`  KJV JSON downloaded: ${dest}`);
    },
  },

  // -------------------------------------------------------------------------
  // wlc — Hebrew WLC + morphology (morphhb)
  // openscriptures/morphhb — OSHB XML per book
  // License: text PD, morphology CC BY 3.0
  // -------------------------------------------------------------------------
  {
    key: "wlc",
    description: "morphhb (OSHB Hebrew+morph XML) git clone (PD + CC BY 3.0)",
    fetch: (dir) => {
      gitClone("https://github.com/openscriptures/morphhb", dir);
    },
  },

  // -------------------------------------------------------------------------
  // berean-greek — Berean Greek NT + interlinear (CC0)
  // bereanbible.com publishes a Greek interlinear table
  // -------------------------------------------------------------------------
  {
    key: "berean-greek",
    description: "Berean Greek NT interlinear table from bereanbible.com (CC0)",
    fetch: (dir) => {
      // The Berean Greek table (includes Greek text + Strong's + morphology):
      const greekUrl = "https://berean.bible/bgnt.xlsx";
      const greekTsvUrl = "https://berean.bible/bgnt.tsv";

      let ok = false;
      try {
        curlDownload(greekTsvUrl, path.join(dir, "bgnt.tsv"));
        ok = true;
        log(`  Berean Greek TSV downloaded`);
      } catch {
        log(`  Berean Greek TSV failed, trying XLSX...`);
      }

      if (!ok) {
        try {
          curlDownload(greekUrl, path.join(dir, "bgnt.xlsx"));
          log(`  Berean Greek XLSX downloaded`);
        } catch {
          // Try the interlinear table from the alternate subdomain
          const altUrl =
            "https://bereanbible.com/bsb_tables.xlsx";
          curlDownload(altUrl, path.join(dir, "bsb_tables_interlinear.xlsx"));
        }
      }
    },
  },

  // -------------------------------------------------------------------------
  // lexicon — Strong's Hebrew + Greek lexicons
  // openscriptures/strongs (XML, CC BY 3.0)
  // -------------------------------------------------------------------------
  {
    key: "lexicon",
    description: "Strong's lexicons from openscriptures/strongs (CC BY 3.0)",
    fetch: (dir) => {
      gitClone("https://github.com/openscriptures/strongs", dir);
    },
  },

  // -------------------------------------------------------------------------
  // xrefs — OpenBible cross-references (~340k TSV)
  // https://a.openbible.info/data/cross-references.zip
  // License: CC BY
  // -------------------------------------------------------------------------
  {
    key: "xrefs",
    description: "OpenBible cross-references TSV (CC BY)",
    fetch: (dir) => {
      const zipUrl = "https://a.openbible.info/data/cross-references.zip";
      const zipFile = path.join(dir, "cross-references.zip");
      curlDownload(zipUrl, zipFile);
      unzipTo(zipFile, dir);
      // Clean up zip after extraction
      fs.unlinkSync(zipFile);
      log(`  xrefs extracted to ${dir}`);
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  ensureDir(SOURCES_DIR);
  log(`Sources root: ${SOURCES_DIR}`);
  log(`Processing ${SOURCES.length} sources...\n`);

  const results: { key: string; status: "SKIPPED" | "OK" | "FAILED"; msg?: string }[] = [];

  for (const spec of SOURCES) {
    const dir = path.join(SOURCES_DIR, spec.key);
    log(`=== [${spec.key}] ${spec.description}`);

    if (hasFiles(dir)) {
      log(`  Already has files — SKIPPED (delete dir to re-fetch)\n`);
      results.push({ key: spec.key, status: "SKIPPED" });
      continue;
    }

    ensureDir(dir);

    try {
      await spec.fetch(dir);
      log(`  [${spec.key}] OK\n`);
      results.push({ key: spec.key, status: "OK" });
    } catch (e) {
      err(`[${spec.key}] FAILED: ${e}`);
      results.push({ key: spec.key, status: "FAILED", msg: String(e) });
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const mark = r.status === "OK" ? "✓" : r.status === "SKIPPED" ? "~" : "✗";
    console.log(`  ${mark} ${r.key}: ${r.status}${r.msg ? " — " + r.msg : ""}`);
  }

  const failed = results.filter((r) => r.status === "FAILED");
  if (failed.length > 0) {
    console.log(`\n${failed.length} source(s) failed. Check logs above.`);
    process.exit(1);
  } else {
    console.log("\nAll sources ready.");
  }
}

main().catch((e) => {
  err(`Fatal: ${e}`);
  process.exit(1);
});
