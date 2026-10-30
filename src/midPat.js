// 장마다 다른 중간보스 전용 패턴(data.js CHAPTERS[].mid). boss.js가 BossAI.prototype에 섞는다.
// 장 보스 패턴(envfx.js·lateEnv.js)과 함께 쓰며, 이쪽은 장 기믹(바닥·몹·지형)과 엮인 작은 변형이다.
import { sfx } from './sfx.js';
import { lineWarn, flashLine, segDist } from './lateEnv.js';

const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;
const cl = v => Phaser.Math.Clamp(v, 40, 1560);
const aimOf = b => Phaser.Math.Angle.Between(b.m.x, b.m.y, b.s.hero.x, b.s.hero.y);

// 남는 장판: 밟으면 계속 아프다(환경이 있는 장은 환경 장판, 없으면 직접 그린다)
function puddle(b, x, y, r, ms, col, src) {
  const s = b.s;
  if (s.env?.addHaz) { s.env.addHaz(x, y, r * 0.8, ms, 0.6, src || 'fire', col); return; }
  const g = s.add.graphics().setDepth(8).fillStyle(col, 0.4).fillEllipse(x, y, r * 2, r * 1.5).lineStyle(2, 0xff4050, 1).strokeEllipse(x, y, r * 2, r * 1.5);
  let left = ms;
  s.time.addEvent({ delay: 400, repeat: Math.ceil(ms / 400), callback: () => {
    if (!g.active) return;
    left -= 400; g.setAlpha(Math.max(0.2, left / ms));
    if (b.m.active && b.inWarn(x, y, r * 0.85)) s.hurt(b.m.dmg * 0.35);
    if (left <= 0 || !b.m.active) g.destroy();
  } });
}
// 굵은 선 공격: 예고 뒤 선 위에 있으면 맞는다. onHit(진행 방향 단위벡터)을 받을 수 있다
function beam(b, a, len, w, ms, col, mul = 1, onHit) {
  const s = b.s, m = b.m, ox = m.x, oy = m.y, ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len;
  lineWarn(b, ox, oy, a, len, w, ms, () => {
    flashLine(s, ox, oy, ex, ey, col); sfx('crit', 110);
    if (segDist(s.hero.x, s.hero.y, ox, oy, ex, ey) < w * 0.6) { s.hurt(m.dmg * mul); onHit?.(a, ox, oy); }
  });
}

export const MID_PATTERNS = {
  // 고블린 족장: 몽둥이가 내 쪽으로 줄지어 내리친다
  clubs(fast) {
    const m = this.m, a = aimOf(this), n = fast ? 5 : 4;
    this.busy = 1100; m.setVelocity(0, 0); sfx('warn');
    for (let i = 1; i <= n; i++) {
      const x = cl(m.x + Math.cos(a) * i * 46), y = cl(m.y + Math.sin(a) * i * 46);
      this.s.time.delayedCall(i * 170, () => m.active && this.warnCircle(x, y, 28, 800, () => m.active && this.thud(x, y, 28)));
    }
  },
  // 묘지기: 내 둘레 무덤 넷이 열리며 좀비가 일어난다(바로 처리하지 않으면 늘어난다)
  graves(fast) {
    const s = this.s, m = this.m, h = s.hero, n = fast ? 5 : 4;
    this.busy = 1200; m.setVelocity(0, 0); sfx('warn');
    const a0 = RF(0, 6.28);
    for (let i = 0; i < n; i++) {
      const x = cl(h.x + Math.cos(a0 + i / n * 6.28) * 58), y = cl(h.y + Math.sin(a0 + i / n * 6.28) * 44);
      s.time.delayedCall(i * 140, () => m.active && this.warnCircle(x, y, 24, 1000, () => {
        if (!m.active) return;
        this.thud(x, y, 24);
        if (s.mobs.countActive() < 36) { const mm = s.spawn(false, s.ch.mobs[0], { force: true, at: { x, y } }); if (mm) mm.orb = true; }
      }, true));
    }
  },
  // 용암 도롱뇽: 용암 침을 부채꼴로 뱉고 내 자리에 용암이 고인다
  lavaspit(fast) {
    const s = this.s, m = this.m;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    for (let k = 0; k < (fast ? 3 : 2); k++) s.time.delayedCall(250 + k * 330, () => {
      if (!m.active) return;
      const a = aimOf(this);
      for (let i = -1; i <= 1; i++) s.enemyShot(m.x, m.y, a + i * 0.26, 100, m.dmg * 0.8).setTint(0xff7a2a);
    });
    for (let i = 0; i < 2; i++) {
      const x = cl(s.hero.x + (i ? R(-60, 60) : 0)), y = cl(s.hero.y + (i ? R(-50, 50) : 0));
      s.time.delayedCall(700 + i * 250, () => m.active && this.warnCircle(x, y, 28, 850, () => { if (m.active) { this.thud(x, y, 28); puddle(this, x, y, 28, 4000, 0xff7a2a, 'fire'); } }));
    }
  },
  // 빙하 곰: 고드름 고리가 천천히 퍼지고, 그 사이 내 둘레에 얼음 기둥이 박힌다
  icicles(fast) {
    const s = this.s, m = this.m, n = fast ? 14 : 10;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    s.time.delayedCall(300, () => { if (m.active) for (let i = 0; i < n; i++) s.enemyShot(m.x, m.y, i / n * 6.283, 58, m.dmg * 0.7).setTint(0xbff0ff); });
    for (let i = 0; i < 3; i++) {
      const x = cl(s.hero.x + R(-70, 70)), y = cl(s.hero.y + R(-55, 55));
      s.time.delayedCall(500 + i * 260, () => m.active && this.warnCircle(x, y, 26, 900, () => m.active && this.thud(x, y, 26)));
    }
  },
  // 암흑 집행관: 사슬이 X자로 교차해 내리친다
  chains(fast) {
    const m = this.m, a = aimOf(this);
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    for (const d of [-0.42, 0.42]) beam(this, a + d, 270, 16, fast ? 700 : 900, 0xc8a0ff, 1.0);
    this.s.time.delayedCall(fast ? 700 : 900, () => m.active && beam(this, a, 270, 16, 600, 0xff9090, 1.0));
  },
  // 산호 게왕: 집게발 두 번. 한 번은 부채꼴, 한 번은 어긋난 부채꼴
  claw(fast) {
    const s = this.s, m = this.m;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    for (let k = 0; k < 2; k++) s.time.delayedCall(300 + k * 520, () => {
      if (!m.active) return;
      const a = aimOf(this) + (k ? 0.12 : -0.12);
      for (let i = -2; i <= 2; i++) s.enemyShot(m.x, m.y, a + i * 0.2, 110, m.dmg * 0.8).setTint(0xff9a9a);
      s.cameras.main.shake(120, 0.003);
    });
    if (fast) s.time.delayedCall(1100, () => m.active && this.warnCircle(m.x + Math.cos(aimOf(this)) * 60, m.y + Math.sin(aimOf(this)) * 45, 34, 700, () => {}));
  },
  // 늪 두꺼비: 긴 혀가 내 쪽으로 나가 맞으면 두꺼비 쪽으로 끌려온다
  tongue(fast) {
    const s = this.s, m = this.m;
    this.busy = 1400; m.setVelocity(0, 0); sfx('warn');
    beam(this, aimOf(this), 300, 18, fast ? 700 : 950, 0xff8aa0, 1.0, (a, ox, oy) => {
      const b = Math.atan2(oy - s.hero.y, ox - s.hero.x);
      s.env?.impulse(Math.cos(b) * 170, Math.sin(b) * 170, 420);
    });
    s.tweens.add({ targets: m, scaleX: m.scaleX * 1.12, duration: 300, yoyo: true });
  },
  // 수정 전갈: 꼬리 침이 날아오고, 내 둘레에 수정이 박혀 파편을 사방에 흩뿌린다
  stinger(fast) {
    const s = this.s, m = this.m;
    this.busy = 1700; m.setVelocity(0, 0); sfx('warn');
    s.time.delayedCall(350, () => { if (m.active) { const a = aimOf(this); for (let i = -1; i <= 1; i++) s.enemyShot(m.x, m.y, a + i * 0.14, 125, m.dmg * 0.9).setTint(0xc890ff); } });
    for (let i = 0; i < (fast ? 4 : 3); i++) {
      const x = cl(s.hero.x + R(-75, 75)), y = cl(s.hero.y + R(-60, 60));
      s.time.delayedCall(450 + i * 240, () => m.active && this.warnCircle(x, y, 26, 900, () => {
        if (!m.active) return;
        this.thud(x, y, 26);
        const a0 = RF(0, 6.28);
        for (let k = 0; k < 5; k++) s.enemyShot(x, y, a0 + k * 1.2566, 78, m.dmg * 0.5).setTint(0xc890ff);
      }));
    }
  },
  // 하늘 그리핀·번개 매: 하늘로 떠올랐다가 내가 선 자리로 급강하한다
  swoop(fast) {
    const s = this.s, m = this.m, tx = s.hero.x, ty = s.hero.y, r = 44, col = this.b.color;
    this.busy = 1900; m.setVelocity(0, 0); sfx('warn');
    s.tweens.add({ targets: m, alpha: 0.12, y: m.y - 45, duration: 450 });
    m.dive = true;
    this.warnCircle(tx, ty, r, fast ? 1000 : 1250, () => {});
    s.time.delayedCall(fast ? 1000 : 1250, () => {
      if (!m.active) return;
      m.dive = false; m.setPosition(tx, ty - 55).setAlpha(1);
      s.tweens.add({ targets: m, y: ty, duration: 150, ease: 'Quad.In', onComplete: () => {
        if (!m.active) return;
        this.thud(tx, ty, r);
        for (let i = 0; i < 8; i++) s.enemyShot(tx, ty, i / 8 * 6.283, 82, m.dmg * 0.55).setTint(col);
      } });
    });
  },
  // 공허의 눈: 시선. 시야가 좁아지고(깊은 곳) 나선 탄 두 줄기가 돌며 나온다
  gaze(fast) {
    const s = this.s, m = this.m;
    this.busy = 2200; m.setVelocity(0, 0); sfx('warn');
    s.env?.blackout?.(1800);
    let n = 0;
    s.time.addEvent({ delay: 400, callback: () => { s.time.addEvent({ delay: fast ? 85 : 110, repeat: 14, callback: () => {
      if (!m.active || s.over) return;
      n++;
      for (let k = 0; k < 2; k++) s.enemyShot(m.x, m.y, n * 0.4 + k * Math.PI, 70, m.dmg * 0.6).setTint(0xa090ff);
    } }); } });
  },
  // 모래 미라: 붕대가 십자로 뻗고, 곧이어 대각선으로 한 번 더 뻗는다
  unwrap(fast) {
    const m = this.m, a0 = aimOf(this);
    this.busy = 2000; m.setVelocity(0, 0); sfx('warn');
    for (let k = 0; k < 4; k++) beam(this, a0 + k * Math.PI / 2, 210, 14, 850, 0xe8d8a0, 0.9);
    this.s.time.delayedCall(850 + 350, () => { if (m.active) for (let k = 0; k < 4; k++) beam(this, a0 + Math.PI / 4 + k * Math.PI / 2, 210, 14, fast ? 600 : 750, 0xe8d8a0, 0.9); });
  },
  // 증기 거미전차: 증기 피스톤이 내 쪽으로 걸어오며 하나씩 쾅쾅 박힌다
  piston(fast) {
    const s = this.s, m = this.m, a = aimOf(this), n = fast ? 5 : 4;
    this.busy = 1300; m.setVelocity(0, 0); sfx('warn');
    for (let i = 1; i <= n; i++) {
      const x = cl(m.x + Math.cos(a) * i * 48 + R(-12, 12)), y = cl(m.y + Math.sin(a) * i * 48 + R(-12, 12));
      s.time.delayedCall(i * 190, () => m.active && this.warnCircle(x, y, 28, 850, () => { if (m.active) { this.thud(x, y, 28); puddle(this, x, y, 24, 2500, 0xe8e8f0, 'steam'); } }));
    }
  },
  // 거울 광대: 유리 조각 셋이 둘레에 박혔다가 터지며 파편을 뿌린다
  shards(fast) {
    const s = this.s, m = this.m, h = s.hero, n = fast ? 4 : 3;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const a = RF(0, 6.28), x = cl(h.x + Math.cos(a) * R(30, 80)), y = cl(h.y + Math.sin(a) * R(25, 60));
      s.time.delayedCall(i * 260, () => m.active && this.warnCircle(x, y, 26, 1000, () => {
        if (!m.active) return;
        this.thud(x, y, 26);
        const a0 = RF(0, 6.28);
        for (let k = 0; k < 6; k++) s.enemyShot(x, y, a0 + k * 1.0472, 85, m.dmg * 0.5).setTint(0x90ffe8);
      }));
    }
  },
  // 모루 거북: 내 둘레에 모루가 떨어져 불웅덩이가 남는다
  anvilrain(fast) {
    const s = this.s, m = this.m, h = s.hero, n = fast ? 6 : 5;
    this.busy = 1500; m.setVelocity(0, 0); sfx('warn');
    for (let i = 0; i < n; i++) {
      const x = cl(h.x + (i ? R(-90, 90) : 0)), y = cl(h.y + (i ? R(-70, 70) : 0));
      s.time.delayedCall(i * 230, () => m.active && this.warnCircle(x, y, 28, 900, () => { if (m.active) { this.thud(x, y, 28); puddle(this, x, y, 24, 3000, 0xff8a2a, 'fire'); } }));
    }
  },
};
