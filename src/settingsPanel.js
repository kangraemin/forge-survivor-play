// 설정 창: 저장 내보내기/가져오기(복사용 코드), 구매 복원, 클라우드 저장, 버전
import { W, H } from './data.js';
import { font, font9, panel, button, toast, viewPt } from './ui.js';
import { load, save, exportSave, importSave, loadStatus, store, reset } from './save.js';
import { importCode, brief, restorePurchases } from './saveCore.js';
import { cloudEnabled, cloudMeta, restorePlatformPurchases } from './cloudSave.js';
import { openCloud } from './cloudPanel.js';
import { BUILD, channel } from './updater.js';
import { track, trackScreen } from './log.js';
import { openInvite } from './share.js';
import { LANGS, LANG_NAME, lang, setLang, t, tt } from './i18n.js';
import { shareHidden, cashHidden, trialInfo, openFull } from './platform/flags.js';   // 포털판 분기
import { runTutorial } from './tutorial.js';
import { isTest, testAllowed, makeTapCounter, askEnableTest, askDisableTest } from './testMode.js';
import { notifyAvailable, notifyState, notifyEnable, notifyDisable } from './notify.js';
import { setSound, setMusic, setMusicLevel, setVib, sfx, buzz, playBgm } from './sfx.js';

// 문의·약관·개인정보: 웹 배포 레포(forge-survivor-play)의 정적 페이지. 원본은 docs/legal/. 문의 메일은 다른 앱(오늘의 눈썰미 사이트)이 이미 쓰는 주소
const LINKS = { mail: 'remin1994@gmail.com', terms: 'https://kangraemin.github.io/forge-survivor-play/terms.html', privacy: 'https://kangraemin.github.io/forge-survivor-play/privacy.html' };

// 글자 상자가 필요한 입력은 화면 위에 HTML 창을 띄운다(캔버스에는 글자 입력이 없다)
export function textDialog({ title, note = '', value = '', readonly = false, ok = t('lobby.468266'), onOk }) {
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:#000b;z-index:99;display:flex;align-items:center;justify-content:center;font-family:G9,sans-serif';
  const box = document.createElement('div');
  box.style.cssText = 'width:min(86vw,340px);background:#1a1426;border:1px solid #ffd75e;padding:12px;color:#fff;font-size:13px;line-height:1.5';
  const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'color:#ffd75e;font-size:15px;margin-bottom:6px';
  const n = document.createElement('div'); n.textContent = note; n.style.cssText = 'color:#cfc6e0;margin-bottom:6px;white-space:pre-line';
  const ta = document.createElement('textarea'); ta.value = value; ta.readOnly = readonly; ta.spellcheck = false;
  ta.style.cssText = 'width:100%;height:96px;box-sizing:border-box;background:#0d0a14;color:#fff;border:1px solid #475c66;font-size:11px;word-break:break-all;resize:none';
  const err = document.createElement('div'); err.style.cssText = 'color:#ed786f;min-height:18px;white-space:pre-line';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:6px';
  const mk = (t, fn, primary) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; b.style.cssText = `padding:8px 14px;border:1px solid #475c66;font:inherit;color:${primary ? '#111923' : '#fff'};background:${primary ? '#ffb85c' : '#293845'}`; return b; };
  const close = () => back.remove();
  row.append(mk(t('cosmeticShop.94b7db'), close));
  if (readonly) row.append(mk(t('settingsPanel.a55b1e'), async () => { try { await navigator.clipboard.writeText(ta.value); err.style.color = '#5fdc6a'; err.textContent = t('settingsPanel.68f0de'); } catch { ta.select(); try { document.execCommand('copy'); err.style.color = '#5fdc6a'; err.textContent = t('settingsPanel.68f0de'); } catch { err.textContent = t('settingsPanel.1c7658'); } } }, true));
  if (onOk) row.append(mk(ok, () => { const m = onOk(ta.value, err, close); if (m) err.textContent = m; }, true));
  box.append(h, n, ta, err, row); back.append(box); document.body.append(back);
  if (readonly) ta.select(); else ta.focus();
}

const SRC = { main: t('settingsPanel.f6846c'), bak1: t('settingsPanel.ffbb91'), bak2: t('settingsPanel.ffbb91'), new: t('settingsPanel.ccdcc8') };
// 언어 고르기: 고르면 저장(저장 파일에도 남는다)하고 페이지를 다시 연다
function langPicker(scene) {
  const c = scene.modal(), sv = load();
  c.add(panel(scene, 16, 50, W - 32, 330, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 68, t('settingsPanel.1a723e'), font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 38, 68, 26, 22, 'X', () => c.close(), { size: 11 }));
  LANGS.forEach((code, i) => {
    const x = W / 2 + (i % 2 ? 59 : -59), y = 104 + Math.floor(i / 2) * 34;
    c.add(button(scene, x, y, 114, 28, LANG_NAME[code], () => {
      if (code === lang) return c.close();
      sv.lang = code; save(); track('lang_set', { lang: code }); setLang(code);
    }, { size: 11, color: code === lang ? 0x2f6b3a : 0x3a3846 }));
  });
}
// 고급 창: 저장 가져오기, 인트로 다시 보기, 데이터 초기화. 토스·스토어 앱은 주소(?prologue)를 바꿀 수 없어 여기서 연다
function openAdvanced(scene) {
  const c = scene.modal();
  c.add(panel(scene, 26, 120, W - 52, 230, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 138, tt('settingsPanel.advTitle'), font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 48, 138, 26, 22, 'X', () => c.close(), { size: 11 }));
  const row = (y, label, fn, color = 0x3a3846) => { const b = button(scene, W / 2, y, W - 80, 28, label, fn, { size: 11, color }); c.add(b); return b; };
  row(172, tt('settingsPanel.be28ca'), () => textDialog({
    title: t('settingsPanel.dc3734'), note: t('settingsPanel.8738f3'), ok: t('settingsPanel.e01dd0'),
    onOk: (v, err, close) => {
      let d; try { d = importCode(v); } catch (e) { return e.message; }
      const a = brief(d), b = brief(load());
      if (!err.dataset.ask) { err.dataset.ask = '1'; err.style.color = '#ffd75e'; return t('settingsPanel.9d3dec', { gold: a.gold, gem: a.gem, enh: a.enh, gold2: b.gold, gem2: b.gem, enh2: b.enh }); }
      importSave(v); track('save_import'); close(); scene.scene.restart();
    },
  }));
  // 인트로(프롤로그)만 다시 본다: 진행은 그대로, 보상은 다시 주지 않는다(Prologue.js replay)
  row(206, tt('settingsPanel.replayIntro'), () => { track('prologue_replay'); scene.scene.start('Prologue', { replay: true }); });
  // 데이터 초기화: 두 번 눌러야 지운다. 직전 저장은 save()가 백업 칸에 남긴다
  let ask = false;
  const wb = row(250, tt('settingsPanel.wipe'), () => {
    if (!ask) { ask = true; wb.label.setText(tt('settingsPanel.wipeAsk')); wb.label.setColor('#ffd75e'); return; }
    track('data_wipe', { cleared: load().cleared }); reset(); location.reload();
  }, 0x5a2a2a);
  const note = [tt('settingsPanel.wipeNote1')].concat(cashHidden() ? [] : [tt('settingsPanel.wipeNote2')]).map(x => '- ' + x).join('\n');
  c.add(scene.add.text(46, 274, note, { ...font9(10, '#a1b2b6'), wordWrap: { width: W - 92 } }).setLineSpacing(3));
}
export function openSettings(scene) {
  trackScreen('settings');
  const sv = load(), c = scene.modal(), st = loadStatus();
  const cloud = cloudEnabled();
  // 11/1: 버튼이 다닥다닥 붙어 있었다 — 칸마다 GAP(버튼 BH + 틈 10)씩 띄우고, 길어진 창은 scrollBody로 민다
  const GAP = 42, BH = 32, Y0 = 200;
  const nOn = notifyAvailable(), half = nOn && !shareHidden();
  const rowsN = 1 + (!shareHidden() || nOn ? 1 : 0) + 2 + (cashHidden() ? 0 : 1) + 1 + (cloud ? 1 : 0) + 1;
  const ly = Y0 + rowsN * GAP + 2, tl = trialInfo();
  const ph = ly + (cashHidden() ? 20 : 54) + (tl ? 34 : 0) - 60;
  c.add(panel(scene, 16, 60, W - 32, ph, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 78, tt('settingsPanel.c14a56'), font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 38, 78, 26, 22, 'X', () => c.close(), { size: 11 }));
  // 안내 다시 보기(코치마크). 1-1을 깨기 전에는 가리킬 화면이 없다
  c.add(button(scene, 62, 78, 84, 22, t('settingsPanel.930aa2'), () => { if (sv.cleared < 1) { toast(scene, t('settingsPanel.2a3ad0'), '#ffd75e'); return; } track('coach_replay'); c.close(); runTutorial(scene); }, { size: 10, color: 0x3a3846 }));
  const info = [tt('settingsPanel.94d834', { v: SRC[st.source] || tt('settingsPanel.f6846c'), v2: st.lostRaw ? tt('settingsPanel.e90d14') : '' }), tt('settingsPanel.154a72', { BUILD, channel: channel(), schemaVersion: sv.schemaVersion })];
  const infoTxt = scene.add.text(26, 98, info.join('\n'), font9(10, '#a1b2b6')).setLineSpacing(3);
  c.add(infoTxt);
  // 테스트 모드 진입(주인용): 버전 글자를 7번 연속 탭 → 코드 입력 창. 포털판은 아무 반응이 없다
  if (testAllowed()) {
    const tap = makeTapCounter(() => { if (isTest()) askDisableTest(); else askEnableTest(); });
    infoTxt.setInteractive({ useHandCursor: false }).on('pointerup', tap);
  }
  let ry = Y0;
  const row = (label, fn, color) => { const b = button(scene, W / 2, ry, W - 60, BH, label, fn, { size: 11, color }); ry += GAP; c.add(b); return b; };
  row(t('settingsPanel.14669c', { v: LANG_NAME[lang] }), () => langPicker(scene));
  // 재방문 알림(스토어 앱만): 친구 초대 칸을 반으로 나눠 나란히 둔다
  if (!shareHidden()) {
    const ib0 = button(scene, half ? W / 2 - 52 : W / 2, ry, half ? 102 : W - 60, BH, tt('settingsPanel.bf6a10'), () => { track('invite_open'); openInvite(scene); }, { size: 11, color: 0x3a3846 });   // 보석 보상 · share.js
    c.add(ib0);
  }
  if (nOn) {
    const paintN = () => { nb.label.setText(notifyState().on ? t('notify.setOn') : t('notify.setOff')); nb.label.setColor(notifyState().on ? '#ffffff' : '#7d8f94'); };
    const nb = button(scene, half ? W / 2 + 52 : W / 2, ry, half ? 102 : W - 60, BH, '', async () => {
      if (notifyState().on) await notifyDisable();
      else if (await notifyEnable() === 'denied') toast(scene, t('notify.denied'), '#ffffff');
      paintN();
    }, { size: 11, color: 0x3a3846 });
    c.add(nb); paintN();
  }
  if (!shareHidden() || nOn) ry += GAP;
  row(tt('settingsPanel.48157e'), () => {
    track('save_export');
    textDialog({ title: t('settingsPanel.9f6960'), note: t('settingsPanel.78d36c'), value: exportSave(), readonly: true });
  });
  // 52차: 붉고 커서 위험해 보였다 — 접힌 '고급' 창 안에 두고, 열어도 덮어쓰기 확인을 한 번 더 거친다
  row(t('settingsPanel.6bdb31'), () => { c.close(); openAdvanced(scene); }, 0x3a3846);   // 설정 창을 닫고 연다: 뒤에 깔린 버튼과 겹친다고 보고 textfit이 제목을 줄였다
  if (!cashHidden()) row(tt('settingsPanel.d359b2'), async () => {
    const n = restorePurchases(store(), load()) + await restorePlatformPurchases();
    save(); track('purchase_restore_tap', { n }); toast(scene, n ? t('settingsPanel.d97561', { n }) : t('settingsPanel.5fc588'), n ? '#5fdc6a' : '#ffffff');
  });
  // 이펙트 간단히(48차): 큰 베기 호·파편·번쩍임을 줄인다. 클라우드 저장은 준비되기 전까지 보이지 않는다
  const fx = row('', () => { sv.fxLite = !sv.fxLite; save(); track('fx_lite', { on: !!sv.fxLite }); fx.label.setText(tt('settingsPanel.6220d0', { v: sv.fxLite ? tt('settingsPanel.23c83c') : tt('settingsPanel.6f1a98') })); }, 0x3a3846);
  fx.label.setText(tt('settingsPanel.6220d0', { v: sv.fxLite ? tt('settingsPanel.23c83c') : tt('settingsPanel.6f1a98') }));
  if (cloud) {
    const sa = cloudMeta().savedAt, d = sa && new Date(sa), p2 = n => String(n).padStart(2, '0');
    row(sa ? t('settingsPanel.06c848', { v: d.getMonth() + 1, getDate: d.getDate(), p2: p2(d.getHours()), p22: p2(d.getMinutes()) }) : t('settingsPanel.681f97'), () => { track('cloud_open'); openCloud(scene); });
  }
  // 데이터 초기화(11/1): '고급' 창 안에 있어 못 찾았다 — 설정 첫 화면에 두고, 두 번 눌러야 지운다
  let ask = false;
  const wb = row(tt('settingsPanel.wipe'), () => {
    if (!ask) { ask = true; wb.label.setText(tt('settingsPanel.wipeAsk')); wb.label.setColor('#ffd75e'); return; }
    track('data_wipe', { cleared: load().cleared, from: 'settings' }); reset(); location.reload();
  }, 0x5a2a2a);
  // 사운드·진동: 효과음 / 음악 / 진동을 따로 켜고 끈다
  const tg = (x, name, get, set) => {
    const b = button(scene, x, 150, 66, 28, '', () => { set(!get()); save(); b.label.setText(`${name} ${get() ? tt('settingsPanel.8f13d8') : tt('settingsPanel.667709')}`); b.label.setColor(get() ? '#ffffff' : '#7d8f94'); }, { size: 10, color: 0x3a3846 });
    b.label.setText(`${name} ${get() ? tt('settingsPanel.8f13d8') : tt('settingsPanel.667709')}`); b.label.setColor(get() ? '#ffffff' : '#7d8f94'); c.add(b);
  };
  tg(W / 2 - 74, tt('settingsPanel.9c2420'), () => sv.sound !== false, v => { sv.sound = v; setSound(v); track('sound_toggle', { on: v, from: 'settings' }); if (v) { sfx('click'); } });
  // 음악 크기(53차): 보통 -> 작게 -> 끔 순으로 돌린다. musicLvl 없으면 보통(2), 작게 1, 끔은 기존 musicOff
  const mv = () => (sv.musicOff ? 0 : sv.musicLvl === 1 ? 1 : 2);
  const mb = button(scene, W / 2, 150, 66, 28, '', () => {
    const n = (mv() + 2) % 3;   // 2 -> 1 -> 0 -> 2
    sv.musicOff = n === 0; if (n) sv.musicLvl = n; setMusicLevel(n === 1 ? 1 : 2); setMusic(n !== 0); if (n) playBgm('lobby');
    save(); track('music_level', { lv: n }); paint();
  }, { size: 10, color: 0x3a3846 });
  const paint = () => { const n = mv(); mb.label.setText(`${tt('settingsPanel.4e71ce')} ${n === 0 ? tt('settingsPanel.667709') : n === 1 ? tt('settingsPanel.2247a8') : tt('settingsPanel.2179da')}`); mb.label.setColor(n ? '#ffffff' : '#7d8f94'); };
  paint(); c.add(mb);
  tg(W / 2 + 74, tt('settingsPanel.9b37fc'), () => !sv.vibOff, v => { sv.vibOff = !v; setVib(v); if (v) buzz(30); });
  // 문의·이용약관·개인정보처리방침: 주소가 비어 있으면 안내만 띄운다
  const link = (x, name, url) => c.add(button(scene, x, ly, 66, 28, name, () => {
    if (!url) { toast(scene, tt('settingsPanel.f5e710', { name }), '#ffffff'); return; }
    try { window.open(url, '_blank', 'noopener'); } catch { /* 열 수 없으면 무시 */ }
  }, { size: 9, color: 0x3a3846 }));
  link(W / 2 - 74, tt('settingsPanel.0fc1ee'), LINKS.mail ? `mailto:${LINKS.mail}` : '');
  link(W / 2, tt('settingsPanel.3b9e30'), LINKS.terms);
  link(W / 2 + 74, tt('settingsPanel.d629d0'), LINKS.privacy);
  if (tl) c.add(button(scene, W / 2, ly + (cashHidden() ? 36 : 70), 190, 26, `${tl.label} ▶`, () => openFull('settings'), { size: 10, color: 0x2f6b3a }));
  if (!cashHidden()) c.add(scene.add.text(26, ly + 24, tt('settingsPanel.a31e82'), { ...font9(9, '#7d8f94'), wordWrap: { width: W - 60 } }).setLineSpacing(2));
  scrollBody(scene, c, 60 + ph);
}
// 설정 창이 화면보다 길면(짧은 폰·클라우드 칸·체험판 버튼) 어두운 막만 두고 창 전체를 손가락·휠로 위아래로 민다
function scrollBody(scene, c, panelBot) {
  const body = scene.add.container(0, 0);
  c.list.slice(1).forEach(o => { c.remove(o); body.add(o); });
  c.add(body);
  let bot = panelBot;   // 창 바탕(그래픽)은 크기를 못 잰다
  body.list.forEach(o => { try { const b = o.getBounds(); bot = Math.max(bot, b.bottom); } catch { /* 크기를 못 재는 오브젝트 */ } });
  const max = Math.max(0, Math.ceil(bot + 10 - H));
  if (!max) return;
  const cv = scene.game.canvas, gy = e => viewPt(scene, e).y;
  let d = null, off = 0;
  const set = v => { off = Math.max(0, Math.min(max, v)); body.y = -off; };
  const down = e => { d = { y0: gy(e), off0: off, on: false }; };
  const move = e => {
    if (!d) return; const dy = gy(e) - d.y0;
    if (!d.on && Math.abs(dy) < 6) return;
    if (!d.on) { d.on = true; scene.input.enabled = false; }
    set(d.off0 - dy);
  };
  // 끈 자리의 버튼이 눌리지 않게 손 뗀 뒤 몇 프레임 지나 입력을 다시 켠다(Lobby.installScroll과 같다)
  const up = () => { if (d?.on) setTimeout(() => { if (scene.sys.isActive()) scene.input.enabled = true; }, 120); d = null; };
  const wheel = e => set(off + e.deltaY * 0.25);
  cv.addEventListener('wheel', wheel, { passive: true });
  cv.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  c.once('destroy', () => { cv.removeEventListener('wheel', wheel); cv.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); scene.input.enabled = true; });
}
