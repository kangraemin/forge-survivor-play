// 포털판(CrazyGames·itch) 데스크톱: 가로로 넓은 창에서는 세로 게임 판을 가운데 두고 좌우를 게임 배경 그림(흐리고 어둡게)으로 채운다.
// 키보드 안내(WASD·방향키·스페이스)는 옆 공간이 넉넉하고 마우스가 있는 기기에서만 왼쪽에 띄운다.
// 모바일·토스판은 이 파일을 부르지 않는다(platform/index.js가 포털일 때만 부른다). 게임 화면(캔버스) 크기·좌표는 그대로다.
import { t } from '../i18n.js';

const WIDE = 1.15;   // 창 가로/세로가 이보다 크면 옆이 비어 보인다
export function installDesktop() {
  if (typeof document === 'undefined') return;
  const css = document.createElement('style');
  css.textContent = `
#sidebg{position:fixed;inset:-24px;z-index:0;display:none;background:#0b0b10 url(assets/loading_bg.jpg) center/cover no-repeat;filter:blur(12px) brightness(.42) saturate(.9);pointer-events:none}
#game{z-index:1}
#deskhint{position:fixed;z-index:2;display:none;top:50%;transform:translateY(-50%);color:#cfd8dc;font:12px/1.7 G9,G11,sans-serif;text-shadow:0 1px 2px #000;pointer-events:none}
#deskhint b{display:block;margin-bottom:4px;color:#ffd75e;font:14px G11,G9,sans-serif}
@media (min-aspect-ratio:115/100){#sidebg{display:block}}`;
  document.head.appendChild(css);
  const bg = document.createElement('div'); bg.id = 'sidebg';
  document.body.insertBefore(bg, document.body.firstChild);
  const hint = document.createElement('div'); hint.id = 'deskhint';
  const b = document.createElement('b'); b.textContent = t('desk.title');
  hint.append(b, ...[t('desk.move'), t('desk.ult')].map(s => { const d = document.createElement('div'); d.textContent = '- ' + s; return d; }));
  document.body.appendChild(hint);
  const fine = () => { try { return matchMedia('(pointer:fine)').matches; } catch { return false; } };
  const place = () => {
    const w = innerWidth, h = innerHeight, cv = document.querySelector('#game canvas'), side = cv ? cv.getBoundingClientRect().left : (w - Math.min(w, h * 270 / 480)) / 2;   // 가운데 판을 뺀 한쪽 폭
    const on = w / h >= WIDE && side >= 170 && fine();
    hint.style.display = on ? 'block' : 'none';
    if (on) { hint.style.left = Math.round(side - 196) + 'px'; hint.style.width = '180px'; hint.style.textAlign = 'right'; }
  };
  addEventListener('resize', place); place(); setInterval(place, 1500);   // 캔버스가 뜨고 크기가 잡힌 뒤에도 맞춘다
}
