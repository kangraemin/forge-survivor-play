// 돌파 3~15장: 사행 길(BreachPath) + 장별 규칙. 판 데이터는 modeStages.js, 1·2장(cfg.path 없음)은 modes.js 기존 로직
// modes.js는 run.tw(= makeBreachRule 결과)에 setup · update · botDir · spawnPoint · spdMul · hud · prog 를 맡긴다.
import { font } from './ui.js';
import { sfx } from './sfx.js';
import { modeAnim, wallArt, WALL_FILL, chSprite } from './modeArt.js';
import { addPillar, clearPillars } from './modeRules.js';
import { t } from './i18n.js';

const WORLD = 1600, W = 390;
const RF = Phaser.Math.FloatBetween;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HW = 118;                         // 길 반폭
const PTS = [[260, 1450], [1400, 1450], [1400, 1150], [200, 1150], [200, 850], [1400, 850], [1400, 550], [200, 550], [200, 250], [1400, 250]];
const LANE0 = [0, 1440, 2940, 4440, 5940], LANE_LEN = [1140, 1200, 1200, 1200, 1200];   // 가로 길 5줄의 시작 호장·길이
const WALL_NAME = { lavaFlood: t('modeBreach.ace7dc'), avalanche: t('modeBreach.e9e5eb'), sealStones: t('modeBreach.5dd2a6'), tidalWave: t('modeBreach.769339'), fogCurrent: t('modeBreach.baf5d2'), crystalCollapse: t('modeBreach.f3e528'), stormWind: t('modeBreach.a0f97e'), abyssDark: t('modeBreach.085c00'), sandStorm: t('modeBreach.56e27c'), steamLine: t('modeBreach.f48a05'), thunderFront: t('modeBreach.a852d0'), mirrorWall: t('modeBreach.d04a47'), furnace: t('modeBreach.4d30cd') };
const WALL_K = 0.62;                    // 달리기가 0.62배로 느려진 만큼 벽 속도(stage 값은 84px/s 기준)도 줄인다
const WALL_HEAD = 560;                  // 벽이 시작선 뒤에서 출발하는 거리(주인공이 먼저 달려 나간다)

const SEGS = []; let TOTAL = 0;
for (let i = 0; i < PTS.length - 1; i++) {
  const [ax, ay] = PTS[i], [bx, by] = PTS[i + 1], l = Math.hypot(bx - ax, by - ay);
  SEGS.push({ ax, ay, bx, by, l, s0: TOTAL, dx: (bx - ax) / l, dy: (by - ay) / l }); TOTAL += l;
}

export class BreachPath {
  constructor(run) {
    this.r = run; this.s = run.s; this.c = run.cfg; this.total = TOTAL; this.hw = HW;
    this.w = -WALL_HEAD; this.sh = 0; this.slow = 1; this.freeze = 0; this.boost = 0; this.surge = 0; this.drift = { x: 0, y: 0 };
    this.t = 0; this.inWall = false; this.near = null;
  }
  // 길 위 호장 s, 옆으로 off 만큼 떨어진 점
  at(sv, off = 0) {
    sv = clamp(sv, 0, TOTAL);
    const g = SEGS.find(q => sv <= q.s0 + q.l) || SEGS[SEGS.length - 1], u = sv - g.s0;
    return { x: g.ax + g.dx * u - g.dy * off, y: g.ay + g.dy * u + g.dx * off, dx: g.dx, dy: g.dy };
  }
  lane(k, f) { return LANE0[k] + LANE_LEN[k] * f; }
  nearest(x, y, around) {   // around: 호장 s를 주면 그 앞뒤 400px 구간만 본다(바람에 날려도 다른 줄로 건너뛰지 않게)
    let best = null;
    for (const g of SEGS) {
      if (around != null && (g.s0 + g.l < around - 400 || g.s0 > around + 400)) continue;
      const u = clamp((x - g.ax) * g.dx + (y - g.ay) * g.dy, 0, g.l), px = g.ax + g.dx * u, py = g.ay + g.dy * u, d = Math.hypot(x - px, y - py);
      if (!best || d < best.d) best = { s: g.s0 + u, d, px, py, g };
    }
    return best;
  }
  // 아직 길 위에서 벗어난 몹도 벽 안이면 쓸어 낸다
  setup() {
    const r = this.r, s = this.s, c = this.c, h = s.hero;
    this.rule = RULES[c.rule]?.(this, c) || {};
    const st = this.at(0);
    h.setPosition(st.x, st.y);
    r.y0 = st.y; r.goalY = 250;
    const gp = this.at(TOTAL - 4);
    this.gate = modeAnim(s, s.add.sprite(gp.x + 26, gp.y, 'ma_finish_gate'), 'finish_gate').setDepth(8).setScale(2);
    r.glowAt(gp.x + 26, gp.y, 0xffe8a0, 1.4, 0.3);
    // 장 테마 장치 그림: 가로 길 다섯 줄 가장자리에 번갈아 놓는다(없으면 놓지 않는다)
    for (let k = 0; k < 5; k++) for (let j = 0; j < 2; j++) {
      const q = this.at(this.lane(k, 0.28 + j * 0.42 + k % 2 * 0.08), ((k + j) % 2 ? 1 : -1) * (HW - 26));
      chSprite(s, 'breach', c.c, q.x, q.y, 2, 6);
    }
    // 길 밖을 어둡게(40px 칸을 가로로 묶어 칠한다)
    const sd = s.add.graphics().setDepth(3), CELL = 40;
    sd.fillStyle(0x000000, 0.5);
    for (let cy = 0; cy < WORLD; cy += CELL) {
      let run0 = -1;
      for (let cx = 0; cx <= WORLD; cx += CELL) {
        const out = cx < WORLD && this.nearest(cx + CELL / 2, cy + CELL / 2).d > HW + 14;
        if (out && run0 < 0) run0 = cx;
        if (!out && run0 >= 0) { sd.fillRect(run0, cy, cx - run0, CELL); run0 = -1; }
      }
    }
    // 길 가장자리 선
    const ed = s.add.graphics().setDepth(3);
    ed.lineStyle(2, 0xffe8a0, 0.3);
    for (const g of SEGS) { const nx = -g.dy * HW, ny = g.dx * HW; ed.lineBetween(g.ax + nx, g.ay + ny, g.bx + nx, g.by + ny).lineBetween(g.ax - nx, g.ay - ny, g.bx - nx, g.by - ny); }
    this.wallKey = 'ma_' + wallArt(c.c);
    this.wg = s.add.graphics().setDepth(36);
    this.wsp = s.add.image(0, 0, this.wallKey, 0).setOrigin(0.5, 0).setDepth(37).setVisible(false);
    this.wallF = 0; this.wallAnim = 0;
    this.wlab = s.add.text(0, 0, WALL_NAME[c.rule] || t('modeBreach.b491a5'), font(12, '#ffd0c0', 3)).setOrigin(0.5, 1).setDepth(52).setVisible(false);
    this.warn = s.add.rectangle(W / 2, 844 - 58, W, 116, 0xc01020, 0).setScrollFactor(0).setDepth(97);   // 벽이 가까우면 화면 아래가 붉게 뛴다
    this.warnTxt = r.mkTxt(W / 2, 844 - 84, '', font(15, '#ffffff', 4)); this.warnTxt.setOrigin(0.5).setAlpha(0);
    this.g = s.add.graphics().setDepth(7);          // 규칙이 매 프레임 그리는 장치
    this.say = (() => { const t = r.mkTxt(0, 0, '', font(10, '#ffffff', 3)); t.setOrigin(0.5).setPosition(W / 2, 124); return (str, col = '#ffffff') => { t.setText(str).setColor(col).setAlpha(str ? 1 : 0); }; })();
    this.arrow = s.add.sprite(0, 0, 'ma_elite_arrow').setScrollFactor(0).setDepth(61).setVisible(false).setTint(0xff6a5a);
    this.rule.setup?.();
  }
  pulse(px) { this.surge += px; }
  update(dt) {
    const r = this.r, s = this.s, c = this.c, h = s.hero, sec = dt / 1000;
    r.spawnTick(dt, 1.15 * (c.mobMul || 1));
    this.t += dt;
    this.slow = 1; this.boost = 0;
    // 길 밖으로 못 나간다
    const n = this.nearest(h.x, h.y, this.sh);
    if (n.d > HW - 8) { const k = (HW - 8) / n.d; h.x = n.px + (h.x - n.px) * k; h.y = n.py + (h.y - n.py) * k; }
    this.sh = this.nearest(h.x, h.y, this.sh).s;
    this.rule.update?.(dt);
    // 벽: 시간이 갈수록 조금 빨라진다. 얼림·밀림·부스트는 규칙이 정한다
    const v = c.wall * WALL_K * (1 + Math.min(0.35, this.t / 120000)) * (1 - 0.08 * r.cl('mwallslow'));
    this.w += (this.freeze > 0 ? 0 : v + this.boost) * sec;
    this.freeze = Math.max(0, this.freeze - dt);
    if (this.surge !== 0) { const st = clamp(this.surge, -320 * sec, 320 * sec); this.w += st; this.surge -= st; }
    if (this.drift.x || this.drift.y) { h.x += this.drift.x * sec; h.y += this.drift.y * sec; this.drift.x = this.drift.y = 0; }
    this.drawWall(dt);
    // 경고: 벽이 가까우면 화면 아래 붉은 띠와 글자
    const near = clamp(1 - (this.sh - this.w - 40) / 260, 0, 1) * (this.w > 0 ? 1 : 0);
    this.warn.setFillStyle(0xc01020, near * (0.28 + 0.18 * Math.sin(s.bt / 110)));
    this.warnTxt.setText(near > 0.05 ? t('modeBreach.811d8c', { v: WALL_NAME[c.rule] || t('modeBreach.b491a5') }) : '').setAlpha(near > 0.05 ? 0.6 + 0.4 * Math.sin(s.bt / 130) : 0);
    // 벽 안: 몹은 사라지고 주인공은 크게 다친다
    this.wT = (this.wT || 0) - dt;
    if (this.wT <= 0) {
      this.wT = 250;
      s.mobs.getChildren().slice().forEach(m => { if (m.dead || !m.active) return; const q = this.nearest(m.x, m.y); if (q.d < HW + 70 && q.s < this.w - 10) { m.dead = true; m.body.enable = false; s.tweens.add({ targets: m, alpha: 0, duration: 200, onComplete: () => m.destroy() }); } });
    }
    this.inWall = this.sh < this.w;
    r.inWall = this.inWall;
    if (this.inWall && s.bt >= s.iframe) s.hurt(s.maxHp * c.wallDmg, 'wall');
    if (this.sh >= TOTAL - 16) return r.finish(true);
  }
  drawWall(dt) {
    const g = this.wg, w = this.w, hide = this.hideWall && this.sh < w + 0; g.clear();
    if (w <= 0) { this.wsp.setVisible(false); this.wlab.setVisible(false); return; }
    const col = WALL_FILL[wallArt(this.c.c)], vis = this.rule.wallAlpha ? this.rule.wallAlpha() : 1;
    g.fillStyle(col, 0.88 * vis);
    for (const q of SEGS) {
      if (q.s0 >= w) break;
      const e = Math.min(w, q.s0 + q.l) - q.s0, bx = q.ax + q.dx * e, by = q.ay + q.dy * e, p = HW + 30;
      g.fillRect(Math.min(q.ax, bx) - p, Math.min(q.ay, by) - p, Math.abs(bx - q.ax) + 2 * p, Math.abs(by - q.ay) + 2 * p);
    }
    const f = this.at(w);
    this.wsp.setVisible(vis > 0.05).setAlpha(vis).setPosition(f.x, f.y).setRotation(Math.atan2(f.dy, f.dx) + Math.PI / 2).setDisplaySize(2 * HW + 80, 36);
    if (this.wsp.texture.frameTotal > 2 && (this.wallAnim += dt) > 170) { this.wallAnim = 0; this.wallF = (this.wallF + 1) % 4; this.wsp.setFrame(this.wallF); }
    this.wlab.setVisible(vis > 0.3).setPosition(f.x, f.y - 22).setAlpha(vis);
    g.lineStyle(3, 0xff6a5a, 0.7 * vis);
    const nx = -f.dy * (HW + 30), ny = f.dx * (HW + 30);
    g.lineBetween(f.x + nx, f.y + ny, f.x - nx, f.y - ny);
  }
  // ── Battle 훅 ──
  prog() { return clamp(this.sh / TOTAL, 0, 1); }
  spdMul() { return this.slow * (this.inWall ? 0.7 : 1) * 0.62 * (1 + 0.06 * this.r.cl('mdash')); }   // 0.62는 1·2장 돌파와 같은 달리기 속도
  spawnPoint(min, max) {
    const hs = this.sh;
    for (let i = 0; i < 6; i++) {
      const sv = hs + RF(min * 0.8, max * 1.1), p = this.at(sv, RF(-HW * 0.7, HW * 0.7));
      if (sv < TOTAL - 40 && sv > this.w + 80) return { x: p.x, y: p.y };
    }
    const p = this.at(Math.min(TOTAL - 40, hs + 160));
    return { x: p.x, y: p.y };
  }
  botDir() {
    const h = this.s.hero, p = this.at(this.sh + 110), d = Math.hypot(p.x - h.x, p.y - h.y) || 1;
    const bd = this.rule.botDir?.(p, d);
    return bd || { x: (p.x - h.x) / d * 1.6, y: (p.y - h.y) / d * 1.6 };
  }
  hud(g, bx, bw) {
    const s = this.s;
    const prog = clamp(this.sh / TOTAL, 0, 1), wp = clamp(this.w / TOTAL, 0, 1);
    g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 22);
    g.fillStyle(0x1a2430).fillRect(14, 49, bw - 12, 8);
    if (wp > 0) g.fillStyle(0x8a2a9a).fillRect(14, 49, (bw - 12) * wp, 8);
    g.fillStyle(0xffe8a0).fillRect(14 + (bw - 12) * prog - 2, 46, 4, 14);
    g.fillStyle(0xffe8a0).fillRect(bx + bw - 6, 44, 3, 22);
    const gap = Math.round((this.sh - this.w) / 4);
    s.timeTxt.setText(t('modes.02f94d', { max: Math.max(0, Math.round((TOTAL - this.sh) / 4)) })).setColor('#ffffff');
    s.waveTxt.setText(t('modeBreach.235ac1', { max: Math.max(0, gap) })).setColor(gap < 25 ? '#ff7070' : '#a1b2b6');
    this.rule.hud?.();
  }
  // 벽이 뒤에서 가까우면 화면 가장자리에 경고 화살표
  warnArrow(maxD) {
    const s = this.s, h = s.hero, gap = this.sh - this.w;
    if (this.w <= 0 || gap > maxD || gap < 0) { this.arrow.setVisible(false); return; }
    const f = this.at(this.w), a = Math.atan2(f.y - h.y, f.x - h.x);
    this.arrow.setVisible(true).setPosition(195 + Math.cos(a) * 130, 422 + Math.sin(a) * 160).setRotation(a).setScale(1.3);
  }
}

// ── 장 규칙. (bp, cfg) → { setup, update, hud, wallAlpha, botDir } ──
const onSeg = (bp, k, f, len = 0) => bp.lane(k, f) + len;
const burn = (bp, key, frac, gap = 650) => { bp[key] = (bp[key] ?? 0); if (bp.s.bt - bp[key] > gap) { bp[key] = bp.s.bt; bp.s.hurt(bp.s.maxHp * frac, 'env'); } };
const flash = (s, x, y, col, txt) => {
  const o = s.add.circle(x, y, 8, col, 0.5).setStrokeStyle(2, col).setDepth(41);
  s.tweens.add({ targets: o, scale: 5, alpha: 0, duration: 380, onComplete: () => o.destroy() });
  if (txt) { const t = s.add.text(x, y - 18, txt, font(10, '#ffffff', 3)).setOrigin(0.5).setDepth(42); s.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() }); }
};
// 주기 경고 → 벽 밀림. 반환: 경고 중이면 남은 초
function surger(bp, every, px, label, first = 9000) {
  let t = first;
  return dt => {
    t -= dt;
    const warn = t < 2200;
    if (warn) bp.say(label, '#ffd75e');
    if (t <= 0) { t = every; bp.pulse(px); bp.s.cameras.main.shake(260, 0.007); sfx('boom', 150); bp.say(''); }
    return warn;
  };
}

const RULES = {
  // 3장: 용암 띠 가운데 돌 발판만 안전
  lavaFlood(bp) {
    const s = bp.s, bands = [], stones = [];
    return {
      setup() {
        for (let k = 0; k < 5; k++) {
          const s0 = bp.lane(k, k === 0 ? 0.55 : 0.5), pts = [[18, -55], [58, 45], [98, -40]].map(([u, o]) => ({ ...bp.at(s0 + u, o), r: 27 }));
          bands.push(s0); pts.forEach(p => stones.push(p));
        }
      },
      update() {
        const g = bp.g, h = s.hero; g.clear();
        let onLava = false;
        bands.forEach(s0 => {
          const a = bp.at(s0 + 60), vert = Math.abs(a.dx) > 0.5;
          const bw = 118, bh = 2 * HW;
          g.fillStyle(0xff4a10, 0.62 + 0.12 * Math.sin(s.bt / 130)).fillRect(a.x - bw / 2, a.y - bh / 2, bw, bh).lineStyle(2, 0xffd070, 0.8).strokeRect(a.x - bw / 2, a.y - bh / 2, bw, bh);
          if (Math.abs(h.x - a.x) < bw / 2 && Math.abs(h.y - a.y) < bh / 2) onLava = true;
        });
        stones.forEach(p => {
          g.fillStyle(0x6a6a78, 1).fillCircle(p.x, p.y, p.r).lineStyle(2, 0xd8d8e8, 0.9).strokeCircle(p.x, p.y, p.r);
          if (Math.hypot(h.x - p.x, h.y - p.y) < p.r + 2) onLava = false;
        });
        if (onLava) { bp.slow *= 0.7; burn(bp, 'lv', 0.04, 550); }
      },
    };
  },
  // 4장: 얼음 길은 빠르지만 옆으로 미끄러진다. 눈사태가 덮친다
  avalanche(bp) {
    const s = bp.s, sw = surger(bp, 16000, 190, t('modeBreach.3b4ba6'), 11000);
    const ice = [1, 3];
    return {
      update(dt) {
        const g = bp.g, h = s.hero; g.clear();
        ice.forEach(k => { const a = bp.at(bp.lane(k, 0.5)); g.fillStyle(0x9fe0ff, 0.2).fillRect(Math.min(a.x - 600, 200), a.y - HW, 1200, 2 * HW); });
        const k = LANE0.findIndex((v, i) => bp.sh >= v && bp.sh < v + LANE_LEN[i]);
        if (ice.includes(k)) { bp.slow *= 1.3; const side = k === 1 ? 1 : -1; bp.drift.y = side * 36 * (0.6 + 0.4 * Math.sin(s.bt / 700)); }
        sw(dt);
      },
    };
  },
  // 5장: 문장석을 밟으면 벽이 3초 멈춘다
  sealStones(bp) {
    const s = bp.s, st = [];
    return {
      setup() { for (let k = 1; k < 5; k++) [0.28, 0.72].forEach((f, i) => { const p = bp.at(bp.lane(k, f), (i + k) % 2 ? 62 : -62); st.push({ x: p.x, y: p.y, on: false }); }); },
      update() {
        const g = bp.g, h = s.hero; g.clear();
        for (const q of st) {
          if (!q.on && Math.hypot(h.x - q.x, h.y - q.y) < 30) { q.on = true; bp.freeze = 3200; sfx('level'); flash(s, q.x, q.y, 0xb070ff, t('modeBreach.abccee')); }
          g.fillStyle(q.on ? 0x403060 : 0xb070ff, q.on ? 0.5 : 0.35 + 0.15 * Math.sin(s.bt / 150)).fillCircle(q.x, q.y, 24).lineStyle(2, q.on ? 0x806aa0 : 0xe0c0ff, 0.9).strokeCircle(q.x, q.y, 24);
          if (!q.on) for (let k = 0; k < 4; k++) { const a = s.bt / 500 + k * 1.57; g.fillStyle(0xe0c0ff, 0.8).fillCircle(q.x + Math.cos(a) * 15, q.y + Math.sin(a) * 15, 2); }
        }
        if (bp.freeze > 0) bp.say(t('modeBreach.f8d66c'), '#cfa0ff'); else bp.say('');
      },
    };
  },
  // 6장: 웅덩이는 느리고 해일이 크게 친다
  tidalWave(bp) {
    const s = bp.s, sw = surger(bp, 15000, 210, t('modeBreach.9c9483'), 10000);
    return {
      setup() {
        const env = s.env; env.puddles.length = 0;
        for (let k = 0; k < 5; k++) [0.3, 0.55, 0.8].forEach((f, i) => { if (k === 0 && f < 0.3) return; const p = bp.at(bp.lane(k, f), ((i + k) % 3 - 1) * 55); env.addPuddle(p.x, p.y, 38, Infinity); });
      },
      update(dt) { sw(dt); },
    };
  },
  // 7장: 구간마다 물살이 다르다
  fogCurrent(bp) {
    const s = bp.s;
    return {
      update() {
        const g = bp.g; g.clear();
        const k = LANE0.findIndex((v, i) => bp.sh >= v && bp.sh < v + LANE_LEN[i]);
        if (k >= 0) { const dir = k % 2 ? -1 : 1; bp.drift.x = 0; const a = bp.at(bp.sh); const push = 40 * dir; bp.drift.x += a.dx * push; bp.drift.y += a.dy * push; bp._dir = dir; }
        for (let kk = 0; kk < 5; kk++) {
          const dir = kk % 2 ? -1 : 1, base = bp.lane(kk, 0);
          for (let i = 0; i < 16; i++) { const sv = base + ((i * 75 + s.bt * 0.05 * dir) % LANE_LEN[kk] + LANE_LEN[kk]) % LANE_LEN[kk]; const p = bp.at(sv, (i % 3 - 1) * 60); const ax = p.dx * dir, ay = p.dy * dir; g.lineStyle(2, dir > 0 ? 0xb0ffb0 : 0xffa090, 0.55).lineBetween(p.x - ax * 8 - ay * 6, p.y - ay * 8 + ax * 6, p.x + ax * 6, p.y + ay * 6).lineBetween(p.x - ax * 8 + ay * 6, p.y - ay * 8 - ax * 6, p.x + ax * 6, p.y + ay * 6); }
        }
        bp.say(k >= 0 ? (k % 2 ? t('modeBreach.c94978') : t('modeBreach.5c5cce')) : '', k % 2 ? '#ffa090' : '#b0ffb0');
      },
    };
  },
  // 8장: 길 옆 레이저 기둥과 수정 붕괴
  crystalCollapse(bp) {
    const s = bp.s, sw = surger(bp, 18000, 200, t('modeBreach.8b341b'), 12000);
    return {
      setup() {
        const env = s.env; clearPillars(env);
        for (let k = 1; k < 5; k++) [0.35, 0.72].forEach((f, i) => { const p = bp.at(bp.lane(k, f), (i % 2 ? 1 : -1) * (HW - 8)); const q = addPillar(env, p.x, p.y, (i % 2 ? -1 : 1) * 0.55, 190, false); q.a = RF(0, 6.28); });
      },
      update(dt) { sw(dt); },
    };
  },
  // 9장: 순풍이면 벽이 빨라진다
  stormWind(bp) {
    const s = bp.s;
    return {
      update() {
        const w = s.env?.wind; if (!w || !w.blow) { bp.say(''); return; }
        const f = bp.at(Math.max(0, bp.w)), dot = Math.cos(w.a) * f.dx + Math.sin(w.a) * f.dy;
        if (dot > 0.3) { bp.boost = dot * w.k * 34; bp.say(t('modeBreach.e47ca6'), '#ffa090'); } else bp.say(dot < -0.3 ? t('modeBreach.d03a4a') : '', '#b0ffb0');
        if (dot < -0.3) bp.boost = dot * w.k * 18;
      },
    };
  },
  // 10장: 벽이 가까워야만 보인다. 경고 화살표
  abyssDark(bp) {
    const s = bp.s;
    return {
      wallAlpha: () => { const gap = bp.sh - bp.w; return gap < 0 || gap > 340 ? 0 : clamp(1 - gap / 340, 0.15, 1); },
      update() {
        bp.warnArrow(300);
        const gap = bp.sh - bp.w;
        bp.say(gap > 0 && gap < 300 ? t('modeBreach.b496af') : '', '#ff8a7a');
        if (gap > 0 && gap < 160) { bp._bp = (bp._bp || 0) - 1; if (bp._bp <= 0) { bp._bp = 36; sfx('warn', 140); } }
      },
    };
  },
  // 11장: 유사 구덩이 돌아가기 + 모래바람이 옆으로 민다
  sandStorm(bp) {
    const s = bp.s;
    return {
      setup() {
        const env = s.env; env.pits.length = 0;
        for (let k = 0; k < 5; k++) [0.35, 0.7].forEach((f, i) => { if (k === 0 && f < 0.5) return; const p = bp.at(bp.lane(k, f), ((i + k) % 2 ? 1 : -1) * 48); env.addPit(p.x, p.y, 36, Infinity); });
      },
      update() {
        const g = bp.g; g.clear();
        const ph = Math.sin(s.bt / 2600), push = 30 * ph, h = s.hero, a = bp.at(bp.sh);
        bp.drift.x += -a.dy * push; bp.drift.y += a.dx * push;
        for (let i = 0; i < 14; i++) { const sv = bp.sh + ((i * 83 + s.bt * 0.3) % 600) - 200, q = bp.at(sv, ((i * 37) % 200) - 100); g.lineStyle(1.5, 0xe0c080, 0.5).lineBetween(q.x, q.y, q.x - a.dy * ph * 26, q.y + a.dx * ph * 26); }
      },
    };
  },
  // 12장: 분출구 박자 + 압력 방출 때 벽이 달린다
  steamLine(bp) {
    const s = bp.s, sw = surger(bp, 16000, 170, t('modeBreach.c2dc89'), 11000);
    return {
      setup() {
        const env = s.env; env.vents.length = 0;
        let n = 0;
        for (let k = 1; k < 5; k++) [0.3, 0.6, 0.85].forEach((f, i) => { const p = bp.at(bp.lane(k, f), ((i + k) % 3 - 1) * 60); env.vents.push({ x: p.x, y: p.y, r: 26, t: 900 + (n++ % 4) * 900, ph: 'idle' }); });
      },
      update(dt) { sw(dt); },
    };
  },
  // 13장: 기둥을 징검다리 삼아라. 기둥 없는 구간은 번개가 나를 노린다
  thunderFront(bp) {
    const s = bp.s, rods = [];
    let tT = 5000, tgt = null;
    return {
      setup() {
        const env = s.env; env.rods.length = 0;
        [1, 2, 3, 4].forEach(k => { if (k === 3) return; [0.2, 0.5, 0.8].forEach((f, i) => { const p = bp.at(bp.lane(k, f), (i % 2 ? 1 : -1) * 55); const q = { x: p.x, y: p.y, hot: 0 }; env.rods.push(q); rods.push(q); }); });
      },
      update(dt) {
        const g = bp.g, h = s.hero; g.clear();
        const safe = rods.some(q => Math.hypot(h.x - q.x, h.y - q.y) < 170);
        if (safe) { tT = Math.max(tT, 3000); tgt = null; bp.say(t('modeBreach.9adb74'), '#b0e0ff'); return; }
        tT -= dt;
        bp.say(t('modeBreach.a508b1'), '#ffd75e');
        if (tT < 900 && !tgt) tgt = { x: h.x, y: h.y };
        if (tgt) { g.lineStyle(2, 0xffd75e, 0.9).strokeCircle(tgt.x, tgt.y, 30); g.fillStyle(0xffd75e, 0.18).fillCircle(tgt.x, tgt.y, 30); }
        if (tT <= 0) { tT = 4200; if (tgt) { const hit = Math.hypot(h.x - tgt.x, h.y - tgt.y) < 30; flash(s, tgt.x, tgt.y, 0xc8d8f0, t('boss.7e82c9')); sfx('boom', 120); if (hit) s.hurt(s.maxHp * 0.1, 'zap'); tgt = null; } }
      },
    };
  },
  // 14장: 빛줄기가 벽에 닿으면 벽이 빨라진다
  mirrorWall(bp) {
    const s = bp.s;
    return {
      setup() {
        const env = s.env; clearPillars(env);
        for (let k = 0; k < 5; k++) [0.4, 0.8].forEach((f, i) => { if (k === 0 && f < 0.5) return; const p = bp.at(bp.lane(k, f), (i % 2 ? 1 : -1) * (HW - 10)); const q = addPillar(env, p.x, p.y, (i % 2 ? -1 : 1) * 0.6, 195, true); q.a = RF(0, 6.28); });
      },
      update() {
        const f = bp.at(Math.max(0, bp.w)); let hit = false;
        for (const p of s.env.pillars) { const ex = p.x + Math.cos(p.a) * p.len, ey = p.y - 8 + Math.sin(p.a) * p.len; if (bp.w > 0 && Math.hypot(ex - f.x, ey - f.y) < 120) hit = true; }
        if (hit) { bp.boost = 34; bp.say(t('modeBreach.57e6e9'), '#80ffe0'); } else bp.say('');
      },
    };
  },
  // 15장: 모루 화염 버프로 몹을 쓸며 달린다
  furnace(bp) {
    const s = bp.s;
    let prevF = 0, sweepT = 0;
    return {
      setup() {
        const env = s.env; env.anvils.length = 0;
        for (let k = 0; k < 5; k++) [0.35, 0.72].forEach((f, i) => { if (k === 0 && f < 0.5) return; const p = bp.at(bp.lane(k, f), (i % 2 ? 1 : -1) * 50); env.anvils.push({ x: p.x, y: p.y, cd: 0 }); });
      },
      update(dt) {
        const env = s.env, h = s.hero, g = bp.g; g.clear();
        if (env.forged > 0) {
          if (prevF <= 0) { bp.pulse(-170); flash(s, h.x, h.y, 0xff9a30, t('modeBreach.449129')); }
          g.fillStyle(0xff7a20, 0.14).fillCircle(h.x, h.y, 90).lineStyle(2, 0xffb050, 0.7).strokeCircle(h.x, h.y, 90);
          sweepT -= dt;
          if (sweepT <= 0) { sweepT = 380; s.mobs.getChildren().forEach(m => { if (m.active && !m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 90) s.hitMob(m, 4, { src: 'forge', kb: 150, fx: 'big', from: h }); }); }
        }
        prevF = env.forged;
      },
    };
  },
};

export function makeBreachRule(run) {
  if (!run.cfg.path) return null;
  return new BreachPath(run);
}
