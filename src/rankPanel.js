// 주간 랭킹 창(로비 무한의 탑 화면에서 연다). 데이터는 rank.js, 서버는 routes/rank.js
import { W, TIERS } from './data.js';
import { font, font9, panel, button } from './ui.js';
import { loadTop, rankEnabled, rankDecode, myWeek } from './rank.js';
import { track } from './log.js';
import { t } from './i18n.js';

const PER = 10;
const valText = (board, score) => {
  if (board === 'tower') return t('rank.floor', { v: score });
  const d = rankDecode(score);
  return t('rank.gear', { name: TIERS[Math.min(d.tier, TIERS.length - 1)].name, v: d.enh });
};

// 열 수 있는 판인가(포털판은 숨김). 서버 확인은 열 때 한다
export const rankVisible = () => rankEnabled();

const fixed = o => { o.isBtnLabel = true; return o; };   // 글자 맞춤(textfit)이 뒤에 깔린 로비 글자와 부딪힌다고 줄이지 않게
export async function openRank(scene) {
  if (!rankEnabled()) return;
  const c = scene.modal();
  c.add(panel(scene, 12, 44, W - 24, 396, { fill: 0x1a1426, line: 0x8a6ac8 }));
  c.add(scene.add.text(W / 2, 62, t('rank.title'), font(14, '#ffd75e')).setOrigin(0.5));
  c.add(button(scene, W - 34, 62, 26, 22, 'X', () => c.close(), { size: 11 }));
  const status = scene.add.text(W / 2, 200, t('rank.loading'), font9(11, '#a1b2b6')).setOrigin(0.5);
  c.add(status);
  track('rank_open');
  const data = await loadTop();
  if (!c.scene) return;   // 기다리는 사이에 닫았다
  if (!data) { status.setText(t('rank.fail')); return; }
  status.destroy();
  let board = 'tower', page = 0;
  const dyn = scene.add.container(0, 0);
  c.add(dyn);
  const left = Math.max(0, data.resetAt - Date.now()), days = Math.floor(left / 86400000), hrs = Math.floor((left % 86400000) / 3600000);
  c.add(scene.add.text(W / 2, 80, t('rank.reset', { d: days, h: hrs }), font9(9, '#7d8f94')).setOrigin(0.5));
  const tabs = [];
  const draw = () => {
    dyn.removeAll(true);
    tabs.forEach(([id, b]) => b.setColor(id === board ? 0x1d6f80 : 0x3a3846));
    const bd = data[board], rows = bd.top, pages = Math.max(1, Math.ceil(rows.length / PER));
    dyn.add(scene.add.text(26, 122, t('rank.colRank'), font9(9, '#7d8f94')));
    dyn.add(scene.add.text(72, 122, t('rank.colName'), font9(9, '#7d8f94')));
    dyn.add(scene.add.text(W - 26, 122, t('rank.colScore'), font9(9, '#7d8f94')).setOrigin(1, 0));
    if (!rows.length) {   // 빈 판: 짧은 제목 + '- 문장'
      dyn.add(scene.add.text(W / 2, 196, t('rank.emptyTitle'), font(13, '#ffd75e')).setOrigin(0.5));
      let ey = 222;
      [t('rank.emptyL1'), t('rank.emptyL2')].forEach(s2 => { const o = fixed(scene.add.text(44, ey, '- ' + s2, { ...font9(10, '#e8f4f8'), wordWrap: { width: W - 88 } }).setLineSpacing(2)); dyn.add(o); ey += o.height + 6; });
    }
    rows.slice(page * PER, page * PER + PER).forEach((r, i) => {
      const y = 140 + i * 20;
      if (r.mine) dyn.add(scene.add.rectangle(W / 2, y + 8, W - 40, 18, 0x2a4a58, 0.9));
      dyn.add(fixed(scene.add.text(26, y, t('rank.n', { n: r.rank }), font9(10, r.rank <= 3 ? '#ffd75e' : '#f2e4bc'))));
      dyn.add(fixed(scene.add.text(72, y, '#' + r.tag, font9(10, r.mine ? '#9ae0ff' : '#a1b2b6'))));
      dyn.add(fixed(scene.add.text(W - 26, y, valText(board, r.score), font9(10, r.mine ? '#9ae0ff' : '#f2e4bc')).setOrigin(1, 0)));
    });
    if (pages > 1) {
      dyn.add(button(scene, 70, 354, 44, 20, '◀', () => { page = (page + pages - 1) % pages; draw(); }, { size: 11 }));
      dyn.add(scene.add.text(W / 2, 354, `${page + 1} / ${pages}`, font9(10, '#a1b2b6')).setOrigin(0.5));
      dyn.add(button(scene, W - 70, 354, 44, 20, '▶', () => { page = (page + 1) % pages; draw(); }, { size: 11 }));
    }
    // 내 순위(50위 밖이어도 보인다). 서버 응답 전에 쌓은 이번 주 기록이 있으면 그 값
    dyn.add(panel(scene, 22, 372, W - 44, 56, { fill: 0x12202a, line: 0x475c66 }));
    dyn.add(scene.add.text(32, 380, t('rank.me'), font(11, '#9ae0ff')));
    const mine = bd.mine, mw = myWeek()[board];
    if (mine) {
      dyn.add(scene.add.text(W - 32, 380, t('rank.n', { n: mine.rank }), font(12, '#ffd75e')).setOrigin(1, 0));
      dyn.add(fixed(scene.add.text(32, 402, '#' + data.me, font9(10, '#a1b2b6'))));
      dyn.add(fixed(scene.add.text(W - 32, 404, valText(board, mine.score), font9(10, '#f2e4bc')).setOrigin(1, 0)));
    } else {
      dyn.add(scene.add.text(32, 404, mw ? valText(board, mw) : t('rank.meNone'), font9(10, '#a1b2b6')));
    }
  };
  [['tower', t('rank.tabTower'), 70], ['enh', t('rank.tabGear'), W - 70]].forEach(([id, name, x]) => {
    const b = button(scene, x, 104, 110, 22, name, () => { board = id; page = 0; track('rank_tab', { board: id }); draw(); }, { size: 10, color: 0x3a3846 });
    c.add(b); tabs.push([id, b]);
  });
  draw();
}
