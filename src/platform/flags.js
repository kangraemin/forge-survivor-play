// 포털판(CrazyGames·itch.io) 분기 깃발. 토스·웹 빌드에는 window.forgePlatform에 이 깃발이 없어 전부 false다
// 화면 파일은 이 함수만 보고, 포털 이름은 보지 않는다
const fp = () => (typeof window !== 'undefined' && window.forgePlatform) || {};
export const portal = () => fp().portal || '';
export const cashHidden = () => !!fp().noCash;       // 현금 상품(결제·특가·패키지·광고 제거·결제 묶음)을 화면에서 지운다
export const shareHidden = () => !!fp().noShare;     // 친구 초대·자랑하기(외부 링크 공유)를 지운다
export const adsHidden = () => !!fp().noAds;         // 광고가 없는 판(itch 체험판): 광고 문구를 지우고 바로 보상
export const adWord = (withAd, without) => (adsHidden() ? without : withAd);
export const trialInfo = () => fp().trial || null;   // { url, label } 체험판이면 전체판 링크
export function openFull(from = '') {
  const t = trialInfo(); if (!t?.url) return false;
  try { window.open(t.url, '_blank', 'noopener'); } catch { return false; }
  try { window.forgePlatform?.log?.('full_link', { from }); } catch { /* 무시 */ }
  return true;
}
// 포털판(CrazyGames): 판이 끝나고 '다음 판'으로 넘어갈 때만 중간 광고를 낀다(플레이 중·메뉴·상점에는 안 띄운다).
// 처음 3판은 건너뛴다. 빈도는 SDK가 거른다. 같은 장면 플러그인에 한 번만 건다
export function midgameBeforeBattle(s, sv) {
  const mg = window.forgePlatform?.midgame, sc = s.scene;
  if (!mg || sc.__mg || (sv?.stats?.runs ?? 0) <= 3) return;
  sc.__mg = true;
  const orig = sc.start.bind(sc);
  sc.start = (key, data) => (key === 'Battle' ? mg().then(() => orig(key, data), () => orig(key, data)) : orig(key, data));
}
