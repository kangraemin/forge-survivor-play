import { shareBrag } from './share.js';
import { shareHidden, adWord, trialInfo, openFull, midgameBeforeBattle } from './platform/flags.js';   // 포털판 분기
import { cosmeticResultCard } from './cosmeticShop.js';
import { cosmetic, wardrobe, salePrice, buyCosmetic } from './cosmetics.js';
// 전투 위에 뜨는 창: 레벨업 3택, 스킬 상자, 웨이브 사이 상점, 일시정지, 결과
import * as D from './data.js';
import { save, mission } from './save.js';
import { sfx, endBgm } from './sfx.js';
import { font, font9, panel, button, icon, fmt, COLOR, toast, gemIcon, fixedContainer, skillIcon, onTap } from './ui.js';
import { showAd, adsLeft } from './shop.js';
import { itemName, SKILL_UNLOCK, PETS, SLOTS, RARITY, statText, equipped, itemScore, addItems, lastTidy, makeItem, grantEgg, eggsSettled, WTYPES, grantWeapon, hasW } from './gear.js';
import { itemBox } from './gearTab.js';
import { dexRefresh, dexState, DEX_HP, titleName } from './codex.js';
import { t } from './i18n.js';
import { sideDim } from './wide.js';
import { petCard } from './petRoles.js';
import { nextGoal, powerAct } from './nextGoal.js';
import { trackOnce } from './log.js';
import { noteTower, tossSubmitRecord } from './rank.js';
const R = Phaser.Math.Between;

const { W, H } = D;
const DEPTH = 150;

export class Overlay {
  constructor(s) { this.s = s; this.open = null; this.pendingLv = 0; this.queue = []; }

  // 창을 열면 전투가 멈춘다. 닫으면 대기 중인 창(레벨업 등)을 이어서 연다
  // 새 보스 펫 합류 창: 그림·이름·역할·잘 듣는 장, '데려가기'로 바로 낀다
  petJoin(p) {
    const s = this.s, sv = s.sv;
    const c = fixedContainer(s).setDepth(DEPTH + 10);
    const dim = s.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive();
    c.add([dim, panel(s, 14, 60, W - 28, 372, { fill: 0x1a1426, line: p.color })]);
    c.add(s.add.text(W / 2, 80, t('lobby.87c061'), font(15, '#ffd75e')).setOrigin(0.5));
    petCard(s, c, p, sv, 94);
    const close = () => { s.tweens.killTweensOf(c); c.destroy(); };
    c.add(button(s, W / 2 + 46, 404, 84, 28, t('lobby.818a75'), () => { sv.pet = p.id; save(); sfx('buy'); s.log('pet_join_take', { pet: p.id }); close(); }, { size: 11, color: 0x2f6b3a }));
    c.add(button(s, W / 2 - 50, 404, 76, 28, sv.pet === p.id ? t('lobby.468266') : t('lobby.0fcd14'), () => { s.log('pet_join_later', { pet: p.id }); close(); }, { size: 10, color: 0x3a3846 }));
    c.setAlpha(0); s.tweens.add({ targets: c, alpha: 1, duration: 250, delay: 600 });
  }

  // 47차: 체험 연습장이 끝나면 바로 구매 카드(졌어도 같은 카드). 주 버튼은 구매 하나
  practiceCard(it, done) {
    const s = this.s, sv = s.sv;
    if (this.c) { this.c.destroy(); this.c = null; this.open = null; }
    const c = this.begin('practice');
    const sp = it ? salePrice(sv, it) : null, owned = !!(it && wardrobe(sv).owned[it.id]);
    c.add(panel(s, 24, 110, W - 48, 250, { fill: 0x142a31, line: 0x507b89 }));
    c.add(s.add.text(W / 2, 134, done ? t('overlay.b0c8be') : t('overlay.81ce89'), font(16, '#ffd75e')).setOrigin(0.5));
    c.add(s.add.text(W / 2, 154, done ? t('overlay.f70c11') : t('overlay.389aec'), font9(10, '#b4cfda')).setOrigin(0.5));
    if (it) {
      const body = it.kind === 'character' || it.kind === 'costume';
      const im = s.add.image(W / 2, 205, body ? `cos_${it.id}_4` : `cos_${it.id}`, body ? 2 : 0); im.setScale(56 / Math.max(im.width, im.height)); c.add(im);
      c.add(s.add.text(W / 2, 244, it.name, font(13)).setOrigin(0.5));
      if (sp?.off) c.add(s.add.text(W / 2, 262, t('overlay.6abbb5', { off: sp.off, cost: it.cost, price: sp.price }), font9(10, '#ffd75e')).setOrigin(0.5));
      else c.add(s.add.text(W / 2, 262, t('overlay.795b77', { cost: it.cost }), font9(10, '#ffd75e')).setOrigin(0.5));
      const enough = sv.gem >= (sp?.price ?? it.cost);
      if (!owned) c.add(button(s, W / 2, 298, 200, 32, enough ? t('cosmeticShop.88dcf0', { price: sp.price }) : t('overlay.06c086', { price: sp.price }), () => {
        if (enough) { if (buyCosmetic(sv, it.id)) { save(); sfx('buy'); s.log('cosmetic_buy', { id: it.id, cost: sp.price, from: 'practice' }); s.scene.start('Lobby', { tab: 'shop', cosmetic: it.id }); } }
        else s.scene.start('Lobby', { tab: 'shop', cosmetic: it.id });
      }, { size: 12, color: 0x2f6b3a }));
    }
    c.add(button(s, W / 2, 338, 120, 24, t('overlay.d5068c'), () => s.scene.start('Lobby', { tab: 'shop', cosmetic: it?.id }), { size: 10, color: 0x3a3846 }));
  }

  // 마지막 장 클리어 연출: 금빛 불꽃비와 큰 글씨(누르는 곳 없이 3초 뒤 걷힌다)
  finale() {
    const s = this.s, c = fixedContainer(s).setDepth(DEPTH + 20);
    s.cameras.main.flash(500, 255, 220, 120); sfx('win');
    const band = s.add.rectangle(W / 2, 240, W, 70, 0x000000, 0.75), t1 = s.add.text(W / 2, 228, t('overlay.f0752e'), font(16, '#ffd75e', 4)).setOrigin(0.5), t2 = s.add.text(W / 2, 252, t('overlay.86abf9'), font9(11, '#ffffff')).setOrigin(0.5);
    c.add([band, t1, t2]);
    for (let i = 0; i < 48; i++) {
      const sp = s.add.rectangle(R(0, W), -10, R(2, 3), R(3, 5), Phaser.Utils.Array.GetRandom([0xffd75e, 0xff9a40, 0xfff0b0, 0xff6030]));
      c.add(sp);
      s.tweens.add({ targets: sp, y: R(260, 500), x: sp.x + R(-24, 24), angle: R(-180, 180), duration: R(1400, 2600), delay: R(0, 1400), ease: 'Sine.In', onComplete: () => sp.destroy() });
    }
    c.setAlpha(0); s.tweens.add({ targets: c, alpha: 1, duration: 250 });
    s.tweens.add({ targets: c, alpha: 0, delay: 3200, duration: 500, onComplete: () => c.destroy() });
  }

  begin(name) {
    const s = this.s;
    this.open = name;
    s.paused = true; s.physics.pause(); s.anims.pauseAll();
    // 이동 안내가 창 뒤로 비치지 않게 바로 지운다
    s.hint?.forEach(o => { s.tweens.killTweensOf(o); o.destroy(); }); s.hint = null;
    // 떠 있던 배너(웨이브·보스 이름)도 지운다: 창 제목과 겹쳐 읽을 수 없었다
    s.bannerObjs?.forEach(o => { s.tweens.killTweensOf(o); o.destroy(); }); s.bannerObjs = null; s.bannerQ = [];
    s.joy.o = null; s.joy.v.reset(); s.joy.base.setVisible(false); s.joy.knob.setVisible(false);
    s.showUlt?.(false);   // 창 아래 안내 글과 겹치지 않게 궁극기 버튼을 숨긴다
    // 세로로 긴 폰(H>480)에서는 창 내용을 남는 높이의 절반만큼 내려 가운데로(48차). 어둡게 덮는 막은 그만큼 올려 화면 전체를 덮는다
    const dy = Math.round((H - 480) / 2);
    const c = fixedContainer(s, 0, dy).setDepth(DEPTH);
    const dim = s.add.rectangle(0, -dy, W, H, 0x05030a, 0.72).setOrigin(0).setInteractive();
    c.add(dim); c.setAlpha(0);
    s.tweens.add({ targets: c, alpha: 1, duration: 140 });
    const sd = sideDim(s, 0x05030a, 0.72, DEPTH - 1);   // 넓은 화면: 양옆도 같이 어둡게
    if (sd.length) { sd.forEach(r => r.setAlpha(0)); s.tweens.add({ targets: sd, alpha: 0.72, duration: 140 }); c.once('destroy', () => sd.forEach(r => r.destroy())); }
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
    if (this.pendingLv > 0) { this.pendingLv--; this.open = 'next'; s.time.delayedCall(10, () => { if (this.open !== 'next') return; this.open = null; this.levelUp(true); this.settle(); }); return; }
    const next = this.queue.shift();
    if (next) { this.open = 'next'; s.time.delayedCall(10, () => { if (this.open !== 'next') return; this.open = null; next(); this.settle(); }); return; }
    this.resume();
  }
  resume() { const s = this.s; s.paused = false; s.physics.resume(); s.anims.resumeAll(); s.showUlt?.(true); }
  // 대기열 항목이 창을 열지 않고 끝났으면(이미 더 좋은 장비·봇 자동 장착 등) 다음 항목으로 넘기거나 일시정지를 푼다
  settle() {
    if (this.open || this.s.over) return;
    if (this.pendingLv > 0) { this.pendingLv--; this.levelUp(true); this.settle(); return; }
    const n = this.queue.shift();
    if (n) { n(); this.settle(); return; }
    this.resume();
  }

  // ── 레벨업: 3장 중 하나 ──
  choices(skip) {
    const sk = this.s.run.skills;
    const act = Object.keys(sk).filter(k => D.SKILLS[k].type === 'active').length;
    const pas = Object.keys(sk).filter(k => D.SKILLS[k].type === 'passive' && !D.SKILLS[k].mode).length;
    const first = this.s.sv.stats.runs <= 1 && this.s.run.lv === 2;
    const pool = [];
    for (const [k, def] of Object.entries(D.SKILLS)) {
      const lv = sk[k] || 0;
      if (lv >= D.SKILL_MAX || this.s.run.banned?.[k] || skip?.has(k)) continue;
      if (def.mode) {   // 50차: 모드 전용 카드는 그 모드 판에서만, 일반 카드보다 훨씬 자주
        if (def.mode !== this.s.mode?.id) continue;
        pool.push({ k, w: lv ? 3.5 : 7 });
        continue;
      }
      if (!lv && (def.type === 'active' ? act >= D.ACTIVE_SLOTS : pas >= D.PASSIVE_SLOTS)) continue;
      // 처음 하는 사람의 첫 레벨업은 바로 눈에 보이는 공격 스킬만 보여 준다
      if (first && def.type !== 'active') continue;
      // 무기 전용 스킬은 그 무기를 든 판에만, 몇몇 스킬은 진행할수록 열린다(판마다 같은 카드만 나오지 않게)
      if (!lv && def.own && def.own !== this.s.wtype.id) continue;
      if (!lv && (SKILL_UNLOCK[k] || 0) > this.s.sv.cleared) continue;
      // 이미 가진 걸 키우는 쪽을 조금 더 자주 보여 준다(빌드가 완성되는 맛)
      // 액티브가 Lv3을 넘었는데 진화 짝 패시브가 없으면 그 패시브를 크게 밀어 준다(한 판 안에 진화가 닿게)
      const pair = !lv && def.type === 'passive' && Object.entries(D.EVOS).some(([b, e]) => e.need === k && (sk[b] || 0) >= 3);
      // 무기가 좋아하는 스킬은 1.8배 자주 나온다(검은 회전·구슬, 창은 단검·얼음, 도끼는 화염·성역)
      const fav = this.s.wtype.fav.includes(k) ? 1.8 : 1;
      pool.push({ k, w: (pair ? 8 : lv ? 3 : def.type === 'active' ? 2.2 : 1.6) * fav });
    }
    const out = [];
    // 진화할 수 있으면 첫 칸에 반드시 띄운다
    for (const [k, e] of Object.entries(D.EVOS)) {
      if (out.length < 2 && sk[k] >= D.SKILL_MAX && sk[e.need] && !this.s.run.evo[k] && !skip?.has('_evo_' + k)) out.push('_evo_' + k);
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
    c.add(s.add.text(W / 2, 100, t('overlay.925ab9', { lv: s.run.lv }), font(18, '#ffffff')).setOrigin(0.5));
    // 처음 하는 사람에게는 같은 자리에서 고르는 법을 알려 준다(카드와 겹치지 않게)
    const firstLv = s.sv.stats.runs <= 1 && s.run.lv === 2;
    // 추천 딱지는 처음 3번의 레벨업까지 남긴다(첫 장만 보고 나머지는 못 고른다는 평가)(42차)
    const recLv = s.sv.stats.runs <= 1 && s.run.lv <= 4;
    c.add(s.add.text(W / 2, 122, firstLv ? (D.PC ? t('pc.pickCard') : t('overlay.245621')) : t('overlay.a38227'), font9(11, firstLv ? '#ffffff' : '#a1b2b6')).setOrigin(0.5));
    const cards = s.add.container(0, 0); c.add(cards);
    this.cardsC = cards;   // 키보드 1·2·3으로 고르려고 pcInput.js가 쓴다
    // 다시 뽑기와 헷갈렸다: 카드의 '빼기'는 그 카드만 바꾼다고 짧게 적는다(긴 설명은 화면 밖으로 넘쳤다)
    const banInfo = () => banTxt.setText(r.banLeft > 0 ? t('overlay.ac8276', { banLeft: r.banLeft }) : t('overlay.35d4d7', { BAN_GEM: D.BAN_GEM }));
    const draw = () => {
      cards.removeAll(true);
      this.choices().forEach((k, i) => cards.add(this.card(k, W / 2, 172 + i * 78, i)));
      banInfo();
    };
    // 빼기는 그 자리 한 장만 새로 뽑는다(나머지 두 장은 그대로: 원하던 카드까지 사라져 억울했다)
    this.banSlot = k => {
      const i = cards.list.findIndex(o => o.key === k); if (i < 0) return draw();
      const nk = this.choices(new Set(cards.list.map(o => o.key)))[0];
      cards.list[i].destroy();
      if (nk) cards.addAt(this.card(nk, W / 2, 172 + i * 78, 0), i);
      banInfo();
    };
    const r = s.run;
    if (r.banLeft === undefined) r.banLeft = D.BANISH_PER_RUN;
    const banTxt = s.add.text(W / 2, 438, '', font9(10, '#a1b2b6')).setOrigin(0.5); c.add(banTxt);
    this.redraw = draw;
    draw();
    if (D.PC) for (let i = 0; i < 3; i++) c.add(s.add.text(W / 2 - 124, 172 + i * 78, String(i + 1), font(11, '#8fb0b8', 2)).setOrigin(0.5));   // PC: 카드 왼쪽 옆에 고르는 키 번호
    // 처음 하는 사람: 첫 레벨업 카드를 반짝여 고르는 곳을 알려 준다
    if (firstLv) {
      banTxt.setText('');
      const glow = s.add.rectangle(W / 2, 172, 236, 76).setStrokeStyle(2, 0xffffff).setAlpha(0); c.add(glow);
      s.tweens.add({ targets: glow, alpha: 1, duration: 350, yoyo: true, repeat: -1, delay: 300 });
    }
    // 세 장이 다 새 스킬이라 뭘 골라야 할지 몰랐다: 첫 장에 '추천'
    if (recLv) {
      c.add(s.add.text(W / 2 - 94, 139, t('lobby.4b0ea2'), font(9, '#ffffff')).setOrigin(0.5).setBackgroundColor('#2f7a3a').setPadding(3, 1, 3, 1));
    }
    // 무료 → 은화 → 은화가 모자라면 보석
    const label = () => r.freeReroll > 0 ? t('overlay.f684a8') : r.silver >= this.lvReroll() ? t('overlay.e203cb', { lvReroll: this.lvReroll() }) : t('overlay.8cdceb', { REROLL_GEM: D.REROLL_GEM });
    const can = () => r.freeReroll > 0 || r.silver >= this.lvReroll() || s.sv.gem >= D.REROLL_GEM;
    const rb = button(s, W / 2, 400, 190, 28, label(), () => {
      let gem = false;
      if (r.freeReroll > 0) r.freeReroll--;
      else if (r.silver >= this.lvReroll()) { r.silver -= this.lvReroll(); r.lvRerolls = (r.lvRerolls || 0) + 1; }
      else if (s.sv.gem >= D.REROLL_GEM) {
        // 무료를 연달아 누르던 손이 그대로 보석을 쓰지 않게, 이번 판 첫 보석 사용은 한 번 더 눌러 확인한다
        if (!r.gemRerollOk) { r.gemRerollOk = true; sfx('deny'); rb.label.setText(t('overlay.46a3cd', { REROLL_GEM: D.REROLL_GEM })); return; }
        s.sv.gem -= D.REROLL_GEM; save(); gem = true;
      }
      else return;
      s.log('levelup_reroll', { n: r.lvRerolls || 0, silver: r.silver, gem });
      sfx('buy'); draw(); rb.label.setText(label()); rb.setEnabled(can()); own.setText(ownTxt());
    }, { size: 10, color: 0x3a3846 });
    rb.setEnabled(can());
    c.add(rb);
    // '은화 0'만 있으면 무슨 숫자인지 몰랐다: 가진 은화·보석을 같이 보여 준다
    const ownTxt = () => t('overlay.37d916', { silver: r.silver, gem: s.sv.gem });
    const own = s.add.text(W / 2, 422, ownTxt(), font9(11, '#e8eef8')).setOrigin(0.5); c.add(own);
    this.lvOwn = () => own.active && own.setText(ownTxt());
    if (s.bot) s.time.delayedCall(150, () => this.pick(cards.list[0]?.key));
  }
  lvReroll() { return 8 + 6 * (this.s.run.lvRerolls || 0); }
  // 진화할 수 있는 스킬이 있는가(있으면 자동 강화로 넘기지 않고 카드 창을 연다)
  evoReady() {
    const sk = this.s.run.skills;
    return Object.entries(D.EVOS).some(([k, e]) => sk[k] >= D.SKILL_MAX && sk[e.need] && !this.s.run.evo[k]);
  }
  // 카드 없이 가진 스킬 하나를 한 단계 올린다. 올릴 게 없으면 체력·은화
  autoLevel() {
    const s = this.s, r = s.run, sk = r.skills;
    const own = Object.keys(sk).filter(k => D.SKILLS[k] && sk[k] > 0 && sk[k] < D.SKILL_MAX);
    sfx('level');
    const pil = s.add.sprite(s.hero.x, s.hero.y + 20, 'fx2_r2s').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH - 1).setTint(0x9ad8ff).setScale(0.7).play('fxPillar');
    pil.once('animationcomplete', () => pil.destroy());
    if (own.length) {
      // 액티브를 먼저, 그다음 낮은 레벨부터(고르는 수고만 덜고 빌드는 그대로 자란다)
      own.sort((a, b) => (D.SKILLS[a].type === 'active' ? 0 : 1) - (D.SKILLS[b].type === 'active' ? 0 : 1) || sk[a] - sk[b] || Math.random() - 0.5);
      const k = own[0];
      sk[k]++;
      if (k === 'vigor') { s.maxHp += 20; s.hp += 20; }
      s.mode?.onCard?.(k, sk[k]);
      s.refreshSkillRow();
      s.log('skill_auto', { skill: k, skill_lv: sk[k], lv: r.lv });
      toast(s, t('overlay.fae44a', { lv: r.lv, name: D.SKILLS[k].name, v: sk[k] }), '#9ae0ff', 96);
    } else {
      s.heal(s.maxHp * 0.15); r.silver += 10;
      toast(s, t('overlay.462e05', { lv: r.lv }), '#9ae0ff', 96);
    }
  }

  card(k, x, y, i) {
    const s = this.s, sk = s.run.skills;
    const c = s.add.container(x, y); c.key = k;
    if (k.startsWith('_evo_')) return this.evoCard(k, x, y, i);
    const special = k[0] === '_';
    const def = special ? null : D.SKILLS[k], lv = sk[k] || 0;
    const isAct = def?.type === 'active';
    const firstRun = s.sv.stats.runs <= 1;
    const banGem = s.run.banLeft <= 0, canBan = !special && (!banGem || s.sv.gem >= D.BAN_GEM) && !(firstRun && s.run.lv === 2);
    // 카드는 한 가지 틀: 공격/보조 구분은 이름 옆 작은 글로만 한다(테두리 색이 두 가지라 어지러웠다)
    c.add(panel(s, -115, -35, 230, 70, { fill: 0x1c2935, line: 0x475c66 }));
    c.add(s.add.rectangle(-88, 0, 40, 40, 0x000000, 0.4));
    c.add(special ? icon(s, -88, 0, k === '_heal' ? 14 : 12, 32) : skillIcon(s, -88, 0, def, 32));
    // 기본 공격 이름은 든 무기를 따른다(창 찌르기·도끼 찍기)
    const name = special ? (k === '_heal' ? t('data.b7ce4b') : t('overlay.d7abf5')) : k === 'sword' ? { sword: def.name, spear: t('overlay.b741a3'), axe: t('overlay.2c602d'), bow: t('overlay.1e0408'), gun: t('overlay.b68df2'), knuckle: t('overlay.74f9bf'), staff: t('overlay.293d94') }[s.wtype.id] : def.name;
    const nm = s.add.text(-60, -24, name, font(12, '#ffb85c', 0)); c.add(nm);
    if (!special) c.add(s.add.text(-60 + nm.width + 5, -23, lv ? `Lv ${lv}→${lv + 1}` : isAct ? t('overlay.2a9c18') : def.mode ? t('modeScreen.cd1abb') : t('overlay.51378a'), font9(10, def.mode ? '#ffd75e' : '#a1b2b6')));
    let desc = special ? (k === '_heal' ? t('overlay.1e2e56') : t('overlay.fcc82d')) : def.type === 'passive' && !def.mode ? def.desc[0] : def.desc[lv];
    if (def?.bonus && lv + 1 === D.PASSIVE_LV3) desc += t('overlay.91feb3', { bonus: def.bonus });
    c.add(s.add.text(-60, -6, desc, { ...font9(11, '#f2e4bc'), wordWrap: { width: 165 } }).setLineSpacing(1));
    // 레벨 칸
    if (!special) for (let j = 0; j < D.SKILL_MAX; j++) c.add(s.add.rectangle(-60 + j * 9, 26, 7, 4, j < lv ? 0xd8d2e8 : j === lv ? 0x5fdc6a : 0x293845).setOrigin(0, 0.5));
    // 진화 재료 표시: 이 스킬이 다른 스킬의 진화에 쓰이면 짝을 알려 준다
    const evoOf = special ? null : def.type === 'active' ? D.EVOS[k] && D.SKILLS[D.EVOS[k].need].name : Object.keys(D.EVOS).filter(b => D.EVOS[b].need === k).map(b => D.SKILLS[b].name).join('·');
    // 시너지: 이 스킬을 고르면 이미 가진 짝 스킬과 시너지가 생긴다(진화 안내보다 먼저 보여 준다)
    const syn = special || lv ? [] : D.synOf(k, sk);
    if (syn.length) c.add(s.add.text(108, 26, t('overlay.9230ff', { name: syn[0].name }), font9(10, '#ffb050')).setOrigin(1, 0.5));
    else if (evoOf && !firstRun && !(def.type === 'active' && s.run.evo[k])) c.add(s.add.text(108, 26, def.type === 'active' ? t('overlay.f0f907', { evoOf }) : t('overlay.440133', { evoOf }), font9(10, '#a1b2b6')).setOrigin(1, 0.5));
    c.setSize(230, 70).setInteractive({ useHandCursor: true });
    onTap(c, () => this.pick(k, c));
    // 추방: 이번 판에서 다시 안 나온다(첫 레벨업에는 숨김)
    if (canBan) {
      // 카드 오른쪽 위 모서리에 '빼기'라고 글로 붙인다(X만 있으면 다시 뽑기와 구분이 안 됐다)
      const x = s.add.container(96, -22);
      x.add(s.add.rectangle(0, 0, 38, 22, 0x293845, 1).setStrokeStyle(1, 0x475c66));
      x.add(s.add.text(banGem ? 4 : 0, 0, banGem ? t('overlay.909bfd', { BAN_GEM: D.BAN_GEM }) : t('gearTab.60af2f'), font9(10, '#a1b2b6')).setOrigin(0.5));
      if (banGem) x.add(gemIcon(s, -13, 0, 8));
      x.setSize(42, 24).setInteractive({ useHandCursor: true });
      onTap(x, (p, lx, ly, ev) => {
        ev?.stopPropagation();
        if (this.picking) return;
        if (s.run.banLeft > 0) s.run.banLeft--;
        else if (s.sv.gem >= D.BAN_GEM) { s.sv.gem -= D.BAN_GEM; save(); s.log('banish_gem'); }
        else return;
        (s.run.banned ||= {})[k] = true; sfx('deny'); this.banSlot ? this.banSlot(k) : this.redraw?.(); this.lvOwn?.();
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
    c.add(skillIcon(s, -88, 0, D.SKILLS[base], 32));
    c.add(s.add.text(-60, -24, e.name, font(12, '#ffd75e')));
    c.add(s.add.text(108, -24, t('overlay.496702'), font(11, '#ff9a3a')).setOrigin(1, 0));
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
      s.banner(D.EVOS[base].name, t('overlay.916e5b'));
    } else if (k === '_heal') s.heal(s.maxHp * 0.3);
    else if (k === '_silver') r.silver += 25;
    else {
      r.skills[k] = (r.skills[k] || 0) + 1;
      const syn = r.skills[k] === 1 ? D.synOf(k, r.skills) : [];
      if (syn.length) s.time.delayedCall(250, () => s.banner(syn[0].name, t('overlay.3bf20f')));
      if (k === 'vigor') { s.maxHp += 20; s.hp += 20; }
      s.mode?.onCard?.(k, r.skills[k]);
      s.refreshSkillRow();
    }
    sfx('buy');
    const oc = this.c, after = () => { this.picking = false; this.end(oc); };
    if (cardObj) {
      s.tweens.add({ targets: cardObj, scale: 1.08, duration: 90, yoyo: true, onComplete: after });
    } else after();
  }

  // ── 주운 장비가 지금 낀 것보다 좋으면 바로 낄지 묻는다 ──
  lootAsk(item, cur) {
    if (this.open) { this.queue.push(() => this.lootAsk(item, cur)); return; }
    const s = this.s;
    // 줄 서 있던 사이 더 좋은 걸 꼈으면 묻지 않는다
    cur = equipped(s.sv).find(x => x.s === item.s);
    if (cur && itemScore(item) <= itemScore(cur)) return;
    if (s.bot) { s.equipNow(item); return; }
    const c = this.begin('loot'), rr = RARITY[item.r], slot = SLOTS.find(x => x.id === item.s);
    c.add(panel(s, 24, 130, W - 48, 236, { fill: 0x1a1426, line: rr.color }));
    c.add(s.add.text(W / 2, 150, cur ? t('overlay.845804', { name: slot.name }) : t('overlay.524e78', { name: slot.name }), font(13, '#ffd75e')).setOrigin(0.5));
    // 왼쪽: 지금 낀 것, 오른쪽: 주운 것
    const side = (x, it, head, col) => {
      c.add(s.add.text(x, 172, head, font9(10, col)).setOrigin(0.5));
      if (!it) { c.add(s.add.text(x, 204, t('overlay.ed3cbe'), font9(10, '#6a6080')).setOrigin(0.5)); return; }
      c.add(itemBox(s, x, 200, it, 32));
      c.add(s.add.text(x, 224, itemName(it), font9(10, RARITY[it.r].css)).setOrigin(0.5));
      // 주운 것은 지금 것보다 오른 능력치를 초록 ▲, 내린 것을 빨강 ▼로(계산 안 해도 보이게)
      // 지금 것에만 있는 능력치는 '잃음'으로 빨갛게 보여 준다(새 템에 없으면 손해를 몰랐다)
      const keys = it === item && cur ? [...new Set([...Object.keys(it.st), ...Object.keys(cur.st)])] : Object.keys(it.st);
      keys.forEach((k, i) => {
        const v = it.st[k] || 0, o = it === item && cur ? cur.st[k] || 0 : null, mark = o == null || v === o ? '' : v > o ? ' ▲' : ' ▼';
        const txt = v ? statText(k, v) + mark : statText(k, o).replace('+', '-') + ' ▼';   // 잃는 만큼 빼서 보여 준다
        c.add(s.add.text(x, 240 + i * 13, txt, font9(9, mark === ' ▲' ? '#5fdc6a' : mark ? '#ff8a8a' : '#a1b2b6')).setOrigin(0.5));
      });
    };
    side(W / 2 - 54, cur, t('overlay.d07eb3'), '#a1b2b6');
    side(W / 2 + 54, item, t('overlay.84f8dc'), '#5fdc6a');
    c.add(s.add.text(W / 2, 200, '→', font(14, '#ffd75e')).setOrigin(0.5));
    // 끼는 쪽이 기본: 장착 버튼을 크게, 가방은 작게
    c.add(button(s, W / 2 - 64, 340, 70, 26, t('overlay.928a1c'), () => { item.bag = true; s.log('loot_ask', { equip: false }); this.end(c); }, { size: 10, color: 0x3a3846 }));
    c.add(button(s, W / 2 + 38, 340, 124, 32, t('overlay.eb0e58'), () => { s.equipNow(item); sfx('level'); s.log('loot_ask', { equip: true }); this.end(c); }, { size: 12, color: 0x2f6b3a }));
  }

  // ── 스킬 상자: 가진 스킬 중 하나가 무료로 오른다 ──
  chest() {
    const s = this.s, sk = s.run.skills;
    const can = Object.keys(sk).filter(k => sk[k] < D.SKILL_MAX);
    // 47차: 상자 창은 판당 한 번 — 두 번째부터는 창 없이 같은 보상(스킬 한 단계)을 바로 받고 알림만 띄운다
    if (s.run.chestShown) {
      const k = Phaser.Utils.Array.GetRandom(can);
      if (k) { sk[k]++; if (k === 'vigor') { s.maxHp += 20; s.hp += 20; } s.refreshSkillRow(); toast(s, t('overlay.d71866', { name: D.SKILLS[k].name, v: sk[k] }), '#ffd75e', 112); }
      else { s.run.silver += 40; toast(s, t('overlay.c0f245'), '#ffd75e', 112); }
      s.log('chest_open', { skill: k || '_silver', quiet: true }); sfx('success');
      return;
    }
    if (this.open) { this.queue.push(() => this.chest()); return; }
    s.run.chestShown = true;
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
      } else { s.run.silver += 40; c.add(s.add.text(W / 2, 240, t('overlay.30732c'), font(13, '#ffd75e')).setOrigin(0.5)); }
      c.add(s.add.text(W / 2, 270, t('overlay.de0088'), font9(10)).setOrigin(0.5));
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
    c.add(panel(s, 10, 60, W - 20, 358, { fill: 0x1a1426 }));   // 3칸 가로 카드라 창이 짧아졌다(42차)
    c.add(s.add.text(W / 2, 78, t('overlay.cfe465'), font(15, '#ffd75e')).setOrigin(0.5));
    c.add(s.add.text(W / 2, 96, t('overlay.981d4a'), font9(10, '#a1b2b6')).setOrigin(0.5));
    const silverTxt = s.add.text(W / 2, 116, '', font(12, '#e8eef8')).setOrigin(0.5); c.add(silverTxt);
    const hpTxt = s.add.text(W / 2, 132, '', font9(10, '#ff9090')).setOrigin(0.5); c.add(hpTxt);
    const grid = s.add.container(0, 0); c.add(grid);
    let stock = [];
    // 황금 상인 4세트: 20% 할인
    const off = s.gear.fx.has('gold4') ? 0.8 : 1;
    // 한 칸은 늘 장비다(세트가 잘 나온다). 나머지 세 칸은 물약·강화
    const gearCard = () => {
      const item = makeItem(s.c, { boost: round >= 1 ? 1 : 0, w: s.wtype.id, setP: 0.6 });
      return { id: 'gear', item, name: itemName(item), desc: statText(...Object.entries(item.st)[0]), price: Math.floor(D.shopPrice(D.SHOP_GEAR_PRICE[item.r], round) * off), sold: false };
    };
    // 체력이 절반 넘게 남았으면 회복 물약은 안 판다(1-2에서 늘 가득이라 살 일이 없었다)(42차)
    const roll = () => { stock = [gearCard(), ...Phaser.Utils.Array.Shuffle(D.SHOP_ITEMS.filter(it => it.id !== 'meat' || s.hp < s.maxHp * 0.5)).slice(0, D.SHOP_SLOTS - 1).map(it => ({ ...it, price: Math.floor(D.shopPrice(it.price, round) * off), sold: false }))]; };
    const draw = () => {
      grid.removeAll(true);
      silverTxt.setText(t('overlay.078341', { silver: r.silver }));
      hpTxt.setText(t('overlay.1a289a', { min: Math.min(Math.ceil(s.hp), Math.round(s.maxHp)), round: Math.round(s.maxHp) }));
      // 설명이 길어 끊겼다: 가로 한 줄 카드 3장(아이콘·이름+한 줄 설명·가격)(42차)
      stock.forEach((it, i) => {
        const x = W / 2, y = 178 + i * 70;   // 체력 줄(132)과 겹치지 않게 아래로
        const can = !it.sold && r.silver >= it.price;
        const g = s.add.container(x, y);
        g.add(panel(s, -115, -31, 230, 62, { fill: it.sold ? 0x141018 : 0x261f3a, line: can ? 0xffd75e : 0x4a4060 }));
        g.add((it.item ? itemBox(s, -91, 0, it.item, 26) : icon(s, -91, 0, it.icon, 26)).setAlpha(it.sold ? 0.3 : 1));
        g.add(s.add.text(-66, -10, it.name, font(11, it.sold ? '#666' : it.item ? RARITY[it.item.r].css : '#ffffff')).setOrigin(0, 0.5));
        g.add(s.add.text(-66, 9, it.desc, font9(10, '#a1b2b6')).setOrigin(0, 0.5));
        g.add(s.add.text(108, 0, it.sold ? t('lobby.b83fab') : t('overlay.42d459', { price: it.price }), font(10, it.sold ? '#666' : can ? '#ffd75e' : '#ff7070')).setOrigin(1, 0.5));
        g.setSize(230, 62).setInteractive({ useHandCursor: true });
        onTap(g, () => {
          if (it.sold) return;
          if (r.silver < it.price) { sfx('deny'); s.tweens.add({ targets: g, x: x + 3, duration: 40, yoyo: true, repeat: 2 }); return; }
          r.silver -= it.price; it.sold = true; sfx('buy');
          s.log('run_shop_buy', { item: it.id, price: it.price, round, silver: r.silver });
          if (it.item) s.gotLoot(it.item); else this.apply(it.id);
          // 멈춘 동안에도 뒤 HUD(은화·체력)를 바로 맞춘다(가운데와 위 숫자가 달라 보였다)
          s.updateHud(s.time.now); s.hpLag.width = s.hpBar.width;
          draw();
        });
        grid.add(g);
      });
      rb.label.setText(t('overlay.88d130', { rerollCost: D.rerollCost(round, rerolls) }));
      rb.setEnabled(r.silver >= D.rerollCost(round, rerolls));
    };
    const rb = button(s, 80, 388, 120, 28, '', () => {
      const cost = D.rerollCost(round, rerolls);
      if (r.silver < cost) return;
      r.silver -= cost; rerolls++; sfx('buy'); roll(); draw(); s.updateHud(s.time.now);
      s.log('run_shop_reroll', { round, n: rerolls, cost });
    }, { size: 9 });
    const go = button(s, 200, 388, 100, 28, t('overlay.78a934'), () => { if (c !== this.c) return; s.log('run_shop_leave', { round, silver: r.silver, bought: stock.filter(it => it.sold).length }); r.shopRound++; this.end(c); onDone?.(); }, { size: 12, color: 0x2f6b3a });
    c.add([rb, go]);
    roll(); draw();
    if (s.bot) s.time.delayedCall(200, () => {
      // 봇: 체력이 낮으면 고기, 아니면 살 수 있는 것 중 비싼 것부터
      stock.sort((a, b) => b.price - a.price);
      if (s.hp < s.maxHp * 0.5) stock.sort((a, b) => (b.id === 'meat') - (a.id === 'meat'));
      stock.forEach(it => { if (!it.sold && r.silver >= it.price) { r.silver -= it.price; it.sold = true; if (it.item) s.gotLoot(it.item); else this.apply(it.id); } });
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
      case 'tome': r.xp = D.xpNeed(r.lv, s.early); s.gainXp(0); break;
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
    if (D.PC) c.add(s.add.text(W / 2, 330, t('pc.pauseKeys'), font9(9, '#a1b2b6')).setOrigin(0.5, 0));
    c.add(s.add.text(W / 2, 172, t('overlay.3b6992'), font(14)).setOrigin(0.5));
    const sk = Object.entries(s.run.skills).map(([k, lv]) => `${D.SKILLS[k].name} ${lv}`).join('\n');
    c.add(s.add.text(W / 2, 192, sk, { ...font9(10), align: 'center' }).setOrigin(0.5, 0).setLineSpacing(1));
    c.add(button(s, W / 2, 268, 130, 26, t('overlay.9cb367'), () => this.end(c), { color: 0x2f6b3a }));
    c.add(button(s, W / 2, 300, 130, 24, t('overlay.851565'), () => { if (c !== this.c) return; s.log('give_up', { wave: s.wave, progress: Math.round(s.runProgress() * 100) }); this.end(c); s.over = true; s.physics.pause(); this.result(false); }, { size: 10, color: 0x8a2f3a }));
  }

  // ── 쓰러졌을 때 부활 제안(판당 1번): 광고 또는 보석 ──
  revive() {
    const s = this.s, sv = s.sv;
    const c = this.begin('revive');
    s.log('revive_offer', { gem: sv.gem, can_gem: sv.gem >= D.REVIVE_GEM, no_ads: !!sv.noAds });
    c.add(panel(s, 30, 150, W - 60, 190, { fill: 0x1a1426, line: 0x7a3a4a }));
    c.add(s.add.text(W / 2, 176, t('overlay.099a98'), font(16, '#ff7070')).setOrigin(0.5));
    c.add(s.add.text(W / 2, 194, t('overlay.a0ae79'), font9(10, '#f2e4bc')).setOrigin(0.5));
    // 다시 하기와 다른 점: 지금까지 키운 것이 그대로 남는다
    c.add(s.add.text(W / 2, 210, t('overlay.92df3b', { lv: s.run.lv }), font9(10, '#9ae0ff')).setOrigin(0.5));
    let busy = false;
    const up = () => { this.end(c); s.reviveNow(); };
    const free = !sv.noAds && sv.stats.runs <= D.FREE_REVIVE_RUNS;   // 판 수는 전투 시작 때 오른다(첫 판 = 1)
    const ad = button(s, W / 2, 232, 170, 28, sv.noAds ? t('overlay.1d93b9') : free ? t('overlay.87dafa', { FREE_REVIVE_RUNS: D.FREE_REVIVE_RUNS }) : adWord(t('overlay.0ff047'), t('overlay.1d93b9')), async () => {
      if (busy || c !== this.c) return; busy = true;
      const ok = free || await showAd(s, sv, 'revive');
      busy = false;
      s.log('revive_choice', { via: free ? 'free' : 'ad', ok });
      if (ok && c === this.c) up();
    }, { size: 11, color: 0x2f6b3a });
    const gm = button(s, W / 2, 268, 170, 28, t('overlay.5bcd68', { REVIVE_GEM: D.REVIVE_GEM }), () => {
      if (busy || c !== this.c || sv.gem < D.REVIVE_GEM) return;
      sv.gem -= D.REVIVE_GEM; save(); s.log('revive_choice', { via: 'gem', ok: true, gem_left: sv.gem }); up();
    }, { size: 11, color: 0x3a3846 });
    // 보석이 모자라면 버튼 대신 작은 안내만(못 누르는 큰 버튼이 광고 부활을 가렸다)
    if (sv.gem >= D.REVIVE_GEM) {
      c.add([gm, gemIcon(s, W / 2 - 62, 268, 12)]);
      c.add(s.add.text(W / 2 + 70, 288, t('overlay.4a8baf', { gem: sv.gem }), font9(10, '#ff9ad0')).setOrigin(1, 0));
    } else { gm.destroy(); c.add(s.add.text(W / 2, 266, t('overlay.0a1e97', { REVIVE_GEM: D.REVIVE_GEM, gem: sv.gem }), font9(10, '#7d8f94')).setOrigin(0.5)); }
    c.add(ad);
    // 58차: 포기는 큰 빨강 버튼 대신 작은 회색 링크(선택 부담을 줄인다)
    const gl = s.add.text(W / 2, 318, t('overlay.2facf7'), font9(10, '#8a98a0')).setOrigin(0.5);
    const ul = s.add.rectangle(W / 2, 318 + gl.height / 2, gl.width, 1, 0x8a98a0);
    const hit = s.add.rectangle(W / 2, 318, Math.max(96, gl.width + 24), 26, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (busy || c !== this.c) return;
      s.log('revive_choice', { via: 'giveup' });
      this.end(c); s.die(true);
    });
    c.add([ul, gl, hit]);
  }

  // ── 결과 ──
  result(win) {
    const s = this.s, sv = s.sv, r = s.run;
    if (this.done) return; this.done = true;
    s.over = true; s.physics.pause();
    midgameBeforeBattle(s, sv);   // CrazyGames: 다음 판으로 갈 때 중간 광고
    if (s.mode) return s.mode.result(win, this);   // 모드 판은 모드 전용 결과창(modes.js)
    const idx = s.c * D.STAGES_PER_CHAPTER + s.s, hard = s.hard, dun = s.dungeon;
    const prog = hard ? sv.hardCleared : sv.cleared;   // 어려움은 따로 센다
    const first = win && !s.endless && !dun && idx >= prog;
    let gold, stone = r.stones, guard = 0, sweep = 0, gem = 0, charm = 0, dunItems = 0;
    const dunF = dun ? r.kills / D.DUNGEON.killNeed : 0;
    // 무한의 탑: 버틴 층만큼 받고, 최고 기록을 넘은 층마다 보석
    const floors = s.wave, best = sv.endBest || 0;
    if (s.endless) {
      gold = D.clearGold(s.c, D.STAGES_PER_CHAPTER - 1) * D.ENDLESS.goldPerFloor * floors;
      stone += D.ENDLESS.stonePerFloor * floors;
      gem = Math.max(0, floors - best) * D.ENDLESS.gemPerNewFloor;
      sv.endBest = Math.max(best, floors); noteTower(floors); tossSubmitRecord(sv);
      if (floors >= 3) mission('clear');
    } else if (dun) {
      // 일일 던전: 잡은 만큼(최소 20%) 요일 보상
      const g = D.dunReward(dun, D.dunBase(sv), dunF);
      gold = g.gold || 0; stone += g.stone || 0; gem = g.gem || 0; dunItems = g.items || 0;
      sv.stats.dun = (sv.stats.dun || 0) + 1; mission('dun');
    } else if (win) {
      gold = Math.round(D.goldOf(s.c, s.s, hard) * (first ? D.FIRST_CLEAR_MUL : 1));
      stone += D.stoneOf(s.c, s.s, hard);
      mission('clear');
      if (first && hard) { sv.hardCleared = idx + 1; sweep = 1; if (s.isBoss) guard = 1; else charm = 1; gem = s.isBoss ? D.HARD.bossGem : D.HARD.firstGem; }
      else if (first) { sv.cleared = idx + 1; sweep = 1; if (s.isBoss) guard = 1; else charm = 1; gem = s.isBoss ? D.GEM_FREE.bossFirst : D.GEM_FREE.stageFirst; }   // 일반 판 첫 클리어: 강화 성공률을 올리는 행운 부적
      if (!hard) sv.best[idx] = 1;
      // 새 무기: 보스를 처음 잡으면 확정, 처음 깬 판 20%, 다시 깬 판 5%. 어떤 무기인지는 무작위
      r.newW = grantWeapon(sv, first && s.isBoss ? 1 : first ? 0.2 : 0.05);
      // 무기를 다 모았으면 보스 첫 처치 무기 보상은 강화석으로 바꿔 준다
      if (!r.newW && first && s.isBoss && WTYPES.every(w => hasW(sv, w.id))) { stone += D.DUP_W_STONE; r.dupW = true; }
      // 장 보스를 처음 잡으면 24시간 성장 꾸러미(그 장에 맞는 강화석·방지권)
      if (first && !hard && s.isBoss && !s.bot) { sv.grow = { c: s.c, at: Date.now() }; s.log('grow_offer', { c: s.c }); }
      if (r.newW) s.log('weapon_get', { wtype: r.newW.id, first, boss: s.isBoss });
    } else {
      gold = Math.round(D.goldOf(s.c, s.s, hard) * s.runProgress() * D.FAIL_GOLD_RATE);
      // 초반 스테이지는 내림하면 0개가 된다: 1/4 넘게 버텼으면 최소 1개
      const fs = Math.floor(D.stoneOf(s.c, s.s, hard) * s.runProgress() * D.FAIL_STONE_RATE);
      stone += s.runProgress() >= 0.25 ? Math.max(1, fs) : fs;
    }
    if (!s.endless && !dun) gold += r.goldBag || 0;   // 58차: 판 안에서 주운 금화
    gold = Math.round(gold);
    // 장비: 이기면 1개(보스는 2개, 한 등급 위로), 무한의 탑은 3층부터 1개. 판에서 주운 것은 져도 남는다
    const loot = r.loot.slice();
    // 마지막 장 보스를 처음 잡으면 완주 보상
    const finale = first && !hard && s.isBoss && s.c === D.MAIN_CHAPTERS - 1;
    if (finale) { gem += D.FINALE.gem; sweep += D.FINALE.sweep; guard += D.FINALE.guard; stone += D.FINALE.stone; for (let i = 0; i < D.FINALE.items; i++) loot.push(makeItem(s.c, { boost: 2 })); }
    // 처음 깬 판은 한 등급 위로(판마다 받는 게 손에 잡히게)
    // 어려움은 5장 수치 장비가 한 등급 위로 나온다
    if (win && !s.endless && !dun) for (let i = 0; i < (s.isBoss ? 2 : 1); i++) loot.push(makeItem(hard ? D.openN() - 1 : s.c, { boost: hard || s.isBoss || first ? 1 : 0 }));
    if (s.endless && floors >= 3) loot.push(makeItem(s.c, { boost: 1 }));
    for (let i = 0; i < dunItems; i++) loot.push(makeItem(s.c, { boost: 1, w: sv.wtype }));
    if (!win && !s.endless && !dun) {
      sv.stats.losses = (sv.stats.losses || 0) + 1;
      // 할머니 뜨개 모자: 열 번째 쓰러졌을 때
      if (sv.stats.losses >= 10) { const e = grantEgg(sv, 'granny', false); if (e) loot.push(e); }
    }
    addItems(sv, loot);
    const tidy = { ...lastTidy() };
    // 1-1을 처음 깼을 땐 얻은 장비 중 지금 낀 것보다 좋은 것을 알아서 낀다(처음 하는 사람은 장비 탭을 열 줄 모른다)
    const autoEq = [];
    if (first && !hard && idx === 0) {
      for (const it of loot.slice().sort((a, b) => itemScore(b) - itemScore(a))) {
        if (it.egg || it.bag || !sv.inv.includes(it)) continue;
        if (sv.eq[it.s] === it.u) { autoEq.push(it); continue; }   // 빈 부위라 addItems가 이미 끼웠다
        const cur = equipped(sv).find(x => x.s === it.s);
        if (!cur || itemScore(it) > itemScore(cur)) { sv.eq[it.s] = it.u; autoEq.push(it); }
      }
    }
    eggsSettled();
    // 보스를 처음 잡으면 그 보스 펫이 합류한다. 펫이 없으면 알아서 데려간다(펫 탭을 안 열어도 보이게)
    const newPet = first && !hard && PETS.find(p => p.unlock === sv.cleared);
    if (newPet && !sv.pet) sv.pet = newPet.id;
    sv.gold += gold; sv.stone += stone; sv.guard += guard; sv.sweep = Math.min(D.SWEEP_MAX, sv.sweep + sweep); sv.gem += gem; sv.charm = (sv.charm || 0) + charm;
    // 도감: 이번 판 처치·획득으로 새로 찬 칸
    const dexNew = dexRefresh(sv);
    save();
    if (dexNew > 0 && !s.bot) s.time.delayedCall(1200, () => toast(s, t('overlay.b6f158', { dexNew, v: Math.round(dexNew * DEX_HP * 1000) / 10 }), '#9ae0ff', s.cosCard ? 8 : 454));   // 63차: 결과 창(y 84~452) 제목·무기 줄을 가리던 위쪽 띠를 창 아래로
    if (win && first && !hard && !s.endless && !dun && !s.bot && !s.mode) {   // 깔때기: 1-1·1-3 첫 클리어(한 기기에 한 번)
      if (idx === 0) trackOnce('funnel_clear_1_1', { t: Math.round(s.bt / 1000), power: D.powerOf(sv) });
      if (idx === 2) trackOnce('funnel_clear_1_3', { t: Math.round(s.bt / 1000), power: D.powerOf(sv) });
    }
    s.log('battle_end', { win, first, hard, dungeon: dun || 'none', progress: Math.round((win ? 1 : s.runProgress()) * 100), wave: s.wave, floors: s.endless ? floors : undefined, kills: r.kills, gold, stone, gem, power: D.powerOf(sv), rec: s.endless ? undefined : D.recPower(s.c, s.s), top_dmg: s.topHit(), revived: !!r.revived, cleared: sv.cleared, loot: loot.length, skills: Object.entries(r.skills).map(([k, v]) => k + v).join(',').slice(0, 100) });
    endBgm();
    sfx(win ? 'win' : 'fail');
    // 열린 창이 있으면 닫고 결과만 띄운다
    if (this.c) { this.c.destroy(); this.c = null; this.open = null; }
    this.queue = []; this.pendingLv = 0;
    const c = this.begin('result');
    cosmeticResultCard(s, c, win);
    c.add(panel(s, 20, 84, W - 40, 368, { fill: 0x1a1426, line: win ? 0xffd75e : 0x7a3a4a }));
    if (D.PC) c.add(s.add.text(W / 2, 459, t('pc.resultKeys'), font9(9, '#a1b2b6')).setOrigin(0.5, 0));
    const dunFull = dun && dunF >= 1;
    const title = s.add.text(W / 2, 118, s.endless ? (floors > best ? t('overlay.747619') : t('overlay.0a1382')) : dun ? (dunFull ? t('overlay.be4ff0') : t('overlay.87a62f')) : win ? (s.isBoss ? t('overlay.d2fe64') : t('overlay.aaa1a2')) : t('overlay.099a98'), font(18, win || dunFull || (s.endless && floors > best) ? '#ffd75e' : '#ff7070')).setOrigin(0.5).setScale(2);
    c.add(title); s.tweens.add({ targets: title, scale: 1, duration: 300, ease: 'Back.Out' });
    c.add(s.add.text(W / 2, 142, s.endless ? t('overlay.9f9bf4', { endBest: sv.endBest }) : dun ? t('battle.023b82', { name: D.DUN_TYPES[dun].name }) : `${hard ? t('lobby.52de23') : ''}${s.c + 1}-${s.s + 1} ${s.ch.name}${first ? t('overlay.d13fa1', { FIRST_CLEAR_MUL: D.FIRST_CLEAR_MUL }) : ''}`, font9(10, hard ? '#ff9090' : '#a1b2b6')).setOrigin(0.5));
    // 61차: 보스 첫 클리어(새 펫·새 무기)는 핵심을 위로 올리고, 판 기록은 한 줄·보상은 아이콘 칩으로 묶는다(10줄 넘게 쌓여 새 무기가 묻혔다. 보상 수치는 그대로)
    const keyW = win && !s.endless && !dun && r.newW, keyMode = !!(keyW || (win && !s.endless && !dun && newPet));
    let rewY0 = 214, rewH = 22, cy = 0;
    if (keyMode) {
      const ln = [];
      if (keyW && newPet) ln.push([t('overlay.7b8cb9', { name: newPet.name }), font9(10, '#ffb050')]);
      if (keyW) ln.push([t('overlay.5e1ee0', { name: keyW.name }), font(11, '#ffd75e')], [t('overlay.41dd1f', { name: keyW.name, st: { str: t('gear.ef089e'), dex: t('gear.64b53c'), int: t('gear.448d3a') }[keyW.stat] }), font9(10, '#f2e4bc')]);
      else ln.push([t('overlay.7b8cb9', { name: newPet.name }), font(11, '#ffd75e')]);
      const ph = 8 + ln.length * 14;
      c.add(panel(s, 36, 154, W - 72, ph, { fill: 0x2a2010, line: 0xffb050 }));
      ln.forEach(([tx0, f], i) => { const o = s.add.text(W / 2, 154 + 13 + i * 14, tx0, f).setOrigin(0.5); o.isBtnLabel = true; o.setScale(Math.min(1, (W - 84) / o.width)); c.add(o); });
      cy = 154 + ph + 11;
      const ct = s.add.text(W / 2, cy, `${t('battle.5e9c0f')} ${fmt(r.kills)}  ·  ${t('overlay.453d0d')} ${r.lv}`, font9(10, '#a1b2b6')).setOrigin(0.5); ct.setScale(Math.min(1, (W - 40) / ct.width)); c.add(ct);
      c.add(s.add.rectangle(W / 2, cy + 10, W - 80, 1, 0x293845));
      rewY0 = cy + 24; rewH = 20;
    }
    // 판 기록은 한 줄 칸으로(이름·값 세 줄이 보상 목록과 섞여 빽빽했다)
    const lines = [[t('battle.5e9c0f'), fmt(r.kills)], [t('overlay.453d0d'), String(r.lv)]];
    if (s.endless) lines.push([t('overlay.163795'), t('overlay.756235', { floors })]); else if (dun) lines.push([t('lobby.0c955c'), Math.round(Math.max(D.DUNGEON.minPay, Math.min(1, dunF)) * 100) + '%']); else if (!win) lines.push([t('overlay.2dde29'), Math.round(s.runProgress() * 100) + '%']);
    if (!keyMode) lines.forEach(([a, b], i) => {
      const x = W / 2 + (i - (lines.length - 1) / 2) * 70;
      c.add(s.add.text(x, 164, a, font9(10, '#a1b2b6')).setOrigin(0.5));
      c.add(s.add.text(x, 180, b, font(13)).setOrigin(0.5));
    });
    if (!keyMode) c.add(s.add.rectangle(W / 2, 198, W - 80, 1, 0x293845));
    const rew = [[12, t('contentTab.a3755a'), gold], [13, t('contentTab.5bf71e'), stone]];
    if (guard) rew.push([11, t('lobby.2e604f'), guard]);
    if (sweep) rew.push([15, t('overlay.27f21d'), sweep]);
    if (charm) rew.push([7, t('lobby.c5e28a'), charm]);
    if (gem) rew.push([-1, t('lobby.1fed91'), gem]);
    const tx = [];
    // 보상은 두 칸 격자(한 줄씩 쌓으면 보스 보상 6줄이 겹쳤다)
    if (keyMode) rew.forEach(([ic, name, n], i) => {   // 아이콘 칩: 한 줄에 셋
      const x = 26 + (i % 3) * 74, y = rewY0 + Math.floor(i / 3) * rewH;
      c.add(ic < 0 ? gemIcon(s, x + 8, y, 12) : icon(s, x + 8, y, ic, 16));
      const nt0 = s.add.text(x + 20, y, '+0', font(12)).setOrigin(0, 0.5); c.add(nt0); tx.push(nt0);
      const o = { v: 0 };
      s.tweens.add({ targets: o, v: n, duration: 350, delay: 150 + i * 80, onUpdate: () => nt0.setText('+' + fmt(Math.round(o.v))), onComplete: () => sfx('coin') });
    });
    else rew.forEach(([ic, name, n], i) => {
      const x = i % 2 ? 146 : 38, y = 214 + Math.floor(i / 2) * 22;
      c.add(ic < 0 ? gemIcon(s, x + 8, y, 12) : icon(s, x + 8, y, ic, 16));
      { const nt = s.add.text(x + 20, y, name, font9(10, '#a1b2b6')).setOrigin(0, 0.5), mw = 66 - (('+' + fmt(n)).length * 7 + 3); if (nt.width > mw) nt.setScale(Math.max(0.6, mw / nt.width)); c.add(nt); }
      const t = s.add.text(x + 88, y, '+0', font(12)).setOrigin(1, 0.5); c.add(t); tx.push(t);
      const o = { v: 0 };
      s.tweens.add({ targets: o, v: n, duration: 350, delay: 150 + i * 80, onUpdate: () => t.setText('+' + fmt(Math.round(o.v))), onComplete: () => sfx('coin') });
    });
    // 52차: 이겼을 때 가운데 빈 곳 — 이 장 별(깬 판 수)·다음 목표·도감 진행(보상 줄 아래에 이어 붙인다)
    if (win && !s.endless && !dun && !hard) {
      const per = D.STAGES_PER_CHAPTER, done = Math.max(0, Math.min(per, sv.cleared - s.c * per)), rows = Math.ceil(rew.length / (keyMode ? 3 : 2));
      let y = rewY0 + (rows - 1) * rewH + (keyMode ? 18 : 24);
      c.add(s.add.text(W / 2, y, t('overlay.2bf75f', { repeat: '★'.repeat(done), repeat2: '☆'.repeat(per - done), v: s.c + 1, done, per }), font(11, '#ffd75e', 2)).setOrigin(0.5)); y += 15;
      // 아래 보조 버튼 줄(y 294~)과 겹치지 않는 줄만 쓴다(보상이 6칸이면 별 줄만 남는다)
      if (sv.cleared < D.openTotal() && y <= 286) {
        const ni = sv.cleared, nc = Math.floor(ni / per), ns = ni % per, pw = D.powerOf(sv), rp = D.recOf(nc, ns, false);
        const nt = s.add.text(W / 2, y, t('overlay.451078', { v: nc + 1, v2: ns + 1, fmt: fmt(rp), fmt2: fmt(pw) }), font9(10, D.powerCol(pw, rp, ns))).setOrigin(0.5);
        nt.setScale(Math.min(1, (W - 40) / nt.width)); c.add(nt); y += 14;
      }
      if (rows < 3 && y <= 286) { const dx = dexState(sv); c.add(s.add.text(W / 2, y, t('overlay.bf1d48', { n: dx.n, all: dx.all, v: dexNew > 0 ? ` (+${dexNew})` : '' }), font9(10, '#9ae0ff')).setOrigin(0.5)); }
    }
    // 졌으면 무엇이 모자랐는지 숫자로 보여 준다
    // 아깝게 졌으면 얼마나 가까웠는지 한 줄(다시 하기를 앞으로)
    const close = !win && !s.endless && !dun && s.runProgress() >= D.CLOSE_LOSS;
    if (close) {
      const bm = s.boss?.m, left = Math.max(1, Math.ceil((s.waveCount * s.waveLen - (s.wave * s.waveLen + s.waveT)) / 1000));
      const msg = s.bossPhase && bm ? t('overlay.de79d2', { max: Math.max(1, Math.round(bm.hp / bm.maxHp * 100)) }) : t('overlay.cd086b', { left });
      const ct = s.add.text(W / 2, 247, msg, font(12, '#ffd75e')).setOrigin(0.5); c.add(ct);
      s.tweens.add({ targets: ct, scale: 1.08, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (!win && !s.endless && !dun && !close) {   // 아깝게 졌으면 '한 번 더'만 권한다(강화하자와 둘로 갈렸다)
      const pw = D.powerOf(sv), rp = D.recOf(s.c, s.s, hard);
      c.add(s.add.text(W / 2, 266, t('overlay.db8c28', { fmt: fmt(pw), fmt2: fmt(rp) }), font(11, D.powerCol(pw, rp, s.s))).setOrigin(0.5));
      c.add(pw >= rp ? s.add.text(W / 2, 282, s.isBoss ? t('overlay.9fe7e0') : t('overlay.d7b59a'), font9(10, '#a1b2b6')).setOrigin(0.5) : s.add.text(W / 2, 282, t('overlay.d04840', { fmt: fmt(rp - pw) }), font9(11, '#f2e4bc')).setOrigin(0.5));
    }
    // 자랑하기: 이겼거나 탑 기록을 넘으면 공유(친구가 들어올 길이 없었다). 하루 한 번 보석
    // 48차: 첫 3판은 보상과 '다음 판'만 보여 준다. 광고 2배·자랑하기·장착 안내는 4판째부터
    const early = sv.stats.runs <= 3 && !dun && !s.endless;
    const brag = !shareHidden() && !early && !s.bot && !dun && (win || (s.endless && floors > best));
    // 45차: 광고 2배·자랑하기는 한 줄 보조 버튼(둘 다 있으면 반반, 하나면 가운데). 주 버튼은 아래 '다음 판' 하나
    const adOn = !early && !s.bot && adsLeft(sv, 'double') > 0 && gold + stone > 0;
    const sw = adOn && brag ? 112 : 170, sx = adOn && brag ? 58 : 0;
    if (brag) {
      const gift = sv.shareDay !== sv.day, shareGem = sv.shared ? D.SHARE_GEM : D.SHARE_GEM_FIRST;
      // 광고 버튼 아래 한 줄. 강조색은 주 버튼 하나만 쓴다(주황·파랑·초록이 한 창에 다 있었다)
      const sb = button(s, W / 2 + sx, 306, sw, 24, gift ? t('overlay.68c5f2', { shareGem }) : t('overlay.c5cca3'), async () => {
        const msg = s.endless ? t('overlay.31a9cd', { floors }) : t('overlay.e8ddd9', { v: s.isBoss ? t('overlay.4eed44', { name: D.BOSSES[s.ch.boss].name }) : '', v2: s.c + 1, v3: s.s + 1 });
        const text = t('overlay.449754', { v: sv.title ? `[${titleName(sv.title)}] ` : '', v2: hard ? t('lobby.52de23') : '', msg, tierName: D.tierName(sv.tier, s.wtype), enh: sv.enh });
        const r = await shareBrag(s, text, s.endless ? 'endless' : s.isBoss ? 'boss' : 'clear');   // 공유 로직은 share.js
        if (r.gem && sb.scene) sb.label.setText(t('overlay.ab7e90'));
      }, { size: 10, color: 0x3a3846 });
      c.add(sb);
    }
    // 53차: 광고 2배·자랑하기 줄이 없으면(첫 판들) 가운데가 비었다 — 다음 목표를 그 자리에 한 줄로(탭하면 가야 할 곳으로)
    if (win && !s.endless && !dun && !hard && !adOn && !brag) {
      const g = nextGoal(sv, D.powerOf(sv));
      if (g) c.add(s.add.text(W / 2, 306, g.kind === 'power' ? `${g.stage} · ${g.title}` : g.sub, { ...font9(11, '#7fe6ee'), align: 'center', wordWrap: { width: W - 64 } }).setOrigin(0.5));
    }
    // itch.io 체험판: 전체판 링크(결과창 맨 아래 작은 글씨)
    const tl = trialInfo();
    if (tl) c.add(button(s, W / 2, 462, 170, 16, `${tl.label} ▶`, () => { s.log('full_link', { from: 'result' }); openFull('result'); }, { size: 9, color: 0x3a3846 }));
    // 광고 보고 금화·강화석 2배(하루 횟수 제한). 져도 받을 게 있으면 띄운다
    if (adOn) {
      const db = button(s, W / 2 - sx, 306, sw, 24, sv.noAds ? t('overlay.56ce53') : adWord(t('overlay.88b26a'), t('overlay.56ce53')), async () => {
        if (db.used) return; db.used = true; db.setEnabled(false);
        const ok = await showAd(s, sv, 'double');
        s.log('double_reward', { ok, gold, stone });
        if (!ok || !s.scene.isActive()) { db.used = false; db.setEnabled(true); return; }
        sv.ads.double = (sv.ads.double || 0) + 1;
        sv.gold += gold; sv.stone += stone; save();
        tx[0].setText('+' + fmt(gold * 2)); tx[1].setText('+' + fmt(stone * 2));
        [tx[0], tx[1]].forEach(t => s.tweens.add({ targets: t, scale: 1.4, duration: 120, yoyo: true }));
        sfx('coin'); db.label.setText(t('lobby.63b8a7'));
      }, { size: 10, color: 0x3a3846, textColor: '#ffb85c' });   // 보조 줄. 채운 주황은 아래 주 버튼 하나만
      c.add(db);
    }
    // 얻은 장비 줄(판 안, 버튼 위). 빈 부위는 알아서 끼워졌다
    c.add(s.add.rectangle(W / 2, 336, W - 80, 1, 0x293845));
    const egg = loot.find(it => it.egg), top = loot.reduce((a, it) => Math.max(a, it.r < 4 ? it.r : -1), -1);
    // 장 보스를 처음 잡으면 새 무기가 열린다(장마다 받는 큰 보상)
    const wNew = s.run.newW;   // 이번 판에 얻은 새 무기(보스 첫 처치는 확정, 그 밖엔 확률)
    const head = autoEq.length && !early && !wNew && !egg && !newPet ? t('overlay.8270d4', { n: autoEq[0].n, v: autoEq.length > 1 ? t('overlay.e31140', { v: autoEq.length - 1 }) : '' }) : wNew ? t('overlay.5e1ee0', { name: wNew.name }) : s.run.dupW ? t('overlay.954b88', { DUP_W_STONE: D.DUP_W_STONE }) : egg ? t('overlay.504024', { n: egg.n }) : newPet ? t('overlay.7b8cb9', { name: newPet.name }) : top >= 3 ? t('overlay.e27679') : loot.length ? t('overlay.33c668', { length: loot.length }) : '';
    // 보스를 처음 잡으면 새 무기와 보스 펫이 같이 온다: 펫은 한 줄 위에 따로
    if (!keyMode && wNew && newPet) c.add(s.add.text(W / 2, 326, t('overlay.7b8cb9', { name: newPet.name }), font9(10, '#ffb050')).setOrigin(0.5));
    if (tidy.n) {   // 가방이 꽉 차서 알아서 정리한 것 한 줄
      const tt = s.add.text(W / 2, wNew && newPet ? 316 : 326, t('overlay.d0829b', { n: tidy.n, v: tidy.gold ? t('overlay.8bee60', { fmt: fmt(tidy.gold) }) : t('overlay.6f3584', { fmt: fmt(tidy.stone) }) }), font9(10, '#9ae0ff')).setOrigin(0.5);
      tt.setScale(Math.min(1, (W - 24) / tt.width)); c.add(tt);
    }
    if (head && !keyMode) c.add(s.add.text(W / 2, 350, head, wNew || egg || newPet || top >= 3 ? font(11, '#ffb050') : autoEq.length ? font(11, '#5fdc6a') : font9(10, '#a1b2b6')).setOrigin(0.5));
    // 보스 펫 합류는 결과 창 위에 따로 크게 띄운다(한 줄 글씨로는 못 보고 지나갔다)
    // 47차: 새 펫 합류 창은 클리어 카드 위에 겹쳐 뜨지 않는다 — 로비에서 팝업 순서대로(펫 → 꾸러미) 하나씩
    if (newPet && !s.bot) { sv.petJoinPending = newPet.id; save(); }
    if (finale && !s.bot) this.finale();
    // 새 무기는 장비 아이콘 대신 무기 이름 칸으로 보여 준다(장비 그림이 나와 무엇을 얻었는지 헷갈렸다)
    if (wNew && !keyMode) {
      const st = { str: t('gear.ef089e'), dex: t('gear.64b53c'), int: t('gear.448d3a') }[wNew.stat];
      c.add(panel(s, W / 2 - 90, 362, 180, 30, { fill: 0x2a2010, line: 0xffb050 }));
      c.add(s.add.text(W / 2, 371, t('overlay.41dd1f', { name: wNew.name, st }), font(11, '#ffd75e')).setOrigin(0.5));
      c.add(s.add.text(W / 2, 384, t('overlay.ba83de'), font9(10, '#a1b2b6')).setOrigin(0.5));
    }
    const n = wNew && !keyMode ? 0 : Math.min(loot.length, 7), x0 = W / 2 - (n - 1) * 15 - (loot.length > n ? 12 : 0);
    loot.slice(0, n).forEach((it, i) => {
      const box = itemBox(s, x0 + i * 30, 376, it, 26);
      c.add(box); box.setScale(0);
      s.tweens.add({ targets: box, scale: 1, duration: 220, delay: 450 + i * 90, ease: 'Back.Out', onStart: () => it.r >= 2 && sfx('level') });
    });
    if ((!wNew || keyMode) && loot.length > n) c.add(s.add.text(x0 + n * 30 - 6, 376, `+${loot.length - n}`, font(10, '#a1b2b6')).setOrigin(0, 0.5));
    const nextIdx = Math.min(hard ? sv.hardCleared : sv.cleared, D.openTotal() - 1);
    const nextName = `${Math.floor(nextIdx / D.STAGES_PER_CHAPTER) + 1}-${nextIdx % D.STAGES_PER_CHAPTER + 1}`;   // 다음 판 이름을 버튼에 적어 어디로 가는지 보이게(42차)
    // 던전: 남은 횟수가 있으면 바로 한 번 더
    if (dun) {
      const left = D.DUNGEON.daily - (sv.dunN || 0);
      c.add(button(s, 68, 424, 76, 28, t('overlay.90e5f5'), () => { s.log('result_action', { act: 'lobby', dungeon: dun }); s.scene.start('Lobby', { tab: 'battle' }); }, { color: 0x3a3846 }));
      const again = button(s, 176, 424, 136, 32, left > 0 ? t('overlay.774d3b', { left }) : t('overlay.c3c902'), () => {
        if (left <= 0) return;
        sv.dunN = (sv.dunN || 0) + 1; save(); s.log('result_action', { act: 'dungeon_again' });
        s.scene.start('Battle', { chapter: s.c, stage: s.s, hard, dungeon: D.dunToday(), bot: s.bot });
      }, { color: 0x2f6b3a, size: left > 0 ? 11 : 12 });
      again.setEnabled(left > 0); c.add(again);
      s.registry.set('lastResult', { win, dungeon: dun, gold, stone, gem, kills: r.kills, t: s.bt });
      return;
    }
    // 이겼으면 다음 스테이지가 주인공(로비는 작게)
    const fw = win || s.endless;
    // 장 보스를 잡으면 다음 장이 확 세지니 대장간 정비가 주인공이다
    if (win && s.isBoss && !s.endless && (hard ? sv.hardCleared : sv.cleared) <= nextIdx) {
      c.add(button(s, 176, 424, 136, 32, t('overlay.db8527'), () => { s.log('result_action', { act: 'forge', win }); s.scene.start('Lobby', { tab: 'forge' }); }, { color: 0x2f6b3a }));
      c.add(button(s, 68, 424, 76, 28, t('overlay.53f57a'), () => { s.log('result_action', { act: 'next', win }); s.scene.start('Battle', { chapter: Math.floor(nextIdx / D.STAGES_PER_CHAPTER), stage: nextIdx % D.STAGES_PER_CHAPTER, hard, bot: s.bot }); }, { color: 0x3a3846 }));
      s.registry.set('lastResult', { win, gold, stone, idx, kills: r.kills, lv: r.lv, progress: 1, t: s.bt });
      return;
    }
    // 마지막 보스까지 잡았으면 끝: 같은 판을 다시 시작하지 않고 무한의 탑으로
    const total = D.openTotal();
    if (win && !s.endless && !hard && sv.cleared >= total && idx === total - 1) {
      c.add(s.add.text(W / 2, 404, t('overlay.2efaca'), font(12, '#ffd75e')).setOrigin(0.5));
      if (D.openN() <= D.MAIN_CHAPTERS) c.add(s.add.text(W / 2, 418, t('lobby.810f12'), font9(9, '#9ae0ff')).setOrigin(0.5, 0));   // 16장은 업데이트로 열린다: 예고
      c.add(button(s, 68, 440, 76, 28, t('overlay.90e5f5'), () => { s.log('result_action', { act: 'lobby', win }); s.scene.start('Lobby', { tab: 'battle' }); }, { color: 0x3a3846 }));
      c.add(button(s, 176, 440, 136, 32, t('overlay.0ebd12'), () => { s.log('result_action', { act: 'tower', win }); s.scene.start('Battle', { chapter: s.c, stage: 0, endless: true, bot: s.bot }); }, { color: 0x2f6b3a }));
      s.registry.set('lastResult', { win, gold, stone, idx, kills: r.kills, lv: r.lv, progress: 1, t: s.bt });
      return;
    }
    // 다음 판 전투력이 권장의 80%도 안 되면 대장간이 주인공(그대로 보스에 들어가 25초 만에 쓰러졌다)
    const weak = win && !s.endless && D.powerOf(sv) < D.recOf(Math.floor(nextIdx / D.STAGES_PER_CHAPTER), nextIdx % D.STAGES_PER_CHAPTER, hard) * (nextIdx < D.STAGES_PER_CHAPTER ? 0.65 : 0.8);   // 1장은 강화 한두 번이면 넘는다
    if (weak) {
      // 64차: 강화 재료가 남아 있으면 대장간이 큰 주 버튼(대장간을 안 만진 사람이 1-3에서 4번 졌다)
      const forgeMain = powerAct(sv).act === 'enh';
      const goForge = () => { s.log('result_action', { act: 'forge', win }); s.scene.start('Lobby', { tab: 'forge' }); };
      const goNext = () => { s.log('result_action', { act: 'next', win }); const nc = Math.floor(nextIdx / D.STAGES_PER_CHAPTER), ns = nextIdx % D.STAGES_PER_CHAPTER; if (forgeMain && !hard && nc === 0 && D.isBossS(ns)) { s.scene.start('Lobby', { tab: 'battle', autoStart: { c: nc, s: ns } }); return; }   // 65차: 보스 벽 도전도 로비의 '강화하면 쉬워져요' 확인(enhGate)을 거친다
      s.scene.start('Battle', { chapter: Math.floor(nextIdx / D.STAGES_PER_CHAPTER), stage: nextIdx % D.STAGES_PER_CHAPTER, hard, bot: s.bot }); };
      if (forgeMain) {
        c.add(s.add.text(W / 2, 400, t('overlay.weakHint', { n: sv.stone | 0 }), font9(10, '#7fe6ee')).setOrigin(0.5));
        c.add(button(s, 63, 430, 76, 26, t('overlay.weakGo', { nextName }), goNext, { color: 0x3a3846, size: 9 }));
        c.add(button(s, 180, 430, 150, 36, t('nextGoal.enh'), goForge, { color: 0x2f6b3a, size: 13 }));
      } else {
        c.add(button(s, 63, 424, 66, 26, t('lobby.348786'), goForge, { color: 0x3a3846, size: 10 }));
        c.add(button(s, 174, 424, 140, 40, t('overlay.37f495', { nextName }), goNext, { color: 0x2f6b3a, size: 14 }));
      }
      s.registry.set('lastResult', { win, gold, stone, idx, kills: r.kills, lv: r.lv, progress: 1, t: s.bt });
      return;
    }
    const big = fw || close;   // 아깝게 졌으면 '한 번 더'가 주인공
    c.add(button(s, big ? 63 : 82, 424, big ? 66 : 100, big ? 26 : 30, fw ? t('overlay.90e5f5') : close ? t('lobby.348786') : t('overlay.508b94'), () => { s.log('result_action', { act: win || s.endless ? 'lobby' : 'forge', win }); s.scene.start('Lobby', { tab: win || s.endless ? 'battle' : 'forge' }); }, { color: 0x3a3846 }));
    c.add(button(s, big ? 174 : 190, 424, big ? 140 : 100, big ? 40 : 30, win ? (s.endless ? t('overlay.03d1f9') : s.s === 1 && !s.isBoss ? t('overlay.bb3a3e') : t('overlay.37f495', { nextName })) : close ? t('overlay.33b4a9') : t('overlay.e671aa'), () => {
      s.log('result_action', { act: win ? 'next' : 'retry', win });
      if (s.endless) return s.scene.start('Battle', { chapter: s.c, stage: 0, endless: true, bot: s.bot });
      const n = win ? nextIdx : idx;
      s.scene.start('Battle', { chapter: Math.floor(n / D.STAGES_PER_CHAPTER), stage: n % D.STAGES_PER_CHAPTER, hard, bot: s.bot });
    }, { color: 0x2f6b3a, size: big ? 14 : 12 }));
    s.registry.set('lastResult', { win, floors: s.endless ? floors : undefined, gold, stone, idx, kills: r.kills, lv: r.lv, progress: win ? 1 : s.runProgress(), t: s.bt });
  }
}
