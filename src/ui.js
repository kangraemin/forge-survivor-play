// 공통 UI: 글자 스타일, 패널, 누르는 버튼, 아이콘
import { sfx } from './sfx.js';
import { TIERS, SKILLS } from './data.js';

// 그리는 배율. 카메라를 왼쪽 위 기준으로 PX배 당겨 게임 좌표(270x480)를 그대로 쓴다
// 기기 실제 픽셀에 맞춘다(1080 폭 폰이면 4배): 화면에 맞추며 정수배가 아니게 늘리거나 줄이면 글자 획이 들쭉날쭉해진다
const dpr = window.devicePixelRatio || 1;
export const PX = Math.max(2, Math.min(4, Math.ceil(Math.min(innerWidth * dpr / 270, innerHeight * dpr / 480) - 0.05)));

// 글자는 그리는 판 해상도로 만든다(1배로 만들어 PX배로 늘리면 뭉개진다)
export const font = (size, color = '#ffffff', stroke = 3) =>
  ({ fontFamily: 'G11', fontSize: size + 'px', color, stroke: '#0a0710', strokeThickness: stroke, resolution: PX });
export const font9 = (size, color = '#d8d2e8') => ({ fontFamily: 'G9', fontSize: size + 'px', color, resolution: PX });

export const COLOR = { panel: 0x1c2935, panel2: 0x293845, line: 0x475c66, gold: 0xffd75e, red: 0xe8343a, green: 0x5fdc6a, blue: 0x6fd3ff };

export const hiCam = scene => scene.cameras.main.setOrigin(0).setZoom(PX);
// 카메라 기준점을 왼쪽 위로 옮겨 Phaser의 worldView(가운데 기준 계산)가 어긋난다 → 보이는 영역은 이걸로 구한다
export const viewRect = scene => { const c = scene.cameras.main; return new Phaser.Geom.Rectangle(c.scrollX, c.scrollY, c.width / c.zoom, c.height / c.zoom); };

// 상단 바 칸이 좁아 4글자 안팎으로 자른다(반올림하면 99999가 100.0k가 되니 버림)
export const fmt = n => n >= 1e6 ? Math.floor(n / 1e5) / 10 + 'M' : n >= 10000 ? Math.floor(n / 1000) + 'k' : String(Math.floor(n));

// 패널·버튼은 디자인 인계(잿불 성채 style_guide) 규격: 직각 면 + 1px 선, 그림자·광택 없음
export function panel(scene, x, y, w, h, { fill = COLOR.panel, line = COLOR.line, alpha = 0.94 } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha).fillRect(x, y, w, h);
  g.lineStyle(1, line, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.box = { x, y, w, h };   // 배치 검사용(버튼이 패널 밖으로 나갔는지)
  return g;
}

// 버튼: 누르면 살짝 눌렸다 튀어 오르고 소리. disabled면 회색에 거절음
// 색은 셋만 쓴다: 주 행동 초록 0x2f6b3a, 위험(분해·포기·초기화) 빨강 0x8a2f3a, 그 밖은 기본 회색 0x3a3846
// 그리는 색은 디자인 인계 토큰으로 바꿔 칠한다: 주 행동 = 불빛 주황(ink 글자), 기본 = iron 면 + line 테두리
const BTN_FILL = { 0x2f6b3a: 0xffb85c, 0x3a3846: 0x293845 };
export function button(scene, x, y, w, h, label, onTap, { color = 0x3a3846, size = 12, textColor = '#ffffff', onDeny } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (col, down) => {
    g.clear();
    const f = BTN_FILL[col] ?? col, oy = down ? 1 : 0;
    g.fillStyle(f, 1).fillRect(-w / 2, -h / 2 + oy, w, h);
    g.lineStyle(1, f === 0xffb85c ? 0x111923 : 0x475c66, 1).strokeRect(-w / 2 + 0.5, -h / 2 + 0.5 + oy, w - 1, h - 1);
  };
  const primary = color === 0x2f6b3a && textColor === '#ffffff';
  const t = scene.add.text(0, 0, label, font(size, primary ? '#111923' : textColor, primary ? 0 : 3)).setOrigin(0.5);
  c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.label = t; c.enabled = true; c.col = color; c.isBtn = true;
  c.setEnabled = v => { c.enabled = v; draw(v ? c.col : 0x221f2a, false); t.setAlpha(v ? 1 : 0.45); return c; };
  // 주 행동 색(주황)일 때만 글자를 진한 잉크로, 아니면 흰 글자 + 외곽선
  const ink = col => { if (textColor !== '#ffffff') return; const p = col === 0x2f6b3a; t.setColor(p ? '#111923' : '#ffffff').setStroke('#0a0710', p ? 0 : 3); };
  c.setColor = col => { c.col = col; ink(col); draw(col, false); return c; };
  draw(color, false);
  c.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); c.armed = true; draw(c.enabled ? c.col : 0x3a3a44, true); t.y = 2; });
  c.on('pointerout', () => { c.armed = false; draw(c.enabled ? c.col : 0x3a3a44, false); t.y = 0; });
  c.on('pointerup', (p, lx, ly, ev) => {
    ev?.stopPropagation?.();
    // 이동하느라 누르고 있던 손가락을 떼는 것은 누른 게 아니다: 이 버튼 위에서 눌렀을 때만 받는다
    if (!c.armed) return;
    c.armed = false;
    draw(c.enabled ? c.col : 0x3a3a44, false); t.y = 0;
    if (!c.enabled) { if (onDeny) return onDeny(); sfx('deny'); scene.tweens.add({ targets: c, x: x + 3, duration: 40, yoyo: true, repeat: 2 }); return; }
    sfx('click'); onTap?.();
  });
  return c;
}

// 이 물체 위에서 눌렀다 뗐을 때만 fn을 부른다(다른 데서 누른 채 끌고 와 떼면 무시)
export function onTap(obj, fn) {
  obj.on('pointerdown', () => { obj.armed = true; });
  obj.on('pointerout', () => { obj.armed = false; });
  obj.on('pointerup', (...a) => { if (!obj.armed) return; obj.armed = false; fn(...a); });
  return obj;
}

// 아이콘 시트(4x4)에서 번호로 한 칸. 시트가 없으면 글자로 대신한다
const FALLBACK = ['🗡', '⚔', '🔷', '🔥', '🌀', '🔪', '⚡', '✨', '☄', '❄', '🧪', '🛡', '🪙', '💎', '❤', '📜'];
export function icon(scene, x, y, idx, size = 22) {
  const key = 'icons_r' + (idx >> 2) + 's';
  if (scene.textures.exists(key)) {
    const im = scene.add.image(x, y, key, idx & 3);
    im.setScale(size / Math.max(im.width, im.height));
    return im;
  }
  return scene.add.text(x, y, FALLBACK[idx] || '?', { fontSize: Math.round(size * 0.8) + 'px', resolution: PX }).setOrigin(0.5);
}

// 화면 위쪽에서 잠깐 떴다 사라지는 알림 한 줄
export function toast(scene, msg, color = '#ffffff', y) {
  // 로비는 위쪽 정보(임무 제목·공격력 줄)를 가려서 탭 바로 위에 띄운다
  y ??= scene.scene.key === 'Lobby' ? 421 : 88;
  // 출석·미션 창(깊이 2000) 위에서도 보이게 그보다 위에 띄운다
  // 화면 위쪽(상단 바 바로 아래)에 어두운 띠를 깔아 아래 정보·버튼을 가리지 않는다
  const t = scene.add.container(135, y + 16).setDepth(3000).setScrollFactor(0).setAlpha(0);
  const tx = scene.add.text(0, 0, msg, font(12, color)).setOrigin(0.5);
  t.add([scene.add.rectangle(0, 0, Math.min(262, tx.width + 24), 24, 0x0a0710, 0.85).setStrokeStyle(1, 0x5b4f7a), tx]);
  scene.tweens.add({ targets: t, alpha: 1, y, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, alpha: 0, y: y - 12, delay: 1300, duration: 300, onComplete: () => t.destroy() });
}

// 칼빛 꾸미기: 궤적 그림(하늘색)의 색상을 돌려 다른 색으로 만든다. tint는 곱셈이라 하늘색을 빨강·금색으로 못 바꾼다
export function skinFx(sprite, sk) {
  const cm = sprite.preFX?.addColorMatrix();
  if (!cm) return sprite.setTint(sk.tint);
  if (sk.gray) { cm.grayscale(1); cm.brightness(sk.dark ? 0.55 : 1.4, true); } else cm.hue(sk.hue);
  return sprite;
}

// 무기 그림: 검은 아이콘 시트의 등급 그림, 나머지 종류는 Boot에서 그린 w_<종류><등급>
export function weaponIcon(scene, x, y, wid, tier = 0, size = 22) {
  const key = `w_${wid}${tier}`;
  if (wid === 'sword' && scene.textures.exists('icons_r0s') || !scene.textures.exists(key)) return icon(scene, x, y, TIERS[tier].icon, size);
  return scene.add.image(x, y, key).setScale(size / 16);
}

// 스킬 아이콘: 아이콘 칸이 모자라 같은 그림을 쓰는 스킬은 색으로 구분한다
// 기본 공격은 든 무기 그림을 쓴다(전투 화면은 scene.wtype이 있다)
export function skillIcon(scene, x, y, def, size) {
  if (def === SKILLS.sword && scene.wtype && scene.wtype.id !== 'sword') return weaponIcon(scene, x, y, scene.wtype.id, scene.sv?.tier || 0, size);
  const im = icon(scene, x, y, def.icon, size);
  if (def.tint) im.setTint(def.tint);
  if (def.flip) im.setFlipX(true);   // 같은 칼 그림이라 뒤집어 기본 공격과 구분한다
  return im;
}

// 보석(유료 재화) 아이콘: 아이콘 시트에 없어 직접 그린 분홍 다이아
export function gemIcon(scene, x, y, size = 14) {
  if (!scene.textures.exists('gemc')) {
    const g = scene.make.graphics({ add: false });
    const px = (c, pts) => { g.fillStyle(c); pts.forEach(([a, b, w = 1, h = 1]) => g.fillRect(a, b, w, h)); };
    px(0x2a0a1e, [[3, 0, 6], [1, 2, 10], [0, 3, 12, 2], [1, 5, 10], [2, 6, 8], [3, 7, 6], [4, 8, 4], [5, 9, 2]]);
    px(0xff4fa8, [[3, 1, 6], [1, 3, 10, 2], [2, 5, 8], [3, 6, 6], [4, 7, 4], [5, 8, 2]]);
    px(0xffb0dc, [[4, 1, 2], [2, 3, 3], [3, 5, 2]]);
    px(0xffffff, [[4, 1], [3, 3]]);
    g.generateTexture('gemc', 12, 10); g.destroy();
  }
  return scene.add.image(x, y, 'gemc').setScale(size / 12);
}

// 화면에 고정된 컨테이너. Phaser는 컨테이너의 scrollFactor를 자식의 입력 판정에 쓰지 않아
// 카메라가 움직이면 버튼이 눌리지 않는다 → 넣는 자식(그 안의 자식까지)도 전부 0으로 맞춘다
export function fixedContainer(scene, x = 0, y = 0) {
  // 안쪽 컨테이너는 나중에 채워질 수 있으니 그 add도 같은 식으로 감싼다
  const pin = o => {
    o.setScrollFactor?.(0);
    if (!o.list) return;
    o.list.forEach(pin);
    if (o.add.pinned) return;
    const add = o.add.bind(o);
    o.add = ch => { [].concat(ch).forEach(pin); return add(ch); };
    o.add.pinned = true;
  };
  const c = scene.add.container(x, y);
  pin(c);
  return c;
}
