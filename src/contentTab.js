// 로비 콘텐츠 확장: 메뉴 줄(임무·던전·기록·난이도), 일일 던전 창, 주간 도전, 도감·업적 창
// Lobby.prototype에 섞어 쓴다(this는 Lobby 장면)
import * as D from './data.js';
import { save } from './save.js';
import { sfx } from './sfx.js';
import { font, font9, panel, button, icon, fmt, toast, gemIcon, skillIcon } from './ui.js';
import { grant, giveText } from './shop.js';
import { track } from './log.js';
import { dexState, ACHIEVES, achReady, titles, DEX_HP, DEX_SET_ATK } from './codex.js';
import { WTYPES, SETS } from './gear.js';

const { W } = D;
const ACH_PAGE = 8;

export const ContentTab = {
  // ── 전투 탭 메뉴 줄 ──
  menuRow(b) {
    const sv = this.sv, y = 223;
    const dot = (x, on) => on && b.add(this.add.circle(x + 25, y - 10, 4, 0xff3a3a));
    const doneN = D.MISSIONS.filter(m => sv.misGot[m.id]).length;
    b.add(button(this, 41, y, 58, 24, `임무 ${doneN}/3`, () => !this.busy && this.missionWin(), { size: 10 }));
    dot(41, this.missionReady() > 0);
    const dunOpen = sv.cleared >= D.DUNGEON.unlock, left = D.DUNGEON.daily - (sv.dunN || 0);
    const db = button(this, 103, y, 58, 24, dunOpen ? `던전 ${left}/${D.DUNGEON.daily}` : '던전', () => !this.busy && this.dungeonWin(), { size: 10, color: 0x3a3846,
      onDeny: () => { track('locked_menu_tap', { menu: 'dungeon' }); toast(this, '일일 던전 · 1장 보스를 잡으면 열린다', '#ff9a8a'); } });
    db.setEnabled(dunOpen); b.add(db);
    dot(103, dunOpen && left > 0);
    b.add(button(this, 165, y, 58, 24, '기록', () => !this.busy && this.recordWin(), { size: 10 }));
    dot(165, achReady(sv) > 0);
    // 난이도: 마왕을 잡으면 열린다(그 전엔 잠긴 채 목표로 보인다)
    const hardOpen = sv.cleared >= D.HARD.unlock;
    const hb = button(this, 227, y, 58, 24, this.hard ? '보통으로' : '어려움', () => {
      if (this.busy) return;
      this.hard = !this.hard; sv.hardOn = this.hard; save(); this.selTop();
      track('difficulty_toggle', { hard: this.hard, hardCleared: sv.hardCleared || 0 });
      toast(this, this.hard ? '어려움 · 몹이 세고 보상이 크다' : '보통 난이도', this.hard ? '#ff9090' : '#ffffff');
      this.show('battle');
    }, { size: 10, color: this.hard ? 0x3a3846 : 0x8a2a3a, onDeny: () => { track('locked_menu_tap', { menu: 'hard' }); toast(this, '어려움 · 5장 마왕을 잡으면 열린다', '#ff9a8a'); } });
    hb.setEnabled(hardOpen); b.add(hb);
  },

  // ── 일일 던전 ──
  dungeonWin() {
    const sv = this.sv, c = this.modal(), type = D.dunToday(), T = D.DUN_TYPES[type], left = D.DUNGEON.daily - (sv.dunN || 0);
    track('dungeon_open', { type, left });
    c.add(panel(this, 16, 70, W - 32, 344, { fill: 0x1a1426, line: T.tint }));
    c.add(this.add.text(W / 2, 92, '일일 던전', font(14, '#ffd75e')).setOrigin(0.5));
    c.add(button(this, W - 38, 92, 26, 22, 'X', () => c.close(), { size: 11 }));
    c.add(this.add.text(W / 2, 114, `오늘은 ${T.name}`, font(12, T.css)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 131, T.desc, font9(10, '#a1b2b6')).setOrigin(0.5));
    // 요일표: 내일 무엇이 열리는지 보여 다시 올 이유를 만든다
    const today = new Date().getDay(), SHORT = { gold: '금화', stone: '강화석', gear: '장비', gem: '보석' };
    ['일', '월', '화', '수', '목', '금', '토'].forEach((d, i) => {
      const x = W / 2 + (i - 3) * 32, t = D.DUN_TYPES[D.DUN_WEEK[i]], on = i === today;
      c.add(this.add.rectangle(x, 166, 29, 34, on ? 0x3b2f5c : 0x15111f).setStrokeStyle(1, on ? 0xffd75e : 0x293845));
      c.add(this.add.text(x, 157, d, font9(10, on ? '#ffd75e' : '#7d8f94')).setOrigin(0.5));
      c.add(this.add.text(x, 173, SHORT[D.DUN_WEEK[i]], font9(9, t.css)).setOrigin(0.5));
    });
    c.add(this.add.text(28, 196, '규칙', font(11, '#c8a0ff')));
    [`${D.DUNGEON.sec}초 동안 몹을 잡는다.`, `${D.DUNGEON.killNeed}마리를 채우면 보상을 다 받는다.`, '덜 잡아도 잡은 만큼 받는다.', `${D.DUNGEON.goblinSec}초마다 보물 고블린이 나온다.`].forEach((t, i) =>
      c.add(this.add.text(28, 214 + i * 16, '- ' + t, font9(10, '#f2e4bc'))));
    // 다 채웠을 때 받는 것
    c.add(this.add.text(28, 286, '다 채우면', font(11, '#c8a0ff')));
    const g = D.dunReward(type, D.dunBase(sv), 1);
    const rw = [g.gold && [12, fmt(g.gold)], g.stone && [13, String(g.stone)], g.gem && [-1, String(g.gem)], g.items && [11, `장비 ${g.items}`]].filter(Boolean);
    let rx = 36;
    rw.forEach(([ic, v]) => {
      c.add(ic < 0 ? gemIcon(this, rx, 312, 12) : icon(this, rx, 312, ic, 14));
      const t = this.add.text(rx + 10, 305, v, font(11)); c.add(t); rx += 24 + t.width;
    });
    c.add(this.add.text(W / 2, 342, left > 0 ? `오늘 ${left}번 남았다` : '오늘은 다 했다. 내일 또 열린다', font9(10, left > 0 ? '#a1b2b6' : '#7d8f94')).setOrigin(0.5));
    const go = button(this, W / 2, 380, 150, 30, left > 0 ? '입장' : '내일 다시', () => {
      if (left <= 0) return;
      sv.dunN = (sv.dunN || 0) + 1; save();
      track('dungeon_enter', { type, n: sv.dunN });
      const base = D.dunBase(sv);
      c.destroy(); this.busy = false;
      this.startBattle(base.c, Math.min(base.s, D.STAGES_PER_CHAPTER - 2), false, base.hard, type);   // 보스 판 대신 같은 장의 일반 판 몹. 어려움을 시작했으면 어려움 몹
    }, { size: 13, color: 0x2f6b3a });
    go.setEnabled(left > 0); c.add(go);
  },

  // ── 주간 도전(임무 창 '이번 주' 칸) ──
  weeklyReady() {
    const wk = this.sv.wk || { mis: {}, got: {} };
    const n = D.WEEKLY.filter(m => (wk.mis[m.id] || 0) >= m.need && !wk.got[m.id]).length;
    return n + (D.WEEKLY.every(m => wk.got[m.id]) && !wk.got.all ? 1 : 0);
  },
  weeklyDraw(body, redraw) {
    const sv = this.sv, wk = sv.wk;
    D.WEEKLY.forEach((m, i) => {
      const y = 102 + i * 40, have = Math.min(m.need, wk.mis[m.id] || 0), done = have >= m.need, got = wk.got[m.id];
      body.add(panel(this, 26, y, W - 52, 34, { fill: got ? 0x141018 : 0x293845 }));
      body.add(this.add.text(36, y + 5, m.name, font9(10, got ? '#6a6080' : '#ffffff')));
      body.add(this.add.text(36, y + 19, `${fmt(have)}/${fmt(m.need)} · ${giveText(D.WEEKLY_GIVE)}`, font9(10, done ? '#5fdc6a' : '#a1b2b6')));
      const bt = button(this, W - 60, y + 17, 52, 24, got ? '완료' : '받기', () => {
        if (got || !done) return;
        wk.got[m.id] = true; track('weekly_claim', { id: m.id }); grant(sv, D.WEEKLY_GIVE); sfx('coin'); this.refreshTop(); redraw();
      }, { size: 10, color: 0x2f6b3a });
      bt.setEnabled(done && !got); body.add(bt);
    });
    const allDone = D.WEEKLY.every(m => wk.got[m.id]);
    const ab = button(this, W / 2, 278, 200, 24, wk.got.all ? '모두 완료 보너스 받음' : `넷 다 하면 ${giveText(D.WEEKLY_ALL)}`, () => {
      if (!allDone || wk.got.all) return;
      wk.got.all = true; track('weekly_claim', { id: 'all' }); grant(sv, D.WEEKLY_ALL); sfx('win'); this.refreshTop(); redraw();
    }, { size: 10, color: 0x2f6b3a });
    ab.setEnabled(allDone && !wk.got.all); body.add(ab);
    const left = (8 - new Date().getDay()) % 7 || 7;
    body.add(this.add.text(W / 2, 312, `${left}일 뒤 월요일에 새 도전이 열린다`, font9(10, '#a1b2b6')).setOrigin(0.5));
    body.add(this.add.text(W / 2, 330, '오늘의 임무와 같이 센다', font9(10, '#7d8f94')).setOrigin(0.5));
  },

  // ── 기록: 도감 / 업적 ──
  recordWin(page = 'dex') {
    const sv = this.sv, c = this.modal();
    this.recPage = page; this.dexG ??= 0; this.achP = 0;
    track('record_open', { page });
    c.add(panel(this, 12, 44, W - 24, 392, { fill: 0x1a1426, line: 0x8a6ac8 }));
    const body = this.add.container(0, 0); c.add(body);
    const draw = () => {
      body.removeAll(true);
      [['dex', '도감'], ['ach', '업적']].forEach(([id, name], i) => {
        const x = 90 + i * 90, on = this.recPage === id;
        body.add(this.add.text(x, 64, name, font(on ? 13 : 11, on ? '#ffd75e' : '#7d8f94')).setOrigin(0.5));
        if (on) body.add(this.add.rectangle(x, 76, 44, 2, 0xffd75e));
        if (id === 'ach' && achReady(sv) > 0) body.add(this.add.circle(x + 24, 58, 3.5, 0xff3a3a));
        const hit = this.add.rectangle(x, 64, 80, 24, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => { if (this.recPage === id) return; sfx('click'); this.recPage = id; draw(); });
        body.add(hit);
      });
      body.add(button(this, W - 32, 64, 26, 22, 'X', () => c.close(), { size: 11 }));
      if (this.recPage === 'dex') this.dexDraw(body, draw); else this.achDraw(body, draw);
    };
    draw();
  },

  dexDraw(body, redraw) {
    const st = dexState(this.sv), fb = this.registry.get('fallback') || {};
    body.add(this.add.text(W / 2, 92, `${st.n}/${st.all}칸 · 최대 체력 +${Math.round(st.hp * 1000) / 10}% · 피해 +${Math.round(st.atk * 100)}%`, font(10, '#9ae0ff')).setOrigin(0.5));
    body.add(this.add.text(W / 2, 108, `칸마다 체력 +${DEX_HP * 100}% · 묶음을 다 채우면 피해 +${DEX_SET_ATK * 100}%`, font9(10, '#a1b2b6')).setOrigin(0.5));
    // 묶음 고르기
    const gw = (W - 36) / st.groups.length;
    st.groups.forEach((g, i) => {
      const x = 18 + i * gw, on = i === this.dexG, full = g.n === g.list.length;
      body.add(this.add.rectangle(x + gw / 2, 134, gw - 3, 32, on ? 0x3b2f5c : 0x15111f).setStrokeStyle(1, full ? 0xffd75e : on ? 0xc8a0ff : 0x293845));
      body.add(this.add.text(x + gw / 2, 127, g.name, font9(10, on ? '#ffffff' : '#a1b2b6')).setOrigin(0.5));
      body.add(this.add.text(x + gw / 2, 141, `${g.n}/${g.list.length}`, font9(9, full ? '#ffd75e' : '#7d8f94')).setOrigin(0.5));
      const hit = this.add.rectangle(x + gw / 2, 134, gw - 3, 32, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { if (this.dexG === i) return; sfx('click'); this.dexG = i; redraw(); });
      body.add(hit);
    });
    const g = st.groups[this.dexG], cols = g.list.length > 12 || g.id === 'weapon' ? 4 : 3, cw = (W - 36) / cols;
    const sprite = g.id === 'mob' || g.id === 'boss' || g.id === 'pet', ch = sprite || g.id === 'weapon' ? 58 : g.id === 'egg' ? 60 : 36;
    g.list.forEach((cell, i) => {
      const x = 18 + (i % cols) * cw, y = 156 + Math.floor(i / cols) * (ch + 3);
      body.add(panel(this, x, y, cw - 3, ch, { fill: cell.on ? 0x1d2a22 : 0x15111f, line: cell.on ? 0x5fdc6a : 0x293845 }));
      const cx = x + (cw - 3) / 2;
      let ty = y + 8;
      if (sprite) {
        const sp = this.add.sprite(cx, y + 15, null).play(cell.anim);
        sp.setScale(22 / sp.height);
        if (!cell.on) sp.setTintFill(0x000000).setAlpha(0.7); else if (fb[cell.anim]) sp.setTint((D.MOBS[cell.anim] || D.BOSSES[cell.anim]).color);
        body.add(sp); ty = y + 29;
      } else if (g.id === 'weapon') {
        const w = WTYPES.find(x => x.id === cell.id), ic = skillIcon(this, cx, y + 15, D.SKILLS[w.own], 18);
        if (!cell.on) ic.setAlpha(0.3);
        body.add(ic); ty = y + 29;
      }
      const col = g.id === 'set' && cell.on ? SETS[cell.id].css : cell.on ? '#ffffff' : '#6a6080';
      body.add(this.add.text(cx, ty, cell.name, font9(cell.name.length > 6 ? 9 : 10, col)).setOrigin(0.5, 0));
      body.add(this.add.text(cx, ty + 12, cell.sub, { ...font9(9, cell.on ? '#5fdc6a' : '#7d8f94'), align: 'center', wordWrap: { width: cw - 8 } }).setOrigin(0.5, 0));
    });
  },

  achDraw(body, redraw) {
    const sv = this.sv, own = titles(sv);
    // 칭호: 가진 것 중에서 돌려 고른다
    body.add(this.add.text(24, 86, `칭호  ${sv.title || '없음'}`, font(11, sv.title ? '#ffb050' : '#7d8f94')));
    const tb = button(this, W - 56, 92, 64, 22, own.length ? '바꾸기' : '없음', () => {
      const list = ['', ...own], i = list.indexOf(sv.title || '');
      sv.title = list[(i + 1) % list.length]; save(); track('title_set', { title: sv.title || 'none' }); redraw();
    }, { size: 10 });
    tb.setEnabled(own.length > 0); body.add(tb);
    // 받을 것 → 진행 중 → 받은 것 순서
    const rank = a => sv.ach[a.id] ? 2 : a.v(sv) >= a.need ? 0 : 1;
    const list = ACHIEVES.slice().sort((a, b) => rank(a) - rank(b));
    const pages = Math.ceil(list.length / ACH_PAGE);
    list.slice(this.achP * ACH_PAGE, (this.achP + 1) * ACH_PAGE).forEach((a, i) => {
      const y = 108 + i * 36, got = !!sv.ach[a.id], v = a.v(sv), done = v >= a.need;
      body.add(panel(this, 20, y, W - 40, 32, { fill: got ? 0x141018 : 0x293845, line: done && !got ? 0xffd75e : 0x475c66 }));
      body.add(this.add.text(28, y + 4, a.name + (a.title ? '  · 칭호' : ''), font9(10, got ? '#6a6080' : a.title ? '#ffb050' : '#ffffff')));
      body.add(this.add.text(28, y + 17, `${a.desc} · ${fmt(Math.min(v, a.need))}/${fmt(a.need)}`, font9(10, done ? '#5fdc6a' : '#a1b2b6')));
      const bt = button(this, W - 56, y + 16, 56, 22, got ? '받음' : `   ${a.gem}`, () => {
        if (got || !done) return;
        sv.ach[a.id] = true; grant(sv, { gem: a.gem }); track('achieve_claim', { id: a.id });
        if (a.title && !sv.title) sv.title = a.title;   // 첫 칭호는 바로 낀다
        save(); sfx('win'); this.refreshTop();
        toast(this, a.title ? `칭호 「${a.title}」 획득!` : `보석 +${a.gem}`, '#ffd75e');
        redraw();
      }, { size: 10, color: 0x2f6b3a });
      bt.setEnabled(done && !got); body.add(bt);
      if (!got) body.add(gemIcon(this, W - 72, y + 16, 9));
    });
    if (pages > 1) {
      body.add(this.add.text(W / 2, 410, `${this.achP + 1} / ${pages}`, font(10, '#a1b2b6')).setOrigin(0.5));
      [[-1, W / 2 - 50, '◀'], [1, W / 2 + 50, '▶']].forEach(([d, x, t]) => {
        const ok = this.achP + d >= 0 && this.achP + d < pages;
        const bt = button(this, x, 410, 36, 22, t, () => { if (!ok) return; this.achP += d; redraw(); }, { size: 10 });
        bt.setEnabled(ok); body.add(bt);
      });
    }
  },
};
