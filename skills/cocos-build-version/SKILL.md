---
name: cocos-build-version
description: Cocos Creator 프로젝트 빌드 자동화 스킬. 사용자가 "빌드해줘", "build", "웹 빌드" 등을 요청할 때 사용한다. 버전 자동 증가, web-mobile 빌드 실행, 빌드 결과에 버전 표시, README changelog 자동 생성을 수행한다. Cocos Creator 2.x/3.x 모두 지원.
---

# Cocos Build Version

Cocos Creator 프로젝트의 빌드 자동화 및 버전 관리 스킬.

## 트리거 조건

다음과 같은 요청 시 이 스킬을 사용한다:
- "빌드해줘", "빌드 해줘", "build"
- "웹 빌드", "web build"
- "버전 올리고 빌드"

## 빌드 워크플로우

사용자가 빌드를 요청하면 다음 순서로 진행한다:

### Step 0: 사용자 확인

빌드 시작 전 사용자에게 질문:

**vConsole 추가 여부**
- vConsole은 모바일 웹 디버깅 도구
- 개발/테스트 빌드에서 유용, 프로덕션에서는 제거 권장
- Y 선택 시: 빌드 결과에 vConsole 스크립트 삽입
- N 선택 시: vConsole 없이 빌드

### Step 1: 프로젝트 분석

1. **Cocos Creator 버전 확인**
   - 2.x: `project.json`에 `engine-version` 존재
   - 3.x: `extensions/` 폴더 또는 `package.json` 구조로 판별

2. **기존 빌드 템플릿 확인** (중요!)
   - `build-templates/web-mobile/` 폴더 존재 여부 확인
   - 커스텀 `index.html`, 스타일, 스크립트 등 확인
   - 존재하면 해당 템플릿 구조를 유지하며 빌드

3. **기존 빌드 설정 확인**
   - `settings/builder.json` 파일 확인
   - 이전 빌드 옵션 참조 (startScene, excludeScenes 등)

4. **Cocos Creator 실행 파일 경로 확인**
   - Windows 기본: `C:\CocosDashboard\resources\.editors\Creator\{version}\CocosCreator.exe`
   - 경로가 다르면 사용자에게 확인

### Step 2: 버전 증가

1. `package.json`에서 현재 버전 읽기
2. 버전이 없으면 `"version": "0.0.1"` 추가
3. 있으면 patch 버전 1 증가 (예: 0.0.1 → 0.0.2)
4. `package.json` 업데이트

```javascript
// 버전 증가 로직
const [major, minor, patch] = version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;
```

### Step 3: Cocos Creator CLI 빌드

**기존 빌드 템플릿이 있으면 해당 설정을 우선 사용한다.**

web-mobile 플랫폼으로 빌드 실행:

```bash
# Cocos Creator 2.x
"{CocosCreator경로}" --path "{프로젝트경로}" --build "platform=web-mobile"

# Cocos Creator 3.x
"{CocosCreator경로}" --project "{프로젝트경로}" --build "platform=web-mobile"
```

빌드 설정 우선순위:
1. `settings/builder.json`의 기존 설정
2. `build-templates/web-mobile/`의 커스텀 템플릿
3. 기본 빌드 옵션

### Step 4: 빌드 결과에 버전 표시 (필수!)

**중요: 이 단계는 반드시 실행해야 한다. 빌드 완료 후 즉시 index.html을 수정한다.**

1. **빌드 출력 파일 열기**
   - `build/web-mobile/index.html` 파일을 Read 도구로 읽는다

2. **`<title>` 태그 수정 (필수)**
   - Edit 도구를 사용하여 `<title>` 태그에 버전을 추가한다
   - 기존 title 텍스트 뒤에 ` v{버전}` 형식으로 추가
   ```html
   <!-- Before -->
   <title>GameName</title>

   <!-- After -->
   <title>GameName v0.0.2</title>
   ```

3. **버전 전역 변수 추가 (필수)**
   - Edit 도구를 사용하여 `<head>` 태그 안에 버전 스크립트 삽입
   ```html
   <head>
     <script>window.GAME_VERSION = "0.0.2";</script>
     <!-- 나머지 head 내용 -->
   </head>
   ```

**체크리스트:**
- [ ] index.html을 읽었는가?
- [ ] `<title>` 태그에 버전이 추가되었는가?
- [ ] `window.GAME_VERSION` 변수가 삽입되었는가?

### Step 5: vConsole 추가 (선택)

사용자가 Y를 선택한 경우에만 실행:

1. **vConsole CDN 스크립트 삽입**
   `build/web-mobile/index.html`의 `</body>` 태그 앞에 추가:

   ```html
   <!-- vConsole for debugging -->
   <script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
   <script>
     var vConsole = new window.VConsole();
     console.log('vConsole initialized - Version:', window.GAME_VERSION);
   </script>
   ```

2. **기존 빌드 템플릿에 vConsole 설정이 있으면 그것을 우선 사용**

### Step 6: README Changelog 업데이트

1. **마지막 버전 태그 이후의 git 커밋 메시지 수집**
   ```bash
   git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD
   ```

2. **README.md에 changelog 섹션 추가/업데이트**
   ```markdown
   ## Changelog

   ### v0.0.2 (2024-01-15)
   - feat: 새로운 기능 추가
   - fix: 버그 수정

   ### v0.0.1 (2024-01-10)
   - Initial release
   ```

3. 커밋 메시지가 없으면 "빌드 업데이트"로 기록

4. **README.md가 없으면 생성**

### Step 7: 완료 및 빌드 폴더 열기

빌드 완료 후:

1. **빌드 폴더 자동 열기 (필수)**
   ```bash
   # Windows
   explorer "{프로젝트경로}\build\web-mobile"

   # macOS
   open "{프로젝트경로}/build/web-mobile"
   ```

2. **완료 메시지 출력**
   ```
   ✅ 빌드 완료!

   📦 버전: 0.0.1 → 0.0.2
   🌐 플랫폼: web-mobile
   📁 출력 경로: build/web-mobile/ (폴더 열림)
   🔧 vConsole: 추가됨 (또는 "미포함")
   📝 Changelog: README.md 업데이트됨
   ```

## 버전 관리 규칙

| 상황 | 동작 |
|------|------|
| package.json에 version 없음 | 0.0.1로 시작 |
| version 존재 | patch +1 (0.0.x) |
| 빌드 실패 | 버전 롤백 |

## 빌드 템플릿 경로

| 항목 | 경로 |
|------|------|
| 커스텀 템플릿 | `build-templates/web-mobile/` |
| 빌드 설정 | `settings/builder.json` |
| 빌드 출력 | `build/web-mobile/` |

**중요**: 기존 빌드 템플릿이 있으면 반드시 해당 구조와 설정을 유지해야 한다.

## 에러 처리

### Cocos Creator 경로를 찾을 수 없는 경우

사용자에게 다음을 확인:
1. CocosDashboard 설치 여부
2. Cocos Creator 에디터 설치 버전
3. 설치 경로 직접 입력 요청

### 빌드 실패 시

1. 에러 로그 출력
2. package.json 버전 원복
3. 일반적인 해결 방법 안내:
   - 프로젝트를 에디터에서 한 번 열어보기
   - 의존성 확인
   - 빌드 설정 확인

## 참고: Cocos Creator CLI 옵션

### 2.x 버전
```
--path <projectPath>     프로젝트 경로
--build <buildOptions>   빌드 옵션 (JSON 문자열 또는 key=value)
--compile <platform>     네이티브 프로젝트 컴파일
--force                  강제 빌드
```

### 3.x 버전
```
--project <projectPath>  프로젝트 경로
--build <buildOptions>   빌드 옵션
-c, --config <file>      빌드 설정 파일
-o, --output <dir>       출력 디렉토리
```
