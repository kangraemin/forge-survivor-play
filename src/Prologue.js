// 첫 실행 프롤로그(처음 하는 사람에게만, 약 1분). 전투가 아니라 정해진 연출 장면이라 저장에 아무것도 남기지 않는다(끝에 '봤음' 표시 하나만).
//  1) 최강 상태(+20 도끼·최강 펫·최강 장비·스킬 MAX)로 화면 가득 몬스터를 쓸어버린다  2) 15장 마지막 보스(PROLOGUE_BOSS)가 들어와 쓰러뜨리고 무기가 부서진다(+20 → +0)
//  3) 쓰러진 주인공을 사제가 부활시킨다(대사·탭으로 넘김·건너뛰기) — 사제는 30장 보스라는 복선을 눈빛·한 줄 대사로만 깐다(docs/prologue.md)
//  4) 낡은 검 +0·펫·장비 없음으로 새 목표를 받고 1-1로 이어진다. 음악은 15장 마지막 보스 곡(boss.mp3), 1-1이 열리면 전투 곡으로 돌아간다
import { W, H, BOSSES, PROLOGUE_BOSS } from './data.js';
import { RARITY } from './gear.js';
import { font, font9, panel, button, hiCam, icon } from './ui.js';
import { sfx, playBgm, unlock } from './sfx.js';
import { load, save } from './save.js';
import { track } from './log.js';
import { t } from './i18n.js';
import { wrapTo } from './textfit.js';
import { ensureKeys } from './lazy.js';
import { buildAnims } from './Boot.js';
import { insetsGame, inTossShell } from './safeArea.js';

const RND = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;
const MAXC = RARITY[4].color;                                  // 최강 장비 색
const MOBS15 = ['anvilimp', 'flamegiant', 'starskull'];        // 15장 몹(보스와 같은 장)
const SKILL_ICONS = [4, 8, 7, 6, 5];                           // 진화한 스킬 아이콘(아이콘 시트 번호)
const GEAR_ICONS = ['gs_helm', 'gs_armor', 'gs_boots', 'gs_ring', 'gs_collar'];
const LINES = [   // [누가, 키]
  ['hero', () => t('prologue.l0')], ['hero', () => t('prologue.l1')], ['priest', () => t('prologue.l2')], ['priest', () => t('prologue.l3')],
  ['priest', () => t('prologue.l4')], ['priest', () => t('prologue.l5')], ['hero', () => t('prologue.l6')],
];
// 프롤로그 전용 그림(game/assets/pro_*.png, docs/prologue.md): 사제 5프레임·거대 보스 3프레임·쓰러진 주인공 2프레임·부활 빛 기둥 4프레임
const PRO_SHEETS = [['pro_priest', 60, 79], ['pro_boss', 165, 202], ['pro_hero_down', 69, 51], ['pro_revive_fx', 41, 78]];

export class Prologue extends Phaser.Scene {
  constructor() { super('Prologue'); }

  init(data) { this.replay = !!data?.replay; }

  // 15장 몹·15장 마지막 보스·바닥·최강 펫 그림은 첫 실행에서 아직 안 받았다: 시작 직전에 받는다
  preload() {
    ensureKeys(this, k => /^(z15_r[012]|boss5_r0|tile15)$/.test(k));
    for (const [k, fw, fh] of PRO_SHEETS) if (!this.textures.exists(k)) this.load.spritesheet(k, `assets/${k}.png`, { frameWidth: fw, frameHeight: fh });
  }

  create() {
    hiCam(this); buildAnims(this); this.makeTextures(); this.makeAnims();
    this.sv = load();
    this.fg = this.add.group();      // 전투 연출 물체(끝나면 한 번에 지운다)
    this.mobs = []; this.waves = []; this.sched = []; this.T = 0; this.kills = 0; this.phase = 'fight'; this.skipped = false; this.spawnOn = true;
    this.HX = W / 2; this.HY = Math.round(H * 0.6); this.face = 1; this.orbit = 0;
    const ins = insetsGame(this.game);
    this.topY = (inTossShell() ? ins.xTop : ins.top) + 6;
    track('prologue_start', { replay: this.replay });
    playBgm('boss', 0);   // 15장 마지막 보스 곡. 첫 터치 전에는 소리가 나지 않으니(자동재생 제한) 첫 터치에 다시 건다
    this.input.once('pointerdown', () => { unlock(); playBgm('boss', 0); });
    this.makeGround(); this.makeHero(); this.makePet(); this.makeHud();
    this.skipBtn = button(this, W - 38, this.topY + 11, 62, 20, t('coach.88130a'), () => this.skip(), { size: 10 }).setDepth(300);
    this.events.once('shutdown', () => { this.tweens.killAll(); this.time.removeAllEvents(); });
    // 시간표(초)
    this.at(15.5, () => this.ult());
    this.at(17.2, () => this.bossIn());
    this.at(24.6, () => this.telegraph());
    this.at(25.8, () => this.slam());
    this.at(27.0, () => this.breakWeapon());
    this.at(33.4, () => { this.cameras.main.fadeOut(500, 0, 0, 0); this.cameras.main.once('camerafadeoutcomplete', () => !this.skipped && this.startCut()); });
    this.slashNext();
  }

  at(sec, fn) { this.sched.push({ t: sec, fn }); }

  // ── 코드로 그리는 그림 ──
  makeTextures() {}
  makeAnims() {
    const A = (key, tex, frames, rate, repeat) => { if (!this.anims.exists(key) && this.textures.exists(tex)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, frames ? { frames } : {}), frameRate: rate, repeat }); };
    this.idleTex = this.textures.exists('hn_hero2_r2s') ? 'hn_hero2_r2s' : 'hero2_r2s';
    this.slashTex = this.textures.exists('hn_hero_r2s') ? 'hn_hero_r2s' : 'hero_r2s';
    A('pro_idle', this.idleTex, [2, 3], 2.5, -1); A('pro_slash', this.slashTex, null, 22, 0);
    A('pro_sword', 'hero2_r2s', [2, 3], 2.5, -1); A('pro_pillar', 'pro_revive_fx', null, 9, -1); A('pro_priest_idle', 'pro_priest', [0, 1], 2, -1); A('pro_priest_pray', 'pro_priest', [2, 3], 4, -1);
  }
  makeGround() {
    const key = this.textures.exists('tile15') ? 'tile15' : 'tiles';
    if (!this.textures.exists(key + '_t')) { const src = this.textures.get(key).getSourceImage(); this.textures.addSpriteSheet(key + '_t', src, { frameWidth: src.width / 4, frameHeight: src.width / 4 }); }
    this.add.tileSprite(0, 0, W, H, key + '_t', 0).setOrigin(0).setDepth(-10);
    this.dim = this.add.rectangle(0, 0, W, H, 0x05030a, 1).setOrigin(0).setDepth(20).setAlpha(0);   // 어두운 막(컷신에서 짙어진다)
    this.red = this.add.rectangle(0, 0, W, H, 0xff1a10, 1).setOrigin(0).setDepth(19).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  }

  // ── 주인공·무기·펫 ──
  makeHero() {
    this.hero = this.add.sprite(this.HX, this.HY, this.idleTex).setOrigin(0.5, 1).setScale(1.35).setDepth(8).play('pro_idle');
    this.add.ellipse(this.HX, this.HY - 2, 40, 12, 0x000000, 0.4).setDepth(7);
    // 발밑 최강 기운
    const aura = this.add.image(this.HX, this.HY - 4, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(MAXC).setDepth(7.5).setScale(1.6, 0.7).setAlpha(0.6);
    this.tweens.add({ targets: aura, alpha: 0.25, duration: 520, yoyo: true, repeat: -1 }); this.fg.add(aura);
    const wk = this.textures.exists('w_axe9') ? 'w_axe9' : 'w_sword9';
    this.wp = this.add.image(this.HX, this.HY, wk).setOrigin(0.2, 0.8).setScale(1.6).setDepth(8.5);
    this.wp.preFX?.addGlow(MAXC, 4, 0, false, 0.1, 8);
    this.fg.add(this.wp);
    this.hero.on('animationcomplete', a => { if (a.key === 'pro_slash' && this.phase !== 'cut') this.slashNext(); });
  }
  makePet() {
    if (!this.textures.exists('boss5_r0s')) return;
    this.pet = this.add.sprite(this.HX - 44, this.HY - 6, 'boss5_r0s').setScale(0.3).setDepth(9);
    if (this.anims.exists('thunderdragon')) this.pet.play('thunderdragon');
    this.pet.preFX?.addGlow(0x9a8aff, 3, 0, false, 0.1, 8);
    this.petRing = this.add.ellipse(this.pet.x, this.pet.y + 10, 24, 8, 0x9a8aff, 0.6).setDepth(8);
    this.fg.add(this.pet); this.fg.add(this.petRing);
  }
  slashNext() {
    if (this.phase === 'cut' || this.skipped || !this.hero.active || this.dead) return;
    // 가장 가까운 몹(없으면 보스 쪽)을 향해 베고, 근처 몹을 쓸어 버린다
    let tg = null, bd = 1e9;
    for (const m of this.mobs) { const d = Phaser.Math.Distance.Between(m.x, m.y, this.HX, this.HY); if (d < bd) { bd = d; tg = m; } }
    this.face = tg ? (tg.x < this.HX ? -1 : 1) : -this.face;
    this.hero.setFlipX(this.face < 0).play('pro_slash');
    sfx('swing', 60);
    const near = this.mobs.filter(m => Phaser.Math.Distance.Between(m.x, m.y, this.HX, this.HY) < 96).slice(0, 5);
    for (const m of near) this.killMob(m);
    if (this.phase === 'boss' || this.phase === 'bossHit') this.bossDmg();
  }
  // 칼질 중 무기가 손을 따라 휘두르는 모양
  placeWeapon() {
    if (!this.wp?.active) return;
    const f = this.face, an = this.hero.anims, slashing = an.currentAnim?.key === 'pro_slash' && an.isPlaying;
    const p = slashing ? an.getProgress() : 0;
    this.wp.setPosition(this.hero.x + f * 13, this.hero.y - 28 + (slashing ? 0 : Math.sin(this.T * 4) * 1.5));
    this.wp.setFlipX(f < 0).setAngle(f * (slashing ? -110 + 200 * p : 25));
  }

  // ── 위쪽 표시(HUD) ──
  makeHud() {
    const y0 = this.topY, F = o => (this.fg.add(o), o.setDepth(50));
    this.hudBadge = F(this.add.image(18, y0 + 12, this.wp.texture.key).setScale(0.62));
    this.hudEnh = F(this.add.text(36, y0 + 11, '+20', font(16, '#ffd75e')).setOrigin(0, 0.5)); this.hudEnh.isBtnLabel = true;
    this.hudGear = GEAR_ICONS.map((k, i) => F(this.add.image(12 + i * 15, y0 + 34, k).setTint(MAXC).setScale(0.95)));
    this.hudSkill = SKILL_ICONS.map((ic, i) => F(icon(this, 12 + i * 17, y0 + 52, ic, 15)));
    this.hudCap = F(this.add.text(8, y0 + 64, t('prologue.maxAll'), font9(9, '#ffe9a0')).setOrigin(0, 0)); this.hudCap.isBtnLabel = true;
    this.hudKill = F(this.add.text(W - 8, y0 + 36, t('prologue.kills', { n: 0 }), font(11, '#ffffff', 3)).setOrigin(1, 0.5)); this.hudKill.isBtnLabel = true;
    this.hudKill.setScrollFactor(0);
  }
  hideHud() { for (const o of [this.hudBadge, this.hudEnh, this.hudCap, ...this.hudGear, ...this.hudSkill]) this.tweens.add({ targets: o, alpha: 0, duration: 400 }); }

  // ── 몹 ──
  spawnMob() {
    const side = RND(0, 3), kind = MOBS15[RND(0, 2)];
    const x = side === 0 ? -16 : side === 1 ? W + 16 : RND(-10, W + 10), y = side === 2 ? -16 : side === 3 ? H + 16 : RND(0, H);
    const sheet = { anvilimp: 'z15_r0s', flamegiant: 'z15_r1s', starskull: 'z15_r2s' }[kind];
    if (!this.textures.exists(sheet)) return;
    const s = this.add.sprite(x, y, sheet).setOrigin(0.5, 0.8).setScale(kind === 'flamegiant' ? 1.25 : 1);
    if (this.anims.exists(kind)) s.play(kind);
    s.spd = RND(48, 85) * (kind === 'flamegiant' ? 0.6 : 1); s.kind = kind; this.mobs.push(s); this.fg.add(s);
  }
  killMob(m, quiet) {
    const i = this.mobs.indexOf(m); if (i < 0) return;
    this.mobs.splice(i, 1); this.kills++;
    if (!quiet) {
      if (this.anims.exists('fxHit')) { const fx = this.add.sprite(m.x, m.y - 8, 'fx1_r1s').setDepth(15).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD).play('fxHit'); fx.once('animationcomplete', () => fx.destroy()); }
      if (this.kills % 3 === 0) this.dmgText(m.x, m.y - 14, String(RND(2, 9) * 1000 + RND(0, 999)), '#ffe9a0', 11);
      if (this.kills % 2 === 0) sfx('kill', 70);
    }
    m.setDepth(6).setTint(0xffffff);
    this.tweens.add({ targets: m, alpha: 0, scale: 0.2, y: m.y - 10, duration: quiet ? 200 : 140, onComplete: () => m.destroy() });
  }
  dmgText(x, y, str, col, size) {
    if ((this.dmgN | 0) > 14) return;
    this.dmgN = (this.dmgN | 0) + 1;
    const tx = this.add.text(x, y, str, font(size, col, 3)).setOrigin(0.5).setDepth(40); tx.isBtnLabel = true; this.fg.add(tx);
    this.tweens.add({ targets: tx, y: y - 22, alpha: 0, duration: 520, onComplete: () => { this.dmgN--; tx.destroy(); } });
  }

  // 궁극기: 화면 전체 쓸어버림
  ult() {
    if (this.skipped) return;
    sfx('ult'); this.spawnOn = false;
    this.cameras.main.flash(260, 255, 230, 160); this.cameras.main.shake(500, 0.012);
    const sp = this.add.sprite(this.HX, this.HY - 24, 'fx2_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(32).setTint(0xffd070).setScale(7).play('fxSpin');
    sp.once('animationcomplete', () => sp.destroy()); this.fg.add(sp);
    const ring = this.add.image(this.HX, this.HY - 24, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(MAXC).setScale(0.3).setDepth(31);
    this.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    [...this.mobs].forEach((m, i) => this.time.delayedCall(i * 8, () => m.active && this.killMob(m, i % 2)));
    this.dmgText(this.HX, this.HY - 90, '99,999', '#ff9a5a', 22);
  }

  // ── 보스 등장 ──
  bossIn() {
    if (this.skipped) return;
    this.phase = 'boss'; this.spawnOn = false;
    sfx('warn'); this.time.delayedCall(450, () => sfx('boom'));
    this.cameras.main.shake(2600, 0.007);
    this.tweens.add({ targets: this.red, alpha: 0.22, duration: 400, yoyo: true, repeat: 5 });
    const w = this.add.text(W / 2, this.HY - 150, t('prologue.warn'), font(15, '#ff6a5a', 4)).setOrigin(0.5).setDepth(60).setAlpha(0); w.isBtnLabel = true; this.fg.add(w);
    this.tweens.add({ targets: w, alpha: 1, duration: 300, yoyo: true, hold: 1500, onComplete: () => w.destroy() });
        const fy = this.HY - 34; this.bossFeet = fy;
    this.bossShadow = this.add.ellipse(W / 2, fy + 2, 280, 44, 0x000000, 0.55).setDepth(6).setAlpha(0); this.fg.add(this.bossShadow);
    this.bossAura = this.add.image(W / 2, fy - 150, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3010).setScale(6.5).setDepth(6.5).setAlpha(0); this.fg.add(this.bossAura);
    this.boss = this.add.sprite(W / 2, -330, 'pro_boss', 0).setOrigin(0.5, 1).setScale(1.7).setDepth(7); this.fg.add(this.boss);
    this.boss.preFX?.addGlow(0xff2a10, 3, 0, false, 0.1, 10);
    this.tweens.add({ targets: this.boss, y: fy, duration: 2600, ease: 'Quad.In', onComplete: () => { sfx('boom'); this.cameras.main.shake(400, 0.02); this.tweens.add({ targets: [this.bossShadow, this.bossAura], alpha: { from: 0, to: 0.6 }, duration: 400 }); this.tweens.add({ targets: this.bossAura, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 }); this.bossBar(); this.phase = 'bossHit'; } });
    this.tweens.add({ targets: this.bossShadow, alpha: 0.55, duration: 2600 });
  }
  bossBar() {
    const y = this.topY + 96, F = o => (this.fg.add(o), o.setDepth(55));
    F(this.add.rectangle(W / 2, y, 236, 14, 0x0a0710, 0.9).setStrokeStyle(1, 0xff6a5a));
    this.bar = F(this.add.rectangle(W / 2 - 116, y, 232, 10, 0xe8343a).setOrigin(0, 0.5));
    const n = F(this.add.text(W / 2, y - 14, '???', font(12, '#ffd0c0', 3)).setOrigin(0.5)); n.isBtnLabel = true;
    const v = F(this.add.text(W / 2, y, '???', font(9, '#ffffff', 3)).setOrigin(0.5)); v.isBtnLabel = true;
    this.tweens.add({ targets: [n, v], alpha: 0.4, duration: 260, yoyo: true, repeat: -1 });
  }
  // 거의 안 들어가는 피해: 숫자 1, 막대는 눈에 안 띄게 깎인다
  bossDmg() {
    if (!this.boss?.active || this.phase !== 'bossHit') return;
    this.dmgText(RND(70, 200), this.bossFeet - RND(20, 120), '1', '#aaa4b8', 10);
    sfx('hit', 90, 0.6);
    if (this.bar) this.bar.width = Math.max(228, this.bar.width - 0.4);
    this.boss.setTint(0xffbbbb); this.time.delayedCall(60, () => this.boss?.active && this.boss.clearTint());
  }
  telegraph() {
    if (this.skipped) return;
    this.phase = 'telegraph'; sfx('warn');
    this.zone = this.add.ellipse(this.HX, this.HY - 6, 30, 12, 0xff2020, 0.45).setDepth(7.2); this.fg.add(this.zone);
    this.tweens.add({ targets: this.zone, scaleX: 5, scaleY: 5, duration: 1100 });
    this.boss.setFrame(1);
    this.tweens.add({ targets: this.boss, scale: 1.98, y: this.bossFeet - 50, duration: 1100, ease: 'Sine.Out' });
    this.tweens.add({ targets: this.bossAura, alpha: 0.7, duration: 1100 });
  }
  slam() {
    if (this.skipped) return;
    this.phase = 'slam';
    this.boss.setFrame(2);
    this.tweens.add({ targets: this.boss, scale: 1.62, y: this.bossFeet + 70, duration: 130, ease: 'Expo.In', onComplete: () => {
      sfx('boom'); sfx('hurt');
      this.cameras.main.flash(300, 255, 255, 255); this.cameras.main.shake(700, 0.035);
      const ring = this.add.image(this.HX, this.HY - 6, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5030).setScale(0.3, 0.14).setDepth(31);
      this.tweens.add({ targets: ring, scaleX: 8, scaleY: 3.5, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
      // 주인공이 날아가고 무기는 손에서 떨어져 나간다
      this.dead = true; this.hero.stop().setTexture('pro_hero_down', 0).setScale(1.15).setTint(0xffaaaa);
      this.tweens.add({ targets: this.hero, x: this.HX - 40, y: this.HY + 36, duration: 380, ease: 'Quad.Out' });
      this.tweens.add({ targets: this.wp, x: this.HX + 90, y: this.HY - 90, angle: 700, duration: 700, alpha: 0.0 });
      if (this.pet) this.tweens.add({ targets: [this.pet, this.petRing], alpha: 0.2, duration: 400 });
      [...this.mobs].forEach(m => this.killMob(m, true));
    } });
    this.tweens.add({ targets: this.zone, alpha: 0, duration: 200 });
  }

  // ── 무기 부서짐: +20 → +0 ──
  breakWeapon() {
    if (this.skipped) return;
    this.phase = 'break'; this.hideHud();
    if (this.bar) this.bar.setVisible(false);
    const F = o => (this.fg.add(o), o.setDepth(120));
    const cx = W / 2, cy = Math.round(H * 0.42);
    const back = F(this.add.rectangle(0, 0, W, H, 0x05030a, 1).setOrigin(0).setAlpha(0)); this.tweens.add({ targets: back, alpha: 0.85, duration: 350 });
    const glow = F(this.add.image(cx, cy, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(MAXC).setScale(5).setAlpha(0));
    const sw = F(this.add.image(cx, cy, this.wp.texture.key).setScale(0.5).setAlpha(0)); sw.preFX?.addGlow(MAXC, 5, 0, false, 0.1, 10);
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
    this.fg.destroy(true); this.fg = this.add.group(); this.mobs = [];
    this.red.setAlpha(0); this.cameras.main.resetFX();
    this.pet = null; this.petRing = null; this.wp = null; this.boss = null;
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
    if (!this.replay) { this.sv.prologue = 1; save(); }
    track(this.skipped ? 'prologue_skip' : 'prologue_done', { at: Math.round(this.T) });
    const x = W / 2, y = Math.round(H * 0.42), c = this.add.container(0, 0).setDepth(250);
    const ph = 168; c.add(panel(this, 18, y - ph / 2, W - 36, ph, { fill: 0x111923, line: 0xffb85c, alpha: 0.97 }));
    const title = this.add.text(x, y - ph / 2 + 22, t('prologue.goalTitle'), font(15, '#ffd75e', 4)).setOrigin(0.5); title.isBtnLabel = true; c.add(title);
    const lines = [t('prologue.goal1', { name: BOSSES[PROLOGUE_BOSS].name }), t('prologue.goal2')];
    lines.forEach((s, i) => {
      const o = this.add.text(30, y - ph / 2 + 44 + i * 34, '', font9(11, '#ffffff')).setLineSpacing(3); o.isBtnLabel = true;
      for (let sz = 11; sz >= 7; sz -= 0.5) { o.setFontSize(sz); o.setText(wrapTo(o, '- ' + s, W - 36 - 24)); if (o.height <= 32) break; }
      c.add(o);
    });
    const b = button(this, x, y + ph / 2 - 24, W - 72, 30, t('prologue.go'), () => this.finish(), { color: 0x2f6b3a, size: 12 });
    c.add(b);
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 400 });
    sfx('buy');
  }
  finish() {
    if (this.done) return; this.done = true;
    if (this.replay) return this.scene.start('Lobby');
    this.scene.start('Battle', { chapter: 0, stage: 0 });   // 낡은 검 +0으로 1-1(이동·자동 공격 안내는 전투가 한다)
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
    const d = Math.min(delta, 50) / 1000;
    this.T += d;
    for (let i = this.sched.length - 1; i >= 0; i--) if (this.T >= this.sched[i].t) { const s = this.sched.splice(i, 1)[0]; s.fn(); }
    if (this.phase === 'cut' || this.phase === 'goal') return;
    this.placeWeapon();
    if (this.hudKill && this.hudKill.active && this.hudKill._k !== this.kills) { this.hudKill._k = this.kills; this.hudKill.setText(t('prologue.kills', { n: this.kills })); }
    const live = this.phase === 'fight' || this.phase === 'boss' || this.phase === 'bossHit';
    // 몹 생성·이동
    if (this.spawnOn && this.mobs.length < 90) { this.spawnAcc = (this.spawnAcc || 0) + d * 20; while (this.spawnAcc >= 1) { this.spawnAcc--; this.spawnMob(); } }
    const hx = this.HX, hy = this.HY - 22;
    // 무기·스킬: 도는 단검 6개(+작은 구슬 4개)가 몹을 벤다
    this.orbit += d * 3.4;
    const pts = [];
    if (live && !this.dead) {
      this.orbs ||= [...Array(6)].map(() => this.fg.add(this.add.image(0, 0, 'dagger').setScale(2).setDepth(12).setTint(0xffe9a0)).getLast?.(true) || null);
      if (!this.orbs[0]) this.orbs = [...Array(6)].map(() => { const s = this.add.image(0, 0, 'dagger').setScale(2).setDepth(12).setTint(0xffe9a0); this.fg.add(s); return s; });
      this.orbs2 ||= [...Array(4)].map(() => { const s = this.add.image(0, 0, 'orb').setScale(1.6).setDepth(12).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ad8ff); this.fg.add(s); return s; });
      this.orbs.forEach((s, i) => { const a = this.orbit + i * 1.047; s.setPosition(hx + Math.cos(a) * 48, hy + Math.sin(a) * 36).setRotation(a + 1.57); pts.push([s.x, s.y]); });
      this.orbs2.forEach((s, i) => { const a = -this.orbit * 0.7 + i * 1.571; s.setPosition(hx + Math.cos(a) * 76, hy + Math.sin(a) * 58); pts.push([s.x, s.y]); });
      // 검기·불꽃 파동: 0.7초마다 사방으로
      this.waveT = (this.waveT || 0) + d;
      if (this.waveT > 0.7) { this.waveT = 0; sfx('zap', 200); for (let i = 0; i < 8; i++) { const a = i * 0.785 + RF(0, 0.3), w = this.add.image(hx, hy, 'wave').setScale(2).setDepth(11).setTint(0xffa860).setRotation(a); w.vx = Math.cos(a) * 210; w.vy = Math.sin(a) * 210; w.life = 1.1; this.waves.push(w); this.fg.add(w); } }
      // 펫 번개
      this.petT = (this.petT || 0) + d;
      if (this.pet && this.petT > 0.5) { this.petT = 0; const tg = this.mobs[RND(0, Math.max(0, this.mobs.length - 1))]; if (tg) this.bolt(this.pet.x, this.pet.y - 10, tg.x, tg.y - 8, tg); }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.x += w.vx * d; w.y += w.vy * d; w.life -= d;
      if (w.life <= 0) { w.destroy(); this.waves.splice(i, 1); continue; }
      for (const m of [...this.mobs]) if (Math.abs(m.x - w.x) < 14 && Math.abs(m.y - w.y) < 16) this.killMob(m);
    }
    for (const m of [...this.mobs]) {
      const dx = hx - m.x, dy = hy - m.y, L = Math.hypot(dx, dy) || 1;
      if (L > 30) { m.x += dx / L * m.spd * d; m.y += dy / L * m.spd * d; } m.setFlipX(dx < 0).setDepth(6 + m.y / 1000);
      for (const p of pts) if (Math.abs(m.x - p[0]) < 11 && Math.abs(m.y - p[1]) < 12) { this.killMob(m); break; }
    }
    // 펫: 주인공 뒤를 따라다닌다
    if (this.pet?.active && !this.dead) { this.pet.setPosition(hx - 46 + Math.sin(this.T * 3) * 4, this.HY - 14 + Math.cos(this.T * 4) * 3).setDepth(9); this.petRing.setPosition(this.pet.x, this.pet.y + 18); }
    // 보스: 서서히 흔들린다
    if (this.boss?.active && this.phase === 'bossHit') { this.boss.x = W / 2 + Math.sin(this.T * 5) * 1.5; this.bossHitT = (this.bossHitT || 0) + d; if (this.bossHitT > 0.22) { this.bossHitT = 0; this.bossDmg(); } }
    if (this.dead && this.phase === 'slam') this.orbs?.forEach(s => s.active && s.setAlpha(Math.max(0, s.alpha - d * 4)));
  }
  bolt(x1, y1, x2, y2, tg) {
    const g = this.add.graphics().setDepth(14).setBlendMode(Phaser.BlendModes.ADD); this.fg.add(g);
    g.lineStyle(2, 0xc8c0ff, 1).beginPath().moveTo(x1, y1);
    const n = 4; for (let i = 1; i < n; i++) g.lineTo(x1 + (x2 - x1) * i / n + RND(-8, 8), y1 + (y2 - y1) * i / n + RND(-8, 8));
    g.lineTo(x2, y2).strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
    this.killMob(tg);
  }
}
