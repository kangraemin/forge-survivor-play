// 전투 속 펫: 잡은 보스를 작게 만든 모습으로 주인공을 따라다니며 저마다 다른 일을 한다
// 장(맵)마다 잘 듣는 펫이 달라(petFit) 처음 받은 펫도 뒤 장에서 다시 꺼내 쓴다
import { PETS, petPow, petFit, PET_GOOD } from './gear.js';
import { sfx } from './sfx.js';
import { font } from './ui.js';
import { roleTick } from './petRoles.js';

const D2 = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

export class Pet {
  constructor(s) {
    this.s = s; this.def = PETS.find(p => p.id === s.sv.pet);
    if (!this.def) return;
    this.lv = s.sv.pets?.[this.def.id] || 0;
    // 맵 상성: 잘 듣는 장이면 효과가 세지고, 안 듣는 장이면 약해진다(무한의 탑은 보통)
    this.fit = s.endless ? (this.def.id === 'demonlord' ? PET_GOOD : 1) : petFit(this.def, s.c);   // 마왕은 마지막에 얻으니 무한의 탑에서 강하게
    // 펫 목걸이·이상한 돌멩이가 피해를 올린다
    this.pow = petPow(this.lv) * (1 + s.gear.pet) * this.fit;
    this.t = 0; this.t2 = 0; this.x = s.hero.x - 20; this.y = s.hero.y;
    const fb = s.registry.get('fallback')?.[this.def.id];
    this.g = s.add.sprite(this.x, this.y, null).play(this.def.id).setScale(fb ? 0.7 : 0.26).setDepth(10);
    if (fb) this.g.setTint(this.def.color);
    this.ring = s.add.ellipse(this.x, this.y, 20, 7, this.def.color, 0.6).setDepth(8);   // 보스와 같은 그림이라 발밑 링으로 구분
  }

  update(dt) {
    if (!this.def) return;
    const s = this.s, h = s.hero;
    // 주인공 뒤쪽 아래로 비켜서 따라온다(주인공을 가리지 않게)
    const tx = h.x - s.face * 34, ty = h.y + 10;
    if (!this.busy) { const k = 1 - Math.pow(0.88, dt / 16.7); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; }
    this.g.setPosition(this.x, this.y - 6).setFlipX(s.face < 0).setDepth(h.depth - 0.01);
    this.ring.setPosition(this.x, this.y + 10);
    this.shieldFx?.setPosition(h.x, h.y);
    this.t += dt; this.t2 += dt;
    this[this.def.id](dt);
    roleTick(this, dt);
  }

  near(maxD, n = 1, from = this) {
    const out = [];
    for (const m of this.s.liveMobs) { if (!m.dead && m.active) { const d = D2(m, from); if (d < maxD) out.push([d, m]); } }
    return out.sort((a, b) => a[0] - b[0]).slice(0, n).map(a => a[1]);
  }

  pop(col, sc = 1.6) {
    const ring = this.s.add.image(this.x, this.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(0.3).setDepth(30);
    this.s.tweens.add({ targets: ring, scale: sc, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
  }

  // 해골 장군: 방패를 세워 다음 한 대를 막아 준다
  general() {
    const s = this.s;
    if (s.petShield || this.t < 8500 / this.fit) return;
    this.t = 0; s.petShield = true;
    if (!this.shieldFx) this.shieldFx = s.add.ellipse(0, 0, 34, 40).setStrokeStyle(2, 0xe8e2c8, 0.8).setDepth(29);
    this.shieldFx.setVisible(true);
    this.pop(0xe8e2c8);
    sfx('buy');
  }

  // 방패가 맞았을 때(Battle.hurt에서 부른다)
  block() {
    const s = this.s; s.petShield = false; this.t = 0;
    this.shieldFx?.setVisible(false);
    const t = s.add.text(s.hero.x, s.hero.y - 28, '막음!', font(10, '#e8e2c8')).setOrigin(0.5).setDepth(40);
    s.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    sfx('deny');
  }

  // 슬라임 왕: 떨어진 은화·상자·고기를 주워 오고, 가끔 점액으로 주변을 녹인다
  kingslime() {
    const s = this.s;
    if (this.t >= 700 / this.fit) {
      this.t = 0;
      const it = s.items.getChildren().filter(i => !i.pull && D2(i, s.hero) < 190).sort((a, b) => D2(a, s.hero) - D2(b, s.hero))[0];
      if (it) { it.pull = true; this.pop(0x6fe36a, 0.8); }
    }
    if (this.t2 >= 5000) {
      this.t2 = 0;
      s.gems.getChildren().forEach(g => { if (D2(g, s.hero) < 140) g.pull = true; });
      this.near(70, 6).forEach(m => s.hitMob(m, this.pow * 0.5, { kb: 160, tag: 'pet', src: 'pet', cd: 400 }));
      this.pop(0x6fe36a, 2.2);
    }
  }

  // 리치 왕: 가까운 적에게 저주. 저주받은 적은 20% 더 아프게 맞고 느려진다
  lich() {
    if (this.t < 1800) return;
    // 대상 수: 약한 맵 1, 보통 2, 잘 듣는 맵 3
    const s = this.s, ms = this.near(150, this.fit > 1 ? 3 : this.fit < 1 ? 1 : 2);
    if (!ms.length) return;
    this.t = 0;
    ms.forEach(m => {
      m.curse = s.bt + 3000 * this.fit; m.slow = Math.max(m.slow || 0, 1500);
      // 저주받은 동안 보라색(맞고 번쩍인 뒤에도). 풀리면 원래 색으로(변종 몬스터는 제 색이 있다)
      if (!m.isBoss) { if (m.tint0 === undefined) m.tint0 = m.baseTint; m.baseTint = 0xb07aff; m.setTint(0xb07aff); }
      s.time.delayedCall(3000 * this.fit, () => { if (m.active && !m.dead && !m.isBoss && m.curse <= s.bt) { m.baseTint = m.tint0; m.clearTint(); if (m.tint0 !== 0xffffff) m.setTint(m.tint0); } });
      s.hitMob(m, this.pow * 0.25, { kb: 0, tag: 'pet', src: 'pet' });
      const l = s.add.line(0, 0, this.x, this.y - 6, m.x, m.y, 0xb07aff, 0.7).setOrigin(0).setDepth(28);
      s.tweens.add({ targets: l, alpha: 0, duration: 260, onComplete: () => l.destroy() });
    });
    sfx('shoot', 90);
  }

  // 용암 거신: 둘레에 불바다. 가까이 온 적은 계속 탄다
  lavagolem() {
    if (this.t < 450) return;
    this.t = 0;
    const s = this.s;
    if (!this.lava) {
      // 설원에서도 보이게 진하게 + 테두리
      this.lava = s.add.ellipse(0, 0, 96, 40, 0xff6a2a, 0.4).setStrokeStyle(2, 0xffb040, 0.9).setDepth(7);
      s.tweens.add({ targets: this.lava, alpha: 0.6, duration: 500, yoyo: true, repeat: -1 });
    }
    this.lava.setPosition(s.hero.x, s.hero.y + 8);
    this.s.mobs.getChildren().slice().forEach(m => {
      if (!m.dead && Math.abs(m.x - s.hero.x) < 50 && Math.abs(m.y - s.hero.y - 8) < 26) s.hitMob(m, this.pow * 0.3, { kb: 0, tag: 'pet', src: 'pet' });
    });
  }

  // 서리 용: 바라보는 쪽으로 입김. 맞은 적은 잠깐 얼어붙는다(보스는 느려지기만)
  wyrm() {
    if (this.t < 2800 / this.fit) return;
    const s = this.s, cx = s.hero.x + s.face * 50, cy = s.hero.y;
    const ms = this.near(60, 12, { x: cx, y: cy });
    if (!ms.length) return;
    this.t = 0;
    const puff = s.add.image(cx, cy, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ae8ff).setScale(0.4).setDepth(30);
    s.tweens.add({ targets: puff, scale: 1.8, alpha: 0, duration: 420, onComplete: () => puff.destroy() });
    ms.forEach(m => {
      if (m.isBoss) m.slow = 1500;
      else { const fz = 1200 * Math.min(1, this.fit); m.freeze = fz; m.setTint(0x9ae8ff); s.time.delayedCall(fz, () => m.active && !m.dead && m.setTint(m.baseTint)); }
      s.hitMob(m, this.pow * 0.5, { kb: 0, tag: 'pet', src: 'pet' });
    });
    sfx('shoot', 140);
  }

  // 해일의 수문룡: 바라보는 쪽으로 파도를 밀어 적을 멀리 날린다(물웅덩이 감속은 envfx.js가 이 펫이면 건너뛴다)
  tidewyrm() {
    if (this.t < 2600 / this.fit) return;
    const s = this.s, cx = s.hero.x + s.face * 46, cy = s.hero.y;
    const ms = this.near(64, 14, { x: cx, y: cy });
    if (!ms.length) return;
    this.t = 0;
    const w = s.add.image(cx, cy, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5ae0d0).setScale(0.3, 0.2).setDepth(30);
    s.tweens.add({ targets: w, scaleX: 2.2, scaleY: 1.2, x: cx + s.face * 30, alpha: 0, duration: 420, onComplete: () => w.destroy() });
    ms.forEach(m => s.hitMob(m, this.pow * 0.5, { kb: m.isBoss ? 0 : 260, tag: 'pet', src: 'pet', from: s.hero }));
    sfx('shoot', 140);
  }

  // 늪의 여왕: 둘레에 독안개. 가까운 적이 계속 아프고 느려진다(독구름 피해는 envfx.js가 이 펫이면 면제)
  swampqueen() {
    if (this.t < 600) return;
    this.t = 0;
    const s = this.s;
    if (!this.fog) {
      this.fog = s.add.ellipse(0, 0, 110, 46, 0xa050d0, 0.3).setStrokeStyle(2, 0xd890ff, 0.8).setDepth(7);
      s.tweens.add({ targets: this.fog, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
    }
    this.fog.setPosition(s.hero.x, s.hero.y + 8);
    s.mobs.getChildren().slice().forEach(m => {
      if (m.dead || !m.active || Math.abs(m.x - s.hero.x) > 55 || Math.abs(m.y - s.hero.y - 8) > 24) return;
      m.slow = Math.max(m.slow || 0, 900);
      s.hitMob(m, this.pow * 0.26, { kb: 0, tag: 'pet', src: 'pet' });
    });
  }

  // 수정 거신: 수정 파편 여섯 개를 사방으로 쏜다
  crystcolossus() {
    if (this.t < 2300 / this.fit) return;
    if (!this.near(190)[0]) return;
    this.t = 0;
    const a0 = Math.random() * 6.28;
    for (let i = 0; i < 6; i++) this.s.weapons.bullet('ice', this.x, this.y - 6, a0 + i * 1.047, 200, { mult: this.pow * 0.5, pierce: 2, src: 'pet', life: 800, kb: 30, tag: 'pet', scale: 0.8, tint: 0xc890ff });
    this.pop(0xc890ff, 1.2);
    sfx('shoot', 120);
  }

  // 폭풍의 기사단장: 가까운 적 하나에 낙뢰를 내리고 둘레도 함께 맞는다(바람에 덜 밀리는 건 envfx.js)
  stormcaptain() {
    if (this.t < 2200 / this.fit) return;
    const s = this.s, m = this.near(210)[0];
    if (!m) return;
    this.t = 0;
    const x = m.x, y = m.y;
    const l = s.add.line(0, 0, x, y - 90, x, y, 0xe8f4ff, 1).setOrigin(0).setLineWidth(3).setBlendMode(Phaser.BlendModes.ADD).setDepth(32);
    s.tweens.add({ targets: l, alpha: 0, duration: 260, onComplete: () => l.destroy() });
    this.near(46, 8, { x, y }).forEach(q => s.hitMob(q, this.pow * (q === m ? 0.9 : 0.4), { kb: 40, tag: 'pet', src: 'pet', fx: q === m ? 'big' : 'small' }));
    sfx('crit', 90);
  }

  // 공허 군주: 가까운 적을 곁으로 끌어모아 한꺼번에 때리기 좋게 한다
  voidlord() {
    if (this.t < 5200 / this.fit) return;
    const s = this.s, ms = this.near(170, 14, s.hero).filter(m => !m.isBoss);
    if (ms.length < 2) return;
    this.t = 0;
    this.pop(0x7a6aff, 2.4);
    ms.forEach(m => { m.x += (s.hero.x - m.x) * 0.6; m.y += (s.hero.y - m.y) * 0.6; s.hitMob(m, this.pow * 0.3, { kb: 0, tag: 'pet', src: 'pet' }); });
    sfx('shoot', 100);
  }

  // 모래 거신: 둘레 적을 느리게 하고 살살 때린다(유사 구덩이는 envfx.js가 이 펫이면 면제)
  sandcolossus() {
    if (this.t < 700) return;
    this.t = 0;
    const s = this.s;
    if (!this.storm) { this.storm = s.add.ellipse(0, 0, 120, 50, 0xe0c080, 0.22).setStrokeStyle(2, 0xffe8a0, 0.7).setDepth(7); s.tweens.add({ targets: this.storm, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 }); }
    this.storm.setPosition(s.hero.x, s.hero.y + 8);
    s.mobs.getChildren().slice().forEach(m => {
      if (m.dead || !m.active || Math.abs(m.x - s.hero.x) > 60 || Math.abs(m.y - s.hero.y - 8) > 26) return;
      m.slow = Math.max(m.slow || 0, 1000);
      s.hitMob(m, this.pow * 0.2, { kb: 0, tag: 'pet', src: 'pet' });
    });
  }

  // 증기 장군: 주기적으로 둘레에 증기를 뿜는다(분출구·증기 피해는 이 펫이면 면제)
  steamgeneral() {
    if (this.t < 2800 / this.fit) return;
    const s = this.s, ms = this.near(70, 12, s.hero);
    if (!ms.length) return;
    this.t = 0; this.pop(0xe8e8f0, 2.2);
    ms.forEach(m => s.hitMob(m, this.pow * 0.55, { kb: 90, tag: 'pet', src: 'pet', from: s.hero }));
    sfx('shoot', 120);
  }

  // 뇌룡: 가까운 적 셋에 번개를 잇는다(낙뢰 면제)
  thunderdragon() {
    if (this.t < 2400 / this.fit) return;
    const ms = this.near(200, 3);
    if (!ms.length) return;
    this.t = 0;
    const s = this.s;
    ms.forEach((m, i) => {
      const l = s.add.line(0, 0, i ? ms[i - 1].x : this.x, i ? ms[i - 1].y : this.y - 6, m.x, m.y, 0xc8b8ff, 1).setOrigin(0).setLineWidth(2.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(32);
      s.tweens.add({ targets: l, alpha: 0, duration: 240, onComplete: () => l.destroy() });
      s.hitMob(m, this.pow * 0.6, { kb: 30, tag: 'pet', src: 'pet', fx: 'big' });
    });
    sfx('crit', 90);
  }

  // 거울의 군주: 가까운 적을 6초마다 1.5초 멈춘다(거울 빛줄기 피해 면제)
  mirrorlord() {
    if (this.t < 6000 / this.fit) return;
    const ms = this.near(110, 10, this.s.hero).filter(m => !m.isBoss);
    if (!ms.length) return;
    this.t = 0; this.pop(0x90ffe8, 2.4);
    ms.forEach(m => { m.freeze = 1500; m.setTint(0x90ffe8); this.s.time.delayedCall(1500, () => m.active && !m.dead && (m.clearTint(), m.baseTint !== 0xffffff && m.setTint(m.baseTint))); });
    sfx('shoot', 100);
  }

  // 원초의 대장신: 적이 가장 몰린 곳에 큰 망치(불 면제)
  forgegod() {
    if (this.t < 5200 / this.fit) return;
    const ms = this.near(220, 20);
    if (ms.length < 2) return;
    this.t = 0;
    const s = this.s, c = ms[0], x = c.x, y = c.y;
    const r = s.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd75e).setScale(0.4, 0.3).setDepth(30);
    s.tweens.add({ targets: r, scaleX: 1.8, scaleY: 1.3, alpha: 0, duration: 380, onComplete: () => r.destroy() });
    this.near(60, 30, { x, y }).forEach(m => s.hitMob(m, this.pow * 1.1, { kb: 80, tag: 'pet', src: 'pet', from: { x, y }, fx: 'big' }));
    s.cameras.main.shake(120, 0.008);
    sfx('boom', 120);
  }

  // 마왕: 마탄 세 발을 부채꼴로 쏜다
  demonlord() {
    if (this.t < 1300) return;
    const m = this.near(210)[0]; if (!m) return;
    this.t = 0;
    const a = Phaser.Math.Angle.Between(this.x, this.y, m.x, m.y);
    [-0.25, 0, 0.25].forEach(da => this.s.weapons.bullet('fireball', this.x, this.y - 6, a + da, 240, { mult: this.pow * 0.55, pierce: 1, src: 'pet', life: 900, kb: 40, tag: 'pet', scale: 0.7, tint: 0xff3a50 }));
    sfx('shoot', 120);
  }
}
