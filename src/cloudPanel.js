// 설정 > 서버 저장 창: 서버에 저장된 시각, 지금 맞추기, 다른 기기로 옮기는 코드 만들기 / 코드로 불러오기
import { W } from './data.js';
import { font, font9, panel, button, toast } from './ui.js';
import { load } from './save.js';
import { importCode, brief } from './saveCore.js';
import { cloudMeta, transferCreate, transferRedeem } from './cloudSave.js';
import { syncNow, applyCode, reloadGame } from './cloudSync.js';
import { textDialog } from './settingsPanel.js';
import { track } from './log.js';

const pad = n => String(n).padStart(2, '0');
// '서버에 저장됨 10월 30일 14:32' / 아직이면 안내
export function savedText(t = cloudMeta().savedAt) {
  if (!t) return '서버에 아직 저장되지 않았어요';
  const d = new Date(t);
  return `서버에 저장됨 ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const ERR = { offline: '인터넷에 연결되어 있지 않아요', expired: '코드가 없거나 시간이 지났어요', bad_tcode: '코드 모양이 맞지 않아요', rate_limited: '잠시 뒤에 다시 해 주세요', off: '이 환경에서는 쓸 수 없어요', no_save: '서버에 저장된 게 없어요' };

export function openCloud(scene) {
  const c = scene.modal();
  c.add(panel(scene, 16, 110, W - 32, 250, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 128, '서버 저장', font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 38, 128, 26, 22, 'X', () => c.close(), { size: 11 }));
  const when = scene.add.text(W / 2, 156, '', font9(11, '#ffffff')).setOrigin(0.5); c.add(when);
  const note = scene.add.text(W / 2, 176, '', { ...font9(10, '#a1b2b6'), align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0); c.add(note);
  const paint = () => {
    when.setText(savedText());
    note.setText(['앱을 지우거나 기기를 바꿔도', '서버에서 되살릴 수 있어요.', cloudMeta().dirty ? '인터넷이 끊겨 있어서 아직 못 맞췄어요.' : ''].filter(Boolean).join('\n'));
  };
  paint();
  let busy = false;
  const guarded = fn => async () => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };
  c.add(button(scene, W / 2, 238, W - 60, 30, '지금 서버와 맞추기', guarded(async () => {
    const r = await syncNow();
    track('cloud_sync_tap', { action: r.action });
    if (r.applied) { toast(scene, '서버 저장을 불러왔어요', '#5fdc6a'); setTimeout(reloadGame, 600); return; }
    if (r.action === 'pushed') toast(scene, '서버에 저장했어요', '#5fdc6a');
    else if (r.action === 'kept') toast(scene, '저장할 진행이 아직 없어요', '#ffffff');
    else toast(scene, '맞추지 못했어요. 인터넷을 확인해 주세요', '#ed786f');
    paint();
  }), { size: 12, color: 0x2f6b3a }));
  c.add(button(scene, W / 2, 278, W - 60, 28, '다른 기기로 옮기는 코드 만들기', guarded(async () => {
    const r = await transferCreate(load());
    paint();
    if (!r.ok) { toast(scene, ERR[r.error] || '코드를 만들지 못했어요', '#ed786f'); return; }
    track('cloud_transfer_create');
    textDialog({ title: '옮기기 코드', note: '다른 기기에서 "코드로 불러오기"에 넣으세요.\n10분 안에 한 번만 쓸 수 있어요.', value: r.tcode, readonly: true });
  }), { size: 11 }));
  c.add(button(scene, W / 2, 314, W - 60, 28, '코드로 불러오기', () => {
    textDialog({
      title: '코드로 불러오기', note: '다른 기기에서 만든 옮기기 코드를 넣으세요.\n지금 저장은 백업으로 남아요.', ok: '확인',
      onOk: (v, err, close) => {
        if (err.dataset.code && err.dataset.v === v) { applyCode(err.dataset.code); track('cloud_transfer_apply'); close(); reloadGame(); return ''; }
        err.style.color = '#cfc6e0'; err.textContent = '확인 중…';
        transferRedeem(v).then(r => {
          err.style.color = '#ed786f';
          if (!r.ok) { err.textContent = ERR[r.error] || '불러오지 못했어요'; return; }
          let d; try { d = importCode(r.code); } catch (e) { err.textContent = e.message; return; }
          const a = brief(d), b = brief(load());
          err.dataset.code = r.code; err.dataset.v = v; err.style.color = '#ffd75e';
          err.textContent = `서버: 골드 ${a.gold} 보석 ${a.gem} 강화 ${a.enh}\n지금: 골드 ${b.gold} 보석 ${b.gem} 강화 ${b.enh}\n맞으면 한 번 더 누르세요.`;
        });
        return '';
      },
    });
  }, { size: 11 }));
}
