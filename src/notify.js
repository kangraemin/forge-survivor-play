// 재방문 알림(스토어 앱 전용): 방치 보상이 가득 찰 때, 일일 던전이 다시 열릴 때, 오래 안 들어왔을 때.
// 예약은 기기 알림(@capacitor/local-notifications)이 한다. 어댑터: store/src/forge-platform.js 의 forgePlatform.notify
// 웹·토스·포털판에는 어댑터가 없어 이 파일은 아무 일도 하지 않는다(요청도 없다)
//  · 권한 묻기: 첫 판을 깬 뒤 로비에서 한 번(설명 창). 거절해도 설정에서 다시 켤 수 있다
//  · 재예약: 로비가 열릴 때, 앱이 앞/뒤로 바뀔 때마다 전부 취소하고 다시 건다(비운 시간은 마지막 저장 시각부터 센다)
//  · 시간대: 밤 10시~아침 9시에 걸리면 그날(또는 다음 날) 오전 10시로 옮긴다
// 토스(앱인토스) 푸시는 여기서 예약하지 않는다. 공식 문서(2026-10-31, guide/marketing/smart-message · api/push):
//  · 미니앱 SDK에는 기기 예약 알림이 없다. 스마트 발송은 콘솔 캠페인(문구 검수 2~3영업일)이나 서버 API(mTLS 인증서 + x-anon-key)로만 나간다.
//  · 특정 시점에 알림을 받겠다고 동의를 받는 기능성 메시지는 콘솔의 알림 동의문 + 기능성 캠페인 템플릿이 먼저 있어야 requestNotificationAgreement를 쓸 수 있다.
//  콘솔 쪽 템플릿·서버가 준비되면 toss.js의 forgePlatform에 requestNotificationAgreement를 붙이고, 서버에서 방치 보상 가득 참 알림을 보낸다. 그 전까지 토스판은 이 파일이 아무 일도 안 한다.
import * as D from './data.js';
import { W } from './data.js';
import { font, font9, panel, button, toast } from './ui.js';
import { load } from './save.js';
import { track } from './log.js';
import { t } from './i18n.js';
import { isTest } from './testMode.js';

const KEY = 'forge-notify-v1';          // { asked, on } 기기 저장소(저장 파일 형식은 건드리지 않는다)
const HOUR = 3600000, AWAY_H = 72;
export const IDS = { idle: 71, dungeon: 72, away: 73 };
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 막힘 */ } },
};
const plat = () => (isTest() ? null : globalThis.window?.forgePlatform?.notify || null);   // 테스트 모드: 기기 알림 예약 없음
export const notifyAvailable = () => !!plat();
export const notifyState = () => { try { return { asked: false, on: false, ...JSON.parse(ls.get(KEY) || '{}') }; } catch { return { asked: false, on: false }; } };
const setState = p => ls.set(KEY, JSON.stringify({ ...notifyState(), ...p }));

// 낮 시간(9~22시)에 걸리도록 옮긴다
export function daytime(ts) {
  const d = new Date(ts), h = d.getHours();
  if (h >= 9 && h < 22) return ts;
  if (h >= 22) d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
}
// 예약 목록(순수 함수: 시험에서도 쓴다)
export function planNotes(sv, now = Date.now()) {
  const out = [];
  if (sv.cleared >= 1) out.push({ id: IDS.idle, at: daytime(now + D.IDLE.capH * HOUR), title: t('notify.idleTitle'), body: t('notify.idleBody', { h: D.IDLE.capH }) });
  if (sv.cleared >= D.DUNGEON.unlock) {
    const d = new Date(now + HOUR); d.setHours(10, 0, 0, 0);
    if (d.getTime() <= now + HOUR) d.setDate(d.getDate() + 1);
    out.push({ id: IDS.dungeon, at: d.getTime(), title: t('notify.dunTitle'), body: t('notify.dunBody', { n: D.DUNGEON.daily }) });
  }
  if (sv.cleared >= 1) out.push({ id: IDS.away, at: daytime(now + AWAY_H * HOUR), title: t('notify.awayTitle'), body: t('notify.awayBody') });
  return out;
}

// 켜져 있으면 전부 다시 걸고, 꺼져 있으면 걸린 것을 지운다
export async function notifySync(sv = load()) {
  const p = plat();
  if (!p) return;
  try {
    if (notifyState().on) await p.schedule(planNotes(sv));
    else await p.cancelAll();
  } catch { /* 알림이 안 되어도 게임은 계속 */ }
}
let hooked = false;
export function notifyInstall() {
  if (hooked || !plat()) return;
  hooked = true;
  document.addEventListener('visibilitychange', () => { notifySync(); });
}

export const notifyAskDue = sv => !!plat() && !notifyState().asked && sv.cleared >= 1 && (sv.stats?.runs || 0) >= 1;

// 켜기(권한 요청 포함). 결과: 'on' | 'denied'
export async function notifyEnable() {
  const p = plat();
  if (!p) return 'denied';
  let ok = false;
  try { ok = await p.request(); } catch { ok = false; }
  setState({ asked: true, on: ok });
  track('notify_ask', { ok });
  if (ok) await notifySync();
  return ok ? 'on' : 'denied';
}
export async function notifyDisable() {
  setState({ asked: true, on: false });
  track('notify_off');
  await notifySync();
}

// 설명 창: '짧은 제목' 아래 '- 문장'
export function openNotifyAsk(scene) {
  if (!plat() || scene.busy) return;
  const c = scene.modal();
  c.add(panel(scene, 20, 120, W - 40, 224, { fill: 0x1a1426, line: 0xffd75e }));
  c.add(scene.add.text(W / 2, 144, t('notify.askTitle'), font(14, '#ffd75e')).setOrigin(0.5));
  const body = scene.add.text(34, 170, [t('notify.ask1'), t('notify.ask2'), t('notify.ask3'), t('notify.ask4')].map(s => '- ' + s).join('\n'),
    { ...font9(10, '#f2e4bc'), wordWrap: { width: W - 68 } }).setLineSpacing(9);
  body.isBtnLabel = true;   // 글자 맞춤이 뒤에 깔린 로비 글자와 부딪힌다고 줄이지 않게(창이 위를 덮는다)
  c.add(body);
  c.add(button(scene, W / 2 + 56, 318, 100, 28, t('notify.allow'), async () => {
    const r = await notifyEnable();
    c.close();
    if (r === 'denied') toast(scene, t('notify.denied'), '#ffffff');
  }, { size: 11, color: 0x2f6b3a }));
  c.add(button(scene, W / 2 - 56, 318, 80, 28, t('notify.later'), () => { setState({ asked: true, on: false }); track('notify_later'); c.close(); }, { size: 11, color: 0x3a3846 }));
}
