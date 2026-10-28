// 진행 저장(localStorage). 접근이 막힌 브라우저에서도 게임은 돌아가게 메모리로 대체한다
import { SWEEP_DAILY, SWEEP_MAX } from './data.js';

const KEY = 'forge-survivor-v1';
const fresh = () => ({
  gold: 150, stone: 10, guard: 1, sweep: SWEEP_DAILY,
  tier: 0, enh: 0,
  cleared: 0,              // 깬 스테이지 수(0이면 1-1 도전 가능). 챕터c 스테이지s의 번호 = c*6+s
  best: {},                // 스테이지별 최고 기록(초)
  train: {},
  day: '',
  stats: { runs: 0, kills: 0, destroyed: 0, playMs: 0 },
  sound: true,
});

let mem = null;
export function load() {
  if (mem) return mem;
  try { mem = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { mem = fresh(); }
  // 하루가 바뀌면 소탕권 충전, 파괴 방지권 1장
  const today = new Date().toISOString().slice(0, 10);
  if (mem.day !== today) {
    if (mem.day) { mem.sweep = Math.min(SWEEP_MAX, mem.sweep + SWEEP_DAILY); mem.guard += 1; }
    mem.day = today;
  }
  save();
  return mem;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* 저장 불가 환경 */ }
}
export function reset() { mem = fresh(); save(); return mem; }
