// 장비 판매·일괄 정리(순수 로직: 화면 없이 node에서 시험한다)
// 판매가 = 그 장의 1번 스테이지 클리어 금화 × 등급 계수 × (세트면 1.25). 분해는 강화석(등급 1·2·4·8)
// 금화가 급하면 판매, 강화석이 필요하면 분해. 근거와 수입 비율은 docs/economy.md
import { clearGold } from './data.js';
import { RARITY, setSellFn } from './gear.js';

export const SELL_MUL = [0.04, 0.08, 0.16, 0.32];   // 일반·희귀·영웅·전설
export const SET_BONUS = 1.25;
export const sellPrice = it => {
  if (it.egg || it.r > 3) return 0;
  return Math.max(5, Math.round(clearGold(it.c || 0, 0) * SELL_MUL[it.r] * (it.set ? SET_BONUS : 1) / 5) * 5);
};
setSellFn(sellPrice);

// 정리 대상: 낀 것·잠근 것·숨겨진/이벤트(egg)는 뺀다. rarities는 등급 번호 배열
export function tidyList(sv, rarities) {
  const on = new Set(Object.values(sv.eq || {}));
  return (sv.inv || []).filter(it => rarities.includes(it.r) && it.r <= 2 && !it.egg && !it.lock && !on.has(it.u));
}
// 합계 { n, gold(판매 시), stone(분해 시) }
export function tidyTotals(list) {
  return { n: list.length, gold: list.reduce((a, it) => a + sellPrice(it), 0), stone: list.reduce((a, it) => a + RARITY[it.r].salvage, 0) };
}
// 실제로 처리한다. mode 'sell' | 'salvage'. 처리한 합계를 돌려준다
export function tidyApply(sv, rarities, mode) {
  const list = tidyList(sv, rarities), t = tidyTotals(list), set = new Set(list);
  sv.inv = sv.inv.filter(it => !set.has(it));
  if (mode === 'sell') sv.gold += t.gold; else sv.stone += t.stone;
  return t;
}
// 장비 하나
export function sellOne(sv, it) {
  const on = Object.values(sv.eq || {}).includes(it.u);
  if (it.egg || it.lock || on || !sv.inv.includes(it)) return 0;
  const g = sellPrice(it); sv.inv = sv.inv.filter(v => v !== it); sv.gold += g; return g;
}
export function salvageOne(sv, it) {
  const on = Object.values(sv.eq || {}).includes(it.u);
  if (it.egg || it.lock || on || !sv.inv.includes(it)) return 0;
  const st = RARITY[it.r].salvage; sv.inv = sv.inv.filter(v => v !== it); sv.stone += st; return st;
}
