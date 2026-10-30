// 에셋 로딩, 애니메이션 등록, 코드로 그리는 작은 텍스처 생성
import { W, H, MOBS, BOSSES } from './data.js';
import { font, hiCam } from './ui.js';
import { makeWeaponTextures } from './wart.js';
import { updateGate, startCheck } from './updateGate.js';
import { bootSync } from './cloudSync.js';
import { loadFx2, makeFx2Anims } from './fx2.js';
import { MODE_SHEETS, MODE_IMAGES, CH_SHEETS } from './modeArt.js';
import { loadPetRoles, makePetRoleAnims } from './petRoles.js';
import { BODY_LOOKS, COS_ROWS, WEAPON_LOOKS, HEAD_LOOKS, CASH_PETS, AURAS } from './cosmetics.js';
import { t, tt } from './i18n.js';
import { load } from './save.js';
import { track } from './log.js';
import { isFirstRun } from './coach.js';
import { setSound, setMusic, setMusicLevel, setVib, unlock, primeAudio } from './sfx.js';

// 있으면 쓰고 없으면 대체 그림으로 돌린다(새 지역 그림이 아직 없을 때도 게임은 돌아가게)
const REQUIRED = ['hero_r0', 'hero_r1', 'hero_r2', 'hero2_r0', 'hero2_r1', 'hero2_r2', 'mob_r0', 'mob_r1', 'mob_r2',
  'mob2_r0', 'mob2_r1', 'mob2_r2', 'fx1_r0', 'fx1_r1', 'fx1_r2', 'fx2_r0', 'fx2_r1', 'fx2_r2', 'tiles', 'deco'];
// 6~15장 그림은 기존 그림의 색만 바꿔 만든다(tools/palette.py). 몹 시트 z6~z15(장당 3행), 보스 boss3~boss6, 바닥 tile6~tile15
const NEW_CH = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPTIONAL = ['z2', 'z3', 'z4', 'z5', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'mid1', 'mid2', 'mid3', 'mid4', 'mid5', 'mid6', ...NEW_CH.map(c => 'z' + c)].flatMap(k => [0, 1, 2].map(r => `${k}_r${r}`))
  .concat(['boss6_r0'], NEW_CH.map(c => 'tile' + c), NEW_CH.map(c => 'prop' + c), [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(c => 'lobby_bg' + c))
  .concat(['icons_r0', 'icons_r1', 'icons_r2', 'icons_r3', 'forge_bg', 'lobby_bg', 'bell', 'tile2', 'tile3', 'tile4', 'tile5']);
// 코드로 그리던 작은 그림을 대신하는 PNG(assets/icon). 있으면 makeTextures가 건너뛴다
// 16~18장 그림(assets/ch16-18): 키는 다른 장과 같은 규칙(z16_r0·tile16·prop16·lobby_bg16·boss16_r0), 공격 시트는 _attack, 보스 예고는 _telegraph
const LATE_CH = [16, 17, 18];
const LATE_IMAGES = LATE_CH.flatMap(c => [0, 1, 2].flatMap(r => [`z${c}_r${r}`, `z${c}_r${r}_attack`]).concat([`tile${c}`, `prop${c}`, `lobby_bg${c}`, `boss${c}_r0`, `boss${c}_r0_telegraph`]))
  .concat(['gimmick16_frost_vent', 'gimmick16_ice_patch', 'gimmick17_deck_vent', 'gimmick17_wind_sail', 'gimmick18_hourglass', 'gimmick18_stopped_clock']);
const ICONS = ['gemc', 'gs_helm', 'gs_armor', 'gs_boots', 'gs_ring', 'gs_collar', 'loot', 'chest', 'silver',
  'magnetItem', 'gem1', 'gem2', 'gem3', 'ebullet', 'fireball', 'ice', 'hammer', 'wave', 'dagger', 'orb'];
// 무기 그림 PNG(assets/weapon/<종류><등급>.png). 있으면 makeWeaponTextures가 건너뛴다
const WEAPONS = ['sword', 'spear', 'axe', 'bow', 'gun', 'knuckle', 'staff'];

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  init() { this.upd = startCheck(); }   // 버전 확인은 그림을 받는 동안 같이 돈다

  preload() {
    hiCam(this);
    // 로딩 배경(맨 먼저 받아 깔고, 아래 막대·글자는 그 위에)
    this.load.image('loading_bg', 'assets/loading_bg.png');
    this.load.once('filecomplete-image-loading_bg', () => this.add.image(0, 0, 'loading_bg').setOrigin(0).setDisplaySize(W, H).setDepth(-10));
    const bar = this.add.rectangle(W / 2 - 80, H / 2, 0, 6, 0xffd75e).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 164, 10).setStrokeStyle(1, 0x5b4f7a);
    this.add.text(W / 2, H / 2 - 20, tt('boot.e414a2'), font(16, '#ffd75e')).setOrigin(0.5);
    this.load.on('progress', v => { bar.width = 160 * v; });
    this.load.on('loaderror', f => console.warn('missing asset', f.key));
    for (const k of REQUIRED.concat(OPTIONAL)) this.load.image(k, `assets/${k}.png`);
    for (const [k, fw, fh] of MODE_SHEETS) this.load.spritesheet('ma_' + k, `assets/modes/${k}.png`, { frameWidth: fw, frameHeight: fh });   // 모드 그림(docs/modes_art.md)
    for (const [k, fw, fh] of CH_SHEETS) this.load.spritesheet('ma_' + k, `assets/modes/${k}.png`, { frameWidth: fw, frameHeight: fh });   // 3~15장 장 테마 그림(파일이 없으면 도형으로)
    for (const k of MODE_IMAGES) this.load.image('ma_' + k, `assets/modes/${k}.png`);
    for (const k of ['hero2_r0', 'hero2_r1', 'hero_r1', 'hero_r2', 'hero2_r2']) this.load.image('hn_' + k, `assets/hn_${k}.png`);   // 검을 지운 전투용 주인공(검은 Battle이 단계별로 쥔다)
    for (const it of BODY_LOOKS) COS_ROWS.forEach((w, row) => this.load.spritesheet(`cos_${it.id}_${row}`, `assets/${it.dir || 'cosmetics'}/${it.id}_${row}.png`, { frameWidth: w, frameHeight: 52 }));
    for (const it of [...WEAPON_LOOKS, ...HEAD_LOOKS]) this.load.image(`cos_${it.id}`, `assets/${it.dir || 'cosmetics'}/${it.id}.png`);
    for (const it of CASH_PETS) { this.load.spritesheet(`cos_${it.id}`, `assets/${it.dir || 'cosmetics'}/${it.id}.png`, { frameWidth: 28, frameHeight: 28 }); if (it.dir) this.load.spritesheet(`cos_${it.id}_slash`, `assets/${it.dir}/${it.id}_slash.png`, { frameWidth: 28, frameHeight: 28 }); }
    loadPetRoles(this);
    this.load.image('ban_ch16', 'assets/banner/chapter16_96.png'); this.load.image('ban_ch16_big', 'assets/banner/chapter16_150.png');
    this.load.spritesheet('cos_fx','assets/cosmetics/fx.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('cos_fx2', 'assets/cosmetics2/fx.png', { frameWidth: 16, frameHeight: 16 });
    for (const id of AURAS) this.load.spritesheet(`cos_aura_${id}`, `assets/cosmetics2/fx_${id}.png`, { frameWidth: 52, frameHeight: 52 });
    loadFx2(this);
    for (const k of LATE_IMAGES) this.load.image(k, `assets/ch16-18/${k}.png`);
    for (const k of ICONS) this.load.image(k, `assets/icon/${k}.png`);
    for (const id of WEAPONS) for (let t = 0; t < 10; t++) this.load.image(`w_${id}${t}`, `assets/weapon/${id}${t}.png`);
  }

  sheet(key, frames = 4) {
    if (!this.textures.exists(key)) return null;
    const img = this.textures.get(key).getSourceImage();
    if (this.textures.exists(key + 's')) return key + 's';
    this.textures.addSpriteSheet(key + 's', img, { frameWidth: Math.floor(img.width / frames), frameHeight: img.height });
    return key + 's';
  }

  // 몹 시트에 어두운 외곽선 한 겹을 굽는다(13장: 번개·피격 빛이 겹쳐 몹이 배경에 묻혔다). 프레임마다 따로 그려 이웃 프레임으로 번지지 않는다
  outline(key, frames = 4, color = '#0a0612') {
    if (!this.textures.exists(key)) return;
    const img = this.textures.get(key).getSourceImage(), fw = Math.floor(img.width / frames), fh = img.height;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = fh;
    const cx = cv.getContext('2d'), tmp = document.createElement('canvas'), tc = tmp.getContext('2d');
    tmp.width = fw; tmp.height = fh;
    for (let f = 0; f < frames; f++) {
      tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, fw, fh); tc.drawImage(img, f * fw, 0, fw, fh, 0, 0, fw, fh);
      tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, fw, fh);   // 같은 모양의 어두운 실루엣
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) cx.drawImage(tmp, f * fw + dx, dy);
      cx.drawImage(img, f * fw, 0, fw, fh, f * fw, 0, fw, fh);
    }
    this.textures.remove(key); this.textures.addCanvas(key, cv);
  }

  create() {
    for (let r = 0; r < 3; r++) { this.outline('z13_r' + r); this.outline('z12_r' + r); }
    const A = (key, sheet, rate, repeat = -1, frames) => sheet &&
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, frames ? { frames } : {}), frameRate: rate, repeat });
    // 전투 주인공은 검을 지운 시트(hn_)를 쓴다. 로비는 검이 그려진 원본 'idleL'
    const hn = k => this.sheet('hn_' + k) || this.sheet(k);
    A('walkFront', hn('hero2_r0'), 8);
    A('walkUp', hn('hero2_r1'), 8);
    A('walkSide', hn('hero_r1'), 8);
    A('slash', hn('hero_r2'), 26, 0);
    const pose = hn('hero2_r2');
    A('idle', pose, 2.5, -1, [2, 3]);
    A('hurtPose', pose, 1, 0, [0]);
    A('dashPose', pose, 1, 0, [1]);
    A('idleL', this.sheet('hero2_r2'), 2.5, -1, [2, 3]);
    A('fxSlash', this.sheet('fx1_r0'), 32, 0);
    A('fxHit', this.sheet('fx1_r1'), 30, 0);
    A('fxSmoke', this.sheet('fx1_r2'), 16, 0);
    A('fxCrit', this.sheet('fx2_r0'), 22, 0);
    A('fxSpin', this.sheet('fx2_r1'), 20, 0);
    A('fxPillar', this.sheet('fx2_r2'), 10, 0);
    makeFx2Anims(this);
    for (let i = 0; i < 4; i++) this.sheet('icons_r' + i);

    // 몬스터: 전용 그림이 없으면 1챕터 같은 줄 몬스터를 색만 바꿔 쓴다
    const fallback = {};
    for (const [key, m] of Object.entries(MOBS)) {
      let sh = this.sheet(`${m.sheet}_r${m.row}`);
      if (!sh) { sh = this.sheet(`mob_r${m.row}`); fallback[key] = true; }
      A(key, sh, m.ai === 'swarm' ? 10 : m.ai === 'tank' ? 6 : 7);
      if (m.lateCh) A(key + 'Atk', this.sheet(`${m.sheet}_r${m.row}_attack`), 9);   // 16~18장 몹의 공격 준비·발동 그림
      if (m.die !== undefined) {
        const d = this.sheet('mob2_r' + m.die);
        A(key + 'Hurt', d, 1, 0, [0]);
        A(key + 'Die', d, 14, 0, [0, 1, 2, 3]);
      }
    }
    for (const [key, b] of Object.entries(BOSSES)) {
      let sh = this.sheet(`${b.sheet}_r${b.row}`, 2);
      if (!sh) { sh = this.sheet('mob_r' + (b.row % 3)); fallback[key] = true; }
      A(key, sh, 3);
      if (b.lateCh && !b.mid) A(key + 'Tele', this.sheet(`${b.sheet}_r${b.row}_telegraph`, 2), 5);   // 16~18장 보스의 패턴 예고 그림
    }
    for (const it of CASH_PETS) { A(`pet_${it.id}`, `cos_${it.id}`, 6); if (it.dir) A(`pet_${it.id}_slash`, `cos_${it.id}_slash`, 10, 0); }
    makePetRoleAnims(this);
    for (const id of AURAS) A(`aura_${id}`, `cos_aura_${id}`, 8);
    this.registry.set('fallback', fallback);
    this.makeTextures();
    updateGate(this, this.upd).then(async go => { if (go && !(await bootSync().catch(() => false))) this.enter(); });   // 서버 저장이 이 기기보다 앞서면 받아서 화면을 다시 불러온다   // 강제 업데이트면 여기서 멈춘다
  }

  // 처음 켠 사람(한 판도 안 함)은 로비를 건너뛰고 곧바로 1-1. 이동·자동 공격은 전투의 손가락 표시(dragHint)가 알려 준다. 나머지는 로비
  enter() {
    const sv = load();
    if (!isFirstRun(sv) || new URLSearchParams(location.search).has('lobby')) return this.scene.start('Lobby');
    setSound(sv.sound); setMusicLevel(sv.musicLvl); setMusic(!sv.musicOff && sv.sound !== false); setVib(!sv.vibOff);   // 로비가 하던 소리 설정을 대신
    this.game.canvas.addEventListener('pointerdown', () => unlock(), { once: true });
    const go = () => { primeAudio('battle', 0); track('first_run_direct'); this.scene.start('Battle', { chapter: 0, stage: 0 }); };
    const q = new URLSearchParams(location.search);
    if (q.has('bot') || q.has('nogate')) return go();
    // 54차: 아이폰은 드래그로 끝난 터치로는 소리를 못 켠다(움직이지 않은 탭만). 첫 판이 곧바로 드래그 전투라 시작 탭을 한 번 받는다
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(900);
    const tip = this.add.text(W / 2, H / 2 + 40, tt('boot.7b30bf'), font(14, '#ffffff')).setOrigin(0.5).setDepth(901);
    this.tweens.add({ targets: tip, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    const up = p => {
      if (Math.hypot(p.upX - p.downX, p.upY - p.downY) > 12) return;   // 끌었다 뗀 건 탭이 아니다
      this.input.off('pointerup', up); go();
    };
    this.input.on('pointerup', up);
  }

  // 픽셀 단위로 직접 그리는 작은 그림들
  makeTextures() {
    const g = this.make.graphics({ add: false });
    const tex = (key, w, h, draw) => { if (this.textures.exists(key)) return; g.clear(); draw(g); g.generateTexture(key, w, h); };
    tex('px', 2, 2, g => g.fillStyle(0xffffff).fillRect(0, 0, 2, 2));
    // 경험치 보석: 작은 파랑, 중간 초록, 큰 빨강
    const gem = (key, c1, c2) => tex(key, 6, 8, g => {
      g.fillStyle(0x0a0710).fillRect(2, 0, 2, 1).fillRect(1, 1, 4, 1).fillRect(0, 2, 6, 4).fillRect(1, 6, 4, 1).fillRect(2, 7, 2, 1);
      g.fillStyle(c1).fillRect(2, 1, 2, 1).fillRect(1, 2, 4, 4).fillRect(2, 6, 2, 1);
      g.fillStyle(c2).fillRect(2, 2, 1, 2);
    });
    gem('gem1', 0x3fa8ff, 0xd8f4ff); gem('gem2', 0x3fdc5a, 0xe0ffd8); gem('gem3', 0xff4060, 0xffe0e8);
    tex('silver', 6, 6, g => {
      g.fillStyle(0x0a0710).fillCircle(3, 3, 3);
      g.fillStyle(0xc8d0e0).fillCircle(3, 3, 2.4);
      g.fillStyle(0xffffff).fillRect(2, 1, 1, 2);
    });
    // 체력 포션(키는 예전 고기 그대로): 빨간 물약병에 흰 십자
    tex('meat', 12, 15, g => {
      g.fillStyle(0x0a0710).fillRect(3, 0, 6, 5).fillRoundedRect(0, 4, 12, 11, 4);
      g.fillStyle(0x9a6a3a).fillRect(4, 1, 4, 2);
      g.fillStyle(0xcfe8f0).fillRect(4, 3, 4, 2);
      g.fillStyle(0xe8283a).fillRoundedRect(1, 5, 10, 9, 3);
      g.fillStyle(0xff7080).fillRect(2, 6, 2, 3);
      g.fillStyle(0xffffff).fillRect(5, 7, 2, 6).fillRect(3, 9, 6, 2);
    });
    tex('magnetItem', 10, 10, g => {
      g.fillStyle(0x0a0710).fillRect(0, 0, 10, 10);
      g.fillStyle(0xe8343a).fillRect(1, 1, 3, 7).fillRect(6, 1, 3, 7).fillRect(1, 5, 8, 3);
      g.fillStyle(0xdddddd).fillRect(1, 1, 3, 2).fillRect(6, 1, 3, 2);
    });
    tex('chest', 14, 12, g => {
      g.fillStyle(0x0a0710).fillRect(0, 0, 14, 12);
      g.fillStyle(0x8a5a2a).fillRect(1, 1, 12, 10);
      g.fillStyle(0xffd75e).fillRect(1, 4, 12, 2).fillRect(6, 3, 2, 5);
      g.fillStyle(0xb57a3a).fillRect(2, 1, 10, 2);
    });
    // 장비 부위 그림(밝은 회색으로 그려 등급 색으로 물들인다)
    const L = 0xffffff, M = 0xb0b0b0, Dk = 0x606060;
    tex('gs_helm', 12, 12, g => {
      g.fillStyle(Dk).fillRect(2, 3, 8, 8); g.fillStyle(M).fillRect(3, 2, 6, 8); g.fillStyle(L).fillRect(4, 2, 4, 2).fillRect(3, 4, 1, 4);
      g.fillStyle(0x000000).fillRect(4, 6, 4, 1).fillRect(5, 7, 2, 3);
    });
    tex('gs_armor', 12, 12, g => {
      g.fillStyle(Dk).fillRect(1, 2, 10, 4).fillRect(2, 6, 8, 5); g.fillStyle(M).fillRect(2, 2, 8, 3).fillRect(3, 5, 6, 5);
      g.fillStyle(L).fillRect(3, 3, 2, 1).fillRect(4, 5, 1, 4); g.fillStyle(0x000000).fillRect(5, 2, 2, 2);
    });
    tex('gs_boots', 12, 12, g => {
      g.fillStyle(Dk).fillRect(3, 1, 5, 9).fillRect(3, 8, 8, 3); g.fillStyle(M).fillRect(4, 1, 3, 8).fillRect(4, 8, 6, 2);
      g.fillStyle(L).fillRect(4, 1, 1, 6).fillRect(3, 3, 5, 1);
    });
    tex('gs_ring', 12, 12, g => {
      g.fillStyle(Dk).fillCircle(6, 7, 4); g.fillStyle(0x000000).fillCircle(6, 7, 2); g.fillStyle(M).fillRect(3, 9, 6, 1);
      g.fillStyle(L).fillRect(4, 1, 4, 3); g.fillStyle(M).fillRect(5, 2, 2, 1);
    });
    tex('gs_collar', 12, 12, g => {
      g.fillStyle(Dk).fillRect(1, 3, 10, 3); g.fillStyle(M).fillRect(1, 3, 10, 2); g.fillStyle(L).fillRect(2, 3, 2, 1).fillRect(7, 3, 2, 1);
      g.fillStyle(M).fillCircle(6, 8, 3); g.fillStyle(L).fillRect(5, 6, 2, 2); g.fillStyle(0x000000).fillRect(6, 9, 1, 1);
    });
    // 정예가 떨어뜨리는 장비 꾸러미(빛나는 보따리)
    tex('loot', 12, 12, g => {
      g.fillStyle(0x0a0710).fillRect(1, 2, 10, 10);
      g.fillStyle(0x6a4ab0).fillRect(2, 4, 8, 7);
      g.fillStyle(0xc890ff).fillRect(3, 5, 3, 2);
      g.fillStyle(0xffd75e).fillRect(4, 2, 4, 2).fillRect(5, 1, 2, 1);
    });
    // 검기: 초승달 모양
    tex('wave', 10, 16, g => {
      g.fillStyle(0xffffff, 0.5).fillEllipse(5, 8, 10, 16);
      g.fillStyle(0xffffff).fillEllipse(6, 8, 6, 14);
      g.fillStyle(0x000000, 1).fillEllipse(2, 8, 6, 12);
    });
    tex('dagger', 12, 4, g => {
      g.fillStyle(0x0a0710).fillRect(0, 0, 12, 4);
      g.fillStyle(0xe8eef8).fillRect(4, 1, 7, 2);
      g.fillStyle(0x8a5a2a).fillRect(1, 1, 3, 2);
      g.fillStyle(0xffd75e).fillRect(4, 0, 1, 4);
    });
    tex('ebullet', 8, 8, g => {
      g.fillStyle(0x0a0710).fillCircle(4, 4, 4);
      g.fillStyle(0xff4a6a).fillCircle(4, 4, 3);
      g.fillStyle(0xffd0e0).fillCircle(3, 3, 1.2);
    });
    tex('fireball', 10, 10, g => {
      g.fillStyle(0xff4a1a).fillCircle(5, 5, 5);
      g.fillStyle(0xffb03a).fillCircle(5, 5, 3.4);
      g.fillStyle(0xfff2b0).fillCircle(5, 5, 1.8);
    });
    tex('ice', 12, 6, g => {
      g.fillStyle(0x0a0710).fillTriangle(0, 3, 12, 0, 12, 6);
      g.fillStyle(0x9ae8ff).fillTriangle(1, 3, 11, 1, 11, 5);
      g.fillStyle(0xffffff).fillRect(7, 2, 3, 1);
    });
    tex('orb', 10, 10, g => {
      g.fillStyle(0x6fd3ff, 0.35).fillCircle(5, 5, 5);
      g.fillStyle(0x9ae8ff).fillCircle(5, 5, 3.2);
      g.fillStyle(0xffffff).fillCircle(4, 4, 1.4);
    });
    tex('ring', 64, 64, g => { g.lineStyle(3, 0xffffff, 1).strokeCircle(32, 32, 30); });
    tex('disc', 64, 64, g => { for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.05); g.fillCircle(32, 32, r); } });
    tex('shadow', 16, 6, g => g.fillStyle(0x000000, 0.35).fillEllipse(8, 3, 16, 6));
    // 무기 종류별 그림(종류 7 × 등급 5)
    makeWeaponTextures(g);
    // 조명 구멍(어두운 화면에서 지울 원)
    g.clear();
    for (let r = 150; r > 0; r -= 6) { g.fillStyle(0xffffff, 0.06); g.fillCircle(150, 150, r); }
    g.generateTexture('light', 300, 300);
    g.destroy();
  }
}
