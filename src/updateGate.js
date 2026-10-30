// 로딩 화면의 업데이트 관문: 강제 업데이트면 막고, 선택이면 물어보고, 새 데이터가 있으면 받고 나서 통과한다
import { W, H, setOpenN } from './data.js';
import { font, panel, button } from './ui.js';
import { checkVersion, syncData, markAsked } from './updater.js';
import { t } from './i18n.js';

// 스토어 앱(Capacitor)은 window.open이 스토어로 안 가므로 forgePlatform.openStore가 연다(주소가 비어도 앱 스토어 페이지로)
const openStore = url => { try { const fp = window.forgePlatform; if (fp?.openStore) return fp.openStore(url); if (url) window.open(url, '_blank'); } catch { /* 열 수 없는 환경 */ } };
function dialog(scene, title, lines, buttons) {
  const c = scene.add.container(0, 0).setDepth(100);
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());
  c.add(panel(scene, 24, H / 2 - 80, W - 48, 160, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, H / 2 - 62, title, font(14, '#ffd75e')).setOrigin(0.5));
  c.add(scene.add.text(W / 2, H / 2 - 28, lines.join('\n'), font(11, '#ffffff', 2)).setOrigin(0.5, 0).setAlign('center'));
  buttons.forEach((b, i) => c.add(button(scene, W / 2 + (i - (buttons.length - 1) / 2) * 104, H / 2 + 54, 96, 28, b.label, b.fn, { size: 11, color: b.color })));
  return c;
}

// 반환: Promise<boolean> — true면 로비로 진행, false면 멈춘다(강제 업데이트)
export async function updateGate(scene, started) {
  const status = scene.add.text(W / 2, H / 2 + 34, '', font(10, '#cfc6e0', 2)).setOrigin(0.5).setDepth(5);
  let r;
  try { status.setText(t('updateGate.4997a0')); r = await Promise.race([started, new Promise(res => setTimeout(() => res(null), 4500))]); } catch { r = null; }
  status.setText('');
  if (!r) return true;   // 네트워크 실패: 그냥 진행(열린 장 수는 마지막으로 받은 값을 쓴다)
  if (r.info?.contentChapters !== undefined) setOpenN(r.info.contentChapters);   // 16장부터는 이 값을 올리면 열린다(기본 15)
  if (r.action === 'force') {
    dialog(scene, t('updateGate.fcef0c'), [t('updateGate.bab9f6'), t('updateGate.08411c'), r.notes].filter(Boolean), [{ label: t('updateGate.4f72dd'), color: 0x2f6b3a, fn: () => openStore(r.store) }]);
    return false;
  }
  if (r.action === 'optional') {
    markAsked();
    await new Promise(res => {
      const d = dialog(scene, t('updateGate.08b126'), [t('updateGate.952638'), r.notes].filter(Boolean), [
        { label: t('updateGate.4f72dd'), color: 0x2f6b3a, fn: () => { openStore(r.store); d.destroy(); res(); } },
        { label: t('lobby.0fcd14'), color: 0x3a3846, fn: () => { d.destroy(); res(); } }]);
    });
  }
  try {
    const want = Number(r.info?.dataVersion) || 0;
    if (want) {
      status.setText(t('updateGate.2d88be'));
      await syncData(r.info, v => status.setText(t('updateGate.765a03', { round: Math.round(v * 100) })));
      status.setText('');
    }
  } catch { status.setText(''); }
  return true;
}
export const startCheck = () => checkVersion().catch(() => null);
