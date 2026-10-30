// 53차: '다음 목표' 한 줄. 로비 첫 화면·대장간(승급이 증표에 막혔을 때)·클리어 결과 화면이 같은 말을 쓴다
// 반환: { kind: 'mark' | 'power' | 'go', title, sub, to: 'challenge' | 'forge' | 'battle' } 또는 null(다 깼으면)
import * as D from './data.js';
import { MODE_IDS, MODE_DEFS, MODE_N, modeOpen, modeStage, markGain } from './modeData.js';
import { t } from './i18n.js';

// 판매 노출은 첫 승급(또는 1장 클리어) 뒤부터: 아직 강화도 안 해 본 사람 앞에 꾸러미·특가를 깔지 않는다
export const salesOpen = sv => (sv.tier | 0) >= 1 || (sv.cleared | 0) >= D.STAGES_PER_CHAPTER;

// 증표가 모자라 승급이 막힌 상태인가(그 장 보스는 이미 깼는데 증표만 모자란다)
export function markBlocked(sv) {
  if ((sv.tier | 0) >= D.TIERS.length - 1) return false;
  const nt = sv.tier + 1;
  return sv.cleared >= D.TIER_AT[nt] && D.markNeed(nt) > (sv.mark | 0);
}

// 증표를 얻을 수 있는 가장 앞 도전 한 판
export function markTarget(sv) {
  for (let n = 0; n < MODE_N; n++) for (const id of MODE_IDS) if (modeOpen(sv, n) && modeStage(id, n) && markGain(sv, id, n) > 0) return { id, n, name: MODE_DEFS[id].name };
  return null;
}

// 힘이 모자랄 때 지금 할 행동 하나: 금화 부족이면 소탕·전투로 벌기, 강화석 부족이면 전투, 다 있으면 강화
export function powerAct(sv) {
  const enh = sv.enh | 0;
  if (enh >= D.ENH_MAX) return { act: 'enh' };
  const gold = D.enhGold(sv.tier, enh), stone = D.enhStone(sv.tier, enh);
  if ((sv.gold | 0) < gold) return { act: (sv.sweep | 0) > 0 && (sv.cleared | 0) >= 1 ? 'sweep' : 'play', res: 'gold', have: sv.gold | 0, need: gold };
  if ((sv.stone | 0) < stone) return { act: 'play', res: 'stone', have: sv.stone | 0, need: stone };
  return { act: 'enh' };
}

export function nextGoal(sv, atk) {
  if (markBlocked(sv)) {
    const need = D.markNeed(sv.tier + 1), have = sv.mark | 0, tg = markTarget(sv);
    return { kind: 'mark', to: 'challenge', title: t('nextGoal.34bfe9', { have, need }), sub: tg ? t('nextGoal.8a10a9', { name: tg.name, v: tg.n + 1 }) : t('nextGoal.63e2ee') };
  }
  if ((sv.cleared | 0) >= D.openTotal()) return null;
  const idx = sv.cleared | 0, c = Math.floor(idx / D.STAGES_PER_CHAPTER), s = idx % D.STAGES_PER_CHAPTER, rec = D.recOf(c, s, false), a = atk ?? D.powerOf(sv), stage = `${c + 1}-${s + 1}`;
  if (a < rec) {
    const pa = powerAct(sv);
    if (pa.act === 'enh') return { kind: 'power', act: 'enh', to: 'forge', stage, title: t('nextGoal.enh'), sub: t('nextGoal.enhSub', { stage }) };
    const sub = pa.res === 'gold' ? t('nextGoal.haveGold', { have: pa.have, need: pa.need }) : t('nextGoal.haveStone', { have: pa.have, need: pa.need });
    const title = pa.res === 'stone' ? t('nextGoal.earnStone') : pa.act === 'sweep' ? t('nextGoal.earnGoldSweep') : t('nextGoal.earnGoldPlay');
    return { kind: 'power', act: pa.act, to: 'battle', stage, title, sub };
  }
  return { kind: 'go', to: 'battle', stage, title: t('nextGoal.f32dd2', { stage }), sub: t('nextGoal.baf639') };
}
