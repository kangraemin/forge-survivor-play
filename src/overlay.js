// 전투 위에 뜨는 창: 레벨업 3택, 스킬 상자, 웨이브 사이 상점, 일시정지, 결과
import * as D from './data.js';
import { save, mission } from './save.js';
import { sfx, stopBgm } from './sfx.js';
import { font, font9, panel, button, icon, fmt, COLOR, toast, gemIcon, fixedContainer, skillIcon, onTap } from './ui.js';
import { showAd, adsLeft } from './shop.js';

const { W, H } = D;
const DEPTH = 150;

export class Overlay {
  constructor(s) { this.s = s; this.open = null; this.pendingLv = 0; this.queue = []; }

  // 창을 열면 전투가 멈춘다. 닫으면 대기 중인 창(레벨업 등)을 이어서 연다
  begin(name) {
    const s = this.s;
    this.open = name;
    s.paused = true; s.physics.pause(); s.anims.pauseAll();
    // 이동 안내가 창 뒤로 비치지 않게 바로 지운다
    s.hint?.forEach(o => { s.tweens.killTweensOf(o); o.destroy(); }); s.hint = null;
    s.joy.o = null; s.joy.v.reset(); s.joy.base.setVisible(false); s.joy.knob.setVisible(false);
    s.showUlt?.(false);   // 창 아래 안내 글과 겹치지 않게 궁극기 버튼을 숨긴다
    const c = fixedContainer(s).setDepth(DEPTH);
    const dim = s.add.rectangle(0, 0, W, H, 0x05030a, 0.72).setOrigin(0).setInteractive();
    c.add(dim); c.setAlpha(0);
    s.tweens.add({ targets: c, alpha: 1, duration: 140 });
    this.c = c;
    return c;
  }
  // c를 넘기면 그 창이 아직 열려 있을 때만 닫는다(늦게 온 콜백·연타가 다른 창을 닫지 않게)
  end(c = this.c) {
    const s = this.s;
    if (!c || c !== this.c) return;
    this.open = null; this.c = null;
    s.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() });
    // 다음 창을 여는 10ms 동안 다른 창이 끼어들지 않게 자리를 잡아 둔다
    if (this.pendingLv > 0) { this.pendingLv--; this.open = 'next'; s.time.delayedCall(10, () => { if (this.open !== 'next') return; this.open = null; this.levelUp(true); }); return; }
    const next = this.queue.shift();
    if (next) { this.open = 'next'; s.time.delayedCall(10, () => { if (this.open !== 'next') return; this.open = null; next(); }); return; }
    s.paused = false; s.physics.resume(); s.anims.resumeAll();
    s.showUlt?.(true);
  }

  // ── 레벨업: 3장 중 하나 ──
  choices() {
    const sk = this.s.run.skills;
    const act = Object.keys(sk).filter(k => D.SKILLS[k].type === 'active').length;
    const pas = Object.keys(sk).filter(k => D.SKILLS[k].type === 'passive').length;
    const first = this.s.sv.stats.runs <= 1 && this.s.run.lv === 2;
    const pool = [];
    for (const [k, def] of Object.entries(D.SKILLS)) {
      const lv = sk[k] || 0;
      if (lv >= D.SKILL_MAX || this.s.run.banned?.[k]) continue;
      if (!lv && (def.type === 'active' ? act >= D.ACTIVE_SLOTS : pas >= D.PASSIVE_SLOTS)) continue;
      // 처음 하는 사람의 첫 레벨업은 바로 눈에 보이는 공격 스킬만 보여 준다
      if (first && def.type !== 'active') continue;
      // 이미 가진 걸 키우는 쪽을 조금 더 자주 보여 준다(빌드가 완성되는 맛)
      // 액티브가 Lv3을 넘었는데 진화 짝 패시브가 없으면 그 패시브를 크게 밀어 준다(한 판 안에 진화가 닿게)
      const pair = !lv && def.type === 'passive' && Object.entries(D.EVOS).some(([b, e]) => e.need === k && (sk[b] || 0) >= 3);
      pool.push({ k, w: pair ? 8 : lv ? 3 : def.type === 'active' ? 2.2 : 1.6 });
    }
    const out = [];
    // 진화할 수 있으면 첫 칸에 반드시 띄운다
    for (const [k, e] of Object.entries(D.EVOS)) {
      if (out.length < 2 && sk[k] >= D.SKILL_MAX && sk[e.need] && !this.s.run.evo[k]) out.push('_evo_' + k);
    }
    while (out.length < 3 && pool.length) {
      let r = Math.random() * pool.reduce((a, b) => a + b.w, 0), i = 0;
      while ((r -= pool[i].w) > 0) i++;
      out.push(pool.splice(i, 1)[0].k);
    }
    if (!out.length) out.push('_heal', '_silver');
    return out;
  }

  levelUp(fromQueue = false) {
    if (this.open && !fromQueue) { this.pendingLv++; return; }
    const s = this.s;
    sfx('level');
    s.log('levelup_show', { first: s.sv.stats.runs <= 1 && s.run.lv === 2 });
    const c = this.begin('level');
    // 주인공 머리 위로 빛기둥
    const pil = s.add.sprite(s.hero.x, s.hero.y + 20, 'fx2_r2s').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH - 1).setTint(0x9ad8ff).play('fxPillar');
    pil.once('animationcomplete', () => pil.destroy());
    c.add(s.add.text(W / 2, 100, 'LEVEL UP!', font(20, '#6fd3ff')).setOrigin(0.5));
    // 처음 하는 사람에게는 같은 자리에서 고르는 법을 알려 준다(카드와 겹치지 않게)
    const firstLv = s.sv.stats.runs <= 1 && s.run.lv === 2;
    c.add(s.add.text(W / 2, 122, firstLv ? '▼ 아래 카드 하나를 눌러 고르세요' : `Lv ${s.run.lv}  ·  스킬을 하나 고르세요`, font9(11, firstLv ? '#ffffff' : '#d8d2e8')).setOrigin(0.5));
    const cards = s.add.container(0, 0); c.add(cards);
    const draw = () => {
      cards.removeAll(true);
      this.choices().forEach((k, i) => cards.add(this.card(k, W / 2, 172 + i * 78, i)));
      banTxt.setText(r.banLeft > 0 ? `카드 모서리 X를 누르면 이번 판에서 뺀다 · ${r.banLeft}번` : '');
    };
    const r = s.run;
    if (r.banLeft === undefined) r.banLeft = D.BANISH_PER_RUN;
    const banTxt = s.add.text(W / 2, 432, '', font9(10, '#8a80a0')).setOrigin(0.5); c.add(banTxt);
    this.redraw = draw;
    draw();
    // 처음 하는 사람: 첫 레벨업 카드를 반짝여 고르는 곳을 알려 준다
    if (firstLv) {
      banTxt.setText('');
      const glow = s.add.rectangle(W / 2, 172, 236, 76).setStrokeStyle(2, 0xffffff).setAlpha(0); c.add(glow);
      s.tweens.add({ targets: glow, alpha: 1, duration: 350, yoyo: true, repeat: -1, delay: 300 });
    }
    const label = () => r.freeReroll > 0 ? '다시 뽑기 (무료)' : `다시 뽑기  은화 ${this.lvReroll()}`;
    const rb = button(s, W / 2, 400, 150, 28, label(), () => {
      if (r.freeReroll > 0) r.freeReroll--;
      else if (r.silver >= this.lvReroll()) { r.silver -= this.lvReroll(); r.lvRerolls = (r.lvRerolls || 0) + 1; }
      else return;
      s.log('levelup_reroll', { n: r.lvRerolls || 0, silver: r.silver });
      sfx('buy'); draw(); rb.label.setText(label()); rb.setEnabled(r.freeReroll > 0 || r.silver >= this.lvReroll());
    }, { size: 10, color: 0x3b2f5c });
    rb.setEnabled(r.freeReroll > 0 || r.silver >= this.lvReroll());
    c.add(rb);
    c.add(s.add.text(W / 2, 418, `은화 ${r.silver}`, font9(11, '#d8e0f0')).setOrigin(0.5));
    if (s.bot) s.time.delayedCall(150, () => this.pick(cards.list[0]?.key));
  }
  lvReroll() { return 8 + 6 * (this.s.run.lvRerolls || 0); }

  card(k, x, y, i) {
    const s = this.s, sk = s.run.skills;
    const c = s.add.container(x, y); c.key = k;
    if (k.startsWith('_evo_')) return this.evoCard(k, x, y, i);
    const special = k[0] === '_';
    const def = special ? null : D.SKILLS[k], lv = sk[k] || 0;
    const isAct = def?.type === 'active';
    const firstRun = s.sv.stats.runs <= 1;
    const canBan = !special && s.run.banLeft > 0 && !(firstRun && s.run.lv === 2);
    c.add(panel(s, -115, -35, 230, 70, { fill: lv ? 0x241d38 : 0x1c1830, line: isAct ? 0x6fd3ff : 0xffd75e }));
    c.add(s.add.rectangle(-88, 0, 40, 40, 0x000000, 0.4).setStrokeStyle(1, isAct ? 0x6fd3ff : 0xffd75e, 0.6));
    c.add(special ? icon(s, -88, 0, k === '_heal' ? 14 : 12, 32) : skillIcon(s, -88, 0, def, 32));
    const name = special ? (k === '_heal' ? '회복 물약' : '은화 주머니') : def.name;
    c.add(s.add.text(-60, -24, name, font(12, isAct ? '#9ae0ff' : '#ffe08a')));
    c.add(s.add.text(canBan ? 84 : 108, -24, special ? '' : lv ? `Lv ${lv} → ${lv + 1}` : '새 스킬', font(11, lv ? '#ffffff' : '#5fdc6a')).setOrigin(1, 0));
    let desc = special ? (k === '_heal' ? '체력 30% 회복' : '은화 +25') : def.type === 'passive' ? def.desc[0] : def.desc[lv];
    if (def?.bonus && lv + 1 === D.PASSIVE_LV3) desc += `\n+ Lv3 보너스: ${def.bonus}`;
    c.add(s.add.text(-60, -6, desc, { ...font9(11, '#e8e2f8'), wordWrap: { width: 165 } }).setLineSpacing(1));
    // 레벨 칸
    if (!special) for (let j = 0; j < D.SKILL_MAX; j++) c.add(s.add.rectangle(-60 + j * 9, 26, 7, 4, j < lv ? 0xffd75e : j === lv ? 0x5fdc6a : 0x3a3450).setOrigin(0, 0.5));
    // 진화 재료 표시: 이 스킬이 다른 스킬의 진화에 쓰이면 짝을 알려 준다
    const evoOf = special ? null : def.type === 'active' ? D.EVOS[k] && D.SKILLS[D.EVOS[k].need].name : Object.keys(D.EVOS).filter(b => D.EVOS[b].need === k).map(b => D.SKILLS[b].name).join('·');
    if (evoOf && !firstRun && !(def.type === 'active' && s.run.evo[k])) c.add(s.add.text(108, 26, def.type === 'active' ? `+${evoOf} → 진화` : `${evoOf} 진화 재료`, font9(evoOf.length > 6 ? 10 : 11, '#e0b060')).setOrigin(1, 0.5));
    c.setSize(230, 70).setInteractive({ useHandCursor: true });
    onTap(c, () => this.pick(k, c));
    // 추방: 이번 판에서 다시 안 나온다(첫 레벨업에는 숨김)
    if (canBan) {
      // 카드 오른쪽 위 모서리에 붙인다. 글꼴에 따라 ✕가 x로 보여 선 두 개로 그린다
      const x = s.add.container(103, -24);
      x.add(s.add.rectangle(0, 0, 24, 22, 0x2a0e16, 0.9).setStrokeStyle(1, 0xc06070));
      const g = s.add.graphics().lineStyle(2, 0xff8090).lineBetween(-5, -5, 5, 5).lineBetween(-5, 5, 5, -5); x.add(g);
      x.setSize(28, 26).setInteractive({ useHandCursor: true });
      onTap(x, (p, lx, ly, ev) => {
        ev?.stopPropagation();
        if (this.picking || s.run.banLeft <= 0) return;
        s.run.banLeft--; (s.run.banned ||= {})[k] = true; sfx('deny'); this.redraw?.();
      });
      c.add(x);
    }
    c.setScale(0.6).setAlpha(0);
    s.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, delay: i * 70, ease: 'Back.Out' });
    return c;
  }

  // 진화 카드: 금테두리, 반짝임
  evoCard(k, x, y, i) {
    const s = this.s, base = k.slice(5), e = D.EVOS[base];
    const c = s.add.container(x, y); c.key = k;
    c.add(panel(s, -115, -35, 230, 70, { fill: 0x3a2a10, line: 0xffd75e }));
    const shine = s.add.rectangle(0, 0, 230, 70, 0xffd75e, 0.18); c.add(shine);
    s.tweens.add({ targets: shine, alpha: 0.02, duration: 500, yoyo: true, repeat: -1 });
    c.add(s.add.rectangle(-88, 0, 40, 40, 0x000000, 0.4).setStrokeStyle(2, 0xffd75e));
    c.add(icon(s, -88, 0, D.SKILLS[base].icon, 32));
    c.add(s.add.text(-60, -24, e.name, font(12, '#ffd75e')));
    c.add(s.add.text(108, -24, '진화!', font(11, '#ff9a3a')).setOrigin(1, 0));
    c.add(s.add.text(-60, -6, e.desc, { ...font9(11, '#fff2c8'), wordWrap: { width: 165 } }));
    c.add(s.add.text(-60, 20, `${D.SKILLS[base].name} + ${D.SKILLS[e.need].name}`, font9(11, '#c8a060')));
    c.setSize(230, 70).setInteractive({ useHandCursor: true });
    onTap(c, () => this.pick(k, c));
    c.setScale(0.6).setAlpha(0);
    s.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, delay: i * 70, ease: 'Back.Out' });
    return c;
  }

  pick(k, cardObj) {
    if (!k || this.picking) return;
    this.picking = true;
    const s = this.s, r = s.run;
    s.log('skill_pick', { skill: k, skill_lv: k.startsWith('_') ? undefined : (r.skills[k] || 0) + 1, evo: k.startsWith('_evo_'), skills: Object.keys(r.skills).length });
    if (k.startsWith('_evo_')) {
      const base = k.slice(5);
      r.evo[base] = true; s.refreshSkillRow();
      s.cameras.main.flash(300, 255, 220, 120);
      s.banner(D.EVOS[base].name, '무기가 진화했다!');
    } else if (k === '_heal') s.heal(s.maxHp * 0.3);
    else if (k === '_silver') r.silver += 25;
    else {
      r.skills[k] = (r.skills[k] || 0) + 1;
      if (k === 'vigor') { s.maxHp += 20; s.hp += 20; }
      s.refreshSkillRow();
    }
    sfx('buy');
    const oc = this.c, after = () => { this.picking = false; this.end(oc); };
    if (cardObj) {
      s.tweens.add({ targets: cardObj, scale: 1.08, duration: 90, yoyo: true, onComplete: after });
    } else after();
  }

  // ── 스킬 상자: 가진 스킬 중 하나가 무료로 오른다 ──
  chest() {
    if (this.open) { this.queue.push(() => this.chest()); return; }
    const s = this.s, sk = s.run.skills;
    const can = Object.keys(sk).filter(k => sk[k] < D.SKILL_MAX);
    const c = this.begin('chest');
    sfx('success');
    const box = s.add.image(W / 2, 210, 'chest').setScale(4);
    c.add(box);
    s.tweens.add({ targets: box, angle: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: 4 });
    const k = Phaser.Utils.Array.GetRandom(can);
    s.time.delayedCall(450, () => {
      const pil = s.add.sprite(W / 2, 240, 'fx2_r2s').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setScale(1.6).play('fxPillar');
      c.add(pil);
      box.setVisible(false);
      s.log('chest_open', { skill: k || '_silver' });
      if (k) {
        sk[k]++;
        if (k === 'vigor') { s.maxHp += 20; s.hp += 20; }
        s.refreshSkillRow();
        c.add(skillIcon(s, W / 2, 200, D.SKILLS[k], 40));
        c.add(s.add.text(W / 2, 240, `${D.SKILLS[k].name}  Lv ${sk[k]}`, font(13, '#ffd75e')).setOrigin(0.5));
      } else { s.run.silver += 40; c.add(s.add.text(W / 2, 240, '은화 +40', font(13, '#ffd75e')).setOrigin(0.5)); }
      c.add(s.add.text(W / 2, 270, '스킬 상자!', font9(10)).setOrigin(0.5));
      s.time.delayedCall(1100, () => this.end(c));
    });
  }

  // ── 웨이브 사이 상점: 은화는 판이 끝나면 사라지니 여기서 쓴다 ──
  shop(onDone) {
    if (this.open) { this.queue.push(() => this.shop(onDone)); return; }
    const s = this.s, r = s.run;
    const c = this.begin('shop');
    const round = r.shopRound;
    s.log('run_shop_open', { round, silver: r.silver });
    let rerolls = 0;
    c.add(panel(s, 10, 60, W - 20, 380, { fill: 0x1a1426 }));
    c.add(s.add.text(W / 2, 78, '떠돌이 상인', font(15, '#ffd75e')).setOrigin(0.5));
    c.add(s.add.text(W / 2, 96, '은화는 판이 끝나면 사라진다', font9(10, '#a89cc8')).setOrigin(0.5));
    const silverTxt = s.add.text(W / 2, 116, '', font(12, '#e8eef8')).setOrigin(0.5); c.add(silverTxt);
    const hpTxt = s.add.text(W / 2, 132, '', font9(10, '#ff9090')).setOrigin(0.5); c.add(hpTxt);
    const grid = s.add.container(0, 0); c.add(grid);
    let stock = [];
    const roll = () => { stock = Phaser.Utils.Array.Shuffle(D.SHOP_ITEMS.slice()).slice(0, D.SHOP_SLOTS).map(it => ({ ...it, price: D.shopPrice(it.price, round), sold: false })); };
    const draw = () => {
      grid.removeAll(true);
      silverTxt.setText(`보유 은화 ${r.silver}`);
      hpTxt.setText(`체력 ${Math.ceil(s.hp)} / ${Math.round(s.maxHp)}`);
      stock.forEach((it, i) => {
        const x = 75 + (i % 2) * 120, y = 190 + Math.floor(i / 2) * 104;
        const can = !it.sold && r.silver >= it.price;
        const g = s.add.container(x, y);
        g.add(panel(s, -56, -46, 112, 92, { fill: it.sold ? 0x141018 : 0x261f3a, line: can ? 0xffd75e : 0x4a4060 }));
        g.add(icon(s, 0, -26, it.icon, 26).setAlpha(it.sold ? 0.3 : 1));
        g.add(s.add.text(0, -8, it.name, font(10, it.sold ? '#666' : '#ffffff')).setOrigin(0.5));
        g.add(s.add.text(0, 7, it.desc, { ...font9(10, '#c8bfe0'), align: 'center', wordWrap: { width: 104 } }).setOrigin(0.5, 0).setLineSpacing(-1));
        g.add(s.add.text(0, 37, it.sold ? '구매함' : `은화 ${it.price}`, font(10, it.sold ? '#666' : can ? '#ffd75e' : '#ff7070')).setOrigin(0.5));
        g.setSize(112, 92).setInteractive({ useHandCursor: true });
        onTap(g, () => {
          if (it.sold) return;
          if (r.silver < it.price) { sfx('deny'); s.tweens.add({ targets: g, x: x + 3, duration: 40, yoyo: true, repeat: 2 }); return; }
          r.silver -= it.price; it.sold = true; sfx('buy');
          s.log('run_shop_buy', { item: it.id, price: it.price, round, silver: r.silver });
          this.apply(it.id);
          draw();
        });
        grid.add(g);
      });
      rb.label.setText(`다시 뽑기  은화 ${D.rerollCost(round, rerolls)}`);
      rb.setEnabled(r.silver >= D.rerollCost(round, rerolls));
    };
    const rb = button(s, 80, 410, 120, 28, '', () => {
      const cost = D.rerollCost(round, rerolls);
      if (r.silver < cost) return;
      r.silver -= cost; rerolls++; sfx('buy'); roll(); draw();
      s.log('run_shop_reroll', { round, n: rerolls, cost });
    }, { size: 9 });
    const go = button(s, 200, 410, 100, 28, '출발', () => { if (c !== this.c) return; s.log('run_shop_leave', { round, silver: r.silver, bought: stock.filter(it => it.sold).length }); r.shopRound++; this.end(c); onDone?.(); }, { size: 12, color: 0x2f6b3a });
    c.add([rb, go]);
    roll(); draw();
    if (s.bot) s.time.delayedCall(200, () => {
      // 봇: 체력이 낮으면 고기, 아니면 살 수 있는 것 중 비싼 것부터
      stock.sort((a, b) => b.price - a.price);
      if (s.hp < s.maxHp * 0.5) stock.sort((a, b) => (b.id === 'meat') - (a.id === 'meat'));
      stock.forEach(it => { if (!it.sold && r.silver >= it.price) { r.silver -= it.price; it.sold = true; this.apply(it.id); } });
      if (c !== this.c) return;
      r.shopRound++; this.end(c); onDone?.();
    });
  }

  apply(id) {
    const s = this.s, r = s.run;
    switch (id) {
      case 'meat': s.heal(s.maxHp * 0.4); break;
      case 'whet': r.bDmg += 0.08; break;
      case 'boots': r.bSpd += 0.06; break;
      case 'heart': s.maxHp += 15; s.hp += 15; break;
      case 'tome': r.xp = D.xpNeed(r.lv); s.gainXp(0); break;
      case 'chest': this.queue.push(() => this.chest()); break;
      case 'mana': r.mana = D.MANA_MAX; break;
      case 'magnet': r.bPick += 0.25; break;
    }
  }

  // ── 일시정지 ──
  pauseMenu() {
    if (this.open || this.s.over) return;
    const s = this.s;
    const c = this.begin('pause');
    s.log('pause_open');
    c.add(panel(s, 45, 150, 180, 170));
    c.add(s.add.text(W / 2, 172, '일시정지', font(14)).setOrigin(0.5));
    const sk = Object.entries(s.run.skills).map(([k, lv]) => `${D.SKILLS[k].name} ${lv}`).join('\n');
    c.add(s.add.text(W / 2, 192, sk, { ...font9(10), align: 'center' }).setOrigin(0.5, 0).setLineSpacing(1));
    c.add(button(s, W / 2, 268, 130, 26, '계속하기', () => this.end(c), { color: 0x2f6b3a }));
    c.add(button(s, W / 2, 300, 130, 24, '포기하기', () => { if (c !== this.c) return; s.log('give_up', { wave: s.wave, progress: Math.round(s.runProgress() * 100) }); this.end(c); s.over = true; s.physics.pause(); this.result(false); }, { size: 10, color: 0x6b2f3a }));
  }

  // ── 쓰러졌을 때 부활 제안(판당 1번): 광고 또는 보석 ──
  revive() {
    const s = this.s, sv = s.sv;
    const c = this.begin('revive');
    s.log('revive_offer', { gem: sv.gem, can_gem: sv.gem >= D.REVIVE_GEM, no_ads: !!sv.noAds });
    c.add(panel(s, 30, 150, W - 60, 190, { fill: 0x1a1426, line: 0x7a3a4a }));
    c.add(s.add.text(W / 2, 176, '쓰러졌다…', font(16, '#ff7070')).setOrigin(0.5));
    c.add(s.add.text(W / 2, 194, '체력 절반으로 일어나 이어서 싸울까?', font9(10, '#e8e2f8')).setOrigin(0.5));
    // 다시 하기와 다른 점: 지금까지 키운 것이 그대로 남는다
    c.add(s.add.text(W / 2, 210, `Lv ${s.run.lv}·스킬·주운 것 그대로 남는다`, font9(10, '#9ae0ff')).setOrigin(0.5));
    let busy = false;
    const up = () => { this.end(c); s.reviveNow(); };
    const ad = button(s, W / 2, 232, 170, 28, sv.noAds ? '무료 부활' : '광고 보고 부활 ▶', async () => {
      if (busy || c !== this.c) return; busy = true;
      const ok = await showAd(s, sv, 'revive');
      busy = false;
      s.log('revive_choice', { via: 'ad', ok });
      if (ok && c === this.c) up();
    }, { size: 11, color: 0x2f5a7a });
    const gm = button(s, W / 2, 268, 170, 28, `보석 ${D.REVIVE_GEM}으로 부활`, () => {
      if (busy || c !== this.c || sv.gem < D.REVIVE_GEM) return;
      sv.gem -= D.REVIVE_GEM; save(); s.log('revive_choice', { via: 'gem', ok: true, gem_left: sv.gem }); up();
    }, { size: 11, color: 0x8a2f6a });
    gm.setEnabled(sv.gem >= D.REVIVE_GEM);
    c.add([ad, gm, gemIcon(s, W / 2 - 62, 268, 12)]);
    c.add(s.add.text(W / 2 + 70, 288, `보유 ${sv.gem}`, font9(10, '#ff9ad0')).setOrigin(1, 0));
    c.add(button(s, W / 2, 316, 120, 24, '포기', () => {
      if (busy || c !== this.c) return;
      s.log('revive_choice', { via: 'giveup' });
      this.end(c); s.die(true);
    }, { size: 10, color: 0x4a3a4a }));
  }

  // ── 결과 ──
  result(win) {
    const s = this.s, sv = s.sv, r = s.run;
    if (this.done) return; this.done = true;
    s.over = true; s.physics.pause();
    const idx = s.c * D.STAGES_PER_CHAPTER + s.s;
    const first = win && !s.endless && idx >= sv.cleared;
    let gold, stone = r.stones, guard = 0, sweep = 0, gem = 0;
    // 무한의 탑: 버틴 층만큼 받고, 최고 기록을 넘은 층마다 보석
    const floors = s.wave, best = sv.endBest || 0;
    if (s.endless) {
      gold = D.clearGold(s.c, D.STAGES_PER_CHAPTER - 1) * D.ENDLESS.goldPerFloor * floors;
      stone += D.ENDLESS.stonePerFloor * floors;
      gem = Math.max(0, floors - best) * D.ENDLESS.gemPerNewFloor;
      sv.endBest = Math.max(best, floors);
      if (floors >= 3) mission('clear');
    } else if (win) {
      gold = Math.round(D.clearGold(s.c, s.s) * (first ? D.FIRST_CLEAR_MUL : 1));
      stone += D.clearStone(s.c, s.s);
      mission('clear');
      if (first) { sv.cleared = idx + 1; sweep = 1; if (s.isBoss) guard = 1; gem = s.isBoss ? D.GEM_FREE.bossFirst : D.GEM_FREE.stageFirst; }
      sv.best[idx] = 1;
    } else {
      gold = Math.round(D.clearGold(s.c, s.s) * s.runProgress() * D.FAIL_GOLD_RATE);
    }
    gold = Math.round(gold);
    sv.gold += gold; sv.stone += stone; sv.guard += guard; sv.sweep = Math.min(D.SWEEP_MAX, sv.sweep + sweep); sv.gem += gem;
    save();
    s.log('battle_end', { win, first, progress: Math.round((win ? 1 : s.runProgress()) * 100), wave: s.wave, floors: s.endless ? floors : undefined, kills: r.kills, gold, stone, gem, power: D.powerOf(sv), rec: s.endless ? undefined : D.recPower(s.c, s.s), top_dmg: s.topHit(), revived: !!r.revived, cleared: sv.cleared, skills: Object.entries(r.skills).map(([k, v]) => k + v).join(',').slice(0, 100) });
    stopBgm();
    sfx(win ? 'win' : 'fail');
    // 열린 창이 있으면 닫고 결과만 띄운다
    if (this.c) { this.c.destroy(); this.c = null; this.open = null; }
    this.queue = []; this.pendingLv = 0;
    const c = this.begin('result');
    c.add(panel(s, 20, 90, W - 40, 300, { fill: 0x1a1426, line: win ? 0xffd75e : 0x7a3a4a }));
    const title = s.add.text(W / 2, 118, s.endless ? (floors > best ? '최고 기록!' : '탑 도전 끝') : win ? (s.isBoss ? '보스 격파!' : '스테이지 클리어!') : '쓰러졌다…', font(18, win || (s.endless && floors > best) ? '#ffd75e' : '#ff7070')).setOrigin(0.5).setScale(2);
    c.add(title); s.tweens.add({ targets: title, scale: 1, duration: 300, ease: 'Back.Out' });
    c.add(s.add.text(W / 2, 142, s.endless ? `무한의 탑  ·  최고 ${sv.endBest}층` : `${s.c + 1}-${s.s + 1} ${s.ch.name}${first ? '  ·  첫 클리어 ×' + D.FIRST_CLEAR_MUL : ''}`, font9(10, '#c8bfe0')).setOrigin(0.5));
    const lines = [
      ['처치', fmt(r.kills)], ['레벨', 'Lv ' + r.lv], s.endless ? ['넘은 층', `${floors}층`] : ['버틴 정도', Math.round((win ? 1 : s.runProgress()) * 100) + '%'],
    ];
    lines.forEach(([a, b], i) => {
      c.add(s.add.text(50, 166 + i * 16, a, font9(10, '#a89cc8')));
      c.add(s.add.text(W - 50, 166 + i * 16, b, font(10)).setOrigin(1, 0));
    });
    c.add(s.add.rectangle(W / 2, 220, W - 80, 1, 0x5b4f7a));
    const rew = [[12, '금화', gold], [13, '강화석', stone]];
    if (guard) rew.push([11, '파괴 방지권', guard]);
    if (sweep) rew.push([15, '소탕권', sweep]);
    if (gem) rew.push([-1, '보석', gem]);
    const tx = [];
    rew.forEach(([ic, name, n], i) => {
      const y = 232 + i * 18;
      c.add(ic < 0 ? gemIcon(s, 58, y, 14) : icon(s, 58, y, ic, 18));
      c.add(s.add.text(74, y - 7, name, font(11)));
      const t = s.add.text(W - 50, y - 7, '+0', font(12, '#ffd75e')).setOrigin(1, 0); c.add(t); tx.push(t);
      const o = { v: 0 };
      s.tweens.add({ targets: o, v: n, duration: 350, delay: 150 + i * 80, onUpdate: () => t.setText('+' + fmt(Math.round(o.v))), onComplete: () => sfx('coin') });
    });
    // 졌으면 무엇이 모자랐는지 숫자로 보여 준다
    if (!win && !s.endless) {
      const pw = D.powerOf(sv), rp = D.recPower(s.c, s.s);
      c.add(s.add.text(W / 2, 294, `내 전투력 ${pw}  ·  권장 ${rp}`, font(11, pw >= rp ? '#5fdc6a' : '#ff8070')).setOrigin(0.5));
      c.add(s.add.text(W / 2, 308, pw >= rp ? '움직임을 바꿔 다시 도전하자' : '강화·훈련하고 다시 도전하자', font9(10, '#c8bfe0')).setOrigin(0.5));
    }
    // 광고 보고 금화·강화석 2배(하루 횟수 제한). 져도 받을 게 있으면 띄운다
    if (!s.bot && adsLeft(sv, 'double') > 0 && gold + stone > 0) {
      const db = button(s, W / 2, 330, 190, 20, sv.noAds ? '보상 2배 받기' : '광고 보고 보상 2배 ▶', async () => {
        if (db.used) return; db.used = true; db.setEnabled(false);
        const ok = await showAd(s, sv, 'double');
        s.log('double_reward', { ok, gold, stone });
        if (!ok || !s.scene.isActive()) { db.used = false; db.setEnabled(true); return; }
        sv.ads.double = (sv.ads.double || 0) + 1;
        sv.gold += gold; sv.stone += stone; save();
        tx[0].setText('+' + fmt(gold * 2)); tx[1].setText('+' + fmt(stone * 2));
        [tx[0], tx[1]].forEach(t => s.tweens.add({ targets: t, scale: 1.4, duration: 120, yoyo: true }));
        sfx('coin'); db.label.setText('2배 받았다!');
      }, { size: 10, color: 0x2f5a7a });
      c.add(db);
    }
    const nextIdx = Math.min(sv.cleared, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1);
    c.add(button(s, 85, 360, 110, 30, win || s.endless ? '로비' : '대장간으로', () => { s.log('result_action', { act: win || s.endless ? 'lobby' : 'forge', win }); s.scene.start('Lobby', { tab: win || s.endless ? 'battle' : 'forge' }); }, { color: 0x3b2f5c }));
    c.add(button(s, 190, 360, 100, 30, win ? '다음' : '다시', () => {
      s.log('result_action', { act: win ? 'next' : 'retry', win });
      if (s.endless) return s.scene.start('Battle', { chapter: s.c, stage: 0, endless: true, bot: s.bot });
      const n = win ? nextIdx : idx;
      s.scene.start('Battle', { chapter: Math.floor(n / D.STAGES_PER_CHAPTER), stage: n % D.STAGES_PER_CHAPTER, bot: s.bot });
    }, { color: 0x2f6b3a }));
    s.registry.set('lastResult', { win, floors: s.endless ? floors : undefined, gold, stone, idx, kills: r.kills, lv: r.lv, progress: win ? 1 : s.runProgress(), t: s.bt });
  }
}
