// 모드 3~15장 규칙(지키기·점령·사냥). 판 데이터는 modeStages.js, 돌파는 modeBreach.js
// 규칙 함수는 (run) → 훅 묶음을 돌려준다. modes.js는 run.tw?.훅()만 부른다.
//   공통: setup() · update(dt) · steer(m,dt)→true면 기본 이동 생략 · hud(g)
//   지키기: cartMul(near) · itemDmgMul(m) · onItemHit(m)       점령: zoneRate(p,i,inside,rate)
//   사냥: preyInit(m,i) · prey(m,dt)→true면 기본 도망 생략 · preySpd(m) · preyPost(m,dt) · arrowOk(m)
import { font } from './ui.js';
import { sfx } from './sfx.js';
import { makeBreachRule } from './modeBreach.js';
import { t } from './i18n.js';

const WORLD = 1600, MX = WORLD / 2;
const R = (a, b) => Phaser.Math.Between(a, b), RF = (a, b) => Phaser.Math.FloatBetween(a, b);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy || 1, t = clamp(((px - ax) * vx + (py - ay) * vy) / l, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
};
const segCross = (ax, ay, bx, by, cx, cy, dx, dy) => {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};
const beamEnd = p => ({ x: p.x + Math.cos(p.a) * p.len, y: p.y - 8 + Math.sin(p.a) * p.len });
export const addPillar = (env, x, y, w, len, mirror) => {
  const s = env.s, p = { x, y, a: RF(0, 6.28), w, len, mirror };
  p.img = s.add.ellipse(x, y, 14, 8, mirror ? 0x80ffe0 : 0xc080ff).setStrokeStyle(2, 0xffffff, 0.9).setDepth(10 + y / WORLD).setOrigin(0.5, 1);
  env.pillars.push(p); return p;
};
export const clearPillars = env => { env.pillars.forEach(p => p.img?.destroy()); env.pillars.length = 0; };
const beamNear = (env, x, y, d) => env.pillars.some(p => { const e = beamEnd(p); return segDist(x, y, p.x, p.y - 8, e.x, e.y) < d; });
const flash = (s, x, y, col, txt) => {
  const o = s.add.circle(x, y, 8, col, 0.5).setStrokeStyle(2, col).setDepth(41);
  s.tweens.add({ targets: o, scale: 5, alpha: 0, duration: 380, onComplete: () => o.destroy() });
  if (txt) { const t = s.add.text(x, y - 18, txt, font(10, '#ffffff', 3)).setOrigin(0.5).setDepth(42); s.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() }); }
};
const bolt = (s, a, b, col = 0xffd75e) => {
  const l = s.add.line(0, 0, a.x, a.y, b.x, b.y, col, 0.9).setOrigin(0).setLineWidth(2).setDepth(40);
  s.tweens.add({ targets: l, alpha: 0, duration: 260, onComplete: () => l.destroy() });
};
// 화면 안에 한 줄 안내(경고·상태)
const callout = (r, y = 112) => { const t = r.mkTxt(0, 0, '', font(10, '#ffffff', 3)); t.setOrigin(0.5).setPosition(195, y).setAlpha(0); return (str, col = '#ffffff') => { t.setText(str).setColor(col).setAlpha(str ? 1 : 0); }; };

// ═══ 지키기 공통: 물건 이름표·빛·위치 고리 ═══
function guardBase(r, name, glow) {
  const s = r.s, it = r.item;
  it.glow.setTint(glow).setAlpha(0.32).setScale(1.2);
  const lb = s.add.text(it.x, it.y + 42, name, font(9, '#ffffff', 3)).setOrigin(0.5).setDepth(41);
  const ring = s.add.graphics().setDepth(5);
  return {
    lb, ring,
    sync() {
      lb.setPosition(it.x, it.y + 42);
      ring.clear().lineStyle(2, glow, 0.8).strokeEllipse(it.x, it.y + 12, 54 + Math.sin(s.bt / 220) * 4, 24);
    },
    mv(dy) {   // 수레를 앞뒤로 옮긴다(dy>0이 뒤로)
      it.y = clamp(it.y + dy, r.endY ?? -1e9, it.startY); it.sp.y = it.y; it.sh.y = it.y + 12; it.glow.y = it.y;
      it.prog = (it.startY - it.y) / r.cfg.route; it.sp.setDepth(35 + it.y / WORLD * 0.9);
    },
  };
}
// 멀리서 쏘는 습격 몹
function shooter(r, m, dt, range = 120, gap = 2100) {
  const it = r.item, s = r.s;
  if (!(m.raider && it?.hp > 0 && r.cfg.shooters?.includes(m.kind))) return false;
  if (dist(m, s.hero) < 46) return false;
  const d = dist(m, it);
  if (d > range) { m.setVelocity((it.x - m.x) / d * m.spd, (it.y - m.y) / d * m.spd); return true; }
  m.setVelocity(0, 0); m.atkT = (m.atkT ?? 700) - dt;
  if (m.atkT <= 0) { m.atkT = gap; bolt(s, m, it, 0xff8a6a); r.hitItem(m); }
  return true;
}
const dashRing = (g, x, y, rx, ry, col, a = 0.6) => { g.lineStyle(2, col, a).strokeEllipse(x, y, rx * 2, ry * 2); };

const GUARD = {
  // 3장: 달아오른 용암 바닥에서는 광차가 서고, 밟으면 식는다
  lavaCart(r, c) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.5b6728'), 0xff7a30), g = s.add.graphics().setDepth(4);
    const ps = [0.18, 0.38, 0.58, 0.78].map((f, i) => ({ x: MX, y: it.startY - c.route * f, rx: 40, ry: 28, off: i * 1900, cool: 0 }));
    const hot = p => p.cool <= 0 && (s.bt + p.off) % 6400 < 3600;
    let burn = 0;
    return {
      update(dt) {
        b.sync(); g.clear(); burn -= dt;
        const h = s.hero;
        for (const p of ps) {
          p.cool = Math.max(0, p.cool - dt);
          const on = Math.abs(h.x - p.x) < p.rx && Math.abs(h.y - p.y) < p.ry;
          if (on && hot(p) && Math.abs(it.y - p.y) < 130) { p.cool = 2600; sfx('level', 200); flash(s, p.x, p.y, 0x7fd0ff, t('modeRules.f45d11')); }
          const ph = (s.bt + p.off) % 6400, warn = p.cool <= 0 && ph > 5800;
          const hh = hot(p);
          g.fillStyle(hh ? 0xff5a1a : warn ? 0xffc23a : 0x4a5568, hh ? 0.6 + 0.15 * Math.sin(s.bt / 90) : 0.5).fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
          g.lineStyle(2, hh ? 0xffd070 : 0x9ab0c8, 0.8).strokeEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
          if (on && hh && burn <= 0) { burn = 700; s.hurt(s.maxHp * 0.04, 'lava'); }
        }
      },
      cartMul(near) { const stop = ps.some(p => hot(p) && Math.abs(it.y - p.y) < p.ry + 6); return stop ? 0 : near ? 1 : 0; },
      steer: (m, dt) => shooter(r, m, dt),
    };
  },
  // 4장: 서리 지대에서 썰매가 혼자 미끄러지고, 늑대에게 물리면 밀려난다
  iceSled(r, c) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.7157d3'), 0x9fe0ff), g = s.add.graphics().setDepth(4);
    const zs = [0.2, 0.48, 0.74].map(f => ({ y: it.startY - c.route * f, h: 70 }));
    const inF = () => zs.some(z => Math.abs(it.y - z.y) < z.h);
    return {
      update() {
        b.sync(); g.clear();
        for (const z of zs) {
          g.fillStyle(0x9fe0ff, 0.2).fillRect(MX - 64, z.y - z.h, 128, z.h * 2).lineStyle(1.5, 0xe8f8ff, 0.7).strokeRect(MX - 64, z.y - z.h, 128, z.h * 2);
          for (let k = 0; k < 5; k++) { const yy = z.y - z.h + ((s.bt / 14 + k * 30) % (z.h * 2)); g.lineStyle(1, 0xffffff, 0.5).lineBetween(MX - 40 + k * 20, yy, MX - 34 + k * 20, yy - 8); }
        }
      },
      cartMul(near) { return inF() ? 2.3 : near ? 1 : 0; },
      onItemHit(m) { if (m.kind === 'wolf') { b.mv(32); flash(s, it.x, it.y, 0xffffff, t('modeRules.16f098')); } },
    };
  },
  // 5장: 사교도는 멀리서 쏜다
  sigil(r) {
    const s = r.s, b = guardBase(r, t('modeRules.4af924'), 0xb070ff), g = s.add.graphics().setDepth(4);
    return {
      update() { b.sync(); g.clear(); const it = r.item; for (let k = 0; k < 6; k++) { const a = s.bt / 900 + k * 1.047; g.fillStyle(0xd0a0ff, 0.7).fillCircle(it.x + Math.cos(a) * 34, it.y + 12 + Math.sin(a) * 15, 2.5); } },
      steer: (m, dt) => shooter(r, m, dt, 125, 1900),
    };
  },
  // 6장: 길 위 물웅덩이에서 수레가 느려진다
  tideCart(r, c) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.8d115b'), 0x5ae0d0), env = s.env;
    env.puddles.length = 0;
    [0.15, 0.3, 0.45, 0.62, 0.78].forEach((f, i) => env.addPuddle(MX + (i % 2 ? 16 : -16), it.startY - c.route * f, 34, Infinity));
    const inP = () => env.puddles.some(p => Math.abs(it.x - p.x) < p.r * 0.9 && Math.abs(it.y - p.y) < p.r * 0.75);
    return { update() { b.sync(); }, cartMul(near) { return near ? (inP() ? 0.35 : 1) : 0; } };
  },
  // 7장: 늪 물살이 단지를 흘려 보낸다
  herbJar(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.c589da'), 0x9aff5a), env = s.env, home = it.x, g = s.add.graphics().setDepth(4);
    env.streams = [{ ax: 'x', pos: it.y + 8, w: 120, dir: 1 }];
    return {
      update(dt) {
        const sec = dt / 1000, anch = dist(s.hero, it) < 55;
        it.x = clamp(it.x + (anch ? clamp(home - it.x, -1, 1) * 36 : 24) * sec, home - 40, home + 300);
        it.glow.x = it.x; it.sh.x = it.x;
        const lost = it.x - home > 220;
        if (lost) r.damageItem(it.max * 0.09 * sec, t('modeRules.7b8b98'));
        b.sync(); g.clear();
        g.lineStyle(2, 0xff6060, 0.5);
        for (let yy = it.y - 50; yy < it.y + 70; yy += 12) g.lineBetween(home + 220, yy, home + 220, yy + 6);
        g.fillStyle(0x9aff5a, 0.25).fillRect(home - 40, it.y - 4, 20, 8);
        if (it.x - home > 90) { g.lineStyle(2, 0xffd75e, 0.9).strokeCircle(it.x, it.y, 30 + Math.sin(s.bt / 90) * 3); }
      },
    };
  },
  // 8장: 레이저가 핵을 스치고, 기둥 곁에 서면 그 기둥이 멈춘다
  crystalCore(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.962e2f'), 0xc080ff), env = s.env;
    clearPillars(env);
    const ps = [0, 1, 2].map(i => { const a = 0.5 + i * Math.PI * 2 / 3; const p = addPillar(env, it.x + Math.cos(a) * 105, it.y + Math.sin(a) * 105, (i % 2 ? -1 : 1) * 0.56, 175, false); p.w0 = p.w; p.hitI = 0; return p; });
    return {
      update(dt) {
        b.sync();
        for (const p of ps) {
          const held = dist(s.hero, { x: p.x, y: p.y }) < 30;
          p.w = held ? 0 : p.w0;
          if (held && !p.heldFx) { p.heldFx = true; sfx('click'); }
          if (!held) p.heldFx = false;
          p.hitI -= dt;
          const e = beamEnd(p);
          if (p.hitI <= 0 && segDist(it.x, it.y, p.x, p.y - 8, e.x, e.y) < 18) { p.hitI = 800; r.damageItem(it.max * 0.045); flash(s, it.x, it.y, 0xc080ff); }
        }
      },
      steer: (m, dt) => shooter(r, m, dt, 115, 2300),
    };
  },
  // 9장: 바람이 수레를 민다
  sailCart(r, c) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.e17051'), 0xe8f4ff), env = s.env, g = s.add.graphics().setDepth(11);
    const wy = () => { const w = env.wind; return w ? Math.sin(w.a) * w.k : 0; }, wx = () => { const w = env.wind; return w ? Math.cos(w.a) * w.k : 0; };
    return {
      update(dt) {
        const sec = dt / 1000;
        b.sync(); g.clear();
        const near = dist(s.hero, it) < 80;
        if (wy() > 0.3 && !near) b.mv(wy() * 13 * sec);
        it.x = clamp(it.x + (wx() * 30 + (MX - it.x) * (Math.abs(wx()) < 0.2 ? 0.6 : 0)) * sec, MX - 90, MX + 90);
        it.glow.x = it.x; it.sh.x = it.x;
        const f = clamp(-wy(), -1, 1);
        g.fillStyle(0xffffff, 0.85).fillTriangle(it.x, it.y - 30, it.x, it.y - 8, it.x + 14 * (f >= 0 ? 1 : -1) * (0.4 + Math.abs(f)), it.y - 10);
        if (Math.abs(f) > 0.3) g.lineStyle(2, f > 0 ? 0x7dffa0 : 0xff8a70, 0.9).lineBetween(it.x - 20, it.y - 52, it.x - 20, it.y - 52 - f * 14);
      },
      cartMul(near) { const k = clamp(1 + wy() * 0.8, 0.15, 1); return near ? (wy() < -0.3 ? 1 - wy() * 0.9 : k) : (wy() < -0.3 ? -wy() * 0.7 : 0); },
    };
  },
  // 10장: 등불 기름. 통의 기름을 날라 채운다
  lantern(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.9bd51e'), 0xffd070), g = s.add.graphics().setDepth(6);
    let oil = 100, carry = false;
    const barrels = [{ x: it.x - 190, y: it.y + 40, cd: 0 }, { x: it.x + 190, y: it.y - 30, cd: 0 }];
    const say = callout(r, 124);
    let nameLb = null;
    return {
      update(dt) {
        const sec = dt / 1000, h = s.hero;
        oil = Math.max(0, oil - 2.1 * sec);
        for (const q of barrels) {
          q.cd = Math.max(0, q.cd - dt);
          if (!carry && q.cd <= 0 && dist(h, q) < 30) { carry = true; q.cd = 7000; sfx('level', 150); flash(s, q.x, q.y, 0xc08040, t('modeRules.4584a2')); }
        }
        if (carry && dist(h, it) < 55) { carry = false; oil = Math.min(100, oil + 55); sfx('level'); flash(s, it.x, it.y - 10, 0xffd070, t('modeRules.ffcdfc')); }
        const f = oil / 100;
        it.glow.setScale(0.5 + 1.7 * f).setAlpha(0.15 + 0.3 * f);
        b.sync(); g.clear();
        for (const q of barrels) { g.fillStyle(q.cd > 0 ? 0x4a3a2a : 0xa06a30, 1).fillRect(q.x - 7, q.y - 12, 14, 16).lineStyle(1.5, 0xffd070, q.cd > 0 ? 0.2 : 0.9).strokeRect(q.x - 7, q.y - 12, 14, 16); }
        if (carry) g.fillStyle(0xa06a30, 1).fillRect(h.x - 5, h.y - 40, 10, 11).lineStyle(1, 0xffd070).strokeRect(h.x - 5, h.y - 40, 10, 11);
        g.fillStyle(0x000000, 0.7).fillRect(it.x - 22, it.y - 52, 44, 5).fillStyle(f > 0.3 ? 0xffc23a : 0xe23a44, 1).fillRect(it.x - 21, it.y - 51, 42 * f, 3);
        say(oil <= 0 ? t('modeRules.616e01') : carry ? t('modeRules.414fad') : f < 0.3 ? t('modeRules.d2dd65') : '');
      },
      itemDmgMul() { return oil <= 0 ? 2.4 : oil < 30 ? 1.7 : 1; },
      steer(m) {   // 불빛 안의 적만 또렷이 보인다
        if (m.dead || m.isBoss) return false;
        const lit = oil > 0 && dist(m, it) < 60 + 120 * (oil / 100);
        if (lit) m.setAlpha(1);
        else if (oil <= 0 && dist(m, s.hero) > 60) m.setAlpha(0.12);
        return false;
      },
    };
  },
  // 11장: 유사 구덩이가 수레를 끌어당긴다
  caravan(r, c) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.fa5a29'), 0xe0c080), env = s.env;
    env.pits.length = 0;
    [0.2, 0.42, 0.62, 0.82].forEach((f, i) => env.addPit(MX + (i % 2 ? 52 : -52), it.startY - c.route * f, 34, Infinity));
    let stuck = false;
    return {
      update(dt) {
        const sec = dt / 1000, near = dist(s.hero, it) < 45;
        let pulled = false;
        for (const p of env.pits) {
          const d = dist(it, p);
          if (d < 60) { pulled = true; it.x += (p.x - it.x) / (d || 1) * (near ? 8 : 30) * sec; }
        }
        if (!pulled) it.x += (MX - it.x) * Math.min(1, 1.2 * sec);
        stuck = env.pits.some(p => dist(it, p) < 16);
        if (stuck && near) it.x += (MX - it.x) * Math.min(1, 3 * sec);
        it.glow.x = it.x; it.sh.x = it.x; b.sync();
        if (stuck && !near) { flash(s, it.x, it.y, 0xe0c080); }
      },
      cartMul(nearHero) { const sl = env.pits.some(p => dist(it, p) < 60); return nearHero ? (stuck ? 0.15 : sl ? 0.4 : 1) : 0; },
    };
  },
  // 12장: 압력이 오르면 터진다. 밸브를 열어 식힌다
  boiler(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.95d4cb'), 0xff9a50), env = s.env, g = s.add.graphics().setDepth(6);
    let heat = 20, hold = 0, valve = env.vents[0];
    if (valve) { valve.x = it.x + 90; valve.y = it.y + 14; valve.t = 2500; valve.ph = 'idle'; }
    const say = callout(r, 124);
    return {
      update(dt) {
        const sec = dt / 1000;
        heat += 2.0 * sec;
        if (valve && valve.ph === 'idle' && dist(s.hero, valve) < 30) { hold += dt; if (hold >= 1000) { hold = 0; heat = Math.max(0, heat - 45); valve.ph = 'warn'; valve.t = 1100; sfx('warn', 200); flash(s, valve.x, valve.y, 0xffffff, t('modeRules.254c1d')); } } else hold = 0;
        if (heat >= 100) { heat = 40; r.damageItem(it.max * 0.2, t('modeRules.4de524')); sfx('boom'); s.cameras.main.shake(160, 0.006); flash(s, it.x, it.y, 0xff6a20, t('modeRules.d258dc')); s.mobs.getChildren().forEach(m => { if (m.active && !m.dead && dist(m, it) < 100) s.hitMob(m, 3, { src: 'boil', kb: 160, fx: 'big', from: it }); }); }
        b.sync(); g.clear();
        const f = heat / 100;
        g.fillStyle(0x000000, 0.7).fillRect(it.x - 24, it.y - 52, 48, 6).fillStyle(f > 0.7 ? 0xff3020 : f > 0.4 ? 0xffa030 : 0x6fd3ff, 1).fillRect(it.x - 23, it.y - 51, 46 * f, 4);
        if (valve) { g.lineStyle(2, 0xffffff, 0.8).strokeCircle(valve.x, valve.y, 30); if (hold > 0) g.lineStyle(3, 0xffd75e, 1).beginPath().arc(valve.x, valve.y, 30, -1.57, -1.57 + 6.28 * hold / 1000).strokePath(); }
        say(f > 0.78 ? t('modeRules.7cd44d') : '');
      },
    };
  },
  // 13장: 낙뢰가 몹과 제단을 같이 때린다
  lightningAltar(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.e78497'), 0xc8d8f0), env = s.env;
    env.rods.length = 0;
    const near = { x: it.x + 38, y: it.y + 16, hot: 0 }; env.rods.push(near);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.7; env.rods.push({ x: it.x + Math.cos(a) * 380, y: it.y + Math.sin(a) * 380, hot: 0 }); }
    let prev = 0;
    return {
      update() {
        b.sync();
        if (prev > 300 && near.hot <= 300) { r.damageItem(it.max * 0.13, t('modeRules.a82d40')); flash(s, it.x, it.y, 0xc8d8f0, t('boss.7e82c9')); s.mobs.getChildren().forEach(m => { if (m.active && !m.dead && dist(m, it) < 90) s.hitMob(m, 6, { src: 'rod', kb: 140, fx: 'big', from: it }); }); }
        prev = near.hot;
      },
    };
  },
  // 14장: 빛줄기가 수정상에 닿으면 피해, 곁에 서면 덜 아프고 되받아 튕긴다
  statue(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.acc5a9'), 0x80ffe0), env = s.env;
    clearPillars(env);
    [-1, 1].forEach((d, i) => { const p = addPillar(env, it.x + d * 125, it.y + 10, i ? -0.55 : 0.55, 185, true); p.hitI = 0; });
    return {
      update(dt) {
        b.sync();
        for (const p of env.pillars) {
          p.hitI -= dt; const e = beamEnd(p);
          if (p.hitI <= 0 && segDist(it.x, it.y, p.x, p.y - 8, e.x, e.y) < 18) {
            p.hitI = 800; const guard = dist(s.hero, it) < 40;
            r.damageItem(it.max * (guard ? 0.012 : 0.04));
            flash(s, it.x, it.y, 0x80ffe0, t('boss.2c22c2')); sfx('crit', 120);
            s.mobs.getChildren().forEach(m => { if (m.active && !m.dead && dist(m, it) < 120) s.hitMob(m, 5, { src: 'reflect', kb: 200, fx: 'big', from: it }); });
          }
        }
      },
    };
  },
  // 15장: 모루 곁에 2초 서면 화염 보호막
  anvilGuard(r) {
    const s = r.s, it = r.item, b = guardBase(r, t('modeRules.42878c'), 0xff9a30), env = s.env, g = s.add.graphics().setDepth(12);
    env.anvils.length = 0; env.anvils.push({ x: it.x, y: it.y + 16, cd: 0 }, { x: it.x + 330, y: it.y + 120, cd: 0 }, { x: it.x - 300, y: it.y - 140, cd: 0 });
    let shield = 0, prevF = 0;
    return {
      update(dt) {
        b.sync(); g.clear();
        shield = Math.max(0, shield - dt);
        if (env.forged > 0 && prevF <= 0 && dist(s.hero, it) < 60) { shield = 5000; sfx('level'); flash(s, it.x, it.y, 0xff9a30, t('modeRules.4650e5')); }
        prevF = env.forged;
        if (shield > 0) { g.lineStyle(3, 0xff9a30, 0.5 + 0.4 * Math.sin(s.bt / 80)).strokeCircle(it.x, it.y, 34).fillStyle(0xff7a20, 0.18).fillCircle(it.x, it.y, 34); }
        const h = env.heat; if (h > 2 && shield <= 0) { g.lineStyle(3, 0xffd75e, 0.9).beginPath().arc(it.x, it.y - 58, 10, -1.57, -1.57 + 6.28 * h / 100).strokePath(); }
      },
      itemDmgMul() { return shield > 0 ? 0 : 1; },
    };
  },
};

// ═══ 점령 ═══
const tintZones = (r, col) => r.pts.forEach(p => { p.sp.setTint(col); p.glow.setTint(col); });
const zoneHurt = (r, p, dt, key, frac, gap = 700) => { p[key] = (p[key] ?? 0) - dt; if (p[key] <= 0) { p[key] = gap; r.s.hurt(r.s.maxHp * frac, 'zone'); } };
const CAPTURE = {
  // 3장: 석대가 달아올랐다 식는다
  lavaPads(r) {
    const s = r.s, g = s.add.graphics().setDepth(5);
    tintZones(r, 0xff9a5a);
    const hot = (p, i) => !p.done && (s.bt + i * 2700) % 8200 < 3200;
    return {
      setup() {},
      update(dt) {
        g.clear();
        r.pts.forEach((p, i) => {
          if (p.done) return;
          const ph = (s.bt + i * 2700) % 8200, h = hot(p, i), warn = !h && ph > 7400;
          p.hot = h;
          g.fillStyle(h ? 0xff4a10 : warn ? 0xffc23a : 0x4a5568, h ? 0.5 + 0.15 * Math.sin(s.bt / 90) : 0.3).fillCircle(p.x, p.y, r.cfg.r);
          if (h && p.inside) zoneHurt(r, p, dt, 'bt', 0.035);
        });
      },
      zoneRate: (p, i, inside, rate) => hot(p, i) ? 0 : rate,
    };
  },
  // 4장: 눈보라. 점령한 불씨 곁은 따뜻하다
  blizzard(r) {
    const s = r.s, g = s.add.graphics().setScrollFactor(0).setDepth(60), say = callout(r, 124), gs = s.add.graphics().setDepth(5);
    tintZones(r, 0xbfe8ff);
    const storm = () => (s.bt + 4500) % 13000 > 9000;
    const sheltered = p => r.pts.some(q => q.done && dist(p, q) < 170);
    return {
      update() {
        g.clear(); gs.clear();
        const st = storm(), warn = !st && (s.bt + 4500) % 13000 > 7600;
        if (st) { for (let i = 0; i < 40; i++) { const x = ((i * 53 + s.bt * 0.35) % 420) - 15, y = ((i * 91 + s.bt * 0.5) % 860) - 8; g.lineStyle(1.5, 0xffffff, 0.6).lineBetween(x, y, x - 10, y + 7); } g.fillStyle(0xdff0ff, 0.12).fillRect(0, 0, 390, 844); }
        r.pts.forEach(p => { if (p.done) gs.lineStyle(2, 0xffb070, 0.4).strokeCircle(p.x, p.y, 170); });
        say(st ? t('modeRules.c4b43f') : warn ? t('modeRules.704920') : '', st ? '#bfe8ff' : '#ffd75e');
      },
      zoneRate: (p, i, inside, rate) => { if (!storm() || sheltered(p)) return rate; return rate > 0 ? rate * 0.3 : rate * 3; },
    };
  },
  // 5장: 마법진이 차례로 깨어난다. 사교도가 진 위에서 쏜다
  sigilRing(r) {
    const s = r.s, g = s.add.graphics().setDepth(5);
    tintZones(r, 0xb070ff);
    let nextT = 2;
    const first = () => r.pts.findIndex(p => !p.done);
    return {
      update(dt) {
        g.clear();
        const f = first();
        r.pts.forEach((p, i) => {
          p.sleep = !p.done && i > f;
          p.sp.setAlpha(p.sleep ? 0.3 : 0.9);
          if (p.sleep) { g.lineStyle(2, 0x6a5090, 0.6).strokeCircle(p.x, p.y, r.cfg.r); p.tx.setText(t('modeRules.d52ab5')); }
          else if (!p.done) { for (let k = 0; k < 6; k++) { const a = s.bt / 700 + k * 1.047; g.fillStyle(0xd0a0ff, 0.8).fillCircle(p.x + Math.cos(a) * r.cfg.r * 0.8, p.y + Math.sin(a) * r.cfg.r * 0.8, 2.4); } }
        });
        const p = r.pts[f];
        nextT -= dt / 1000;
        if (p && p.inside && nextT <= 0 && s.mobs.getChildren().filter(m => m.kind === 'cultist' && !m.dead && m.active).length < 6) {
          nextT = 2.4; const a = RF(0, 6.28);
          s.spawn(false, 'cultist', { force: true, at: { x: p.x + Math.cos(a) * r.cfg.r * 0.8, y: p.y + Math.sin(a) * r.cfg.r * 0.8 } });
        }
      },
      zoneRate: (p, i, inside, rate) => p.sleep ? 0 : rate,
    };
  },
  // 6장: 물이 차면 제단이 잠긴다
  floodAltars(r) {
    const s = r.s, g = s.add.graphics().setDepth(5), env = s.env;
    tintZones(r, 0x5ae0d0);
    env.puddles.length = 0;
    r.pts.forEach(p => env.addPuddle(p.x, p.y + 6, 30, Infinity));
    const ph = i => (s.bt + i * 3200) % 9600;
    const flooded = (p, i) => !p.done && ph(i) < 3400;
    return {
      update() {
        g.clear();
        r.pts.forEach((p, i) => {
          if (p.done) return;
          const f = flooded(p, i), warn = !f && ph(i) > 8700;
          p.flood = f;
          if (f || warn) { const w = r.cfg.r * 2.3; g.fillStyle(0x2a90c8, f ? 0.5 : 0.22).fillEllipse(p.x, p.y, w, w * 0.8).lineStyle(2, 0xa8fff4, 0.7).strokeEllipse(p.x, p.y, w * (0.8 + 0.1 * Math.sin(s.bt / 160)), w * 0.65); }
          if (f) p.tx.setText(t('lobby.956f2f'));
        });
      },
      zoneRate: (p, i, inside, rate) => flooded(p, i) ? 0 : rate,
    };
  },
  // 7장: 물살이 주인공을 거점 밖으로 민다
  dryLands(r) {
    const s = r.s, g = s.add.graphics().setDepth(5), env = s.env;
    tintZones(r, 0x9ac060);
    r.pts.forEach((p, i) => { const a = Math.atan2(p.y - MX, p.x - MX) + Math.PI / 2 * (i % 2 ? 1 : -1); p.fl = { x: Math.cos(a), y: Math.sin(a) }; });
    return {
      update() {
        g.clear();
        r.pts.forEach(p => {
          if (p.done) return;
          const R0 = r.cfg.r;
          g.fillStyle(0x3a8a5a, 0.22).fillCircle(p.x, p.y, R0 * 1.5);
          for (let k = 0; k < 3; k++) { const o = (((s.bt * 0.04 + k * 30) % 90) - 45); const cx = p.x + p.fl.x * o, cy = p.y + p.fl.y * o; g.lineStyle(2, 0xe0ffc0, 0.6).lineBetween(cx - p.fl.x * 6 - p.fl.y * 6, cy - p.fl.y * 6 + p.fl.x * 6, cx, cy).lineBetween(cx - p.fl.x * 6 + p.fl.y * 6, cy - p.fl.y * 6 - p.fl.x * 6, cx, cy); }
          if (dist(s.hero, p) < R0 * 1.5) env.impulse(p.fl.x * 38, p.fl.y * 38, 60);
        });
      },
    };
  },
  // 8장: 레이저가 지나가면 두 배
  resonance(r) {
    const s = r.s, env = s.env, g = s.add.graphics().setDepth(5);
    tintZones(r, 0xc080ff);
    clearPillars(env);
    [0, 1, 2].forEach(i => { const p = addPillar(env, MX, MX, (i % 2 ? -1 : 1) * (0.5 + i * 0.06), r.cfg.rad + 25, false); p.a = i * 2.09; });
    const on = p => !p.done && beamNear(env, p.x, p.y, 34);
    return {
      setup() { s.hero.setPosition(MX, MX + r.cfg.rad * 0.5); },
      update() { g.clear(); r.pts.forEach(p => { if (on(p)) g.lineStyle(4, 0xffffff, 0.9).strokeCircle(p.x, p.y, r.cfg.r + 8); }); },
      zoneRate: (p, i, inside, rate) => on(p) && rate > 0 ? rate * 2 : rate,
    };
  },
  // 9장: 바람이 불면 게이지가 샌다
  flagpoles(r) {
    const s = r.s, env = s.env, g = s.add.graphics().setDepth(11);
    tintZones(r, 0xe8f4ff);
    const blow = () => env.wind && env.wind.blow ? env.wind.k : 0;
    return {
      update() {
        g.clear();
        const w = env.wind; if (!w) return;
        r.pts.forEach(p => {
          const k = blow(), fx = Math.cos(w.a) * (6 + 16 * k), fy = Math.sin(w.a) * (6 + 16 * k) * 0.6;
          g.lineStyle(2, 0xcfd8e8, 1).lineBetween(p.x, p.y - 4, p.x, p.y - 34);
          g.fillStyle(p.done ? 0x7ddc6a : 0xffd75e, 1).fillTriangle(p.x, p.y - 34, p.x + fx, p.y - 30 + fy, p.x, p.y - 22);
        });
      },
      zoneRate: (p, i, inside, rate) => { const k = blow(); return rate > 0 ? rate * (1 - 0.6 * k) : rate * (1 + 1.5 * k); },
    };
  },
  // 10장: 등대는 가까이 가야 보인다
  lighthouses(r) {
    const s = r.s, g = s.add.graphics().setDepth(5), arrow = s.add.sprite(0, 0, 'ma_elite_arrow').setScrollFactor(0).setDepth(61).setVisible(false).setTint(0xfff0a0);
    const say = callout(r, 124);
    let ping = 0;
    return {
      update(dt) {
        const h = s.hero;
        r.pts.forEach(p => {
          const d = dist(h, p), a = p.done ? 1 : clamp(1.4 - d / 220, 0, 1);
          [p.sp, p.fill, p.flag, p.tx, p.glow].forEach(o => o && o.setAlpha(o === p.glow ? 0.2 * a : a));
          if (o_ok(p)) { }
        });
        ping += dt;
        const left = r.pts.filter(p => !p.done);
        const nearest = left.sort((a, b) => dist(h, a) - dist(h, b))[0];
        const show = nearest && ping % 7000 < 1500 && ping > 3000 && dist(h, nearest) > 140;
        arrow.setVisible(!!show);
        say(show ? t('modeRules.bfb994') : '', '#ffe8a0');
        if (show) {
          const vr = s.cameras.main, a = Math.atan2(nearest.y - h.y, nearest.x - h.x);
          arrow.setPosition(195 + Math.cos(a) * 120, 422 + Math.sin(a) * 120).setRotation(a).setScale(1.4);
        }
        g.clear();
      },
    };
    function o_ok() { return true; }
  },
  // 11장: 거점 한가운데 유사 구덩이
  oasis(r) {
    const s = r.s, env = s.env, g = s.add.graphics().setDepth(5);
    tintZones(r, 0xe0c080);
    env.pits.length = 0; r.pts.forEach(p => env.addPit(p.x, p.y, 34, Infinity));
    const core = p => dist(s.hero, p) < 20;
    return {
      update(dt) {
        g.clear();
        r.pts.forEach(p => { if (!p.done && p.inside && core(p)) { zoneHurt(r, p, dt, 'sk', 0.03, 800); g.lineStyle(2, 0xff9060, 0.8).strokeCircle(p.x, p.y, 22); } });
      },
      zoneRate: (p, i, inside, rate) => inside && core(p) && rate > 0 ? rate * 2 : rate,
    };
  },
  // 12장: 밸브가 증기를 뿜는 동안 게이지가 멈춘다
  valves(r) {
    const s = r.s, env = s.env;
    tintZones(r, 0xd09060);
    r.pts.forEach((p, i) => { const v = env.vents[i] || (env.vents[i] = { x: 0, y: 0, r: 26, t: 0, ph: 'idle' }); v.x = p.x + r.cfg.r * 0.7; v.y = p.y - 4; v.t = 900 + i * 1100; v.ph = 'idle'; p.v = v; });
    const g = s.add.graphics().setDepth(5);
    return {
      update() { g.clear(); r.pts.forEach(p => { if (p.done) return; if (p.v.ph !== 'idle') { g.lineStyle(3, p.v.ph === 'burst' ? 0xffffff : 0xff6050, 0.9).strokeCircle(p.x, p.y, r.cfg.r + 8); p.tx.setText(t('modeRules.c98497')); } }); },
      zoneRate: (p, i, inside, rate) => p.v && p.v.ph === 'burst' ? 0 : rate,
    };
  },
  // 13장: 번개를 맞아야 게이지가 크게 찬다
  rodPillars(r) {
    const s = r.s, env = s.env;
    tintZones(r, 0xc8d8f0);
    env.rods.length = 0;
    r.pts.forEach(p => env.rods.push({ x: p.x, y: p.y, hot: 0, prev: 0, p }));
    return {
      update() {
        for (const q of env.rods) {
          if (q.prev > 300 && q.hot <= 300 && !q.p.done && dist(s.hero, q) < 48) { q.p.g = Math.min(99, q.p.g + 38); flash(s, q.x, q.y, 0xc8d8f0, t('modeRules.713a7c')); sfx('level'); }
          q.prev = q.hot;
        }
      },
      zoneRate: (p, i, inside, rate) => rate > 0 ? rate * 0.45 : rate,
    };
  },
  // 14장: 빛줄기가 지날 때만 충전
  prisms(r) {
    const s = r.s, env = s.env, g = s.add.graphics().setDepth(5);
    tintZones(r, 0x80ffe0);
    clearPillars(env);
    [0, 1].forEach(i => { const p = addPillar(env, MX, MX, i ? -0.55 : 0.55, r.cfg.rad + 30, true); p.a = i * Math.PI; });
    const lit = p => beamNear(env, p.x, p.y, 40);
    return {
      setup() { s.hero.setPosition(MX, MX + r.cfg.rad * 0.5); },
      update() { g.clear(); r.pts.forEach(p => { if (p.done) return; if (lit(p)) g.fillStyle(0x80ffe0, 0.3).fillCircle(p.x, p.y, r.cfg.r).lineStyle(4, 0xffffff, 0.9).strokeCircle(p.x, p.y, r.cfg.r + 6); else g.lineStyle(2, 0x80ffe0, 0.35).strokeCircle(p.x, p.y, r.cfg.r - 6); }); },
      zoneRate: (p, i, inside, rate) => lit(p) ? (inside ? 100 / r.cfg.cap * 3.2 : 0) : (rate > 0 ? 0 : rate * 0.1),
    };
  },
  // 15장: 모루 위 거점. 화염 버프 동안 점령이 빠르다
  anvilZones(r) {
    const s = r.s, env = s.env, g = s.add.graphics().setDepth(5);
    tintZones(r, 0xffb050);
    env.anvils.length = 0;
    r.pts.forEach(p => env.anvils.push({ x: p.x, y: p.y, cd: 0 }));
    let prevF = 0;
    return {
      update() {
        g.clear();
        if (env.forged > 0 && prevF <= 0) { const p = r.pts.find(q => !q.done && q.inside); if (p) { p.g = Math.min(99, p.g + 12); flash(s, p.x, p.y, 0xff9a30, t('modeRules.33bb2c')); } }
        prevF = env.forged;
        if (env.forged > 0) g.fillStyle(0xff7a20, 0.12).fillCircle(s.hero.x, s.hero.y, 60);
      },
      zoneRate: (p, i, inside, rate) => env.forged > 0 && rate > 0 ? rate * 1.8 : rate,
    };
  },
};

// ═══ 사냥 ═══
const diver = (r, m, dt, opt) => {
  // 숨음(m.dive)·이동·떠오름. opt.pick(m) → 떠오를 자리, opt.dur 잠긴 시간, opt.col 자국 색
  const s = r.s, h = s.hero;
  m.dvT = (m.dvT ?? RF(0.8, 2)) - dt / 1000;
  if (!m.dive) {
    m.setVelocity(0, 0);
    if (m.dvT <= 0 && dist(m, h) < opt.trig) {
      m.dive = true; m.dvT = opt.dur; m.dvTo = opt.pick(m); m.setAlpha(0.12); m.mk?.setAlpha(0.2); m.au?.setAlpha(0.2); s.env.ripple(m.x, m.y, opt.col);
    }
    return false;
  }
  const dx = m.dvTo.x - m.x, dy = m.dvTo.y - m.y, d = Math.hypot(dx, dy) || 1;
  m.setVelocity(dx / d * opt.spd, dy / d * opt.spd);
  r.g2.fillStyle(opt.col, 0.55).fillEllipse(m.x, m.y + 8, 22, 9).lineStyle(1.5, 0xffffff, 0.6).strokeEllipse(m.x, m.y + 8, 26, 11);
  if (m.dvT <= 0 || d < 8) { m.dive = false; m.dvT = opt.up(); m.setAlpha(1); m.mk?.setAlpha(1); m.au?.setAlpha(1); s.env.ripple(m.x, m.y, opt.col); }
  return true;
};
const HUNT = {
  // 3장: 용암 웅덩이. 정예는 느려지고 나는 데인다
  lavaPools(r) {
    const s = r.s, g = s.add.graphics().setDepth(4);
    const pools = Array.from({ length: 7 }, (_, i) => { const a = i * 0.9 + RF(0, 0.4), d = RF(150, 520); return { x: clamp(MX + Math.cos(a) * d, 90, WORLD - 90), y: clamp(MX + Math.sin(a) * d, 90, WORLD - 90), rx: 46, ry: 32 }; });
    const inPool = o => pools.some(p => ((o.x - p.x) / p.rx) ** 2 + ((o.y + 8 - p.y) / p.ry) ** 2 < 1);
    let burn = 0;
    return {
      update(dt) {
        g.clear(); burn -= dt;
        for (const p of pools) { g.fillStyle(0xff4a10, 0.55 + 0.12 * Math.sin(s.bt / 130 + p.x)).fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2).lineStyle(2, 0xffd070, 0.8).strokeEllipse(p.x, p.y, p.rx * 2, p.ry * 2); }
        if (inPool(s.hero) && burn <= 0) { burn = 700; s.hurt(s.maxHp * 0.04, 'lava'); }
      },
      preySpd: m => inPool(m) ? 0.4 : 1,
    };
  },
  // 4장: 무리가 같이 도망치고 발자국이 남는다
  herdTracks(r) {
    const s = r.s, g = s.add.graphics().setDepth(3), prints = [];
    let t = 0;
    return {
      update(dt) {
        t += dt; g.clear();
        if (t > 380) { t = 0; for (const m of r.prey) prints.push({ x: m.x + R(-3, 3), y: m.y + 10, life: 7000, c: m.ph === 'run' }); }
        for (let i = prints.length - 1; i >= 0; i--) { const q = prints[i]; q.life -= dt; if (q.life <= 0) { prints.splice(i, 1); continue; } g.fillStyle(0xdff2ff, 0.7 * q.life / 7000).fillEllipse(q.x, q.y, 5, 3).lineStyle(1, 0x7090b0, 0.5 * q.life / 7000).strokeEllipse(q.x, q.y, 5, 3); }
        if (prints.length > 400) prints.splice(0, 80);
      },
      preyPost() {},
      prey(m) {   // 한 마리가 달리기 시작하면 가까운 무리도 같이 달린다
        if (m.ph === 'run' && !m.herdSent) {
          m.herdSent = true;
          for (const q of r.prey) if (q !== m && dist(q, m) < 260 && q.ph !== 'run') { q.ph = 'run'; q.phT = RF(1.0, 1.5); q.fx = m.fx; q.fy = m.fy; }
        }
        if (m.ph !== 'run') m.herdSent = false;
        return false;
      },
    };
  },
  // 5장: 사교도 호위가 있는 동안 기사는 단단하다
  escorts(r) {
    const s = r.s, g = s.add.graphics().setDepth(40);
    return {
      setup() {
        r.prey.forEach(k => { k.esc = []; for (let i = 0; i < 2; i++) { const a = i * Math.PI + RF(0, 1), e = s.spawn(false, 'cultist', { force: true, at: { x: clamp(k.x + Math.cos(a) * 50, 40, WORLD - 40), y: clamp(k.y + Math.sin(a) * 50, 40, WORLD - 40) } }); if (e) { e.guardOf = k; e.gA = a; k.esc.push(e); e.setTint(0xffd0a0); e.baseTint = e.tintTopLeft; } } });
      },
      update() {
        g.clear();
        for (const k of r.prey) {
          k.esc = k.esc.filter(e => e.active && !e.dead);
          k.weak = k.esc.length ? 0.1 : 1;
          if (k.esc.length) { g.lineStyle(3, 0x80c8ff, 0.7 + 0.2 * Math.sin(s.bt / 100)).strokeCircle(k.x, k.y, 26); k.esc.forEach(e => g.lineStyle(1, 0x80c8ff, 0.5).lineBetween(k.x, k.y, e.x, e.y)); }
        }
      },
      steer(m) {
        if (!m.guardOf) return false;
        const k = m.guardOf;
        if (!k.active || k.dead) { m.guardOf = null; return false; }
        if (dist(m, s.hero) < 100) return false;
        m.gA += 0.02;
        const tx = k.x + Math.cos(m.gA) * 46, ty = k.y + Math.sin(m.gA) * 46, d = dist(m, { x: tx, y: ty });
        m.setVelocity((tx - m.x) / (d || 1) * Math.min(m.spd * 1.8, d * 4), (ty - m.y) / (d || 1) * Math.min(m.spd * 1.8, d * 4));
        return true;
      },
    };
  },
  // 6장: 물속에 잠겼다가 물웅덩이에서 떠오른다
  divers(r) {
    const s = r.s, env = s.env, g2 = r.g2 = s.add.graphics().setDepth(8);
    return {
      preyInit(m) { m.fx = null; },
      update() { g2.clear(); for (const p of env.puddles) g2.lineStyle(1.5, 0xe0fffa, 0.5).strokeEllipse(p.x, p.y, p.r * 2.4, p.r * 1.8); },
      prey(m, dt) {
        return diver(r, m, dt, { trig: 150, dur: 1.7, spd: 120, col: 0x5ae0d0, up: () => RF(2.8, 3.8), pick: q => { let b = null, bd = 1e9; for (const p of env.puddles) { const d = dist(p, s.hero); if (d > 90 && dist(p, q) < 420 && d < bd + 400 * 0) { if (!b || Math.abs(dist(p, q) - 240) < Math.abs(dist(b, q) - 240)) b = p; } } return b || { x: clamp(q.x + R(-200, 200), 80, WORLD - 80), y: clamp(q.y + R(-200, 200), 80, WORLD - 80) }; } });
      },
    };
  },
  // 7장: 독구름 길 + 늪 물살에 떠내려간다
  streamDrift(r) {
    const s = r.s, env = s.env;
    return {
      preyPost(m) {
        const b = m.body; if (!b) return;
        for (const st of env.streams || []) {
          const x = st.ax === 'x', on = x ? Math.abs(m.y - st.pos) < st.w / 2 : Math.abs(m.x - st.pos) < st.w / 2;
          if (on) { if (x) b.velocity.x += st.dir * 46; else b.velocity.y += st.dir * 46; }
        }
      },
    };
  },
  // 8장: 레이저 뒤에 숨는다
  laserCover(r) {
    const s = r.s, env = s.env, g = s.add.graphics().setDepth(40);
    return {
      setup() { r.prey.forEach((m, i) => { const p = env.pillars[i % env.pillars.length]; m.cover = p; }); },
      update(dt) {
        g.clear();
        const h = s.hero;
        for (const m of r.prey) {
          let blocked = false;
          for (const p of env.pillars) { const e = beamEnd(p); if (segCross(h.x, h.y, m.x, m.y, p.x, p.y - 8, e.x, e.y)) blocked = true; }
          if (blocked) m.shieldT = 1300; else m.shieldT = Math.max(0, (m.shieldT || 0) - dt);
          m.weak = m.shieldT > 0 ? 0.05 : 1;
          if (m.shieldT > 0) g.lineStyle(3, 0xc080ff, 0.6 + 0.3 * Math.sin(s.bt / 90)).strokeCircle(m.x, m.y, 24);
        }
      },
      prey(m) {   // 가까워지면 기둥 뒤쪽(주인공 반대편)으로 숨는다
        const p = m.cover, h = s.hero; if (!p) return false;
        const d = dist(m, h);
        if (d < 220 && m.ph === 'run') {
          const ux = p.x - h.x, uy = p.y - h.y, l = Math.hypot(ux, uy) || 1, tx = p.x + ux / l * 60, ty = p.y + uy / l * 60, dd = dist(m, { x: tx, y: ty });
          if (dd > 14) { m.setVelocity((tx - m.x) / dd * m.runSpd, (ty - m.y) / dd * m.runSpd); return true; }
        }
        return false;
      },
    };
  },
  // 9장: 바람을 타고 도망친다
  windRiders(r) {
    const s = r.s, env = s.env;
    let was = false;
    const wv = () => { const w = env.wind; return w ? { x: Math.cos(w.a), y: Math.sin(w.a), k: w.blow ? w.k : 0 } : { x: 0, y: 0, k: 0 }; };
    return {
      update() {
        const w = env.wind; if (!w) return;
        if (w.blow && !was) for (const m of r.prey) { const v = wv(); m.fx = v.x * 0.85 + (m.fx || 0) * 0.15; m.fy = v.y * 0.85 + (m.fy || 0) * 0.15; m.ph = 'run'; m.phT = 2.2; }
        was = w.blow;
      },
      preySpd(m) { const v = wv(), l = Math.hypot(m.fx || 0, m.fy || 0) || 1; const dot = ((m.fx || 0) * v.x + (m.fy || 0) * v.y) / l; return clamp(1 + 0.75 * v.k * dot, 0.35, 1.8); },
    };
  },
  // 10장: 어둠에 숨고, 화살표는 가까운 정예만 알려 준다
  darkHide(r) {
    return {
      preyInit(m) { m.hide = true; },
      arrowOk: m => dist(m, r.s.hero) < 470,
    };
  },
  // 11장: 모래에 숨고 솟는 모래가 자리를 알려 준다
  sandBurrow(r) {
    const s = r.s, g2 = r.g2 = s.add.graphics().setDepth(8);
    return {
      preyInit(m) { m.fx = null; },
      update() { g2.clear(); },
      prey(m, dt) {
        return diver(r, m, dt, { trig: 160, dur: 1.5, spd: 105, col: 0xe0c080, up: () => RF(1.6, 2.6), pick: q => { const h = s.hero, a = Math.atan2(q.y - h.y, q.x - h.x) + RF(-0.9, 0.9); return { x: clamp(q.x + Math.cos(a) * 170, 80, WORLD - 80), y: clamp(q.y + Math.sin(a) * 170, 80, WORLD - 80) }; } });
      },
    };
  },
  // 12장: 점점 빨라지다 태엽이 풀려 멈춘다
  overclock(r) {
    const s = r.s, g = s.add.graphics().setDepth(40);
    const st = m => { const t = (m.t + (m.ckOff ?? (m.ckOff = RF(0, 6000)))) % 19000; return t < 15500 ? 0.8 + 1.1 * (t / 15500) : 0; };
    return {
      update() {
        g.clear();
        for (const m of r.prey) { const k = st(m); if (k === 0) { g.lineStyle(2, 0xffd75e, 0.9).strokeCircle(m.x, m.y, 22 + Math.sin(s.bt / 60) * 3); } else if (k > 1.6) g.lineStyle(2, 0xff6040, 0.7).strokeCircle(m.x, m.y, 20); }
      },
      preySpd: m => st(m),
      prey(m) { if (st(m) === 0) { m.setVelocity(0, 0); return true; } return false; },
    };
  },
  // 13장: 순간이동. 피뢰침 곁이면 번개를 대신 맞는다
  blinkRods(r) {
    const s = r.s, env = s.env;
    return {
      update() {
        for (const q of env.rods || []) {
          if ((q.pv || 0) > 300 && q.hot <= 300) for (const m of r.prey) if (dist(m, q) < 80) { s.hitMob(m, 16, { src: 'rod', kb: 100, fx: 'big', from: q }); flash(s, m.x, m.y, 0xc8d8f0, t('boss.7e82c9')); }
          q.pv = q.hot;
        }
      },
      prey(m, dt) {
        m.bkT = (m.bkT ?? RF(1.5, 3)) - dt / 1000;
        const h = s.hero;
        if (m.bkT <= 0 && dist(m, h) < 150) {
          m.bkT = RF(3.6, 4.6); env.ripple(m.x, m.y, 0xc8d8ff);
          const a = Math.atan2(m.y - h.y, m.x - h.x) + RF(-0.7, 0.7);
          m.setPosition(clamp(m.x + Math.cos(a) * 190, 70, WORLD - 70), clamp(m.y + Math.sin(a) * 190, 70, WORLD - 70)); env.ripple(m.x, m.y, 0xc8d8ff); sfx('shoot', 100);
        }
        return false;
      },
    };
  },
  // 14장: 분신 사이에서 거울상이 비치는 진짜를 찾는다
  decoys(r) {
    const s = r.s, refl = [];
    return {
      preyInit(m) { m.fx = null; m.mk?.setVisible(false); m.au?.setVisible(false); m.refl = s.add.image(m.x, m.y, m.texture.key, m.frame.name).setFlipY(true).setAlpha(0.4).setTint(0x80ffe0).setDepth(7); refl.push(m); },
      setup() {
        r.prey.forEach(k => {
          k.dc = [];
          for (let i = 0; i < 2; i++) { const d = s.spawn(false, 'phantompriest', { force: true, mini: true, at: { x: clamp(k.x + R(-60, 60), 40, WORLD - 40), y: clamp(k.y + R(-60, 60), 40, WORLD - 40) } }); if (d) { d.fx = null; d.decoyOf = k; d.maxHp = d.hp = 4; d.sz = i ? 1 : -1; k.dc.push(d); } }
        });
        s.time.delayedCall(10, () => r.prey.forEach(k => k.dc.forEach(d => { d.setScale(k.scaleX); })));
      },
      update() {
        for (const m of refl) { if (!m.active || m.dead || !m.refl) { m.refl?.destroy(); m.refl = null; continue; } m.refl.setPosition(m.x, m.y + m.displayHeight * 0.95).setTexture(m.texture.key, m.frame.name).setFlipX(m.flipX).setScale(m.scaleX, -m.scaleY); }
      },
      steer(m, dt) {
        if (!m.decoyOf) return false;
        const k = m.decoyOf;
        if (!k.active || k.dead) { if (!m.dead) { m.dead = true; m.body.enable = false; s.tweens.add({ targets: m, alpha: 0, duration: 250, onComplete: () => m.destroy() }); } return true; }
        const tx = k.x + m.sz * 40, ty = k.y + 18, d = dist(m, { x: tx, y: ty });
        m.setVelocity((tx - m.x) / (d || 1) * Math.min(80, d * 4), (ty - m.y) / (d || 1) * Math.min(80, d * 4));
        return true;
      },
    };
  },
  // 15장: 모루 둘레를 돌며 도망치고, 화염 버프를 받아야 쉽게 다친다
  anvilOrbit(r) {
    const s = r.s, env = s.env;
    return {
      preyInit(m) { m.weak = 0.35; },
      update() { const f = env.forged > 0; for (const m of r.prey) m.weak = f ? 3 : 0.35; },
      prey(m) {   // 모루 곁에선 모루 둘레를 돈다
        const a = env.anvils?.slice().sort((p, q) => dist(m, p) - dist(m, q))[0];
        if (!a || dist(m, a) > 150 || m.ph === 'rest') return false;
        const h = s.hero, tx = -(m.y - a.y), ty = m.x - a.x, tl = Math.hypot(tx, ty) || 1;
        const sgn = (h.x - m.x) * tx + (h.y - m.y) * ty > 0 ? -1 : 1;
        m.setVelocity(tx / tl * sgn * m.runSpd, ty / tl * sgn * m.runSpd);
        return true;
      },
    };
  },
};

const RULES = { ...GUARD, ...CAPTURE, ...HUNT };
export function makeRule(run) {
  const name = run.cfg.rule;
  if (run.id === 'breach') return makeBreachRule(run);
  return RULES[name] ? RULES[name](run, run.cfg) : null;
}
