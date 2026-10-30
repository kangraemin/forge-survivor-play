// 진행 저장(localStorage). 접근이 막힌 브라우저에서도 게임은 돌아가게 메모리로 대체한다
import { SWEEP_DAILY, SWEEP_MAX, GEM_FREE, PASS_DAILY } from './data.js';
import { track } from './log.js';
import { PET_OLD } from './gear.js';
import { dexRefresh } from './codex.js';

const dayNo = d => Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); // 기기 시간대 기준 날짜 번호

const KEY = 'forge-survivor-v1';
const fresh = () => ({
  gold: 150, stone: 10, guard: 1, charm: 0, sweep: SWEEP_DAILY,
  tier: 0, enh: 0,
  cleared: 0,              // 깬 스테이지 수(0이면 1-1 도전 가능). 챕터c 스테이지s의 번호 = c*3+s
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
  cosmetics: { owned: {}, equip: {}, tried: {} }, // 신규 외형·캐시 펫, 이전 skins/hskins 보존
  skins: {}, skin: '',     // 산 칼빛, 끼고 있는 칼빛
  hskins: {}, hskin: '', cw: {}, books: {}, book: '',   // 산 영웅 스킨·캐시 무기·비급, 낀 것
  stats: { runs: 0, kills: 0, destroyed: 0, playMs: 0, losses: 0 },
  inv: [], eq: {},         // 가진 장비, 부위별로 낀 장비 uid
  wtype: 'sword',          // 든 무기 종류(가진 무기 wOwn·스탯 버전 spV는 load에서 채운다)
  pet: '', pets: {},       // 데려가는 펫, 펫별 레벨
  sp: { str: 0, dex: 0, int: 0, vit: 0 }, spReset: 1, // 찍은 스탯, 초기화권(처음 한 장은 공짜)
  eggs: {}, taps: 0,       // 얻은 숨겨진 템, 대장간 칼 두드린 횟수
  sound: true,
  // 콘텐츠 확장(없던 저장도 이 값으로 채운다)
  hardCleared: 0, hardOn: false, // 어려움 깬 판 수, 전투 탭이 어려움을 보고 있나
  dunN: 0,                 // 오늘 일일 던전 들어간 횟수
  wk: { id: 0, mis: {}, got: {} }, // 이번 주 번호, 주간 도전 진행·받은 것
  dex: { m: {}, s: {} },   // 도감: 몬스터별 처치 수, 얻은 세트
  ach: {}, title: '',      // 받은 업적, 낀 칭호
  // 한정 판매: 오늘의 특가 { day, id, off, got }, 성장 꾸러미 { c, at, shown }
  deal: null, grow: null,
});

let mem = null;
export function load() {
  if (mem) return mem;
  try { mem = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { mem = fresh(); }
  // 장당 6판 → 3판으로 바뀌기 전 저장: 깬 수를 새 번호로 옮긴다(x-1·x-4까지 깼으면 x-1·x-2, 보스를 잡았으면 다음 장)
  // 스탯 총점 식도 바뀌어 찍은 점수가 총점을 넘을 수 있다: 돌려주고 다시 찍게 한다
  if (!mem.st3) { const o = mem.cleared || 0, k = o % 6; mem.cleared = Math.floor(o / 6) * 3 + (k >= 1) + (k >= 4); mem.best = {}; mem.sp = {}; mem.st3 = true; }
  // 무기 7종으로 바뀌기 전 저장: 예전에 깬 만큼 창·도끼를 준다. 스탯 규칙(무기 스탯 1점 +10%)이 바뀌어 찍은 점수를 한 번 돌려준다
  if (!mem.wOwn) { mem.wOwn = { sword: true }; if (mem.cleared >= 3) mem.wOwn.spear = true; if (mem.cleared >= 6) mem.wOwn.axe = true; }
  // 펫이 보스 펫으로 바뀌기 전 저장: 키운 단계와 데려가던 펫을 옮긴다
  if (mem.pets && !mem.petV) { for (const [o, n] of Object.entries(PET_OLD)) if (mem.pets[o]) { mem.pets[n] = Math.max(mem.pets[n] || 0, mem.pets[o]); delete mem.pets[o]; } }
  if (PET_OLD[mem.pet]) mem.pet = PET_OLD[mem.pet];
  mem.petV = 2;
  if (!mem.spV) { mem.sp = { str: 0, dex: 0, int: 0, vit: 0 }; mem.spV = 2; }
  // 캐시 무기를 사면 해금(wOwn)까지 켜던 저장: 산 무기는 cw로만 남겨 보스 무기 보상이 다시 그 칸을 열 수 있게 한다(든 무기는 그대로 든다)
  if (!mem.cwV) { for (const k in mem.cw || {}) if (mem.cw[k] && k !== 'sword' && mem.wOwn) delete mem.wOwn[k]; mem.cwV = 1; }
  // 콘텐츠 확장 전 저장: 묶음 값이 없거나 비면 채운다. 도감 세트는 가방의 장비로 채운다
  mem.stats = { runs: 0, kills: 0, destroyed: 0, playMs: 0, losses: 0, ...mem.stats };
  mem.dex = { m: {}, s: {}, ...mem.dex }; mem.dex.m ||= {}; mem.dex.s ||= {};
  for (const it of mem.inv || []) if (it.set) mem.dex.s[it.set] = 1;
  mem.ach ||= {};
  if (!mem.wk?.mis) mem.wk = { id: 0, mis: {}, got: {} };
  mem.stats.maxEnh = Math.max(mem.stats.maxEnh || 0, mem.enh || 0);
  // 마지막으로 저장한 뒤 얼마나 비웠나(자리 비움 보상). 로비가 읽고 0으로 돌린다
  if (mem.seenAt) mem.idleMs = Math.max(mem.idleMs || 0, Date.now() - mem.seenAt);
  // 하루가 바뀌면 소탕권 충전, 파괴 방지권 1장
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; // 기기 시간대 기준 자정에 바뀐다
  if (mem.day !== today) {
    if (mem.day) { mem.sweep = Math.min(SWEEP_MAX, mem.sweep + SWEEP_DAILY); mem.guard += 1; }
    // 출석 보석, 월정액은 남은 날이 있으면 매일 지급
    mem.gem += GEM_FREE.daily; mem.ads = {}; mem.mis = {}; mem.misGot = {}; mem.dunN = 0;
    // 출석: 어제 왔으면 하루 늘고, 며칠 빠졌으면 늘지 않는다(처음으로 돌아가지는 않는다)
    const n = dayNo(d);
    if (!mem.streak || n - mem.dayN === 1) mem.streak++;
    mem.dayN = n; mem.loginGot = false; mem.day0 ??= n;   // 처음 온 날(광고 보석 첫 7일 5회)
    if (mem.passLeft > 0) { mem.passLeft--; mem.gem += PASS_DAILY.gem; mem.sweep += PASS_DAILY.sweep; track('pass_daily', { left: mem.passLeft }); }
    track('daily_reset', { streak: mem.streak, returning: !!mem.day, gem: mem.gem });
    mem.day = today;
  }
  // 주간 도전: 월요일 0시에 새 주(날짜 번호 0은 1970-01-01 목요일)
  const wk = Math.floor((dayNo(d) + 3) / 7);
  if (mem.wk.id !== wk) { mem.wk = { id: wk, mis: {}, got: {} }; track('weekly_reset', { wk }); }
  dexRefresh(mem);
  save();
  return mem;
}
export function save() {
  if (mem) mem.seenAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* 저장 불가 환경 */ }
}
export function reset() { mem = fresh(); save(); return mem; }
// 오늘 임무 진행
// 주간 도전도 같은 id로 함께 센다
export function mission(id, n = 1) { if (!mem) return; mem.mis[id] = (mem.mis[id] || 0) + n; mem.wk.mis[id] = (mem.wk.mis[id] || 0) + n; }
