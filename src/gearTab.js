import { equippedLook } from './cosmetics.js';
// 로비 '장비' 탭: 장비 끼기·분해, 무기 종류, 펫, 스탯. Lobby.prototype에 섞어 쓴다
import * as D from './data.js';
import { save } from './save.js';
import { sfx } from './sfx.js';
import { font, font9, panel, button, fmt, COLOR, toast, weaponIcon } from './ui.js';
import { track } from './log.js';
import { roleOf, petCard } from './petRoles.js';
import {
  SLOTS, slotOf, RARITY, STATS, statText, SETS, EGGS, WTYPES, PETS, PET_MAX, petCost, petPow, SP, SP_RESET_GEM, SKILL_TAG, TAG_NAME,
  spFree, spTotal, gearStats, itemScore, INV_MAX, statMul, ownsW, SP_MILE, SP_MILE_DMG, SP_MILE_HP,
} from './gear.js';
import { sellPrice, tidyList, tidyTotals, tidyApply, sellOne, salvageOne } from './gearSell.js';
import { t, tt } from './i18n.js';

const { W, H } = D;
const PAGE = 24, COLS = 6, CELL = 40;
const SHORT = { hp: t('data.a45ea5'), atk: t('gearTab.f737ae'), def: t('gearTab.2a87c1'), spd: t('gearTab.19377a'), mag: t('data.0d4fff'), luck: t('gearTab.9046ff'), regen: t('data.95ca12'), cd: t('gearTab.275b16'), pet: t('codex.153119') };

// 장비 한 칸 그림: 등급 색 테두리 + 등급 색으로 물든 부위 그림. 세트는 안쪽 테두리를 세트 색으로, 숨겨진 템은 ★
export function itemBox(scene, x, y, it, size = 34, on = false, appearance = false) {
  const c = scene.add.container(x, y), rr = RARITY[it.r];
  c.add(scene.add.rectangle(0, 0, size, size, it.r === 4 ? 0x2a0a22 : it.r === 3 ? 0x2a1a08 : 0x1c2935).setStrokeStyle(2, rr.color));
  if (it.set) c.add(scene.add.rectangle(0, 0, size - 6, size - 6).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(SETS[it.set].css).color, 0.9));
  const hat = appearance && it.s === 'helm' && scene.sv && equippedLook(scene.sv).head;
  if (hat) c.add(scene.add.image(0, 0, `cos_${hat}`).setDisplaySize(size * 0.8, size * 0.8));
  else c.add(scene.add.image(0, 0, 'gs_' + it.s).setScale(Math.floor(size * 0.6 / 12 * 2) / 2).setTint(it.r === 0 ? 0xd8d2e8 : Phaser.Display.Color.HexStringToColor(rr.css).color));
  if (it.egg) c.add(scene.add.text(size / 2 - 3, -size / 2 + 1, '★', font(8, '#ff8ae0')).setOrigin(1, 0));
  if (on) c.add(scene.add.text(-size / 2 + 2, size / 2 - 2, 'E', font(8, '#5fdc6a')).setOrigin(0, 1));
  if (it.lock) {   // 작은 자물쇠(왼쪽 위): 몸통 + 고리
    c.add(scene.add.rectangle(-size / 2 + 6, -size / 2 + 9, 5, 4, 0xffd75e));
    c.add(scene.add.rectangle(-size / 2 + 6, -size / 2 + 5.5, 3, 3).setStrokeStyle(1, 0xffd75e));
  }
  c.setSize(size, size);
  return c;
}

export const GearTab = {
  gearTab() {
    const sv = this.sv, b = this.body;
    this.gearPage ||= 'gear';
    const subs = [['gear', t('contentTab.e17b20')], ['pet', t('codex.153119')], ['stat', t('gearTab.fc1e0d')], ['train', t('gearTab.6c9264')]];
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
        if (!open) { sfx('deny'); toast(this, tt('gearTab.fbdb87'), '#ff9a8a'); return; }
        sv.wtype = w.id; save(); sfx('buy'); track('wtype_set', { wtype: w.id }); this.show('gear');
        toast(this, `${w.name}: ${w.desc}`, '#ffd75e');
      }, { size: 10, color: on ? 0x5a3f8a : open ? 0x2a2440 : 0x1a1726 });
      if (open) bt.add(weaponIcon(this, 0, 0, w.id, sv.tier, 18).setAlpha(on ? 1 : 0.7));
      b.add(bt);
    });
    const wt = WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];
    b.add(this.add.text(W / 2, 101, tt('gearTab.95339e', { name: wt.name, name2: SP.find(p => p.id === wt.stat).name, name3: D.SKILLS[wt.own].name }), font9(10, '#a1b2b6')).setOrigin(0.5));
    // 낀 장비 5칸
    SLOTS.forEach((sl, i) => {
      const x = 31 + i * 52, y = 132, u = sv.eq?.[sl.id], it = u && sv.inv.find(v => v.u === u);
      if (it) {
        const box = itemBox(this, x, y, it, 38, false, true); b.add(box);
        box.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.busy && this.itemWin(it));
      } else {
        b.add(this.add.rectangle(x, y, 38, 38, 0x0b111a).setStrokeStyle(1, 0x293845));
      }
      b.add(this.add.text(x, y + 25, sl.name, font9(10, '#a1b2b6')).setOrigin(0.5));
    });
    // 합친 효과
    const parts = Object.keys(STATS).filter(k => g[k] > 0.0005).map(k => `${SHORT[k]} +${STATS[k].pct ? Math.round(g[k] * 100) + '%' : g[k].toFixed(1)}`);
    b.add(this.add.text(W / 2, 170, parts.length ? parts.join('  ') : tt('gearTab.047469'), { ...font9(9, '#f2e4bc'), align: 'center', wordWrap: { width: W - 20 } }).setOrigin(0.5, 0));
    const setLine = Object.entries(g.sets).map(([k, n]) => `${SETS[k].name} ${n}/4${n >= 4 ? ' ★' : n >= 2 ? ' ☆' : ''}${SETS[k].w && SETS[k].w !== sv.wtype ? '(' + WTYPES.find(w => w.id === SETS[k].w).name + ')' : ''}`).join('  ');
    if (setLine) { const st = this.add.text(W / 2, 189, setLine, font9(9, '#ffb050')).setOrigin(0.5, 0); st.setScale(Math.min(1, (W - 16) / st.width)); b.add(st); }   // 세트가 여럿이면 양옆이 잘렸다
    // 가방
    const on = new Set(Object.values(sv.eq || {}));
    const inv = (sv.inv || []).slice().sort((a, c) => (on.has(c.u) - on.has(a.u)) || (c.r - a.r) || (itemScore(c) - itemScore(a)));
    const pages = Math.max(1, Math.ceil(inv.length / PAGE));
    this.invPage = Math.min(this.invPage || 0, pages - 1);
    b.add(this.add.text(14, 206, tt('gearTab.9cdd32', { length: inv.length, INV_MAX }), font(10)));
    const toStat = () => { if (this.busy) return; sfx('click'); track('sp_hint_go'); this.gearPage = 'stat'; this.show('gear'); };
    if (!inv.length) {
      // 언제 얻는지 막연했다(40차): 판을 깨면 1개 확정이라는 걸 숫자로 말한다
      b.add(this.add.text(W / 2, 258, sv.cleared ? tt('gearTab.ccb737') : tt('gearTab.4661ed'), { ...font9(11, '#a1b2b6'), align: 'center', lineSpacing: 4 }).setOrigin(0.5));
      // 탭의 빨간 점 = 찍을 스탯 포인트. 비었을 땐 가운데 버튼으로 바로 보낸다
      if (spFree(sv) > 0) b.add(button(this, W / 2, 300, 190, 26, tt('gearTab.6de2b3', { spFree: spFree(sv) }), toStat, { size: 11, color: 0x3a3846 }));
      b.add(button(this, W / 2, spFree(sv) > 0 ? 334 : 310, 170, 26, tt('gearTab.5d9a22'), () => { if (this.busy) return; track('gear_empty_go'); this.show('battle'); }, { size: 11, color: 0x2f6b3a }));
    } else if (spFree(sv) > 0) {
      const t = this.add.text(104, 207, tt('gearTab.4f3013', { spFree: spFree(sv) }), font9(10, '#ff8080')).setOrigin(0, 0);
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
    // 가방 위 '한번에 정리': 등급을 골라 판매·분해(낀·잠근·숨겨진 장비는 뺀다). 빈 가방엔 두지 않는다
    if (inv.length) b.add(button(this, W - 50, 214, 84, 16, tt('gearTab.520847'), () => { if (!this.busy) this.tidyWin(); }, { size: 9, color: 0x3a3846 }));
  },

  // 한번에 정리 창: 등급(일반·희귀·영웅)과 방식(판매·분해)을 고르고, 받을 금화·강화석 합계를 보고 확인한다
  tidyWin() {
    const sv = this.sv, c = this.modal();
    this.tidyR ||= [0]; this.tidyMode ||= 'sell';
    const rs = this.tidyR.slice().sort(), list = tidyList(sv, rs), t = tidyTotals(list), sell = this.tidyMode === 'sell';
    const reopen = () => { c.destroy(); this.busy = false; this.tidyWin(); };
    c.add(panel(this, 14, 96, W - 28, 334, { fill: 0x1a1426, line: COLOR.line }));
    c.add(this.add.text(W / 2, 114, tt('gearTab.520847'), font(13)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 134, tt('gearTab.cdfe32'), font9(10, '#a1b2b6')).setOrigin(0.5));
    [0, 1, 2].forEach(r => {
      const on = rs.includes(r), n = tidyList(sv, [r]).length;
      c.add(button(this, 55 + r * 80, 154, 72, 24, `${RARITY[r].name} ${n}`, () => {
        this.tidyR = on ? this.tidyR.filter(x => x !== r) : [...this.tidyR, r]; sfx('click'); reopen();
      }, { size: 10, color: on ? 0x5a3f8a : 0x2a2440 }));
    });
    c.add(this.add.text(W / 2, 182, tt('gearTab.4760a2'), font9(10, '#a1b2b6')).setOrigin(0.5));
    c.add(button(this, W / 2 - 50, 202, 92, 24, tt('gearTab.ff7de0'), () => { this.tidyMode = 'sell'; sfx('click'); reopen(); }, { size: 10, color: sell ? 0x5a3f8a : 0x2a2440 }));
    c.add(button(this, W / 2 + 50, 202, 92, 24, tt('gearTab.4187a2'), () => { this.tidyMode = 'salvage'; sfx('click'); reopen(); }, { size: 10, color: !sell ? 0x5a3f8a : 0x2a2440 }));
    c.add(this.add.rectangle(W / 2, 226, W - 60, 1, 0x293845));
    c.add(this.add.text(W / 2, 240, tt('gearTab.3fea0b', { n: t.n }), font(14)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 262, tt('gearTab.5c892b', { fmt: fmt(t.gold) }), font9(11, sell ? '#ffd75e' : '#6a6080')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 280, tt('gearTab.698685', { fmt: fmt(t.stone) }), font9(11, !sell ? '#9ae0ff' : '#6a6080')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 302, tt('gearTab.079414'), font9(9, '#a1b2b6')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 318, tt('gearTab.d39d30'), font9(9, '#a1b2b6')).setOrigin(0.5));
    // 가방이 꽉 찼을 때 알아서 정리하는 방식
    const auto = sv.bagAuto === 'sell';
    c.add(this.add.text(W / 2, 338, tt('gearTab.8b7de6'), font9(10, '#a1b2b6')).setOrigin(0.5));
    const ab = button(this, W / 2, 358, 120, 22, auto ? tt('gearTab.d9838e') : tt('gearTab.f978a0'), () => {
      sv.bagAuto = auto ? 'salvage' : 'sell'; save(); sfx('click'); track('bag_auto', { mode: sv.bagAuto }); reopen();
    }, { size: 10 });
    c.add(ab);
    const ok = button(this, W / 2 - 52, 408, 92, 28, sell ? tt('gearTab.f1bc97') : tt('gearTab.77338d'), () => {
      if (!list.length) return;
      const r = tidyApply(sv, rs, this.tidyMode); save();
      track('gear_tidy', { mode: this.tidyMode, n: r.n, gold: sell ? r.gold : 0, stone: sell ? 0 : r.stone, rarities: rs.join(',') });
      sfx('coin'); c.close(); toast(this, sell ? tt('gearTab.1f889b', { fmt: fmt(r.gold) }) : tt('gearTab.05442f', { fmt: fmt(r.stone) }), sell ? '#ffd75e' : '#9ae0ff');
    }, { size: 11, color: 0x2f6b3a });
    ok.setEnabled(list.length > 0); c.add(ok);
    c.add(button(this, W / 2 + 52, 408, 92, 28, tt('cosmeticShop.94b7db'), () => c.close(), { size: 10 }));
  },

  // 장비 한 개 창: 옵션, 낀 것과 비교, 끼기·빼기·분해
  itemWin(it) {
    const sv = this.sv, c = this.modal(), rr = RARITY[it.r], sl = slotOf(it.s);
    const curU = sv.eq?.[it.s], cur = curU && curU !== it.u ? sv.inv.find(v => v.u === curU) : null, isOn = curU === it.u;
    c.add(panel(this, 12, 96, W - 24, 334, { fill: 0x1a1426, line: rr.color }));
    c.add(itemBox(this, W / 2, 130, it, 40));
    c.add(this.add.text(W / 2, 160, itemName(it), font(13, rr.css)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 177, `${rr.name} ${sl.name}${it.egg ? '' : t('gearTab.9477f3', { v: it.c + 1 })}`, font9(10, '#a1b2b6')).setOrigin(0.5));
    let y = 194;
    const line = (txt, col = '#f2e4bc') => { c.add(this.add.text(W / 2, y, txt, font9(10, col)).setOrigin(0.5, 0)); y += 15; };
    Object.entries(it.st).forEach(([k, v], i) => line(statText(k, v), i === 0 ? '#ffffff' : '#c8f0a0'));
    if (it.egg) line(EGGS[it.egg].desc, '#ff8ae0');
    if (it.set) {
      const s = SETS[it.set], n = gearStats(sv).sets[it.set] || 0;
      y += 3; line(t('gearTab.c8cff3', { name: s.name, n, v: s.w ? t('gearTab.d383ed', { name: WTYPES.find(w => w.id === s.w).name }) : '' }), s.css);
      line(t('gearTab.68893c', { twoTxt: s.twoTxt }), n >= 2 ? s.css : '#6a6080'); line(t('gearTab.5945e9', { fourTxt: s.fourTxt }), n >= 4 ? s.css : '#6a6080');
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
      y += 3; line(cur ? t('gearTab.50a478', { n: cur.n }) : t('gearTab.3f3b86'), '#a1b2b6');
      if (!diff.length) line(t('gearTab.e2708f'), '#a1b2b6');
      // 두 칸씩 줄을 나눠 글자가 중간에서 잘리지 않게
      diff.forEach(([t, col], i) => c.add(this.add.text(W / 2 + (i % 2 ? 6 : -6), y + Math.floor(i / 2) * 13, t, font9(9, col)).setOrigin(i % 2 ? 0 : 1, 0)));
    }
    // 자물쇠: 잠그면 판매·분해·자동 정리에서 빠진다
    const lk = button(this, W - 50, 130, 56, 20, it.lock ? t('gearTab.d16552') : t('gearTab.4562ee'), () => {
      if (it.lock) delete it.lock; else it.lock = 1;
      save(); sfx('click'); track('gear_lock', { on: !!it.lock, rarity: it.r }); c.destroy(); this.busy = false; this.itemWin(it);
    }, { size: 9, color: it.lock ? 0x5a3f8a : 0x2a2440 });
    c.add(lk);
    const eb = button(this, 62, 414, 88, 26, isOn ? t('gearTab.60af2f') : t('lobby.2fdb4c'), () => {
      sv.eq ||= {};
      if (isOn) delete sv.eq[it.s]; else sv.eq[it.s] = it.u;
      save(); sfx('buy'); track('gear_equip', { on: !isOn, slot: it.s, rarity: it.r, set: it.set || 'none', egg: it.egg || 'none', power: D.powerOf(sv) });
      c.close();
    }, { size: 11, color: 0x2f6b3a });
    c.add(eb);
    // 분해와 판매는 나란히: 강화석이 필요하면 분해, 금화가 급하면 판매
    const salv = RARITY[it.r].salvage, price = sellPrice(it), can = !it.egg && !isOn && !it.lock;
    const xb = button(this, W / 2 - 54, 372, 100, 26, it.egg ? t('gearTab.a603c4') : t('gearTab.1093de', { salv }), () => {
      if (!can) return;
      salvageOne(sv, it); save();
      track('gear_salvage', { rarity: it.r, stone: salv }); sfx('coin'); c.close(); toast(this, t('gearTab.6ab362', { salv }), '#9ae0ff');
    }, { size: 10, color: 0x8a2f3a });
    xb.setEnabled(can); c.add(xb);
    const sb = button(this, W / 2 + 54, 372, 100, 26, it.egg ? t('gearTab.b0ac31') : t('gearTab.66e859', { fmt: fmt(price) }), () => {
      if (!can) return;
      sellOne(sv, it); save();
      track('gear_sell', { rarity: it.r, gold: price }); sfx('coin'); c.close(); toast(this, t('gearTab.1f889b', { fmt: fmt(price) }), '#ffd75e');
    }, { size: 10, color: 0x5a4a1f });
    sb.setEnabled(can); c.add(sb);
    if (it.lock && !it.egg) c.add(this.add.text(W / 2, 394, t('gearTab.f9d80e'), font9(9, '#a1b2b6')).setOrigin(0.5));
    c.add(button(this, W - 62, 414, 88, 26, t('cosmeticShop.94b7db'), () => c.close(), { size: 10 }));
  },

  // ── 펫: 잡은 보스가 작아져 따라온다. 맵마다 잘 듣는 펫이 달라 바꿔 데려간다 ──
  petPage() {
    const sv = this.sv, b = this.body, g = gearStats(sv), fb = this.registry.get('fallback') || {};
    const chN = c => t('lobby.022fbd', { v: c + 1 });
    // 한 쪽에 여섯 마리: 장이 늘어 펫이 열여섯이 됐다
    const PER = 6, pages = Math.ceil(PETS.length / PER), pg = Math.min(this.petPg || 0, pages - 1);
    b.add(this.add.text(W / 2, 74, t('gearTab.056d12'), font9(10, '#a1b2b6')).setOrigin(0.5));
    if (pages > 1) {
      const go = d => { if (this.busy) return; this.petPg = (pg + d + pages) % pages; sfx('click'); this.show('gear'); };
      b.add(button(this, 22, 74, 28, 16, '◀', () => go(-1), { size: 9 }));
      b.add(button(this, W - 22, 74, 28, 16, '▶', () => go(1), { size: 9 }));
      b.add(this.add.text(W - 22, 86, `${pg + 1}/${pages}`, font9(9, '#a1b2b6')).setOrigin(0.5, 0));
    }
    PETS.slice(pg * PER, pg * PER + PER).forEach((p, i) => {
      const y = 86 + i * 50, open = sv.cleared >= p.unlock, lv = sv.pets?.[p.id] || 0, on = sv.pet === p.id;
      b.add(panel(this, 12, y, W - 24, 46, { fill: on ? 0x2e2448 : 0x1a1528, line: on ? 0xffd75e : COLOR.line }));
      if (open) { const hit = this.add.rectangle(12, y, W - 24, 46, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true }); hit.on('pointerup', () => !this.busy && this.petInfo(p)); b.add(hit); }   // 52차: 펫을 누르면 설명 창
      // 전투와 같은 모습(보스를 작게)
      if (!open) b.add(this.add.text(34, y + 23, '?', font(14, '#6a6080')).setOrigin(0.5));
      else if (this.anims.exists(p.id)) { const sp = this.add.sprite(34, y + 23, null).play(p.id).setScale(fb[p.id] ? 0.8 : 0.36); if (fb[p.id]) sp.setTint(p.color); b.add(sp); }
      b.add(this.add.text(56, y + 5, open ? `${p.name}  Lv ${lv}` : `??? · ${p.hint}`, font(11, open ? '#ffffff' : '#6a6080')));
      if (!open) { b.add(this.add.text(56, y + 23, t('gearTab.267e2a'), font9(10, '#5c6e76'))); return; }
      const rl = roleOf(p.id);
      if (rl && this.textures.exists(rl.icon)) { b.add(this.add.image(W - 91, y + 23, rl.icon).setScale(0.62)); { const rn = this.add.text(W - 93, y + 37, rl.name, font9(8, rl.color)).setOrigin(0.5, 0); rn.setScale(Math.min(1, 28 / rn.width)); b.add(rn); } }   // 55차: 오른쪽 버튼과 겹치지 않게
      const fitW = o => { o.setScale(Math.min(1, 118 / o.width)); return o; };   // 52차: 역할 아이콘·버튼과 겹치지 않게 폭 118 안으로
      b.add(fitW(this.add.text(56, y + 20, p.desc, font9(10, '#f2e4bc'))));
      const fit = t('gearTab.d8ac3d', { v: [...(p.good || []).map(chN), ...(p.id === 'demonlord' ? [t('gearTab.86b73a')] : [])].join('·') || '-', v2: p.weak ? t('gearTab.659c1c', { join: p.weak.map(chN).join('·') }) : '' });
      b.add(fitW(this.add.text(56, y + 33, fit, font9(9, '#8fdc8a'))));
      const tb = button(this, W - 50, y + 13, 62, 18, on ? t('gearTab.2101bf') : t('lobby.6d4e70'), () => {
        if (this.busy || on) return;
        sv.pet = p.id; save(); sfx('buy'); track('pet_set', { pet: p.id, lv }); this.show('gear');
      }, { size: 10, color: on ? 0x3a3846 : 0x2f6b3a });
      tb.setEnabled(!on); b.add(tb);
      const cost = petCost(lv), max = lv >= PET_MAX;
      const fbt = button(this, W - 50, y + 34, 62, 18, max ? t('lobby.869e9f') : t('gearTab.316251', { fmt: fmt(cost) }), () => {
        if (this.busy || max || sv.gold < cost) return;
        sv.gold -= cost; (sv.pets ||= {})[p.id] = lv + 1; save();
        track('pet_feed', { pet: p.id, lv: lv + 1, cost }); sfx('level'); this.refreshTop(); this.bump(0); this.show('gear');
      }, { size: 10 });
      fbt.setEnabled(!max && sv.gold >= cost); b.add(fbt);
    });
    // 한 줄이면 화면 양 끝이 잘려 두 줄로 나눈다
    for (const [yy, tx] of [[391, t('gearTab.cb9eee')], [404, t('gearTab.0f4c32', { round: Math.round(g.pet * 100) })]]) { const nt = this.add.text(W / 2, yy, tx, font9(9, '#a1b2b6')).setOrigin(0.5); nt.setScale(Math.min(1, (W - 24) / nt.width)); b.add(nt); }   // 55차: 긴 언어에서 화면 양 끝이 잘리지 않게 폭에 맞춘다
  },

  // 52차: 펫 설명 창(펫을 얻을 때 뜨는 것과 같은 카드) + 장착
  petInfo(p) {
    const sv = this.sv, c = this.modal();
    c.add(panel(this, 14, 60, W - 28, 372, { fill: 0x1a1426, line: p.color }));
    c.add(this.add.text(W / 2, 80, p.name, font(15, '#ffd75e')).setOrigin(0.5));
    petCard(this, c, p, sv, 94);
    const on = sv.pet === p.id;
    const eb = button(this, W / 2 + 46, 404, 84, 28, on ? t('gearTab.2101bf') : t('lobby.818a75'), () => { if (on) return; sv.pet = p.id; save(); sfx('buy'); track('pet_set', { pet: p.id, from: 'info' }); c.close(); }, { size: 11, color: on ? 0x3a3846 : 0x2f6b3a });
    eb.setEnabled(!on); c.add(eb);
    c.add(button(this, W / 2 - 50, 404, 76, 28, t('cosmeticShop.94b7db'), () => c.close(), { size: 10, color: 0x3a3846 }));
  },

  // ── 스탯: 스테이지를 처음 깰 때 점수를 받아 찍는다 ──
  statPage() {
    const sv = this.sv, b = this.body, free = spFree(sv), wt = WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];
    sv.sp ||= { str: 0, dex: 0, int: 0, vit: 0 };
    b.add(this.add.text(W / 2, 76, t('gearTab.735230', { free, spTotal: spTotal(sv.cleared) }), font(12, free ? '#ffd75e' : '#ffffff')).setOrigin(0.5));
    { const nt = this.add.text(W / 2, 92, t('gearTab.d33464'), font9(10, '#a1b2b6')).setOrigin(0.5); nt.setScale(Math.min(1, (W - 24) / nt.width)); b.add(nt); }
    SP.forEach((st, i) => {
      const y = 104 + i * 54, v = sv.sp[st.id] || 0;
      b.add(panel(this, 12, y, W - 24, 48, { fill: 0x1a1528 }));
      b.add(this.add.text(24, y + 7, st.name, font(12, st.css)));
      if (st.id === wt.stat) b.add(this.add.text(W - 44, y + 4, t('gearTab.fc4fa9', { name: wt.name }), font9(9, '#ffd75e')).setOrigin(0.5, 0));
      b.add(this.add.text(70, y + 9, String(v), font(11)));
      // 지금 효과와 다음 5점 보너스까지 남은 점수
      const dmgStat = st.id !== 'vit';
      const now = Math.round((dmgStat ? statMul(sv, st.id) - 1 : gearStats({ sp: { vit: v } }).hp) * 100);
      const left = SP_MILE - v % SP_MILE;
      b.add(this.add.text(92, y + 10, t('gearTab.471fa1', { now, left, round: Math.round((dmgStat ? SP_MILE_DMG : SP_MILE_HP) * 100) }), font9(9, '#ffd75e')));
      b.add(this.add.text(24, y + 28, st.desc, font9(10, '#f2e4bc')));
      const pb = button(this, W - 44, y + 30, 44, 24, '+1', () => {
        if (this.busy || spFree(sv) <= 0) return;
        sv.sp[st.id] = v + 1; save(); sfx('buy'); track('stat_up', { stat: st.id, v: v + 1, power: D.powerOf(sv) }); this.show('gear');
      }, { size: 11, color: 0x2f6b3a });
      pb.setEnabled(free > 0); b.add(pb);
    });
    // 든 무기의 스탯만 피해를 올린다: 안 맞는 스탯에 찍었으면 경고
    const wrong = SP.filter(p => p.id !== 'vit' && p.id !== wt.stat).reduce((a, p) => a + (sv.sp[p.id] || 0), 0);
    b.add(this.add.text(W / 2, 330, t('gearTab.f2ca2a', { name: wt.name, name2: SP.find(p => p.id === wt.stat).name }), font9(10, '#f2e4bc')).setOrigin(0.5));
    if (wrong) b.add(this.add.text(W / 2, 346, t('gearTab.910c53', { wrong }), font9(10, '#ff8070')).setOrigin(0.5));
    const used = spTotal(sv.cleared) - free;
    const rb = button(this, W / 2, 402, 200, 24, sv.spReset > 0 ? t('gearTab.0be0ba', { spReset: sv.spReset }) : t('gearTab.ec7ebb', { SP_RESET_GEM }), () => {
      if (this.busy || !used) return;
      if (sv.spReset > 0) sv.spReset--;
      else if (sv.gem >= SP_RESET_GEM) sv.gem -= SP_RESET_GEM;
      else { sfx('deny'); toast(this, t('lobby.60eef5'), '#ff9a8a'); return; }
      sv.sp = { str: 0, dex: 0, int: 0, vit: 0 }; save();
      track('stat_reset', { used }); sfx('win'); this.refreshTop(); toast(this, t('gearTab.4525c9'), '#ffd75e'); this.show('gear');
    }, { size: 10, color: 0x8a2f3a });
    rb.setEnabled(used > 0); b.add(rb);
  },
};
