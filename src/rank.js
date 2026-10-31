// 주간 랭킹 클라이언트: 무한의 탑 최고 층 · 대장간 최고 강화(등급×21 + 강화). 서버: server/invite-worker/src/routes/rank.js
//  · 이번 주 기록은 저장 파일이 아니라 기기 저장소(forge-rank-v1)에 따로 둔다(저장 형식을 바꾸지 않는다)
//  · 포털판(noAnalytics)은 요청을 하지 않고 창도 숨긴다. 서버가 없거나 닿지 않으면 조용히 숨기되, 백오프가 지나면 다음 화면 진입 때 다시 묻는다
import { REMOTE_URL } from './cloudSave.js';
import { deviceId } from './deviceKey.js';
import { track } from './log.js';
import { isTest } from './testMode.js';

const KEY = 'forge-rank-v1';
const DAY = 86400000;
export const ENH_STEP = 21;                       // 강화 수치 0~20
export const weekNow = (now = Date.now()) => Math.floor((Math.floor(now / DAY) + 3) / 7);   // 서버와 같은 식(UTC 월요일 시작)
const remote = () => globalThis.__FORGE_REMOTE__ || REMOTE_URL;
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 막힘 */ } },
};
let deadUntil = 0, fails = 0;                      // 서버가 없거나 닿지 않음: 지수 백오프(10초→최대 5분) 동안만 접고, 그 뒤 화면에 들어올 때 다시 묻는다
let topCache = null;

// 랭킹을 쓰는 판인가(포털판은 외부 요청 금지)
export const rankEnabled = () => !isTest() && Date.now() >= deadUntil && !!remote() && !globalThis.window?.forgePlatform?.noAnalytics;
export const rankScore = (tier, enh) => tier * ENH_STEP + enh;
export const rankDecode = score => ({ tier: Math.floor(score / ENH_STEP), enh: score % ENH_STEP });

function rec() {
  let r = {}; try { r = JSON.parse(ls.get(KEY) || '{}') || {}; } catch { r = {}; }
  const wk = weekNow();
  if (r.wk !== wk) r = { wk, tower: 0, enh: 0, sent: { tower: 0, enh: 0 }, av: r.av, seeded: r.seeded };   // av: 서버에 랭킹이 있다고 확인한 적이 있다
  r.sent ||= { tower: 0, enh: 0 };
  return r;
}
const put = r => ls.set(KEY, JSON.stringify(r));

const fail = () => { fails++; deadUntil = Date.now() + Math.min(300000, 10000 * 2 ** Math.min(fails - 1, 5)); };
async function call(path, body, ms = 8000) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(remote() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) { if (res.status === 404 || res.status >= 500) fail(); return null; }   // Worker 에 랭킹이 아직 없다(404)·일시 장애 → 잠시 숨김
    const j = await res.json(); fails = 0; deadUntil = 0; return j;
  } catch { fail(); return null; } finally { clearTimeout(tm); }
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
export const MAX_TOWER = 300;   // 서버 검증 범위(routes/rank.js)와 같다
export function noteTower(floors) {
  if (isTest()) return;   // 테스트 모드: 이번 주 기록에 남기지 않는다
  floors = Math.min(floors | 0, MAX_TOWER);
  if (floors < 1) return;
  const r = rec();
  if (floors > r.tower) { r.tower = floors; put(r); flush(); }
}
export function noteGear(sv) {
  if (isTest()) return;
  const s = rankScore(sv.tier | 0, sv.enh | 0), r = rec();
  if (s > r.enh) { r.enh = s; put(r); flush(); }
  tossSubmitRecord(sv);   // 64차: 토스 리더보드에도 강화 기록을 함께 낸다(변하지 않았으면 안 보낸다)
}
// 저장에 이미 있는 무한탑 최고층·최고 강화를 처음 한 번 올린다(없는 기록은 올리지 않는다). 랭킹 화면·탑 화면에 들어올 때 부른다
export function seedFromSave(sv) {
  if (isTest()) return;
  const r = rec();
  if (r.seeded) return;
  r.seeded = 1; put(r);
  noteTower(sv.endBest | 0); noteGear(sv);
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

// 토스 게임 리더보드(친구 랭킹): 토스판에서만(forgePlatform.leaderboard).
// 공식 문서(2026-10-31): submitGameCenterLeaderBoardScore({score})는 앱당 리더보드 하나에 점수 하나만 받는다(종류별 보드·보조 필드 없음).
// 그래서 무한의 탑 최고 층과 대장간 최고 강화를 한 점수로 묶어 낸다: 점수 = 층 x 1000 + 강화 점수(등급 x 21 + 강화, 최대 209). 층이 같으면 강화가 높은 쪽이 위.
// 콘솔 리더보드 정책: 점수 단위 '점', 높을수록 위. 정책이 없으면 'LeaderBoard not found'로 실패한다 -> 조용히 넘어가고 track으로만 남긴다
export const tossBoard = () => (isTest() ? null : globalThis.window?.forgePlatform?.leaderboard || null);   // 테스트 모드: 리더보드 제출 없음
export const TOSS_FLOOR_MUL = 1000;
export const tossScore = (floors, tier, enh) => Math.min(floors | 0, MAX_TOWER) * TOSS_FLOOR_MUL + rankScore(tier | 0, enh | 0);
const LB_KEY = 'forge-toss-lb-v1';
let lbBusy = false;
export async function tossSubmitRecord(sv) {
  const lb = tossBoard();
  if (!lb || lbBusy) return;
  const score = tossScore(sv.endBest | 0, sv.tier, sv.enh);
  if (score < 1) return;
  let sent = 0; try { sent = +ls.get(LB_KEY) || 0; } catch {}
  if (score <= sent) return;   // 낮아졌거나(승급 직후 강화 0 등) 같으면 다시 내지 않는다
  lbBusy = true;
  try {
    if (await lb.submit(score)) ls.set(LB_KEY, String(score));
    else track('toss_lb_fail', { score });   // 정책 없음·버전 미달·네트워크: 게임엔 영향 없이 로그만
  } catch (e) { track('toss_lb_fail', { score, err: String(e?.message || e).slice(0, 60) }); }
  finally { lbBusy = false; }
}
// 예전 이름(무한의 탑 층만 내던 때): 같은 일을 한다
export const tossSubmitTower = tossSubmitRecord;
