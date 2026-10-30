// 설정 > 서버 저장 창: 서버에 저장된 시각, 지금 맞추기, 다른 기기로 옮기는 코드 만들기 / 코드로 불러오기
import { W } from './data.js';
import { font, font9, panel, button, toast } from './ui.js';
import { load } from './save.js';
import { importCode, brief } from './saveCore.js';
import { cloudMeta, transferCreate, transferRedeem } from './cloudSave.js';
import { syncNow, applyCode, reloadGame } from './cloudSync.js';
import { textDialog } from './settingsPanel.js';
import { track } from './log.js';
import { t, tt } from './i18n.js';

const pad = n => String(n).padStart(2, '0');
// '서버에 저장됨 10월 30일 14:32' / 아직이면 안내
export function savedText(t = cloudMeta().savedAt) {
  if (!t) return tt('cloudPanel.d77ab0');
  const d = new Date(t);
  return tt('cloudPanel.30c968', { v: d.getMonth() + 1, getDate: d.getDate(), pad: pad(d.getHours()), pad2: pad(d.getMinutes()) });
}
const ERR = { offline: t('cloudPanel.277c5c'), expired: t('cloudPanel.3eb837'), bad_tcode: t('cloudPanel.56212f'), rate_limited: t('cloudPanel.525a83'), off: t('cloudPanel.3af6b2'), no_save: t('cloudPanel.326c82') };

export function openCloud(scene) {
  const c = scene.modal();
  c.add(panel(scene, 16, 110, W - 32, 250, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 128, t('cloudPanel.0ae56b'), font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 38, 128, 26, 22, 'X', () => c.close(), { size: 11 }));
  const when = scene.add.text(W / 2, 156, '', font9(11, '#ffffff')).setOrigin(0.5); c.add(when);
  const note = scene.add.text(W / 2, 176, '', { ...font9(10, '#a1b2b6'), align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0); c.add(note);
  const paint = () => {
    when.setText(savedText());
    note.setText([t('cloudPanel.72feb7'), t('cloudPanel.2019e1'), cloudMeta().dirty ? t('cloudPanel.7c7618') : ''].filter(Boolean).join('\n'));
  };
  paint();
  let busy = false;
  const guarded = fn => async () => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };
  c.add(button(scene, W / 2, 238, W - 60, 30, t('cloudPanel.65a4dc'), guarded(async () => {
    const r = await syncNow();
    track('cloud_sync_tap', { action: r.action });
    if (r.applied) { toast(scene, t('cloudPanel.10a252'), '#5fdc6a'); setTimeout(reloadGame, 600); return; }
    if (r.action === 'pushed') toast(scene, t('cloudPanel.5adc9b'), '#5fdc6a');
    else if (r.action === 'kept') toast(scene, t('cloudPanel.78be80'), '#ffffff');
    else toast(scene, t('cloudPanel.98fb4f'), '#ed786f');
    paint();
  }), { size: 12, color: 0x2f6b3a }));
  c.add(button(scene, W / 2, 278, W - 60, 28, t('cloudPanel.4de0d9'), guarded(async () => {
    const r = await transferCreate(load());
    paint();
    if (!r.ok) { toast(scene, ERR[r.error] || t('cloudPanel.858036'), '#ed786f'); return; }
    track('cloud_transfer_create');
    textDialog({ title: t('cloudPanel.870a30'), note: t('cloudPanel.e6b1e6'), value: r.tcode, readonly: true });
  }), { size: 11 }));
  c.add(button(scene, W / 2, 314, W - 60, 28, t('cloudPanel.6431ae'), () => {
    textDialog({
      title: t('cloudPanel.6431ae'), note: t('cloudPanel.aea9ee'), ok: t('lobby.468266'),
      onOk: (v, err, close) => {
        if (err.dataset.code && err.dataset.v === v) { applyCode(err.dataset.code); track('cloud_transfer_apply'); close(); reloadGame(); return ''; }
        err.style.color = '#cfc6e0'; err.textContent = t('cloudPanel.33c1f7');
        transferRedeem(v).then(r => {
          err.style.color = '#ed786f';
          if (!r.ok) { err.textContent = ERR[r.error] || t('cloudPanel.253fdc'); return; }
          let d; try { d = importCode(r.code); } catch (e) { err.textContent = e.message; return; }
          const a = brief(d), b = brief(load());
          err.dataset.code = r.code; err.dataset.v = v; err.style.color = '#ffd75e';
          err.textContent = t('cloudPanel.8c52eb', { gold: a.gold, gem: a.gem, enh: a.enh, gold2: b.gold, gem2: b.gem, enh2: b.enh });
        });
        return '';
      },
    });
  }, { size: 11 }));
}
