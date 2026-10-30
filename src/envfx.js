// 6장부터의 장 기믹(지형·환경)과 몹 고유 행동(MOBS의 fx), 새 보스 패턴을 모아 둔 곳.
// Battle.js는 아래 훅만 부른다: makeEnv(scene) → env.update(dt) · env.spdMul() · env.vel() · env.mobInit(m) · env.mobTick(m, dt) · env.mobKill(m) · env.shot(m, ang)
// 장 기믹(CHAPTERS[c].env): tide 물웅덩이 · fog 독안개 · beam 수정 레이저 · wind 바람 · abyss 어둠
import * as D from './data.js';
import { sfx } from './sfx.js';
import { font } from './ui.js';

const WORLD = 1600;
const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Env {
  constructor(s) {
    this.s = s; this.kind = s.endless || s.dungeon ? null : s.ch.env || null;
    this.base = 6 * s.mobDmgMul;           // 지형 피해의 바탕(몹 한 마리 피해쯤)
    this.puddles = []; this.clouds = []; this.imp = []; this.pillars = []; this.pits = []; this.vents = []; this.haz = []; this.boltT = 3500; this.boltBoost = 0;
    this.slowT = 0; this.tickT = 0; this.blackT = 0; this.baseDark = s.darkA;
    this.gfx = s.add.graphics().setDepth(8);
    this.gfxTop = s.add.graphics().setDepth(28);
    this.light = s.make.image({ key: 'light', add: false });
    this.lightK = 1;
    const c = WORLD / 2;
    if (this.kind === 'tide') for (let i = 0; i < 7; i++) this.addPuddle(...this.farPoint(150, 560), RF(24, 34), Infinity);
    if (this.kind === 'fog') for (let i = 0; i < 4; i++) {
      const p = this.farPoint(110, 520), a = RF(0, 6.28);
      this.clouds.push({ x: p[0], y: p[1], r: 36, life: Infinity, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, drift: true });
    }
    if (this.kind === 'beam') {
      const o = RF(0, 6.28);
      for (let i = 0; i < 3; i++) {
        const a = o + i * Math.PI * 2 / 3;
        this.pillars.push({ x: c + Math.cos(a) * 230, y: c + Math.sin(a) * 230, a: a + 1, w: (i % 2 ? -1 : 1) * RF(0.5, 0.65), len: 150 });
      }
      this.pillars.forEach(p => { p.img = s.add.ellipse(p.x, p.y, 14, 8, 0xc080ff).setStrokeStyle(2, 0xffffff, 0.9).setDepth(10 + p.y / WORLD); p.img.setOrigin(0.5, 1); });
    }
    if (this.kind === 'wind') {
      this.wind = { a: 0, k: 0, next: 3500, blow: false };
      this.windTxt = s.add.text(D.W / 2, 112, '', font(9, '#e8f4ff')).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
      this.streaks = s.add.graphics().setDepth(27);
    }
    if (this.kind === 'abyss') this.lightK = 0.6;
    if (this.kind === 'sand') for (let i = 0; i < 5; i++) { const q = this.farPoint(140, 560); this.pits.push({ x: q[0], y: q[1], r: 34, life: Infinity }); }
    if (this.kind === 'steam') for (let i = 0; i < 5; i++) { const q = this.farPoint(110, 540); this.vents.push({ x: q[0], y: q[1], r: 26, t: 600 + i * 900, ph: 'idle' }); }
    if (this.kind === 'mirror') {
      for (let i = 0; i < 2; i++) { const a = i * Math.PI; this.pillars.push({ x: c + Math.cos(a) * 200, y: c + Math.sin(a) * 200, a: a + 1.6, w: i ? -0.55 : 0.55, len: 170, mirror: true }); }
      this.pillars.forEach(p => { p.img = s.add.ellipse(p.x, p.y, 14, 8, 0x80ffe0).setStrokeStyle(2, 0xffffff, 0.9).setDepth(10 + p.y / WORLD).setOrigin(0.5, 1); });
    }
    // 이 장의 규칙을 처음에 한 번 알린다
    if (this.kind && !s.bot) s.time.delayedCall(2100, () => !s.over && s.banner('이 장의 규칙', s.ch.note.split(' · ')[0]));
  }

  farPoint(min, max) {
    const c = WORLD / 2;
    for (let i = 0; i < 20; i++) {
      const x = R(80, WORLD - 80), y = R(80, WORLD - 80), d = Math.hypot(x - c, y - c);
      if (d > min && d < max) return [x, y];
    }
    return [c + 300, c];
  }

  // ── 면역·경감 ──
  petIs(id) { return this.s.pet?.def?.id === id; }
  fx4(k) { return this.s.gear.fx.has(k); }

  addPuddle(x, y, r, life) { this.puddles.push({ x, y, r, life, born: this.s.bt }); }
  cloud(x, y, r, life) {
    const n = this.clouds.filter(c => !c.drift).length;
    if (n >= 14) { const i = this.clouds.findIndex(c => !c.drift); this.clouds.splice(i, 1); }
    this.clouds.push({ x, y, r, life, vx: 0, vy: 0, drift: false });
  }
  impulse(vx, vy, ms) { this.imp.push({ x: vx, y: vy, t: ms }); }
  blackout(ms) { this.blackT = ms; }

  spdMul() { return this.slowT > 0 && !this.petIs('tidewyrm') && !this.fx4('tide4') ? 0.55 : 1; }
  vel() {
    let x = 0, y = 0;
    for (const i of this.imp) { x += i.x; y += i.y; }
    if (this.wind && this.wind.k > 0.02) {
      const f = this.fx4('sky4') ? 0 : this.petIs('stormcaptain') ? 0.5 : 1, v = D.PLAYER.spd * 0.5 * this.wind.k * f;
      x += Math.cos(this.wind.a) * v; y += Math.sin(this.wind.a) * v;
    }
    return { x, y };
  }

  hurtEnv(mul, src) {
    const s = this.s;
    const imm = { sand: 'sandcolossus', vent: 'steamgeneral', steam: 'steamgeneral', bolt: 'thunderdragon', laser: 'mirrorlord', fire: 'forgegod' }[src];
    if (imm && this.petIs(imm)) return;
    let k = 1;
    if (this.fx4('crystal4') && (src === 'laser' || src === 'bolt')) k *= 0.6;
    if (this.fx4('steam4') && (src === 'vent' || src === 'steam' || src === 'fire' || src === 'bolt')) k *= 0.5;
    if (this.fx4('mirror4') && (src === 'laser' || src === 'reflect')) k *= 0.5;
    s.hurt(this.base * mul * k, src);
  }

  addHaz(x, y, r, life, mul, src, col) { this.haz.push({ x, y, r, life, mul, src, col, tk: 0 }); }
  addPit(x, y, r, life) { this.pits.push({ x, y, r, life }); }
  // 예고 원(빨강) → ms 뒤 onBoom
  warn(x, y, r, ms, onBoom) {
    const s = this.s, g = s.add.graphics().setDepth(9), st = { f: 0 };
    s.tweens.add({ targets: st, f: 1, duration: ms, onUpdate: () => { g.clear().fillStyle(0xff2030, 0.2).fillEllipse(x, y, r * 2, r * 1.5).lineStyle(2, 0xff4050, 0.5 + 0.5 * Math.abs(Math.sin(st.f * 12))).strokeEllipse(x, y, r * 2, r * 1.5); }, onComplete: () => { g.destroy(); if (!s.over) onBoom(); } });
  }
  inEll(x, y, r) { const h = this.s.hero, dx = (h.x - x) / r, dy = (h.y + 8 - y) / (r * 0.75); return dx * dx + dy * dy <= 1; }
  // 낙뢰: 예고 → 번개
  strike(x, y, r = 26, ms = 900) {
    this.warn(x, y, r, ms, () => {
      const s = this.s, l = s.add.line(0, 0, x, y - 140, x, y, 0xe8f0ff, 1).setOrigin(0).setLineWidth(4).setBlendMode(Phaser.BlendModes.ADD).setDepth(32);
      s.tweens.add({ targets: l, alpha: 0, duration: 260, onComplete: () => l.destroy() });
      s.cameras.main.flash(60, 220, 230, 255); sfx('crit', 90);
      if (this.inEll(x, y, r)) this.hurtEnv(1.5, 'bolt');
    });
  }

  update(dt) {
    const s = this.s, h = s.hero;
    if (this.blackT > 0) { this.blackT -= dt; }
    const wantDark = this.blackT > 0 ? 0.93 : this.baseDark;
    s.darkA += (wantDark - s.darkA) * Math.min(1, dt / 220);
    this.imp = this.imp.filter(i => (i.t -= dt) > 0);
    this.slowT = Math.max(0, this.slowT - dt);
    const g = this.gfx; g.clear();
    // 웅덩이(느려짐)
    this.puddles = this.puddles.filter(p => p.life === Infinity || (p.life -= dt) > 0);
    for (const p of this.puddles) {
      const a = p.life === Infinity ? 0.38 : Math.min(0.38, p.life / 1500 * 0.38);
      g.fillStyle(0x2ab8c8, a).fillEllipse(p.x, p.y, p.r * 2, p.r * 1.5).lineStyle(1.5, 0xa8fff4, a + 0.2).strokeEllipse(p.x, p.y, p.r * 2, p.r * 1.5);
      const w = 0.6 + 0.4 * Math.sin((s.bt + p.x) / 380);
      g.lineStyle(1, 0xe0fffa, a * w).strokeEllipse(p.x, p.y, p.r * 1.2, p.r * 0.9);
      const dx = (h.x - p.x) / p.r, dy = (h.y + 8 - p.y) / (p.r * 0.75);
      if (dx * dx + dy * dy < 1) this.slowT = 160;
    }
    // 독구름(움직이는 것·남은 것)
    this.tickT -= dt;
    const tick = this.tickT <= 0; if (tick) this.tickT = 650;
    this.clouds = this.clouds.filter(c => c.life === Infinity || (c.life -= dt) > 0);
    for (const c of this.clouds) {
      if (c.drift) {
        c.x += c.vx * dt / 1000; c.y += c.vy * dt / 1000;
        if (c.x < 90 || c.x > WORLD - 90) c.vx *= -1; if (c.y < 90 || c.y > WORLD - 90) c.vy *= -1;
        // 가끔 플레이어 쪽으로 슬쩍 방향을 튼다
        if (Math.random() < dt / 9000) { const a = Math.atan2(h.y - c.y, h.x - c.x) + RF(-0.8, 0.8); c.vx = Math.cos(a) * 9; c.vy = Math.sin(a) * 9; }
      }
      const a = c.life === Infinity ? 0.34 : Math.min(0.34, c.life / 1200 * 0.34);
      const wob = 1 + 0.06 * Math.sin((s.bt + c.x) / 300);
      g.fillStyle(0x7ad040, a).fillEllipse(c.x, c.y, c.r * 2 * wob, c.r * 1.5 * wob).fillStyle(0xb8ff70, a * 0.6).fillEllipse(c.x - c.r * 0.2, c.y - c.r * 0.1, c.r * 1.1, c.r * 0.8)
        .lineStyle(1.5, 0xd8ff90, a + 0.15).strokeEllipse(c.x, c.y, c.r * 2 * wob, c.r * 1.5 * wob);
      const dx = (h.x - c.x) / c.r, dy = (h.y + 8 - c.y) / (c.r * 0.75);
      if (tick && dx * dx + dy * dy < 1 && !this.petIs('swampqueen')) this.hurtEnv(this.fx4('tide4') ? 0.4 : 0.8, 'poison');
    }
    // 수정 레이저
    const gt = this.gfxTop; gt.clear();
    for (const p of this.pillars) {
      p.a += p.w * dt / 1000;
      const ex = p.x + Math.cos(p.a) * p.len, ey = p.y + Math.sin(p.a) * p.len;
      gt.lineStyle(9, p.mirror ? 0x60ffe0 : 0xc080ff, 0.28).lineBetween(p.x, p.y - 8, ex, ey).lineStyle(3, p.mirror ? 0xe8fff8 : 0xffe8ff, 0.95).lineBetween(p.x, p.y - 8, ex, ey);
      p.img.setDepth(10 + p.y / WORLD);
      // 점과 선분 사이 거리
      const vx = ex - p.x, vy = ey - (p.y - 8), wx = h.x - p.x, wy = h.y - (p.y - 8);
      const t = Phaser.Math.Clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
      if (Math.hypot(wx - vx * t, wy - vy * t) < 8 && s.bt - (p.hitT || -1e9) > 500) { p.hitT = s.bt; this.hurtEnv(1.3, 'laser'); }
    }
    // 바람: 방향이 바뀌기 1.4초 전에 화살표로 알린다
    if (this.wind) this.updateWind(dt);
    this.updateMore(dt);
  }

  updateMore(dt) {
    const s = this.s, h = s.hero, g = this.gfx;
    // 유사 구덩이: 가운데로 끌어당기고 느려진다
    this.pits = this.pits.filter(p => p.life === Infinity || (p.life -= dt) > 0);
    for (const p of this.pits) {
      const a = p.life === Infinity ? 0.5 : Math.min(0.5, p.life / 1200 * 0.5);
      g.fillStyle(0x6a4a20, a).fillEllipse(p.x, p.y, p.r * 2, p.r * 1.5).fillStyle(0x2a1a08, a).fillEllipse(p.x, p.y, p.r, p.r * 0.75).lineStyle(1.5, 0xe0c080, a + 0.2).strokeEllipse(p.x, p.y, p.r * 2, p.r * 1.5);
      const dx = p.x - h.x, dy = p.y - (h.y + 8), d = Math.hypot(dx, dy);
      if (this.inEll(p.x, p.y, p.r * 1.5) && !this.petIs('sandcolossus')) {
        this.impulse(dx / (d || 1) * 62, dy / (d || 1) * 62, 60);
        if (this.inEll(p.x, p.y, p.r * 0.5)) this.slowT = 160;
      }
    }
    // 증기 분출구: 쉬다가 → 예고(1.1초) → 분출(0.6초)
    for (const v of this.vents) {
      v.t -= dt;
      if (v.ph === 'idle' && v.t <= 0) { v.ph = 'warn'; v.t = 1100; sfx('warn', 200); }
      else if (v.ph === 'warn' && v.t <= 0) { v.ph = 'burst'; v.t = 650; v.hit = false; }
      else if (v.ph === 'burst' && v.t <= 0) { v.ph = 'idle'; v.t = 2800 + R(0, 900); }
      if (v.ph === 'idle') g.fillStyle(0x303038, 0.7).fillEllipse(v.x, v.y, 16, 9).lineStyle(1, 0xa0a0b0, 0.8).strokeEllipse(v.x, v.y, 16, 9);
      else if (v.ph === 'warn') g.fillStyle(0xff2030, 0.2).fillEllipse(v.x, v.y, v.r * 2, v.r * 1.5).lineStyle(2, 0xff4050, 0.5 + 0.5 * Math.abs(Math.sin(s.bt / 70))).strokeEllipse(v.x, v.y, v.r * 2, v.r * 1.5);
      else {
        g.fillStyle(0xf0f0f8, 0.55).fillEllipse(v.x, v.y - 8, v.r * 1.6, v.r * 2.2).fillStyle(0xffffff, 0.4).fillEllipse(v.x, v.y - 18, v.r * 1.1, v.r * 1.8);
        if (!v.hit && this.inEll(v.x, v.y, v.r)) { v.hit = true; this.hurtEnv(1.3, 'vent'); }
      }
    }
    // 낙뢰(폭풍 평원 · 대장간)
    if (this.kind === 'storm' || this.kind === 'forge') {
      this.boltT -= dt * (this.boltBoost > 0 ? 2.4 : 1);
      this.boltBoost = Math.max(0, this.boltBoost - dt);
      if (this.boltT <= 0) {
        this.boltT = this.kind === 'forge' ? 3400 : 2400;
        // 먹구름 설인이 가까이 있으면 번개가 그쪽으로 몰린다
        const yeti = s.mobs.getChildren().find(m => m.active && !m.dead && m.fx === 'lure' && dist(m, h) < 230);
        const tx = yeti && Math.random() < 0.6 ? yeti.x + R(-16, 16) : h.x + R(-90, 90), ty = yeti && Math.random() < 0.6 ? yeti.y + R(-10, 10) : h.y + R(-70, 70);
        this.strike(Phaser.Math.Clamp(tx, 40, WORLD - 40), Phaser.Math.Clamp(ty, 40, WORLD - 40));
      }
    }
    // 불 균열(대장간): 주기적으로 불웅덩이가 열린다
    if (this.kind === 'forge') {
      this.fireT = (this.fireT ?? 2500) - dt;
      if (this.fireT <= 0) { this.fireT = 4200; const x = h.x + R(-110, 110), y = h.y + R(-90, 90); this.warn(x, y, 30, 1100, () => this.addHaz(x, y, 30, 6000, 0.7, 'fire', 0xff8a2a)); }
    }
    // 남는 장판(불·증기 등)
    this.haz = this.haz.filter(z => (z.life -= dt) > 0);
    for (const z of this.haz) {
      const a = Math.min(0.42, z.life / 1200 * 0.42);
      g.fillStyle(z.col, a).fillEllipse(z.x, z.y, z.r * 2, z.r * 1.5).lineStyle(1.5, 0xffe0a0, a + 0.2).strokeEllipse(z.x, z.y, z.r * 2, z.r * 1.5);
      z.tk -= dt;
      if (z.tk <= 0) { z.tk = 450; if (this.inEll(z.x, z.y, z.r * 0.9)) this.hurtEnv(z.mul, z.src); }
    }
  }

  updateWind(dt) {
    const w = this.wind, s = this.s, ar = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const pick = cur => { let a; do { a = R(0, 3) * Math.PI / 2; } while (Math.abs(Phaser.Math.Angle.Wrap(a - cur)) < 0.1); return a; };
    if (w.pa === undefined) w.pa = pick(w.a);
    w.next -= dt;
    if (w.next <= 0) {
      if (!w.blow) { w.blow = true; w.next = 3800; w.a = w.pa; }
      else { w.blow = false; w.next = 2800; w.pa = pick(w.a); }
    }
    w.k += ((w.blow ? 1 : 0) - w.k) * Math.min(1, dt / 350);
    const warn = !w.blow && w.next < 1500, show = w.blow || warn;
    const a = warn ? w.pa : w.a, idx = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    this.windTxt.setAlpha(show ? 1 : 0).setText(`${w.blow ? '바람' : '곧 바람'} ${ar[idx]}`);
    const g = this.streaks.clear();
    if (w.k > 0.1) {
      const cam = s.cameras.main, cx = Math.cos(w.a), cy = Math.sin(w.a);
      for (let i = 0; i < 14; i++) {
        const ph = ((s.bt * 0.35 + i * 53) % 280) / 280, ox = (i * 83) % 270, oy = (i * 131) % 480;
        const x = cam.scrollX + ox + cx * ph * 90, y = cam.scrollY + oy + cy * ph * 90;
        g.lineStyle(1, 0xffffff, 0.5 * w.k * (1 - ph)).lineBetween(x, y, x + cx * 12, y + cy * 12);
      }
    }
  }

  // ── 몹 ──
  mobInit(m) {
    m.fx = D.MOBS[m.kind]?.fx;
    if (m.mini && ['split', 'clone', 'revive'].includes(m.fx)) m.fx = null;
    if (m.fx === 'overclock') m.spd0 = m.spd;
  }

  mobTick(m, dt) {
    const s = this.s, h = s.hero;
    if (!m.fx && this.kind !== 'abyss') return;
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    // 심연: 멀리 있는 몹은 어둠에 묻힌다(시야 밖은 윤곽만)
    if (this.kind === 'abyss' && !m.isBoss && !m.dive) {
      const sight = 150 * (this.fx4('sky4') ? 1.4 : this.petIs('voidlord') ? 1.25 : 1);
      let a = d > sight ? 0.22 : d > sight * 0.7 ? 0.22 + (sight - d) / (sight * 0.3) * 0.78 : 1;
      if (m.fx === 'cloak') { const cs = sight * 0.7; a = d > cs ? 0.06 : d > cs * 0.75 ? 0.5 : 1; }
      m.setAlpha(a);
    }
    switch (m.fx) {
      case 'dive': {
        m.diveT = (m.diveT ?? RF(1200, 3000)) - dt;
        if (m.diveT <= 0) {
          m.dive = !m.dive;
          m.diveT = m.dive ? 1400 : RF(3000, 4200);
          m.setAlpha(m.dive ? 0.14 : 0.85);
          if (m.dive) m.setTint(0x3060ff); else { m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); }
          this.ripple(m.x, m.y);
        }
        break;
      }
      case 'burrow': {
        m.diveT = (m.diveT ?? RF(1500, 3500)) - dt;
        if (m.diveT <= 0) {
          m.dive = !m.dive;
          if (m.dive) { m.diveT = 1100; m.setAlpha(0.12); this.ripple(m.x, m.y, 0xe0c080); }
          else {
            m.diveT = RF(3600, 5000); m.setAlpha(1);
            const a = RF(0, 6.28); m.setPosition(Phaser.Math.Clamp(h.x + Math.cos(a) * 58, 20, WORLD - 20), Phaser.Math.Clamp(h.y + Math.sin(a) * 58, 20, WORLD - 20));
            this.ripple(m.x, m.y, 0xe0c080); m.cd = 700;
          }
        }
        break;
      }
      case 'blink': {
        m.blinkT = (m.blinkT ?? RF(2500, 4500)) - dt;
        if (m.blinkT <= 0 && d > 70) {
          m.blinkT = 4200; this.ripple(m.x, m.y, 0x80e8d8);
          const a = Math.atan2(m.y - h.y, m.x - h.x) + Math.PI;
          m.setPosition(Phaser.Math.Clamp(h.x + Math.cos(a) * 80, 20, WORLD - 20), Phaser.Math.Clamp(h.y + Math.sin(a) * 80, 20, WORLD - 20));
          this.ripple(m.x, m.y, 0x80e8d8);
        }
        break;
      }
      case 'overclock': {
        const k = Math.min(1, m.t / 12000);
        m.spd = m.spd0 * (1 + k);
        if (k > 0.65 && !m.hot) { m.hot = true; m.baseTint = 0xff9060; m.setTint(0xff9060); }
        break;
      }
      case 'brace': {
        m.braceT = (m.braceT ?? RF(1500, 4000)) - dt;
        if (m.braceT <= 0) { m.brace = !m.brace; m.braceT = m.brace ? 1600 : 4200; m.weak = m.brace ? 0.3 : 1; if (m.brace) m.setTint(0x80b0ff); else { m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); } }
        break;
      }
      case 'parry': {
        m.parryT = (m.parryT ?? RF(1500, 3500)) - dt;
        if (m.parryT <= 0) { m.parryT = 4200; m.parryUntil = s.bt + 1300; m.setTintFill(0xffffff); s.time.delayedCall(1300, () => { if (m.active && !m.dead) { m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); } }); }
        else if (m.parryUntil > s.bt && Math.floor(s.bt / 120) % 2) m.setTint(0xc8fff0);
        break;
      }
      case 'clone': {
        m.cloneT = (m.cloneT ?? RF(3000, 5000)) - dt;
        if (m.cloneT <= 0 && s.mobs.countActive() < 60) {
          m.cloneT = 7000;
          const c = s.spawn(true, m.kind, { force: true, mini: true, at: { x: m.x + R(-30, 30), y: m.y + R(-30, 30) } });
          if (c) { c.setAlpha(0.6); c.setTint(0xa0ffa0); c.baseTint = 0xa0ffa0; this.ripple(c.x, c.y, 0xa0ffa0); }
        }
        break;
      }
      case 'spore': {
        if (m.t - (m.sporeT || 0) > 700) { m.sporeT = m.t; this.cloud(m.x, m.y + 4, 15, 3200); }
        break;
      }
      case 'gust': {
        m.gustCd = (m.gustCd ?? RF(1000, 2500)) - dt;
        if (m.gustWind > 0) {
          m.gustWind -= dt;
          if (m.gustWind <= 0) {
            m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint);
            if (Math.hypot(h.x - m.x, h.y - m.y) < 100) { const a = Math.atan2(h.y - m.y, h.x - m.x); this.impulse(Math.cos(a) * 190, Math.sin(a) * 190, 380); this.ripple(m.x, m.y, 0xe8f4ff); sfx('shoot', 120); }
          }
        } else if (m.gustCd <= 0 && d < 95) { m.gustCd = 3200; m.gustWind = 380; m.setTintFill(0xe8f4ff); }
        break;
      }
    }
  }

  ripple(x, y, col = 0xa8fff4) {
    const r = this.s.add.image(x, y + 6, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(0.2, 0.12).setDepth(9).setAlpha(0.9);
    this.s.tweens.add({ targets: r, scaleX: 0.9, scaleY: 0.5, alpha: 0, duration: 420, onComplete: () => r.destroy() });
  }

  // 맞았을 때: 빛나는 되받기 몹·보스를 치면 내가 다친다
  onHit(m) {
    if (m.parryUntil > this.s.bt) this.s.env.hurtEnv(0.9, 'reflect');
  }

  // 몹이 쓰러질 때
  mobKill(m) {
    const s = this.s;
    switch (m.fx) {
      case 'pool': this.addPuddle(m.x, m.y + 6, 20, 5000); break;
      case 'revive': {
        if (m.mini) break;
        const x = m.x, y = m.y, b = s.add.ellipse(x, y + 4, 14, 6, 0xe0c080, 0.6).setDepth(8);
        s.time.delayedCall(1500, () => { b.destroy(); if (s.over) return; const r = s.spawn(true, m.kind, { force: true, mini: true, at: { x, y } }); if (r) { r.fx = null; this.ripple(x, y, 0xe0c080); } });
        break;
      }
      case 'steamdie': this.addHaz(m.x, m.y + 4, 22, 3000, 0.6, 'steam', 0xe8e8f0); break;
      case 'firepool': this.addHaz(m.x, m.y + 6, 24, 5000, 0.7, 'fire', 0xff8a2a); break;
      case 'zap': { const x = m.x, y = m.y; this.warn(x, y, 30, 700, () => { this.ripple(x, y, 0xc8d8ff); if (this.inEll(x, y, 30)) this.hurtEnv(1.2, 'zap'); }); break; }
      case 'anvil': { const x = m.x, y = m.y; this.warn(x, y, 28, 950, () => { s.cameras.main.shake(120, 0.008); this.ripple(x, y, 0xffd75e); sfx('boom', 120); if (this.inEll(x, y, 28)) this.hurtEnv(1.5, 'anvil'); }); break; }
      case 'shard': {
        // 수정 골렘: 깨지며 파편이 사방으로 튄다
        const a0 = RF(0, 6.28);
        for (let i = 0; i < 6; i++) s.enemyShot(m.x, m.y, a0 + i * Math.PI / 3, 85, m.dmg * 0.7).setTint(0xc890ff);
        break;
      }
      case 'split': {
        if (m.mini) break;
        for (const d of [-8, 8]) s.spawn(true, m.kind, { force: true, mini: true, at: { x: m.x + d, y: m.y + R(-4, 4) } });
        break;
      }
    }
  }

  // 원거리 몹 발사를 가로챈다(처리했으면 true)
  shot(m, ang) {
    const s = this.s;
    if (m.fx === 'aimline') {
      const g = s.add.graphics().setDepth(9).lineStyle(2, 0xff4050, 0.8).lineBetween(m.x, m.y, m.x + Math.cos(ang) * 200, m.y + Math.sin(ang) * 200);
      s.time.delayedCall(550, () => { g.destroy(); if (m.active && !m.dead && !s.over) s.enemyShot(m.x, m.y, ang, 160, m.dmg * 1.2).setTint(0x80d0ff); });
      return true;
    }
    if (m.fx === 'homing') {
      const b = s.enemyShot(m.x, m.y, ang, 52, m.dmg).setTint(0xa0f0b0);
      b.life = 3200;
      const ev = s.time.addEvent({ delay: 90, repeat: 28, callback: () => {
        if (!b.active) { ev.remove(); return; }
        const t = Phaser.Math.Angle.Between(b.x, b.y, s.hero.x, s.hero.y), c = Math.atan2(b.body.velocity.y, b.body.velocity.x);
        const n = c + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(t - c), -0.3, 0.3);
        b.setVelocity(Math.cos(n) * 52, Math.sin(n) * 52);
      } });
      return true;
    }
    if (m.fx !== 'prism') return false;
    // 프리즘 정령: 탄이 날아가다 셋으로 갈라진다
    const b = s.enemyShot(m.x, m.y, ang, 70, m.dmg).setTint(0x80ffd0);
    s.time.delayedCall(520, () => {
      if (!b.active || s.over) return;
      const x = b.x, y = b.y;
      b.destroy();
      for (let i = -1; i <= 1; i++) s.enemyShot(x, y, ang + i * 0.45, 70, m.dmg * 0.7).setTint(0x80ffd0);
    });
    return true;
  }
}

export function makeEnv(s) { return new Env(s); }

// ── 보스 패턴(BossAI.prototype에 섞는다) ──
// 띠 파도: 중심 (cx,cy)에서 ang 방향으로 길이 len, 두께 thick인 띠가 ms 동안 예고된 뒤 달려간다
function bandWave(boss, cx, cy, ang, len, thick, warnMs, sweepMs, dmgMul) {
  const s = boss.s, m = boss.m, g = s.add.graphics().setDepth(9);
  const c = Math.cos(ang), sn = Math.sin(ang), nx = -sn, ny = c;
  const sx = cx - c * len / 2, sy = cy - sn * len / 2;
  // 진행 방향 ang, 띠의 폭(진행에 수직) 380 · 두께 thick
  const W2 = 190;
  const path = [{ x: sx + nx * W2, y: sy + ny * W2 }, { x: sx + c * len + nx * W2, y: sy + sn * len + ny * W2 }, { x: sx + c * len - nx * W2, y: sy + sn * len - ny * W2 }, { x: sx - nx * W2, y: sy - ny * W2 }];
  g.fillStyle(0xff2030, 0.14).fillPoints(path, true).lineStyle(1.5, 0xff4050, 0.7).strokePoints(path, true);
  sfx('warn');
  const st = { f: 0 };
  s.tweens.add({ targets: g, alpha: { from: 0.5, to: 1 }, duration: 220, yoyo: true, repeat: Math.floor(warnMs / 440) });
  s.time.delayedCall(warnMs, () => {
    if (!m.active || s.over) { g.destroy(); return; }
    g.clear().setAlpha(1);
    let hit = false;
    s.tweens.add({
      targets: st, f: 1, duration: sweepMs,
      onUpdate: () => {
        if (!g.active) return;
        const px = sx + c * len * st.f, py = sy + sn * len * st.f;
        const a = { x: px + nx * W2, y: py + ny * W2 }, b = { x: px - nx * W2, y: py - ny * W2 };
        const back = { x: a.x - c * thick, y: a.y - sn * thick }, back2 = { x: b.x - c * thick, y: b.y - sn * thick };
        g.clear().fillStyle(0x5ae0d0, 0.5).fillPoints([a, b, back2, back], true).lineStyle(3, 0xe0fffa, 1).lineBetween(a.x, a.y, b.x, b.y);
        const dx = s.hero.x - px, dy = s.hero.y - py, along = dx * c + dy * sn, side = dx * nx + dy * ny;
        if (!hit && along < 6 && along > -thick - 4 && Math.abs(side) < W2) { hit = true; s.hurt(m.dmg * dmgMul); }
      },
      onComplete: () => g.destroy(),
    });
  });
}

function sectorBeams(boss, n, arm, rot, warnMs, sweepMs, len, dmgMul) {
  const s = boss.s, m = boss.m, a0 = Math.random() * 6.28, dir = Math.random() < 0.5 ? -1 : 1, g = s.add.graphics().setDepth(9), st = { a: 0 };
  const ox = m.x, oy = m.y;
  const lines = a => { for (let i = 0; i < n; i++) { const t = a0 + a * dir + i * arm; g.lineBetween(ox, oy, ox + Math.cos(t) * len, oy + Math.sin(t) * len); } };
  g.lineStyle(2, 0xff4050, 0.8); lines(0); sfx('warn');
  s.time.delayedCall(warnMs, () => {
    if (!m.active || s.over) { g.destroy(); return; }
    const hitAt = {};
    s.tweens.add({
      targets: st, a: rot, duration: sweepMs,
      onUpdate: () => {
        if (!g.active) return;
        g.clear().lineStyle(10, 0xc080ff, 0.45); lines(st.a); g.lineStyle(3.5, 0xffe8ff, 1); lines(st.a);
        const dx = s.hero.x - ox, dy = s.hero.y - oy;
        for (let i = 0; i < n; i++) {
          const t = a0 + st.a * dir + i * arm, c = Math.cos(t), sn = Math.sin(t), along = dx * c + dy * sn;
          if (along > 0 && along < len && Math.abs(dy * c - dx * sn) < 8 && s.bt - (hitAt.t || -1e9) > 500) { hitAt.t = s.bt; s.hurt(m.dmg * dmgMul); }
        }
      },
      onComplete: () => g.destroy(),
    });
  });
}

export const BOSS_PATTERNS = {
  // 해일의 수문룡: 길을 붉게 알린 뒤 파도가 쓸고 간다. 빨리(분노 직전)면 엇갈려 두 줄
  wave(fast) {
    const s = this.s, h = s.hero, ang = Phaser.Math.Angle.Between(this.m.x, this.m.y, h.x, h.y);
    const axis = Math.random() < 0.5 ? 0 : Math.PI / 2, a = axis + (Math.cos(ang - axis) < 0 ? Math.PI : 0);
    this.busy = 1400; this.m.setVelocity(0, 0);
    bandWave(this, h.x, h.y, a, 380, 34, 1000, 1300, 1.3);
    if (fast) s.time.delayedCall(600, () => this.m.active && bandWave(this, h.x + Math.cos(a + 1.57) * 70, h.y + Math.sin(a + 1.57) * 70, a + Math.PI, 380, 34, 800, 1300, 1.3));
  },
  // 분노: 해일. 두 줄 이상이 한꺼번에 와서 줄 사이 빈틈에 서야 한다
  tsunami() {
    const s = this.s, h = s.hero, horiz = Math.random() < 0.5, dirn = Math.random() < 0.5 ? 1 : -1;
    this.busy = 1800; this.m.setVelocity(0, 0);
    for (let i = -1; i <= 1; i++) {
      const off = i * 62;
      const cx = horiz ? h.x : h.x + off, cy = horiz ? h.y + off : h.y;
      bandWave(this, cx, cy, horiz ? (dirn > 0 ? 0 : Math.PI) : (dirn > 0 ? Math.PI / 2 : -Math.PI / 2), 380, 30, 1100, 1300, 1.3);
    }
  },
  // 늪의 여왕: 독 포자 세 발이 떨어져 독구름을 남긴다
  spore(fast) {
    const s = this.s, m = this.m, n = fast ? 4 : 3;
    this.busy = 700; m.setVelocity(0, 0);
    s.tweens.add({ targets: m, scaleY: m.scaleY * 1.12, duration: 200, yoyo: true });
    for (let i = 0; i < n; i++) {
      const x = s.hero.x + (i ? R(-70, 70) : 0), y = s.hero.y + (i ? R(-60, 60) : 0);
      s.time.delayedCall(i * 260, () => m.active && this.warnCircle(x, y, 30, 1000, () => { if (m.active) { this.thud(x, y, 30); s.env?.cloud(x, y, 28, 5200); } }));
    }
  },
  // 분노: 독꽃. 내 둘레 고리와 발밑에 한꺼번에 독구름을 뿌려 움직이게 만든다
  bloom() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 900; m.setVelocity(0, 0);
    const pts = [[h.x, h.y]];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; pts.push([h.x + Math.cos(a) * 78, h.y + Math.sin(a) * 58]); }
    pts.forEach(([x, y], i) => s.time.delayedCall(i * 110, () => m.active && this.warnCircle(x, y, 28, 1100, () => { if (m.active) { this.thud(x, y, 28); s.env?.cloud(x, y, 26, 6000); } })));
  },
  // 수정 거신: 레이저 세 줄이 돌며 쓸고 간다
  prism(fast) {
    this.busy = 2400; this.m.setVelocity(0, 0);
    sectorBeams(this, 3, Math.PI * 2 / 3, fast ? 2.3 : 1.9, fast ? 800 : 1000, fast ? 1500 : 1700, 210, 1.2);
  },
  // 분노: 파편 폭발. 네 곳이 차례로 터지며 파편이 사방으로 날아간다
  shatter() {
    const s = this.s, m = this.m;
    this.busy = 900;
    for (let i = 0; i < 4; i++) {
      const x = s.hero.x + R(-70, 70), y = s.hero.y + R(-55, 55);
      s.time.delayedCall(i * 260, () => m.active && this.warnCircle(x, y, 30, 900, () => {
        if (!m.active) return;
        this.thud(x, y, 30);
        const a0 = RF(0, 6.28);
        for (let k = 0; k < 8; k++) s.enemyShot(x, y, a0 + k * Math.PI / 4, 80, m.dmg * 0.55).setTint(0xc890ff);
      }));
    }
  },
  // 폭풍의 기사단장: 돌풍이 나를 밀어내는 동안 부채꼴 칼날이 두 번 날아온다
  gale(fast) {
    const s = this.s, m = this.m;
    this.busy = 2000; m.setVelocity(0, 0);
    const a = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), g = s.add.graphics().setDepth(9);
    g.fillStyle(0xe8f4ff, 0.18).slice(m.x, m.y, 180, a - 0.5, a + 0.5, false).fillPath().lineStyle(2, 0xff4050, 0.8).lineBetween(m.x, m.y, m.x + Math.cos(a) * 180, m.y + Math.sin(a) * 180);
    sfx('warn');
    s.time.delayedCall(850, () => {
      g.destroy();
      if (!m.active) return;
      s.env?.impulse(Math.cos(a) * 150, Math.sin(a) * 150, 1100);
      for (let k = 0; k < (fast ? 3 : 2); k++) s.time.delayedCall(150 + k * 420, () => {
        if (!m.active) return;
        const t = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y);
        for (let i = -3; i <= 3; i++) s.enemyShot(m.x, m.y, t + i * 0.17, 100, m.dmg * 0.7).setTint(0xe8f4ff);
      });
    });
  },
  // 분노: 회오리. 제자리에서 돌며 나선 탄을 뿌리고 나를 끌어당긴다
  cyclone() {
    const s = this.s, m = this.m;
    this.busy = 2800; m.setVelocity(0, 0);
    s.tweens.add({ targets: m, angle: 360, duration: 1800, delay: 500 });
    sfx('warn');
    let n = 0;
    s.time.addEvent({ delay: 500, callback: () => { s.time.addEvent({ delay: 85, repeat: 22, callback: () => {
      if (!m.active || s.over) return;
      n++;
      for (let k = 0; k < 2; k++) s.enemyShot(m.x, m.y, n * 0.42 + k * Math.PI, 78, m.dmg * 0.6).setTint(0xe8f4ff);
      const a = Phaser.Math.Angle.Between(s.hero.x, s.hero.y, m.x, m.y);
      s.env?.impulse(Math.cos(a) * 46, Math.sin(a) * 46, 95);
    } }); } });
    s.time.delayedCall(2600, () => m.active && m.setAngle(0));
  },
  // 공허 군주: 허공에 구멍을 열어 나를 빨아들인다. 중심에 닿으면 크게 다친다
  void() {
    const s = this.s, m = this.m, tx = s.hero.x + R(-50, 50), ty = s.hero.y + R(-40, 40);
    this.busy = 1000; m.setVelocity(0, 0);
    this.warnCircle(tx, ty, 36, 900, () => {
      if (!m.active || s.over) return;
      const hole = s.add.image(tx, ty, 'disc').setTint(0x3a2aa0).setScale(1.3, 0.9).setDepth(8).setAlpha(0.9);
      const core = s.add.image(tx, ty, 'disc').setTint(0x000000).setScale(0.5, 0.35).setDepth(8.1);
      s.tweens.add({ targets: hole, angle: 360, duration: 2400 });
      let t = 0, hitT = -1e9;
      const ev = s.time.addEvent({ delay: 40, repeat: 58, callback: () => {
        t += 40;
        if (!m.active || s.over) { ev.remove(); hole.destroy(); core.destroy(); return; }
        const dx = tx - s.hero.x, dy = ty - s.hero.y, d = Math.hypot(dx, dy);
        if (d < 150) s.env?.impulse(dx / d * 105, dy / d * 105, 60);
        if (d < 14 && s.bt - hitT > 600) { hitT = s.bt; s.hurt(m.dmg * 1.4); }
        if (t >= 2300) { hole.destroy(); core.destroy(); }
      } });
    });
  },
  // 분노: 일식. 화면이 거의 어두워지고 틈이 있는 탄 고리가 차례로 밀려온다. 틈은 내 쪽을 향한다
  eclipse() {
    const s = this.s, m = this.m;
    this.busy = 4600; m.setVelocity(0, 0);
    sfx('warn'); s.env?.blackout(5200);
    for (let k = 0; k < 5; k++) s.time.delayedCall(800 + k * 800, () => {
      if (!m.active || s.over) return;
      const gap = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y) + RF(-0.3, 0.3), n = 22;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        if (Math.abs(Phaser.Math.Angle.Wrap(a - gap)) < 0.42) continue;
        s.enemyShot(m.x, m.y, a, 62, m.dmg * 0.8).setTint(0xa090ff);
      }
    });
  },
  // 모래 거신: 모래 속으로 잠겨(맞지 않는다) 내 자리를 따라온 뒤 솟구친다
  burrow(fast) {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 2200; m.setVelocity(0, 0);
    m.dive = true; m.setAlpha(0.15); s.env?.ripple(m.x, m.y, 0xe0c080);
    const tx = h.x, ty = h.y, r = 50;
    s.time.delayedCall(700, () => { if (m.active) this.warnCircle(tx, ty, r, fast ? 800 : 1000, () => {}); });
    s.time.delayedCall(700 + (fast ? 800 : 1000), () => {
      if (!m.active) return;
      m.dive = false; m.setAlpha(1); m.setPosition(tx, ty);
      this.thud(tx, ty, r);
      s.env?.ripple(tx, ty, 0xe0c080);
    });
  },
  // 분노: 모래 늪. 둘레에 구덩이 셋이 열려 8초 동안 끌어당긴다
  sink() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 900; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + RF(0, 1), x = Phaser.Math.Clamp(h.x + Math.cos(a) * 85, 40, 1560), y = Phaser.Math.Clamp(h.y + Math.sin(a) * 65, 40, 1560);
      s.time.delayedCall(i * 250, () => m.active && this.warnCircle(x, y, 34, 900, () => m.active && s.env?.addPit(x, y, 34, 8000)));
    }
  },
  // 증기 장군: 내 둘레 네 곳에서 증기가 뿜는다
  vent(fast) {
    const s = this.s, m = this.m, h = s.hero, n = fast ? 5 : 4;
    this.busy = 800; m.setVelocity(0, 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + RF(0, 1), x = h.x + Math.cos(a) * 60, y = h.y + Math.sin(a) * 45;
      s.time.delayedCall(i * 160, () => m.active && this.warnCircle(x, y, 28, 1000, () => { if (m.active) { this.thud(x, y, 28); s.env?.addHaz(x, y, 24, 2500, 0.6, 'steam', 0xe8e8f0); } }));
    }
  },
  // 분노: 과열. 고리 탄막이 세 번 연달아 나가고 발밑에 증기가 깔린다
  overheat() {
    const s = this.s, m = this.m;
    this.busy = 2200; m.setVelocity(0, 0); sfx('warn'); m.setTint(0xff6040);
    for (let k = 0; k < 3; k++) s.time.delayedCall(500 + k * 650, () => {
      if (!m.active) return;
      for (let i = 0; i < 16; i++) s.enemyShot(m.x, m.y, (i + k * 0.33) / 16 * Math.PI * 2, 75, m.dmg * 0.7).setTint(0xffa060);
      s.env?.addHaz(m.x + R(-50, 50), m.y + R(-40, 40), 26, 3000, 0.6, 'steam', 0xe8e8f0);
    });
    s.time.delayedCall(2200, () => m.active && (m.clearTint(), m.baseTint && m.baseTint !== 0xffffff && m.setTint(m.baseTint)));
  },
  // 뇌룡: 내 쪽으로 번개 줄이 한 줄로 떨어진다
  bolt(fast) {
    const s = this.s, m = this.m, h = s.hero, a = Phaser.Math.Angle.Between(m.x, m.y, h.x, h.y), n = fast ? 6 : 5;
    this.busy = 1000; m.setVelocity(0, 0);
    for (let i = 1; i <= n; i++) { const x = m.x + Math.cos(a) * (i * 45), y = m.y + Math.sin(a) * (i * 45); s.time.delayedCall(i * 190, () => m.active && s.env?.strike(Phaser.Math.Clamp(x, 30, 1570), Phaser.Math.Clamp(y, 30, 1570), 26, 800)); }
  },
  // 분노: 뇌우. 낙뢰가 두 배 빨리 떨어지고 둘레에 한꺼번에 내린다
  tempest() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    if (s.env) s.env.boltBoost = 9000;
    for (let i = 0; i < 8; i++) s.time.delayedCall(i * 230, () => m.active && s.env?.strike(Phaser.Math.Clamp(h.x + R(-95, 95), 30, 1570), Phaser.Math.Clamp(h.y + R(-75, 75), 30, 1570), 26, 900));
  },
  // 거울의 군주: 분신 둘을 만들어 셋이 함께 부채꼴을 쏜다(진짜는 체력 막대가 있는 쪽)
  mirror() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 2400; m.setVelocity(0, 0); sfx('warn');
    const cl = [];
    for (let i = 0; i < 2; i++) {
      const a = RF(0, 6.28), c = s.add.sprite(Phaser.Math.Clamp(h.x + Math.cos(a) * 110, 30, 1570), Phaser.Math.Clamp(h.y + Math.sin(a) * 85, 30, 1570), m.texture.key, m.frame.name).setScale(m.scaleX).setAlpha(0).setTint(0xa0ffe8).setDepth(12);
      s.tweens.add({ targets: c, alpha: 0.6, duration: 400 }); cl.push(c);
    }
    for (let k = 0; k < 2; k++) s.time.delayedCall(1000 + k * 450, () => {
      for (const o of [m, ...cl]) {
        if (!m.active) return;
        const t = Phaser.Math.Angle.Between(o.x, o.y, h.x, h.y);
        for (let i = -2; i <= 2; i++) s.enemyShot(o.x, o.y, t + i * 0.22, 95, m.dmg * 0.6).setTint(0x90ffe8);
      }
    });
    s.time.delayedCall(2200, () => cl.forEach(c => s.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() })));
  },
  // 분노: 반사. 2.5초 동안 빛나며 치면 내가 다친다. 그동안 고리 탄막이 나간다
  reflect() {
    const s = this.s, m = this.m;
    this.busy = 2600; m.setVelocity(0, 0); sfx('warn');
    m.parryUntil = s.bt + 2500; m.setTintFill(0xffffff);
    s.banner('빛난다! 치지 마라', '2초 동안 맞히면 되받는다');
    s.time.delayedCall(2500, () => m.active && (m.clearTint(), m.baseTint && m.baseTint !== 0xffffff && m.setTint(m.baseTint)));
    for (let k = 0; k < 2; k++) s.time.delayedCall(700 + k * 800, () => { if (m.active) for (let i = 0; i < 18; i++) s.enemyShot(m.x, m.y, (i + k * 0.5) / 18 * Math.PI * 2, 70, m.dmg * 0.7).setTint(0x90ffe8); });
  },
  // 원초의 대장신: 망치 자국이 내 쪽으로 줄지어 박히고 불이 남는다
  hammer(fast) {
    const s = this.s, m = this.m, h = s.hero, a = Phaser.Math.Angle.Between(m.x, m.y, h.x, h.y), n = fast ? 5 : 4;
    this.busy = 1100; m.setVelocity(0, 0);
    for (let i = 1; i <= n; i++) {
      const x = Phaser.Math.Clamp(m.x + Math.cos(a) * i * 50, 30, 1570), y = Phaser.Math.Clamp(m.y + Math.sin(a) * i * 50, 30, 1570);
      s.time.delayedCall(i * 180, () => m.active && this.warnCircle(x, y, 32, 800, () => { if (m.active) { this.thud(x, y, 32); s.env?.addHaz(x, y, 26, 3000, 0.7, 'fire', 0xff8a2a); } }));
    }
  },
  // 분노: 유성우. 둘레에 열 개의 낙하 지점이 3초 동안 차례로 찍힌다
  meteor() {
    const s = this.s, m = this.m, h = s.hero;
    this.busy = 1800; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < 10; i++) {
      s.time.delayedCall(i * 300, () => {
        if (!m.active) return;
        const x = Phaser.Math.Clamp(h.x + R(-110, 110), 30, 1570), y = Phaser.Math.Clamp(h.y + R(-85, 85), 30, 1570);
        this.warnCircle(x, y, 30, 950, () => { if (m.active) { this.thud(x, y, 30); s.env?.addHaz(x, y, 22, 2200, 0.6, 'fire', 0xff8a2a); } });
      });
    }
  },
};
