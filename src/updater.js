// 업데이트 구조: 로딩 화면 업데이트(데이터·그림 JSON) + 강제/선택 업데이트(코드·결제·저장 형식)
// 코드는 내려받아 실행하지 않는다(앱인토스는 외부 코드 실행 금지). 받는 것은 JSON뿐이다
// 원격 주소: 웹은 같은 곳의 version.json. 토스·네이티브 번들은 REMOTE_BASE를 CDN/페이지 주소로 바꿔야 번들 밖 최신본을 본다
export const BUILD = 1;            // 이 앱 코드의 빌드 번호. 코드·결제·저장 형식을 바꾼 배포마다 올린다
export const REMOTE_BASE = '';     // 예: 'https://example.github.io/forge/'. 비면 상대 경로
const FETCH_MS = 3500, MAX_BYTES = 2e6;
const DATA_KEY = 'forge-data-cache', ASK_KEY = 'forge-update-asked';

const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } } };
export const channel = () => (window.__AIT_SDK ? 'toss' : window.forgeNativeSave || window.Capacitor ? (/iPhone|iPad/.test(navigator.userAgent) ? 'ios' : 'android') : 'web');

async function getJson(path, ms = FETCH_MS) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(REMOTE_BASE + path + (path.includes('?') ? '&' : '?') + 't=' + Date.now(), { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const s = await r.text();
    return s.length > MAX_BYTES ? null : JSON.parse(s);
  } catch { return null; } finally { clearTimeout(t); }
}

// 버전 정보 판정(순수 함수): { action: 'force'|'optional'|'none', store, notes }
export function judge(info, { build = BUILD, ch = 'web', today = '', asked = '' } = {}) {
  if (!info || typeof info !== 'object') return { action: 'none' };
  const store = info.store?.[ch] || '', notes = String(info.notes || '');
  if (Number.isFinite(info.minBuild) && build < info.minBuild) return { action: 'force', store, notes };
  if (Number.isFinite(info.recommendedBuild) && build < info.recommendedBuild && asked !== today) return { action: 'optional', store, notes };
  return { action: 'none', store, notes };
}

export function cachedData() { try { return JSON.parse(ls.get(DATA_KEY) || 'null'); } catch { return null; } }
// 게임 코드가 쓰는 입구: 받아 둔 데이터 JSON 한 개(없으면 null). 안 쓰면 내장 값으로 돈다
export const remoteData = name => cachedData()?.files?.[name] ?? null;

// 데이터 버전이 새로우면 목록의 JSON을 전부 받아 한 번에 캐시한다(하나라도 실패하면 기존 캐시 유지)
export async function syncData(info, onProgress = () => {}) {
  const want = Number(info?.dataVersion) || 0, list = Array.isArray(info?.data) ? info.data.filter(p => typeof p === 'string' && /\.json$/i.test(p) && !/^[a-z]+:|\.\./i.test(p)) : [];
  const have = cachedData()?.v || 0;
  if (!list.length || want <= have) return { updated: false };
  const files = {};
  for (let i = 0; i < list.length; i++) {
    const j = await getJson(list[i], 8000);
    if (j == null || typeof j !== 'object') return { updated: false, failed: list[i] };
    files[list[i]] = j; onProgress((i + 1) / list.length);
  }
  return { updated: ls.set(DATA_KEY, JSON.stringify({ v: want, files })), v: want };
}

// 부팅 때 한 번: 버전 확인 -> 판정. 네트워크가 안 되면 그냥 진행
export async function checkVersion() {
  const info = await getJson('version.json');
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const r = judge(info, { ch: channel(), today, asked: ls.get(ASK_KEY) || '' });
  return { ...r, info };
}
export const markAsked = () => { const d = new Date(); ls.set(ASK_KEY, `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`); };
