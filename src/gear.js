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
  flame: { name: '대장장이의 불꽃', pre: '불꽃 대장장이의', css: '#ff8a4a', two: { atk: 0.1 }, twoTxt: '모든 피해 +10%', fourTxt: '베인 적이 25% 확률로 폭발한다', minC: 0 },
  frost: { name: '서리 수호자', pre: '서리 수호자의', css: '#9ae8ff', two: { def: 0.06 }, twoTxt: '받는 피해 -6%', fourTxt: '맞으면 주변 적을 2초 얼린다(6초마다)', minC: 1 },
  wind: { name: '바람 사냥꾼', pre: '바람 사냥꾼의', css: '#a8ffb0', two: { spd: 0.12 }, twoTxt: '이동 속도 +12%', fourTxt: '모든 스킬 재사용 대기 -18%', minC: 2 },
};

// 숨겨진 템: 한 번만 얻는다. 얻는 조건은 hint로 흐릿하게만 알려 준다
export const EGGS = {
  duck: { slot: 'ring', name: '고무 오리', st: { def: 0.12, luck: 0.06 }, desc: '맞으면 꽥! 하고 운다', hint: '아주 드물게, 아무 데서나' },
  granny: { slot: 'helm', name: '할머니 뜨개 모자', st: { hp: 0.2, regen: 0.8 }, desc: '쓰러져도 따뜻하다', hint: '열 번 쓰러지면' },
  apron: { slot: 'armor', name: '대장장이 앞치마', st: { def: 0.08, hp: 0.12 }, desc: '끼고 있으면 강화 성공 확률 +5%p', hint: '칼을 세 번 부수면' },
  cat: { slot: 'boots', name: '고양이 발 장화', st: { spd: 0.2, mag: 0.4 }, desc: '발소리가 나지 않는다', hint: '도망치는 고블린이 가끔' },
  rock: { slot: 'collar', name: '이상한 돌멩이', st: { pet: 1.0 }, desc: '펫이 이걸 아주 좋아한다', hint: '대장간에서 칼을 자꾸 건드리면' },
};

// ── 무기 종류: 기본 공격 모양과 레벨업에 잘 나오는 스킬이 달라진다 ──
export const WTYPES = [
  { id: 'sword', name: '검', desc: '앞쪽을 넓게 벤다 · 힘', tag: 'melee', unlock: 0, fav: ['spin', 'orb', 'wave', 'might'], own: 'wave' },
  { id: 'spear', name: '창', desc: '좁고 길게 꿰뚫는다 · 민첩', tag: 'ranged', unlock: 6, hint: '1-6 보스를 잡으면', fav: ['dagger', 'ice', 'javelin', 'haste'], own: 'javelin' },
  { id: 'axe', name: '도끼', desc: '느리지만 사방을 크게 찍는다 · 힘', tag: 'melee', unlock: 12, hint: '2-6 보스를 잡으면', fav: ['fireball', 'holy', 'quake', 'vigor'], own: 'quake' },
];
export const wtypeOf = sv => WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];
// 무기 전용 스킬: 그 무기를 든 판에서만 나온다
export const OWN_SKILLS = WTYPES.map(w => w.own);
// 진행할수록 레벨업 카드에 새 스킬이 섞여 나온다(깬 스테이지 수)
export const SKILL_UNLOCK = { holy: 1, bolt: 3, fireball: 6, ice: 9 };

// ── 스탯: 스테이지를 처음 깰 때 1점, 보스는 2점 더(끝까지 40점) ──
export const SP = [
  { id: 'str', name: '힘', desc: '근접 스킬 피해 +1%', tag: 'melee', css: '#ff9a7a' },
  { id: 'dex', name: '민첩', desc: '원거리 스킬 피해 +1% · 이동 +0.3%', tag: 'ranged', css: '#a8ffb0' },
  { id: 'int', name: '지능', desc: '마법 스킬 피해 +1% · 재사용 -0.3%', tag: 'magic', css: '#9ad8ff' },
  { id: 'vit', name: '체력', desc: '최대 체력 +1.5% · 회복 +0.02/초', css: '#ffd75e' },
];
export const SP_DMG = 0.01;
export const SKILL_TAG = { sword: 'melee', spin: 'melee', quake: 'melee', dagger: 'ranged', ice: 'ranged', javelin: 'ranged', wave: 'ranged', bolt: 'magic', fireball: 'magic', holy: 'magic', orb: 'magic' };
export const TAG_NAME = { melee: '근접', ranged: '원거리', magic: '마법' };
const TAG_SP = { melee: 'str', ranged: 'dex', magic: 'int' };
export const spTotal = cleared => cleared + Math.floor(cleared / 6) * 2;
export const spUsed = sv => SP.reduce((a, s) => a + (sv.sp?.[s.id] || 0), 0);
export const spFree = sv => spTotal(sv.cleared) - spUsed(sv);
// 그 태그 스킬의 피해 배율
// 5점마다 한 번 더 붙는 보너스(찍는 맛)
export const SP_MILE = 5, SP_MILE_DMG = 0.03, SP_MILE_HP = 0.05;
const spDmg = n => SP_DMG * n + SP_MILE_DMG * Math.floor(n / SP_MILE);
export const tagMul = (sv, tag) => 1 + spDmg(sv.sp?.[TAG_SP[tag]] || 0);
export const SP_RESET_GEM = 50;

// ── 펫: 깬 스테이지 수로 열린다. 금화로 키우고 목걸이를 끼워 준다 ──
export const PETS = [
  { id: 'fire', name: '불씨 정령', desc: '가까운 적에게 불꽃을 쏜다', unlock: 3, hint: '1-3을 깨면', color: 0xff8a3a },
  { id: 'slime', name: '수호 슬라임', desc: '7초마다 체력을 채우고 주변을 밀친다', unlock: 9, hint: '2-3을 깨면', color: 0x6fe08a },
  { id: 'bat', name: '황금 박쥐', desc: '주변 적을 물고 은화를 더 줍게 한다', unlock: 15, hint: '3-3을 깨면', color: 0xffd75e },
];
export const PET_MAX = 20;
export const petCost = lv => Math.round(90 * Math.pow(1.27, lv) / 5) * 5;
// 펫 한 번 공격의 무기 공격력 대비 배율
export const petPow = lv => 0.4 + 0.06 * lv;

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
  // 영웅 이상은 35% 확률로 세트(그 챕터에서 나오는 세트만)
  const sets = Object.entries(SETS).filter(([, s]) => s.minC <= c).map(([k]) => k);
  const set = opt.set || (r >= 2 && !slot.pet && Math.random() < 0.35 ? pick(sets) : null);
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
  // 스탯 체력·민첩·지능
  const sp = sv.sp || {};
  out.hp += 0.015 * (sp.vit || 0) + SP_MILE_HP * Math.floor((sp.vit || 0) / SP_MILE); out.regen += 0.02 * (sp.vit || 0);
  out.spd += 0.003 * (sp.dex || 0); out.cd += 0.003 * (sp.int || 0);
  return out;
}

// 인벤토리에 넣는다. 꽉 차면 끼지 않은 가장 약한 것을 분해해 강화석으로 바꾼다
export const INV_MAX = 60;
export function addItems(sv, items) {
  sv.inv ||= []; let stone = 0;
  sv.eq ||= {};
  for (const it of items) {
    if (it.egg) { if (sv.eggs?.[it.egg]) continue; (sv.eggs ||= {})[it.egg] = true; }
    sv.inv.push(it);
    // 빈 부위는 바로 낀다(장비 탭을 안 열어도 새 장비가 전투에 들어가게)
    if (!sv.eq[it.s]) sv.eq[it.s] = it.u;
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
  return makeItem(c, opt);
}
