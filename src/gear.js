import { t } from './i18n.js';
// 장비·펫·스탯·무기 종류
// 드랍 장비는 등급마다 옵션 수가 다르고 수치가 무작위다. 세트는 2·4개를 맞추면 효과가 붙고, 숨겨진 템은 조건을 채워야 나온다
// 수치 기준: 1장 일반 4칸이면 피해·체력 +5%쯤, 4장 전설 4칸이면 +40%쯤(몹 체력도 챕터마다 ×(1+0.2c) 올린다)
const RF = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// 6장부터 두 장마다 장비 이름이 한 등급 오른다(무기 등급과 같은 순서)
const NEW_PRE = [t('data.cafc55'), t('data.eeac0d'), t('data.c53ca8'), t('data.82267f'), t('data.8ec2bb')];
export const SLOTS = [
  { id: 'helm', name: t('gear.b9b0fb'), main: 'hp', names: [t('gear.e42bf1'), t('gear.35ae57'), t('gear.2a4ce4'), t('gear.8d644d'), t('gear.ab5d3d'), ...NEW_PRE.map(p => t('gear.563e8c', { p }))] },
  { id: 'armor', name: t('data.490212'), main: 'def', names: [t('gear.a77b8d'), t('gear.b9a7c1'), t('gear.3a7ff1'), t('gear.a29ce4'), t('gear.2af0b7'), ...NEW_PRE.map(p => t('gear.7ba0fe', { p }))] },
  { id: 'boots', name: t('gear.7f0de4'), main: 'spd', names: [t('gear.46b6c6'), t('gear.bbaaf2'), t('gear.cbda60'), t('gear.b01018'), t('gear.652428'), ...NEW_PRE.map(p => t('gear.1ae2eb', { p }))] },
  { id: 'ring', name: t('gear.f8435c'), main: 'atk', names: [t('gear.edc528'), t('gear.f5ce27'), t('gear.3fd714'), t('gear.7ff559'), t('gear.cbe7bc'), ...NEW_PRE.map(p => t('gear.54cf95', { p }))] },
  { id: 'collar', name: t('gear.bc3a88'), main: 'pet', pet: true, names: [t('gear.b74209'), t('gear.f4f229'), t('gear.72886c'), t('gear.1c5853'), t('gear.d3325b'), ...NEW_PRE.map(p => t('gear.0fe653', { p }))] },
];
export const slotOf = id => SLOTS.find(s => s.id === id);

export const RARITY = [
  { name: t('gear.aef1a1'), color: 0x9a94a8, css: '#c8c2d8', mul: 1, subs: 0, salvage: 1 },
  { name: t('gear.402095'), color: 0x4aa8ff, css: '#6fc0ff', mul: 1.25, subs: 1, salvage: 2 },
  { name: t('lobby.be8063'), color: 0xb060ff, css: '#c890ff', mul: 1.55, subs: 2, salvage: 4 },
  { name: t('gear.72041d'), color: 0xff9a2a, css: '#ffb050', mul: 1.9, subs: 3, salvage: 8 },
  { name: t('codex.a34b3f'), color: 0xff5ad0, css: '#ff8ae0', mul: 1, subs: 0, salvage: 1 },
];
// 드랍 등급 가중치(일반·희귀·영웅·전설). 보스 판은 한 칸 위로 민다
const RARITY_W = [56, 30, 11, 3];

// 옵션 1회분 기준값(1장 일반). 챕터마다 ×(1+0.35c)
export const STATS = {
  hp: { name: t('data.e36ea0'), base: 0.04, pct: true },
  atk: { name: t('data.b6691c'), base: 0.025, pct: true },
  def: { name: t('data.ed39ed'), base: 0.012, pct: true },
  spd: { name: t('data.4affb5'), base: 0.02, pct: true },
  mag: { name: t('data.7be700'), base: 0.07, pct: true },
  luck: { name: t('gear.2388c3'), base: 0.012, pct: true },
  regen: { name: t('gear.2e8e06'), base: 0.1 },
  cd: { name: t('gear.cafd8d'), base: 0.012, pct: true },
  pet: { name: t('gear.a27d0d'), base: 0.12, pct: true },
};
const SUB_KEYS = ['hp', 'atk', 'def', 'spd', 'mag', 'luck', 'regen', 'cd'];
export const statText = (k, v) => STATS[k].pct ? `${STATS[k].name} +${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%` : `${STATS[k].name} +${v.toFixed(2)}`;

// 세트: 2개 효과는 능력치, 4개 효과는 전투 중 특수 효과(Battle·weapons에서 fx 이름으로 확인)
export const SETS = {
  flame: { name: t('gear.4ddc2b'), pre: t('gear.5c85eb'), css: '#ff8a4a', two: { atk: 0.1 }, twoTxt: t('gear.5bca81'), fourTxt: t('gear.2b2d06'), minC: 0 },
  frost: { name: t('gear.06b1b2'), pre: t('gear.d45acb'), css: '#9ae8ff', two: { def: 0.06 }, twoTxt: t('gear.2367e4'), fourTxt: t('gear.1b5fda'), minC: 1 },
  wind: { name: t('gear.75e1d5'), pre: t('gear.04b3ce'), css: '#a8ffb0', two: { spd: 0.12 }, twoTxt: t('gear.1b54c9'), fourTxt: t('gear.db06e4'), minC: 2 },
  // 6장~ 세트: 4세트 효과는 그 장의 지형을 다룬다(envfx.js)
  tide: { name: t('gear.2c5818'), pre: t('gear.610dd9'), css: '#5ae0d0', two: { def: 0.06 }, twoTxt: t('gear.2367e4'), fourTxt: t('gear.187007'), minC: 5 },
  crystal: { name: t('gear.52bf4b'), pre: t('gear.1c44ce'), css: '#c080ff', two: { cd: 0.08 }, twoTxt: t('data.fd5d9c'), fourTxt: t('gear.e71f23'), minC: 7 },
  sky: { name: t('gear.5bf334'), pre: t('gear.f1c803'), css: '#e8f4ff', two: { spd: 0.08 }, twoTxt: t('data.3c4ccd'), fourTxt: t('gear.467826'), minC: 9 },
  steam: { name: t('gear.b618ff'), pre: t('gear.620db6'), css: '#e08a50', two: { hp: 0.1 }, twoTxt: t('gear.fefbab'), fourTxt: t('gear.8a95df'), minC: 11 },
  mirror: { name: t('gear.2e8831'), pre: t('gear.a5d2e8'), css: '#90ffe8', two: { atk: 0.08 }, twoTxt: t('gear.9e0581'), fourTxt: t('gear.d88cb8'), minC: 13 },
  // 16~18장 세트: 장 열릴 때만 나온다(minC가 그 장). 4세트는 그 장의 기믹 피해를 약 40% 줄인다
  palace: { name: t('gear.9bba5e'), pre: t('gear.e7b3bd'), css: '#8ad8ff', two: { def: 0.07 }, twoTxt: t('gear.234918'), fourTxt: t('gear.df87e2'), minC: 15 },
  skyway: { name: t('gear.432096'), pre: t('gear.6fe2e2'), css: '#ffc890', two: { spd: 0.1 }, twoTxt: t('gear.1077c1'), fourTxt: t('gear.b302bd'), minC: 16 },
  clock: { name: t('gear.2cc839'), pre: t('gear.d121fc'), css: '#e8d090', two: { cd: 0.09 }, twoTxt: t('gear.aed6ea'), fourTxt: t('gear.29a9a9'), minC: 17 },
  thorn: { name: t('gear.804e48'), pre: t('gear.804e48'), css: '#7fd06a', two: { hp: 0.1 }, twoTxt: t('gear.fefbab'), fourTxt: t('gear.f353a7'), minC: 0 },
  gold: { name: t('gear.b25c04'), pre: t('gear.46395b'), css: '#ffd75e', two: { mag: 0.3 }, twoTxt: t('data.7703b8'), fourTxt: t('gear.aff98a'), minC: 1 },
  // 무기 전용 세트: 그 무기를 들고 싸울 때만 나온다(상인도 판다)
  sword: { w: 'sword', name: t('gear.2bea5d'), pre: t('gear.07fec2'), css: '#9ad8ff', two: { atk: 0.1 }, twoTxt: t('gear.5bca81'), fourTxt: t('gear.82f301'), minC: 0 },
  spear: { w: 'spear', name: t('gear.ce2b07'), pre: t('gear.cc6e77'), css: '#a8ffb0', two: { luck: 0.06 }, twoTxt: t('gear.47986c'), fourTxt: t('gear.0a3a2c'), minC: 0 },
  axe: { w: 'axe', name: t('gear.c78379'), pre: t('gear.e2a392'), css: '#ff7a5a', two: { hp: 0.12 }, twoTxt: t('gear.dc5cc3'), fourTxt: t('gear.fdf048'), minC: 0 },
  bow: { w: 'bow', name: t('gear.3d13f8'), pre: t('gear.921dce'), css: '#e8d08a', two: { cd: 0.08 }, twoTxt: t('data.fd5d9c'), fourTxt: t('gear.5b89ae'), minC: 0 },
  gun: { w: 'gun', name: t('gear.b026d6'), pre: t('gear.e08ae1'), css: '#ffb050', two: { spd: 0.1 }, twoTxt: t('gear.1077c1'), fourTxt: t('gear.1199c4'), minC: 0 },
  knuckle: { w: 'knuckle', name: t('gear.a2cff2'), pre: t('gear.ac9015'), css: '#ffe070', two: { def: 0.06 }, twoTxt: t('gear.2367e4'), fourTxt: t('gear.e2b9cf'), minC: 0 },
  staff: { w: 'staff', name: t('gear.b65756'), pre: t('gear.c8ab98'), css: '#c890ff', two: { cd: 0.1 }, twoTxt: t('gear.1c9604'), fourTxt: t('gear.04c4e6'), minC: 0 },
};

// 숨겨진 템: 한 번만 얻는다. 얻는 조건은 hint로 흐릿하게만 알려 준다
export const EGGS = {
  duck: { slot: 'ring', name: t('gear.6200c6'), st: { def: 0.12, luck: 0.06 }, desc: t('gear.e32d35'), hint: t('gear.83856f') },
  granny: { slot: 'helm', name: t('gear.3a4371'), st: { hp: 0.2, regen: 0.8 }, desc: t('gear.d600cf'), hint: t('gear.e32096') },
  apron: { slot: 'armor', name: t('gear.83fada'), st: { def: 0.08, hp: 0.12 }, desc: t('gear.8bdbfa'), hint: t('gear.46668c') },
  cat: { slot: 'boots', name: t('gear.6a09be'), st: { spd: 0.2, mag: 0.4 }, desc: t('gear.a36ef1'), hint: t('gear.a4bb6f') },
  rock: { slot: 'collar', name: t('gear.97efd8'), st: { pet: 1.0 }, desc: t('gear.227ed3'), hint: t('gear.358adf') },
};

// ── 무기 종류: 기본 공격·전용 스킬·잘 나오는 스킬·따르는 스탯이 다르다. 검 말고는 보스·정예를 잡거나 판을 깨면 무작위로 얻는다 ──
export const WTYPES = [
  { id: 'sword', name: t('gear.a2a7e6'), noun: t('gear.a2a7e6'), desc: t('gear.ce7066'), stat: 'str', tag: 'melee', fav: ['spin', 'orb', 'wave', 'might'], own: 'wave' },
  { id: 'spear', name: t('gear.c214a6'), noun: t('gear.c214a6'), desc: t('gear.e7ff7f'), stat: 'dex', tag: 'ranged', fav: ['dagger', 'ice', 'javelin', 'haste'], own: 'javelin' },
  { id: 'axe', name: t('gear.2c9df8'), noun: t('gear.2c9df8'), desc: t('gear.1bfd66'), stat: 'str', tag: 'melee', fav: ['fireball', 'holy', 'quake', 'vigor'], own: 'quake' },
  { id: 'bow', name: t('gear.1c93d6'), noun: t('gear.1c93d6'), desc: t('gear.aa96eb'), stat: 'dex', tag: 'ranged', fav: ['dagger', 'ice', 'volley', 'haste'], own: 'volley' },
  { id: 'gun', name: t('gear.10d96e'), noun: t('gear.10d96e'), desc: t('gear.621ee8'), stat: 'dex', tag: 'ranged', fav: ['bolt', 'dagger', 'grenade', 'focus'], own: 'grenade' },
  { id: 'knuckle', name: t('gear.a65ee1'), noun: t('gear.a65ee1'), desc: t('gear.012e4e'), stat: 'str', tag: 'melee', fav: ['spin', 'orb', 'palm', 'vigor'], own: 'palm' },
  { id: 'staff', name: t('gear.e5ed98'), noun: t('gear.e5ed98'), desc: t('gear.fd9ef8'), stat: 'int', tag: 'magic', fav: ['bolt', 'fireball', 'holy', 'missile'], own: 'missile' },
];
export const wtypeOf = sv => WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];

// ── 보석으로 사는 꾸미기 ──
// 영웅 스킨: 이전 색상 스킨 구매 내역을 보존한다. 능력치 보너스는 없다
export const HERO_SKINS = [
  { id: '', name: t('gear.eb1a0e'), desc: t('gear.4ddd2f'), cost: 0 },
  { id: 'crimson', name: t('gear.d167dd'), desc: t('gear.b73918'), hue: 150, cost: 500 },
  { id: 'shadow', name: t('gear.edf081'), desc: t('gear.7bc0ef'), gray: true, dark: true, cost: 500 },
  { id: 'jade', name: t('gear.a0e911'), desc: t('gear.5d91e7'), hue: -90, cost: 800 },
  { id: 'paladin', name: t('gear.c01c98'), desc: t('gear.b83810'), hue: -150, cost: 800 },
  { id: 'demon', name: t('gear.712e5a'), desc: t('gear.eba52e'), hue: 100, cost: 1600 },
];
// 캐시 무기: 무기 종류마다 하나. 그 무기를 들면 피해 +12%, 칼빛을 따로 안 끼면 고유 궤적 색
export const CASH_W = {
  sword: { name: t('gear.23f653'), hue: 175, tint: 0xff5a2a },
  spear: { name: t('gear.4c84aa'), hue: -60, tint: 0x9ae8ff },
  axe: { name: t('gear.515403'), hue: 100, tint: 0xb07aff },
  bow: { name: t('gear.baf63b'), hue: -150, tint: 0xffd75e },
  gun: { name: t('gear.9e0682'), hue: 60, tint: 0xff6ad0 },
  knuckle: { name: t('gear.7a7a42'), hue: -120, tint: 0x6fe36a },
  staff: { name: t('gear.13c3b9'), gray: true, tint: 0xffffff },
};
export const CASH_W_GEM = 900, CASH_W_DMG = 0.12;
export const heroSkin = sv => HERO_SKINS.find(x => x.id === (sv.hskin || '')) || HERO_SKINS[0];
export const cashW = sv => sv.cw?.[wtypeOf(sv).id] ? CASH_W[wtypeOf(sv).id] : null;
// 무기 해금(wOwn)은 보스·판 보상으로만 열린다. 캐시 무기(cw)는 따로 세고, 산 무기 종류는 해금 없이도 든다
// (캐시 무기를 사면 해금된 걸로 쳐서 보스 무기 보상이 줄던 문제)
export const hasW = (sv, id) => id === 'sword' || !!sv.wOwn?.[id];
export const ownsW = (sv, id) => hasW(sv, id) || !!sv.cw?.[id];
// 아직 해금 안 된 무기 하나를 무작위로 준다(없으면 null). 캐시 무기로도 못 드는 종류를 먼저. chance: 얻을 확률
export function grantWeapon(sv, chance = 1) {
  const left = WTYPES.filter(w => !hasW(sv, w.id));
  if (!left.length || Math.random() >= chance) return null;
  const fresh = left.filter(w => !ownsW(sv, w.id));
  const w = pick(fresh.length ? fresh : left);
  (sv.wOwn ||= {})[w.id] = true;
  return w;
}
// 무기 전용 스킬: 그 무기를 든 판에서만 나온다
export const OWN_SKILLS = WTYPES.map(w => w.own);
// 진행할수록 레벨업 카드에 새 스킬이 섞여 나온다(깬 스테이지 수)
export const SKILL_UNLOCK = { holy: 1, bolt: 2, fireball: 3, ice: 5 };

// ── 스탯: 스테이지를 처음 깰 때 2점, 보스는 2점 더(5장까지 40점, 6장부터는 판마다 1점·보스 1점 더) ──
export const SP = [
  { id: 'str', name: t('gear.ef089e'), desc: t('gear.d7322e'), css: '#ff9a7a' },
  { id: 'dex', name: t('gear.64b53c'), desc: t('gear.83fd4d'), css: '#a8ffb0' },
  { id: 'int', name: t('gear.448d3a'), desc: t('gear.940dd1'), css: '#9ad8ff' },
  { id: 'vit', name: t('data.a45ea5'), desc: t('gear.7d5210'), css: '#ffd75e' },
];
// 든 무기가 따르는 스탯 1점마다 모든 피해 +10%. 다른 무기 스탯에 찍은 점수는 피해를 올리지 않는다
// 몹 체력은 무기 스탯에 대부분 찍었다고 보고 올린다(spReq): 창을 들고 지능만 찍으면 뒤로 갈수록 못 깬다
export const SP_DMG = 0.1;
export const SKILL_TAG = { sword: 'melee', spin: 'melee', quake: 'melee', palm: 'melee', dagger: 'ranged', ice: 'ranged', javelin: 'ranged', wave: 'ranged', volley: 'ranged', grenade: 'ranged', bolt: 'magic', fireball: 'magic', holy: 'magic', orb: 'magic', missile: 'magic' };
export const TAG_NAME = { melee: t('gear.c95a16'), ranged: t('gear.e39bc2'), magic: t('gear.9d4179') };
// 15판(5장)까지는 스테이지 2점·보스 2점 더(40점). 6장부터는 판마다 1점·보스 1점 더로 완만하게(45판 끝까지 약 80점)
export const SP_OLD_END = 15;
export const spTotal = cleared => cleared <= SP_OLD_END ? cleared * 2 + Math.floor(cleared / 3) * 2
  : 40 + (cleared - SP_OLD_END) + (Math.floor(cleared / 3) - Math.floor(SP_OLD_END / 3));
export const spUsed = sv => SP.reduce((a, s) => a + (sv.sp?.[s.id] || 0), 0);
export const spFree = sv => spTotal(sv.cleared) - spUsed(sv);
// 5점마다 한 번 더 붙는 보너스(찍는 맛)
export const SP_MILE = 5, SP_MILE_DMG = 0.03, SP_MILE_HP = 0.05;
const spDmg = (n, k = SP_DMG) => k * n + SP_MILE_DMG * Math.floor(n / SP_MILE);
// 그 스탯이 주는 피해 배율 / 든 무기의 피해 배율
export const statMul = (sv, id) => 1 + spDmg(sv.sp?.[id] || 0);
export const wMul = sv => statMul(sv, wtypeOf(sv).stat);
// idx번째 스테이지에서 몹 체력에 곱하는 값: 무기 스탯에 80%를 찍은 사람이 예전(1점 +2%) 기준과 같은 힘이 되게
export const SP_INVEST = 0.8;
export const spReq = idx => { const e = Math.round(spTotal(idx) * SP_INVEST); return (1 + spDmg(e)) / (1 + spDmg(e, 0.02)); };
export const SP_RESET_GEM = 50;

// ── 펫: 깬 스테이지 수로 열린다. 금화로 키우고 목걸이를 끼워 준다 ──
// 보스를 처음 잡으면 그 보스를 작게 만든 펫이 따라온다. 장(맵)마다 잘 듣는 펫이 달라 처음 받은 펫도 뒷 장에서 다시 쓴다
// good: 그 장에서 효과 ×1.8 + 주인공 받는 피해 -20%, weak: 그 장에서 효과 ×0.6 (장 번호는 0부터)
export const PETS = [
  { id: 'general', name: t('battle.20631e'), desc: t('gear.e0457f'), unlock: 2, hint: t('gear.a32b6f'), color: 0xe8e2c8, good: [0, 2], tank: true },
  { id: 'kingslime', name: t('data.052600'), desc: t('gear.e49319'), unlock: 3, hint: t('gear.dc40e0'), color: 0x6fe36a, good: [1], weak: [2] },
  { id: 'lich', name: t('data.8938a1'), desc: t('gear.fd27a3'), unlock: 6, hint: t('gear.94c524'), color: 0xb07aff, good: [4], weak: [1] },
  { id: 'lavagolem', name: t('data.7464f1'), desc: t('gear.690878'), unlock: 9, hint: t('gear.4adfa8'), color: 0xff7a2a, good: [3], weak: [2], tank: true },
  { id: 'wyrm', name: t('data.05e151'), desc: t('gear.028ba6'), unlock: 12, hint: t('gear.14ff77'), color: 0x9ae8ff, good: [4] },   // 4-3에서 얻으면 남은 곳이 5장뿐이라 5장에 잘 듣게
  { id: 'demonlord', name: t('data.93df8f'), desc: t('gear.6acfc2'), unlock: 15, hint: t('gear.a17071'), color: 0xff3a50, good: [0, 1], weak: [4] },
  // 6장~: 보스 이름 = 펫 id. 지형 기믹을 다루는 펫이 하나씩 있다(good은 그 기믹이 심한 장)
  { id: 'tidewyrm', name: t('data.2758f7'), desc: t('gear.b6f98b'), unlock: 18, hint: t('gear.d23c11'), color: 0x5ae0d0, good: [5, 9], weak: [3] },
  { id: 'swampqueen', name: t('data.782796'), desc: t('gear.313f6a'), unlock: 21, hint: t('gear.709650'), color: 0xb060e0, good: [6, 10], weak: [4] },
  { id: 'crystcolossus', name: t('data.c93590'), desc: t('gear.0da21a'), unlock: 24, hint: t('gear.2d95ee'), color: 0xb080ff, good: [7, 13], weak: [5], tank: true },
  { id: 'stormcaptain', name: t('data.0e877d'), desc: t('gear.a5abb7'), unlock: 27, hint: t('gear.d497d9'), color: 0xd8e8ff, good: [8, 12], weak: [9] },
  { id: 'voidlord', name: t('data.15bd71'), desc: t('gear.34c282'), unlock: 30, hint: t('gear.841922'), color: 0x7a6aff, good: [9, 14], weak: [7] },
  { id: 'sandcolossus', name: t('data.134571'), desc: t('gear.03abd7'), unlock: 33, hint: t('gear.7ef7ca'), color: 0xe0c080, good: [10, 4], weak: [5], tank: true },
  { id: 'steamgeneral', name: t('data.37ac3b'), desc: t('gear.3d4f2a'), unlock: 36, hint: t('gear.a423d7'), color: 0xe08a50, good: [11, 14], weak: [8] },
  { id: 'thunderdragon', name: t('data.da6742'), desc: t('gear.3eeed8'), unlock: 39, hint: t('gear.086c44'), color: 0x9a8aff, good: [12, 14], weak: [10] },
  { id: 'mirrorlord', name: t('data.91fb7c'), desc: t('gear.1a6d5d'), unlock: 42, hint: t('gear.749dde'), color: 0x90ffe8, good: [13, 7], weak: [11] },
  { id: 'forgegod', name: t('data.66d303'), desc: t('gear.c941c0'), unlock: 45, hint: t('gear.b17e72'), color: 0xffd75e, good: [14, 6], weak: [12] },
];
// 예전 펫(불씨·슬라임·박쥐)을 키운 만큼 같은 때 받는 보스 펫으로 옮긴다
export const PET_OLD = { fire: 'general', slime: 'lich', bat: 'lavagolem' };
export const PET_GOOD = 1.8, PET_WEAK = 0.6, PET_GOOD_DEF = 0.2;   // 받는 피해 감소는 막아 주는 펫(tank)만
// 이 장에 잘 듣는 펫: 가진 것 먼저, 최대 두 마리
export const recPets = (sv, c) => PETS.filter(p => p.good?.includes(c) && sv.cleared >= p.unlock).slice(0, 2);   // 잠긴 펫은 '???'로 떠 뜻을 몰랐다
export const petFit = (p, c) => p.good?.includes(c) ? PET_GOOD : p.weak?.includes(c) ? PET_WEAK : 1;
export const PET_MAX = 20;
export const petCost = lv => Math.round(90 * Math.pow(1.27, lv) / 5) * 5;
// 펫 한 번 공격의 무기 공격력 대비 배율
export const petPow = lv => 0.6 + 0.08 * lv;   // 직접 피해 비중이 1~3%라 펫 차이가 안 보였다

// ── 장비 만들기 ──
let uidN = 0;
const uid = () => Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
const roll = (k, c, mul) => STATS[k].base * (1 + 0.35 * c) * mul * RF(0.75, 1.25);

export function rollRarity(boost = 0) {
  let r = Math.random() * RARITY_W.reduce((a, b) => a + b, 0), i = 0;
  while ((r -= RARITY_W[i]) > 0) i++;
  return Math.min(3, i + boost);
}

// c: 얻은 챕터(수치 기준), opt: { rarity, slot, boost, set }
export function makeItem(c, opt = {}) {
  const r = opt.rarity ?? rollRarity(opt.boost || 0);
  const slot = slotOf(opt.slot || pick(SLOTS.map(s => s.id)));
  const ci = Math.min(c, 17), ni = c < 5 ? c : Math.min(slot.names.length - 1, 5 + Math.floor((c - 5) / 2));   // ci: 장(수치), ni: 이름 칸(두 장에 한 칸)
  // 희귀 이상은 55% 확률로 세트(든 무기의 전용 세트 60%, 나머지는 그 챕터 공용 세트). 4세트가 너무 안 모였다
  const sets = Object.entries(SETS).filter(([, s]) => !s.w && s.minC <= c).map(([k]) => k);
  const wset = opt.w && SETS[opt.w] ? opt.w : null;
  const set = opt.set || (r >= 1 && !slot.pet && Math.random() < (opt.setP ?? 0.55) ? (wset && Math.random() < 0.6 ? wset : pick(sets)) : null);
  const st = {};
  st[slot.main] = roll(slot.main, ci, RARITY[r].mul * 1.6);
  const pool = SUB_KEYS.filter(k => k !== slot.main);
  for (let i = 0; i < RARITY[r].subs; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    st[k] = (st[k] || 0) + roll(k, ci, RARITY[r].mul * 0.8);
  }
  for (const k in st) st[k] = Math.round(st[k] * 1000) / 1000;
  return { u: uid(), s: slot.id, r, c: ci, n: set ? `${SETS[set].pre} ${slot.name}` : slot.names[ni], set, st };
}
// 장비 이름은 저장된 글자(it.n)가 아니라 종류·세트·단계로 지금 언어에서 다시 만든다(옛 저장도 같다)
export function itemName(it) {
  if (it.egg && EGGS[it.egg]) return EGGS[it.egg].name;
  const slot = SLOTS.find(x => x.id === it.s);
  if (!slot) return it.n;
  const c = it.c || 0, ni = c < 5 ? c : Math.min(slot.names.length - 1, 5 + Math.floor((c - 5) / 2));
  return it.set && SETS[it.set] ? `${SETS[it.set].pre} ${slot.name}` : slot.names[ni] || it.n;
}
export const makeEgg = id => ({ u: uid(), s: EGGS[id].slot, r: 4, c: 0, n: EGGS[id].name, egg: id, st: { ...EGGS[id].st } });

// 장비 점수(정렬·비교용): 옵션 값을 기준값으로 나눠 더한다
export const itemScore = it => Object.entries(it.st).reduce((a, [k, v]) => a + v / STATS[k].base, 0) + (it.set ? 3 : 0) + (it.egg ? 6 : 0);

// 낀 장비 목록
export const equipped = sv => Object.values(sv.eq || {}).map(u => (sv.inv || []).find(it => it.u === u)).filter(Boolean);

// 낀 장비·세트를 더한 능력치. fx: 세트 4개 효과·숨겨진 템 효과 이름
export function gearStats(sv) {
  const out = { hp: 0, atk: 0, def: 0, spd: 0, mag: 0, luck: 0, regen: 0, cd: 0, pet: 0, sets: {}, fx: new Set() };
  for (const it of equipped(sv)) {
    for (const [k, v] of Object.entries(it.st)) out[k] += v;
    if (it.set) out.sets[it.set] = (out.sets[it.set] || 0) + 1;
    if (it.egg) out.fx.add(it.egg);
  }
  for (const [k, n] of Object.entries(out.sets)) {
    if (n >= 2) for (const [sk, v] of Object.entries(SETS[k].two)) out[sk] += v;
    if (n >= 4) out.fx.add(k + '4');
  }
  // 영웅 스킨·캐시 무기
  // 캐릭터·의상은 시각 효과만: 기존 영웅 스킨도 능력치에 더하지 않는다.
  if (cashW(sv)) out.atk += CASH_W_DMG;
  // 스탯 체력·민첩·지능
  const sp = sv.sp || {};
  out.hp += 0.04 * (sp.vit || 0) + SP_MILE_HP * Math.floor((sp.vit || 0) / SP_MILE); out.regen += 0.02 * (sp.vit || 0);
  out.spd += 0.003 * (sp.dex || 0); out.cd += 0.003 * (sp.int || 0);
  // 도감 보너스(codex.js dexRefresh가 계산해 둔 값)
  out.hp += sv.dexB?.hp || 0; out.atk += sv.dexB?.atk || 0;
  return out;
}

// 인벤토리에 넣는다. 꽉 차면 끼지 않은·잠그지 않은 가장 약한 것을 자동 정리한다(분해 또는 판매: sv.bagAuto)
export const INV_MAX = 60;
// 판매가 식은 data.js에 기대서 gearSell.js가 등록한다(data.js가 gear.js를 불러와 순환을 피한다)
let sellFn = () => 0;
export const setSellFn = f => { sellFn = f; };
export const sellOf = it => (it.egg ? 0 : sellFn(it));
// 방금 addItems가 자동 정리한 결과 { n, gold, stone }
let tidyLast = { n: 0, gold: 0, stone: 0 };
export const lastTidy = () => tidyLast;
export function addItems(sv, items) {
  sv.inv ||= []; let stone = 0;
  sv.eq ||= {};
  tidyLast = { n: 0, gold: 0, stone: 0 };
  const sell = sv.bagAuto === 'sell';
  for (const it of items) {
    if (it.egg) { if (sv.eggs?.[it.egg]) continue; (sv.eggs ||= {})[it.egg] = true; }
    if (sv.inv.some(x => x.u === it.u)) continue;   // 판 안에서 이미 끼운 장비
    sv.inv.push(it);
    if (it.set) ((sv.dex ||= {}).s ||= {})[it.set] = 1;   // 도감: 세트 한 부위라도 얻었다
    // 빈 부위는 바로 낀다(장비 탭을 안 열어도 새 장비가 전투에 들어가게)
    if (!sv.eq[it.s] && !it.bag) sv.eq[it.s] = it.u;   // 판에서 '가방에'를 고른 건 끼지 않는다
    if (sv.inv.length > INV_MAX) {
      const on = new Set(Object.values(sv.eq || {}));
      const worst = sv.inv.filter(x => !on.has(x.u) && !x.egg && !x.lock).sort((a, b) => itemScore(a) - itemScore(b))[0];
      if (worst) {
        sv.inv.splice(sv.inv.indexOf(worst), 1); tidyLast.n++;
        if (sell) { const g = sellOf(worst); sv.gold += g; tidyLast.gold += g; }
        else { const st = RARITY[worst.r].salvage; stone += st; tidyLast.stone += st; }
      }
    }
  }
  sv.stone += stone;
  return stone;
}
// 숨겨진 템을 한 번만 준다. add가 false면 아이템만 돌려준다(전투 중 줍는 것은 판이 끝날 때 넣는다)
// 얻었다는 표시는 가방에 들어갈 때(addItems) 남긴다: 판 도중 앱이 꺼져도 다시 얻을 수 있게
const pending = new Set();
export function grantEgg(sv, id, add = true) {
  if (sv.eggs?.[id] || pending.has(id)) return null;
  const it = makeEgg(id);
  if (add) addItems(sv, [it]); else pending.add(id);
  return it;
}
export const eggsSettled = () => pending.clear();
// 전투 중 드랍 하나(인벤토리에는 판이 끝날 때 넣는다): 아주 드물게 고무 오리
export function dropItem(sv, c, opt = {}) {
  if (Math.random() < 0.004) { const e = grantEgg(sv, 'duck', false); if (e) return e; }
  return makeItem(c, { w: sv.wtype, ...opt });
}
