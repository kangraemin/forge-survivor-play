// 저장 핵심(순수 로직): 버전 변환 체인, 백업·복구, 내보내기 코드. 브라우저·Phaser에 기대지 않아 node에서 시험한다(tools/save_test.mjs)
import { SWEEP_DAILY, TIER_AT, markNeed } from './data.js';
import { PET_OLD } from './gear.js';
import { t } from './i18n.js';

export const KEY = 'forge-survivor-v1';
export const BAK = [KEY + '.bak1', KEY + '.bak2'];   // 직전 저장 2개
export const CORRUPT = KEY + '.corrupt';             // 읽지 못한 원본 문자열(지우지 않고 보관)
// 저장 모양 버전. 저장 형식을 바꾸면 SCHEMA를 올리고 STEPS 끝에 한 단계를 더한다(앞 단계는 고치지 않는다)
export const SCHEMA = 9;

export const fresh = () => ({ schemaVersion: SCHEMA,

  gold: 150, stone: 10, guard: 1, charm: 0, sweep: SWEEP_DAILY,
  tier: 0, enh: 0,
  cleared: 0,              // 깬 스테이지 수(0이면 1-1 도전 가능). 챕터c 스테이지s의 번호 = c*3+s
  best: {},                // 스테이지별 최고 기록(초)
  train: {},
  day: '',
  gem: 0,
  bought: {},             // 산 1회 한정 상품
  passLeft: 0,             // 월정액 남은 날
  noAds: false,
  ads: {},                 // 오늘 본 광고 횟수
  mis: {}, misGot: {},     // 오늘 임무 진행·받은 것
  streak: 0, dayN: 0, loginGot: true, // 출석 일수, 마지막 접속 날짜 번호, 오늘 출석 보상 받았나
  tut: {},                 // 처음 하는 사람 안내를 마쳤나
  starterShown: false,
  endBest: 0,              // 무한의 탑 최고 층
  cosmetics: { owned: {}, equip: {}, tried: {} }, // 신규 외형·캐시 펫, 이전 skins/hskins 보존
  skins: {}, skin: '',     // 산 칼빛, 끼고 있는 칼빛
  hskins: {}, hskin: '', cw: {}, books: {}, book: '',   // 산 영웅 스킨·캐시 무기·비급, 낀 것
  stats: { runs: 0, kills: 0, destroyed: 0, playMs: 0, losses: 0 },
  inv: [], eq: {},         // 가진 장비, 부위별로 낀 장비 uid
  wtype: 'sword',          // 든 무기 종류(가진 무기 wOwn·스탯 버전 spV는 load에서 채운다)
  pet: '', pets: {},       // 데려가는 펫, 펫별 레벨
  sp: { str: 0, dex: 0, int: 0, vit: 0 }, spReset: 1, // 찍은 스탯, 초기화권(처음 한 장은 공짜)
  eggs: {}, taps: 0,       // 얻은 숨겨진 템, 대장간 칼 두드린 횟수
  sound: true,
  // 콘텐츠 확장(없던 저장도 이 값으로 채운다)
  hardCleared: 0, hardOn: false, // 어려움 깬 판 수, 전투 탭이 어려움을 보고 있나
  dunN: 0,                 // 오늘 일일 던전 들어간 횟수
  wk: { id: 0, mis: {}, got: {} }, // 이번 주 번호, 주간 도전 진행·받은 것
  dex: { m: {}, s: {} },   // 도감: 몬스터별 처치 수, 얻은 세트
  ach: {}, title: '',      // 받은 업적, 낀 칭호
  // 한정 판매: 오늘의 특가 { day, id, off, got }, 성장 꾸러미 { c, at, shown }
  deal: null, grow: null,
  mark: 0, markN: 0, markGift: 0,   // 도전 증표 수, 오늘 다시 깨서 받은 수(하루 3번까지), 업데이트로 받은 선물 수(로비가 한 번 알리고 0으로)
  modes: { clear: {}, stars: {}, best: {}, mark: {} },    // 모드(지키기·점령·돌파·사냥) 깬 판: 'guard:1' 같은 키 -> 1 · stars: 키 -> 별 비트 마스크(1 깨기·2 시간 안에·4 피해 적게) · best: 키 -> { t 가장 빠른 초, hurt 가장 적은 피해 % }
  // 공유 보상(share.js): 자랑하기 받은 날·받은 적 있나, 내 초대 코드, 나를 초대한 코드(첫 실행에만 저장), 그 코드를 서버에 알렸나,
  // 초대로 받은 보석 수(친구 수), 확정 중인 보상 {key,n}, 서버가 알려 준 초대한 친구 수·받을 수
  shareDay: '', shared: false, inviteCode: '', invitedBy: '', refChecked: false, inviteClaimed: false,
  inviteRewards: 0, inviteAck: null, inviteTotal: 0, invitePending: 0,
  lang: '',                // 고른 언어(빈 값 = 기기 언어로 자동). 7부터
  bagAuto: 'salvage',      // 가방이 꽉 찼을 때 자동 정리: 'salvage'(분해) | 'sell'(판매)
  prologue: 0,             // 첫 실행 프롤로그를 봤나(9부터). 진행 기록이 있는 옛 저장은 변환에서 1로 채운다
  proRelic: 0,             // 프롤로그 보스를 진짜로 잡았나(마왕의 목걸이: 쓰러뜨린 몹이 가끔 우리 편이 됨). 없는 옛 저장은 기본값 0이라 변환 불필요
});

// STEPS[i]: schemaVersion i -> i+1. 각 단계는 값을 지우지 않고 없는 것만 채우거나 옮긴다. 이미 한 변환은 플래그로 다시 하지 않는다
const STEPS = [
  // 0 -> 1: 버전 번호가 없던 시절의 플래그식 변환 전부
  mem => {
    // 장당 6판 → 3판으로 바뀌기 전 저장: 깬 수를 새 번호로 옮긴다(x-1·x-4까지 깼으면 x-1·x-2, 보스를 잡았으면 다음 장)
    // 스탯 총점 식도 바뀌어 찍은 점수가 총점을 넘을 수 있다: 돌려주고 다시 찍게 한다
    if (!mem.st3) { const o = mem.cleared || 0, k = o % 6; mem.cleared = Math.floor(o / 6) * 3 + (k >= 1) + (k >= 4); mem.best = {}; mem.sp = {}; mem.st3 = true; }
    // 무기 7종으로 바뀌기 전 저장: 예전에 깬 만큼 창·도끼를 준다. 스탯 규칙(무기 스탯 1점 +10%)이 바뀌어 찍은 점수를 한 번 돌려준다
    if (!mem.wOwn) { mem.wOwn = { sword: true }; if (mem.cleared >= 3) mem.wOwn.spear = true; if (mem.cleared >= 6) mem.wOwn.axe = true; }
    // 펫이 보스 펫으로 바뀌기 전 저장: 키운 단계와 데려가던 펫을 옮긴다
    if (mem.pets && !mem.petV) { for (const [o, n] of Object.entries(PET_OLD)) if (mem.pets[o]) { mem.pets[n] = Math.max(mem.pets[n] || 0, mem.pets[o]); delete mem.pets[o]; } }
    if (PET_OLD[mem.pet]) mem.pet = PET_OLD[mem.pet];
    mem.petV = 2;
    if (!mem.spV) { mem.sp = { str: 0, dex: 0, int: 0, vit: 0 }; mem.spV = 2; }
    // 캐시 무기를 사면 해금(wOwn)까지 켜던 저장: 산 무기는 cw로만 남겨 보스 무기 보상이 다시 그 칸을 열 수 있게 한다(든 무기는 그대로 든다)
    if (!mem.cwV) { for (const k in mem.cw || {}) if (mem.cw[k] && k !== 'sword' && mem.wOwn) delete mem.wOwn[k]; mem.cwV = 1; }
    // 콘텐츠 확장 전 저장: 묶음 값이 없거나 비면 채운다. 도감 세트는 가방의 장비로 채운다
    mem.stats = { runs: 0, kills: 0, destroyed: 0, playMs: 0, losses: 0, ...mem.stats };
    mem.dex = { m: {}, s: {}, ...mem.dex }; mem.dex.m ||= {}; mem.dex.s ||= {};
    for (const it of mem.inv || []) if (it.set) mem.dex.s[it.set] = 1;
    mem.ach ||= {};
    if (!mem.wk?.mis) mem.wk = { id: 0, mis: {}, got: {} };
    mem.stats.maxEnh = Math.max(mem.stats.maxEnh || 0, mem.enh || 0);
  },
  // 1 -> 2: 구매 기록 사본. 저장이 날아가도 복원 함수(restorePurchases)가 되살릴 수 있게 따로 쌓는다
  mem => { mem.cosmetics = { owned: {}, equip: {}, tried: {}, ...mem.cosmetics }; mem.ledger ||= {}; collectLedger(mem); },
  // 2 -> 3: 모드 진행 칸. 없던 저장은 빈 칸으로 채운다(본편 진행은 건드리지 않는다)
  mem => { mem.modes = { ...mem.modes }; if (!mem.modes.clear || typeof mem.modes.clear !== 'object') mem.modes.clear = {}; },
  // 3 -> 4: 공유 보상 필드. 이미 하던 사람은 '처음 들어온 친구'가 아니라서 초대 링크(?ref=)를 받지 않는다(refChecked)
  mem => {
    mem.shareDay ||= ''; mem.shared = !!(mem.shared || mem.shareDay);
    mem.inviteCode ||= ''; mem.invitedBy ||= ''; mem.inviteClaimed = !!mem.inviteClaimed;
    mem.refChecked = !!(mem.refChecked || mem.cleared > 0 || mem.stats?.runs > 0);
    mem.inviteRewards |= 0; mem.inviteTotal |= 0; mem.invitePending |= 0; mem.inviteAck ??= null;
  },
  // 4 -> 5: 장비 잠금(it.lock)과 자동 정리 방식. 장비는 하나도 지우지 않고 없는 값만 채운다
  mem => {
    if (mem.bagAuto !== 'sell') mem.bagAuto = 'salvage';
    if (Array.isArray(mem.inv)) for (const it of mem.inv) if (it && typeof it === 'object' && it.lock !== undefined) it.lock = it.lock ? 1 : 0;
  },
  // 5 -> 6: 모드 별 3개. 이미 깬 판은 별 1개(깨기)로 옮긴다. 기록(best)은 빈 칸. 깬 기록·보상은 그대로
  mem => {
    mem.modes = { ...mem.modes };
    const m = mem.modes;
    if (!m.clear || typeof m.clear !== 'object') m.clear = {};
    if (!m.stars || typeof m.stars !== 'object' || Array.isArray(m.stars)) m.stars = {};
    if (!m.best || typeof m.best !== 'object' || Array.isArray(m.best)) m.best = {};
    for (const k of Object.keys(m.clear)) if (m.clear[k]) m.stars[k] = (m.stars[k] | 0) | 1;
  },
  // 6 -> 7: 다국어. 언어 설정 칸을 만들고, 한글 글자로 저장돼 있던 칭호를 업적 id로 바꾼다(언어를 바꿔도 같은 칭호가 보이게)
  mem => {
    mem.lang ||= '';
    const T = { '학살자': 'kill2', '강화 장인': 'enh15', '전설의 대장장이': 'enh20', '마왕 사냥꾼': 'demon', '심연의 방랑자': 'ch10', '원초의 대장장이': 'ch15', '지옥의 정복자': 'hard5', '탑의 주인': 'tower25', '대장간 식구': 'day30', '박물관장': 'dexAll', '시간의 대장장이': 'ch18', '수호자': 'mode_guard', '정복자': 'mode_capture', '돌파자': 'mode_breach', '추적자': 'mode_hunt' };   // i18n-ignore: 옛 저장의 칭호 글자
    if (typeof mem.title === 'string' && T[mem.title]) mem.title = T[mem.title];
    else if (typeof mem.title === 'string' && /[가-힣]/.test(mem.title)) mem.title = '';
  },
  // 7 -> 8: 도전 증표(54차). 이미 깬 도전 단계마다 증표를 소급해 주고(modes.mark로 '받음' 표시), 깬 장에 비해 못 올린 승급 몫이 있으면 그만큼은 채워 준다(업데이트로 갑자기 막히지 않게)
  mem => {
    mem.mark = Math.max(0, mem.mark | 0); mem.markN = Math.max(0, mem.markN | 0); mem.markGift = Math.max(0, mem.markGift | 0);
    mem.modes = { ...mem.modes };
    const m = mem.modes;
    if (!m.clear || typeof m.clear !== 'object' || Array.isArray(m.clear)) m.clear = {};
    if (!m.mark || typeof m.mark !== 'object' || Array.isArray(m.mark)) m.mark = {};
    let n = 0;
    for (const k of Object.keys(m.clear)) if (m.clear[k] && !m.mark[k]) { m.mark[k] = 1; n++; }
    let back = 0;
    for (let tr = (mem.tier | 0) + 1; tr < TIER_AT.length && (mem.cleared | 0) >= TIER_AT[tr]; tr++) back += markNeed(tr);
    const gift = Math.max(n, back);
    mem.mark += gift; mem.markGift += gift;
  },
  // 8 -> 9: 첫 실행 프롤로그 본 표시. 이미 진행한 저장(깬 판·한 판·장비·강화 중 하나라도)은 프롤로그를 건너뛰도록 1로 채운다. 그 밖의 값은 건드리지 않는다
  mem => {
    const played = (mem.cleared | 0) > 0 || (mem.stats?.runs | 0) > 0 || (mem.hardCleared | 0) > 0 || (mem.enh | 0) > 0 || (mem.tier | 0) > 0 || (Array.isArray(mem.inv) && mem.inv.length > 0);
    mem.prologue = (mem.prologue | 0) || (played ? 1 : 0);
  },
];
export class SaveError extends Error {}

// 읽은 값을 현재 모양으로 변환. 모르는 필드는 그대로 둔다. 실패하면 SaveError
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new SaveError(t('saveCore.560504'));
  const from = Number.isInteger(raw.schemaVersion) && raw.schemaVersion >= 0 ? raw.schemaVersion : 0;
  const mem = { ...fresh(), ...raw };
  if (from > SCHEMA) return mem;   // 더 새 앱이 쓴 저장: 건드리지 않고 그대로 쓴다(schemaVersion도 낮추지 않는다)
  try {
    for (let v = from; v < SCHEMA; v++) STEPS[v](mem);
  } catch (e) { throw new SaveError(t('saveCore.4772ec', { from, v: e?.message || e })); }
  mem.schemaVersion = SCHEMA;
  return mem;
}

const parse = s => { const o = JSON.parse(s); return migrate(o); };
const get = (st, k) => { try { return st.getItem(k); } catch { return null; } };
const put = (st, k, v) => { try { st.setItem(k, v); return true; } catch { return false; } };

// 저장 읽기. 반환 { data, source: 'main'|'bak1'|'bak2'|'new', lostRaw }
// 읽기·변환이 실패하면 새로 시작하지 않고 백업 -> 그래도 안 되면 원본을 CORRUPT 칸에 둔 뒤 새로 시작
export function readSave(st) {
  const mainRaw = get(st, KEY);
  if (mainRaw != null) {
    try { return { data: parse(mainRaw), source: 'main', lostRaw: false }; } catch { /* 백업으로 */ }
  }
  for (let i = 0; i < BAK.length; i++) {
    const b = get(st, BAK[i]);
    if (b == null) continue;
    try {
      const data = parse(b);
      if (mainRaw != null) put(st, CORRUPT, mainRaw);
      return { data, source: 'bak' + (i + 1), lostRaw: mainRaw != null };
    } catch { /* 다음 백업 */ }
  }
  if (mainRaw != null) { put(st, CORRUPT, mainRaw); return { data: fresh(), source: 'new', lostRaw: true }; }
  return { data: fresh(), source: 'new', lostRaw: false };
}

// 저장 쓰기. 직렬화 -> 다시 읽어 검증 -> 직전 저장을 백업으로 -> 쓰기 -> 읽어서 확인. 성공 true
export function writeSave(st, mem) {
  let s;
  try {
    s = JSON.stringify(mem);
    const back = JSON.parse(s);
    if (!back || typeof back !== 'object' || JSON.stringify(back) !== s) return false;
  } catch { return false; }
  const cur = get(st, KEY);
  if (cur != null && cur !== s) {
    let ok = false; try { JSON.parse(cur); ok = true; } catch { /* 깨진 저장은 백업으로 밀지 않는다 */ }
    if (ok && cur !== get(st, BAK[0])) {
      const b1 = get(st, BAK[0]);
      if (b1 != null) put(st, BAK[1], b1);
      put(st, BAK[0], cur);
    }
  }
  return put(st, KEY, s) && get(st, KEY) === s;
}

// ── 내보내기/가져오기 코드: FS1.<base64url 저장>.<체크섬 8자리> ──
const sum = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = t => decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))));
export function exportCode(mem) { const j = JSON.stringify(mem); const p = b64(j); return `FS1.${p}.${sum(p)}`; }
export function importCode(code) {
  const m = /^FS1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(String(code).replace(/\s+/g, ''));
  if (!m) throw new SaveError(t('saveCore.d84e80'));
  if (sum(m[1]) !== m[2]) throw new SaveError(t('saveCore.e4686c'));
  let o; try { o = JSON.parse(unb64(m[1])); } catch { throw new SaveError(t('saveCore.cfbfd4')); }
  return migrate(o);
}
// 코드의 재화가 지금 저장보다 크게 줄어드는지 보여 주는 요약(가져오기 확인 화면용)
export const brief = d => ({ gold: d.gold | 0, gem: d.gem | 0, stone: d.stone | 0, enh: d.enh | 0, cleared: d.cleared | 0 });

// ── 구매 기록(저장과 분리) ──
// 산 것은 저장(bought·cosmetics.owned·skins·hskins·cw·books)과 별도 칸(LEDGER)에 같이 적어 둔다. 저장이 사라져도 복원 함수가 되살린다
// 결제 영수증 자체는 플랫폼(앱인토스 getPendingOrders·플레이/앱스토어 복원)이 진실이고, 이 기록은 그 앞의 안전판이다
export const LEDGER = KEY + '.ledger';
const LEDGER_MAPS = { b: m => m.bought, c: m => m.cosmetics?.owned, s: m => m.skins, h: m => m.hskins, w: m => m.cw, k: m => m.books };
const LEDGER_SET = { b: m => (m.bought ||= {}), c: m => ((m.cosmetics ||= { owned: {}, equip: {}, tried: {} }).owned ||= {}), s: m => (m.skins ||= {}), h: m => (m.hskins ||= {}), w: m => (m.cw ||= {}), k: m => (m.books ||= {}) };
// mem.ledger에 없는 산 것을 적는다. 새로 적은 개수
export function collectLedger(mem, now = Date.now()) {
  mem.ledger ||= {}; let n = 0;
  for (const t in LEDGER_MAPS) for (const id in LEDGER_MAPS[t](mem) || {}) if (LEDGER_MAPS[t](mem)[id]) { const k = t + ':' + id; if (!mem.ledger[k]) { mem.ledger[k] = { at: now }; n++; } }
  return n;
}
// 저장 + 별도 칸에 구매 기록을 맞춘다(save()가 부른다)
export function syncLedger(st, mem) {
  collectLedger(mem);
  let sep = {}; try { sep = JSON.parse(get(st, LEDGER) || '{}') || {}; } catch { sep = {}; }
  if (Object.keys(mem.ledger).every(k => sep[k])) return;   // 이미 맞춰져 있다
  put(st, LEDGER, JSON.stringify({ ...sep, ...mem.ledger }));
}
// 저장에 빠진 구매를 기록(저장 안 기록·별도 칸)에서 되살린다. 되살린 개수
export function restorePurchases(st, mem) {
  let sep = {}; try { sep = JSON.parse(get(st, LEDGER) || '{}') || {}; } catch { sep = {}; }
  const all = { ...sep, ...(mem.ledger || {}) }; let n = 0;
  for (const k in all) {
    const t = k[0], id = k.slice(2), set = LEDGER_SET[t]; if (!set || k[1] !== ':') continue;
    const o = set(mem); if (!o[id]) { o[id] = 1; n++; }
  }
  mem.ledger = { ...all };
  return n;
}
