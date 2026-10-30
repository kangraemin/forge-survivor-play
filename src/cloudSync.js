// 서버 저장 연결부: 서버와 맞추고(cloudSave.js) 받은 저장을 게임 저장소에 적용한다
// 적용한 뒤에는 화면을 다시 불러온다: load()가 다시 돌아야 하루 바뀜(출석·소탕권) 같은 처리가 새 저장에도 걸린다
import { load, save, importSave, store } from './save.js';
import { restorePurchases } from './saveCore.js';
import { cloudSync, cloudEnabled, cloudReady, cloudPull } from './cloudSave.js';
import { progressOf, compareProgress } from './progress.js';
import { track } from './log.js';

// 받은 FS1 코드를 저장으로 적용한다. 직전 저장은 save()가 백업 2칸에 남기고, 구매 기록은 별도 칸에서 다시 맞춘다
export function applyCode(code) {
  importSave(code);
  const n = restorePurchases(store(), load());
  save();
  return n;
}
export const reloadGame = () => { try { location.reload(); } catch { /* 환경이 막으면 다음 실행에 반영 */ } };

// 서버와 맞춘다. 서버본이 더 크면 적용한다(guard.late 이면 이미 로비로 넘어간 뒤라 적용하지 않는다: 하는 중인 판을 덮지 않는다)
// 반환 { action, applied }
export async function syncNow(guard = {}) {
  const r = await cloudSync(load());
  if (r.action === 'pull' && !guard.late) {
    applyCode(r.code);
    track('cloud_pull', { lost: !!r.lost });
    return { ...r, applied: true };
  }
  if (r.action === 'pushed') track('cloud_push');
  return { ...r, applied: false };
}

// 부팅 때 한 번(로딩 화면): 서버에 저장이 있고 이 기기보다 앞서 있으면 가져온다. 느리면 3.5초만 기다리고 그냥 진행한다
// 반환: 저장을 바꿔서 화면을 다시 불러오는 중이면 true
export async function bootSync() {
  if (!cloudEnabled()) return false;
  const guard = { late: false };
  let r = null;
  try { r = await Promise.race([syncNow(guard), new Promise(res => setTimeout(() => { guard.late = true; res(null); }, 3500))]); } catch { r = null; }
  cloudReady();
  // 서버에 못 닿았고 이 기기 저장이 비어 있으면(앱 데이터가 지워진 경우) 기기 안 사본(토스 Storage · 앱 Preferences)에서 되살린다
  if (!r?.applied && (!r || r.action === 'offline')) {
    try {
      const m = await cloudPull(), cur = load();
      if (m && compareProgress(progressOf(m.data), progressOf(cur)) > 0) { applyCode((await import('./saveCore.js')).exportCode(m.data)); track('mirror_restore'); r = { applied: true }; }
    } catch { /* 사본이 없거나 깨짐 */ }
  }
  if (r?.applied) { reloadGame(); return true; }
  return false;
}
