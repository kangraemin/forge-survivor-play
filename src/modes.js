// 모드 규칙(지키기·점령·돌파·사냥). Battle.js는 this.mode 훅만 부른다. 설계표는 docs/modes.md, 값은 modeData.js
import * as D from './data.js';
import { font, font9, panel, button, fmt, viewRect, toast, icon, gemIcon, markIcon } from './ui.js';
import { sfx, stopBgm } from './sfx.js';
import { save, mission } from './save.js';
import { addItems } from './gear.js';
import { dexRefresh } from './codex.js';
import { ensureModeArt, modeAnim, wallArt, WALL_FILL, chArt, chSprite } from './modeArt.js';
import { makeRule } from './modeRules.js';
import { MODE_DEFS, MODE_N, modeStage, modeOpen, modeDone, modeCount, modeReward, markGain, markLeftToday, STAR_HURT, starTexts, starMask, starCount, starFirstReward, repeatReward, fmtT } from './modeData.js';
import { t, tt } from './i18n.js';

const WORLD = 1600, W = D.W, H = D.H;
const RF = Phaser.Math.FloatBetween, R = Phaser.Math.Between;
const MX = WORLD / 2;
const COL = [0xff5a5a, 0x5ac8ff, 0xffd75e, 0xc890ff];   // 점령 거점 색(번호 순)
const CSS = ['#ff7a7a', '#7ad4ff', '#ffe27a', '#d6aaff'];

export class ModeRun {
  constructor(s, id, n) {
    this.s = s; this.id = id; this.n = n;
    this.cfg = modeStage(id, n); this.def = MODE_DEFS[id];
    this.t = 0; this.el = 0; this.acc = 0; this.formT = 0; this.eliteDone = false; this.ended = false; this.leg = 0;
    this.limit = (this.cfg.sec || 0) * 1000;
    this.tw = null; this.bp = null;   // 3~15장 규칙 비틀기(modeRules.js·modeBreach.js)는 setup에서 만든다. 1·2장은 null
  }
  // Battle이 읽는 값
  waveLen() { return this.limit || 1e9; }

  // ── 진행도(0~1): 몹 체력 상승(timeHp)과 실패 보상에 쓴다 ──
  progress() { return this.prog(); }
  prog() {
    const c = this.cfg;
    if (this.id === 'breach') return this.bp ? this.bp.prog() : Phaser.Math.Clamp((this.leg + Phaser.Math.Clamp((this.y0 - this.s.hero.y) / c.len, 0, 1)) / (c.legs || 1), 0, 1);
    if (this.id === 'guard' && c.go) return Phaser.Math.Clamp(Math.max(this.item?.prog || 0, this.s.waveT / this.limit * 0.6), 0, 1);
    return Math.min(1, this.s.waveT / (this.limit || 1));
  }

  // ── 시작 ──
  setup() {
    const s = this.s, c = this.cfg;
    ensureModeArt(s);
    this.g = s.add.graphics().setDepth(6);       // 땅 위에 그리는 고리·게이지
    this.hg = s.add.graphics().setScrollFactor(0).setDepth(100);   // 화면 위쪽 진행 표시
    this.hud_ = [];
    // 53차: 몹이 수십 마리 겹쳐도 내 캐릭터가 보이게 발밑에 밝은 청록 고리를 깐다(9장 점령·돌파에서 구분이 안 됐다)
    this.heroRing = s.add.ellipse(0, 0, 38, 15).setStrokeStyle(2, 0x7fe6ee, 1).setDepth(s.heroDisc ? s.heroDisc.depth + 0.3 : 6);
    s.tweens.add({ targets: this.heroRing, alpha: 0.55, duration: 450, yoyo: true, repeat: -1 });
    // 스킬 줄과 콤보 글자를 진행 표시 아래로 내린다
    s.skillRow.setPosition(8, 74); s.comboTxt.setPosition(W - 57, 80);
    this.mkTxt = (x, y, str, o, size = 10) => { const t = s.add.text(x, y, str, o || font9(size, '#ffffff')).setScrollFactor(0).setDepth(101); this.hud_.push(t); return t; };
    if (this.id === 'breach') { this.bigDist = this.mkTxt(W / 2, 92, '', font(22, '#ffffff', 5)); this.bigDist.setOrigin(0.5).setAlpha(0.95); }   // 53차: 돌파 남은 거리를 화면 위 가운데에 크게(몹에 가려 작았다)
    if (this.id === 'breach' && c.path) { this.tw = this.bp = makeRule(this); this.bp.setup(); }   // 3~15장 돌파: 사행 길
    else {
      if (this.id === 'guard') this.setupGuard();
      if (this.id === 'capture') this.setupCapture();
      if (this.id === 'breach') this.setupBreach();
      if (this.id === 'hunt') this.setupHunt();
      this.tw = makeRule(this);
      if (this.tw) { this.prey?.forEach((m, i) => this.tw.preyInit?.(m, i)); this.tw.setup?.(); }
      if (this.id === 'hunt') this.huntDeco();
    }
    s.events.once('shutdown', () => { this.hud_.length = 0; });
  }

  intro() {
    const s = this.s;
    s.banner(`${this.def.name} ${this.n + 1}  ${s.ch.name}`, this.cfg.goal);
    s.time.delayedCall(300, () => !s.over && s.banner(t('modes.cb61ea'), this.cfg.note));
  }

  // 지점에 닿는 그림과 빛(어둠 속에서도 보이게)
  glowAt(x, y, tint, scale = 0.9, a = 0.22) {
    return this.s.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(a).setScale(scale).setDepth(5);
  }

  // 모드 카드 레벨
  cl(k) { return this.s.run.skills[k] || 0; }
  onCard(k, lv) {
    if (k === 'mweaken') for (const m of this.prey || []) if (m.active && !m.dead) { m.hp *= 0.88; m.maxHp *= 0.88; }
  }
  // 화면 밖 목표를 가리키는 화살표(보스 화살표와 같은 수학)
  mkArrow(tint) { return modeAnim(this.s, this.s.add.sprite(0, 0, 'ma_elite_arrow'), 'elite_arrow').setScrollFactor(0).setDepth(61).setVisible(false).setTint(tint); }
  edgeArrow(sp, x, y) {
    const s = this.s, vr = viewRect(s);
    if (vr.contains(x, y)) { sp.setVisible(false); return false; }
    const cx = vr.centerX, cy = vr.centerY, hw = vr.width / 2 - 16, hh = vr.height / 2 - 84;
    const dx = x - cx, dy = y - cy, k = Math.min(hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
    const pulse = 1.3 + 0.2 * Math.sin(s.bt / 160);
    sp.setVisible(true).setPosition((cx + dx * k - vr.x) / vr.width * W, (cy + dy * k - vr.y) / vr.height * H).setRotation(Math.atan2(dy, dx)).setScale(pulse);
    return true;
  }

  // ═══ 지키기 ═══
  setupGuard() {
    const s = this.s, c = this.cfg, h = s.hero;
    const y = c.go ? MX + 150 : MX - 20;
    const art = chArt(s, 'guard', c.c) || (c.go ? 'cart' : 'anvil_guard');   // 3~15장은 장 테마 그림
    const big = c.go ? 2.4 : 2.2;   // 50차: 주인공보다 크고 위 층에 그려 한눈에 보이게
    const sp = modeAnim(s, s.add.sprite(MX, y, 'ma_' + art), art).setDepth(35 + y / WORLD * 0.9);
    sp.setScale(big);
    const sh = s.add.ellipse(MX, y + 14 * big / 1.3, 60, 16, 0x000000, 0.5).setDepth(9);
    const max = Math.round(D.PLAYER.hp * c.hp * 2 * (c.c >= 2 ? Math.pow(D.chapterDmg(c.c) / D.chapterDmg(1), 0.85) : 1));   // 3장부터는 몹 피해가 커진 만큼 물건 체력도 키운다
    this.item = { art, x: MX, y, sp, sh, hp: max, max, prog: 0, startY: y, flashT: 0, att: 0, big, glow: this.glowAt(MX, y, 0x9ad8ff, 1.3, 0.3), bar: s.add.graphics().setDepth(62), ico: s.add.image(0, 0, 'ma_mode_defend').setDisplaySize(15, 15).setDepth(62), lab: s.add.text(0, 0, c.go ? t('modes.4b9182') : t('modes.5599ae'), font(9, '#cfe8ff', 3)).setOrigin(0.5, 1).setDepth(62) };
    this.arrow = this.mkArrow(0x5fc8ff);
    h.setPosition(MX, y + 70);
    if (c.go) {   // 도착 지점 문과 길
      this.endY = y - c.route;
      this.gate = modeAnim(s, s.add.sprite(MX, this.endY, 'ma_goal_flag'), 'goal_flag').setDepth(8).setScale(2);
      this.glowAt(MX, this.endY, 0xffe8a0, 1.1, 0.25);
      const g = s.add.graphics().setDepth(2);
      g.lineStyle(2, 0xffe8a0, 0.28);
      for (let yy = y; yy > this.endY; yy -= 14) g.lineBetween(MX, yy, MX, yy - 7);
    }
    this.barTxt = this.mkTxt(12, 46, c.go ? t('modes.4b9182') : t('modes.5599ae'), font9(10, '#cfe8ff'));
    this.numTxt = this.mkTxt(0, 0, '', font(9, '#ffffff', 2)); this.numTxt.setOrigin(0.5);
  }
  raidWave() {
    const s = this.s, c = this.cfg, it = this.item, n = Math.min(9, 5 + c.c);
    s.banner(c.go ? t('modes.1acafe') : t('modes.9bf4d2'), c.go ? t('modes.153423') : t('modes.7dc74f'));
    sfx('warn');
    for (let i = 0; i < n; i++) {
      const kind = c.raiders[i % c.raiders.length], a = (i / n) * Math.PI * 2 + RF(-0.3, 0.3);
      const at = c.go ? { x: Phaser.Math.Clamp(MX + (i % 2 ? 1 : -1) * R(100, 190), 40, WORLD - 40), y: Math.max(60, it.y - R(190, 260)) } : { x: Phaser.Math.Clamp(it.x + Math.cos(a) * 200, 40, WORLD - 40), y: Phaser.Math.Clamp(it.y + Math.sin(a) * 200, 60, WORLD - 40) };
      const m = s.spawn(false, kind, { at, force: true });
      if (m) { m.raider = true; m.setTint(0xff9a7a); m.baseTint = m.tintTopLeft; }
    }
  }
  guardUpdate(dt) {
    const s = this.s, c = this.cfg, it = this.item, h = s.hero;
    this.spawnTick(dt, 1);
    this.extras(dt);
    this.drawItem();
    if (!it || it.hp <= 0) return;
    // 52차: 습격 — 처음 22초, 이후 32초마다 몹 여럿이 한꺼번에 노리는 물건 쪽으로 달려든다(긴장이 늘 같았다)
    if ((this.raidT = (this.raidT ?? 22000) - dt) <= 0) { this.raidT = 32000; this.raidWave(); }
    const sec = dt / 1000;
    // 모드 카드: 수리(수레 HP 차오름)·가시(곁의 몹이 찔림)
    const rp = this.cl('mrepair'); if (rp) it.hp = Math.min(it.max, it.hp + it.max * 0.008 * rp * sec);
    const th = this.cl('mthorn');
    if (th && (it.thT = (it.thT ?? 600) - dt) <= 0) {
      it.thT = 650; const rad = 52 + (th >= 4 ? 18 : 0), mult = 0.5 * (1 + 0.5 * th);
      s.mobs.getChildren().slice().forEach(m => { if (!m.dead && m.active && Math.hypot(m.x - it.x, m.y - it.y) < rad) s.hitMob(m, mult, { src: 'mthorn', cd: 500, kb: 70, fx: 'small' }); });
    }
    it.att = s.mobs.getChildren().filter(m => m.raider && !m.dead && m.active && Math.hypot(m.x - it.x, m.y - it.y) < 28).length;
    if (c.go) {
      // 곁에 서 있어야 간다. 갉아 대는 몹이 많으면 느려진다
      const near = Math.hypot(h.x - it.x, h.y - it.y) < 80;
      const mul = this.tw?.cartMul ? this.tw.cartMul(near) : near ? 1 : 0;   // 규칙이 속도 배수를 바꾼다(0이면 선다, 음수면 밀린다)
      if (mul !== 0) {
        const v = c.speed * (mul > 0 ? Math.max(0.3, 1 - 0.14 * it.att) : 1) * mul * dt / 1000;
        it.y = Math.min(it.startY, it.y - v); it.sp.y = it.y; it.sh.y = it.y + 12; it.glow.y = it.y; it.sp.setDepth(35 + it.y / WORLD * 0.9);
        it.prog = (it.startY - it.y) / c.route;
      }
      it.moving = mul > 0;
      if (it.y <= this.endY + 6) return this.finish(true);
      s.waveT += dt; if (s.waveT >= this.limit) return this.finish(false, t('modes.bd7fdd'));
    } else {
      s.waveT += dt; if (s.waveT >= this.limit) return this.finish(true);
    }
    // 노리는 몹이 닿으면 갉는다(m.atkT는 steer에서)
    if (it.flashT > 0) { it.flashT -= dt; if (it.flashT <= 0) { it.sp.clearTint(); if (it.art === 'cart' && it.hp > 0) { it.sp.setTexture('ma_cart'); modeAnim(s, it.sp, 'cart'); } } }
  }
  // 물건 머리 위 아이콘·체력바·화면 밖 화살표·바닥 고리
  drawItem() {
    const s = this.s, it = this.item, c = this.cfg, g = this.g;
    g.clear();
    if (!it) return;
    const pulse = 0.5 + 0.5 * Math.sin(s.bt / 260), f = Phaser.Math.Clamp(it.hp / it.max, 0, 1);
    if (it.hp > 0) {
      g.lineStyle(2, 0x5fc8ff, 0.3 + 0.3 * pulse).strokeCircle(it.x, it.y + 12, c.go ? 80 : 46 + pulse * 4);   // 수레는 이 원 안에 서야 간다
      const th = this.cl('mthorn'); if (th) g.lineStyle(1, 0xff6a50, 0.35).strokeCircle(it.x, it.y, 52 + (th >= 4 ? 18 : 0));
    }
    const bw = 64, bx = it.x - bw / 2, by = it.y - it.big * 16 - 14;
    it.bar.clear();
    it.bar.fillStyle(0x000000, 0.7).fillRect(bx - 1, by - 1, bw + 2, 9);
    it.bar.fillStyle(f > 0.5 ? 0x5fdc6a : f > 0.25 ? 0xffb347 : 0xe23a44).fillRect(bx, by, bw * f, 7);
    it.ico.setPosition(bx - 11, by + 3.5); it.lab.setPosition(it.x, by - 2);
    it.sp.x = it.x + (it.att > 0 ? Math.sin(s.bt / 60) * 1.2 : 0);
    if (this.arrow) this.edgeArrow(this.arrow, it.x, it.y);
  }
  hitItem(m) {
    const s = this.s, it = this.item, c = this.cfg;
    const d = m.dmg * 0.55 * (c.mult?.[m.kind] || 1) * (this.tw?.itemDmgMul?.(m) ?? 1);
    if (d > 0) this.damageItem(d);
    this.tw?.onItemHit?.(m);
  }
  // 물건이 입는 피해(규칙에서도 직접 부른다)
  damageItem(d, why) {
    const s = this.s, it = this.item, c = this.cfg;
    if (this.ended || !it || it.hp <= 0) return;
    it.hp = Math.max(0, it.hp - d);
    if (it.art === 'cart' && it.hp > 0) { it.sp.stop(); it.sp.setTexture('ma_cart_hit', (s.bt >> 6) & 1); it.flashT = 160; } else { it.sp.setTintFill(0xffffff); it.flashT = 90; }
    if (!it.ringT || s.bt - it.ringT > 260) {   // 붉은 링이 퍼진다
      it.ringT = s.bt;
      const rg = s.add.circle(it.x, it.y, 26, 0xff4040, 0.12).setStrokeStyle(3, 0xff5050, 1).setDepth(63);
      s.tweens.add({ targets: rg, scale: 2.2, alpha: 0, duration: 340, onComplete: () => rg.destroy() });
    }
    if (!it.popT || s.bt - it.popT > 450) { it.popT = s.bt; const t = s.add.text(it.x + R(-8, 8), it.y - 20, '-' + Math.round(d), font(9, '#ff7070')).setOrigin(0.5).setDepth(40); s.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 500, onComplete: () => t.destroy() }); sfx('hurt', 200); }
    if (it.hp <= 0) { if (it.art === 'cart') { it.sp.stop(); it.sp.setTexture('ma_cart_broken').clearTint(); } else if (it.art !== 'anvil_guard') { it.sp.stop(); it.sp.setTint(0x555566); } this.finish(false, why || (c.go ? tt('modes.61e6dd') : tt('modes.0cad2e'))); }
  }

  // ═══ 점령 ═══
  setupCapture() {
    const s = this.s, c = this.cfg;
    this.pts = [];
    for (let i = 0; i < c.n; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / c.n, x = MX + Math.cos(a) * c.rad, y = MX + Math.sin(a) * c.rad;
      const col = COL[i % COL.length];
      const fill = s.add.image(x, y, 'ma_zone_fill').setDisplaySize(c.r * 2.6, c.r * 2.6).setDepth(3).setTint(col).setAlpha(0.45);   // 50차: 거점마다 다른 색 바닥
      const sp = modeAnim(s, s.add.sprite(x, y, 'ma_zone_ring'), 'zone_ring').setDisplaySize(c.r * 2.4, c.r * 2.4).setDepth(4).setAlpha(1).setTint(col);
      const mark = chSprite(s, 'capture', c.c, x, y - 6, 1.9, 10 + y / WORLD);   // 3~15장: 거점 표식(중립/점령 2프레임)
      const flag = mark || s.add.sprite(x, y - c.r - 12, 'ma_zone_banner', 0).setDepth(10 + y / WORLD).setTint(col).setScale(1.3);
      const num = s.add.text(x, y - 2 + (mark ? 30 : 0), String(i + 1), font(24, CSS[i % CSS.length], 4)).setOrigin(0.5).setDepth(7).setAlpha(0.9);
      const tx = s.add.text(x, y + c.r + 14, '0%', font(10, '#ffffff', 3)).setOrigin(0.5).setDepth(7);
      this.pts.push({ x, y, g: 0, done: false, sp, fill, flag, num, col, tx, glow: this.glowAt(x, y, col, 1.0, 0.22), spT: 0, gT: 3, tT: 800 });
    }
    this.arrow = this.mkArrow(0xffd75e);
    s.hero.setPosition(MX, MX);
    this.slots = [];
  }
  captureUpdate(dt) {
    const s = this.s, c = this.cfg, h = s.hero, sec = dt / 1000;
    const anyIn = this.pts.some(p => !p.done && Math.hypot(h.x - p.x, h.y - p.y) < c.r);
    this.spawnTick(dt, anyIn ? 1.25 : 0.6);   // 50차: 점령 중엔 몹이 더 몰린다
    this.extras(dt);
    s.waveT += dt; if (s.waveT >= this.limit) return this.finish(false, t('modes.bd7fdd'));
    let all = true;
    this.g.clear();
    const tu = this.cl('mturret');
    this.pts.forEach((p, i) => {
      // 거점 포탑: 점령했든 아니든 거점 곁의 몹을 쏜다
      if (tu) {
        this.g.fillStyle(0x2c2a36, 1).fillRect(p.x + c.r * 0.9 - 6, p.y - c.r * 0.9 - 6, 12, 12).fillStyle(0xffd75e, 1).fillCircle(p.x + c.r * 0.9, p.y - c.r * 0.9, 3.5);
        p.tT -= dt;
        if (p.tT <= 0) {
          p.tT = 1500 - 150 * tu; const rng = 150 * (tu >= 4 ? 1.3 : 1), shots = tu >= 5 ? 2 : 1;
          const near = s.mobs.getChildren().filter(m => !m.dead && m.active && Math.hypot(m.x - p.x, m.y - p.y) < rng).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
          for (let k = 0; k < shots && k < near.length; k++) { s.hitMob(near[k], 0.8 * (tu >= 3 ? 1.5 : 1), { src: 'mturret' + i, kb: 40 }); (p.shots ||= []).push({ x: near[k].x, y: near[k].y, t: 110 }); }
        }
        if (p.shots) { p.shots = p.shots.filter(q => (q.t -= dt) > 0); for (const q of p.shots) this.g.lineStyle(2, 0xffe27a, 0.9).lineBetween(p.x + c.r * 0.9, p.y - c.r * 0.9, q.x, q.y); }
      }
      if (p.done) { this.g.lineStyle(3, 0x7ddc6a, 1).strokeCircle(p.x, p.y, c.r + 4); return; }
      all = false;
      const inside = Math.hypot(h.x - p.x, h.y - p.y) < c.r;
      p.inside = inside;
      let rate = (inside ? 100 / c.cap : -100 / c.cap * 0.25) * (inside ? 1 + 0.2 * this.cl('mcapspeed') : 1);   // 서 있으면 차고, 비우면 천천히 빠진다
      // 유령 파수꾼이 비운 무덤을 갉는다
      if (c.ghosts && !inside) {
        const gs = s.mobs.getChildren().filter(m => m.sentry === i && !m.dead && m.active && Math.hypot(m.x - p.x, m.y - p.y) < c.r + 14).length;
        rate -= gs * 6; p.gs = gs;
        p.gT -= sec;
        const have = s.mobs.getChildren().filter(m => m.sentry === i && !m.dead && m.active).length;
        if (p.gT <= 0 && have < 2 && s.mobs.countActive() < 70) { p.gT = 4; const m = s.spawn(false, 'ghost', { force: true, at: { x: p.x + R(-20, 20), y: p.y + R(-20, 20) } }); if (m) m.sentry = i; }
      }
      if (this.tw?.zoneRate) rate = this.tw.zoneRate(p, i, inside, rate);
      p.g = Phaser.Math.Clamp(p.g + rate * sec, 0, 100);
      // 거점 위에 서 있으면 몹이 더 몰린다
      if (inside) {
        p.spT -= sec;
        if (p.spT <= 0 && s.mobs.countActive() < 70) {
          p.spT = 1.1;
          for (let k = 0; k < 3; k++) { const a = RF(0, Math.PI * 2), d = c.r + RF(26, 70); s.spawn(false, c.spawnKind, { force: true, at: { x: Phaser.Math.Clamp(p.x + Math.cos(a) * d, 20, WORLD - 20), y: Phaser.Math.Clamp(p.y + Math.sin(a) * d, 20, WORLD - 20) } }); }
        }
      }
      if (p.g >= 100) {
        p.done = true; p.fill.setTint(0x7ddc6a).setAlpha(0.55); p.flag.setFrame(1); if (p.flag.texture.key === 'ma_zone_banner') p.flag.setTint(0x9dffa0); p.sp.setTint(0x9dffa0); p.tx.setText(t('modeData.7b547e')); p.num.setColor('#9dffa0'); p.glow.setTint(0x7ddc6a); sfx('level');
        toast(s, t('modes.668b49', { length: this.pts.filter(q => q.done).length, n: c.n }), '#7ddc6a', 100);
        return;
      }
      p.tx.setText(Math.floor(p.g) + '%');
      p.fill.setAlpha(inside ? 0.7 : 0.42);
      const col = inside ? 0xffffff : p.col;
      this.g.lineStyle(4, col, inside ? 1 : 0.8).beginPath().arc(p.x, p.y, c.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.g / 100).strokePath();
    });
    // 가장 가까운 미점령 거점이 화면 밖이면 화살표
    const nxt = this.pts.filter(q => !q.done).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (nxt) { this.arrow.setTint(nxt.col); this.edgeArrow(this.arrow, nxt.x, nxt.y); } else this.arrow.setVisible(false);
    if (all && this.pts.length) this.finish(true);
  }

  // ═══ 돌파 ═══
  setupBreach() {
    const s = this.s, c = this.cfg, h = s.hero;
    this.y0 = WORLD - 120; this.goalY = this.y0 - c.len; this.wallStart = WORLD + 560; this.wallY = this.wallStart; this.cx0 = MX - 160; this.cx1 = MX + 160;
    h.setPosition(MX, this.y0);
    this.gate = modeAnim(s, s.add.sprite(MX, this.goalY, 'ma_finish_gate'), 'finish_gate').setDepth(8).setScale(2);
    this.glowAt(MX, this.goalY, 0xffe8a0, 1.4, 0.3);
    // 길 양옆을 어둡게 덮어 한 줄 길로 보이게 한다
    const sd = s.add.graphics().setDepth(3);
    sd.fillStyle(0x000000, 0.5).fillRect(0, this.goalY - 100, this.cx0, WORLD - this.goalY + 100).fillRect(this.cx1, this.goalY - 100, WORLD - this.cx1, WORLD - this.goalY + 100);
    sd.lineStyle(2, 0xffe8a0, 0.3).lineBetween(this.cx0, this.goalY, this.cx0, WORLD).lineBetween(this.cx1, this.goalY, this.cx1, WORLD);
    this.wallKey = 'ma_' + wallArt(c.c);
    // 50차: 어둠 층(깊이 50) 위에 그려 벽 그림이 또렷이 보이게 하고, 가장자리에 붉은 빛줄을 둔다
    const wk = wallArt(c.c), edge = { wall_dark: 0xb060ff, wall_lava: 0xff6a20, wall_ice: 0x7fd8ff, wall_void: 0xc060ff }[wk];
    this.wallSp = s.add.tileSprite(0, this.wallY, WORLD, 64, this.wallKey, 0).setOrigin(0, 1).setDepth(51).setTileScale(2, 2);
    this.wallBody = s.add.rectangle(0, this.wallY, WORLD, 700, WALL_FILL[wk], 0.96).setOrigin(0, 0).setDepth(51);
    this.wallEdge = s.add.rectangle(0, this.wallY, WORLD, 5, edge, 0.9).setOrigin(0, 0.5).setDepth(52).setBlendMode(Phaser.BlendModes.ADD);
    this.wallLab = s.add.text(MX, this.wallY - 76, c.wallName || t('modes.65fef2'), font(12, '#ffd0c0', 3)).setOrigin(0.5, 1).setDepth(52);
    this.warn = s.add.rectangle(W / 2, H - 58, W, 116, 0xc01020, 0).setScrollFactor(0).setDepth(97);   // 벽이 가까우면 화면 아래가 붉게 뛴다
    this.warnTxt = this.mkTxt(W / 2, H - 84, '', font(15, '#ffffff', 4)); this.warnTxt.setOrigin(0.5).setAlpha(0);
    // 52차: 구간·벽 거리는 줄을 나눈다(위 칸은 '1/4구간', 막대 아래 줄은 '벽 이름 거리' — 처치·은화 숫자와 겹쳤다)
    this.wallInfo = this.mkTxt(W / 2, 68, '', font9(10, '#a1b2b6')).setOrigin(0.5, 0); this.s.skillRow.setPosition(8, 84); this.s.comboTxt.setPosition(W - 57, 92);
    this.legTxt = this.mkTxt(W / 2, 128, '', font(14, '#ffe8a0', 4)); this.legTxt.setOrigin(0.5).setAlpha(0);
    this.wallF = 0;
    this.items = [];
    const at = f => this.y0 - c.len * f;
    if (c.torches) for (let i = 0; i < c.torches; i++) {
      const y = at((i + 1) / (c.torches + 1)), x = MX + (i % 2 ? 40 : -40);
      const sp = s.add.image(x, y, 'mode_torch').setDepth(10 + y / WORLD).setDisplaySize(16, 28);
      this.items.push({ kind: 'torch', x, y, sp, glow: this.glowAt(x, y, 0xff9a3c, 0.7, 0.18), on: false });
    }
    if (c.webs) for (let i = 0; i < c.webs; i++) {
      const y = at((i + 0.8) / (c.webs + 0.5)), x = MX + (i % 2 ? -50 : 50);
      const sp = s.add.image(x, y, 'mode_web').setDepth(3).setDisplaySize(130, 130).setAlpha(0.8);
      this.items.push({ kind: 'web', x, y, sp, r: 62 });
    }
    this.wallTxt = this.mkTxt(0, 0, '', font(9, '#ffb0a0', 2));
    this.slowed = false;
    this.arrowUp = null;
  }
  // 다음 구간: 주인공을 아래로 돌려보내고 벽을 다시 먼 곳에 세운다(벽은 구간마다 빨라진다)
  nextLeg() {
    const s = this.s, c = this.cfg, h = s.hero;
    this.leg++; this.legT = 0;
    h.setPosition(MX, this.y0); this.wallY = this.wallStart; this.wallLead = 0;
    for (const o of this.items) if (o.kind === 'torch') { o.on = false; o.sp.clearTint(); o.glow.setAlpha(0.18); }
    s.mobs.getChildren().slice().forEach(m => { if (!m.dead && m.active && !m.isBoss) { m.dead = true; m.body.enable = false; s.tweens.add({ targets: m, alpha: 0, duration: 200, onComplete: () => m.destroy() }); } });
    sfx('level'); s.cameras.main.flash(250, 255, 232, 160);
    this.legTxt.setText(t('modes.f7485c', { v: this.leg + 1 })).setAlpha(1); s.tweens.add({ targets: this.legTxt, alpha: 0, delay: 1500, duration: 500 });
  }
  breachUpdate(dt) {
    const s = this.s, c = this.cfg, h = s.hero, sec = dt / 1000;
    this.spawnTick(dt, 1.15);
    this.t += dt;
    // 벽은 쉬지 않고 올라온다(시간이 갈수록 조금 빨라진다)
    this.legT = (this.legT || 0) + dt;
    this.wallY -= c.wall * (1 + 0.25 * this.leg) * (1 + Math.min(0.35, this.legT / 100000)) * (1 - 0.08 * this.cl('mwallslow')) * sec;
    if (this.windBoost) this.wallY -= this.windBoost * sec;
    h.x = Phaser.Math.Clamp(h.x, this.cx0 + 10, this.cx1 - 10);
    this.wallSp.setPosition(0, this.wallY); this.wallBody.setPosition(0, this.wallY); this.wallEdge.setPosition(0, this.wallY); this.wallLab.setPosition(Phaser.Math.Clamp(h.x, this.cx0, this.cx1), this.wallY - 70);
    this.wallSp.tilePositionX += dt * 0.02;
    // 경고: 벽이 가까우면 화면 아래 붉은 띠와 글자
    const dist = this.wallY - h.y;
    const near = Phaser.Math.Clamp(1 - (dist - 40) / 260, 0, 1);
    this.warn.setFillStyle(0xc01020, near * (0.28 + 0.18 * Math.sin(s.bt / 110)));
    this.warnTxt.setText(near > 0.05 ? t('modes.9900c5', { v: c.wallName || t('modes.8e939b') }) : '').setAlpha(near > 0.05 ? 0.6 + 0.4 * Math.sin(s.bt / 130) : 0);
    if ((this.wallAnim = (this.wallAnim || 0) + dt) > 170 && this.wallSp.texture.frameTotal > 2) { this.wallAnim = 0; this.wallF = (this.wallF + 1) % 4; this.wallSp.setFrame(this.wallF); }
    this.slowed = false;
    for (const o of this.items) {
      if (o.kind === 'torch' && !o.on && Math.hypot(h.x - o.x, h.y - o.y) < 34) {
        o.on = true; o.sp.setTint(0xffe070); o.glow.setAlpha(0.45); this.wallY += 150; sfx('level');
        toast(s, t('modes.4e8154'), '#ffd75e', 100);
      }
      if (o.kind === 'web' && Math.hypot(h.x - o.x, h.y - o.y) < o.r) this.slowed = true;
    }
    // 벽 안에 들어간 몹은 사라지고, 주인공은 크게 다친다
    this.wallT = (this.wallT || 0) - dt;
    if (this.wallT <= 0) {
      this.wallT = 250;
      s.mobs.getChildren().slice().forEach(m => { if (!m.dead && m.active && m.y > this.wallY - 4) { m.dead = true; m.body.enable = false; s.tweens.add({ targets: m, alpha: 0, duration: 200, onComplete: () => m.destroy() }); } });
    }
    this.inWall = h.y + 8 > this.wallY;
    if (this.inWall && s.bt >= s.iframe) s.hurt(s.maxHp * c.wallDmg, 'wall');
    if (h.y <= this.goalY + 14) { if (this.leg + 1 < (c.legs || 1)) this.nextLeg(); else return this.finish(true); }
  }

  // ═══ 사냥 ═══
  // 3~15장 사냥 장치 그림: 판 둘레에 일곱 군데(정예가 도망·숨는 자리). 파일이 없으면 놓지 않는다
  huntDeco() {
    const s = this.s, c = this.cfg;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.5, d = 150 + (i % 3) * 120, x = Phaser.Math.Clamp(MX + Math.cos(a) * d, 50, WORLD - 50), y = Phaser.Math.Clamp(MX + Math.sin(a) * d, 50, WORLD - 50);
      chSprite(s, 'hunt', c.c, x, y, 2, 6);
    }
  }
  setupHunt() {
    const s = this.s, c = this.cfg, h = s.hero;
    this.prey = []; this.preyTotal = c.prey.length;
    h.setPosition(MX, MX);
    c.prey.forEach((kind, i) => {
      const a = i * Math.PI * 2 / c.prey.length + RF(-0.3, 0.3), d = RF(260, 420);
      const m = s.spawn(false, kind, { elite: true, force: true, at: { x: Phaser.Math.Clamp(MX + Math.cos(a) * d, 60, WORLD - 60), y: Phaser.Math.Clamp(MX + Math.sin(a) * d, 60, WORLD - 60) } });
      if (!m) return;
      m.prey = true; m.maxHp = m.hp = m.hp * 0.8; m.dmg *= 0.5; m.ph = 'rest'; m.phT = RF(0.2, 1.2); m.hide = kind === 'ghost';
      m.runSpd = c.run ? c.run * (kind === 'bat' ? 1.3 : 1) : kind === 'bat' ? 82 : kind === 'ghost' ? 66 : 60;
      m.mk = modeAnim(s, s.add.sprite(m.x, m.y, 'ma_elite_mark'), 'elite_mark').setDepth(41);
      m.au = modeAnim(s, s.add.sprite(m.x, m.y, 'ma_elite_aura'), 'elite_aura').setDepth(8);
      this.prey.push(m);
    });
    this.arrows = c.prey.map(() => modeAnim(s, s.add.sprite(0, 0, 'ma_elite_arrow'), 'elite_arrow').setScrollFactor(0).setDepth(61).setVisible(false));
    this.cnt = this.mkTxt(0, 0, '', font(10, '#ffd75e', 2));
  }
  huntUpdate(dt) {
    const s = this.s;
    this.spawnTick(dt, 0.55);
    this.extras(dt, true);
    s.waveT += dt; if (s.waveT >= this.limit) return this.finish(false, t('modes.bd7fdd'));
    for (const m of this.prey) {
      if (m.active && !m.dead) { m.lx = m.x; m.ly = m.y; m.mk.setPosition(m.x, m.y - m.displayHeight * 0.5 - 8); m.au.setPosition(m.x, m.y + m.displayHeight * 0.4); continue; }
      m.mk?.destroy(); m.au?.destroy(); m.mk = m.au = null;
      const bu = s.add.sprite(m.lx ?? m.x, m.ly ?? m.y, 'ma_catch_burst').setDepth(42);
      if (s.anims.exists('ma_catch_burst')) { bu.play('ma_catch_burst'); bu.once('animationcomplete', () => bu.destroy()); s.time.delayedCall(700, () => bu.active && bu.destroy()); } else s.time.delayedCall(300, () => bu.destroy());
    }
    this.prey = this.prey.filter(m => m.active && !m.dead);
    if (!this.prey.length) this.finish(true);
  }
  huntArrows() {
    this.arrows.forEach((sp, i) => { const m = this.prey[i]; if (!m || (this.tw?.arrowOk && !this.tw.arrowOk(m))) sp.setVisible(false); else this.edgeArrow(sp, m.x, m.y); });
  }

  // ── 공통: 일반 몹이 계속 방해한다 ──
  spawnTick(dt, mul) {
    const s = this.s, f = s.progress();
    const ramp = s.c >= 1 ? Math.min(1, 0.4 + s.bt / 25000 * 0.6) : 1;
    this.acc += dt * (2.5 + D.stageSpawn(1) + 5 * f) * ramp * mul / 1000;
    while (this.acc >= 1) { this.acc--; if (s.mobs.countActive() < Math.min(60, ramp < 1 ? 30 + s.bt / 1000 * 1.6 : 60)) s.spawn(); }
  }
  extras(dt, noElite) {
    const s = this.s;
    if (!noElite && !this.eliteDone && s.waveT > this.limit * 0.5) { this.eliteDone = true; s.spawn(false, s.ch.mobs[1], { elite: true, force: true }); }
    if ((this.formT += dt) > 20000) { this.formT = 0; s.formation(); }
  }

  update(dt) {
    if (this.ended) return;
    this.t += this.id === 'breach' ? 0 : dt;
    this.el += dt;
    if (this.bp) return this.bp.update(dt);
    if (this.id === 'guard') this.guardUpdate(dt);
    else if (this.id === 'capture') this.captureUpdate(dt);
    else if (this.id === 'breach') this.breachUpdate(dt);
    else this.huntUpdate(dt);
    if (!this.ended) this.tw?.update?.(dt);
  }

  // ── 몹 훅 ──
  onSpawn(m) {
    if (this.id !== 'guard' || m.elite || m.prey) return;
    const c = this.cfg;
    if (c.raiders.includes(m.kind) && Math.random() < c.raid && this.s.mobs.getChildren().filter(q => q.raider && !q.dead && q.active).length < c.cap) { m.raider = true; m.setTint(0xff9a7a); m.baseTint = m.tintTopLeft; }
  }
  spawnPoint(min, max) {
    if (this.bp) return this.bp.spawnPoint(min, max);
    if (this.id !== 'breach') return null;
    const h = this.s.hero;
    for (let i = 0; i < 6; i++) {
      // 50차: 길 한가운데를 꽉 막지 않게 가장자리 쪽에서 나오고, 주인공 바로 앞(180px 안)엔 두지 않는다
      const y = h.y - RF(Math.max(min * 0.8, 180), Math.max(max * 1.1, 300)), side = Math.random() < 0.5 ? -1 : 1;
      const x = Phaser.Math.Clamp(MX + side * RF(95, 190), this.cx0 - 30, this.cx1 + 30);
      if (y > this.goalY - 30 && y < this.wallY - 40) return { x, y };
    }
    return { x: Phaser.Math.Clamp(MX + (Math.random() < 0.5 ? -1 : 1) * R(100, 170), this.cx0, this.cx1), y: Math.max(this.goalY + 20, h.y - 260) };
  }
  targetOf(m) { return m.raider && this.item && this.item.hp > 0 ? this.item : null; }
  // true를 돌려주면 Battle은 이 몹의 기본 이동을 건너뛴다
  steer(m, dt) {
    const s = this.s, h = s.hero;
    if (m.raider && this.item?.hp > 0) {
      const it = this.item, d = Math.hypot(it.x - m.x, it.y - m.y);
      if (d < 22) {
        m.setVelocity(0, 0);
        m.atkT = (m.atkT ?? 400) - dt;
        if (m.atkT <= 0) { m.atkT = 900; this.hitItem(m); }
        return true;
      }
      if (Math.hypot(h.x - m.x, h.y - m.y) < 40) return false;   // 주인공이 코앞이면 주인공을 문다
      m.setVelocity((it.x - m.x) / d * m.spd, (it.y - m.y) / d * m.spd);
      return true;
    }
    if (m.sentry != null) {
      const p = this.pts?.[m.sentry];
      if (!p || p.done) { m.sentry = null; return false; }
      if (Math.hypot(h.x - m.x, h.y - m.y) < 110) return false;   // 가까이 가면 달려든다
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
      if (d > this.cfg.r * 0.5) m.setVelocity(dx / d * m.spd, dy / d * m.spd);
      else m.setVelocity(Math.cos(m.t / 600 + m.phase) * 14, Math.sin(m.t / 600 + m.phase) * 14);
      return true;
    }
    if (this.tw?.steer?.(m, dt)) return true;
    if (m.prey) {
      const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy) || 1;
      if (m.hide) { const vis = d < 115 + 22 * this.cl('mmark'); m.setAlpha(vis ? 0.9 : 0.12); m.mk?.setAlpha(vis ? 1 : 0.15); m.au?.setAlpha(vis ? 1 : 0.15); }
      m.phT -= dt / 1000;
      if (this.tw?.prey?.(m, dt)) return true;
      if (d > 280) { m.setVelocity(Math.cos(m.t / 900 + m.phase) * 14, Math.sin(m.t / 900 + m.phase) * 14); return true; }   // 멀리 있으면 서성인다
      if (m.phT <= 0) { m.ph = m.ph === 'run' ? 'rest' : 'run'; m.phT = m.ph === 'run' ? RF(1.0, 1.5) : RF(0.7, 1.1); if (m.ph === 'run') m.fx = dx / d, m.fy = dy / d; }
      if (m.ph === 'rest') { m.setVelocity(0, 0); return true; }
      // 도망: 주인공 반대쪽, 가장자리에선 가운데 쪽으로 휘어 구석에 몰리지 않게
      const edge = Math.max(0, 1 - Math.min(m.x, m.y, WORLD - m.x, WORLD - m.y) / 200);
      let vx = (m.fx ?? dx / d) + (MX - m.x) / 800 * edge * 3, vy = (m.fy ?? dy / d) + (MX - m.y) / 800 * edge * 3;
      const vl = Math.hypot(vx, vy) || 1;
      const slow = (m.slow > 0 ? 0.5 : 1) * (1 - 0.07 * this.cl('mmark')) * (this.tw?.preySpd?.(m) ?? 1);
      m.setVelocity(vx / vl * m.runSpd * slow, vy / vl * m.runSpd * slow);
      this.tw?.preyPost?.(m, dt);
      return true;
    }
    return false;
  }
  spdMul() { if (this.bp) return this.bp.spdMul(); return this.id === 'breach' ? (this.slowed ? 0.5 : 1) * (this.inWall ? 0.7 : 1) * 0.62 * (1 + 0.06 * this.cl('mdash')) : 1; }

  // 봇이 판 목표를 따라가게 하는 방향(자동 검증용)
  botDir() {
    const h = this.s.hero;
    const to = (x, y, k) => { const d = Math.hypot(x - h.x, y - h.y) || 1; return { x: (x - h.x) / d * k, y: (y - h.y) / d * k, d }; };
    if (this.id === 'guard' && this.item) { const t = to(this.item.x, this.item.y - 6, 1.4); return t.d > 40 ? t : { x: 0, y: 0 }; }
    if (this.id === 'capture') { const p = this.pts.find(q => !q.done); if (p) { const t = to(p.x, p.y, 2.2); return t.d > this.cfg.r * 0.3 ? t : { x: 0, y: 0 }; } }
    if (this.id === 'breach') return this.bp ? this.bp.botDir() : { x: (MX - h.x) / 400, y: -1.5 };
    if (this.id === 'hunt') { const m = this.prey[0]; if (m) { let b = m, bd = 1e9; for (const q of this.prey) { const d = Math.hypot(q.x - h.x, q.y - h.y); if (d < bd) { bd = d; b = q; } } return to(b.x, b.y, 1.6); } }
    return null;
  }

  // ── 진행 표시(화면 위쪽) ──
  hud() {
    const s = this.s, c = this.cfg, g = this.hg, id = this.id;
    g.clear();
    if (this.heroRing) this.heroRing.setPosition(s.hero.x, s.hero.y + s.hero.displayHeight / 2 - 2);
    const lim = this.limit, left = Math.max(0, Math.ceil((lim - s.waveT) / 1000));
    const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (id === 'breach') { s.timeTxt.setText(''); }
    else { s.timeTxt.setText(t('modes.8a295c', { mmss })).setColor(left <= 10 ? '#ffd75e' : '#ffffff'); }
    const bx = 8, bw = W - 16;
    if (id === 'guard') {
      const it = this.item, f = Math.max(0, it.hp / it.max);
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, c.go ? 26 : 18);
      g.fillStyle(0x1c0709).fillRect(48, 47, bw - 44, 11);
      g.fillStyle(f > 0.5 ? 0x5fdc6a : f > 0.25 ? 0xffb347 : 0xe23a44).fillRect(48, 47, (bw - 44) * f, 11);
      this.barTxt.setPosition(12, 46); this.barTxt.setText(c.go ? t('modes.4b9182') : t('modes.5599ae'));
      this.numTxt.setPosition(48 + (bw - 44) / 2, 52.5).setText(`${Math.ceil(it.hp)}/${it.max}`);
      s.waveTxt.setText(c.go ? t('modes.693c73', { round: Math.round(it.prog * 100) }) : t('battle.39fc0b')).setColor(it.moving ? '#5fdc6a' : '#a1b2b6');
      if (c.go) { g.fillStyle(0x1a2430).fillRect(48, 61, bw - 44, 5); g.fillStyle(0x6fd3ff).fillRect(48, 61, (bw - 44) * Phaser.Math.Clamp(it.prog, 0, 1), 5); this.barTxt.setText(t('modes.4b9182')); }
    } else if (id === 'capture') {
      const n = this.pts.length, gap = 4, sw = (bw - gap * (n - 1)) / n;
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 18);
      this.pts.forEach((p, i) => {
        const x = bx + i * (sw + gap);
        g.fillStyle(0x1a2430).fillRect(x + 2, 47, sw - 4, 11);
        g.fillStyle(p.done ? 0x7ddc6a : p.inside ? 0xffd75e : 0x6fd3ff).fillRect(x + 2, 47, (sw - 4) * p.g / 100, 11);
      });
      s.waveTxt.setText(t('modes.203ed7', { length: this.pts.filter(p => p.done).length, n })).setColor('#a1b2b6');
    } else if (id === 'breach' && this.bp) {
      this.bp.hud(g, bx, bw);
    } else if (id === 'breach') {
      const prog = Phaser.Math.Clamp((this.y0 - s.hero.y) / c.len, 0, 1), wp = Phaser.Math.Clamp((this.y0 - this.wallY) / c.len, -0.2, 1);
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 22);
      g.fillStyle(0x1a2430).fillRect(14, 49, bw - 12, 8);
      if (wp > 0) g.fillStyle(0x8a2a9a).fillRect(14, 49, (bw - 12) * Math.min(1, wp), 8);
      g.fillStyle(0xffe8a0).fillRect(14 + (bw - 12) * prog - 2, 46, 4, 14);
      g.fillStyle(0xffe8a0).fillRect(bx + bw - 6, 44, 3, 22);
      const gap = Math.max(0, Math.round((this.wallY - s.hero.y) / 4));
      s.timeTxt.setText(t('modes.02f94d', { max: Math.max(0, Math.round((s.hero.y - this.goalY) / 4)) })).setColor('#ffffff');
      s.waveTxt.setText(t('modes.b33be9', { v: this.leg + 1, v2: c.legs || 1 })).setColor('#a1b2b6');
      this.bigDist?.setText(`${Math.max(0, Math.round((s.hero.y - this.goalY) / 4))}m`).setColor(gap < 25 ? '#ff7070' : '#ffffff');
      this.wallInfo.setText(`${c.wallName || t('modes.8e939b')} ${gap}m`).setColor(gap < 25 ? '#ff7070' : '#a1b2b6');
      this.wallTxt.setText('').setPosition(0, 0);
    } else {
      const n = this.preyTotal, alive = this.prey.length;
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 18);
      for (let i = 0; i < n; i++) { const x = bx + 6 + i * 16; g.fillStyle(i < n - alive ? 0x5fdc6a : 0xe23a44).fillRect(x, 48, 12, 10); }
      this.cnt.setPosition(bx + 8 + n * 16, 47).setText(t('modes.a88df5', { alive }));
      s.waveTxt.setText(t('modes.68296e', { v: n - alive, n })).setColor('#a1b2b6');
      this.huntArrows();
    }
  }

  // ── 끝 ──
  finish(win, why) {
    const s = this.s;
    if (this.ended || s.over) return;
    this.ended = true; this.why = why;
    s.log('mode_end', { mode: this.id, n: this.n, win, why });
    if (win) { sfx('win'); s.banner(t('modes.e7f866'), this.def.one); }
    else s.banner(t('modes.f81efa'), why || '');
    s.mobs.getChildren().forEach(m => { if (!m.dead && m.body) m.body.enable = false; });
    s.over = true; s.physics.pause();
    s.time.delayedCall(900, () => { s.over = false; s.ui.result(win); });
  }

  // ── 별 판정(이긴 판에서만): ★1 클리어 · ★2 제한 시간(par초) 안에 [성물함은 물건 HP가 keep 이상] · ★3 받은 피해가 체력의 STAR_HURT 이하 ──
  hurtFrac() { const by = this.s.run.dmgBy || {}; return Object.values(by).reduce((a, b) => a + b, 0) / Math.max(1, this.s.maxHp); }
  starsNow(win) {
    if (!win) return 0;
    const c = this.cfg;
    let m = 1;
    if (c.par ? this.el / 1000 <= c.par : this.item && this.item.hp / this.item.max >= (c.keep || 0.6)) m |= 2;
    if (this.hurtFrac() <= STAR_HURT) m |= 4;
    return m;
  }

  // ── 결과 창(overlay.result가 모드 판이면 이쪽으로 넘긴다) ──
  result(win, ui) {
    const s = this.s, sv = s.sv, r = s.run, c = this.cfg, key = `${this.id}:${this.n}`;
    s.over = true; s.physics.pause();
    const first = win && !modeDone(sv, this.id, this.n);
    const mask = this.starsNow(win), stars = starCount(mask), sec = this.el / 1000, hurt = this.hurtFrac();
    const old = starMask(sv, this.id, this.n), fresh = win ? mask & ~old : 0;   // 이번에 처음 딴 별
    let rw = win ? (first ? modeReward(c.c, true) : repeatReward(c.c, stars)) : { gold: Math.round(D.clearGold(c.c, 1) * 0.3 * this.prog()), stone: 0, gem: 0 };
    // 54차: 도전 증표 — 승급 재료. 첫 클리어 1개, 다시 깨면 하루 3번까지 1개(이긴 판만)
    const mk = win ? markGain(sv, this.id, this.n) : 0, mkFull = win && !mk && !first && markLeftToday(sv) <= 0;
    let bonus = 0;
    for (const b of [2, 4]) if (fresh & b) { const f = starFirstReward(c.c); rw.gold += f.gold; rw.stone += f.stone; rw.gem += f.gem; bonus++; }
    rw.stone += r.stones;
    if (win) {
      const md = sv.modes; (md.clear ||= {})[key] = 1; (md.stars ||= {})[key] = old | mask;
      const bs = (md.best ||= {})[key] || {}, sc = Math.round(sec), hp = Math.round(hurt * 100);
      md.best[key] = { t: bs.t ? Math.min(bs.t, sc) : sc, hurt: bs.hurt != null ? Math.min(bs.hurt, hp) : hp };
      mission('clear');
      if (mk) { (md.mark ||= {}); if (md.mark[key]) sv.markN = (sv.markN | 0) + 1; else md.mark[key] = 1; sv.mark = (sv.mark | 0) + 1; }
    }
    sv.gold += rw.gold; sv.stone += rw.stone; sv.gem += rw.gem;
    if (r.loot?.length) addItems(sv, r.loot);
    dexRefresh(sv);
    save();
    stopBgm(); sfx(win ? 'win' : 'fail');
    s.log('battle_end', { win, mode: this.id, n: this.n, first, stars, newStars: starCount(fresh), time: Math.round(sec), hurt: Math.round(hurt * 100), kills: r.kills, gold: rw.gold, stone: rw.stone, gem: rw.gem, mark: mk, power: D.powerOf(sv) });
    const cnt = modeCount(sv, this.id);
    s.registry.set('lastResult', { win, mode: this.id, n: this.n, stars, gold: rw.gold, stone: rw.stone, gem: rw.gem, mark: mk, kills: r.kills, lv: r.lv, progress: win ? 1 : this.prog(), t: s.bt });
    if (ui.c) { ui.c.destroy(); ui.c = null; ui.open = null; }
    ui.queue = []; ui.pendingLv = 0;
    const cc = ui.begin('result');
    cc.add(panel(s, 20, 96, W - 40, 356, { fill: 0x1a1426, line: win ? 0xffd75e : 0x7a3a4a }));
    cc.add(s.add.text(W / 2, 124, win ? t('modes.947667') : t('modes.f81efa'), font(18, win ? '#ffd75e' : '#ff7070')).setOrigin(0.5));
    cc.add(s.add.text(W / 2, 148, `${this.def.name} ${this.n + 1}  ${s.ch.name}`, font9(10, '#a1b2b6')).setOrigin(0.5));
    cc.add(s.add.text(W / 2, 166, win ? (first ? t('modes.4abc46', { FIRST_CLEAR_MUL: D.FIRST_CLEAR_MUL }) : t('modes.dd9ec7')) : (this.why || t('modes.89941f')), font9(11, win ? '#ffd75e' : '#ff9090')).setOrigin(0.5));
    // 가운데: 별 3개와 조건
    const tx = starTexts(c);
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 78, got = mask & (1 << i), isNew = fresh & (1 << i);
      cc.add(s.add.text(x, 192, '★', font(22, got ? '#ffd75e' : '#4a4256', 3)).setOrigin(0.5));
      cc.add(s.add.text(x, 214, tx[i], { ...font9(9, got ? '#f2e4bc' : '#6a6078'), align: 'center', wordWrap: { width: 74 } }).setOrigin(0.5, 0));
      if (isNew && i > 0) cc.add(s.add.text(x, 246, t('modes.25047d'), font9(9, '#ffb050')).setOrigin(0.5));
    }
    cc.add(s.add.rectangle(W / 2, 262, W - 80, 1, 0x293845));
    // 이번 판 기록
    [[t('modes.6c3513'), fmtT(sec)], [t('battle.5e9c0f'), fmt(r.kills)], [t('modes.33dde2'), t('modes.e403d2', { round: Math.round(hurt * 100) })]].forEach(([a, b], i) => {
      const x = W / 2 + (i - 1) * 78;
      cc.add(s.add.text(x, 278, a, font9(10, '#a1b2b6')).setOrigin(0.5));
      cc.add(s.add.text(x, 296, b, font(13)).setOrigin(0.5));
    });
    cc.add(s.add.rectangle(W / 2, 314, W - 80, 1, 0x293845));
    const rows = [[12, t('contentTab.a3755a'), rw.gold], [13, t('contentTab.5bf71e'), rw.stone]];
    if (rw.gem) rows.push([-1, t('lobby.1fed91'), rw.gem]);
    if (mk) rows.push([-2, t('modes.c57bf4'), mk]);
    rows.forEach(([ic, name, n], i) => {
      const x = i % 2 ? 146 : 38, y = 330 + Math.floor(i / 2) * 22;
      cc.add(ic === -2 ? markIcon(s, x + 8, y, 14) : ic < 0 ? gemIcon(s, x + 8, y, 12) : icon(s, x + 8, y, ic, 16));
      { const nt = s.add.text(x + 20, y, name, font9(10, '#a1b2b6')).setOrigin(0, 0.5), mw = 66 - (('+' + fmt(n)).length * 7 + 3); if (nt.width > mw) nt.setScale(Math.max(0.6, mw / nt.width)); cc.add(nt); }
      cc.add(s.add.text(x + 88, y, '+' + fmt(n), font(12)).setOrigin(1, 0.5));
    });
    if (mkFull) cc.add(s.add.text(W / 2, cnt >= MODE_N ? 399 : 388, t('modes.ec29b8'), font9(9, '#7fe6ee')).setOrigin(0.5));
    cc.add(s.add.text(W / 2, 372, t('modes.0b6006', { name: this.def.name, cnt, MODE_N }), font9(10, '#a1b2b6')).setOrigin(0.5));
    if (win && cnt >= MODE_N) cc.add(s.add.text(W / 2, 388, t('modes.124143', { title: this.def.title }), font(11, '#ffb050')).setOrigin(0.5));
    // 버튼: 주황은 하나. 이기면 다음 판(열려 있고 만들어져 있을 때), 졌으면 다시
    const nextOk = win && modeStage(this.id, this.n + 1) && modeOpen(sv, this.n + 1);
    const go = (n) => s.scene.start('Battle', { mode: { id: this.id, n }, bot: s.bot });
    cc.add(button(s, 68, 418, 92, 30, t('modes.7add28'), () => s.scene.start('Lobby', { tab: 'battle', modeSel: this.id, modeN: this.n }), { color: 0x3a3846, size: 11 }));
    cc.add(button(s, 188, 418, 120, 36, nextOk ? t('modes.d86221', { v: this.n + 2 }) : win ? t('modes.215120') : t('overlay.e671aa'), () => go(nextOk ? this.n + 1 : this.n), { color: 0x2f6b3a, size: 13 }));
  }
}
