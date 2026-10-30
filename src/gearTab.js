// 로비 '장비' 탭: 장비 끼기·분해, 무기 종류, 펫, 스탯. Lobby.prototype에 섞어 쓴다
import * as D from './data.js';
import { save } from './save.js';
import { sfx } from './sfx.js';
import { font, font9, panel, button, fmt, COLOR, toast, weaponIcon } from './ui.js';
import { track } from './log.js';
import {
  SLOTS, slotOf, RARITY, STATS, statText, SETS, EGGS, WTYPES, PETS, PET_MAX, petCost, petPow, SP, SP_RESET_GEM, SKILL_TAG, TAG_NAME,
  spFree, spTotal, gearStats, itemScore, INV_MAX, statMul, ownsW, SP_MILE, SP_MILE_DMG, SP_MILE_HP,
} from './gear.js';

const { W, H } = D;
const PAGE = 24, COLS = 6, CELL = 40;
const SHORT = { hp: '체력', atk: '피해', def: '방어', spd: '이속', mag: '자력', luck: '치명', regen: '회복', cd: '재사용', pet: '펫' };

// 장비 한 칸 그림: 등급 색 테두리 + 등급 색으로 물든 부위 그림. 세트는 안쪽 테두리를 세트 색으로, 숨겨진 템은 ★
export function itemBox(scene, x, y, it, size = 34, on = false) {
  const c = scene.add.container(x, y), rr = RARITY[it.r];
  c.add(scene.add.rectangle(0, 0, size, size, it.r === 4 ? 0x2a0a22 : it.r === 3 ? 0x2a1a08 : 0x1c2935).setStrokeStyle(2, rr.color));
  if (it.set) c.add(scene.add.rectangle(0, 0, size - 6, size - 6).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(SETS[it.set].css).color, 0.9));
  c.add(scene.add.image(0, 0, 'gs_' + it.s).setScale(Math.floor(size * 0.6 / 12 * 2) / 2).setTint(it.r === 0 ? 0xd8d2e8 : Phaser.Display.Color.HexStringToColor(rr.css).color));
  if (it.egg) c.add(scene.add.text(size / 2 - 3, -size / 2 + 1, '★', font(8, '#ff8ae0')).setOrigin(1, 0));
  if (on) c.add(scene.add.text(-size / 2 + 2, size / 2 - 2, 'E', font(8, '#5fdc6a')).setOrigin(0, 1));
  c.setSize(size, size);
  return c;
}

export const GearTab = {
  gearTab() {
    const sv = this.sv, b = this.body;
    this.gearPage ||= 'gear';
    const subs = [['gear', '장비'], ['pet', '펫'], ['stat', '스탯'], ['train', '훈련']];
    subs.forEach(([id, name], i) => {
      const on = this.gearPage === id;
      // 아래 무기 버튼 줄과 똑같이 생겨 헷갈렸다: 위는 글자+밑줄 탭으로 구분한다
      const x = 37 + i * 65.3, t = this.add.text(x, 50, name, font(12, on ? '#ffb85c' : '#a1b2b6', 0)).setOrigin(0.5);
      b.add(t);
      if (on) b.add(this.add.rectangle(x, 62, 45, 2, 0xffb85c));
      const hit = this.add.rectangle(x, 52, 64, 28, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { if (this.busy) return; this.gearPage = id; this.invPage = 0; sfx('click'); this.show('gear'); });
      b.add(hit);
      if (id === 'stat' && spFree(sv) > 0) b.add(this.add.circle(x + t.width / 2 + 6, 45, 3, 0xff5050));
    });
    if (this.gearPage === 'pet') return this.petPage();
    if (this.gearPage === 'stat') return this.statPage();
    if (this.gearPage === 'train') return this.trainTab();
    this.equipPage();
  },

  // ── 장비 ──
  equipPage() {
    const sv = this.sv, b = this.body, g = gearStats(sv);
    // 무기 종류: 버튼이 좁아 이름 대신 그림을 넣고, 고른 무기 이름은 아래 줄에 적는다
    WTYPES.forEach((w, i) => {
      const open = ownsW(sv, w.id), on = sv.wtype === w.id;
      const bt = button(this, 22 + i * 37.6, 82, 35, 22, open ? '' : '?', () => {
        if (this.busy) return;
        if (!open) { sfx('deny'); toast(this, '보스를 처음 잡거나 판을 깨면 무작위로 얻는다', '#ff9a8a'); return; }
        sv.wtype = w.id; save(); sfx('buy'); track('wtype_set', { wtype: w.id }); this.show('gear');
        toast(this, `${w.name}: ${w.desc}`, '#ffd75e');
      }, { size: 10, color: on ? 0x5a3f8a : open ? 0x2a2440 : 0x1a1726 });
      if (open) bt.add(weaponIcon(this, 0, 0, w.id, sv.tier, 18).setAlpha(on ? 1 : 0.7));
      b.add(bt);
    });
    const wt = WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];
    b.add(this.add.text(W / 2, 101, `${wt.name} · ${SP.find(p => p.id === wt.stat).name}을 따른다 · 전용 스킬 「${D.SKILLS[wt.own].name}」`, font9(10, '#a1b2b6')).setOrigin(0.5));
    // 낀 장비 5칸
    SLOTS.forEach((sl, i) => {
      const x = 31 + i * 52, y = 132, u = sv.eq?.[sl.id], it = u && sv.inv.find(v => v.u === u);
      if (it) {
        const box = itemBox(this, x, y, it, 38); b.add(box);
        box.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.busy && this.itemWin(it));
      } else {
        b.add(this.add.rectangle(x, y, 38, 38, 0x0b111a).setStrokeStyle(1, 0x293845));
      }
      b.add(this.add.text(x, y + 25, sl.name, font9(10, '#a1b2b6')).setOrigin(0.5));
    });
    // 합친 효과
    const parts = Object.keys(STATS).filter(k => g[k] > 0.0005).map(k => `${SHORT[k]} +${STATS[k].pct ? Math.round(g[k] * 100) + '%' : g[k].toFixed(1)}`);
    b.add(this.add.text(W / 2, 170, parts.length ? parts.join('  ') : '장비를 끼면 능력치가 오른다', { ...font9(9, '#f2e4bc'), align: 'center', wordWrap: { width: W - 20 } }).setOrigin(0.5, 0));
    const setLine = Object.entries(g.sets).map(([k, n]) => `${SETS[k].name} ${n}/4${n >= 4 ? ' ★' : n >= 2 ? ' ☆' : ''}${SETS[k].w && SETS[k].w !== sv.wtype ? '(' + WTYPES.find(w => w.id === SETS[k].w).name + ')' : ''}`).join('  ');
    if (setLine) { const st = this.add.text(W / 2, 194, setLine, font9(9, '#ffb050')).setOrigin(0.5, 0); st.setScale(Math.min(1, (W - 16) / st.width)); b.add(st); }   // 세트가 여럿이면 양옆이 잘렸다
    // 가방
    const on = new Set(Object.values(sv.eq || {}));
    const inv = (sv.inv || []).slice().sort((a, c) => (on.has(c.u) - on.has(a.u)) || (c.r - a.r) || (itemScore(c) - itemScore(a)));
    const pages = Math.max(1, Math.ceil(inv.length / PAGE));
    this.invPage = Math.min(this.invPage || 0, pages - 1);
    b.add(this.add.text(14, 206, `장비 가방 ${inv.length}/${INV_MAX}`, font(10)));
    const toStat = () => { if (this.busy) return; sfx('click'); track('sp_hint_go'); this.gearPage = 'stat'; this.show('gear'); };
    if (!inv.length) {
      // 언제 얻는지 막연했다(40차): 판을 깨면 1개 확정이라는 걸 숫자로 말한다
      b.add(this.add.text(W / 2, 258, sv.cleared ? '스테이지를 깰 때마다 장비 1개 확정\n빈 칸에는 알아서 낀다' : '1-1을 처음 깨면 장비 1개 확정\n빈 칸에는 알아서 낀다', { ...font9(11, '#a1b2b6'), align: 'center', lineSpacing: 4 }).setOrigin(0.5));
      // 탭의 빨간 점 = 찍을 스탯 포인트. 비었을 땐 가운데 버튼으로 바로 보낸다
      if (spFree(sv) > 0) b.add(button(this, W / 2, 300, 190, 26, `스탯 포인트 ${spFree(sv)}개 찍기 →`, toStat, { size: 11, color: 0x3a3846 }));
      b.add(button(this, W / 2, spFree(sv) > 0 ? 334 : 310, 170, 26, '장비 얻으러 전투하기 →', () => { if (this.busy) return; track('gear_empty_go'); this.show('battle'); }, { size: 11, color: 0x2f6b3a }));
    } else if (spFree(sv) > 0) {
      const t = this.add.text(W - 14, 207, `● 스탯 포인트 ${spFree(sv)} 찍기 →`, font9(10, '#ff8080')).setOrigin(1, 0);
      t.setInteractive({ useHandCursor: true }).on('pointerup', toStat); b.add(t);
    }
    inv.slice(this.invPage * PAGE, this.invPage * PAGE + PAGE).forEach((it, i) => {
      const x = 32 + (i % COLS) * CELL, y = 240 + Math.floor(i / COLS) * CELL;
      const box = itemBox(this, x, y, it, 34, on.has(it.u)); b.add(box);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.busy && this.itemWin(it));
    });
    if (pages > 1) {
      b.add(button(this, 40, 404, 40, 22, '◀', () => { if (this.busy) return; this.invPage = (this.invPage + pages - 1) % pages; this.show('gear'); }, { size: 10 }));
      b.add(this.add.text(80, 404, `${this.invPage + 1}/${pages}`, font9(10, '#a1b2b6')).setOrigin(0.5));
      b.add(button(this, 120, 404, 40, 22, '▶', () => { if (this.busy) return; this.invPage = (this.invPage + 1) % pages; this.show('gear'); }, { size: 10 }));
    }
    const junk = inv.filter(it => it.r === 0 && !on.has(it.u));
    const sb = button(this, W - 62, 404, 104, 22, `일반 ${junk.length}개 분해`, () => {
      if (this.busy || !junk.length) return;
      const st = junk.length * RARITY[0].salvage;
      sv.inv = sv.inv.filter(it => !junk.includes(it)); sv.stone += st; save();
      track('gear_salvage_all', { n: junk.length, stone: st });
      sfx('coin'); this.refreshTop(); this.bump(1); toast(this, `강화석 +${st}`, '#9ae0ff'); this.show('gear');
    }, { size: 9, color: 0x3a3846 });
    // 빈 가방엔 분해 버튼을 안 둔다(탭 몸통에 안 넣으면 다른 탭까지 남는다: 바로 지운다)
    sb.setEnabled(junk.length > 0); if (inv.length) b.add(sb); else sb.destroy();
  },

  // 장비 한 개 창: 옵션, 낀 것과 비교, 끼기·빼기·분해
  itemWin(it) {
    const sv = this.sv, c = this.modal(), rr = RARITY[it.r], sl = slotOf(it.s);
    const curU = sv.eq?.[it.s], cur = curU && curU !== it.u ? sv.inv.find(v => v.u === curU) : null, isOn = curU === it.u;
    c.add(panel(this, 22, 96, W - 44, 302, { fill: 0x1a1426, line: rr.color }));
    c.add(itemBox(this, W / 2, 130, it, 40));
    c.add(this.add.text(W / 2, 160, it.n, font(13, rr.css)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 177, `${rr.name} ${sl.name}${it.egg ? '' : ` · ${it.c + 1}장`}`, font9(10, '#a1b2b6')).setOrigin(0.5));
    let y = 194;
    const line = (txt, col = '#f2e4bc') => { c.add(this.add.text(W / 2, y, txt, font9(10, col)).setOrigin(0.5, 0)); y += 15; };
    Object.entries(it.st).forEach(([k, v], i) => line(statText(k, v), i === 0 ? '#ffffff' : '#c8f0a0'));
    if (it.egg) line(EGGS[it.egg].desc, '#ff8ae0');
    if (it.set) {
      const s = SETS[it.set], n = gearStats(sv).sets[it.set] || 0;
      y += 3; line(`세트 「${s.name}」 (${n}/4)${s.w ? ` · ${WTYPES.find(w => w.id === s.w).name} 전용` : ''}`, s.css);
      line(`2개: ${s.twoTxt}`, n >= 2 ? s.css : '#6a6080'); line(`4개: ${s.fourTxt}`, n >= 4 ? s.css : '#6a6080');
    }
    // 낀 것과 능력치별로 비교(빈칸이면 그대로 오른다)
    if (!isOn) {
      const keys = [...new Set([...Object.keys(it.st), ...Object.keys(cur?.st || {})])];
      const diff = keys.map(k => {
        const d = (it.st[k] || 0) - (cur?.st[k] || 0);
        if (Math.abs(d) < 0.0005) return null;
        const v = STATS[k].pct ? `${Math.round(Math.abs(d) * 1000) / 10}%` : Math.abs(d).toFixed(2);
        return [`${SHORT[k]} ${d > 0 ? '▲' : '▼'}${v}`, d > 0 ? '#5fdc6a' : '#ff8070'];
      }).filter(Boolean);
      y += 3; line(cur ? `낀 「${cur.n}」과 비교` : '빈칸에 끼면', '#a1b2b6');
      if (!diff.length) line('차이 없음', '#a1b2b6');
      // 두 칸씩 줄을 나눠 글자가 중간에서 잘리지 않게
      diff.forEach(([t, col], i) => c.add(this.add.text(W / 2 + (i % 2 ? 6 : -6), y + Math.floor(i / 2) * 13, t, font9(9, col)).setOrigin(i % 2 ? 0 : 1, 0)));
    }
    const eb = button(this, 72, 372, 88, 26, isOn ? '빼기' : '끼기', () => {
      sv.eq ||= {};
      if (isOn) delete sv.eq[it.s]; else sv.eq[it.s] = it.u;
      save(); sfx('buy'); track('gear_equip', { on: !isOn, slot: it.s, rarity: it.r, set: it.set || 'none', egg: it.egg || 'none', power: D.powerOf(sv) });
      c.close();
    }, { size: 11, color: 0x2f6b3a });
    c.add(eb);
    const salv = RARITY[it.r].salvage;
    const xb = button(this, W / 2 + 8, 372, 72, 26, it.egg ? '분해 불가' : `분해 +${salv}`, () => {
      if (it.egg || isOn) return;
      sv.inv = sv.inv.filter(v => v !== it); sv.stone += salv; save();
      track('gear_salvage', { rarity: it.r, stone: salv }); sfx('coin'); c.close(); toast(this, `강화석 +${salv}`, '#9ae0ff');
    }, { size: 10, color: 0x8a2f3a });
    xb.setEnabled(!it.egg && !isOn); c.add(xb);
    c.add(button(this, W - 52, 372, 44, 26, '닫기', () => c.close(), { size: 10 }));
  },

  // ── 펫: 잡은 보스가 작아져 따라온다. 맵마다 잘 듣는 펫이 달라 바꿔 데려간다 ──
  petPage() {
    const sv = this.sv, b = this.body, g = gearStats(sv), fb = this.registry.get('fallback') || {};
    const chN = c => `${c + 1}장`;
    // 한 쪽에 여섯 마리: 장이 늘어 펫이 열여섯이 됐다
    const PER = 6, pages = Math.ceil(PETS.length / PER), pg = Math.min(this.petPg || 0, pages - 1);
    b.add(this.add.text(W / 2, 74, '한 마리를 데려간다 · 맵마다 잘 듣는 펫이 다르다', font9(10, '#a1b2b6')).setOrigin(0.5));
    if (pages > 1) {
      const go = d => { if (this.busy) return; this.petPg = (pg + d + pages) % pages; sfx('click'); this.show('gear'); };
      b.add(button(this, 22, 74, 28, 16, '◀', () => go(-1), { size: 9 }));
      b.add(button(this, W - 22, 74, 28, 16, '▶', () => go(1), { size: 9 }));
      b.add(this.add.text(W - 22, 86, `${pg + 1}/${pages}`, font9(9, '#a1b2b6')).setOrigin(0.5, 0));
    }
    PETS.slice(pg * PER, pg * PER + PER).forEach((p, i) => {
      const y = 86 + i * 50, open = sv.cleared >= p.unlock, lv = sv.pets?.[p.id] || 0, on = sv.pet === p.id;
      b.add(panel(this, 12, y, W - 24, 46, { fill: on ? 0x2e2448 : 0x1a1528, line: on ? 0xffd75e : COLOR.line }));
      // 전투와 같은 모습(보스를 작게)
      if (!open) b.add(this.add.text(34, y + 23, '?', font(14, '#6a6080')).setOrigin(0.5));
      else if (this.anims.exists(p.id)) { const sp = this.add.sprite(34, y + 23, null).play(p.id).setScale(fb[p.id] ? 0.8 : 0.36); if (fb[p.id]) sp.setTint(p.color); b.add(sp); }
      b.add(this.add.text(56, y + 5, open ? `${p.name}  Lv ${lv}` : `??? · ${p.hint}`, font(11, open ? '#ffffff' : '#6a6080')));
      if (!open) { b.add(this.add.text(56, y + 23, '보스를 잡으면 따라온다', font9(10, '#5c6e76'))); return; }
      b.add(this.add.text(56, y + 20, p.desc, font9(10, '#f2e4bc')));
      const fit = `강함 ${[...(p.good || []).map(chN), ...(p.id === 'demonlord' ? ['탑'] : [])].join('·') || '-'}${p.weak ? `  약함 ${p.weak.map(chN).join('·')}` : ''}`;
      b.add(this.add.text(56, y + 33, fit, font9(9, '#8fdc8a')));
      const tb = button(this, W - 50, y + 13, 62, 18, on ? '함께' : '데려가기', () => {
        if (this.busy || on) return;
        sv.pet = p.id; save(); sfx('buy'); track('pet_set', { pet: p.id, lv }); this.show('gear');
      }, { size: 10, color: on ? 0x3a3846 : 0x2f6b3a });
      tb.setEnabled(!on); b.add(tb);
      const cost = petCost(lv), max = lv >= PET_MAX;
      const fbt = button(this, W - 50, y + 34, 62, 18, max ? '최대' : `먹이 ${fmt(cost)}`, () => {
        if (this.busy || max || sv.gold < cost) return;
        sv.gold -= cost; (sv.pets ||= {})[p.id] = lv + 1; save();
        track('pet_feed', { pet: p.id, lv: lv + 1, cost }); sfx('level'); this.refreshTop(); this.bump(0); this.show('gear');
      }, { size: 10 });
      fbt.setEnabled(!max && sv.gold >= cost); b.add(fbt);
    });
    // 한 줄이면 화면 양 끝이 잘려 두 줄로 나눈다
    b.add(this.add.text(W / 2, 386, '맞는 맵이면 효과 ×1.8 (장군·거신은 피해 -20%)', font9(9, '#a1b2b6')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 399, `목걸이로 펫 효과 +${Math.round(g.pet * 100)}%`, font9(9, '#a1b2b6')).setOrigin(0.5));
  },

  // ── 스탯: 스테이지를 처음 깰 때 점수를 받아 찍는다 ──
  statPage() {
    const sv = this.sv, b = this.body, free = spFree(sv), wt = WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];
    sv.sp ||= { str: 0, dex: 0, int: 0, vit: 0 };
    b.add(this.add.text(W / 2, 76, `남은 점수 ${free} / ${spTotal(sv.cleared)}`, font(12, free ? '#ffd75e' : '#ffffff')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 92, '첫 클리어마다 1점, 보스는 2점 더 · 15판 뒤로는 판마다 1점 · 5점마다 보너스', font9(10, '#a1b2b6')).setOrigin(0.5));
    SP.forEach((st, i) => {
      const y = 104 + i * 54, v = sv.sp[st.id] || 0;
      b.add(panel(this, 12, y, W - 24, 48, { fill: 0x1a1528 }));
      b.add(this.add.text(24, y + 7, st.name, font(12, st.css)));
      if (st.id === wt.stat) b.add(this.add.text(W - 44, y + 4, `${wt.name} 스탯`, font9(9, '#ffd75e')).setOrigin(0.5, 0));
      b.add(this.add.text(70, y + 9, String(v), font(11)));
      // 지금 효과와 다음 5점 보너스까지 남은 점수
      const dmgStat = st.id !== 'vit';
      const now = Math.round((dmgStat ? statMul(sv, st.id) - 1 : gearStats({ sp: { vit: v } }).hp) * 100);
      const left = SP_MILE - v % SP_MILE;
      b.add(this.add.text(92, y + 10, `+${now}% · ${left}점 뒤 +${Math.round((dmgStat ? SP_MILE_DMG : SP_MILE_HP) * 100)}%`, font9(9, '#ffd75e')));
      b.add(this.add.text(24, y + 28, st.desc, font9(10, '#f2e4bc')));
      const pb = button(this, W - 44, y + 30, 44, 24, '+1', () => {
        if (this.busy || spFree(sv) <= 0) return;
        sv.sp[st.id] = v + 1; save(); sfx('buy'); track('stat_up', { stat: st.id, v: v + 1, power: D.powerOf(sv) }); this.show('gear');
      }, { size: 11, color: 0x2f6b3a });
      pb.setEnabled(free > 0); b.add(pb);
    });
    // 든 무기의 스탯만 피해를 올린다: 안 맞는 스탯에 찍었으면 경고
    const wrong = SP.filter(p => p.id !== 'vit' && p.id !== wt.stat).reduce((a, p) => a + (sv.sp[p.id] || 0), 0);
    b.add(this.add.text(W / 2, 330, `${wt.name}은 ${SP.find(p => p.id === wt.stat).name}만 피해를 올린다`, font9(10, '#f2e4bc')).setOrigin(0.5));
    if (wrong) b.add(this.add.text(W / 2, 346, `다른 무기 스탯에 ${wrong}점: 지금 무기로는 힘이 안 된다`, font9(10, '#ff8070')).setOrigin(0.5));
    const used = spTotal(sv.cleared) - free;
    const rb = button(this, W / 2, 402, 200, 24, sv.spReset > 0 ? `초기화 (초기화권 ${sv.spReset}장)` : `초기화 (보석 ${SP_RESET_GEM})`, () => {
      if (this.busy || !used) return;
      if (sv.spReset > 0) sv.spReset--;
      else if (sv.gem >= SP_RESET_GEM) sv.gem -= SP_RESET_GEM;
      else { sfx('deny'); toast(this, '보석이 모자라다', '#ff9a8a'); return; }
      sv.sp = { str: 0, dex: 0, int: 0, vit: 0 }; save();
      track('stat_reset', { used }); sfx('win'); this.refreshTop(); toast(this, '스탯을 되돌렸다', '#ffd75e'); this.show('gear');
    }, { size: 10, color: 0x8a2f3a });
    rb.setEnabled(used > 0); b.add(rb);
  },
};
