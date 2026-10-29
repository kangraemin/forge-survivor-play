// 로비 '장비' 탭: 장비 끼기·분해, 무기 종류, 펫, 스탯. Lobby.prototype에 섞어 쓴다
import * as D from './data.js';
import { save } from './save.js';
import { sfx } from './sfx.js';
import { font, font9, panel, button, fmt, COLOR, toast } from './ui.js';
import { track } from './log.js';
import {
  SLOTS, slotOf, RARITY, STATS, statText, SETS, EGGS, WTYPES, PETS, PET_MAX, petCost, petPow, SP, SP_RESET_GEM, SKILL_TAG, TAG_NAME,
  spFree, spTotal, gearStats, itemScore, INV_MAX, tagMul, SP_MILE, SP_MILE_DMG, SP_MILE_HP,
} from './gear.js';

const { W, H } = D;
const PAGE = 24, COLS = 6, CELL = 40;
const SHORT = { hp: '체력', atk: '피해', def: '방어', spd: '이속', mag: '자력', luck: '치명', regen: '회복', cd: '재사용', pet: '펫' };

// 장비 한 칸 그림: 등급 색 테두리 + 등급 색으로 물든 부위 그림. 세트는 안쪽 테두리를 세트 색으로, 숨겨진 템은 ★
export function itemBox(scene, x, y, it, size = 34, on = false) {
  const c = scene.add.container(x, y), rr = RARITY[it.r];
  c.add(scene.add.rectangle(0, 0, size, size, it.r === 4 ? 0x2a0a22 : it.r === 3 ? 0x2a1a08 : 0x15121f).setStrokeStyle(2, rr.color));
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
    const subs = [['gear', '장비'], ['pet', '펫'], ['stat', '스탯']];
    subs.forEach(([id, name], i) => {
      const on = this.gearPage === id;
      const bt = button(this, 50 + i * 85, 50, 78, 22, name, () => { if (this.busy) return; this.gearPage = id; this.invPage = 0; sfx('click'); this.show('gear'); }, { size: 10, color: on ? 0x5a3f8a : 0x2a2440 });
      b.add(bt);
      if (id === 'stat' && spFree(sv) > 0) b.add(this.add.circle(50 + i * 85 + 34, 42, 4, 0xff5050));
    });
    if (this.gearPage === 'pet') return this.petPage();
    if (this.gearPage === 'stat') return this.statPage();
    this.equipPage();
  },

  // ── 장비 ──
  equipPage() {
    const sv = this.sv, b = this.body, g = gearStats(sv);
    // 무기 종류
    WTYPES.forEach((w, i) => {
      const open = sv.cleared >= w.unlock, on = sv.wtype === w.id;
      const bt = button(this, 50 + i * 85, 78, 78, 20, open ? w.name : `🔒 ${w.name}`, () => {
        if (this.busy) return;
        if (!open) { sfx('deny'); toast(this, `${w.hint} 열린다`, '#ff9a8a'); return; }
        sv.wtype = w.id; save(); sfx('buy'); track('wtype_set', { wtype: w.id }); this.show('gear');
        toast(this, `${w.name}: ${w.desc}`, '#ffd75e');
      }, { size: 10, color: on ? 0x7a5a1a : open ? 0x2f2a44 : 0x1a1726 });
      b.add(bt);
    });
    const wt = WTYPES.find(w => w.id === sv.wtype) || WTYPES[0];
    b.add(this.add.text(W / 2, 96, `${wt.desc} · 전용 스킬 「${D.SKILLS[wt.own].name}」`, font9(10, '#a89cc8')).setOrigin(0.5));
    // 낀 장비 5칸
    SLOTS.forEach((sl, i) => {
      const x = 31 + i * 52, y = 126, u = sv.eq?.[sl.id], it = u && sv.inv.find(v => v.u === u);
      if (it) {
        const box = itemBox(this, x, y, it, 38); b.add(box);
        box.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.busy && this.itemWin(it));
      } else {
        b.add(this.add.rectangle(x, y, 38, 38, 0x0d0a14).setStrokeStyle(1, 0x3a3450));
        b.add(this.add.text(x, y, '빈칸', font9(9, '#5a5070')).setOrigin(0.5));
      }
      b.add(this.add.text(x, y + 25, sl.name, font9(9, '#8a80a0')).setOrigin(0.5));
    });
    // 합친 효과
    const parts = Object.keys(STATS).filter(k => g[k] > 0.0005).map(k => `${SHORT[k]} +${STATS[k].pct ? Math.round(g[k] * 100) + '%' : g[k].toFixed(1)}`);
    b.add(this.add.text(W / 2, 164, parts.length ? parts.join('  ') : '장비를 끼면 능력치가 오른다', { ...font9(9, '#e8e2f8'), align: 'center', wordWrap: { width: W - 20 } }).setOrigin(0.5, 0));
    const setLine = Object.entries(g.sets).map(([k, n]) => `${SETS[k].name} ${n}/4${n >= 4 ? ' ★' : n >= 2 ? ' ☆' : ''}`).join('  ');
    if (setLine) b.add(this.add.text(W / 2, 192, setLine, font9(9, '#ffb050')).setOrigin(0.5, 0));
    // 가방
    const on = new Set(Object.values(sv.eq || {}));
    const inv = (sv.inv || []).slice().sort((a, c) => (on.has(c.u) - on.has(a.u)) || (c.r - a.r) || (itemScore(c) - itemScore(a)));
    const pages = Math.max(1, Math.ceil(inv.length / PAGE));
    this.invPage = Math.min(this.invPage || 0, pages - 1);
    b.add(this.add.text(14, 206, `장비 가방 ${inv.length}/${INV_MAX}`, font(10, '#ffd75e')));
    if (!inv.length) b.add(this.add.text(W / 2, 270, '스테이지를 깨거나\n정예·보물 고블린을 잡으면 장비가 나온다', { ...font9(10, '#8a80a0'), align: 'center' }).setOrigin(0.5));
    inv.slice(this.invPage * PAGE, this.invPage * PAGE + PAGE).forEach((it, i) => {
      const x = 32 + (i % COLS) * CELL, y = 240 + Math.floor(i / COLS) * CELL;
      const box = itemBox(this, x, y, it, 34, on.has(it.u)); b.add(box);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.busy && this.itemWin(it));
    });
    if (pages > 1) {
      b.add(button(this, 40, 404, 40, 22, '◀', () => { if (this.busy) return; this.invPage = (this.invPage + pages - 1) % pages; this.show('gear'); }, { size: 10 }));
      b.add(this.add.text(80, 404, `${this.invPage + 1}/${pages}`, font9(10, '#a89cc8')).setOrigin(0.5));
      b.add(button(this, 120, 404, 40, 22, '▶', () => { if (this.busy) return; this.invPage = (this.invPage + 1) % pages; this.show('gear'); }, { size: 10 }));
    }
    const junk = inv.filter(it => it.r === 0 && !on.has(it.u));
    const sb = button(this, W - 62, 404, 104, 22, `일반 ${junk.length}개 분해`, () => {
      if (this.busy || !junk.length) return;
      const st = junk.length * RARITY[0].salvage;
      sv.inv = sv.inv.filter(it => !junk.includes(it)); sv.stone += st; save();
      track('gear_salvage_all', { n: junk.length, stone: st });
      sfx('coin'); this.refreshTop(); this.bump(1); toast(this, `강화석 +${st}`, '#9ae0ff'); this.show('gear');
    }, { size: 9, color: 0x5a3a2a });
    sb.setEnabled(junk.length > 0); b.add(sb);
  },

  // 장비 한 개 창: 옵션, 낀 것과 비교, 끼기·빼기·분해
  itemWin(it) {
    const sv = this.sv, c = this.modal(), rr = RARITY[it.r], sl = slotOf(it.s);
    const curU = sv.eq?.[it.s], cur = curU && curU !== it.u ? sv.inv.find(v => v.u === curU) : null, isOn = curU === it.u;
    c.add(panel(this, 22, 96, W - 44, 302, { fill: 0x1a1426, line: rr.color }));
    c.add(itemBox(this, W / 2, 130, it, 40));
    c.add(this.add.text(W / 2, 160, it.n, font(13, rr.css)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 177, `${rr.name} ${sl.name}${it.egg ? '' : ` · ${it.c + 1}장`}`, font9(10, '#a89cc8')).setOrigin(0.5));
    let y = 194;
    const line = (txt, col = '#e8e2f8') => { c.add(this.add.text(W / 2, y, txt, font9(10, col)).setOrigin(0.5, 0)); y += 15; };
    Object.entries(it.st).forEach(([k, v], i) => line(statText(k, v), i === 0 ? '#ffffff' : '#c8f0a0'));
    if (it.egg) line(EGGS[it.egg].desc, '#ff8ae0');
    if (it.set) {
      const s = SETS[it.set], n = gearStats(sv).sets[it.set] || 0;
      y += 3; line(`세트 「${s.name}」 (${n}/4)`, s.css);
      line(`2개: ${s.twoTxt}`, n >= 2 ? s.css : '#6a6080'); line(`4개: ${s.fourTxt}`, n >= 4 ? s.css : '#6a6080');
    }
    // 낀 것과 능력치별로 비교(빈칸이면 그대로 오른다)
    if (!isOn) {
      const keys = [...new Set([...Object.keys(it.st), ...Object.keys(cur?.st || {})])];
      const diff = keys.map(k => {
        const d = (it.st[k] || 0) - (cur?.st[k] || 0);
        if (Math.abs(d) < 0.0005) return null;
        const v = STATS[k].pct ? `${Math.round(Math.abs(d) * 1000) / 10}%` : Math.abs(d).toFixed(2);
        return `${SHORT[k]} ${d > 0 ? '▲' : '▼'}${v}`;
      }).filter(Boolean);
      y += 3; line(cur ? `낀 「${cur.n}」과 비교` : '빈칸에 끼면', '#a89cc8');
      c.add(this.add.text(W / 2, y, diff.join('  ') || '차이 없음', { ...font9(9, '#e8e2f8'), align: 'center', wordWrap: { width: W - 64 } }).setOrigin(0.5, 0));
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
    }, { size: 10, color: 0x5a3a2a });
    xb.setEnabled(!it.egg && !isOn); c.add(xb);
    c.add(button(this, W - 52, 372, 44, 26, '닫기', () => c.close(), { size: 10 }));
  },

  // ── 펫 ──
  petPage() {
    const sv = this.sv, b = this.body, g = gearStats(sv);
    b.add(this.add.text(W / 2, 76, '한 마리를 데려간다 · 금화로 먹이를 주면 세진다', font9(10, '#a89cc8')).setOrigin(0.5));
    PETS.forEach((p, i) => {
      const y = 90 + i * 92, open = sv.cleared >= p.unlock, lv = sv.pets?.[p.id] || 0, on = sv.pet === p.id;
      b.add(panel(this, 12, y, W - 24, 86, { fill: on ? 0x2e2448 : 0x1a1528, line: on ? 0xffd75e : COLOR.line }));
      b.add(this.add.circle(42, y + 30, 18, p.color, open ? 0.25 : 0.1).setStrokeStyle(1, p.color, open ? 0.8 : 0.3));
      // 전투와 같은 모습으로 보여 준다(슬라임·박쥐는 몬스터 그림에 색, 불씨는 불덩이)
      const anim = { slime: 'slime', bat: 'bat' }[p.id];
      if (!open) b.add(this.add.text(42, y + 30, '?', font(14)).setOrigin(0.5));
      else if (anim && this.anims.exists(anim)) b.add(this.add.sprite(42, y + 30, null).play(anim).setScale(0.9).setTint(p.color));
      else { const f = this.add.image(42, y + 30, 'fireball').setScale(2.6).setBlendMode(Phaser.BlendModes.ADD); b.add(f); this.tweens.add({ targets: f, scale: 3, duration: 400, yoyo: true, repeat: -1 }); }
      b.add(this.add.text(66, y + 8, open ? `${p.name}  Lv ${lv}` : `??? (${p.hint})`, font(11, open ? '#ffffff' : '#6a6080')));
      b.add(this.add.text(66, y + 26, open ? p.desc : '스테이지를 더 깨면 만난다', font9(10, open ? '#e8e2f8' : '#5a5070')));
      if (!open) return;
      b.add(this.add.text(66, y + 42, `위력 ${Math.round(petPow(lv) * (1 + g.pet) * 100)}%${lv < PET_MAX ? ` → ${Math.round(petPow(lv + 1) * (1 + g.pet) * 100)}%` : ''}`, font9(10, '#ffd75e')));
      const tb = button(this, 66 + 44, y + 68, 88, 22, on ? '함께하는 중' : '데려가기', () => {
        if (this.busy || on) return;
        sv.pet = p.id; save(); sfx('buy'); track('pet_set', { pet: p.id, lv }); this.show('gear');
      }, { size: 10, color: on ? 0x3b2f5c : 0x2f6b3a });
      tb.setEnabled(!on); b.add(tb);
      const cost = petCost(lv), max = lv >= PET_MAX;
      const fb = button(this, W - 62, y + 68, 90, 22, max ? '최대' : `먹이 ${fmt(cost)}`, () => {
        if (this.busy || max || sv.gold < cost) return;
        sv.gold -= cost; (sv.pets ||= {})[p.id] = lv + 1; save();
        track('pet_feed', { pet: p.id, lv: lv + 1, cost }); sfx('level'); this.refreshTop(); this.bump(0); this.show('gear');
      }, { size: 10, color: 0x7a5a1a });
      fb.setEnabled(!max && sv.gold >= cost); b.add(fb);
    });
    b.add(this.add.text(W / 2, 372, `펫 목걸이(장비)를 끼면 펫 피해가 오른다 · 지금 +${Math.round(g.pet * 100)}%`, font9(10, '#a89cc8')).setOrigin(0.5));
  },

  // ── 스탯: 스테이지를 처음 깰 때 점수를 받아 찍는다 ──
  statPage() {
    const sv = this.sv, b = this.body, free = spFree(sv);
    sv.sp ||= { str: 0, dex: 0, int: 0, vit: 0 };
    b.add(this.add.text(W / 2, 76, `남은 점수 ${free} / ${spTotal(sv.cleared)}`, font(12, free ? '#ffd75e' : '#ffffff')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 92, '첫 클리어마다 1점, 보스는 2점 더 · 5점마다 보너스', font9(10, '#a89cc8')).setOrigin(0.5));
    SP.forEach((st, i) => {
      const y = 104 + i * 54, v = sv.sp[st.id] || 0;
      b.add(panel(this, 12, y, W - 24, 48, { fill: 0x1a1528 }));
      b.add(this.add.text(24, y + 7, st.name, font(12, st.css)));
      b.add(this.add.text(70, y + 9, String(v), font(11)));
      // 지금 효과와 다음 5점 보너스까지 남은 점수
      const now = Math.round((st.tag ? tagMul(sv, st.tag) - 1 : gearStats({ sp: { vit: v } }).hp) * 100);
      const left = SP_MILE - v % SP_MILE;
      b.add(this.add.text(92, y + 10, `+${now}% · ${left}점 뒤 +${Math.round((st.tag ? SP_MILE_DMG : SP_MILE_HP) * 100)}%`, font9(9, '#ffd75e')));
      b.add(this.add.text(24, y + 28, st.desc, font9(10, '#e8e2f8')));
      const pb = button(this, W - 44, y + 24, 44, 28, '+1', () => {
        if (this.busy || spFree(sv) <= 0) return;
        sv.sp[st.id] = v + 1; save(); sfx('buy'); track('stat_up', { stat: st.id, v: v + 1, power: D.powerOf(sv) }); this.show('gear');
      }, { size: 11, color: 0x2f6b3a });
      pb.setEnabled(free > 0); b.add(pb);
    });
    // 어떤 스킬이 어느 스탯을 따르는지
    const by = tag => Object.entries(SKILL_TAG).filter(([, t]) => t === tag).map(([k]) => D.SKILLS[k].name).join('·');
    b.add(this.add.text(W / 2, 324, ['melee', 'ranged', 'magic'].map(t => `${TAG_NAME[t]}: ${by(t)}`).join('\n'), { ...font9(9, '#8a80a0'), align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0));
    const used = spTotal(sv.cleared) - free;
    const rb = button(this, W / 2, 402, 200, 24, sv.spReset > 0 ? `초기화 (초기화권 ${sv.spReset}장)` : `초기화 (보석 ${SP_RESET_GEM})`, () => {
      if (this.busy || !used) return;
      if (sv.spReset > 0) sv.spReset--;
      else if (sv.gem >= SP_RESET_GEM) sv.gem -= SP_RESET_GEM;
      else { sfx('deny'); toast(this, '보석이 모자라다', '#ff9a8a'); return; }
      sv.sp = { str: 0, dex: 0, int: 0, vit: 0 }; save();
      track('stat_reset', { used }); sfx('win'); this.refreshTop(); toast(this, '스탯을 되돌렸다', '#ffd75e'); this.show('gear');
    }, { size: 10, color: 0x5a2f8a });
    rb.setEnabled(used > 0); b.add(rb);
  },
};
