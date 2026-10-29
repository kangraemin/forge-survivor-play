// 진행 저장(localStorage). 접근이 막힌 브라우저에서도 게임은 돌아가게 메모리로 대체한다
import { SWEEP_DAILY, SWEEP_MAX, GEM_FREE, PASS_DAILY } from './data.js';
import { track } from './log.js';

const dayNo = d => Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); // 기기 시간대 기준 날짜 번호

const KEY = 'forge-survivor-v1';
const fresh = () => ({
  gold: 150, stone: 10, guard: 1, charm: 0, sweep: SWEEP_DAILY,
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
  mis: {}, misGot: {},     // 오늘 임무 진행·받은 것
  streak: 0, dayN: 0, loginGot: true, // 출석 일수, 마지막 접속 날짜 번호, 오늘 출석 보상 받았나
  tut: {},                 // 처음 하는 사람 안내를 마쳤나
  starterShown: false,
  endBest: 0,              // 무한의 탑 최고 층
  skins: {}, skin: '',     // 산 칼빛, 끼고 있는 칼빛
  stats: { runs: 0, kills: 0, destroyed: 0, playMs: 0, losses: 0 },
  inv: [], eq: {},         // 가진 장비, 부위별로 낀 장비 uid
  wtype: 'sword',          // 무기 종류
  pet: '', pets: {},       // 데려가는 펫, 펫별 레벨
  sp: { str: 0, dex: 0, int: 0, vit: 0 }, spReset: 1, // 찍은 스탯, 초기화권(처음 한 장은 공짜)
  eggs: {}, taps: 0,       // 얻은 숨겨진 템, 대장간 칼 두드린 횟수
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
    mem.gem += GEM_FREE.daily; mem.ads = {}; mem.mis = {}; mem.misGot = {};
    // 출석: 어제 왔으면 하루 늘고, 며칠 빠졌으면 늘지 않는다(처음으로 돌아가지는 않는다)
    const n = dayNo(d);
    if (!mem.streak || n - mem.dayN === 1) mem.streak++;
    mem.dayN = n; mem.loginGot = false;
    if (mem.passLeft > 0) { mem.passLeft--; mem.gem += PASS_DAILY.gem; mem.sweep += PASS_DAILY.sweep; track('pass_daily', { left: mem.passLeft }); }
    track('daily_reset', { streak: mem.streak, returning: !!mem.day, gem: mem.gem });
    mem.day = today;
  }
  save();
  return mem;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* 저장 불가 환경 */ }
}
export function reset() { mem = fresh(); save(); return mem; }
// 오늘 임무 진행
export function mission(id, n = 1) { if (!mem) return; mem.mis[id] = (mem.mis[id] || 0) + n; }
