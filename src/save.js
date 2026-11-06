// 진행 저장(localStorage). 접근이 막힌 브라우저에서도 게임은 돌아가게 메모리로 대체한다
import { SWEEP_DAILY, sweepAdd, GEM_FREE, PASS_DAILY } from './data.js';
import { track, trackThrottled } from './log.js';
import { readSave, writeSave, fresh, KEY, exportCode, importCode, restorePurchases, syncLedger } from './saveCore.js';
import { dexRefresh } from './codex.js';
import { cloudQueue } from './cloudSave.js';
import { isTest, wrapTestStorage } from './testMode.js';

const dayNo = d => Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); // 기기 시간대 기준 날짜 번호

let mem = null, loadInfo = { source: 'new', lostRaw: false };
// localStorage가 막힌 브라우저에서는 메모리 저장소로 대체
const memStore = (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; })();
let st0 = null;
export function store() { if (st0) return st0;
   if (isTest()) { let b; try { localStorage.getItem(KEY); b = localStorage; } catch { b = memStore; } return st0 = wrapTestStorage(b); }   // 테스트 모드: forge-survivor-test* 칸만 쓴다(실제 저장은 건드리지 않는다)
   if (window.forgePlatform?.storage) return st0 = window.forgePlatform.storage;   // 포털판 저장소(platform/crazygames.js)
   try { localStorage.getItem(KEY); st0 = localStorage; } catch { st0 = memStore; } return st0; }
export const loadStatus = () => loadInfo;
// 날짜를 보고 하루·주를 새로 연다. 앱을 켜 둔 채 자정을 넘겨도 로비로 돌아오면 바뀐다
function rollDay() {
  // 하루가 바뀌면 소탕권 충전, 파괴 방지권 1장
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; // 기기 시간대 기준 자정에 바뀐다
  // 시계가 미래로 잘못 갔다가 돌아오면 dayN이 미래에 묶여 일일 보상·광고 횟수가 멈춘다 → 이틀 넘게 앞서 있으면 지금 날짜로 되돌린다(보상 없음)
  // 시계 왕복으로 보상을 다시 타는 길을 막으려고 저장 하나에 5번까지만
  const now = dayNo(d);
  if ((mem.dayN || 0) - now >= 2 && (mem.clockFix | 0) < 5) {
    mem.clockFix = (mem.clockFix | 0) + 1; mem.dayN = now; mem.day = today;
    if (mem.wk?.id > Math.floor((now + 3) / 7)) mem.wk.id = Math.floor((now + 3) / 7);
    track('clock_fix', { n: mem.clockFix });
  }
  // 날짜가 앞으로 갈 때만 하루를 새로 연다: 시계를 어제로 돌렸다 되돌리면 그때마다 출석 보석·광고 횟수·월정액 하루치가 다시 들어왔다
  if (mem.day !== today && dayNo(d) > (mem.dayN || 0)) {
    if (mem.day) { mem.sweep = sweepAdd(mem.sweep, SWEEP_DAILY); mem.guard += 1; }
    // 출석 보석, 월정액은 남은 날이 있으면 매일 지급
    mem.gem += GEM_FREE.daily; mem.ads = {}; mem.mis = {}; mem.misGot = {}; mem.dunN = 0; mem.markN = 0; mem.trialN = 0;
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
  if (!(mem.wk.id >= wk)) { mem.wk = { id: wk, mis: {}, got: {} }; track('weekly_reset', { wk }); }
}
// 로비가 열릴 때 부른다. 바뀌었으면 저장한다
export function checkDay() {
  if (!mem || realMem) return;
  const before = mem.day, wk = mem.wk?.id;
  rollDay();
  if (mem.day !== before || mem.wk?.id !== wk) save();
}
export function load() {
  if (mem) return mem;
  // 읽기·변환이 실패해도 새 저장으로 덮어쓰지 않는다: 백업 복구, 안 되면 원본을 따로 보관(saveCore.readSave)
  const r = readSave(store());
  mem = r.data; loadInfo = { source: r.source, lostRaw: r.lostRaw };
  const back = restorePurchases(store(), mem);   // 저장이 새로 시작됐거나 구매가 빠졌으면 구매 기록으로 되살린다
  if (back) track('purchase_restore', { n: back });
  if (r.source !== 'main') track('save_recover', { source: r.source, lost: r.lostRaw });
  // 마지막으로 저장한 뒤 얼마나 비웠나(자리 비움 보상). 로비가 읽고 0으로 돌린다
  if (mem.seenAt) mem.idleMs = Math.max(mem.idleMs || 0, Date.now() - mem.seenAt);
  rollDay();
  dexRefresh(mem);
  save();
  return mem;
}
// 프롤로그 모래판: 풀템 프롤로그 상태를 메모리에서만 쓴다. 들어가 있는 동안 load()는 이 객체를 돌려주고 save()는 아무것도 쓰지 않는다(실제 저장 칸·백업·구매 장부·서버 저장 모두 그대로)
let realMem = null;
export function sandboxBegin(sv) { if (realMem) return; load(); realMem = mem; mem = sv; }
export function sandboxEnd() { if (!realMem) return; mem = realMem; realMem = null; }
export const inSandbox = () => !!realMem;
// 창을 둘 열면 뒤늦게 저장하는 옛 창이 새 창의 진행을 덮는다(업데이트로 새로 생긴 값까지): 다른 창이 저장하면 이 창은 저장을 멈추고 다시 불러오게 한다
let stale = false, staleCb = null;
export const onStale = cb => { staleCb = cb; if (stale) cb(); };
try { window.addEventListener('storage', e => { if (e.key === KEY && e.newValue != null && !stale) { stale = true; staleCb?.(); } }); } catch { /* 창이 없는 환경 */ }
export function save() {
  if (realMem || stale) return false;
  if (mem) mem.seenAt = Date.now();
  if (!mem) return false;
  syncLedger(store(), mem);   // 산 것을 저장과 분리된 칸에도 적는다
  const ok = writeSave(store(), mem);
  if (!ok) trackThrottled('save_fail', { day: Math.floor(Date.now() / 86400000) }, 60000);   // 저장 칸이 꽉 찼거나 막힘
  if (ok) cloudQueue(mem);   // 서버 저장: 5분에 한 번·앱을 떠날 때 올린다(cloudSave.js)
  return ok;   // 직렬화 검증 -> 직전 저장을 백업 2칸에 -> 쓰기
}
// 내보내기/가져오기(설정 화면). 가져오면 지금 저장은 백업 칸으로 밀린다
export const exportSave = () => (load(), exportCode(mem));
export function importSave(code) { const d = importCode(code); mem = d; save(); return mem; }
export function reset() { mem = fresh(); save(); return mem; }   // 직전 저장은 save()가 백업에 남긴다
// 오늘 임무 진행
// 주간 도전도 같은 id로 함께 센다
export function mission(id, n = 1) { if (!mem) return; mem.mis[id] = (mem.mis[id] || 0) + n; mem.wk.mis[id] = (mem.wk.mis[id] || 0) + n; }
