// 전투: 웨이브 생존, 자동 공격 스킬, 레벨업 3택, 웨이브 사이 상점, 궁극기, 보스
import * as D from './data.js';
import { load, save, mission } from './save.js';
import { sfx, playBgm, stopBgm } from './sfx.js';
import { font, font9, panel, button, icon, skillIcon, fmt, COLOR, hiCam, viewRect, PX, toast, skinFx } from './ui.js';
import { Weapons } from './weapons.js';
import { BossAI } from './boss.js';
import { Overlay } from './overlay.js';
import { gearStats, wMul, spReq, wtypeOf, dropItem, makeItem, grantEgg, eggsSettled, RARITY, equipped, itemScore, PETS, PET_GOOD_DEF, recPets, heroSkin } from './gear.js';
import { Pet } from './pets.js';
import { track, logCtx } from './log.js';
import { dexKill } from './codex.js';

const { W, H } = D;
const WORLD = 1600;
const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.c = data.chapter; this.s = data.stage;
    this.ch = D.CHAPTERS[this.c];
    this.endless = !!data.endless;
    this.hard = !!data.hard && !this.endless;           // 어려움: 같은 판을 센 몹으로
    this.dungeon = data.dungeon || null;                // 일일 던전 종류(gold·stone·gear·gem)
    this.isBoss = !this.endless && !this.dungeon && this.s === D.STAGES_PER_CHAPTER - 1;
    this.sv = load();
    const q = new URLSearchParams(location.search);
    this.bot = !!data.bot || q.has('bot');
    this.speed = +(q.get('speed') || 1);   // 자동 검증용 배속
  }

  // 행동 로그(자동 검증 봇은 남기지 않는다)
  log(name, p = {}) { if (!this.bot) track(name, { t: Math.round(this.bt / 1000), lv: this.run?.lv, hp_pct: this.maxHp ? Math.round(this.hp / this.maxHp * 100) : undefined, ...p }); }
  // 가장 많이 때린 것(죽은 원인)
  topHit() { const e = Object.entries(this.run.dmgBy || {}).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : 'none'; }

  // 훈련 + 장비·스탯 효과(영구). 받는 피해 감소는 60%에서 멈춘다
  tv(id) {
    const t = D.TRAINING.find(x => x.id === id), v = D.trainVal(t, this.sv.train[id] || 0) + (this.gear?.[id] || 0);
    return id === 'def' ? Math.min(0.6, v) : v;
  }

  create() {
    const sv = this.sv;
    this.bt = 0;                        // 전투 시간(멈춘 동안은 안 흐름, ms)
    this.paused = false; this.hitstop = 0; this.over = false; this.mv = null; this.formT = 0;
    // 씬을 다시 쓰므로 콤보도 판마다 비운다(앞 판 처치 시각이 남아 다음 판 콤보가 424까지 이어졌다)
    this.combo = 0; this.lastKillT = -1e9;
    // 장면 인스턴스는 판끼리 재사용된다: 이벤트·축복·던전 고블린 상태를 비운다
    this.eventDone = false; this.shrine = null; this.buffUntil = 0; this.buffTxt = null; this.dunGobT = null;
    this.run = {
      lv: 1, xp: 0, silver: 0, kills: 0, mana: 0, stones: 0, chests: 0,
      skills: { sword: 1 }, evo: {}, freeReroll: 1, shopRound: 0,
      // 판 안에서 산 강화
      bDmg: 0, bSpd: 0, bHp: 0, bPick: 0,
      revive: sv.train.revive ? 1 : 0, lastHeal: 0, dmgBy: {},
    };
    // 비급: 산 스킬 한 권을 판 시작부터 들고 들어간다
    if (sv.book && sv.books?.[sv.book]) this.run.skills[sv.book] = D.BOOK_LV;
    // 장비·세트·스탯, 무기 종류. 든 무기가 따르는 스탯만 피해를 올린다
    this.gear = gearStats(sv);
    this.wtype = wtypeOf(sv);
    this.wM = wMul(sv);
    this.run.loot = []; eggsSettled();
    this.wave = 0;
    this.waveLen = this.endless ? D.ENDLESS.floorSec * 1000 : this.dungeon ? D.DUNGEON.sec * 1000 : this.ch.dur * 1000 / D.WAVES;
    this.waveCount = this.endless ? Infinity : this.dungeon ? 1 : this.isBoss ? D.WAVES - 1 : D.WAVES;
    this.waveT = 0;
    this.mobDmgMul = D.chapterDmg(this.c) * D.stageDmg(this.s) * (this.endless ? 1 : D.easeDmg(this.c, this.s)) * (1 - this.tv('def')) * (!this.endless && this.c >= 2 ? D.LATE_DMG : 1);   // 3장부터는 맞는 펫(받는 피해 -20%) 없이는 버겁게
    if (this.hard) this.mobDmgMul = D.hardDmg(this.c, this.s) * (1 - this.tv('def'));
    // 처음 두 판의 1-1은 맞는 피해를 줄이고 시작 몹도 적게(조작을 익히는 동안 지지 않게)
    this.easy = this.sv.stats.runs < 2 && this.c === 0 && this.s === 0 && !this.endless && !this.hard && !this.dungeon;
    if (this.easy) { this.mobDmgMul *= 0.55; this.waveCount = 2; this.waveLen *= 0.8; }   // 처음 판은 웨이브 둘에 짧게(150초 → 80초): 첫 클리어까지 오래 걸리면 떠났다
    this.mobHpMul = D.chapterHp(this.c) * D.stageMul(this.s) * (this.endless ? 1 : D.easeHp(this.c, this.s)) * spReq(this.endless ? sv.cleared : this.c * D.STAGES_PER_CHAPTER + this.s);
    if (this.hard) this.mobHpMul = D.hardHp(this.c, this.s);
    // 던전은 많이 잡는 판: 몹이 약하고 조금 덜 아프다
    if (this.dungeon) { this.mobHpMul *= D.DUNGEON.hp; this.mobDmgMul *= 0.8; }

    this.makeMap();
    this.makeHero();
    this.makeFx();

    this.mobs = this.physics.add.group();
    this.gems = this.physics.add.group();
    this.items = this.physics.add.group();
    this.ebullets = this.physics.add.group();
    this.pbullets = this.physics.add.group();
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.physics.add.collider(this.mobs, this.mobs, null, (a, b) => !a.float && !b.float && !a.dead && !b.dead);
    this.physics.add.overlap(this.hero, this.mobs, (h, m) => !m.dead && !m.goblin && this.hurt(m.dmg, (m.elite ? 'elite_' : '') + m.kind));
    this.physics.add.overlap(this.hero, this.ebullets, (h, b) => { this.hurt(b.dmg, 'shot'); b.destroy(); });

    // 왼쪽 위 기준 카메라라 주인공이 가운데 오도록 반 화면만큼 밀고, 경계도 그만큼 옮긴다(clampX는 가운데 기준 계산)
    hiCam(this).startFollow(this.hero, true, 1, 1).setFollowOffset(W / 2, H / 2).setBounds(W / 2, H / 2, WORLD, WORLD).setRoundPixels(true);
    // 화면 흔들림: 공격·피격마다 흔들려 머리가 아팠다. 작은 흔들림은 없애고 큰 것(보스·엘리트)만 약하고 짧게
    const cam = this.cameras.main, shake = Phaser.Cameras.Scene2D.Camera.prototype.shake;
    cam.shake = (d, i = 0.005, ...r) => i <= 0.005 ? cam : shake.call(cam, Math.min(d, 250), i * 0.4, ...r);
    this.weapons = new Weapons(this);
    this.boss = null;
    this.ui = new Overlay(this);
    this.petShield = false;
    this.pet = new Pet(this);
    this.makeHud();
    this.makeJoystick();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE');
    this.keys.SPACE.on('down', () => this.ult());

    // 애니메이션 관리자는 판끼리 공유된다: 지난 판이 멈춤(히트스톱·보스 처치) 중에 끝났으면 멈춘 채 넘어와
    // 첫 베기 궤적이 끝나지 않고 잔상으로 남는다 → 판을 시작할 때 늘 풀어 준다
    this.anims.resumeAll(); this.anims.globalTimeScale = 1;
    if (this.speed !== 1) {
      this.physics.world.timeScale = 1 / this.speed; this.time.timeScale = this.speed;
      this.tweens.timeScale = this.speed; this.anims.globalTimeScale = this.speed;
    }
    // 판 규칙(처음 두 판·보스·무한의 탑 제외)
    // x-2 첫 도전은 그 장의 규칙이 정해져 나오고, 다시 할 땐 뽑는다
    const firstTry = !this.endless && this.c * D.STAGES_PER_CHAPTER + this.s >= (this.hard ? sv.hardCleared : sv.cleared);
    this.mod = this.easy || this.isBoss || this.endless || this.dungeon ? null : this.s === 1 && firstTry ? D.stageMod(this.c)
      : sv.stats.runs >= 2 && Math.random() < D.RUN_MOD_CHANCE ? Phaser.Utils.Array.GetRandom(D.RUN_MODS.filter(m => m.id !== 'mutant' || D.stageVariant(this.c, this.s))) : null;   // 변종이 없는 판엔 '변종 소굴'은 빼고 뽑는다
    this.hordeKind = this.mod?.id === 'horde' ? this.ch.mobs[R(0, 2)] : null;
    // 깜짝 이벤트: 보스·무한의 탑·처음 판·던전이 아니면 판 중간에 하나(보물 고블린·황금 박쥐 떼·축복의 제단)
    this.eventAt = !this.easy && !this.isBoss && !this.endless && !this.dungeon && Math.random() < D.EVENTS.chance ? RF(0.3, 0.7) : null;
    this.eventKind = Phaser.Utils.Array.GetRandom(D.EVENTS.kinds);
    // 시작부터 화면이 차 있어야 첫 10초가 심심하지 않다
    for (let i = 0; i < (this.easy ? 18 : 40); i++) this.spawn(true);
    if (!this.bot) playBgm('battle', this.c);
    this.events.once('shutdown', stopBgm);
    // 앱을 내리거나 화면이 꺼지면 일시정지 창을 띄워 둔다(돌아왔을 때 이미 맞고 있지 않게)
    const onHide = () => { if (!this.over && !this.paused && !this.bot) this.ui.pauseMenu(); };
    this.game.events.on('hidden', onHide); this.events.once('shutdown', () => this.game.events.off('hidden', onHide));
    if (sv.stats.runs < 2 && !this.bot) this.dragHint();
    if (this.endless) this.banner('무한의 탑', `1층  ·  최고 ${sv.endBest}층`);
    else if (this.dungeon) this.banner(`일일 던전 · ${D.DUN_TYPES[this.dungeon].name}`, `${D.DUNGEON.sec}초 안에 ${D.DUNGEON.killNeed}마리를 잡아라`);
    else if (this.hard) this.banner(`어려움 ${this.c + 1}-${this.s + 1}  ${this.ch.name}`, this.isBoss ? '보스 스테이지' : `웨이브 1 / ${this.waveCount}  ·  몹이 훨씬 세다`);
    else this.banner(`${this.c + 1}-${this.s + 1}  ${this.ch.name}`, this.isBoss ? '보스 스테이지' : `웨이브 1 / ${this.waveCount}  ·  ${this.s === 1 ? '깨면 다음은 보스!' : '2판 깨면 보스'}`);
    // 펫 상성: 잘 듣는 펫이면 알려 주고, 없으면 이 장에 맞는 펫을 알려 준다(가진 것만)
    if (!this.endless && !this.dungeon) {
      const pf = this.pet.def && this.pet.fit, rs = recPets(this.sv, this.c).filter(p => this.sv.cleared >= p.unlock).map(p => p.name).join(' / ');
      const msg = pf > 1 ? [`펫 상성 좋음! 효과 ×1.8${this.pet.def.tank ? ' · 받는 피해 -20%' : ''}`, '#5fdc6a'] : pf < 1 ? [`${this.pet.def.name}은 이 맵에서 약하다${rs ? ` · 추천 ${rs}` : ''}`, '#ff9070'] : rs ? [`이 맵 추천 펫: ${rs}`, '#ffd75e'] : null;
      if (msg) this.time.delayedCall(2600, () => !this.over && toast(this, msg[0], msg[1], 96));
    }
    if (this.mod) this.time.delayedCall(4200, () => !this.over && this.banner(`이번 판: ${this.mod.id === 'horde' ? D.MOB_NAMES[this.hordeKind] + ' ' : ''}${this.mod.name}`, this.mod.desc));
    // 이번 스테이지에 처음 나오는 변종을 알려 준다
    const nv = !this.endless && !this.isBoss && !this.dungeon && !this.hard && D.stageVariant(this.c, this.s);
    if (nv) this.time.delayedCall(1900, () => !this.over && this.banner(`새 몬스터: ${D.VARIANTS[nv[1]].pre} ${D.MOB_NAMES[this.ch.mobs[nv[0]]]}`, D.VARIANTS[nv[1]].desc));
    sv.stats.runs++; save();
    logCtx({ stage: this.endless ? 'tower' : this.dungeon ? 'dungeon' : `${this.hard ? 'H' : ''}${this.c + 1}-${this.s + 1}`, idx: this.endless || this.dungeon ? -1 : this.c * D.STAGES_PER_CHAPTER + this.s });
    this.log('battle_start', { power: D.powerOf(sv), rec: this.endless || this.dungeon ? undefined : D.recOf(this.c, this.s, this.hard), hard: this.hard, dungeon: this.dungeon || 'none', tier: sv.tier, enh: sv.enh, mod: this.mod?.id || 'none', easy: this.easy, runs: sv.stats.runs, replay: !this.endless && this.c * D.STAGES_PER_CHAPTER + this.s < sv.cleared, boss_stage: this.isBoss });
  }

  // ── 지도 ──
  makeMap() {
    const key = this.textures.exists(this.ch.tiles) ? this.ch.tiles : 'tiles';
    const tintless = key === this.ch.tiles;
    const ts = this.textures.get(key).getSourceImage();
    const T = ts.width / 4;
    if (!this.textures.exists(key + '_t')) this.textures.addSpriteSheet(key + '_t', ts, { frameWidth: T, frameHeight: T });
    const rt = this.add.renderTexture(0, 0, WORLD, WORLD).setOrigin(0).setDepth(-10);
    const stamp = this.make.image({ key: key + '_t', add: false });
    const c = WORLD / 2;
    // 가운데 광장·길 안쪽으로 들어간 거리(밖이면 음수)
    const inside = (x, y) => Math.max(190 - Math.hypot(x - c, y - c), 50 - Math.abs(x - c), 50 - Math.abs(y - c));
    // 바깥 바닥을 전부 깔고, 광장 바닥은 경계에서 서서히 짙어지게 겹친다(경계 타일을 쓰면 계단식 사각 패치로 보였다)
    for (let y = 0; y < WORLD; y += T) for (let x = 0; x < WORLD; x += T) {
      const n = Math.random(), cx = x + T / 2, cy = y + T / 2;
      // 3번 그림(밝은 변종)은 3장부터 색을 입히면 사각으로 튄다
      stamp.setFrame(n < 0.85 || this.c >= 2 ? Phaser.Math.RND.pick([0, 2]) : 3).setAngle(R(0, 3) * 90).setAlpha(1);
      rt.draw(stamp, cx, cy);
      const a = Phaser.Math.Clamp((inside(cx, cy) + T * 0.8) / (T * 2.4), 0, 1);
      if (a <= 0) continue;
      stamp.setFrame(Math.random() < 0.85 ? R(4, 5) : R(8, 9)).setAngle(R(0, 3) * 90).setAlpha(a * a);
      rt.draw(stamp, cx, cy);
    }
    stamp.setAlpha(1);
    // 전용 바닥 그림이 없는 챕터는 1챕터 바닥에 색을 입힌다
    const TINT = [0xffffff, 0x8a9ab8, 0xd07050, 0xd8f0ff, 0x9a70b0];
    if (this.hard) rt.setTint(0xd87a7a);   // 어려움은 바닥이 붉게 물든다
    else if (!tintless && this.c > 0) rt.setTint(TINT[this.c]);
    else if (this.s === 1 && !this.endless) rt.setTint(0xb8c0dc);   // x-2는 바닥을 식혀 x-1과 다른 곳처럼
    if (!this.textures.exists('decos')) {
      const ds = this.textures.get('deco').getSourceImage();
      this.textures.addSpriteSheet('decos', ds, { frameWidth: ds.width / 4, frameHeight: ds.height });
    }
    this.torches = [];
    for (let i = 0; i < 90; i++) {
      const x = R(0, WORLD), y = R(0, WORLD);
      if (Math.hypot(x - c, y - c) < 220) continue;
      this.add.image(x, y, 'decos', R(0, 2)).setOrigin(0.5, 1).setDepth(10 + y / WORLD).setTint(this.c ? TINT[this.c] : 0xffffff);
    }
    for (let a = 0; a < 8; a++) {
      const x = c + Math.cos(a * Math.PI / 4) * 200, y = c + Math.sin(a * Math.PI / 4) * 200;
      this.add.image(x, y, 'decos', 3).setOrigin(0.5, 1).setDepth(10 + y / WORLD);
      this.torches.push({ x, y: y - 40 });
    }
    // 어두운 화면 + 빛
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(50);
    // x-2는 조금 더 어둡다. 0.2를 더하면 2장·5장이 0.8이 돼 몹이 안 보였다
    this.darkA = Math.min(0.62, this.ch.dark + (this.s === 1 && !this.endless ? 0.1 : 0));
    this.glow = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(this.hard ? 0xff3a3a : this.ch.light).setAlpha(this.hard ? 0.22 : 0.16).setDepth(49);
  }

  makeHero() {
    const sv = this.sv;
    this.maxHp = D.PLAYER.hp * (1 + this.tv('hp')) * (1 + 0.15 * this.sv.tier);   // 무기 등급이 오르면 체력도 오른다(tv('hp')에 장비·스탯 체력도 들어 있다)
    this.hp = this.maxHp;
    this.hero = this.physics.add.sprite(WORLD / 2, WORLD / 2, 'hero2_r0s').play('idle');
    this.hero.body.setSize(this.hero.width * 0.45, this.hero.height * 0.35).setOffset(this.hero.width * 0.275, this.hero.height * 0.6);
    this.hero.setCollideWorldBounds(true);
    this.heroShadow = this.add.image(0, 0, 'shadow').setScale(1.6, 1.4);
    // 몹 떼 속에서도 내 캐릭터가 바로 보이게 발밑에 밝은 고리
    // 고리 색은 강화 단계를 따른다(+5 파랑, +10 주황, +15 보라). +10부터는 몸에도 빛이 돈다
    const rc = sv.enh >= 15 ? 0xd06bff : sv.enh >= 10 ? 0xff8a2a : sv.enh >= 5 ? 0x5fc8ff : 0x9ae6ff;
    this.heroRing = this.add.ellipse(0, 0, 24, 10, rc, 0.18).setStrokeStyle(2, rc, 1).setDepth(11.5);
    // 몹 더미에 몸이 가려도 머리 위 작은 화살표로 어디 있는지 보인다
    this.heroMark = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 5, rc).setStrokeStyle(1, 0x000000, 0.6).setDepth(12);
    // 영웅 스킨: 몸 색을 바꾼다
    if (heroSkin(sv).id) skinFx(this.hero, heroSkin(sv));
    if (sv.enh >= 10) this.hero.preFX?.addGlow(rc, sv.enh >= 15 ? 3 : 2, 0, false, 0.1, 8);
    this.face = 1; this.walkT = 0; this.iframe = 0;
    this.atk = D.weaponAtk(sv.tier, sv.enh);
  }

  makeFx() {
    this.spark = this.add.particles(0, 0, 'px', {
      speed: { min: 40, max: 140 }, lifespan: { min: 150, max: 380 }, scale: { start: 1.5, end: 0 },
      tint: [0xffffff, 0xffe066, 0xff7b3a], emitting: false,
    }).setDepth(30);
    this.dust = this.add.particles(0, 0, 'px', {
      speedX: { min: -14, max: 14 }, speedY: { min: -18, max: -4 }, lifespan: 380, scale: { start: 2, end: 0 },
      alpha: { start: 0.5, end: 0 }, tint: 0xc8bfa8, emitting: false,
    }).setDepth(9);
    this.goo = this.add.particles(0, 0, 'px', {
      speed: { min: 30, max: 110 }, lifespan: 450, scale: { start: 2, end: 0.5 }, gravityY: 200, emitting: false,
    }).setDepth(9);
    this.hurtFx = this.add.rectangle(0, 0, W, H, 0xff2020, 0).setOrigin(0).setScrollFactor(0).setDepth(60);
    this.flashFx = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(61);
    this.popups = [];
  }

  // ── HUD ──
  makeHud() {
    const d = 100, sf = o => o.setScrollFactor(0).setDepth(d);
    sf(this.add.rectangle(0, 0, W, 4, 0x000000, 0.7).setOrigin(0));
    this.xpBar = sf(this.add.rectangle(0, 0, 0, 4, 0x6fd3ff).setOrigin(0));
    sf(panel(this, 4, 7, 104, 20));
    this.add.text(9, 12, 'HP', font(9, '#ff6b6b')).setScrollFactor(0).setDepth(d);
    // 막대를 글자 높이만큼 키워 숫자가 막대 안에 들어가게 한다(8px 막대 위에 10px 글자가 걸쳐 지저분했다)
    sf(this.add.rectangle(26, 10, 76, 14, 0x1c0709).setOrigin(0));
    this.hpLag = sf(this.add.rectangle(26, 10, 76, 14, 0xffffff, 0.5).setOrigin(0));
    this.hpBar = sf(this.add.rectangle(26, 10, 76, 14, 0xe23a44).setOrigin(0));   // 빈 칸은 더 어둡게, 막대는 밝게(남은 체력이 한눈에 안 보였다)
    this.hpTxt = sf(this.add.text(64, 17, '', font(10)).setOrigin(0.5));
    this.lvTxt = sf(this.add.text(8, 31, 'Lv 1', font(10, '#d8d2e8')));
    // 콤보는 가운데 위(오른쪽 숫자 밑에 붙어 처치 수와 헷갈렸다)
    this.comboTxt = sf(this.add.text(W / 2, 72, '', font(12, '#ffb347')).setOrigin(0.5).setAlpha(0));
    this.timeTxt = sf(this.add.text(W / 2, 16, '', font(14)).setOrigin(0.5));
    this.waveTxt = sf(this.add.text(W / 2, 31, '', font(9, '#c8bfe0')).setOrigin(0.5));
    // 처치·은화: 점 아이콘만으로는 무슨 숫자인지 몰랐다. 글자 이름을 붙인다
    sf(this.add.rectangle(W - 88, 7, 62, 34, 0x000000, 0.45).setOrigin(0));
    sf(this.add.text(W - 85, 17, '처치', font9(10, '#a89cc8')).setOrigin(0, 0.5));
    sf(this.add.text(W - 85, 32, '은화', font9(10, '#a89cc8')).setOrigin(0, 0.5));
    this.killTxt = sf(this.add.text(W - 30, 17, '0', font(10, '#ffffff')).setOrigin(1, 0.5));
    this.silverTxt = sf(this.add.text(W - 30, 32, '0', font(10, '#ffffff')).setOrigin(1, 0.5));
    // 일시정지
    const pb = button(this, W - 13, 21, 18, 22, 'II', () => this.ui.pauseMenu(), { size: 9, color: 0x3a3846 });
    pb.setScrollFactor(0).setDepth(d);
    // 보유 스킬 아이콘 줄
    this.skillRow = this.add.container(8, 46).setScrollFactor(0).setDepth(d);
    // 궁극기 버튼(마나)
    const ux = W - 32, uy = H - 40;
    this.ultBase = sf(this.add.circle(ux, uy, 22, 0x15121f, 0.9).setStrokeStyle(2, 0x5b4f7a));
    this.ultFill = sf(this.add.graphics());
    this.ultIcon = sf(icon(this, ux, uy, 4, 22));
    this.ultTxt = sf(this.add.text(ux, uy + 28, '궁극기', font(9, '#c8bfe0')).setOrigin(0.5));
    this.ultBase.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.ult());
    this.ultPos = { x: ux, y: uy };
    this.showUlt = v => [this.ultBase, this.ultFill, this.ultIcon, this.ultTxt].forEach(o => o.setVisible(v));
    this.bossBar = null; this.bannerObjs = null;
    this.refreshSkillRow();
  }

  refreshSkillRow() {
    this.skillRow.removeAll(true);
    Object.entries(this.run.skills).forEach(([k, lv], i) => {
      const x = (i % 8) * 17, y = Math.floor(i / 8) * 17;
      const evo = this.run.evo[k];
      this.skillRow.add(this.add.rectangle(x, y, 15, 15, evo ? 0x5a3a08 : 0x000000, 0.6).setOrigin(0).setStrokeStyle(1, evo ? 0xff9a3a : D.SKILLS[k].type === 'active' ? 0x6fd3ff : 0xffd75e, evo ? 1 : 0.7));
      this.skillRow.add(skillIcon(this, x + 7.5, y + 7.5, D.SKILLS[k], 13));
      this.skillRow.add(this.add.text(x + 15, y + 15, evo ? '★' : lv, font(7, evo ? '#ffd75e' : '#ffffff')).setOrigin(1, 1));
    });
  }

  makeJoystick() {
    this.joy = {
      base: this.add.circle(0, 0, 28, 0xffffff, 0.07).setStrokeStyle(1, 0xffffff, 0.3).setScrollFactor(0).setDepth(99).setVisible(false),
      knob: this.add.circle(0, 0, 11, 0xffffff, 0.3).setScrollFactor(0).setDepth(99).setVisible(false), v: new Phaser.Math.Vector2(),
    };
    this.input.on('pointerdown', (p, over) => {
      if (over.length || this.paused) return;
      // p.x는 그리는 판(PX배) 좌표라 게임 좌표로 나눈다
      const x = p.x / PX, y = p.y / PX;
      this.joy.o = { x, y, id: p.id };
      this.joy.base.setPosition(x, y).setVisible(true); this.joy.knob.setPosition(x, y).setVisible(true);
    });
    this.input.on('pointermove', p => {
      if (!this.joy.o || !p.isDown || p.id !== this.joy.o.id) return;
      const v = new Phaser.Math.Vector2(p.x / PX - this.joy.o.x, p.y / PX - this.joy.o.y).limit(28);
      this.joy.knob.setPosition(this.joy.o.x + v.x, this.joy.o.y + v.y);
      this.joy.v.copy(v).scale(1 / 28);
    });
    const up = p => { if (this.joy.o && p.id !== this.joy.o.id) return; this.joy.o = null; this.joy.v.reset(); this.joy.base.setVisible(false); this.joy.knob.setVisible(false); };
    this.input.on('pointerup', up); this.input.on('pointerupoutside', up);
  }

  banner(big, small) {
    const y = 150;
    // 앞 배너가 아직 떠 있으면 지우고 띄운다(두 줄이 겹쳐 읽을 수 없었다)
    if (this.bannerObjs) this.bannerObjs.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
    const b = this.add.rectangle(W / 2, y, W, 46, 0x000000, 0.35).setScrollFactor(0).setDepth(110).setScale(1, 0);
    const t1 = this.add.text(W / 2, y - 7, big, font(15, '#ffd75e')).setOrigin(0.5).setScrollFactor(0).setDepth(111).setAlpha(0);
    const t2 = this.add.text(W / 2, y + 12, small, font9(11, '#ffffff')).setOrigin(0.5).setScrollFactor(0).setDepth(111).setAlpha(0);
    this.tweens.add({ targets: b, scaleY: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: [t1, t2], alpha: 1, x: { from: W / 2 - 20, to: W / 2 }, duration: 220, delay: 80 });
    this.bannerObjs = [b, t1, t2];
    this.tweens.add({ targets: [b, t1, t2], alpha: 0, delay: 1500, duration: 300, onComplete: () => { [b, t1, t2].forEach(o => o.destroy()); if (this.bannerObjs?.[0] === b) this.bannerObjs = null; } });
  }

  // 처음 두 판: 이동 방법을 3초 보여 준다
  dragHint() {
    const t = this.add.text(W / 2, H - 120, '화면을 누른 채로 끌면 이동', font(12, '#ffffff')).setOrigin(0.5).setScrollFactor(0).setDepth(120);
    const hand = this.add.circle(W / 2 - 30, H - 90, 9, 0xffffff, 0.5).setStrokeStyle(2, 0xffffff).setScrollFactor(0).setDepth(120);
    this.tweens.add({ targets: hand, x: W / 2 + 30, duration: 700, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
    this.hint = [t, hand];
    this.tweens.add({ targets: [t, hand], alpha: 0, delay: 3000, duration: 400, onComplete: () => { t.destroy(); hand.destroy(); this.hint = null; } });
  }

  // ── 스폰 ──
  spawnPoint(min = 200, max = 250) {
    for (let i = 0; i < 8; i++) {
      const a = RF(0, Math.PI * 2), d = RF(min, max);
      const x = this.hero.x + Math.cos(a) * d, y = this.hero.y + Math.sin(a) * d;
      if (x > 20 && y > 20 && x < WORLD - 20 && y < WORLD - 20) return { x, y };
    }
    return { x: Phaser.Math.Clamp(this.hero.x + R(-200, 200), 20, WORLD - 20), y: Phaser.Math.Clamp(this.hero.y + 220, 20, WORLD - 20) };
  }

  // 웨이브 진행도(0~1)에 따라 몬스터 종류 비율이 바뀐다: 초반엔 기본형, 갈수록 단단한 놈과 떼거리
  pickKind() {
    const f = Math.min(1, this.progress()), [a, b, c] = this.ch.mobs;
    const r = Math.random();
    if (this.hordeKind && r < 0.6) return this.hordeKind;
    // 뒤 스테이지일수록 처음부터 단단한 놈·떼거리가 섞인다
    const st = this.endless ? 0 : this.s * 0.03;
    if (r < 0.15 + st + 0.25 * f) return b;
    if (r < 0.35 + 2 * st + 0.3 * f) return c;
    return a;
  }

  // 지속 스킬이 3레벨에 닿으면 붙는 보너스
  lv3(k, v) { return (this.run.skills[k] || 0) >= D.PASSIVE_LV3 ? v : 0; }

  // 결과 창·실패 보상용 진행도. 보스 스테이지는 웨이브를 다 버텨도 70%, 나머지 30%는 보스에게 준 피해
  runProgress() {
    if (!this.isBoss) return this.progress();
    const m = this.boss?.m, hurt = m ? 1 - Math.max(0, m.hp) / m.maxHp : 0;
    return Math.min(1, this.progress() * 0.7 + hurt * 0.3);
  }

  // 무한의 탑은 3층에 걸쳐 1이 되고 그 뒤로도 maxF까지 계속 오른다
  progress() {
    if (this.endless) return Math.min(D.ENDLESS.maxF, (this.wave * this.waveLen + this.waveT) / (3 * this.waveLen));
    return Math.min(1, (this.wave * this.waveLen + this.waveT) / (this.waveCount * this.waveLen)); }

  // 이번 스테이지 변종(과 앞 스테이지 변종)을 일정 비율로 섞는다. 거대 변종은 드물게
  rollVariant() {
    // 무한의 탑: 2층부터 모든 변종이 섞인다
    if (this.endless) {
      if (this.wave < 1 || Math.random() > D.VARIANT_RATE) return null;
      const ks = Object.keys(D.VARIANTS), vk = ks[R(0, ks.length - 1)];
      return vk === 'giant' && Math.random() > 0.35 ? null : { kind: this.pickKind(), v: vk };
    }
    if (this.isBoss) return null;
    let r = Math.random();
    const vm = this.mod?.id === 'mutant' ? 2 : 1;
    for (const [st, rate] of [[this.s, D.VARIANT_RATE * vm], [this.s - 1, D.VARIANT_OLD_RATE * vm]]) {
      const sv = D.stageVariant(this.c, st);
      if (sv && r < rate) return r < rate * (sv[1] === 'giant' ? 0.35 : 1) ? { kind: this.ch.mobs[sv[0]], v: sv[1] } : null;
      r -= rate;
    }
    return null;
  }

  spawn(near = false, kind = null, opt = {}) {
    // 동시 몹 수 상한: 저사양 폰, 그리고 3장부터 30초 만에 100마리가 쌓여 손쓸 틈 없이 포위됐다
    if (this.mobs.countActive() >= 75 && !opt.force) return null;
    let vk = opt.variant;
    if (!kind) { const rv = this.rollVariant(); if (rv) { kind = rv.kind; vk = rv.v; } else kind = this.pickKind(); }
    // 탱커(골렘·설인)는 느리고 단단해 쌓이면 화면을 막는다: 동시에 일정 수를 넘으면 다른 몹으로 바꾼다(보스전은 더 적게)
    if (!opt.force && !vk && D.MOBS[kind].ai === 'tank') {
      const cap = this.boss ? 6 : 12;
      if (this.mobs.getChildren().filter(m => m.active && !m.dead && m.ai === 'tank').length >= cap) {
        for (let i = 0; i < 4 && D.MOBS[kind].ai === 'tank'; i++) kind = this.pickKind();
      }
    }
    const m0 = D.MOBS[kind], v = vk ? D.VARIANTS[vk] : null;
    const p = opt.at || (near ? this.spawnPoint(110, 230) : this.spawnPoint());
    const m = this.mobs.create(p.x, p.y, null);
    m.play({ key: kind, startFrame: R(0, 3) });
    m.kind = kind; m.ai = m0.ai; m.float = m0.ai === 'float'; m.mini = !!opt.mini;
    const elite = !!opt.elite;
    m.elite = elite;
    // 무한의 탑은 층마다 몹이 곱으로 세져 언젠가는 반드시 쓰러진다
    const tower = this.endless ? [Math.pow(D.ENDLESS.hpGrow, this.wave), Math.pow(D.ENDLESS.dmgGrow, this.wave)] : [1, 1];
    m.maxHp = m.hp = m0.hp * this.mobHpMul * D.timeHp(this.progress()) * (elite ? 8 : 1) * tower[0] * (v?.hp || 1) * (opt.mini ? 0.35 : 1) * (this.mod?.hp || 1);
    m.dmg = m0.dmg * this.mobDmgMul * (elite ? 1.2 : 1) * tower[1];
    m.spd = m0.spd * (1 + 0.04 * this.c) * RF(0.9, 1.1) * (v?.spd || 1) * (opt.mini ? 1.2 : 1) * (this.mod?.spd || 1);
    if (v?.ai) m.ai = v.ai;
    m.kbRes = v?.kb ?? (m.ai === 'tank' ? 0.45 : elite ? 0.3 : 1);
    m.variant = opt.mini ? null : vk; m.bs = (elite ? 1.5 : 1) * (v?.scale || 1) * (opt.mini ? 0.65 : 1);
    m.color = m0.color; m.kb = 0; m.slow = 0; m.freeze = 0; m.curse = 0; m.tint0 = undefined; m.phase = RF(0, 6); m.t = 0;
    m.hitBy = {};
    if (this.registry.get('fallback')[kind] && this.c > 0) m.setTint(m0.color);
    if (v) m.setTint(v.tint); else if (m0.tint) m.setTint(m0.tint);
    if (this.dungeon) m.setTint(D.DUN_TYPES[this.dungeon].tint);   // 던전 몹은 요일 색
    if (this.hard) m.bs *= 1.1;
    m.baseTint = m.tintTopLeft;
    m.setScale(m.bs);
    if (elite) {
      m.preFX?.addGlow(0xffd75e, 3, 0, false, 0.1, 8);
    }
    m.body.setSize(m.width * 0.6, m.height * 0.5).setOffset(m.width * 0.2, m.height * 0.45);
    m.setAlpha(m.float ? 0.85 : 1);
    if (!near) { m.setScale(0.2 * m.scaleX); this.tweens.add({ targets: m, scale: m.bs, duration: 200, ease: 'Back.Out' }); }
    // 변종은 색만으로는 구별이 안 된다: 발밑 고리와 머리 위 표식을 붙여 실루엣을 바꾼다
    if (vk && !opt.mini) {
      const col = v.tint, mk = this.add.container(m.x, m.y).setDepth(9);
      mk.add(this.add.ellipse(0, 0, 18 * m.bs, 7 * m.bs).setStrokeStyle(vk === 'armor' || vk === 'giant' ? 2 : 1, col, 0.9).setFillStyle(col, 0.18));
      if (vk === 'burst') { const f = this.add.circle(0, -m.height * m.bs - 2, 2.5, 0xffd040); mk.add(f); this.tweens.add({ targets: f, alpha: 0.2, duration: 180, yoyo: true, repeat: -1 }); }
      if (vk === 'armor') mk.add(this.add.rectangle(0, -m.height * m.bs - 1, 8, 3, 0xc8d4ea).setStrokeStyle(1, 0x2a3040));
      m.mark = mk; m.markY = m.height * m.bs * 0.5 - 2;
      m.once('destroy', () => { this.tweens.killTweensOf(mk.list); mk.destroy(); });
    }
    // 폭탄 변종은 부풀었다 줄었다 해서 멀리서도 알아본다
    if (vk === 'burst' && !opt.mini) this.tweens.add({ targets: m, scaleX: m.bs * 1.15, scaleY: m.bs * 0.9, duration: 260, yoyo: true, repeat: -1, delay: 220 });
    return m;
  }

  // 뱀서식 포위: 떼거리가 원을 그리며 한꺼번에 몰려온다
  // 대열: 화면 한쪽 가장자리를 붉게 깜빡여 알린 뒤 그쪽에서 줄·떼로 나온다. 그만큼 일반 스폰을 덜어 난이도는 그대로
  formation() {
    const a = R(0, 3) * Math.PI / 2 + RF(-0.3, 0.3), p = a + Math.PI / 2, type = R(0, 2);
    const cx = this.hero.x + Math.cos(a) * 200, cy = this.hero.y + Math.sin(a) * 200;
    const at = (u, v) => ({ x: Phaser.Math.Clamp(cx + Math.cos(p) * u + Math.cos(a) * v, 10, WORLD - 10), y: Phaser.Math.Clamp(cy + Math.sin(p) * u + Math.sin(a) * v, 10, WORLD - 10) });
    const kind = Phaser.Utils.Array.GetRandom(this.ch.mobs), pts = [];
    if (type === 0) for (let i = 0; i < 11; i++) pts.push(at((i - 5) * 15, 0));
    else if (type === 1) for (let i = 0; i < 14; i++) pts.push(at(RF(-30, 30), RF(-20, 20)));
    else for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) pts.push(at((i - 3) * 16, r * 18));
    pts.forEach(q => this.spawn(false, kind, { force: true, at: q }));
    this.spawnAcc = (this.spawnAcc || 0) - pts.length * 0.7;
    // 경고: 그쪽 화면 가장자리
    const ex = Math.cos(a), ey = Math.sin(a), horiz = Math.abs(ex) > Math.abs(ey);
    const bar = this.add.rectangle(horiz ? (ex > 0 ? W - 3 : 3) : W / 2, horiz ? H / 2 : (ey > 0 ? H - 3 : 3), horiz ? 6 : W, horiz ? H : 6, 0xff3030, 0.7).setScrollFactor(0).setDepth(60);
    this.tweens.add({ targets: bar, alpha: 0, duration: 200, yoyo: true, repeat: 2, onComplete: () => bar.destroy() });
    sfx('warn', 300);
  }

  encircle() {
    const kind = this.ch.mobs[2], n = 18;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      this.spawn(false, kind, { force: true, at: { x: Phaser.Math.Clamp(this.hero.x + Math.cos(a) * 190, 10, WORLD - 10), y: Phaser.Math.Clamp(this.hero.y + Math.sin(a) * 190, 10, WORLD - 10) } });
    }
  }

  // ── 피해 ──
  dmgCalc(mult, tag) {
    const r = this.run, crit = Math.random() < 0.08 + this.tv('luck');
    const base = this.atk * mult * (1 + this.tv('atk') + r.bDmg + 0.1 * (r.skills.might || 0) + this.lv3('might', 0.1)) * (tag === 'pet' ? 1 : this.wM) * (this.wtype.id === 'axe' && this.gear.fx.has('axe4') && this.hp < this.maxHp / 2 ? 1.3 : 1) * RF(0.9, 1.1);
    return { dmg: Math.round(base * (crit ? 2 : 1)), crit };
  }

  // src: 같은 무기가 같은 몹을 너무 자주 때리지 않게 하는 키. kb: 밀려나는 세기
  // tag: 스킬 갈래(근접·원거리·마법·펫). 스탯 힘·민첩·지능이 갈래별 피해를 올린다
  hitMob(m, mult, { src = 'x', cd = 0, kb = 60, fx = 'small', from, tag } = {}) {
    if (!m.active || m.dead) return false;
    if (cd && this.bt - (m.hitBy[src] || -1e9) < cd) return false;
    m.hitBy[src] = this.bt;
    const { dmg, crit } = this.dmgCalc(mult, tag);
    m.hp -= dmg * (m.weak || 1) * (m.curse > this.bt ? 1.2 : 1);   // 지친 보스·리치 왕에게 저주받은 적은 더 아프게 맞는다
    // 흰 번쩍임 + 찌그러짐
    // 보스는 몸집이 커서 흰 번쩍임이 화면을 덮는다: 붉게만 물들인다
    if (m.isBoss) m.setTint(0xff8a8a); else m.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (m.active && !m.dead) { m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); } });
    if (!m.isBoss && !m.goblin) {
      const ox = from ? from.x : this.hero.x, oy = from ? from.y : this.hero.y;
      const ang = Phaser.Math.Angle.Between(ox, oy, m.x, m.y), k = kb * (crit ? 1.5 : 1) * m.kbRes;
      if (k > 0) { m.setVelocity(Math.cos(ang) * k, Math.sin(ang) * k); m.kb = 120; }
      const sc = m.bs || 1;
      this.tweens.add({ targets: m, scaleX: 1.3 * sc, scaleY: 0.75 * sc, duration: 50, yoyo: true, ease: 'Quad.Out', onComplete: () => m.active && m.setScale(sc) });
      if (m.hp > 0 && this.anims.exists(m.kind + 'Hurt') && fx === 'big') {
        m.play(m.kind + 'Hurt');
        this.time.delayedCall(150, () => m.active && !m.dead && m.play(m.kind));
      }
    }
    if (fx === 'big' || crit) {
      const s = this.add.sprite(m.x + RF(-4, 4), m.y + RF(-6, 2), 'fx1_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31)
        .setScale(crit ? 1.1 : 0.7).setRotation(RF(0, 6.28)).play('fxHit');
      s.once('animationcomplete', () => s.destroy());
      if (crit) {
        const c2 = this.add.sprite(m.x, m.y, 'fx2_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setScale(0.8).play('fxCrit');
        c2.once('animationcomplete', () => c2.destroy());
      }
      this.spark.explode(crit ? 12 : 5, m.x, m.y);
    } else this.spark.explode(3, m.x, m.y);
    this.popup(m.x, m.y - 12, dmg, crit, fx === 'big');
    sfx(crit ? 'crit' : 'hit', 45, 1 + 0.1 * Math.min(3, Math.floor(this.sv.enh / 5)));
    if (m.hp <= 0) this.kill(m);
    return true;
  }

  popup(x, y, n, crit, big) {
    // 화면이 숫자로 덮이지 않게: 치명타와 큰 숫자(100 이상)만 띄우고, 8개를 넘으면 오래된 것부터 지운다
    if (!crit && n < 100 && Math.random() > 0.25) return;   // 일반 타격도 네 번에 한 번은 보여 강화 차이가 숫자로 보인다
    if (this.popups.length >= 5) this.popups.shift().destroy();
    const t = this.add.text(x + R(-6, 6), y, fmt(n), font(crit ? 14 : big ? 11 : 9, crit ? '#ffd23f' : '#ffffff', crit ? 3 : 2))
      .setOrigin(0.5).setDepth(40).setScale(crit ? 1.6 : 1.3);
    this.popups.push(t);
    this.tweens.add({ targets: t, scale: 1, duration: 110, ease: 'Back.Out' });
    this.tweens.add({
      targets: t, y: y - 16, alpha: 0, delay: crit ? 380 : 220, duration: 300,
      onComplete: () => { t.destroy(); this.popups = this.popups.filter(p => p !== t); },
    });
  }

  kill(m) {
    m.dead = true; m.body.enable = false;
    const r = this.run;
    r.kills++; this.sv.stats.kills++; mission('kill');
    if (!m.mini && !m.goblin && !m.bat) dexKill(this.sv, m.kind);   // 도감(갈라진 새끼·이벤트 몹은 빼고)
    r.mana = Math.min(D.MANA_MAX, r.mana + (m.elite ? D.MANA_ELITE : D.MANA_KILL));
    sfx('kill', 50);
    if (m.isBoss) { m.bossAI.die(); return; }
    // 연속 처치: 1.2초 안에 이어 잡으면 콤보가 쌓인다
    this.combo = this.bt - (this.lastKillT || -1e9) < 1200 ? (this.combo || 0) + 1 : 1; this.lastKillT = this.bt;
    if (this.combo >= 10) { this.comboTxt.setText(`${this.combo} 콤보`).setAlpha(1).setScale(1.35); this.tweens.add({ targets: this.comboTxt, scale: 1, duration: 120 }); }
    // 정예를 잡으면 잠깐 멈추고 번쩍인다
    if (m.elite) { this.hitstop = 110; this.cameras.main.shake(140, 0.008); this.cameras.main.flash(90, 255, 230, 160); }
    // +10부터는 쓰러뜨린 자리에도 불티가 튄다(+15는 더 자주)
    const g = this.weapons.enhGlow();
    if (g.ember && Math.random() < (this.sv.enh >= 15 ? 0.6 : 0.35)) this.weapons.embers(m.x, m.y, g.tint);
    // 쓰러지는 그림(전용 시트가 있으면 무너짐, 없으면 흰빛으로 부풀었다 사라짐)
    // 시체가 칼 맞은 반대쪽으로 튕겨 나간다
    const ka = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, m.x, m.y), kd = m.elite ? 10 : 18;
    if (this.anims.exists(m.kind + 'Die')) {
      const c = this.add.sprite(m.x, m.y, m.texture.key).setFlipX(m.flipX).setDepth(9).setScale(m.scaleX).setTintFill(0xffffff).play(m.kind + 'Die');
      this.tweens.add({ targets: c, x: m.x + Math.cos(ka) * kd, y: m.y + Math.sin(ka) * kd, angle: Math.cos(ka) > 0 ? 25 : -25, duration: 180, ease: 'Quad.Out' });
      this.time.delayedCall(60, () => c.clearTint());
      c.once('animationcomplete', () => this.tweens.add({ targets: c, alpha: 0, delay: 250, duration: 400, onComplete: () => c.destroy() }));
    } else {
      const c = this.add.sprite(m.x, m.y, m.texture.key, m.frame.name).setFlipX(m.flipX).setDepth(9).setScale(m.scaleX).setTintFill(0xffffff);
      this.tweens.add({ targets: c, x: m.x + Math.cos(ka) * kd, y: m.y + Math.sin(ka) * kd, angle: Math.cos(ka) > 0 ? 40 : -40, scaleX: c.scaleX * 1.4, scaleY: c.scaleY * 0.2, alpha: 0, duration: 220, ease: 'Quad.In', onComplete: () => c.destroy() });
    }
    this.goo.setParticleTint(m.color); this.goo.explode(m.elite ? 24 : 8, m.x, m.y);
    if (m.variant === 'split') for (const d of [-7, 7]) this.spawn(true, m.kind, { force: true, mini: true, at: { x: m.x + d, y: m.y + R(-4, 4) } })?.setTint(D.VARIANTS.split.tint);
    if (m.variant === 'burst') this.burst(m.x, m.y, m.dmg);
    const sm = this.add.sprite(m.x, m.y - 2, 'fx1_r2s').setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setAlpha(0.35).setScale(m.elite ? 1 : 0.5).setTint(m.color).play('fxSmoke');
    sm.once('animationcomplete', () => sm.destroy());
    if (m.goblin) this.goblinDown(m);
    this.drop(m);
    this.tweens.killTweensOf(m);   // 폭탄 변종의 반복 맥박이 지운 몹을 붙잡지 않게
    m.destroy();
  }

  // 폭탄 변종: 붉은 원이 차오른 뒤 터진다. 그 안에 있으면 맞는다
  burst(x, y, dmg) {
    const R0 = 30, warn = this.add.circle(x, y, R0, 0xff4020, 0.18).setStrokeStyle(1, 0xff6040).setDepth(6).setScale(0.2);
    this.tweens.add({ targets: warn, scale: 1, duration: 550, ease: 'Quad.In', onComplete: () => {
      warn.destroy();
      if (this.over) return;
      const s = this.add.sprite(x, y, 'fx2_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setTint(0xffa040).setScale(1.3).play('fxCrit');
      s.once('animationcomplete', () => s.destroy());
      this.spark.explode(14, x, y); sfx('boom', 80); this.cameras.main.shake(90, 0.004);
      if (Phaser.Math.Distance.Between(x, y, this.hero.x, this.hero.y) < R0 + 4) this.hurt(dmg, 'burst');
    } });
  }

  // ── 드롭 ──
  drop(m) {
    const r = this.run, P = D.DROP;
    this.addGem(m.x, m.y, m.elite ? 10 : m.variant === 'giant' ? 5 : m.ai === 'tank' || m.variant === 'armor' ? 2 : 1);
    if (m.elite) {
      const n = R(...P.eliteSilver);
      for (let i = 0; i < 6; i++) this.addItem(m.x + R(-10, 10), m.y + R(-10, 10), 'silver', Math.ceil(n / 6));
      this.addItem(m.x, m.y, 'chest');
      // 정예는 다섯에 한 번 장비 꾸러미도 떨어뜨린다
      if (Math.random() < 0.2) this.addItem(m.x + 8, m.y, 'loot');
      r.stones += R(1, 2);
      return;
    }
    if (Math.random() < P.silver * (1 + this.tv('luck')) * (this.pet.def?.id === 'kingslime' ? 1.3 : 1)) this.addItem(m.x + R(-4, 4), m.y + R(-4, 4), 'silver', 1);
    // 회복: 기본 1.5%, 체력이 낮을수록 확률 가산, 90초 동안 안 나오면 확정
    const f = this.hp / this.maxHp;
    let ph = P.heal + (f < 0.4 ? P.healLow : 0) + (f < 0.3 ? P.healCrit : 0);
    if (f < 0.9 && this.bt - r.lastHeal > P.healPity) ph = 1;
    if (Math.random() < ph) { this.addItem(m.x, m.y, 'meat'); r.lastHeal = this.bt; }
    else if (Math.random() < P.magnet) this.addItem(m.x, m.y, 'magnetItem');
  }

  addGem(x, y, v) {
    // 보석이 너무 많으면 가장 먼 보석에 값을 합쳐 개수를 줄인다
    if (this.gems.countActive() > 160) {
      const far = this.gems.getChildren().reduce((a, b) => (Phaser.Math.Distance.Squared(a.x, a.y, this.hero.x, this.hero.y) > Phaser.Math.Distance.Squared(b.x, b.y, this.hero.x, this.hero.y) ? a : b));
      far.v += v; far.setTexture(far.v >= 10 ? 'gem3' : far.v >= 3 ? 'gem2' : 'gem1');
      return;
    }
    const g = this.gems.create(x + R(-3, 3), y + R(-3, 3), v >= 10 ? 'gem3' : v >= 2 ? 'gem2' : 'gem1').setDepth(8);
    g.v = v;
    this.tweens.add({ targets: g, y: g.y - 6, duration: 140, yoyo: true, ease: 'Quad.Out' });
  }

  addItem(x, y, kind, v = 1) {
    const it = this.items.create(x, y, kind).setDepth(8);
    it.kind = kind; it.v = v;
    this.tweens.add({ targets: it, y: y - 8, duration: 160, yoyo: true, ease: 'Quad.Out' });
    if (kind === 'loot') it.preFX?.addGlow(0xc890ff, 2, 0, false, 0.1, 6);
    if (kind === 'chest' || kind === 'meat' || kind === 'loot') this.tweens.add({ targets: it, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
    return it;
  }

  pickup(it) {
    const r = this.run;
    if (it.kind === 'silver') { r.silver += this.gear.fx.has('gold4') ? Math.ceil(it.v * 1.5) : it.v; sfx('coin', 60); }
    else if (it.kind === 'meat') { this.heal(this.maxHp * D.HEAL_PCT); }
    else if (it.kind === 'magnetItem') { this.gems.getChildren().forEach(g => g.pull = true); sfx('level'); }
    else if (it.kind === 'chest') { r.chests++; this.ui.chest(); }
    else if (it.kind === 'loot') this.gotLoot(dropItem(this.sv, this.c));
    it.destroy();
  }

  // 판에서 얻은 장비: 그 부위가 비었거나 지금 낀 것보다 좋으면 바로 낄지 묻는다(판이 끝나야 쓰면 주운 맛이 없었다)
  // 나머지는 판이 끝나면 가방에 들어간다(져도 남는다)
  gotLoot(item) {
    this.run.loot.push(item);
    const sv = this.sv, cur = !item.egg && equipped(sv).find(x => x.s === item.s);
    if (!item.egg && (!cur || itemScore(item) > itemScore(cur))) this.ui.lootAsk(item, cur);
    const rr = RARITY[item.r];
    const t = this.add.text(this.hero.x, this.hero.y - 34, `${rr.name} ${item.n}`, font(10, rr.css)).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, delay: 600, duration: 700, onComplete: () => t.destroy() });
    sfx(item.r >= 2 ? 'level' : 'coin');
    this.log('loot', { rarity: item.r, slot: item.s, egg: item.egg || 'none' });
  }

  // 판 안에서 장비를 바로 낀다: 능력치·체력·받는 피해를 다시 계산한다
  equipNow(item) {
    const sv = this.sv, def0 = this.tv('def'), hp0 = 1 + this.tv('hp');
    if (!(sv.inv ||= []).some(x => x.u === item.u)) sv.inv.push(item);
    (sv.eq ||= {})[item.s] = item.u;
    this.gear = gearStats(sv);
    this.mobDmgMul *= (1 - this.tv('def')) / (1 - def0);
    const k = (1 + this.tv('hp')) / hp0;
    this.maxHp *= k; this.hp = Math.min(this.maxHp, this.hp * k);
    save();
    this.log('loot_equip', { rarity: item.r, slot: item.s });
  }

  // 보물 고블린: 금빛, 단단하고 도망친다. 12초 안에 잡으면 은화와 희귀 이상 장비
  spawnGoblin(quiet = false) {
    const m = this.spawn(true, this.ch.mobs[0], { force: true });
    if (!m) return;
    m.goblin = true; m.goblinT = 12000; m.maxHp = m.hp = m.hp * 6; m.spd = 62; m.kbRes = 0.25; m.dmg = 0;
    m.setTint(0xffd75e); m.baseTint = 0xffd75e; m.bs *= 1.25; m.setScale(m.bs);
    m.preFX?.addGlow(0xffd75e, 4, 0, false, 0.1, 10);
    if (!quiet) this.banner('보물 고블린!', '도망치기 전에 잡아라');
    sfx('warn', 300);
    this.log('goblin_spawn', { quiet });
  }

  // ── 깜짝 이벤트 ──
  surprise(kind) {
    this.log('event', { kind });
    if (kind === 'goblin') return this.spawnGoblin();
    if (kind === 'bats') {
      // 황금 박쥐 떼: 빠르고 약하다. 8초 안에 잡으면 은화·경험치가 쏟아진다
      for (let i = 0; i < 6; i++) {
        const m = this.spawn(true, 'bat', { force: true });
        if (!m) continue;
        m.goblin = true; m.bat = true; m.goblinT = 8000; m.maxHp = m.hp = m.hp * 2; m.spd = 72; m.dmg = 0;
        m.setTint(0xffd75e); m.baseTint = 0xffd75e; m.preFX?.addGlow(0xffd75e, 2, 0, false, 0.1, 6);
      }
      this.banner('황금 박쥐 떼!', '흩어지기 전에 잡아라'); sfx('warn', 300);
      return;
    }
    // 축복의 제단: 근처에 빛 기둥. 그 안에 2초 서 있으면 버프
    const a = RF(0, Math.PI * 2), x = Phaser.Math.Clamp(this.hero.x + Math.cos(a) * 80, 30, WORLD - 30), y = Phaser.Math.Clamp(this.hero.y + Math.sin(a) * 80, 30, WORLD - 30);
    const g = this.add.container(x, y).setDepth(7);
    const glow = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).setScale(0.22).setAlpha(0.7);
    const ring = this.add.circle(0, 0, 22, 0xffd75e, 0.12).setStrokeStyle(2, 0xffd75e, 0.9);
    const arc = this.add.graphics();
    const t = this.add.text(0, -32, '축복의 제단', font(9, '#ffd75e')).setOrigin(0.5);
    g.add([glow, ring, arc, t]);
    this.tweens.add({ targets: glow, scale: 0.28, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    this.shrine = { g, arc, x, y, t: 0, life: 15000 };
    this.banner('축복의 제단!', '빛 안에 2초 서 있으면 강해진다'); sfx('level');
  }
  updateShrine(dt) {
    const r = this.run, sh = this.shrine;
    if (this.buffUntil && this.bt > this.buffUntil) {
      const b = D.EVENTS.shrineBuff; r.bDmg -= b.dmg; r.bSpd -= b.spd; this.buffUntil = 0; this.buffTxt?.setText('');
      toast(this, '축복이 끝났다', '#c8bfe0', 96);
    } else if (this.buffUntil) this.buffTxt?.setText(`축복 ${Math.ceil((this.buffUntil - this.bt) / 1000)}초`);
    if (!sh) return;
    sh.life -= dt;
    const inside = Phaser.Math.Distance.Between(sh.x, sh.y, this.hero.x, this.hero.y) < 24;
    sh.t = inside ? sh.t + dt : Math.max(0, sh.t - dt);
    const f = sh.t / D.EVENTS.shrineStand;
    sh.arc.clear().lineStyle(3, 0xffffff, 1).beginPath().arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, f)).strokePath();
    if (f >= 1) {
      const b = D.EVENTS.shrineBuff;
      r.bDmg += b.dmg; r.bSpd += b.spd; this.buffUntil = this.bt + b.ms;
      this.buffTxt ||= this.add.text(W - 57, 50, '', font(10, '#ffd75e')).setOrigin(0.5).setScrollFactor(0).setDepth(100);
      this.banner('축복!', `${b.ms / 1000}초 동안 피해 +${b.dmg * 100}% · 이동 +${b.spd * 100}%`); sfx('level');
      this.cameras.main.flash(150, 255, 230, 140);
      this.log('shrine_buff');
    }
    if (f >= 1 || sh.life <= 0) { this.tweens.killTweensOf(sh.g.list); sh.g.destroy(); this.shrine = null; }
  }
  goblinDown(m) {
    // 황금 박쥐: 은화와 경험치만
    if (m.bat) { for (let i = 0; i < 3; i++) this.addItem(m.x + R(-8, 8), m.y + R(-8, 8), 'silver', 2); this.addGem(m.x, m.y, 4); this.log('bat_kill'); return; }
    this.sv.stats.gob = (this.sv.stats.gob || 0) + 1;
    // 던전 고블린은 은화 대신 강화석(던전엔 상인이 없다)
    if (this.dungeon) { this.run.stones += 2; this.cameras.main.flash(120, 255, 220, 120); this.log('goblin_kill', { dungeon: true }); return; }
    for (let i = 0; i < 8; i++) this.addItem(m.x + R(-14, 14), m.y + R(-14, 14), 'silver', 5);
    this.gotLoot(makeItem(this.c, { rarity: R(1, 10) > 8 ? 2 : 1, w: this.sv.wtype }));
    if (Math.random() < 0.1) { const e = grantEgg(this.sv, 'cat', false); if (e) this.gotLoot(e); }
    this.cameras.main.flash(120, 255, 220, 120);
    this.log('goblin_kill');
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    sfx('heal');
    const t = this.add.text(this.hero.x, this.hero.y - 26, '+' + Math.round(n), font(10, '#5fdc6a')).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    this.hero.setTint(0x9dff9d); this.time.delayedCall(120, () => this.hero.clearTint());
  }

  gainXp(v) {
    const r = this.run;
    r.xp += v;
    sfx('gem', 35);
    if (r.xp >= D.xpNeed(r.lv)) {
      r.xp -= D.xpNeed(r.lv); r.lv++;
      this.log('level_up', { wave: this.wave });
      this.lvTxt.setText('Lv ' + r.lv);
      this.ui.levelUp();
    }
  }

  // ── 피격 ──
  hurt(dmg, src = 'boss') {
    if (this.over || this.paused || this.bt < this.iframe) return;
    // 해골 장군 펫의 방패가 한 대를 막는다
    if (this.petShield) { this.iframe = this.bt + D.PLAYER.iframe; this.pet.block(); return; }
    // 광전사 4세트: 체력이 절반 아래면 덜 아프다(공격만 올라 위험하기만 했다)
    const zerk = this.wtype.id === 'axe' && this.gear.fx.has('axe4') && this.hp < this.maxHp / 2 ? 0.8 : 1;
    const d = Math.max(1, Math.round(dmg * zerk * (this.pet.fit > 1 && this.pet.def.tank ? 1 - PET_GOOD_DEF : 1)));
    const by = this.run.dmgBy; by[src] = (by[src] || 0) + d;
    this.hp -= d;
    this.iframe = this.bt + D.PLAYER.iframe;
    this.run.mana = Math.min(D.MANA_MAX, this.run.mana + D.MANA_HURT);
    sfx('hurt', 120);
    this.hurtFx.setAlpha(0.3); this.tweens.add({ targets: this.hurtFx, alpha: 0, duration: 240 });
    this.cameras.main.shake(90, 0.004);
    this.hero.setTint(0xff7070); this.time.delayedCall(90, () => this.hero.clearTint());
    this.hurtUntil = this.bt + 160; this.hero.play('hurtPose');
    const t = this.add.text(this.hero.x, this.hero.y - 26, '-' + d, font(10, '#ff5050')).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    // 서리 수호자 4세트: 맞으면 주변 적을 얼린다(6초마다)
    if (this.gear.fx.has('frost4') && this.bt - (this.frostT || -1e9) > 6000) {
      this.frostT = this.bt;
      const ring = this.add.image(this.hero.x, this.hero.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ae8ff).setScale(0.3).setDepth(30);
      this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      this.mobs.getChildren().forEach(m => { if (!m.dead && !m.isBoss && Phaser.Math.Distance.Between(m.x, m.y, this.hero.x, this.hero.y) < 60) { m.freeze = 2000; m.setTint(0x9ae8ff); this.time.delayedCall(2000, () => m.active && !m.dead && m.setTint(m.baseTint)); } });
    }
    // 가시 덩굴 4세트: 맞으면 주변 적에게 가시가 박힌다
    if (this.gear.fx.has('thorn4')) this.mobs.getChildren().slice().forEach(m => { if (!m.dead && Phaser.Math.Distance.Between(m.x, m.y, this.hero.x, this.hero.y) < 56) this.hitMob(m, 1.5, { kb: 120, src: 'thorn', cd: 300 }); });
    // 고무 오리: 꽥!
    if (this.gear.fx.has('duck')) { const q = this.add.text(this.hero.x + 10, this.hero.y - 30, '꽥!', font(10, '#ffe066')).setOrigin(0.5).setDepth(40); this.tweens.add({ targets: q, y: q.y - 12, alpha: 0, duration: 600, onComplete: () => q.destroy() }); }
    if (this.hp <= 0) this.die();
  }

  die(final = false) {
    if (!final && this.run.revive > 0) {
      this.run.revive--;
      this.log('revive_done', { via: 'train' });
      this.hp = this.maxHp * 0.5;
      this.blast(6, true);
      this.banner('부활!', '한 번 더 싸운다');
      return;
    }
    // 부활을 포기해 다시 불린 것(final)은 이미 남겼다
    if (!final) this.log('death', { by: this.topHit(), wave: this.wave, kills: this.run.kills, final, progress: Math.round(this.runProgress() * 100), boss: !!this.bossPhase, boss_hp_pct: this.boss?.m ? Math.round(this.boss.m.hp / this.boss.m.maxHp * 100) : undefined });
    // 판당 한 번: 광고·보석으로 부활할 기회
    if (!final && !this.bot && !this.run.offered) { this.run.offered = true; this.hp = 0; this.ui.revive(); return; }
    this.over = true;
    this.hp = 0;
    this.physics.pause();
    this.hero.play('hurtPose');
    this.time.timeScale = 1;
    this.tweens.add({ targets: this.hero, angle: 90 * this.face, alpha: 0.4, duration: 500 });
    this.cameras.main.flash(300, 120, 0, 0);
    this.time.delayedCall(900, () => this.ui.result(false));
  }

  reviveNow() {
    this.run.revived = true;
    this.log('revive_done', { via: 'offer' });
    this.hp = this.maxHp * 0.5;
    this.iframe = this.bt + 2000;
    this.blast(6, true);
    this.banner('부활!', '한 번 더 싸운다');
  }

  // ── 궁극기: 화면 전체 베기 + 2초 무적 ──
  ult() {
    if (this.paused || this.over || this.run.mana < D.MANA_MAX) return;
    this.run.mana = 0;
    this.log('ult_use', { boss: !!this.boss, mobs: this.mobs.countActive() });
    this.blast(9, false);
  }

  blast(mult, revive) {
    sfx('ult');
    this.iframe = this.bt + 2000;
    this.hitstop = 120;
    this.flashFx.setAlpha(0.8); this.tweens.add({ targets: this.flashFx, alpha: 0, duration: 400 });
    this.cameras.main.shake(300, 0.012);
    const sp = this.add.sprite(this.hero.x, this.hero.y, 'fx2_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(32).setScale(1).play('fxSpin');
    this.tweens.add({ targets: sp, scale: 4, duration: 500, ease: 'Quad.Out' });
    sp.once('animationcomplete', () => sp.destroy());
    const cam = viewRect(this);
    this.mobs.getChildren().slice().forEach(m => {
      if (!Phaser.Geom.Rectangle.Contains(cam, m.x, m.y)) return;
      this.hitMob(m, m.isBoss ? mult / 2 : mult, { kb: 260, fx: 'big' });
    });
    this.ebullets.clear(true, true);
  }

  // ── 웨이브 ──
  endWave() {
    this.wave++;
    this.log('wave_clear', { wave: this.wave, of: this.endless ? undefined : this.waveCount, kills: this.run.kills, silver: this.run.silver });
    // 남은 몹은 흩어지고 보석은 다 끌려온다(브로타토식 자동 수거)
    this.mobs.getChildren().slice().forEach(m => {
      if (m.isBoss || m.dead) return;
      m.dead = true; m.body.enable = false;
      this.tweens.add({ targets: m, alpha: 0, scale: 0.3, duration: 250, onComplete: () => m.destroy() });
    });
    this.ebullets.clear(true, true);
    this.gems.getChildren().forEach(g => g.pull = true);
    this.items.getChildren().forEach(it => { if (it.kind === 'silver') it.pull = true; });
    this.time.delayedCall(700, () => {
      if (this.over) return;
      if (this.wave >= this.waveCount) {
        if (this.isBoss) { this.ui.shop(() => this.startBoss()); }
        else this.ui.result(true);
      } else if (this.endless) this.ui.shop(() => this.banner(`${this.wave + 1}층`, this.wave % 3 === 2 ? '해골 장군이 온다' : '더 세진다'));
      else this.ui.shop(() => this.banner(`웨이브 ${this.wave + 1} / ${this.waveCount}`, this.wave === this.waveCount - 1 ? '마지막 웨이브' : '버텨라'));
    });
  }

  startBoss() {
    this.bossPhase = true;
    this.log('boss_start', { boss: this.ch.boss });
    sfx('bossIn');
    this.cameras.main.shake(800, 0.006);
    const b = D.BOSSES[this.ch.boss];
    this.banner(b.name, '보스 등장 — 쓰러뜨려라');
    if (!this.bot) playBgm('boss', this.c);
    this.boss = new BossAI(this, this.ch.boss, this.mobHpMul);
  }

  // ── 매 프레임 ──
  update(time, delta) {
    if (this.over) return;
    if (this.hitstop > 0) {
      this.hitstop -= delta;
      if (!this.physics.world.isPaused) this.physics.pause();
      this.anims.pauseAll();
      if (this.hitstop <= 0 && !this.paused) { this.physics.resume(); this.anims.resumeAll(); }
      return;
    }
    if (this.paused) return;
    const dt = Math.min(delta, 50) * this.speed;
    this.bt += dt;
    const r = this.run;

    // 웨이브 시간
    if (!this.bossPhase) {
      this.waveT += dt;
      if (this.waveT >= this.waveLen) { this.waveT = 0; this.endWave(); return; }
      // 스폰: 초당 2.5 → 끝날 즈음 5.5마리(초반 몹은 약하고 많게)
      const f = this.progress();
      // x-1은 판 시작 20초에 초당 2마리를 더 내보낸다: 첫 판 초반 화면이 비어 지루했다(뒤 스테이지는 원래 많다)
      // 단 1-1은 처음 30초를 반쯤 비운다(25마리 → 22초에 69마리로 늘어 첫 판이 정신없었다)
      const first11 = !this.endless && this.c === 0 && this.s === 0 && this.bt < 30000;
      const early = !this.endless && this.s === 0 && this.bt < 20000 ? 2 : 0;
      this.spawnAcc = (this.spawnAcc || 0) + dt * (2.5 + early + D.stageSpawn(this.endless ? 0 : this.s) + 3 * f) * (this.dungeon ? 1.6 : 1) / 1000;   // 던전은 잡을 몹이 많아야 한다
      // 화면에 70마리가 넘으면 더 내보내지 않는다(3장에서 89마리까지 쌓여 저사양 폰이 버거웠다)
      while (this.spawnAcc >= 1) { this.spawnAcc--; if (this.mobs.countActive() < (first11 ? 35 : 70)) this.spawn(); }
      // 웨이브마다 엘리트 1마리(중간), 포위는 웨이브 2부터
      if (!this.eliteDone && this.waveT > this.waveLen * (this.wave + this.c + this.s === 0 ? 0.55 : 0.5)) { this.eliteDone = true; this.spawn(false, this.ch.mobs[1], { elite: true, force: true }); }
      if (this.eventAt != null && !this.eventDone && this.progress() >= this.eventAt) { this.eventDone = true; this.surprise(this.eventKind); }
      // 던전: 15초마다 보물 고블린(알림 없이)
      if (this.dungeon && this.bt >= (this.dunGobT ??= D.DUNGEON.goblinSec * 1000)) { this.dunGobT += D.DUNGEON.goblinSec * 1000; this.spawnGoblin(true); }
      if (this.wave >= 1 && !this.ringDone && this.waveT > this.waveLen * 0.25) { this.ringDone = true; this.encircle(); }
      if (this.waveT < dt * 2) { this.eliteDone = false; this.ringDone = false; }
      // 15초마다 한쪽에서 대열이 밀려온다(그냥 몰려오기만 하지 않게). 처음 판의 1-1은 뺀다
      if (!this.easy && (this.formT = (this.formT || 0) + dt) > 15000) { this.formT = 0; this.formation(); }
      // x-2는 마지막 웨이브에 해골 장군(중간 보스)
      const towerBoss = this.endless && this.wave % 3 === 2 && this.midWave !== this.wave && !this.midBoss;
      if ((towerBoss || this.s === 1 && !this.endless && this.wave === this.waveCount - 1 && !this.midDone) && this.waveT > this.waveLen * 0.3) {
        this.midDone = true; this.midWave = this.wave; this.midBoss = new BossAI(this, 'general', this.mobHpMul * (this.endless ? Math.pow(D.ENDLESS.hpGrow, this.wave) : 1), true);
        this.banner('해골 장군', '중간 보스'); sfx('bossIn');
      }
    } else {
      // 보스전에도 졸개가 꾸준히 나온다(1.2마리면 화면이 비어 보였다)
      // 다만 40마리를 넘으면 멈추고, 보스가 거의 죽으면 줄여 막판에 포위당해 지지 않게 한다
      // 분노하면 새 패턴을 보고 피할 수 있게 졸개도 줄인다
      const bm = this.boss?.m, low = bm && bm.hp < bm.maxHp * 0.3, calm = low || this.boss?.rage;
      this.spawnAcc = (this.spawnAcc || 0) + dt * (calm ? 1.1 : 2.2) / 1000;
      while (this.spawnAcc >= 1) { this.spawnAcc--; if (this.mobs.countActive() < (calm ? 25 : 40)) this.spawn(); }
    }
    this.boss?.update(dt);
    this.midBoss?.update(dt);
    this.updateShrine(dt);

    // 회복(훈련 + 활력)
    const regen = this.tv('regen') + 0.3 * (r.skills.vigor || 0) + this.lv3('vigor', 0.6);
    if (regen > 0) this.hp = Math.min(this.maxHp, this.hp + regen * dt / 1000);

    this.moveHero(time, dt);
    this.weapons.update(dt);
    this.pet.update(dt);
    this.updateMobs(dt);
    this.updatePickups(dt);
    this.updateHud(time);
    if (this.bot) this.botThink();
  }

  moveHero(time, dt) {
    const k = this.keys, v = this.joy.v.clone();
    if (k.A.isDown || k.LEFT.isDown) v.x = -1; if (k.D.isDown || k.RIGHT.isDown) v.x = 1;
    if (k.W.isDown || k.UP.isDown) v.y = -1; if (k.S.isDown || k.DOWN.isDown) v.y = 1;
    if (this.autoMove) v.copy(this.autoMove(time));
    if (v.length() > 1) v.normalize();
    const r = this.run;
    const spd = D.PLAYER.spd * (1 + this.tv('spd') + 0.08 * (r.skills.haste || 0) + this.lv3('haste', 0.08) + r.bSpd);
    // 출발·정지를 짧게 보간해 뻣뻣하지 않게(손가락을 따라 미끄러지듯)
    const ease = 1 - Math.pow(1 - (v.length() > 0.1 ? 0.3 : 0.4), dt / 16.7);
    this.mv ||= { x: 0, y: 0 };
    this.mv.x += (v.x * spd - this.mv.x) * ease; this.mv.y += (v.y * spd - this.mv.y) * ease;
    let vx = this.mv.x, vy = this.mv.y;
    if (this.lunge && this.lunge.t > 0) { vx += this.lunge.x; vy += this.lunge.y; this.lunge.t -= dt; }
    this.hero.setVelocity(vx, vy);
    const moving = v.length() > 0.1, h = this.hero;
    const slashing = (h.anims.currentAnim?.key === 'slash' && h.anims.isPlaying) || this.bt < (this.hurtUntil || 0);
    if (Math.abs(v.x) > 0.2 && !slashing) this.face = Math.sign(v.x);
    if (!slashing) {
      // 위·아래로 갈 땐 앞·뒷모습, 그 밖엔 옆모습(좌우 뒤집기). 서 있으면 숨쉬는 자세
      const want = !moving ? 'idle' : Math.abs(v.y) > Math.abs(v.x) * 1.3 ? (v.y < 0 ? 'walkUp' : 'walkFront') : 'walkSide';
      if (h.anims.currentAnim?.key !== want) h.play(want);
      h.anims.timeScale = moving ? 0.6 + v.length() * 0.9 : 1;
      h.setFlipX(want === 'walkSide' || want === 'idle' ? this.face < 0 : false);
    }
    // 걸을 때 통통 튀고, 앞·뒷모습은 좌우로 흔들어 발걸음을 보이게. 무적 중엔 깜빡임
    this.walkT += dt * (moving ? 0.018 : 0.004);
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * 0.08 : 0;
    h.setOrigin(0.5, 0.5 + bob);
    const rock = moving && !slashing && h.anims.currentAnim?.key !== 'walkSide' ? Math.sin(this.walkT) * 8 : 0;
    h.setAngle(slashing ? 0 : rock + v.x * 4);
    // 휘두를 때의 늘어남(weapons.js)을 덮어쓰지 않게 그동안은 손대지 않는다
    if (!slashing) h.setScale(1, moving ? 1 : 1 + Math.sin(this.walkT) * 0.025);
    h.setAlpha(this.bt < this.iframe && Math.floor(this.bt / 60) % 2 ? 0.55 : 1);
    h.setDepth(10 + h.y / WORLD);
    if (moving && this.bt - (this.lastDust || 0) > 170) { this.lastDust = this.bt; this.dust.explode(3, h.x - v.x * 6, h.y + h.height / 2 - 3); }
    this.heroRing.setPosition(h.x, h.y + h.height / 2 - 2);
    this.heroMark.setPosition(h.x, h.y - h.height / 2 - 4 + Math.sin(this.bt / 160) * 1.5);
    this.heroShadow.setPosition(h.x, h.y + h.height / 2 - 2).setScale(1.6 * (1 - bob * 2), 1.4).setDepth(9);
    this.moveV = v;
  }

  updateMobs(dt) {
    const h = this.hero;
    this.mobs.getChildren().forEach(m => {
      if (m.dead || m.isBoss) return;
      m.t += dt;
      m.setDepth(10 + m.y / WORLD);
      if (m.mark) {
        m.mark.setPosition(m.x, m.y + m.markY);
        // 광폭 변종은 붉은 잔상을 남긴다
        if (m.variant === 'swift' && m.t - (m.trailT || 0) > 110) { m.trailT = m.t; const g = this.add.image(m.x, m.y, m.texture.key, m.frame.name).setFlipX(m.flipX).setScale(m.scaleX).setTintFill(0xff4040).setAlpha(0.35).setDepth(8); this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() }); }
      }
      m.setFlipX(m.x > h.x);
      if (m.freeze > 0) { m.freeze -= dt; m.setVelocity(0, 0); m.anims.timeScale = 0; return; }
      m.anims.timeScale = m.slow > 0 ? 0.5 : 1;
      if (m.slow > 0) m.slow -= dt;
      if (m.kb > 0) { m.kb -= dt; m.body.velocity.scale(0.86); return; }
      const spd = m.spd * (m.slow > 0 ? 0.5 : 1);
      const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1;
      // 보물 고블린은 반대로 달아나다 12초가 지나면 사라진다
      if (m.goblin) {
        m.goblinT -= dt;
        if (m.goblinT <= 0) { m.dead = true; m.body.enable = false; this.tweens.add({ targets: m, alpha: 0, scale: 0.2, duration: 300, onComplete: () => m.destroy() }); if (!m.bat && !this.dungeon) this.banner('고블린이 도망쳤다', '다음엔 빨리 잡자'); this.log('goblin_escape', { bat: !!m.bat }); return; }
        const wob = Math.sin(m.t / 300 + m.phase) * 0.8;
        m.setVelocity((-dx / d - dy / d * wob) * spd, (-dy / d + dx / d * wob) * spd);
        if (m.x < 30 || m.y < 30 || m.x > WORLD - 30 || m.y > WORLD - 30) m.setVelocity((WORLD / 2 - m.x) * 0.3, (WORLD / 2 - m.y) * 0.3);
        return;
      }
      // 너무 멀어진 몹은 플레이어 근처로 다시 데려온다
      if (d > 420) { const p = this.spawnPoint(); m.setPosition(p.x, p.y); return; }
      if (m.ai === 'swarm') {
        const wob = Math.sin(m.t / 180 + m.phase) * 0.7;
        m.setVelocity((dx / d - dy / d * wob) * spd, (dy / d + dx / d * wob) * spd);
      } else if (m.ai === 'charge') {
        m.cd = (m.cd ?? 2000 + R(0, 1500)) - dt;
        if (m.dash > 0) { m.dash -= dt; return; }
        if (m.wind > 0) {
          m.wind -= dt; m.setVelocity(0, 0); m.x += Math.sin(m.t) * 0.6;
          if (m.wind <= 0) { m.dash = 450; m.setVelocity(Math.cos(m.dashA) * spd * 3, Math.sin(m.dashA) * spd * 3); m.setTint(m.baseTint); }
          return;
        }
        if (m.cd <= 0 && d < 140) {
          m.cd = 3200; m.wind = 600; m.setTint(0xff6060);
          // 돌진할 방향을 바닥에 붉은 줄로 미리 그려 피할 수 있게 한다(그 방향 그대로 달린다)
          m.dashA = Math.atan2(dy, dx);
          const len = spd * 3 * 0.45, g = this.add.graphics().setDepth(7);
          g.lineStyle(5, 0xff3030, 0.35).lineBetween(m.x, m.y, m.x + Math.cos(m.dashA) * len, m.y + Math.sin(m.dashA) * len);
          this.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: 600, onComplete: () => this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() }) });
          return;
        }
        m.setVelocity(dx / d * spd, dy / d * spd);
      } else if (m.ai === 'ranged') {
        const want = d > 120 ? 1 : d < 90 ? -0.6 : 0;
        m.setVelocity(dx / d * spd * want, dy / d * spd * want);
        m.cd = (m.cd ?? 1500 + R(0, 1500)) - dt;
        if (m.cd <= 0 && d < 200) { m.cd = 3000; this.enemyShot(m.x, m.y, Math.atan2(dy, dx), 75, m.dmg); }
      } else m.setVelocity(dx / d * spd, dy / d * spd);
    });
  }

  enemyShot(x, y, ang, spd, dmg) {
    const b = this.ebullets.create(x, y, 'ebullet').setDepth(29);
    b.dmg = dmg; b.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd); b.body.setCircle(3, 1, 1);
    b.life = 4000;
    sfx('shoot', 120);
    return b;
  }

  updatePickups(dt) {
    const h = this.hero, r = this.run;
    const pick = D.PLAYER.pickup * (1 + this.tv('mag') + 0.3 * (r.skills.magnet || 0) + this.lv3('magnet', 0.4) + r.bPick);
    this.gems.getChildren().slice().forEach(g => {
      const d = Phaser.Math.Distance.Between(g.x, g.y, h.x, h.y);
      if (d < pick || g.pull) { g.pull = true; this.physics.moveToObject(g, h, 120 + (g.sp = (g.sp || 0) + dt * 0.5)); }
      // 조금 먼 보석은 천천히 끌려온다: 몹에 둘러싸여 보석까지 못 가면 레벨이 멈췄다
      else if (d < pick * 3) this.physics.moveToObject(g, h, 45);
      else if (g.body.speed) g.setVelocity(0);
      if (d < 10) { this.gainXp(g.v); g.destroy(); }
    });
    this.items.getChildren().slice().forEach(it => {
      const d = Phaser.Math.Distance.Between(it.x, it.y, h.x, h.y);
      if (d < pick * 0.8 || it.pull) { it.pull = true; this.physics.moveToObject(it, h, 140); }
      if (d < 12) this.pickup(it);
    });
    this.ebullets.getChildren().slice().forEach(b => { b.life -= dt; if (b.life <= 0) b.destroy(); });
  }

  updateHud(time) {
    if (this.comboTxt.alpha > 0 && this.bt - (this.lastKillT || 0) > 1200) this.comboTxt.setAlpha(Math.max(0, this.comboTxt.alpha - 0.05));
    const r = this.run, cam = this.cameras.main;
    this.xpBar.width = W * Math.min(1, r.xp / D.xpNeed(r.lv));
    const f = Math.max(0, this.hp / this.maxHp);
    this.hpBar.width = 76 * f;
    this.hpLag.width += (76 * f - this.hpLag.width) * 0.06;
    this.hpTxt.setText(`${Math.ceil(Math.max(0, this.hp))}/${Math.round(this.maxHp)}`);
    if (this.bossPhase) { this.timeTxt.setText('보스'); this.waveTxt.setText(''); }
    else {
      const left = Math.max(0, Math.ceil((this.waveLen - this.waveT) / 1000));
      this.timeTxt.setText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
      this.timeTxt.setColor(left <= 5 ? '#ffd75e' : '#ffffff');
      this.waveTxt.setText(this.endless ? `${this.wave + 1}층` : this.dungeon ? `처치 ${r.kills} / ${D.DUNGEON.killNeed}` : `${this.hard ? '어려움 · ' : ''}웨이브 ${Math.min(this.wave + 1, this.waveCount)}/${this.waveCount}`);
      if (this.dungeon) this.waveTxt.setColor(r.kills >= D.DUNGEON.killNeed ? '#5fdc6a' : '#c8bfe0');
    }
    this.killTxt.setText(fmt(r.kills)); this.silverTxt.setText(fmt(r.silver));
    // 마나 링
    const mf = r.mana / D.MANA_MAX, full = mf >= 1;
    this.ultFill.clear().lineStyle(3, full ? 0xffd75e : 0x6fd3ff, 1)
      .beginPath().arc(this.ultPos.x, this.ultPos.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * mf).strokePath();
    this.ultIcon.setAlpha(full ? 1 : 0.45).setScale((full ? 1 + Math.sin(time / 120) * 0.08 : 1) * (this.ultIcon.baseScale ||= this.ultIcon.scaleX));
    this.ultTxt.setText(full ? '눌러서 발동!' : `궁극기 ${Math.floor(mf * 100)}%`).setColor(full ? '#ffd75e' : '#c8bfe0');
    // 조명
    this.glow.setPosition(this.hero.x, this.hero.y).setScale(1 + Math.sin(time / 120) * 0.03);
    this.dark.clear().fill(0x06040c, this.darkA).erase('light', this.hero.x - cam.scrollX - 150, this.hero.y - cam.scrollY - 150);
    for (const t of this.torches) {
      const sx = t.x - cam.scrollX, sy = t.y - cam.scrollY;
      if (sx > -150 && sy > -150 && sx < W + 150 && sy < H + 150) this.dark.erase('light', sx - 150, sy - 150);
    }
  }

  // ── 자동 플레이(테스트용 ?bot) ──
  botThink() {
    const h = this.hero; let ax = 0, ay = 0, near = null, nd = 1e9;
    // 바짝 붙은 적과 탄만 피하고, 아니면 가장 가까운 적에게 다가가 벤다(사람이 하듯)
    this.mobs.getChildren().forEach(m => {
      if (m.dead) return;
      const dx = h.x - m.x, dy = h.y - m.y, d2 = dx * dx + dy * dy + 1;
      if (d2 < nd) { nd = d2; near = m; }
      // 보스는 공격 준비 중(busy)일 때만 크게 피하고, 평소엔 검이 닿는 거리(약 70)를 지킨다
      const big = m.isBoss || m.elite, R2 = m.isBoss ? (m.bossAI.busy > 0 ? 120 * 120 : 62 * 62) : m.elite ? 80 * 80 : 42 * 42;
      if (d2 < R2) { ax += dx / d2 * (big ? 2500 : 260); ay += dy / d2 * (big ? 2500 : 260); }
    });
    this.ebullets.getChildren().forEach(b => {
      const dx = h.x - b.x, dy = h.y - b.y, d2 = dx * dx + dy * dy + 1;
      if (d2 < 60 * 60) { ax += dx / d2 * 900; ay += dy / d2 * 900; }
    });
    const bm = this.boss?.m;
    if (bm?.active && !(this.boss.busy > 0)) { const dx = bm.x - h.x, dy = bm.y - h.y, d = Math.hypot(dx, dy) + 1; if (d > 75) { ax += dx / d * 0.8; ay += dy / d * 0.8; } }
    else if (near && !near.isBoss && !near.elite && nd > 46 * 46 && Math.hypot(ax, ay) < 0.5) { const d = Math.sqrt(nd); ax += (near.x - h.x) / d * 0.7; ay += (near.y - h.y) / d * 0.7; }
    // 보석·고기 쪽으로 살짝 끌림, 가운데로 복귀
    let best = null, bd = 1e9;
    this.items.getChildren().concat(this.gems.getChildren()).forEach(g => { const d = Phaser.Math.Distance.Squared(g.x, g.y, h.x, h.y); if (d < bd) { bd = d; best = g; } });
    if (best && bd < 150 * 150) { const d = Math.sqrt(bd) + 1; ax += (best.x - h.x) / d * 0.6; ay += (best.y - h.y) / d * 0.6; }
    ax += (WORLD / 2 - h.x) / 2000; ay += (WORLD / 2 - h.y) / 2000;
    const v = new Phaser.Math.Vector2(ax, ay);
    this.joy.v.copy(v.length() > 0.15 ? v.normalize() : v.scale(0));
    if (this.run.mana >= D.MANA_MAX && (this.boss || this.mobs.countActive() > 40)) this.ult();
  }
}
