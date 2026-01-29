/**
 * ResolutionAutoFit - Cocos Creator 3.x
 * 화면 종횡비에 따라 해상도 정책을 자동 전환하는 컴포넌트
 */
import { _decorator, Component, view, screen, ResolutionPolicy } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ResolutionAutoFit')
export class ResolutionAutoFit extends Component {
    private _resizeHandler: () => void = null;

    onLoad() {
        this._resizeHandler = this.adjustResolutionPolicy.bind(this);
        window.addEventListener('resize', this._resizeHandler);
        this.adjustResolutionPolicy();
    }

    onDestroy() {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }
    }

    adjustResolutionPolicy() {
        const winSize = screen.windowSize;
        const ratio = winSize.width / winSize.height;
        const drs = view.getDesignResolutionSize();
        const drsRatio = drs.width / drs.height;

        if (ratio > drsRatio) {
            // 화면이 디자인보다 넓음 → 높이 고정
            view.setDesignResolutionSize(drs.width, drs.height, ResolutionPolicy.FIXED_HEIGHT);
        } else {
            // 화면이 디자인보다 좁음 → 너비 고정
            view.setDesignResolutionSize(drs.width, drs.height, ResolutionPolicy.FIXED_WIDTH);
        }

        console.log(`[ResolutionAutoFit] ${winSize.width}x${winSize.height} → ${ratio > drsRatio ? 'FIXED_HEIGHT' : 'FIXED_WIDTH'}`);
    }
}
