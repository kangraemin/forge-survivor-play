// 기기 식별값(서버 저장·초대의 열쇠). 순서: 앱인토스 getUserKeyForGame -> getAnonymousKey -> 저장소 uuid
// 개인정보는 쓰지 않는다(해시/무작위 값뿐). share.js와 cloudSave.js가 같은 값을 쓴다
const DEV_KEY = 'forge-device-v1';
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const sdk = () => globalThis.window?.__AIT_SDK || null;
const clean = s => String(s).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
const uuid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9]/g, '');
let dev = null, devP = null;
export const peekDeviceId = () => dev;
export const resetDeviceIdForTest = () => { dev = null; devP = null; };   // 시험용: 다른 기기 열쇠로 바꿔 시험
export function deviceId() {
  if (dev) return Promise.resolve(dev);
  return devP ||= (async () => {
    let id = null;
    const s = sdk();
    try {
      const f = s?.getUserKeyForGame || s?.User?.getAnonymousKey || s?.getAnonymousKey;
      const r = f && await f();
      if (r && r !== 'ERROR' && r.type === 'HASH' && r.hash) id = 't' + clean(r.hash);
    } catch { /* 미지원 앱 버전: 저장소 값으로 */ }
    id ||= ls(DEV_KEY) || 'w' + uuid();
    if (id.length < 8) id = id.padEnd(8, '0');
    ls(DEV_KEY, id);
    return dev = id;
  })();
}
