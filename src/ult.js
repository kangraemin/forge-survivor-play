// 궁극기: 무기마다 다른 기술, 무기 등급(tier)마다 색·개수·층이 늘고, 한 판 안에서 쓸 때마다 단계(Lv1→3)가 오른다
//  - 피해: 기술이 맞힌 만큼 쌓고, 마지막에 화면 안 몹마다 단계 기준치(BUDGET)까지 채운다(예전 화면 전체 베기보다 약해지지 않는다)
//  - 그림(assets/ult/<무기>.png, 96x96 8칸)이 없으면 도형으로 그린다. 판정은 그림과 상관없다(s.bot이면 그림을 건너뛴다)
import * as D from './data.js';
import { sfx } from './sfx.js';
import { viewRect, toast } from './ui.js';
import { t } from './i18n.js';

export const ULT_W = ['sword', 'spear', 'axe', 'bow', 'gun', 'knuckle', 'staff'];
export const ULT_FW = 96;
export const ULT_MAX = 3;
const BUDGET = [0, 9, 11, 13];   // 단계별로 화면 안 몹 하나가 받는 최소 배수(보스는 절반)
// 등급별 색: 등급에 색이 있으면 그 색, 없으면 아래 표
const PAL = [0xfff4d0, 0xbfe8ff, 0x9effa0, 0xffa0ff, 0xffc070, 0xfff0a0, 0x80ffd0, 0xa0d8ff, 0x9a80ff, 0xffe070];
const BASE = { sword: 0xcfe8ff, spear: 0xfff2a0, axe: 0xffb070, bow: 0xb0ffb0, gun: 0xffa060, knuckle: 0xffe080, staff: 0xd0a0ff };

export function ultAnims(scene) {
  for (const w of ULT_W) {
    const key = 'ult_' + w;
    if (scene.textures.exists(key) && !scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 7 }), frameRate: 18, repeat: 0 });
  }
}
export const ultLv = s => Math.min(ULT_MAX, (s.run.ultLv || 0) + 1);   // 다음에 쓸 단계
const NAMES = { sword: () => t('ult.sword'), spear: () => t('ult.spear'), axe: () => t('ult.axe'), bow: () => t('ult.bow'), gun: () => t('ult.gun'), knuckle: () => t('ult.knuckle'), staff: () => t('ult.staff') };
export const ultName = (w, lv) => (NAMES[w] || NAMES.sword)() + ' Lv' + lv;

const half = c => (((c >> 16 & 255) + 255) >> 1) << 16 | (((c >> 8 & 255) + 255) >> 1) << 8 | ((c & 255) + 255) >> 1;   // 흰색과 반반
// 그림 하나(끝나면 사라짐). 그림이 없으면 퍼지는 고리
function fx(s, w, x, y, { sc = 1, rot = 0, tint, depth = 33 } = {}) {
  if (s.bot) return null;
  const key = 'ult_' + w;
  if (s.textures.exists(key) && !s.anims.exists(key)) ultAnims(s);   // 뒤에서 늦게 받은 그림
  if (s.textures.exists(key) && s.anims.exists(key)) {
    const sp = s.add.sprite(x, y, key, 0).setScale(sc).setRotation(rot).setDepth(depth).setBlendMode(w === 'gun' || w === 'axe' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);   // 연기·흙먼지는 더하면 하얗게 뜬다
    // 연기·흙먼지(일반 섞기)는 등급색을 반만 입힌다: 초록 등급에 독연기처럼 보였다
    if (tint != null) sp.setTint(sp.blendMode === Phaser.BlendModes.NORMAL ? half(tint) : tint);
    sp.play(key); sp.once('animationcomplete', () => sp.destroy());
    return sp;
  }
  const c = s.add.circle(x, y, 10 * sc, tint ?? 0xffffff, 0.5).setStrokeStyle(3, tint ?? 0xffffff).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  s.tweens.add({ targets: c, scale: 3, alpha: 0, duration: 380, onComplete: () => c.destroy() });
  return c;
}
// 날아가는 그림(검기·유성 등): from → to, ms 동안
function fly(s, w, x0, y0, x1, y1, ms, { sc = 1, tint } = {}) {
  if (s.bot) return;
  const sp = fx(s, w, x0, y0, { sc, rot: Math.atan2(y1 - y0, x1 - x0), tint });
  if (sp) s.tweens.add({ targets: sp, x: x1, y: y1, duration: ms });
}

export function castUlt(s) {
  const r = s.run, lv = ultLv(s);
  r.ultLv = lv;
  const w = s.wtype.id, tier = Math.max(0, Math.min(9, s.sv.tier | 0));
  const tint = D.TIERS[tier]?.tint ?? PAL[tier] ?? BASE[w];
  const cam = viewRect(s), hx = s.hero.x, hy = s.hero.y;
  const got = new Map();   // 몹 → 지금까지 맞은 배수
  const inView = () => s.mobs.getChildren().filter(m => m.active && !m.dead && Phaser.Geom.Rectangle.Contains(cam, m.x, m.y));
  const hit = (m, k, kb = 140) => {
    if (!m.active || m.dead) return;
    got.set(m, (got.get(m) || 0) + k);
    s.hitMob(m, m.isBoss ? k / 2 : k, { src: 'ult', kb, fx: 'big' });
  };
  const area = (x, y, rad, k, kb) => inView().forEach(m => { if ((m.x - x) ** 2 + (m.y - y) ** 2 < rad * rad) hit(m, k, kb); });
  const later = (ms, f) => s.time.delayedCall(ms, () => { if (!s.over) f(); });
  // 몹이 가장 많이 모인 곳 n곳(겹치지 않게)
  const dense = (n, rad) => {
    const ms = inView(), out = [];
    for (let i = 0; i < n; i++) {
      let best = null, bc = -1;
      for (const m of ms) {
        if (out.some(p => (p.x - m.x) ** 2 + (p.y - m.y) ** 2 < rad * rad)) continue;
        const c = ms.reduce((a, o) => a + ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 < rad * rad ? 1 : 0), 0);
        if (c > bc) { bc = c; best = m; }
      }
      out.push(best ? { x: best.x, y: best.y } : { x: cam.x + Math.random() * cam.width, y: cam.y + Math.random() * cam.height });
    }
    return out;
  };
  const pick = () => { const ms = inView(); return ms.length ? ms[(Math.random() * ms.length) | 0] : null; };

  // 무기별 기술. k = 피해 배수(메아리는 절반), n0 = 등급으로 늘어난 개수
  const n0 = tier;
  const TECH = {
    // 칼: 주인공 둘레로 검기가 사방으로 퍼진다
    sword(k, t0) {
      const n = Math.min(16, 6 + n0), a0 = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI * 2 / n, ex = hx + Math.cos(a) * 300, ey = hy + Math.sin(a) * 300;
        later(t0, () => fly(s, 'sword', hx, hy, ex, ey, 420, { sc: 0.9, tint }));
        inView().forEach(m => {
          const d = Math.hypot(m.x - hx, m.y - hy), da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(m.y - hy, m.x - hx) - a));
          if (da < Math.PI / n + 0.05 && d < 320) later(t0 + d * 1.4, () => hit(m, k * 3, 220));
        });
      }
    },
    // 창: 빛의 창이 하늘에서 몹 위로 꽂힌다
    spear(k, t0) {
      const n = 8 + n0;
      for (let i = 0; i < n; i++) later(t0 + i * 70, () => {
        const m = pick(), x = m ? m.x : hx + (Math.random() - 0.5) * 200, y = m ? m.y : hy + (Math.random() - 0.5) * 300;
        fx(s, 'spear', x, y - 34, { sc: 0.9, tint });   // 그림은 칸 아래쪽이 땅이다
        later(120, () => area(x, y, 38, k * 2.5, 120));
      });
    },
    // 도끼: 땅을 내리찍어 충격파 고리가 세 번 퍼진다
    axe(k, t0) {
      const rings = n0 >= 6 ? 4 : 3;
      for (let i = 0; i < rings; i++) later(t0 + i * 230, () => {
        const rad = 100 + i * 85;
        fx(s, 'axe', hx, hy, { sc: rad / 40, tint });
        inView().forEach(m => { const d = Math.hypot(m.x - hx, m.y - hy); if (d < rad && d >= rad - 110) hit(m, k * 2.2, 300); });
        if (i === 0) s.cameras.main.shake(260, 0.01);
      });
    },
    // 활: 화살비가 화면 곳곳의 몹에게 쏟아진다
    bow(k, t0) {
      const n = 14 + 2 * n0;
      for (let i = 0; i < n; i++) later(t0 + i * 45, () => {
        const m = pick(); if (!m) return;
        const x = m.x, y = m.y;
        fx(s, 'bow', x, y - 18, { sc: 0.6, tint });   // 그림 안에서 화살이 떨어져 꽂힌다
        later(140, () => area(x, y, 24, k * 1.3, 80));
      });
    },
    // 총: 몹이 모인 곳에 포탄이 떨어져 터진다
    gun(k, t0) {
      const pts = dense(4 + (n0 >> 1), 70);
      pts.forEach((p, i) => later(t0 + i * 160, () => {
        fx(s, 'gun', p.x, p.y, { sc: 1.3, tint });
        area(p.x, p.y, 66, k * 3.2, 260);
        if (i === 0) s.cameras.main.shake(200, 0.008);
      }));
    },
    // 너클: 가까운 몹부터 연타하고 마지막에 큰 충격
    knuckle(k, t0) {
      const n = 8 + n0;
      const ms = inView().sort((a, b) => Math.hypot(a.x - hx, a.y - hy) - Math.hypot(b.x - hx, b.y - hy)).slice(0, n);
      ms.forEach((m, i) => later(t0 + i * 55, () => { fx(s, 'knuckle', m.x, m.y, { sc: 0.7, tint }); hit(m, k * 2, 160); }));
      later(t0 + ms.length * 55 + 80, () => { fx(s, 'knuckle', hx, hy, { sc: 2, tint }); area(hx, hy, 150, k * 1.8, 320); });
    },
    // 지팡이: 몹이 가장 많은 곳에 유성이 떨어진다
    staff(k, t0) {
      const pts = dense(3 + Math.floor(n0 / 3), 90);
      pts.forEach((p, i) => later(t0 + i * 220, () => {
        fx(s, 'staff', p.x, p.y - 48, { sc: 1.5, tint });   // 그림 안에서 유성이 떨어져 터진다(칸 아래쪽이 땅)
        later(130, () => area(p.x, p.y, 84, k * 4, 280));
      }));
    },
  };
  const tech = TECH[w] || TECH.sword;

  // 시작: 소리·번쩍·주인공 둘레 고리, 적 탄 지우기, 2초 무적
  sfx('ult');
  s.iframe = Math.max(s.iframe || 0, s.bt + 2200);   // 이미 걸린 무적을 줄이지 않는다
  s.hitstop = 100;
  s.ebullets.clear(true, true);
  if (!s.bot) {
    s.flashFx.setAlpha(0.55); s.tweens.add({ targets: s.flashFx, alpha: 0, duration: 380 });
    const ring = s.add.sprite(hx, hy, 'fx2_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(32).setTint(tint).play('fxSpin');
    s.tweens.add({ targets: ring, scale: 3.4, duration: 480, ease: 'Quad.Out' });
    ring.once('animationcomplete', () => ring.destroy());
    toast(s, ultName(w, lv), '#ffd75e', 120);
  }
  tech(1, 0);
  // 등급 층: 3등급부터 같은 기술이 한 번 더(작게), 6등급부터 주인공 둘레 충격, 9등급은 황금 십자
  if (tier >= 3) tech(0.5, 380);
  if (tier >= 6) later(200, () => { fx(s, 'axe', hx, hy, { sc: 3, tint }); area(hx, hy, 130, 1.5, 240); });
  if (tier >= 9) later(520, () => {
    if (!s.bot) for (let i = 0; i < 4; i++) fly(s, 'sword', hx, hy, hx + Math.cos(i * Math.PI / 2) * 260, hy + Math.sin(i * Math.PI / 2) * 260, 360, { sc: 1.2, tint: 0xffe070 });
    inView().forEach(m => hit(m, 1.5, 200));
  });
  // 단계: Lv2부터 메아리(같은 기술 절반), Lv3은 마지막에 얼리고 황금 폭발
  const echoAt = 850;
  if (lv >= 2) later(echoAt, () => tech(0.5, 0));
  const endAt = lv >= 2 ? echoAt + 900 : 900;
  later(endAt, () => {
    if (lv >= 3) {
      if (!s.bot) { s.flashFx.setAlpha(0.45); s.tweens.add({ targets: s.flashFx, alpha: 0, duration: 420 }); fx(s, 'axe', hx, hy, { sc: 5, tint: 0xffe070 }); }
      inView().forEach(m => {
        if (m.isBoss) return;
        m.freeze = 1500; m.setTint(0x9ae8ff);
        s.time.delayedCall(1500, () => m.active && !m.dead && m.setTint(m.baseTint));
      });
      s.cameras.main.shake(240, 0.01);
    }
    // 마무리: 화면 안 몹마다 단계 기준치까지 채운다
    const bud = BUDGET[lv] + (tier >= 9 ? 2 : 0);
    inView().forEach(m => { const rem = bud - (got.get(m) || 0); if (rem > 0.3) hit(m, rem, 200); });
  });
}
