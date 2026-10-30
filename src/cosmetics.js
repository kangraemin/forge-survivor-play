import { t } from './i18n.js';
// 외형 소유/착용은 기존 skins·hskins·cw와 독립. 전투 능력치에 접근하지 않는다.
export const COS_TABS = [['character', t('cosmetics.fd4bbe')], ['costume', t('cosmetics.51ab62')], ['weapon', t('lobby.8c4dac')], ['head', t('cosmetics.75b9f2')], ['pet', t('codex.153119')], ['winter', t('cosmetics.cc89f1')]];
export const ITEM_KINDS = COS_TABS.map(([k]) => k).filter(k => k !== 'winter');
const items = (kind, rows) => rows.map(([id, name, cost, effect, desc]) => ({ id, kind, name, cost, effect, desc }));
// 겨울 시즌 14종: 그림은 assets/cosmetics2/, 판매 기간·상점 '겨울' 탭은 산타와 같다
const winter = (kind, rows) => items(kind, rows).map(it => ({ ...it, dir: 'cosmetics2', winter: true }));
export const CHARACTERS = items('character', [
  ['girl', t('cosmetics.594d47'), 900, 'petal', t('cosmetics.dffff7')],
  ['warrior', t('cosmetics.376a26'), 1200, 'gold', t('cosmetics.7c4cc6')],
  ['penguin', t('cosmetics.3dbe4f'), 900, 'snow', t('cosmetics.65143a')],
  ['capybara', t('cosmetics.75a893'), 900, 'steam', t('cosmetics.dbf54d')],
  ['platypus', t('cosmetics.1a3910'), 900, 'water', t('cosmetics.aca9b8')],
  ['cat', t('cosmetics.244d62'), 900, 'paw', t('cosmetics.f6839e')],
]);
CHARACTERS.push(...winter('character', [
  ['snowman', t('cosmetics.474d35'), 900, 'frost', t('cosmetics.fd7497')],
  ['polar_bear', t('cosmetics.836dad'), 1200, 'ice', t('cosmetics.f6114b')],
  ['fur_adventurer', t('cosmetics.1c4704'), 900, 'sparkle', t('cosmetics.6328ac')],
  ['party_suit', t('cosmetics.825fc9'), 900, 'firework', t('cosmetics.701cac')],
]));
export const COSTUMES = items('costume', [
  ['knight', t('cosmetics.fb5b1a'), 600, 'gold', t('cosmetics.8deec4')],
  ['pirate', t('cosmetics.14081c'), 600, 'gold', t('cosmetics.f13e01')],
  ['mage', t('cosmetics.5cfa18'), 700, 'star', t('cosmetics.83ea2e')],
  ['ninja', t('cosmetics.29d45c'), 700, 'leaf', t('cosmetics.cc7a53')],
  ['hanbok', t('cosmetics.9ec6a4'), 700, 'petal', t('cosmetics.5baf24')],
  ['santa', t('cosmetics.19c252'), 600, 'snow', t('cosmetics.0d067b')],
]);
export const WEAPON_LOOKS = items('weapon', [
  ['pinwheel', t('cosmetics.812bce'), 350, 'star', t('cosmetics.473651')],
  ['leek', t('cosmetics.911dd1'), 350, 'leaf', t('cosmetics.6ab385')],
  ['fish', t('cosmetics.f104b8'), 350, 'water', t('cosmetics.ed7fca')],
  ['umbrella', t('cosmetics.8925a2'), 400, 'water', t('cosmetics.8795a8')],
  ['broom', t('cosmetics.7dc44a'), 400, 'star', t('cosmetics.4905c1')],
  ['guitar', t('cosmetics.c2292f'), 450, 'note', t('cosmetics.fff089')],
  ['hammer', t('cosmetics.2e20f0'), 400, 'heart', t('cosmetics.2727cf')],
  ['candy', t('cosmetics.b67501'), 400, 'heart', t('cosmetics.3074aa')],
  ['dragon', t('cosmetics.5ac500'), 700, 'ember', t('cosmetics.ae2bf7')],
  ['light', t('cosmetics.735ceb'), 700, 'gold', t('cosmetics.dcc656')],
]);
WEAPON_LOOKS.push(...winter('weapon', [
  ['icicle_sword', t('cosmetics.3fedd1'), 450, 'shard', t('cosmetics.065321')],
  ['candy_cane', t('cosmetics.f7bf69'), 400, 'candy', t('cosmetics.cb53f2')],
  ['ice_fishing_rod', t('cosmetics.4bf8d5'), 350, 'snowball', t('cosmetics.d1e2ca')],
  ['firework_wand', t('cosmetics.5738e0'), 450, 'firework', t('cosmetics.c35614')],
]));
export const HEAD_LOOKS = items('head', [
  ['crown', t('cosmetics.17d1e1'), 300, 'gold', t('cosmetics.1b3e79')],
  ['cat_ears', t('cosmetics.836fa8'), 250, 'paw', t('cosmetics.2f0741')],
  ['ribbon', t('cosmetics.244f0c'), 250, 'heart', t('cosmetics.79276c')],
  ['beret', t('cosmetics.28bd6a'), 300, 'star', t('cosmetics.a2d3fa')],
  ['halo', t('cosmetics.08c685'), 350, 'gold', t('cosmetics.6479c1')],
  ['sprout', t('cosmetics.dac4e2'), 250, 'leaf', t('cosmetics.8417df')],
]);
HEAD_LOOKS.push(...winter('head', [
  ['fur_hat', t('cosmetics.b1c9f4'), 300, 'frost', t('cosmetics.f12b38')],
  ['reindeer_antlers', t('cosmetics.4aae48'), 300, 'frost', t('cosmetics.ee7ca9')],
  ['earmuffs', t('cosmetics.c43725'), 250, 'frost', t('cosmetics.d20e87')],
]));
export const CASH_PETS = items('pet', [
  ['baby_dragon', t('cosmetics.a6a35b'), 700, 'ember', t('cosmetics.d44c63')],
  ['ghost', t('cosmetics.fab17c'), 600, 'star', t('cosmetics.c8fd27')],
  ['chick', t('cosmetics.139b6b'), 600, 'heart', t('cosmetics.edf91c')],
  ['baby_capy', t('cosmetics.47cdb2'), 700, 'steam', t('cosmetics.c8fd27')],
]);
CASH_PETS.push(...winter('pet', [
  ['penguin_sled', t('cosmetics.8ce51f'), 700, 'frost', t('cosmetics.2ca56f')],
  ['snow_rabbit', t('cosmetics.f77f7a'), 600, 'sparkle', t('cosmetics.80af1c')],
  ['mini_snowman', t('cosmetics.3434a5'), 700, 'frost', t('cosmetics.c8fd27')],
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
export const WINTER = { from: Date.parse('2026-10-30T00:00:00+09:00'), until: Date.parse('2027-01-01T00:00:00+09:00'), label: t('cosmetics.e10278') };
export const isWinter = it => !!it && (it.winter || it.id === 'santa');
export const available = (it, now = Date.now()) => !isWinter(it) || (now >= WINTER.from && now < WINTER.until);
export const winterItems = () => COSMETICS.filter(isWinter);
export const COS_PACKS = [
  { id: 'look_picnic', name: t('cosmetics.87f868'), price: 12400, once: true, give: { cosmetics: ['girl', 'candy', 'ribbon'] }, gemCost: 1240 },
  { id: 'look_bath', name: t('cosmetics.41839d'), price: 14800, once: true, give: { cosmetics: ['capybara', 'baby_capy', 'sprout'] }, gemCost: 1480 },
  { id: 'look_snow_trip', name: t('cosmetics.474626'), price: 13200, once: true, winter: true, give: { cosmetics: ['fur_adventurer', 'icicle_sword', 'fur_hat'] }, gemCost: 1320 },
  { id: 'look_snow_friends', name: t('cosmetics.d8cb19'), price: 14800, once: true, winter: true, give: { cosmetics: ['snowman', 'mini_snowman', 'earmuffs'] }, gemCost: 1480 },
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
