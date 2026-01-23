---
name: localize
description: Cocos Creator 프로젝트에 Localize 플러그인을 설치하는 스킬. 이 스킬은 사용자가 "/localize" 명령을 실행하거나 "Localize 플러그인 설치", "다국어 지원 설정" 등의 요청을 할 때 사용된다.
---

# Localize Plugin 설치 스킬

Cocos Creator 프로젝트에 Localize 플러그인을 설치하는 스킬입니다.

## 플러그인 위치

```
C:\Users\user\Desktop\cocos\Localize-json-ts\
├── 2.x/localize-plugin/    # Cocos Creator 2.x용
└── 3.x/localize-plugin/    # Cocos Creator 3.x용
```

## Instructions

1. 현재 프로젝트가 Cocos Creator 프로젝트인지 확인 (assets 폴더 존재 여부)
2. Cocos Creator 버전 확인:
   - `project.json` 파일의 `engine` 또는 `version` 필드 확인
   - 2.x.x → 2.x 플러그인 사용
   - 3.x.x → 3.x 플러그인 사용
3. 버전에 맞는 플러그인 복사:
   - 2.x: `packages/localize-plugin` 폴더로 복사
   - 3.x: `extensions/localize-plugin` 폴더로 복사
4. 프로젝트 루트에 설정 파일 생성:
   - `.env` 파일 (SYNO_CONNECTION 설정)
   - `localize-config.json` 파일 (gameId, outputPath 설정)
5. 사용자에게 설정 안내

## 복사 명령어

### Cocos Creator 3.x
```bash
mkdir -p "${PROJECT_PATH}/extensions"
cp -r "C:/Users/user/Desktop/cocos/Localize-json-ts/3.x/localize-plugin" "${PROJECT_PATH}/extensions/"
```

### Cocos Creator 2.x
```bash
mkdir -p "${PROJECT_PATH}/packages"
cp -r "C:/Users/user/Desktop/cocos/Localize-json-ts/2.x/localize-plugin" "${PROJECT_PATH}/packages/"
```

## 설정 파일 템플릿

### .env
```
SYNO_CONNECTION=사용자명:비밀번호@NAS주소
```

### localize-config.json
```json
{
  "gameId": "프로젝트명",
  "outputPath": "assets/scripts/i18n/langs"
}
```

## 사용 방법 안내

플러그인 설치 후 사용자에게 다음을 안내:

1. Cocos Creator 재시작 또는 Extension Manager에서 플러그인 활성화
2. `.env` 파일에 Synology NAS 접속 정보 설정
3. `localize-config.json`에서 gameId 확인
4. 메뉴 **Extension > Localize** 실행

## 테스트

플러그인 설치 후 다음 사항을 확인:

1. **플러그인 인식 확인**
   - Cocos Creator 재시작
   - Extension Manager에서 `localize-plugin` 표시 확인

2. **설정 파일 확인**
   - `.env` 파일 존재 및 SYNO_CONNECTION 설정
   - `localize-config.json` 파일 존재 및 gameId 설정

3. **메뉴 확인**
   - **Extension > Localize** 메뉴 접근 가능 여부

4. **언어 파일 동기화 테스트** (선택)
   - NAS 연결이 가능한 경우 동기화 실행

## 배열 값 후처리 (선택)

Synology 엑셀에서 배열 값을 사용하는 경우 (예: `yellowText: ["스피드 업!", "고고고!!"]`), 후처리 스크립트를 실행해야 합니다.

### Synology 엑셀 입력 방법

| key | ko | en |
|-----|----|----|
| yellowText | ["스피드 업!", "고고고!!", "완벽해!"] | ["Speed up!", "Go go!!", "Perfect!"] |
| normalText | 일반 텍스트 | Normal text |

### 후처리 스크립트 실행

플러그인이 생성한 언어 파일에서 JSON 배열 문자열을 실제 배열로 변환:

```bash
node "C:/Users/user/Desktop/cocos/Localize-json-ts/post-process-arrays.js" "${PROJECT_PATH}/assets/scripts/i18n/langs"
```

### 변환 결과

**변환 전** (플러그인 출력):
```typescript
export default {
    yellowText: '["스피드 업!", "고고고!!", "완벽해!"]',  // 문자열
    normalText: '일반 텍스트',
};
```

**변환 후** (후처리 완료):
```typescript
export default {
    yellowText: ["스피드 업!", "고고고!!", "완벽해!"],    // 배열
    normalText: '일반 텍스트',
};
```

### 후처리 스크립트 위치

```
C:\Users\user\Desktop\cocos\Localize-json-ts\post-process-arrays.js
```

## 다음 단계

Localize 플러그인 설치 및 테스트가 완료되면, **HTML 빌드에서 언어 선택 UI**가 필요할 수 있습니다.

웹 빌드 시 사용자가 언어를 선택할 수 있는 HTML 기반 언어 선택기를 추가하려면:

```
/hi5-html-language
```

이 스킬은 Hi5Lang 시스템과 연동되는 HTML 언어 선택기를 설치합니다:
- 웹 빌드 시 언어 선택 드롭다운 UI 추가
- Hi5Lang.setLang()과 자동 연동
- localStorage 기반 언어 설정 저장

## Guidelines

- 기존 플러그인이 있으면 덮어쓸지 사용자에게 확인
- 버전을 자동 감지할 수 없으면 사용자에게 질문
- outputPath는 프로젝트의 기존 i18n 구조에 맞게 설정
- **테스트 완료 후 반드시 `/hi5-html-language` 스킬 사용을 안내할 것**
