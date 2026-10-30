// 보스: 패턴을 돌아가며 쓴다. 모든 공격은 빨간 예고 표시가 먼저 뜨고, 체력 절반 이하면 빨라진다
import * as D from './data.js';
import { sfx } from './sfx.js';
import { insetsGame } from './safeArea.js';
import { font, toast, viewRect } from './ui.js';
import { BOSS_PATTERNS } from './envfx.js';
import { warnDisc, warnStrip, warnFan, runWarn, playOnce, phaseBorder, weakBorder, bubbleFrame, rageAura, has } from './fx2.js';

const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;
const PAT_NAME = { jump: '내려찍기!', charge: '돌진!', slam: '장판!', ring: '탄막!', aimed: '조준 사격!', summon: '소환!', sweep: '광선!', pools: '독 웅덩이!', wave: '파도!', tsunami: '해일!', spore: '포자!', bloom: '개화!', prism: '프리즘!', shatter: '파편!', gale: '돌풍!', cyclone: '회오리!', void: '공허!', eclipse: '일식!', burrow: '잠복!', sink: '함몰!', vent: '증기 분출!', overheat: '과열!', bolt: '낙뢰!', tempest: '폭풍!', mirror: '거울!', reflect: '반사!', hammer: '망치!', meteor: '운석!', icelance: '얼음 창!', frostquake: '서리 폭발!', blizzard: '눈보라!', volley: '작살 일제!', skydive: '급강하!', broadside: '옆구리 포격!', squall: '돌풍!', chime: '종소리!', rewindpat: '되감기!', gearsaw: '톱니!', stoptime: '멈춘 시간!' };
const MID_EXTRA = ['ring', 'jump'];   // 50차: 중간보스 페이즈 1·2에서 늘어나는 새 패턴
const PHASE_LINE = ['크윽… 이 정도로!', '이제 진심이다!'];

export class BossAI {
  constructor(s, key, hpMul, mid = false, formula = false) {
    this.s = s; this.key = key; this.b = D.BOSSES[key]; this.mid = mid; this.PH = mid ? [0.66, 0.33] : [0.7, 0.4];
    // 49차: 화면 안 위쪽 1/3에 나타난다(150~170px 밖에서 나와 화면 밖이라 안 보였다)
    const vr = viewRect(s), hx = s.hero.x, hy = s.hero.y;
    const p = { x: Phaser.Math.Clamp(hx + R(-70, 70), 40, 1600 - 40), y: Phaser.Math.Clamp(Math.max(vr.y + vr.height * 0.22, 60), 60, 1600 - 40) };
    const m = this.m = s.mobs.create(p.x, p.y, null).play(key);
    const fb = s.registry.get('fallback')[key];
    m.setScale(fb ? 3.0 : 1.3).setDepth(12);
    m.preFX?.addGlow(0x000000, 2.5, 0, false, 0.1, 8);   // 49차: 짙은 외곽선으로 바닥·효과 속에서도 읽힌다
    if (fb) m.setTint(this.b.color);
    m.isBoss = true; m.bossAI = this; m.kind = key; m.kbRes = 0; m.color = this.b.color; m.hitBy = {}; m.baseTint = m.tintTopLeft;
    // 3장부터 챕터 보스는 15% 덜 단단하게: 권장의 135%로도 체력 1~16%를 남기고 졌다
    // 마지막 마왕은 할인 없이: 권장 116%에서 11초 만에 죽어 패턴·분노를 못 봤다(37차)
    const tune = !mid && !s.endless && !s.dungeon && !s.hard && !s.practice ? D.BOSS_TUNE(s.c) : { hp: 1, sh: [0, 0] };
    this.tune = tune;
    m.maxHp = m.hp = this.b.hp * hpMul * tune.hp * (!mid && s.c >= 2 && !s.endless && key !== 'demonlord' ? 0.85 : 1);
    // 50차: 체력은 최근 8초 실제 DPS x 목표 시간. 강화·장비가 올라도, 다시 하는 판·하드에서도 순삭되지 않는다(식 값의 절반이 바닥)
    if (!formula) {
      const dps = s.realDps?.() || 0;
      if (dps > 0) m.maxHp = m.hp = Math.max(m.maxHp * 0.5, dps * (mid ? D.BOSS_SEC.mid : D.BOSS_SEC.last));
      s.log?.('boss_hp', { boss: key, mid, dps: Math.round(dps), hp: Math.round(m.maxHp) });
    }
    this.T = formula ? 0 : (mid ? D.BOSS_SEC.mid : D.BOSS_SEC.last) * 1000;   // 최소 버티는 시간(ms)
    // 1장 보스는 첫 보스라 20% 덜 아프게: 권장을 넘고도 체력 26% 남기고 졌다
    m.dmg = this.b.dmg * s.mobDmgMul * (!mid && s.c === 0 && !s.endless ? 0.8 : 1);
    m.body.setSize(m.width * 0.6, m.height * 0.55).setOffset(m.width * 0.2, m.height * 0.4);
    m.setImmovable(true);
    this.shadow = s.add.image(m.x, m.y, 'shadow').setScale(m.displayWidth / 10, 2.5).setDepth(9);
    this.t = 1800; this.pi = 0; this.busy = 0; this.tele = s.add.graphics().setDepth(9);
    // 등장: 위에서 떨어져 쿵
    m.y -= 60; m.setAlpha(0);
    s.tweens.add({ targets: m, y: p.y, alpha: 1, duration: 500, ease: 'Quad.In', onComplete: () => this.thud(m.x, m.y, 0) });
    this.makeBar();
    if (!mid) this.pull0 = s.bt;   // 등장 1.5초 동안 카메라를 보스 쪽으로 살짝 끌었다 돌려놓는다
  }

  // 49차: 등장 연출 — 400ms에 걸쳐 보스 쪽으로 40% 끌고, 700ms 머물고, 400ms에 돌아온다
  camPull() {
    const s = this.s, t = s.bt - this.pull0, cam = s.cameras.main;
    if (t >= 1500) { cam.setFollowOffset(D.W / 2, D.H / 2); this.pull0 = null; return; }
    const f = 0.4 * (t < 400 ? t / 400 : t < 1100 ? 1 : (1500 - t) / 400), m = this.m;
    cam.setFollowOffset(D.W / 2 - (m.x - s.hero.x) * f, D.H / 2 - (m.y - s.hero.y) * f);
  }

  makeBar() {
    // 스킬 아이콘 줄(최대 2줄, y 46~78) 아래에 둬 겹치지 않게 한다
    const s = this.s, y = 92 + insetsGame(s.game).top;
    this.bar = [
      s.add.rectangle(D.W / 2, y, 200, 9, 0x1a0a10).setStrokeStyle(1, 0x000000),
      s.add.rectangle(35, y, 200, 7, 0xffffff).setOrigin(0, 0.5),
      s.add.rectangle(35, y, 200, 7, 0xe8343a).setOrigin(0, 0.5),
      s.add.text(D.W / 2, y - 11, this.b.name, font(9, '#ffd75e')).setOrigin(0.5),
    ];
    // 등장 배너(1.5초)가 사라진 뒤에 떠서 글자끼리 겹치지 않는다
    for (const f of this.PH) this.bar.push(s.add.rectangle(35 + 200 * f, y, 1, 9, 0xffffff, 0.9));   // 페이즈 눈금
    this.bar.forEach(o => o.setScrollFactor(0).setDepth(100).setAlpha(0));
    s.tweens.add({ targets: this.bar, alpha: 1, delay: 1700, duration: 250 });
  }

  // 시간 곡선 바닥: 한 방에 선 아래로 떨어져도 그 선에서 멈춘다(hitMob에서도 부른다)
  holdFloor() {
    const m = this.m;
    if (this.T && (this.age || 0) < this.T && !m.dead) { const ex = Math.max(0.03, 1 - (this.age || 0) / this.T); if (m.hp < ex * m.maxHp) m.hp = ex * m.maxHp; }
  }

  update(dt) {
    const s = this.s, m = this.m;
    if (!m.active || m.dead) return;
    const h = s.hero, enraged = m.hp < m.maxHp * 0.5;
    if (this.pull0 != null) this.camPull();
    // 오래 버티면 지친다: 받는 피해 증가(보스전이 3분 가까이 늘어졌다)
    this.age = (this.age || 0) + dt;
    // 50차: 시간 곡선 — 체력 비율이 (1 - 경과/목표시간)보다 빨리 닳으면 그 선까지 되채운다(보스가 숨을 고른다). 싸우는 중 레벨업·카드로 DPS가 늘어도, 고강화로 다시 해도 목표 시간 안엔 안 죽는다
    this.holdFloor();
    if (this.bar && !this.mid && !this.tired && this.age > D.BOSS_TIRED.ms) {
      this.tired = true; m.weak = D.BOSS_TIRED.mul; this.bar[3].setText(`${this.b.name} · 지쳤다! 피해 +${Math.round((D.BOSS_TIRED.mul - 1) * 100)}%`).setColor('#ff9a5a');
      s.banner('보스가 지쳤다!', `받는 피해 +${Math.round((D.BOSS_TIRED.mul - 1) * 100)}% · 몰아붙여라`);
    }
    // 46차: 체력 70%·40%에서 페이즈가 바뀐다 — 보스가 포효하며 잠깐 멈추고(색 번쩍·화면 흔들림), 3초 동안 약점이 드러난다(맞으면 추가 피해)
    if (this.bar) for (const [i, f] of [[1, this.PH[0]], [2, this.PH[1]]]) if ((this.phase || 0) < i && m.hp <= m.maxHp * f) this.phaseShift(i, f);
    if (this.mark) {
      if (m.expose > s.bt && m.active) {
        // 48차: fx2 약점 과녁을 크게(보스 몸 폭의 70%, 최소 1.8배)
        const sc = Math.max(1.8, m.displayWidth * 0.7 / 28) * (1 + 0.1 * Math.sin(s.bt / 80));
        this.mark.setPosition(m.x, m.y - m.displayHeight * 0.1).setScale(sc);
        this.markTxt?.setPosition(m.x, m.y - m.displayHeight * 0.1 - 22 * Math.max(1, sc * 0.6)).setAlpha(0.6 + 0.4 * Math.abs(Math.sin(s.bt / 120)));
      } else { this.mark.destroy(); this.mark = null; this.markTxt?.destroy(); this.markTxt = null; this.wborder?.destroy(); this.wborder = null; }
    }
    if (m.shield > 0) {
      if (s.bt >= this.shNext) { this.openWeak(2200); this.shNext = s.bt + 2200 + 2400; }
      this.shGfx?.setPosition(m.x, m.y).setAlpha(m.expose > s.bt ? 0.35 : 1);
      if (this.shBar) this.shBar[1].width = 200 * Math.max(0, m.shield / m.shieldMax);
    }
    if (enraged && !this.rage) {
      this.rage = true; m.setTint(0xff8080); m.baseTint = 0xff8080; this.aura = rageAura(s, m); phaseBorder(s, 800, 0xff4040); s.cameras.main.shake(300, 0.005); sfx('bossIn');
      const what = D.RAGE_WHAT[this.b.rage];
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
    // 펫(서리 용·리치 왕)이 건 감속: 보스는 얼지 않고 걸음과 공격 준비가 느려진다
    const sl = m.slow > 0 ? 0.5 : 1;
    if (m.slow > 0) m.slow -= dt;
    if (this.busy > 0) { this.busy -= dt; return; }
    const ang = Phaser.Math.Angle.Between(m.x, m.y, h.x, h.y);
    m.setVelocity(Math.cos(ang) * this.b.spd * sl, Math.sin(ang) * this.b.spd * sl);
    this.t -= dt * (sl < 1 ? 0.7 : 1);
    if (this.t <= 0) {
      let list = enraged && this.b.rage ? [...this.b.pattern, this.b.rage] : this.b.pattern;
      if (this.mid && this.phase) list = [...list, ...MID_EXTRA.slice(0, this.phase)];
      const pat = list[this.pi++ % list.length];
      // 47차: 초반 보스(1~2장)는 공격 간격을 줄여 피할 일이 생기게 한다
      this.t = (enraged ? 2400 : 3200) * (!this.mid && s.c <= 1 && !s.endless ? 0.8 : 1) + R(0, 600);
      this.callout(pat);
      this[pat](enraged);
    }
  }

  // 47차: 공격이 시작될 때 이름을 머리 위에 띄워 무엇이 오는지 알린다(바닥 예고와 함께)
  callout(pat) {
    const s = this.s, m = this.m, name = PAT_NAME[pat] || '공격!';
    const t = s.add.text(m.x, m.y - m.displayHeight * 0.62, name, font(10, '#ffe0a0', 3)).setOrigin(0.5).setDepth(41);
    s.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 900, delay: 350, onComplete: () => t.destroy() });
    // 16~18장 보스: 패턴이 시작되면 예고 그림(_telegraph)으로 잠깐 바뀐다
    if (this.b.lateCh && s.anims.exists(this.key + 'Tele')) { m.anims.play(this.key + 'Tele', true); s.time.delayedCall(1000, () => m.active && m.anims.play(this.key, true)); }
  }

  // 47차: 보스 머리 위 말풍선 한 줄
  bubble(text, ms = 1500) {
    const s = this.s, m = this.m;
    const t = s.add.text(0, -2, text, font(10, '#2a1a10', 0)).setOrigin(0.5);
    const w = Math.max(60, t.width + 26), h = 30;
    // 48차: fx2 말풍선 틀(9슬라이스). 틀이 없으면 예전 둥근 사각형
    const fr = bubbleFrame(s, w, h);
    const bg = fr || s.add.graphics().fillStyle(0xfff4d8, 1).lineStyle(2, 0x2a1a10, 1).fillRoundedRect(-w / 2, -9, w, 18, 5).strokeRoundedRect(-w / 2, -9, w, 18, 5)
      .fillTriangle(-4, 8, 4, 8, 0, 15);
    const c = s.add.container(m.x, m.y - m.displayHeight * 0.75, [bg, t]).setDepth(42);
    const follow = () => { if (!m.active || !c.active) return; c.setPosition(m.x, m.y - m.displayHeight * 0.75); };
    s.events.on('update', follow);
    s.time.delayedCall(ms, () => { s.events.off('update', follow); s.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() }); });
  }

  phaseShift(i, f) {
    const s = this.s, m = this.m;
    // 47차: 0.7초 완전 정지(보스·움직임), 화면 번쩍임, 말풍선, 약점 표식
    this.phase = i; this.busy = Math.max(this.busy, 1100); m.setVelocity(0, 0); m.invuln = s.bt + 900;
    s.hitstop = Math.max(s.hitstop || 0, 700);
    s.flashFx.setAlpha(0.45); s.tweens.add({ targets: s.flashFx, alpha: 0, duration: 450 });
    phaseBorder(s, 900);
    this.bubble(PHASE_LINE[i - 1] || '이제부터 진짜다!');
    s.cameras.main.shake(260, 0.006); s.cameras.main.flash(180, 255, 240, 200); sfx('bossIn');
    const ring = s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe060).setDepth(30).setScale(0.4);
    s.tweens.add({ targets: ring, scale: m.displayWidth / 28 + 1.4, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
    s.tweens.add({ targets: m, scaleX: m.scaleX * 1.15, scaleY: m.scaleY * 0.9, duration: 160, yoyo: true });
    this.openWeak(4200, true);
    const sh = this.tune.sh[i - 1] || 0;
    if (sh > 0) this.addShield(sh);
    s.banner(`페이즈 ${i + 1}!`, sh > 0 ? '방어막! 약점이 열릴 때 쳐서 깨라' : '약점이 드러났다 · 지금 몰아쳐라 (추가 피해)');
    s.log?.('boss_phase', { boss: this.key, phase: i + 1, at: f });
  }

  // 약점을 ms 동안 연다: 과녁 그림 + (페이즈 전환이면) 화면 테두리와 효과음. 맞으면 추가 피해, 쉴드는 이때만 깎인다
  openWeak(ms, border = false) {
    const s = this.s, m = this.m;
    m.expose = s.bt + ms;
    this.mark?.destroy();
    // 48차: 약점 과녁은 fx2 그림(반복 깜빡임)
    this.mark = has(s, 'weakpoint') ? s.add.sprite(m.x, m.y, 'x_weakpoint').setDepth(41).setScale(2.4).play('x_weakpoint')
      : s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe060).setDepth(41).setAlpha(1);
    this.markTxt?.destroy();
    this.markTxt = s.add.text(m.x, m.y, '약점!', font(11, '#ffe060', 3)).setOrigin(0.5).setDepth(41);
    if (border) { this.wborder?.destroy(); this.wborder = weakBorder(s); }
    sfx('weak');
  }

  // 쉴드: 약점이 닫혀 있는 동안은 전부 막힌다. 열린 2.2초에 쳐서 깬다(지치면 늘 열려 있어 막히지 않는다)
  addShield(frac) {
    const s = this.s, m = this.m;
    m.shield = m.shieldMax = m.maxHp * frac;
    this.shNext = s.bt + 4600;   // 페이즈 전환 약점(4.2초)이 끝난 뒤부터 열고 닫기를 되풀이
    const w = m.displayWidth * 1.15, h = m.displayHeight * 1.1;
    this.shGfx?.destroy();
    this.shGfx = s.add.ellipse(m.x, m.y, w, h, 0x66ccff, 0.2).setStrokeStyle(2, 0xbff0ff, 0.95).setDepth(m.depth + 0.5);
    if (this.bar) {
      this.shBar?.forEach(o => o.destroy());
      this.shBar = [s.add.rectangle(35, 99 + insetsGame(s.game).top, 200, 4, 0x0a1a24).setOrigin(0, 0.5), s.add.rectangle(35, 99 + insetsGame(s.game).top, 200, 4, 0x66ccff).setOrigin(0, 0.5)];
      this.shBar.forEach(o => o.setScrollFactor(0).setDepth(100));
    }
  }
  absorb(dealt, open) {
    const s = this.s, m = this.m;
    if (open || this.tired) {
      m.shield -= dealt;
      if (m.shield <= 0) this.breakShield();
    } else if (s.bt - (this.blockT || 0) > 450) {
      this.blockT = s.bt; sfx('deny', 120);
      const t = s.add.text(m.x + R(-14, 14), m.y - m.displayHeight * 0.3, '막힘! 약점이 열릴 때', font(9, '#9ae0ff', 3)).setOrigin(0.5).setDepth(40);
      s.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    }
    return 0;
  }
  breakShield() {
    const s = this.s, m = this.m;
    m.shield = 0;
    this.shGfx?.destroy(); this.shGfx = null; this.shBar?.forEach(o => o.destroy()); this.shBar = null;
    s.cameras.main.shake(200, 0.006); s.hitstop = Math.max(s.hitstop || 0, 120); sfx('boom', 80);
    const ring = s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ae0ff).setDepth(30).setScale(0.4);
    s.tweens.add({ targets: ring, scale: m.displayWidth / 28 + 1.2, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    toast(s, '방어막 파괴!', '#9ae0ff', 200);
    s.log?.('boss_shield_break', { boss: this.key });
  }

  // 예고: fx2 원형 그림이 차오른 뒤 터진다(48차). 소환 자리는 마법진 그림
  warnCircle(x, y, r, ms, onBoom, summon = false) {
    const s = this.s, sp = warnDisc(s, x, y, r, summon);
    if (sp) { runWarn(s, sp, ms, onBoom); return; }
    const g = s.add.graphics().setDepth(9);
    const st = { f: 0 };
    s.tweens.add({
      targets: st, f: 1, duration: ms,
      onUpdate: () => { const blink = 0.55 + 0.45 * Math.abs(Math.sin(st.f * 12)); g.clear().fillStyle(0xff2030, 0.2).fillEllipse(x, y, r * 2, r * 1.5).lineStyle(2.5, 0xff4050, blink).strokeEllipse(x, y, r * 2, r * 1.5); },
      onComplete: () => { g.destroy(); onBoom(); },
    });
  }

  // 예고 원은 납작한 타원(가로 r, 세로 0.75r)이라 판정도 같은 타원으로 한다(원으로 재면 선 밖 위아래에서 맞았다)
  inWarn(x, y, r) { const h = this.s.hero, dx = (h.x - x) / r, dy = (h.y - y) / (r * 0.75); return dx * dx + dy * dy <= 1; }

  thud(x, y, r) {
    const s = this.s;
    s.cameras.main.shake(220, 0.01);
    sfx('boom');
    // 48차: 착탄은 fx2 충격파 그림(없으면 예전 고리)
    if (!playOnce(s, 'impact_slam', x, y, { sx: Math.max(0.5, (r || 40) * 2 / 100), sy: Math.max(0.5, (r || 40) * 1.5 / 100), depth: 10 })) {
      const ring = s.add.image(x, y, 'ring').setScale(0.3, 0.22).setTint(0xffe0c0).setDepth(9).setAlpha(0.9);
      s.tweens.add({ targets: ring, scaleX: (r || 40) / 28, scaleY: (r || 40) / 38, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    }
    s.dust.explode(20, x, y);
    if (r && this.inWarn(x, y, r)) s.hurt(this.m.dmg * 1.6);
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
    const w = m.displayWidth * 0.6, cx = Math.cos(a), cy = Math.sin(a);
    const strip = warnStrip(s, m.x, m.y, a, len, w);
    let g = strip;
    if (strip) runWarn(s, strip, fast ? 550 : 750);
    else {
      g = s.add.graphics().setDepth(9);
      g.fillStyle(0xff2030, 0.22).lineStyle(1, 0xff4050, 0.9);
      const nx = -cy * w / 2, ny = cx * w / 2;
      const pts = [{ x: m.x + nx, y: m.y + ny }, { x: m.x + cx * len + nx, y: m.y + cy * len + ny }, { x: m.x + cx * len - nx, y: m.y + cy * len - ny }, { x: m.x - nx, y: m.y - ny }];
      g.fillPoints(pts, true).strokePoints(pts, true);
    }
    const sx0 = m.x, sy0 = m.y;
    sfx('warn');
    s.tweens.add({ targets: m, x: m.x - cx * 8, y: m.y - cy * 8, duration: fast ? 500 : 700 });
    s.time.delayedCall(fast ? 550 : 750, () => {
      g.active && g.destroy();
      // 돌진이 시작되면 지나간 자리에 먼지 자국
      playOnce(s, 'impact_charge', sx0, sy0, { sx: 1.6, sy: Math.max(0.8, w / 40), rot: a, depth: 8, origin: [0, 0.5], alpha: 0.9 });
      m.setVelocity(cx * 520, cy * 520);
      s.cameras.main.shake(300, 0.004);
      s.time.delayedCall(500, () => { if (m.active) m.setVelocity(0, 0); });
    });
  }

  // 소환: 주변에 졸개를 부른다
  summon() {
    const s = this.s, m = this.m;
    this.busy = 1000; m.setVelocity(0, 0);
    s.tweens.add({ targets: m, scaleY: m.scaleY * 1.15, duration: 180, yoyo: true });
    sfx('warn');
    // 47차: 소환 자리에 먼저 빨간 표시가 뜨고 0.7초 뒤 졸개가 나온다
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = m.x + Math.cos(a) * 50, y = m.y + Math.sin(a) * 50;
      this.warnCircle(x, y, 14, 700, () => { if (m.active) { const mm = s.spawn(false, s.ch.mobs[i % 3], { force: true, at: { x, y } }); if (mm && this.mid) mm.orb = true; } }, true);
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
    // 48차: 휩쓸 범위는 fx2 부채꼴 그림(중심 방향 = 시작각에서 반 호만큼)
    const fan = warnFan(s, m.x, m.y, a0 + dir * arc / 2, len);
    if (fan) runWarn(s, fan, fast ? 650 : 850);
    else g.fillStyle(0xff2030, 0.26).slice(m.x, m.y, len, a0, a0 + dir * arc, dir < 0).fillPath()
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
          if (this.m.active && this.inWarn(x, y, r * 0.85)) s.hurt(this.m.dmg * 0.35);
          if (left <= 0 || !this.m.active) g.destroy();
        } });
      }));
    }
  }

  die() {
    const s = this.s, m = this.m;
    this.tele.destroy(); this.shadow.destroy(); this.mark?.destroy(); this.markTxt?.destroy(); this.wborder?.destroy(); this.aura?.destroy(); this.shGfx?.destroy(); this.shBar?.forEach(o => o.destroy());
    this.bar?.forEach(o => o.destroy());
    s.hitstop = 260;
    // 48차: 막타는 0.4초 슬로모션(실제 시간 기준)
    if (!this.mid) {
      const sl = 0.25;
      s.time.timeScale = sl; s.tweens.timeScale = sl; s.anims.globalTimeScale = sl;
      setTimeout(() => { try { s.time.timeScale = 1; s.tweens.timeScale = 1; s.anims.globalTimeScale = 1; } catch { /* 장면이 이미 닫힘 */ } }, 400);
    }
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

// 6장부터의 보스 패턴(envfx.js)
Object.assign(BossAI.prototype, BOSS_PATTERNS);
