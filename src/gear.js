// 장비·펫·스탯·무기 종류
// 드랍 장비는 등급마다 옵션 수가 다르고 수치가 무작위다. 세트는 2·4개를 맞추면 효과가 붙고, 숨겨진 템은 조건을 채워야 나온다
// 수치 기준: 1장 일반 4칸이면 피해·체력 +5%쯤, 4장 전설 4칸이면 +40%쯤(몹 체력도 챕터마다 ×(1+0.2c) 올린다)
const RF = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export const SLOTS = [
  { id: 'helm', name: '투구', main: 'hp', names: ['가죽 두건', '철 투구', '미스릴 투구', '룬 투구', '마왕의 뿔투구'] },
  { id: 'armor', name: '갑옷', main: 'def', names: ['누빈 옷', '사슬 갑옷', '미스릴 갑옷', '룬 갑옷', '마왕의 흑갑'] },
  { id: 'boots', name: '장화', main: 'spd', names: ['헌 장화', '철 장화', '미스릴 장화', '룬 장화', '마왕의 군화'] },
  { id: 'ring', name: '반지', main: 'atk', names: ['구리 반지', '은 반지', '미스릴 반지', '룬 반지', '마왕의 인장'] },
  { id: 'collar', name: '펫 목걸이', main: 'pet', pet: true, names: ['가죽 목걸이', '방울 목걸이', '미스릴 목걸이', '룬 목걸이', '마왕의 목줄'] },
];
export const slotOf = id => SLOTS.find(s => s.id === id);

export const RARITY = [
  { name: '일반', color: 0x9a94a8, css: '#c8c2d8', mul: 1, subs: 0, salvage: 1 },
  { name: '희귀', color: 0x4aa8ff, css: '#6fc0ff', mul: 1.25, subs: 1, salvage: 2 },
  { name: '영웅', color: 0xb060ff, css: '#c890ff', mul: 1.55, subs: 2, salvage: 4 },
  { name: '전설', color: 0xff9a2a, css: '#ffb050', mul: 1.9, subs: 3, salvage: 8 },
  { name: '숨겨진', color: 0xff5ad0, css: '#ff8ae0', mul: 1, subs: 0, salvage: 1 },
];
// 드랍 등급 가중치(일반·희귀·영웅·전설). 보스 판은 한 칸 위로 민다
const RARITY_W = [56, 30, 11, 3];

// 옵션 1회분 기준값(1장 일반). 챕터마다 ×(1+0.35c)
export const STATS = {
  hp: { name: '최대 체력', base: 0.04, pct: true },
  atk: { name: '모든 피해', base: 0.025, pct: true },
  def: { name: '받는 피해 감소', base: 0.012, pct: true },
  spd: { name: '이동 속도', base: 0.02, pct: true },
  mag: { name: '줍는 거리', base: 0.07, pct: true },
  luck: { name: '치명·은화', base: 0.012, pct: true },
  regen: { name: '초당 회복', base: 0.1 },
  cd: { name: '재사용 대기 감소', base: 0.012, pct: true },
  pet: { name: '펫 피해', base: 0.12, pct: true },
};
const SUB_KEYS = ['hp', 'atk', 'def', 'spd', 'mag', 'luck', 'regen', 'cd'];
export const statText = (k, v) => STATS[k].pct ? `${STATS[k].name} +${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%` : `${STATS[k].name} +${v.toFixed(2)}`;

// 세트: 2개 효과는 능력치, 4개 효과는 전투 중 특수 효과(Battle·weapons에서 fx 이름으로 확인)
export const SETS = {
  flame: { name: '대장장이의 불꽃', pre: '불꽃 대장장이의', css: '#ff8a4a', two: { atk: 0.1 }, twoTxt: '모든 피해 +10%', fourTxt: '맞힌 적이 25% 확률로 폭발한다', minC: 0 },
  frost: { name: '서리 수호자', pre: '서리 수호자의', css: '#9ae8ff', two: { def: 0.06 }, twoTxt: '받는 피해 -6%', fourTxt: '맞으면 주변 적을 2초 얼린다(6초마다)', minC: 1 },
  wind: { name: '바람 사냥꾼', pre: '바람 사냥꾼의', css: '#a8ffb0', two: { spd: 0.12 }, twoTxt: '이동 속도 +12%', fourTxt: '모든 스킬 재사용 대기 -18%', minC: 2 },
  thorn: { name: '가시 덩굴', pre: '가시 덩굴', css: '#7fd06a', two: { hp: 0.1 }, twoTxt: '최대 체력 +10%', fourTxt: '맞으면 주변 적에게 가시가 박힌다', minC: 0 },
  gold: { name: '황금 상인', pre: '황금 상인의', css: '#ffd75e', two: { mag: 0.3 }, twoTxt: '줍는 거리 +30%', fourTxt: '은화 +50%, 상인 물건 20% 할인', minC: 1 },
  // 무기 전용 세트: 그 무기를 들고 싸울 때만 나온다(상인도 판다)
  sword: { w: 'sword', name: '검성', pre: '검성의', css: '#9ad8ff', two: { atk: 0.1 }, twoTxt: '모든 피해 +10%', fourTxt: '세 번 벨 때마다 검기가 날아간다', minC: 0 },
  spear: { w: 'spear', name: '용기사', pre: '용기사의', css: '#a8ffb0', two: { luck: 0.06 }, twoTxt: '치명·은화 +6%', fourTxt: '찌를 때 25% 확률로 투창을 던진다', minC: 0 },
  axe: { w: 'axe', name: '광전사', pre: '광전사의', css: '#ff7a5a', two: { hp: 0.12 }, twoTxt: '최대 체력 +12%', fourTxt: '체력 절반 아래면 피해 +30%·받는 피해 -20%', minC: 0 },
  bow: { w: 'bow', name: '사냥꾼', pre: '사냥꾼의', css: '#e8d08a', two: { cd: 0.08 }, twoTxt: '재사용 대기 -8%', fourTxt: '세 번째 화살마다 터진다', minC: 0 },
  gun: { w: 'gun', name: '총잡이', pre: '총잡이의', css: '#ffb050', two: { spd: 0.1 }, twoTxt: '이동 속도 +10%', fourTxt: '다섯 번째 총알은 피해 2배', minC: 0 },
  knuckle: { w: 'knuckle', name: '무도가', pre: '무도가의', css: '#ffe070', two: { def: 0.06 }, twoTxt: '받는 피해 -6%', fourTxt: '열 번 칠 때마다 충격파가 퍼진다', minC: 0 },
  staff: { w: 'staff', name: '대마법사', pre: '대마법사의', css: '#c890ff', two: { cd: 0.1 }, twoTxt: '재사용 대기 -10%', fourTxt: '스킬이 10% 확률로 한 번 더 나간다', minC: 0 },
};

// 숨겨진 템: 한 번만 얻는다. 얻는 조건은 hint로 흐릿하게만 알려 준다
export const EGGS = {
  duck: { slot: 'ring', name: '고무 오리', st: { def: 0.12, luck: 0.06 }, desc: '맞으면 꽥! 하고 운다', hint: '아주 드물게, 아무 데서나' },
  granny: { slot: 'helm', name: '할머니 뜨개 모자', st: { hp: 0.2, regen: 0.8 }, desc: '쓰러져도 따뜻하다', hint: '열 번 쓰러지면' },
  apron: { slot: 'armor', name: '대장장이 앞치마', st: { def: 0.08, hp: 0.12 }, desc: '끼고 있으면 강화 성공 확률 +5%p', hint: '칼을 세 번 부수면' },
  cat: { slot: 'boots', name: '고양이 발 장화', st: { spd: 0.2, mag: 0.4 }, desc: '발소리가 나지 않는다', hint: '도망치는 고블린이 가끔' },
  rock: { slot: 'collar', name: '이상한 돌멩이', st: { pet: 1.0 }, desc: '펫이 이걸 아주 좋아한다', hint: '대장간에서 칼을 자꾸 건드리면' },
};

// ── 무기 종류: 기본 공격·전용 스킬·잘 나오는 스킬·따르는 스탯이 다르다. 검 말고는 보스·정예를 잡거나 판을 깨면 무작위로 얻는다 ──
export const WTYPES = [
  { id: 'sword', name: '검', noun: '검', desc: '앞쪽을 넓게 벤다', stat: 'str', tag: 'melee', fav: ['spin', 'orb', 'wave', 'might'], own: 'wave' },
  { id: 'spear', name: '창', noun: '창', desc: '좁고 길게 꿰뚫는다', stat: 'dex', tag: 'ranged', fav: ['dagger', 'ice', 'javelin', 'haste'], own: 'javelin' },
  { id: 'axe', name: '도끼', noun: '도끼', desc: '느리지만 사방을 크게 찍는다', stat: 'str', tag: 'melee', fav: ['fireball', 'holy', 'quake', 'vigor'], own: 'quake' },
  { id: 'bow', name: '활', noun: '활', desc: '멀리서 꿰뚫는 화살을 쏜다', stat: 'dex', tag: 'ranged', fav: ['dagger', 'ice', 'volley', 'haste'], own: 'volley' },
  { id: 'gun', name: '총', noun: '총', desc: '총알을 연달아 쏜다', stat: 'dex', tag: 'ranged', fav: ['bolt', 'dagger', 'grenade', 'focus'], own: 'grenade' },
  { id: 'knuckle', name: '너클', noun: '너클', desc: '붙어서 아주 빠르게 친다', stat: 'str', tag: 'melee', fav: ['spin', 'orb', 'palm', 'vigor'], own: 'palm' },
  { id: 'staff', name: '지팡이', noun: '지팡이', desc: '적을 따라가는 마력탄을 쏜다', stat: 'int', tag: 'magic', fav: ['bolt', 'fireball', 'holy', 'missile'], own: 'missile' },
];
export const wtypeOf = sv => WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];

// ── 보석으로 사는 꾸미기 ──
// 영웅 스킨: 주인공 몸 색이 바뀌고 작은 능력치가 붙는다(st 값은 장비 옵션과 같은 비율)
export const HERO_SKINS = [
  { id: '', name: '기본 모험가', desc: '처음 옷', cost: 0 },
  { id: 'crimson', name: '진홍 기사', desc: '최대 체력 +6%', hue: 150, st: { hp: 0.06 }, cost: 500 },
  { id: 'shadow', name: '그림자 추적자', desc: '이동 속도 +6%', gray: true, dark: true, st: { spd: 0.06 }, cost: 500 },
  { id: 'jade', name: '비취 수도승', desc: '재사용 대기 -5%', hue: -90, st: { cd: 0.05 }, cost: 800 },
  { id: 'paladin', name: '황금 성기사', desc: '피해 +6%', hue: -150, st: { atk: 0.06 }, cost: 800 },
  { id: 'demon', name: '마왕 갑주', desc: '피해 +8% · 체력 +8%', hue: 100, st: { atk: 0.08, hp: 0.08 }, cost: 1600 },
];
// 캐시 무기: 무기 종류마다 하나. 그 무기를 들면 피해 +12%, 칼빛을 따로 안 끼면 고유 궤적 색
export const CASH_W = {
  sword: { name: '용살검', hue: 175, tint: 0xff5a2a },
  spear: { name: '천룡창', hue: -60, tint: 0x9ae8ff },
  axe: { name: '파멸의 도끼', hue: 100, tint: 0xb07aff },
  bow: { name: '천궁', hue: -150, tint: 0xffd75e },
  gun: { name: '마도총', hue: 60, tint: 0xff6ad0 },
  knuckle: { name: '용권', hue: -120, tint: 0x6fe36a },
  staff: { name: '대현자의 지팡이', gray: true, tint: 0xffffff },
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

// ── 스탯: 스테이지를 처음 깰 때 1점, 보스는 2점 더(끝까지 40점) ──
export const SP = [
  { id: 'str', name: '힘', desc: '검·도끼·너클 피해 +10%', css: '#ff9a7a' },
  { id: 'dex', name: '민첩', desc: '창·활·총 피해 +10% · 이동 +0.3%', css: '#a8ffb0' },
  { id: 'int', name: '지능', desc: '지팡이 피해 +10% · 재사용 -0.3%', css: '#9ad8ff' },
  { id: 'vit', name: '체력', desc: '최대 체력 +4% · 회복 +0.02/초', css: '#ffd75e' },
];
// 든 무기가 따르는 스탯 1점마다 모든 피해 +10%. 다른 무기 스탯에 찍은 점수는 피해를 올리지 않는다
// 몹 체력은 무기 스탯에 대부분 찍었다고 보고 올린다(spReq): 창을 들고 지능만 찍으면 뒤로 갈수록 못 깬다
export const SP_DMG = 0.1;
export const SKILL_TAG = { sword: 'melee', spin: 'melee', quake: 'melee', palm: 'melee', dagger: 'ranged', ice: 'ranged', javelin: 'ranged', wave: 'ranged', volley: 'ranged', grenade: 'ranged', bolt: 'magic', fireball: 'magic', holy: 'magic', orb: 'magic', missile: 'magic' };
export const TAG_NAME = { melee: '근접', ranged: '원거리', magic: '마법' };
export const spTotal = cleared => cleared * 2 + Math.floor(cleared / 3) * 2;   // 스테이지 2점, 보스 2점 더(끝까지 40점)
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
  { id: 'general', name: '해골 장군', desc: '방패로 한 대를 막아 준다', unlock: 2, hint: '1-2 중간 보스', color: 0xe8e2c8, good: [0, 2], tank: true },
  { id: 'kingslime', name: '슬라임 왕', desc: '은화·상자를 주워 온다', unlock: 3, hint: '1-3 보스', color: 0x6fe36a, good: [1], weak: [2] },
  { id: 'lich', name: '리치 왕', desc: '저주로 적을 약하게 한다', unlock: 6, hint: '2-3 보스', color: 0xb07aff, good: [4], weak: [1] },
  { id: 'lavagolem', name: '용암 거신', desc: '둘레에 불바다를 깐다', unlock: 9, hint: '3-3 보스', color: 0xff7a2a, good: [3], weak: [2], tank: true },
  { id: 'wyrm', name: '서리 용', desc: '입김으로 앞쪽 적을 얼린다', unlock: 12, hint: '4-3 보스', color: 0x9ae8ff, good: [4] },   // 4-3에서 얻으면 남은 곳이 5장뿐이라 5장에 잘 듣게
  { id: 'demonlord', name: '마왕', desc: '마탄 세 발을 흩뿌린다', unlock: 15, hint: '5-3 보스', color: 0xff3a50, good: [0, 1], weak: [4] },
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
  const ci = Math.min(c, slot.names.length - 1);
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
  return { u: uid(), s: slot.id, r, c: ci, n: set ? `${SETS[set].pre} ${slot.name}` : slot.names[ci], set, st };
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
  for (const [k, v] of Object.entries(heroSkin(sv).st || {})) out[k] += v;
  if (cashW(sv)) out.atk += CASH_W_DMG;
  // 스탯 체력·민첩·지능
  const sp = sv.sp || {};
  out.hp += 0.04 * (sp.vit || 0) + SP_MILE_HP * Math.floor((sp.vit || 0) / SP_MILE); out.regen += 0.02 * (sp.vit || 0);
  out.spd += 0.003 * (sp.dex || 0); out.cd += 0.003 * (sp.int || 0);
  // 도감 보너스(codex.js dexRefresh가 계산해 둔 값)
  out.hp += sv.dexB?.hp || 0; out.atk += sv.dexB?.atk || 0;
  return out;
}

// 인벤토리에 넣는다. 꽉 차면 끼지 않은 가장 약한 것을 분해해 강화석으로 바꾼다
export const INV_MAX = 60;
export function addItems(sv, items) {
  sv.inv ||= []; let stone = 0;
  sv.eq ||= {};
  for (const it of items) {
    if (it.egg) { if (sv.eggs?.[it.egg]) continue; (sv.eggs ||= {})[it.egg] = true; }
    if (sv.inv.some(x => x.u === it.u)) continue;   // 판 안에서 이미 끼운 장비
    sv.inv.push(it);
    if (it.set) ((sv.dex ||= {}).s ||= {})[it.set] = 1;   // 도감: 세트 한 부위라도 얻었다
    // 빈 부위는 바로 낀다(장비 탭을 안 열어도 새 장비가 전투에 들어가게)
    if (!sv.eq[it.s] && !it.bag) sv.eq[it.s] = it.u;   // 판에서 '가방에'를 고른 건 끼지 않는다
    if (sv.inv.length > INV_MAX) {
      const on = new Set(Object.values(sv.eq || {}));
      const worst = sv.inv.filter(x => !on.has(x.u) && !x.egg).sort((a, b) => itemScore(a) - itemScore(b))[0];
      if (worst) { sv.inv.splice(sv.inv.indexOf(worst), 1); stone += RARITY[worst.r].salvage; }
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
