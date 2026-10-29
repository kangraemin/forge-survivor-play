// 전투 속 펫: 잡은 보스를 작게 만든 모습으로 주인공을 따라다니며 저마다 다른 일을 한다
// 장(맵)마다 잘 듣는 펫이 달라(petFit) 처음 받은 펫도 뒤 장에서 다시 꺼내 쓴다
import { PETS, petPow, petFit } from './gear.js';
import { sfx } from './sfx.js';
import { font } from './ui.js';

const D2 = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

export class Pet {
  constructor(s) {
    this.s = s; this.def = PETS.find(p => p.id === s.sv.pet);
    if (!this.def) return;
    this.lv = s.sv.pets?.[this.def.id] || 0;
    // 맵 상성: 잘 듣는 장이면 효과가 세지고, 안 듣는 장이면 약해진다(무한의 탑은 보통)
    this.fit = s.endless ? 1 : petFit(this.def, s.c);
    // 펫 목걸이·이상한 돌멩이가 피해를 올린다
    this.pow = petPow(this.lv) * (1 + s.gear.pet) * this.fit;
    this.t = 0; this.t2 = 0; this.x = s.hero.x - 20; this.y = s.hero.y;
    const fb = s.registry.get('fallback')?.[this.def.id];
    this.g = s.add.sprite(this.x, this.y, null).play(this.def.id).setScale(fb ? 0.7 : 0.32).setDepth(10);
    if (fb) this.g.setTint(this.def.color);
    this.ring = s.add.ellipse(this.x, this.y, 20, 7, this.def.color, 0.3).setDepth(8);
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
  }

  near(maxD, n = 1, from = this) {
    const out = [];
    this.s.mobs.getChildren().forEach(m => { if (!m.dead && m.active) { const d = D2(m, from); if (d < maxD) out.push([d, m]); } });
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
