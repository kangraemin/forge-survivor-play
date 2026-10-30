// 안전 영역: 토스 SDK의 SafeAreaInsets(1.4.7+: get()·subscribe())와 CSS env(safe-area-inset-*)의 큰 쪽을 쓴다.
// 값은 CSS 픽셀이라 게임 좌표(270x480, 캔버스는 FIT이라 위아래 여백이 있다)로 바꿔 준다.
// 토스 안에서는 오른쪽 위에 닫기(X) 버튼이 떠 있다: 오른쪽 HUD는 그 아래로 내린다.
let sdkIn = { top: 0, bottom: 0, left: 0, right: 0 }, probe = null, started = false;
const XBTN_BOTTOM = 52;   // 위 인셋 아래로 X 버튼(top+5, 높이 약 36)이 차지하는 CSS px + 여유

function cssEnv() {
  try {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(probe);
    }
    const c = getComputedStyle(probe);
    return { top: parseFloat(c.paddingTop) || 0, right: parseFloat(c.paddingRight) || 0, bottom: parseFloat(c.paddingBottom) || 0, left: parseFloat(c.paddingLeft) || 0 };
  } catch { return { top: 0, right: 0, bottom: 0, left: 0 }; }
}
const norm = v => ({ top: +v?.top || 0, bottom: +v?.bottom || 0, left: +v?.left || 0, right: +v?.right || 0 });

// 토스 SDK 값을 읽고 바뀌면 따라간다(가로·세로 전환 등). 여러 번 불러도 한 번만 건다
export function initSafeArea() {
  if (started) return; started = true;
  try {
    const S = window.__AIT_SDK?.SafeAreaInsets;
    if (S) {
      try { sdkIn = norm(S.get()); } catch { /* 값을 못 읽으면 CSS 값만 쓴다 */ }
      try { S.subscribe({ onEvent: v => { sdkIn = norm(v); } }); } catch { /* 구독 실패는 무시 */ }
    }
  } catch { /* SDK 없음(웹) */ }
}
export const inTossShell = () => !!window.__AIT_SDK;

// CSS px 인셋(SDK와 CSS env 중 큰 값)
export function insetsCss() {
  initSafeArea();
  const e = cssEnv();
  return { top: Math.max(sdkIn.top, e.top), bottom: Math.max(sdkIn.bottom, e.bottom), left: Math.max(sdkIn.left, e.left), right: Math.max(sdkIn.right, e.right) };
}

// 게임 좌표로 바꾼 값: top·bottom은 캔버스 안으로 실제로 파고드는 만큼, xTop은 오른쪽 HUD가 X 버튼을 피해 내려갈 만큼(토스 안에서만)
export function insetsGame(game) {
  const cv = game?.canvas, r = cv?.getBoundingClientRect?.();
  if (!r || !r.width) return { top: 0, bottom: 0, xTop: 0 };
  const k = r.width / 270, ins = insetsCss();
  const top = Math.max(0, (ins.top - r.top) / k);
  const bottom = Math.max(0, (ins.bottom - (innerHeight - r.bottom)) / k);
  const xTop = inTossShell() ? Math.max(0, (ins.top + XBTN_BOTTOM - r.top) / k - 7) : 0;
  return { top: Math.round(top), bottom: Math.round(bottom), xTop: Math.round(Math.max(top, xTop)) };
}
