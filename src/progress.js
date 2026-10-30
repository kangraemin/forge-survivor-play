// 진행도 비교(순수 함수, import 없음). 클라이언트(cloudSave.js)와 서버(server/invite-worker)가 같은 파일을 쓴다
// 서버 저장 충돌 규칙: 서버본과 기기본 중 진행도가 더 큰 쪽을 지키고, 진 쪽은 백업 칸에 보관한다
const num = v => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);

// 저장 데이터 -> { cleared: 깬 스테이지 수, playMs: 누적 플레이 시간, ledger: 구매 기록 수 }
export const progressOf = d => ({
  cleared: num(d?.cleared),
  playMs: num(d?.stats?.playMs),
  ledger: d?.ledger && typeof d.ledger === 'object' && !Array.isArray(d.ledger) ? Object.keys(d.ledger).length : 0,
});

// 1: a가 크다 / -1: b가 크다 / 0: 같다
// 세 값이 모두 같거나 큰 쪽이 이긴다. 엇갈리면(한쪽은 더 깼고 한쪽은 더 샀다) cleared -> playMs -> ledger 순서로 본다
export function compareProgress(a, b) {
  const ks = ['cleared', 'playMs', 'ledger'];
  let up = false, down = false;
  for (const k of ks) { if (a[k] > b[k]) up = true; else if (a[k] < b[k]) down = true; }
  if (up && !down) return 1;
  if (down && !up) return -1;
  if (!up && !down) return 0;
  for (const k of ks) if (a[k] !== b[k]) return a[k] > b[k] ? 1 : -1;
  return 0;
}

// FS1 내보내기 코드를 풀지 않고 모양·체크섬만 보고 진행도를 읽는다(서버용). 못 읽으면 null
const sum = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
export function peekCode(code) {
  const m = /^FS1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(String(code));
  if (!m || sum(m[1]) !== m[2]) return null;
  try {
    const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    return { ...progressOf(o), schema: Number.isInteger(o.schemaVersion) ? o.schemaVersion : 0 };
  } catch { return null; }
}

// 진 쪽(loser)의 구매 기록을 이긴 쪽(winner)에 합친다. 합친 개수. (산 것이 서버 동기화로 사라지지 않게)
export function mergeLedger(winner, loser) {
  if (!loser?.ledger || typeof loser.ledger !== 'object') return 0;
  winner.ledger ||= {}; let n = 0;
  for (const k in loser.ledger) if (!winner.ledger[k]) { winner.ledger[k] = loser.ledger[k]; n++; }
  return n;
}
