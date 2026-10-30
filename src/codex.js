// 도감·업적·칭호. 도감 칸을 채우면 영구 보너스(gearStats가 sv.dexB를 읽는다)
import { MOBS, MOB_NAMES, BOSSES, HARD, chapterOpen } from './data.js';
import { MODE_DEFS, MODE_N, MODE_IDS, modeCount } from './modeData.js';
import { WTYPES, PETS, SETS, EGGS, ownsW } from './gear.js';
import { t } from './i18n.js';

export const DEX_KILL = 100;                 // 몬스터 칸은 이만큼 잡아야 찬다
export const DEX_HP = 0.005, DEX_SET_ATK = 0.02;   // 칸 하나 최대 체력 +0.5%, 묶음 하나 다 채우면 모든 피해 +2%

// 16~18장 몹·보스는 그 장이 열린 뒤에만 도감·업적에 센다(잠긴 동안 도감 전부가 막히지 않게)
const shown = o => !o.lateCh || chapterOpen(o.lateCh - 1);
const kills = (sv, k) => sv.dex?.m?.[k] || 0;
// 묶음: 칸마다 이름·찼나·진행 글자
export const DEX_GROUPS = [
  { id: 'mob', name: t('codex.fa2390'), cells: sv => Object.keys(MOBS).filter(k => shown(MOBS[k])).map(k => ({ id: k, name: MOB_NAMES[k], anim: k, on: kills(sv, k) >= DEX_KILL, sub: `${Math.min(DEX_KILL, kills(sv, k))}/${DEX_KILL}` })) },
  { id: 'boss', name: t('battle.792e7e'), cells: sv => Object.keys(BOSSES).filter(k => shown(BOSSES[k])).map(k => ({ id: k, name: BOSSES[k].name, anim: k, on: kills(sv, k) >= 1, sub: kills(sv, k) ? t('codex.e8885d', { kills: kills(sv, k) }) : t('codex.cb74c6') })) },
  { id: 'weapon', name: t('lobby.8c4dac'), cells: sv => WTYPES.map(w => ({ id: w.id, name: w.name, on: ownsW(sv, w.id), sub: ownsW(sv, w.id) ? t('codex.cb4483') : t('codex.d58fa7') })) },
  { id: 'pet', name: t('codex.153119'), cells: sv => PETS.map(p => ({ id: p.id, name: p.name, anim: p.id, on: sv.cleared >= p.unlock, sub: sv.cleared >= p.unlock ? t('codex.01aff8') : p.hint })) },
  { id: 'set', name: t('codex.aaba48'), cells: sv => Object.entries(SETS).map(([k, s]) => ({ id: k, name: s.name, on: !!sv.dex?.s?.[k], sub: sv.dex?.s?.[k] ? t('codex.de937c') : t('codex.d58fa7') })) },
  { id: 'egg', name: t('codex.a34b3f'), cells: sv => Object.entries(EGGS).map(([k, e]) => ({ id: k, name: sv.eggs?.[k] ? e.name : '???', on: !!sv.eggs?.[k], sub: sv.eggs?.[k] ? t('codex.de937c') : e.hint })) },
];

export function dexState(sv) {
  let n = 0, all = 0, full = 0;
  const groups = DEX_GROUPS.map(g => { const cells = g.cells(sv), k = cells.filter(c => c.on).length; n += k; all += cells.length; if (k === cells.length) full++; return { ...g, list: cells, n: k }; });
  return { groups, n, all, full, hp: n * DEX_HP, atk: full * DEX_SET_ATK };
}
// 보너스를 다시 계산해 저장값에 둔다(전투·전투력이 읽는다). 새로 찬 칸 수를 돌려준다
export function dexRefresh(sv) {
  const st = dexState(sv), before = sv.dexB?.n || 0;
  sv.dexB = { n: st.n, hp: st.hp, atk: st.atk };
  return st.n - before;
}
// 처치 기록(전투 중). 세트 획득은 gear.js addItems가 남긴다
export const dexKill = (sv, kind) => { const m = ((sv.dex ||= {}).m ||= {}); m[kind] = (m[kind] || 0) + 1; };

export const dexAllN = () => Object.values(MOBS).filter(shown).length + Object.values(BOSSES).filter(shown).length + WTYPES.length + PETS.length + Object.keys(SETS).length + Object.keys(EGGS).length;

// ── 업적: 값(v)이 need에 닿으면 받기. title이 있으면 칭호도 열린다 ──
const st = (sv, k) => sv.stats?.[k] || 0;
export const ACHIEVES = [
  { id: 'kill1', name: t('codex.6811ae'), desc: t('codex.b7ef2f'), need: 1000, v: sv => st(sv, 'kills'), gem: 20 },
  { id: 'kill2', name: t('codex.50cb47'), desc: t('codex.69079c'), need: 10000, v: sv => st(sv, 'kills'), gem: 50, title: t('codex.50cb47') },
  { id: 'kill3', name: t('codex.6adf79'), desc: t('codex.a445c7'), need: 50000, v: sv => st(sv, 'kills'), gem: 150 },
  { id: 'enh10', name: t('codex.ee197b'), desc: t('codex.2ec61a'), need: 10, v: sv => Math.max(sv.enh, st(sv, 'maxEnh')), gem: 30 },
  { id: 'enh15', name: t('codex.6292c9'), desc: t('codex.555b67'), need: 15, v: sv => Math.max(sv.enh, st(sv, 'maxEnh')), gem: 80, title: t('codex.6292c9') },
  { id: 'enh20', name: t('codex.12dbb6'), desc: t('codex.778486'), need: 20, v: sv => Math.max(sv.enh, st(sv, 'maxEnh')), gem: 150, title: t('codex.12dbb6') },
  { id: 'demon', name: t('codex.97bd8f'), desc: t('codex.42738b'), need: 15, v: sv => sv.cleared, gem: 100, title: t('codex.97bd8f') },
  { id: 'ch8', name: t('codex.0cd2e0'), desc: t('codex.5f1121'), need: 24, v: sv => sv.cleared, gem: 80 },
  { id: 'ch10', name: t('codex.ed6662'), desc: t('codex.366300'), need: 30, v: sv => sv.cleared, gem: 120, title: t('codex.a9df46') },
  { id: 'hard1', name: t('codex.6b05f5'), desc: t('codex.e521b1'), need: 3, v: sv => sv.hardCleared || 0, gem: 50 },
  { id: 'ch15', name: t('codex.ed0430'), desc: t('codex.406623'), need: 45, v: sv => sv.cleared, gem: 200, title: t('codex.57800a') },
  { id: 'ch16', name: t('codex.93326b'), desc: t('codex.b62dc7'), need: 48, v: sv => sv.cleared, gem: 120, late: 16 },
  { id: 'ch17', name: t('codex.05f58b'), desc: t('codex.f50cab'), need: 51, v: sv => sv.cleared, gem: 150, late: 17 },
  { id: 'ch18', name: t('codex.771e08'), desc: t('codex.94b02e'), need: 54, v: sv => sv.cleared, gem: 200, title: t('codex.4c4c1a'), late: 18 },
  { id: 'hard5', name: t('codex.db6427'), desc: t('codex.76c4c6'), need: HARD.unlock, v: sv => sv.hardCleared || 0, gem: 150, title: t('codex.db6427') },
  { id: 'tower10', name: t('lobby.6369c3'), desc: t('codex.92754e'), need: 10, v: sv => sv.endBest || 0, gem: 30 },
  { id: 'tower25', name: t('codex.6f4889'), desc: t('codex.4f8102'), need: 25, v: sv => sv.endBest || 0, gem: 100, title: t('codex.6f4889') },
  // 모드 15판 완주 기념(다른 곳에서 얻을 수 없는 칭호)
  ...MODE_IDS.map(id => ({ id: 'mode_' + id, name: MODE_DEFS[id].title, desc: MODE_DEFS[id].ach, need: MODE_N, v: sv => modeCount(sv, id), gem: 100, title: MODE_DEFS[id].title })),
  { id: 'day7', name: t('codex.69f489'), desc: t('codex.d9852d'), need: 7, v: sv => sv.streak || 0, gem: 30 },
  { id: 'day30', name: t('codex.af7b6d'), desc: t('codex.0928c5'), need: 30, v: sv => sv.streak || 0, gem: 100, title: t('codex.af7b6d') },
  { id: 'dun10', name: t('codex.073fe8'), desc: t('codex.c22128'), need: 10, v: sv => st(sv, 'dun'), gem: 40 },
  { id: 'gob10', name: t('codex.f0a5a4'), desc: t('codex.02061f'), need: 10, v: sv => st(sv, 'gob'), gem: 40 },
  { id: 'dex25', name: t('codex.433b87'), desc: t('codex.f9cfb9'), need: 25, v: sv => dexState(sv).n, gem: 50 },
  { id: 'dexAll', name: t('codex.c12360'), desc: t('codex.b573b6'), get need() { return dexAllN(); }, v: sv => dexState(sv).n, gem: 150, title: t('codex.c12360') },
];
export const achList = () => ACHIEVES.filter(a => !a.late || chapterOpen(a.late - 1));
export const achReady = sv => achList().filter(a => !sv.ach?.[a.id] && a.v(sv) >= a.need).length;
// 칭호는 업적 id로 저장한다(언어를 바꿔도 같은 칭호). 화면에는 titleName으로 현재 언어 이름을 보인다
export const titles = sv => ACHIEVES.filter(a => a.title && sv.ach?.[a.id]).map(a => a.id);
export const titleName = id => ACHIEVES.find(a => a.id === id)?.title || '';
