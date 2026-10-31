// 테스트 모드 진행도 프리셋·값 직접 넣기. 테스트 저장(load()가 돌려주는 객체)만 바꾼다
import * as D from './data.js';
import { fresh } from './saveCore.js';
import { WTYPES, PETS, PET_MAX, SLOTS, EGGS, HERO_SKINS, CASH_W, makeItem, addItems, grantEgg, spTotal, SP } from './gear.js';
import { COSMETICS } from './cosmetics.js';
import { dexRefresh } from './codex.js';

export const PRESETS = [
  { id: 'new', cleared: 0 },
  { id: 'c1', cleared: 3 },
  { id: 'c5', cleared: 15 },
  { id: 'c10', cleared: 30 },
  { id: 'c15', cleared: 45 },
  { id: 'all', cleared: 0 },   // 아래에서 열린 장 전부로 정한다
];
const KEEP = ['lang', 'sound', 'musicOff', 'musicLvl', 'vibOff', 'fxLite', 'bagAuto', 'seenAt'];

// 모든 것 해금: 무기·펫·꾸미기·칼빛·영웅 스킨·캐시 무기·비급·숨겨진 템
export function unlockAll(sv) {
  sv.wOwn = Object.fromEntries(WTYPES.map(w => [w.id, true]));
  sv.pets ||= {}; for (const p of PETS) sv.pets[p.id] = Math.max(sv.pets[p.id] || 0, PET_MAX);
  if (!sv.pet) sv.pet = PETS[0].id;
  const w = (sv.cosmetics ||= { owned: {}, equip: {}, tried: {} }); w.owned ||= {};
  for (const c of COSMETICS) w.owned[c.id] = true;
  sv.skins ||= {}; for (const s of D.SKINS) if (s.id) sv.skins[s.id] = true;
  sv.hskins ||= {}; for (const s of HERO_SKINS) if (s.id) sv.hskins[s.id] = true;
  sv.cw ||= {}; for (const k of Object.keys(CASH_W)) sv.cw[k] = true;
  sv.books ||= {}; for (const k of D.BOOKS) sv.books[k] = Math.max(sv.books[k] || 0, 3);
  for (const id of Object.keys(EGGS)) grantEgg(sv, id, true);
}

// 장비: 슬롯마다 장착 1 + 가방 1. 등급은 진행도에 맞춘다
function giveGear(sv, k, lastRarity) {
  const items = [];
  for (const s of SLOTS) {
    for (let i = 0; i < 2; i++) items.push(makeItem(k, { slot: s.id, rarity: i ? Math.max(0, lastRarity - 1) : lastRarity }));
  }
  sv.inv = []; sv.eq = {};
  addItems(sv, items);
  for (const s of SLOTS) { const it = items.find(x => x.s === s.id); if (it) sv.eq[s.id] = it.u; }
}

export function applyPreset(sv, id) {
  const pr = PRESETS.find(p => p.id === id);
  if (!pr) return false;
  const N = id === 'all' ? D.openN() * D.STAGES_PER_CHAPTER : pr.cleared;
  const keep = {}; for (const k of KEEP) if (sv[k] !== undefined) keep[k] = sv[k];
  for (const k of Object.keys(sv)) delete sv[k];
  Object.assign(sv, fresh(), keep);
  const d = new Date(); sv.day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (N === 0) { sv.prologue = 0; return true; }   // 새 유저: 첫 실행 상태
  const k = Math.min(D.CHAPTERS.length - 1, Math.floor((N - 1) / D.STAGES_PER_CHAPTER));
  sv.prologue = 1; sv.cleared = N;
  sv.stats = { runs: Math.max(5, N), kills: N * 300, destroyed: 0, playMs: N * 240000, losses: 0 };
  sv.tut = { forge: true, forgeShown: true, ult: true, coach: { main: 2, mode: 1, tab_gear: 1, tab_pet: 1, tab_shop: 1 } };
  sv.gold = 50000 + N * 20000; sv.stone = 500 + N * 300; sv.gem = 3000; sv.guard = 10; sv.charm = 5 + N; sv.sweep = D.SWEEP_MAX;
  if (N >= D.STAGES_PER_CHAPTER) sv.mark = 10;
  sv.hardCleared = id === 'c15' ? N : id === 'all' ? N : 0;
  sv.endBest = Math.min(30, Math.floor(N / 2));
  // 무기
  sv.wOwn = { sword: true }; WTYPES.slice(1, 1 +Math.min(WTYPES.length - 1, Math.floor(N / 4))).forEach(w => { sv.wOwn[w.id] = true; });
  // 펫
  sv.pets = {}; const open = PETS.filter(p => N >= p.unlock);
  for (const p of open) sv.pets[p.id] = Math.min(PET_MAX, 3 + Math.floor(N / 3));
  sv.pet = open.length ? open[open.length - 1].id : '';
  // 훈련·스탯
  sv.train = {}; for (const t of D.TRAINING) sv.train[t.id] = Math.min(t.max, Math.round(t.max * Math.min(1, N / 45)));
  const tot = spTotal(N), main = 'str';
  sv.sp = { str: 0, dex: 0, int: 0, vit: 0 }; sv.sp[main] = Math.ceil(tot * 0.6); sv.sp.vit = tot - sv.sp[main];
  void SP;
  // 장비
  giveGear(sv, k, N < 6 ? 1 : N < 18 ? 2 : 3);
  // 칼: 등급은 깬 판 수로, 강화는 다음 판 권장 전투력을 넘을 때까지
  sv.tier = 0; D.TIER_AT.forEach((at, t) => { if (N >= at && t < D.TIERS.length) sv.tier = t; });
  const nextIdx = Math.min(N, D.openTotal() - 1), rec = D.recOf(Math.floor(nextIdx / D.STAGES_PER_CHAPTER), nextIdx % D.STAGES_PER_CHAPTER, false);
  sv.enh = 0; while (sv.enh < D.ENH_MAX && D.powerOf(sv) < rec * 1.1) sv.enh++;
  if (id === 'all') unlockAll(sv);
  dexRefresh(sv);
  return true;
}

export function addCurrency(sv, key, n) {
  if (key === 'sweep') sv.sweep = Math.min(D.SWEEP_MAX * 100, (sv.sweep || 0) + n);
  else sv[key] = (sv[key] || 0) + n;
}
export function setSword(sv, { enh, tier }) {
  if (tier !== undefined) sv.tier = Math.max(0, Math.min(D.TIERS.length - 1, tier | 0));
  if (enh !== undefined) sv.enh = Math.max(0, Math.min(D.ENH_MAX, enh | 0));
}
