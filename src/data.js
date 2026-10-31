import { gearStats, wMul, wtypeOf, spReq, SP_RESET_GEM } from './gear.js';
import { t } from './i18n.js';
import { isTest } from './testMode.js';
// 게임 데이터와 밸런스 수치. 숫자는 전부 여기서만 바꾼다. 근거는 docs/DESIGN.md
// 세로는 폰 화면 비율에 맞춰 늘린다(48차): 480(16:9) ~ 585(19.5:9). 위아래 빈 띠 대신 HUD·조이스틱 영역으로 쓴다
export const W = 270;
export const H = (() => { try { const r = innerHeight / innerWidth; return r > 0 && isFinite(r) ? Math.max(480, Math.min(585, Math.round(W * r))) : 480; } catch { return 480; } })();

// 64차: 가로가 넓은 화면(PC·태블릿 가로·큰 세로)은 높이 480은 그대로 두고 폭만 비율에 맞게 늘린다(270~854). 폰·토스(세로)는 그대로 270
export const calcGW = () => { try { const r = innerHeight / innerWidth; return r > 0 && isFinite(r) && r < 1.7 ? Math.max(W, Math.min(854, Math.round(480 / r))) : W; } catch { return W; } };   // 65차: 창 크기가 바뀌면 pcInput.js가 다시 계산해 달라지면 다시 연다
export const GW = calcGW();
export const OFF = (GW - W) / 2;   // 넓은 화면에서 기본 판(270)이 가운데 놓이는 왼쪽 여백
export const WIDE = GW > W;
// 64차: 마우스(정밀 포인터)가 주 입력인 기기(PC). 터치 문구 대신 키보드·마우스 문구를 쓰는 데만 쓴다. 폰·토스는 false
export const PC = (() => { try { return matchMedia('(pointer:fine)').matches && !matchMedia('(pointer:coarse)').matches; } catch { return false; } })();

// 챕터: 몬스터 3종 + 보스. dur은 일반 스테이지 길이(초)
export const CHAPTERS = [
  { name: t('data.46c389'), tiles: 'tiles', mobs: ['slime', 'skel', 'bat'], boss: 'kingslime', mid: 'chief', dur: 150, dark: 0.45, light: 0xff9a3c },
  { name: t('data.50327f'), tiles: 'tile2', mobs: ['zombie', 'ghost', 'spider'], boss: 'lich', mid: 'gravekeeper', dur: 165, dark: 0.48, light: 0x9ad8ff },
  { name: t('data.5575d2'), tiles: 'tile3', mobs: ['imp', 'golem', 'fskull'], boss: 'lavagolem', mid: 'salamander', dur: 180, dark: 0.5, light: 0xff6a2a },
  { name: t('data.6e942e'), tiles: 'tile4', mobs: ['wolf', 'yeti', 'icesp'], boss: 'wyrm', mid: 'glacierbear', dur: 195, dark: 0.35, light: 0xbfe8ff },
  { name: t('data.f5d844'), tiles: 'tile5', mobs: ['dknight', 'cultist', 'gargoyle'], boss: 'demonlord', mid: 'executioner', dur: 210, dark: 0.5, light: 0xff4060 },
  // 6장부터: env는 장 고유 지형·환경(envfx.js), note는 '새로운 점' 한 줄(판 시작 때 알려 준다). 설계표 docs/chapters.md
  { name: t('data.2cc3d4'), tiles: 'tile6', mobs: ['drowned', 'coral', 'wraith'], boss: 'tidewyrm', mid: 'coralcrab', dur: 232, dark: 0.45, light: 0x5ae0d0, deco: 0x7ad8d0, env: 'tide', note: t('data.570308') },
  { name: t('data.3d8de3'), tiles: 'tile7', mobs: ['toxslime', 'rotgiant', 'sporespider'], boss: 'swampqueen', mid: 'bogtoad', dur: 240, dark: 0.5, light: 0x9aff5a, deco: 0x9ac060, env: 'fog', note: t('data.45d9c3') },
  { name: t('data.0c1749'), tiles: 'tile8', mobs: ['crystbat', 'crystgolem', 'prism'], boss: 'crystcolossus', mid: 'crystscorp', dur: 248, dark: 0.5, light: 0xc080ff, deco: 0xb090ff, env: 'beam', note: t('data.2edb78') },
  { name: t('data.416257'), tiles: 'tile9', mobs: ['galewolf', 'citknight', 'galegarg'], boss: 'stormcaptain', mid: 'griffin', dur: 256, dark: 0.3, light: 0xe8f4ff, deco: 0xd8e8ff, env: 'wind', note: t('data.5b1564') },
  { name: t('data.e5a7aa'), tiles: 'tile10', mobs: ['voidslime', 'abysspider', 'voidpriest'], boss: 'voidlord', mid: 'voideye', dur: 264, dark: 0.62, light: 0x6a5aff, deco: 0x6a70c0, env: 'abyss', note: t('data.0259b9') },
  { name: t('data.edaa29'), tiles: 'tile11', mobs: ['sandskel', 'scorpion', 'mirage'], boss: 'sandcolossus', mid: 'sandmummy', dur: 272, dark: 0.3, light: 0xffd070, deco: 0xe0c080, env: 'sand', note: t('data.6fb70a') },
  { name: t('data.2a11eb'), tiles: 'tile12', mobs: ['clockimp', 'steelgiant', 'steamskull'], boss: 'steamgeneral', mid: 'steamspider', dur: 280, dark: 0.45, light: 0xff9a50, deco: 0xd09060, env: 'steam', note: t('data.826af1') },
  { name: t('data.40296b'), tiles: 'tile13', mobs: ['stormwolf', 'stormyeti', 'stormspirit'], boss: 'thunderdragon', mid: 'thunderbird', dur: 288, dark: 0.4, light: 0x8ac8ff, deco: 0x90b0d0, env: 'storm', note: t('data.9d1583') },
  { name: t('data.3e6189'), tiles: 'tile14', mobs: ['mirrorknight', 'phantompriest', 'glassgarg'], boss: 'mirrorlord', mid: 'harlequin', dur: 296, dark: 0.35, light: 0x80ffe0, deco: 0x90e0d0, env: 'mirror', note: t('data.449728') },
  { name: t('data.f42027'), tiles: 'tile15', mobs: ['anvilimp', 'flamegiant', 'starskull'], boss: 'forgegod', mid: 'anviltortoise', dur: 304, dark: 0.5, light: 0xffd75e, deco: 0xe0b060, env: 'forge', note: t('data.71c4c4') },
  // 16장부터는 업데이트 장: 출시 때는 잠겨 있고(version.json contentChapters), 값을 올리면 열린다. 설계표 docs/chapters.md
  { name: t('data.e37437'), tiles: 'tile16', mobs: ['frostguard', 'froshound', 'frostmage'], boss: 'frostking', mid: 'frostknight', dur: 312, dark: 0.4, light: 0x8ad8ff, deco: 0x90c0e8, env: 'palace', lateCh: 16, note: t('data.724478') },
  { name: t('data.f1967b'), tiles: 'tile17', mobs: ['harpooner', 'skyray', 'balloon'], boss: 'skywhale', mid: 'skypirate', dur: 320, dark: 0.3, light: 0xffc890, deco: 0xc89860, env: 'skyway', lateCh: 17, note: t('data.1d0e45') },
  { name: t('data.d0cadf'), tiles: 'tile18', mobs: ['gearbeetle', 'duelist', 'alarmowl'], boss: 'clockwarden', mid: 'clockdancer', dur: 328, dark: 0.45, light: 0xffd890, deco: 0xc0a060, env: 'clocktower', lateCh: 18, note: t('data.1cba79') },
];
// 출시 본편 장 수. 16장부터는 업데이트로 연다(원격 설정 contentChapters, 기본 15). 웹/앱은 부팅 때 version.json 값을 받아 둔다
export const MAIN_CHAPTERS = 15;
const OPEN_KEY = 'forge-content-ch';
let OPEN = MAIN_CHAPTERS;
if (isTest()) OPEN = CHAPTERS.length;   // 테스트 모드: 모든 장을 연다(기기의 열림 값은 읽지도 쓰지도 않는다)
else try { const v = Number(localStorage.getItem(OPEN_KEY)); if (Number.isInteger(v) && v >= MAIN_CHAPTERS && v <= CHAPTERS.length) OPEN = v; } catch { /* 저장소 없음 */ }
export const openN = () => OPEN;                                   // 지금 열린 장 수(15~18)
export const openTotal = () => OPEN * 3;                           // 열린 판 수
export const setOpenN = n => {
  const v = Math.max(MAIN_CHAPTERS, Math.min(CHAPTERS.length, Math.floor(Number(n)) || MAIN_CHAPTERS));
  if (isTest()) return OPEN;
  OPEN = v; try { localStorage.setItem(OPEN_KEY, String(v)); } catch { /* 저장소 없음 */ }
  return v;
};
export const chapterOpen = c => c < OPEN;
// 장마다 3판: 일반 → 일반(규칙·변종·중간 보스) → 보스. 6판일 땐 같은 맵·같은 몹이 이어져 x-5쯤 질렸다
export const STAGES_PER_CHAPTER = 3;
export const isBossS = s => s === STAGES_PER_CHAPTER - 1;
// 난이도·보상 표는 6판 시절 칸(0~5)으로 짜여 있어 새 스테이지를 그 칸으로 옮겨 읽는다
const OLD_S = [0, 3, 5];
export const oldS = s => OLD_S[s] ?? s;

// 몬스터 기본값(1챕터 기준). ai: chase 추적, swarm 빠르고 흔들림, tank 느리고 단단함, float 겹쳐 통과, charge 돌진, ranged 거리 두고 쏨
// sheet/row: 걷기 시트 위치, die: 전용 죽음 시트 행(없으면 공통 연기)
export const MOBS = {
  slime: { sheet: 'mob', row: 0, die: 0, hp: 14, spd: 30, dmg: 6, ai: 'chase', color: 0x6fe36a },
  skel: { sheet: 'mob', row: 1, die: 1, hp: 30, spd: 24, dmg: 7.5, ai: 'tank', color: 0xe8e2c8 },
  bat: { sheet: 'mob', row: 2, die: 2, hp: 8, spd: 52, dmg: 4, ai: 'swarm', color: 0xa45cff },
  zombie: { sheet: 'z2', row: 0, hp: 16, spd: 26, dmg: 6, ai: 'chase', color: 0x7fae5a },
  ghost: { sheet: 'z2', row: 1, hp: 11, spd: 40, dmg: 5, ai: 'float', color: 0xaee6ff },
  spider: { sheet: 'z2', row: 2, hp: 18, spd: 32, dmg: 6.5, ai: 'charge', color: 0x8a4cc0 },
  imp: { sheet: 'z3', row: 0, hp: 10, spd: 54, dmg: 4, ai: 'swarm', color: 0xff5a3a },
  golem: { sheet: 'z3', row: 1, hp: 44, spd: 19, dmg: 7.5, ai: 'tank', color: 0xff9a3a },
  fskull: { sheet: 'z3', row: 2, hp: 13, spd: 30, dmg: 5, ai: 'ranged', color: 0xffc23a },
  wolf: { sheet: 'z4', row: 0, hp: 18, spd: 44, dmg: 6.5, ai: 'charge', color: 0xdff2ff },
  yeti: { sheet: 'z4', row: 1, hp: 48, spd: 21, dmg: 8, ai: 'tank', color: 0xffffff },
  icesp: { sheet: 'z4', row: 2, hp: 13, spd: 30, dmg: 5, ai: 'ranged', color: 0x7fe8ff, tint: 0x7fb0ff },   // 눈 바닥에 묻혀 안 보였다
  dknight: { sheet: 'z5', row: 0, hp: 46, spd: 25, dmg: 8, ai: 'tank', color: 0xc04050 },
  cultist: { sheet: 'z5', row: 1, hp: 15, spd: 28, dmg: 5, ai: 'ranged', color: 0xb070ff },
  gargoyle: { sheet: 'z5', row: 2, hp: 14, spd: 52, dmg: 4.5, ai: 'swarm', color: 0x9a9aa8 },
  // 6장~ : fx는 envfx.js가 처리하는 몹 고유 행동
  drowned: { sheet: 'z6', row: 0, hp: 16, spd: 26, dmg: 6, ai: 'chase', color: 0x5ac8b0, fx: 'pool' },
  coral: { sheet: 'z6', row: 1, hp: 46, spd: 20, dmg: 8, ai: 'tank', color: 0x70e0d8 },
  wraith: { sheet: 'z6', row: 2, hp: 12, spd: 38, dmg: 5, ai: 'float', color: 0xb8a0ff, fx: 'dive' },
  toxslime: { sheet: 'z7', row: 0, hp: 17, spd: 30, dmg: 6, ai: 'chase', color: 0xb060e0 },
  rotgiant: { sheet: 'z7', row: 1, hp: 48, spd: 19, dmg: 8, ai: 'tank', color: 0xa0c040 },
  sporespider: { sheet: 'z7', row: 2, hp: 19, spd: 34, dmg: 6, ai: 'charge', color: 0xc0e040, fx: 'spore' },
  crystbat: { sheet: 'z8', row: 0, hp: 9, spd: 54, dmg: 4, ai: 'swarm', color: 0xd0a0ff },
  crystgolem: { sheet: 'z8', row: 1, hp: 46, spd: 19, dmg: 8, ai: 'tank', color: 0xa080ff, fx: 'shard' },
  prism: { sheet: 'z8', row: 2, hp: 13, spd: 28, dmg: 5, ai: 'ranged', color: 0x80ffd0, fx: 'prism' },
  galewolf: { sheet: 'z9', row: 0, hp: 19, spd: 46, dmg: 6.5, ai: 'charge', color: 0xc0d8ff },
  citknight: { sheet: 'z9', row: 1, hp: 50, spd: 24, dmg: 8.5, ai: 'tank', color: 0xe0e8ff },
  galegarg: { sheet: 'z9', row: 2, hp: 14, spd: 50, dmg: 5, ai: 'swarm', color: 0x90c8e8, fx: 'gust' },
  voidslime: { sheet: 'z10', row: 0, hp: 18, spd: 30, dmg: 6, ai: 'chase', color: 0x6a60d0, fx: 'split' },
  abysspider: { sheet: 'z10', row: 1, hp: 21, spd: 36, dmg: 7, ai: 'charge', color: 0x5a80c0, fx: 'cloak' },
  voidpriest: { sheet: 'z10', row: 2, hp: 14, spd: 28, dmg: 5, ai: 'ranged', color: 0x8a70e0, fx: 'cloak' },
  sandskel: { sheet: 'z11', row: 0, hp: 19, spd: 30, dmg: 6.5, ai: 'chase', color: 0xe0c080, fx: 'revive' },
  scorpion: { sheet: 'z11', row: 1, hp: 22, spd: 38, dmg: 7, ai: 'charge', color: 0xd09040, fx: 'burrow' },
  mirage: { sheet: 'z11', row: 2, hp: 15, spd: 36, dmg: 5.5, ai: 'float', color: 0x80e8d8, fx: 'blink' },
  clockimp: { sheet: 'z12', row: 0, hp: 15, spd: 34, dmg: 6, ai: 'chase', color: 0xd09060, fx: 'overclock' },
  steelgiant: { sheet: 'z12', row: 1, hp: 52, spd: 20, dmg: 9, ai: 'tank', color: 0xa0a8b8, fx: 'brace' },
  steamskull: { sheet: 'z12', row: 2, hp: 17, spd: 32, dmg: 6.5, ai: 'chase', color: 0xe0e0f0, fx: 'steamdie' },
  stormwolf: { sheet: 'z13', row: 0, hp: 22, spd: 48, dmg: 7, ai: 'charge', color: 0xa0c8ff, fx: 'zap' },
  stormyeti: { sheet: 'z13', row: 1, hp: 54, spd: 21, dmg: 9, ai: 'tank', color: 0x7080a0, fx: 'lure' },
  stormspirit: { sheet: 'z13', row: 2, hp: 15, spd: 28, dmg: 6, ai: 'ranged', color: 0x80d0ff, fx: 'aimline' },
  mirrorknight: { sheet: 'z14', row: 0, hp: 56, spd: 25, dmg: 9.5, ai: 'tank', color: 0xb0f0e0, fx: 'parry' },
  phantompriest: { sheet: 'z14', row: 1, hp: 16, spd: 28, dmg: 6, ai: 'ranged', color: 0x90e090, fx: 'clone' },
  glassgarg: { sheet: 'z14', row: 2, hp: 17, spd: 52, dmg: 6, ai: 'swarm', color: 0x80e0c8, fx: 'shard' },
  anvilimp: { sheet: 'z15', row: 0, hp: 20, spd: 36, dmg: 7, ai: 'chase', color: 0xe0b060, fx: 'anvil' },
  flamegiant: { sheet: 'z15', row: 1, hp: 60, spd: 21, dmg: 10, ai: 'tank', color: 0xf0b050, fx: 'firepool' },
  starskull: { sheet: 'z15', row: 2, hp: 18, spd: 32, dmg: 7, ai: 'ranged', color: 0xa0f0b0, fx: 'homing' },
  // 16~18장(업데이트): sheet는 assets/ch16-18의 z<장>_r<행>(걷기)·_attack(공격 준비·발동). lateCh는 그 장이 열릴 때만 도감에 센다
  frostguard: { sheet: 'z16', row: 0, hp: 66, spd: 22, dmg: 10.5, ai: 'tank', color: 0x8ad8ff, fx: 'bash', lateCh: 16 },
  froshound: { sheet: 'z16', row: 1, hp: 24, spd: 50, dmg: 7.5, ai: 'charge', color: 0x70c8ff, fx: 'howl', lateCh: 16 },
  frostmage: { sheet: 'z16', row: 2, hp: 17, spd: 28, dmg: 7, ai: 'ranged', color: 0xa0b8ff, fx: 'frostzone', lateCh: 16 },
  harpooner: { sheet: 'z17', row: 0, hp: 18, spd: 30, dmg: 7, ai: 'ranged', color: 0xe08a50, fx: 'harpoon', lateCh: 17 },
  skyray: { sheet: 'z17', row: 1, hp: 22, spd: 52, dmg: 7, ai: 'swarm', color: 0x70a0ff, fx: 'burstgust', lateCh: 17 },
  balloon: { sheet: 'z17', row: 2, hp: 34, spd: 26, dmg: 7.5, ai: 'float', color: 0xf0d0a0, fx: 'bloat', lateCh: 17 },
  gearbeetle: { sheet: 'z18', row: 0, hp: 68, spd: 28, dmg: 11, ai: 'chase', color: 0xd0a050, fx: 'rewind', lateCh: 18 },
  duelist: { sheet: 'z18', row: 1, hp: 24, spd: 46, dmg: 8, ai: 'charge', color: 0xa0a0d0, fx: 'timeskip', lateCh: 18 },
  alarmowl: { sheet: 'z18', row: 2, hp: 18, spd: 50, dmg: 7, ai: 'swarm', color: 0xe0d0b0, fx: 'alarm', lateCh: 18 },
};

export const MOB_NAMES = {
  slime: t('data.d4d298'), skel: t('data.5cbb9a'), bat: t('data.b1ed9c'), zombie: t('data.6d1c96'), ghost: t('data.f71cd6'), spider: t('data.680d7f'), imp: t('data.54ec56'), golem: t('data.473945'), fskull: t('data.e34e26'),
  wolf: t('data.82faf9'), yeti: t('data.de142a'), icesp: t('data.68ada1'), dknight: t('data.47ee1c'), cultist: t('data.fa11ec'), gargoyle: t('data.563c96'),
  drowned: t('data.c9ca2f'), coral: t('data.e51a88'), wraith: t('data.8b4d7b'), toxslime: t('data.46da7d'), rotgiant: t('data.9ee7d3'), sporespider: t('data.098cae'),
  crystbat: t('data.a36156'), crystgolem: t('data.5af8ed'), prism: t('data.095bde'), galewolf: t('data.ae1c59'), citknight: t('data.d87de7'), galegarg: t('data.eda6c8'),
  voidslime: t('data.dd614b'), abysspider: t('data.87a32a'), voidpriest: t('data.dce5af'),
  sandskel: t('data.ed4455'), scorpion: t('data.c51875'), mirage: t('data.c77dc0'), clockimp: t('data.8ccba8'), steelgiant: t('data.5441ea'), steamskull: t('data.9137a4'),
  stormwolf: t('data.29e4c4'), stormyeti: t('data.378016'), stormspirit: t('data.a99ef9'), mirrorknight: t('data.b3b475'), phantompriest: t('data.55fd9c'), glassgarg: t('data.7a4652'),
  anvilimp: t('data.bb5bd7'), flamegiant: t('data.5db3d1'), starskull: t('data.59ee18'),
  frostguard: t('data.20d4ce'), froshound: t('data.443dbb'), frostmage: t('data.2590f1'), harpooner: t('data.4ae714'), skyray: t('data.4ac09c'), balloon: t('data.ed8dfa'),
  gearbeetle: t('data.59164c'), duelist: t('data.9357d2'), alarmowl: t('data.fbd14f'),
};
// 변종: 스테이지마다 하나씩 새로 나와 판마다 몬스터가 달라 보이게 한다(같은 그림에 색·크기·행동을 바꾼다)
export const VARIANTS = {
  split: { pre: t('data.195f59'), desc: t('data.883ea4'), tint: 0xc070ff },
  swift: { pre: t('data.830f2f'), desc: t('data.905865'), tint: 0xff5050, spd: 1.35, ai: 'charge' },
  armor: { pre: t('data.f42428'), desc: t('data.16a142'), tint: 0x8fa8d0, hp: 1.5, scale: 1.2, kb: 0.25 },
  burst: { pre: t('data.d7c9c6'), desc: t('data.a94ad9'), tint: 0xffa030 },
  giant: { pre: t('data.4dfd4c'), desc: t('data.a98400'), tint: 0xffe070, hp: 3, scale: 1.7, spd: 0.8, kb: 0.2 },
};
// x-2에 새로 나오는 변종은 장마다 다르다: [챕터 몹 번호, 변종]. 2장부터 x-1엔 앞 장 변종이 섞인다. 보스 판은 없음
const CH_VARIANT = [[0, 'split'], [2, 'swift'], [1, 'armor'], [0, 'burst'], [2, 'giant'], [2, 'swift'], [0, 'armor'], [2, 'burst'], [1, 'giant'], [0, 'swift']];
export const stageVariant = (c, s) => s === 1 ? CH_VARIANT[c % CH_VARIANT.length] : s === 0 && c > 0 ? CH_VARIANT[(c - 1) % CH_VARIANT.length] : null;
export const VARIANT_RATE = 0.22, VARIANT_OLD_RATE = 0.1;   // 이번 변종 / 앞 스테이지 변종이 섞이는 비율
// 판 규칙: 같은 스테이지도 판마다 다르게 흘러가도록 시작할 때 하나를 뽑는다(안 뽑힐 수도 있다)
export const RUN_MODS = [
  { id: 'horde', name: t('data.285d7e'), desc: t('data.fcb5e4') },
  { id: 'mutant', name: t('data.08ab5a'), desc: t('data.05e932') },
  { id: 'rush', name: t('data.96e711'), desc: t('data.2f2d43'), spd: 1.2, hp: 0.85 },
];
export const RUN_MOD_CHANCE = 0.6;
// x-2는 판 규칙이 정해져 있다(장마다 돌아가며). 다시 할 땐 위 확률로 다른 규칙이 섞인다
export const stageMod = c => RUN_MODS[[2, 0, 1, 0, 2, 1, 2, 0, 2, 1][c % 10]];   // 1-2는 질풍: 1-1 다음 판이 바로 1-2라 첫 규칙이 여기서 보여야 한다(41차)

// 보스: sheet/row는 2프레임 시트. hp는 1챕터 배율 기준 값(챕터 배율이 곱해진다)
// rage: 체력 절반 아래에서 새로 섞여 나오는 공격(같은 패턴만 반복된다는 평가)
// 보스 분노 때 알리는 새 공격 이름
export const RAGE_WHAT = {
  sweep: t('data.02a265'), pools: t('data.b8e689'), slam: t('data.c17c6b'),
  tsunami: t('data.a5cc13'), bloom: t('data.2b305f'), shatter: t('data.e6c7d9'), cyclone: t('data.2fab2d'), eclipse: t('data.ee87da'),
  sink: t('data.be3ab6'), overheat: t('data.1c9ca0'), tempest: t('data.d60d02'), reflect: t('data.0db4d5'), meteor: t('data.1b6824'),
  blizzard: t('data.2b095a'), squall: t('data.2ec769'), stoptime: t('data.087d4f'),
};
export const BOSSES = {
  kingslime: { name: t('data.052600'), sheet: 'boss1', row: 0, hp: 1200, dmg: 12, spd: 26, color: 0x6fe36a, pattern: ['jump', 'charge', 'summon', 'slam', 'ring'], rage: 'pools' },
  lich: { name: t('data.8938a1'), sheet: 'boss1', row: 1, hp: 1500, dmg: 12, spd: 22, color: 0x9dff7a, pattern: ['ring', 'summon', 'aimed', 'ring'], rage: 'sweep' },
  lavagolem: { name: t('data.7464f1'), sheet: 'boss1', row: 2, hp: 1650, dmg: 8, spd: 18, color: 0xff7a2a, pattern: ['slam', 'ring', 'charge', 'slam'], rage: 'pools' },
  wyrm: { name: t('data.05e151'), sheet: 'boss2', row: 0, hp: 1450, dmg: 14, spd: 30, color: 0x9ae8ff, pattern: ['aimed', 'charge', 'ring', 'aimed'], rage: 'sweep' },
  demonlord: { name: t('data.93df8f'), sheet: 'boss2', row: 1, hp: 3000, dmg: 15, spd: 28, color: 0xff3a50, pattern: ['charge', 'ring', 'slam', 'summon', 'aimed'], rage: 'sweep' },
  // 6장~ 보스: 새 패턴(envfx.js BOSS_PATTERNS)이 섞인다. rage는 체력 절반 아래에서 끼어드는 새 공격
  tidewyrm: { name: t('data.2758f7'), sheet: 'boss3', row: 0, hp: 1500, dmg: 14, spd: 30, color: 0x5ae0d0, pattern: ['wave', 'aimed', 'jump', 'wave'], rage: 'tsunami' },
  swampqueen: { name: t('data.782796'), sheet: 'boss3', row: 1, hp: 1650, dmg: 14, spd: 24, color: 0xb060e0, pattern: ['spore', 'summon', 'aimed', 'spore'], rage: 'bloom' },
  crystcolossus: { name: t('data.c93590'), sheet: 'boss3', row: 2, hp: 1800, dmg: 15, spd: 18, color: 0xb080ff, pattern: ['prism', 'slam', 'charge', 'prism'], rage: 'shatter' },
  stormcaptain: { name: t('data.0e877d'), sheet: 'boss4', row: 0, hp: 1700, dmg: 15, spd: 32, color: 0xd8e8ff, pattern: ['gale', 'charge', 'aimed', 'gale'], rage: 'cyclone' },
  voidlord: { name: t('data.15bd71'), sheet: 'boss4', row: 1, hp: 2000, dmg: 16, spd: 26, color: 0x7a6aff, pattern: ['void', 'ring', 'summon', 'void'], rage: 'eclipse' },
  sandcolossus: { name: t('data.134571'), sheet: 'boss4', row: 2, hp: 2100, dmg: 16, spd: 20, color: 0xe0c080, pattern: ['burrow', 'slam', 'summon', 'burrow'], rage: 'sink' },
  steamgeneral: { name: t('data.37ac3b'), sheet: 'boss5', row: 0, hp: 2250, dmg: 17, spd: 28, color: 0xe08a50, pattern: ['vent', 'aimed', 'summon', 'vent'], rage: 'overheat' },
  thunderdragon: { name: t('data.da6742'), sheet: 'boss5', row: 1, hp: 2400, dmg: 17, spd: 34, color: 0x9a8aff, pattern: ['bolt', 'charge', 'aimed', 'bolt'], rage: 'tempest' },
  mirrorlord: { name: t('data.91fb7c'), sheet: 'boss5', row: 2, hp: 2550, dmg: 18, spd: 26, color: 0x90ffe8, pattern: ['mirror', 'ring', 'aimed', 'mirror'], rage: 'reflect' },
  forgegod: { name: t('data.66d303'), sheet: 'boss6', row: 0, hp: 2800, dmg: 19, spd: 24, color: 0xffd75e, pattern: ['hammer', 'ring', 'slam', 'hammer'], rage: 'meteor' },
  // 16~18장 보스: 시트는 assets/ch16-18/boss<장>_r0(이동 2프레임)·_telegraph(패턴 예고 2프레임)
  frostking: { name: t('data.3d46cb'), sheet: 'boss16', row: 0, hp: 3000, dmg: 20, spd: 26, color: 0x8ad8ff, pattern: ['icelance', 'charge', 'frostquake', 'icelance'], rage: 'blizzard', lateCh: 16 },
  skywhale: { name: t('data.862fee'), sheet: 'boss17', row: 0, hp: 3250, dmg: 21, spd: 24, color: 0xe08a50, pattern: ['volley', 'skydive', 'broadside', 'volley'], rage: 'squall', lateCh: 17 },
  clockwarden: { name: t('data.f3231a'), sheet: 'boss18', row: 0, hp: 3500, dmg: 22, spd: 22, color: 0xd0a050, pattern: ['chime', 'rewindpat', 'gearsaw', 'rewindpat'], rage: 'stoptime', lateCh: 18 },
  // 장마다 다른 중간보스(x-2 마지막 웨이브). 그림 assets/mid1~6_r0~2(2프레임, 높이 80), 패턴은 midPat.js·envfx.js·lateEnv.js. general은 무한의 탑 전용(펫으로도 쓴다)
  chief: { name: t('data.2512ff'), sheet: 'mid1', row: 0, hp: 440, dmg: 11, spd: 24, color: 0x7ac05a, pattern: ['charge', 'clubs', 'summon', 'clubs'], rage: 'slam', mid: true },
  gravekeeper: { name: t('data.d061cb'), sheet: 'mid1', row: 1, hp: 480, dmg: 11, spd: 20, color: 0x9dd0a0, pattern: ['graves', 'pools', 'aimed', 'graves'], rage: 'slam', mid: true },
  salamander: { name: t('data.06d3f2'), sheet: 'mid1', row: 2, hp: 520, dmg: 12, spd: 26, color: 0xff7a2a, pattern: ['lavaspit', 'slam', 'charge', 'lavaspit'], rage: 'pools', mid: true },
  glacierbear: { name: t('data.2f2417'), sheet: 'mid2', row: 0, hp: 560, dmg: 12, spd: 24, color: 0xbfe8ff, pattern: ['icicles', 'charge', 'aimed', 'icicles'], rage: 'slam', mid: true },
  executioner: { name: t('data.9b8faf'), sheet: 'mid2', row: 1, hp: 600, dmg: 13, spd: 26, color: 0xc060ff, pattern: ['chains', 'charge', 'aimed', 'chains'], rage: 'sweep', mid: true },
  coralcrab: { name: t('data.bf5e53'), sheet: 'mid2', row: 2, hp: 640, dmg: 12, spd: 24, color: 0xff9a9a, pattern: ['claw', 'wave', 'jump', 'wave'], rage: 'slam', mid: true },
  bogtoad: { name: t('data.ae3e2e'), sheet: 'mid3', row: 0, hp: 680, dmg: 12, spd: 22, color: 0xa0d050, pattern: ['tongue', 'spore', 'jump', 'spore'], rage: 'pools', mid: true },
  crystscorp: { name: t('data.2d5688'), sheet: 'mid3', row: 1, hp: 720, dmg: 13, spd: 28, color: 0xc890ff, pattern: ['stinger', 'prism', 'charge', 'stinger'], rage: 'shatter', mid: true },
  griffin: { name: t('data.eb278a'), sheet: 'mid3', row: 2, hp: 760, dmg: 13, spd: 30, color: 0xe8f4ff, pattern: ['swoop', 'gale', 'aimed', 'swoop'], rage: 'slam', mid: true },
  voideye: { name: t('data.532153'), sheet: 'mid4', row: 0, hp: 800, dmg: 13, spd: 22, color: 0xa090ff, pattern: ['gaze', 'void', 'ring', 'gaze'], rage: 'sweep', mid: true },
  sandmummy: { name: t('data.76fcfc'), sheet: 'mid4', row: 1, hp: 840, dmg: 14, spd: 22, color: 0xe8d8a0, pattern: ['unwrap', 'burrow', 'summon', 'unwrap'], rage: 'sink', mid: true },
  steamspider: { name: t('data.ee142b'), sheet: 'mid4', row: 2, hp: 880, dmg: 14, spd: 26, color: 0xe8e8f0, pattern: ['piston', 'vent', 'aimed', 'piston'], rage: 'overheat', mid: true },
  thunderbird: { name: t('data.c1d044'), sheet: 'mid5', row: 0, hp: 920, dmg: 14, spd: 32, color: 0x9a8aff, pattern: ['swoop', 'bolt', 'charge', 'bolt'], rage: 'tempest', mid: true },
  harlequin: { name: t('data.0723ac'), sheet: 'mid5', row: 1, hp: 960, dmg: 15, spd: 26, color: 0x90ffe8, pattern: ['shards', 'mirror', 'ring', 'shards'], rage: 'reflect', mid: true },
  anviltortoise: { name: t('data.98021f'), sheet: 'mid5', row: 2, hp: 1000, dmg: 15, spd: 20, color: 0xffb040, pattern: ['anvilrain', 'hammer', 'slam', 'anvilrain'], rage: 'meteor', mid: true },
  frostknight: { name: t('data.923d9e'), sheet: 'mid6', row: 0, hp: 1040, dmg: 16, spd: 24, color: 0x8ad8ff, pattern: ['icelance', 'frostquake', 'charge', 'icelance'], rage: 'blizzard', mid: true, lateCh: 16 },
  skypirate: { name: t('data.1bdaa0'), sheet: 'mid6', row: 1, hp: 1080, dmg: 16, spd: 28, color: 0xe08a50, pattern: ['volley', 'broadside', 'swoop', 'volley'], rage: 'squall', mid: true, lateCh: 17 },
  clockdancer: { name: t('data.744747'), sheet: 'mid6', row: 2, hp: 1120, dmg: 17, spd: 26, color: 0xd0a050, pattern: ['chime', 'gearsaw', 'rewindpat', 'chime'], rage: 'stoptime', mid: true, lateCh: 18 },
  general: { name: t('battle.20631e'), sheet: 'boss2', row: 2, hp: 500, dmg: 11, spd: 24, color: 0xe8e2c8, pattern: ['charge', 'summon', 'aimed'], rage: 'slam' },
};

// 첫 실행 프롤로그에서 주인공을 쓰러뜨리는 보스 = 15장 마지막 보스(같은 이름·같은 그림). 15장 보스 데이터를 따라가므로 따로 맞출 일이 없다
export const PROLOGUE_BOSS = CHAPTERS[14].boss;

// 챕터 배율: 무기 등급이 오를 때(약 2.1배) 몬스터 체력도 같이 오른다. 4~5장 벽이 너무 높아 조금 낮췄다
// 6장부터는 장마다 REC_G배씩 오른다(무기 등급이 2장마다 오르므로 등급 한 칸 2.56배 = 장당 1.6배). 5장까지는 예전 그대로
export const REC_G = 1.4;
export const chapterHp = c => (c < 5 ? Math.pow(2.05, c) : Math.pow(2.05, 4) * Math.pow(REC_G, c - 4)) * GEAR_HP(c);           // c는 0부터
export const chapterDmgRaw = c => 0.65 * Math.pow(1.18, c);   // 어려움 모드는 이 값 그대로(어려움 표는 따로 맞춰 둠)
// 50차: 10장부터 몹 피해가 장마다 18%씩 늘어 15장에선 주인공 체력(선형)이 몇 대에 녹았다. 권장 전투력 1.2배로도 보스에 못 닿았다
// 10장부터는 장당 증가를 10%로 줄인다(몹 피해·지형 피해 둘 다 이 값에서 나온다). 플레이어 쪽은 건드리지 않는다
export const chapterDmg = c => c <= 7 ? chapterDmgRaw(c) : chapterDmgRaw(7) * Math.pow(1.015, c - 7);   // 1.25면 3장부터 무기 등급 체력 보너스를 앞질러 30초 만에 녹았다
// 스테이지마다 확 어려워진다: 1-1은 누구나 깨고, 1-2부터는 대충 움직이면 죽고 대장간에서 몇 번 강화하면 깬다
// s는 0~5. 1-2에서 바로 벽을 느끼게 크게 뛰고, 1-6 권장이 +10쯤(승급 조건)에 닿게 뒤로 갈수록 완만히
// x-2가 읽는 칸(3)은 1.92→1.6: 2-1 32 → 2-2 84로 한 판에 2.6배 뛰었다(37차). 장 안 세 판이 고르게 오르게
const STAGE_HP = [1, 1.45, 1.7, 1.6, 2.12, 2.3];
export const stageMul = s => STAGE_HP[oldS(s)] ?? 1;
export const stageDmg = s => 1 + 0.1 * oldS(s);                // 피해는 공격력으로 못 막으니 체력보다 완만하게
export const stageSpawn = s => 0.35 * oldS(s);                 // 초당 더 나오는 몹 수
// 판 안 시간에 따른 체력 상승(처음 0.75배 → 끝날 즈음 1.7배)
export const timeHp = f => 0.75 + 0.8 * f + 0.45 * f * f;   // 초반 몹은 약하고 많게. 끝 무렵을 더 세게(1.7→2.0): 마지막 웨이브는 늘 체력 만땅이었다(37차)

// ── 무기·대장간 ──
const tierAtk = t => Math.round(190 * Math.pow(REC_G, 2 * (t - 5) + 1));
export const TIERS = [
  { name: t('data.1754a6'), atk: 10, icon: 0 },
  { name: t('data.15368e'), atk: 21, icon: 1 },
  { name: t('data.712653'), atk: 44, icon: 2 },
  { name: t('data.8b8372'), atk: 92, icon: 2, tint: 0xffa0ff },
  { name: t('data.c29e2a'), atk: 190, icon: 3 },
  // 6장부터 두 장마다 한 등급. atk은 그 등급을 처음 쓰는 장의 권장 기준(REC_BASE)과 같다
  { name: t('data.90ab26'), atk: tierAtk(5), icon: 3, tint: 0xfff0a0 },
  { name: t('data.2c337f'), atk: tierAtk(6), icon: 3, tint: 0x80ffd0 },
  { name: t('data.9f785c'), atk: tierAtk(7), icon: 3, tint: 0xa0d8ff },
  { name: t('data.1d806b'), atk: tierAtk(8), icon: 3, tint: 0x9a80ff },
  { name: t('data.0b9bef'), atk: tierAtk(9), icon: 3, tint: 0xffe070 },
];
// 승급에 필요한 깬 판 수(그 등급으로 올라가려면). 5장까지는 장마다, 6장부터는 두 장마다
export const TIER_AT = [0, 3, 6, 9, 12, 15, 21, 27, 33, 39];
// 그 장을 권장할 때 쓰는 무기 공격력 기준
export const REC_BASE = c => c < 5 ? TIERS[c].atk : Math.round(190 * Math.pow(REC_G, c - 4));
// 무기 종류마다 이름이 다르다(검은 원래 이름, 나머지는 등급 + 무기)
const TIER_PRE = [t('data.a30c87'), t('data.5d91e5'), t('data.4834de'), t('data.967598'), t('data.40f556'), t('data.cafc55'), t('data.eeac0d'), t('data.c53ca8'), t('data.82267f'), t('data.8ec2bb')];
export const tierName = (tier, w) => !w || w.id === 'sword' ? TIERS[tier].name : `${TIER_PRE[tier]} ${w.noun}`;
// +5·+10·+15·+20을 넘을 때마다 칼이 한 번 더 깨어난다(×1.1). 한 단계 +10%만으론 강해진 게 안 느껴진다
export const ENH_MILESTONE = 5, MILESTONE_MUL = 1.1;
// 강화 각성(+5/+10/+15): 숫자만 오르지 않고 공격 모양이 바뀐다(weapons.js sword/shoot/enhWave)
export const AWAKENINGS = [[5, t('data.632300'), t('data.4ee8e5')], [10, t('data.71dd53'), t('data.e6c04c')], [15, t('data.e63f67'), t('data.051ed7')]];
export const awakenText = enh => { const a = AWAKENINGS.filter(x => enh >= x[0]); return a.length ? [t('data.33b2fe', { v: a[a.length - 1][0], join: a.map(x => x[1]).join(' · ') }), a[a.length - 1][2]] : null; };
// +11부터는 한 단계마다 ×1.15: 더하기로는 단계가 오를수록 오름폭이 +10%→+8%로 줄어 파괴를 무릅쓸 이유가 없었다
export const OVER10_MUL = 1.15;
export const weaponAtk = (tier, enh) => TIERS[tier].atk * (1 + 0.1 * Math.min(enh, 10)) * Math.pow(OVER10_MUL, Math.max(0, enh - 10)) * Math.pow(MILESTONE_MUL, Math.floor(enh / ENH_MILESTONE));
// 강화 성공 확률(%) — 인덱스는 현재 강화 수치
// 앞 칸을 낮춰 첫 판 뒤 강화 몇 번 안에 실패→보정→성공을 겪게 한다(37차: +12까지 한 번도 실패가 없었다)
export const ENH_RATE = [100, 95, 85, 75, 70, 65, 60, 55, 50, 45, 45, 40, 36, 32, 28, 22, 18, 15, 12, 10];
export const ENH_MAX = 20;
// 결과 창 자랑하기: 하루 한 번 보석
// 처음 한 번 자랑은 조금 더(10) 주되 광고 한 번(보석 20)보다 작게(공유 보상 10/30)
export const SHARE_GEM_FIRST = 10;   // 광고 한 번(보석 20)보다 작게
export const SHARE_GEM = 5, SHARE_URL = 'https://kangraemin.github.io/forge-survivor-play/';
// 천장: +15부터 실패할 때마다 다음 확률 +3%(성공하면 0으로). +19→+20(10%)에 운이 없으면 끝없이 갈렸다
export const PITY_FROM = 15, PITY_STEP = 3;
// +10 아래는 실패할 때마다 다음 확률 +10%p(65%에서 세 번 내리 실패해 금화만 날렸다)
export const LOW_PITY_STEP = 10;
export const pityOn = enh => enh < DESTROY_FROM || enh >= PITY_FROM;
export const pityRate = sv => sv.enh < DESTROY_FROM ? (sv.pity || 0) * LOW_PITY_STEP : sv.enh >= PITY_FROM ? (sv.pity || 0) * PITY_STEP : 0;
export const DESTROY_FROM = 10;                            // +10에서 +11을 노릴 때부터 실패하면 파괴
// 부서지면 두 단계 떨어진다(+0이나 +5까지 떨어지면 성공 +10%에 실패 -32%라 아무도 위험을 지지 않았다)
export const SHATTER_DROP = 2;
export const shatterTo = enh => Math.max(0, enh - SHATTER_DROP);
export const FAIL_REFUND = 0.3;                            // 위험 구간에서 실패하면 금화 30%를 돌려준다
const TIER_COST_OLD = [1, 2.2, 4.8, 10.5, 23];
export const GOLD_G = 1.25;                                 // 6장부터 장마다 금화 보상·강화 비용이 오르는 배율
export const chCost = c => c < 5 ? TIER_COST_OLD[c] : 23 * Math.pow(GOLD_G, c - 4);
const tierCost = t => t < 5 ? TIER_COST_OLD[t] : chCost(5 + 2 * (t - 5));   // 등급은 두 장에 한 칸
export const enhGold = (tier, enh) => Math.round(40 * tierCost(tier) * Math.pow(1.22, enh) / 5) * 5;
export const enhStone = (tier, enh) => Math.ceil((enh + 1) / 2) + tier;
export const PROMOTE_NEED = 10;                            // 승급하려면 +10 이상
export const promoteGold = tier => Math.round(600 * tierCost(tier + 1) / 50) * 50;
// 54차: 도전 증표 — 도전(지키기·점령·돌파·사냥)에서만 나온다. 3장 무기(등급 3) 이상으로 올릴 때부터 승급에 든다
// 장마다 도전 4개 중 2~3개만 하면 되는 양(1~2장 무기 승급은 지금처럼 증표 없음)
export const MARK_NEED = [0, 0, 0, 2, 2, 2, 3, 3, 3, 3];   // 인덱스: 올라갈 등급
export const markNeed = toTier => MARK_NEED[toTier] || 0;
export const MODE_HP = 1.12, MODE_DMG = 1.1;              // 도전 난이도: 본편 같은 장 x-2 기준에서 몹 체력 +12%·피해 +10%로 고정(보상은 그대로)
export const MARK_REPEAT_DAY = 3;                          // 이미 깬 단계를 다시 깨서 받는 증표는 하루 3번까지
// 승급하면 지금 공격력 이상이 되는 가장 낮은 강화 수치에서 시작한다(+0부터면 223 → 190으로 약해졌다)
export const promoteEnh = (tier, enh) => { let e = 0; while (e < PROMOTE_NEED - 1 && weaponAtk(tier + 1, e) < weaponAtk(tier, enh)) e++; return e; };

// ── 스테이지 보상(금화·강화석) ──
// 2장부터 10% 더 준다: 후반 강화 한 번에 판이 너무 많이 들었다(25%면 완주가 3.7시간으로 짧아졌다)
export const clearGold = (c, s) => Math.round(75 * chCost(c) * (1 + 0.2 * oldS(s)) * (c >= 1 ? 1.1 : 1) / 5) * 5;
export const FIRST_CLEAR_MUL = 2.5;
// 새 장 도입 보상: 6장부터 장 첫 판(x-1)에 처음 들어가면 금화 꾸러미와 소탕권을 준다(6장부터 금화 쓸 곳이 갑자기 늘어 막히던 구간 완충). 기존 보상은 그대로
// 마지막 장(15장) 보스를 처음 잡을 때 따로 받는 완주 보상(업적·무기·펫과 별개). 장비는 한 등급 위로 2개
export const RELIC_DROP = 0.05;   // 15장 마지막 보스 희귀 보상(마왕의 목걸이) 확률
export const FINALE = { gem: 150, sweep: 3, guard: 2, stone: 40, items: 2 };
// 16~18장 보스를 처음 잡을 때 받는 새 보상(장마다 하나씩). 18장은 마지막이라 크다. 세트 장비(palace·skyway·clock)는 gear.js
export const LATE_FIRST = { 15: { gem: 100, stone: 30, guard: 2, items: 1, title: t('codex.93326b') }, 16: { gem: 120, stone: 36, guard: 2, items: 1, sweep: 2 }, 17: { gem: 200, stone: 50, guard: 3, items: 2, sweep: 3 } };
export const CHAPTER_INTRO = { from: 5, goldMul: 2, sweep: 1 };
export const introOf = c => c >= CHAPTER_INTRO.from ? { gold: Math.round(clearGold(c, 0) * CHAPTER_INTRO.goldMul / 5) * 5, sweep: CHAPTER_INTRO.sweep } : null;
export const clearStone = (c, s) => 3 + oldS(s) + c * 2;
export const FAIL_STONE_RATE = 0.5;                        // 져도 강화석을 같은 식으로 조금 준다(0개면 허탈했다)
// 자리를 비운 동안 견습생이 번다: 30분 넘게 비우면, 최대 8시간까지 시간당 지금 스테이지 클리어 보상의 50%(25%면 8시간이 두 판어치라 돌아올 맛이 없었다)
export const IDLE = { minMin: 30, capH: 8, perH: 0.5, bonusH: 12, bonusGem: 10 };   // 12시간 넘게 비웠으면 보석도 조금
export const FREE_REVIVE_RUNS = 3;   // 처음 세 판은 부활이 공짜(첫 판부터 광고를 들이밀지 않는다)
// 보스가 이 시간(ms) 넘게 버티면 지쳐서 받는 피해가 늘어난다(보스전이 늘어지지 않게)
// 49차: 장 마지막 보스는 권장 전투력 105%에서 40~60초 걸리게 한다(15장은 15초에 죽었다). hp: 체력 배수, sh: 페이즈 1·2에서 생기는 쉴드(체력 대비 비율, 쉴드 구간엔 약점이 열렸을 때 맞혀야만 깎인다)
// 1장 보스는 지금 길이(약 55초)를 유지한다
export const BOSS_TUNE = c => c < 1 ? { hp: 1, sh: [0, 0] } : { hp: +(1 + 0.27 * (c - 1)).toFixed(2), sh: [0.4, 0.4] };   // 장이 깊을수록 체력 배수를 키운다(후반 장은 권장 전투력 대비 훨씬 빨리 잡혔다)
// 50차: 보스 체력 = 최근 8초 실제 DPS x 목표 시간(초). 강화·장비가 올라도 순삭되지 않는다. K는 측정으로 맞춘 보정(단일 대상·약점·후반 성장)
export const BOSS_SEC = { mid: 78, last: 105 };   // 보스가 최소한 버티는 시간(초). 시작 체력은 DPS x 이 시간, 싸우는 동안 이보다 빨리 닳으면 체력 틀을 키워 시간 곡선을 지킨다
export const BOSS_FIT = { mid: 72, last: 108 };   // 53차: 보스에 실제 들어간 피해율에 체력을 맞춰 끝나게 할 목표 시간(초). 55차: 중간보스 목표 85→72(4-2·12-2·15-2가 90~93초로 90을 넘었다. 바닥은 BOSS_SEC.mid 78초가 지킨다). 중간보스 75~90, 장 보스 90~120 안
// 64차: 1-1 첫 통과 중간보스는 78초 버티기가 길었다(평가 64차 1-1 116초). 목표 시간을 0.7배로(약 55초). 다른 판은 그대로
export const FIRST_MID_K = 0.7;
export const BOSS_TIRED = { ms: 75000, midMs: 84000, mul: 1.5 };   // 55차: 중간보스도 84초가 지나면 지친다(75초 이상 버틴 뒤라 최소 시간은 그대로, 90초를 넘기는 판만 줄인다)
export const FAIL_GOLD_RATE = 0.5;                         // 실패해도 버틴 시간 비율 × 클리어 금화의 50%를 준다
// 은화는 판이 끝나면 사라진다(아껴 두지 말고 상점에서 바로 쓰게)
export const SWEEP_DAILY = 5, SWEEP_MAX = 12;

// ── 훈련(영구 능력치). v는 레벨당 효과 ──
export const TRAINING = [
  { id: 'hp', name: t('data.a45ea5'), desc: t('data.e36ea0'), v: 0.06, unit: '%', max: 15, base: 50 },
  { id: 'atk', name: t('data.43ddf0'), desc: t('data.b6691c'), v: 0.03, unit: '%', max: 15, base: 60 },
  { id: 'def', name: t('data.490212'), desc: t('data.ed39ed'), v: 0.015, unit: '%', max: 20, base: 70 },
  { id: 'spd', name: t('data.5e9f2c'), desc: t('data.4affb5'), v: 0.02, unit: '%', max: 10, base: 60 },
  { id: 'mag', name: t('data.0d4fff'), desc: t('data.7be700'), v: 0.1, unit: '%', max: 10, base: 40 },
  { id: 'luck', name: t('data.413755'), desc: t('data.27110f'), v: 0.04, unit: '%', max: 10, base: 80 },
  { id: 'regen', name: t('data.95ca12'), desc: t('data.9c422b'), v: 0.1, unit: '', max: 10, base: 90 },
  { id: 'revive', name: t('data.dc6cc3'), desc: t('data.655c81'), v: 1, unit: 'once', max: 1, base: 2500 },
];
// 5레벨마다 이정표: 한 레벨치 효과를 덤으로 준다(부활 같은 1회짜리는 제외)
export const TRAIN_MILE = 5, TRAIN_MILE_BONUS = 1;
export const trainVal = (t, lv) => (lv + (t.max >= TRAIN_MILE ? Math.floor(lv / TRAIN_MILE) * TRAIN_MILE_BONUS : 0)) * t.v;
// 전투력: 무기 공격력에 훈련(근력·체력·갑옷)을 합친 값. 권장 전투력과 비교한다(훈련만 올려도 숫자가 오른다)
// 장비(능력치·세트)와 무기 종류의 주 스탯(검·도끼 힘, 창 민첩)도 넣는다
export const powerOf = sv => {
  const tv = id => trainVal(TRAINING.find(t => t.id === id), sv.train?.[id] || 0);
  const g = gearStats(sv);
  return Math.round(weaponAtk(sv.tier, sv.enh) * (1 + tv('atk') + g.atk) * wMul(sv) * (1 + (tv('hp') + g.hp) * 0.25 + Math.min(0.6, tv('def') + g.def) * 0.5));
};
// 스테이지별 권장 전투력: 그 챕터 무기 등급에서 강화를 조금씩 더 올려야 깨지게
// 보스 판은 봇 실측에서 권장 100~130%로도 졌다: 권장을 올려 화면이 '충분'이라고 속이지 않게 한다
// 장 첫 판(2장부터)은 적응 판: 보스 바로 뒤라 강화를 덜 했어도 깰 수 있게 낮춘다
export const easeHp = (c, s) => c > 0 && s === 0 ? 0.9 : 1;
export const easeDmg = (c, s) => c > 0 && s === 0 ? 0.9 : 1;
// 64차: 1-3(1장 보스) 권장 28은 실제 통과선(전투력 약 17, 강화 +4~5)보다 높아 '권장 28 / 내 14'로 겁만 줬다. 통과선 기준으로 19(보스 초록은 1.2배)
export const CH1_BOSS_REC = 19;
export const recPower = (c, s) => c === 0 && s === 2 ? CH1_BOSS_REC : Math.round(REC_BASE(c) * stageMul(s) * easeHp(c, s) * (isBossS(s) && c > 0 ? 1.25 : 1) * GEAR_HP(c) * spReq(c * STAGES_PER_CHAPTER + s));
// 2장부터 장비·스탯으로 늘어나는 힘만큼 몹 체력과 권장 전투력을 올린다(1장은 장비 없이도 깨지게 그대로). 스탯(1점 +2%, 5점 보너스)까지 넣고 sim 완주 중앙 5.4h로 맞춘 값
// 6장부터는 장비·스탯으로 늘어나는 힘이 더 가파르다고 보고 장당 0.82씩(5장까지는 0.36)
const GEAR_SLOPE2 = 0.95;
export const GEAR_HP = c => c < 5 ? 1 + 0.36 * c : 1 + 0.36 * 4 + GEAR_SLOPE2 * (c - 4);
// 전투력 색: 권장을 넘어도 보스 판은 20% 여유가 있어야 초록(20차 봇: 1-6 권장 114%에서 졌다)
// 63차: 붉은색은 권장의 절반 미만일 때만(평가 61차: 권장 28/내 14에서도 1-3 보스를 깼다). 절반~권장은 '조금 어려움' 노랑
export const powerCol = (pw, rp, s) => pw >= rp * (isBossS(s) ? 1.2 : 1) ? '#5fdc6a' : pw >= rp * 0.5 ? '#ffd75e' : '#ff8070';
export const trainCost = (t, lv) => Math.round(t.base * Math.pow(1.23, lv) / 5) * 5;

// ── 판 안 성장 ──
export const PLAYER = { hp: 100, spd: 84, iframe: 600, pickup: 46 };
// 몹이 많아진 만큼 레벨업 간격을 늘리되, Lv6부터는 40% 줄여 한 판 안에 진화까지 닿게 한다
// 2레벨은 바로, 3~5레벨은 고르게(17차 150초에 Lv5, 18차 20초에 카드 4연타, 19차 20초에 3장 뒤 30초 공백)
// 49차: 첫 카드는 8~12초(2초에 뜨던 것을 늦춤). 2레벨 필요량을 늘렸다
const XP_EARLY = [0, 26, 10, 18, 28, 40];
// 63차: 1장(early)은 6레벨부터 필요량 ×1.3 — 카드 창은 그대로이고 뜨는 횟수만 줄인다
// 66차에 줄였던 6레벨부터의 필요량을 67차에 되돌렸다: 한 판 레벨업 25~28회라 무작위 카드도 스킬 4~6개를 전부 만렙으로 채웠다(빌드를 '골라서' 채우게. 보상은 그대로)
export const xpNeed = (lv, early = false) => lv <= 5 ? XP_EARLY[lv] : Math.round(Math.max(53, Math.round((8 + (lv - 1) * 11) * 0.6)) * (early ? 1.3 : 1));
export const PASSIVE_LV3 = 3;                                         // 이 레벨에 닿으면 한 번 더 붙는 보너스
export const ACTIVE_SLOTS = 4, PASSIVE_SLOTS = 4, SKILL_MAX = 5;

// 액티브 스킬. lv별 수치는 Battle에서 lv로 계산한다
export const SKILLS = {
  sword: { name: t('data.b48ea6'), type: 'active', icon: 0, desc: [t('data.719b5a'), t('data.d2ebf6'), t('data.b53fb2'), t('data.d55752'), t('data.d22185')] },
  spin: { name: t('data.8712a7'), type: 'active', icon: 4, desc: [t('data.31a62c'), t('data.4822d1'), t('data.d55752'), t('data.d1ddd3'), t('data.419172')] },
  dagger: { name: t('data.c0966c'), type: 'active', icon: 5, desc: [t('data.b4dc36'), t('data.ee9a86'), t('data.4822d1'), t('data.dfe38b'), t('data.d85f47')] },
  bolt: { name: t('data.4c2786'), type: 'active', icon: 6, desc: [t('data.0f6f09'), t('data.abe428'), t('data.de7411'), t('data.abe428'), t('data.5df273')] },
  holy: { name: t('data.fa5a03'), type: 'active', icon: 7, desc: [t('data.bfa191'), t('data.d55752'), t('data.4822d1'), t('data.898da6'), t('data.44af39')] },
  fireball: { name: t('data.b0c495'), type: 'active', icon: 8, desc: [t('data.d7f7c3'), t('data.4822d1'), t('data.0b713c'), t('data.7fb3d1'), t('data.f675c1')] },
  ice: { name: t('data.4ed23a'), type: 'active', icon: 9, desc: [t('data.a01586'), t('data.a3235b'), t('data.e7ba92'), t('data.de7411'), t('data.f2b42a')] },
  // 무기 전용 스킬: 그 무기를 든 판에서만 레벨업 카드에 나온다(진화 없음)
  wave: { name: t('data.632300'), type: 'active', icon: 0, tint: 0x40a0ff, flip: true, own: 'sword', desc: [t('data.58bff1'), t('data.4822d1'), t('data.f67bb6'), t('data.3236a0'), t('data.602b96')] },
  javelin: { name: t('data.931cad'), type: 'active', icon: 5, tint: 0xa8ffb0, own: 'spear', desc: [t('data.e94f2b'), t('data.4822d1'), t('data.34b2e4'), t('data.b79728'), t('data.97ea86')] },
  quake: { name: t('data.9019f4'), type: 'active', icon: 4, tint: 0xffb050, own: 'axe', desc: [t('data.6c3adc'), t('data.d55752'), t('data.de7411'), t('data.d1ddd3'), t('data.0c9c0e')] },
  volley: { name: t('data.180316'), type: 'active', icon: 5, tint: 0xffe0a0, own: 'bow', desc: [t('data.b85040'), t('data.f90aca'), t('data.4822d1'), t('data.7a50b6'), t('data.aa0e5f')] },
  grenade: { name: t('data.841359'), type: 'active', icon: 8, tint: 0xffd75e, own: 'gun', desc: [t('data.22b330'), t('data.4822d1'), t('data.0b713c'), t('data.97dc58'), t('data.f675c1')] },
  palm: { name: t('data.005d96'), type: 'active', icon: 6, tint: 0xffe070, own: 'knuckle', desc: [t('data.8b9c43'), t('data.4822d1'), t('data.6d8be2'), t('data.3236a0'), t('data.3e73e9')] },
  missile: { name: t('data.946272'), type: 'active', icon: 11, tint: 0xc890ff, own: 'staff', desc: [t('data.f7db1e'), t('data.3fe27d'), t('data.4822d1'), t('data.b29034'), t('data.a40799')] },
  orb: { name: t('data.6c97ca'), type: 'active', icon: 11, tint: 0x9ad0ff, desc: [t('data.37e5e9'), t('data.d87541'), t('data.4822d1'), t('data.d87541'), t('data.e8eea6')] },
  might: { name: t('data.cff8ee'), type: 'passive', icon: 0, tint: 0xff9a5a, desc: [t('data.c83067')], bonus: t('data.5eedab') },
  haste: { name: t('data.cb2ce0'), type: 'passive', icon: 10, desc: [t('data.3c4ccd')], bonus: t('data.e665d8') },
  focus: { name: t('data.56fb80'), type: 'passive', icon: 15, desc: [t('data.fd5d9c')], bonus: t('data.a4398a') },
  area: { name: t('data.7564f4'), type: 'passive', icon: 4, tint: 0x8affa0, desc: [t('data.27b348')], bonus: t('data.c94815') },
  magnet: { name: t('data.c72afb'), type: 'passive', icon: 13, desc: [t('data.7703b8')], bonus: t('data.0a8ed0') },
  vigor: { name: t('data.dce572'), type: 'passive', icon: 14, desc: [t('data.a45bcf')], bonus: t('data.9d8e4f') },
  // 50차: 모드 전용 카드(그 모드 판에서만 나온다, 슬롯을 쓰지 않는다). 효과는 modes.js
  mrepair: { name: t('data.c53463'), type: 'passive', mode: 'guard', icon: 14, tint: 0x7fd8ff, desc: [t('data.42ccc8'), t('data.fe0790'), t('data.d991f4'), t('data.c3ea5f'), t('data.045982')] },
  mthorn: { name: t('data.1c7aa0'), type: 'passive', mode: 'guard', icon: 4, tint: 0xff7050, desc: [t('data.74233a'), t('data.4046db'), t('data.2a2c8e'), t('data.9cace8'), t('data.a51ba6')] },
  mcapspeed: { name: t('data.941806'), type: 'passive', mode: 'capture', icon: 10, tint: 0x7ddc6a, desc: [t('data.0f2f7d'), t('data.9e322d'), t('data.e807d0'), t('data.675aad'), t('data.2a9439')] },
  mturret: { name: t('data.dbdf28'), type: 'passive', mode: 'capture', icon: 11, tint: 0xffd75e, desc: [t('data.daec8c'), t('data.81914c'), t('data.ce1aee'), t('data.5c944b'), t('data.32e3d5')] },
  mdash: { name: t('data.de1a8a'), type: 'passive', mode: 'breach', icon: 10, tint: 0xffd75e, desc: [t('data.b6c778'), '+12%', '+18%', '+24%', '+30%'] },
  mwallslow: { name: t('data.cd3357'), type: 'passive', mode: 'breach', icon: 13, tint: 0xa070ff, desc: [t('data.fb874e'), t('data.d12916'), t('data.549078'), t('data.4ddd65'), t('data.f80df5')] },
  mmark: { name: t('data.acb76b'), type: 'passive', mode: 'hunt', icon: 15, tint: 0xff7070, desc: [t('data.f1e059'), t('data.fdd98b'), t('data.f174f2'), t('data.0e1bd0'), t('data.7ad7f1')] },
  mweaken: { name: t('data.a1aec2'), type: 'passive', mode: 'hunt', icon: 0, tint: 0xc890ff, desc: [t('data.f4f57b'), t('data.a9804e'), t('data.a9804e'), t('data.a9804e'), t('data.a9804e')] },
};
export const PASSIVE_KEYS = ['might', 'haste', 'focus', 'area', 'magnet', 'vigor'];

// ── 판 안 상점(웨이브 사이) ──
// 가격 = 내림((기본가 + 회차×3) × (1 + 0.1×회차)) — 브로타토 가격 공식 변형. 회차는 이번 판에서 상점이 열린 횟수(0부터)
export const SHOP_ITEMS = [
  { id: 'meat', name: t('data.b7ce4b'), icon: 14, price: 18, desc: t('data.b80db6') },
  { id: 'whet', name: t('data.a21832'), icon: 0, price: 30, desc: t('data.2228b4') },
  { id: 'boots', name: t('data.cb2ce0'), icon: 10, price: 22, desc: t('data.a45aab') },
  { id: 'heart', name: t('data.3af434'), icon: 11, price: 34, desc: t('data.44bc3f') },
  { id: 'tome', name: t('data.7620ce'), icon: 15, price: 40, desc: t('data.f54847') },
  { id: 'chest', name: t('data.bca9df'), icon: 7, price: 55, desc: t('data.30fa5d') },
  { id: 'mana', name: t('data.ba9f46'), icon: 13, price: 20, desc: t('data.0e1883') },
  { id: 'magnet', name: t('data.a794e5'), icon: 12, price: 16, desc: t('data.2316ac') },
];
export const SHOP_SLOTS = 3;   // 장비 1 + 나머지 2(4칸은 90초 판이 자꾸 끊겼다)(42차)
// 상인이 파는 장비 기본가(일반·희귀·영웅·전설). 장비 칸은 매번 하나 나온다
export const SHOP_GEAR_PRICE = [18, 30, 56, 98];   // 영구 장비라도 물약(18~22)과 견줘 비싸 보였다
export const shopPrice = (base, round) => Math.floor((base + round * 3) * (1 + 0.1 * round));
export const rerollCost = (round, n) => 3 + round + 2 * n;   // n: 이번 상점에서 리롤한 횟수

// 웨이브: 일반 스테이지는 3웨이브(사이 상점 2번), 보스 스테이지는 2웨이브 + 보스
export const WAVES = 3;

// 궁극기(마나): 처치로 차고 가득 차면 버튼으로 쓴다
// 처치 +1, 엘리트 +10, 피격 +2. 발동: 화면 전체 큰 피해 + 2초 무적(보스는 피해 절반)
export const MANA_MAX = 100;
export const MANA_KILL = 1, MANA_ELITE = 10, MANA_HURT = 2;

// ── 드롭 ──
export const DROP = {
  silver: 0.55,        // 일반 몹 은화 확률(1개)
  heal: 0.02,          // 고기(최대 체력 15%) 기본 확률
  healLow: 0.03,       // 체력 40% 이하일 때 추가
  healCrit: 0.06,      // 체력 30% 이하일 때 추가
  healPity: 90000,     // 마지막 고기 뒤 90초 지나면 다음 처치에 확정
  magnet: 0.002,       // 화면의 보석을 다 끌어오는 자석
  eliteSilver: [15, 25],
  bossSilver: 100,
};
export const HEAL_PCT = 0.15;
// 보스 약점 구간(페이즈 전환 뒤 4.2초) 받는 피해 배수: 보스 체력은 그대로 두고 몰아치는 맛을 준다(48차 1.5 -> 2.2)
export const WEAK_MUL = 2.2;

// ── 과금 ──
// 보석: 유료 재화. 무료로도 꾸준히 모인다(출석·첫 클리어·광고). 보석 1개 ≈ 10원
// 보석으로는 '시간'과 '안전'을 산다(소탕권·방지권·강화석). 무기 공격력을 직접 팔지 않아 실력·강화의 재미를 지킨다
export const GEM_FREE = { daily: 20, stageFirst: 5, bossFirst: 50 };
export const IAP = [
  { id: 'starter', name: t('data.1fcc55'), price: 1200, once: true, tag: t('data.starterOnce'), desc: t('data.3ee4ff'), give: { hskin: 'crimson', gem: 300, guard: 3, stone: 60, gold: 3000 } },
  // 1,200원과 4,900원 사이가 비어 있었다: 꾸미기 둘을 한 번에(보석으로 사면 1,400)
  { id: 'cosm', name: t('data.69c6c8'), price: 3900, once: true, tag: t('data.5e6a58'), desc: t('data.aeeaa7'), give: { skin: 'frost', hskin: 'jade', gem: 100 } },
  { id: 'pass', name: t('data.9385e1'), price: 4900, tag: t('data.c8f6f3'), give: { gem: 300 }, passDays: 30 },
  // 광고 제거: 보석이 아닌 현금 상품. 광고 버튼(보석·소탕권·보상 2배·부활)이 광고 없이 바로 보상을 준다
  { id: 'noads', name: t('data.3720bb'), price: 5900, once: true, tag: t('data.a84b85'), desc: t('data.5f7e91'), give: { gem: 100 }, noAds: true },
  { id: 'gem1', name: t('data.b8140f'), price: 1200, give: { gem: 120 } },
  // 48차 가격 사다리: 2,900·9,900·19,900원. 보석 10원/개 기준에 큰 묶음일수록 덤이 커진다(+7% → +10% → +16% → +17% → +18%)
  { id: 'gem1b', name: t('data.064e59'), price: 2900, tag: '+7%', give: { gem: 310 } },
  { id: 'gem2', name: t('data.67465b'), price: 5900, tag: t('data.231956'), give: { gem: 650 } },
  // 49차: 9,900원 보석은 12,000원과 겹쳐 판매 중지(stop). 이미 콘솔에 등록된 ID라 지우지 않고 남긴다(기존 구매·미결 주문 복구용). 9,900원 자리는 특가 칸 중간 꾸러미(mid1)가 쓴다
  { id: 'gem2b', name: t('data.fb5726'), price: 9900, stop: true, tag: '+16%', give: { gem: 1150 } },
  { id: 'gem3', name: t('data.3fe2a7'), price: 12000, tag: '+17%', give: { gem: 1400 } },
  { id: 'gem4', name: t('data.327410'), price: 19900, tag: t('data.9e5e5e'), give: { gem: 2350 } },
];
// 보석 묶음은 처음 살 때 보석 2배(특가·성장 꾸러미·큰 꾸러미는 해당 없음)
export const FIRST_BUY_X2 = ['gem1', 'gem1b', 'gem2', 'gem2b', 'gem3', 'gem4'];
// 패키지 탭 구분(48차): 보석 묶음 / 꾸러미 / 정기
// 49차: 보석 가격 사다리 1,200 / 2,900 / 5,900 / 12,000 / 19,900 (덤 0 → 7 → 10 → 17 → 18%로 가격 따라 늘어난다)
export const PACK_GROUPS = { gem: ['gem1', 'gem1b', 'gem2', 'gem3', 'gem4'], bundle: ['starter', 'cosm', 'noads'], sub: ['pass'] };

// ── 한정 판매(상점 '특가' 칸) ──
// 오늘의 특가: 하루 한 번 아래 꾸러미 하나를 무작위 할인율로 판다. 기기 시간 자정에 바뀐다
export const DEALS = [
  { id: 'dstone', name: t('data.b79db0'), give: { stone: 200, guard: 2 } },
  { id: 'dguard', name: t('data.30b913'), give: { guard: 5, charm: 2 } },
  { id: 'dgem', name: t('data.cf135e'), give: { gem: 600, sweep: 10 } },
  { id: 'dgold', name: t('data.492bbd'), give: { goldStage: 10, stone: 80 } },
  { id: 'dluck', name: t('data.1e59c2'), give: { charm: 5, gem: 150 } },
];
export const DEAL_OFF = [30, 40, 50];   // 할인율(%)
// 46차: 원가는 '실제 상시 판매가'(보석 상점 개당 보석값 x 10원)의 합. 상시 판매가 없는 구성품이 있으면 null(원가·할인 표시 안 함)
const gemUnit = () => { const u = { gem: 1 }; GEM_SHOP.forEach(it => { const [k, v] = Object.entries(it.give)[0]; u[k] = it.cost / v; }); return u; };
export const dealRegular = d => { const u = gemUnit(); let g = 0; for (const [k, v] of Object.entries(d.give)) { if (!u[k]) return null; g += u[k] * v; } return Math.round(g * 10 / 100) * 100; };
export const dealPrice = (d, off) => Math.round(dealRegular(d) * (100 - off) / 10000) * 100;
// 성장 꾸러미: 장 보스를 처음 잡은 뒤 24시간. 다음 등급 +0→+10에 드는 강화석(30 + 10×등급)의 2배와 방지권
export const GROW = { ms: 24 * 3600000, price: [2900, 3900, 4900, 5900, 6900, 6900, 6900, 6900, 6900, 6900] };
export const growGive = c => { const t = Math.min(c + 1, TIERS.length - 1); return { stone: 2 * (30 + 10 * t), guard: 3 + c, goldStage: 4 }; };
// 큰 꾸러미: 달마다 한 번(보석 상자보다 보석당 값이 싸고 방지권·부적이 붙는다)
export const BIG_PACKS = [
  // 49차: 특가 칸 중간 꾸러미. 4,900~9,900원 사이가 비어 있었다(9,900원 보석 판매 중지 자리)
  { id: 'mid1', name: t('data.bd6bed'), price: 9900, month: true, tag: t('data.d77bed'), desc: t('data.fd5d3f'), give: { gem: 1100, guard: 6, charm: 3, stone: 150 } },
  { id: 'big1', name: t('data.e368f9'), price: 33000, month: true, tag: t('data.b2b222'), desc: t('data.9d0164'), give: { gem: 4000, guard: 10, charm: 5, stone: 300 } },
  { id: 'big2', name: t('data.5fb40d'), price: 55000, month: true, tag: t('data.a8afad'), desc: t('data.fe3501'), give: { gem: 7000, guard: 20, charm: 10, stone: 600, skin: 'void' } },
];
export const PASS_DAILY = { gem: 80, sweep: 3 };
// 보석으로 사는 것. gold 꾸러미는 지금 도전 중인 스테이지 클리어 금화의 3배
// 행운 부적: 강화 한 번 성공 확률 +5%p(1회 소모). 부서진 칼 되살리기: 보석 30 + 단계×10
export const CHARM_RATE = 5;
// 레벨업 카드 추방(이번 판에서 다시 안 나옴) 횟수
export const BANISH_PER_RUN = 2;
// 공짜 빼기·다시 뽑기를 다 쓰면 보석으로 더 쓴다
export const BAN_GEM = 5, REROLL_GEM = 5;
// 무한의 탑: 1장 보스를 깨면 열린다. 층(웨이브)마다 몹이 세지고 3층마다 해골 장군
// 3장부터 몬스터가 더 아프다: 상성 펫이 받는 피해를 줄여 이걸 메운다
export const LATE_DMG = 1.12;
export const ENDLESS = { unlock: 3, floorSec: 50, maxF: 3, gemPerNewFloor: 5, stonePerFloor: 2, goldPerFloor: 0.3, hpGrow: 1.28, dmgGrow: 1.2 };
// 칼빛(궤적 색) 꾸미기: 능력치는 그대로, 보이는 것만 바뀐다
export const SKINS = [
  { id: '', name: t('data.291e56'), desc: t('data.a33a32'), cost: 0 },
  { id: 'flame', name: t('data.306c35'), desc: t('data.0e25d3'), hue: 175, tint: 0xff5a2a, cost: 300 },
  { id: 'silver', name: t('data.496450'), desc: t('data.7b5022'), gray: true, tint: 0xffffff, cost: 600 },
  { id: 'gold', name: t('data.39a039'), desc: t('data.04e546'), hue: -150, tint: 0xffd75e, cost: 1200, ember: true },
  { id: 'frost', name: t('data.8cfc05'), desc: t('data.5b33d3'), hue: -60, tint: 0x9ae8ff, cost: 600 },
  { id: 'venom', name: t('data.6dfe2a'), desc: t('data.ffd9c1'), hue: -120, tint: 0x6fe36a, cost: 600 },
  { id: 'void', name: t('data.cc5f98'), desc: t('data.356129'), hue: 100, tint: 0xb07aff, cost: 1200, ember: true },
  { id: 'sakura', name: t('data.210952'), desc: t('data.0c62d4'), hue: 60, tint: 0xff6ad0, cost: 1500, ember: true },
];
// 비급: 보석으로 산 스킬은 판을 시작할 때부터 높은 Lv로 들고 들어간다(한 권만 낀다)
// 비급 Lv1(사기) 400 → Lv2 600 → Lv3 900(×1.5씩). 판 시작 스킬 Lv = 비급 Lv + 1(최대 Lv4, 스킬 최대 5는 판 안에서 올린다)
export const BOOKS = ['spin', 'dagger', 'bolt', 'holy', 'fireball', 'ice', 'orb'];
export const BOOK_COST = [400, 600, 900], BOOK_MAX = BOOK_COST.length, BOOK_GEM = BOOK_COST[0];
export const bookLv = (sv, k) => sv.books?.[k] === true ? 1 : sv.books?.[k] || 0;   // 예전 저장은 true(=Lv1)
export const bookSkillLv = lv => lv + 1;
// 무기를 다 모은 뒤 보스를 처음 잡으면 무기 대신 주는 강화석
export const DUP_W_STONE = 40;
// 시너지: 짝 스킬을 둘 다 가지면 두 스킬 모두 더 자주 나간다
export const SYNERGY = [
  { a: 'bolt', b: 'ice', name: t('data.7ee23b'), cd: true },
  { a: 'fireball', b: 'holy', name: t('data.9965d7'), cd: true },
  { a: 'spin', b: 'dagger', name: t('data.3798c8'), cd: true },
  { a: 'dagger', b: 'bolt', name: t('data.11b32f'), cd: true },
  { a: 'spin', b: 'holy', name: t('data.11600d'), cd: true },
  // 66차: 무기 전용 스킬과 맞물리는 짝. 쿨다운이 아니라 실제 상호작용이다(synergy.js)
  // prime이 적에게 상태(빙결·화상·감전·표식)를 걸고, pay 스킬이 그 상태의 적을 맞히면 추가 피해와 연쇄가 터진다
  { a: 'wave', b: 'ice', name: t('syn.frostwave'), fx: 'pay', pay: 'wave', prime: 'ice' },
  { a: 'wave', b: 'spin', name: t('syn.whirl'), fx: 'whirl' },
  { a: 'javelin', b: 'ice', name: t('syn.icelance'), fx: 'pay', pay: 'javelin', prime: 'ice' },
  { a: 'javelin', b: 'dagger', name: t('syn.splitjav'), fx: 'split', pay: 'javelin' },
  { a: 'quake', b: 'fireball', name: t('syn.lavacrack'), fx: 'lava' },
  { a: 'quake', b: 'holy', name: t('syn.holycrack'), fx: 'pay', pay: 'quake', prime: 'holy' },
  { a: 'volley', b: 'ice', name: t('syn.frostarrow'), fx: 'pay', pay: 'volley', prime: 'ice' },
  { a: 'volley', b: 'dagger', name: t('syn.chainshot'), fx: 'split', pay: 'volley' },
  { a: 'grenade', b: 'bolt', name: t('syn.shockboom'), fx: 'pay', pay: 'grenade', prime: 'bolt' },
  { a: 'grenade', b: 'dagger', name: t('syn.fragnade'), fx: 'frag' },
  { a: 'palm', b: 'spin', name: t('syn.spinpalm'), fx: 'twin' },
  { a: 'palm', b: 'ice', name: t('syn.frostpalm'), fx: 'pay', pay: 'palm', prime: 'ice' },
  { a: 'missile', b: 'fireball', name: t('syn.firemissile'), fx: 'pay', pay: 'missile', prime: 'fireball' },
  { a: 'missile', b: 'holy', name: t('syn.holymissile'), fx: 'pay', pay: 'missile', prime: 'holy' },
];
// 수호 구슬은 대기 시간 없이 늘 돌아서 '더 자주'가 효과가 없다: 시너지 짝에 넣지 않는다
export const SYN_CD = 0.75;
// 짝 효과가 쿨다운(cd)인 것만 재사용 시간을 줄인다(SYN_CD). 나머지는 synergy.js가 처리한다
export const synOf = (k, skills) => SYNERGY.filter(x => (x.a === k && skills[x.b]) || (x.b === k && skills[x.a]));
export const restoreGem = enh => 30 + enh * 10;
export const GEM_SHOP = [
  { id: 'guard', name: t('data.64e975'), icon: 11, cost: 80, give: { guard: 1 }, desc: t('data.a0ea65') },
  { id: 'charm', name: t('lobby.c5e28a'), icon: 7, cost: 120, give: { charm: 1 }, desc: t('data.69385a') },
  { id: 'sweep', name: t('data.eb8f10'), icon: 15, cost: 40, give: { sweep: 5 }, desc: t('data.57c9a7') },
  { id: 'stone', name: t('data.f30c68'), icon: 13, cost: 60, give: { stone: 40 }, desc: t('data.2dd711') },
  { id: 'gold', name: t('data.492bbd'), icon: 12, cost: 100, give: { goldStage: 3 } },
  { id: 'spReset', name: t('data.4dc434'), icon: 14, cost: SP_RESET_GEM, give: { spReset: 1 }, desc: t('data.6e794d') },
];
// 보상형 광고: 하루 횟수 제한
export const ADS = {
  // 하루 60: 월정액(하루 80)보다 적게 두되 볼 맛은 나게(39차: +10은 볼 이유가 없다). early: 처음 7일은 하루 5번(40차)
  gem: { name: t('data.502e9d'), daily: 3, early: 5, give: { gem: 20 } },
  sweep: { name: t('data.f37835'), daily: 1, give: { sweep: 1 } },   // 소탕권은 캐시 상품이라 광고로는 하루 1장만(사용자 10/31)
  double: { daily: 10 },   // 클리어 보상 2배
};
export const REVIVE_GEM = 30; // 쓰러졌을 때 보석 부활(판당 1번, 광고 부활과 같은 기회)

// ── 매일 할 일: 임무 3개 + 출석 7일 ──
export const MISSIONS = [
  { id: 'kill', name: t('data.0c8b84'), need: 100 },
  { id: 'clear', name: t('data.31ae7b'), need: 1 },
  { id: 'enh', name: t('data.35b3d5'), need: 1 },
];
export const MISSION_GIVE = { gem: 5, stone: 2 };
// 55차: 대장간 의뢰 — 매일 3개(날짜 번호로 돌려 가며 고른다). 진행은 오늘 임무 칸(mis)의 같은 세는 값을 쓰고 받은 표시는 misGot('o_id')에 둔다
// 확률·보상 수치는 그대로 두고 '강화에 실패해도 쌓이는 진행'을 더해 2장부터의 금화 벽 구간에 강화석·방지권이 들어오게 한다
export const FORGE_ORDERS = [
  { id: 'kill300', key: 'kill', need: 300, name: t('data.ordKill', { need: 300 }), give: { stone: 4 } },
  { id: 'sweep2', key: 'sweep', need: 2, name: t('data.ordSweep', { need: 2 }), give: { stone: 3 } },
  { id: 'enh3', key: 'enh', need: 3, name: t('data.ordEnh', { need: 3 }), give: { guard: 1 } },
  { id: 'fail1', key: 'fail', need: 1, name: t('data.ordFail', { need: 1 }), give: { stone: 3 } },
  { id: 'clear3', key: 'clear', need: 3, name: t('data.ordClear', { need: 3 }), give: { stone: 3 } },
  { id: 'kill600', key: 'kill', need: 600, name: t('data.ordKill', { need: 600 }), give: { stone: 6 } },
  { id: 'enh5', key: 'enh', need: 5, name: t('data.ordEnh', { need: 5 }), give: { guard: 1, stone: 2 } },
];
export const forgeOrdersToday = dayN => [0, 1, 2].map(i => FORGE_ORDERS[((dayN | 0) + i * 2) % FORGE_ORDERS.length]);
export const MISSION_ALL = { gem: 10 };
// 출석: 하루 빠지면 처음으로 돌아가지 않고 그 자리에 멈춘다
export const LOGIN_REWARDS = [
  { goldStage: 1 }, { stone: 20 }, { guard: 1 }, { goldStage: 2 }, { sweep: 3 }, { stone: 40 }, { gem: 100, skin: 'flame' },  // 7일째: 처음 한 번은 불꽃 칼빛까지
];

// 출석은 7일을 한 바퀴 돌 때마다 보상이 25%씩 늘어난다(최대 2배)
export const loginMul = streak => 1 + 0.25 * Math.min(4, Math.floor(Math.max(0, streak - 1) / 7));

// ── 어려움: 마왕을 잡으면 같은 15판을 센 몹·큰 보상으로 다시 돈다. 근거는 docs/CONTENT_PLAN.md ──
// k는 마지막 장 보스 권장 대비 배율. 판마다 4.5%씩, 장 첫 판은 조금 낮추고 보스 판은 높인다
// 장이 늘어 한 바퀴가 45판이 됐다: 판마다 오르는 비율을 15판 시절(14%/3%)에서 45판(약 4.5%/1%)으로 풀어 끝 판 권장이 예전과 비슷한 배율로 오르게 한다
// 열리는 때: 일반 모드를 끝까지 깬 뒤. 예전에 이미 어려움을 시작한 저장은 그대로 들어간다(hardOpen)
export const HARD = { unlock: MAIN_CHAPTERS * STAGES_PER_CHAPTER, start: 1, grow: 1.045, dmg: 1.05, dmgGrow: 1.01, firstGem: 10, bossGem: 80 };
export const hardOpen = sv => sv.cleared >= HARD.unlock || (sv.hardCleared || 0) > 0;
const LAST_C = MAIN_CHAPTERS - 1, LAST_S = 2;   // 어려움 수치는 본편 마지막 판(15-3)을 기준으로 16장 이후에도 같은 식으로 늘린다
export const hardK = (c, s) => HARD.start * Math.pow(HARD.grow, c * STAGES_PER_CHAPTER + s) * (isBossS(s) ? 1.12 : c > 0 && s === 0 ? 0.92 : 1);
export const hardRec = (c, s) => Math.round(recPower(LAST_C, LAST_S) * hardK(c, s));
// 몹 체력: 5-3 몹 체력 × k(보스 판이 아니면 권장의 보스 가산 1.25를 뺀다)
export const hardHp = (c, s) => chapterHp(LAST_C) * stageMul(LAST_S) * spReq(LAST_C * STAGES_PER_CHAPTER + LAST_S) * hardK(c, s) * (isBossS(s) ? 1 : 1.25);
export const hardDmg = (c, s) => chapterDmgRaw(LAST_C) * stageDmg(LAST_S) * LATE_DMG * HARD.dmg * Math.pow(HARD.dmgGrow, c * STAGES_PER_CHAPTER + s);
// 보상은 5-3의 1.2배에서 판마다 +8%p, 강화석은 판마다 +2(sim 어려움 완주 중앙 약 2.5h 더)
export const hardGold = (c, s) => Math.round(clearGold(LAST_C, LAST_S) * (1.2 + 0.08 * (c * STAGES_PER_CHAPTER + s)) / 5) * 5;
export const hardStone = (c, s) => clearStone(LAST_C, LAST_S) + 2 * (c * STAGES_PER_CHAPTER + s);
// 난이도에 따라 고른다(로비·결과·소탕이 같이 쓴다)
export const recOf = (c, s, hard) => hard ? hardRec(c, s) : recPower(c, s);
export const goldOf = (c, s, hard) => hard ? hardGold(c, s) : clearGold(c, s);
export const stoneOf = (c, s, hard) => hard ? hardStone(c, s) : clearStone(c, s);

// ── 일일 던전: 하루 2번, 60초. 요일마다 보상이 다르다(0 일요일) ──
export const DUNGEON = { unlock: 3, daily: 2, sec: 60, killNeed: 150, minPay: 0.2, hp: 0.55, goblinSec: 15 };
export const DUN_TYPES = {
  gold: { name: t('data.d73ae3'), desc: t('data.8c5ae3'), tint: 0xffd75e, css: '#ffd75e' },
  stone: { name: t('data.18e4cd'), desc: t('data.831ebe'), tint: 0x9ae0ff, css: '#9ae0ff' },
  gear: { name: t('data.ec6e5d'), desc: t('data.24795c'), tint: 0xc890ff, css: '#c890ff' },
  gem: { name: t('data.53c260'), desc: t('data.f0e734'), tint: 0xff9ad0, css: '#ff9ad0' },
};
export const DUN_WEEK = ['gem', 'gold', 'stone', 'gear', 'gold', 'stone', 'gear'];
export const dunToday = (d = new Date()) => DUN_WEEK[d.getDay()];
// 보상 기준: 지금 도전 중인 판(어려움을 시작했으면 어려움 판)의 클리어 보상
export const dunBase = sv => {
  const hard = (sv.hardCleared || 0) > 0, n = Math.min(hard ? sv.hardCleared : sv.cleared, openTotal() - 1);
  const c = Math.floor(n / STAGES_PER_CHAPTER), s = n % STAGES_PER_CHAPTER;
  return { c, s, hard, gold: goldOf(c, s, hard), stone: stoneOf(c, s, hard) };
};
// f: 채운 비율(0~1). 장비는 개수가 늘고 한 등급 위로 나온다
// main: 그날 주 보상(클리어 보상의 몇 배), side: 곁들이. 4배·1배일 땐 일반 완주가 5.7h → 4.5h로 줄었다
const D_MUL = { main: 1.6, side: 0.4 };
export const dunReward = (type, base, f) => {
  const k = Math.max(DUNGEON.minPay, Math.min(1, f));
  if (type === 'gold') return { gold: Math.round(base.gold * D_MUL.main * k), stone: Math.round(base.stone * D_MUL.side * k) };
  if (type === 'stone') return { gold: Math.round(base.gold * D_MUL.side * k), stone: Math.round(base.stone * D_MUL.main * k) };
  if (type === 'gear') return { gold: Math.round(base.gold * D_MUL.side * k), stone: Math.round(base.stone * D_MUL.side * k), items: 1 + Math.round(2 * k) };
  return { gold: Math.round(base.gold * D_MUL.side * k), stone: Math.round(base.stone * D_MUL.main * 0.5 * k), gem: Math.round(30 * k) };
};

// ── 주간 도전: 월요일에 새로 연다 ──
export const WEEKLY = [
  { id: 'kill', name: t('data.2f9c52'), need: 3000 },
  { id: 'clear', name: t('data.8a2177'), need: 15 },
  { id: 'enh', name: t('data.c72d7e'), need: 10 },
  { id: 'dun', name: t('data.65c72e'), need: 4 },
];
export const WEEKLY_GIVE = { gem: 20, stone: 10 };
export const WEEKLY_ALL = { gem: 50, guard: 1 };

// ── 깜짝 이벤트: 보스·탑·처음 두 판이 아니면 판마다 하나가 나올 수 있다 ──
export const PRACTICE_SEC = 30;   // 47차: 꾸미기 체험 연습장 길이
export const EVENTS = { chance: 0.55, kinds: ['goblin', 'bats', 'shrine', 'raid'], shrineBuff: { dmg: 0.3, spd: 0.15, ms: 20000 }, shrineStand: 2000 };
// 진 판이 이만큼 넘게 버텼으면 '조금만 더'를 띄운다
export const CLOSE_LOSS = 0.6;

// ── 진화: 액티브 5레벨 + 짝 패시브를 가지면 레벨업 카드에 진화가 뜬다 ──
export const EVOS = {
  sword: { need: 'might', name: t('data.1ed31f'), desc: t('data.c9d8ca') },
  spin: { need: 'haste', name: t('data.f0a099'), desc: t('data.338f49') },
  dagger: { need: 'focus', name: t('data.ccc7f4'), desc: t('data.effa56') },
  bolt: { need: 'area', name: t('data.70813b'), desc: t('data.89767e') },
  holy: { need: 'vigor', name: t('data.a3fc84'), desc: t('data.f149f9') },
  fireball: { need: 'magnet', name: t('data.cbe54b'), desc: t('data.6fb598') },
  orb: { need: 'area', name: t('data.9e8e53'), desc: t('data.a36eec') },
  ice: { need: 'focus', name: t('data.1b7f24'), desc: t('data.e5f0ba') },
};
