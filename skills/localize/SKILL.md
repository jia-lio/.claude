---
name: localize
description: |
  Synology NAS에서 다국어 번역 데이터를 다운로드하여 Cocos Creator 프로젝트의 TypeScript i18n 파일로 변환하는 스킬.
  사용자가 "/localize", "번역 데이터 다운로드", "다국어 동기화", "i18n 업데이트", "로컬라이즈" 등을 요청할 때 사용된다.
  @tinycellcorp/syno-lang CLI를 사용하며, JSON → TypeScript 변환 및 배열 후처리를 포함한다.
---

# Localize 스킬

Synology NAS에서 번역 데이터를 다운로드하여 Cocos Creator 프로젝트에 TypeScript i18n 파일로 적용한다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/localize` | 번역 데이터 다운로드 및 변환 (전체 워크플로우) |
| `/localize init` | 초기 설정 (.env, config 생성) |
| `/localize download` | 번역 데이터만 다운로드 (변환 없이) |

## 환경 설정

### 필수 경로

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LOCALIZE_TOOL_PATH` | `C:/Users/user/Desktop/cocos/Localize-json-ts` | syno-lang 패키지 및 후처리 스크립트 위치 |

### 패키지 구조

```
${LOCALIZE_TOOL_PATH}/
├── 2.x/localize-plugin/node_modules/  # syno-lang 패키지 포함
└── post-process-arrays.js              # 배열 후처리 스크립트
```

### 플랫폼 요구사항

- **Windows**: Git Bash 또는 WSL 필요
- **macOS/Linux**: 기본 bash 사용

## 워크플로우

### 1. 초기 설정 (`/localize init`)

프로젝트에 syno-lang 패키지 복사:

```bash
mkdir -p "${PROJECT_PATH}/node_modules/@tinycellcorp"
cp -r "${LOCALIZE_TOOL_PATH}/2.x/localize-plugin/node_modules/"* "${PROJECT_PATH}/node_modules/"
```

### 2. 설정 파일 생성

#### .env

```
SYNO_CONNECTION=사용자명:비밀번호@NAS주소
```

**중요:**
- `https://` 제외 (예: `tinycellsuperhit.synology.me`)
- 비밀번호에 특수문자가 있어도 그대로 입력

#### localize-config.json

```json
{
  "gameId": "프로젝트명",
  "outputPath": "assets/scripts/i18n/langs"
}
```

### 3. 전체 실행 (`/localize`)

`scripts/localize.sh` 스크립트를 사용하여 전체 워크플로우 실행:

```bash
# 사용법
./scripts/localize.sh <PROJECT_PATH> <GAME_ID> [OUTPUT_PATH]

# 예시
./scripts/localize.sh /path/to/project MyGame assets/scripts/i18n/langs
```

스크립트가 수행하는 작업:
1. syno-lang CLI로 번역 데이터 다운로드
2. JSON → TypeScript 변환 (`export default` 형식)
3. 배열 값 후처리 (선택)
4. 임시 파일 정리

### 4. 다운로드만 (`/localize download`)

변환 없이 JSON 파일만 다운로드:

```bash
cd "${PROJECT_PATH}"
node node_modules/@tinycellcorp/syno-lang/dist/cli.js download \
  --gameId "${GAME_ID}" \
  --outputDir ./temp/localize
```

## CLI 옵션

```bash
node node_modules/@tinycellcorp/syno-lang/dist/cli.js --help

Commands:
  download [options]  번역 데이터를 JSON 파일로 다운로드

Options:
  --gameId      게임 ID (필수)
  --outputDir   출력 디렉토리 (기본: ./temp/localize)
```

## 트러블슈팅

자세한 트러블슈팅 가이드는 `references/troubleshooting.md` 참조.

| 증상 | 빠른 해결 |
|------|----------|
| `fetch failed` | .env의 NAS 주소에서 `https://` 제거 |
| `Drive 로그인 실패` | 비밀번호 확인 |
| `Cannot find package` | node_modules 전체 복사 필요 |

## 다음 단계

번역 데이터 적용 후 웹 빌드에서 언어 선택 UI가 필요하면:

```
/hi5-html-language
```

## Guidelines

- GitHub Packages 인증 필요 시 `~/.npmrc`에 토큰 설정
- 패키지 설치 실패 시 원본에서 node_modules 복사
- outputPath는 프로젝트의 기존 i18n 구조에 맞게 설정
- Cocos Editor 플러그인 대신 CLI 직접 실행 권장 (버전 호환성 문제 없음)
