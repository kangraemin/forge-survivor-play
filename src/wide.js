// 64차: 넓은 화면(PC·태블릿 가로) 전투. 메인 카메라가 창 전폭 월드를 보여 주고, HUD·창은 별도 카메라(가운데 270 열)가 그린다.
// 좌표 체계는 그대로다: HUD·창을 만드는 코드(setScrollFactor(0) 물체)는 270x480 기준 좌표를 그대로 쓴다.
//  - 월드 물체(scrollFactor 1): 메인 카메라만 그린다(HUD 카메라는 무시)
//  - 화면 고정 물체(scrollFactor 0): HUD 카메라만 그린다(메인 카메라는 무시)
//  - wideFx 표시가 붙은 화면 고정 물체(어둠·피격 번쩍임·가장자리 경고·조이스틱): 창 전폭이라 메인 카메라가 그린다
// 폭이 270이면(폰·토스) 아무것도 안 하고 null을 돌려준다.
import { W, H, GW, OFF, WIDE } from './data.js';
import { PX } from './ui.js';

export function setupWide(scene) {
  if (!WIDE) return null;
  const main = scene.cameras.main;
  const hud = scene.cameras.add(OFF * PX, 0, W * PX, H * PX, false, 'hud');
  hud.setOrigin(0).setZoom(PX).setRoundPixels(true);
  const mid = main.id, hid = hud.id;
  // 방식을 바꿀 때마다 두 카메라의 무시 비트를 다시 쓴다(물체가 나중에 scrollFactor를 0으로 바꿔도 따라간다)
  const sweep = () => {
    const list = scene.children.list;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const mode = o.scrollFactorX === 0 ? (o.wideFx ? 2 : 1) : 0;
      if (o.__wm === mode) continue;
      o.__wm = mode;
      o.cameraFilter = (o.cameraFilter & ~(mid | hid)) | (mode === 1 ? mid : mode === 0 ? hid : hid);
    }
  };
  scene.events.on('postupdate', sweep);
  scene.events.once('shutdown', () => scene.events.off('postupdate', sweep));
  return { hud, main };
}

// 창이 뜰 때 가운데 열 밖(양옆)도 같이 어둡게 덮는다. 열 안은 창의 막이 덮는다. 돌려준 물체는 창이 닫힐 때 같이 지운다
export function sideDim(scene, color, alpha, depth) {
  if (!WIDE) return [];
  const mk = (x, w) => { const r = scene.add.rectangle(x, 0, w, H, color, alpha).setOrigin(0).setScrollFactor(0).setDepth(depth); r.wideFx = true; return r; };
  return [mk(0, OFF), mk(OFF + W, OFF)];
}
