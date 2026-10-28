// 공통 UI: 글자 스타일, 패널, 누르는 버튼, 아이콘
import { sfx } from './sfx.js';

export const font = (size, color = '#ffffff', stroke = 3) =>
  ({ fontFamily: 'G11', fontSize: size + 'px', color, stroke: '#0a0710', strokeThickness: stroke });
export const font9 = (size, color = '#d8d2e8') => ({ fontFamily: 'G9', fontSize: size + 'px', color });

export const COLOR = { panel: 0x15121f, panel2: 0x221c33, line: 0x5b4f7a, gold: 0xffd75e, red: 0xe8343a, green: 0x5fdc6a, blue: 0x6fd3ff };

export const fmt = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.floor(n));

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

// 화면 아래에서 떠오르는 알림 한 줄
export function toast(scene, msg, color = '#ffffff') {
  const t = scene.add.text(135, 380, msg, font(12, color)).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
  scene.tweens.add({ targets: t, alpha: 1, y: 360, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, alpha: 0, y: 340, delay: 1100, duration: 300, onComplete: () => t.destroy() });
}
