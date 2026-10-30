// 전투: 웨이브 생존, 자동 공격 스킬, 레벨업 3택, 웨이브 사이 상점, 궁극기, 보스
import * as D from './data.js';
import { load, save, mission } from './save.js';
import { sfx, playBgm, stopBgm, buzz } from './sfx.js';
import { font, font9, panel, button, icon, skillIcon, fmt, COLOR, hiCam, viewRect, PX, toast, skinFx, setBackdrop, clearBackdrop } from './ui.js';
import { Weapons } from './weapons.js';
import { BossAI } from './boss.js';
import { insetsGame } from './safeArea.js';
import { Overlay } from './overlay.js';
import { itemName, gearStats, wMul, spReq, wtypeOf, dropItem, makeItem, grantEgg, eggsSettled, RARITY, equipped, itemScore, PETS, PET_GOOD_DEF, recPets, heroSkin } from './gear.js';
import { Pet } from './pets.js';
import { track, logCtx } from './log.js';
import { dexKill } from './codex.js';
import { makeEnv } from './envfx.js';
import { raidFlag, playOnce } from './fx2.js';
import { ModeRun } from './modes.js';   // 모드(지키기·점령·돌파·사냥) 규칙. 여기선 연결만

import { consumeTrial, cosmetic, wardrobe, salePrice, buyCosmetic } from './cosmetics.js';
import { dressHero, CosmeticActor, weaponKey, placeHeld } from './cosmeticView.js';
import { t, tt } from './i18n.js';
const { W, H } = D;
const WORLD = 1600;
const HERO_D = 33;   // 47차: 주인공은 몹·불꽃·베기 효과(28~32)보다 위 층, 피해 숫자(40)·어둠(50)보다 아래
const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.mode = data.mode ? new ModeRun(this, data.mode.id, data.mode.n) : null;   // 모드 판: 장 번호는 모드 설정에서, 난이도는 그 장 2판(x-2) 기준
    this.c = this.mode ? this.mode.cfg.c : data.chapter; this.s = this.mode ? 1 : data.stage;
    this.ch = D.CHAPTERS[this.c];
    this.endless = !!data.endless;
    this.practice = !!data.practice;                    // 47차: 꾸미기 체험 30초 연습장(몹 약함·보상 없음)
    this.hard = !!data.hard && !this.endless;           // 어려움: 같은 판을 센 몹으로
    this.dungeon = data.dungeon || null;                // 일일 던전 종류(gold·stone·gear·gem)
    this.isBoss = !this.practice && !this.endless && !this.dungeon && this.s === D.STAGES_PER_CHAPTER - 1;
    this.sv = load();
    const outfit = consumeTrial(this.sv); this.cosLook = outfit.look; this.cosTrial = outfit.trial; save();
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
    this.ultTip = null; this.eventDone = false; this.shrine = null; this.buffUntil = 0; this.buffTxt = null; this.dunGobT = null;
    // 보스 단계도 비운다(앞 판이 보스전으로 끝나면 다음 판이 웨이브 없이 영원히 이어졌다)
    this.bossPhase = false; this.midBoss = null; this.shopShown = false; this.midDone = false; this.midWave = undefined; this.eliteDone = false; this.ringDone = false; this.tasteDone = false; this.spawnAcc = 0;
    this.run = {
      lv: 1, xp: 0, silver: 0, kills: 0, mana: 0, stones: 0, chests: 0,
      skills: { sword: 1 }, evo: {}, freeReroll: 1, shopRound: 0,
      // 판 안에서 산 강화
      bDmg: 0, bSpd: 0, bHp: 0, bPick: 0,
      revive: sv.train.revive ? 1 : 0, lastHeal: 0, dmgBy: {},
    };
    // 비급: 산 스킬 한 권을 판 시작부터 들고 들어간다
    if (sv.book && D.bookLv(sv, sv.book)) this.run.skills[sv.book] = D.bookSkillLv(D.bookLv(sv, sv.book));
    // 장비·세트·스탯, 무기 종류. 든 무기가 따르는 스탯만 피해를 올린다
    this.gear = gearStats(sv);
    this.wtype = wtypeOf(sv);
    this.wM = wMul(sv);
    this.run.loot = []; eggsSettled();
    this.wave = 0;
    this.waveLen = this.endless ? D.ENDLESS.floorSec * 1000 : this.dungeon ? D.DUNGEON.sec * 1000 : this.ch.dur * 1000 / D.WAVES;
    this.waveCount = this.endless ? Infinity : this.dungeon ? 1 : this.isBoss ? D.WAVES - 1 : D.WAVES;
    if (this.mode) { this.waveLen = this.mode.waveLen(); this.waveCount = 1; }
    this.waveT = 0;
    this.mobDmgMul = D.chapterDmg(this.c) * D.stageDmg(this.s) * (this.endless ? 1 : D.easeDmg(this.c, this.s)) * (1 - this.tv('def')) * (!this.endless && this.c >= 2 ? D.LATE_DMG : 1);   // 3장부터는 맞는 펫(받는 피해 -20%) 없이는 버겁게
    if (this.hard) this.mobDmgMul = D.hardDmg(this.c, this.s) * (1 - this.tv('def'));
    // 처음 두 판의 1-1은 맞는 피해를 줄이고 시작 몹도 적게(조작을 익히는 동안 지지 않게)
    this.easy = this.sv.stats.runs < 2 && this.c === 0 && this.s === 0 && !this.endless && !this.hard && !this.dungeon;
    this.firstRun = this.easy && this.sv.stats.runs === 0;   // runs++는 시작 때 올라가니 판 도중엔 못 읽는다(42차)
    if (this.easy) { this.mobDmgMul *= 0.4;   // 0.55면 피해 다녀도 30초에 체력 54%(36차)
      // 두 번째 판은 30초 뒤 0.55로: 두 판 내내 체력이 안 닳아 카드 고르는 의미가 없었다(41차)
      if (this.sv.stats.runs === 1) this.time.delayedCall(30000, () => { this.mobDmgMul *= 0.55 / 0.4; });
      this.waveCount = 2; this.waveLen *= 0.8; }   // 처음 판은 웨이브 둘에 짧게(150초 → 80초): 첫 클리어까지 오래 걸리면 떠났다
    // 쉬운 판이 끝나도 1장은 한 번에 ×1로 뛰지 않게 3·4판째는 0.6·0.8(39차: 3판째 절벽)
    else if (this.c === 0 && !this.endless && !this.hard && !this.dungeon && this.sv.stats.runs < 4) this.mobDmgMul *= this.sv.stats.runs < 3 ? 0.6 : 0.8;
    this.mobHpMul = D.chapterHp(this.c) * D.stageMul(this.s) * (this.endless ? 1 : D.easeHp(this.c, this.s)) * spReq(this.endless ? sv.cleared : this.c * D.STAGES_PER_CHAPTER + this.s);
    if (this.hard) this.mobHpMul = D.hardHp(this.c, this.s);
    // 던전은 많이 잡는 판: 몹이 약하고 조금 덜 아프다
    if (this.dungeon) { this.mobHpMul *= D.DUNGEON.hp; this.mobDmgMul *= 0.8; }

    // 47차: 연습장은 30초 한 웨이브, 몹은 약하고 덜 아프다. 보상·상인·이벤트·규칙 없음
    if (this.practice) { this.waveCount = 1; this.waveLen = D.PRACTICE_SEC * 1000; this.mobHpMul *= 0.25; this.mobDmgMul *= 0.25; this.easy = false; this.firstRun = false; }
    this.makeMap();
    this.makeHero();
    this.makeFx();

    this.mobs = this.physics.add.group();
    this.gems = this.physics.add.group();
    this.items = this.physics.add.group();
    this.ebullets = this.physics.add.group();
    this.pbullets = this.physics.add.group();
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.liveMobs = []; this.gridCells = new Map(); this.gridUsed = []; this.fxFree = []; this.popFree = [];
    // 몹끼리 밀어내기는 두 프레임에 한 번만 푼다(쌍 검사가 몹 수의 제곱으로 늘어 저사양 폰에서 가장 무거웠다)
    this.mobCollider = this.physics.add.collider(this.mobs, this.mobs, null, (a, b) => !a.float && !b.float && !a.dead && !b.dead);
    this.physics.add.overlap(this.hero, this.mobs, (h, m) => !m.dead && !m.goblin && !m.dive && this.hurt(m.dmg, (m.elite ? 'elite_' : '') + m.kind));
    this.physics.add.overlap(this.hero, this.ebullets, (h, b) => { this.hurt(b.dmg, 'shot'); b.destroy(); });

    // 왼쪽 위 기준 카메라라 주인공이 가운데 오도록 반 화면만큼 밀고, 경계도 그만큼 옮긴다
    // Phaser는 줌 카메라의 경계를 (화면폭 - 보이는폭)/2 = W*(PX-1)/2 만큼 안쪽으로 잡는다. 예전엔 W/2만 더해 오른쪽·아래 끝에서 주인공이 화면 밖으로 나가고 위·왼쪽은 검은 빈 곳이 보였다(42차)
    // 위·아래 끝에서는 HUD(위 64px)·궁극기 버튼(아래 56px)에 주인공이 가리지 않게, 좌우는 40px 바깥 바닥(어둡게 덮인 곳)까지 보이게 경계를 넓힌다
    const MX = 40, MT = 64, MB = 56;
    hiCam(this).startFollow(this.hero, true, 1, 1).setFollowOffset(W / 2, H / 2).setBounds(W * (PX - 1) / 2 - MX, H * (PX - 1) / 2 - MT, WORLD + 2 * MX, WORLD + MT + MB).setRoundPixels(true);
    // 화면 흔들림: 공격·피격마다 흔들려 머리가 아팠다. 작은 흔들림은 없애고 큰 것(보스·엘리트)만 약하고 짧게
    const cam = this.cameras.main, shake = Phaser.Cameras.Scene2D.Camera.prototype.shake;
    cam.shake = (d, i = 0.005, ...r) => i <= 0.005 ? cam : shake.call(cam, Math.min(d, 250), i * 0.4, ...r);
    this.weapons = new Weapons(this);
    this.boss = null;
    this.ui = new Overlay(this);
    this.petShield = false;
    this.pet = new Pet(this);
    this.env = makeEnv(this);   // 6장부터의 장 기믹(envfx.js)
    this.makeHud();
    this.makeJoystick();
    this.mode?.setup();   // 물건·거점·벽·사냥감을 놓고 주인공 위치를 잡는다(시작 몹을 깔기 전에)
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
    // 어려움은 늘 판 규칙이 붙는다(같은 맵에 바닥만 붉어 새 판으로 안 느껴졌다)
    // 1-1 두 번째 판은 떼를 붙인다: 처음 두 판에 판 규칙이 안 보여 매번 같은 게임 같았다(40차). 질풍은 바로 다음 1-2 몫(41차)
    this.mod = this.practice || this.mode ? null : this.easy && sv.stats.runs === 1 ? D.RUN_MODS.find(m => m.id === 'horde') : this.easy || this.isBoss || this.endless || this.dungeon ? null : this.s === 1 && firstTry ? D.stageMod(this.c)
      : this.hard ? Phaser.Utils.Array.GetRandom(D.RUN_MODS.filter(m => m.id !== 'mutant' || D.stageVariant(this.c, this.s)))
      : sv.stats.runs >= 2 && Math.random() < D.RUN_MOD_CHANCE ? Phaser.Utils.Array.GetRandom(D.RUN_MODS.filter(m => m.id !== 'mutant' || D.stageVariant(this.c, this.s))) : null;   // 변종이 없는 판엔 '변종 소굴'은 빼고 뽑는다
    this.hordeKind = this.mod?.id === 'horde' ? this.ch.mobs[R(0, 2)] : null;
    // 깜짝 이벤트: 보스·무한의 탑·처음 판·던전이 아니면 판 중간에 하나(보물 고블린·황금 박쥐 떼·축복의 제단)
    this.eventAt = !this.practice && !this.mode && !this.easy && !this.isBoss && !this.endless && !this.dungeon && (this.c * D.STAGES_PER_CHAPTER + this.s >= sv.cleared || Math.random() < D.EVENTS.chance) ? RF(0.3, 0.7) : null;   // 처음 도전하는 판은 꼭 한 번 본다
    this.eventKind = Phaser.Utils.Array.GetRandom(D.EVENTS.kinds);
    // 시작부터 화면이 차 있어야 첫 10초가 심심하지 않다
    // 44차: 6장부터는 시작 몹 28마리가 곧바로 에워싸 무기 1개인 첫 30초에 쓰러졌다 → 일부만 두고 나머지는 화면 밖에서 차례로 들어온다
    const total = this.easy ? 24 : 28, first = this.endless || this.dungeon ? total : this.c === 0 ? (this.easy ? 10 : 16) : this.c >= 5 ? 8 : 16;   // 45차: 1-1도 시작 24마리가 이미 화면에 있었다 → 10(처음 판)·16마리만 두고 나머지는 7초에 걸쳐 들어온다(첫 레벨업 2.4초는 가까운 몹으로 유지)
    for (let i = 0; i < first; i++) this.spawn(true, null, first < total ? { at: this.spawnPoint(150, 230) } : {});   // 40이면 무기 1~2개인 첫 30초가 가장 위험했다(37차)
    // 46차: 9장부터는 시작 10초 동안 처치가 없어 조용했다 — 약한 몹(체력 12%, 보상은 그대로)을 가까이 먼저 보내 첫 베기에 바로 쓰러지게 한다
    if (this.c >= 8 && !this.endless && !this.dungeon && !this.isBoss) for (let i = 0; i < 5; i++) this.spawn(true, this.ch.mobs[0], { weak: 0.12, force: true, at: this.spawnPoint(55 + i * 8, 95 + i * 8) });
    for (let i = 0; i < total - first; i++) this.time.delayedCall(700 + i * (7000 / (total - first)), () => !this.over && this.spawn(false, null, { at: this.spawnPoint(250, 300) }));
    if (!this.bot) playBgm('battle', this.c);
    this.events.once('shutdown', stopBgm);
    // 앱을 내리거나 화면이 꺼지면 일시정지 창을 띄워 둔다(돌아왔을 때 이미 맞고 있지 않게)
    const onHide = () => { if (!this.over && !this.paused && !this.bot) this.ui.pauseMenu(); };
    this.game.events.on('hidden', onHide); this.events.once('shutdown', () => this.game.events.off('hidden', onHide));
    if (sv.stats.runs < 2 && !this.bot && !this.practice) this.dragHint();
    if (this.practice) this.practiceStart();
    if (this.practice) { /* 연습장 안내는 practiceStart */ }
    else if (this.mode) this.mode.intro();
    else if (this.endless) this.banner(t('battle.6304cf'), t('battle.c78e78', { endBest: sv.endBest }));
    else if (this.dungeon) this.banner(t('battle.023b82', { name: D.DUN_TYPES[this.dungeon].name }), t('battle.f18dc3', { sec: D.DUNGEON.sec, killNeed: D.DUNGEON.killNeed }));
    else if (this.hard) this.banner(t('battle.2188f1', { v: this.c + 1, v2: this.s + 1, name: this.ch.name }), this.isBoss ? t('battle.aae927') : t('battle.d46739', { waveCount: this.waveCount }));
    else this.banner(`${this.c + 1}-${this.s + 1}  ${this.ch.name}`, this.isBoss ? t('battle.aae927') : t('battle.0e4516', { waveCount: this.waveCount, v: this.s === 1 ? t('battle.6c34bd') : t('battle.a75122') }));
    // 펫 상성: 잘 듣는 펫이면 알려 주고, 없으면 이 장에 맞는 펫을 알려 준다(가진 것만)
    if (!this.endless && !this.dungeon) {
      const pf = this.pet.def && this.pet.fit, rs = recPets(this.sv, this.c).filter(p => this.sv.cleared >= p.unlock).map(p => p.name).join(' / ');
      const msg = pf > 1 ? [t('battle.dbd648', { v: this.pet.def.tank ? t('battle.6935f3') : '' }), '#5fdc6a'] : pf < 1 ? [t('battle.009d79', { name: this.pet.def.name, v: rs ? t('battle.2d4406', { rs }) : '' }), '#ff9070'] : rs ? [t('battle.c7a9ca', { rs }), '#ffd75e'] : null;
      if (msg) this.time.delayedCall(2600, () => !this.over && toast(this, msg[0], msg[1], 96));
    }
    if (this.mod) this.time.delayedCall(4200, () => !this.over && this.banner(t('battle.da7b97', { v: this.mod.id === 'horde' ? D.MOB_NAMES[this.hordeKind] + ' ' : '', name: this.mod.name }), this.mod.desc));
    // 이번 스테이지에 처음 나오는 변종을 알려 준다
    const nv = !this.mode && !this.endless && !this.isBoss && !this.dungeon && !this.hard && D.stageVariant(this.c, this.s);
    // 각성한 무기는 판 시작 때 무엇이 달라졌는지 알려 준다
    const aw = D.awakenText(sv.enh);
    if (aw && !this.dungeon) this.time.delayedCall(this.mod ? 7600 : 3400, () => !this.over && this.banner(aw[0], aw[1]));
    if (nv) this.time.delayedCall(1900, () => !this.over && this.banner(t('battle.27535b', { pre: D.VARIANTS[nv[1]].pre, v: D.MOB_NAMES[this.ch.mobs[nv[0]]] }), D.VARIANTS[nv[1]].desc));
    if (!this.practice) { sv.stats.runs++; save(); }
    logCtx({ stage: this.mode ? `mode_${this.mode.id}_${this.mode.n + 1}` : this.endless ? 'tower' : this.dungeon ? 'dungeon' : `${this.hard ? 'H' : ''}${this.c + 1}-${this.s + 1}`, idx: this.endless || this.dungeon ? -1 : this.c * D.STAGES_PER_CHAPTER + this.s });
    this.log('battle_start', { power: D.powerOf(sv), rec: this.endless || this.dungeon ? undefined : D.recOf(this.c, this.s, this.hard), hard: this.hard, dungeon: this.dungeon || 'none', tier: sv.tier, enh: sv.enh, mod: this.mod?.id || 'none', easy: this.easy, runs: sv.stats.runs, replay: !this.endless && this.c * D.STAGES_PER_CHAPTER + this.s < sv.cleared, boss_stage: this.isBoss });
  }

  // ── 지도 ──
  makeMap() {
    const key = this.textures.exists(this.ch.tiles) ? this.ch.tiles : 'tiles';
    const tintless = key === this.ch.tiles;
    const ts = this.textures.get(key).getSourceImage();
    const T = ts.width / 4;
    if (!this.textures.exists(key + '_t')) this.textures.addSpriteSheet(key + '_t', ts, { frameWidth: T, frameHeight: T });
    // 월드 밖 M만큼도 바닥을 깐다: 카메라가 위 64·아래 56px 더 내려가 맵 끝에 검은 빈 곳이 보였다(41차: 버그처럼 보인다)
    const M = 96;
    const rt = this.add.renderTexture(-M, -M, WORLD + 2 * M, WORLD + 2 * M).setOrigin(0).setDepth(-10);
    const stamp = this.make.image({ key: key + '_t', add: false });
    const c = WORLD / 2;
    // 가운데 광장·길 안쪽으로 들어간 거리(밖이면 음수)
    const inside = (x, y) => Math.max(190 - Math.hypot(x - c, y - c), 50 - Math.abs(x - c), 50 - Math.abs(y - c));
    // 바깥 바닥을 전부 깔고, 광장 바닥은 경계에서 서서히 짙어지게 겹친다(경계 타일을 쓰면 계단식 사각 패치로 보였다)
    if (key === 'tile9' || key === 'tile12') {
      // 9·12장 바닥은 160x120 한 장이 통째로 이어지는 그림이라 회전·광장 겹침 없이 깐다(칸을 섞으면 사각 이음새가 보였다)
      const big = this.make.image({ key, add: false }).setOrigin(0);
      for (let y = 0; y < WORLD + 2 * M; y += ts.height) for (let x = 0; x < WORLD + 2 * M; x += ts.width) rt.draw(big, x, y);
      big.destroy();
    } else
    for (let y = -M; y < WORLD + M; y += T) for (let x = -M; x < WORLD + M; x += T) {
      const n = Math.random(), cx = x + T / 2, cy = y + T / 2;
      // 3번 그림(밝은 변종)은 3장부터 색을 입히면 사각으로 튄다
      stamp.setFrame(n < 0.85 || this.c >= 2 ? Phaser.Math.RND.pick([0, 2]) : 3).setAngle(R(0, 3) * 90).setAlpha(1);
      rt.draw(stamp, cx + M, cy + M);
      const a = Phaser.Math.Clamp((inside(cx, cy) + T * 0.8) / (T * 2.4), 0, 1);
      if (a <= 0) continue;
      stamp.setFrame(Math.random() < 0.85 ? R(4, 5) : R(8, 9)).setAngle(R(0, 3) * 90).setAlpha(a * a);
      rt.draw(stamp, cx + M, cy + M);
    }
    stamp.setAlpha(1);
    // 못 가는 바깥은 어둡게 덮어 끝이라는 걸 보인다
    this.add.graphics().setDepth(-9).fillStyle(0x000000, 0.5).fillRect(-M, -M, WORLD + 2 * M, M).fillRect(-M, WORLD, WORLD + 2 * M, M).fillRect(-M, 0, M, WORLD).fillRect(WORLD, 0, M, WORLD);
    // 전용 바닥 그림이 없는 챕터는 1챕터 바닥에 색을 입힌다
    const TINT = [0xffffff, 0x8a9ab8, 0xd07050, 0xd8f0ff, 0x9a70b0];
    const decoTint = this.ch.deco ?? (this.c ? TINT[this.c] : 0xffffff);   // 6장부터는 장 데이터의 deco 색
    let floorTint = 0xffffff;
    if (this.hard) floorTint = 0xd87a7a;   // 어려움은 바닥이 붉게 물든다
    else if (!tintless && this.c > 0) floorTint = TINT[this.c] ?? 0xffffff;
    else if (this.s === 1 && !this.endless && !this.mode) floorTint = 0xb8c0dc;   // x-2는 바닥을 식혀 x-1과 다른 곳처럼
    if (floorTint !== 0xffffff) rt.setTint(floorTint);
    // 세로로 긴 폰(390x844)에서 게임 판 위아래 남는 띠를 같은 바닥으로 채운다
    setBackdrop(this, key, floorTint);
    this.events.once('shutdown', clearBackdrop);
    if (!this.textures.exists('decos')) {
      const ds = this.textures.get('deco').getSourceImage();
      this.textures.addSpriteSheet('decos', ds, { frameWidth: ds.width / 4, frameHeight: ds.height });
    }
    this.torches = [];
    const hasProp = this.textures.exists('prop' + (this.c + 1));   // 장 테마 소품이 있으면 더 촘촘히(6~15장이 한 틀로 보이던 걸 줄인다)
    for (let i = 0; i < (hasProp ? 190 : 90); i++) {
      const x = R(0, WORLD), y = R(0, WORLD);
      if (Math.hypot(x - c, y - c) < (hasProp ? 150 : 220)) continue;
      // 6~15장은 장 테마 소품(prop<장>, 3종), 없으면 풀숲·기둥
      const pk = 'prop' + (this.c + 1);
      if (this.textures.exists(pk)) { if (!this.textures.exists(pk + '_f')) { const ps = this.textures.get(pk).getSourceImage(); this.textures.addSpriteSheet(pk + '_f', ps, { frameWidth: ps.width / 3, frameHeight: ps.height }); } this.add.image(x, y, pk + '_f', R(0, 2)).setOrigin(0.5, 1).setDepth(10 + y / WORLD); }
      else this.add.image(x, y, 'decos', R(0, 2)).setOrigin(0.5, 1).setDepth(10 + y / WORLD).setTint(decoTint);
    }
    // 50차: 지키기·점령에서는 가운데 둘레의 장식 횃불을 치운다(거점·수레와 똑같이 보여 헷갈렸다)
    for (let a = 0; a < 8 && !(this.mode && (this.mode.id === 'guard' || this.mode.id === 'capture')); a++) {
      const x = c + Math.cos(a * Math.PI / 4) * 200, y = c + Math.sin(a * Math.PI / 4) * 200;
      this.add.image(x, y, 'decos', 3).setOrigin(0.5, 1).setDepth(10 + y / WORLD);
      this.torches.push({ x, y: y - 40 });
    }
    // 어두운 화면 + 빛
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(50);
    this.darkKey = [];   // 어둠 그림에 쓴 값(주인공·횃불 위치, 빛 크기, 어둠 농도): 같으면 다시 안 그린다
    // x-2는 조금 더 어둡다. 0.2를 더하면 2장·5장이 0.8이 돼 몹이 안 보였다
    this.darkA = Math.min(0.62, this.ch.dark + (this.s === 1 && !this.endless && !this.mode ? 0.1 : 0));
    this.glow = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(this.hard ? 0xff3a3a : this.ch.light).setAlpha(this.hard ? 0.22 : 0.16).setDepth(49);
  }

  makeHero() {
    const sv = this.sv;
    this.maxHp = D.PLAYER.hp * (1 + this.tv('hp')) * (1 + 0.15 * this.sv.tier);   // 무기 등급이 오르면 체력도 오른다(tv('hp')에 장비·스탯 체력도 들어 있다)
    this.hp = this.maxHp;
    this.hero = this.physics.add.sprite(WORLD / 2, WORLD / 2, 'hero2_r0s').play('idle');
    dressHero(this.hero, this.cosLook);
    // 46차: 주인공 그림을 1.3배로 키운다(전투에서 작아 안 보였다). 피격 판정은 그대로 두려고 몸 상자는 같은 비율로 줄인다
    this.HS = 1.3; this.hero.setScale(this.HS); this.hero.bs = this.HS;
    this.hero.body.setSize(this.hero.width * 0.45 / this.HS, this.hero.height * 0.35 / this.HS).setOffset(this.hero.width * (0.5 - 0.225 / this.HS), this.hero.height * (0.775 - 0.175 / this.HS));
    this.hero.setCollideWorldBounds(true);
    this.heroShadow = this.add.image(0, 0, 'shadow').setScale(1.6 * 1.3, 1.4 * 1.3);
    // 47차: 증기·불꽃 속에서도 보이게 — 발밑 어두운 그림자 원을 늘 깔고, 몸에 1px 어두운 외곽선을 두른다(주인공은 효과보다 위 층)
    this.heroDisc = this.add.ellipse(0, 0, 30 * 1.3, 11 * 1.3, 0x000000, 0.6).setDepth(HERO_D - 0.6);
    this.hero.preFX?.addGlow(0x000000, 1.5, 0, false, 0.1, 6);
    // 몹 떼 속에서도 내 캐릭터가 바로 보이게 발밑에 밝은 고리
    // 고리 색은 강화 단계를 따른다(+5 파랑, +10 주황, +15 보라). +10부터는 몸에도 빛이 돈다
    const rc = sv.enh >= 15 ? 0xd06bff : sv.enh >= 10 ? 0xff8a2a : sv.enh >= 5 ? 0x5fc8ff : 0x9ae6ff;
    this.heroRing = this.add.ellipse(0, 0, 24 * 1.3, 10 * 1.3, rc, 0.18).setStrokeStyle(2, rc, 1).setDepth(HERO_D - 0.4);
    // +10 각성부터 발밑에 강화 색 기운이 맥박친다(+15는 더 크고 잔상이 남는다)
    if (sv.enh >= 10) {
      this.heroAura = this.add.image(0, 0, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(rc).setDepth(9.5).setAlpha(0.5).setScale(sv.enh >= 15 ? 1.2 : 0.9, sv.enh >= 15 ? 0.55 : 0.42);
      this.tweens.add({ targets: this.heroAura, alpha: 0.2, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    // 몹 더미에 몸이 가려도 머리 위 작은 화살표로 어디 있는지 보인다
    this.heroMark = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 5, rc).setStrokeStyle(1, 0x000000, 0.6).setDepth(HERO_D + 2);
    // 영웅 스킨: 몸 색을 바꾼다
    if (!this.hero.cosBody && heroSkin(sv).id) skinFx(this.hero, heroSkin(sv));
    if (sv.enh >= 10) this.hero.preFX?.addGlow(rc, sv.enh >= 15 ? 3 : 2, 0, false, 0.1, 8);
    // 주인공 그림은 검을 들고 있다: 다른 무기면 손에 그 무기 그림을 겹쳐 든다
    const wk = weaponKey(this.cosLook, this.wtype.id, sv.tier);
    this.heroWeapon = this.textures.exists(wk) ? this.add.image(0, 0, wk) : null;
    this.heroSword = this.wtype.id === 'sword' || !!this.cosLook.weapon;
    if (this.heroWeapon) {
      // 검은 등급마다 다른 그림(w_sword0~9)을 손잡이 끝으로 쥔다. +5·+10·+15를 넘으면 검이 커지고 강화 색으로 빛난다
      const eb = sv.enh >= 15 ? 3 : sv.enh >= 10 ? 2 : sv.enh >= 5 ? 1 : 0, sz = (this.heroSword ? 17 + 1.6 * sv.tier + 2 * eb : 16) * 1.45;   // 46차: 손에 든 무기·무기 스킨을 한 번 더 키운다(주인공 1.3배보다 더)   // 45차: 검 단계가 오를수록 손에 든 검이 눈에 띄게 커진다(0단계 17 → 9단계 31+)
      this.heroWeapon.setScale(sz / Math.max(this.heroWeapon.width, this.heroWeapon.height));   // 6단계 이후 그림은 16칸보다 크다
      if (this.heroSword) {
        this.heroWeapon.setOrigin(0.2, 0.8);
        if (eb) this.heroWeapon.preFX?.addGlow(rc, eb, 0, false, 0.1, 6);
      }
    }
    this.cosActor = new CosmeticActor(this, this.hero, this.cosLook);
    this.cosActor.effect ||= ({ crimson: 'ember', shadow: 'star', jade: 'leaf', paladin: 'gold', demon: 'ember' })[sv.hskin];
    this.events.once('shutdown', () => { this.cosActor?.destroy(); this.cosActor = null; });
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
    const n0 = this.children.length, ins = insetsGame(this.game);
    this.makeHud0(ins);
    // 50차: 안전 영역·토스 X 버튼 회피 — 왼쪽 HUD는 인셋만큼, 오른쪽 HUD(처치·은화·일시정지)는 X 버튼 아래로 내린다
    for (const o of this.children.list.slice(n0)) {
      if (o.scrollFactorX !== 0 || o.y == null || o.y <= 0.5 || o.y >= 70) continue;
      o.y += o.x >= 170 ? ins.xTop : ins.top;
    }
  }
  makeHud0(ins) {
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
    this.lvTxt = sf(this.add.text(8, 31, 'Lv 1', font(10, '#f2e4bc')));
    // 콤보는 가운데 위(오른쪽 숫자 밑에 붙어 처치 수와 헷갈렸다)
    this.comboTxt = sf(this.add.text(W - 57, 52, '', font(11, '#ffb347')).setOrigin(0.5).setAlpha(0));   // 스킬 아이콘 줄(왼쪽 위)과 겹치지 않게 처치 칸 아래
    // 시간은 HP 칸(끝 108)과 처치 칸(시작 182) 사이 가운데: 화면 가운데(135)면 '남은 0:33'이 HP 칸에 붙었다(40차)
    this.timeTxt = sf(this.add.text(145, 16, '', font(14)).setOrigin(0.5));
    this.waveTxt = sf(this.add.text(145, 31, '', font(9, '#a1b2b6')).setOrigin(0.5));
    // 처치·은화: 점 아이콘만으로는 무슨 숫자인지 몰랐다. 글자 이름을 붙인다
    sf(this.add.rectangle(W - 88, 7, 62, 34, 0x000000, 0.45).setOrigin(0));
    sf(this.add.text(W - 85, 17, t('battle.5e9c0f'), font9(10, '#a1b2b6')).setOrigin(0, 0.5));
    sf(this.add.text(W - 85, 32, t('battle.ce69a8'), font9(10, '#a1b2b6')).setOrigin(0, 0.5));
    this.killTxt = sf(this.add.text(W - 30, 17, '0', font(10, '#ffffff')).setOrigin(1, 0.5));
    this.silverTxt = sf(this.add.text(W - 30, 32, '0', font(10, '#ffffff')).setOrigin(1, 0.5));
    // 일시정지
    const pb = button(this, W - 13, 21, 18, 22, 'II', () => this.ui.pauseMenu(), { size: 9, color: 0x3a3846 });
    pb.setScrollFactor(0).setDepth(d);
    // 보유 스킬 아이콘 줄
    this.skillRow = this.add.container(8, 46).setScrollFactor(0).setDepth(d);
    // 궁극기 버튼(마나)
    const ux = W - 32, uy = H - 40 - ins.bottom;
    this.ultBase = sf(this.add.circle(ux, uy, 22, 0x1c2935, 0.9).setStrokeStyle(2, 0x475c66));
    this.ultFill = sf(this.add.graphics());
    this.ultIcon = sf(icon(this, ux, uy, 4, 22));
    this.ultTxt = sf(this.add.text(ux, uy + 28, t('battle.f0a3b5'), font(9, '#a1b2b6')).setOrigin(0.5));
    this.ultBase.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.ult());
    this.ultPos = { x: ux, y: uy };
    this.showUlt = v => [this.ultBase, this.ultFill, this.ultIcon, this.ultTxt, this.ultTip, this.ultTip?.ring].forEach(o => o?.setVisible(v));
    this.bossBar = null; this.bannerObjs = null; this.bannerQ = [];
    this.refreshSkillRow();
  }

  refreshSkillRow() {
    this.skillRow.removeAll(true);
    Object.entries(this.run.skills).forEach(([k, lv], i) => {
      const x = (i % 8) * 20, y = Math.floor(i / 8) * 20;   // 한 칸 18(전엔 15): 작아서 뭔지 안 보였다(+20%)
      const evo = this.run.evo[k];
      this.skillRow.add(this.add.rectangle(x, y, 18, 18, evo ? 0x5a3a08 : 0x000000, 0.6).setOrigin(0).setStrokeStyle(1, evo ? 0xff9a3a : D.SKILLS[k].type === 'active' ? 0x6fd3ff : 0xffd75e, evo ? 1 : 0.7));
      this.skillRow.add(skillIcon(this, x + 9, y + 9, D.SKILLS[k], 16));
      this.skillRow.add(this.add.text(x + 18, y + 18, evo ? '★' : lv, font(8, evo ? '#ffd75e' : '#ffffff')).setOrigin(1, 1));
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
    // 앞 배너가 떠 있으면 줄을 세워 하나씩 띄운다(39차: 맵·변종·각성 배너가 겹쳐 덮였다)
    if (this.bannerObjs) { if ((this.bannerQ ||= []).length < 3) this.bannerQ.push([big, small]); return; }
    const y = 150;
    const b = this.add.rectangle(W / 2, y, W, 46, 0x000000, 0.7).setScrollFactor(0).setDepth(110).setScale(1, 0).setAlpha(0);   // 글자보다 띠가 먼저 떠 '가로 어두운 띠'로 보였다(43차): 띠도 글자와 함께 나타난다
    const t1 = this.add.text(W / 2, y - 7, big, font(15, '#ffd75e', 4)).setOrigin(0.5).setScrollFactor(0).setDepth(111).setAlpha(0);
    // 45차: 긴 규칙 글(15장 모루 등)이 좌우로 잘렸다 — 폭 안에서 줄을 바꾸고 띠를 글 높이만큼 키운다
    const t2 = this.add.text(W / 2, y + 5, small, { ...font9(11, '#ffffff'), wordWrap: { width: W - 28 }, align: 'center' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(111).setAlpha(0);
    const extra = Math.max(0, t2.height - 14);
    b.setSize(W, 46 + extra).setPosition(W / 2, y + extra / 2);
    this.tweens.add({ targets: b, scaleY: 1, alpha: 0.7, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: [t1, t2], alpha: 1, x: { from: W / 2 - 20, to: W / 2 }, duration: 200, delay: 0 });
    this.bannerObjs = [b, t1, t2];
    this.tweens.add({ targets: [b, t1, t2], alpha: 0, delay: 1500, duration: 300, onComplete: () => { [b, t1, t2].forEach(o => o.destroy()); if (this.bannerObjs?.[0] === b) this.bannerObjs = null; const n = this.bannerQ?.shift(); if (n && !this.over) this.banner(...n); } });
  }

  // 처음 두 판: 이동 방법을 3초 보여 준다
  dragHint() {
    const t = this.add.text(W / 2, H - 120, tt('battle.04bd37'), font(12, '#ffffff')).setOrigin(0.5).setScrollFactor(0).setDepth(120);
    const hand = this.add.circle(W / 2 - 30, H - 90, 9, 0xffffff, 0.5).setStrokeStyle(2, 0xffffff).setScrollFactor(0).setDepth(120);
    this.tweens.add({ targets: hand, x: W / 2 + 30, duration: 700, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
    this.hint = [t, hand];
    this.tweens.add({ targets: [t, hand], alpha: 0, delay: 3000, duration: 400, onComplete: () => { t.destroy(); hand.destroy(); this.hint = null; } });
  }

  // ── 스폰 ──
  spawnPoint(min = 200, max = 250) {
    const mp = this.mode?.spawnPoint(min, max); if (mp) return mp;
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
    if (this.mode) return this.mode.progress();
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
    const vm = (this.mod?.id === 'mutant' ? 2 : 1) * (this.hard ? 2 : 1);   // 어려움은 변종이 두 배
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
    m.maxHp = m.hp = m0.hp * this.mobHpMul * D.timeHp(this.progress()) * (elite ? 8 : 1) * tower[0] * (v?.hp || 1) * (opt.mini ? 0.35 : 1) * (opt.weak || 1) * (this.mod?.hp || 1);
    m.dmg = m0.dmg * this.mobDmgMul * (elite ? 1.2 : 1) * tower[1];
    m.spd = m0.spd * (1 + 0.04 * this.c) * RF(0.9, 1.1) * (v?.spd || 1) * (opt.mini ? 1.2 : 1) * (this.mod?.spd || 1);
    if (v?.ai) m.ai = v.ai;
    m.kbRes = v?.kb ?? (m.ai === 'tank' ? 0.45 : elite ? 0.3 : 1);
    m.variant = opt.mini ? null : vk; m.bs = (elite ? 1.5 : 1) * (v?.scale || 1) * (opt.mini ? 0.65 : 1);
    m.color = m0.color; m.kb = 0; m.slow = 0; m.freeze = 0; m.curse = 0; m.marked = 0; m.tint0 = undefined; m.phase = RF(0, 6); m.t = 0;
    m.hitBy = {};
    this.env?.mobInit(m);
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
    this.mode?.onSpawn(m);
    return m;
  }

  // 뱀서식 포위: 떼거리가 원을 그리며 한꺼번에 몰려온다
  // 대열: 화면 한쪽 가장자리를 붉게 깜빡여 알린 뒤 그쪽에서 줄·떼로 나온다. 그만큼 일반 스폰을 덜어 난이도는 그대로
  // 47차 새 이벤트 — 몹 습격: 한쪽 가장자리가 붉게 깜빡이며 경고, 2.5초 뒤부터 10초 동안 그쪽에서 대열이 계속 밀려온다(기존 몹 그림·대열 재사용)
  raid() {
    const a = R(0, 3) * Math.PI / 2;
    this.banner(t('battle.ca7fa0'), t('battle.d501f9', { v: [t('battle.16f66a'), t('battle.0ab5e2'), t('battle.2df94c'), t('battle.5eb553')][a / (Math.PI / 2)] }));
    sfx('warn', 300);
    const ex = Math.cos(a), ey = Math.sin(a), horiz = Math.abs(ex) > Math.abs(ey);
    const bar = this.add.rectangle(horiz ? (ex > 0 ? W - 4 : 4) : W / 2, horiz ? H / 2 : (ey > 0 ? H - 4 : 4), horiz ? 8 : W, horiz ? H : 8, 0xff3030, 0.75).setScrollFactor(0).setDepth(60);
    this.tweens.add({ targets: bar, alpha: 0.15, duration: 180, yoyo: true, repeat: 6, onComplete: () => bar.destroy() });
    raidFlag(this, ex, ey, 2600);
    for (let k = 0; k < 8; k++) this.time.delayedCall(2500 + k * 1250, () => { if (!this.over && !this.bossPhase) this.formation(a + RF(-0.25, 0.25)); });
    this.time.delayedCall(2500 + 8 * 1250, () => !this.over && toast(this, t('battle.b92bff'), '#5fdc6a', 96));
  }

  formation(ang) {
    const a = ang ?? (R(0, 3) * Math.PI / 2 + RF(-0.3, 0.3)), p = a + Math.PI / 2, type = R(0, 2);
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
    const base = this.atk * mult * (1 + this.tv('atk') + r.bDmg + 0.1 * (r.skills.might || 0) + this.lv3('might', 0.1)) * (this.env?.atkMul() ?? 1) * (tag === 'pet' ? 1 : this.wM) * (this.wtype.id === 'axe' && this.gear.fx.has('axe4') && this.hp < this.maxHp / 2 ? 1.3 : 1) * RF(0.9, 1.1);
    return { dmg: Math.round(base * (crit ? 2 : 1)), crit };
  }

  // 50차: 최근 8초 실제 DPS(250ms 칸으로 묶고, 한 칸에 여러 마리를 때린 만큼 나눠 다수 타격을 보정)
  trackDps(d) {
    const k = (this.bt / 250) | 0, a = this.dpsBk || (this.dpsBk = []);
    let e = a[a.length - 1];
    if (!e || e.k !== k) { e = { k, d: 0, n: 0 }; a.push(e); if (a.length > 40) a.shift(); }
    e.d += d; e.n++;
  }
  realDps() {
    const a = this.dpsBk; if (!a || !a.length) return 0;
    const k = (this.bt / 250) | 0; let sum = 0;
    for (const e of a) if (e.k > k - 32) sum += e.d / (1 + 0.35 * (e.n - 1));
    return sum / Math.max(2, Math.min(8, this.bt / 1000));
  }

  // src: 같은 무기가 같은 몹을 너무 자주 때리지 않게 하는 키. kb: 밀려나는 세기
  // tag: 스킬 갈래(근접·원거리·마법·펫). 스탯 힘·민첩·지능이 갈래별 피해를 올린다
  hitMob(m, mult, { src = 'x', cd = 0, kb = 60, fx = 'small', from, tag } = {}) {
    if (!m.active || m.dead || m.dive) return false;   // 물귀신은 잠겨 있는 동안 맞지 않는다
    if (cd && this.bt - (m.hitBy[src] || -1e9) < cd) return false;
    m.hitBy[src] = this.bt;
    const { dmg, crit } = this.dmgCalc(mult, tag);
    const open = m.isBoss && m.expose > this.bt;   // 46차: 보스 페이즈 전환 뒤 짧게 약점이 드러난다 — 이때 맞으면 추가 피해
    if (open && this.bt - (this.weakAt || -1e9) > 260) { this.weakAt = this.bt; sfx('weak', 120); playOnce(this, 'weakpoint_break', m.x, m.y - m.displayHeight * 0.1, { sx: Math.max(1.4, m.displayWidth * 0.45 / 48), depth: 43 }); }
    let dealt = dmg * (m.weak || 1) * (m.curse > this.bt ? 1.2 : 1) * (m.marked > this.bt ? 1.4 : 1) * (open ? D.WEAK_MUL : 1);
    if (m.isBoss && m.shield > 0) dealt = m.bossAI.absorb(dealt, open);   // 49차: 쉴드 구간엔 약점이 열렸을 때 맞혀야 깎인다
    if (m.isBoss && m.invuln > this.bt) dealt = 0;   // 50차: 페이즈 전환 연출 동안 무적(1초 이내)
    this.trackDps(Math.min(dealt, Math.max(0, m.hp)));   // 과잉 피해는 뺀다
    m.hp -= dealt;
    if (m.isBoss) m.bossAI?.holdFloor?.();
    if (open && this.bt - (m.exposeTxt || 0) > 260) {
      m.exposeTxt = this.bt;
      const wt = this.add.text(m.x + RF(-14, 14), m.y - m.displayHeight * 0.35, t('battle.6fbdb2'), font(10, '#ffe060', 3)).setOrigin(0.5).setDepth(39);
      this.tweens.add({ targets: wt, y: wt.y - 18, alpha: 0, duration: 520, onComplete: () => wt.destroy() });
    }
    // 44차: 새 장은 몹 체력이 커서 첫 몹이 쓰러지기까지 30초가 걸려 Lv1에 머물렀다(9-1). 2장부터 Lv3 전까진 때릴 때마다 경험치가 조금씩 찬다(처치 경험치는 그대로, 70번 베면 1 → 첫 레벨업 15초 안팎)
    if (this.c >= 1 && !this.endless && this.run.lv < 3 && !m.isBoss && !m.mini && !this.over) this.fightXp = (this.fightXp || 0) + Math.min(0.5, mult / 70);   // 레벨업 창은 프레임 맨 앞에서 연다(맞히는 도중에 열지 않게)
    // 흰 번쩍임 + 찌그러짐
    // 보스는 몸집이 커서 흰 번쩍임이 화면을 덮는다: 붉게만 물들인다
    // 13장(폭풍 평원)은 번개·붉은 원과 겹쳐 흰 덩어리가 몹을 지웠다: 옅은 푸른빛으로 짧게만 번쩍인다
    const calmFx = this.env?.kind === 'storm';
    if (m.isBoss) m.setTint(0xff8a8a); else m.setTintFill(calmFx ? 0xc8d4f0 : 0xffffff);
    this.time.delayedCall(calmFx ? 40 : 60, () => { if (m.active && !m.dead) { m.clearTint(); if (m.baseTint !== 0xffffff) m.setTint(m.baseTint); } });
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
        .setScale((crit ? 1.1 : 0.7) * (calmFx ? 0.6 : 1)).setAlpha(calmFx ? 0.65 : 1).setRotation(RF(0, 6.28)).play('fxHit');
      s.once('animationcomplete', () => s.destroy());
      if (crit) {
        const c2 = this.add.sprite(m.x, m.y, 'fx2_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setScale(0.8).play('fxCrit');
        c2.once('animationcomplete', () => c2.destroy());
      }
      if (this.spark.getAliveParticleCount() < 50) this.spark.explode(crit ? 8 : 4, m.x, m.y);
    } else if (this.spark.getAliveParticleCount() < 50) this.spark.explode(3, m.x, m.y);
    this.popup(m.x, m.y - 12, dmg, crit, fx === 'big', m);
    sfx(crit ? 'crit' : 'hit', 45, 1 + 0.1 * Math.min(3, Math.floor(this.sv.enh / 5)));
    if (m.parryUntil > this.bt) this.env?.onHit(m);
    if (m.hp <= 0) this.kill(m);
    return true;
  }

  // 한 번 쓰고 버리던 스프라이트(시체·연기)를 되살려 쓴다: 처치마다 객체를 새로 만들고 지우느라 GC가 끊겼다
  fxGet(x, y, key, frame) {
    const sp = this.fxFree.pop();
    if (!sp) return this.add.sprite(x, y, key, frame);
    return sp.setActive(true).setVisible(true).setTexture(key, frame).setPosition(x, y).setAlpha(1).setScale(1).setAngle(0).setFlip(false, false)
      .clearTint().setBlendMode(Phaser.BlendModes.NORMAL);
  }
  fxFree_(sp) {
    if (!sp.active) return;
    this.tweens.killTweensOf(sp); sp.off('animationcomplete'); sp.anims.stop();
    sp.setActive(false).setVisible(false); this.fxFree.push(sp);
  }

  // 같은 칸(64px) 안의 몹만 훑으려고 프레임 처음에 한 번 격자에 담는다
  rebuildMobs() {
    const live = this.liveMobs, cells = this.gridCells, used = this.gridUsed;
    live.length = 0;
    for (let i = 0; i < used.length; i++) used[i].length = 0;
    used.length = 0;
    for (const m of this.mobs.getChildren()) {
      if (m.dead || !m.active) continue;
      live.push(m);
      const k = (Math.floor(m.x / 64) + 2) * 128 + Math.floor(m.y / 64) + 2;
      let c = cells.get(k);
      if (!c) cells.set(k, c = []);
      if (!c.length) used.push(c);
      c.push(m);
    }
  }
  // (x,y) 반지름 r 안쪽 칸에 든 몹(거리는 부른 쪽이 따로 잰다). r은 64 이하로 쓴다
  mobsNear(x, y, r) {
    const out = [], cells = this.gridCells;
    const x0 = Math.floor((x - r) / 64) + 2, x1 = Math.floor((x + r) / 64) + 2, y0 = Math.floor((y - r) / 64) + 2, y1 = Math.floor((y + r) / 64) + 2;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const c = cells.get(cx * 128 + cy);
      if (c) for (let i = 0; i < c.length; i++) { const m = c[i]; if (!m.dead && m.active) out.push(m); }
    }
    return out;
  }

  popup(x, y, n, crit, big, m) {
    // 화면이 숫자로 덮이지 않게: 치명타와 큰 숫자(100 이상)만 띄우고, 5개를 넘으면 오래된 것부터 지운다
    // 같은 몹을 0.4초 안에 또 때리면 새로 띄우지 않고 합산해 한 숫자로 보여 준다
    // 왼쪽 위 스킬 아이콘 줄(HUD) 밑에 깔려 겹쳐 보이는 숫자는 띄우지 않는다
    const vr = viewRect(this);
    // 49차: 숫자 크기는 '큰 한방'(치명타이거나 최근 평균의 2.5배 이상)만 크게, 나머지는 작고 옅게 — 590만·165만이 같은 크기로 겹쳐 떴다
    this.popRef = this.popRef ? this.popRef * 0.95 + n * 0.05 : n;
    this.popN = (this.popN || 0) + 1;
    const major = crit || (this.popN > 12 && n >= this.popRef * 2.5);
    // 44차: 상단 HUD 줄(82px) 안쪽엔 폭 전체에 띄우지 않는다('만' 글자가 '남은 1:16'에 걸렸다)
    if (y - vr.y < 82) y = vr.y + 82;   // 50차: HUD 줄 안쪽이면 버리지 않고 바로 아래로 내려 띄운다
    const pp = m && m._pop;
    if (pp && pp.t.active && pp.t.pop === pp && this.bt - pp.at < 650) {   // 45차: 같은 몹 합산 창 0.4→0.65초
      pp.n += n; pp.at = this.bt; pp.crit = pp.crit || crit;
      pp.t.setText(fmt(pp.n)).setAlpha(pp.major || pp.crit ? 1 : 0.6).setScale(pp.major || pp.crit ? 1.25 : 1.1);
      if (pp.crit) pp.t.setColor('#ffd23f');
      this.tweens.add({ targets: pp.t, scale: 1, duration: 90 });
      return;
    }
    // 48차: 다른 몹이어도 0.3초 안·64px 안에서 큰 숫자가 연달아 뜨면 한 숫자로 합친다(화면이 숫자로 덮이는 것 방지)
    const pl = this.popLast;
    if (pl && pl.t.active && pl.t.pop === pl && this.bt - pl.at < 300 && Math.hypot(pl.t.x - x, pl.t.y - y) < 64) {
      pl.n += n; pl.at = this.bt; pl.crit = pl.crit || crit;
      pl.t.setText(fmt(pl.n)).setAlpha(pl.major || pl.crit ? 1 : 0.6).setScale(pl.major || pl.crit ? 1.2 : 1.1); if (pl.crit) pl.t.setColor('#ffd23f');
      this.tweens.add({ targets: pl.t, scale: 1, duration: 90 });
      return;
    }
    // 50차: 숫자를 버리지 않는다 — 위의 합치기로 줄이고, 동시 8개를 넘으면 가장 오래된 것부터 지운다
    if (this.popups.length >= 8) this.popFree_(this.popups.shift());
    // 44차: 다른 몹의 숫자와 겹치면('7754 7779') 위로 비켜 띄운다. 세 칸을 올려도 겹치면 일반 타격은 접는다
    for (let k = 0; k < 4; k++) {
      const hit = this.popups.some(o => o.active && Math.abs(o.x - x) < 38 && Math.abs(o.y - y) < 11);
      if (!hit) break;
      if (k === 3) break;
      y -= 12;
    }
    // 46차: 큰 숫자가 주인공을 가렸다 — 주인공 반경(34px) 안에서 뜨는 숫자는 머리 위로 밀어 올린다
    { const hh = this.hero, hr = 34; if (Math.hypot(x - hh.x, y - hh.y) < hr) y = hh.y - hr - 6 - Math.abs(x - hh.x) * 0.1;
      // 50차: 큰 숫자(치명타·큰 한방)는 주인공 몸 위에 겹쳐 떴다 — 몸 가로폭 안이면 머리·무기 위로 띄운다
      if ((major || crit) && Math.abs(x - hh.x) < 52 && y > hh.y - 74 && y < hh.y + 30) y = hh.y - 74; }
    // 50차: 같은 시점의 큰 숫자는 하나만 — 0.5초 안에 또 큰 숫자가 뜨면 더 큰 쪽 하나만 남긴다
    if (major || crit) {
      const bl = this.bigLast;
      if (bl && bl.t.active && bl.t.visible && this.bt - bl.at < 500) {
        if (n > bl.n) { bl.n = n; bl.at = this.bt; bl.t.setText(fmt(n)).setPosition(x, Math.min(y, bl.t.y)); if (crit) bl.t.setColor('#ffd23f'); }
        return;
      }
    }
    if (y - vr.y < 82) y = vr.y + 82;
    const st = font(crit ? 14 : major ? 12 : 8, crit ? '#ffd23f' : major ? '#ffffff' : '#c9d2de', crit ? 3 : major ? 2 : 1);
    let t = this.popFree.pop();
    const a0 = major ? 1 : 0.55, s0 = crit ? 1.6 : major ? 1.3 : 1;
    if (t) t.setActive(true).setVisible(true).setAlpha(a0).setStyle(st).setText(fmt(n)).setPosition(x + R(-6, 6), y).setScale(s0);
    else t = this.add.text(x + R(-6, 6), y, fmt(n), st).setOrigin(0.5).setDepth(40).setAlpha(a0).setScale(s0);
    this.popups.push(t);
    t.pop = null;
    t.pop = this.popLast = { t, n, at: this.bt, crit, major };
    if (major || crit) this.bigLast = { t, n, at: this.bt };
    if (m) m._pop = t.pop;
    this.tweens.add({ targets: t, scale: 1, duration: 110, ease: 'Back.Out' });
    this.tweens.add({
      targets: t, y: y - 16, alpha: 0, delay: crit ? 380 : 420, duration: 300,
      onComplete: () => { const i = this.popups.indexOf(t); if (i >= 0) { this.popups.splice(i, 1); this.popFree_(t); } },
    });
  }

  // 48차: 보스가 화면 밖에 있으면 화면 가장자리에 그쪽을 가리키는 화살표를 띄운다(15장처럼 큰 보스가 시야 밖일 때)
  bossArrow_() {
    const m = this.boss?.m, vr = viewRect(this);
    const off = m && m.active && !m.dead && !vr.contains(m.x, m.y);
    if (!off) { if (this.bArrow) this.bArrow.setVisible(false); return; }
    if (!this.bArrow) {
      const g = this.add.graphics().setScrollFactor(0).setDepth(61);
      g.fillStyle(0xff4040, 0.95).lineStyle(2, 0x2a0a0a, 1).fillTriangle(10, 0, -8, -9, -8, 9).strokeTriangle(10, 0, -8, -9, -8, 9);
      const t = this.add.text(0, 0, tt('battle.792e7e'), font(9, '#ffd0d0', 2)).setOrigin(0.5).setScrollFactor(0).setDepth(61);
      this.bArrow = this.add.container(0, 0, [g, t]).setScrollFactor(0).setDepth(61);
      this.bArrowTxt = t; this.bArrow.g = g;
    }
    const cx = vr.centerX, cy = vr.centerY, dx = m.x - cx, dy = m.y - cy;
    const hw = vr.width / 2 - 20, hh = vr.height / 2 - 70;   // 위쪽은 HUD 줄을 피해 70px 안쪽
    const k = Math.min(hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
    const sx = (cx + dx * k - vr.x) / vr.width * W, sy = (cy + dy * k - vr.y) / vr.height * H;
    const ang = Math.atan2(dy, dx);
    this.bArrow.setVisible(true).setPosition(sx, sy).setAlpha(0.7 + 0.3 * Math.sin(this.bt / 120));
    this.bArrow.g.setRotation(ang);
    this.bArrowTxt.setPosition(-Math.cos(ang) * 16, -Math.sin(ang) * 16);
  }

  popFree_(t) {
    if (!t.active) return;
    this.tweens.killTweensOf(t); t.setActive(false).setVisible(false); this.popFree.push(t);
  }

  kill(m) {
    if (!m.dead) this.cosActor?.emit('kill');
    m.dead = true; m.body.enable = false;
    const r = this.run;
    r.kills++; this.sv.stats.kills++; mission('kill');
    if (!m.mini && !m.goblin && !m.bat) dexKill(this.sv, m.kind);   // 도감(갈라진 새끼·이벤트 몹은 빼고)
    r.mana = Math.min(D.MANA_MAX, r.mana + (m.elite ? D.MANA_ELITE : D.MANA_KILL));
    sfx('kill', 50);
    if (m.isBoss) { m.bossAI.die(); return; }
    this.env?.mobKill(m);
    // 연속 처치: 1.2초 안에 이어 잡으면 콤보가 쌓인다
    this.combo = this.bt - (this.lastKillT || -1e9) < 1200 ? (this.combo || 0) + 1 : 1; this.lastKillT = this.bt;
    if (this.combo >= 10) { this.comboTxt.setText(t('battle.76126e', { combo: this.combo })).setAlpha(1).setScale(1.35); this.tweens.add({ targets: this.comboTxt, scale: 1, duration: 120 }); }
    // 정예를 잡으면 잠깐 멈추고 번쩍인다
    if (m.elite) { this.hitstop = 110; this.cameras.main.shake(140, 0.008); this.cameras.main.flash(90, 255, 230, 160); }
    // +10부터는 쓰러뜨린 자리에도 불티가 튄다(+15는 더 자주)
    const g = this.weapons.enhGlow();
    if (g.ember && Math.random() < (this.sv.enh >= 15 ? 0.6 : 0.35)) this.weapons.embers(m.x, m.y, g.tint);
    // 쓰러지는 그림(전용 시트가 있으면 무너짐, 없으면 흰빛으로 부풀었다 사라짐)
    // 시체가 칼 맞은 반대쪽으로 튕겨 나간다
    const ka = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, m.x, m.y), kd = m.elite ? 10 : 18;
    if (this.anims.exists(m.kind + 'Die')) {
      const c = this.fxGet(m.x, m.y, m.texture.key).setFlipX(m.flipX).setDepth(9).setScale(m.scaleX).setTintFill(0xffffff).play(m.kind + 'Die');
      this.tweens.add({ targets: c, x: m.x + Math.cos(ka) * kd, y: m.y + Math.sin(ka) * kd, angle: Math.cos(ka) > 0 ? 25 : -25, duration: 180, ease: 'Quad.Out' });
      this.time.delayedCall(60, () => c.active && c.clearTint());
      c.once('animationcomplete', () => this.tweens.add({ targets: c, alpha: 0, delay: 250, duration: 400, onComplete: () => this.fxFree_(c) }));
    } else {
      const c = this.fxGet(m.x, m.y, m.texture.key, m.frame.name).setFlipX(m.flipX).setDepth(9).setScale(m.scaleX).setTintFill(0xffffff);
      this.tweens.add({ targets: c, x: m.x + Math.cos(ka) * kd, y: m.y + Math.sin(ka) * kd, angle: Math.cos(ka) > 0 ? 40 : -40, scaleX: c.scaleX * 1.4, scaleY: c.scaleY * 0.2, alpha: 0, duration: 220, ease: 'Quad.In', onComplete: () => this.fxFree_(c) });
    }
    this.goo.setParticleTint(m.color); if (this.goo.getAliveParticleCount() < 70) this.goo.explode(m.elite ? 14 : 6, m.x, m.y);
    if (m.variant === 'split') for (const d of [-7, 7]) this.spawn(true, m.kind, { force: true, mini: true, at: { x: m.x + d, y: m.y + R(-4, 4) } })?.setTint(D.VARIANTS.split.tint);
    if (m.variant === 'burst') this.burst(m.x, m.y, m.dmg);
    const sm = this.fxGet(m.x, m.y - 2, 'fx1_r2s').setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setAlpha(0.35).setScale(m.elite ? 1 : 0.5).setTint(m.color).play('fxSmoke');
    sm.once('animationcomplete', () => this.fxFree_(sm));
    if (m.goblin) this.goblinDown(m);
    this.drop(m);
    if (m.orb) this.addGem(m.x, m.y, Math.max(10, Math.ceil(D.xpNeed(this.run.lv) * 0.35)));   // 50차: 중간보스 소환 졸개는 레벨업 구슬
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
      const far = this.farthest(this.gems.getChildren());
      far.v += v; far.setTexture(far.v >= 10 ? 'gem3' : far.v >= 3 ? 'gem2' : 'gem1');
      return;
    }
    const g = this.gems.create(x + R(-3, 3), y + R(-3, 3), v >= 10 ? 'gem3' : v >= 2 ? 'gem2' : 'gem1').setDepth(8);
    g.v = v; g.hopH = 6; g.hopMs = 140; g.hopT = 0; g.hopOff = 0;   // 튀어 오르는 연출은 트윈 대신 updatePickups에서 계산한다(보석마다 트윈이 하나씩 붙어 있었다)
  }

  // 목록에서 주인공과 가장 먼 것(제곱거리로 한 번씩만 잰다)
  farthest(list) {
    const h = this.hero; let far = null, fd = -1;
    for (let i = 0; i < list.length; i++) { const o = list[i], dx = o.x - h.x, dy = o.y - h.y, d = dx * dx + dy * dy; if (d > fd) { fd = d; far = o; } }
    return far;
  }

  addItem(x, y, kind, v = 1) {
    // 은화가 60개를 넘게 쌓이면 가장 먼 은화에 값을 합친다(보석처럼): 후반 판에 100개 넘게 쌓여 그리고 훑는 값이 컸다
    if (kind === 'silver') {
      const list = this.items.getChildren(), sil = [];
      for (let i = 0; i < list.length; i++) if (list[i].kind === 'silver' && list[i].active) sil.push(list[i]);
      if (sil.length >= 60) { this.farthest(sil).v += v; return null; }
    }
    const it = this.items.create(x, y, kind).setDepth(8);
    it.kind = kind; it.v = v; it.hopH = 8; it.hopMs = 160; it.hopT = 0; it.hopOff = 0;
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
    const t = this.add.text(this.hero.x, this.hero.y - 34, `${rr.name} ${itemName(item)}`, font(10, rr.css)).setOrigin(0.5).setDepth(40);
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
    if (!quiet) this.banner(t('battle.79680e'), t('battle.10bd3e'));
    sfx('warn', 300);
    this.log('goblin_spawn', { quiet });
  }

  // ── 깜짝 이벤트 ──
  surprise(kind) {
    this.log('event', { kind });
    if (kind === 'goblin') return this.spawnGoblin();
    if (kind === 'raid') return this.raid();
    if (kind === 'bats') {
      // 황금 박쥐 떼: 빠르고 약하다. 8초 안에 잡으면 은화·경험치가 쏟아진다
      for (let i = 0; i < 6; i++) {
        const m = this.spawn(true, 'bat', { force: true });
        if (!m) continue;
        m.goblin = true; m.bat = true; m.goblinT = 8000; m.maxHp = m.hp = m.hp * 2; m.spd = 72; m.dmg = 0;
        m.setTint(0xffd75e); m.baseTint = 0xffd75e; m.preFX?.addGlow(0xffd75e, 2, 0, false, 0.1, 6);
      }
      this.banner(tt('battle.504a24'), tt('battle.781e2f')); sfx('warn', 300);
      return;
    }
    // 축복의 제단: 근처에 빛 기둥. 그 안에 2초 서 있으면 버프
    const a = RF(0, Math.PI * 2), x = Phaser.Math.Clamp(this.hero.x + Math.cos(a) * 80, 30, WORLD - 30), y = Phaser.Math.Clamp(this.hero.y + Math.sin(a) * 80, 30, WORLD - 30);
    const g = this.add.container(x, y).setDepth(7);
    const glow = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).setScale(0.22).setAlpha(0.7);
    const ring = this.add.circle(0, 0, 22, 0xffd75e, 0.12).setStrokeStyle(2, 0xffd75e, 0.9);
    const arc = this.add.graphics();
    const t = this.add.text(0, -32, tt('battle.0e1ee0'), font(9, '#ffd75e')).setOrigin(0.5);
    g.add([glow, ring, arc, t]);
    this.tweens.add({ targets: glow, scale: 0.28, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    this.shrine = { g, arc, x, y, t: 0, life: 15000 };
    this.banner(tt('battle.1569b7'), tt('battle.f9e798')); sfx('level');
  }
  updateShrine(dt) {
    const r = this.run, sh = this.shrine;
    if (this.buffUntil && this.bt > this.buffUntil) {
      const b = D.EVENTS.shrineBuff; r.bDmg -= b.dmg; r.bSpd -= b.spd; this.buffUntil = 0; this.buffTxt?.setText('');
      toast(this, t('battle.dc9f95'), '#a1b2b6', 96);
    } else if (this.buffUntil) this.buffTxt?.setText(t('battle.ecc7c2', { ceil: Math.ceil((this.buffUntil - this.bt) / 1000) }));
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
      this.banner(t('battle.78424b'), t('battle.f0353b', { v: b.ms / 1000, v2: b.dmg * 100, v3: b.spd * 100 })); sfx('level');
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
    this.hero.setTint(0x9dff9d); this.heroWeapon?.setTint(0x9dff9d); this.time.delayedCall(120, () => { this.hero.clearTint(); this.heroWeapon?.clearTint(); });
  }

  gainXp(v) {
    const r = this.run;
    r.xp += v;
    sfx('gem', 35);
    if (r.xp >= D.xpNeed(r.lv)) {
      r.xp -= D.xpNeed(r.lv); r.lv++;
      this.log('level_up', { wave: this.wave });
      this.lvTxt.setText('Lv ' + r.lv);
      // 3~5레벨과 7레벨부터 홀수 레벨(7·9·11…)을 카드 없이 자동 소강화로 넘긴다: 한 판 카드 창을 4~5번으로(49차, 80초에 7번 떴다). 2레벨 카드로 첫 스킬을 먼저 고른다. 성장 레벨 수는 같다. 진화가 열렸으면 창을 연다
      if (((r.lv >= 3 && r.lv <= 5) || (r.lv >= 7 && r.lv % 2 === 1)) && !this.ui.evoReady()) this.ui.autoLevel();
      else this.ui.levelUp();
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
    // 폰에서는 짧게 떨어 맞은 걸 손으로도 느끼게 한다(38차: 위험이 안 느껴졌다)
    buzz(30);
    this.hero.setTint(0xff7070); this.heroWeapon?.setTint(0xff7070); this.time.delayedCall(90, () => { this.hero.clearTint(); this.heroWeapon?.clearTint(); });
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
    if (this.gear.fx.has('duck')) { const q = this.add.text(this.hero.x + 10, this.hero.y - 30, tt('battle.ecb167'), font(10, '#ffe066')).setOrigin(0.5).setDepth(40); this.tweens.add({ targets: q, y: q.y - 12, alpha: 0, duration: 600, onComplete: () => q.destroy() }); }
    if (this.hp <= 0) this.die();
  }

  die(final = false) {
    if (this.practice) return this.practiceEnd(false);
    if (!final && this.run.revive > 0) {
      this.run.revive--;
      this.log('revive_done', { via: 'train' });
      this.hp = this.maxHp * 0.5;
      this.blast(6, true);
      this.banner(t('battle.8117f7'), t('battle.8d93c5'));
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
    if (this.heroWeapon) this.tweens.add({ targets: this.heroWeapon, alpha: 0, duration: 300 });
    this.cameras.main.flash(300, 120, 0, 0);
    this.time.delayedCall(900, () => this.ui.result(false));
  }

  reviveNow() {
    this.run.revived = true;
    this.log('revive_done', { via: 'offer' });
    this.hp = this.maxHp * 0.5;
    this.iframe = this.bt + 2000;
    this.blast(6, true);
    this.banner(t('battle.8117f7'), t('battle.8d93c5'));
  }

  // ── 궁극기: 화면 전체 베기 + 2초 무적 ──
  ult() {
    if (this.paused || this.over || this.run.mana < D.MANA_MAX) return;
    this.run.mana = 0;
    if (!this.sv.tut.ult) { this.sv.tut.ult = true; save(); }
    if (this.ultTip) { this.tweens.killTweensOf(this.ultTip); this.ultTip.ring?.destroy(); this.ultTip.destroy(); }
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

  // ── 47차: 꾸미기 체험 연습장(30초) ──
  practiceStart() {
    const it = cosmetic(this.cosTrial);
    this.banner(t('battle.02ab04', { v: it ? it.name : '' }), t('battle.09ae55', { PRACTICE_SEC: D.PRACTICE_SEC }));
    this.pracTxt = this.add.text(W / 2, 34, '', font(10, '#9ae0ff', 3)).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.events.on('update', () => { if (this.pracTxt?.active && !this.over) this.pracTxt.setText(t('battle.0e5133', { max: Math.max(0, Math.ceil((this.waveLen - this.waveT) / 1000)) })); });
    this.log('practice_start', { id: this.cosTrial });
  }
  practiceEnd(done) {
    if (this.over) return; this.over = true;
    const sv = this.sv, it = cosmetic(this.cosTrial), id = this.cosTrial;
    this.physics.pause(); this.ebullets.clear(true, true); stopBgm();
    this.log('practice_end', { id, done });
    this.time.delayedCall(done ? 500 : 900, () => this.ui.practiceCard(it, done));
  }

  // ── 웨이브 ──
  endWave() {
    if (this.practice) return this.practiceEnd(true);
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
        if (this.isBoss) { this.shopShown = true; this.ui.shop(() => this.startBoss()); }
        else this.ui.result(true);
      } else if (this.endless) this.ui.shop(() => this.banner(t('battle.bb3f12', { v: this.wave + 1 }), this.wave % 3 === 2 ? t('battle.67af2f') : t('battle.e6d721')));
      else {
        const next = () => this.banner(t('battle.d3ec9b', { v: this.wave + 1, waveCount: this.waveCount }), this.wave === this.waveCount - 1 ? t('battle.0986a8') : t('battle.39fc0b'));
        // 맨 처음 판은 상인을 건너뛴다: 80초 판 한가운데 4칸 상점이 흐름을 끊었다(41차)
        // 47차: 상인 창은 판당 한 번 — 일반 판은 첫 웨이브 뒤, 보스 판은 보스 직전(아래 분기)에만
        if (this.firstRun || this.shopShown || this.isBoss || this.wave !== 1) next(); else { this.shopShown = true; this.ui.shop(next); }
      }
    });
  }

  startBoss() {
    this.bossPhase = true;
    this.log('boss_start', { boss: this.ch.boss });
    sfx('bossIn');
    this.cameras.main.shake(800, 0.006);
    const b = D.BOSSES[this.ch.boss];
    this.banner(b.name, t('battle.b5263b'));
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
    this.mobCollider.active = (this.frameN = (this.frameN || 0) + 1) % 2 === 0;
    this.rebuildMobs();
    this.bossArrow_();
    const r = this.run;
    if (this.fightXp > 0) { const fx = this.fightXp; this.fightXp = 0; if (r.lv < 3) this.gainXp(fx); }
    // 45차: 장과 무관하게 첫 레벨업은 늦어도 약 12초 안에 온다. 9장은 순풍에 떠밀려 몹 곁에 못 서 38초 Lv1이었다(7장 19초·10장 16초). 4초부터 8초 동안 Lv2분(3) 경험치가 시간으로 찬다
    if (r.lv < 2 && !this.endless && !this.dungeon && this.bt > 4000) { this.trickXp = (this.trickXp || 0) + dt * 3 / 8000; if (this.trickXp >= 0.3) { const tx = this.trickXp; this.trickXp = 0; this.gainXp(tx); } }

    // 웨이브 시간(모드 판은 modes.js가 스폰·승패를 맡는다)
    if (this.mode) this.mode.update(dt);
    else if (!this.bossPhase) {
      this.waveT += dt;
      // 50차: 중간 보스가 아직 살아 있으면 웨이브를 끝내지 않고 기다린다(보스가 약 1분 버티는데 웨이브 시간이 먼저 끝났다). 최대 100초까지
      if (this.waveT >= this.waveLen && this.midBoss && !this.endless && (this.midWait = (this.midWait || 0) + dt) < 100000) this.waveT = this.waveLen - 1;
      else if (this.waveT >= this.waveLen) { this.waveT = 0; this.endWave(); return; }
      // 스폰: 초당 2.5 → 끝날 즈음 5.5마리(초반 몹은 약하고 많게)
      const f = this.progress();
      // x-1은 판 시작 20초에 초당 2마리를 더 내보낸다: 첫 판 초반 화면이 비어 지루했다(뒤 스테이지는 원래 많다)
      // 단 1-1은 처음 30초를 반쯤 비운다(25마리 → 22초에 69마리로 늘어 첫 판이 정신없었다)
      const first11 = !this.endless && this.c === 0 && this.s === 0 && this.bt < 30000;
      const early = !this.endless && this.s === 0 && this.bt < 20000 ? (this.easy ? 3 : 2) : 0;   // 첫 판 80초 처치 35라 심심했다(40차)
      // 44차: 2장부터는 첫 25초에 몹이 0.4배에서 차오른다(시작하자마자 에워싸이던 것을 완화)
      const ramp = this.c >= 1 && !this.endless && !this.dungeon ? Math.min(1, 0.4 + this.bt / 25000 * 0.6) : 1;
      this.spawnAcc = (this.spawnAcc || 0) + dt * (2.5 + early + D.stageSpawn(this.endless ? 0 : this.s) + 5 * f) * (this.dungeon ? 1.6 : 1) * ramp / 1000;   // 던전은 잡을 몹이 많아야 한다
      // 화면에 70마리가 넘으면 더 내보내지 않는다(3장에서 89마리까지 쌓여 저사양 폰이 버거웠다)
      while (this.spawnAcc >= 1) { this.spawnAcc--; if (this.mobs.countActive() < (first11 ? (this.easy ? 38 : 42) : Math.min(70, ramp < 1 ? 30 + this.bt / 1000 * 1.6 : 70))) this.spawn(); }   // 2장부터 첫 25초는 동시 몹 상한도 30마리에서 차오른다(44차)
      // 웨이브마다 엘리트 1마리(중간), 포위는 웨이브 2부터
      if (!this.eliteDone && this.waveT > this.waveLen * (this.wave + this.c + this.s === 0 ? 0.55 : 0.5)) { this.eliteDone = true; this.spawn(false, this.ch.mobs[1], { elite: true, force: true }); }
      // 1-1 마지막 웨이브 후반: 다음 장 몹이 두 마리 잠깐 얼굴을 비춘다('앞으로 더 있다'). 약하게 줘서 난이도는 그대로
      if (!this.tasteDone && this.c === 0 && this.s === 0 && !this.endless && !this.hard && !this.dungeon && this.wave === this.waveCount - 1 && this.waveT > this.waveLen * 0.62) {
        this.tasteDone = true;
        const nx = D.CHAPTERS[1];
        if (nx) {
          for (let i = 0; i < 2; i++) { const m = this.spawn(false, nx.mobs[i % 2], { force: true }); if (m) { m.maxHp = m.hp = m.hp * 0.6; m.dmg *= 0.5; m.preFX?.addGlow(0xff6a8a, 2, 0, false, 0.1, 8); } }
          this.banner(t('battle.0b4f7f'), t('battle.ead9a5', { name: nx.name }));
          this.log('taste_next', { ch: 1 });
        }
      }
      if (this.eventAt != null && !this.eventDone && this.progress() >= this.eventAt) { this.eventDone = true; this.surprise(this.eventKind); }
      // 던전: 15초마다 보물 고블린(알림 없이)
      if (this.dungeon && this.bt >= (this.dunGobT ??= D.DUNGEON.goblinSec * 1000)) { this.dunGobT += D.DUNGEON.goblinSec * 1000; this.spawnGoblin(true); }
      if (this.wave >= 1 && !this.ringDone && this.waveT > this.waveLen * 0.25) { this.ringDone = true; this.encircle(); }
      if (this.waveT < dt * 2) { this.eliteDone = false; this.ringDone = false; }
      // 15초마다 한쪽에서 대열이 밀려온다(그냥 몰려오기만 하지 않게). 처음 판의 1-1은 뺀다
      if (!this.easy && (this.formT = (this.formT || 0) + dt) > 15000) { this.formT = 0; this.formation(); }
      // x-2는 마지막 웨이브에 해골 장군(중간 보스)
      const towerBoss = this.endless && this.wave % 3 === 2 && this.midWave !== this.wave && !this.midBoss;
      // 처음 판(1-1)도 마지막 웨이브 후반에 약한 해골 장군이 나온다: 끝이 밋밋하게 시간만 다 됐다(40차)
      const easyBoss = this.easy && this.wave === this.waveCount - 1 && !this.midDone && this.waveT > this.waveLen * 0.45;
      if (easyBoss || (towerBoss || this.s === 1 && !this.endless && this.wave === this.waveCount - 1 && !this.midDone) && this.waveT > this.waveLen * 0.3) {
        this.midDone = true; this.midWave = this.wave; this.midBoss = new BossAI(this, 'general', this.mobHpMul * (this.endless ? Math.pow(D.ENDLESS.hpGrow, this.wave) : 1) * (easyBoss ? 0.4 : 1), true, easyBoss);
        this.banner(t('battle.20631e'), t('battle.a76043')); sfx('bossIn');
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
    this.env?.update(dt);
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
    const spd = D.PLAYER.spd * (1 + this.tv('spd') + 0.08 * (r.skills.haste || 0) + this.lv3('haste', 0.08) + r.bSpd) * (this.env?.spdMul() ?? 1) * (this.mode?.spdMul() ?? 1);
    // 출발·정지를 짧게 보간해 뻣뻣하지 않게(손가락을 따라 미끄러지듯)
    const ease = 1 - Math.pow(1 - (v.length() > 0.1 ? 0.3 : 0.4), dt / 16.7);
    this.mv ||= { x: 0, y: 0 };
    this.mv.x += (v.x * spd - this.mv.x) * ease; this.mv.y += (v.y * spd - this.mv.y) * ease;
    let vx = this.mv.x, vy = this.mv.y;
    if (this.lunge && this.lunge.t > 0) { vx += this.lunge.x; vy += this.lunge.y; this.lunge.t -= dt; }
    const ev = this.env?.vel(); if (ev) { vx += ev.x; vy += ev.y; }   // 바람·돌풍·끌어당김
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
    if (!slashing) h.setScale(this.HS, this.HS * (moving ? 1 : 1 + Math.sin(this.walkT) * 0.025));
    h.setAlpha(this.bt < this.iframe && Math.floor(this.bt / 60) % 2 ? 0.55 : 1);
    h.setDepth(HERO_D + h.y / WORLD);
    if (moving && this.bt - (this.lastDust || 0) > 170) { this.lastDust = this.bt; this.dust.explode(3, h.x - v.x * 6, h.y + h.displayHeight / 2 - 3); }
    this.heroRing.setPosition(h.x, h.y + h.displayHeight / 2 - 2);
    if (this.heroAura) this.heroAura.setPosition(h.x, h.y + h.displayHeight / 2 - 2);
    // +15 각성: 움직이면 강화 색 잔상이 남는다
    if (moving && this.sv.enh >= 15 && this.bt - (this.lastGhost || 0) > 90) {
      this.lastGhost = this.bt;
      const gh = this.add.image(h.x, h.y, h.texture.key, h.frame.name).setFlipX(h.flipX).setScale(h.scaleX, h.scaleY).setTint(0xd06bff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(h.depth - 0.01);
      this.tweens.add({ targets: gh, alpha: 0, duration: 260, onComplete: () => gh.destroy() });
    }
    this.heroMark.setPosition(h.x, h.y - h.displayHeight / 2 - 4 + Math.sin(this.bt / 160) * 1.5);
    this.heroShadow.setPosition(h.x, h.y + h.displayHeight / 2 - 2).setScale(1.6 * 1.3 * (1 - bob * 2), 1.4 * 1.3).setDepth(HERO_D - 0.5);
    this.heroDisc.setPosition(h.x, h.y + h.displayHeight / 2 - 2);
    if (this.heroWeapon) {
      const k = h.anims.currentAnim?.key, f = h.flipX ? -1 : 1;
      if (this.heroSword) {
        placeHeld(h, this.heroWeapon, bob);
      } else {
        // 손 자리: 앞모습은 왼쪽 아래, 뒷모습은 오른쪽(몸 뒤), 옆모습·서 있기는 바라보는 쪽, 휘두를 땐 앞으로 뻗는다
        const [ox, oy, ang] = k === 'walkFront' ? [-9, 6, -20] : k === 'walkUp' ? [9, 5, 20] : k === 'slash' ? [13 * f, 0, 40 * f] : [6 * f, 7, 10 * f];
        this.heroWeapon.setPosition(h.x + ox, h.y + oy - bob * h.displayHeight).setFlipX(f < 0).setAngle(ang + h.angle)
          .setDepth(h.depth + (k === 'walkUp' ? -0.001 : 0.001)).setAlpha(h.alpha);
      }
    }
    this.cosActor?.update(dt, moving);
    this.moveV = v;
  }

  updateMobs(dt) {
    const h = this.hero;
    // 46차: 방위(12칸)마다 접근 슬롯 상한 — 한쪽 방위에 몹이 벽처럼 쌓이면 넘치는 몹은 빈 방위로 돌아 들어온다
    const SEC = 12, CAP = 5, cnt = this.secCnt ||= new Array(SEC);
    cnt.fill(0);
    const ml = this.mobs.getChildren();
    for (let i = 0; i < ml.length; i++) {
      const m = ml[i]; if (m.dead || m.isBoss || m.goblin || !m.active) { m.sec = -1; continue; }
      const dx = m.x - h.x, dy = m.y - h.y, dd = dx * dx + dy * dy;
      m.sec = dd < 190 * 190 && dd > 50 * 50 ? Math.floor(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / SEC)) : -1;
      if (m.sec >= 0) cnt[m.sec]++;
    }
    this.mobs.getChildren().forEach(m => {
      if (m.dead || m.isBoss) return;
      m.t += dt;
      const dp = 10 + m.y / WORLD;
      if (Math.abs(dp - m.depth) > 0.0006) m.setDepth(dp);   // 1px 넘게 움직였을 때만(깊이가 바뀔 때마다 표시 목록을 다시 정렬한다)
      if (m.mark) {
        m.mark.setPosition(m.x, m.y + m.markY);
        // 광폭 변종은 붉은 잔상을 남긴다
        if (m.variant === 'swift' && m.t - (m.trailT || 0) > 110) { m.trailT = m.t; const g = this.add.image(m.x, m.y, m.texture.key, m.frame.name).setFlipX(m.flipX).setScale(m.scaleX).setTintFill(0xff4040).setAlpha(0.35).setDepth(8); this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() }); }
      }
      m.setFlipX(m.x > h.x);
      this.env?.mobTick(m, dt);
      if (m.freeze > 0) { m.freeze -= dt; m.setVelocity(0, 0); m.anims.timeScale = 0; return; }
      m.anims.timeScale = m.slow > 0 ? 0.5 : 1;
      if (m.slow > 0) m.slow -= dt;
      if (m.kb > 0) { m.kb -= dt; m.body.velocity.scale(0.86); return; }
      if (this.env?.late?.move(m, dt)) return;   // 16~18장 몹의 돌진·정지 행동
      if (this.mode?.steer(m, dt)) return;   // 모드: 물건 노리기·거점 파수·도망 사냥감은 자기 움직임을 쓴다
      const spd = m.spd * (m.slow > 0 ? 0.5 : 1);
      let dx = h.x - m.x, dy = h.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      // 45차: 멀리서는 영웅 한 점이 아니라 몹마다 다른 각도의 링(반지름 34px)을 향해 와서 한 점에 40~60마리가 뭉치지 않는다. 가까워지면(50px) 영웅을 곧장 향한다
      if (m.slotT > 0) m.slotT -= dt;
      if (m.sec >= 0 && cnt[m.sec] > CAP && !(m.slotT > 0)) {
        for (let o = 1; o <= SEC / 2; o++) {
          const alt = [(m.sec + o) % SEC, (m.sec - o + SEC) % SEC].find(q => cnt[q] < CAP);
          if (alt !== undefined) { cnt[m.sec]--; cnt[alt]++; m.ringA = (alt + 0.5 + RF(-0.3, 0.3)) * Math.PI * 2 / SEC; m.slotT = 1100; break; }
        }
      }
      if (d > 50 && !m.goblin && m.ai !== 'ranged') {
        const re = m.slotT > 0, ra = re ? m.ringA : m.phase * 1.05;
        const k = re ? Math.min(1, d / 90) * 78 : Math.min(1, (d - 50) / 60) * 34, ex = h.x + Math.cos(ra) * k - m.x, ey = h.y + Math.sin(ra) * k - m.y, ed = Math.hypot(ex, ey) || 1;
        dx = ex / ed * d; dy = ey / ed * d;
      }
      // 보물 고블린은 반대로 달아나다 12초가 지나면 사라진다
      if (m.goblin) {
        m.goblinT -= dt;
        if (m.goblinT <= 0) { m.dead = true; m.body.enable = false; this.tweens.add({ targets: m, alpha: 0, scale: 0.2, duration: 300, onComplete: () => m.destroy() }); if (!m.bat && !this.dungeon) this.banner(t('battle.84781c'), t('battle.2fe850')); this.log('goblin_escape', { bat: !!m.bat }); return; }
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
        if (m.cd <= 0 && d < 200) { m.cd = 3000; if (!this.env?.shot(m, Math.atan2(dy, dx))) this.enemyShot(m.x, m.y, Math.atan2(dy, dx), 75, m.dmg); }
      } else m.setVelocity(dx / d * spd, dy / d * spd);
      this.separate(m);
    });
  }

  // 45차: 겹친 몹끼리 약하게 밀어낸다(기존 몹 격자 3x3칸 재사용, 이웃 6마리까지만 봐 저사양도 가볍다)
  separate(m) {
    const cells = this.gridCells, cx = Math.floor(m.x / 64) + 2, cy = Math.floor(m.y / 64) + 2, R = 22;
    let px = 0, py = 0, n = 0;
    for (let ix = -1; ix <= 1 && n < 6; ix++) for (let iy = -1; iy <= 1 && n < 6; iy++) {
      const c = cells.get((cx + ix) * 128 + cy + iy);
      if (!c) continue;
      for (let i = 0; i < c.length && n < 6; i++) {
        const o = c[i];
        if (o === m || o.dead) continue;
        let ox = m.x - o.x, oy = m.y - o.y;
        const d2 = ox * ox + oy * oy;
        if (d2 >= R * R) continue;
        let d = Math.sqrt(d2);
        if (d < 0.5) { ox = Math.cos(m.phase * 3); oy = Math.sin(m.phase * 3); d = 1; }
        const w = (R - d) / R / d;
        px += ox * w; py += oy * w; n++;
      }
    }
    if (n) { const b = m.body, f = m.spd * 1.0; b.velocity.x += px * f; b.velocity.y += py * f; }
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
    const pick = D.PLAYER.pickup * (1 + (['baby_dragon', 'chick', 'penguin_sled', 'snow_rabbit'].includes(this.cosLook.pet) ? 0.08 : 0) + this.tv('mag') + 0.3 * (r.skills.magnet || 0) + this.lv3('magnet', 0.4) + r.bPick);
    const hop = o => {   // 떨어질 때 살짝 튀는 연출(Quad.Out으로 올랐다 내려온다)
      if (o.hopT === undefined) return;
      o.hopT += dt;
      const p = o.hopT < o.hopMs ? o.hopT / o.hopMs : o.hopT < o.hopMs * 2 ? 2 - o.hopT / o.hopMs : 0;
      const off = -o.hopH * p * (2 - p);
      o.y += off - o.hopOff; o.hopOff = off;
      if (o.hopT >= o.hopMs * 2) o.hopT = undefined;
    };
    const pick2 = pick * pick, pick3 = pick * pick * 9, pickI = pick * 0.8, pickI2 = pickI * pickI;
    const gl = this.gems.getChildren();
    for (let i = gl.length - 1; i >= 0; i--) {   // 안에서 지우므로 뒤에서부터
      const g = gl[i];
      if (g.hopT !== undefined) hop(g);
      const dx = g.x - h.x, dy = g.y - h.y, d2 = dx * dx + dy * dy;
      // 끌리기 시작하면 빠르게 출발해 가속한다: 느릿하게 따라오면 흡수 쾌감이 없다(220에서 출발하니 사용자가 느리다고 했다)
      if (d2 < pick2 || g.pull) { g.pull = true; this.physics.moveToObject(g, h, Math.min(900, 360 + (g.sp = (g.sp || 0) + dt * 2.5))); }
      // 조금 먼 보석도 플레이어 이동 속도(84)보다 빨리 끌려온다: 몹에 둘러싸여 보석까지 못 가면 레벨이 멈췄다
      else if (d2 < pick3) this.physics.moveToObject(g, h, 160);
      else if (g.body.speed) g.setVelocity(0);
      if (d2 < 196) { this.gainXp(g.v); g.destroy(); }   // 한 프레임에 15px까지 움직여 10이면 지나쳤다 돌아왔다
    }
    const il = this.items.getChildren();
    for (let i = il.length - 1; i >= 0; i--) {
      const it = il[i];
      if (it.hopT !== undefined) hop(it);
      const dx = it.x - h.x, dy = it.y - h.y, d2 = dx * dx + dy * dy;
      if (d2 < pickI2 || it.pull) { it.pull = true; this.physics.moveToObject(it, h, Math.min(700, 300 + (it.sp = (it.sp || 0) + dt * 2))); }
      if (d2 < 144) this.pickup(it);
    }
    const bl = this.ebullets.getChildren();
    for (let i = bl.length - 1; i >= 0; i--) { const b = bl[i]; b.life -= dt; if (b.life <= 0) b.destroy(); }
  }

  updateHud(time) {
    if (this.comboTxt.alpha > 0 && this.bt - (this.lastKillT || 0) > 1200) this.comboTxt.setAlpha(Math.max(0, this.comboTxt.alpha - 0.05));
    const r = this.run, cam = this.cameras.main;
    this.xpBar.width = W * Math.min(1, r.xp / D.xpNeed(r.lv));
    const f = Math.max(0, this.hp / this.maxHp);
    this.hpBar.width = 76 * f;
    this.hpLag.width += (76 * f - this.hpLag.width) * 0.06;
    this.hpTxt.setText(`${Math.min(Math.ceil(Math.max(0, this.hp)), Math.round(this.maxHp))}/${Math.round(this.maxHp)}`);
    if (this.bossPhase) { this.timeTxt.setText(tt('battle.792e7e')); this.waveTxt.setText(''); }
    else {
      const left = Math.max(0, Math.ceil((this.waveLen - this.waveT) / 1000));
      this.timeTxt.setText(tt('battle.ee07c6', { floor: Math.floor(left / 60), padStart: String(left % 60).padStart(2, '0') }));   // 경과 시간으로 읽혔다
      this.timeTxt.setColor(left <= 5 ? '#ffd75e' : '#ffffff');
      this.waveTxt.setText(this.endless ? tt('battle.bb3f12', { v: this.wave + 1 }) : this.dungeon ? tt('battle.3e5a0b', { kills: r.kills, killNeed: D.DUNGEON.killNeed }) : tt('battle.7e0431', { v: this.hard ? tt('battle.79b7f1') : '', min: Math.min(this.wave + 1, this.waveCount), waveCount: this.waveCount }));
      if (this.dungeon) this.waveTxt.setColor(r.kills >= D.DUNGEON.killNeed ? '#5fdc6a' : '#a1b2b6');
    }
    this.mode?.hud();   // 모드 진행 표시(화면 위쪽)
    this.killTxt.setText(fmt(r.kills)); this.silverTxt.setText(fmt(r.silver));
    // 마나 링
    const mf = r.mana / D.MANA_MAX, full = mf >= 1;
    this.ultFill.clear().lineStyle(3, full ? 0xffd75e : 0x6fd3ff, 1)
      .beginPath().arc(this.ultPos.x, this.ultPos.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * mf).strokePath();
    this.ultIcon.setAlpha(full ? 1 : 0.45).setScale((full ? 1 + Math.sin(time / 120) * 0.08 : 1) * (this.ultIcon.baseScale ||= this.ultIcon.scaleX));
    // 궁극기를 한 번도 안 써 봤으면 처음 찼을 때 말풍선으로 짚어 준다
    if (full && !this.sv.tut.ult && !this.ultTip) {
      this.ultTip = this.add.text(this.ultPos.x - 28, this.ultPos.y, tt('battle.4f5189'), font(10, '#ffd75e')).setOrigin(1, 0.5).setBackgroundColor('#2a1e3a').setPadding(4, 2, 4, 2).setScrollFactor(0).setDepth(101);
      this.tweens.add({ targets: this.ultTip, x: '-=4', duration: 400, yoyo: true, repeat: -1 });
      // 말풍선만으론 안 눌렀다(38차): 버튼 둘레로 금빛 고리가 계속 퍼진다
      const ur = this.add.circle(this.ultPos.x, this.ultPos.y, 24).setStrokeStyle(3, 0xffd75e).setScrollFactor(0).setDepth(101);
      this.tweens.add({ targets: ur, scale: 1.8, alpha: 0, duration: 700, repeat: -1 });
      this.ultTip.ring = ur;
    }
    this.ultTxt.setText(full ? tt('battle.621771') : tt('battle.612a31', { floor: Math.floor(mf * 100) })).setColor(full ? '#ffd75e' : '#a1b2b6');
    // 조명
    this.glow.setPosition(this.hero.x, this.hero.y).setScale(1 + Math.sin(time / 120) * 0.03);
    const L = this.env?.lightK < 1 || this.env?.blackT > 0 ? this.env.light.setScale(this.env.blackT > 0 ? 0.4 : this.env.lightK) : null;   // 심연·일식은 밝히는 범위가 좁다
    // 어둠은 그림에 쓴 값(주인공·보이는 횃불 위치, 빛 크기, 농도)이 바뀐 프레임에만 다시 그린다.
    // 카메라가 주인공을 따라가 주인공은 거의 화면 한가운데에 있어, 대부분 프레임은 그대로다(전체 화면 패스를 건너뛴다)
    const key = this.darkKey, hx = Math.round(this.hero.x - cam.scrollX), hy = Math.round(this.hero.y - cam.scrollY);
    const ls = L ? Math.round(L.scaleX * 1000) : -1;
    let n = 0, same = key.length > 0 && key[0] === hx && key[1] === hy && key[2] === ls && key[3] === this.darkA;
    if (!same) { key[0] = hx; key[1] = hy; key[2] = ls; key[3] = this.darkA; }
    n = 4;
    for (const t of this.torches) {
      const sx = Math.round(t.x - cam.scrollX), sy = Math.round(t.y - cam.scrollY);
      if (sx > -150 && sy > -150 && sx < W + 150 && sy < H + 150) {
        if (key[n] !== sx || key[n + 1] !== sy) { same = false; key[n] = sx; key[n + 1] = sy; }
        n += 2;
      }
    }
    if (key.length !== n) { same = false; key.length = n; }
    if (same) return;
    this.dark.clear().fill(0x06040c, this.darkA);
    if (L) this.dark.erase(L, this.hero.x - cam.scrollX, this.hero.y - cam.scrollY); else this.dark.erase('light', this.hero.x - cam.scrollX - 150, this.hero.y - cam.scrollY - 150);
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
    const bd2 = this.mode?.botDir(); if (bd2) { ax += bd2.x; ay += bd2.y; }   // 모드 목표 쪽으로
    const v = new Phaser.Math.Vector2(ax, ay);
    this.joy.v.copy(v.length() > 0.15 ? v.normalize() : v.scale(0));
    if (this.run.mana >= D.MANA_MAX && (this.boss || this.mobs.countActive() > 40)) this.ult();
  }
}
