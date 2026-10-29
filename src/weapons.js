// 액티브 스킬 8종 + 무기 전용 3종(검기·투창·지진). 각 스킬은 재사용 대기(ms)가 차면 발동한다. 수치는 lv(1~5)로 정한다
import { sfx } from './sfx.js';
import { skinFx, viewRect } from './ui.js';
import { SKILLS, PASSIVE_LV3, SKINS } from './data.js';

const RF = Phaser.Math.FloatBetween, R = Phaser.Math.Between;

export class Weapons {
  constructor(s) { this.s = s; this.cd = {}; this.orbs = []; this.patches = []; this.aura = null; }

  get sk() { return this.s.run.skills; }
  evo(k) { return this.s.run.evo?.[k]; }
  area() { return 1 + 0.1 * (this.sk.area || 0) + ((this.sk.area || 0) >= PASSIVE_LV3 ? 0.1 : 0); }
  // 집중 + 장비·지능의 재사용 감소 + 바람 사냥꾼 4세트
  cdMul() { const g = this.s.gear; return (1 - 0.08 * (this.sk.focus || 0) - ((this.sk.focus || 0) >= PASSIVE_LV3 ? 0.06 : 0)) * (1 - Math.min(0.3, g.cd)) * (g.fx.has('wind4') ? 0.82 : 1); }

  nearest(maxD = 1e9, from = this.s.hero) {
    let best = null, bd = maxD * maxD;
    this.s.mobs.getChildren().forEach(m => {
      if (m.dead) return;
      const d = Phaser.Math.Distance.Squared(m.x, m.y, from.x, from.y);
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  }
  onScreen() {
    const v = viewRect(this.s);
    return this.s.mobs.getChildren().filter(m => !m.dead && Phaser.Geom.Rectangle.Contains(v, m.x, m.y));
  }

  update(dt) {
    for (const [k, lv] of Object.entries(this.sk)) {
      if (SKILLS[k].type !== 'active') continue;
      this.cd[k] = (this.cd[k] ?? 300) - dt;
      if (this.cd[k] <= 0) this.cd[k] = this[k](lv) * this.cdMul();
    }
    this.updateOrbs(dt);
    this.updateAura(dt);
    this.updateBullets(dt);
  }

  enhGlow() {
    const sv = this.s.sv, g = this.enhBase(sv.enh), sk = sv.skin && SKINS.find(x => x.id === sv.skin);
    // 칼빛을 끼면 색만 바꾼다(크기는 강화 단계 그대로)
    return sk ? { ...g, tint: sk.tint, skin: sk, ember: g.ember || sk.ember } : g;
  }
  enhBase(e) {
    return e >= 15 ? { tint: 0xd06bff, scale: 1.45, ember: true, glow: true } : e >= 10 ? { tint: 0xff8a2a, scale: 1.3, ember: true, glow: true } : e >= 5 ? { tint: 0x5fc8ff, scale: 1.15 } : { tint: 0, scale: 1 };
  }
  // +10부터 맞힌 자리에 불티가 튄다
  embers(x, y, color) {
    const s = this.s;
    for (let i = 0; i < 4; i++) {
      const p = s.add.circle(x, y, Phaser.Math.Between(1, 2), color).setBlendMode(Phaser.BlendModes.ADD).setDepth(29);
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 14;
      s.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 6, alpha: 0, duration: 320, onComplete: () => p.destroy() });
    }
  }

  // ── 검 휘두르기: 가장 가까운 적 쪽으로 내딛으며 벤다. 판정은 궤적이 가장 꽉 찬 순간 ──
  sword(lv) {
    const s = this.s, h = s.hero;
    const target = this.nearest(90);
    const ang = target ? Phaser.Math.Angle.Between(h.x, h.y, target.x, target.y) : (s.face > 0 ? 0 : Math.PI);
    const dir = Math.cos(ang) >= 0 ? 1 : -1;
    s.face = dir;
    h.setFlipX(dir < 0).play('slash', true);
    // 휘두를 때 몸이 앞으로 늘어났다 돌아온다
    const hs = h.bs ||= h.scaleX;
    s.tweens.add({ targets: h, scaleX: hs * 1.18, scaleY: hs * 0.86, duration: 60, yoyo: true, ease: 'Quad.Out', onComplete: () => h.setScale(hs) });
    h.once('animationcomplete-slash', () => h.play('idle'));
    // 무기 종류: 창은 좁고 길게 찌르고, 도끼는 느리지만 사방을 크게 찍는다
    const wt = s.wtype.id, spear = wt === 'spear', axe = wt === 'axe';
    s.lunge = { x: Math.cos(ang) * (spear ? 70 : 40), y: Math.sin(ang) * (spear ? 70 : 40), t: 50 };
    const evo = this.evo('sword');
    const area = this.area() * (lv >= 4 ? 1.2 : 1) * (evo ? 1.35 : 1) * (axe ? 1.12 : 1);
    const mult = (evo ? 4 : [1.6, 2, 2, 2, 2.8][lv - 1]) * (spear ? 1.1 : axe ? 1.45 : 1);
    const tag = s.wtype.tag, flame = s.gear.fx.has('flame4');
    const slash = (a, delay) => s.time.delayedCall(delay, () => {
      // 강화 단계가 판 안에서도 보이게: +5 파랑, +10 불꽃, +15 보라로 궤적이 커지고 물든다
      const g = this.enhGlow();
      const fx = s.add.sprite(0, 0, 'fx1_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(28).setAlpha(0.85)
        .setScale(0.85 * area * g.scale * (spear ? 1.5 : axe ? 1.3 : 1), 0.85 * area * g.scale * (spear ? 0.35 : axe ? 1.3 : 1)).setRotation(a).setFlipY(Math.cos(a) < 0).play('fxSlash');
      if (g.skin) skinFx(fx, g.skin).setAlpha(1);
      else if (g.tint) fx.setTint(g.tint).setAlpha(1);
      // +10부터 같은 궤적을 한 겹 더 크게 깔아 눈에 띄게 한다
      if (g.glow) {
        const fx2 = s.add.sprite(0, 0, 'fx1_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(27).setAlpha(0.6)
          .setScale(0.85 * area * g.scale * 1.25).setRotation(a).setFlipY(Math.cos(a) < 0).play('fxSlash');
        if (g.skin) skinFx(fx2, g.skin); else fx2.setTint(g.tint);
        fx.on('animationupdate', () => { if (fx2.active) fx2.setPosition(fx.x, fx.y); });
        fx2.setPosition(h.x + Math.cos(a) * 22 * area, h.y - 4 + Math.sin(a) * 18 * area);
        fx2.once('animationcomplete', () => fx2.destroy());
      }
      const fwd = spear ? 2 : 1;
      const place = () => fx.setPosition(h.x + Math.cos(a) * 22 * area * fwd, h.y - 4 + Math.sin(a) * 18 * area * fwd);
      place(); fx.on('animationupdate', place);
      fx.once('animationcomplete', () => fx.destroy());
      sfx('swing', 60);
      s.time.delayedCall(45, () => {
        let hit = 0, boom = false;
        s.mobs.getChildren().slice().forEach(m => {
          if (m.dead) return;
          const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy);
          const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a));
          const reach = 56 * area * (spear ? 1.7 : 1) + (m.isBoss ? m.displayWidth * 0.3 : 0);
          if (d < reach && (off < (spear ? 0.45 : axe ? 2.6 : 1.9) || d < 18)) {
            if (s.hitMob(m, mult, { kb: axe ? 220 : 170, fx: 'big', tag })) {
              hit++; if (g.ember && hit <= 3) this.embers(m.x, m.y, g.tint);
              // 대장장이의 불꽃 4세트: 벤 적이 25% 확률로 터진다(한 번 휘두를 때 한 번까지)
              if (flame && !boom && Math.random() < 0.25) { boom = true; const x = m.x, y = m.y; s.time.delayedCall(80, () => this.explode(x, y, 1)); }
            }
          }
        });
        if (axe && hit) s.cameras.main.shake(60, 0.003);
        // 히트스톱: 맞힌 순간 아주 잠깐 멈춰 손맛을 준다(너무 잦으면 끊겨 보여 간격 제한)
        // 일반 타격마다 멈추면 이동이 뚝뚝 끊긴다 → 한꺼번에 여럿 맞혔을 때만, 간격도 넉넉히
        if (hit >= 4 && s.bt - (this.lastStop || 0) > 600) { this.lastStop = s.bt; s.hitstop = 40; s.cameras.main.shake(50, 0.002); }
      });
    });
    slash(ang, 0);
    if (lv >= 3) slash(ang + Math.PI, 120);
    const slow = axe ? 1.35 : 1;
    if (evo) { slash(ang + Math.PI / 2, 60); slash(ang - Math.PI / 2, 180); return 460 * slow; }
    return (lv >= 5 ? 520 : 650) * slow;
  }

  // ── 회전 베기 ──
  spin(lv) {
    const s = this.s, h = s.hero;
    const rad = 50 * this.area() * (lv >= 3 ? 1.2 : 1);
    const mult = 0.9 * (lv >= 2 ? 1.3 : 1);
    const once = delay => s.time.delayedCall(delay, () => {
      const fx = s.add.sprite(h.x, h.y, 'fx2_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(28).setAlpha(0.9)
        .setScale(rad * 2 / 90).play('fxSpin');
      fx.on('animationupdate', () => fx.setPosition(h.x, h.y));
      fx.once('animationcomplete', () => fx.destroy());
      sfx('swing');
      s.mobs.getChildren().slice().forEach(m => {
        if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, h.x, h.y) < rad + (m.isBoss ? 20 : 0)) s.hitMob(m, mult, { kb: 140, fx: 'big', tag: 'melee' });
      });
    });
    once(0); if (lv >= 5) once(260);
    if (this.evo('spin')) { once(520); return 1300; }
    return lv >= 4 ? 2200 : 3000;
  }

  // ── 투척 단검 ──
  dagger(lv) {
    const s = this.s, h = s.hero;
    if (this.evo('dagger')) {
      for (let i = 0; i < 10; i++) this.bullet('dagger', h.x, h.y - 4, s.bt / 300 + i * Math.PI / 5, 320, { mult: 1.1, pierce: 99, src: 'dagger', life: 900, kb: 50, tag: 'ranged' });
      sfx('shoot', 50);
      return 650;
    }
    const n = [1, 2, 2, 3, 5][lv - 1], mult = 0.7 * (lv >= 3 ? 1.3 : 1), pierce = lv >= 4 ? 2 : 0;
    const t = this.nearest(240);
    const base = t ? Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) : (s.face > 0 ? 0 : Math.PI);
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(i * 60, () => {
        const a = base + (i - (n - 1) / 2) * 0.16;
        this.bullet('dagger', h.x, h.y - 4, a, 300, { mult, pierce, src: 'dagger', life: 900, kb: 50, tag: 'ranged' });
        sfx('shoot', 50);
      });
    }
    return 900;
  }

  // ── 번개 ──
  bolt(lv) {
    const s = this.s;
    const evo = this.evo('bolt');
    const n = evo ? 5 : [1, 2, 2, 3, 3][lv - 1], mult = 1.2 * (lv >= 3 ? 1.4 : 1) * (evo ? 1.2 : 1);
    const list = Phaser.Utils.Array.Shuffle(this.onScreen()).slice(0, n);
    list.forEach((m, i) => s.time.delayedCall(i * 70, () => {
      if (!m.active) return;
      this.zap(m.x, m.y);
      s.hitMob(m, mult, { kb: 30, fx: 'big', tag: 'magic' });
      if (lv >= 5) {
        // 근처 두 마리로 튄다
        s.mobs.getChildren().filter(o => o !== m && !o.dead && Phaser.Math.Distance.Between(o.x, o.y, m.x, m.y) < (evo ? 90 : 60)).slice(0, evo ? 4 : 2)
          .forEach(o => { this.zapLine(m.x, m.y, o.x, o.y); s.hitMob(o, mult * 0.6, { kb: 20, tag: 'magic' }); });
      }
    }));
    return evo ? 1200 : 1600;
  }
  zap(x, y) {
    const s = this.s, g = s.add.graphics().setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
    let px = x + R(-10, 10), py = y - 140;
    g.lineStyle(3, 0x9ad8ff, 1); g.beginPath(); g.moveTo(px, py);
    while (py < y) { py += R(10, 22); px += R(-10, 10); g.lineTo(Math.min(py, y) === y ? x : px, Math.min(py, y)); }
    g.strokePath(); g.lineStyle(1, 0xffffff, 1).strokePath();
    s.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
    const f = s.add.sprite(x, y, 'fx1_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setTint(0x9ad8ff).play('fxHit');
    f.once('animationcomplete', () => f.destroy());
    sfx('zap', 60);
  }
  zapLine(x1, y1, x2, y2) {
    const g = this.s.add.graphics().setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(2, 0x9ad8ff, 1).lineBetween(x1, y1, (x1 + x2) / 2 + R(-8, 8), (y1 + y2) / 2 + R(-8, 8)).lineBetween((x1 + x2) / 2, (y1 + y2) / 2, x2, y2);
    this.s.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
  }

  // ── 성역: 발밑 빛이 0.5초마다 태운다 ──
  holy() { return 500; }
  updateAura(dt) {
    const s = this.s, lv = this.sk.holy;
    if (!lv) return;
    const evo = this.evo('holy');
    const rad = 36 * this.area() * (lv >= 2 ? 1.2 : 1) * (lv >= 5 ? 1.3 : 1) * (evo ? 1.6 : 1);
    if (!this.aura) {
      this.aura = s.add.image(0, 0, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setDepth(8);
      this.auraRing = s.add.image(0, 0, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd75e).setDepth(8).setAlpha(0.4);
    }
    const pulse = 1 + Math.sin(s.bt / 200) * 0.04;
    this.aura.setPosition(s.hero.x, s.hero.y + 6).setScale(rad / 32 * pulse, rad / 32 * 0.75 * pulse).setAlpha(0.5);
    this.auraRing.setPosition(s.hero.x, s.hero.y + 6).setScale(rad / 32 * pulse, rad / 32 * 0.75 * pulse);
    this.auraT = (this.auraT || 0) + dt;
    if (this.auraT < 500) return;
    this.auraT = 0;
    const mult = 0.35 * (lv >= 3 ? 1.3 : 1) * (evo ? 1.5 : 1);
    let hit = 0;
    s.mobs.getChildren().slice().forEach(m => {
      if (m.dead) return;
      const dx = m.x - s.hero.x, dy = (m.y - s.hero.y - 6) / 0.75;
      if (Math.hypot(dx, dy) < rad + (m.isBoss ? 16 : 0)) { s.hitMob(m, mult, { kb: 0, tag: 'magic' }); hit++; if (lv >= 4) m.slow = 600; }
    });
    if (evo && hit && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + Math.min(hit, 5) * 0.4);
  }

  // ── 화염구: 맞거나 멀리 가면 터진다 ──
  fireball(lv) {
    const s = this.s, h = s.hero;
    if (this.evo('fireball')) {
      // 화면 안 적 위로 불덩이 6개가 떨어진다
      const list = Phaser.Utils.Array.Shuffle(this.onScreen()).slice(0, 6);
      list.forEach((m, i) => s.time.delayedCall(i * 90, () => {
        const x = m.x, y = m.y;
        const fb = s.add.image(x, y - 120, 'fireball').setDepth(30).setScale(1.4);
        s.tweens.add({ targets: fb, y, duration: 260, ease: 'Quad.In', onComplete: () => { fb.destroy(); this.explode(x, y, 5); } });
      }));
      sfx('shoot');
      return 1500;
    }
    const n = lv >= 4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const t = Phaser.Utils.Array.GetRandom(this.onScreen()) || this.nearest();
      const a = t ? Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) + (i ? 0.3 : 0) : RF(0, 6.28);
      this.bullet('fireball', h.x, h.y - 4, a, 160, { mult: 0, explode: lv, src: 'fire', life: 1400, kb: 0 });
    }
    sfx('shoot');
    return 1800;
  }
  explode(x, y, lv) {
    const s = this.s, rad = 30 * this.area() * (lv >= 3 ? 1.3 : 1), mult = 1.3 * (lv >= 2 ? 1.3 : 1);
    const f = s.add.sprite(x, y, 'fx1_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setTint(0xff8a3a).setScale(rad / 20).play('fxHit');
    f.once('animationcomplete', () => f.destroy());
    const ring = s.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6a2a).setScale(0.2).setDepth(31);
    s.tweens.add({ targets: ring, scale: rad / 30, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    s.cameras.main.shake(70, 0.003);
    sfx('boom', 80);
    s.mobs.getChildren().slice().forEach(m => {
      if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, x, y) < rad + (m.isBoss ? 20 : 0)) s.hitMob(m, mult, { kb: 120, fx: 'big', from: { x, y }, tag: 'magic' });
    });
    if (lv >= 5) {
      const p = s.add.image(x, y, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5a1a).setScale(rad / 32, rad / 32 * 0.7).setDepth(7).setAlpha(0.6);
      this.patches.push({ x, y, rad, t: 2000, g: p, tick: 0 });
    }
  }

  // ── 얼음 파편: 꿰뚫는다, 3레벨부터 얼림 ──
  ice(lv) {
    const s = this.s, h = s.hero;
    if (this.evo('ice')) {
      // 사방 12개 + 가장 가까운 적에게 3개 더(보스에게도 박히게)
      for (let i = 0; i < 12; i++) this.bullet('ice', h.x, h.y - 4, i * Math.PI / 6 + RF(-0.1, 0.1), 240, { mult: 1.4, pierce: 99, src: 'ice', life: 1100, kb: 50, freeze: true, tag: 'ranged' });
      const t = this.nearest(260);
      if (t) for (let i = -1; i <= 1; i++) this.bullet('ice', h.x, h.y - 4, Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) + i * 0.15, 260, { mult: 1.8, pierce: 99, src: 'ice', life: 1100, kb: 50, freeze: true, tag: 'ranged' });
      sfx('shoot');
      return 1000;
    }
    const n = [1, 2, 2, 2, 4][lv - 1], mult = 0.9 * (lv >= 4 ? 1.4 : 1);
    const t = this.nearest(260);
    const base = t ? Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) : RF(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.35;
      this.bullet('ice', h.x, h.y - 4, a, 220, { mult, pierce: 99, src: 'ice', life: 1200, kb: 40, freeze: lv >= 3, tag: 'ranged' });
    }
    sfx('shoot');
    return 1300;
  }

  // ── 검기(검 전용): 바라보는 쪽으로 초승달 검기를 날린다 ──
  wave(lv) {
    const s = this.s, h = s.hero;
    const t = this.nearest(220);
    const base = t ? Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) : (s.face > 0 ? 0 : Math.PI);
    const n = [1, 1, 2, 2, 4][lv - 1], mult = 1.1 * (lv >= 2 ? 1.3 : 1), sc = lv >= 5 ? 1.8 : 1.3;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.3;
      this.bullet('wave', h.x, h.y - 4, a, 260, { mult, pierce: lv >= 4 ? 99 : 1, src: 'wave', life: 800, kb: 80, tag: 'ranged', tint: 0x9ad8ff, scale: sc, add: true });
    }
    sfx('swing', 60);
    return 1400;
  }

  // ── 투창(창 전용): 화면에서 가장 먼 적에게 창을 꽂는다 ──
  javelin(lv) {
    const s = this.s, h = s.hero, list = this.onScreen();
    if (!list.length) return 400;
    list.sort((a, b) => Phaser.Math.Distance.Squared(b.x, b.y, h.x, h.y) - Phaser.Math.Distance.Squared(a.x, a.y, h.x, h.y));
    const n = [1, 1, 2, 2, 4][lv - 1], mult = 1.6 * (lv >= 2 ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const t = list[i % list.length], a = Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) + (i >= list.length ? 0.2 : 0);
      s.time.delayedCall(i * 80, () => this.bullet('dagger', h.x, h.y - 4, a, 380, { mult, pierce: 3, src: 'jav', life: 900, kb: lv >= 4 ? 220 : 60, tag: 'ranged', tint: 0xa8ffb0, scale: 1.8 }));
    }
    sfx('shoot', 50);
    return 1600;
  }

  // ── 지진(도끼 전용): 발밑에서 충격파가 퍼진다 ──
  quake(lv) {
    const s = this.s, h = s.hero;
    const rad = 70 * this.area() * (lv >= 2 ? 1.2 : 1), mult = 1.2 * (lv >= 3 ? 1.4 : 1);
    const once = delay => s.time.delayedCall(delay, () => {
      const x = h.x, y = h.y + 6;
      const ring = s.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050).setScale(0.2, 0.15).setDepth(8);
      s.tweens.add({ targets: ring, scaleX: rad / 30, scaleY: rad / 30 * 0.7, alpha: 0, duration: 340, ease: 'Quad.Out', onComplete: () => ring.destroy() });
      this.s.dust.explode(14, x, y);
      s.cameras.main.shake(90, 0.004);
      sfx('boom', 80);
      s.mobs.getChildren().slice().forEach(m => {
        if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, x, y) < rad + (m.isBoss ? 20 : 0)) s.hitMob(m, mult, { kb: 160, fx: 'big', from: { x, y }, tag: 'melee' });
      });
    });
    once(0); if (lv >= 5) once(320);
    return lv >= 4 ? 2200 : 2800;
  }

  // ── 수호 구슬 ──
  orb() { return 99999; }
  updateOrbs(dt) {
    const s = this.s, lv = this.sk.orb;
    if (!lv) return;
    const evo = this.evo('orb'), n = evo ? 6 : [1, 2, 2, 3, 4][lv - 1];
    while (this.orbs.length < n) this.orbs.push(s.add.image(0, 0, 'orb').setBlendMode(Phaser.BlendModes.ADD).setDepth(27).setScale(1.3));
    if (evo && !this.orbEvo) { this.orbEvo = true; this.orbs.forEach(o => o.setScale(2).setTint(0xffd75e)); }
    const sp = evo ? 4.4 : lv >= 5 ? 3.6 : 2.6, rad = 44 * this.area() * (evo ? 1.35 : 1), mult = 0.6 * (lv >= 3 ? 1.3 : 1) * (evo ? 2 : 1);
    this.orbA = (this.orbA || 0) + sp * dt / 1000;
    this.orbs.forEach((o, i) => {
      const a = this.orbA + i * Math.PI * 2 / n;
      o.setPosition(s.hero.x + Math.cos(a) * rad, s.hero.y - 4 + Math.sin(a) * rad * 0.8);
      s.mobs.getChildren().forEach(m => {
        if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, o.x, o.y) < (evo ? 18 : 12) + (m.isBoss ? 18 : 0)) s.hitMob(m, mult, { src: 'orb' + i, cd: 400, kb: 90, from: o, tag: 'magic' });
      });
    });
  }

  // ── 발사체 공통 ──
  bullet(tex, x, y, a, spd, o) {
    const b = this.s.pbullets.create(x, y, tex).setDepth(27).setRotation(a);
    b.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd);
    Object.assign(b, o, { hits: 0, seen: new Set() });
    if (o.tint) b.setTint(o.tint);
    if (o.scale) b.setScale(o.scale);
    if (o.add) b.setBlendMode(Phaser.BlendModes.ADD);
    if (tex === 'fireball') this.s.tweens.add({ targets: b, scale: 1.3, duration: 120, yoyo: true, repeat: -1 });
    return b;
  }
  updateBullets(dt) {
    const s = this.s;
    s.pbullets.getChildren().slice().forEach(b => {
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) for (const m of s.mobs.getChildren()) {
        if (m.dead || b.seen.has(m)) continue;
        if (Phaser.Math.Distance.Between(m.x, m.y, b.x, b.y) > 10 + (m.isBoss ? 22 : m.displayWidth * 0.25)) continue;
        b.seen.add(m);
        if (b.explode) { dead = true; break; }
        s.hitMob(m, b.mult, { kb: b.kb, from: b, tag: b.tag });
        if (b.freeze && Math.random() < 0.3) { m.freeze = 600; m.setTint(0x9ae8ff); s.time.delayedCall(600, () => m.active && !m.dead && m.clearTint()); }
        if (++b.hits > b.pierce) { dead = true; break; }
      }
      if (dead) { if (b.explode) this.explode(b.x, b.y, b.explode); b.destroy(); }
    });
    this.patches = this.patches.filter(p => {
      p.t -= dt; p.tick -= dt;
      if (p.tick <= 0) {
        p.tick = 400;
        s.mobs.getChildren().slice().forEach(m => { if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y) < p.rad) s.hitMob(m, 0.3, { kb: 0, tag: 'magic' }); });
      }
      p.g.setAlpha(0.6 * Math.min(1, p.t / 500));
      if (p.t <= 0) { p.g.destroy(); return false; }
      return true;
    });
  }
}
