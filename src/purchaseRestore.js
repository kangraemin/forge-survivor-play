// 구매 복원(설정의 '구매 복원'). 순수 로직은 여기, 플랫폼 호출은 window.forgePlatform 어댑터(toss.js · store/ 앱 껍데기)가 맡는다
//
// 공식 문서 확인(2026-10-30, apps-in-toss-docs: 인앱 결제 · IAP.getPendingOrders · IAP.getCompletedOrRefundedOrders · 서버 API 이용하기)
//  · 미지급 주문(결제는 됐지만 지급이 끝나지 않음): IAP.getPendingOrders -> 지급 -> IAP.completeProductGrant. 앱 시작 때 shop.js recoverPurchases 가 한다
//  · 이미 지급이 끝난/환불된 주문 내역: IAP.getCompletedOrRefundedOrders (SDK 1.2.2+, 토스앱 5.231.0+, 한 페이지 50개, hasNext/nextKey). status 'COMPLETED' | 'REFUNDED'
//    "미결 주문 복구용이 아니라 이미 완료/환불된 내역을 확인할 때" 쓴다 → 여기서는 앱을 지웠다 다시 깐 사람의 '영구 상품' 복원에 쓴다
//  · 서버 검증: POST /api-partner/v1/apps-in-toss/order/get-order-status 는 mTLS 인증서가 필요하다(인증서 발급 = 콘솔, 사람 손). Worker 자리: server/invite-worker/src/routes/iap.js
//
// 중복 지급을 막는 규칙
//  1) 주문 번호(sv.orders)에 있으면 건너뛴다. 처리한 주문은 모두 여기에 적는다
//  2) 1회 한정 상품(once)은 이미 가졌으면(sv.bought · 구매 ledger) 주지 않는다. 꾸미기 묶음은 구성품을 이미 다 가졌으면 주지 않는다
//  3) 소모품(보석 묶음·특가·월정액·달 1회 꾸러미)은 완료 내역으로 다시 주지 않는다. 이미 한 번 지급한 것이고, 저장이 사라진 경우는 서버 저장이 복구한다.
//     (완료 내역을 소모품까지 다시 주면, 쓴 보석을 앱 재설치로 되돌리는 구멍이 된다)
const isPermanent = item => !!item && !!item.once && !item.month;

// 복원할 주문만 골라 지급한다. 지급한 개수를 돌려준다. 호출한 쪽이 save()를 한다
//  deps.itemBySku(sku) -> 상품 | null,  deps.applyPurchase(sv, item),  deps.ownsAll(sv, item) -> 구성품을 이미 다 가졌나
export function restoreCompleted(sv, orders, deps) {
  let n = 0;
  sv.orders ||= [];
  for (const o of orders || []) {
    if (!o || typeof o.orderId !== 'string' || !o.orderId || (o.status && o.status !== 'COMPLETED')) continue;
    if (sv.orders.includes(o.orderId)) continue;
    const item = deps.itemBySku(o.sku);
    if (!isPermanent(item)) continue;   // 모르는 상품·소모품은 주문 번호도 적지 않는다(나중에 상품 목록이 늘면 다시 볼 수 있게)
    sv.orders.push(o.orderId);
    if (sv.bought?.[item.id] || sv.ledger?.['b:' + item.id] || deps.ownsAll?.(sv, item)) continue;   // 이미 가졌다
    deps.applyPurchase(sv, item);
    sv.paidTotal = (sv.paidTotal || 0) + (item.price || 0);
    n++;
  }
  return n;
}

// 설정의 '구매 복원' 버튼이 부른다. 반환: 되살린 개수
export async function restoreFromPlatform() {
  const P = window.forgePlatform;
  if (!P) return 0;
  const shop = await import('./shop.js');
  let n = await shop.recoverPurchases();             // 미지급 주문
  if (P.restore) n += shop.restoreCompletedOrders(await P.restore());   // 이미 결제된 영구 상품
  return n;
}
