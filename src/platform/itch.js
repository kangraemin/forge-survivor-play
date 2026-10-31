// itch.io 무료 체험판: 광고 없음, 현금 상품 숨김, 전체판(토스·스토어) 링크
// 전체판 주소: 스토어 URL이 아직 없어 웹판 주소를 자리로 쓴다. 스토어가 열리면 아래 FULL_URL만 바꾼다
import { t } from '../i18n.js';
export const FULL_URL = 'https://kangraemin.github.io/forge-survivor-play/';   // TODO(출시): 토스·스토어 주소로 교체
export const FULL_LABEL = t('platform.fullLabel');

export function install() {
  window.forgePlatform = {
    portal: 'itch',
    noCash: true,
    noShare: true,        // 초대·자랑하기 링크는 웹판으로 데려가는 길이라 체험판에서는 끈다
    noAds: true,
    noAnalytics: true,    // 랭킹·클라우드 저장 등 로그 외 외부 요청은 보내지 않는다
    logOk: true,          // 65차: GA4 로그만 켠다(itch는 HTTPS 외부 요청 허용). 모든 이벤트에 platform=itch
    trial: { url: FULL_URL, label: FULL_LABEL },
    showAd: () => Promise.resolve(true),   // 광고가 없으니 보상은 바로 준다(하루 횟수 제한은 게임 쪽 그대로)
  };
}
