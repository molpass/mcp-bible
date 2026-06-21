# data/local — 로컬 번역본 모듈

이 디렉터리에 개인 소장 번역본 JSON 파일을 넣으면, 서버 재시작 없이 자동으로 인식됩니다.

## 파일 형식

파일명: `<version_id>.json` (예: `krv-rev.json`)

```json
{
  "version_id": "krv-rev",
  "version_name": "개역개정",
  "license_note": "private/local only — do not redistribute",
  "verses": {
    "GEN.1.1": "태초에 하나님이 천지를 창조하시니라",
    "JHN.3.16": "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니..."
  }
}
```

구절 ID 형식은 `BOOK.장.절` (예: `GEN.1.1`, `JHN.3.16`).  
개역개정은 개역한글과 절 번호가 동일하므로 id를 그대로 사용합니다.

## 동작 방식

1. **`list_versions`**: `krv-rev` 등 로컬 파일이 `[로컬 설치]` 태그와 함께 목록에 나타납니다.
2. **기본 번역본 자동 전환**: `krv-rev.json`이 존재하면 기본 번역본이 `krv-rev`로 전환됩니다.
3. **`lookup` 서빙**: 로컬 파일의 본문을 직접 반환합니다.
4. **per-verse 폴백**: 로컬 파일에 해당 구절 id가 없으면 개역한글(krv) 본문으로 자동 대체되며, 출력에 `(krv-rev → 개역한글 본문)` 표시가 붙습니다.

## 보안 / 저작권 주의사항

**이 디렉터리의 `.json` 파일은 `.gitignore`에 의해 커밋되지 않습니다.**  
개역개정 본문은 PM이 정당한 접근 경로로 직접 넣습니다.  
**이 레포지터리 및 git 히스토리에 절대 진입해서는 안 됩니다.**

추적되는 파일: `README.md`, `.gitkeep` 두 개뿐입니다.
