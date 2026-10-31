// 포털판(CrazyGames·itch) 데스크톱: 가로로 넓은 창에서는 세로 게임 판을 가운데 두고 좌우를 게임 배경 그림(흐리고 어둡게)으로 채운다.
// 키보드 안내(WASD·방향키·스페이스)는 옆 공간이 넉넉하고 마우스가 있는 기기에서만 왼쪽에 띄운다.
// 모바일·토스판은 이 파일을 부르지 않는다(platform/index.js가 포털일 때만 부른다). 게임 화면(캔버스) 크기·좌표는 그대로다.
import { t } from '../i18n.js';

const WIDE = 1.15;   // 창 가로/세로가 이보다 크면 옆이 비어 보인다
export function installDesktop() {
  if (typeof document === 'undefined') return;
  const css = document.createElement('style');
  css.textContent = `
#sidebg{position:fixed;inset:-24px;z-index:0;display:none;background:#0b0b10 url(assets/loading_bg.jpg) center/cover no-repeat;filter:blur(7px) brightness(.55) saturate(.95);pointer-events:none}
#game{z-index:1}
#deskhint{position:fixed;z-index:2;display:none;top:50%;transform:translateY(-50%);color:#cfd8dc;font:15px/1.65 G9,G11,sans-serif;text-shadow:0 1px 2px #000;pointer-events:none}
#deskhint,#deskinfo{box-sizing:border-box;padding:16px 18px;background:rgba(12,10,20,.78);border:1px solid #475c66;border-radius:8px}
#deskhint,#deskinfo{font:15px/1.65 G9,G11,sans-serif}
#deskinfo{position:fixed;z-index:2;display:none;top:50%;transform:translateY(-50%);width:260px;color:#e6edf0;text-shadow:0 1px 2px #000;pointer-events:none}
#deskinfo b{display:block;margin:14px 0 5px;color:#ffd75e;font:18px G11,G9,sans-serif}
#deskinfo .ic{display:inline-block;width:1.5em;text-align:center}
#deskinfo b:first-child{margin-top:0}
#deskinfo .ok{color:#5fdc6a}
#deskhint .live{margin-top:14px;padding-top:6px;border-top:1px solid #475c66}
#deskhint .live .big{font:22px G11,G9,sans-serif;color:#fff}
#deskhint b{display:block;margin-bottom:5px;color:#ffd75e;font:18px G11,G9,sans-serif}
@media (min-aspect-ratio:115/100){#sidebg{display:block}}`;
  document.head.appendChild(css);
  const bg = document.createElement('div'); bg.id = 'sidebg';
  document.body.insertBefore(bg, document.body.firstChild);
  const hint = document.createElement('div'); hint.id = 'deskhint';
  const b = document.createElement('b'); b.textContent = t('desk.title');
  hint.append(b, ...[t('desk.move'), t('desk.ult')].map(s => { const d = document.createElement('div'); d.textContent = '- ' + s; return d; }));
  document.body.appendChild(hint);
  // 63차: 전투 중이면 왼쪽 카드 아래에 이번 판 정보(읽기만 한다)를 크게 보여 준다. 게임 좌표·밸런스는 그대로
  const live = document.createElement('div'); live.className = 'live'; live.style.display = 'none'; hint.appendChild(live);
  const tickLive = () => {
    try {
      const bs = window.game?.scene?.getScene?.('Battle'), r = bs?.run;
      if (!bs || !r || !bs.sys?.isActive?.() || bs.over) { live.style.display = 'none'; return; }
      const b = document.createElement('b'); b.textContent = t('desk.liveTitle');
      const l1 = document.createElement('div'); l1.className = 'big'; l1.textContent = t('desk.live1', { stage: bs.endless ? '\u221E' : `${bs.c + 1}-${bs.s + 1}`, lv: r.lv });
      const l2 = document.createElement('div'); l2.textContent = '- ' + t('desk.live2', { k: r.kills | 0, hp: Math.max(0, Math.round(bs.hp / bs.maxHp * 100)) });
      live.replaceChildren(b, l1, l2); live.style.display = 'block';
    } catch { live.style.display = 'none'; }
  };
  setInterval(tickLive, 500);
  // 58차: 오른쪽 빈 자리에 오늘의 대장간 의뢰·내 칼(읽기만 한다. 게임 좌표·밸런스는 그대로). 저장·데이터 모듈은 깃발이 선 뒤에 늦게 불러온다
  const info = document.createElement('div'); info.id = 'deskinfo'; document.body.appendChild(info);
  let mods = null;
  const line = (txt, cls) => { const d = document.createElement('div'); d.textContent = '- ' + txt.replace(/\s+(\S+)$/, '\u00a0$1');   // 맨 끝 낱말(0/3 같은 수)이 혼자 다음 줄로 떨어지지 않게 앞 낱말에 붙인다
     if (cls) d.className = cls; return d; };
  const head = (txt, icon) => { const b = document.createElement('b'); const i = document.createElement('span'); i.className = 'ic'; i.textContent = icon; b.append(i, txt); return b; };   // 아이콘은 글자 그림(외부 이미지·링크 없음)
  const fill = async () => {
    try {
      mods ||= await Promise.all([import('../save.js'), import('../data.js'), import('../gear.js')]);
      const [S, D, G] = mods, sv = S.load();
      const kids = [];
      if ((sv.cleared | 0) >= 1) {
        const ords = D.forgeOrdersToday(sv.dayN), done = ords.filter(o => sv.misGot['o_' + o.id]).length;
        kids.push(head(t('desk.ordTitle', { done, n: ords.length }), '\u{1F4DC}'));
        for (const o of ords) { const have = Math.min(o.need, sv.mis[o.key] || 0); kids.push(line(t('desk.ordRow', { name: o.name, have, need: o.need }), have >= o.need ? 'ok' : '')); }
      }
      kids.push(head(t('desk.swordTitle'), '\u2694\uFE0F'));
      kids.push(line(t('desk.sword', { enh: sv.enh | 0, name: D.tierName(sv.tier, G.wtypeOf(sv)) })));
      kids.push(line(t('desk.power', { p: D.powerOf(sv) })));
      info.replaceChildren(...kids);
    } catch { /* 저장을 못 읽으면 패널만 비운다 */ info.replaceChildren(); }
  };
  const fine = () => { try { return matchMedia('(pointer:fine)').matches; } catch { return false; } };
  const place = () => {
    const w = innerWidth, h = innerHeight, cv = document.querySelector('#game canvas'), side = cv ? cv.getBoundingClientRect().left : (w - Math.min(w, h * 270 / 480)) / 2;   // 가운데 판을 뺀 한쪽 폭
    const on = w / h >= WIDE && side >= 220 && fine();
    hint.style.display = on ? 'block' : 'none';
    const right = cv ? cv.getBoundingClientRect().right : w - side;
    info.style.display = on ? 'block' : 'none';
    if (on) { info.style.width = Math.min(310, w - right - 28) + 'px'; info.style.left = Math.round(right + 16) + 'px'; fill(); }
    if (on) { hint.style.left = Math.round(side - 252) + 'px'; hint.style.width = '236px'; hint.style.textAlign = 'left'; }
  };
  addEventListener('resize', place); place(); setInterval(place, 1500);   // 캔버스가 뜨고 크기가 잡힌 뒤에도 맞춘다
}
