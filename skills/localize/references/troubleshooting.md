# Localize 트러블슈팅 가이드

## 일반적인 오류

### `fetch failed`

**원인**: .env의 NAS 주소에 `https://`가 포함됨

**해결**:
```
# 잘못된 형식
SYNO_CONNECTION=lio:myPassword@https://tinycellsuperhit.synology.me

# 올바른 형식
SYNO_CONNECTION=lio:myPassword@tinycellsuperhit.synology.me
```

---

### `Drive 로그인 실패 (code: 400)`

**원인**:
- 비밀번호가 잘못됨
- URL 인코딩 문제

**해결**:
1. 비밀번호 확인
2. 특수문자가 있어도 URL 인코딩하지 않고 그대로 입력

```
# 비밀번호가 "pass@123"인 경우
SYNO_CONNECTION=lio:pass@123@tinycellsuperhit.synology.me
```

---

### `Cannot find package 'commander'`

**원인**: node_modules 복사가 불완전함

**해결**:
```bash
# 전체 node_modules 복사
cp -r "C:/Users/user/Desktop/cocos/Localize-json-ts/2.x/localize-plugin/node_modules/"* "${PROJECT_PATH}/node_modules/"
```

---

### `E403 Permission denied`

**원인**: GitHub Packages 인증 문제

**해결**:
1. GitHub Personal Access Token 생성 (read:packages 권한 포함)
2. `~/.npmrc`에 토큰 설정:

```
//npm.pkg.github.com/:_authToken=ghp_xxxxxxxxxxxx
@tinycellcorp:registry=https://npm.pkg.github.com
```

---

### `ENOENT: no such file or directory`

**원인**: 출력 디렉토리가 존재하지 않음

**해결**:
```bash
mkdir -p "${PROJECT_PATH}/assets/scripts/i18n/langs"
```

---

## .env 설정 예시

### 올바른 형식

```
SYNO_CONNECTION=lio:myPassword123@tinycellsuperhit.synology.me
```

### 잘못된 형식들

```
# https:// 포함 (X)
SYNO_CONNECTION=lio:myPassword@https://tinycellsuperhit.synology.me

# URL 인코딩 사용 (X)
SYNO_CONNECTION=lio:my%40Password@tinycellsuperhit.synology.me

# 따옴표 사용 (X)
SYNO_CONNECTION="lio:myPassword@tinycellsuperhit.synology.me"
```

---

## 디버깅 팁

### 연결 테스트

```bash
# .env 파일 확인
cat .env

# CLI 직접 실행하여 상세 오류 확인
node node_modules/@tinycellcorp/syno-lang/dist/cli.js download --gameId TestGame --outputDir ./temp/test
```

### 네트워크 문제

```bash
# NAS 접근 가능 여부 확인
ping tinycellsuperhit.synology.me

# 포트 확인 (기본 5001)
curl -I https://tinycellsuperhit.synology.me:5001
```
