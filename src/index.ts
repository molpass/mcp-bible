#!/usr/bin/env node
// mcp-bible MCP server entry — registers 6 tools over stdio.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { runLookup } from "./tools/lookup.js";
import { runSearch } from "./tools/search.js";
import { runCrossReferences } from "./tools/cross_references.js";
import { runWordStudy } from "./tools/word_study.js";
import { runListVersions } from "./tools/list_versions.js";
import { runListBooks } from "./tools/list_books.js";

const server = new McpServer({ name: "bible", version: "1.0.0" });

// 1. lookup
server.registerTool(
  "lookup",
  {
    title: "성경 구절 조회",
    description:
      "성경 구절을 조회한다. 다역본 동시·원어·렉시콘 단계 공개.",
    inputSchema: {
      reference: z
        .string()
        .describe(
          "구절 참조, 예: 'John 3:16', '요한복음 3장 16절', 'GEN.1.1', 범위 'John 3:16-18'"
        ),
      versions: z
        .array(z.string())
        .optional()
        .describe("역본 id 목록 (예 ['krv','bsb']); 생략 시 기본 역본"),
      include_original: z.boolean().optional().default(false),
      include_lexicon: z.boolean().optional().default(false),
    },
  },
  (args) => runLookup(args)
);

// 2. search
server.registerTool(
  "search",
  {
    title: "성경 본문 검색",
    description:
      "성경 본문 검색. keyword(부분일치) 또는 semantic(의미). 행동 판단·'그 구절 뭐였더라'에.",
    inputSchema: {
      query: z.string(),
      mode: z
        .enum(["keyword", "semantic"])
        .optional()
        .default("keyword"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10),
    },
  },
  (args) => runSearch(args)
);

// 3. cross_references
server.registerTool(
  "cross_references",
  {
    title: "관주(교차 참조) 조회",
    description:
      "한 구절의 관주(교차 참조)를 관련도 순으로.",
    inputSchema: {
      reference: z.string(),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20),
    },
  },
  (args) => runCrossReferences(args)
);

// 4. word_study
server.registerTool(
  "word_study",
  {
    title: "원어 단어 연구",
    description:
      "구절 속 원어 단어 → Strong's 번호 → 어원/뜻(렉시콘).",
    inputSchema: {
      reference: z.string(),
      word: z
        .string()
        .optional()
        .describe("원어 단어(표면형/lemma 일부)"),
      strongs: z
        .string()
        .optional()
        .describe("Strong's 번호, 예 G3056, H7225"),
    },
  },
  (args) => runWordStudy(args)
);

// 5. list_versions
server.registerTool(
  "list_versions",
  {
    title: "역본 목록",
    description:
      "사용 가능한 성경 역본 목록(로컬 포함).",
    inputSchema: {},
  },
  () => runListVersions()
);

// 6. list_books
server.registerTool(
  "list_books",
  {
    title: "성경 목록",
    description: "성경 66권 목록.",
    inputSchema: {},
  },
  () => runListBooks()
);

await server.connect(new StdioServerTransport());
