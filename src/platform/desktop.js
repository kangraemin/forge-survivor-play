// 포털판(CrazyGames·itch) 데스크톱: 가로로 넓은 창에서는 세로 게임 판을 가운데 두고 좌우를 게임 배경 그림(흐리고 어둡게)으로 채운다.
// 키보드 안내(WASD·방향키·스페이스)는 옆 공간이 넉넉하고 마우스가 있는 기기에서만 왼쪽에 띄운다.
// 모바일·토스판은 이 파일을 부르지 않는다(platform/index.js가 포털일 때만 부른다). 게임 화면(캔버스) 크기·좌표는 그대로다.
import { t } from '../i18n.js';

const WIDE_R = 1.15;   // 창 가로/세로가 이보다 크면 옆이 비어 보인다
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
#deskhint .live .big{font:20px G11,G9,sans-serif;color:#fff}
.dbtn{pointer-events:auto;cursor:pointer;margin-top:12px;padding:9px 14px;color:#fff;background:#1d6f80;border:1px solid #7fe6ee;border-radius:6px;font:16px G11,G9,sans-serif}
.dbtn:hover{background:#25889c}
#deskinfo .row{display:flex;gap:10px}
#deskhint b{display:block;margin-bottom:5px;color:#ffd75e;font:18px G11,G9,sans-serif}
@media (min-aspect-ratio:115/100){#sidebg{display:block}}`;
  document.head.appendChild(css);
  const bg = document.createElement('div'); bg.id = 'sidebg';
  document.body.insertBefore(bg, document.body.firstChild);
  const hint = document.createElement('div'); hint.id = 'deskhint';
  const b = document.createElement('b'); b.textContent = t('desk.title');
  hint.append(b, ...[t('desk.move'), t('desk.ult'), t('desk.nav')].map(s => { const d = document.createElement('div'); d.textContent = '- ' + s; return d; }));
  document.body.appendChild(hint);
  // 64차: '이번 판' 패널은 게임 위 HUD(처치·은화·레벨)와 겹쳐서 치웠다. 대신 양옆에 눌러서 쓰는 바로가기를 둔다(로비일 때만 켜진다. 게임 좌표·밸런스는 그대로)
  const lobby = () => { try { const sc = window.game?.scene?.getScene?.('Lobby'); return sc && sc.sys?.isActive?.() && !sc.busy ? sc : null; } catch { return null; } };
  const mkBtn = (label, fn) => { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'dbtn'; bt.textContent = label; bt.addEventListener('click', () => { const sc = lobby(); if (sc) fn(sc); }); return bt; };
  const goal = document.createElement('div'); goal.className = 'live'; hint.appendChild(goal);
  let goalMod = null;
  const tickGoal = async () => {
    try {
      const sc = lobby();
      if (!sc) { goal.style.display = 'none'; goal.dataset.sig = ''; return; }
      goalMod ||= await import('../nextGoal.js');
      const g = goalMod.nextGoal(sc.sv);
      if (!g) { goal.style.display = 'none'; return; }
      const b = document.createElement('b'); b.textContent = t('desk.goalTitle');
      const l1 = document.createElement('div'); l1.className = 'big'; l1.textContent = g.kind === 'power' ? `${g.stage} · ${g.title}` : g.title;
      const l2 = document.createElement('div'); l2.textContent = '- ' + g.sub;
      const sig = l1.textContent + l2.textContent; if (sig === goal.dataset.sig && goal.style.display === 'block') return;
      goal.dataset.sig = sig; goal.replaceChildren(b, l1, l2, mkBtn(t('desk.goalGo'), s2 => s2.goGoal(g)));
      goal.style.display = 'block';
    } catch { goal.style.display = 'none'; }
  };
  setInterval(tickGoal, 700);
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
      const row = document.createElement('div'); row.className = 'row';
      row.append(mkBtn(t('desk.btnForge'), sc => sc.show('forge')), mkBtn(t('desk.btnGear'), sc => sc.show('gear')));
      kids.push(row);
      const sig = kids.map(k => k.textContent).join('|'); if (sig === info.dataset.sig) return;   // 같으면 다시 안 그린다(누르는 중 버튼이 바뀌지 않게)
      info.dataset.sig = sig; info.replaceChildren(...kids);
    } catch { /* 저장을 못 읽으면 패널만 비운다 */ info.replaceChildren(); }
  };
  const fine = () => { try { return matchMedia('(pointer:fine)').matches; } catch { return false; } };
  const place = () => {
    // 64차: 캔버스가 창 전폭이고 기본 판(270)은 그 가운데 열이다. 패널은 그 열의 양옆에 둔다. 전투 중엔 월드가 양옆까지 보이니 패널을 숨긴다
    const w = innerWidth, h = innerHeight, cv = document.querySelector('#game canvas');
    let side = (w - Math.min(w, h * 270 / 480)) / 2, right = w - side;
    const col = window.__wideCol;   // main.js가 알려 준다: 캔버스 폭 중 기본 판(가운데 열)의 비율
    if (cv && col) { const r = cv.getBoundingClientRect(); side = r.left + r.width * col.off; right = side + r.width * col.w; }
    let battle = false; try { battle = !!window.game?.scene?.isActive?.('Battle'); } catch { /* 장면 확인 실패는 무시 */ }
    const on = w / h >= WIDE_R && side >= 220 && fine() && !battle;
    hint.style.display = on ? 'block' : 'none';
    info.style.display = on ? 'block' : 'none';
    if (on) { info.style.width = Math.min(310, w - right - 28) + 'px'; info.style.left = Math.round(right + 16) + 'px'; fill(); }
    if (on) { hint.style.left = Math.round(side - 252) + 'px'; hint.style.width = '236px'; hint.style.textAlign = 'left'; }
  };
  addEventListener('resize', place); place(); setInterval(place, 1500);   // 캔버스가 뜨고 크기가 잡힌 뒤에도 맞춘다
}
