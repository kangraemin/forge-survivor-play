// 과금: 결제·광고는 플랫폼마다 다르니 여기 한 곳에서 갈아 끼운다
// 웹판: 광고는 체험용 카운트다운, 결제는 열리지 않는다(?devpay를 붙이면 테스트 결제)
// 앱판(구글플레이·앱인토스)에서는 window.forgePlatform = { buy(id, grant), showAd(kind), pending(), complete(orderId), haptic(ms) } 를 넣어 진짜 SDK로 잇는다
// 앱인토스는 toss.js가 넣는다(설정·API 이름은 거기와 docs/release/toss-sdk.md)
import { track, logUser } from './log.js';
import * as D from './data.js';
import { save, load } from './save.js';
import { HERO_SKINS } from './gear.js';
import { sfx } from './sfx.js';
import { font, font9, panel, button, fixedContainer } from './ui.js';
import { COS_PACKS, cosmetic, wardrobe } from './cosmetics.js';
import { installToss } from './toss.js';
import { restoreCompleted } from './purchaseRestore.js';
import { cashHidden } from './platform/flags.js';
import { isTest } from './testMode.js';
import { t, tt, lang } from './i18n.js';

// 토스 미니앱 안이면 window.forgePlatform을 채운다(웹에서는 아무 일도 안 한다)
installToss();

const W = 270, H = D.H;
const devpay = () => { try { return new URLSearchParams(location.search).has('devpay'); } catch { return false; } };
// 가격 표시는 전부 여기서 한다. 한국·앱인토스는 원화 그대로, 네이티브(플레이·앱스토어)는 스토어가 준 현지화 가격 문자열
// (Play Billing formattedPrice / StoreKit displayPrice)을 window.forgePlatform.prices[상품id]로 받아 쓰고, 없으면 원화로 대신한다.
// 보석 개수·보상은 나라와 무관하게 같다. 웹 해외 접속은 결제를 열지 않으므로 '앱에서 구매' 안내만 보인다.
export const webForeign = () => lang !== 'ko' && !window.forgePlatform?.buy && !devpay();
const krwOf = id => { const f = D.IAP.find(x => x.id === id) || COS_PACKS.find(x => x.id === id); return f?.price; };
// 스토어 앱이 같은 기준 원화 가격의 현지 문자열(forgePlatform.priceText)을 주면 그대로 쓰고, 없으면 원화
const wonText = n => { try { const p = window.forgePlatform?.priceText?.(n); if (p) return p; } catch { /* 어댑터 오류는 무시 */ } return t('shop.9d2fd6', { toLocaleString: n.toLocaleString('ko-KR') }); };
export const won = wonText;
// 55차: 초보 꾸러미 '가치 N배'는 근거를 같은 줄에 적는다 — 구성품을 상시 판매가(보석 상점·꾸미기 보석값, 보석 1개=10원)로 환산한 합계. 상시 판매가가 없는 금화는 합계에서 뺀다(보수적)
export function starterValue(it) {
  const unit = {}; D.GEM_SHOP.forEach(g => { const [k, v] = Object.entries(g.give)[0]; unit[k] = g.cost / v; });
  let gem = 0;
  for (const [k, v] of Object.entries(it.give)) {
    if (k === 'gem') gem += v;
    else if (k === 'hskin') gem += HERO_SKINS.find(h => h.id === v)?.cost || 0;
    else if (unit[k]) gem += unit[k] * v;
  }
  const krw = Math.round(gem * 10 / 100) * 100;
  return { krw, x: Math.floor(krw * 10 / it.price) / 10 };
}
// 상품 이름표: 초보 꾸러미는 계산한 근거를 붙이고, 나머지는 data.js의 tag 그대로
export const iapTag = it => { if (it.id !== 'starter') return it.tag; const v = starterValue(it); return v.x >= 2 ? t('shop.starterTag', { won: wonText(v.krw), x: v.x }) : it.tag; };
// 스토어 문자열(예: "$4.99", "R$ 29,90", "1.200 ₫")의 숫자만 비율로 바꿔 같은 모양으로 돌려준다(정가·할인 표시용)
function scaleStore(str, ratio) {
  const m = str.match(/\d[\d.,\s\u00a0]*\d|\d/);
  if (!m) return str;
  const raw = m[0].replace(/[\s\u00a0]/g, ''), last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  const frac = last >= 0 && raw.length - last - 1 <= 2 ? raw.length - last - 1 : 0, dec = frac ? raw[last] : '', grp = dec === ',' ? '.' : ',';
  const num = parseFloat(raw.replace(/[.,]/g, (c, i) => (frac && i === last ? '.' : '')));
  if (!isFinite(num)) return str;
  const v = (num * ratio).toFixed(frac), [ip, fp] = v.split('.');
  const out = ip.replace(/\B(?=(\d{3})+(?!\d))/g, grp) + (fp ? dec + fp : '');
  return str.replace(m[0], out);
}
// priceLabel(상품 또는 id, 원화 금액?): 금액을 생략하면 그 상품의 가격, 주면 같은 상품 기준 비율로 환산한 값(정가 등)
export function priceLabel(item, krw) {
  const id = typeof item === 'string' ? item : item?.id, own = typeof item === 'object' && item ? item.price : krwOf(id);
  if (webForeign()) return krw == null ? t('shop.appBuy') : '';
  const native = window.forgePlatform?.prices?.[id];
  const amount = krw ?? own;
  if (typeof native === 'string' && native && own > 0) return amount === own ? native : scaleStore(native, amount / own);
  return wonText(amount);
}

// 보상 지급. goldStage는 지금 도전 중인 스테이지 클리어 금화의 배수
// 지금 도전 중인 판(어려움을 시작했으면 어려움 판)의 클리어 금화
const stageGold = sv => D.dunBase(sv).gold;
export function grant(sv, give) {
  for (const [k, v] of Object.entries(give)) {
    if (k === 'cosmetics') { for (const id of v) if (cosmetic(id)) wardrobe(sv).owned[id] = true; }
    else if (k === 'goldStage') sv.gold += Math.round(stageGold(sv) * v);
    else if (k === 'skin') (sv.skins ||= {})[v] = true;
    else if (k === 'hskin') (sv.hskins ||= {})[v] = true;
    else sv[k] = (sv[k] || 0) + v;
  }
  save();
}
// sv를 넘기면 goldStage를 '금화 ×2' 대신 실제 받을 금화로 보여 준다
export const giveText = (give, sv) => Object.entries(give).map(([k, v]) => ({
  cosmetics: Array.isArray(v) ? v.map(id => cosmetic(id)?.name).join(' · ') : '',
  gem: t('shop.f6c4dc', { v }), gold: t('shop.4f71b1', { toLocaleString: v.toLocaleString() }), stone: t('shop.4645d8', { v }), guard: t('shop.6973ab', { v }), charm: t('shop.84de1f', { v }), sweep: t('shop.2b5fc9', { v }), spReset: t('shop.d5481f', { v }), goldStage: sv ? t('shop.4f71b1', { toLocaleString: Math.round(stageGold(sv) * v).toLocaleString() }) : t('shop.ff5167', { v }), skin: D.SKINS.find(x => x.id === v)?.name, hskin: t('shop.c71455', { v: HERO_SKINS.find(x => x.id === v)?.name }),
}[k])).join(' · ');

export const firstX2 = (sv, item) => D.FIRST_BUY_X2.includes(item.id) && !sv.bought[item.id];
// 처음 7일(day0부터)은 early 횟수를 쓴다
export const adsDaily = (sv, kind) => D.ADS[kind].early && sv.dayN - (sv.day0 ?? sv.dayN) < 7 ? D.ADS[kind].early : D.ADS[kind].daily;
export const adsLeft = (sv, kind) => adsDaily(sv, kind) - (sv.ads[kind] || 0);

// ── 한정 판매 ──
// 날짜는 그때그때 기기 시계로 본다(저장의 day는 앱을 다시 열 때만 바뀐다: 켜 둔 채 자정을 넘겨도 특가가 바뀌게)
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;
// 46차: 특가는 KST 날짜로 정한다(기기 시간대·클라이언트 랜덤과 무관하게 같은 날 같은 특가)
const KST = 9 * 3600000, DAY = 86400000;
export const kstDay = (now = Date.now()) => Math.floor((now + KST) / DAY);
export const msToMidnight = (now = Date.now()) => DAY - ((now + KST) % DAY);
export const leftText = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':'); };
export const dealOf = (n = kstDay()) => ({ id: D.DEALS[n % D.DEALS.length].id, off: D.DEAL_OFF[Math.floor(n / D.DEALS.length) % D.DEAL_OFF.length] });
// 오늘의 특가: KST 날짜 번호로 꾸러미·할인율이 정해진다. 산 날은 got
export function todayDeal(sv) {
  const n = kstDay(), day = String(n);
  if (sv.deal?.day !== day) { sv.deal = { day, ...dealOf(n) }; save(); track('deal_roll', { id: sv.deal.id, off: sv.deal.off }); }
  const d = D.DEALS.find(x => x.id === sv.deal.id) || D.DEALS[0];
  // 결제 상품 id는 꾸러미·할인율마다 따로(앱 스토어에 가격별로 등록)
  return { ...d, id: `deal_${d.id}_${sv.deal.off}`, base: D.dealRegular(d), off: sv.deal.off, price: D.dealPrice(d, sv.deal.off), got: !!sv.deal.got, onBuy: sv => { sv.deal.got = true; } };
}
// 성장 꾸러미: 장 보스 첫 처치 뒤 24시간, 장마다 한 번
export const growLeft = sv => sv.grow ? sv.grow.at + D.GROW.ms - Date.now() : 0;
export function growOffer(sv) {
  if (growLeft(sv) <= 0) return null;
  const c = sv.grow.c, id = `grow${c + 1}`;
  if (sv.bought[id]) return null;
  return { id, name: t('shop.e0be96', { v: c + 1 }), price: D.GROW.price[Math.min(c, D.GROW.price.length - 1)], once: true, c, give: D.growGive(c) };
}
// 큰 꾸러미는 달마다 한 번
export const soldOut = (sv, item) => item.month ? sv.bought[item.id] === monthKey() : !!(item.once && sv.bought[item.id]);

// 화면 위에 뜨는 작은 창(장면이 무엇이든 맨 위)
function modal(scene) {
  const c = fixedContainer(scene).setDepth(3000);
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive());
  return c;
}

// 보상형 광고. 끝까지 보면 true. 광고 제거를 샀으면 바로 true
function showAdRaw(scene, sv, kind) {
  return new Promise(res => {
    if (sv.noAds || isTest()) return res(true);   // 테스트 모드: 광고 없이 바로 보상(광고 SDK·서버 기록 없음)
    if (window.forgePlatform?.showAd) return window.forgePlatform.showAd(kind).then(res, () => res(false));
    // 웹 체험판: 3초 카운트다운
    const c = modal(scene);
    c.add(panel(scene, 30, 170, W - 60, 130, { fill: 0x101018 }));
    c.add(scene.add.text(W / 2, 196, tt('shop.eb1892'), font(14, '#ffd75e')).setOrigin(0.5));
    c.add(scene.add.text(W / 2, 218, tt('shop.47ce21'), font9(10, '#a1b2b6')).setOrigin(0.5));
    const t = scene.add.text(W / 2, 250, '3', font(22)).setOrigin(0.5); c.add(t);
    let n = 3;
    const tick = () => {
      n--;
      if (n > 0) { t.setText(String(n)); setTimeout(tick, 1000); return; }
      c.destroy(); res(true);
    };
    // 전투가 멈춰 있어도 돌게 브라우저 타이머를 쓴다
    setTimeout(tick, 1000);
  });
}

// 상품 지급(결제 성공 뒤 한 번). 앱결제는 SDK의 processProductGrant 안에서 부르고, 웹은 결제 창이 닫힐 때 부른다
export function applyPurchase(sv, item) {
  if (item.once) sv.bought[item.id] = true;
  if (item.month) sv.bought[item.id] = monthKey();
  item.onBuy?.(sv);
  if (item.passDays) sv.passLeft = (sv.passLeft || 0) + item.passDays;
  if (item.noAds) sv.noAds = true;
  // 보석 묶음 첫 구매는 보석 2배
  const x2 = firstX2(sv, item);
  if (D.FIRST_BUY_X2.includes(item.id)) sv.bought[item.id] = true;
  grant(sv, x2 ? { ...item.give, gem: item.give.gem * 2 } : item.give);
}

// 결제. 성공하면 상품을 지급하고 true
function buyRaw(scene, sv, item) {
  if (item.stop || (cashHidden() && !isTest())) return Promise.resolve({ ok: false, granted: false });   // 판매 중지 상품(49차) · 포털판은 현금 결제 없음
  return new Promise(res => {
    let applied = false, granted = false;
    const apply = orderId => {
      if (applied) return;
      applied = true;
      if (orderId && sv.orders?.includes(orderId)) return;
      if (orderId) (sv.orders ||= []).push(orderId);   // 같은 주문을 복구 때 두 번 주지 않게
      applyPurchase(sv, item);
      granted = true;
      sv.paidTotal = (sv.paidTotal || 0) + item.price;
      save(); // SDK 지급 성공 응답 전에 소유권·주문·집계를 함께 저장
    };
    const done = ok => {
      if (ok) { apply(); sfx('win'); }
      res({ ok, granted });
    };
    if (isTest()) { done(true); return; }   // 테스트 모드: 결제 없이 바로 지급(스토어·토스 결제 호출 없음)
    // 앱: 지급을 SDK 지급 콜백 안에서 끝낸다(지급 뒤 true를 돌려줘야 주문이 완료로 닫힌다)
    if (window.forgePlatform?.buy) return window.forgePlatform.buy(item.id, orderId => { apply(orderId); return true; }).then(done, () => done(false));
    const c = modal(scene);
    c.add(panel(scene, 24, 160, W - 48, 160, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(scene.add.text(W / 2, 186, item.name, font(13, '#ffd75e')).setOrigin(0.5));
    c.add(scene.add.text(W / 2, 210, (item.month ? item.desc + (item.give.skin ? ` · ${D.SKINS.find(x => x.id === item.give.skin)?.name}` : '') : giveText(item.give, sv)) + (item.passDays ? t('shop.89c181', { passDays: item.passDays }) : ''), { ...font9(10, '#f2e4bc'), wordWrap: { width: W - 70 }, align: 'center' }).setOrigin(0.5, 0));
    if (!devpay()) {
      c.add(scene.add.text(W / 2, 248, t('shop.4606e5'), { ...font9(10, '#ff9a8a'), align: 'center' }).setOrigin(0.5));
      c.add(button(scene, W / 2, 292, 120, 28, t('cosmeticShop.94b7db'), () => { c.destroy(); done(false); }));
      return;
    }
    c.add(scene.add.text(W / 2, 248, t('shop.dc3091', { won: wonText(item.price) }), font(11)).setOrigin(0.5));
    c.add(button(scene, 85, 292, 100, 28, t('shop.19b2d1'), () => { c.destroy(); done(false); }));
    c.add(button(scene, 190, 292, 100, 28, t('shop.989a7a'), () => { c.destroy(); done(true); }, { color: 0x2f6b3a }));
  });
}

// 광고·결제는 요청과 결과를 모두 남긴다(어디서 눌렀는지·끝까지 봤는지·결제했는지)
export function showAd(scene, sv, kind) {
  const t0 = Date.now();
  track('ad_request', { kind, no_ads: !!sv.noAds, scene: scene.scene.key });
  return showAdRaw(scene, sv, kind).then(ok => { track('ad_result', { kind, ok, sec: Math.round((Date.now() - t0) / 1000) }); return ok; });
}
export function buy(scene, sv, item) {
  if (COS_PACKS.some(p => p.id === item.id) && item.give.cosmetics.some(id => wardrobe(sv).owned[id])) return Promise.resolve(false);
  const t0 = Date.now(), first = !sv.paidTotal;
  track('iap_click', { item: item.id, price: item.price, scene: scene.scene.key, first_purchase: first, gem: sv.gem, cleared: sv.cleared, platform: window.forgePlatform?.buy ? 'app' : devpay() ? 'devpay' : 'web' });
  track('begin_checkout', { currency: 'KRW', value: item.price, item_id: item.id });
  return buyRaw(scene, sv, item).then(({ ok, granted }) => {
    const sec = Math.round((Date.now() - t0) / 1000);
    track(ok ? 'iap_success' : 'iap_cancel', { item: item.id, price: item.price, sec, first_purchase: first });
    if (granted) {
      track('purchase', { currency: 'KRW', value: item.price, transaction_id: `${item.id}-${Date.now()}`, item_id: item.id, first_purchase: first });
      logUser({ payer: true, paid_total: sv.paidTotal });
    }
    return ok;
  });
}

// 결제는 됐는데 지급이 끝나지 못한 주문을 앱을 켠 뒤 한 번 되살린다(앱판 전용)
// 상품 id → 상품: 일반(IAP·큰 꾸러미) / 특가 deal_<꾸러미>_<할인율> / 성장 grow<장>
export function itemBySku(sku) {
  const f = [...D.IAP, ...D.BIG_PACKS, ...COS_PACKS].find(x => x.id === sku);
  if (f) return f;
  const m = /^deal_(.+)_(\d+)$/.exec(sku), d = m && D.DEALS.find(x => x.id === m[1]);
  if (d) return { ...d, id: sku, price: D.dealPrice(d, +m[2]), onBuy: sv => { if (sv.deal) sv.deal.got = true; } };
  const g = /^grow(\d+)$/.exec(sku);
  if (g) { const c = +g[1] - 1; return { id: sku, once: true, c, price: D.GROW.price[Math.min(c, D.GROW.price.length - 1)], give: D.growGive(c) }; }
  return null;
}
export async function recoverPurchases() {
  const P = window.forgePlatform;
  if (!P?.pending) return 0;
  let n = 0;
  try {
    const sv = load();
    for (const o of await P.pending()) {
      const item = itemBySku(o.sku);
      if (!item) { track('iap_recover_unknown', { sku: o.sku }); continue; }
      if (!(sv.orders || []).includes(o.orderId)) {
        (sv.orders ||= []).push(o.orderId);
        applyPurchase(sv, item);
        logUser({ payer: true, paid_total: (sv.paidTotal = (sv.paidTotal || 0) + item.price) }); save();
        track('iap_recover', { item: item.id, order: o.orderId });
        n++;
      }
      await P.complete(o.orderId);
    }
  } catch (e) { track('iap_recover_fail', { msg: String(e?.message || e).slice(0, 80) }); }
  return n;
}
if (window.forgePlatform?.pending && !isTest()) setTimeout(recoverPurchases, 4000);
// 이미 결제가 끝난 주문 내역(forgePlatform.restore가 준다)에서 영구 상품만 되살린다. 규칙은 purchaseRestore.js
export function restoreCompletedOrders(orders) {
  const sv = load();
  const n = restoreCompleted(sv, orders, {
    itemBySku, applyPurchase,
    ownsAll: (s, item) => !!item.give?.cosmetics?.length && item.give.cosmetics.every(id => wardrobe(s).owned[id]),
  });
  save();
  if (n) { logUser({ payer: true, paid_total: sv.paidTotal }); track('iap_restore', { n }); }
  return n;
}
