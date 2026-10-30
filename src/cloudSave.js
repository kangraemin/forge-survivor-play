// 원격 저장. 앱인토스·스토어 앱은 기기 저장이 앱을 지우면 사라진다 → 서버(Cloudflare Worker, server/invite-worker)에 한 벌 더 맡긴다
//
// 서버 저장(이 파일의 serverPush / serverPull / cloudSync)
//  · 열쇠: deviceKey.js 의 기기 키(getUserKeyForGame → getAnonymousKey → uuid). 개인정보는 보내지 않는다
//  · 본문: saveCore 내보내기 코드(FS1.…). 서버는 코드의 모양·체크섬·진행도만 본다
//  · 충돌: 진행도(cleared, playMs, 구매 ledger)가 큰 쪽을 지키고 진 쪽은 서버 lost 칸(최근 5개)과 이 기기 CLOSE 칸에 보관한다. 버리지 않는다
//  · 오프라인: 실패하면 dirty 표시만 하고 게임은 계속한다. 다음 동기화 때 다시 시도한다
//  · 다른 기기로 옮기기: 서버가 8자 코드(10분, 한 번)를 주고, 다른 기기가 그 코드로 FS1 코드를 받아 기존 가져오기 화면에 넣는다
//  · 호출 한도(서버): 저장 기기당 분당 6번. 이 파일은 5분에 한 번만 자동 저장한다 → Cloudflare 무료 등급(하루 10만 요청) 안에 둔다
//
// 공식 문서 확인(2026-10-30, apps-in-toss 문서)
//  · Storage(getItem/setItem/removeItem/clearItems): 기기 로컬 저장소. 토스 앱을 지우면 같이 지워진다.
//    기기를 바꿔도 남기려면 "자체 서버를 연결"하라고 안내한다(FAQ). → 앱인토스에는 기기 변경 후에도 남는 공식 클라우드 저장 API가 없다.
//  · getUserKeyForGame(): 게임 미니앱별 고유 사용자 식별키(hash). "게임 내 데이터 저장, 세이브 데이터 관리"에 쓰라고 안내한다. 토스앱 5.232.0 이상.
//  · 공식 확인 안 됨: 토스가 저장 데이터를 서버에 대신 보관해 주는 API.
import { exportCode, importCode } from './saveCore.js';
import { progressOf, compareProgress, mergeLedger } from './progress.js';
import { deviceId } from './deviceKey.js';

export const REMOTE_URL = 'https://forge-invite.remin1994.workers.dev';   // 저장·초대 서버(Cloudflare Worker, 무료 등급)
const mirrorKey = 'forge-survivor-v1.mirror';
export const META_KEY = 'forge-cloud-v1';            // 서버와 마지막으로 맞춘 기록 { rev, savedAt, dirty }
export const LOSE_KEY = 'forge-survivor-v1.cloudlose';   // 서버본에 져서 밀려난 이 기기 저장(FS1 코드). 지우지 않는다
const PUSH_GAP_MS = 5 * 60 * 1000, HIDE_GAP_MS = 60 * 1000, FIRST_MS = 20000;
const sdk = () => window.__AIT_SDK || null;
const remoteUrl = () => globalThis.__FORGE_REMOTE__ || REMOTE_URL;
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

// 서버 저장을 쓰는 채널: 앱인토스 · 스토어 앱(Capacitor). 웹 체험판은 쓰지 않는다(?cloud=1 이면 시험용으로 켠다)
export const cloudEnabled = () => {
  if (!remoteUrl() || window.forgePlatform?.noAnalytics) return false;   // 포털판은 외부 서버로 보내지 않는다
  try { if (new URLSearchParams(globalThis.location?.search).has('cloud')) return true; } catch { /* 주소 없음 */ }
  return !!(sdk() || window.Capacitor || window.forgeNativeSave);
};

export function cloudMeta() { try { return JSON.parse(ls.get(META_KEY) || '{}') || {}; } catch { return {}; } }
const setMeta = patch => { ls.set(META_KEY, JSON.stringify({ ...cloudMeta(), ...patch })); };

async function call(path, body, ms = 8000, keepalive = false) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(remoteUrl() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal, keepalive });
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }   // 오프라인·서버 오류는 null → 호출한 쪽이 dirty로 남긴다
}

// 아직 아무것도 하지 않은 새 저장(진행도 0)은 서버에 올리지 않는다: 서버에 있는 진짜 저장을 밀어내려는 시도가 되기 때문
const isEmpty = p => !p.cleared && !p.playMs && !p.ledger;

// ── 서버에 맡기기 ──
// 반환 { ok, offline?, skipped?, kept: 'incoming'|'server'|'same', conflict?, serverCode?, savedAt, rev }
export async function serverPush(mem, { keepalive = false } = {}) {
  if (!cloudEnabled()) return { ok: false, skipped: true };
  if (isEmpty(progressOf(mem))) return { ok: false, skipped: true, empty: true };
  const device = await deviceId();
  const r = await call('/save/put', { device, code: exportCode(mem), base: cloudMeta().rev | 0 }, 8000, keepalive);
  if (!r?.ok) { setMeta({ dirty: true }); return { ok: false, offline: r === null, error: r?.error }; }
  setMeta({ rev: r.rev, savedAt: r.savedAt, dirty: false, pushedAt: Date.now() });
  return { ok: true, kept: r.kept, conflict: !!r.conflict, serverCode: r.code, savedAt: r.savedAt, rev: r.rev };
}
// ── 서버에서 받기 ── { ok, exists, code, savedAt, rev, progress, lost } | { ok:false, offline }
export async function serverGet() {
  if (!cloudEnabled()) return { ok: false, skipped: true };
  const device = await deviceId();
  const r = await call('/save/get', { device });
  return r?.ok ? r : { ok: false, offline: r === null, error: r?.error };
}

// 서버와 맞추기. 서버본이 더 크면 그 코드를 돌려주고(action 'pull', 호출한 쪽이 적용), 아니면 올린다
// 지는 쪽(이 기기)은 LOSE_KEY에 FS1 코드로 남기고, 이 기기에만 있는 구매 기록은 이긴 쪽에 합친다
// 반환 { action: 'off'|'offline'|'pushed'|'pull'|'kept', code?, savedAt?, lost? }
export async function cloudSync(mem) {
  if (!cloudEnabled()) return { action: 'off' };
  const g = await serverGet();
  if (!g.ok) return { action: g.skipped ? 'off' : 'offline' };
  if (g.exists) {
    const L = progressOf(mem);
    if (!isEmpty(L) ? compareProgress(g.progress, L) > 0 : true) {
      let data; try { data = importCode(g.code); } catch { return { action: 'offline', error: 'bad_server_code' }; }
      if (!isEmpty(L)) { ls.set(LOSE_KEY, exportCode(mem)); mergeLedger(data, mem); }
      setMeta({ rev: g.rev, savedAt: g.savedAt, dirty: false });
      return { action: 'pull', code: exportCode(data), savedAt: g.savedAt, lost: !isEmpty(L) };
    }
    setMeta({ rev: g.rev, savedAt: g.savedAt });   // 이어 쓰는 기준을 서버 최신으로
  }
  const p = await serverPush(mem);
  if (p.skipped) return { action: 'kept' };
  if (!p.ok) return { action: 'offline' };
  if (p.kept === 'server' && p.serverCode) {   // 올렸는데 서버본이 더 컸다(다른 기기가 방금 먼저 썼다)
    ls.set(LOSE_KEY, exportCode(mem));
    let data; try { data = importCode(p.serverCode); } catch { return { action: 'offline' }; }
    mergeLedger(data, mem);
    return { action: 'pull', code: exportCode(data), savedAt: p.savedAt, lost: true };
  }
  return { action: 'pushed', savedAt: p.savedAt };
}

// ── 다른 기기로 옮기기 ──
// 만들기: 먼저 지금 저장을 올리고 8자 코드를 받는다. { ok, tcode, exp } | { ok:false, error }
export async function transferCreate(mem) {
  if (!cloudEnabled()) return { ok: false, error: 'off' };
  const p = await serverPush(mem);
  if (!p.ok && !p.skipped) return { ok: false, error: p.offline ? 'offline' : p.error || 'push' };
  const device = await deviceId();
  const r = await call('/save/transfer', { device });
  return r?.ok ? r : { ok: false, error: r === null ? 'offline' : r.error };
}
// 입력: 다른 기기에서 받은 8자 코드 -> FS1 내보내기 코드. 가져오기 화면(importSave)에 그대로 넣는다. { ok, code } | { ok:false, error }
export async function transferRedeem(tcode) {
  if (!remoteUrl()) return { ok: false, error: 'off' };
  const r = await call('/save/redeem', { tcode: String(tcode || '').trim() });
  return r?.ok ? { ok: true, code: r.code, savedAt: r.savedAt } : { ok: false, error: r === null ? 'offline' : r.error };
}

// ── 자동 저장: save()가 부른다. 5분에 한 번만 올리고, 화면이 숨겨질 때(앱 전환·종료) 마지막으로 한 번 올린다 ──
let latest = null, timer = 0, lastPush = 0, ready = false, hooked = false, busy = false;
export const cloudReady = () => { ready = true; if (latest) cloudQueue(latest); };   // 부팅 동기화가 끝난 뒤 켠다
async function flush(keepalive) {
  timer = 0;
  if (!latest || !ready || busy || !cloudEnabled()) return;
  busy = true; lastPush = Date.now();
  try { cloudPush(latest).catch(() => {}); await serverPush(latest, { keepalive }); } finally { busy = false; }   // 기기 안 사본(토스 Storage)도 같이
}
export function cloudQueue(mem) {
  latest = mem;
  if (!cloudEnabled()) return;
  if (!hooked) {
    hooked = true;
    try { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && ready && latest && Date.now() - lastPush > HIDE_GAP_MS) flush(true); }); } catch { /* 문서 없음 */ }
    setTimeout(() => { ready = true; if (latest) cloudQueue(latest); }, FIRST_MS);   // 부팅 동기화가 못 불러도 20초 뒤에는 켠다
  }
  if (timer || !ready) return;
  timer = setTimeout(() => flush(false), Math.max(1000, PUSH_GAP_MS - (Date.now() - lastPush)));
}

// ── 채널 어댑터(기기 안 사본) ──
// 웹: 서버 없이 내보내기 코드를 사용자가 직접 복사해 둔다(설정 화면)
const web = {
  name: 'web',
  available: () => false,
  push: async () => false,
  pull: async () => null,
};
// 앱인토스: Storage에 사본을 한 벌 더 둔다(웹뷰 저장소가 비워져도 살아남을 수 있게. 토스 앱 삭제·기기 변경에는 못 버틴다 → 그 뒤는 서버 저장)
const toss = {
  name: 'toss',
  available: () => !!sdk()?.Storage,
  async push(code) {
    try { await sdk()?.Storage?.setItem(mirrorKey, JSON.stringify({ code, savedAt: Date.now() })); return true; } catch { return false; }
  },
  async pull() { try { const s = await sdk()?.Storage?.getItem(mirrorKey); return s ? JSON.parse(s) : null; } catch { return null; } },
};
// 네이티브(플레이스토어·앱스토어): 앱 껍데기(store/)가 window.forgeNativeSave를 넣어 주면 그걸 쓴다(Capacitor Preferences 사본)
const native = {
  name: 'native',
  available: () => !!window.forgeNativeSave,
  push: async code => { try { return !!(await window.forgeNativeSave?.push(code)); } catch { return false; } },
  pull: async () => { try { return (await window.forgeNativeSave?.pull()) || null; } catch { return null; } },
};
export const adapter = () => (sdk() ? toss : window.forgeNativeSave ? native : web);

// 기기 안 사본에 맡긴다 / 돌려받는다(돌려받은 코드는 importSave가 검증하고 적용)
export async function cloudPush(mem) { const a = adapter(); if (!a.available()) return false; return a.push(exportCode(mem)); }
export async function cloudPull() { const a = adapter(); if (!a.available()) return null; const r = await a.pull(); if (!r?.code) return null; try { return { data: importCode(r.code), savedAt: r.savedAt }; } catch { return null; } }

// 구매 복원 자리: 저장이 사라진 뒤에도 산 것을 되살린다.
//  1) 구매 기록(saveCore.restorePurchases)은 load()가 알아서 한다
//  2) 플랫폼 영수증 복원: shop.js recoverPurchases(미지급 주문) + forgePlatform.restore(이미 결제된 주문). 자세한 내용은 purchaseRestore.js
export async function restorePlatformPurchases() {
  try { return (await (await import('./purchaseRestore.js')).restoreFromPlatform()) | 0; } catch { return 0; }
}
