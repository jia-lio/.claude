---
name: resolution-auto-fit
description: |
  Cocos Creator 2.x/3.x 프로젝트에 해상도 자동 대응 컴포넌트를 추가하는 스킬.
  사용자가 "/resolution-auto-fit", "해상도 대응", "화면 크기 대응", "해상도 자동 맞춤" 등을 요청할 때 사용된다.
  화면 종횡비에 따라 FIXED_WIDTH/FIXED_HEIGHT 정책을 자동 전환하여 다양한 기기에서 최적의 화면 표시를 제공한다.
---

# Resolution Auto Fit 스킬

Cocos Creator 2.x/3.x 프로젝트에서 다양한 화면 비율에 자동 대응하는 해상도 정책 컴포넌트를 제공한다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/resolution-auto-fit` | 프로젝트에 ResolutionAutoFit 추가 및 적용 |

## 파일

| 파일 | Cocos 버전 |
|------|-----------|
| `assets/ResolutionAutoFit_3x.ts` | 3.x |
| `assets/ResolutionAutoFit_2x.ts` | 2.x |

## 기능

- 화면 종횡비에 따라 해상도 정책 자동 전환
- **화면이 디자인보다 넓은 경우** → `FIXED_HEIGHT` (높이 고정)
- **화면이 디자인보다 좁은 경우** → `FIXED_WIDTH` (너비 고정)
- `resize` 이벤트로 즉시 감지 및 반영

## 동작 원리

```
디자인 해상도: 1080 x 1920 (종횡비 0.5625)

화면 종횡비 > 0.5625 (넓은 화면, 예: 태블릿)
    → FIXED_HEIGHT: 높이 1920 고정, 너비는 비례 확장

화면 종횡비 < 0.5625 (좁은 화면, 예: 긴 폰)
    → FIXED_WIDTH: 너비 1080 고정, 높이는 비례 확장
```

## 런타임 동작

```
게임 시작
    ↓
onLoad() → window.addEventListener('resize') 등록
    ↓
adjustResolutionPolicy() 최초 1회 실행
    ↓
화면 크기 변경 시 → resize 이벤트 발생 → 정책 즉시 전환
    ↓
onDestroy() → 이벤트 리스너 해제
```

## Instructions

**이 스킬이 호출되면 아래 단계를 순서대로 자동 실행한다.**

### Step 1: 프로젝트 버전 감지

```bash
if [ -d "${PROJECT_PATH}/settings/v2" ]; then
  COCOS_VERSION="3.x"
else
  COCOS_VERSION="2.x"
fi
```

### Step 2: 스크립트 복사

```bash
SKILL_PATH="C:/Users/user/Desktop/claude/.claude/skills/resolution-auto-fit"
mkdir -p "${PROJECT_PATH}/assets/scripts/utils"

if [ "$COCOS_VERSION" = "3.x" ]; then
  cp "${SKILL_PATH}/assets/ResolutionAutoFit_3x.ts" "${PROJECT_PATH}/assets/scripts/utils/ResolutionAutoFit.ts"
else
  cp "${SKILL_PATH}/assets/ResolutionAutoFit_2x.ts" "${PROJECT_PATH}/assets/scripts/utils/ResolutionAutoFit.ts"
fi
```

### Step 3: Canvas에 컴포넌트 적용

**방법 A: 에디터에서 직접 추가**
1. Canvas 노드 선택 → Add Component → "ResolutionAutoFit" 추가

**방법 B: 코드에서 동적 추가**
```typescript
// 3.x
import { ResolutionAutoFit } from './utils/ResolutionAutoFit';
canvas.addComponent(ResolutionAutoFit);

// 2.x
import ResolutionAutoFit from './utils/ResolutionAutoFit';
canvas.addComponent(ResolutionAutoFit);
```

### Step 4: 결과 보고

완료 후 사용자에게 다음 정보 출력:
- 감지된 Cocos 버전
- 복사된 스크립트 경로
- 컴포넌트 적용 방법
- Cocos Editor 새로고침 안내

## 함께 사용

| 컴포넌트 | 역할 |
|----------|------|
| **ResolutionAutoFit** | Canvas 해상도 정책 자동 전환 |
| **Widget** (Cocos 기본) | 개별 노드를 부모에 맞춰 정렬 |

## 2.x vs 3.x API 차이

| 기능 | 2.x | 3.x |
|------|-----|-----|
| 화면 크기 | `cc.view.getFrameSize()` | `screen.windowSize` |
| 해상도 설정 | `cc.view.setDesignResolutionSize()` | `view.setDesignResolutionSize()` |
| 정책 상수 | `cc.ResolutionPolicy.FIXED_HEIGHT` | `ResolutionPolicy.FIXED_HEIGHT` |

## 트러블슈팅

| 증상 | 해결 방법 |
|------|----------|
| 컴포넌트 미검색 | 스크립트 저장 후 에디터 새로고침 |
| 정책 전환 안됨 | Canvas에 컴포넌트 추가 확인 |
