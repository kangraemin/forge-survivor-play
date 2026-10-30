// 도감·업적·칭호. 도감 칸을 채우면 영구 보너스(gearStats가 sv.dexB를 읽는다)
import { MOBS, MOB_NAMES, BOSSES, HARD } from './data.js';
import { WTYPES, PETS, SETS, EGGS, ownsW } from './gear.js';

export const DEX_KILL = 100;                 // 몬스터 칸은 이만큼 잡아야 찬다
export const DEX_HP = 0.005, DEX_SET_ATK = 0.02;   // 칸 하나 최대 체력 +0.5%, 묶음 하나 다 채우면 모든 피해 +2%

const kills = (sv, k) => sv.dex?.m?.[k] || 0;
// 묶음: 칸마다 이름·찼나·진행 글자
export const DEX_GROUPS = [
  { id: 'mob', name: '몬스터', cells: sv => Object.keys(MOBS).map(k => ({ id: k, name: MOB_NAMES[k], anim: k, on: kills(sv, k) >= DEX_KILL, sub: `${Math.min(DEX_KILL, kills(sv, k))}/${DEX_KILL}` })) },
  { id: 'boss', name: '보스', cells: sv => Object.keys(BOSSES).map(k => ({ id: k, name: BOSSES[k].name, anim: k, on: kills(sv, k) >= 1, sub: kills(sv, k) ? `${kills(sv, k)}번` : '못 잡음' })) },
  { id: 'weapon', name: '무기', cells: sv => WTYPES.map(w => ({ id: w.id, name: w.name, on: ownsW(sv, w.id), sub: ownsW(sv, w.id) ? '가짐' : '없음' })) },
  { id: 'pet', name: '펫', cells: sv => PETS.map(p => ({ id: p.id, name: p.name, anim: p.id, on: sv.cleared >= p.unlock, sub: sv.cleared >= p.unlock ? '합류' : p.hint })) },
  { id: 'set', name: '세트', cells: sv => Object.entries(SETS).map(([k, s]) => ({ id: k, name: s.name, on: !!sv.dex?.s?.[k], sub: sv.dex?.s?.[k] ? '얻음' : '없음' })) },
  { id: 'egg', name: '숨겨진', cells: sv => Object.entries(EGGS).map(([k, e]) => ({ id: k, name: sv.eggs?.[k] ? e.name : '???', on: !!sv.eggs?.[k], sub: sv.eggs?.[k] ? '얻음' : e.hint })) },
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

export const DEX_ALL = Object.keys(MOBS).length + Object.keys(BOSSES).length + WTYPES.length + PETS.length + Object.keys(SETS).length + Object.keys(EGGS).length;

// ── 업적: 값(v)이 need에 닿으면 받기. title이 있으면 칭호도 열린다 ──
const st = (sv, k) => sv.stats?.[k] || 0;
export const ACHIEVES = [
  { id: 'kill1', name: '사냥 입문', desc: '몬스터 1,000마리', need: 1000, v: sv => st(sv, 'kills'), gem: 20 },
  { id: 'kill2', name: '학살자', desc: '몬스터 10,000마리', need: 10000, v: sv => st(sv, 'kills'), gem: 50, title: '학살자' },
  { id: 'kill3', name: '끝없는 칼날', desc: '몬스터 50,000마리', need: 50000, v: sv => st(sv, 'kills'), gem: 150 },
  { id: 'enh10', name: '위험한 불꽃', desc: '+10 강화', need: 10, v: sv => Math.max(sv.enh, st(sv, 'maxEnh')), gem: 30 },
  { id: 'enh15', name: '강화 장인', desc: '+15 강화', need: 15, v: sv => Math.max(sv.enh, st(sv, 'maxEnh')), gem: 80, title: '강화 장인' },
  { id: 'enh20', name: '전설의 대장장이', desc: '+20 강화', need: 20, v: sv => Math.max(sv.enh, st(sv, 'maxEnh')), gem: 150, title: '전설의 대장장이' },
  { id: 'demon', name: '마왕 사냥꾼', desc: '5장 보스 마왕 격파', need: 15, v: sv => sv.cleared, gem: 100, title: '마왕 사냥꾼' },
  { id: 'ch8', name: '수정 광산의 주인', desc: '8장 수정 거신 격파', need: 24, v: sv => sv.cleared, gem: 80 },
  { id: 'ch10', name: '심연을 건너다', desc: '10장 공허 군주 격파', need: 30, v: sv => sv.cleared, gem: 120, title: '심연의 방랑자' },
  { id: 'hard1', name: '붉은 길', desc: '어려움 1장 보스 격파', need: 3, v: sv => sv.hardCleared || 0, gem: 50 },
  { id: 'ch15', name: '대장간의 끝', desc: '15장 원초의 대장신 격파', need: 45, v: sv => sv.cleared, gem: 200, title: '원초의 대장장이' },
  { id: 'hard5', name: '지옥의 정복자', desc: '어려움 마지막 장 보스 격파', need: HARD.unlock, v: sv => sv.hardCleared || 0, gem: 150, title: '지옥의 정복자' },
  { id: 'tower10', name: '탑 오르기', desc: '무한의 탑 10층', need: 10, v: sv => sv.endBest || 0, gem: 30 },
  { id: 'tower25', name: '탑의 주인', desc: '무한의 탑 25층', need: 25, v: sv => sv.endBest || 0, gem: 100, title: '탑의 주인' },
  { id: 'day7', name: '단골 손님', desc: '출석 7일', need: 7, v: sv => sv.streak || 0, gem: 30 },
  { id: 'day30', name: '대장간 식구', desc: '출석 30일', need: 30, v: sv => sv.streak || 0, gem: 100, title: '대장간 식구' },
  { id: 'dun10', name: '보물 사냥꾼', desc: '일일 던전 10번', need: 10, v: sv => st(sv, 'dun'), gem: 40 },
  { id: 'gob10', name: '고블린 잡이', desc: '보물 고블린 10마리', need: 10, v: sv => st(sv, 'gob'), gem: 40 },
  { id: 'dex25', name: '수집가', desc: '도감 25칸', need: 25, v: sv => dexState(sv).n, gem: 50 },
  { id: 'dexAll', name: '박물관장', desc: '도감 전부', need: DEX_ALL, v: sv => dexState(sv).n, gem: 150, title: '박물관장' },
];
export const achReady = sv => ACHIEVES.filter(a => !sv.ach?.[a.id] && a.v(sv) >= a.need).length;
export const titles = sv => ACHIEVES.filter(a => a.title && sv.ach?.[a.id]).map(a => a.title);
