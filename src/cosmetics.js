// 외형 소유/착용은 기존 skins·hskins·cw와 독립. 전투 능력치에 접근하지 않는다.
export const COS_TABS = [['character', '캐릭터'], ['costume', '의상'], ['weapon', '무기'], ['head', '머리'], ['pet', '펫']];
const items = (kind, rows) => rows.map(([id, name, cost, effect, desc]) => ({ id, kind, name, cost, effect, desc }));
export const CHARACTERS = items('character', [
  ['girl', '꽃바람 소녀 검사', 900, 'petal', '꽃잎·하트가 살랑살랑'],
  ['warrior', '황금 맹세 여전사', 1200, 'gold', '금빛 반짝임과 잔상'],
  ['penguin', '눈송이 펭귄', 900, 'snow', '뒤뚱뒤뚱 눈송이 산책'],
  ['capybara', '온천 카피바라', 900, 'steam', '포근한 김과 온천 거품'],
  ['platypus', '물방울 오리너구리', 900, 'water', '통통 튀는 물방울'],
  ['cat', '별발 고양이 검사', 900, 'paw', '작은 발자국과 별'],
]);
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
export const HEAD_LOOKS = items('head', [
  ['crown', '작은 왕관', 300, 'gold', '반짝이는 세 갈래 왕관'],
  ['cat_ears', '고양이 귀', 250, 'paw', '쫑긋! 분홍 고양이 귀'],
  ['ribbon', '커다란 리본', 250, 'heart', '머리 위 빨간 리본'],
  ['beret', '화가 베레모', 300, 'star', '작은 깃털의 보라 베레모'],
  ['halo', '천사의 머리띠', 350, 'gold', '둥근 후광과 작은 날개'],
  ['sprout', '새싹 머리띠', 250, 'leaf', '머리 위에 봄이 왔어요'],
]);
export const CASH_PETS = items('pet', [
  ['baby_dragon', '아기 용', 700, 'ember', '줍기 거리 +8% · 작은 불꽃'],
  ['ghost', '꼬마 유령', 600, 'star', '8초마다 가까운 은화 1개 줍기'],
  ['chick', '노란 병아리', 600, 'heart', '줍기 거리 +8% · 하트 종종걸음'],
  ['baby_capy', '아기 카피바라', 700, 'steam', '8초마다 가까운 은화 1개 줍기'],
]);
export const COSMETICS = [...CHARACTERS, ...COSTUMES, ...WEAPON_LOOKS, ...HEAD_LOOKS, ...CASH_PETS];
export const cosmetic = id => COSMETICS.find(x => x.id === id);
export const BODY_LOOKS = [...CHARACTERS, ...COSTUMES];
export const COS_ROWS = [37, 39, 40, 58, 63]; // 기존 hn_*와 같은 4프레임, 높이52
export const EFFECT_FRAMES = { petal: [0, 1], heart: [1], gold: [2, 7], snow: [3], steam: [4, 10], water: [5], paw: [6, 7], star: [7], leaf: [8], note: [9], ember: [11] };

export function wardrobe(sv) {
  const c = sv.cosmetics ||= {};
  c.owned ||= {}; c.equip ||= {}; c.tried ||= {};
  return c;
}
export const ownsCosmetic = (sv, id) => !!wardrobe(sv).owned[id];
export function equippedLook(sv) {
  const c = wardrobe(sv);
  return Object.fromEntries(COS_TABS.map(([kind]) => { const id = c.equip[kind]; return [kind, cosmetic(id)?.kind === kind && c.owned[id] ? id : '']; }));
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
export function buyCosmetic(sv, id, now = Date.now()) {
  const it = cosmetic(id), c = wardrobe(sv);
  if (!it || !available(it, now) || c.owned[id] || sv.gem < it.cost) return false;
  sv.gem -= it.cost; c.owned[id] = true; equipCosmetic(sv, it.kind, id); return true;
}
// 고정된 실제 행사 기간. 재접속으로 연장되는 타이머가 아니다. 산 아이템은 기간 뒤에도 착용 가능.
export const WINTER = { from: Date.parse('2026-10-30T00:00:00+09:00'), until: Date.parse('2027-01-01T00:00:00+09:00'), label: '겨울 기념 판매 · 2026.10.30–12.31 KST' };
export const available = (it, now = Date.now()) => it?.id !== 'santa' || (now >= WINTER.from && now < WINTER.until);
export const COS_PACKS = [
  { id: 'look_picnic', name: '꽃바람 소풍 세트', price: 3900, once: true, give: { cosmetics: ['girl', 'candy', 'ribbon'] }, gemCost: 1240 },
  { id: 'look_bath', name: '온천 친구 세트', price: 4900, once: true, give: { cosmetics: ['capybara', 'baby_capy', 'sprout'] }, gemCost: 1480 },
];
export const packBase = pack => pack.give.cosmetics.reduce((n, id) => n + cosmetic(id).cost, 0);
export function buyCosmeticPack(sv, pack) {
  const c = wardrobe(sv);
  if (!COS_PACKS.includes(pack) || pack.give.cosmetics.some(id => c.owned[id]) || sv.gem < pack.gemCost) return false;
  sv.gem -= pack.gemCost;
  pack.give.cosmetics.forEach(id => { c.owned[id] = true; });
  return true;
}
export const todayLook = (now = Date.now()) => COSTUMES[Math.floor((now + 9 * 3600000) / 86400000) % 5];
export function startTrial(sv, id) {
  const c = wardrobe(sv), it = COSTUMES.find(x => x.id === id);
  if (!it || c.tried[id] || c.owned[id] || !available(it)) return false;
  c.tried[id] = true; c.pendingTrial = id; return true;
}
// 시작 때 사용을 확정해 강제종료/재접속으로 무료 체험이 무한 반복되지 않는다.
export function consumeTrial(sv) {
  const c = wardrobe(sv), look = equippedLook(sv), id = c.pendingTrial;
  delete c.pendingTrial;
  if (!COSTUMES.some(x => x.id === id) || !c.tried[id]) return { look, trial: '' };
  c.finishedTrial = id;
  return { look: { ...look, character: '', costume: id }, trial: id };
}
