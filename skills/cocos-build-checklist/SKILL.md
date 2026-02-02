---
name: cocos-build-checklist
description: |
  Cocos Creator 프로젝트 빌드 전 필수 체크리스트 검증 스킬.
  사용 시점: 빌드 전 또는 "체크리스트", "빌드 준비 확인" 요청 시
  검증 항목: 1) HTML 언어 선택기 2) iOS Sound 처리 3) 빌드 버전 표시 4) 빌드 템플릿 적용
  Cocos Creator 2.x/3.x 모두 지원
---

# Cocos Build Checklist

Cocos Creator 프로젝트의 빌드 전 필수 항목을 검증하는 스킬.

## 트리거 조건

다음과 같은 요청 시 이 스킬을 사용한다:
- "체크리스트", "checklist"
- "빌드 준비 확인", "빌드 전 확인"
- "필수 항목 확인"
- "빌드 체크"

## 검증 항목 (4가지)

| # | 항목 | 설명 |
|---|------|------|
| 1 | HTML 언어 선택기 | 다국어 지원을 위한 언어 선택 UI |
| 2 | iOS Sound 처리 | iOS Safari 백그라운드 복귀 시 오디오 처리 |
| 3 | 빌드 버전 표시 | 게임 내 버전 표시 구현 |
| 4 | 빌드 템플릿 적용 | build-templates 폴더 설정 |

---

## 검증 워크플로우

### Step 0: 프로젝트 확인

1. 현재 디렉토리가 Cocos Creator 프로젝트인지 확인
   - `assets/` 폴더 존재
   - `project.json` (2.x) 또는 `package.json` with Cocos 관련 설정 (3.x)

2. Cocos Creator 버전 판별
   - 2.x: `project.json`에 `engine-version` 존재
   - 3.x: `extensions/` 폴더 또는 `cc.VERSION.startsWith('3.')`

---

### Step 1: HTML 언어 선택기 검증

**검색 대상:**
- `assets/**/*.ts` 파일들
- 빌드 템플릿: `build-templates/web-mobile/index.html`

**검증 패턴:**

```typescript
// 코드에서 언어 선택기 관련 패턴 검색
const patterns = [
    'languageSelector',
    'LanguageSelector',
    'langSelector',
    'language-selector',
    'setLanguage',
    'changeLanguage',
    'selectLanguage',
    'i18n',
    'localization',
    'LocalizationManager'
];
```

**검증 방법:**

1. **TypeScript 코드 검색**
   ```bash
   grep -r -l "languageSelector\|LanguageSelector\|setLanguage\|changeLanguage\|i18n\|localization" assets/
   ```

2. **빌드 템플릿 HTML 검색**
   - `build-templates/web-mobile/index.html`에서 `<select>` 또는 언어 관련 UI 요소 확인

3. **씬/프리팹 검색** (선택)
   - `.fire` 또는 `.scene` 파일에서 언어 선택기 노드 확인

**결과 판정:**

| 상태 | 조건 |
|------|------|
| PASS | 언어 선택기 코드 또는 UI 발견 |
| WARN | 관련 코드는 있으나 UI 연결 불확실 |
| FAIL | 언어 선택기 없음 |

---

### Step 2: iOS Sound 처리 검증

**검색 대상:**
- `assets/**/*.ts` 파일들 (특히 audio 관련)
- 오디오 매니저, 사운드 유틸리티 클래스

**검증 패턴:**

```typescript
// iOS 오디오 처리 관련 필수 패턴
const requiredPatterns = [
    // 플랫폼 감지
    'isIOSPlatform',
    'sys.os === sys.OS_IOS',
    'sys.os === sys.OS.IOS',

    // visibility 처리
    'visibilitychange',
    'document.visibilityState',

    // AudioContext 처리
    'AudioContext',
    'audioContext.resume',

    // HTML Audio fallback
    'HTMLAudioElement',
    '_htmlAudio',

    // 사용자 제스처 unlock
    'touchstart',
    'setupUserGestureUnlock'
];
```

**검증 방법:**

1. **오디오 관련 파일 찾기**
   ```bash
   find assets -name "*.ts" | xargs grep -l -i "audio\|sound\|bgm\|music"
   ```

2. **iOS 처리 패턴 검증**
   ```bash
   grep -l "visibilitychange\|isIOSPlatform\|OS_IOS\|OS.IOS" {audio_files}
   ```

3. **HTML Audio fallback 확인**
   ```bash
   grep -l "HTMLAudioElement\|_htmlAudio" {audio_files}
   ```

**결과 판정:**

| 상태 | 조건 |
|------|------|
| PASS | iOS 플랫폼 감지 + visibility 처리 + 사용자 제스처 처리 모두 존재 |
| WARN | 일부 패턴만 존재 (예: visibility만 있고 HTML Audio fallback 없음) |
| FAIL | iOS 특수 처리 없음 |

**WARN/FAIL 시 안내:**
- `/ios-helper` 스킬 사용 권장
- iOS Safari 오디오 이슈 해결 가이드 참조

---

### Step 3: 빌드 버전 표시 검증

**검색 대상:**
- `assets/**/*.ts` 파일들
- `build-templates/web-mobile/index.html`
- UI 관련 씬/프리팹

**검증 패턴:**

```typescript
// 버전 표시 관련 패턴
const versionPatterns = [
    'GAME_VERSION',
    'window.GAME_VERSION',
    'gameVersion',
    'appVersion',
    'BUILD_VERSION',
    'version:'  // 라벨에 표시
];
```

**검증 방법:**

1. **버전 전역 변수 확인**
   ```bash
   grep -r "GAME_VERSION\|BUILD_VERSION\|gameVersion" assets/ build-templates/
   ```

2. **package.json 버전 필드 확인**
   ```bash
   grep '"version"' package.json
   ```

3. **UI에서 버전 표시 확인**
   - 버전 라벨 노드 검색
   - 버전을 화면에 표시하는 코드 검색

**결과 판정:**

| 상태 | 조건 |
|------|------|
| PASS | 버전 변수 정의 + UI 표시 코드 존재 |
| WARN | 버전 변수만 있고 UI 표시 없음 |
| FAIL | 버전 관리 없음 |

---

### Step 4: 빌드 템플릿 적용 검증

**검색 대상:**
- `build-templates/web-mobile/` 폴더

**검증 항목:**

1. **폴더 존재 확인**
   ```bash
   ls -la build-templates/web-mobile/
   ```

2. **필수 파일 확인**
   - `index.html` (커스텀 템플릿)

3. **index.html 내용 검증**
   - `<html lang="...">` 속성 확인
   - 커스텀 스타일/스크립트 확인
   - 메타 태그 확인 (viewport, charset 등)

**검증 체크리스트:**

```
[ ] build-templates/web-mobile/ 폴더 존재
[ ] index.html 파일 존재
[ ] <html lang=""> 언어 속성 설정
[ ] viewport 메타 태그 설정
[ ] 커스텀 로딩 화면 (선택)
[ ] 파비콘 설정 (선택)
```

**결과 판정:**

| 상태 | 조건 |
|------|------|
| PASS | 폴더 + index.html + 기본 메타 태그 모두 존재 |
| WARN | 폴더만 있거나 불완전한 설정 |
| FAIL | build-templates 없음 |

---

## 출력 형식

검증 완료 후 다음 형식으로 결과 출력:

```
======================================
  Cocos Build Checklist 검증 결과
======================================

프로젝트: {프로젝트명}
Cocos Creator: {버전}
검증 시간: {timestamp}

--------------------------------------
  검증 항목
--------------------------------------

1. HTML 언어 선택기
   상태: [PASS] / [WARN] / [FAIL]
   위치: {발견된 파일 경로}
   비고: {추가 설명}

2. iOS Sound 처리
   상태: [PASS] / [WARN] / [FAIL]
   위치: {발견된 파일 경로}
   비고: {추가 설명}

3. 빌드 버전 표시
   상태: [PASS] / [WARN] / [FAIL]
   위치: {발견된 파일 경로}
   비고: {추가 설명}

4. 빌드 템플릿 적용
   상태: [PASS] / [WARN] / [FAIL]
   위치: build-templates/web-mobile/
   비고: {추가 설명}

--------------------------------------
  요약
--------------------------------------

통과: {n}/4
경고: {n}/4
실패: {n}/4

--------------------------------------
  권장 조치
--------------------------------------

{WARN 또는 FAIL 항목에 대한 해결 방법}

- 항목 2 (iOS Sound): /ios-helper 스킬 사용 권장
- 항목 4 (빌드 템플릿): build-templates/web-mobile/ 폴더 생성 필요

======================================
```

---

## 에러 처리

### Cocos Creator 프로젝트가 아닌 경우

```
[ERROR] 현재 디렉토리는 Cocos Creator 프로젝트가 아닙니다.
필수 파일/폴더가 없습니다: assets/, project.json

Cocos Creator 프로젝트 루트 디렉토리에서 실행해주세요.
```

### 파일 접근 권한 문제

```
[ERROR] 파일 읽기 권한이 없습니다: {파일경로}
권한을 확인하거나 관리자 권한으로 실행해주세요.
```

---

## 관련 스킬

| 스킬 | 용도 |
|------|------|
| `/ios-helper` | iOS Sound 처리 구현 가이드 |
| `/cocos-build-version` | 빌드 및 버전 관리 자동화 |
| `/replace-font` | 폰트 일괄 교체 |

---

## 빠른 실행

```bash
# 체크리스트 실행
/cocos-build-checklist

# 또는
체크리스트 확인해줘
빌드 준비 됐는지 확인해줘
```
