// 과금: 결제·광고는 플랫폼마다 다르니 여기 한 곳에서 갈아 끼운다
// 웹판: 광고는 체험용 카운트다운, 결제는 열리지 않는다(?devpay를 붙이면 테스트 결제)
// 앱판(구글플레이·앱인토스)에서는 window.forgePlatform = { buy(id), showAd(kind), haptic(ms) } 를 넣어 진짜 SDK로 잇는다
import { track, logUser } from './log.js';
import * as D from './data.js';
import { save } from './save.js';
import { sfx } from './sfx.js';
import { font, font9, panel, button, fixedContainer } from './ui.js';

const W = 270, H = 480;
const devpay = () => { try { return new URLSearchParams(location.search).has('devpay'); } catch { return false; } };
export const won = n => n.toLocaleString('ko-KR') + '원';

// 보상 지급. goldStage는 지금 도전 중인 스테이지 클리어 금화의 배수
const stageGold = sv => { const top = Math.min(sv.cleared, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1); return D.clearGold(Math.floor(top / D.STAGES_PER_CHAPTER), top % D.STAGES_PER_CHAPTER); };
export function grant(sv, give) {
  for (const [k, v] of Object.entries(give)) {
    if (k === 'goldStage') sv.gold += stageGold(sv) * v;
    else if (k === 'skin') (sv.skins ||= {})[v] = true;
    else sv[k] = (sv[k] || 0) + v;
  }
  save();
}
// sv를 넘기면 goldStage를 '금화 ×2' 대신 실제 받을 금화로 보여 준다
export const giveText = (give, sv) => Object.entries(give).map(([k, v]) => ({
  gem: `보석 ${v}`, gold: `금화 ${v.toLocaleString()}`, stone: `강화석 ${v}`, guard: `방지권 ${v}`, charm: `강화 +5%p ×${v}`, sweep: `소탕권 ${v}`, spReset: `스탯 초기화권 ${v}`, goldStage: sv ? `금화 ${(stageGold(sv) * v).toLocaleString()}` : `금화 ×${v}`, skin: D.SKINS.find(x => x.id === v)?.name,
}[k])).join(' · ');

export const firstX2 = (sv, item) => D.FIRST_BUY_X2.includes(item.id) && !sv.bought[item.id];
export const adsLeft = (sv, kind) => D.ADS[kind].daily - (sv.ads[kind] || 0);

// 화면 위에 뜨는 작은 창(장면이 무엇이든 맨 위)
function modal(scene) {
  const c = fixedContainer(scene).setDepth(3000);
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive());
  return c;
}

// 보상형 광고. 끝까지 보면 true. 광고 제거를 샀으면 바로 true
function showAdRaw(scene, sv, kind) {
  return new Promise(res => {
    if (sv.noAds) return res(true);
    if (window.forgePlatform?.showAd) return window.forgePlatform.showAd(kind).then(res, () => res(false));
    // 웹 체험판: 3초 카운트다운
    const c = modal(scene);
    c.add(panel(scene, 30, 170, W - 60, 130, { fill: 0x101018 }));
    c.add(scene.add.text(W / 2, 196, '광고', font(14, '#ffd75e')).setOrigin(0.5));
    c.add(scene.add.text(W / 2, 218, '(웹 체험판에서는 광고 대신 잠깐 기다린다)', font9(10, '#a89cc8')).setOrigin(0.5));
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

// 결제. 성공하면 상품을 지급하고 true
function buyRaw(scene, sv, item) {
  return new Promise(res => {
    const done = ok => {
      if (ok) {
        if (item.once) sv.bought[item.id] = true;
        if (item.passDays) sv.passLeft = (sv.passLeft || 0) + item.passDays;
        if (item.noAds) sv.noAds = true;
        // 보석 묶음 첫 구매는 보석 2배
        const x2 = firstX2(sv, item);
        if (D.FIRST_BUY_X2.includes(item.id)) sv.bought[item.id] = true;
        grant(sv, x2 ? { ...item.give, gem: item.give.gem * 2 } : item.give);
        sfx('win');
      }
      res(ok);
    };
    if (window.forgePlatform?.buy) return window.forgePlatform.buy(item.id).then(done, () => done(false));
    const c = modal(scene);
    c.add(panel(scene, 24, 160, W - 48, 160, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(scene.add.text(W / 2, 186, item.name, font(13, '#ffd75e')).setOrigin(0.5));
    c.add(scene.add.text(W / 2, 210, giveText(item.give) + (item.passDays ? ` · ${item.passDays}일` : ''), { ...font9(10, '#e8e2f8'), wordWrap: { width: W - 70 }, align: 'center' }).setOrigin(0.5, 0));
    if (!devpay()) {
      c.add(scene.add.text(W / 2, 248, '웹 체험판에서는 결제가 열리지 않는다\n앱에서 구매할 수 있다', { ...font9(10, '#ff9a8a'), align: 'center' }).setOrigin(0.5));
      c.add(button(scene, W / 2, 292, 120, 28, '닫기', () => { c.destroy(); done(false); }));
      return;
    }
    c.add(scene.add.text(W / 2, 248, `테스트 결제  ${won(item.price)}`, font(11)).setOrigin(0.5));
    c.add(button(scene, 85, 292, 100, 28, '취소', () => { c.destroy(); done(false); }));
    c.add(button(scene, 190, 292, 100, 28, '결제', () => { c.destroy(); done(true); }, { color: 0x2f6b3a }));
  });
}

// 광고·결제는 요청과 결과를 모두 남긴다(어디서 눌렀는지·끝까지 봤는지·결제했는지)
export function showAd(scene, sv, kind) {
  const t0 = Date.now();
  track('ad_request', { kind, no_ads: !!sv.noAds, scene: scene.scene.key });
  return showAdRaw(scene, sv, kind).then(ok => { track('ad_result', { kind, ok, sec: Math.round((Date.now() - t0) / 1000) }); return ok; });
}
export function buy(scene, sv, item) {
  const t0 = Date.now(), first = !sv.paidTotal;
  track('iap_click', { item: item.id, price: item.price, scene: scene.scene.key, first_purchase: first, gem: sv.gem, cleared: sv.cleared, platform: window.forgePlatform?.buy ? 'app' : devpay() ? 'devpay' : 'web' });
  track('begin_checkout', { currency: 'KRW', value: item.price, item_id: item.id });
  return buyRaw(scene, sv, item).then(ok => {
    const sec = Math.round((Date.now() - t0) / 1000);
    track(ok ? 'iap_success' : 'iap_cancel', { item: item.id, price: item.price, sec, first_purchase: first });
    if (ok) {
      track('purchase', { currency: 'KRW', value: item.price, transaction_id: `${item.id}-${Date.now()}`, item_id: item.id, first_purchase: first });
      logUser({ payer: true, paid_total: (sv.paidTotal = (sv.paidTotal || 0) + item.price) }); save();
    }
    return ok;
  });
}
