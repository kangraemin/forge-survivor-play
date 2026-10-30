// 에셋 로딩, 애니메이션 등록, 코드로 그리는 작은 텍스처 생성
import { W, H, MOBS, BOSSES } from './data.js';
import { font, hiCam } from './ui.js';
import { makeWeaponTextures } from './wart.js';

// 있으면 쓰고 없으면 대체 그림으로 돌린다(새 지역 그림이 아직 없을 때도 게임은 돌아가게)
const REQUIRED = ['hero_r0', 'hero_r1', 'hero_r2', 'hero2_r0', 'hero2_r1', 'hero2_r2', 'mob_r0', 'mob_r1', 'mob_r2',
  'mob2_r0', 'mob2_r1', 'mob2_r2', 'fx1_r0', 'fx1_r1', 'fx1_r2', 'fx2_r0', 'fx2_r1', 'fx2_r2', 'tiles', 'deco'];
// 6~15장 그림은 기존 그림의 색만 바꿔 만든다(tools/palette.py). 몹 시트 z6~z15(장당 3행), 보스 boss3~boss6, 바닥 tile6~tile15
const NEW_CH = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPTIONAL = ['z2', 'z3', 'z4', 'z5', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', ...NEW_CH.map(c => 'z' + c)].flatMap(k => [0, 1, 2].map(r => `${k}_r${r}`))
  .concat(['boss6_r0'], NEW_CH.map(c => 'tile' + c))
  .concat(['icons_r0', 'icons_r1', 'icons_r2', 'icons_r3', 'forge_bg', 'lobby_bg', 'bell', 'tile2', 'tile3', 'tile4', 'tile5']);
// 코드로 그리던 작은 그림을 대신하는 PNG(assets/icon). 있으면 makeTextures가 건너뛴다
const ICONS = ['gemc', 'gs_helm', 'gs_armor', 'gs_boots', 'gs_ring', 'gs_collar', 'loot', 'chest', 'meat', 'silver',
  'magnetItem', 'gem1', 'gem2', 'gem3', 'ebullet', 'fireball', 'ice', 'hammer', 'wave', 'dagger', 'orb'];
// 무기 그림 PNG(assets/weapon/<종류><등급>.png). 있으면 makeWeaponTextures가 건너뛴다
const WEAPONS = ['sword', 'spear', 'axe', 'bow', 'gun', 'knuckle', 'staff'];

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    hiCam(this);
    const bar = this.add.rectangle(W / 2 - 80, H / 2, 0, 6, 0xffd75e).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 164, 10).setStrokeStyle(1, 0x5b4f7a);
    this.add.text(W / 2, H / 2 - 20, '대장간 서바이버', font(16, '#ffd75e')).setOrigin(0.5);
    this.load.on('progress', v => { bar.width = 160 * v; });
    this.load.on('loaderror', f => console.warn('missing asset', f.key));
    for (const k of REQUIRED.concat(OPTIONAL)) this.load.image(k, `assets/${k}.png`);
    for (const k of ICONS) this.load.image(k, `assets/icon/${k}.png`);
    for (const id of WEAPONS) for (let t = 0; t < 5; t++) this.load.image(`w_${id}${t}`, `assets/weapon/${id}${t}.png`);
  }

  sheet(key, frames = 4) {
    if (!this.textures.exists(key)) return null;
    const img = this.textures.get(key).getSourceImage();
    if (this.textures.exists(key + 's')) return key + 's';
    this.textures.addSpriteSheet(key + 's', img, { frameWidth: Math.floor(img.width / frames), frameHeight: img.height });
    return key + 's';
  }

  create() {
    const A = (key, sheet, rate, repeat = -1, frames) => sheet &&
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, frames ? { frames } : {}), frameRate: rate, repeat });
    A('walkFront', this.sheet('hero2_r0'), 8);
    A('walkUp', this.sheet('hero2_r1'), 8);
    A('walkSide', this.sheet('hero_r1'), 8);
    A('slash', this.sheet('hero_r2'), 26, 0);
    const pose = this.sheet('hero2_r2');
    A('idle', pose, 2.5, -1, [2, 3]);
    A('hurtPose', pose, 1, 0, [0]);
    A('dashPose', pose, 1, 0, [1]);
    A('fxSlash', this.sheet('fx1_r0'), 32, 0);
    A('fxHit', this.sheet('fx1_r1'), 30, 0);
    A('fxSmoke', this.sheet('fx1_r2'), 16, 0);
    A('fxCrit', this.sheet('fx2_r0'), 22, 0);
    A('fxSpin', this.sheet('fx2_r1'), 20, 0);
    A('fxPillar', this.sheet('fx2_r2'), 10, 0);
    for (let i = 0; i < 4; i++) this.sheet('icons_r' + i);

    // 몬스터: 전용 그림이 없으면 1챕터 같은 줄 몬스터를 색만 바꿔 쓴다
    const fallback = {};
    for (const [key, m] of Object.entries(MOBS)) {
      let sh = this.sheet(`${m.sheet}_r${m.row}`);
      if (!sh) { sh = this.sheet(`mob_r${m.row}`); fallback[key] = true; }
      A(key, sh, m.ai === 'swarm' ? 10 : m.ai === 'tank' ? 6 : 7);
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
    }
    this.registry.set('fallback', fallback);
    this.makeTextures();
    this.scene.start('Lobby');
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
