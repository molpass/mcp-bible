# mcp-bible

성경 도우미 **MCP 서버**. 다역본 구절 조회(원어·렉시콘 단계 공개), keyword/semantic 검색, 관주, 단어연구를
Hermes 같은 에이전트에 도구로 노출한다. 결제 스킬(`skill/bible.skill.md`)이 목회적 톤·웨슬리안 사변형 해석틀로 답을 묶는다.

> 도구 = "사실"(본문·원어·관주·렉시콘), 스킬 = "의미"(해석·공감·분별).
> 표준: 프로젝트 공통 `STANDARD.md`(레퍼런스 `mcp-qr`).

---

## 도구

| 도구 | 설명 | 주요 인자 |
|---|---|---|
| `lookup` | 구절 조회 (다역본 동시·원어·렉시콘 단계 공개) | `reference`, `versions?`, `include_original?`, `include_lexicon?` |
| `search` | 본문 검색 — `keyword`(부분일치) / `semantic`(의미) | `query`, `mode?`, `limit?` |
| `cross_references` | 관주(교차 참조), 관련도 순 | `reference`, `limit?` |
| `word_study` | 원어 단어 → Strong's → 어원·뜻 | `reference`, `word?`, `strongs?` |
| `list_versions` | 사용 가능 역본(로컬 포함) | — |
| `list_books` | 성경 66권 목록 | — |

`reference`는 `"John 3:16"` · `"요한복음 3장 16절"` · `"요 3:16"` · `"GEN.1.1"` · 범위 `"John 3:16-18"` 모두 받는다.

## 역본 / 데이터

| id | 역본 | 언어 | 라이선스 |
|---|---|---|---|
| `krv` | 개역한글 | ko | PD (대한성서공회 표기·본문 변형 금지) |
| `bsb` | Berean Standard Bible | en | CC0 |
| `kjv` | King James Version | en | PD |
| `wlc` | 히브리어 WLC + 형태소 | he | PD + 형태소 CC BY 4.0 |
| `berean-grk` | Berean Greek NT | grc | CC0 |

추가: Strong's 렉시콘(히/헬), OpenBible 관주(~34만), BGE-M3 의미검색 임베딩(텍스트 3역본).
출처·라이선스·표기 의무 전체는 [`NOTICE`](NOTICE) 참조. (SBLGNT은 EULA 모호성으로 **미번들**.)

## 설치

```bash
git clone https://github.com/molpass/mcp-bible.git
cd mcp-bible
npm install && npm run build
```

### 데이터 준비 (`data/bible.sqlite` + 임베딩)

무거운 파생물(텍스트+형태소+관주 DB 146MB, 임베딩 `.bin`)은 git이 아니라 **GitHub Release 자산**으로 배포된다.

- **권장(빠름):** Release에서 `bible.sqlite`(+필요 시 `embeddings/*.bin`)를 받아 `data/`에 둔다.
- **직접 빌드:**
  ```bash
  npm run fetch       # 공개 소스 다운로드 → data/sources/ (gitignored)
  npm run build:db    # 정규화 + G1 정렬 게이트 + data/bible.sqlite (FTS 없이도 동작)
  npm run build:embeddings   # 의미검색용 BGE-M3 사전계산 → data/embeddings/*.bin  (DEEPINFRA_TOKEN 필요)
  ```

`lookup`·`keyword 검색`·`word_study`·`관주`는 `bible.sqlite`만 있으면 **오프라인** 동작.
`semantic 검색`만 질의당 임베딩 1회를 위해 `DEEPINFRA_TOKEN`(env)이 필요하며, 없으면 자동으로 keyword로 대체된다.

## Hermes / MCP 등록

서버명은 `bible`:

```json
{
  "mcpServers": {
    "bible": {
      "command": "node",
      "args": ["/abs/path/mcp-bible/dist/index.js"],
      "env": { "DEEPINFRA_TOKEN": "<선택 — semantic 검색용>" }
    }
  }
}
```
> `/abs/path`는 클론한 실제 절대경로. Windows 예: `"C:/Users/<you>/mcp-bible/dist/index.js"`.

## 로컬 역본 (개역개정 등)

`data/local/<version_id>.json`을 두면 자동으로 역본 목록에 등장하고 기본 역본이 된다(있을 때).
형식·정책은 [`data/local/README.md`](data/local/README.md) 참조. **로컬 본문은 비공개 — git에 절대 커밋되지 않는다.**

## 설계 노트

- `bible.sqlite`(146MB)·임베딩은 GitHub 100MB 한도 때문에 **Release 자산**(git 미포함).
- 런타임 DB 엔진은 `node:sqlite`(빌트인, 무네이티브빌드). 이 빌드는 FTS5 미포함이라 keyword 검색은 `LIKE`(부분일치). DB 접근은 `src/db.ts` 단일 모듈로 격리(향후 better-sqlite3 교체 가역).
- semantic은 오프라인 아님(질의 임베딩 DeepInfra 1회) → 토큰 없으면 keyword 폴백.
- 내부 4분할(corpus-loader / verse-id / search / skill)로 향후 다종교 코퍼스(예: sutra/quran) 골격 재사용.

## 스킬

페어링 스킬: [`skill/bible.skill.md`](skill/bible.skill.md) — 트리거(성경·기독교) → 도구 매핑, 목회적 톤, 단일-synthesis 호출 규약.

## About / 제작

**Hermes Agent용 MCP** — molpass의 바이브 코딩(vibe coding) 프로젝트.

- 아이디어·방향: **molpass (이정훈)** · https://zeolinex.com
- 기획: **Claude (Chat)**
- 개발: **Claude Code**

같은 모음:
- [mcp-saju](https://github.com/molpass/mcp-saju) · [mcp-qr](https://github.com/molpass/mcp-qr) · [mcp-biorhythm](https://github.com/molpass/mcp-biorhythm) · [mcp-astrology](https://github.com/molpass/mcp-astrology) · [mcp-ziwei](https://github.com/molpass/mcp-ziwei) · [mcp-numerology](https://github.com/molpass/mcp-numerology) · [mcp-liuren](https://github.com/molpass/mcp-liuren) · [mcp-qimen](https://github.com/molpass/mcp-qimen) · [mcp-taiyi](https://github.com/molpass/mcp-taiyi) · [mcp-weather](https://github.com/molpass/mcp-weather) · [mcp-newsfeed](https://github.com/molpass/mcp-newsfeed)
- **mcp-bible** (이 repo)

## License

MIT (코드) — 데이터 출처·라이선스는 [`NOTICE`](NOTICE).
