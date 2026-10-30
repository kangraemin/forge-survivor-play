// CrazyGames 어댑터 (SDK v3)
//
// 확인한 공식 문서 (2026-10-30) — https://docs.crazygames.com/
//  SDK 소개   /sdk/intro/   : <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">, await window.CrazyGames.SDK.init(),
//                             localhost·127.0.0.1은 local 환경(광고 대신 안내 오버레이), 다른 주소에서는 ?useLocalSdk=true, environment = local | crazygames | disabled
//  광고       /sdk/video-ads, /requirements/ads/ : SDK.ad.requestAd('midgame' | 'rewarded', { adStarted, adFinished, adError })
//             보상은 adFinished에서만, adError(unfilled 포함)에서는 주지 않고 게임은 이어진다. 소리는 광고가 실제로 시작될 때만 끄고 끝나면 켠다
//             요청 중에는 진행을 막는다(버튼 잠금·스피너). 중간 광고는 SDK가 빈도를 알아서 거른다(약 3분에 1번). 플레이 중·메뉴·상점 버튼에는 금지
//             광고차단: SDK.ad.hasAdblock() — 차단 사용자를 막지 않고, 팝업 말고 안내만. 눌러도 아무 일 없는 보상 버튼을 두지 않는다
//  게임       /sdk/game/       : game.gameplayStart()/gameplayStop(), loadingStart()/loadingStop(), settings.muteAudio(+addSettingsChangeListener)
//  데이터     /sdk/data/       : SDK.data.getItem/setItem/removeItem/clear (localStorage 모양). 제출 때 'Progress Save'를 켜야 동작. 1MB 한도. 꺼져 있으면 dataModuleDisabled
//  요건       /requirements/*  : 인앱결제는 초대제(Xsolla), 앱스토어 링크·다른 플랫폼 홍보 금지, 영어 현지화 필수, 상대 경로만, 최초 다운로드 50MB(모바일 홈 20MB) 이하
import { holdAudio } from '../sfx.js';

let sdk = null, ready = false, adBusy = false, adHold = false, muteSetting = false;
const applyAudio = () => holdAudio(adHold || muteSetting);

// ── 화면: 광고 요청 중 진행을 막는 스피너, 알림 줄(팝업 아님) ──
let blocker = null, note = null;
function dom(css, text) { const e = document.createElement('div'); e.style.cssText = css; e.textContent = text; document.body.appendChild(e); return e; }
function block(on) {
  if (on && !blocker) blocker = dom('position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#ffd75e;font:14px G11,sans-serif', '광고를 불러오는 중…');
  if (!on && blocker) { blocker.remove(); blocker = null; }
}
function notice(msg) {
  note?.remove();
  const n = note = dom('position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:99999;background:#1a1426;color:#f2e4bc;border:1px solid #ffd75e;padding:8px 12px;font:12px G9,sans-serif;max-width:80vw;text-align:center;white-space:pre-line;pointer-events:none', msg);
  setTimeout(() => { if (note === n) { n.remove(); note = null; } }, 3500);
}

// ── 광고 ──
function pauseGame(on) {
  adHold = on; applyAudio();
  try { const g = window.game; if (g?.loop) on ? g.loop.sleep() : g.loop.wake(); } catch { /* 무시 */ }
}
function request(type) {
  return new Promise(res => {
    if (!ready || adBusy) return res(false);
    adBusy = true; block(true);
    let started = false, fin = false, guard = 0;
    const end = ok => {
      if (fin) return; fin = true; clearTimeout(guard);
      if (started) pauseGame(false);
      block(false); adBusy = false; res(ok);
    };
    guard = setTimeout(() => end(false), 90000);   // SDK가 아무 응답이 없어도 화면이 영원히 막히지 않게
    try {
      sdk.ad.requestAd(type, {
        adStarted: () => { started = true; block(false); pauseGame(true); },
        adFinished: () => end(true),
        adError: e => {
          if (type === 'rewarded') notice(e?.code === 'unfilled' ? '지금은 볼 수 있는 광고가 없어요.\n잠시 뒤에 다시 눌러 주세요.' : '광고를 불러오지 못했어요.');
          end(false);
        },
      });
    } catch { end(false); }
  });
}
// 보상형: 끝까지 봤을 때만 true
const showAd = () => request('rewarded');
// 중간 광고: 판과 판 사이에서만 부른다. 결과는 필요 없다(실패해도 게임은 이어진다)
const midgame = () => request('midgame').then(() => {});

// ── 저장소: SDK 데이터 모듈(로그인하면 계정 저장) + localStorage 이중 기록. 모듈이 꺼져 있거나 막히면 localStorage만 ──
function makeStorage() {
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }, del: k => { try { localStorage.removeItem(k); } catch { /* 무시 */ } } };
  let dataOk = true;
  const via = fn => { if (!dataOk) return undefined; try { return fn(sdk.data); } catch (e) { if (e?.code === 'dataModuleDisabled') dataOk = false; return undefined; } };
  return {
    getItem: k => { const v = via(d => d.getItem(k)); return v ?? ls.get(k); },
    setItem: (k, v) => { v = String(v); ls.set(k, v); via(d => d.setItem(k, v)); },
    removeItem: k => { ls.del(k); via(d => d.removeItem(k)); },
  };
}

// ── 게임 상태 → gameplayStart/Stop, loadingStop (장면을 짧게 살펴 바뀔 때만 보낸다) ──
function watch() {
  let playing = false, loaded = false;
  setInterval(() => {
    const g = window.game; if (!g?.scene || !ready) return;
    // 첫 실행 '탭해서 시작' 화면이 뜬 순간도 로딩 끝이다(사람 탭을 기다리는 시간은 로딩이 아니다)
    if (!loaded && (g.scene.isActive('Lobby') || g.scene.isActive('Battle') || g.scene.isActive('Prologue') || g.registry.get('tapGate'))) { loaded = true; try { sdk.game.loadingStop(); } catch { /* 무시 */ } }
    const b = g.scene.getScene('Battle');
    const now = !!(b && g.scene.isActive('Battle') && b.run && !b.over && !b.paused && !b.bot && !b.ui?.open && !adBusy);
    if (now !== playing) { playing = now; try { now ? sdk.game.gameplayStart() : sdk.game.gameplayStop(); } catch { /* 무시 */ } }
  }, 400);
}

export function install() {
  window.forgePlatform = {
    portal: 'crazygames',
    noCash: true,         // 인앱결제는 초대제(Xsolla). 지금은 현금 상품이 없다
    noShare: true,        // 다른 사이트로 데려가는 링크 공유는 금지(외부 홍보 금지 요건)
    noAnalytics: true,    // SDK 이벤트 외 개인 정보 수집 없음
    showAd, midgame,
  };
}

// Phaser를 띄우기 전에 부른다. 실패하면 SDK 없이 게임이 돈다(보상형 광고는 보상을 주지 않고 안내만 한다)
export async function init() {
  sdk = window.CrazyGames?.SDK || null;
  try {
    if (!sdk) throw new Error('sdk missing');
    await sdk.init();
    if (sdk.environment === 'disabled') throw new Error('sdk disabled');
    ready = true;
    try { sdk.game.loadingStart(); } catch { /* 무시 */ }
    window.forgePlatform.storage = makeStorage();
    // 데이터 모듈 연결: 계정 저장이 비어 있고 이 기기에 진행이 있으면 옮겨 쓴다(읽기·쓰기를 첫 화면 전에 한 번 거친다). 기존 localStorage 진행은 그대로 둔다
    try {
      const K = 'forge-survivor-v1', st = window.forgePlatform.storage;
      const remote = sdk.data.getItem(K), local = localStorage.getItem(K);
      if (remote == null && local != null) st.setItem(K, local);
    } catch { /* 무시 */ }
    // 소리: 사이트 설정이 꺼짐이면 게임 안 토글로 켤 수 없다
    try {
      muteSetting = !!sdk.game.settings?.muteAudio; applyAudio();
      sdk.game.addSettingsChangeListener?.(s => { muteSetting = !!s?.muteAudio; applyAudio(); });
    } catch { /* 무시 */ }
    watch();
    Promise.resolve(sdk.ad.hasAdblock?.()).then(b => { window.forgePlatform.adblock = !!b; if (b) setTimeout(() => notice('광고 차단 중이라 광고 보상 버튼이 동작하지 않을 수 있어요.\n게임은 그대로 즐길 수 있어요.'), 3000); }).catch(() => {});
  } catch {
    ready = false;
  }
}
