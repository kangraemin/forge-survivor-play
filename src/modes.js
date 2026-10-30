// 모드 규칙(지키기·점령·돌파·사냥). Battle.js는 this.mode 훅만 부른다. 설계표는 docs/modes.md, 값은 modeData.js
import * as D from './data.js';
import { font, font9, panel, button, fmt, viewRect, toast, icon, gemIcon } from './ui.js';
import { sfx, stopBgm } from './sfx.js';
import { save, mission } from './save.js';
import { addItems } from './gear.js';
import { dexRefresh } from './codex.js';
import { ensureModeArt, modeAnim, wallArt, WALL_FILL } from './modeArt.js';
import { MODE_DEFS, MODE_N, modeStage, modeOpen, modeDone, modeCount, modeReward } from './modeData.js';

const WORLD = 1600, W = D.W, H = D.H;
const RF = Phaser.Math.FloatBetween, R = Phaser.Math.Between;
const MX = WORLD / 2;

export class ModeRun {
  constructor(s, id, n) {
    this.s = s; this.id = id; this.n = n;
    this.cfg = modeStage(id, n); this.def = MODE_DEFS[id];
    this.t = 0; this.acc = 0; this.formT = 0; this.eliteDone = false; this.ended = false;
    this.limit = (this.cfg.sec || 0) * 1000;
  }
  // Battle이 읽는 값
  waveLen() { return this.limit || 1e9; }

  // ── 진행도(0~1): 몹 체력 상승(timeHp)과 실패 보상에 쓴다 ──
  progress() { return this.prog(); }
  prog() {
    const c = this.cfg;
    if (this.id === 'breach') return Phaser.Math.Clamp((this.y0 - this.s.hero.y) / c.len, 0, 1);
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
    // 스킬 줄과 콤보 글자를 진행 표시 아래로 내린다
    s.skillRow.setPosition(8, 74); s.comboTxt.setPosition(W - 57, 80);
    this.mkTxt = (x, y, str, o, size = 10) => { const t = s.add.text(x, y, str, o || font9(size, '#ffffff')).setScrollFactor(0).setDepth(101); this.hud_.push(t); return t; };
    if (this.id === 'guard') this.setupGuard();
    if (this.id === 'capture') this.setupCapture();
    if (this.id === 'breach') this.setupBreach();
    if (this.id === 'hunt') this.setupHunt();
    s.events.once('shutdown', () => { this.hud_.length = 0; });
  }

  intro() {
    const s = this.s;
    s.banner(`${this.def.name} ${this.n + 1}  ${s.ch.name}`, this.cfg.goal);
    s.time.delayedCall(300, () => !s.over && s.banner('이번 판의 규칙', this.cfg.note));
  }

  // 지점에 닿는 그림과 빛(어둠 속에서도 보이게)
  glowAt(x, y, tint, scale = 0.9, a = 0.22) {
    return this.s.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(a).setScale(scale).setDepth(5);
  }

  // ═══ 지키기 ═══
  setupGuard() {
    const s = this.s, c = this.cfg, h = s.hero;
    const y = c.go ? MX + 150 : MX - 20;
    const art = c.go ? 'cart' : 'anvil_guard';
    const sp = modeAnim(s, s.add.sprite(MX, y, 'ma_' + art), art).setDepth(10 + y / WORLD);
    sp.setScale(1.3);
    const sh = s.add.ellipse(MX, y + 12, 34, 10, 0x000000, 0.5).setDepth(9);
    const max = Math.round(D.PLAYER.hp * c.hp * 2);
    this.item = { x: MX, y, sp, sh, hp: max, max, prog: 0, startY: y, flashT: 0, att: 0, glow: this.glowAt(MX, y, 0x9ad8ff) };
    h.setPosition(MX, y + 46);
    if (c.go) {   // 도착 지점 문과 길
      this.endY = y - c.route;
      this.gate = modeAnim(s, s.add.sprite(MX, this.endY, 'ma_goal_flag'), 'goal_flag').setDepth(8).setScale(1.5);
      this.glowAt(MX, this.endY, 0xffe8a0, 1.1, 0.25);
      const g = s.add.graphics().setDepth(2);
      g.lineStyle(2, 0xffe8a0, 0.28);
      for (let yy = y; yy > this.endY; yy -= 14) g.lineBetween(MX, yy, MX, yy - 7);
    }
    this.barTxt = this.mkTxt(12, 46, c.go ? '수레' : '성물함', font9(10, '#cfe8ff'));
    this.numTxt = this.mkTxt(0, 0, '', font(9, '#ffffff', 2)); this.numTxt.setOrigin(0.5);
  }
  guardUpdate(dt) {
    const s = this.s, c = this.cfg, it = this.item, h = s.hero;
    this.spawnTick(dt, 1);
    this.extras(dt);
    if (!it || it.hp <= 0) return;
    it.att = s.mobs.getChildren().filter(m => m.raider && !m.dead && m.active && Math.hypot(m.x - it.x, m.y - it.y) < 28).length;
    if (c.go) {
      // 곁에 서 있어야 간다. 갉아 대는 몹이 많으면 느려진다
      const near = Math.hypot(h.x - it.x, h.y - it.y) < 80;
      if (near) {
        const v = c.speed * Math.max(0.3, 1 - 0.14 * it.att) * dt / 1000;
        it.y -= v; it.sp.y = it.y; it.sh.y = it.y + 12; it.glow.y = it.y; it.sp.setDepth(10 + it.y / WORLD);
        it.prog = (it.startY - it.y) / c.route;
      }
      it.moving = near;
      if (it.y <= this.endY + 6) return this.finish(true);
      s.waveT += dt; if (s.waveT >= this.limit) return this.finish(false, '시간이 다 됐다');
    } else {
      s.waveT += dt; if (s.waveT >= this.limit) return this.finish(true);
    }
    // 노리는 몹이 닿으면 갉는다(m.atkT는 steer에서)
    if (it.flashT > 0) { it.flashT -= dt; if (it.flashT <= 0) it.sp.clearTint(); }
    const wob = it.att > 0 ? Math.sin(s.bt / 60) * 1.2 : 0;
    it.sp.x = it.x + wob;
  }
  hitItem(m) {
    const s = this.s, it = this.item, c = this.cfg;
    const d = m.dmg * 0.55 * (c.mult?.[m.kind] || 1);
    it.hp = Math.max(0, it.hp - d);
    it.sp.setTintFill(0xffffff); it.flashT = 70;
    if (!it.popT || s.bt - it.popT > 450) { it.popT = s.bt; const t = s.add.text(it.x + R(-8, 8), it.y - 20, '-' + Math.round(d), font(9, '#ff7070')).setOrigin(0.5).setDepth(40); s.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 500, onComplete: () => t.destroy() }); sfx('hurt', 200); }
    if (it.hp <= 0) { if (c.go) { it.sp.stop(); it.sp.setTexture('ma_cart_broken').clearTint(); } this.finish(false, c.go ? '수레가 부서졌다' : '성물함이 부서졌다'); }
  }

  // ═══ 점령 ═══
  setupCapture() {
    const s = this.s, c = this.cfg;
    this.pts = [];
    for (let i = 0; i < c.n; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / c.n, x = MX + Math.cos(a) * c.rad, y = MX + Math.sin(a) * c.rad;
      const fill = s.add.image(x, y, 'ma_zone_fill').setDisplaySize(c.r * 2.2, c.r * 2.2).setDepth(3).setVisible(false);
      const sp = modeAnim(s, s.add.sprite(x, y, 'ma_zone_ring'), 'zone_ring').setDisplaySize(c.r * 2.2, c.r * 2.2).setDepth(4).setAlpha(0.9);
      const flag = s.add.sprite(x, y - 6, 'ma_zone_banner', 0).setDepth(10 + y / WORLD);
      const tx = s.add.text(x, y, '0%', font(10, '#ffffff', 3)).setOrigin(0.5).setDepth(7);
      this.pts.push({ x, y, g: 0, done: false, sp, fill, flag, tx, glow: this.glowAt(x, y, 0xffd070, 0.8, 0.18), spT: 0, gT: 3 });
    }
    s.hero.setPosition(MX, MX);
    this.slots = [];
  }
  captureUpdate(dt) {
    const s = this.s, c = this.cfg, h = s.hero, sec = dt / 1000;
    this.spawnTick(dt, 0.6);
    this.extras(dt);
    s.waveT += dt; if (s.waveT >= this.limit) return this.finish(false, '시간이 다 됐다');
    let all = true;
    this.g.clear();
    this.pts.forEach((p, i) => {
      if (p.done) { this.g.lineStyle(3, 0x7ddc6a, 1).strokeCircle(p.x, p.y, c.r + 4); return; }
      all = false;
      const inside = Math.hypot(h.x - p.x, h.y - p.y) < c.r;
      p.inside = inside;
      let rate = inside ? 100 / c.cap : -100 / c.cap * 0.25;   // 서 있으면 차고, 비우면 천천히 빠진다
      // 유령 파수꾼이 비운 무덤을 갉는다
      if (c.ghosts && !inside) {
        const gs = s.mobs.getChildren().filter(m => m.sentry === i && !m.dead && m.active && Math.hypot(m.x - p.x, m.y - p.y) < c.r + 14).length;
        rate -= gs * 6; p.gs = gs;
        p.gT -= sec;
        const have = s.mobs.getChildren().filter(m => m.sentry === i && !m.dead && m.active).length;
        if (p.gT <= 0 && have < 2 && s.mobs.countActive() < 70) { p.gT = 4; const m = s.spawn(false, 'ghost', { force: true, at: { x: p.x + R(-20, 20), y: p.y + R(-20, 20) } }); if (m) m.sentry = i; }
      }
      p.g = Phaser.Math.Clamp(p.g + rate * sec, 0, 100);
      // 거점 위에 서 있으면 몹이 더 몰린다
      if (inside) {
        p.spT -= sec;
        if (p.spT <= 0 && s.mobs.countActive() < 70) {
          p.spT = 1.6;
          for (let k = 0; k < 2; k++) { const a = RF(0, Math.PI * 2), d = c.r + RF(26, 70); s.spawn(false, c.spawnKind, { force: true, at: { x: Phaser.Math.Clamp(p.x + Math.cos(a) * d, 20, WORLD - 20), y: Phaser.Math.Clamp(p.y + Math.sin(a) * d, 20, WORLD - 20) } }); }
        }
      }
      if (p.g >= 100) {
        p.done = true; p.fill.setVisible(true); p.flag.setFrame(1); p.sp.setTint(0x9dffa0); p.tx.setText('점령'); p.glow.setTint(0x7ddc6a); sfx('level');
        toast(s, `거점 점령  ${this.pts.filter(q => q.done).length}/${c.n}`, '#7ddc6a', 100);
        return;
      }
      p.tx.setText(Math.floor(p.g) + '%');
      const col = inside ? 0xffd75e : p.g > 0 ? 0xffffff : 0x8a8aa0;
      this.g.lineStyle(4, col, inside ? 1 : 0.7).beginPath().arc(p.x, p.y, c.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.g / 100).strokePath();
    });
    if (all && this.pts.length) this.finish(true);
  }

  // ═══ 돌파 ═══
  setupBreach() {
    const s = this.s, c = this.cfg, h = s.hero;
    this.y0 = WORLD - 120; this.goalY = this.y0 - c.len; this.wallY = WORLD + 320; this.cx0 = MX - 160; this.cx1 = MX + 160;
    h.setPosition(MX, this.y0);
    this.gate = modeAnim(s, s.add.sprite(MX, this.goalY, 'ma_finish_gate'), 'finish_gate').setDepth(8).setScale(2);
    this.glowAt(MX, this.goalY, 0xffe8a0, 1.4, 0.3);
    // 길 양옆을 어둡게 덮어 한 줄 길로 보이게 한다
    const sd = s.add.graphics().setDepth(3);
    sd.fillStyle(0x000000, 0.5).fillRect(0, this.goalY - 100, this.cx0, WORLD - this.goalY + 100).fillRect(this.cx1, this.goalY - 100, WORLD - this.cx1, WORLD - this.goalY + 100);
    sd.lineStyle(2, 0xffe8a0, 0.3).lineBetween(this.cx0, this.goalY, this.cx0, WORLD).lineBetween(this.cx1, this.goalY, this.cx1, WORLD);
    this.wallKey = 'ma_' + wallArt(c.c);
    this.wallSp = s.add.tileSprite(0, this.wallY, WORLD, 32, this.wallKey, 0).setOrigin(0, 1).setDepth(36);
    this.wallBody = s.add.rectangle(0, this.wallY, WORLD, 600, WALL_FILL[wallArt(c.c)], 0.92).setOrigin(0, 0).setDepth(36);
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
  }
  breachUpdate(dt) {
    const s = this.s, c = this.cfg, h = s.hero, sec = dt / 1000;
    this.spawnTick(dt, 1.15);
    this.t += dt;
    // 벽은 쉬지 않고 올라온다(시간이 갈수록 조금 빨라진다)
    this.wallY -= c.wall * (1 + Math.min(0.35, this.t / 120000)) * sec;
    if (this.windBoost) this.wallY -= this.windBoost * sec;
    h.x = Phaser.Math.Clamp(h.x, this.cx0 + 10, this.cx1 - 10);
    this.wallSp.setPosition(0, this.wallY); this.wallBody.setPosition(0, this.wallY);
    this.wallSp.tilePositionX += dt * 0.02;
    if ((this.wallAnim = (this.wallAnim || 0) + dt) > 170 && this.wallSp.texture.frameTotal > 2) { this.wallAnim = 0; this.wallF = (this.wallF + 1) % 4; this.wallSp.setFrame(this.wallF); }
    this.slowed = false;
    for (const o of this.items) {
      if (o.kind === 'torch' && !o.on && Math.hypot(h.x - o.x, h.y - o.y) < 34) {
        o.on = true; o.sp.setTint(0xffe070); o.glow.setAlpha(0.45); this.wallY += 150; sfx('level');
        toast(s, '횃불이 켜졌다 · 벽이 물러난다', '#ffd75e', 100);
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
    if (h.y <= this.goalY + 14) return this.finish(true);
  }

  // ═══ 사냥 ═══
  setupHunt() {
    const s = this.s, c = this.cfg, h = s.hero;
    this.prey = []; this.preyTotal = c.prey.length;
    h.setPosition(MX, MX);
    c.prey.forEach((kind, i) => {
      const a = i * Math.PI * 2 / c.prey.length + RF(-0.3, 0.3), d = RF(260, 420);
      const m = s.spawn(false, kind, { elite: true, force: true, at: { x: Phaser.Math.Clamp(MX + Math.cos(a) * d, 60, WORLD - 60), y: Phaser.Math.Clamp(MX + Math.sin(a) * d, 60, WORLD - 60) } });
      if (!m) return;
      m.prey = true; m.maxHp = m.hp = m.hp * 0.8; m.dmg *= 0.5; m.ph = 'rest'; m.phT = RF(0.2, 1.2); m.hide = kind === 'ghost';
      m.runSpd = kind === 'bat' ? 82 : kind === 'ghost' ? 66 : 60;
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
    s.waveT += dt; if (s.waveT >= this.limit) return this.finish(false, '시간이 다 됐다');
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
    const s = this.s, vr = viewRect(s);
    const cx = vr.centerX, cy = vr.centerY, hw = vr.width / 2 - 14, hh = vr.height / 2 - 80;
    this.arrows.forEach((sp, i) => {
      const m = this.prey[i];
      if (!m || vr.contains(m.x, m.y)) { sp.setVisible(false); return; }
      const dx = m.x - cx, dy = m.y - cy, k = Math.min(hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
      sp.setVisible(true).setPosition((cx + dx * k - vr.x) / vr.width * W, (cy + dy * k - vr.y) / vr.height * H).setRotation(Math.atan2(dy, dx)).setScale(1.3);
    });
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
    if (this.id === 'guard') this.guardUpdate(dt);
    else if (this.id === 'capture') this.captureUpdate(dt);
    else if (this.id === 'breach') this.breachUpdate(dt);
    else this.huntUpdate(dt);
  }

  // ── 몹 훅 ──
  onSpawn(m) {
    if (this.id !== 'guard' || m.elite || m.prey) return;
    const c = this.cfg;
    if (c.raiders.includes(m.kind) && Math.random() < c.raid && this.s.mobs.getChildren().filter(q => q.raider && !q.dead && q.active).length < c.cap) { m.raider = true; m.setTint(0xff9a7a); m.baseTint = m.tintTopLeft; }
  }
  spawnPoint(min, max) {
    if (this.id !== 'breach') return null;
    const h = this.s.hero;
    for (let i = 0; i < 6; i++) {
      const y = h.y - RF(min * 0.8, max * 1.1), x = Phaser.Math.Clamp(h.x + RF(-150, 150), this.cx0 - 40, this.cx1 + 40);
      if (y > this.goalY - 30 && y < this.wallY - 40) return { x, y };
    }
    return { x: Phaser.Math.Clamp(h.x + R(-80, 80), this.cx0, this.cx1), y: Math.max(this.goalY + 20, h.y - 200) };
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
    if (m.prey) {
      const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy) || 1;
      if (m.hide) { const vis = d < 115; m.setAlpha(vis ? 0.9 : 0.12); m.mk?.setAlpha(vis ? 1 : 0.15); m.au?.setAlpha(vis ? 1 : 0.15); }
      m.phT -= dt / 1000;
      if (d > 280) { m.setVelocity(Math.cos(m.t / 900 + m.phase) * 14, Math.sin(m.t / 900 + m.phase) * 14); return true; }   // 멀리 있으면 서성인다
      if (m.phT <= 0) { m.ph = m.ph === 'run' ? 'rest' : 'run'; m.phT = m.ph === 'run' ? RF(1.0, 1.5) : RF(0.7, 1.1); if (m.ph === 'run') m.fx = dx / d, m.fy = dy / d; }
      if (m.ph === 'rest') { m.setVelocity(0, 0); return true; }
      // 도망: 주인공 반대쪽, 가장자리에선 가운데 쪽으로 휘어 구석에 몰리지 않게
      const edge = Math.max(0, 1 - Math.min(m.x, m.y, WORLD - m.x, WORLD - m.y) / 200);
      let vx = (m.fx ?? dx / d) + (MX - m.x) / 800 * edge * 3, vy = (m.fy ?? dy / d) + (MX - m.y) / 800 * edge * 3;
      const vl = Math.hypot(vx, vy) || 1;
      const slow = m.slow > 0 ? 0.5 : 1;
      m.setVelocity(vx / vl * m.runSpd * slow, vy / vl * m.runSpd * slow);
      return true;
    }
    return false;
  }
  spdMul() { return this.id === 'breach' ? (this.slowed ? 0.5 : 1) * (this.inWall ? 0.7 : 1) : 1; }

  // 봇이 판 목표를 따라가게 하는 방향(자동 검증용)
  botDir() {
    const h = this.s.hero;
    const to = (x, y, k) => { const d = Math.hypot(x - h.x, y - h.y) || 1; return { x: (x - h.x) / d * k, y: (y - h.y) / d * k, d }; };
    if (this.id === 'guard' && this.item) { const t = to(this.item.x, this.item.y - 6, 1.4); return t.d > 40 ? t : { x: 0, y: 0 }; }
    if (this.id === 'capture') { const p = this.pts.find(q => !q.done); if (p) { const t = to(p.x, p.y, 2.2); return t.d > this.cfg.r * 0.3 ? t : { x: 0, y: 0 }; } }
    if (this.id === 'breach') return { x: (MX - h.x) / 400, y: -1.5 };
    if (this.id === 'hunt') { const m = this.prey[0]; if (m) { let b = m, bd = 1e9; for (const q of this.prey) { const d = Math.hypot(q.x - h.x, q.y - h.y); if (d < bd) { bd = d; b = q; } } return to(b.x, b.y, 1.6); } }
    return null;
  }

  // ── 진행 표시(화면 위쪽) ──
  hud() {
    const s = this.s, c = this.cfg, g = this.hg, id = this.id;
    g.clear();
    const lim = this.limit, left = Math.max(0, Math.ceil((lim - s.waveT) / 1000));
    const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (id === 'breach') { s.timeTxt.setText(''); }
    else { s.timeTxt.setText(`남은 ${mmss}`).setColor(left <= 10 ? '#ffd75e' : '#ffffff'); }
    const bx = 8, bw = W - 16;
    if (id === 'guard') {
      const it = this.item, f = Math.max(0, it.hp / it.max);
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, c.go ? 26 : 18);
      g.fillStyle(0x1c0709).fillRect(48, 47, bw - 44, 11);
      g.fillStyle(f > 0.5 ? 0x5fdc6a : f > 0.25 ? 0xffb347 : 0xe23a44).fillRect(48, 47, (bw - 44) * f, 11);
      this.barTxt.setPosition(12, 46); this.barTxt.setText(c.go ? '수레' : '성물함');
      this.numTxt.setPosition(48 + (bw - 44) / 2, 52.5).setText(`${Math.ceil(it.hp)}/${it.max}`);
      s.waveTxt.setText(c.go ? `길 ${Math.round(it.prog * 100)}%` : '버텨라').setColor(it.moving ? '#5fdc6a' : '#a1b2b6');
      if (c.go) { g.fillStyle(0x1a2430).fillRect(48, 61, bw - 44, 5); g.fillStyle(0x6fd3ff).fillRect(48, 61, (bw - 44) * Phaser.Math.Clamp(it.prog, 0, 1), 5); this.barTxt.setText('수레'); }
    } else if (id === 'capture') {
      const n = this.pts.length, gap = 4, sw = (bw - gap * (n - 1)) / n;
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 18);
      this.pts.forEach((p, i) => {
        const x = bx + i * (sw + gap);
        g.fillStyle(0x1a2430).fillRect(x + 2, 47, sw - 4, 11);
        g.fillStyle(p.done ? 0x7ddc6a : p.inside ? 0xffd75e : 0x6fd3ff).fillRect(x + 2, 47, (sw - 4) * p.g / 100, 11);
      });
      s.waveTxt.setText(`점령 ${this.pts.filter(p => p.done).length}/${n}`).setColor('#a1b2b6');
    } else if (id === 'breach') {
      const prog = Phaser.Math.Clamp((this.y0 - s.hero.y) / c.len, 0, 1), wp = Phaser.Math.Clamp((this.y0 - this.wallY) / c.len, -0.2, 1);
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 22);
      g.fillStyle(0x1a2430).fillRect(14, 49, bw - 12, 8);
      if (wp > 0) g.fillStyle(0x8a2a9a).fillRect(14, 49, (bw - 12) * Math.min(1, wp), 8);
      g.fillStyle(0xffe8a0).fillRect(14 + (bw - 12) * prog - 2, 46, 4, 14);
      g.fillStyle(0xffe8a0).fillRect(bx + bw - 6, 44, 3, 22);
      const gap = Math.max(0, Math.round((this.wallY - s.hero.y) / 4));
      s.timeTxt.setText(`남은 ${Math.max(0, Math.round((s.hero.y - this.goalY) / 4))}m`).setColor('#ffffff');
      s.waveTxt.setText(`벽까지 ${gap}m`).setColor(gap < 25 ? '#ff7070' : '#a1b2b6');
      this.wallTxt.setText('').setPosition(0, 0);
    } else {
      const n = this.preyTotal, alive = this.prey.length;
      g.fillStyle(0x000000, 0.55).fillRect(bx, 44, bw, 18);
      for (let i = 0; i < n; i++) { const x = bx + 6 + i * 16; g.fillStyle(i < n - alive ? 0x5fdc6a : 0xe23a44).fillRect(x, 48, 12, 10); }
      this.cnt.setPosition(bx + 8 + n * 16, 47).setText(`정예 ${alive}마리 남음`);
      s.waveTxt.setText(`잡은 정예 ${n - alive}/${n}`).setColor('#a1b2b6');
      this.huntArrows();
    }
  }

  // ── 끝 ──
  finish(win, why) {
    const s = this.s;
    if (this.ended || s.over) return;
    this.ended = true; this.why = why;
    s.log('mode_end', { mode: this.id, n: this.n, win, why });
    if (win) { sfx('win'); s.banner('성공!', this.def.one); }
    else s.banner('실패…', why || '');
    s.mobs.getChildren().forEach(m => { if (!m.dead && m.body) m.body.enable = false; });
    s.over = true; s.physics.pause();
    s.time.delayedCall(900, () => { s.over = false; s.ui.result(win); });
  }

  // ── 결과 창(overlay.result가 모드 판이면 이쪽으로 넘긴다) ──
  result(win, ui) {
    const s = this.s, sv = s.sv, r = s.run, c = this.cfg, key = `${this.id}:${this.n}`;
    s.over = true; s.physics.pause();
    const first = win && !modeDone(sv, this.id, this.n);
    let rw = win ? modeReward(c.c, first) : { gold: Math.round(D.clearGold(c.c, 1) * 0.3 * this.prog()), stone: 0, gem: 0 };
    rw.stone += r.stones;
    if (win) { (sv.modes.clear ||= {})[key] = 1; mission('clear'); }
    sv.gold += rw.gold; sv.stone += rw.stone; sv.gem += rw.gem;
    if (r.loot?.length) addItems(sv, r.loot);
    dexRefresh(sv);
    save();
    stopBgm(); sfx(win ? 'win' : 'fail');
    s.log('battle_end', { win, mode: this.id, n: this.n, first, kills: r.kills, gold: rw.gold, stone: rw.stone, gem: rw.gem, power: D.powerOf(sv) });
    const cnt = modeCount(sv, this.id);
    s.registry.set('lastResult', { win, mode: this.id, n: this.n, gold: rw.gold, stone: rw.stone, gem: rw.gem, kills: r.kills, lv: r.lv, progress: win ? 1 : this.prog(), t: s.bt });
    if (ui.c) { ui.c.destroy(); ui.c = null; ui.open = null; }
    ui.queue = []; ui.pendingLv = 0;
    const cc = ui.begin('result');
    cc.add(panel(s, 20, 110, W - 40, 322, { fill: 0x1a1426, line: win ? 0xffd75e : 0x7a3a4a }));
    cc.add(s.add.text(W / 2, 140, win ? '클리어!' : '실패…', font(18, win ? '#ffd75e' : '#ff7070')).setOrigin(0.5));
    cc.add(s.add.text(W / 2, 164, `${this.def.name} ${this.n + 1}  ${s.ch.name}`, font9(10, '#a1b2b6')).setOrigin(0.5));
    cc.add(s.add.text(W / 2, 182, win ? (first ? `첫 클리어 ×${D.FIRST_CLEAR_MUL}` : '다시 깼어요') : (this.why || '쓰러졌어요'), font9(11, win ? '#ffd75e' : '#ff9090')).setOrigin(0.5));
    [['처치', fmt(r.kills)], ['레벨', String(r.lv)]].forEach(([a, b], i) => {
      const x = W / 2 + (i - 0.5) * 80;
      cc.add(s.add.text(x, 208, a, font9(10, '#a1b2b6')).setOrigin(0.5));
      cc.add(s.add.text(x, 224, b, font(13)).setOrigin(0.5));
    });
    cc.add(s.add.rectangle(W / 2, 242, W - 80, 1, 0x293845));
    const rows = [[12, '금화', rw.gold], [13, '강화석', rw.stone]];
    if (rw.gem) rows.push([-1, '보석', rw.gem]);
    rows.forEach(([ic, name, n], i) => {
      const x = i % 2 ? 146 : 38, y = 258 + Math.floor(i / 2) * 22;
      cc.add(ic < 0 ? gemIcon(s, x + 8, y, 12) : icon(s, x + 8, y, ic, 16));
      cc.add(s.add.text(x + 20, y, name, font9(10, '#a1b2b6')).setOrigin(0, 0.5));
      cc.add(s.add.text(x + 88, y, '+' + fmt(n), font(12)).setOrigin(1, 0.5));
    });
    cc.add(s.add.text(W / 2, 312, `${this.def.name} ${cnt}/${MODE_N}판`, font9(10, '#a1b2b6')).setOrigin(0.5));
    if (win && cnt >= MODE_N) cc.add(s.add.text(W / 2, 330, `완주! 기록 탭에서 「${this.def.title}」을 받아요`, font(11, '#ffb050')).setOrigin(0.5));
    // 버튼: 주황은 하나. 이기면 다음 판(열려 있고 만들어져 있을 때), 졌으면 다시
    const nextOk = win && modeStage(this.id, this.n + 1) && modeOpen(sv, this.n + 1);
    const go = (n) => s.scene.start('Battle', { mode: { id: this.id, n }, bot: s.bot });
    cc.add(button(s, 68, 392, 92, 30, '모드 선택', () => s.scene.start('Lobby', { tab: 'battle', modeSel: this.id, modeN: this.n }), { color: 0x3a3846, size: 11 }));
    cc.add(button(s, 188, 392, 120, 36, nextOk ? `다음 판 ${this.n + 2} ▶` : win ? '한 번 더' : '다시', () => go(nextOk ? this.n + 1 : this.n), { color: 0x2f6b3a, size: 13 }));
  }
}
