// 설정 창: 저장 내보내기/가져오기(복사용 코드), 구매 복원, 클라우드 저장, 버전
import { W } from './data.js';
import { font, font9, panel, button, toast } from './ui.js';
import { load, save, exportSave, importSave, loadStatus, store } from './save.js';
import { importCode, brief, restorePurchases } from './saveCore.js';
import { adapter, cloudPush, cloudPull, restorePlatformPurchases } from './cloudSave.js';
import { BUILD, channel } from './updater.js';
import { track } from './log.js';
import { openInvite } from './share.js';
import { setSound, setMusic, setVib, sfx, buzz, playBgm } from './sfx.js';

// 문의·약관 주소: 아직 공개 주소가 없어 자리만 둔다(주소가 정해지면 아래 세 줄만 채운다. docs/에는 약관·개인정보 문서가 없다)
const LINKS = { mail: '', terms: '', privacy: '' };

// 글자 상자가 필요한 입력은 화면 위에 HTML 창을 띄운다(캔버스에는 글자 입력이 없다)
function textDialog({ title, note = '', value = '', readonly = false, ok = '확인', onOk }) {
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:#000b;z-index:99;display:flex;align-items:center;justify-content:center;font-family:G9,sans-serif';
  const box = document.createElement('div');
  box.style.cssText = 'width:min(86vw,340px);background:#1a1426;border:1px solid #ffd75e;padding:12px;color:#fff;font-size:13px;line-height:1.5';
  const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'color:#ffd75e;font-size:15px;margin-bottom:6px';
  const n = document.createElement('div'); n.textContent = note; n.style.cssText = 'color:#cfc6e0;margin-bottom:6px;white-space:pre-line';
  const ta = document.createElement('textarea'); ta.value = value; ta.readOnly = readonly; ta.spellcheck = false;
  ta.style.cssText = 'width:100%;height:96px;box-sizing:border-box;background:#0d0a14;color:#fff;border:1px solid #475c66;font-size:11px;word-break:break-all;resize:none';
  const err = document.createElement('div'); err.style.cssText = 'color:#ed786f;min-height:18px';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:6px';
  const mk = (t, fn, primary) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; b.style.cssText = `padding:8px 14px;border:1px solid #475c66;font:inherit;color:${primary ? '#111923' : '#fff'};background:${primary ? '#ffb85c' : '#293845'}`; return b; };
  const close = () => back.remove();
  row.append(mk('닫기', close));
  if (readonly) row.append(mk('복사', async () => { try { await navigator.clipboard.writeText(ta.value); err.style.color = '#5fdc6a'; err.textContent = '복사했어요'; } catch { ta.select(); try { document.execCommand('copy'); err.style.color = '#5fdc6a'; err.textContent = '복사했어요'; } catch { err.textContent = '길게 눌러 직접 복사해 주세요'; } } }, true));
  if (onOk) row.append(mk(ok, () => { const m = onOk(ta.value, err, close); if (m) err.textContent = m; }, true));
  box.append(h, n, ta, err, row); back.append(box); document.body.append(back);
  if (readonly) ta.select(); else ta.focus();
}

const SRC = { main: '정상', bak1: '백업에서 복구함', bak2: '백업에서 복구함', new: '새로 시작' };
export function openSettings(scene) {
  const sv = load(), c = scene.modal(), st = loadStatus();
  const a = adapter();
  c.add(panel(scene, 16, 60, W - 32, a.available() ? 370 : 340, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 78, '설정', font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 38, 78, 26, 22, 'X', () => c.close(), { size: 11 }));
  const info = [`저장 상태: ${SRC[st.source] || '정상'}${st.lostRaw ? ' (읽지 못한 원본은 따로 보관)' : ''}`, `버전 빌드 ${BUILD} (${channel()})  ·  저장 형식 v${sv.schemaVersion}`];
  c.add(scene.add.text(26, 98, info.join('\n'), font9(10, '#a1b2b6')).setLineSpacing(3));
  const row = (y, label, fn, color) => { const b = button(scene, W / 2, y, W - 60, 28, label, fn, { size: 11, color }); c.add(b); return b; };
  row(176, '친구 초대', () => { track('invite_open'); openInvite(scene); });   // 보석 보상 · share.js
  row(206, '저장 내보내기 (복사)', () => {
    track('save_export');
    textDialog({ title: '저장 내보내기', note: '아래 코드를 메모 앱 등에 붙여 넣어 보관하세요.\n기기를 바꾸면 "저장 가져오기"에 붙여 넣으면 돼요.', value: exportSave(), readonly: true });
  });
  row(236, '저장 가져오기 (붙여넣기)', () => {
    textDialog({
      title: '저장 가져오기', note: '내보낸 코드를 붙여 넣으세요.\n지금 저장은 백업으로 남아요.', ok: '적용',
      onOk: (v, err, close) => {
        let d; try { d = importCode(v); } catch (e) { return e.message; }
        const a = brief(d), b = brief(load());
        if (!err.dataset.ask) { err.dataset.ask = '1'; err.style.color = '#ffd75e'; return `코드: 골드 ${a.gold} 보석 ${a.gem} 강화 ${a.enh}\n지금: 골드 ${b.gold} 보석 ${b.gem} 강화 ${b.enh}\n맞으면 한 번 더 누르세요.`; }
        importSave(v); track('save_import'); close(); scene.scene.restart();
      },
    });
  }, 0x8a2f3a);
  row(266, '구매 복원', async () => {
    const n = restorePurchases(store(), load()) + await restorePlatformPurchases();
    save(); track('purchase_restore_tap', { n }); toast(scene, n ? `구매 ${n}건을 되살렸어요` : '되살릴 구매가 없어요', n ? '#5fdc6a' : '#ffffff');
  });
  // 이펙트 간단히(48차): 큰 베기 호·파편·번쩍임을 줄인다. 클라우드 저장은 준비되기 전까지 보이지 않는다
  const fx = row(296, '', () => { sv.fxLite = !sv.fxLite; save(); track('fx_lite', { on: !!sv.fxLite }); fx.label.setText(`이펙트 간단히: ${sv.fxLite ? '켜짐' : '꺼짐'}`); }, 0x3a3846);
  fx.label.setText(`이펙트 간단히: ${sv.fxLite ? '켜짐' : '꺼짐'}`);
  if (a.available()) {
    row(326, '클라우드에 저장 / 불러오기', async () => {
      const ok = await cloudPush(load()); toast(scene, ok ? '저장을 맡겼어요' : '맡기지 못했어요', ok ? '#5fdc6a' : '#ed786f');
    });
  }
  // 사운드·진동: 효과음 / 음악 / 진동을 따로 켜고 끈다
  const tg = (x, name, get, set) => {
    const b = button(scene, x, 146, 62, 24, '', () => { set(!get()); save(); b.label.setText(`${name} ${get() ? '켬' : '끔'}`); b.label.setColor(get() ? '#ffffff' : '#7d8f94'); }, { size: 10, color: 0x3a3846 });
    b.label.setText(`${name} ${get() ? '켬' : '끔'}`); b.label.setColor(get() ? '#ffffff' : '#7d8f94'); c.add(b);
  };
  tg(W / 2 - 68, '효과음', () => sv.sound !== false, v => { sv.sound = v; setSound(v); track('sound_toggle', { on: v, from: 'settings' }); if (v) { sfx('click'); } });
  tg(W / 2, '음악', () => !sv.musicOff, v => { sv.musicOff = !v; setMusic(v); if (v) playBgm('lobby'); });
  tg(W / 2 + 68, '진동', () => !sv.vibOff, v => { sv.vibOff = !v; setVib(v); if (v) buzz(30); });
  // 문의·이용약관·개인정보처리방침: 주소가 비어 있으면 안내만 띄운다
  const ly = a.available() ? 356 : 326;
  const link = (x, name, url) => c.add(button(scene, x, ly, 62, 22, name, () => {
    if (!url) { toast(scene, `${name} 주소를 준비하고 있어요`, '#ffffff'); return; }
    try { window.open(url, '_blank', 'noopener'); } catch { /* 열 수 없으면 무시 */ }
  }, { size: 9, color: 0x3a3846 }));
  link(W / 2 - 68, '문의', LINKS.mail ? `mailto:${LINKS.mail}` : '');
  link(W / 2, '이용약관', LINKS.terms);
  link(W / 2 + 68, '개인정보', LINKS.privacy);
  c.add(scene.add.text(26, ly + 18, '구매 기록은 저장과 따로 보관돼서 저장이 사라져도 복원할 수 있어요.', { ...font9(9, '#7d8f94'), wordWrap: { width: W - 60 } }).setLineSpacing(2));
  void cloudPull;
}
