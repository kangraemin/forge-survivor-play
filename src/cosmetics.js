// 외형 소유/착용은 기존 skins·hskins·cw와 독립. 전투 능력치에 접근하지 않는다.
export const COS_TABS = [['character', '캐릭터'], ['costume', '의상'], ['weapon', '무기'], ['head', '머리'], ['pet', '펫'], ['winter', '겨울']];
export const ITEM_KINDS = COS_TABS.map(([k]) => k).filter(k => k !== 'winter');
const items = (kind, rows) => rows.map(([id, name, cost, effect, desc]) => ({ id, kind, name, cost, effect, desc }));
// 겨울 시즌 14종: 그림은 assets/cosmetics2/, 판매 기간·상점 '겨울' 탭은 산타와 같다
const winter = (kind, rows) => items(kind, rows).map(it => ({ ...it, dir: 'cosmetics2', winter: true }));
export const CHARACTERS = items('character', [
  ['girl', '꽃바람 소녀 검사', 900, 'petal', '꽃잎·하트가 살랑살랑'],
  ['warrior', '황금 맹세 여전사', 1200, 'gold', '금빛 반짝임과 잔상'],
  ['penguin', '눈송이 펭귄', 900, 'snow', '뒤뚱뒤뚱 눈송이 산책'],
  ['capybara', '온천 카피바라', 900, 'steam', '포근한 김과 온천 거품'],
  ['platypus', '물방울 오리너구리', 900, 'water', '통통 튀는 물방울'],
  ['cat', '별발 고양이 검사', 900, 'paw', '작은 발자국과 별'],
]);
CHARACTERS.push(...winter('character', [
  ['snowman', '눈사람 대장', 900, 'frost', '눈송이 고리가 빙글빙글 도는 눈사람'],
  ['polar_bear', '북극곰 파수꾼', 1200, 'ice', '오로라빛 얼음 기운이 감싸는 곰'],
  ['fur_adventurer', '털모자 탐험가', 900, 'sparkle', '포근한 털옷과 눈 반짝임'],
  ['party_suit', '파티 정장', 900, 'firework', '축제 불꽃이 톡톡 튀는 정장'],
]));
export const COSTUMES = items('costume', [
  ['knight', '청은 기사 갑옷', 600, 'gold', '은빛 갑주와 푸른 망토'],
  ['pirate', '붉은 돛 해적', 600, 'gold', '삼각모와 펄럭이는 코트'],
  ['mage', '별무리 마법사', 700, 'star', '고깔모자와 긴 마법 로브'],
  ['ninja', '달그림자 닌자', 700, 'leaf', '긴 붉은 목도리와 잎사귀'],
  ['hanbok', '비취빛 한복', 700, 'petal', '고운 저고리와 꽃잎'],
  ['santa', '눈꽃 산타', 600, 'snow', '방울모자와 눈꽃 코트'],
]);
export const WEAPON_LOOKS = items('weapon', [
  ['pinwheel', '빙글 바람개비', 350, 'star', '빙글빙글 별바람'],
  ['leek', '싱싱한 대파', 350, 'leaf', '파릇파릇 잎사귀 베기'],
  ['fish', '펄떡 은빛 생선', 350, 'water', '물방울이 톡톡'],
  ['umbrella', '빗방울 우산', 400, 'water', '비 오는 날의 물결'],
  ['broom', '별청소 빗자루', 400, 'star', '반짝이는 별가루'],
  ['guitar', '록스타 기타', 450, 'note', '음표가 춤추는 베기'],
  ['hammer', '통통 뿅망치', 400, 'heart', '하트가 뿅!'],
  ['candy', '소용돌이 사탕', 400, 'heart', '달콤한 하트 궤적'],
  ['dragon', '홍련 용검', 700, 'ember', '용머리 장식과 불꽃'],
  ['light', '새벽의 빛검', 700, 'gold', '투명한 빛과 금빛 별'],
]);
WEAPON_LOOKS.push(...winter('weapon', [
  ['icicle_sword', '고드름 검', 450, 'shard', '얼음 조각이 흩날리는 베기'],
  ['candy_cane', '지팡이 사탕', 400, 'candy', '솔잎과 붉은 불꽃이 퍼지는 베기'],
  ['ice_fishing_rod', '얼음낚싯대', 350, 'snowball', '눈덩이가 톡톡 떨어지는 베기'],
  ['firework_wand', '불꽃놀이 지팡이', 450, 'firework', '축제 불꽃이 터지는 베기'],
]));
export const HEAD_LOOKS = items('head', [
  ['crown', '작은 왕관', 300, 'gold', '반짝이는 세 갈래 왕관'],
  ['cat_ears', '고양이 귀', 250, 'paw', '쫑긋! 분홍 고양이 귀'],
  ['ribbon', '커다란 리본', 250, 'heart', '머리 위 빨간 리본'],
  ['beret', '화가 베레모', 300, 'star', '작은 깃털의 보라 베레모'],
  ['halo', '천사의 머리띠', 350, 'gold', '둥근 후광과 작은 날개'],
  ['sprout', '새싹 머리띠', 250, 'leaf', '머리 위에 봄이 왔어요'],
]);
HEAD_LOOKS.push(...winter('head', [
  ['fur_hat', '털모자', 300, 'frost', '푹신한 방울 털모자'],
  ['reindeer_antlers', '순록 뿔', 300, 'frost', '머리 위에 순록 뿔'],
  ['earmuffs', '분홍 귀마개', 250, 'frost', '따뜻한 분홍 귀마개'],
]));
export const CASH_PETS = items('pet', [
  ['baby_dragon', '아기 용', 700, 'ember', '줍기 거리 +8% · 작은 불꽃'],
  ['ghost', '꼬마 유령', 600, 'star', '8초마다 가까운 은화 1개 줍기'],
  ['chick', '노란 병아리', 600, 'heart', '줍기 거리 +8% · 하트 종종걸음'],
  ['baby_capy', '아기 카피바라', 700, 'steam', '8초마다 가까운 은화 1개 줍기'],
]);
CASH_PETS.push(...winter('pet', [
  ['penguin_sled', '썰매 펭귄', 700, 'frost', '줍기 거리 +8% · 눈길 썰매 동행'],
  ['snow_rabbit', '눈토끼', 600, 'sparkle', '줍기 거리 +8% · 눈 반짝임'],
  ['mini_snowman', '꼬마 눈사람', 700, 'frost', '8초마다 가까운 은화 1개 줍기'],
]));
export const COSMETICS = [...CHARACTERS, ...COSTUMES, ...WEAPON_LOOKS, ...HEAD_LOOKS, ...CASH_PETS];
export const cosmetic = id => COSMETICS.find(x => x.id === id);
export const BODY_LOOKS = [...CHARACTERS, ...COSTUMES];
export const COS_ROWS = [37, 39, 40, 58, 63]; // 기존 hn_*와 같은 4프레임, 높이52
export const EFFECT_FRAMES = { petal: [0, 1], heart: [1], gold: [2, 7], snow: [3], steam: [4, 10], water: [5], paw: [6, 7], star: [7], leaf: [8], note: [9], ember: [11],
  // 겨울 효과 그림(cos_fx2 12칸: 0눈송이 1얼음조각 2눈뭉치 3소용돌이 4·5반짝 6주황불꽃 7붉은폭죽 8불꽃놀이 9솔잎 10눈덩이 11노란불꽃)
  frost: [0, 4, 5], ice: [2, 3, 1], sparkle: [4, 5], firework: [8, 11, 6], shard: [1, 5, 0], candy: [9, 7], snowball: [10, 2, 0] };
// 유료 캐릭터 고유 주변 이펙트(몸 둘레를 도는 4칸 고리). 능력치와 무관한 그림
export const AURAS = ['snowman', 'polar_bear'];
export const WINTER_EFFECTS = new Set(['frost', 'ice', 'sparkle', 'firework', 'shard', 'candy', 'snowball']);
export const effectTex = e => WINTER_EFFECTS.has(e) ? 'cos_fx2' : 'cos_fx';

export function wardrobe(sv) {
  const c = sv.cosmetics ||= {};
  c.owned ||= {}; c.equip ||= {}; c.tried ||= {};
  return c;
}
export const ownsCosmetic = (sv, id) => !!wardrobe(sv).owned[id];
export function equippedLook(sv) {
  const c = wardrobe(sv);
  return Object.fromEntries(ITEM_KINDS.map(kind => { const id = c.equip[kind]; return [kind, cosmetic(id)?.kind === kind && c.owned[id] ? id : '']; }));
}
export function equipCosmetic(sv, kind, id) {
  const c = wardrobe(sv);
  if (id && (!c.owned[id] || cosmetic(id)?.kind !== kind)) return false;
  c.equip[kind] = id;
  // 의상은 기본 모험가용. 동물/다른 캐릭터에 사람 몸을 겹치지 않는다.
  if (id && kind === 'character') c.equip.costume = '';
  if (id && kind === 'costume') c.equip.character = '';
  return true;
}
// 47차: 오늘의 판매 — 머리·무기 꾸미기를 KST 날짜 번호로 하루 하나씩 돌려 노출(같은 날엔 늘 같은 것). 15% 할인
export const SALE_OFF = 15;
export const dayNo = (now = Date.now()) => Math.floor((now + 9 * 3600000) / 86400000);
export const todaySale = (now = Date.now()) => { const pool = [...HEAD_LOOKS, ...WEAPON_LOOKS].filter(it => available(it, now)); return pool[dayNo(now) % pool.length]; };
// 가격: 정가(보석) 기준. 오늘의 판매이거나 체험을 끝낸 안 산 항목(첫 구매)이면 15% 할인 — 겹치지 않고 하나만 적용, 표기는 정확히
export function salePrice(sv, it, now = Date.now()) {
  const c = wardrobe(sv), why = c.owned[it.id] ? '' : todaySale(now).id === it.id ? 'today' : c.tried[it.id] ? 'trial' : '';
  const off = why ? SALE_OFF : 0;
  return { price: Math.round(it.cost * (100 - off) / 100), off, why };
}
export function buyCosmetic(sv, id, now = Date.now()) {
  const it = cosmetic(id), c = wardrobe(sv);
  if (!it || !available(it, now) || c.owned[id]) return false;
  const price = salePrice(sv, it, now).price;
  if (sv.gem < price) return false;
  sv.gem -= price; c.owned[id] = true; equipCosmetic(sv, it.kind, id); return true;
}
// 고정된 실제 행사 기간. 재접속으로 연장되는 타이머가 아니다. 산 아이템은 기간 뒤에도 착용 가능.
export const WINTER = { from: Date.parse('2026-10-30T00:00:00+09:00'), until: Date.parse('2027-01-01T00:00:00+09:00'), label: '겨울 기념 판매 · 2026.10.30–12.31 KST' };
export const isWinter = it => !!it && (it.winter || it.id === 'santa');
export const available = (it, now = Date.now()) => !isWinter(it) || (now >= WINTER.from && now < WINTER.until);
export const winterItems = () => COSMETICS.filter(isWinter);
export const COS_PACKS = [
  { id: 'look_picnic', name: '꽃바람 소풍 세트', price: 12400, once: true, give: { cosmetics: ['girl', 'candy', 'ribbon'] }, gemCost: 1240 },
  { id: 'look_bath', name: '온천 친구 세트', price: 14800, once: true, give: { cosmetics: ['capybara', 'baby_capy', 'sprout'] }, gemCost: 1480 },
  { id: 'look_snow_trip', name: '설원 탐험 세트', price: 13200, once: true, winter: true, give: { cosmetics: ['fur_adventurer', 'icicle_sword', 'fur_hat'] }, gemCost: 1320 },
  { id: 'look_snow_friends', name: '눈사람 친구 세트', price: 14800, once: true, winter: true, give: { cosmetics: ['snowman', 'mini_snowman', 'earmuffs'] }, gemCost: 1480 },
];
// 46차: 보석 10개 = 100원(보석 120개 = 1,200원) 기준. 묶음의 원화가 = 보석가 x 10, 보석가 = 개별가 합 x 0.8
export const GEM_WON = 10;
export const packBase = pack => pack.give.cosmetics.reduce((n, id) => n + cosmetic(id).cost, 0);
export function buyCosmeticPack(sv, pack) {
  const c = wardrobe(sv);
  if (!COS_PACKS.includes(pack) || (pack.winter && !available({ winter: true })) || pack.give.cosmetics.some(id => c.owned[id]) || sv.gem < pack.gemCost) return false;
  sv.gem -= pack.gemCost;
  pack.give.cosmetics.forEach(id => { c.owned[id] = true; });
  return true;
}
export const todayLook = (now = Date.now()) => COSTUMES[Math.floor((now + 9 * 3600000) / 86400000) % 5];
export function startTrial(sv, id) {
  const c = wardrobe(sv), it = BODY_LOOKS.find(x => x.id === id);   // 46차: 유료 캐릭터 6종도 1판 체험
  if (!it || c.tried[id] || c.owned[id] || !available(it)) return false;
  c.tried[id] = true; c.pendingTrial = id; return true;
}
// 시작 때 사용을 확정해 강제종료/재접속으로 무료 체험이 무한 반복되지 않는다.
export function consumeTrial(sv) {
  const c = wardrobe(sv), look = equippedLook(sv), id = c.pendingTrial;
  delete c.pendingTrial;
  if (!BODY_LOOKS.some(x => x.id === id) || !c.tried[id]) return { look, trial: '' };
  c.finishedTrial = id;
  const isChar = CHARACTERS.some(x => x.id === id);
  return { look: { ...look, character: isChar ? id : '', costume: isChar ? '' : id }, trial: id };
}
