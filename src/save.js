// 진행 저장(localStorage). 접근이 막힌 브라우저에서도 게임은 돌아가게 메모리로 대체한다
import { SWEEP_DAILY, SWEEP_MAX, GEM_FREE, PASS_DAILY } from './data.js';

const KEY = 'forge-survivor-v1';
const fresh = () => ({
  gold: 150, stone: 10, guard: 1, sweep: SWEEP_DAILY,
  tier: 0, enh: 0,
  cleared: 0,              // 깬 스테이지 수(0이면 1-1 도전 가능). 챕터c 스테이지s의 번호 = c*6+s
  best: {},                // 스테이지별 최고 기록(초)
  train: {},
  day: '',
  gem: 0,
  bought: {},             // 산 1회 한정 상품
  passLeft: 0,             // 월정액 남은 날
  noAds: false,
  ads: {},                 // 오늘 본 광고 횟수
  stats: { runs: 0, kills: 0, destroyed: 0, playMs: 0 },
  sound: true,
});

let mem = null;
export function load() {
  if (mem) return mem;
  try { mem = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { mem = fresh(); }
  // 하루가 바뀌면 소탕권 충전, 파괴 방지권 1장
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; // 기기 시간대 기준 자정에 바뀐다
  if (mem.day !== today) {
    if (mem.day) { mem.sweep = Math.min(SWEEP_MAX, mem.sweep + SWEEP_DAILY); mem.guard += 1; }
    // 출석 보석, 월정액은 남은 날이 있으면 매일 지급
    mem.gem += GEM_FREE.daily; mem.ads = {};
    if (mem.passLeft > 0) { mem.passLeft--; mem.gem += PASS_DAILY.gem; mem.sweep += PASS_DAILY.sweep; }
    mem.day = today;
  }
  save();
  return mem;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* 저장 불가 환경 */ }
}
export function reset() { mem = fresh(); save(); return mem; }
