// 주간 랭킹 클라이언트: 무한의 탑 최고 층 · 대장간 최고 강화(등급×21 + 강화). 서버: server/invite-worker/src/routes/rank.js
//  · 이번 주 기록은 저장 파일이 아니라 기기 저장소(forge-rank-v1)에 따로 둔다(저장 형식을 바꾸지 않는다)
//  · 포털판(noAnalytics)은 요청을 하지 않고 창도 숨긴다. 서버가 없거나 닿지 않으면 조용히 숨긴다(이번 실행에서는 다시 묻지 않는다)
import { REMOTE_URL } from './cloudSave.js';
import { deviceId } from './deviceKey.js';

const KEY = 'forge-rank-v1';
const DAY = 86400000;
export const ENH_STEP = 21;                       // 강화 수치 0~20
export const weekNow = (now = Date.now()) => Math.floor((Math.floor(now / DAY) + 3) / 7);   // 서버와 같은 식(UTC 월요일 시작)
const remote = () => globalThis.__FORGE_REMOTE__ || REMOTE_URL;
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 막힘 */ } },
};
let dead = false;                                  // 서버가 없거나 닿지 않음: 이번 실행에서는 접는다
let topCache = null;

// 랭킹을 쓰는 판인가(포털판은 외부 요청 금지)
export const rankEnabled = () => !dead && !!remote() && !globalThis.window?.forgePlatform?.noAnalytics;
export const rankScore = (tier, enh) => tier * ENH_STEP + enh;
export const rankDecode = score => ({ tier: Math.floor(score / ENH_STEP), enh: score % ENH_STEP });

function rec() {
  let r = {}; try { r = JSON.parse(ls.get(KEY) || '{}') || {}; } catch { r = {}; }
  const wk = weekNow();
  if (r.wk !== wk) r = { wk, tower: 0, enh: 0, sent: { tower: 0, enh: 0 }, av: r.av };   // av: 서버에 랭킹이 있다고 확인한 적이 있다
  r.sent ||= { tower: 0, enh: 0 };
  return r;
}
const put = r => ls.set(KEY, JSON.stringify(r));

async function call(path, body, ms = 8000) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(remote() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) { if (res.status === 404 || res.status >= 500) dead = true; return null; }   // Worker 에 랭킹이 아직 없다(404) → 숨김
    return await res.json();
  } catch { dead = true; return null; } finally { clearTimeout(tm); }
}

// 이번 주 기록을 올리고 서버로 보낸다(올라간 것만). 부르는 곳은 기다리지 않는다
async function flush(force = false) {
  if (!rankEnabled()) return;
  const r = rec(), body = {};
  if (!r.av && !force) return;   // 서버에 랭킹이 있다고 확인하기 전에는 보내지 않는다(없는 서버에 요청해 오류를 내지 않는다)
  if (r.tower > r.sent.tower) body.tower = r.tower;
  if (r.enh > r.sent.enh) body.enh = r.enh;
  if (!Object.keys(body).length) return;
  const res = await call('/rank/submit', { device: await deviceId(), ...body });
  if (res?.ok) { const n = rec(); n.av = 1; n.sent = { tower: Math.max(n.sent.tower, body.tower || 0), enh: Math.max(n.sent.enh, body.enh || 0) }; put(n); topCache = null; }
}
export function noteTower(floors) {
  floors = floors | 0;
  if (floors < 1) return;
  const r = rec();
  if (floors > r.tower) { r.tower = floors; put(r); flush(); }
}
export function noteGear(sv) {
  const s = rankScore(sv.tier | 0, sv.enh | 0), r = rec();
  if (s > r.enh) { r.enh = s; put(r); flush(); }
}
// 이번 주 내 기록(서버 응답이 오기 전에 보여 줄 값)
export const myWeek = () => { const r = rec(); return { tower: r.tower, enh: r.enh }; };

// 랭킹 창: 서버에서 두 종류의 상위 50 + 내 순위. 실패하면 null(창을 열지 않는다)
export async function loadTop(force = false) {
  if (!rankEnabled()) return null;
  if (topCache && !force && Date.now() - topCache.at < 30000) return topCache.data;
  const dev = await deviceId();
  let res = await call('/rank/top', { device: dev });
  if (!res?.ok) return null;
  const r = rec();
  if (!r.av) { r.av = 1; put(r); }
  if (r.tower > r.sent.tower || r.enh > r.sent.enh) {   // 밀려 있던 이번 주 기록을 올리고 다시 받는다
    await flush(true);
    res = (await call('/rank/top', { device: dev })) || res;
  }
  topCache = { at: Date.now(), data: res };
  return res;
}
