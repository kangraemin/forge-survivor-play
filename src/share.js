// 공유 보상 두 가지: 자랑하기(하루 한 번 작은 보석)와 친구 초대(친구가 1-3을 깨면 둘 다 보석)
// 화면 파일(Lobby·overlay·settingsPanel)은 이 파일의 함수를 부르기만 한다. 서버는 server/invite-worker
//
// 공식 문서 확인(2026-10-30)
//  공유 링크  https://developers-apps-in-toss.toss.im/documentation/common/growth/share/miniapp-share-link
//             getTossShareLink('intoss://<앱이름>?ref=<코드>', ogImageUrl) -> share({ message: 링크 }). 정식 출시 뒤에만 intoss:// 가 열린다
//  공유 시트  https://developers-apps-in-toss.toss.im/documentation/api-and-sdk-en/common/growth/share/share-message  share({message})
//  기기 식별  getAnonymousKey / getUserKeyForGame -> { type:'HASH', hash } (미지원이면 undefined, 오류면 'ERROR')
//  진입 주소  getSchemeUri() = 처음 들어온 스킴 값(Environment.initialURL). ?ref= 를 여기서 읽는다
//  서버 CORS  https://<앱이름>.web.tossmini.com / https://<앱이름>.private-web.tossmini.com 을 서버가 허용한다
//  Promotion.openContactsInvite 는 deprecated 라 쓰지 않는다
import { SHARE_GEM, SHARE_GEM_FIRST, SHARE_URL, W } from './data.js';
import { load, save } from './save.js';
import { track } from './log.js';
import { font, font9, panel, button, toast, gemIcon } from './ui.js';
import { sfx } from './sfx.js';
import { inviteCodeOf, CODE_RE } from './inviteCode.js';
import { deviceId, peekDeviceId } from './deviceKey.js';
import { t } from './i18n.js';
export { inviteCodeOf, CODE_RE };

// ── 설정 한 곳 ──
export const INVITE_URL = 'https://forge-invite.remin1994.workers.dev';   // 초대 서버(Cloudflare Worker)
export const TOSS_APP_NAME = 'forge-survivor';   // 콘솔 등록 앱 이름(앱 94606). toss/granite.config.ts appName과 같다
export const TOSS_OG_IMAGE = SHARE_URL + 'assets/og.png';   // 공유 미리보기 그림(https 절대 경로)
export const INVITE_GEM = 30;     // 친구 한 명이 1-3을 깰 때 나와 친구가 각각 받는 보석(자랑하기 보석보다 크고 광고 3번쯤)
export const INVITE_CAP = 10;     // 보상을 받는 친구 수 상한(서버도 같다)
export const INVITE_NEED = 3;     // 친구가 깨야 하는 스테이지 수(1-3 = sv.cleared 3)
const TICK_GAP_MS = 15000, DOWN_MS = 5 * 60 * 1000;
let downUntil = 0;

// ── 기기 식별: game/src/deviceKey.js (토스 사용자 키 -> 없으면 저장소 uuid) ──
export { deviceId };
const sdk = () => window.__AIT_SDK || null;
const uuid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9]/g, '');
export const myCode = () => (peekDeviceId() ? inviteCodeOf(peekDeviceId()) : load().inviteCode || '');

// ── 받은 ?ref= : 첫 실행 때 한 번만 저장하고 이후엔 바꾸지 않는다 ──
export function parseRef(text) {
  if (!text) return '';
  for (const t of [String(text), (() => { try { return decodeURIComponent(String(text)); } catch { return ''; } })()]) {
    const m = /[?&"]ref(?:=|"\s*:\s*")([A-Za-z0-9]{8})/.exec(t);
    if (m && CODE_RE.test(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return '';
}
export function captureRef(sv = load()) {
  if (sv.refChecked) return sv.invitedBy || '';
  sv.refChecked = true;
  let ref = parseRef(globalThis.location?.search);
  try { const s = sdk(); ref ||= parseRef(s?.getSchemeUri?.() || s?.Environment?.initialURL); } catch { /* 없음 */ }
  if (ref && ref !== sv.inviteCode) { sv.invitedBy = ref; track('invite_ref', { ref }); }
  save();
  return sv.invitedBy || '';
}

// ── 서버 ──
async function api(path, body) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(INVITE_URL + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal });
    if (r.status >= 500) { downUntil = Date.now() + DOWN_MS; return null; }   // 52차: 서버가 5xx면 5분 쉰다(15초마다 다시 두드려 콘솔에 503이 쌓였다)
    return await r.json();
  } catch { downUntil = Date.now() + DOWN_MS; return null; } finally { clearTimeout(t); }   // 서버가 죽었거나 오프라인이면 조용히 넘어간다. 다음에 다시 시도
}

// ── 공유 ──
// 링크: 토스면 intoss 딥링크(?ref=), 웹이면 SHARE_URL?ref=. 스토어판은 window.forgePlatform.share 에 맡긴다
export async function shareLink(code) {
  const s = sdk();
  if (s?.getTossShareLink) {
    try { return await s.getTossShareLink(`intoss://${TOSS_APP_NAME}?ref=${code}`, TOSS_OG_IMAGE); } catch { /* 웹 링크로 */ }
  }
  return `${SHARE_URL}?ref=${code}`;
}
// 공유 창을 연다. 반환: 열렸나(웹에서 클립보드 복사도 연 것으로 센다)
export async function openShare(scene, text) {
  await deviceId();
  const code = myCode();
  const url = await shareLink(code);
  const fp = window.forgePlatform;
  try {
    if (fp?.share) { await fp.share({ message: `${text}\n${url}`, text, url, code }); return true; }
    const s = sdk();
    if (s?.share) { await s.share({ message: `${text}\n${url}` }); return true; }
    if (navigator.share) { await navigator.share({ title: t('overlay.609ac3'), text, url }); return true; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(scene, t('share.c040b8'), '#9ae0ff');
    return true;
  } catch { return false; }   // 공유 창을 닫았거나 복사가 막힘
}
// 자랑하기: 공유 창이 열리면 하루 한 번 작은 보석. 반환 { ok, gem }
export async function shareBrag(scene, text, kind = 'result') {
  const sv = load();
  const ok = await openShare(scene, text);
  track('share', { ok, kind });
  let gem = 0;
  if (ok && sv.shareDay !== sv.day) { gem = sv.shared ? SHARE_GEM : SHARE_GEM_FIRST; sv.shareDay = sv.day; sv.gem += gem; sv.shared = true; save(); sfx('coin'); }
  return { ok, gem };
}
export const braggable = () => load().shareDay !== load().day;
export const bragGem = () => (load().shared ? SHARE_GEM : SHARE_GEM_FIRST);

// ── 초대 보상: 로비에 들어올 때 부른다 ──
let lastTick = 0, busyTick = false;
export async function lobbyShareTick(scene, force = false) {
  if (window.forgePlatform?.noShare) return;   // 포털판은 초대 서버를 부르지 않는다
  const sv = load();
  if (busyTick || Date.now() < downUntil || (!force && Date.now() - lastTick < TICK_GAP_MS)) return;
  busyTick = true; lastTick = Date.now();
  try {
    const device = await deviceId();
    const code = inviteCodeOf(device);
    if (sv.inviteCode !== code) { sv.inviteCode = code; save(); }
    if (sv.invitedBy === code) { sv.invitedBy = ''; save(); }
    const say = (m, c = '#5fdc6a') => { if (scene.scene?.isActive?.()) { toast(scene, m, c); sfx('coin'); } };
    // 1) 내가 초대받았고 1-3을 깼으면 서버에 알리고 보석
    if (sv.invitedBy && !sv.inviteClaimed && sv.cleared >= INVITE_NEED) {
      const r = await api('/invite/claim', { code: sv.invitedBy, device });
      if (r?.ok) { sv.inviteClaimed = true; sv.gem += INVITE_GEM; save(); track('invite_claim', { counted: !!r.counted }); say(t('share.b31455', { INVITE_GEM })); scene.refreshTop?.(); }
      else if (r && (r.error === 'self' || r.error === 'dup')) { sv.inviteClaimed = true; save(); }   // 다시 해도 안 되는 경우
    }
    // 2) 내가 초대한 친구가 깬 만큼 받는다(받는 중에 끊겨도 같은 키로 다시 확정하면 한 번만 지급)
    const p = await api('/invite/pending?device=' + encodeURIComponent(device));
    if (p?.ok) { sv.inviteTotal = p.total; sv.invitePending = p.count; save(); }
    if (p?.ok && (sv.inviteAck || p.count > 0)) {
      if (!sv.inviteAck) { sv.inviteAck = { key: 'a' + uuid().slice(0, 20), n: p.count }; save(); }
      const a = await api('/invite/ack', { device, key: sv.inviteAck.key, n: sv.inviteAck.n });
      if (a?.ok) {
        sv.inviteAck = null; sv.invitePending = Math.max(0, (sv.invitePending || 0) - a.n);
        if (a.n > 0) { sv.gem += a.n * INVITE_GEM; sv.inviteRewards = (sv.inviteRewards || 0) + a.n; track('invite_reward', { n: a.n }); say(t('share.d232fc', { n: a.n, v: a.n * INVITE_GEM })); scene.refreshTop?.(); }
        save();
      }
    }
  } finally { busyTick = false; }
}

// ── 친구 초대 창(설정에서 연다) ──
export function openInvite(scene) {
  const sv = load(), c = scene.modal();
  c.add(panel(scene, 16, 70, W - 32, 330, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 90, t('settingsPanel.bf6a10'), font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 38, 90, 26, 22, 'X', () => c.close(), { size: 11 }));
  c.add(scene.add.text(W / 2, 118, t('share.fefed2'), font9(10, '#a1b2b6')).setOrigin(0.5));
  const code = scene.add.text(W / 2, 140, myCode() || '- - - -', font(20, '#ffffff')).setOrigin(0.5); c.add(code);
  c.add(scene.add.rectangle(W / 2, 162, W - 70, 1, 0x293845));
  const cnt = scene.add.text(W / 2, 182, '', font(13)).setOrigin(0.5), rew = scene.add.text(W / 2, 206, '', font9(11, '#f2e4bc')).setOrigin(0.5);
  c.add([cnt, rew]);
  const paint = () => {
    const tot = Math.min(INVITE_CAP, sv.inviteTotal || 0), pen = sv.invitePending || 0;
    code.setText(myCode() || '- - - -');
    cnt.setText(t('share.b64196', { tot, INVITE_CAP }));
    rew.setText(pen > 0 ? t('share.ece36a', { v: pen * INVITE_GEM }) : t('share.5c9c09', { v: (sv.inviteRewards || 0) * INVITE_GEM }));
  };
  paint();
  [t('share.e91856'), t('share.011a06'), t('share.b1cc0b', { INVITE_GEM }), t('share.ec481b', { INVITE_CAP })].forEach((t, i) => c.add(scene.add.text(W / 2, 236 + i * 17, t, font9(10, i === 2 ? '#ffd75e' : '#a1b2b6')).setOrigin(0.5)));
  const sb = button(scene, W / 2, 330, 190, 32, t('share.98b489'), async () => {
    const r = await openShare(scene, t('share.6ee53a', { myCode: myCode() }));
    track('invite_share', { ok: r });
  }, { size: 13, color: 0x2f6b3a });
  c.add(sb);
  c.add(gemIcon(scene, W / 2 - 78, 366, 12));
  c.add(scene.add.text(W / 2 - 66, 366, t('share.8cb10b', { INVITE_GEM }), font9(10, '#a1b2b6')).setOrigin(0, 0.5));
  // 열 때 서버에서 최신 숫자를 받아 와 받을 보상을 바로 받는다
  deviceId().then(() => { paint(); return lobbyShareTick(scene, true); }).then(() => { if (scene.scene?.isActive?.()) paint(); });
}
