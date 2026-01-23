---
name: hi5-html-language
description: Hi5Lang 시스템을 사용하는 Cocos Creator 프로젝트에 HTML 기반 언어 선택기를 추가하는 스킬. 이 스킬은 사용자가 "/hi5-html-language" 명령을 실행하거나 "HTML 언어 선택기", "웹 빌드 언어 설정" 등의 요청을 할 때 사용된다.
---

# Hi5 HTML Language Selector 설치 스킬

Hi5Lang 시스템을 사용하는 Cocos Creator 프로젝트에 HTML 기반 언어 선택기를 추가하는 스킬입니다.

## 플러그인 위치

```
https://github.com/TinycellCorp/cocos-localization-plugin.git
```

## Instructions

### 1. Cocos Creator 버전 확인

- `project.json` 존재 → 2.x
- `package.json`에 `creator.version` 존재 → 3.x

### 1.5. 프로젝트 환경 감지 (JS/TS 및 zh/cn)

프로젝트의 언어 파일 디렉토리를 확인하여 **확장자(JS/TS)**와 **중국어 코드(zh/cn)**를 판단:

```bash
# Hi5Lang 언어 파일 위치 확인
ls "${PROJECT_PATH}/assets/scripts/i18n/langs/"

# Hi5Lang 메인 파일 확장자 확인
ls "${PROJECT_PATH}/assets/scripts/i18n/Hi5Lang.*"
```

#### 확장자 감지 (JS vs TS)

| 조건 | 사용 확장자 |
|------|-------------|
| `Hi5Lang.ts` 존재 | `.ts` (TypeScript) |
| `Hi5Lang.js` 존재 | `.js` (JavaScript) |
| `ko.ts` 또는 `en.ts` 존재 | `.ts` |
| `ko.js` 또는 `en.js` 존재 | `.js` |

**중요**: 프로젝트의 기존 확장자에 맞춰 모든 언어 파일과 import 문을 생성

#### 중국어 코드 감지 (zh vs cn)

| 조건 | 사용 코드 |
|------|-----------|
| `zh.ts` 또는 `zh.js` 존재 | `zh` (cn → zh 대체) |
| `cn.ts` 또는 `cn.js`만 존재 | `cn` |

**중요**: 프로젝트에 zh가 있다면, 이후 모든 단계에서 `cn`을 `zh`로 대체하여 생성

### 2. 플러그인 설치

```bash
cd "C:\Users\user\Desktop\cocos"
git clone --depth 1 https://github.com/TinycellCorp/cocos-localization-plugin.git temp-loc-plugin
cd temp-loc-plugin
node install.js "${PROJECT_PATH}" --html-only
rm -rf "C:\Users\user\Desktop\cocos\temp-loc-plugin"
```

install.js가 자동으로 버전을 감지하여 설치합니다.

### 3. 버전별 설치 파일

#### Cocos Creator 3.x
```
${PROJECT_PATH}/build-templates/web-mobile/
├── index.ejs               # EJS 템플릿 (자동 적용)
├── language-selector.css
├── language-selector.js
└── localization-adapter.js
```

#### Cocos Creator 2.x
```
${PROJECT_PATH}/build-templates/web-mobile/
├── index.html              # HTML 템플릿
├── language-selector.css
├── language-selector.js
└── localization-adapter.js

${PROJECT_PATH}/
└── post-build-inject.js    # 빌드 후 실행 필요
```

**2.x 추가 작업**: 빌드 후 다음 명령 실행
```bash
node post-build-inject.js "${BUILD_PATH}"
```

### 4. localization-adapter.js 수정

Hi5Lang 시스템에 맞게 수정:

**프로젝트에 zh가 있는 경우** (cn → zh 대체):
```javascript
var langMap = {
    'ko': 'ko',
    'en': 'en',
    'zh': 'zh',
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

**프로젝트에 cn만 있는 경우** (기본):
```javascript
var langMap = {
    'ko': 'ko',
    'en': 'en',
    'cn': 'cn',
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

### 5. 빌드 템플릿 수정

#### 3.x (index.ejs)
```html
<script src="language-selector.js"></script>
<script src="localization-adapter.js"></script>
```

#### 2.x (index.html)
```html
<script src="language-selector.js"></script>
<script src="localization-adapter.js"></script>
```

### 6. language-selector.js 수정

Hi5Lang 직접 호출 추가 (notifyCocos 함수 내):

**프로젝트에 zh가 있는 경우** (cn → zh 대체):
```javascript
if (window.cc && window.cc.game) {
    // cn을 zh로 매핑
    var mappedLang = (language === 'cn') ? 'zh' : language;
    if (window.Hi5Lang && window.Hi5Lang.setLang) {
        window.Hi5Lang.setLang(mappedLang);
    }
    else if (window.LocalizationManager) {
        window.LocalizationManager.setLanguage(mappedLang);
    }
}
```

**프로젝트에 cn만 있는 경우** (기본):
```javascript
if (window.cc && window.cc.game) {
    if (window.Hi5Lang && window.Hi5Lang.setLang) {
        window.Hi5Lang.setLang(language);
    }
    else if (window.LocalizationManager) {
        window.LocalizationManager.setLanguage(language);
    }
}
```

### 7. Hi5Lang 수정 (JS/TS 환경에 맞게)

**파일명**: 프로젝트에 따라 `Hi5Lang.ts` 또는 `Hi5Lang.js`

#### import 수정 (3.x)

**TypeScript 프로젝트**:
```typescript
import { _decorator, Component, Node, director } from 'cc';
```

**JavaScript 프로젝트**:
```javascript
const { _decorator, Component, Node, director } = cc;
```

#### 언어 추가

**TypeScript + zh 사용**:
```typescript
import zh from './langs/zh'

languages: {
    en: en,
    ko: ko,
    zh: zh,
},
```

**TypeScript + cn 사용**:
```typescript
import cn from './langs/cn'

languages: {
    en: en,
    ko: ko,
    cn: cn,
},
```

**JavaScript + zh 사용**:
```javascript
const zh = require('./langs/zh');

languages: {
    en: en,
    ko: ko,
    zh: zh,
},
```

**JavaScript + cn 사용**:
```javascript
const cn = require('./langs/cn');

languages: {
    en: en,
    ko: ko,
    cn: cn,
},
```

#### 이벤트 시스템 추가
```typescript
_listeners: [] as Function[],

setLang(_lang){
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
```

#### key 모드 지원
```typescript
t(key){
    if (this.curLang === 'key') {
        return '@' + key;
    }
    const l = this.languages[this.curLang];
    return l.hasOwnProperty(key)?l[key]:key;
},
```

#### updateSceneRenderers 수정 (3.x)
```typescript
// cc.director → director (import 필요)
let rootNodes = director.getScene().children;
```

### 8. 컴포넌트에서 언어 변경 리스닝

```typescript
// start() 또는 onCreated()
Hi5Lang.onLanguageChange(this.onLanguageChange.bind(this));

onLanguageChange(lang: string) {
    this.updateMyLabels();
}

// onDestroy() 또는 onDispose()
Hi5Lang.offLanguageChange(this.onLanguageChange.bind(this));
```

### 9. HTML Splash 숨기기

Start.ts의 start()에서:
```typescript
if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cc-game-ready'));
}
```

## 지원 언어

| 코드 | 언어 | 확장자 | 비고 |
|------|------|--------|------|
| ko | 한국어 | `.ts` 또는 `.js` | 기본, 프로젝트 환경에 맞춤 |
| en | English | `.ts` 또는 `.js` | 프로젝트 환경에 맞춤 |
| zh | 中文 | `.ts` 또는 `.js` | 프로젝트에 zh 파일 있을 때 |
| cn | 中文 | `.ts` 또는 `.js` | 프로젝트에 cn 파일만 있을 때 |
| jp | 日本語 | `.ts` 또는 `.js` | 프로젝트 환경에 맞춤 |
| key | 키값 | - | 디버깅용 |

## Guidelines

- web-mobile 빌드에서만 동작
- 2.x는 빌드 후 post-build-inject.js 실행 필요
- Hi5Lang.t()로 설정한 텍스트는 onLanguageChange 리스너 등록 필요
- Hi5Lang_Lable 컴포넌트는 자동 업데이트

### JS/TS 처리 규칙

프로젝트의 `assets/scripts/i18n/` 디렉토리를 확인하여:
- `Hi5Lang.ts` 존재 시 → 모든 언어 파일을 `.ts`로 생성/수정
- `Hi5Lang.js` 존재 시 → 모든 언어 파일을 `.js`로 생성/수정
- 기존 `ko.ts`/`en.ts` 존재 시 → `.ts` 사용
- 기존 `ko.js`/`en.js` 존재 시 → `.js` 사용
- 판단 불가 시 → 사용자에게 JS/TS 선택 질문

### zh/cn 처리 규칙

프로젝트의 `assets/scripts/i18n/langs/` 디렉토리를 확인하여:
- `zh.ts` 또는 `zh.js` 존재 시 → 모든 곳에서 `cn` 대신 `zh` 사용
- `cn.ts` 또는 `cn.js`만 존재 시 → `cn` 그대로 사용
- 둘 다 없으면 → 사용자에게 어떤 코드를 사용할지 질문
