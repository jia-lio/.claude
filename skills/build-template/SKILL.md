---
name: build-template
description: Cocos Creator 프로젝트에 웹 빌드 템플릿을 생성하는 스킬. 이 스킬은 사용자가 "/build-template" 명령을 실행하거나 "빌드 템플릿 생성", "웹 빌드 설정" 등의 요청을 할 때 사용된다. 전체화면 금지 기능이 포함된다.
---

# Build Template 스킬

Cocos Creator 프로젝트에 웹 빌드 템플릿을 생성하는 스킬입니다.

## 기능

- **전체화면 금지**: 터치/클릭으로 인한 자동 전체화면 비활성화
- **버전 자동 감지**: 2.x / 3.x 버전에 맞는 템플릿 자동 적용

## Instructions

### 1. Cocos Creator 버전 확인

프로젝트 루트에서 버전 확인:

- `project.json` 존재 → **2.x**
- `package.json`에 `creator.version` 존재 → **3.x**

### 2. 빌드 템플릿 디렉토리 생성

```bash
mkdir -p "${PROJECT_PATH}/build-templates/web-mobile"
```

### 3. 버전별 템플릿 복사

#### Cocos Creator 2.x

이 스킬의 `assets/2.x/web-mobile/` 디렉토리에서 main.js만 복사:

```bash
cp assets/2.x/web-mobile/main.js "${PROJECT_PATH}/build-templates/web-mobile/"
```

**포함된 기능**:
- `cc.view.enableAutoFullScreen(false)` (전체화면 금지)

#### Cocos Creator 3.x

3.x의 경우 main.js에서 전체화면 설정을 직접 수정해야 합니다.
빌드 후 생성된 main.js 파일에서 `cc.screen.autoFullScreen = false` 추가가 필요합니다.

### 4. 테스트

1. Cocos Creator에서 **Project > Build** 실행
2. Platform: **Web Mobile** 선택
3. Build 후 Preview로 확인:
   - 터치/클릭 시 전체화면으로 전환되지 않는지 확인

## 템플릿 파일 위치

```
build-template/
└── assets/
    └── 2.x/
        └── web-mobile/
            └── main.js
```

## Guidelines

- 기존 빌드 템플릿이 있으면 덮어쓸지 사용자에게 확인
- 버전을 자동 감지할 수 없으면 사용자에게 질문
- 빌드 후 반드시 Preview로 기능 테스트 안내
