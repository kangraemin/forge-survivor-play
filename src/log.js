// 유저 행동 로그: GA4 /g/collect로 직접 보낸다(gtag는 github.io에서 쿠키 오류를 남긴다)
// track('이벤트', { 값 }) 한 줄로 어디서든 부른다. 문자는 ep., 숫자는 epn.으로 간다
// 토스로 옮기면 window.forgePlatform.log가 같은 이벤트를 받는다
import { isTest } from './testMode.js';
export const GA_ID = 'G-F1FFKK1T17';
const KEY = 'forge-log-v1';

const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const st = (() => { try { return JSON.parse(ls(KEY) || '{}'); } catch { return {}; } })();
const firstVisit = !st.cid;
if (!st.cid) { st.cid = `${Math.floor(Math.random() * 2147483647)}.${Math.floor(Date.now() / 1000)}`; st.installed = Date.now(); st.sct = 0; }
// 30분 넘게 쉬었다 오면 새 세션
const now = Date.now();
if (!st.sid || now - (st.last || 0) > 30 * 60 * 1000) { st.sid = Math.floor(now / 1000); st.sct = (st.sct || 0) + 1; st.newSession = true; } else st.newSession = false;
st.last = now; ls(KEY, JSON.stringify(st));

// 테스트 봇·헤드리스 브라우저·로컬 개발은 보내지 않는다(통계가 더러워진다)
const host = location.hostname;
// 포털 깃발(forgePlatform)은 이 파일이 불린 뒤에 걸릴 수 있어, 켜짐 여부는 보낼 때마다 본다
const isOff = () => isTest() || navigator.webdriver || /Headless/.test(navigator.userAgent) || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:' || /[?&]nolog/.test(location.search) || (!!window.forgePlatform?.noAnalytics && !window.forgePlatform?.logOk) || window.__FORGE_PORTAL === 'crazygames'   // 포털판은 외부 로그를 보내지 않는다
  || !!window.forgePlatform?.track;   // 스토어 앱은 웹 GA4 대신 Firebase로 보낸다(forgePlatform.track, store/src/forge-platform.js)
let seq = 0, lastT = now, first = true;
const recent = [];
export const logRecent = () => recent.slice();
// 콘솔에서 forgeLog()로 최근 이벤트를 본다
window.forgeLog = () => recent.slice();
export const logEnabled = () => !isOff();
// 같은 판 안의 공통 값(챕터·스테이지 등)을 붙인다
let ctx = {};
export const logCtx = o => { ctx = o ? { ...ctx, ...o } : {}; };
// 유저 속성: 이후 모든 이벤트에 붙어 진행도·결제 여부로 사람을 나눠 볼 수 있다
let user = {};
export const logUser = o => { user = { ...user, ...o }; try { window.forgePlatform?.userProps?.(o); } catch {} };

// GA4 dl(페이지 주소): 쿼리는 모두 빼고 유입 경로(utm_*·gclid)만 남긴다. 첫 이벤트에서 본 값을 sessionStorage에 두어 같은 세션의 다음 이벤트에도 붙인다
const KEEP = /^(utm_[a-z0-9_]+|gclid)$/i, SS = 'forge-utm-v1';
export function dlOf(href, store = true) {
  let u; try { u = new URL(href); } catch { return String(href).split('?')[0]; }
  const keep = new URLSearchParams();
  u.searchParams.forEach((v, k) => { if (KEEP.test(k)) keep.set(k, v); });
  try {
    if (keep.toString()) { if (store) sessionStorage.setItem(SS, keep.toString()); }
    else { const old = sessionStorage.getItem(SS); if (old) new URLSearchParams(old).forEach((v, k) => keep.set(k, v)); }
  } catch { /* 저장소 막힘 */ }
  const q = keep.toString();
  return u.origin + u.pathname + (q ? '?' + q : '');
}

export function track(name, params = {}) {
  const p = { ...ctx, ...params };
  recent.push([Date.now(), name, p]); if (recent.length > 200) recent.shift();
  if (isTest()) return;   // 테스트 모드: GA·Firebase·토스 로그로 아무것도 보내지 않는다
  try { window.forgePlatform?.log?.(name, p); } catch {}
  try { window.forgePlatform?.track?.(name, p); } catch {}   // 스토어 앱: Firebase Analytics
  if (isOff() || GA_ID.includes('X') || navigator.onLine === false) return;
  const t = Date.now();
  const q = new URLSearchParams({ v: '2', tid: GA_ID, cid: st.cid, sid: String(st.sid), sct: String(st.sct), seg: '1', _s: String(++seq), en: name, dl: dlOf(location.href), dt: document.title, ul: navigator.language || 'ko', sr: `${screen.width}x${screen.height}`, npa: '1' });
  if (first) { if (st.newSession) { q.set('_ss', '1'); q.set('_nsi', '1'); } if (firstVisit) q.set('_fv', '1'); first = false; }
  else q.set('_et', String(Math.min(t - lastT, 60000)));
  lastT = t;
  for (const [k, v] of Object.entries(user)) {
    if (v === undefined || v === null) continue;
    q.set((typeof v === 'string' ? 'up.' : 'upn.') + k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v).slice(0, 36));
  }
  // 플레이어별 흐름 리포트용: 무작위 id(개인정보 아님, 기기 localStorage에만 있음)와 시각. GA 관리에서 맞춤 측정기준 pid·ts를 등록해야 API로 읽힌다
  const portal = window.forgePlatform?.portal || window.__FORGE_PORTAL;   // app_open은 깃발이 걸리기 전에 나갈 수 있어 빌드가 넣은 값도 본다
  if (portal) q.set('ep.platform', portal);
  q.set('ep.pid', st.cid.split('.')[0]); q.set('ep.ts', String(t));
  // 결제 매출은 GA 매출 칸(cu+value)으로 간다
  if (p.currency) q.set('cu', p.currency);
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || k === 'currency') continue;
    if (typeof v === 'number') q.set('epn.' + k, String(Math.round(v * 100) / 100));
    else if (typeof v === 'boolean') q.set('epn.' + k, v ? '1' : '0');
    else q.set('ep.' + k, String(v).slice(0, 100));
  }
  const url = 'https://www.google-analytics.com/g/collect?' + q;
  try { if (!navigator.sendBeacon?.(url)) fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true }).catch(() => {}); } catch {}
}

// 깔때기(이탈 분석)용 이벤트: 한 기기에서 딱 한 번만 보낸다. 이름만으로 단계를 셀 수 있어 맞춤 측정기준이 필요 없다
// 단계 순서: app_open{first} → (prologue_done) → funnel_first_battle → funnel_clear_1_1 → funnel_first_enhance → funnel_enter_1_3 → funnel_clear_1_3 → funnel_enter_ch2 → funnel_return_d1 → funnel_return_d7
export function trackOnce(name, params = {}) {
  st.once ||= {};
  if (st.once[name]) return false;
  st.once[name] = Date.now(); ls(KEY, JSON.stringify(st));
  track(name, params);
  return true;
}

// 앱 시작·이탈·복귀·오류는 여기서 자동으로 남긴다
const t0 = Date.now();
track('app_open', { first: firstVisit, session_no: st.sct, days_since_install: Math.floor((now - st.installed) / 86400000), standalone: !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone), w: innerWidth, h: innerHeight });
// 복귀: 설치한 날 기준 달력 날짜로 +1일(D1)·+7일(D7)에 처음 열면 한 번씩(그날 안 오면 안 센다)
{
  const day = t => { const d = new Date(t); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
  const dd = day(now) - day(st.installed || now);
  if (dd === 1) trackOnce('funnel_return_d1', { session_no: st.sct });
  else if (dd === 7) trackOnce('funnel_return_d7', { session_no: st.sct });
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); track('app_background', { alive_sec: Math.round((Date.now() - t0) / 1000) }); }
  else if (hiddenAt) { track('app_foreground', { away_sec: Math.round((Date.now() - hiddenAt) / 1000) }); hiddenAt = 0; }
});
window.addEventListener('pagehide', () => track('app_close', { alive_sec: Math.round((Date.now() - t0) / 1000) }));
let errN = 0;
window.addEventListener('error', e => { if (errN++ < 5) track('js_error', { msg: String(e.message).slice(0, 90), src: `${(e.filename || '').split('/').pop()}:${e.lineno}` }); });
window.addEventListener('unhandledrejection', e => { if (errN++ < 5) track('js_error', { msg: String(e.reason?.message || e.reason).slice(0, 90), src: 'promise' }); });
