// FX2 전투 효과 그림(game/assets/fx2, docs/fx2.md): 보스 예고 바닥·착탄·약점·페이즈 테두리·말풍선·분노 오라·습격 깃발·강화 궤적
// 시트 이름은 'x_<파일명>'. 그림이 없으면(로드 실패) 호출하는 쪽이 예전 그래픽으로 돌아간다
import { W, H, GW } from './data.js';

// [프레임 너비, 높이, 프레임 수, 초당 프레임]
export const SHEETS = {
  warn_slam: [96, 96, 4, 8], warn_charge: [128, 40, 4, 8], warn_fan: [96, 96, 3, 8], warn_summon: [96, 96, 4, 8],
  impact_slam: [112, 112, 5, 20], impact_charge: [128, 40, 4, 16],
  weakpoint: [32, 32, 4, 10], weakpoint_break: [48, 48, 4, 18],
  rage_aura: [112, 112, 4, 8], trap_spikes: [80, 64, 4, 10],
  slash_plus5: [80, 80, 3, 24], slash_plus10: [96, 96, 4, 28], slash_plus15: [112, 112, 4, 28],
};
const IMAGES = ['phase_border', 'boss_bubble', 'raid_flag', 'merchant_tent'];

export function loadFx2(scene) {
  for (const [k, [w, h]] of Object.entries(SHEETS)) scene.load.spritesheet('x_' + k, `assets/fx2/${k}.png`, { frameWidth: w, frameHeight: h });
  for (const k of IMAGES) scene.load.image('x_' + k, `assets/fx2/${k}.png`);
}
export function makeFx2Anims(scene) {
  for (const [k, [, , n, fps]] of Object.entries(SHEETS)) {
    if (!scene.textures.exists('x_' + k) || scene.anims.exists('x_' + k)) continue;
    const loop = k === 'weakpoint' || k === 'rage_aura';
    scene.anims.create({ key: 'x_' + k, frames: scene.anims.generateFrameNumbers('x_' + k, { start: 0, end: n - 1 }), frameRate: fps, repeat: loop ? -1 : 0 });
  }
}
export const has = (s, k) => s.textures.exists('x_' + k);

// ── 예고 바닥: 시간(0~1)에 따라 안쪽이 바깥 테두리까지 차오른다. 다 차는 순간이 맞는 순간이다 ──
// 큰 게임 장판처럼: 옅은 바탕 + 또렷한 테두리 + 차오르는 안쪽 + 차오르는 끝선. 깜빡이지 않는다(예전 그림 4장 넘김은 싸 보였다)
// 그래픽 하나를 (x,y)에 두고 그 안에서 그린다 → setPosition·setRotation·destroy·active를 예전 스프라이트처럼 쓴다
const WC = { red: [0xff1a10, 0xff3b2a, 0xfff0e0], summon: [0x9a4dff, 0xb57aff, 0xf4e8ff] };
function warnG(s, x, y, kind, draw) {
  const [base, edge, hot] = WC[kind];
  const g = s.add.graphics({ x, y }).setDepth(9);
  g.step = f => {
    f = Math.max(0, Math.min(1, f));
    const end = f > 0.88 ? (f - 0.88) / 0.12 : 0;   // 마지막 12%: 테두리가 밝아져 '지금' 신호
    g.clear();
    draw(g, 1, 'base', { base, edge, hot, end });
    if (f > 0.01) draw(g, f, 'fill', { base, edge, hot, end });
  };
  g.step(0);
  return g;
}
// 원형(내려찍기)·소환 마법진: 납작한 타원(가로 r, 세로 0.75r)
export function warnDisc(s, x, y, r, summon = false) {
  return warnG(s, x, y, summon ? 'summon' : 'red', (g, k, part, c) => {
    const rx = r * k, ry = r * 0.75 * k;
    if (part === 'base') {
      g.fillStyle(c.base, 0.2).fillEllipse(0, 0, rx * 2, ry * 2);
      g.lineStyle(5, 0x000000, 0.3).strokeEllipse(0, 0, rx * 2 + 2, ry * 2 + 2);   // 어두운 밑선: 밝은 바닥에서도 테두리가 선다
      g.lineStyle(8, c.edge, 0.18 + 0.3 * c.end).strokeEllipse(0, 0, rx * 2 + 5, ry * 2 + 5);
      g.lineStyle(2.5, c.end ? c.hot : c.edge, 1).strokeEllipse(0, 0, rx * 2, ry * 2);
      if (summon) g.lineStyle(1, c.edge, 0.6).strokeEllipse(0, 0, rx * 1.3, ry * 1.3);
    } else {
      g.fillStyle(c.base, 0.3 + 0.22 * k).fillEllipse(0, 0, rx * 2, ry * 2);
      g.lineStyle(2, c.hot, 0.9).strokeEllipse(0, 0, rx * 2, ry * 2);
    }
  });
}
// 직선 띠(돌진·조준선): (x,y)에서 ang 방향으로 len, 폭 w. 안쪽은 시작점에서 끝까지 차오르고, 방향 화살표가 함께 나아간다
export function warnStrip(s, x, y, ang, len, w) {
  const g = warnG(s, x, y, 'red', (g, k, part, c) => {
    const h = w / 2;
    if (part === 'base') {
      g.fillStyle(c.base, 0.2).fillRect(0, -h, len, w);
      g.lineStyle(5, 0x000000, 0.3).strokeRect(-1, -h - 1, len + 2, w + 2);
      g.lineStyle(8, c.edge, 0.18 + 0.3 * c.end).strokeRect(-2.5, -h - 2.5, len + 5, w + 5);
      g.lineStyle(2.5, c.end ? c.hot : c.edge, 1).strokeRect(0, -h, len, w);
    } else {
      const L = len * k;
      g.fillStyle(c.base, 0.3 + 0.22 * k).fillRect(0, -h, L, w);
      g.lineStyle(2, c.hot, 0.9).lineBetween(L, -h, L, h);
      // 방향 화살표(>): 차오른 구간 안에서 끝 쪽으로 흐른다
      const a = Math.min(h * 0.8, 10), step = Math.max(24, a * 3);
      g.lineStyle(2.5, c.hot, 0.7);
      for (let d = (k * len * 0.6) % step; d < L - a; d += step) g.lineBetween(d, -a, d + a, 0).lineBetween(d + a, 0, d, a);
    }
  });
  return g.setRotation(ang);
}
// 부채꼴(약 ±45도): 꼭짓점이 (x,y), ang 방향으로 반지름 len. 안쪽 반지름이 바깥까지 차오른다
export function warnFan(s, x, y, ang, len) {
  const A = Math.PI / 4;
  const g = warnG(s, x, y, 'red', (g, k, part, c) => {
    const R = len * k;
    if (part === 'base') {
      g.fillStyle(c.base, 0.2).slice(0, 0, R, -A, A, false).fillPath();
      g.lineStyle(5, 0x000000, 0.3).slice(0, 0, R + 1, -A, A, false).strokePath();
      g.lineStyle(8, c.edge, 0.18 + 0.3 * c.end).beginPath().arc(0, 0, R + 3, -A, A, false).strokePath();
      g.lineStyle(2.5, c.end ? c.hot : c.edge, 1).slice(0, 0, R, -A, A, false).strokePath();
    } else {
      g.fillStyle(c.base, 0.3 + 0.22 * k).slice(0, 0, R, -A, A, false).fillPath();
      g.lineStyle(2, c.hot, 0.9).beginPath().arc(0, 0, R, -A, A, false).strokePath();
    }
  });
  return g.setRotation(ang);
}
// 시간에 맞춰 step을 돌려 주는 트윈. ms 뒤 onDone
export function runWarn(s, sp, ms, onDone) {
  const st = { f: 0 };
  s.tweens.add({ targets: st, f: 1, duration: ms, onUpdate: () => sp.active && sp.step(st.f), onComplete: () => { sp.destroy(); onDone && onDone(); } });
}

// ── 한 번 재생하고 사라지는 그림 ──
export function playOnce(s, key, x, y, { sx = 1, sy = sx, rot = 0, depth = 30, alpha = 1, origin } = {}) {
  if (!has(s, key)) return null;
  const sp = s.add.sprite(x, y, 'x_' + key, 0).setScale(sx, sy).setRotation(rot).setDepth(depth).setAlpha(alpha);
  if (origin) sp.setOrigin(origin[0], origin[1]);
  sp.play('x_' + key); sp.once('animationcomplete', () => sp.destroy());
  return sp;
}

// ── 페이즈 전환 화면 테두리(9슬라이스 12px, 중앙은 비어 있다) ──
export function phaseBorder(s, ms = 900, tint = 0xffd060) {
  if (!has(s, 'phase_border')) return null;
  const b = s.add.nineslice(0, 0, 'x_phase_border', undefined, GW, H, 12, 12, 12, 12).setOrigin(0).setScrollFactor(0).setDepth(62).setTint(tint).setAlpha(0); b.wideFx = true;
  s.tweens.add({ targets: b, alpha: 0.95, duration: 120, yoyo: true, hold: ms * 0.5, onComplete: () => b.destroy() });
  return b;
}
// 약점 구간 동안 켜 두는 옅은 테두리. 반환한 것을 destroy하면 꺼진다
export function weakBorder(s) {
  if (!has(s, 'phase_border')) return null;
  const b = s.add.nineslice(0, 0, 'x_phase_border', undefined, GW, H, 12, 12, 12, 12).setOrigin(0).setScrollFactor(0).setDepth(62).setTint(0xffc040).setAlpha(0.2); b.wideFx = true;
  s.tweens.add({ targets: b, alpha: 0.65, duration: 260, yoyo: true, repeat: -1 });
  return b;
}
// 말풍선 틀(9슬라이스 12/12/10/14, 왼쪽 아래 꼬리). 글자 폭에 맞춰 늘려 컨테이너로 돌려 준다
export function bubbleFrame(s, w, h) {
  if (!has(s, 'boss_bubble')) return null;
  return s.add.nineslice(0, 0, 'x_boss_bubble', undefined, w, h, 12, 12, 10, 14).setOrigin(0.5);
}

// 분노 오라: 보스 뒤에서 반복
export function rageAura(s, m) {
  if (!has(s, 'rage_aura')) return null;
  const a = s.add.sprite(m.x, m.y, 'x_rage_aura', 0).setDepth(8).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
  a.setScale(Math.max(1, m.displayWidth * 1.5 / 100)).play('x_rage_aura');
  const follow = () => { if (!m.active || !a.active) { s.events.off('update', follow); a.destroy(); return; } a.setPosition(m.x, m.y + m.displayHeight * 0.05); };
  s.events.on('update', follow);
  return a;
}

// 습격 깃발: 화면 가장자리(원점 기준 방향 ex, ey)에 꽂혀 깜빡인다
export function raidFlag(s, ex, ey, ms = 2600) {
  if (!has(s, 'raid_flag')) return null;
  const x = ex > 0.5 ? GW - 22 : ex < -0.5 ? 22 : GW / 2, y = ey > 0.5 ? H - 40 : ey < -0.5 ? 100 : H / 2;
  const f = s.add.image(x, y, 'x_raid_flag').setScrollFactor(0).setDepth(61).setScale(1.5); f.wideFx = true;
  s.tweens.add({ targets: f, y: y - 4, scale: 1.75, duration: 200, yoyo: true, repeat: Math.floor(ms / 400), onComplete: () => s.tweens.add({ targets: f, alpha: 0, duration: 300, onComplete: () => f.destroy() }) });
  return f;
}

// 휩쓸기 칼날: 지나온 자리에 옅어지는 잔상 부채꼴 + 빛나는 칼날(밑은 붉은 번짐, 가운데 흰 심). 판정은 boss.sweep이 따로 한다
export function sweepBlade(g, ox, oy, len, a0, a, dir) {
  g.clear();
  const tail = 0.55, from = dir > 0 ? Math.max(a0, a - tail) : Math.min(a0, a + tail), n = 6;
  for (let i = 0; i < n; i++) {
    const t0 = from + (a - from) * i / n, t1 = from + (a - from) * (i + 1) / n;
    g.fillStyle(0xff3a20, 0.05 + 0.3 * (i + 1) / n).slice(ox, oy, len, Math.min(t0, t1), Math.max(t0, t1), false).fillPath();
  }
  const ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len;
  g.lineStyle(16, 0xff2a10, 0.35).lineBetween(ox, oy, ex, ey);
  g.lineStyle(8, 0xff8a50, 0.8).lineBetween(ox, oy, ex, ey);
  g.lineStyle(3, 0xffffff, 1).lineBetween(ox, oy, ex, ey);
  g.fillStyle(0xffffff, 0.9).fillCircle(ex, ey, 4);
}
