// 앱인토스(토스 미니앱) 연결: 보상형 광고 + 인앱결제
// 웹판(GitHub Pages)에서는 아무것도 하지 않는다 → shop.js의 웹 체험판 광고·테스트 결제가 그대로 돈다
// 토스 안에서는 번들 입구(toss/entry.js)가 window.__AIT_SDK에 SDK를 넣어 준다 → 여기서 window.forgePlatform을 채운다
//
// 확인한 공식 문서 (2026-10-30)
//  보상형 광고  https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad
//               loadFullScreenAd / showFullScreenAd (+ .isSupported()). 전면/보상형은 광고 그룹 ID로 결정. userEarnedReward 때만 보상
//               테스트 ID: ait-ad-test-rewarded-id
//  인앱결제     https://developers-apps-in-toss.toss.im/guide/monetization/in-app-payment
//               https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/iap/iap.createonetimepurchaseorder
//               IAP.createOneTimePurchaseOrder({options:{sku, processProductGrant}, onEvent, onError}), IAP.getPendingOrders, IAP.completeProductGrant

// ── 설정 한 곳 ──
// 광고 그룹 ID: 콘솔에서 만든 뒤 값을 바꿔 넣는다. 지금은 공식 테스트 ID(개발 중엔 실제 ID로 테스트하면 정책 위반)
// 한 그룹을 모든 종류가 같이 써도 되고, 종류별로 나눠도 된다(없는 종류는 default)
const AD_TEST = 'ait-ad-test-rewarded-id';
export const TOSS_AD_GROUPS = {
  default: 'ait.v2.live.b75ad9f6d7b74cda',   // 콘솔 'forge_rewarded' 보상형 그룹(앱 94606). 개발 중 테스트는 AD_TEST
  // gem: 'TODO', sweep: 'TODO', double: 'TODO', revive: 'TODO',
};
// 결제 상품 SKU = 게임 상품 id 그대로(data.js IAP/BIG_PACKS 의 id, 특가 deal_<꾸러미>_<할인율>, 성장 grow<장>). 콘솔에 이 이름으로 만든다
// 꾸미기 묶음도 동일한 지급/미결 주문 복구 경로를 사용한다. 콘솔 등록 후 실제 SKU로 매핑한다.
// 콘솔 상품 ID는 자동 발급이라 게임 상품 id와 다르다 → 아래 표로 바꾼다(앱 94606, 2026-10-30 등록)
const PID = 'ait.0000094606.';
const PRODUCT_SUFFIX = {
  starter: 'fce88ccd.7d99d30c25.3358577732', cosm: '0f84d69d.31f89a0c62.3358579049', pass: '9c779ffc.23ad6a419b.3358580287', noads: '795abd69.3ed6c9e84c.3358581531',
  gem1: 'feea461e.3c19f67377.3358538965', gem1b: '35435a14.67ff08dad0.3358582844', gem2: '457c23ea.422b9959de.3358584110', gem3: '049fab91.9f98dc979f.3358585294', gem4: 'b4d6f5fa.66f6f4f17b.3358586555',
  mid1: '506418b3.cae797a9bb.3358587788', big1: '5d0dd44d.875677a393.3358589031', big2: '85bdea09.41e0c24fa6.3358590310',
  look_picnic: '0eca77b7.8fd6e65341.3358597157', look_bath: '0af2ec89.c9b5bbaf5c.3358598640', look_snow_trip: 'd933b3cb.3ba886f7b0.3358600330', look_snow_friends: 'bd8334c8.343e47a873.3358601645',
  deal_dstone_30: 'acd0fe9b.d98977752a.3358603103', deal_dstone_40: '1097188c.c8d4f3d87d.3358604315', deal_dstone_50: 'b86a77df.287c6c9e03.3358605525',
  deal_dguard_30: 'e6d2400f.7c3ba62f04.3358607093', deal_dguard_40: 'a262258d.1e733fadb6.3358608300', deal_dguard_50: 'b1e872f5.14762905ce.3358609453',
  deal_dgem_30: 'b13c3c42.785f4f18ba.3358610745', deal_dgem_40: 'b147facd.d7d52bbe51.3358612102', deal_dgem_50: '24ce7704.9d596cf40d.3358613545',
  deal_dgold_30: '1551c10b.e0f70cd0df.3358615154', deal_dgold_40: 'e6f95f2e.13f42a5199.3358616446', deal_dgold_50: '32d83204.ed0a69c033.3358617667',
  deal_dluck_30: '882b4328.a29e7e044d.3358618802', deal_dluck_40: '46d556d1.4835aa0cee.3358620370', deal_dluck_50: 'fc369233.01a13d0ffa.3358621725',
  grow1: 'd060c17d.4c01a9f765.3358627277', grow2: '5ec43166.f9b4a9928c.3358629170', grow3: '1eae7e7b.837c806db8.3358631037', grow4: 'a8963658.6188de1328.3358632933', grow5: '70ee78bd.90b81058b3.3358635047',
  grow6: '09d5e463.2d85ca9548.3358637071', grow7: '92f4d05a.ebe4f7c4fe.3358639086', grow8: '8a3c9ad6.115712595c.3358641041', grow9: 'e757302d.129710db84.3358642888', grow10: '85391c58.3db10d3268.3358644897',
  grow11: 'afbcf4e2.754f523da4.3358646783', grow12: '23303f0a.3f2ce83945.3358648735', grow13: 'efe25b5b.ee08582811.3358650836', grow14: 'f06faad6.ab39471499.3358652828', grow15: '9830768e.c6d1259bb5.3358654845',
};
// gem2b(9,900원)는 판매 중지라 콘솔에 등록하지 않았다
export const TOSS_PRODUCT_IDS = Object.fromEntries(Object.entries(PRODUCT_SUFFIX).map(([id, s]) => [id, PID + s]));
const SKU_TO_GAME = Object.fromEntries(Object.entries(TOSS_PRODUCT_IDS).map(([id, sku]) => [sku, id]));
export const tossSku = itemId => TOSS_PRODUCT_IDS[itemId] || itemId;
export const gameIdOfSku = sku => SKU_TO_GAME[sku] || sku;
export const AD_LOAD_TIMEOUT_MS = 25000;   // AdMob은 로드에 5~20초(최대 60초)

const sdk = () => window.__AIT_SDK || null;
const noop = () => {};

// ── 보상형 광고: load → loaded → show → userEarnedReward → dismissed → (다음 load) ──
const loaded = {}, loading = {};
const groupOf = kind => TOSS_AD_GROUPS[kind] || TOSS_AD_GROUPS.default;

function loadAd(g) {
  if (loaded[g]) return Promise.resolve(true);
  if (loading[g]) return loading[g];
  const p = new Promise(res => {
    let un = noop, fin = false;
    const end = ok => { if (fin) return; fin = true; clearTimeout(t); try { un(); } catch {} res(ok); };
    const t = setTimeout(() => end(false), AD_LOAD_TIMEOUT_MS);
    try {
      un = sdk().loadFullScreenAd({
        options: { adGroupId: g },
        onEvent: e => { if (e?.type === 'loaded') { loaded[g] = true; end(true); } },
        onError: () => end(false),
      }) || noop;
      if (fin) un();
    } catch { end(false); }
  }).finally(() => { delete loading[g]; });
  return loading[g] = p;
}

async function showAd(kind) {
  const g = groupOf(kind);
  if (!await loadAd(g)) return false;
  loaded[g] = false;   // 한 번 보인 광고는 다시 못 보인다
  return new Promise(res => {
    let un = noop, earned = false, fin = false, fb;
    const end = () => { if (fin) return; fin = true; clearTimeout(fb); try { un(); } catch {} loadAd(g); res(earned); };
    try {
      un = sdk().showFullScreenAd({
        options: { adGroupId: g },
        onEvent: e => {
          if (e?.type === 'userEarnedReward') {
            earned = true;
            // 안드로이드 토스앱 5.255.0은 dismissed가 오지 않는다(공식 FAQ) → 보상 뒤 8초가 지나면 마무리
            fb = setTimeout(end, 8000);
          } else if (e?.type === 'dismissed' || e?.type === 'failedToShow') end();
        },
        onError: () => end(),
      }) || noop;
      if (fin) un();
    } catch { end(); }
  });
}

// ── 인앱결제 ──
// grant(orderId)는 shop.js가 넘기는 지급 함수: processProductGrant 안에서 불러 '지급 → 저장'까지 끝낸 뒤에 true를 돌려준다
function buy(id, grant) {
  return new Promise(res => {
    let un = noop, fin = false;
    const end = ok => { if (fin) return; fin = true; try { un(); } catch {} res(ok); };
    try {
      un = sdk().IAP.createOneTimePurchaseOrder({
        options: { sku: tossSku(id), processProductGrant: async ({ orderId }) => { try { return !!(await grant?.(orderId)); } catch { return false; } } },
        onEvent: e => { if (e?.type === 'success') end(true); },
        onError: () => end(false),
      }) || noop;
      if (fin) un();
    } catch { end(false); }
  });
}
// 앱을 켤 때: 결제는 됐는데 지급이 끝나지 못한 주문
const pending = async () => ((await sdk().IAP.getPendingOrders())?.orders || []).map(o => ({ ...o, sku: gameIdOfSku(o.sku) }));
const complete = orderId => sdk().IAP.completeProductGrant({ params: { orderId } });
// 이미 결제가 끝난 주문(구매 복원). IAP.getCompletedOrRefundedOrders: 한 페이지 50개, hasNext/nextKey로 이어 받는다. 환불된 주문은 건너뛴다
// 토스앱이 오래되어 undefined를 주면 빈 목록(공식: 최소 지원 버전 미만이면 undefined)
const restore = async () => {
  const out = []; let key = null;
  for (let i = 0; i < 20; i++) {
    const r = await sdk().IAP.getCompletedOrRefundedOrders(key ? { key } : undefined);
    if (!r) break;
    for (const o of r.orders || []) if (o.status === 'COMPLETED') out.push({ orderId: o.orderId, sku: gameIdOfSku(o.sku), status: o.status });
    if (!r.hasNext || !r.nextKey) break;
    key = r.nextKey;
  }
  return out;
};

// ── 게임 리더보드(토스 친구 랭킹) ──
// 공식: https://developers-apps-in-toss.toss.im/documentation/common/growth/game-center (2026-10-31 확인)
//  submitGameCenterLeaderBoardScore({score: "123"}) 점수는 문자열 숫자. 게임이 끝난 뒤에 부른다. 5.221.0 미만이면 undefined
//  openGameCenterLeaderboard() 리더보드 WebView(친구 추가·점수 공유). 열면 미니앱은 백그라운드로 간다. 5.221.0 미만이면 undefined
//  isMinVersionSupported({android, ios}) 로 버전을 먼저 확인. 콘솔에서 리더보드 정책(점수 단위·정렬)을 먼저 설정해야 한다(없으면 'LeaderBoard not found')
const LB_MIN = { android: '5.221.0', ios: '5.221.0' };
const lbOk = s => { try { return !!s.submitGameCenterLeaderBoardScore && !!s.openGameCenterLeaderboard && !!s.isMinVersionSupported && s.isMinVersionSupported(LB_MIN) === true; } catch { return false; } };
const lbSubmit = async score => {
  try { const r = await sdk().submitGameCenterLeaderBoardScore({ score: String(score | 0) }); return r?.statusCode === 'SUCCESS'; } catch { return false; }
};
const lbOpen = async () => { try { await sdk().openGameCenterLeaderboard(); return true; } catch { return false; } };

// 토스 안일 때만 window.forgePlatform을 채운다(다른 앱판이 먼저 넣어 뒀으면 건드리지 않는다)
export function installToss() {
  const s = sdk();
  if (!s || window.forgePlatform) return false;
  const safe = f => { try { return f(); } catch { return false; } };   // 토스 밖(브라우저)에서는 isSupported가 던진다
  const adOk = safe(() => !!s.loadFullScreenAd?.isSupported?.() && !!s.showFullScreenAd);
  const iapOk = safe(() => !!s.IAP?.createOneTimePurchaseOrder && s.IAP.createOneTimePurchaseOrder.isSupported?.() !== false);
  window.forgePlatform = {
    toss: true,
    ...(lbOk(s) ? { leaderboard: { submit: lbSubmit, open: lbOpen } } : {}),   // 버전 미달·웹·포털에서는 없다 → 버튼도 숨는다
    ...(adOk ? { showAd } : {}),   // 미지원이면 showAd가 없어 shop.js의 웹 체험판으로 떨어진다
    ...(iapOk ? { buy, pending, complete, ...(s.IAP.getCompletedOrRefundedOrders ? { restore } : {}) } : {}),
  };
  if (adOk) loadAd(groupOf('default'));
  return true;
}
