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
  default: AD_TEST,   // TODO(콘솔): 'forge_rewarded' 그룹 ID로 교체
  // gem: 'TODO', sweep: 'TODO', double: 'TODO', revive: 'TODO',
};
// 결제 상품 SKU = 게임 상품 id 그대로(data.js IAP/BIG_PACKS 의 id, 특가 deal_<꾸러미>_<할인율>, 성장 grow<장>). 콘솔에 이 이름으로 만든다
export const tossSku = itemId => itemId;
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
const pending = async () => (await sdk().IAP.getPendingOrders())?.orders || [];
const complete = orderId => sdk().IAP.completeProductGrant({ params: { orderId } });

// 토스 안일 때만 window.forgePlatform을 채운다(다른 앱판이 먼저 넣어 뒀으면 건드리지 않는다)
export function installToss() {
  const s = sdk();
  if (!s || window.forgePlatform) return false;
  const adOk = !!s.loadFullScreenAd?.isSupported?.() && !!s.showFullScreenAd;
  const iapOk = !!s.IAP?.createOneTimePurchaseOrder && s.IAP.createOneTimePurchaseOrder.isSupported?.() !== false;
  window.forgePlatform = {
    toss: true,
    ...(adOk ? { showAd } : {}),   // 미지원이면 showAd가 없어 shop.js의 웹 체험판으로 떨어진다
    ...(iapOk ? { buy, pending, complete } : {}),
  };
  if (adOk) loadAd(groupOf('default'));
  return true;
}
