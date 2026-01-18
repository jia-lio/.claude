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

## Guidelines

- 기존 플러그인이 있으면 덮어쓸지 사용자에게 확인
- 버전을 자동 감지할 수 없으면 사용자에게 질문
- outputPath는 프로젝트의 기존 i18n 구조에 맞게 설정
