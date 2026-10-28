// 공통 UI: 글자 스타일, 패널, 누르는 버튼, 아이콘
import { sfx } from './sfx.js';

export const font = (size, color = '#ffffff', stroke = 3) =>
  ({ fontFamily: 'G11', fontSize: size + 'px', color, stroke: '#0a0710', strokeThickness: stroke });
export const font9 = (size, color = '#d8d2e8') => ({ fontFamily: 'G9', fontSize: size + 'px', color });

export const COLOR = { panel: 0x15121f, panel2: 0x221c33, line: 0x5b4f7a, gold: 0xffd75e, red: 0xe8343a, green: 0x5fdc6a, blue: 0x6fd3ff };

export const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.floor(n));

export function panel(scene, x, y, w, h, { fill = COLOR.panel, line = COLOR.line, alpha = 0.94 } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 2, y + 3, w, h, 6);
  g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(1, line, 1).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 6);
  g.lineStyle(1, 0xffffff, 0.08).lineBetween(x + 5, y + 2, x + w - 5, y + 2);
  return g;
}

// 버튼: 누르면 살짝 눌렸다 튀어 오르고 소리. disabled면 회색에 거절음
export function button(scene, x, y, w, h, label, onTap, { color = 0x3b2f5c, size = 12, textColor = '#ffffff' } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (col, down) => {
    g.clear();
    g.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 6);
    g.fillStyle(col, 1).fillRoundedRect(-w / 2, -h / 2 + (down ? 2 : 0), w, h, 6);
    g.fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2 + 2, -h / 2 + 2 + (down ? 2 : 0), w - 4, h / 2 - 2, 4);
    g.lineStyle(1, 0x000000, 0.6).strokeRoundedRect(-w / 2 + 0.5, -h / 2 + 0.5 + (down ? 2 : 0), w - 1, h - 1, 6);
  };
  const t = scene.add.text(0, 0, label, font(size, textColor)).setOrigin(0.5);
  c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.label = t; c.enabled = true; c.col = color;
  c.setEnabled = v => { c.enabled = v; draw(v ? c.col : 0x3a3a44, false); t.setAlpha(v ? 1 : 0.55); return c; };
  c.setColor = col => { c.col = col; draw(col, false); return c; };
  draw(color, false);
  c.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); draw(c.enabled ? c.col : 0x3a3a44, true); t.y = 2; });
  c.on('pointerout', () => { draw(c.enabled ? c.col : 0x3a3a44, false); t.y = 0; });
  c.on('pointerup', (p, lx, ly, ev) => {
    ev?.stopPropagation?.();
    draw(c.enabled ? c.col : 0x3a3a44, false); t.y = 0;
    if (!c.enabled) { sfx('deny'); scene.tweens.add({ targets: c, x: x + 3, duration: 40, yoyo: true, repeat: 2 }); return; }
    sfx('click'); onTap?.();
  });
  return c;
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
  return scene.add.text(x, y, FALLBACK[idx] || '?', { fontSize: Math.round(size * 0.8) + 'px' }).setOrigin(0.5);
}

// 화면 위쪽에서 잠깐 떴다 사라지는 알림 한 줄
export function toast(scene, msg, color = '#ffffff') {
  // 화면 위쪽(상단 바 바로 아래)에 어두운 띠를 깔아 아래 정보·버튼을 가리지 않는다
  const t = scene.add.container(135, 104).setDepth(200).setScrollFactor(0).setAlpha(0);
  const tx = scene.add.text(0, 0, msg, font(12, color)).setOrigin(0.5);
  t.add([scene.add.rectangle(0, 0, Math.min(262, tx.width + 24), 24, 0x0a0710, 0.85).setStrokeStyle(1, 0x5b4f7a), tx]);
  scene.tweens.add({ targets: t, alpha: 1, y: 88, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, alpha: 0, y: 76, delay: 1300, duration: 300, onComplete: () => t.destroy() });
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
