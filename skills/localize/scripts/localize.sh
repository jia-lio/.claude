#!/bin/bash
# Localize 스킬 - 전체 실행 스크립트
# 사용법: ./localize.sh <PROJECT_PATH> <GAME_ID> [OUTPUT_PATH]

set -e

# 인자 확인
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "사용법: ./localize.sh <PROJECT_PATH> <GAME_ID> [OUTPUT_PATH]"
  echo "예시: ./localize.sh /path/to/project MyGame assets/scripts/i18n/langs"
  exit 1
fi

PROJECT_PATH="$1"
GAME_ID="$2"
OUTPUT_PATH="${3:-assets/scripts/i18n/langs}"
LOCALIZE_TOOL_PATH="${LOCALIZE_TOOL_PATH:-C:/Users/user/Desktop/cocos/Localize-json-ts}"

echo "=== Localize 시작 ==="
echo "프로젝트: $PROJECT_PATH"
echo "게임 ID: $GAME_ID"
echo "출력 경로: $OUTPUT_PATH"

# 1. 다운로드
echo ""
echo "[1/4] 번역 데이터 다운로드 중..."
cd "$PROJECT_PATH"
node node_modules/@tinycellcorp/syno-lang/dist/cli.js download \
  --gameId "$GAME_ID" \
  --outputDir ./temp/localize

# 2. TypeScript 변환
echo ""
echo "[2/4] JSON → TypeScript 변환 중..."
mkdir -p "$OUTPUT_PATH"
for jsonFile in ./temp/localize/*.json; do
  if [ -f "$jsonFile" ]; then
    langCode=$(basename "$jsonFile" .json)
    outputFile="${OUTPUT_PATH}/${langCode}.ts"
    echo "// ${langCode}" > "$outputFile"
    echo "export default $(cat "$jsonFile");" >> "$outputFile"
    echo "  변환 완료: ${langCode}.ts"
  fi
done

# 3. 배열 후처리
echo ""
echo "[3/4] 배열 값 후처리 중..."
if [ -f "${LOCALIZE_TOOL_PATH}/post-process-arrays.js" ]; then
  node "${LOCALIZE_TOOL_PATH}/post-process-arrays.js" "$OUTPUT_PATH"
  echo "  후처리 완료"
else
  echo "  후처리 스크립트 없음 (건너뜀)"
fi

# 4. 임시 파일 정리
echo ""
echo "[4/4] 임시 파일 정리 중..."
rm -rf ./temp/localize
echo "  정리 완료"

echo ""
echo "=== Localize 완료 ==="
echo "생성된 파일: ${OUTPUT_PATH}/*.ts"
