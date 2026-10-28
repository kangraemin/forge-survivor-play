// 로비: 전투(스테이지 선택·소탕), 대장간(강화·승급), 훈련(영구 능력치)
import * as D from './data.js';
import { load, save } from './save.js';
import { sfx, setSound, unlock } from './sfx.js';
import { font, font9, panel, button, icon, fmt, COLOR, toast, gemIcon } from './ui.js';
import { showAd, buy, grant, giveText, adsLeft, won } from './shop.js';

const { W, H } = D;
const R = Phaser.Math.Between;
const TABS = [['battle', '전투', 1], ['forge', '대장간', 13], ['train', '훈련', 14], ['shop', '상점', 12]];

// 스테이지별 권장 공격력: 그 챕터 무기 등급에서 강화를 조금씩 더 올려야 깨지게
export const recAtk = (c, s) => Math.round(D.TIERS[Math.min(c, D.TIERS.length - 1)].atk * (1 + 0.1 * Math.min(10, s * 1.9)));

export class Lobby extends Phaser.Scene {
  constructor() { super('Lobby'); }

  // 씬 인스턴스는 재사용되니 전투에서 돌아올 때 잠금·체크 상태를 비운다
  init(data) { this.tab = data?.tab || this.tab || 'battle'; this.busy = false; this.useGuard = false; }

  create() {
    this.sv = load();
    const sv = this.sv;
    setSound(sv.sound);
    this.input.once('pointerdown', unlock);
    // 처음 고를 챕터는 지금 도전할 곳
    const top = Math.min(sv.cleared, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1);
    if (this.selC === undefined) { this.selC = Math.floor(top / D.STAGES_PER_CHAPTER); this.selS = top % D.STAGES_PER_CHAPTER; }
    this.makeTextures();
    this.cameras.main.setBackgroundColor('#0d0a14');
    this.bg = this.add.container(0, 0);
    this.body = this.add.container(0, 0);
    this.makeTop();
    this.makeTabs();
    this.show(this.tab);
    this.cameras.main.fadeIn(200);
  }

  makeTextures() {
    if (this.textures.exists('hammer')) return;
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x0a0710).fillRect(9, 0, 4, 22).fillRect(0, 0, 22, 9);
    g.fillStyle(0x7a4a22).fillRect(10, 8, 2, 13);
    g.fillStyle(0x9aa4b8).fillRect(1, 1, 20, 7);
    g.fillStyle(0xd8e0f0).fillRect(1, 1, 20, 2);
    g.generateTexture('hammer', 22, 22);
    g.clear().fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('spark', 2, 2);
    g.destroy();
  }

  // ── 상단: 재화 ──
  makeTop() {
    const sv = this.sv;
    this.add.rectangle(0, 0, W, 34, 0x07050c, 0.9).setOrigin(0).setDepth(50);
    this.add.rectangle(0, 34, W, 1, COLOR.line).setOrigin(0).setDepth(50);
    const items = [[12, () => fmt(sv.gold), '#ffd75e'], [13, () => fmt(sv.stone), '#9ae0ff'], [11, () => sv.guard, '#e8e2f8'], [15, () => `${sv.sweep}`, '#c8f0a0'], [-1, () => fmt(sv.gem), '#ff9ad0']];
    this.topTxt = items.map(([ic, get, col], i) => {
      const x = 6 + i * 50;
      if (ic < 0) gemIcon(this, x + 7, 17, 13).setDepth(51);
      else this.add.existing(icon(this, x + 7, 17, ic, 14).setDepth(51));
      const t = this.add.text(x + 17, 10, '', font(11, col)).setDepth(51);
      t.get = get; return t;
    });
    // 소리 켜고 끄기
    const snd = this.add.text(W - 8, 17, sv.sound ? '♪' : '×', font(13)).setOrigin(1, 0.5).setDepth(51).setInteractive({ useHandCursor: true });
    snd.on('pointerup', () => { sv.sound = !sv.sound; setSound(sv.sound); snd.setText(sv.sound ? '♪' : '×'); save(); sfx('click'); });
    this.refreshTop();
  }
  refreshTop() { this.topTxt.forEach(t => t.setText(t.get())); }
  bump(i) { const t = this.topTxt[i]; this.tweens.add({ targets: t, scale: 1.3, duration: 90, yoyo: true }); }

  makeTabs() {
    this.add.rectangle(0, H - 50, W, 50, 0x07050c, 0.95).setOrigin(0).setDepth(50);
    this.add.rectangle(0, H - 50, W, 1, COLOR.line).setOrigin(0).setDepth(50);
    this.tabBtns = TABS.map(([id, name, ic], i) => {
      const tw = W / TABS.length, x = tw / 2 + i * tw, c = this.add.container(x, H - 25).setDepth(51);
      const hl = this.add.rectangle(0, 0, tw - 6, 44, 0xffd75e, 0.12).setStrokeStyle(1, 0xffd75e, 0.5);
      c.add([hl, icon(this, 0, -7, ic, 18), this.add.text(0, 12, name, font(10)).setOrigin(0.5)]);
      c.hl = hl; c.setSize(tw, 50).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => { if (this.busy) return; sfx('click'); this.show(id); });
      c.id = id; return c;
    });
  }

  show(id) {
    this.tab = id;
    this.tabBtns.forEach(b => b.hl.setVisible(b.id === id));
    // 탭 안 오브젝트의 트윈만 끊는다(토스트·결과 글씨·날아가는 동전은 끝까지 돈다)
    const kill = o => { this.tweens.killTweensOf(o); o.list?.forEach(kill); };
    [this.body, this.bg].forEach(kill);
    this.body.removeAll(true); this.bg.removeAll(true);
    if (id === 'battle') this.battleTab();
    if (id === 'forge') this.forgeTab();
    if (id === 'train') this.trainTab();
    if (id === 'shop') this.shopTab();
    this.body.setAlpha(0); this.tweens.add({ targets: this.body, alpha: 1, duration: 150 });
  }

  // ── 전투 탭 ──
  battleTab() {
    const sv = this.sv, b = this.body, c = this.selC, ch = D.CHAPTERS[c];
    const atk = Math.round(D.weaponAtk(sv.tier, sv.enh) * (1 + this.tv('atk')));
    // 챕터 제목과 화살표
    b.add(this.add.text(W / 2, 56, `${c + 1}장  ${ch.name}`, font(15, '#ffd75e')).setOrigin(0.5));
    const unlockedC = Math.floor(Math.min(sv.cleared, D.CHAPTERS.length * 6 - 1) / 6);
    const arrow = (x, d, ok) => {
      const t = this.add.text(x, 56, d < 0 ? '◀' : '▶', font(14, ok ? '#ffffff' : '#3a3450')).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => { if (!ok) return; sfx('click'); this.selC += d; this.selS = Math.min(this.selS, this.selC < unlockedC ? 5 : sv.cleared % 6); if (this.selC === unlockedC) this.selS = Math.min(sv.cleared, 29) % 6; this.show('battle'); });
      b.add(t);
    };
    arrow(22, -1, c > 0); arrow(W - 22, 1, c < unlockedC);
    // 지역 미리보기: 몹 세 마리와 보스
    const pv = this.add.container(0, 0); b.add(pv);
    pv.add(panel(this, 12, 72, W - 24, 70, { fill: 0x15111f }));
    const fb = this.registry.get('fallback') || {};
    ch.mobs.forEach((k, i) => {
      const sp = this.add.sprite(46 + i * 44, 110, null).play(k);
      sp.setScale(34 / sp.height); if (fb[k]) sp.setTint(D.MOBS[k].color);
      pv.add(sp);
    });
    const bs = this.add.sprite(W - 58, 108, null).play(ch.boss);
    bs.setScale((fb[ch.boss] ? 40 : 52) / bs.height); if (fb[ch.boss]) bs.setTint(D.BOSSES[ch.boss].color);
    pv.add(bs);
    pv.add(this.add.text(W - 58, 136, D.BOSSES[ch.boss].name, font(8, '#ff9090')).setOrigin(0.5, 1));
    // 스테이지 6칸
    for (let s = 0; s < 6; s++) {
      const idx = c * 6 + s, x = 50 + (s % 3) * 85, y = 172 + Math.floor(s / 3) * 54;
      const locked = idx > sv.cleared, done = idx < sv.cleared, sel = s === this.selS, boss = s === 5;
      const g = this.add.container(x, y);
      g.add(panel(this, -38, -22, 76, 44, { fill: locked ? 0x100d16 : sel ? 0x3b2f5c : 0x1f1930, line: sel ? 0xffd75e : boss ? 0xc04050 : COLOR.line }));
      g.add(this.add.text(0, -8, `${c + 1}-${s + 1}`, font(13, locked ? '#4a4060' : '#ffffff')).setOrigin(0.5));
      g.add(this.add.text(0, 10, locked ? '잠김' : boss ? '보스' : s === 2 ? '중간 보스' : done ? '클리어' : '도전', font9(9, locked ? '#4a4060' : boss ? '#ff8090' : done ? '#5fdc6a' : '#ffd75e')).setOrigin(0.5));
      if (done) g.add(this.add.text(33, -17, '★', font(9, '#ffd75e')).setOrigin(1, 0));
      g.setSize(76, 44).setInteractive({ useHandCursor: true });
      g.on('pointerup', () => { if (locked) { sfx('deny'); toast(this, '앞 스테이지를 먼저 깨야 한다', '#ff9090'); return; } sfx('click'); this.selS = s; this.show('battle'); });
      b.add(g);
    }
    // 선택한 스테이지 정보
    const s = this.selS, idx = c * 6 + s, done = idx < sv.cleared, rec = recAtk(c, s);
    b.add(panel(this, 12, 286, W - 24, 92, { fill: 0x15111f }));
    const lines = [
      ['내 공격력', `${atk}`, atk >= rec ? '#5fdc6a' : '#ff8070'],
      ['권장 공격력', `${rec}`, '#e8e2f8'],
      ['클리어 금화', `${fmt(D.clearGold(c, s))}${done ? '' : `  (첫 클리어 ×${D.FIRST_CLEAR_MUL})`}`, '#ffd75e'],
      ['강화석', `${D.clearStone(c, s)}`, '#9ae0ff'],
    ];
    lines.forEach(([a, v, col], i) => {
      b.add(this.add.text(24, 296 + i * 19, a, font9(10, '#a89cc8')));
      b.add(this.add.text(W - 24, 296 + i * 19, v, font(10, col)).setOrigin(1, 0));
    });
    if (atk < rec) b.add(this.add.text(W / 2, 384, '대장간에서 강화하면 훨씬 쉬워진다', font9(9, '#ff9a8a')).setOrigin(0.5, 0));
    const go = button(this, 95, 412, 150, 34, s === 5 ? '보스 도전' : '전투 시작', () => this.startBattle(c, s), { size: 14, color: s === 5 ? 0x8a2a3a : 0x2f6b3a });
    const sw = button(this, 214, 412, 76, 34, `소탕 ${sv.sweep}`, () => this.sweep(c, s), { size: 11, color: 0x3b4f7a });
    sw.setEnabled(done && sv.sweep > 0);
    b.add([go, sw]);
    this.tweens.add({ targets: go, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  tv(id) { const t = D.TRAINING.find(x => x.id === id); return (this.sv.train[id] || 0) * t.v; }

  startBattle(c, s) {
    if (this.busy) return; this.busy = true;
    sfx('bossIn');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle', { chapter: c, stage: s }));
  }

  // 소탕: 깬 스테이지 보상을 바로 받는다(하루 5장)
  sweep(c, s) {
    const sv = this.sv, gold = D.clearGold(c, s), stone = D.clearStone(c, s);
    if (sv.sweep <= 0) return;
    sv.sweep--; sv.gold += gold; sv.stone += stone; save();
    sfx('coin');
    for (let i = 0; i < 10; i++) {
      const p = this.add.image(214 + R(-20, 20), 412 + R(-8, 8), 'silver').setTint(0xffd75e).setScale(2).setDepth(60);
      this.tweens.add({ targets: p, x: 18, y: 17, duration: 450, delay: i * 40, ease: 'Quad.In', onComplete: () => { p.destroy(); if (i === 9) { this.refreshTop(); this.bump(0); this.bump(1); this.bump(3); } } });
    }
    toast(this, `금화 +${fmt(gold)}  강화석 +${stone}`, '#ffd75e');
    this.time.delayedCall(500, () => this.show('battle'));
  }

  // ── 대장간 탭 ──
  forgeTab() {
    const sv = this.sv, b = this.body, bg = this.bg;
    if (this.textures.exists('forge_bg')) {
      const im = this.add.image(W / 2, 35, 'forge_bg').setOrigin(0.5, 0);
      im.setScale(Math.max(W / im.width, (H - 85) / im.height)).setAlpha(0.55);
      bg.add(im);
    }
    bg.add(this.add.rectangle(0, 35, W, H - 85, 0x0d0a14, 0.35).setOrigin(0));
    // 화덕 불빛이 일렁인다
    const glow = this.add.image(W / 2, 200, 'disc').setScale(3.4).setTint(0xff7a2a).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    bg.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.4, scale: 3.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const t = D.TIERS[sv.tier], enh = sv.enh, max = enh >= D.ENH_MAX;
    b.add(this.add.text(W / 2, 54, `+${enh} ${t.name}`, font(16, enh >= 15 ? '#ff9a3a' : enh >= 10 ? '#ffd75e' : '#ffffff')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 74, `공격력 ${Math.round(D.weaponAtk(sv.tier, enh))}${max ? '' : `  →  ${Math.round(D.weaponAtk(sv.tier, enh + 1))}`}`, font(10, '#e8e2f8')).setOrigin(0.5));
    // 모루 위의 칼
    const halo = this.add.image(W / 2, 170, 'disc').setScale(1.6).setTint(enh >= 10 ? 0xffd75e : 0x9ad8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.sword = icon(this, W / 2, 168, t.icon, 72);
    if (t.tint) this.sword.setTint?.(t.tint);
    this.tweens.add({ targets: this.sword, y: 162, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.hammer = this.add.image(W / 2 + 54, 130, 'hammer').setScale(2.2).setOrigin(0.5, 0.9).setAngle(30);
    b.add([halo, this.sword, this.hammer]);
    // 강화 단계 표시(20칸)
    b.add(this.add.rectangle(W / 2, 256, W - 32, 26, 0x07050c, 0.75).setStrokeStyle(1, COLOR.line));
    for (let i = 0; i < D.ENH_MAX; i++) {
      const x = 25 + (i % 10) * 22.5, y = 252 + Math.floor(i / 10) * 9;
      b.add(this.add.rectangle(x, y, 18, 5, i < enh ? (i >= 15 ? 0xff9a3a : i >= 10 ? 0xffd75e : 0x6fd3ff) : 0x2a2438).setOrigin(0, 0.5));
    }
    // 정보 패널
    b.add(panel(this, 12, 272, W - 24, 104, { fill: 0x15111f }));
    if (max) {
      b.add(this.add.text(W / 2, 300, '최대 강화', font(14, '#ffd75e')).setOrigin(0.5));
    } else {
      const rate = D.ENH_RATE[enh], gold = D.enhGold(sv.tier, enh), stone = D.enhStone(sv.tier, enh);
      const danger = enh >= D.DESTROY_FROM;
      const row = (y, a, v, col) => { b.add(this.add.text(24, y, a, font9(10, '#a89cc8'))); b.add(this.add.text(W - 24, y, v, font(10, col)).setOrigin(1, 0)); };
      row(282, '성공 확률', rate + '%', rate >= 70 ? '#5fdc6a' : rate >= 35 ? '#ffd75e' : '#ff7070');
      row(300, '실패하면', danger ? (this.useGuard ? '방지권으로 지킴' : '파괴 (+0으로)') : '그대로 유지', danger ? (this.useGuard ? '#9ae0ff' : '#ff5050') : '#e8e2f8');
      row(318, '비용', `금화 ${fmt(gold)} · 강화석 ${stone}`, sv.gold >= gold && sv.stone >= stone ? '#ffd75e' : '#ff7070');
      if (danger) {
        const chk = this.add.container(24, 344);
        chk.add(this.add.rectangle(0, 0, 12, 12, 0x000000).setStrokeStyle(1, 0x9ae0ff).setOrigin(0, 0.5));
        if (this.useGuard) chk.add(this.add.text(6, 0, '✓', font(10, '#9ae0ff')).setOrigin(0.5));
        chk.add(this.add.text(18, 0, `파괴 방지권 쓰기 (${sv.guard}장)`, font9(10, sv.guard ? '#e8e2f8' : '#5a5070')).setOrigin(0, 0.5));
        chk.setSize(200, 18).setInteractive({ useHandCursor: true });
        chk.on('pointerup', () => { if (this.busy) return; if (!sv.guard) { sfx('deny'); return; } sfx('click'); this.useGuard = !this.useGuard; this.show('forge'); });
        b.add(chk);
      }
      const ok = sv.gold >= gold && sv.stone >= stone;
      const eb = button(this, sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1 ? 82 : W / 2, 410, sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1 ? 130 : 180, 38, '강화', () => this.enhance(), { size: 15, color: danger ? 0x8a3a2a : 0x7a5a1a });
      eb.setEnabled(ok); b.add(eb);
    }
    // 승급: +10 이상이고 그 등급 챕터 보스를 깨면 다음 등급 무기로(강화는 +0부터)
    if (sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1) {
      const need = (sv.tier + 1) * 6, okBoss = sv.cleared >= need, cost = D.promoteGold(sv.tier);
      const pb = button(this, max ? W / 2 : 200, 410, max ? 180 : 110, 38, `승급 ${fmt(cost)}`, () => this.promote(), { size: 12, color: 0x5a2f8a });
      pb.setEnabled(okBoss && sv.gold >= cost); b.add(pb);
      if (!okBoss) b.add(this.add.text(W / 2, 384, `승급하려면 ${sv.tier + 1}장 보스를 쓰러뜨려야 한다`, font9(9, '#ff9a8a')).setOrigin(0.5, 0));
      else b.add(this.add.text(W / 2, 384, `다음: ${D.TIERS[sv.tier + 1].name} (공격력 ${D.TIERS[sv.tier + 1].atk})`, font9(9, '#c8a0ff')).setOrigin(0.5, 0));
    }
  }

  enhance() {
    const sv = this.sv, enh = sv.enh;
    if (this.busy || enh >= D.ENH_MAX) return;
    const gold = D.enhGold(sv.tier, enh), stone = D.enhStone(sv.tier, enh);
    if (sv.gold < gold || sv.stone < stone) return;
    this.busy = true;
    sv.gold -= gold; sv.stone -= stone;
    const danger = enh >= D.DESTROY_FROM, guard = danger && this.useGuard && sv.guard > 0;
    if (guard) sv.guard--;
    const win = Math.random() * 100 < D.ENH_RATE[enh];
    let outcome = win ? 'success' : danger && !guard ? 'shatter' : 'fail';
    if (win) sv.enh++;
    else if (outcome === 'shatter') { sv.enh = 0; sv.stats.destroyed++; }
    if (sv.enh < D.DESTROY_FROM || sv.guard <= 0) this.useGuard = false;
    save();
    this.refreshTop();
    // 망치질 세 번(확률이 낮을수록 한 번 더 뜸을 들인다)
    const hits = D.ENH_RATE[enh] < 40 ? 4 : 3;
    const h = this.hammer, sw = this.sword;
    this.tweens.killTweensOf(sw); sw.y = 168;
    const strike = i => {
      this.tweens.add({
        targets: h, angle: -50, x: W / 2 + 26, y: 150, duration: 110, ease: 'Quad.In', onComplete: () => {
          sfx('anvil');
          this.cameras.main.shake(70, 0.006);
          this.sparks(W / 2 + 6, 176, 10 + i * 4, 0xffc46a);
          sw.setTintFill?.(0xffffff); this.time.delayedCall(50, () => sw.clearTint?.());
          this.tweens.add({ targets: h, angle: 30, x: W / 2 + 54, y: 130, duration: 220, ease: 'Quad.Out', onComplete: () => i + 1 < hits ? this.time.delayedCall(i === hits - 2 ? 320 : 60, () => strike(i + 1)) : this.reveal(outcome, enh) });
        },
      });
    };
    strike(0);
  }

  reveal(outcome, from) {
    const sw = this.sword;
    if (outcome === 'success') {
      sfx('success');
      const p = this.add.sprite(W / 2, 214, 'fx2_r2s').setOrigin(0.5, 1).setScale(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).play('fxPillar');
      p.once('animationcomplete', () => p.destroy());
      this.sparks(W / 2, 168, 40, 0xffe08a);
      this.tweens.add({ targets: sw, scale: sw.scale * 1.25, duration: 160, yoyo: true });
      this.flashText(`강화 성공!  +${from + 1}`, '#ffd75e');
    } else if (outcome === 'fail') {
      sfx('fail');
      sw.setTint?.(0x6a6a7a); this.time.delayedCall(400, () => sw.clearTint?.());
      this.tweens.add({ targets: sw, x: W / 2 + 4, duration: 45, yoyo: true, repeat: 4 });
      this.flashText(from >= D.DESTROY_FROM ? '실패… 방지권이 칼을 지켰다' : '강화 실패', '#a8a0c0');
    } else {
      sfx('shatter');
      this.cameras.main.shake(350, 0.02);
      this.cameras.main.flash(250, 255, 60, 60);
      // 칼이 조각나 흩어진다
      for (let i = 0; i < 14; i++) {
        const sh = this.add.rectangle(W / 2 + R(-20, 20), 168 + R(-24, 24), R(3, 7), R(3, 9), Phaser.Utils.Array.GetRandom([0xd8e0f0, 0x9aa4b8, 0x6a7080])).setDepth(40);
        this.tweens.add({ targets: sh, x: sh.x + R(-110, 110), y: sh.y + R(-60, 120), angle: R(-360, 360), alpha: 0, duration: R(600, 1000), ease: 'Quad.Out', onComplete: () => sh.destroy() });
      }
      sw.setVisible(false);
      this.flashText(`파괴!  +${from} → +0`, '#ff5050');
    }
    this.time.delayedCall(outcome === 'shatter' ? 1500 : 900, () => { this.busy = false; this.show('forge'); });
  }

  promote() {
    const sv = this.sv, cost = D.promoteGold(sv.tier);
    if (this.busy || sv.gold < cost || sv.cleared < (sv.tier + 1) * 6) return;
    this.busy = true;
    sv.gold -= cost; sv.tier++; sv.enh = 0; save(); this.refreshTop();
    sfx('win');
    this.cameras.main.flash(400, 200, 160, 255);
    const p = this.add.sprite(W / 2, 214, 'fx2_r2s').setOrigin(0.5, 1).setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8a0ff).play('fxPillar');
    p.once('animationcomplete', () => p.destroy());
    this.sparks(W / 2, 168, 60, 0xc8a0ff);
    this.flashText(`승급!  ${D.TIERS[sv.tier].name}`, '#c8a0ff');
    this.time.delayedCall(1400, () => { this.busy = false; this.show('forge'); });
  }

  sparks(x, y, n, tint) {
    for (let i = 0; i < n; i++) {
      const a = RF(-Math.PI, 0), v = R(30, 110);
      const s = this.add.image(x, y, 'spark').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(40).setScale(R(1, 2));
      this.tweens.add({ targets: s, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v + 40, alpha: 0, duration: R(300, 650), ease: 'Quad.Out', onComplete: () => s.destroy() });
    }
  }

  flashText(msg, color) {
    const t = this.add.text(W / 2, 120, msg, font(16, color)).setOrigin(0.5).setDepth(60).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: 100, delay: 900, duration: 300, onComplete: () => t.destroy() });
  }

  // ── 훈련 탭 ──
  trainTab() {
    const sv = this.sv, b = this.body;
    b.add(this.add.text(W / 2, 52, '훈련장', font(15, '#ffd75e')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 70, '금화로 영원히 강해진다', font9(9, '#a89cc8')).setOrigin(0.5));
    D.TRAINING.forEach((t, i) => {
      const lv = sv.train[t.id] || 0, max = lv >= t.max, cost = D.trainCost(t, lv);
      const y = 88 + i * 42;
      b.add(panel(this, 12, y, W - 24, 38, { fill: 0x1a1528 }));
      b.add(this.add.text(22, y + 6, t.name, font(11)));
      b.add(this.add.text(70, y + 8, `Lv ${lv}/${t.max}`, font9(9, max ? '#ffd75e' : '#a89cc8')));
      const val = t.unit === '%' ? `+${Math.round(lv * t.v * 100)}%` : t.unit === '회' ? (lv ? '있음' : '없음') : `+${(lv * t.v).toFixed(1)}`;
      b.add(this.add.text(22, y + 22, `${t.desc} ${val}`, font9(9, '#e8e2f8')));
      const btn = button(this, W - 52, y + 19, 70, 26, max ? '최대' : fmt(cost), () => {
        if (sv.gold < cost || max) return;
        sv.gold -= cost; sv.train[t.id] = lv + 1; save();
        sfx('buy'); this.refreshTop(); this.bump(0);
        this.show('train');
      }, { size: 10, color: 0x7a5a1a });
      btn.setEnabled(!max && sv.gold >= cost);
      b.add(btn);
    });
    const st = sv.stats;
    b.add(this.add.text(W / 2, 428, `출전 ${st.runs}  ·  처치 ${fmt(st.kills)}  ·  파괴 ${st.destroyed}`, font9(9, '#6a6080')).setOrigin(0.5, 1));
  }

  update() { if (this.topTxt) this.topTxt.forEach(t => { const v = t.get(); if (t.text !== String(v)) t.setText(v); }); }

  // ── 상점 탭: 보석으로 사기·광고 보상 / 패키지(결제) ──
  shopTab() {
    const sv = this.sv, b = this.body, page = this.shopPage || 'gem';
    const sub = (x, id, name) => {
      const bt = button(this, x, 54, 120, 24, name, () => { this.shopPage = id; this.show('shop'); }, { size: 11, color: page === id ? 0x7a5a1a : 0x2a2440 });
      b.add(bt);
    };
    sub(72, 'gem', '보석 상점'); sub(198, 'pack', '패키지');
    const after = msg => { this.refreshTop(); this.bump(4); toast(this, msg, '#ffd75e'); this.show('shop'); };
    if (page === 'gem') {
      b.add(this.add.text(16, 76, '보석으로 사기', font(11, '#ff9ad0')));
      D.GEM_SHOP.forEach((it, i) => {
        const x = 16 + (i % 2) * 122, y = 94 + Math.floor(i / 2) * 64;
        const c = this.add.container(x, y); b.add(c);
        c.add(panel(this, 0, 0, 116, 58));
        c.add(icon(this, 18, 22, it.icon, 22));
        c.add(this.add.text(34, 8, it.name, font(10)));
        c.add(this.add.text(34, 24, giveText(it.give), font9(9, '#c8bfe0')));
        const ok = sv.gem >= it.cost;
        c.add(gemIcon(this, 40, 46, 10));
        c.add(this.add.text(50, 39, String(it.cost), font(10, ok ? '#ff9ad0' : '#7a5a6a')));
        const z = this.add.zone(x, y, 116, 58).setOrigin(0).setInteractive({ useHandCursor: true }); b.add(z);
        z.on('pointerup', () => {
          if (this.busy) return;
          if (sv.gem < it.cost) { sfx('deny'); toast(this, '보석이 모자라다 · 패키지에서 얻을 수 있다', '#ff9a8a'); return; }
          sv.gem -= it.cost; grant(sv, it.give); sfx('buy');
          after(`${it.name} 구매!`);
        });
      });
      b.add(this.add.text(16, 230, '무료 보상 (광고)', font(11, '#9ae0ff')));
      Object.entries(D.ADS).filter(([k]) => k !== 'double').forEach(([k, ad], i) => {
        const y = 262 + i * 42, left = adsLeft(sv, k);
        b.add(panel(this, 16, y - 18, W - 32, 36));
        b.add(this.add.text(28, y - 7, ad.name, font(11)));
        b.add(this.add.text(150, y - 6, `오늘 ${left}/${ad.daily}`, font9(9, left ? '#c8bfe0' : '#5a5070')));
        const bt = button(this, W - 52, y, 64, 24, sv.noAds ? '받기' : '보기 ▶', async () => {
          if (this.busy || adsLeft(sv, k) <= 0) return;
          this.busy = true;
          const ok = await showAd(this, sv, k);
          this.busy = false;
          if (!ok || !this.scene.isActive()) return;
          sv.ads[k] = (sv.ads[k] || 0) + 1; grant(sv, ad.give);
          after(`${ad.name} 받았다`);
        }, { size: 10, color: 0x2f5a7a });
        bt.setEnabled(left > 0); b.add(bt);
      });
      const info = [`매일 접속하면 보석 +${D.GEM_FREE.daily}`, `스테이지 첫 클리어 보석 +${D.GEM_FREE.stageFirst} · 보스 +${D.GEM_FREE.bossFirst}`];
      if (sv.passLeft > 0) info.push(`월정액: 남은 ${sv.passLeft}일 · 매일 보석 ${D.PASS_DAILY.gem}`);
      info.forEach((t, i) => b.add(this.add.text(W / 2, 354 + i * 16, t, font9(9, i === 2 ? '#ffd75e' : '#a89cc8')).setOrigin(0.5)));
      return;
    }
    // 패키지
    D.IAP.forEach((it, i) => {
      const y = 76 + i * 56, sold = it.once && sv.bought[it.id];
      const hot = it.id === 'starter' || it.id === 'pass';
      b.add(panel(this, 12, y, W - 24, 50, { line: hot && !sold ? 0xffd75e : COLOR.line }));
      b.add(gemIcon(this, 30, y + 25, 18));
      b.add(this.add.text(46, y + 8, it.name, font(11, hot ? '#ffd75e' : '#ffffff')));
      b.add(this.add.text(46, y + 24, it.desc || giveText(it.give) + (it.passDays ? ` (+매일 ${D.PASS_DAILY.gem})` : '') + (it.noAds ? ' · 광고 없음' : ''), font9(it.desc ? 8 : 9, '#e8e2f8')));
      if (it.tag) b.add(this.add.text(46, y + 37, it.id === 'pass' && sv.passLeft > 0 ? `남은 ${sv.passLeft}일 · 사면 연장` : it.tag, font9(8, '#ff9ad0')));
      const bt = button(this, W - 46, y + 25, 60, 26, sold ? '구매함' : won(it.price), async () => {
        if (this.busy || sold) return;
        this.busy = true;
        const ok = await buy(this, sv, it);
        this.busy = false;
        if (ok && this.scene.isActive()) after(`${it.name} 구매 완료!`);
      }, { size: 9, color: 0x5a2f8a });
      bt.setEnabled(!sold); b.add(bt);
    });
  }
}

const RF = Phaser.Math.FloatBetween;
