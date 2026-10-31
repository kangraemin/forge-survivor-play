// 테스트 모드(개발·검수용): 원하는 지점을 바로 보려고 켠다. 다른 모듈에 기대지 않는다(저장·로그·랭킹이 이 파일을 먼저 본다)
//  켜는 법: 주소 ?test (끄기 ?test=0) · 설정 창의 버전 글자를 7번 연속 탭 → 확인 창. 한 번 켜면 기기에 기억한다(끄기 버튼도 있다)
//  저장 분리: 테스트 모드는 forge-survivor-test* 칸만 읽고 쓴다. 실제 저장(forge-survivor-v1*)은 쓰지 않는다(복사는 읽기만)
//  끄는 것: 랭킹·리더보드 제출, GA/Firebase 로그, 결제(바로 지급), 광고 보상 서버 기록(바로 지급), 서버 저장·초대
//  포털판(itch·CrazyGames)은 빌드가 window.__FORGE_PORTAL을 넣는다 → 진입을 모두 막는다
export const REAL_KEY = 'forge-survivor-v1';
export const TEST_KEY = 'forge-survivor-test';
const FLAG = 'forge-test-on';

const portalBuild = () => { try { return !!(window.__FORGE_PORTAL || window.forgePlatform?.portal); } catch { return false; } };
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch { return null; } };

// 주인 확인: 입력한 코드의 SHA-256(소문자 hex, 앞뒤 공백 제거)이 이 값과 같아야 켜진다. 원문 코드는 어디에도 두지 않는다
const OWNER_HASH = 'b12422e1a6a963bcddd41db9c6b5181b56d4de967948abb87969e7948e204e0d';
const FAIL = 'forge-test-fail';   // { n, until }: 5번 틀리면 하루 동안 입력 창을 띄우지 않는다
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text).trim()));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const hasCrypto = () => { try { return !!globalThis.crypto?.subtle; } catch { return false; } };

let on = null;
function calc() {
  if (portalBuild()) return false;   // 포털판: 기억된 켜짐도 무시
  let q = ''; try { q = location.search; } catch { /* 주소 없음 */ }
  if (/[?&]test=(0|off|false)(?:&|$)/.test(q)) { ls(FLAG, null); return false; }   // ?test=0: 끄기
  return ls(FLAG) === OWNER_HASH;   // 코드를 맞춘 기기만(기억 값 = 주인 해시). ?test만으로는 켜지지 않는다
}
export const isTest = () => (on ??= calc());
// ?test가 주소에 있는지(코드 입력 창을 띄울 신호)
export const testRequested = () => { try { return /[?&]test(?:=(?!0|off|false)[^&]*)?(?:&|$)/.test(location.search); } catch { return false; } };
export const testAllowed = () => !portalBuild();

// 실제 저장 칸 이름을 테스트 칸 이름으로 바꾼다(forge-survivor-v1.bak1 → forge-survivor-test.bak1)
export const testKey = k => (typeof k === 'string' && k.startsWith(REAL_KEY) ? TEST_KEY + k.slice(REAL_KEY.length) : k);
// 저장소를 감싼다: 저장 모듈이 어떤 칸을 부르든 테스트 칸으로만 간다
export const wrapTestStorage = base => ({
  getItem: k => base.getItem(testKey(k)),
  setItem: (k, v) => base.setItem(testKey(k), v),
  removeItem: k => base.removeItem?.(testKey(k)),
});

// 켜기/끄기. 켠 뒤에는 페이지를 다시 연다(저장소가 다른 칸을 보게)
// copy: 실제 진행도를 읽어 테스트 칸에 복사(읽기만 한다). 빈 칸으로 시작하려면 테스트 칸을 지운다
export function copyRealToTest() {
  const raw = ls(REAL_KEY);
  if (!raw) return false;
  ls(TEST_KEY, raw);
  return true;
}
export function clearTestSave() {
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(TEST_KEY)) localStorage.removeItem(k); } } catch { /* 막힘 */ }
}
export function enableTest({ copy = false, fresh = false } = {}) {
  if (!testAllowed()) return false;
  if (copy) copyRealToTest();
  else if (fresh) clearTestSave();
  ls(FLAG, OWNER_HASH);
  reloadWithoutParam('on');
  return true;
}
export function disableTest() {
  ls(FLAG, null);
  reloadWithoutParam('off');
}
function reloadWithoutParam(mode) {
  try {
    const u = new URL(location.href);
    u.searchParams.delete('test');
    if (mode === 'off') u.searchParams.set('test', '0');   // 켜짐 기억을 막 지웠으니 같은 주소로 돌아가도 꺼진 채 열린다
    location.replace(u.toString());
  } catch { location.reload(); }
}

// ── 문구(ko/en) ──
const KO = {
  title: '테스트 모드', code: '코드', on: '테스트 모드 켜기', off: '테스트 모드 끄기', badge: 'TEST', // i18n-ignore
  askTitle: '테스트 모드를 켤까요?', // i18n-ignore
  askBody: ['테스트용 저장 칸을 따로 씁니다.', '실제 진행도는 건드리지 않습니다.', '랭킹·로그·결제는 모두 꺼집니다.', '설정의 버전 글자를 7번 누르면 다시 열 수 있습니다.'], // i18n-ignore
  askCopy: '내 진행도 복사해서 시작', askNew: '새로 시작', cancel: '취소', // i18n-ignore
  offAsk: '테스트 모드를 끌까요?', offBody: ['실제 진행도로 돌아갑니다.', '테스트 저장은 남겨 둡니다.'], offYes: '끄기', // i18n-ignore
};
const EN = {
  title: 'Test mode', code: 'Code', on: 'Turn on test mode', off: 'Turn off test mode', badge: 'TEST',
  askTitle: 'Turn on test mode?',
  askBody: ['It uses a separate test save slot.', 'Your real progress is never touched.', 'Ranking, logs and payments are all off.', 'Tap the version text in Settings 7 times to open this again.'],
  askCopy: 'Start with a copy of my progress', askNew: 'Start fresh', cancel: 'Cancel',
  offAsk: 'Turn off test mode?', offBody: ['You go back to your real progress.', 'The test save is kept.'], offYes: 'Turn off',
};
// 한국어면 ko, 아니면 en (i18n.js와 같은 순서: 주소 ?lang → 고른 언어 → 기기 언어)
export const isKo = () => {
  try { const q = new URLSearchParams(location.search).get('lang'); if (q) return /^ko/i.test(q); } catch { /* 주소 없음 */ }
  try { const s = localStorage.getItem('forge-survivor-lang'); if (s) return s === 'ko'; } catch { /* 막힘 */ }
  try { const s = JSON.parse(localStorage.getItem(REAL_KEY) || '{}').lang; if (s) return s === 'ko'; } catch { /* 저장 없음 */ }
  try { return /^ko/i.test(navigator.language || 'ko'); } catch { return true; }
};
export const tm = () => (isKo() ? KO : EN);

// ── 설정 창 버전 글자 7번 탭 ──
// 반환: 탭마다 부른다. 7번 연속(각 탭 사이 1.5초 이내)이면 확인 창을 연다
export function makeTapCounter(onTrip, n = 7, gap = 1500) {
  let c = 0, last = 0;
  return () => {
    const now = Date.now();
    c = now - last <= gap ? c + 1 : 1; last = now;
    if (c >= n) { c = 0; onTrip(); }
  };
}

// 확인 창(HTML). 켜는 확인 / 끄는 확인
function dialog(title, lines, buttons) {
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:#000c;z-index:100000;display:flex;align-items:center;justify-content:center;font-family:G9,sans-serif';
  const box = document.createElement('div');
  box.style.cssText = 'width:min(90vw,360px);background:#1a1426;border:2px solid #ffd75e;padding:16px;color:#fff;font-size:14px;line-height:1.6';
  const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'color:#ffd75e;font-size:17px;margin-bottom:8px';
  box.append(h);
  for (const l of lines) { const p = document.createElement('div'); p.textContent = '- ' + l; p.style.cssText = 'color:#cfc6e0'; box.append(p); }
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:12px';
  for (const [label, fn, primary] of buttons) {
    const b = document.createElement('button'); b.textContent = label;
    b.style.cssText = `min-height:48px;border:1px solid #475c66;font:inherit;font-size:15px;color:${primary ? '#111923' : '#fff'};background:${primary ? '#ffb85c' : '#3a3846'}`;
    b.onclick = () => { back.remove(); fn(); };
    row.append(b);
  }
  box.append(row); back.append(box); document.body.append(back);
}
export function askEnableTest() {
  if (!testAllowed() || isTest() || !hasCrypto()) return false;
  let f = {}; try { f = JSON.parse(ls(FAIL) || '{}') || {}; } catch { f = {}; }
  if (f.until && Date.now() < f.until) return false;   // 5번 틀린 기기: 하루 동안 창을 띄우지 않는다
  const m = tm();
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:#000c;z-index:100000;display:flex;align-items:center;justify-content:center;font-family:G9,sans-serif';
  const box = document.createElement('div');
  box.style.cssText = 'width:min(90vw,360px);background:#1a1426;border:2px solid #ffd75e;padding:16px;color:#fff;font-size:14px';
  const inp = document.createElement('input');
  inp.type = 'password'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', m.code);
  inp.style.cssText = 'width:100%;box-sizing:border-box;min-height:48px;font-size:16px;background:#0d0a14;color:#fff;border:1px solid #475c66;padding:0 10px';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
  const mk = (label, fn, primary) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; b.style.cssText = `flex:1;min-height:48px;border:1px solid #475c66;font:inherit;font-size:15px;color:${primary ? '#111923' : '#fff'};background:${primary ? '#ffb85c' : '#3a3846'}`; return b; };
  const close = () => back.remove();
  const submit = async () => {
    const v = inp.value; close();
    let h = ''; try { h = await sha256Hex(v); } catch { return; }
    if (h === OWNER_HASH) {
      ls(FAIL, null);
      dialog(m.askTitle, m.askBody, [
        [m.askCopy, () => enableTest({ copy: true }), true],
        [m.askNew, () => enableTest({ fresh: true }), false],
        [m.cancel, () => {}, false],
      ]);
      return;
    }
    const n = (f.n || 0) + 1;   // 틀림: 아무 안내 없이 닫는다
    ls(FAIL, JSON.stringify(n >= 5 ? { n: 0, until: Date.now() + 86400000 } : { n }));
  };
  row.append(mk(m.cancel, close), mk('OK', submit, true));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  box.append(inp, row); back.append(box); document.body.append(back);
  setTimeout(() => inp.focus(), 50);
  return true;
}
export function askDisableTest() {
  const m = tm();
  dialog(m.offAsk, m.offBody, [[m.offYes, () => disableTest(), true], [m.cancel, () => {}, false]]);
}
