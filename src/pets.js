// 전투 속 펫: 주인공을 따라다니며 저마다 다른 일을 한다
import { PETS, petPow } from './gear.js';
import { sfx } from './sfx.js';

export class Pet {
  constructor(s) {
    this.s = s; this.def = PETS.find(p => p.id === s.sv.pet);
    if (!this.def) return;
    this.lv = s.sv.pets?.[this.def.id] || 0;
    // 펫 목걸이·이상한 돌멩이가 피해를 올린다
    this.pow = petPow(this.lv) * (1 + s.gear.pet);
    this.t = 0; this.x = s.hero.x - 20; this.y = s.hero.y;
    const anim = { slime: 'slime', bat: 'bat' }[this.def.id];
    if (anim && s.anims.exists(anim)) this.g = s.add.sprite(this.x, this.y, null).play(anim).setScale(1).setTint(this.def.color);
    else this.g = s.add.image(this.x, this.y, 'fireball').setBlendMode(Phaser.BlendModes.ADD).setScale(1.7);
    this.g.setDepth(27);
    this.ring = s.add.ellipse(this.x, this.y, 18, 7, this.def.color, 0.25).setDepth(8);
  }

  update(dt) {
    if (!this.def) return;
    const s = this.s, h = s.hero;
    // 주인공 뒤쪽 비스듬히 따라온다(박쥐는 떠다닌다)
    const fly = this.def.id !== 'slime';
    const tx = h.x - s.face * 22, ty = h.y - (fly ? 18 + Math.sin(s.bt / 260) * 4 : -4);
    if (!this.busy) { const k = 1 - Math.pow(0.88, dt / 16.7); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; }
    this.g.setPosition(this.x, this.y).setFlipX(s.face < 0);
    if (this.def.id === 'fire') this.g.setScale(1.6 + Math.sin(s.bt / 90) * 0.2);
    this.ring.setPosition(this.x, this.y + (fly ? 20 : 6)).setVisible(!fly || this.def.id === 'fire');
    this.t += dt;
    this[this.def.id](dt);
  }

  near(maxD) {
    let best = null, bd = maxD * maxD;
    this.s.mobs.getChildren().forEach(m => {
      if (m.dead) return;
      const d = Phaser.Math.Distance.Squared(m.x, m.y, this.x, this.y);
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  }

  // 불씨 정령: 1.4초마다 가까운 적에게 불꽃
  fire() {
    if (this.t < 1400) return;
    const m = this.near(200); if (!m) return;
    this.t = 0;
    const a = Phaser.Math.Angle.Between(this.x, this.y, m.x, m.y);
    this.s.weapons.bullet('fireball', this.x, this.y, a, 230, { mult: this.pow, pierce: 0, src: 'pet', life: 1000, kb: 40, tag: 'pet', scale: 0.7 });
    sfx('shoot', 120);
  }

  // 수호 슬라임: 7초마다 체력을 채우고 주변을 밀친다
  slime() {
    if (this.t < 7000) return;
    this.t = 0;
    const s = this.s;
    s.heal(s.maxHp * (0.03 + 0.002 * this.lv));
    const ring = s.add.image(s.hero.x, s.hero.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6fe08a).setScale(0.3).setDepth(30);
    s.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    s.tweens.add({ targets: this.g, scaleY: 0.35, scaleX: 0.85, duration: 120, yoyo: true });
    s.mobs.getChildren().slice().forEach(m => {
      if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, s.hero.x, s.hero.y) < 75) s.hitMob(m, this.pow * 0.6, { kb: 240, tag: 'pet', src: 'pet' });
    });
  }

  // 황금 박쥐: 0.8초마다 날아가 문다
  bat() {
    if (this.t < 800 || this.busy) return;
    const m = this.near(130); if (!m) return;
    this.t = 0; this.busy = true;
    this.s.tweens.add({ targets: this, x: m.x, y: m.y - 6, duration: 120, yoyo: true, onYoyo: () => {
      if (m.active && !m.dead) this.s.hitMob(m, this.pow * 0.7, { kb: 30, tag: 'pet', src: 'pet' });
    }, onComplete: () => { this.busy = false; } });
  }
}
