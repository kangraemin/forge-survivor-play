// 원격 저장 어댑터 자리. 채널마다 저장을 맡기는 곳이 달라서 같은 모양의 어댑터로 감싼다
//
// 어댑터 모양
//   name        채널 이름
//   available() 지금 쓸 수 있나
//   push(code)  저장 내보내기 코드(FS1.…)를 맡긴다 -> true/false
//   pull()      맡긴 코드를 돌려받는다 -> { code, savedAt } | null
//   userKey()   사용자 식별키(서버 저장의 열쇠) -> string | null
//
// 공식 문서 확인(2026-10-30, apps-in-toss 문서)
//  · Storage(getItem/setItem/removeItem/clearItems): 기기 로컬 저장소. 토스 앱을 지우면 같이 지워진다.
//    기기를 바꿔도 남기려면 "자체 서버를 연결"하라고 안내한다(FAQ). → 앱인토스에는 기기 변경 후에도 남는 공식 클라우드 저장 API가 없다.
//  · getUserKeyForGame(): 게임 미니앱별 고유 사용자 식별키(hash). "게임 내 데이터 저장, 세이브 데이터 관리"에 쓰라고 안내한다. 토스앱 5.232.0 이상.
//  · 공식 확인 안 됨: 토스가 저장 데이터를 서버에 대신 보관해 주는 API. 서버 저장은 REMOTE_URL에 자체 서버가 있어야 켜진다(지금은 비어 있음 = 꺼짐).
import { exportCode, importCode } from './saveCore.js';

export const REMOTE_URL = '';   // 자체 저장 서버 주소(비어 있으면 서버 저장은 꺼짐). 돈이 드는 서버라 사용자가 정할 때 채운다
const mirrorKey = 'forge-survivor-v1.mirror';
const sdk = () => window.__AIT_SDK || null;

// 웹: 서버 없이 내보내기 코드를 사용자가 직접 복사해 둔다(설정 화면). 어댑터는 자리만 있다
const web = {
  name: 'web',
  available: () => false,
  push: async () => false,
  pull: async () => null,
  userKey: async () => null,
};

// 앱인토스: Storage에 사본을 한 벌 더 둔다(웹뷰 저장소가 비워져도 살아남을 수 있게. 토스 앱 삭제·기기 변경에는 못 버틴다).
// 서버 저장은 사용자 식별키로 REMOTE_URL에 맡긴다(서버가 생기면 켠다)
const toss = {
  name: 'toss',
  available: () => !!sdk()?.Storage,
  async userKey() {
    try { const r = await sdk()?.getUserKeyForGame?.(); return r && r !== 'ERROR' && r.type === 'HASH' ? r.hash : null; } catch { return null; }
  },
  async push(code) {
    let ok = false;
    try { await sdk()?.Storage?.setItem(mirrorKey, JSON.stringify({ code, savedAt: Date.now() })); ok = true; } catch { /* 사본 실패는 무시 */ }
    if (REMOTE_URL) {
      const k = await this.userKey(); if (!k) return ok;
      try { const r = await fetch(REMOTE_URL + '/save', { method: 'PUT', headers: { 'x-anon-key': k, 'content-type': 'text/plain' }, body: code }); ok = r.ok; } catch { ok = false; }
    }
    return ok;
  },
  async pull() {
    if (REMOTE_URL) {
      const k = await this.userKey();
      if (k) { try { const r = await fetch(REMOTE_URL + '/save', { headers: { 'x-anon-key': k } }); if (r.ok) return { code: (await r.text()).trim(), savedAt: Date.now() }; } catch { /* 사본으로 */ } }
    }
    try { const s = await sdk()?.Storage?.getItem(mirrorKey); return s ? JSON.parse(s) : null; } catch { return null; }
  },
};

// 네이티브(플레이스토어·앱스토어): 이후 연결(플레이 게임즈 / iCloud 키-값 등). 앱 껍데기가 window.forgeNativeSave를 넣어 주면 그걸 쓴다
const native = {
  name: 'native',
  available: () => !!window.forgeNativeSave,
  push: async code => { try { return !!(await window.forgeNativeSave?.push(code)); } catch { return false; } },
  pull: async () => { try { return (await window.forgeNativeSave?.pull()) || null; } catch { return null; } },
  userKey: async () => { try { return (await window.forgeNativeSave?.userKey?.()) || null; } catch { return null; } },
};

export const adapter = () => (sdk() ? toss : window.forgeNativeSave ? native : web);

// 현재 저장을 맡긴다 / 맡긴 것을 돌려받는다(돌려받은 코드는 importSave가 검증하고 적용)
export async function cloudPush(mem) { const a = adapter(); if (!a.available()) return false; return a.push(exportCode(mem)); }
export async function cloudPull() { const a = adapter(); if (!a.available()) return null; const r = await a.pull(); if (!r?.code) return null; try { return { data: importCode(r.code), savedAt: r.savedAt }; } catch { return null; } }

// 구매 복원 자리: 저장이 사라진 뒤에도 산 것을 되살린다.
//  1) 구매 기록(saveCore.restorePurchases)은 load()가 알아서 한다
//  2) 플랫폼 영수증 복원: 앱인토스 IAP.getPendingOrders / 플레이·앱스토어 복원 구매는 window.forgePlatform.restore()로 잇는다(아직 연결 전이면 0)
export async function restorePlatformPurchases() {
  try { return (await window.forgePlatform?.restore?.()) | 0; } catch { return 0; }
}
