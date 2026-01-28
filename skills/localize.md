---
name: localize
description: Cocos Creator 프로젝트에서 Synology NAS 번역 데이터를 다운로드하는 스킬. "/localize" 명령을 실행하거나 "번역 데이터 다운로드", "다국어 동기화" 등의 요청을 할 때 사용된다.
---

# Localize 스킬

Synology NAS에서 번역 데이터를 다운로드하여 Cocos Creator 프로젝트에 적용하는 스킬입니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/localize` | 번역 데이터 다운로드 및 변환 |
| `/localize init` | 초기 설정 (.env, config 생성) |
| `/localize download` | 번역 데이터만 다운로드 |

## 패키지 위치

```
C:\Users\user\Desktop\cocos\Localize-json-ts\
├── 2.x/localize-plugin/node_modules/  # syno-lang 패키지 포함
└── post-process-arrays.js              # 배열 후처리 스크립트
```

## Instructions

### 1. 초기 설정 (최초 1회)

```bash
# node_modules에 syno-lang 패키지 복사
mkdir -p "${PROJECT_PATH}/node_modules/@tinycellcorp"
cp -r "C:/Users/user/Desktop/cocos/Localize-json-ts/2.x/localize-plugin/node_modules/"* "${PROJECT_PATH}/node_modules/"
```

### 2. 설정 파일 생성

#### .env
```
SYNO_CONNECTION=사용자명:비밀번호@NAS주소
```

**주의:**
- `https://` 제외 (예: `tinycellsuperhit.synology.me`)
- 비밀번호에 특수문자 있어도 그대로 입력

#### localize-config.json
```json
{
  "gameId": "프로젝트명",
  "outputPath": "assets/scripts/i18n/langs"
}
```

### 3. 번역 데이터 다운로드

```bash
cd "${PROJECT_PATH}"
node node_modules/@tinycellcorp/syno-lang/dist/cli.js download --gameId ${GAME_ID} --outputDir ./temp/localize
```

### 4. JSON → TypeScript 변환

다운로드된 JSON 파일을 TypeScript로 변환:

```bash
# 각 언어 파일 변환
for jsonFile in ./temp/localize/*.json; do
  langCode=$(basename "$jsonFile" .json)
  outputPath="${PROJECT_PATH}/assets/scripts/i18n/langs/${langCode}.ts"

  # JSON을 TypeScript export default 형식으로 변환
  echo "// ${langCode}" > "$outputPath"
  echo "export default $(cat $jsonFile);" >> "$outputPath"
done
```

### 5. 배열 값 후처리 (선택)

엑셀에서 배열 값을 사용하는 경우:

```bash
node "C:/Users/user/Desktop/cocos/Localize-json-ts/post-process-arrays.js" "${PROJECT_PATH}/assets/scripts/i18n/langs"
```

## 전체 실행 스크립트

```bash
#!/bin/bash
PROJECT_PATH="프로젝트경로"
GAME_ID="게임ID"
OUTPUT_PATH="assets/scripts/i18n/langs"

# 1. 다운로드
cd "$PROJECT_PATH"
node node_modules/@tinycellcorp/syno-lang/dist/cli.js download \
  --gameId "$GAME_ID" \
  --outputDir ./temp/localize

# 2. TypeScript 변환
mkdir -p "$OUTPUT_PATH"
for jsonFile in ./temp/localize/*.json; do
  langCode=$(basename "$jsonFile" .json)
  echo "// ${langCode}" > "${OUTPUT_PATH}/${langCode}.ts"
  echo "export default $(cat $jsonFile);" >> "${OUTPUT_PATH}/${langCode}.ts"
  echo "변환 완료: ${langCode}.ts"
done

# 3. 배열 후처리 (필요시)
node "C:/Users/user/Desktop/cocos/Localize-json-ts/post-process-arrays.js" "$OUTPUT_PATH"

# 4. 임시 파일 정리
rm -rf ./temp/localize

echo "완료!"
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

| 증상 | 해결 방법 |
|------|----------|
| `fetch failed` | .env의 NAS 주소에서 `https://` 제거 |
| `Drive 로그인 실패 (code: 400)` | 비밀번호 확인, URL 인코딩 제거 |
| `Cannot find package 'commander'` | node_modules 전체 복사 필요 |
| `E403 Permission denied` | GitHub PAT에 read:packages 권한 추가 |

## .env 예시

```
# 올바른 형식
SYNO_CONNECTION=lio:myPassword123@tinycellsuperhit.synology.me

# 잘못된 형식 (https:// 포함하면 안됨)
SYNO_CONNECTION=lio:myPassword123@https://tinycellsuperhit.synology.me
```

## 다음 단계

번역 데이터 적용 후 웹 빌드에서 언어 선택 UI가 필요하면:

```
/hi5-html-language
```

## Guidelines

- GitHub Packages 인증 필요 시 `~/.npmrc`에 토큰 설정
- 패키지 설치 실패 시 원본에서 node_modules 복사
- outputPath는 프로젝트의 기존 i18n 구조에 맞게 설정
- **Cocos Editor 플러그인 대신 CLI 직접 실행 권장** (버전 호환성 문제 없음)
