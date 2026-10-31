// 첫 실행 프롤로그(처음 하는 사람에게만, 직접 하는 약 1분 30초). 보는 영상이 아니라 진짜 전투다(Battle.js 프롤로그 모드, proBattle.js).
//  1) 'play': 최강 상태(+20 도끼·최강 펫·최강 장비·스킬 여러 개 MAX 직전)로 직접 움직이며 몬스터를 쓸고 레벨업 카드를 고른다 — 저장은 메모리 모래판에서만(save.js sandboxBegin)
//  2) 마지막에 15장 마지막 보스(PROLOGUE_BOSS)가 나온다. 거의 다 여기서 쓰러진다(신컨 1% 미만만 잡는다 → 잡으면 성이 무너져 깔린다, 대신 보상) → 'after': 무기가 부서진다(+20 → +0)
//  3) 쓰러진 주인공을 사제가 부활시킨다(대사·탭으로 넘김·건너뛰기) — 사제는 30장 보스라는 복선을 눈빛·한 줄 대사로만 깐다(docs/prologue.md)
//  4) 낡은 검 +0·펫·장비 없음으로 새 목표를 받고 대장간(로비)에서 게임 설명부터 듣는다. 음악은 15장 마지막 보스 곡(boss.mp3), 1-1이 열리면 전투 곡으로 돌아간다
//  진짜 저장에 남는 건 '봤음' 표시 하나뿐이다(끝의 showGoal). 보스를 잡았으면 금화 보너스·마왕의 목걸이(proRelic)도 남는다
import { W, H, BOSSES, PROLOGUE_BOSS } from './data.js';
import { RARITY } from './gear.js';
import { font, font9, panel, button, hiCam } from './ui.js';
import { sfx, playBgm } from './sfx.js';
import { load, save, sandboxBegin } from './save.js';
import { makeProSv } from './proBattle.js';
import { track } from './log.js';
import { t } from './i18n.js';
import { wrapTo } from './textfit.js';
import { ensureKeys } from './lazy.js';
import { buildAnims } from './Boot.js';
import { insetsGame, inTossShell } from './safeArea.js';

const RND = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;
const MAXC = RARITY[4].color;                                  // 최강 장비 색
let WON = false;   // 보스를 진짜로 잡고 무너진 성에 깔렸다(첫 줄 대사·보상이 달라진다)
export const PRO_BONUS_GOLD = 600;   // 보스를 잡은 사람 보너스(1-1 첫 클리어의 몇 배: 대장간에서 바로 몇 번 두드려 본다)
const LINES = [   // [누가, 키]
  ['hero', () => (WON ? t('prologue.l0w') : t('prologue.l0'))], ['hero', () => t('prologue.l1')], ['priest', () => t('prologue.l2')], ['priest', () => t('prologue.l3')],
  ['priest', () => t('prologue.l4')], ['priest', () => t('prologue.l5')], ['hero', () => t('prologue.l6')],
];
// 프롤로그 전용 그림(game/assets/pro_*.png, docs/prologue.md): 사제 5프레임·거대 보스 3프레임·쓰러진 주인공 2프레임·부활 빛 기둥 4프레임
const PRO_SHEETS = [['pro_priest', 60, 79], ['pro_boss', 165, 202], ['pro_hero_down', 69, 51], ['pro_revive_fx', 41, 78]];

export class Prologue extends Phaser.Scene {
  constructor() { super('Prologue'); }

  // phase: 'play'(전투로 보낸다) | 'after'(보스에게 쓰러진 뒤: 무기 파괴 → 컷신) | 'skip'(건너뛰기: 새 목표 화면으로)
  init(data) { WON = this.won = !!data?.won; this.replay = !!data?.replay; this.stage = data?.phase || 'play'; this.data0 = data || {}; }

  // 15장 몹·15장 마지막 보스·바닥·최강 펫 그림은 첫 실행에서 아직 안 받았다: 시작 직전에 받는다(전투도 이 그림들을 쓴다)
  preload() {
    ensureKeys(this, k => /^(z15_r[012]|boss5_r0|tile15)$/.test(k));
    for (const [k, fw, fh] of PRO_SHEETS) if (!this.textures.exists(k)) this.load.spritesheet(k, `assets/${k}.png`, { frameWidth: fw, frameHeight: fh });
  }

  create() {
    hiCam(this); buildAnims(this); this.makeAnims();
    if (this.stage === 'play') return this.startPlay();
    this.sv = load();   // 모래판은 이미 닫혔다: 진짜 저장
    this.fg = this.add.group();
    this.sched = []; this.T = 0; this.phase = 'after'; this.skipped = this.stage === 'skip';
    this.HX = W / 2; this.HY = Math.round(H * 0.6);
    const ins = insetsGame(this.game);
    this.topY = (inTossShell() ? ins.xTop : ins.top) + 6;
    if (!this.sound.locked) playBgm('boss', 0);   // 15장 마지막 보스 곡을 이어서
    this.makeGround();
    this.hero = this.add.sprite(this.HX, this.HY, this.idleTex).setOrigin(0.5, 1).setScale(1.35).setDepth(8);
    this.add.ellipse(this.HX, this.HY - 2, 40, 12, 0x000000, 0.4).setDepth(7);
    this.events.once('shutdown', () => { this.tweens.killAll(); this.time.removeAllEvents(); });
    if (this.skipped) return this.skipToGoal();
    this.skipBtn = this.data0?.replay ? button(this, W - 38, this.topY + 11, 62, 20, t('coach.88130a'), () => this.skip(), { size: 10 }).setDepth(300) : { setDepth() {}, destroy() {} };   // 처음엔 건너뛰기 없음, 다시 보기에서만(사용자 10/31)
    // 보스에게 쓰러진 모습으로 시작해 무기가 부서진다
    this.hero.setOrigin(0.5, 1).setTexture('pro_hero_down', 0).setScale(1.15).setTint(0xffaaaa).setPosition(this.HX - 40, this.HY + 36);
    this.wk = this.data0.wk && this.textures.exists(this.data0.wk) ? this.data0.wk : (this.textures.exists('w_axe9') ? 'w_axe9' : 'w_sword9');
    this.dim.setAlpha(0.5);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.at(0.15, () => this.breakWeapon());
    this.at(6.4, () => { this.cameras.main.fadeOut(500, 0, 0, 0); this.cameras.main.once('camerafadeoutcomplete', () => !this.skipped && this.startCut()); });
  }

  // 모래판(저장과 따로 노는 풀템 상태)을 열고 전투로 보낸다
  startPlay() {
    sandboxBegin(makeProSv(load()));
    track('prologue_start', { replay: this.replay });
    this.scene.start('Battle', { chapter: 14, stage: 0, prologue: true, replay: this.replay });
  }

  at(sec, fn) { this.sched.push({ t: sec, fn }); }

  // 건너뛰기로 들어왔다: 주인공이 선 채로 새 목표 화면
  skipToGoal() {
    this.hero.setDepth(25).setPosition(this.HX, this.HY + 30).clearTint().setFlipX(false).setScale(1.35).play('pro_sword');
    this.dim.setAlpha(0.6);
    this.dlg = { setVisible() {}, destroy() {} }; this.tapZone = { destroy() {} }; this.skipBtn = { destroy() {} };
    this.showGoal();
  }

  // ── 코드로 그리는 그림 ──
  makeAnims() {
    const A = (key, tex, frames, rate, repeat) => { if (!this.anims.exists(key) && this.textures.exists(tex)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, frames ? { frames } : {}), frameRate: rate, repeat }); };
    this.idleTex = this.textures.exists('hn_hero2_r2s') ? 'hn_hero2_r2s' : 'hero2_r2s';
    A('pro_idle', this.idleTex, [2, 3], 2.5, -1);
    A('pro_sword', 'hero2_r2s', [2, 3], 2.5, -1); A('pro_pillar', 'pro_revive_fx', null, 9, -1); A('pro_priest_idle', 'pro_priest', [0, 1], 2, -1); A('pro_priest_pray', 'pro_priest', [2, 3], 4, -1);
  }
  makeGround() {
    const key = this.textures.exists('tile15') ? 'tile15' : 'tiles';
    if (!this.textures.exists(key + '_t')) { const src = this.textures.get(key).getSourceImage(); this.textures.addSpriteSheet(key + '_t', src, { frameWidth: src.width / 4, frameHeight: src.width / 4 }); }
    this.add.tileSprite(0, 0, W, H, key + '_t', 0).setOrigin(0).setDepth(-10);
    this.dim = this.add.rectangle(0, 0, W, H, 0x05030a, 1).setOrigin(0).setDepth(20).setAlpha(0);   // 어두운 막(컷신에서 짙어진다)
    this.red = this.add.rectangle(0, 0, W, H, 0xff1a10, 1).setOrigin(0).setDepth(19).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  }

  // ── 무기 부서짐: +20 → +0 ──
  breakWeapon() {
    if (this.skipped) return;
    this.phase = 'break';
    const F = o => (this.fg.add(o), o.setDepth(120));
    const cx = W / 2, cy = Math.round(H * 0.42);
    const back = F(this.add.rectangle(0, 0, W, H, 0x05030a, 1).setOrigin(0).setAlpha(0)); this.tweens.add({ targets: back, alpha: 0.85, duration: 350 });
    const glow = F(this.add.image(cx, cy, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(MAXC).setScale(5).setAlpha(0));
    const sw = F(this.add.image(cx, cy, this.wk).setScale(0.5).setAlpha(0)); sw.preFX?.addGlow(MAXC, 5, 0, false, 0.1, 10);
    this.tweens.add({ targets: sw, scale: 7, alpha: 1, duration: 600, ease: 'Back.Out' }); this.tweens.add({ targets: glow, alpha: 0.5, duration: 600 });
    const a = F(this.add.text(cx, cy - 135, '+20', font(40, '#ffd75e', 5)).setOrigin(0.5)); a.isBtnLabel = true;
    const cap = F(this.add.text(cx, cy + 130, t('prologue.broke'), font(14, '#ffffff', 4)).setOrigin(0.5).setAlpha(0)); cap.isBtnLabel = true;
    // 금이 간다
    const g = F(this.add.graphics()); const cracks = [[0, -6, -26, -50, -10, -90], [0, 0, 30, -30, 20, -80], [0, 6, -34, 36, -22, 84], [4, 10, 38, 50, 30, 88], [0, 0, -50, 8, -88, 22], [0, 0, 52, -6, 90, -20]];
    let k = 0;
    this.time.addEvent({ delay: 170, repeat: cracks.length - 1, callback: () => {
      const c = cracks[k++]; g.lineStyle(2, 0xffffff, 0.95).beginPath().moveTo(cx + c[0], cy + c[1]).lineTo(cx + c[2], cy + c[3]).lineTo(cx + c[4], cy + c[5]).strokePath();
      sfx('click'); sw.x = cx + RND(-3, 3);
    } });
    this.time.delayedCall(1400, () => {
      if (this.skipped) return;
      sfx('shatter'); this.cameras.main.flash(260, 255, 255, 255); this.cameras.main.shake(500, 0.02);
      sw.destroy(); g.destroy(); this.tweens.add({ targets: glow, alpha: 0, duration: 500 });
      for (let i = 0; i < 26; i++) {
        const p = F(this.add.image(cx + RND(-14, 14), cy + RND(-30, 30), 'px').setScale(RND(4, 10)).setTint([0xff9a5a, 0xffd75e, 0xffffff, 0xff5a3a, 0xc8c0d8][RND(0, 4)]));
        const an = RF(0, 6.28), d = RND(60, 150);
        this.tweens.add({ targets: p, x: cx + Math.cos(an) * d, y: cy + Math.sin(an) * d + 60, angle: RND(-360, 360), alpha: 0, duration: RND(700, 1100), ease: 'Quad.Out', onComplete: () => p.destroy() });
      }
      this.tweens.add({ targets: a, x: cx - 66, scale: 0.75, duration: 300, ease: 'Quad.Out' });
      const ar = F(this.add.text(cx, cy - 135, '→', font(28, '#ffffff', 4)).setOrigin(0.5).setAlpha(0)); ar.isBtnLabel = true;
      const z = F(this.add.text(cx + 66, cy - 135, '+0', font(40, '#ff5a5a', 5)).setOrigin(0.5).setScale(2.2).setAlpha(0)); z.isBtnLabel = true;
      this.tweens.add({ targets: ar, alpha: 1, duration: 200, delay: 250 });
      this.tweens.add({ targets: z, alpha: 1, scale: 1, duration: 300, delay: 400, ease: 'Back.Out', onStart: () => sfx('fail') });
      this.tweens.add({ targets: cap, alpha: 1, duration: 300, delay: 600 });
    });
  }

  // ── 컷신: 쓰러짐 → 사제 → 부활 ──
  clearStage() {
    this.tweens.killAll(); this.time.removeAllEvents(); this.sched.length = 0;
    this.fg.destroy(true); this.fg = this.add.group();
    this.cameras.main.resetFX();
  }
  startCut() {
    this.clearStage(); this.phase = 'cut';
    this.skipBtn.setDepth(300);
    this.dim.setAlpha(0.8).setDepth(20);
    this.hero.setDepth(25).setPosition(this.HX - 30, this.HY + 24).setAngle(0).setFlipX(false).setScale(1.15).setTexture('pro_hero_down', 0).setTint(0x7a7a90);
    this.hero.stop(); this.hero.y += 4;
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.dlgIdx = -1; this.makeDialog();
    this.time.delayedCall(900, () => this.nextLine());
  }
  makeDialog() {
    const bh = 100, by = H - bh - 8;
    this.dlg = this.add.container(0, 0).setDepth(200);
    this.dlg.add([panel(this, 8, by, W - 16, bh, { fill: 0x111923, line: 0x475c66, alpha: 0.96 })]);
    this.who = this.add.text(18, by + 8, '', font(11, '#7fe6ee', 3)).setOrigin(0, 0); this.who.isBtnLabel = true;
    this.body = this.add.text(18, by + 26, '', font9(11, '#f2e4bc')).setLineSpacing(3); this.body.isBtnLabel = true;
    this.more = this.add.text(W - 20, by + bh - 12, '▼', font(10, '#ffd75e', 2)).setOrigin(0.5).setAlpha(0);
    this.more.isBtnLabel = true; this.tweens.add({ targets: this.more, y: this.more.y + 3, duration: 400, yoyo: true, repeat: -1 });
    this.dlg.add([this.who, this.body, this.more]);
    this.dlgBox = { y: by, h: bh };
    // 맨 아래 막: 아무 데나 탭하면 다음(건너뛰기 버튼은 이 위에서 먼저 받는다)
    this.tapZone = this.add.rectangle(0, 0, W, H, 0x000000, 0.001).setOrigin(0).setDepth(150).setInteractive();
    this.tapZone.on('pointerup', () => this.tap());
    this.dlg.setVisible(false);
  }
  tap() {
    if (this.phase !== 'cut') return;
    sfx('click');
    if (this.typing) { this.typing.remove(); this.typing = null; this.body.setText(this.full); this.finishLine(); return; }
    this.autoT?.remove(); this.nextLine();
  }
  finishLine() { this.more.setAlpha(1); this.autoT?.remove(); this.autoT = this.time.delayedCall(4600, () => this.phase === 'cut' && this.nextLine()); }
  nextLine() {
    this.autoT?.remove(); this.more.setAlpha(0);
    this.dlgIdx++;
    if (this.dlgIdx >= LINES.length) return this.showGoal();
    const [who, line] = LINES[this.dlgIdx], i = this.dlgIdx;
    this.dlg.setVisible(true);
    this.who.setText(who === 'hero' ? t('prologue.whoHero') : t('prologue.whoPriest')).setColor(who === 'hero' ? '#7fe6ee' : '#ffe9a0');
    // 글자 크기: 상자에 들어갈 때까지 줄인다(긴 번역)
    const TW = W - 16 - 20, room = this.dlgBox.h - 34, text = line();
    let sz = 11; this.body.setText('');
    for (; sz >= 7; sz -= 0.5) { this.body.setFontSize(sz); this.full = wrapTo(this.body, text, TW); this.body.setText(this.full); if (this.body.height <= room) break; }
    this.body.setText('');
    const chars = [...this.full]; let n = 0;
    this.typing = this.time.addEvent({ delay: 34, repeat: chars.length - 1, callback: () => { this.body.setText(chars.slice(0, ++n).join('')); if (n === chars.length) { this.typing = null; this.finishLine(); } } });
    this.act(i);
  }
  // 줄마다 곁들이는 연출
  act(i) {
    const hx = this.HX - 30, py = this.HY + 28;
    if (i === 1) {   // 완전히 쓰러진다
      this.tweens.add({ targets: this.hero, y: this.HY + 36, duration: 700, ease: 'Quad.In' });
    }
    if (i === 2) {   // 빛 기둥 + 사제
      sfx('heal');
      this.pillar = this.add.sprite(this.HX + 54, py + 4, 'pro_revive_fx').setOrigin(0.5, 1).setScale(1.7, 1.6).setDepth(24).setAlpha(0).play('pro_pillar');
      this.priest = this.add.sprite(this.HX + 54, py, 'pro_priest', 0).setOrigin(0.5, 1).setScale(0.95).setDepth(26).setAlpha(0).play('pro_priest_idle');
      this.tweens.add({ targets: this.pillar, alpha: 0.75, duration: 700 }); this.tweens.add({ targets: this.priest, alpha: 1, duration: 1000, delay: 300 });
      this.cameras.main.flash(300, 255, 240, 190);
    }
    if (i === 3) {   // 부활: 낡은 검을 든 모습으로 일어선다
      sfx('success');
      const pl = this.add.sprite(hx, this.HY + 32, 'pro_revive_fx').setOrigin(0.5, 1).setScale(1.5, 1.3).setDepth(24).play('pro_pillar');
      this.priest?.play('pro_priest_pray');
      this.time.delayedCall(1600, () => this.tweens.add({ targets: pl, alpha: 0, duration: 500, onComplete: () => pl.destroy() }));
      this.cameras.main.flash(300, 255, 240, 190);
      this.hero.clearTint().setTint(0xffffff).clearTint();
      this.hero.setTexture('pro_hero_down', 1);
      this.tweens.add({ targets: this.hero, y: this.HY + 30, duration: 600, ease: 'Back.Out', onComplete: () => this.hero.setScale(1.35).play('pro_sword') });
      this.tweens.add({ targets: this.dim, alpha: 0.55, duration: 800 });
      this.showCard(false);
    }
    if (i === 4) this.showCard(true);
    if (i === 5) {   // 복선: 사제의 눈이 한순간 붉게 빛난다(눈빛 하나, 그 뒤 아무 일도 없다)
      const pr = this.priest; pr.play('pro_priest_idle');   // 붉은 눈 프레임(4)을 잠깐 보여 주고 틴트·글로우로 강조한다
      this.time.delayedCall(700, () => { if (!pr.active) return; pr.anims.stop(); pr.setFrame(4).setTint(0xffb0a0); pr.preFX?.addGlow(0xff2a10, 4, 0, false, 0.1, 10); sfx('warn'); });
      this.time.delayedCall(1300, () => { if (!pr.active) return; pr.clearTint(); pr.preFX?.clear(); pr.play('pro_priest_idle'); });
    }
  }
  // 지금 가진 것: 낡은 검 +0, 펫·장비 없음
  showCard(withNone) {
    if (!this.card) {
      const x = W / 2, y = this.topY + 40, c = this.add.container(0, 0).setDepth(210);
      c.add(panel(this, x - 84, y - 24, 168, withNone ? 66 : 50, { fill: 0x111923, line: 0xffb85c, alpha: 0.95 }));
      c.add(this.add.image(x - 62, y, 'w_sword0').setScale(1.1));
      const z = this.add.text(x - 40, y - 8, '+0', font(18, '#ff8a8a', 3)).setOrigin(0, 0.5); z.isBtnLabel = true; c.add(z);
      const nm = this.add.text(x - 40, y + 9, t('prologue.cardSword'), font9(10, '#f2e4bc')).setOrigin(0, 0.5); nm.isBtnLabel = true; c.add(nm);
      this.card = c; c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 400 });
    }
    if (withNone && !this.cardNone) {
      const x = W / 2, y = this.topY + 40;
      this.cardNone = this.add.text(x, y + 30, t('prologue.cardNone'), font9(10, '#ff9a9a')).setOrigin(0.5).setDepth(211); this.cardNone.isBtnLabel = true;
      this.card.list[0].clear().fillStyle(0x111923, 0.95).fillRect(x - 84, y - 24, 168, 66).lineStyle(1, 0xffb85c, 1).strokeRect(x - 83.5, y - 23.5, 167, 65);
      this.cardNone.setAlpha(0); this.tweens.add({ targets: this.cardNone, alpha: 1, duration: 400 });
    }
  }

  // ── 새 목표 → 1-1 ──
  showGoal() {
    this.phase = 'goal'; this.autoT?.remove(); this.typing?.remove(); this.typing = null;
    this.dlg.setVisible(false); this.tapZone.destroy(); this.skipBtn.destroy();
    this.cards?.destroy?.();
    if (!this.skipped) this.tweens.add({ targets: this.dim, alpha: 0.7, duration: 400 });
    // 진행 기록은 이 한 가지뿐: 프롤로그를 봤다(칼 +0·재화·장비는 그대로 새 저장)
    // 보스를 진짜로 잡았으면(신컨) 금화 보너스와 마왕의 목걸이(쓰러뜨린 몹이 가끔 우리 편이 됨, 밸런스는 거의 그대로). 다시 보기에선 안 준다
    const reward = this.won && !this.replay && !this.sv.proRelic;
    if (reward) { this.sv.gold += PRO_BONUS_GOLD; this.sv.proRelic = 1; track('prologue_reward', { gold: PRO_BONUS_GOLD }); }
    if (!this.replay) { this.sv.prologue = 1; save(); }
    track(this.skipped ? 'prologue_skip' : 'prologue_done', this.skipped ? { at: Math.round(this.data0.at || this.T), part: this.data0.part || 'after', lv: this.data0.lv } : { at: Math.round(this.T) });
    const x = W / 2, y = Math.round(H * 0.42), c = this.add.container(0, 0).setDepth(250);
    const ph = reward ? 252 : 168; c.add(panel(this, 18, y - ph / 2, W - 36, ph, { fill: 0x111923, line: 0xffb85c, alpha: 0.97 }));
    const title = this.add.text(x, y - ph / 2 + 22, t('prologue.goalTitle'), font(15, '#ffd75e', 4)).setOrigin(0.5); title.isBtnLabel = true; c.add(title);
    const lines = [t('prologue.goal1', { name: BOSSES[PROLOGUE_BOSS].name }), t('prologue.goal2')];
    lines.forEach((s, i) => {
      const o = this.add.text(30, y - ph / 2 + 44 + i * 34, '', font9(11, '#ffffff')).setLineSpacing(3); o.isBtnLabel = true;
      for (let sz = 11; sz >= 7; sz -= 0.5) { o.setFontSize(sz); o.setText(wrapTo(o, '- ' + s, W - 36 - 24)); if (o.height <= 32) break; }
      c.add(o);
    });
    if (reward) {   // 받은 것: 짧은 제목 아래 '- 문장'
      const ry = y - ph / 2 + 124;
      const rt = this.add.text(30, ry, t('prologue.rwT'), font(12, '#ffd75e', 3)); rt.isBtnLabel = true; c.add(rt);
      [t('prologue.rwGold', { n: PRO_BONUS_GOLD }), t('prologue.rwRelic')].forEach((s, i) => {
        const o = this.add.text(30, ry + 20 + i * 26, '', font9(11, '#ffffff')).setLineSpacing(3); o.isBtnLabel = true;
        for (let sz = 11; sz >= 7; sz -= 0.5) { o.setFontSize(sz); o.setText(wrapTo(o, '- ' + s, W - 36 - 24)); if (o.height <= 24) break; }
        c.add(o);
      });
    }
    const b = button(this, x, y + ph / 2 - 24, W - 72, 30, t('prologue.go'), () => this.finish(), { color: 0x2f6b3a, size: 12 });
    c.add(b);
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 400 });
    sfx('buy');
  }
  finish() {
    if (this.done) return; this.done = true;
    if (this.replay) return this.scene.start('Lobby');
    this.scene.start('Lobby', { tab: 'forge', intro: true });   // 10/31: 1-1로 바로 가지 않고 대장간에서 게임 설명부터(tutorial.js runIntro)
  }
  skip() {
    if (this.skipped || this.phase === 'goal') return;
    this.skipped = true; sfx('click');
    this.clearStage(); this.typing?.remove(); this.typing = null; this.autoT?.remove();
    this.pillar?.destroy(); this.priest?.destroy(); this.card?.destroy(); this.cardNone?.destroy();
    this.tapZone?.destroy(); this.dlg?.destroy();
    this.hero.setDepth(25).setPosition(this.HX, this.HY + 30).setAngle(0).clearTint().setFlipX(false).setScale(1.35).play('pro_sword');
    this.dim.setAlpha(0.6);
    this.dlg = { setVisible() {}, destroy() {} }; this.tapZone = { destroy() {} };
    this.showGoal();
  }

  // ── 매 프레임 ──
  update(time, delta) {
    if (this.stage === 'play') return;
    this.T += Math.min(delta, 50) / 1000;
    for (let i = this.sched.length - 1; i >= 0; i--) if (this.T >= this.sched[i].t) { const s = this.sched.splice(i, 1)[0]; s.fn(); }
  }
}
