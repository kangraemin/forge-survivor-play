// 16~20장(얼어붙은 왕궁 · 하늘 고래 항로 · 시간 시계탑 · 용의 무덤 · 검은 왕좌)의 장 기믹, 새 몹 행동, 새 보스 패턴.
// envfx.js의 Env가 `env.late`로 들고 있다. 설계표는 docs/chapters.md.
// 훅: late.update(dt) · late.mobTick(m, dt) · late.move(m, dt) · late.mobKill(m) · late.shot(m, ang) · late.slowMul()
import * as D from './data.js';
import { sfx } from './sfx.js';
import { font } from './ui.js';
import { warnDisc, warnStrip } from './fx2.js';
import { t } from './i18n.js';

const WORLD = 1600;
const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;
const cl = v => Phaser.Math.Clamp(v, 40, WORLD - 40);

// 피해 이름 → 그 장 세트(4세트가 이 피해를 약 40% 줄인다)
export const LATE_FX4 = { ice: 'palace4', frost: 'palace4', bash: 'palace4', harpoon: 'skyway4', gust: 'skyway4', cannon: 'skyway4', shock: 'skyway4', chime: 'clock4', gear: 'clock4', slash: 'clock4', breath: 'grave4', bone: 'grave4', dive: 'grave4', gaze: 'throne4', curse: 'throne4', shadow: 'throne4', royal: 'throne4' };

export const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = Phaser.Math.Clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
};
// 공격 그림(_attack 시트)을 잠깐 틀었다 걷기로 돌아온다
// 장면은 따로 받는다: 시뮬 몹에는 m.scene이 없어 공격 그림을 건너뛰었고, 그림 크기가 달라 16장부터 시뮬과 실제 판정이 어긋났다
function atkAnim(s, m, ms) {
  const k = m.kind + 'Atk';
  if (!s?.anims?.exists(k) || m.dead) return;
  m.play(k, true);
  s.time.delayedCall(ms, () => { if (m.active && !m.dead) m.play(m.kind, true); });
}
function say(s, x, y, txt, col = '#ffe0a0') {
  const t = s.add.text(x, y - 14, txt, font(9, col, 3)).setOrigin(0.5).setDepth(41);
  s.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 800, delay: 250, onComplete: () => t.destroy() });
}

export class Late {
  constructor(env) {
    const s = this.s = env.s; this.env = env;
    this.kind = env.kind; this.slowT = 0; this.slowK = 1; this.glide = { x: 0, y: 0 }; this.fz = [];
    this.ice = []; this.fv = []; this.sails = []; this.dv = []; this.clocks = []; this.glass = [];
    this.skulls = []; this.bones = []; this.corpses = []; this.eye = null; this.candles = []; this.curses = [];
    const img = (key, x, y, o = [0.5, 0.5], sc = 1, depth = 7.5) => s.textures.exists(key) ? s.add.image(x, y, key).setOrigin(...o).setScale(sc).setDepth(depth) : null;
    if (this.kind === 'palace') {
      for (let i = 0; i < 3; i++) { const q = env.farPoint(90, 520); this.ice.push({ x: q[0], y: q[1], r: 40, img: img('gimmick16_ice_patch', q[0], q[1]) }); }
      for (let i = 0; i < 3; i++) { const q = env.farPoint(110, 540); this.fv.push({ x: q[0], y: q[1], r: 32, t: 900 + i * 1300, ph: 'idle', img: img('gimmick16_frost_vent', q[0], q[1] + 10, [0.5, 0.85], 0.8, 10 + q[1] / WORLD) }); }
    }
    if (this.kind === 'skyway') {
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      for (let i = 0; i < 3; i++) { const q = env.farPoint(100, 500), a = dirs[R(0, 3)]; this.sails.push({ x: q[0], y: q[1], a, pa: dirs[(dirs.indexOf(a) + R(1, 3)) % 4], t: 4000 + i * 1500, img: img('gimmick17_wind_sail', q[0], q[1], [0.5, 0.95], 0.8, 10 + q[1] / WORLD) }); }
      for (let i = 0; i < 3; i++) { const q = env.farPoint(110, 540); this.dv.push({ x: q[0], y: q[1], r: 28, t: 1000 + i * 1200, ph: 'idle', img: img('gimmick17_deck_vent', q[0], q[1], [0.5, 0.6], 0.7, 7.6) }); }
    }
    if (this.kind === 'clocktower') {
      for (let i = 0; i < 2; i++) { const q = env.farPoint(100, 480); this.clocks.push({ x: q[0], y: q[1], r: 50, ph: 'off', t: 2500 + i * 3000, img: img('gimmick18_stopped_clock', q[0], q[1], [0.5, 0.5], 1, 7.5) }); }
      for (let i = 0; i < 2; i++) { const q = env.farPoint(110, 540); this.glass.push({ x: q[0], y: q[1], cd: 0, stand: 0, img: img('gimmick18_hourglass', q[0], q[1], [0.5, 0.9], 0.85, 10 + q[1] / WORLD) }); }
    }
    if (this.kind === 'grave') {
      for (let i = 0; i < 2; i++) { const q = env.farPoint(130, 520); this.skulls.push({ x: q[0], y: q[1], a: 0, t: 3500 + i * 2600, ph: 'idle', img: img('gimmick19_dragon_skull', q[0], q[1], [0.5, 0.8], 0.9, 10 + q[1] / WORLD) }); }
      for (let i = 0; i < 3; i++) { const q = env.farPoint(110, 540); this.bones.push({ x: q[0], y: q[1], r: 30, t: 1500 + i * 1400, ph: 'idle', img: img('gimmick19_bone_pile', q[0], q[1], [0.5, 0.7], 0.8, 7.6) }); }
    }
    if (this.kind === 'throne') {
      const q = env.farPoint(160, 420);
      this.eye = { x: q[0], y: q[1], sx: q[0], sy: q[1] + 60, det: 0, cd: 2500, img: img('gimmick20_throne_eye', q[0], q[1], [0.5, 0.9], 0.9, 10 + q[1] / WORLD) };
      for (let i = 0; i < 3; i++) { const p = env.farPoint(100, 480); this.candles.push({ x: p[0], y: p[1], r: 38, fuel: 5000, out: 0, img: img('gimmick20_candle', p[0], p[1], [0.5, 0.9], 0.8, 10 + p[1] / WORLD) }); }
    }
  }

  // 주인공 감속(서리·멈춘 시계). 4세트는 덜 느려진다
  slowMul() { return this.slowT > 0 ? this.slowK : 1; }
  slow(ms, k) { this.slowT = Math.max(this.slowT, ms); this.slowK = Math.min(this.slowK, k); }

  addZone(x, y, r, life) {
    if (this.fz.length >= 8) this.fz.shift();
    this.fz.push({ x, y, r, life, tk: 0 });
  }

  // 분출구 한 칸의 상태 진행(쉼 → 예고 1.2초 → 분출 0.7초). 분출 때 onBurst를 부른다
  ventStep(v, dt, g, warnCol, burstCol, onBurst) {
    const env = this.env, s = this.s;
    v.t -= dt;
    if (v.ph === 'idle' && v.t <= 0) { v.ph = 'warn'; v.t = 1200; sfx('warn', 200); }
    else if (v.ph === 'warn' && v.t <= 0) { v.wd?.destroy(); v.wd = null; v.ph = 'burst'; v.t = 700; v.hit = false; }
    else if (v.ph === 'burst' && v.t <= 0) { v.ph = 'idle'; v.t = 3200 + R(0, 900); }
    if (v.ph === 'warn') {
      if (v.wd || (v.wd = warnDisc(s, v.x, v.y, v.r))) v.wd.step(1 - v.t / 1200);
      else g.fillStyle(warnCol, 0.2).fillEllipse(v.x, v.y, v.r * 2, v.r * 1.5).lineStyle(2, 0xff4050, 0.5 + 0.5 * Math.abs(Math.sin(s.bt / 70))).strokeEllipse(v.x, v.y, v.r * 2, v.r * 1.5);
    } else if (v.ph === 'burst') {
      g.fillStyle(burstCol, 0.5).fillEllipse(v.x, v.y - 8, v.r * 1.7, v.r * 2.3).fillStyle(0xffffff, 0.35).fillEllipse(v.x, v.y - 18, v.r * 1.1, v.r * 1.8);
      if (!v.hit) { v.hit = true; onBurst(v); }
    }
    if (v.img) v.img.setTint(v.ph === 'warn' ? 0xffb0b0 : 0xffffff);
  }

  update(dt) {
    const env = this.env, s = this.s, h = s.hero, g = env.gfx, sp = D.PLAYER.spd;
    this.slowT = Math.max(0, this.slowT - dt); if (this.slowT <= 0) this.slowK = 1;
    // ── 16장 ──
    if (this.kind === 'palace') {
      // 얼음판: 위에서는 관성으로 미끄러진다(4세트는 덜)
      const on = this.ice.some(p => env.inEll(p.x, p.y, p.r)), mv = s.mv, ml = mv ? Math.hypot(mv.x, mv.y) : 0, gl = this.glide;
      if (on) {
        const tau = env.fx4('palace4') ? 300 : 650, k = Math.min(1, dt / tau), tx = ml > 12 ? mv.x / ml * sp * 0.6 : 0, ty = ml > 12 ? mv.y / ml * sp * 0.6 : 0;
        gl.x += (tx - gl.x) * k; gl.y += (ty - gl.y) * k;
      } else { const f = Math.pow(0.5, dt / 100); gl.x *= f; gl.y *= f; }
      if (Math.hypot(gl.x, gl.y) > 5) env.impulse(gl.x, gl.y, 60);
      this.onIce = on;
      for (const v of this.fv) this.ventStep(v, dt, g, 0xff2030, 0x9ae8ff, q => {
        sfx('crit', 120);
        if (env.inEll(q.x, q.y, q.r)) { env.hurtEnv(1.0, 'frost'); this.slow(env.fx4('palace4') ? 1300 : 2200, env.fx4('palace4') ? 0.78 : 0.6); say(s, h.x, h.y - 10, t('lateEnv.23e79c'), '#9ae8ff'); }
        for (const m of s.mobs.getChildren()) if (m.active && !m.dead && !m.isBoss && Math.hypot(m.x - q.x, (m.y - q.y) / 0.75) < q.r * 1.1) { m.freeze = 1300; m.setTint(0x9ae8ff); s.time.delayedCall(1300, () => m.active && !m.dead && (m.clearTint(), m.baseTint !== 0xffffff && m.setTint(m.baseTint))); }
      });
    }
    // 서리 지대(서리술사·서리 왕이 남긴 것): 안에 서 있으면 느려지고 조금씩 아프다
    this.fz = this.fz.filter(z => (z.life -= dt) > 0);
    for (const z of this.fz) {
      const a = Math.min(0.4, z.life / 1200 * 0.4);
      g.fillStyle(0x9ae8ff, a).fillEllipse(z.x, z.y, z.r * 2, z.r * 1.5).lineStyle(1.5, 0xe8ffff, a + 0.25).strokeEllipse(z.x, z.y, z.r * 2, z.r * 1.5);
      if (env.inEll(z.x, z.y, z.r * 0.9)) {
        this.slow(200, env.fx4('palace4') ? 0.78 : 0.6);
        z.tk -= dt; if (z.tk <= 0) { z.tk = 700; env.hurtEnv(0.45, 'frost'); }
      }
    }
    // ── 17장 ──
    if (this.kind === 'skyway') {
      const mv = s.mv, ml = mv ? Math.hypot(mv.x, mv.y) : 0, f = env.fx4('skyway4') ? 0.6 : 1;
      for (const p of this.sails) {
        p.t -= dt;
        const warn = p.t < 1500;
        if (p.t <= 0) { p.a = p.pa; const ds = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; p.pa = ds[(ds.indexOf(p.a) + R(1, 3)) % 4]; p.t = 6000; sfx('shoot', 120); }
        if (p.img) { p.img.setFlipX(Math.cos(p.a) < 0).setDepth(10 + p.y / WORLD); }
        // 화살표: 지금 바람 방향(굵게), 곧 바뀔 방향(깜빡임)
        const arrow = (a, col, al) => { const ox = p.x, oy = p.y - 52, ex = ox + Math.cos(a) * 22, ey = oy + Math.sin(a) * 15; g.lineStyle(3, col, al).lineBetween(ox, oy, ex, ey).lineBetween(ex, ey, ex - Math.cos(a - 0.6) * 8, ey - Math.sin(a - 0.6) * 6).lineBetween(ex, ey, ex - Math.cos(a + 0.6) * 8, ey - Math.sin(a + 0.6) * 6); };
        arrow(p.a, 0xffe8b0, 0.95);
        if (warn && Math.floor(s.bt / 150) % 2) arrow(p.pa, 0xff8a5a, 0.9);
        g.lineStyle(1, 0xffe8b0, 0.3).strokeEllipse(p.x, p.y, 112, 84);
        if (env.inEll(p.x, p.y, 56)) {
          const v = sp * 0.55 * f; env.impulse(Math.cos(p.a) * v, Math.sin(p.a) * v, 60);
          if (ml > 12 && (mv.x * Math.cos(p.a) + mv.y * Math.sin(p.a)) / ml > 0.35) env.impulse(mv.x / ml * sp * 0.3, mv.y / ml * sp * 0.3, 60);   // 같은 쪽으로 달리면 가속
        }
      }
      for (const v of this.dv) this.ventStep(v, dt, g, 0xff2030, 0xf0f0ff, q => {
        sfx('shoot', 140);
        if (env.inEll(q.x, q.y, q.r)) {
          env.hurtEnv(0.6, 'gust');
          const a = Math.atan2(h.y + 8 - q.y, h.x - q.x) || RF(0, 6.28), k = env.fx4('skyway4') ? 0.6 : 1;
          env.impulse(Math.cos(a) * 240 * k, Math.sin(a) * 240 * k, 420);
        }
      });
    }
    // ── 18장 ──
    if (this.kind === 'clocktower') {
      for (const c of this.clocks) {
        c.t -= dt;
        if (c.ph === 'off' && c.t <= 0) { c.ph = 'warn'; c.t = 1000; sfx('warn', 200); }
        else if (c.ph === 'warn' && c.t <= 0) { c.ph = 'on'; c.t = 5500; }
        else if (c.ph === 'on' && c.t <= 0) { c.ph = 'off'; c.t = 3500; }
        const on = c.ph === 'on';
        if (c.img) c.img.setAlpha(c.ph === 'off' ? 0.55 : 1);
        if (c.ph === 'warn') g.lineStyle(2, 0xff4050, 0.5 + 0.5 * Math.abs(Math.sin(s.bt / 70))).strokeEllipse(c.x, c.y, c.r * 2.1, c.r * 1.6);
        if (on) {
          g.fillStyle(0x70e8e0, 0.16).fillEllipse(c.x, c.y, c.r * 2.1, c.r * 1.6).lineStyle(2, 0xb8fff0, 0.7).strokeEllipse(c.x, c.y, c.r * 2.1, c.r * 1.6);
          if (env.inEll(c.x, c.y, c.r * 1.05)) this.slow(200, env.fx4('clock4') ? 0.78 : 0.6);
          for (const m of s.mobs.getChildren()) if (m.active && !m.dead && Math.hypot(m.x - c.x, (m.y - c.y) / 0.75) < c.r * 1.05) m.slow = Math.max(m.slow || 0, 200);
        }
      }
      for (const q of this.glass) {
        q.cd = Math.max(0, q.cd - dt);
        const near = q.cd <= 0 && env.inEll(q.x, q.y, 26);
        q.stand = near ? q.stand + dt : Math.max(0, q.stand - dt * 2);
        if (q.img) { q.img.setDepth(10 + q.y / WORLD).setTint(q.cd > 0 ? 0x808890 : 0xffffff); }
        if (q.cd <= 0) {
          g.lineStyle(1.5, 0x70f0e0, near ? 0.9 : 0.4).strokeEllipse(q.x, q.y, 52, 39);
          if (q.stand > 0) g.fillStyle(0x000000, 0.7).fillRect(q.x - 15, q.y - 54, 30, 5).fillStyle(0x70f0e0, 1).fillRect(q.x - 14, q.y - 53, 28 * Math.min(1, q.stand / 2000), 3);
        }
        if (q.stand >= 2000) {
          q.stand = 0; q.cd = 25000;
          s.heal(s.maxHp * 0.22); env.ripple(q.x, q.y, 0x70f0e0); sfx('level'); say(s, h.x, h.y - 10, t('lateEnv.68f1ec'), '#70f0e0');
        }
      }
    }
    this.updateLate(dt);
  }

  // 19·20장 장치와 저주 표식(update 끝에서 부른다)
  updateLate(dt) {
    const env = this.env, s = this.s, h = s.hero, g = env.gfx, sp = D.PLAYER.spd;
    // ── 19장 ──
    if (this.kind === 'grave') {
      // 용 두개골: 예고 줄(1.1초) 뒤 숨결이 곧게 뻗고, 줄 위에 영혼 불이 잠깐 남는다
      for (const k of this.skulls) {
        k.t -= dt;
        if (k.ph === 'idle' && k.t <= 0) {
          k.ph = 'warn'; k.t = 1100; k.a = Math.atan2(h.y + 8 - k.y, h.x - k.x); sfx('warn', 200);
          k.w = warnStrip(s, k.x, k.y, k.a, 300, 30);
          if (k.w) { const st = { f: 0 }, w = k.w; s.tweens.add({ targets: st, f: 1, duration: 1100, onUpdate: () => w.active && w.step(st.f) }); }
        } else if (k.ph === 'warn' && k.t <= 0) {
          k.ph = 'idle'; k.t = 5200 + R(0, 1200); k.w?.destroy(); k.w = null;
          const ox = k.x, oy = k.y, ex = ox + Math.cos(k.a) * 300, ey = oy + Math.sin(k.a) * 300;
          flashLine(s, ox, oy, ex, ey, 0xc8a0ff); sfx('crit', 120);
          if (segDist(h.x, h.y + 8, ox, oy, ex, ey) < 16) env.hurtEnv(1.0, 'breath');
          for (let i = 1; i <= 3; i++) env.addHaz(ox + Math.cos(k.a) * 75 * i, oy + Math.sin(k.a) * 75 * i, 20, 2200, 0.5, 'breath', 0xb890ff);
        }
        if (k.ph === 'warn' && !k.w) g.lineStyle(26, 0xff2030, 0.2).lineBetween(k.x, k.y, k.x + Math.cos(k.a) * 300, k.y + Math.sin(k.a) * 300);
        if (k.img) k.img.setTint(k.ph === 'warn' ? 0xd0b0ff : 0xffffff).setFlipX(Math.cos(k.a) < 0);
      }
      // 뼈 무더기: 흔들리다(1.2초) 뼈 가시가 솟는다
      for (const v of this.bones) this.ventStep(v, dt, g, 0xff2030, 0xe8e0f0, q => {
        sfx('crit', 120);
        if (env.inEll(q.x, q.y, q.r)) env.hurtEnv(0.8, 'bone');
      });
      const now = s.bt; this.corpses = this.corpses.filter(o => now - o.t < 8000);
    }
    // ── 20장 ──
    if (this.kind === 'throne') {
      const e = this.eye, f4 = env.fx4('throne4');
      // 검은 촛대: 불빛 안은 왕좌의 눈이 못 본다. 5초 머물면 꺼지고 12초 뒤 다시 켜진다
      let hidden = false;
      for (const c of this.candles) {
        if (c.out > 0 && (c.out -= dt) <= 0) c.fuel = 5000;
        const lit = c.out <= 0, inside = lit && env.inEll(c.x, c.y, c.r);
        if (inside) {
          hidden = true;
          if ((c.fuel -= dt) <= 0) { c.out = 12000; env.ripple(c.x, c.y, 0xffb070); say(s, c.x, c.y - 20, t('late20.candleOut'), '#ffb070'); }
        }
        if (lit) {
          g.fillStyle(0xffb070, 0.1 + 0.04 * Math.sin(s.bt / 90)).fillEllipse(c.x, c.y, c.r * 2, c.r * 1.5).lineStyle(1, 0xffd0a0, 0.35).strokeEllipse(c.x, c.y, c.r * 2, c.r * 1.5);
          if (inside) g.fillStyle(0x000000, 0.7).fillRect(c.x - 15, c.y - 50, 30, 5).fillStyle(0xffb070, 1).fillRect(c.x - 14, c.y - 49, 28 * Math.max(0, c.fuel / 5000), 3);
        }
        if (c.img) c.img.setTint(lit ? 0xffffff : 0x606070);
      }
      // 왕좌의 눈: 붉은 빛이 나를 천천히 쫓는다(내 걸음보다 느리다). 1.3초 비치면 들켜서 둘레 몹이 빨라지고 조금 아프다
      e.cd = Math.max(0, e.cd - dt);
      const dx = h.x - e.sx, dy = h.y + 8 - e.sy, dl = Math.hypot(dx, dy), v = sp * (f4 ? 0.4 : 0.55) * dt / 1000;
      if (dl > 1) { e.sx += dx / dl * Math.min(v, dl); e.sy += dy / dl * Math.min(v, dl); }
      const r = 46, on = e.cd <= 0, al = on ? 0.2 : 0.06;
      g.lineStyle(1, 0xff6a5a, al + 0.1).lineBetween(e.x - 6, e.y - 40, e.sx - r, e.sy).lineBetween(e.x + 6, e.y - 40, e.sx + r, e.sy);
      g.fillStyle(0xff4a3a, al).fillEllipse(e.sx, e.sy, r * 2, r * 1.5).lineStyle(2, 0xff8a7a, al + 0.3).strokeEllipse(e.sx, e.sy, r * 2, r * 1.5);
      const inS = on && !hidden && Math.hypot((h.x - e.sx) / r, (h.y + 8 - e.sy) / (r * 0.75)) <= 1;
      e.det = inS ? e.det + dt : Math.max(0, e.det - dt * 1.5);
      if (e.det > 0) g.fillStyle(0x000000, 0.7).fillRect(h.x - 15, h.y - 30, 30, 5).fillStyle(0xff6a5a, 1).fillRect(h.x - 14, h.y - 29, 28 * Math.min(1, e.det / 1300), 3);
      if (e.det >= 1300) {
        e.det = 0; e.cd = 4500; env.hurtEnv(0.6, 'gaze'); sfx('warn'); say(s, h.x, h.y - 10, t('late20.seen'), '#ff8a7a');
        for (const o of s.mobs.getChildren()) if (o.active && !o.dead && !o.isBoss && Math.hypot(o.x - h.x, o.y - h.y) < 260) this.boost(o, 1.3, 3000, 0xff8a7a);
      }
      if (e.img) e.img.setTint(on ? 0xffffff : 0x806060);
    }
    // 저주 표식(저주 기사): 붉은 고리가 2초 가까이 나를 따라다니다 멈추고 0.6초 뒤 터진다
    for (const c of this.curses) {
      c.t -= dt;
      if (c.t > 600) { const p = 0.5 + 0.5 * Math.abs(Math.sin(s.bt / 90)); g.lineStyle(2, 0xff4a6a, p).strokeEllipse(h.x, h.y + 8, 76, 57); }
      else if (!c.lock) {
        c.lock = true; const x = h.x, y = h.y + 8;
        env.warn(x, y, 38, 600, () => { env.ripple(x, y, 0xff4a6a); sfx('crit', 120); if (env.inEll(x, y, 38)) env.hurtEnv(1.0, 'curse'); });
      }
    }
    this.curses = this.curses.filter(c => !c.lock);
  }

  // ── 몹 ──
  boost(m, k, ms, tint = 0x9ae8ff) {
    if (!(m.boostT > 0)) { m.bSpd0 = m.spd; m.spd *= k; }
    m.boostT = ms; m.setTint(tint);
  }

  mobTick(m, dt) {
    const s = this.s, env = this.env, h = s.hero;
    if (m.boostT > 0 && (m.boostT -= dt) <= 0) { m.boostT = 0; m.spd = m.bSpd0; m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); }
    if (m.rallyT > 0 && (m.rallyT -= dt) <= 0) { m.rallyT = 0; m.weak = 1; m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); }
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    switch (m.fx) {
      case 'lunge': {   // 뼈 비룡: 내가 선 자리에 예고 원(0.75초)을 띄우고 거기로 내리꽂힌다
        m.lgCd = (m.lgCd ?? RF(2000, 4000)) - dt;
        if (m.lgCd <= 0 && d > 50 && d < 170 && !(m.holdT > 0)) {
          m.lgCd = 4400; m.holdT = 900; atkAnim(s, m, 900);
          const x = cl(h.x), y = cl(h.y + 8);
          env.warn(x, y, 26, 750, () => {
            if (!m.active || m.dead || s.over) return;
            s.tweens.add({ targets: m, x, y: y - 8, duration: 150, ease: 'Quad.In' });
            sfx('crit', 120); env.ripple(x, y, 0xc8b8ff);
            if (env.inEll(x, y, 28)) env.hurtEnv(1.1, 'dive');
          });
        }
        break;
      }
      case 'raise': {   // 뼈 사제: 8초 안에 쓰러진 몹 하나를 보랏빛 작은 몹으로 되살린다(사제를 먼저 잡아라)
        m.rsCd = (m.rsCd ?? RF(2500, 4500)) - dt;
        if (m.rsCd <= 0) {
          const c = s.mobs.countActive() < 60 && this.corpses.find(o => Math.hypot(o.x - m.x, o.y - m.y) < 170);
          if (!c) { m.rsCd = 1000; break; }
          m.rsCd = 6500; m.holdT = 900; atkAnim(s, m, 900); this.corpses.splice(this.corpses.indexOf(c), 1);
          flashLine(s, m.x, m.y, c.x, c.y, 0xb890ff); env.ripple(c.x, c.y, 0xb890ff); sfx('warn', 140);
          s.time.delayedCall(900, () => {
            if (s.over || !m.active || m.dead) return;
            const r = s.spawn(true, c.kind, { force: true, mini: true, at: { x: c.x, y: c.y } });
            if (r) { r.fx = null; r.baseTint = 0xb890ff; r.setTint(0xb890ff); env.ripple(c.x, c.y, 0xb890ff); }
          });
        }
        break;
      }
      case 'shadowtrail':   // 그림자 분신: 지나간 자리에 그림자 웅덩이가 잠깐 남는다
        if (!m.mini && m.t - (m.trT || 0) > 650 && d < 260 && env.haz.length < 40) { m.trT = m.t; env.addHaz(m.x, m.y + 6, 13, 1700, 0.4, 'shadow', 0x503060); }
        break;
      case 'curse':   // 저주 기사: 붙으면 저주 표식을 건다(2.2초 뒤 내 자리에서 터진다)
        m.csCd = Math.max(0, (m.csCd ?? 0) - dt);
        if (m.csCd <= 0 && d < 26 && this.curses.length < 2) { m.csCd = 6000; atkAnim(s, m, 600); this.curses.push({ t: 2200 }); say(s, h.x, h.y - 10, t('late20.cursed'), '#ff6a8a'); sfx('warn', 160); }
        break;
      case 'rewind':   // 태엽 딱정벌레: 체력이 40% 아래로 처음 떨어지면 시간을 되감아 70%까지 회복한다
        if (!m.rewound && !m.mini && m.hp > 0 && m.hp < m.maxHp * 0.4) {
          m.rewound = true; m.hp = m.maxHp * 0.7; m.holdT = 650; atkAnim(s, m, 650); env.ripple(m.x, m.y, 0xffd870); say(s, m.x, m.y - 10, t('boss.099f7b'), '#ffd870'); sfx('level', 100);
        }
        break;
      case 'timeskip': {   // 진자 결투사: 예고 원이 내 등 뒤에 뜨고, 0.7초 뒤 거기로 순간이동해 벤다
        m.tsCd = (m.tsCd ?? RF(2500, 4500)) - dt;
        if (m.tsCd <= 0 && d > 55 && d < 170 && !(m.holdT > 0)) {
          m.tsCd = 4600; m.holdT = 800; atkAnim(s, m, 800);
          const a = Math.atan2(h.y - m.y, h.x - m.x), x = cl(h.x + Math.cos(a) * 34), y = cl(h.y + Math.sin(a) * 26);
          env.warn(x, y, 30, 700, () => {
            if (!m.active || m.dead || s.over) return;
            env.ripple(m.x, m.y, 0xa0a0ff); m.setPosition(x, y); env.ripple(x, y, 0xa0a0ff); sfx('crit', 120);
            if (env.inEll(x, y, 34)) env.hurtEnv(1.3, 'slash');
          });
        }
        break;
      }
      case 'alarm': {   // 알람 올빼미: 5초마다 경보 — 둘레 200 안의 몹이 3초 동안 1.35배 빨라진다
        m.alCd = (m.alCd ?? RF(1500, 3500)) - dt;
        if (m.alCd <= 0 && s.mobs.countActive() > 1) {
          m.alCd = 5200; atkAnim(s, m, 700); env.ripple(m.x, m.y, 0xffe0a0); sfx('warn', 160);
          const r = s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe0a0).setDepth(30).setScale(0.3);
          s.tweens.add({ targets: r, scale: 7, alpha: 0, duration: 520, onComplete: () => r.destroy() });
          for (const o of s.mobs.getChildren()) if (o.active && !o.dead && o !== m && !o.isBoss && Math.hypot(o.x - m.x, o.y - m.y) < 200) this.boost(o, 1.35, 3000, 0xffe0a0);
        }
        break;
      }
    }
  }

  // 몹의 움직임을 직접 쥐는 행동. 쥐었으면 true(Battle이 일반 이동을 건너뛴다)
  move(m, dt) {
    if (m.holdT > 0) { m.holdT -= dt; m.setVelocity(0, 0); return true; }
    if (m.fx === 'steal') return this.steal(m, dt);
    if (m.fx !== 'bash') return false;
    const s = this.s, h = s.hero, d = Math.hypot(h.x - m.x, h.y - m.y);
    m.bPh = m.bPh || 0;
    if (m.bPh === 0) {
      m.bCd = (m.bCd ?? RF(2500, 4500)) - dt;
      if (m.bCd <= 0 && d < 170 && d > 40) {
        m.bPh = 1; m.bT = 800; m.bA = Math.atan2(h.y - m.y, h.x - m.x); m.bHit = false; atkAnim(s, m, 800); sfx('warn', 160);
        const w = warnStrip(s, m.x, m.y, m.bA, 95, 24);
        if (w) { m.bW = w; const st = { f: 0 }; s.tweens.add({ targets: st, f: 1, duration: 800, onUpdate: () => w.active && w.step(st.f), onComplete: () => w.destroy() }); }
      }
      return false;
    }
    m.bT -= dt;
    if (m.bPh === 1) {
      m.setVelocity(0, 0);
      if (m.bT <= 0) { m.bPh = 2; m.bT = 520; sfx('shoot', 120); }
    } else if (m.bPh === 2) {
      const v = 150 * (m.slow > 0 ? 0.5 : 1);
      m.setVelocity(Math.cos(m.bA) * v, Math.sin(m.bA) * v);
      if (!m.bHit && d < 24) {
        m.bHit = true; s.hurt(m.dmg * 0.9, 'bash');
        s.env.impulse(Math.cos(m.bA) * 190, Math.sin(m.bA) * 190, 360);
      }
      if (m.bT <= 0) { m.bPh = 3; m.bT = 700; m.setVelocity(0, 0); }
    } else {
      m.setVelocity(0, 0);
      if (m.bT <= 0) { m.bPh = 0; m.bCd = 4600; }
    }
    return true;
  }

  // 도굴꾼: 떨어진 경험치 보석을 주워 먹고, 먹은 뒤엔 나를 피해 달아난다. 잡으면 먹은 것의 두 배를 토해 낸다
  steal(m, dt) {
    const s = this.s, h = s.hero, d = Math.hypot(h.x - m.x, h.y - m.y), v = m.spd * (m.slow > 0 ? 0.5 : 1);
    if (m.loot > 0 && d < 150) { const a = Math.atan2(m.y - h.y, m.x - h.x); m.setVelocity(Math.cos(a) * v * 0.9, Math.sin(a) * v * 0.9); m.setFlipX(Math.cos(a) < 0); return true; }
    if ((m.gT = (m.gT || 0) - dt) <= 0) {
      m.gT = 400; m.gem = null; let bd = 140;
      for (const g of s.gems.getChildren()) { if (!g.active || g.pull) continue; const gd = Math.hypot(g.x - m.x, g.y - m.y); if (gd < bd) { bd = gd; m.gem = g; } }
    }
    const g = m.gem;
    if (!g || !g.active || g.pull) { m.gem = null; return false; }
    const gd = Math.hypot(g.x - m.x, g.y - m.y);
    if (gd < 10) {
      m.loot = (m.loot || 0) + (g.v || 1); g.destroy(); m.gem = null;
      m.baseTint = 0xffd75e; m.setTint(0xffd75e); say(s, m.x, m.y, t('late19.steal'), '#ffd75e');
      return false;
    }
    m.setVelocity((g.x - m.x) / gd * v, (g.y - m.y) / gd * v); m.setFlipX(g.x < m.x);
    return true;
  }

  mobKill(m) {
    const s = this.s, env = this.env, x = m.x, y = m.y;
    if (this.kind === 'grave' && !m.isBoss && !m.mini && !m.mid && m.fx !== 'raise') { this.corpses.push({ x, y, kind: m.kind, t: s.bt }); if (this.corpses.length > 12) this.corpses.shift(); }
    switch (m.fx) {
      case 'steal':
        if (m.loot > 0) { const n = Math.min(4, Math.ceil(m.loot)); for (let i = 0; i < n; i++) s.addGem(x + R(-8, 8), y + R(-8, 8), m.loot * 2 / n); say(s, x, y, t('late19.back'), '#ffd75e'); }
        break;
      case 'howl': {   // 빙결 사냥개: 쓰러지며 울부짖어 둘레 사냥개가 2.5초 빨라진다
        let n = 0;
        for (const o of s.mobs.getChildren()) if (o.active && !o.dead && o !== m && o.fx === 'howl' && Math.hypot(o.x - x, o.y - y) < 170) { this.boost(o, 1.6, 2500); n++; }
        if (n) { env.ripple(x, y, 0x9ae8ff); say(s, x, y, t('lateEnv.39cc18'), '#9ae8ff'); sfx('warn', 120); }
        break;
      }
      case 'burstgust':   // 구름 가오리: 쓰러진 자리에서 돌풍이 터져 가까이 있으면 밀려난다
        env.warn(x, y, 42, 500, () => {
          env.ripple(x, y, 0xe8f4ff); sfx('shoot', 120);
          if (env.inEll(x, y, 46)) { const a = Math.atan2(s.hero.y + 8 - y, s.hero.x - x), k = env.fx4('skyway4') ? 0.6 : 1; env.impulse(Math.cos(a) * 210 * k, Math.sin(a) * 210 * k, 380); }
        });
        break;
      case 'bloat':   // 풍선 해파리: 터지면 전기 장판이 3.5초 남는다
        env.warn(x, y, 28, 600, () => { env.ripple(x, y, 0xf0e060); env.addHaz(x, y, 28, 3500, 0.7, 'shock', 0xf0e060); });
        break;
    }
  }

  // 원거리 몹 발사 가로채기(처리했으면 true)
  shot(m, ang) {
    const s = this.s, env = this.env;
    if (m.fx === 'rally') {   // 나팔수: 쏘지 않는다. 5.5초마다 나팔을 불어 둘레 몹이 3초 동안 받는 피해가 절반이 된다
      if (s.bt - (m.rlAt ?? -1e9) < 5500) return true;
      m.rlAt = s.bt; atkAnim(s, m, 700); sfx('level', 120);
      const r = s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd75e).setDepth(30).setScale(0.3);
      s.tweens.add({ targets: r, scale: 6, alpha: 0, duration: 520, onComplete: () => r.destroy() });
      for (const o of s.mobs.getChildren()) if (o.active && !o.dead && o !== m && !o.isBoss && !o.brace && Math.hypot(o.x - m.x, o.y - m.y) < 170) { o.weak = 0.5; o.rallyT = 3000; o.setTint(0xffd75e); }
      return true;
    }
    if (m.fx === 'frostzone') {   // 궁정 서리술사: 내가 선 자리에 서리 지대를 예고하고 만든다
      const x = s.hero.x, y = s.hero.y + 8;
      atkAnim(s, m, 700); sfx('warn', 140);
      env.warn(x, y, 34, 1100, () => { env.ripple(x, y, 0x9ae8ff); this.addZone(x, y, 34, 5000); });
      return true;
    }
    if (m.fx === 'harpoon') {   // 비행선 작살병: 예고 줄 → 작살. 줄 위에 남아 있으면 끌려온다
      const ox = m.x, oy = m.y, len = 230, ex = ox + Math.cos(ang) * len, ey = oy + Math.sin(ang) * len;
      atkAnim(s, m, 800); sfx('warn', 140);
      const w = warnStrip(s, ox, oy, ang, len, 14) || s.add.graphics().setDepth(9).lineStyle(2, 0xff4050, 0.8).lineBetween(ox, oy, ex, ey);
      if (w.step) { const st = { f: 0 }; s.tweens.add({ targets: st, f: 1, duration: 750, onUpdate: () => w.active && w.step(st.f) }); }
      s.time.delayedCall(750, () => {
        w.destroy();
        if (!m.active || m.dead || s.over) return;
        const ln = s.add.line(0, 0, ox, oy, ex, ey, 0xffe0b0, 1).setOrigin(0).setLineWidth(2).setDepth(32);
        s.tweens.add({ targets: ln, alpha: 0, duration: 220, onComplete: () => ln.destroy() });
        sfx('crit', 110);
        if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 12) {
          const k = env.fx4('skyway4') ? 0.6 : 1;
          s.hurt(m.dmg * 0.9 * k, 'harpoon');
          const a = Math.atan2(oy - s.hero.y, ox - s.hero.x); env.impulse(Math.cos(a) * 170 * k, Math.sin(a) * 170 * k, 450);
        }
      });
      return true;
    }
    return false;
  }
}

// ── 보스 패턴(BossAI.prototype에 섞는다) ──
const hit = (b, mul, src) => { const e = b.s.env, f = LATE_FX4[src]; b.s.hurt(b.m.dmg * mul * (f && e?.fx4(f) ? 0.6 : 1), src); };
export const lineWarn = (b, ox, oy, a, len, w, ms, onFire) => {
  const s = b.s, m = b.m, strip = warnStrip(s, ox, oy, a, len, w) || s.add.graphics().setDepth(9).lineStyle(w / 2, 0xff4050, 0.6).lineBetween(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
  if (strip.step) { const st = { f: 0 }; s.tweens.add({ targets: st, f: 1, duration: ms, onUpdate: () => strip.active && strip.step(st.f) }); }
  s.time.delayedCall(ms, () => { strip.destroy(); if (m.active && !s.over) onFire(); });
};
// 70차: 졸개 무리에 묻히던 예고(외통수) — 몹(깊이 10~11) 위에 굵은 테두리를 깜빡이고, diag면 가운데와 대각선으로 잇는다
const topRings = (s, pts, r, ms, col, diag = false) => {
  const g = s.add.graphics().setDepth(11.5), st = { f: 0 }, [cx, cy] = diag ? [(pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2] : [0, 0];
  s.tweens.add({ targets: st, f: 1, duration: ms, onUpdate: () => {
    if (!g.active) return;
    const a = 0.6 + 0.4 * Math.abs(Math.sin(st.f * 12));
    g.clear().lineStyle(3.5, col, a);
    for (const [x, y] of pts) { g.strokeEllipse(x, y, r * 2, r * 1.5); if (diag) g.lineBetween(cx, cy, x, y); }
  }, onComplete: () => g.destroy() });
};
export const flashLine = (s, ox, oy, ex, ey, col) => { const ln = s.add.line(0, 0, ox, oy, ex, ey, col, 1).setOrigin(0).setLineWidth(3).setDepth(32); s.tweens.add({ targets: ln, alpha: 0, duration: 260, onComplete: () => ln.destroy() }); };

export const LATE_PATTERNS = {
  // 서리 왕: 얼음 창이 내 쪽으로 세 줄(분노 직전엔 다섯 줄) 부채꼴로 박힌다
  icelance(fast) {
    const s = this.s, m = this.m, a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), n = fast ? 5 : 3;
    this.busy = 1300; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.32, ox = m.x, oy = m.y, ex = ox + Math.cos(a) * 280, ey = oy + Math.sin(a) * 280;
      lineWarn(this, ox, oy, a, 280, 18, 900, () => {
        flashLine(s, ox, oy, ex, ey, 0xcff4ff); sfx('crit', 120);
        if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 11) hit(this, 1.0, 'ice');
        s.env?.late?.addZone(ex, ey, 16, 2500);
      });
    }
  },
  // 서리 왕: 다섯 곳이 얼어 터지고 느려지는 서리 지대가 남는다
  frostquake(fast) {
    const s = this.s, m = this.m, h = s.hero, n = fast ? 6 : 5;
    this.busy = 1400; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + RF(0, 1), r = i ? RF(60, 120) : 0, x = cl(i ? m.x + Math.cos(a) * r * 1.2 : h.x), y = cl(i ? m.y + Math.sin(a) * r : h.y);
      s.time.delayedCall(i * 170, () => m.active && this.warnCircle(x, y, 32, 1000, () => { if (m.active) { this.thud(x, y, 32); s.env?.late?.addZone(x, y, 28, 4500); } }));
    }
  },
  // 69차: 서리 왕: 내 쪽으로 넓은 얼음 길이 예고된 뒤 그 길을 미끄러져 돌진하고, 지나간 자리에 서리 지대가 남는다(길 옆으로 비켜라)
  frostslide(fast) {
    const s = this.s, m = this.m, a = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), L = fast ? 300 : 250, ox = m.x, oy = m.y;
    const ex = cl(ox + Math.cos(a) * L), ey = cl(oy + Math.sin(a) * L), len = Math.hypot(ex - ox, ey - oy);
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    lineWarn(this, ox, oy, a, len, 30, 950, () => {
      sfx('crit', 120);
      s.tweens.add({ targets: m, x: ex, y: ey, duration: 320, ease: 'Quad.In', onComplete: () => {
        if (!m.active) return;
        flashLine(s, ox, oy, ex, ey, 0xcff4ff);
        if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 16) hit(this, 1.2, 'ice');
        for (let i = 1; i <= 3; i++) s.env?.late?.addZone(ox + (ex - ox) * i / 3, oy + (ey - oy) * i / 3, 18, 3000);
      } });
    });
  },
  // 분노: 눈보라. 2.6초간 내가 느려지고 서리 지대가 둘레에 쏟아지며 고드름 고리가 나간다
  blizzard() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 2000; m.setVelocity(0, 0); sfx('warn');
    s.env?.late?.slow(2600, 0.82);
    s.cameras.main.flash(300, 200, 235, 255);
    for (let i = 0; i < 9; i++) s.time.delayedCall(i * 260, () => {
      if (!m.active) return;
      const x = cl(h.x + R(-100, 100)), y = cl(h.y + R(-75, 75));
      this.warnCircle(x, y, 26, 800, () => { if (m.active) { this.thud(x, y, 26); s.env?.late?.addZone(x, y, 24, 3500); } });
    });
    for (let k = 0; k < 2; k++) s.time.delayedCall(600 + k * 700, () => { if (m.active) for (let i = 0; i < 14; i++) s.enemyShot(m.x, m.y, (i + k * 0.5) / 14 * Math.PI * 2, 70, m.dmg * 0.7).setTint(0xbff0ff); });
  },

  // 하늘 고래 함선: 작살 세 줄이 동시에 날아온다. 줄 위에 있으면 끌려와 맞는다
  volley(fast) {
    const s = this.s, m = this.m, a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), n = fast ? 4 : 3;
    this.busy = 1300; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.4, ox = m.x, oy = m.y, ex = ox + Math.cos(a) * 300, ey = oy + Math.sin(a) * 300;
      lineWarn(this, ox, oy, a, 300, 16, 850, () => {
        flashLine(s, ox, oy, ex, ey, 0xffe0b0); sfx('crit', 110);
        if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 12) {
          hit(this, 1.0, 'harpoon');
          const k = s.env?.fx4('skyway4') ? 0.6 : 1, b = Math.atan2(oy - s.hero.y, ox - s.hero.x);
          s.env?.impulse(Math.cos(b) * 190 * k, Math.sin(b) * 190 * k, 450);
        }
      });
    }
  },
  // 하늘 고래 함선: 위로 사라졌다가 내가 선 자리로 내려앉는다
  skydive() {
    const s = this.s, m = this.m, h = s.hero, tx = h.x, ty = h.y, r = 50;
    this.busy = 2000; m.setVelocity(0, 0); sfx('warn');
    s.tweens.add({ targets: m, alpha: 0.1, y: m.y - 50, duration: 500 });
    this.warnCircle(tx, ty, r, 1400, () => {});
    s.time.delayedCall(1300, () => {
      if (!m.active) return;
      m.setPosition(tx, ty - 60).setAlpha(1);
      s.tweens.add({ targets: m, y: ty, duration: 160, ease: 'Quad.In', onComplete: () => {
        if (!m.active) return;
        s.cameras.main.shake(260, 0.012);
        if (this.inWarn(tx, ty, r)) hit(this, 1.4, 'cannon');
        this.thud(tx, ty, 0);
        for (let i = 0; i < 10; i++) s.enemyShot(tx, ty, i / 10 * Math.PI * 2, 80, m.dmg * 0.6).setTint(0xffc890);
      } });
    });
  },
  // 하늘 고래 함선: 옆구리 대포. 내 둘레 가로 한 줄에 포탄이 차례로 떨어진다
  broadside(fast) {
    const s = this.s, m = this.m, h = s.hero, n = fast ? 7 : 6, y0 = h.y, dir = Math.random() < 0.5 ? 1 : -1;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const x = cl(h.x + (i - (n - 1) / 2) * 52 * dir), y = cl(y0 + R(-8, 8));
      s.time.delayedCall(i * 200, () => m.active && this.warnCircle(x, y, 26, 850, () => { if (m.active) { this.thud(x, y, 0); if (this.inWarn(x, y, 26)) hit(this, 1.0, 'cannon'); s.env?.addHaz(x, y, 20, 1800, 0.5, 'shock', 0xffc060); } }));
    }
  },
  // 분노: 돛 뒤집기 돌풍. 2.6초 동안 바람이 좌우로 번갈아 불고 포탄이 떨어진다
  squall() {
    const s = this.s, m = this.m, h = s.hero, e = s.env, k = e?.fx4('skyway4') ? 0.6 : 1;
    this.busy = 2400; m.setVelocity(0, 0); sfx('warn');
    s.banner(t('lateEnv.c01229'), t('lateEnv.846b27'));
    e?.impulse(-130 * k, 0, 1300);
    s.time.delayedCall(1300, () => m.active && e?.impulse(130 * k, 0, 1300));
    for (let i = 0; i < 7; i++) s.time.delayedCall(i * 340, () => {
      if (!m.active) return;
      const x = cl(h.x + R(-100, 100)), y = cl(h.y + R(-75, 75));
      this.warnCircle(x, y, 28, 850, () => { if (m.active) { this.thud(x, y, 0); if (this.inWarn(x, y, 28)) hit(this, 1.0, 'cannon'); } });
    });
  },

  // 시계탑 수호자: 종소리 고리가 세 번 퍼져 나간다(고리가 지나갈 때 맞는다 — 지나치는 순간 비껴 서라)
  chime(fast) {
    const s = this.s, m = this.m, n = fast ? 4 : 3;
    this.busy = 500 + n * 850; m.setVelocity(0, 0); sfx('warn');
    for (let k = 0; k < n; k++) s.time.delayedCall(250 + k * 850, () => {
      if (!m.active) return;
      const cx = m.x, cy = m.y, g = s.add.graphics().setDepth(30), st = { r: 20 };
      let done = false; sfx('boom', 120);
      s.tweens.add({ targets: st, r: 210, duration: 1300, onUpdate: () => {
        if (!g.active) return;
        g.clear().lineStyle(5, 0xffd870, 0.85).strokeEllipse(cx, cy, st.r * 2, st.r * 1.5).lineStyle(2, 0xffffff, 0.9).strokeEllipse(cx, cy, st.r * 2, st.r * 1.5);
        const dx = s.hero.x - cx, dy = (s.hero.y + 8 - cy) / 0.75;
        if (!done && Math.abs(Math.hypot(dx, dy) - st.r) < 9) { done = true; hit(this, 0.9, 'chime'); }
      }, onComplete: () => g.destroy() });
    });
  },
  // 시계탑 수호자: 내가 '있었던' 자리를 때린다. 세 번 서로 다른 시각의 내 위치에 예고가 뜬다
  rewindpat() {
    const s = this.s, m = this.m;
    this.busy = 1600; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < 3; i++) s.time.delayedCall(i * 420, () => {
      if (!m.active) return;
      const x = s.hero.x, y = s.hero.y + 8;
      this.warnCircle(x, y, 34, 1300, () => { if (m.active) { this.thud(x, y, 0); if (this.inWarn(x, y, 34)) hit(this, 1.3, 'gear'); s.env?.ripple(x, y, 0xffd870); } });
    });
  },
  // 69차: 시계탑 수호자: 시계바늘 넷이 보스에서 십자로 뻗고, 곧 45도 돌아간 십자가 한 번 더(분노 직전엔 세 번). 바늘 사이로 서라
  clockhands(fast) {
    const s = this.s, m = this.m, a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y) + Math.PI / 4, n = fast ? 3 : 2, L = 260;
    this.busy = 900 + n * 750; m.setVelocity(0, 0); sfx('warn');
    for (let k = 0; k < n; k++) s.time.delayedCall(k * 750, () => {
      if (!m.active) return;
      const ox = m.x, oy = m.y;
      for (let i = 0; i < 4; i++) {
        const a = a0 + k * Math.PI / 4 + i * Math.PI / 2, ex = ox + Math.cos(a) * L, ey = oy + Math.sin(a) * L;
        lineWarn(this, ox, oy, a, L, 20, 900, () => { flashLine(s, ox, oy, ex, ey, 0xffd870); if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 12) hit(this, 1.0, 'gear'); });
      }
      sfx('boom', 120);
    });
  },
  // 시계탑 수호자: 톱니 세 개가 굴러가며 둘레를 돈다(몸집이 커서 피하기 쉽지 않다)
  gearsaw(fast) {
    const s = this.s, m = this.m, a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), n = fast ? 4 : 3;
    this.busy = 1000; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.55;
      s.time.delayedCall(250 + i * 220, () => {
        if (!m.active) return;
        const b = s.enemyShot(m.x, m.y, a, 105, m.dmg * 0.9).setTint(0xffd870).setScale(2.8);
        b.life = 3000; b.setAngularVelocity(420);
      });
    }
  },
  // 분노: 멈춘 시간. 내 둘레에 탄 고리가 멈춘 채 떠 있다가 2초 뒤 한꺼번에 안쪽으로 모인다(빈틈으로 빠져나가라)
  stoptime() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 3000; m.setVelocity(0, 0); sfx('warn');
    s.cameras.main.flash(300, 160, 200, 230); s.banner(t('lateEnv.f7ecc6'), t('lateEnv.6c9b07'));
    for (let k = 0; k < 2; k++) s.time.delayedCall(k * 1400, () => {
      if (!m.active) return;
      const cx = h.x, cy = h.y, n = 16, gap = R(0, n - 1), bs = [];
      for (let i = 0; i < n; i++) {
        if (Math.abs(((i - gap + n) % n)) < 2 || Math.abs(((i - gap + n) % n) - n) < 2) continue;   // 빈틈 둘
        const a = i / n * Math.PI * 2, b = s.enemyShot(cx + Math.cos(a) * 95, cy + Math.sin(a) * 71, 0, 0, m.dmg * 0.8).setTint(0xa0e8ff);
        b.setVelocity(0, 0); b.life = 6000; bs.push([b, a]);
      }
      s.time.delayedCall(1800, () => bs.forEach(([b, a]) => b.active && b.setVelocity(-Math.cos(a) * 95, -Math.sin(a) * 71)));
    });
  },
  // 해골 용왕: 숨결이 한쪽 끝에서 다른 쪽 끝으로 쓸고 지나간다(쓰는 반대쪽으로 비켜라)
  bonebreath(fast) {
    const s = this.s, m = this.m, a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), n = fast ? 7 : 5, dir = Math.random() < 0.5 ? 1 : -1;
    this.busy = 900 + n * 200; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) s.time.delayedCall(i * 200, () => {
      if (!m.active) return;
      const a = a0 + (i - (n - 1) / 2) * 0.24 * dir, ox = m.x, oy = m.y, ex = ox + Math.cos(a) * 270, ey = oy + Math.sin(a) * 270;
      lineWarn(this, ox, oy, a, 270, 22, 700, () => { flashLine(s, ox, oy, ex, ey, 0xc8a0ff); sfx('crit', 110); if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 13) hit(this, 0.9, 'breath'); });
    });
  },
  // 해골 용왕: 발밑에서 내 쪽으로 뼈 가시가 차례로 솟는다(분노 직전엔 세 줄)
  graverise(fast) {
    const s = this.s, m = this.m, a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), rows = fast ? [-0.32, 0, 0.32] : [0], n = 8;
    this.busy = 1300 + n * 110; m.setVelocity(0, 0); sfx('warn');
    for (const da of rows) for (let i = 0; i < n; i++) {
      const a = a0 + da, x = cl(m.x + Math.cos(a) * (40 + i * 34)), y = cl(m.y + Math.sin(a) * (40 + i * 34) * 0.85);
      s.time.delayedCall(i * 110, () => m.active && this.warnCircle(x, y, 20, 800, () => {
        if (!m.active) return;
        s.env?.ripple(x, y, 0xe8e0f0); if (i % 3 === 0) sfx('boom', 140);
        if (this.inWarn(x, y, 20)) hit(this, 1.0, 'bone');
      }));
    }
  },
  // 해골 용왕: 뼈 기둥이 나를 둘러싸 갇힌다(빈틈 한 곳). 곧 가운데에 큰 예고 원 — 빈틈으로 빠져나가라
  ribcage() {
    const s = this.s, m = this.m, h = s.hero, cx = h.x, cy = h.y, n = 12, gap = R(0, n - 1);
    this.busy = 2600; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      if ((i - gap + n) % n < 2) continue;
      const a = i / n * Math.PI * 2, x = cl(cx + Math.cos(a) * 92), y = cl(cy + Math.sin(a) * 69);
      this.warnCircle(x, y, 16, 900, () => {
        if (!m.active) return;
        if (this.inWarn(x, y, 16)) hit(this, 0.8, 'bone');
        const b = s.enemyShot(x, y, 0, 0, m.dmg * 0.7).setTint(0xe8e0f0).setScale(2.4); b.setVelocity(0, 0); b.life = 2600;
      });
    }
    s.time.delayedCall(1100, () => m.active && this.warnCircle(cx, cy, 58, 1100, () => { if (!m.active) return; this.thud(cx, cy, 0); if (this.inWarn(cx, cy, 58)) hit(this, 1.3, 'bone'); }));
  },
  // 분노: 용의 낙하. 하늘로 사라졌다가 내가 선 자리에 세 번 내리꽂힌다
  dragonfall() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 3000; m.setVelocity(0, 0); sfx('warn');
    s.banner(t('late19.rage'), t('late19.rageSub'));
    s.tweens.add({ targets: m, alpha: 0.1, y: m.y - 50, duration: 500 });
    let last = null;
    for (let k = 0; k < 3; k++) s.time.delayedCall(300 + k * 600, () => {
      if (!m.active) return;
      const x = cl(h.x), y = cl(h.y), r = 44; last = [x, y];
      this.warnCircle(x, y, r, 1000, () => {
        if (!m.active) return;
        this.thud(x, y, 0); if (this.inWarn(x, y, r)) hit(this, 1.2, 'bone');
        for (let i = 0; i < 8; i++) s.enemyShot(x, y, i / 8 * Math.PI * 2 + k * 0.2, 75, m.dmg * 0.6).setTint(0xe8e0f0);
      });
    });
    s.time.delayedCall(2500, () => { if (!m.active) return; m.setAlpha(1); if (last) m.setPosition(last[0], last[1] - 10); });
  },

  // 검은 왕: 내 둘레 3x3 칸이 두 번에 나눠 그림자로 덮인다(먼저 터진 칸으로 옮겨라)
  shadowgrid(fast) {
    const s = this.s, m = this.m, h = s.hero, cw = 64, ch = 48, cells = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) cells.push([h.x + i * cw, h.y + j * ch]);
    Phaser.Utils.Array.Shuffle(cells);
    const waves = [cells.slice(0, 5), cells.slice(5)];
    if (fast) waves.push(cells.slice(0, 5));
    this.busy = 700 + waves.length * 1100; m.setVelocity(0, 0); sfx('warn');
    waves.forEach((w, k) => s.time.delayedCall(k * 1100, () => {
      if (!m.active) return;
      for (const [x, y] of w) lineWarn(this, x - cw / 2, y, 0, cw, ch, 1050, () => {
        const r = s.add.rectangle(x, y, cw, ch, 0x401020, 0.6).setDepth(31);
        s.tweens.add({ targets: r, alpha: 0, duration: 260, onComplete: () => r.destroy() });
        if (Math.abs(s.hero.x - x) < cw / 2 && Math.abs(s.hero.y - y) < ch / 2) hit(this, 1.0, 'royal');
      });
      sfx('boom', 140);
    }));
  },
  // 검은 왕: 내 자리에 십자 칼날(분노 직전엔 X자가 한 번 더)
  kingsword(fast) {
    const s = this.s, m = this.m, h = s.hero, x = h.x, y = h.y, L = 340;
    this.busy = fast ? 2000 : 1300; m.setVelocity(0, 0); sfx('warn');
    const cross = (angs, delay) => s.time.delayedCall(delay, () => {
      if (!m.active) return;
      for (const a of angs) {
        const ox = x - Math.cos(a) * L / 2, oy = y - Math.sin(a) * L / 2, ex = x + Math.cos(a) * L / 2, ey = y + Math.sin(a) * L / 2;
        lineWarn(this, ox, oy, a, L, 24, 900, () => { flashLine(s, ox, oy, ex, ey, 0xff6a5a); sfx('crit', 110); if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 13) hit(this, 1.1, 'royal'); });
      }
    });
    cross([0, Math.PI / 2], 0);
    if (fast) cross([Math.PI / 4, -Math.PI / 4], 700);
  },
  // 69차: 검은 왕: 외통수. 내 대각선 네 칸이 먼저 터지고, 곧 내가 섰던 가운데가 터진다(가로·세로로 한 칸 비켜라)
  checkmate(fast) {
    const s = this.s, m = this.m, h = s.hero, cx = cl(h.x), cy = cl(h.y), r = 30, pts = [];
    this.busy = 1900; m.setVelocity(0, 0); sfx('warn');
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cl(cx + i * 58), y = cl(cy + j * 44);
      pts.push([x, y]);
      this.warnCircle(x, y, r, 900, () => { if (!m.active) return; this.thud(x, y, 0); if (this.inWarn(x, y, r)) hit(this, 1.0, 'royal'); });
    }
    topRings(s, pts, r, 900, 0xff5060, true);
    const d2 = fast ? 500 : 650;
    s.time.delayedCall(d2, () => { if (!m.active) return; topRings(s, [[cx, cy]], r + 6, 900, 0xffe060); this.warnCircle(cx, cy, r + 6, 900, () => { if (!m.active) return; this.thud(cx, cy, 0); if (this.inWarn(cx, cy, r + 6)) hit(this, 1.2, 'royal'); }); });
  },
  // 검은 왕: 붉은 마법진이 나를 1.1초 따라오다 멈춰 터진다(두 번). 그림자 분신 둘을 부른다
  sigil() {
    const s = this.s, m = this.m, h = s.hero, r = 42;
    this.busy = 2400; m.setVelocity(0, 0); sfx('warn');
    for (let k = 0; k < 2; k++) s.time.delayedCall(k * 900, () => {
      if (!m.active) return;
      const g = s.add.graphics().setDepth(9), st = { f: 0 };
      let x = h.x, y = h.y;
      s.tweens.add({ targets: st, f: 1, duration: 1100, onUpdate: () => { if (!g.active) return; x = h.x; y = h.y; g.clear().lineStyle(2, 0xff4050, 0.5 + 0.5 * Math.abs(Math.sin(st.f * 10))).strokeEllipse(x, y, r * 2, r * 1.5); }, onComplete: () => {
        g.destroy();
        if (m.active) this.warnCircle(x, y, r, 550, () => { if (!m.active) return; this.thud(x, y, 0); if (this.inWarn(x, y, r)) hit(this, 1.3, 'royal'); });
      } });
    });
    s.time.delayedCall(400, () => {
      if (!m.active || s.over || s.mobs.countActive() >= 50) return;
      for (let i = 0; i < 2; i++) { const a = RF(0, 6.28); s.spawn(false, 'shade', { force: true, mini: true, at: { x: cl(h.x + Math.cos(a) * 150), y: cl(h.y + Math.sin(a) * 110) } }); }
    });
  },
  // 분노: 왕관의 시선. 네 모서리에서 붉은 빛줄기가 두 번 나를 겨누고, 이어서 그림자 칸
  crownfall() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 3400; m.setVelocity(0, 0); sfx('warn');
    s.cameras.main.flash(300, 120, 20, 30); s.banner(t('late20.rage'), t('late20.rageSub'));
    for (let k = 0; k < 2; k++) s.time.delayedCall(k * 900, () => {
      if (!m.active) return;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4 + k * Math.PI / 4, ox = cl(h.x + Math.cos(a) * 190), oy = cl(h.y + Math.sin(a) * 150), b = Math.atan2(h.y - oy, h.x - ox), ex = ox + Math.cos(b) * 380, ey = oy + Math.sin(b) * 380;
        lineWarn(this, ox, oy, b, 380, 20, 900, () => { flashLine(s, ox, oy, ex, ey, 0xff6a5a); sfx('crit', 110); if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < 12) hit(this, 1.0, 'gaze'); });
      }
    });
    s.time.delayedCall(1900, () => m.active && LATE_PATTERNS.shadowgrid.call(this, false));
  },
};
