// 보스: 패턴을 돌아가며 쓴다. 모든 공격은 빨간 예고 표시가 먼저 뜨고, 체력 절반 이하면 빨라진다
import * as D from './data.js';
import { sfx } from './sfx.js';
import { font, toast } from './ui.js';

const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;

export class BossAI {
  constructor(s, key, hpMul, mid = false) {
    this.s = s; this.key = key; this.b = D.BOSSES[key]; this.mid = mid;
    const p = s.spawnPoint(150, 170);
    const m = this.m = s.mobs.create(p.x, p.y, null).play(key);
    const fb = s.registry.get('fallback')[key];
    m.setScale(fb ? 2.6 : 1).setDepth(12);
    if (fb) m.setTint(this.b.color);
    m.isBoss = true; m.bossAI = this; m.kind = key; m.kbRes = 0; m.color = this.b.color; m.hitBy = {}; m.baseTint = m.tintTopLeft;
    // 3장부터 챕터 보스는 15% 덜 단단하게: 권장의 135%로도 체력 1~16%를 남기고 졌다
    m.maxHp = m.hp = this.b.hp * hpMul * (!mid && s.c >= 2 && !s.endless ? 0.85 : 1);
    // 1장 보스는 첫 보스라 20% 덜 아프게: 권장을 넘고도 체력 26% 남기고 졌다
    m.dmg = this.b.dmg * s.mobDmgMul * (!mid && s.c === 0 && !s.endless ? 0.8 : 1);
    m.body.setSize(m.width * 0.6, m.height * 0.55).setOffset(m.width * 0.2, m.height * 0.4);
    m.setImmovable(true);
    this.shadow = s.add.image(m.x, m.y, 'shadow').setScale(m.displayWidth / 10, 2.5).setDepth(9);
    this.t = 1800; this.pi = 0; this.busy = 0; this.tele = s.add.graphics().setDepth(9);
    // 등장: 위에서 떨어져 쿵
    m.y -= 120; m.setAlpha(0);
    s.tweens.add({ targets: m, y: p.y, alpha: 1, duration: 500, ease: 'Quad.In', onComplete: () => this.thud(m.x, m.y, 0) });
    if (!mid) this.makeBar();
  }

  makeBar() {
    // 스킬 아이콘 줄(최대 2줄, y 46~78) 아래에 둬 겹치지 않게 한다
    const s = this.s, y = 92;
    this.bar = [
      s.add.rectangle(D.W / 2, y, 200, 9, 0x1a0a10).setStrokeStyle(1, 0x000000),
      s.add.rectangle(35, y, 200, 7, 0xffffff).setOrigin(0, 0.5),
      s.add.rectangle(35, y, 200, 7, 0xe8343a).setOrigin(0, 0.5),
      s.add.text(D.W / 2, y - 11, this.b.name, font(9, '#ffd75e')).setOrigin(0.5),
    ];
    // 등장 배너(1.5초)가 사라진 뒤에 떠서 글자끼리 겹치지 않는다
    this.bar.forEach(o => o.setScrollFactor(0).setDepth(100).setAlpha(0));
    s.tweens.add({ targets: this.bar, alpha: 1, delay: 1700, duration: 250 });
  }

  update(dt) {
    const s = this.s, m = this.m;
    if (!m.active || m.dead) return;
    const h = s.hero, enraged = m.hp < m.maxHp * 0.5;
    // 오래 버티면 지친다: 받는 피해 증가(보스전이 3분 가까이 늘어졌다)
    this.age = (this.age || 0) + dt;
    if (this.bar && !this.tired && this.age > D.BOSS_TIRED.ms) {
      this.tired = true; m.weak = D.BOSS_TIRED.mul; this.bar[3].setText(`${this.b.name} · 지쳤다! 피해 +${Math.round((D.BOSS_TIRED.mul - 1) * 100)}%`).setColor('#ff9a5a');
      s.banner('보스가 지쳤다!', `받는 피해 +${Math.round((D.BOSS_TIRED.mul - 1) * 100)}% · 몰아붙여라`);
    }
    if (enraged && !this.rage) {
      this.rage = true; m.setTint(0xff8080); m.baseTint = 0xff8080; s.cameras.main.shake(300, 0.005); sfx('bossIn');
      const what = { sweep: '휩쓰는 광선', pools: '남는 장판', slam: '연속 내려찍기' }[this.b.rage];
      // 중간 보스는 배너 대신 짧은 알림(예고 없이 새 공격이 나왔다)
      if (this.b.rage && !this.mid) s.banner(`${this.b.name}이 분노했다!`, `새 공격: ${what}`);
      else if (this.b.rage) toast(s, `${this.b.name} 분노! 새 공격: ${what}`, '#ff9a8a', 200);   // 위쪽 배너와 겹치지 않게
    }
    m.setFlipX(h.x < m.x);
    m.setDepth(10 + m.y / 1600);
    this.shadow.setPosition(m.x, m.y + m.displayHeight * 0.42);
    if (this.bar) {
      const f = Math.max(0, m.hp / m.maxHp);
      this.bar[2].width = 200 * f;
      this.bar[1].width += (200 * f - this.bar[1].width) * 0.05;
    }
    if (this.busy > 0) { this.busy -= dt; return; }
    const ang = Phaser.Math.Angle.Between(m.x, m.y, h.x, h.y);
    m.setVelocity(Math.cos(ang) * this.b.spd, Math.sin(ang) * this.b.spd);
    this.t -= dt;
    if (this.t <= 0) {
      const list = enraged && this.b.rage ? [...this.b.pattern, this.b.rage] : this.b.pattern;
      const pat = list[this.pi++ % list.length];
      this.t = (enraged ? 2400 : 3200) + R(0, 600);
      this[pat](enraged);
    }
  }

  // 예고: 빨간 원이 차오른 뒤 터진다
  warnCircle(x, y, r, ms, onBoom) {
    const s = this.s, g = s.add.graphics().setDepth(9);
    const st = { f: 0 };
    s.tweens.add({
      targets: st, f: 1, duration: ms,
      // 몹·이펙트에 묻히지 않게 테두리를 굵게 하고 깜빡인다
      onUpdate: () => { const blink = 0.55 + 0.45 * Math.abs(Math.sin(st.f * 12)); g.clear().fillStyle(0xff2030, 0.2).fillEllipse(x, y, r * 2, r * 1.5).lineStyle(2.5, 0xff4050, blink).strokeEllipse(x, y, r * 2, r * 1.5).fillStyle(0xff2030, 0.32).fillEllipse(x, y, r * 2 * st.f, r * 1.5 * st.f); },
      onComplete: () => { g.destroy(); onBoom(); },
    });
  }

  thud(x, y, r) {
    const s = this.s;
    s.cameras.main.shake(220, 0.01);
    sfx('boom');
    const ring = s.add.image(x, y, 'ring').setScale(0.3, 0.22).setTint(0xffe0c0).setDepth(9).setAlpha(0.9);
    s.tweens.add({ targets: ring, scaleX: (r || 40) / 28, scaleY: (r || 40) / 38, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    s.dust.explode(20, x, y);
    if (r && Phaser.Math.Distance.Between(s.hero.x, s.hero.y, x, y) < r) s.hurt(this.m.dmg * 1.6);
  }

  // 점프: 플레이어 자리에 예고 원 → 뛰어올라 내려찍기
  jump(fast) {
    const s = this.s, m = this.m, tx = s.hero.x, ty = s.hero.y, r = 46;
    this.busy = 1300; m.setVelocity(0, 0);
    this.warnCircle(tx, ty, r, fast ? 750 : 950, () => {});
    s.tweens.add({ targets: m, scaleY: m.scaleY * 0.7, duration: 200, yoyo: true });
    s.time.delayedCall(220, () => {
      if (!m.active) return;
      s.tweens.add({ targets: m, x: tx, duration: fast ? 520 : 720, ease: 'Sine.InOut' });
      s.tweens.add({ targets: m, y: ty, duration: fast ? 520 : 720, ease: 'Back.In', onComplete: () => m.active && this.thud(tx, ty, r) });
    });
  }

  // 원형 탄막(두 번째 줄은 반 칸 어긋나게)
  ring(fast) {
    const s = this.s, m = this.m, n = fast ? 20 : 14;
    this.busy = 700; m.setVelocity(0, 0);
    s.tweens.add({ targets: m, scale: m.scale * 1.12, duration: 250, yoyo: true });
    sfx('warn');
    for (let k = 0; k < 2; k++) s.time.delayedCall(350 + k * 300, () => {
      if (!m.active) return;
      for (let i = 0; i < n; i++) s.enemyShot(m.x, m.y, (i + k * 0.5) / n * Math.PI * 2, 70, m.dmg * 0.8);
    });
  }

  // 조준 부채꼴 5발
  aimed(fast) {
    const s = this.s, m = this.m;
    this.busy = 600; m.setVelocity(0, 0);
    const shots = fast ? 3 : 2;
    for (let k = 0; k < shots; k++) s.time.delayedCall(250 + k * 280, () => {
      if (!m.active) return;
      const a = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y);
      for (let i = -2; i <= 2; i++) s.enemyShot(m.x, m.y, a + i * 0.2, 105, m.dmg * 0.8);
    });
  }

  // 돌진: 예고선 → 빠르게 직선 돌격
  charge(fast) {
    const s = this.s, m = this.m;
    const a = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y), len = 260;
    this.busy = 1500; m.setVelocity(0, 0);
    const g = s.add.graphics().setDepth(9);
    g.fillStyle(0xff2030, 0.22).lineStyle(1, 0xff4050, 0.9);
    const w = m.displayWidth * 0.6, cx = Math.cos(a), cy = Math.sin(a), nx = -cy * w / 2, ny = cx * w / 2;
    const pts = [{ x: m.x + nx, y: m.y + ny }, { x: m.x + cx * len + nx, y: m.y + cy * len + ny }, { x: m.x + cx * len - nx, y: m.y + cy * len - ny }, { x: m.x - nx, y: m.y - ny }];
    g.fillPoints(pts, true).strokePoints(pts, true);
    sfx('warn');
    s.tweens.add({ targets: m, x: m.x - cx * 8, y: m.y - cy * 8, duration: fast ? 500 : 700 });
    s.time.delayedCall(fast ? 550 : 750, () => {
      g.destroy();
      m.setVelocity(cx * 520, cy * 520);
      s.cameras.main.shake(300, 0.004);
      s.time.delayedCall(500, () => { if (m.active) m.setVelocity(0, 0); });
    });
  }

  // 소환: 주변에 졸개를 부른다
  summon() {
    const s = this.s, m = this.m;
    this.busy = 500; m.setVelocity(0, 0);
    s.tweens.add({ targets: m, scaleY: m.scaleY * 1.15, duration: 180, yoyo: true });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      s.spawn(false, s.ch.mobs[i % 3], { force: true, at: { x: m.x + Math.cos(a) * 50, y: m.y + Math.sin(a) * 50 } });
    }
  }

  // 장판: 플레이어 주변 세 곳이 차례로 터진다
  slam(fast) {
    const s = this.s;
    this.busy = 600;
    for (let i = 0; i < (fast ? 5 : 3); i++) {
      const x = s.hero.x + (i ? R(-60, 60) : 0), y = s.hero.y + (i ? R(-60, 60) : 0);
      s.time.delayedCall(i * 200, () => this.m.active && this.warnCircle(x, y, 32, 900, () => this.m.active && this.thud(x, y, 32)));
    }
  }

  // 광선: 휩쓸 부채꼴을 먼저 옅게 보여 준 뒤 굵은 선이 한쪽으로 쓸고 지나간다
  sweep(fast) {
    const s = this.s, m = this.m, len = 190, arc = 1.6, dir = Math.random() < 0.5 ? -1 : 1;
    const a0 = Phaser.Math.Angle.Between(m.x, m.y, s.hero.x, s.hero.y) - dir * arc / 2;
    this.busy = 2100; m.setVelocity(0, 0);
    const g = s.add.graphics().setDepth(9), st = { a: a0 };
    g.fillStyle(0xff2030, 0.26).slice(m.x, m.y, len, a0, a0 + dir * arc, dir < 0).fillPath()
      .lineStyle(2, 0xff4050, 0.8).lineBetween(m.x, m.y, m.x + Math.cos(a0) * len, m.y + Math.sin(a0) * len);
    sfx('warn');
    s.time.delayedCall(fast ? 650 : 850, () => {
      if (!m.active) { g.destroy(); return; }
      const ox = m.x, oy = m.y;
      let hit = false;
      s.tweens.add({
        targets: st, a: a0 + dir * arc, duration: fast ? 950 : 1150,
        onUpdate: () => {
          if (!m.active || !g.active) return;
          const c = Math.cos(st.a), sn = Math.sin(st.a);
          g.clear().lineStyle(11, 0xff3040, 0.5).lineBetween(ox, oy, ox + c * len, oy + sn * len).lineStyle(4, 0xffe0e0, 1).lineBetween(ox, oy, ox + c * len, oy + sn * len);
          const dx = s.hero.x - ox, dy = s.hero.y - oy, along = dx * c + dy * sn;
          if (!hit && along > 0 && along < len && Math.abs(dy * c - dx * sn) < 8) { hit = true; s.hurt(m.dmg * 1.2); }
        },
        onComplete: () => g.destroy(),
      });
    });
  }

  // 남는 장판: 예고 원이 터진 자리에 4초 동안 웅덩이가 남아 밟으면 계속 아프다
  pools(fast) {
    const s = this.s, r = 28;
    this.busy = 500;
    for (let i = 0; i < (fast ? 3 : 2); i++) {
      const x = s.hero.x + (i ? R(-55, 55) : 0), y = s.hero.y + (i ? R(-55, 55) : 0);
      s.time.delayedCall(i * 250, () => this.m.active && this.warnCircle(x, y, r, 850, () => {
        if (!this.m.active) return;
        // 바닥 색과 섞이지 않게(용암 장에서 주황 장판이 안 보였다) 독 보라색에 빨간 테를 두른다
        const g = s.add.graphics().setDepth(8).fillStyle(0x9a3aff, 0.4).fillEllipse(x, y, r * 2, r * 1.5).lineStyle(2, 0xff4050, 1).strokeEllipse(x, y, r * 2, r * 1.5);
        let left = 4000;
        s.time.addEvent({ delay: 400, repeat: 9, callback: () => {
          if (!g.active) return;
          left -= 400; g.setAlpha(Math.max(0.2, left / 4000));
          if (this.m.active && Phaser.Math.Distance.Between(s.hero.x, s.hero.y, x, y) < r * 0.85) s.hurt(this.m.dmg * 0.35);
          if (left <= 0 || !this.m.active) g.destroy();
        } });
      }));
    }
  }

  die() {
    const s = this.s, m = this.m;
    this.tele.destroy(); this.shadow.destroy();
    this.bar?.forEach(o => o.destroy());
    s.hitstop = 260;
    s.cameras.main.shake(600, 0.015);
    s.flashFx.setAlpha(0.9); s.tweens.add({ targets: s.flashFx, alpha: 0, duration: 700 });
    sfx('boom'); s.time.delayedCall(200, () => sfx('boom'));
    for (let i = 0; i < 6; i++) s.time.delayedCall(i * 90, () => {
      const f = s.add.sprite(m.x + R(-20, 20), m.y + R(-24, 16), 'fx1_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setScale(1.6).play('fxHit');
      f.once('animationcomplete', () => f.destroy());
    });
    const c = s.add.sprite(m.x, m.y, m.texture.key, m.frame.name).setFlipX(m.flipX).setScale(m.scaleX).setDepth(12).setTintFill(0xffffff);
    s.tweens.add({ targets: c, scaleX: c.scaleX * 1.3, scaleY: c.scaleY * 0.1, alpha: 0, duration: 700, delay: 250, ease: 'Quad.In', onComplete: () => c.destroy() });
    s.goo.setParticleTint(this.b.color); s.goo.explode(60, m.x, m.y);
    const x = m.x, y = m.y;
    m.destroy();
    if (this.mid) {
      for (let i = 0; i < 8; i++) s.addItem(x + R(-16, 16), y + R(-16, 16), 'silver', 5);
      s.addItem(x, y, 'chest'); s.run.stones += 3;
      s.midBoss = null;
      return;
    }
    s.run.silver += D.DROP.bossSilver;
    s.boss = null;
    s.iframe = s.bt + 1e9; s.ebullets.clear(true, true); // 결과 창이 뜨기 전 남은 탄에 죽지 않게
    s.time.delayedCall(1400, () => s.ui.result(true));
  }
}
