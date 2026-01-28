---
name: hi5-html-language
description: Hi5Lang 시스템을 사용하는 Cocos Creator 프로젝트에 HTML 기반 언어 선택기를 추가하는 스킬. 이 스킬은 사용자가 "/hi5-html-language" 명령을 실행하거나 "HTML 언어 선택기", "웹 빌드 언어 설정" 등의 요청을 할 때 사용된다.
---

# Hi5 HTML Language Selector

Cocos Creator 2.x/3.x 호환 HTML 언어 선택기 플러그인입니다.

## 사용 가능한 명령어

| 명령어 | 설명 |
|--------|------|
| `init` | 플러그인 설치 및 프로젝트 설정 |
| `check` | 설치 상태 및 호환성 검사 |
| `verify` | 빌드 전 최종 검증 |
| `post-build` | 2.x 빌드 후 주입 작업 (2.x 전용) |
| (인자 없음) | 현재 상황에 맞는 작업 자동 판단 |

**사용 예시**: `/hi5-html-language init`

## 플러그인 소스

```
https://github.com/TinycellCorp/cocos-localization-plugin.git
```

## Cocos 버전별 차이

| 항목 | Cocos 2.x | Cocos 3.x |
|------|-----------|-----------|
| 버전 감지 | `project.json` 존재 | `package.json`에 `creator.version` |
| 모듈 시스템 | CommonJS (`require`) | ESM (`import`) |
| 템플릿 파일 | `index.html` | `index.ejs` |
| 빌드 후 작업 | `post-build-inject.js` 필요 | 자동 적용 |
| director 접근 | `cc.director` | `director` (import) |

## 개발 단계별 워크플로우

### 1. 초기화 (Init)

#### 1.1 프로젝트 환경 자동 감지

```bash
# 실행할 명령
/hi5-html-language init
```

**자동 감지 항목:**

| 감지 항목 | 방법 | 결과 |
|-----------|------|------|
| Cocos 버전 | `project.json` 존재 여부 | 2.x 또는 3.x |
| 언어 타입 | `Hi5Lang.ts` vs `Hi5Lang.js` | TypeScript 또는 JavaScript |
| 중국어 코드 | `zh.*` vs `cn.*` 파일 존재 | `zh` 또는 `cn` 사용 |

**감지 경로:**
```
${PROJECT_PATH}/assets/scripts/i18n/
├── Hi5Lang.ts (또는 .js)
└── langs/
    ├── ko.ts (또는 .js)
    ├── en.ts (또는 .js)
    └── zh.ts 또는 cn.ts (또는 .js)
```

#### 1.2 플러그인 설치

```bash
cd "${TEMP_DIR}"
git clone --depth 1 https://github.com/TinycellCorp/cocos-localization-plugin.git temp-loc-plugin
cd temp-loc-plugin
node install.js "${PROJECT_PATH}" --html-only
rm -rf temp-loc-plugin
```

#### 1.3 설치 결과물

**Cocos 3.x:**
```
${PROJECT_PATH}/build-templates/web-mobile/
├── index.ejs               # EJS 템플릿 (자동 적용)
├── language-selector.css
├── language-selector.js
└── localization-adapter.js
```

**Cocos 2.x:**
```
${PROJECT_PATH}/build-templates/web-mobile/
├── index.html              # HTML 템플릿
├── language-selector.css
├── language-selector.js
└── localization-adapter.js

${PROJECT_PATH}/
└── post-build-inject.js    # 빌드 후 실행 필요
```

### 2. 호환성 검사 (Check)

```bash
/hi5-html-language check
```

**검증 항목:**

| 항목 | 검사 내용 | 통과 조건 |
|------|-----------|-----------|
| 템플릿 존재 | `build-templates/web-mobile/` | 필수 파일 4개 존재 |
| Hi5Lang 설정 | `languages` 객체 | 감지된 언어 코드 포함 |
| 이벤트 시스템 | `_listeners`, `onLanguageChange` | 메서드 정의됨 |
| Adapter 설정 | `langMap` 객체 | 프로젝트 언어 코드와 일치 |
| 2.x 전용 | `post-build-inject.js` | 2.x일 때만 존재 확인 |

### 3. 빌드 전 검증 (Verify)

```bash
/hi5-html-language verify
```

**최종 체크리스트:**

- [ ] 템플릿 파일 구조 정상
- [ ] `localization-adapter.js`의 `langMap` 설정 완료
- [ ] `language-selector.js`의 `notifyCocos` 함수 수정 완료
- [ ] `Hi5Lang`에 이벤트 시스템 추가됨
- [ ] `Start.ts`에 `cc-game-ready` 이벤트 발송 코드 있음
- [ ] (2.x) `post-build-inject.js` 존재

### 4. 빌드 후 작업 (2.x 전용)

```bash
/hi5-html-language post-build
# 또는 수동으로:
node post-build-inject.js "${BUILD_PATH}"
```

## 버전별 코드 패턴

### localization-adapter.js

**공통 구조:**
```javascript
var langMap = {
    'ko': 'ko',
    'en': 'en',
    '${CHINESE_CODE}': '${CHINESE_CODE}',  // zh 또는 cn
    'jp': 'jp'
};

function setGameLanguage(language) {
    console.log('[Adapter] setGameLanguage:', language);
    if (window.Hi5Lang && window.Hi5Lang.setLang) {
        var mappedLang = langMap[language] || language;
        window.Hi5Lang.setLang(mappedLang);
        return true;
    }
    console.warn('[Adapter] Hi5Lang 시스템을 찾을 수 없습니다.');
    return false;
}
```

### language-selector.js (notifyCocos 함수)

**zh 사용 시 (cn → zh 매핑):**
```javascript
if (window.cc && window.cc.game) {
    var mappedLang = (language === 'cn') ? 'zh' : language;
    if (window.Hi5Lang && window.Hi5Lang.setLang) {
        window.Hi5Lang.setLang(mappedLang);
    } else if (window.LocalizationManager) {
        window.LocalizationManager.setLanguage(mappedLang);
    }
}
```

**cn 사용 시 (기본):**
```javascript
if (window.cc && window.cc.game) {
    if (window.Hi5Lang && window.Hi5Lang.setLang) {
        window.Hi5Lang.setLang(language);
    } else if (window.LocalizationManager) {
        window.LocalizationManager.setLanguage(language);
    }
}
```

### Hi5Lang 수정

#### import 문 (버전별)

| 버전 | TypeScript | JavaScript |
|------|------------|------------|
| 3.x | `import { director } from 'cc';` | `const { director } = cc;` |
| 2.x | N/A | `const director = cc.director;` |

#### 언어 import (환경별)

| 환경 | 코드 |
|------|------|
| TS + zh | `import zh from './langs/zh'` |
| TS + cn | `import cn from './langs/cn'` |
| JS + zh | `const zh = require('./langs/zh');` |
| JS + cn | `const cn = require('./langs/cn');` |

#### 이벤트 시스템 추가 (필수)

```typescript
// Hi5Lang 객체에 추가
_listeners: [] as Function[],

setLang(_lang) {
    this.curLang = _lang;
    if (_lang !== 'key') {
        localStorage.setItem('_hi5_lang', _lang);
    }
    this.updateSceneRenderers();
    this._notifyListeners(_lang);
},

onLanguageChange(callback: Function) {
    if (callback && typeof callback === 'function') {
        this._listeners.push(callback);
    }
},

offLanguageChange(callback: Function) {
    const index = this._listeners.indexOf(callback);
    if (index > -1) {
        this._listeners.splice(index, 1);
    }
},

_notifyListeners(_lang: string) {
    for (let i = 0; i < this._listeners.length; i++) {
        try { this._listeners[i](_lang); } catch (e) {}
    }
},

// key 모드 지원
t(key) {
    if (this.curLang === 'key') {
        return '@' + key;
    }
    const l = this.languages[this.curLang];
    return l.hasOwnProperty(key) ? l[key] : key;
},
```

#### updateSceneRenderers (3.x)

```typescript
// 변경 전 (2.x 스타일)
let rootNodes = cc.director.getScene().children;

// 변경 후 (3.x 스타일)
import { director } from 'cc';
// ...
let rootNodes = director.getScene().children;
```

### Start.ts - Splash 숨기기

```typescript
start() {
    // ... 기존 코드 ...

    // HTML Splash 숨기기 (web-mobile 빌드용)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cc-game-ready'));
    }
}
```

### 컴포넌트에서 언어 변경 리스닝

```typescript
// start() 또는 onCreated()
Hi5Lang.onLanguageChange(this.onLanguageChange.bind(this));

onLanguageChange(lang: string) {
    this.updateMyLabels();
}

// onDestroy() 또는 onDispose()
Hi5Lang.offLanguageChange(this.onLanguageChange.bind(this));
```

## 지원 언어

| 코드 | 언어 | 비고 |
|------|------|------|
| ko | 한국어 | 기본 |
| en | English | 기본 |
| zh | 中文 | 프로젝트에 zh 파일 있을 때 |
| cn | 中文 | 프로젝트에 cn 파일만 있을 때 |
| jp | 日本語 | 선택 |
| key | 키값 | 디버깅용 (`@key` 형태로 표시) |

## 트러블슈팅

### 언어 변경이 안 됨

| 증상 | 원인 | 해결 |
|------|------|------|
| 버튼 클릭 무반응 | `language-selector.js` 미로드 | `index.ejs/html`에 script 태그 확인 |
| Hi5Lang 없음 경고 | Hi5Lang이 window에 노출 안 됨 | Hi5Lang 싱글톤이 전역에 할당되었는지 확인 |
| 언어는 바뀌나 UI 안 바뀜 | 이벤트 리스너 미등록 | `onLanguageChange` 리스너 등록 확인 |

### 2.x에서 빌드 후 동작 안 함

```bash
# 해결: post-build 스크립트 실행
node post-build-inject.js ./build/web-mobile
```

### zh/cn 매핑 오류

| 상황 | 해결 |
|------|------|
| 프로젝트는 zh, 선택기는 cn | `language-selector.js`의 매핑 코드 확인 |
| langMap 불일치 | `localization-adapter.js`의 langMap 수정 |

### Splash가 안 사라짐

`Start.ts`에 아래 코드가 있는지 확인:
```typescript
window.dispatchEvent(new Event('cc-game-ready'));
```

## Guidelines

### 환경 감지 규칙

**JS/TS 감지 우선순위:**
1. `Hi5Lang.ts` 존재 → TypeScript
2. `Hi5Lang.js` 존재 → JavaScript
3. `ko.ts` 또는 `en.ts` 존재 → TypeScript
4. `ko.js` 또는 `en.js` 존재 → JavaScript
5. 판단 불가 → 사용자에게 질문

**zh/cn 감지 우선순위:**
1. `zh.ts` 또는 `zh.js` 존재 → `zh` 사용 (cn → zh 매핑)
2. `cn.ts` 또는 `cn.js`만 존재 → `cn` 사용
3. 둘 다 없음 → 사용자에게 질문

### 필수 조건

- web-mobile 빌드 전용
- Hi5Lang 시스템 사전 설치 필요
- 2.x는 빌드마다 `post-build-inject.js` 실행 필요

### 자동 업데이트 vs 수동 업데이트

| 컴포넌트 | 업데이트 방식 |
|----------|--------------|
| `Hi5Lang_Label` | 자동 (내장 리스너) |
| `Hi5Lang.t()` 직접 호출 | 수동 (`onLanguageChange` 등록 필요) |
