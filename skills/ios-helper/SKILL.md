---
name: ios-helper
description: |
  iOS Safari 오디오 이슈 해결 가이드
  사용 시점: iOS Safari에서 백그라운드 복귀 후 오디오 재생 안됨 이슈 발생 시
  전제조건: Cocos Creator 2.x 또는 3.x 프로젝트, Web Audio API 사용
  입력: audioTool.ts 또는 유사한 오디오 매니저 클래스
---

# iOS Safari 오디오 이슈 해결

iOS Safari에서 앱이 백그라운드로 갔다가 복귀할 때 오디오가 재생되지 않는 문제를 해결합니다.

**Cocos Creator 2.x/3.x 모두 지원** (v2.0.0)

---

## 모듈화된 코드 (다른 프로젝트 적용용)

| 파일 | 설명 |
|------|------|
| `templates/iOSAudioHelper.ts` | 독립 모듈 - 복사해서 사용 |
| `templates/INTEGRATION.md` | 통합 가이드 |

### 빠른 적용 방법

1. `iOSAudioHelper.ts`를 프로젝트에 복사
2. 오디오 매니저에서 import 및 초기화
3. `setupUserGestureUnlock()` 호출
4. 상세 내용은 `INTEGRATION.md` 참조

---

## 문제 원인

### iOS Safari의 Web Audio API 제한

1. **AudioContext 상태 변화**
   - 백그라운드 진입 시: `running` → `interrupted` 또는 `suspended`
   - 포그라운드 복귀 시: AudioContext가 손상되어 resume() 실패
   - DOMException 발생: "The operation was aborted"

2. **Safari 제한사항**
   - AudioContext 인스턴스 최대 4개 제한
   - 사용자 제스처 없이 오디오 재생 불가
   - 백그라운드에서 AudioContext 자동 중단

3. **관련 WebKit 버그**
   - WebKit Bug #237878: AudioContext suspended on iOS backgrounding
   - WebKit Bug #263627: AudioContext resume fails after background

---

## 구현 가이드

### Step 1: 플랫폼 감지 (2.x/3.x 호환)

```typescript
public isIOSPlatform(): boolean {
    const cc = (window as any).cc;
    const sys = cc?.sys;

    // 2.x: sys.OS_IOS, 3.x: sys.OS.IOS
    const isIOS = sys?.os === (sys?.OS_IOS || sys?.OS?.IOS || 'iOS');
    return sys?.isBrowser && isIOS;
}
```

### Step 2: 상태 변수 추가

```typescript
/** iOS에서 Cocos Audio 사용 불가 상태 */
private _iOSAudioDisabled: boolean = false;

/** iOS용 HTML Audio fallback */
private _htmlAudio: HTMLAudioElement | null = null;
private _usingHTMLAudio: boolean = false;

/** BGM 복구 필요 플래그 */
private _needsBGMRecovery: boolean = false;

/** 백그라운드 진입 전 재생 상태 */
private _wasPlayingBeforeBackground: boolean = false;
```

### Step 3: Visibility 이벤트 핸들러 (2.x/3.x 호환)

```typescript
private setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            this.resumeAudioOnForeground();
        } else {
            this.pauseForBackground();
        }
    });

    window.addEventListener('focus', () => this.resumeAudioOnForeground());
    window.addEventListener('blur', () => this.pauseForBackground());

    // Safari bfcache
    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
        if (e.persisted) this.resumeAudioOnForeground();
    }, { passive: true });

    // Cocos Game events (2.x/3.x 호환)
    const cc = (window as any).cc;
    const isV3 = (cc?.VERSION || '').startsWith('3.');

    const EVENT_SHOW = isV3 ? cc.Game?.EventType?.SHOW : cc.game?.EVENT_SHOW;
    const EVENT_HIDE = isV3 ? cc.Game?.EventType?.HIDE : cc.game?.EVENT_HIDE;

    cc.game.on(EVENT_SHOW, () => this.resumeAudioOnForeground());
    cc.game.on(EVENT_HIDE, () => this.pauseForBackground());
}
```

### Step 4: 백그라운드 진입 처리

```typescript
private pauseForBackground(): void {
    // HTML Audio 일시정지
    if (this._htmlAudio && !this._htmlAudio.paused) {
        this._htmlAudio.pause();
        this._wasPlayingBeforeBackground = true;
    }
    // Cocos BGM 상태 저장
    else if (this.bgmComp?.playing) {
        this._wasPlayingBeforeBackground = true;
    } else {
        this._wasPlayingBeforeBackground = false;
    }
}
```

### Step 5: 포그라운드 복귀 처리 (iOS)

```typescript
private async resumeAudioOnForeground(): Promise<void> {
    // Debounce 처리 (500ms)
    const now = Date.now();
    if (now - this._lastResumeTime < 500) return;
    this._lastResumeTime = now;

    if (this.isIOSPlatform()) {
        // Cocos Audio 비활성화
        this._iOSAudioDisabled = true;

        // 기존 Cocos BGM 정지 (에러 무시)
        try {
            if (this.bgmComp) {
                this.bgmComp.stop();
                this.bgmComp.clip = null;
            }
        } catch (e) { /* ignore */ }

        // HTML Audio가 있고 일시정지 상태면 재개 시도
        if (this._htmlAudio && this._htmlAudio.paused && this._wasPlayingBeforeBackground) {
            try {
                await this._htmlAudio.play();
                return; // 성공
            } catch (e) {
                // 실패 → 사용자 제스처 필요
            }
        }

        // 사용자 터치 대기
        this._needsBGMRecovery = true;
        return;
    }

    // 비-iOS: 기존 AudioContext resume 로직
    // ...
}
```

### Step 6: 사용자 제스처 기반 오디오 unlock

```typescript
public setupUserGestureUnlock(): void {
    if (!this.isIOSPlatform()) return;
    if (this._touchListenerAdded) return;
    this._touchListenerAdded = true;

    const onUserGesture = async () => {
        if (!gameConfig.isBgm) return;

        // HTML Audio가 이미 재생 중이면 스킵
        if (this._usingHTMLAudio && this._htmlAudio && !this._htmlAudio.paused) {
            return;
        }

        // 복구 필요 시 HTML Audio 재생
        if (this._iOSAudioDisabled || this._needsBGMRecovery) {
            await this.playBGMWithHTMLAudio();
        }
    };

    // Canvas에 리스너 추가 (중요!)
    const canvas = document.getElementById('GameCanvas')
        || document.querySelector('canvas')
        || document.body;

    canvas.addEventListener('touchstart', onUserGesture, { passive: true });
    canvas.addEventListener('touchend', onUserGesture, { passive: true });
    canvas.addEventListener('click', onUserGesture, { passive: true });

    // document에도 fallback 추가
    document.addEventListener('touchstart', onUserGesture, { passive: true });
}
```

---

## 플랫폼별 주의사항

| 플랫폼 | 제한 | 해결책 |
|--------|------|--------|
| iOS Safari | AudioContext 최대 4개 | 인스턴스 재사용 |
| iOS Safari | 백그라운드 중단 | HTML Audio fallback |
| iOS Safari | 사용자 제스처 필수 | touchstart 리스너 |

---

## 테스트 시나리오

| # | 시나리오 | 예상 결과 |
|---|---------|----------|
| 1 | 백그라운드 → 포그라운드 (터치) | BGM 재생됨 |
| 2 | BGM OFF → 재접속 → ON | BGM 재생됨 |
| 3 | 로비 → 게임 씬 전환 | 게임 BGM으로 전환 |
| 4 | 광고 시청 후 복귀 | BGM 재생됨 |
| 5 | 백그라운드 복귀 후 효과음 | 효과음 재생됨 |
| 6 | BGM ON/OFF 토글 | 즉시 반영됨 |

---

## 디버깅

콘솔 로그 프리픽스: `[audioTool]`

```typescript
console.log('[audioTool] Touch detected:', {
    isBgm: gameConfig.isBgm,
    bgmName: this._currentBgmName,
    iOSDisabled: this._iOSAudioDisabled,
    needsRecovery: this._needsBGMRecovery,
    usingHTML: this._usingHTMLAudio,
    htmlPaused: this._htmlAudio?.paused
});
```
