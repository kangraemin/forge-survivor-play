// 로비: 전투(스테이지 선택·소탕), 대장간(강화·승급), 훈련(영구 능력치)
import * as D from './data.js';
import { load, save, mission } from './save.js';
import { sfx, setSound, unlock, playBgm } from './sfx.js';
import { font, font9, panel, button, icon, fmt, COLOR, toast, gemIcon, fixedContainer, skinFx, hiCam, skillIcon, weaponIcon } from './ui.js';
import { showAd, buy, grant, giveText, adsLeft, won, firstX2, todayDeal, growOffer, growLeft, soldOut, leftText, msToMidnight, dayKey } from './shop.js';
import { track, logUser } from './log.js';
import { GearTab } from './gearTab.js';
import { ContentTab } from './contentTab.js';
import { dexRefresh } from './codex.js';
import { gearStats, grantEgg, makeItem, addItems, RARITY, spFree, WTYPES, hasW, wtypeOf, recPets, HERO_SKINS, CASH_W, CASH_W_GEM, CASH_W_DMG } from './gear.js';

const { W, H } = D;
const R = Phaser.Math.Between;
const TABS = [['battle', '전투', 1], ['forge', '대장간', 13], ['gear', '장비', 11], ['train', '훈련', 14], ['shop', '상점', 12]];

// 스테이지별 권장 전투력(data.js recPower)
export const recAtk = D.recPower;

// 비급 칸은 좁아 설명 첫 줄만 남기면 문장이 중간에서 잘렸다: 한 줄에 들어가는 짧은 설명
const BOOK_SHORT = { spin: '주변 한 바퀴 베기', dagger: '가까운 적에 단검', bolt: '무작위 적에 벼락', holy: '발밑을 태우는 빛', fireball: '터지는 불덩이', ice: '꿰뚫는 얼음', orb: '몸을 도는 구슬' };

export class Lobby extends Phaser.Scene {
  constructor() { super('Lobby'); }

  // 씬 인스턴스는 재사용되니 전투에서 돌아올 때 잠금·체크 상태를 비운다
  init(data) { this.tab = data?.tab || this.tab || 'battle'; this.busy = false; this.enhQ = false; this.guardOff = false; this.charmOff = false; }
  // 방지권은 가지고 있으면 기본으로 쓴다(직접 끈 경우만 안 씀)
  get useGuard() { return !this.guardOff && this.sv?.guard > 0; }
  get useCharm() { return !this.charmOff && this.sv?.charm > 0 && D.ENH_RATE[this.sv.enh] < 100; }

  create() {
    // 전투가 멈춘 채 끝났어도 로비 애니메이션은 돌아야 한다(애니메이션 관리자는 장면끼리 공유)
    this.anims.resumeAll(); this.anims.globalTimeScale = 1;
    this.sv = load();
    const sv = this.sv;
    setSound(sv.sound);
    this.input.once('pointerdown', () => { unlock(); playBgm('lobby'); });
    playBgm('lobby');
    // 1-1을 처음 깨고 오면 대장간으로 안내한다
    if (sv.cleared >= 1 && !sv.tut.forgeShown) { sv.tut.forgeShown = true; this.tab = 'forge'; save(); }
    // 어려움은 마왕을 잡은 뒤에만. 전투 탭이 보던 난이도를 기억한다
    this.hard = !!sv.hardOn && sv.cleared >= D.HARD.unlock;
    dexRefresh(sv);
    // 처음 고를 챕터는 지금 도전할 곳
    // 판을 새로 깼으면 다음 도전 칸으로 옮긴다(깬 칸에 머물러 1-1만 되풀이했다)
    if (this.selC === undefined || this.lastProg !== this.prog) this.selTop();
    this.lastProg = this.prog;
    this.makeTextures();
    hiCam(this).setBackgroundColor('#0d0a14');
    this.bg = this.add.container(0, 0);
    this.body = this.add.container(0, 0);
    this.makeTop();
    this.makeTabs();
    logUser({ cleared: sv.cleared, tier: sv.tier, enh: sv.enh, payer: !!sv.paidTotal, paid_total: sv.paidTotal || 0, no_ads: !!sv.noAds, pass: sv.passLeft > 0 });
    track('lobby_enter', { tab: this.tab, cleared: sv.cleared, tier: sv.tier, enh: sv.enh, power: D.powerOf(sv), gold: sv.gold, stone: sv.stone, gem: sv.gem, runs: sv.stats.runs, guard: sv.guard, sweep: sv.sweep });
    this.show(this.tab);
    this.cameras.main.fadeIn(200);
    // 자리를 비웠다 돌아오면 견습생이 번 것을 먼저 준다(다른 창보다 앞)
    const idle = this.idleReward();
    if (idle) this.time.delayedCall(250, () => this.welcomeWin(idle));
    else if (this.tab === 'forge' && sv.tut.forgeShown && !sv.tut.forge) this.time.delayedCall(300, () => toast(this, '대장간이 열렸다! 칼을 강화해 보자', '#ffd75e'));
    // 세 판을 하고 난 뒤부터(처음엔 창이 연달아 뜨지 않게): 출석 창, 1-3을 깨면 첫 결제 꾸러미 한 번
    else if (!sv.loginGot && sv.stats.runs >= 3 && sv.loginPop !== sv.day) { sv.loginPop = sv.day; save(); this.time.delayedCall(250, () => this.missionWin(true)); }
    // 장 보스를 처음 잡고 오면 24시간 성장 꾸러미를 한 번 띄운다
    else if (growOffer(sv) && !sv.grow.shown && this.tab === 'battle') this.time.delayedCall(250, () => this.tab === 'battle' && !this.busy && this.growWin());
    else if (sv.cleared >= 2 && !sv.bought.starter && !sv.starterShown && this.tab === 'battle') this.time.delayedCall(250, () => this.tab === 'battle' && this.starterWin());
  }

  // 지금 난이도에서 깬 판 수, 그 다음 도전할 판을 고른다
  get prog() { return this.hard ? this.sv.hardCleared || 0 : this.sv.cleared; }
  selTop() { const top = Math.min(this.prog, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1); this.selC = Math.floor(top / D.STAGES_PER_CHAPTER); this.selS = top % D.STAGES_PER_CHAPTER; }

  // 로비 위에 뜨는 창
  modal() {
    const c = fixedContainer(this).setDepth(2000);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive());
    this.busy = true;
    c.close = () => { c.destroy(); this.busy = false; this.refreshTop(); this.show(this.tab); };
    return c;
  }

  // ── 오늘의 임무 + 출석 ──
  missionReady() {
    const sv = this.sv;
    const n = D.MISSIONS.filter(m => (sv.mis[m.id] || 0) >= m.need && !sv.misGot[m.id]).length;
    const all = D.MISSIONS.every(m => sv.misGot[m.id]) && !sv.misGot.all;
    return n + (all ? 1 : 0) + (sv.loginGot ? 0 : 1) + this.weeklyReady();
  }
  // auto: 하루 첫 접속에 저절로 뜬 창이면 출석 보상을 바로 준다(누를 필요 없이)
  missionWin(auto = false, page = 'day') {
    const sv = this.sv, c = this.modal();
    const day = (sv.streak - 1) % 7, mul = D.loginMul(sv.streak);
    // 7일을 돌 때마다 보상이 커진다(칼빛은 그대로 한 번)
    const scaled = g0 => Object.fromEntries(Object.entries(g0).map(([k, v]) => [k, typeof v === 'number' && k !== 'goldStage' ? Math.round(v * mul) : k === 'goldStage' ? v * mul : v]));
    const claim = () => {
      if (sv.loginGot) return;
      const g = scaled(D.LOGIN_REWARDS[day]);
      if (g.skin && sv.skins?.[g.skin]) delete g.skin;   // 이미 가진 칼빛은 다시 주지 않는다
      sv.loginGot = true; track('login_reward', { day, auto }); grant(sv, g); sfx('win'); this.refreshTop();
      toast(this, `출석 보상 ${giveText(g, sv)}`, '#ffd75e');
    };
    if (auto) claim();
    c.add(panel(this, 16, 60, W - 32, 370, { fill: 0x1a1426, line: 0xffd75e }));
    const body = this.add.container(0, 0); c.add(body);
    this.misPage = page;
    const draw = () => {
      body.removeAll(true);
      // 위: 오늘 / 이번 주 두 칸
      [['day', '오늘의 임무'], ['week', '이번 주 도전']].forEach(([id, name], i) => {
        const x = 74 + i * 92, on = this.misPage === id;
        body.add(this.add.text(x, 80, name, font(on ? 13 : 11, on ? '#ffd75e' : '#8a80a0')).setOrigin(0.5));
        if (on) body.add(this.add.rectangle(x, 92, 70, 2, 0xffd75e));
        if (id === 'week' && this.weeklyReady()) body.add(this.add.circle(x + 44, 74, 3.5, 0xff3a3a));
        const hit = this.add.rectangle(x, 80, 92, 24, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => { if (this.misPage === id) return; sfx('click'); this.misPage = id; draw(); });
        body.add(hit);
      });
      body.add(button(this, W - 38, 80, 26, 22, 'X', () => c.close(), { size: 11, color: 0x3a3846 }));
      if (this.misPage === 'week') return this.weeklyDraw(body, draw);
      D.MISSIONS.forEach((m, i) => {
        const y = 102 + i * 40, have = Math.min(m.need, sv.mis[m.id] || 0), done = have >= m.need, got = sv.misGot[m.id];
        body.add(panel(this, 26, y, W - 52, 34, { fill: got ? 0x141018 : 0x221c33 }));
        body.add(this.add.text(36, y + 5, m.name, font9(10, got ? '#6a6080' : '#ffffff')));
        body.add(this.add.text(36, y + 19, `${have}/${m.need} · 보석 ${D.MISSION_GIVE.gem} 강화석 ${D.MISSION_GIVE.stone}`, font9(10, done ? '#5fdc6a' : '#a89cc8')));
        const bt = button(this, W - 60, y + 17, 52, 24, got ? '완료' : '받기', () => {
          if (got || !done) return;
          sv.misGot[m.id] = true; track('mission_claim', { mission: m.id }); grant(sv, D.MISSION_GIVE); sfx('coin'); this.refreshTop(); draw();
        }, { size: 10, color: 0x2f6b3a });
        bt.setEnabled(done && !got); body.add(bt);
      });
      const allDone = D.MISSIONS.every(m => sv.misGot[m.id]);
      const ab = button(this, W / 2, 236, 190, 24, sv.misGot.all ? '모두 완료 보너스 받음' : `3개 모두 하면 보석 +${D.MISSION_ALL.gem}`, () => {
        if (!allDone || sv.misGot.all) return;
        sv.misGot.all = true; track('mission_claim', { mission: 'all' }); grant(sv, D.MISSION_ALL); sfx('win'); this.refreshTop(); draw();
      }, { size: 10, color: 0x3a3846 });
      ab.setEnabled(allDone && !sv.misGot.all); body.add(ab);
      // 출석 7일
      body.add(this.add.rectangle(W / 2, 258, W - 60, 1, 0x5b4f7a));
      body.add(this.add.text(W / 2, 272, `출석 ${sv.streak}일째`, font(12, '#9ae0ff')).setOrigin(0.5));
      body.add(this.add.text(W / 2, 288, mul > 1 ? `${Math.floor((sv.streak - 1) / 7) + 1}바퀴째라 보상 ×${mul}` : '7일을 돌 때마다 보상이 25%씩 오른다', font9(10, mul > 1 ? '#ffd75e' : '#a89cc8')).setOrigin(0.5));
      D.LOGIN_REWARDS.map(scaled).forEach((g, i) => {
        const x = W / 2 + (i - 3) * 31, y = 324, past = i < day || (i === day && sv.loginGot), today = i === day;
        body.add(this.add.rectangle(x, y, 28, 50, today ? 0x3b2f5c : 0x15111f).setStrokeStyle(1, today ? 0xffd75e : 0x3a3450));
        body.add(this.add.text(x, y - 16, `${i + 1}일`, font9(10, today ? '#ffd75e' : '#8a80a0')).setOrigin(0.5).setPadding(0, 2));
        const [k, v] = Object.entries(g)[0];
        body.add(k === 'gem' ? gemIcon(this, x, y - 3, 12) : icon(this, x, y - 3, { goldStage: 12, stone: 13, guard: 11, sweep: 15 }[k], 14));
        body.add(this.add.text(x, y + 10, k === 'goldStage' ? fmt(Math.round(D.dunBase(sv).gold * v)) : String(v), font9(10, '#ffffff')).setOrigin(0.5));
        if (g.skin && !sv.skins?.[g.skin]) body.add(this.add.text(x, y + 20, '+칼빛', font9(9, '#ff9a5a')).setOrigin(0.5));
        if (past) { body.add(this.add.rectangle(x, y, 28, 50, 0x000000, 0.55)); body.add(this.add.text(x + 9, y - 15, '✓', font(11, '#5fdc6a')).setOrigin(0.5)); }
      });
      const lb = button(this, W / 2, 380, 170, 26, sv.loginGot ? '오늘 출석 완료' : '출석 보상 받기', () => { claim(); draw(); }, { size: 11, color: 0x2f6b3a });
      lb.setEnabled(!sv.loginGot); body.add(lb);
    };
    draw();
  }

  // 자리 비움 보상: 비운 시간(최대 8시간) × 지금 스테이지 클리어 보상의 일부
  idleReward() {
    const sv = this.sv, ms = sv.idleMs || 0;
    sv.idleMs = 0;
    if (sv.cleared < 1 || ms < D.IDLE.minMin * 60000) return null;
    const raw = ms / 3600000, h = Math.min(D.IDLE.capH, raw), base = D.dunBase(sv);   // 어려움을 시작했으면 어려움 판 기준
    return { h, raw, gold: Math.round(base.gold * D.IDLE.perH * h), stone: Math.max(1, Math.round(base.stone * D.IDLE.perH * h)), gem: ms >= D.IDLE.bonusH * 3600000 ? D.IDLE.bonusGem : 0 };
  }

  welcomeWin({ h, raw, gold, stone, gem }) {
    const sv = this.sv, c = this.modal();
    sv.gold += gold; sv.stone += stone; sv.gem += gem; save(); this.refreshTop();
    track('idle_reward', { hours: Math.round(h * 10) / 10, gold, stone, gem });
    c.add(panel(this, 24, 130, W - 48, 220, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(this.add.text(W / 2, 152, '돌아왔구나!', font(14, '#ffd75e')).setOrigin(0.5));
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    // 최대보다 오래 비웠으면 실제로 비운 시간과 지급 상한을 따로 적는다(13시간 비웠는데 '8시간'이라 하면 이상했다)
    c.add(this.add.text(W / 2, 174, raw > D.IDLE.capH ? `${Math.floor(raw)}시간 비움 · 최대 ${D.IDLE.capH}시간 몫을 벌어 뒀다` : `${hh ? `${hh}시간 ` : ''}${mm}분 동안 견습생이 벌어 뒀다`, font9(10, '#c8bfe0')).setOrigin(0.5));
    const tx = [];
    [[12, gold, '#ffd75e'], [13, stone, '#9ae0ff']].forEach(([ic, v, col], i) => {
      const x = W / 2 - 50 + i * 100;
      c.add(icon(this, x, 214, ic, 26));
      const t = this.add.text(x, 242, '+' + fmt(v), font(13, col)).setOrigin(0.5); c.add(t); tx.push(t);
    });
    c.add(gem ? this.add.text(W / 2, 268, `오래 기다렸다! 보석 +${gem}`, font(10, '#ff9ad0')).setOrigin(0.5) : this.add.text(W / 2, 268, `최대 ${D.IDLE.capH}시간까지 쌓인다`, font9(9, '#8a80a0')).setOrigin(0.5));
    if (adsLeft(sv, 'double') > 0) {
      const db = button(this, W / 2, 296, 180, 24, sv.noAds ? '2배 받기' : '광고 보고 2배 ▶', async () => {
        if (db.used) return; db.used = true; db.setEnabled(false);
        const ok = await showAd(this, sv, 'double');
        if (!ok || !this.scene.isActive()) { db.used = false; db.setEnabled(true); return; }
        sv.ads.double = (sv.ads.double || 0) + 1;
        sv.gold += gold; sv.stone += stone; save(); this.refreshTop();
        tx[0].setText('+' + fmt(gold * 2)); tx[1].setText('+' + fmt(stone * 2));
        sfx('coin'); db.label.setText('2배 받았다!'); track('idle_double', { gold, stone });
      }, { size: 10, color: 0x2f6b3a });
      c.add(db);
    }
    c.add(button(this, W / 2, 330, 110, 26, '좋아', () => c.close(), { size: 11, color: 0x2f6b3a }));
  }

  // 1-3을 깬 뒤 한 번만: 첫 결제 꾸러미
  starterWin() {
    const sv = this.sv, it = D.IAP.find(x => x.id === 'starter'), c = this.modal();
    sv.starterShown = true; save(); track('starter_offer_show', { cleared: sv.cleared });
    c.add(panel(this, 24, 130, W - 48, 210, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(this.add.text(W / 2, 152, '처음 온 대장장이에게만', font9(10, '#ff9ad0')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 172, it.name, font(14, '#ffd75e')).setOrigin(0.5));
    c.add(gemIcon(this, W / 2, 204, 26));
    c.add(this.add.text(W / 2, 230, giveText(it.give), { ...font9(10, '#e8e2f8'), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2, 268, `${it.tag}  ·  ${won(it.price)}`, font(11, '#ffd75e')).setOrigin(0.5));
    c.add(button(this, 88, 310, 96, 28, '다음에', () => { track('starter_offer_close'); c.close(); }, { size: 11, color: 0x3a3846 }));
    c.add(button(this, 186, 310, 100, 28, '사기', async () => {
      track('starter_offer_click');
      const ok = await buy(this, sv, it);
      if (ok) toast(this, `${it.name} 구매 완료!`, '#ffd75e');
      c.close();
    }, { size: 12, color: 0x2f6b3a }));
  }

  // 장 보스 첫 처치 뒤 한 번: 24시간 성장 꾸러미
  growWin() {
    const sv = this.sv, it = growOffer(sv);
    if (!it) return;
    const c = this.modal();
    sv.grow.shown = true; save(); track('grow_offer_show', { c: it.c });
    c.add(panel(this, 24, 130, W - 48, 210, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(this.add.text(W / 2, 152, `${it.c + 1}장 보스 격파 축하!`, font9(10, '#ff9ad0')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 172, it.name, font(13, '#ffd75e')).setOrigin(0.5));
    c.add(icon(this, W / 2, 202, 13, 24));
    c.add(this.add.text(W / 2, 222, giveText(it.give, sv), { ...font9(10, '#e8e2f8'), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2, 256, `다음 장 강화에 맞춘 꾸러미 · ${won(it.price)}`, font(10, '#ffd75e')).setOrigin(0.5));
    const lt = this.add.text(W / 2, 274, '', font9(10, '#ff9a8a')).setOrigin(0.5); c.add(lt);
    const tick = () => { if (!lt.active) return; lt.setText(`24시간 한정 · 남은 ${leftText(growLeft(sv))}`); this.time.delayedCall(1000, tick); }; tick();
    c.add(button(this, 88, 310, 96, 28, '다음에', () => { track('grow_offer_close'); c.close(); }, { size: 11, color: 0x3a3846 }));
    c.add(button(this, 186, 310, 100, 28, '사기', async () => {
      track('grow_offer_click');
      const ok = await buy(this, sv, it);
      if (ok) toast(this, `${it.name} 구매 완료!`, '#ffd75e');
      c.close();
    }, { size: 12, color: 0x2f6b3a }));
  }

  makeTextures() {
    const g = this.make.graphics({ add: false });
    // 망치 그림이 로드돼도 불티(spark)는 따로 만든다(같이 건너뛰면 강화 불꽃이 깨진다)
    if (!this.textures.exists('spark')) g.fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('spark', 2, 2);
    if (this.textures.exists('hammer')) return g.destroy();
    g.clear().fillStyle(0x0a0710).fillRect(9, 0, 4, 22).fillRect(0, 0, 22, 9);
    g.fillStyle(0x7a4a22).fillRect(10, 8, 2, 13);
    g.fillStyle(0x9aa4b8).fillRect(1, 1, 20, 7);
    g.fillStyle(0xd8e0f0).fillRect(1, 1, 20, 2);
    g.generateTexture('hammer', 22, 22);
    g.destroy();
  }

  // ── 상단: 재화 ──
  makeTop() {
    const sv = this.sv;
    this.add.rectangle(0, 0, W, 34, 0x07050c, 0.9).setOrigin(0).setDepth(50);
    this.add.rectangle(0, 34, W, 1, COLOR.line).setOrigin(0).setDepth(50);
    const items = [[12, () => fmt(sv.gold)], [13, () => fmt(sv.stone)], [11, () => sv.guard], [15, () => `${sv.sweep}`], [-1, () => fmt(sv.gem)]];
    this.topTxt = items.map(([ic, get], i) => {
      const x = [4, 66, 116, 154, 192][i];   // 금화 자리를 넓게: 네 자리면 옆 아이콘에 붙는다
      if (ic < 0) gemIcon(this, x + 7, 17, 13).setDepth(51);
      else this.add.existing(icon(this, x + 7, 17, ic, 14).setDepth(51));
      const t = this.add.text(x + 17, 10, '', font(11, '#ffffff')).setDepth(51);   // 숫자는 흰색: 색은 아이콘이 맡는다(다섯 색이 나란히 있어 어지러웠다)
      t.get = get; return t;
    });
    // 소리 켜고 끄기
    const snd = this.add.text(W - 8, 17, sv.sound ? '♪' : '×', font(13)).setOrigin(1, 0.5).setDepth(51).setInteractive({ useHandCursor: true });
    snd.on('pointerup', () => { sv.sound = !sv.sound; track('sound_toggle', { on: sv.sound }); setSound(sv.sound); snd.setText(sv.sound ? '♪' : '×'); save(); sfx('click'); if (sv.sound) playBgm('lobby'); });
    this.refreshTop();
  }
  refreshTop() { this.topTxt.forEach(t => t.setText(t.get())); }
  bump(i) { const t = this.topTxt[i]; this.tweens.add({ targets: t, scale: 1.3, duration: 90, yoyo: true }); }

  makeTabs() {
    this.add.rectangle(0, H - 50, W, 50, 0x07050c, 0.95).setOrigin(0).setDepth(50);
    this.add.rectangle(0, H - 50, W, 1, COLOR.line).setOrigin(0).setDepth(50);
    this.tabBtns = TABS.map(([id, name, ic], i) => {
      const tw = W / TABS.length, x = tw / 2 + i * tw, c = this.add.container(x, H - 25).setDepth(51);
      const hl = this.add.rectangle(0, 0, tw - 6, 44, 0xffd75e, 0.12).setStrokeStyle(1, 0xffd75e, 0.5);
      c.add([hl, icon(this, 0, -7, ic, 18), this.add.text(0, 12, name, font(10)).setOrigin(0.5)]);
      c.hl = hl; c.setSize(tw, 50).setInteractive({ useHandCursor: true });
      // 처음엔 전투만: 1-1을 깨면 나머지 탭이 열린다
      const locked = () => id !== 'battle' && this.sv.cleared === 0;
      if (locked()) { c.setAlpha(0.45); c.add(this.add.text(tw / 2 - 4, -22, '🔒1-1', font9(9, '#ffb070')).setOrigin(1, 0)); }
      c.on('pointerup', () => { if (this.busy) return; if (locked()) { sfx('deny'); track('locked_tab_tap', { tab: id }); toast(this, `${name} · 1-1을 깨면 열린다`, '#ff9a8a'); return; } sfx('click'); this.show(id); });
      // 장비 탭: 찍을 스탯이 남았으면 빨간 점
      if (id === 'gear' && !locked() && spFree(this.sv) > 0) c.add(this.add.circle(tw / 2 - 10, -16, 4, 0xff5050));
      // 상점 탭: 성장 꾸러미(24시간 한정)가 열려 있으면 빨간 점
      if (id === 'shop' && !locked() && growOffer(this.sv)) c.add(this.add.circle(tw / 2 - 10, -16, 4, 0xff5050));
      c.id = id; return c;
    });
  }

  show(id) {
    if (id !== this.lastTab) { track('tab_view', { tab: id, page: id === 'shop' ? this.shopPage : undefined }); this.lastTab = id; }
    this.tab = id; this.ticks = [];
    this.tabBtns.forEach(b => b.hl.setVisible(b.id === id));
    // 탭 안 오브젝트의 트윈만 끊는다(토스트·결과 글씨·날아가는 동전은 끝까지 돈다)
    const kill = o => { this.tweens.killTweensOf(o); o.list?.forEach(kill); };
    [this.body, this.bg].forEach(kill);
    this.body.removeAll(true); this.bg.removeAll(true);
    if (id === 'battle') this.battleTab();
    if (id === 'forge') this.forgeTab();
    if (id === 'gear') this.gearTab();
    if (id === 'train') this.trainTab();
    if (id === 'shop') this.shopTab();
    this.body.setAlpha(0); this.tweens.add({ targets: this.body, alpha: 1, duration: 150 });
  }

  // ── 전투 탭 ──
  battleTab() {
    if (this.tower) return this.towerPage();
    const sv = this.sv, b = this.body, c = this.selC, ch = D.CHAPTERS[c], hard = this.hard, prog = this.prog;
    const atk = D.powerOf(sv);
    // 챕터 제목과 화살표(어려움은 붉게)
    b.add(this.add.text(W / 2, 56, `${hard ? '어려움 ' : ''}${c + 1}장  ${ch.name}`, font(15, hard ? '#ff7070' : '#ffd75e')).setOrigin(0.5));
    const unlockedC = Math.floor(Math.min(prog, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1) / D.STAGES_PER_CHAPTER);
    const arrow = (x, d, ok) => {
      const t = this.add.text(x, 56, d < 0 ? '◀' : '▶', font(14, ok ? '#ffffff' : '#3a3450')).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => { if (!ok) return; sfx('click'); this.selC += d; this.selS = Math.min(this.selS, this.selC < unlockedC ? D.STAGES_PER_CHAPTER - 1 : prog % D.STAGES_PER_CHAPTER); if (this.selC === unlockedC) this.selS = Math.min(prog, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1) % D.STAGES_PER_CHAPTER; this.show('battle'); });
      b.add(t);
    };
    arrow(22, -1, c > 0);
    // 마지막 챕터 오른쪽은 무한의 탑(1장 보스를 깨면 열림)
    if (c === unlockedC && sv.cleared >= D.ENDLESS.unlock) {
      const t = this.add.text(W - 22, 56, '∞▶', font(13, '#c8a0ff')).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => { sfx('click'); this.tower = true; track('tower_open', { best: sv.endBest || 0 }); this.show('battle'); });
      b.add(t);
    } else arrow(W - 22, 1, c < unlockedC);
    // 무기가 주인공: 성채 그림 위에 지금 든 무기와 강화 단계를 크게 세운다(칸과 글자만 빽빽했다)
    const pv = this.add.container(0, 0); b.add(pv);
    const AY = 68, AH = 138;
    if (this.textures.exists('lobby_bg')) pv.add(this.add.image(0, AY - 30, 'lobby_bg').setOrigin(0).setCrop(0, 30, W, AH));
    else pv.add(this.add.rectangle(0, AY, W, AH, 0x15111f).setOrigin(0));
    pv.add(this.add.rectangle(0, AY + AH - 44, W, 44, 0x05030a, 0.55).setOrigin(0));
    pv.add(this.add.rectangle(0, AY, W, 18, 0x05030a, 0.5).setOrigin(0));
    const enh = sv.enh, ec = enh >= 15 ? 0xd06bff : enh >= 10 ? 0xff8a2a : enh >= 5 ? 0x5fc8ff : 0x9ad8ff;
    const halo = this.add.image(W / 2, AY + 46, 'disc').setScale(1.3).setTint(ec).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    pv.add(halo);
    this.tweens.add({ targets: halo, scale: 1.3, alpha: 0.18, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const wpn = weaponIcon(this, W / 2, AY + 46, wtypeOf(sv).id, sv.tier, 70 * (1 + Math.min(enh, 20) * 0.012));
    pv.add(wpn);
    this.tweens.add({ targets: wpn, y: wpn.y - 3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    pv.add(this.add.text(W / 2, AY + 84, `+${enh} ${D.tierName(sv.tier, wtypeOf(sv))}`, font(13, enh >= 15 ? '#e8a0ff' : enh >= 10 ? '#ffd75e' : '#ffffff', 3)).setOrigin(0.5));
    // 보스는 오른쪽 위 작게, 아래에 보스까지 몇 판
    const fb = this.registry.get('fallback') || {};
    const bs = this.add.sprite(W - 34, AY + 26, null).play(ch.boss);
    bs.setScale((fb[ch.boss] ? 26 : 34) / bs.height); if (fb[ch.boss]) bs.setTint(D.BOSSES[ch.boss].color);
    pv.add(bs);
    const bossLeft = c * D.STAGES_PER_CHAPTER + D.STAGES_PER_CHAPTER - 1 - prog;
    pv.add(this.add.text(W - 34, AY + 52, bossLeft > 0 ? `보스까지 ${bossLeft}판` : bossLeft === 0 ? '보스 도전!' : '보스 격파', font(9, bossLeft < 0 ? '#a8a0c0' : '#ff9090', 3)).setOrigin(0.5, 0));
    if (sv.title) pv.add(this.add.text(10, AY + 4, `「${sv.title}」`, font9(10, '#ffb050', 3)));
    // 돌아올 이유: 자리를 비워도 견습생이 번다(조용한 한 줄)
    if (sv.cleared >= 1) pv.add(this.add.text(sv.title ? 90 : 10, AY + 4, `견습생 금화 ${fmt(Math.round(D.dunBase(sv).gold * D.IDLE.perH))}/시간`, font9(9, '#d8d0e8', 3)));
    // 스테이지 3칸: 그림 아래 띠에 작게. 무엇이 다른지는 아래 정보판에
    for (let s = 0; s < D.STAGES_PER_CHAPTER; s++) {
      const idx = c * D.STAGES_PER_CHAPTER + s, x = 47 + s * 88, y = AY + AH - 20;
      const locked = idx > prog, done = idx < prog, sel = s === this.selS, boss = D.isBossS(s);
      const g = this.add.container(x, y);
      g.add(panel(this, -38, -14, 76, 28, { fill: locked ? 0x100d16 : sel ? (hard ? 0x3a1a24 : 0x2e2548) : hard ? 0x22121a : 0x1c1729, line: sel ? 0xffd75e : boss && !locked ? 0xa03848 : 0x3a3150 }));
      g.add(this.add.text(0, 0, locked ? '잠김' : `${c + 1}-${s + 1}${boss ? ' 보스' : ''}`, font(11, locked ? '#4a4060' : boss ? '#ff9090' : '#ffffff')).setOrigin(0.5));
      if (done) g.add(this.add.text(34, -12, '★', font(9, '#ffd75e')).setOrigin(1, 0));
      g.setSize(76, 28).setInteractive({ useHandCursor: true });
      g.on('pointerup', () => { if (locked) { sfx('deny'); track('locked_stage_tap', { stage: `${c + 1}-${s + 1}` }); toast(this, '앞 스테이지를 먼저 깨야 한다', '#ff9090'); return; } sfx('click'); this.selS = s; track('stage_select', { stage: `${c + 1}-${s + 1}` }); this.show('battle'); });
      b.add(g);
    }
    // 메뉴 줄: 임무·던전·기록·난이도(받을 게 있으면 빨간 점)
    if (sv.stats.runs > 0) this.menuRow(b);
    // 선택한 스테이지 정보판: 무엇이 다른지 → 전투력 막대 → 보상
    const s = this.selS, idx = c * D.STAGES_PER_CHAPTER + s, done = idx < prog, rec = D.recOf(c, s, hard), boss = D.isBossS(s);
    b.add(panel(this, 12, 244, W - 24, 132, { fill: 0x15111f }));   // 아래 버튼이 탭 바에 붙지 않게 짧게
    const vr = D.stageVariant(c, s), mod = D.stageMod(c);
    const head = boss ? `보스 ${D.BOSSES[ch.boss].name}` : s === 1 ? `${mod.name} 규칙 + 중간 보스` : vr ? `새 몬스터 ${D.VARIANTS[vr[1]].pre} ${D.MOB_NAMES[ch.mobs[vr[0]]]}` : '기본 몬스터';
    const last = idx >= D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1;
    const sub = hard ? (boss ? (last ? '어려움 마지막 보스다' : `잡으면 어려움 ${c + 2}장이 열린다`) : '몹이 훨씬 세고 보상이 크다')
      : boss ? (last ? '마지막 보스. 잡으면 어려움이 열린다' : `잡으면 ${c + 2}장과 새 무기가 열린다`) : s === 1 ? `${mod.desc}. 깨면 다음은 보스` : vr ? D.VARIANTS[vr[1]].desc : '2판 깨면 보스가 나온다';
    b.add(this.add.text(24, 254, `${hard ? '어려움 ' : ''}${c + 1}-${s + 1}  ${head}`, font(12, boss || hard ? '#ff9090' : '#ffffff')));
    b.add(this.add.text(24, 273, sub, { ...font9(10, '#a89cc8'), wordWrap: { width: W - 48 } }));
    // 전투력: 숫자 두 개보다 막대 하나가 빨리 읽힌다
    const pc = D.powerCol(atk, rec, s), ratio = Math.min(1, atk / rec);   // rec는 난이도에 맞춘 권장
    const pl = this.add.text(24, 300, '전투력', font9(10, '#a89cc8')), pt = this.add.text(24 + pl.width + 6, 299, `${atk} / ${rec}`, font(11, pc));
    b.add([pl, pt]);
    // 이 맵에 잘 듣는 펫(데려가고 있으면 초록). 보상 줄과 겹치지 않게 전투력 줄 오른쪽에 둔다
    const rps = recPets(sv, c);
    if (rps.length) {
      const nm = rps.map(p => p.name);
      const rt = this.add.text(W - 24, 301, `추천 펫 ${nm.join(' / ')}`, font9(9, rps.some(p => p.id === sv.pet) ? '#5fdc6a' : '#ffd75e')).setOrigin(1, 0);
      if (rt.x - rt.width < pt.x + pt.width + 8) rt.setText(`추천 펫 ${nm[0]}`);
      b.add(rt);
    }
    const bar = this.add.graphics();
    bar.fillStyle(0x2a2338, 1).fillRect(24, 316, W - 48, 6);
    bar.fillStyle(Phaser.Display.Color.HexStringToColor(pc).color, 1).fillRect(24, 316, Math.max(2, (W - 48) * ratio), 6);
    b.add(bar);
    if (atk < rec) {
      const t = this.add.text(24, 328, '대장간에서 강화하면 깰 수 있다  ▶', font(10, '#ffb070')).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => { sfx('click'); track('to_forge_click', { from: 'battle_tab', power: atk, rec, stage: `${c + 1}-${s + 1}` }); this.show('forge'); });
      b.add(t);
    } else b.add(this.add.text(24, 328, done ? '깬 곳이다. 소탕으로 빠르게 모을 수 있다' : '이길 만하다', font9(10, '#8a80a0')));
    // 보상: 아이콘 + 숫자
    b.add(this.add.rectangle(W / 2, 344, W - 48, 1, 0x2e2740));
    b.add(this.add.text(24, 352, done ? '보상' : '첫 보상', font9(10, '#a89cc8')));
    const wNew = boss && WTYPES.some(w => !hasW(sv, w.id));   // 보스를 처음 잡으면 아직 해금 안 된 무기 하나를 무작위로 준다(캐시 무기와 따로 센다)
    const rw = [[12, fmt(Math.round(D.goldOf(c, s, hard) * (done ? 1 : D.FIRST_CLEAR_MUL)))], [13, `${D.stoneOf(c, s, hard)}`]];
    if (!done && hard) rw.push(boss ? [11, '방지권'] : [7, '부적'], [-1, String(boss ? D.HARD.bossGem : D.HARD.firstGem)]);
    else if (!done) rw.push(boss ? [11, wNew ? '새 무기(무작위)' : '방지권'] : [7, '행운 부적']);
    let rx = 78;
    rw.forEach(([ic, v]) => {
      b.add(ic < 0 ? gemIcon(this, rx, 359, 11) : icon(this, rx, 359, ic, 14));
      const t = this.add.text(rx + 10, 352, v, font(10, '#ffffff')); b.add(t);
      rx += 10 + t.width + 14;
    });
    const go = button(this, 95, 398, 150, 32, boss ? '보스 도전' : '전투 시작', () => this.startBattle(c, s, false, hard), { size: 14, color: boss || hard ? 0x8a2a3a : 0x2f6b3a });
    const sw = button(this, 214, 398, 76, 32, `소탕 ${sv.sweep}`, () => this.sweep(c, s), { size: 11, color: 0x3a3846 });
    sw.setEnabled(done && sv.sweep > 0);
    b.add([go, sw]);
  }

  // 보석이 모자라면 패키지 탭으로 보낸다(첫 구매 2배를 같이 알린다)
  gemShort(need) {
    const sv = this.sv, first = D.FIRST_BUY_X2.some(id => !sv.bought?.[id]);
    this.shopPage = 'pack'; this.show('shop');
    toast(this, `보석 ${need - sv.gem} 부족${first ? ' · 첫 구매는 2배' : ''}`, '#ff9a8a');
  }

  // ── 무한의 탑 ──
  towerPage() {
    const sv = this.sv, b = this.body;
    const c = Math.floor(Math.min(sv.cleared, D.CHAPTERS.length * D.STAGES_PER_CHAPTER - 1) / D.STAGES_PER_CHAPTER);
    b.add(this.add.text(W / 2, 56, '무한의 탑', font(15, '#c8a0ff')).setOrigin(0.5));
    const back = this.add.text(22, 56, '◀', font(14)).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => { sfx('click'); this.tower = false; this.show('battle'); });
    b.add(back);
    b.add(panel(this, 12, 74, W - 24, 92, { fill: 0x1a1430, line: 0x8a6ac8 }));
    b.add(this.add.text(W / 2, 100, `최고 ${sv.endBest || 0}층`, font(22, '#ffd75e')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 128, `${c + 1}장 ${D.CHAPTERS[c].name} 몹이 끝없이 온다`, font9(10, '#c8bfe0')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 146, '판이 끝나야 보상을 받는다', font9(10, '#a89cc8')).setOrigin(0.5));
    b.add(this.add.text(24, 180, '규칙', font(12, '#c8a0ff')));
    [`한 층은 ${D.ENDLESS.floorSec}초다.`, '층이 오를수록 몹이 세진다.', '3층마다 해골 장군이 나온다.', '층 사이에 상인이 온다.'].forEach((t, i) =>
      b.add(this.add.text(24, 200 + i * 17, '- ' + t, font9(10, '#e8e2f8'))));
    b.add(this.add.text(24, 276, '보상', font(12, '#c8a0ff')));
    [`층마다 금화와 강화석 ${D.ENDLESS.stonePerFloor}개`, `최고 기록을 넘은 층마다 보석 ${D.ENDLESS.gemPerNewFloor}`, '3층을 버티면 임무 클리어로 친다.'].forEach((t, i) =>
      b.add(this.add.text(24, 296 + i * 17, '- ' + t, font9(10, '#e8e2f8'))));
    const go = button(this, W / 2, 398, 190, 32, '탑 오르기', () => this.startBattle(c, 0, true), { size: 14, color: 0x2f6b3a });
    b.add(go);
    this.tweens.add({ targets: go, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  tv(id) { const t = D.TRAINING.find(x => x.id === id); return D.trainVal(t, this.sv.train[id] || 0); }

  startBattle(c, s, endless = false, hard = false, dungeon = null) {
    if (this.busy) return; this.busy = true;
    const sv = this.sv, rec = D.recOf(c, s, hard), pw = D.powerOf(sv);
    track('battle_start_click', { stage: endless ? 'tower' : dungeon ? 'dungeon' : `${hard ? 'H' : ''}${c + 1}-${s + 1}`, idx: c * D.STAGES_PER_CHAPTER + s, power: pw, rec, ratio: Math.round(pw / rec * 100) / 100, replay: c * D.STAGES_PER_CHAPTER + s < (hard ? sv.hardCleared : sv.cleared), tier: sv.tier, enh: sv.enh, hard, dungeon: dungeon || 'none' });
    sfx('bossIn');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle', { chapter: c, stage: s, endless, hard, dungeon }));
  }

  // 소탕: 깬 스테이지 보상을 바로 받는다(하루 5장)
  sweep(c, s) {
    const sv = this.sv, gold = D.goldOf(c, s, this.hard), stone = D.stoneOf(c, s, this.hard);
    if (sv.sweep <= 0) return;
    sv.sweep--; sv.gold += gold; sv.stone += stone; mission('clear'); save();
    track('sweep', { stage: `${this.hard ? 'H' : ''}${c + 1}-${s + 1}`, gold, stone, left: sv.sweep });
    sfx('coin');
    for (let i = 0; i < 10; i++) {
      const p = this.add.image(214 + R(-20, 20), 412 + R(-8, 8), 'silver').setTint(0xffd75e).setScale(2).setDepth(60);
      this.tweens.add({ targets: p, x: 18, y: 17, duration: 450, delay: i * 40, ease: 'Quad.In', onComplete: () => { p.destroy(); if (i === 9) { this.refreshTop(); this.bump(0); this.bump(1); this.bump(3); } } });
    }
    // 소탕도 절반 확률로 장비 하나(대부분 일반)
    const it = Math.random() < 0.5 ? makeItem(this.hard ? D.CHAPTERS.length - 1 : c, { rarity: Math.random() < 0.75 ? 0 : 1 }) : null;
    if (it) { addItems(sv, [it]); save(); }
    toast(this, `금화 +${fmt(gold)}  강화석 +${stone}${it ? `  ·  ${RARITY[it.r].name} ${it.n}` : ''}`, '#ffd75e');
    this.time.delayedCall(500, () => this.show('battle'));
  }

  // ── 대장간 탭 ──
  // 강화 단계마다 칼 모습이 달라진다: +5 푸른 빛, +10 불티, +15 보랏빛 룬이 칼 둘레를 돈다
  swordAura(enh) {
    const b = this.body, sw = this.sword, col = enh >= 15 ? 0xd06bff : enh >= 10 ? 0xff8a2a : 0x5fc8ff;
    if (enh < 5) return;
    sw.preFX?.addGlow(col, enh >= 15 ? 6 : enh >= 10 ? 5 : 3, 0, false, 0.1, 12);
    const ring = this.add.image(W / 2, 168, 'disc').setScale(1.1).setTint(col).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);
    b.addAt(ring, 0);
    this.tweens.add({ targets: ring, scale: 1.35, alpha: 0.12, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    if (enh >= 10) for (let i = 0; i < 7; i++) {
      const e = this.add.circle(W / 2 + R(-22, 22), 200, R(1, 2), i % 2 ? 0xffd75e : 0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      b.add(e);
      this.tweens.add({ targets: e, y: R(118, 140), x: e.x + R(-10, 10), alpha: { from: 0.9, to: 0 }, duration: R(900, 1400), delay: i * 180, repeat: -1 });
    }
    if (enh >= 15) {
      const rc = this.add.container(W / 2, 168);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        rc.add(this.add.rectangle(Math.cos(a) * 44, Math.sin(a) * 44, 5, 5, 0xe8a0ff).setAngle(45).setBlendMode(Phaser.BlendModes.ADD));
      }
      b.add(rc);
      this.tweens.add({ targets: rc, angle: 360, duration: 6000, repeat: -1 });
    }
  }

  forgeTab() {
    const sv = this.sv, b = this.body, bg = this.bg;
    if (this.textures.exists('forge_bg')) {
      const im = this.add.image(W / 2, 35, 'forge_bg').setOrigin(0.5, 0);
      im.setScale(Math.max(W / im.width, (H - 85) / im.height)).setAlpha(0.55);
      bg.add(im);
    }
    bg.add(this.add.rectangle(0, 35, W, H - 85, 0x0d0a14, 0.35).setOrigin(0));
    // 화덕 불빛이 일렁인다
    const glow = this.add.image(W / 2, 200, 'disc').setScale(3.4).setTint(0xff7a2a).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    bg.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.4, scale: 3.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const t = D.TIERS[sv.tier], enh = sv.enh, max = enh >= D.ENH_MAX;
    b.add(this.add.text(W / 2, 54, `+${enh} ${D.tierName(sv.tier, wtypeOf(sv))}`, font(16, enh >= 15 ? '#ff9a3a' : enh >= 10 ? '#ffd75e' : '#ffffff')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 74, `공격력 ${Math.round(D.weaponAtk(sv.tier, enh))}${max ? '' : `  →  ${Math.round(D.weaponAtk(sv.tier, enh + 1))} (+${Math.round((D.weaponAtk(sv.tier, enh + 1) / D.weaponAtk(sv.tier, enh) - 1) * 100)}%)`}`, font(10, '#e8e2f8')).setOrigin(0.5));
    // 다음 각성(+5 단위)까지 남은 단계: 거기서 공격력이 한 번 더 뛰고 칼 모습이 바뀐다
    if (!max) {
      const next = (Math.floor(enh / D.ENH_MILESTONE) + 1) * D.ENH_MILESTONE;
      // +15까지는 각성 때 무엇이 바뀌는지 이름을 보여 준다
      const an = D.AWAKENINGS.find(x => x[0] === next), nm = an ? ` [${an[1]}]` : '';
      this.awakeTxt = this.add.text(W / 2, 88, next === enh + 1 ? `다음 강화에 각성!${nm || ` ×${D.MILESTONE_MUL}`}` : `+${next} 각성${nm}까지 ${next - enh}단계`, font(8, next === enh + 1 ? '#ffd75e' : '#a8a0c0', 2)).setOrigin(0.5);
      b.add(this.awakeTxt);
    }
    // 모루 위의 칼
    const halo = this.halo = this.add.image(W / 2, 170, 'disc').setScale(1.6).setTint(enh >= 10 ? 0xffd75e : 0x9ad8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    // 강화할수록 칼이 커지고 빛깔이 물든다(+5 푸른, +10 주황, +15 보라). 그림은 든 무기 종류를 따른다
    const wid = wtypeOf(sv).id;
    this.sword = weaponIcon(this, W / 2, 168, wid, sv.tier, 72 * (1 + Math.min(enh, 20) * 0.012));
    const et = enh >= 15 ? 0xf0c0ff : enh >= 10 ? 0xffc088 : enh >= 5 ? 0xb8e4ff : 0;
    // 룬 등급 색(t.tint)은 검 시트 그림용: 다른 종류는 등급 색을 그림에 이미 칠해 뒀다
    if (t.tint && wid === 'sword') this.sword.setTint?.(t.tint); else if (et) this.sword.setTint?.(et);
    this.tweens.add({ targets: this.sword, y: 162, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.hammer = this.add.image(W / 2 + 54, 130, 'hammer').setScale(2.2).setOrigin(0.5, 0.9).setAngle(30);
    b.add([halo, this.sword, this.hammer]);
    // 이상한 돌멩이: 모루 위 칼을 스무 번 건드리면 떨어진다
    this.sword.setInteractive().on('pointerup', () => {
      if (this.busy || sv.eggs?.rock) return;
      sv.taps = (sv.taps || 0) + 1; sfx('hit', 40);
      // 다섯 번마다 뭔가 있다는 기척을 준다
      if (sv.taps % 5 === 0 && sv.taps < 20) { save(); toast(this, ['칼 밑에서 뭔가 덜그럭거린다…', '덜그럭… 덜그럭…', '거의 빠질 것 같다!'][sv.taps / 5 - 1], '#c8bfe0'); }
      this.tweens.add({ targets: this.sword, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, onComplete: () => this.sword.setAngle(0) });
      if (sv.taps >= 20 && grantEgg(sv, 'rock')) { save(); sfx('win'); toast(this, '칼 밑에서 「이상한 돌멩이」가 굴러 나왔다!', '#ff8ae0'); track('egg_found', { egg: 'rock' }); }
    });
    if (!max) b.bringToTop(this.awakeTxt);
    this.swordAura(enh);
    // 강화 단계 표시(20칸)
    b.add(this.add.rectangle(W / 2, 256, W - 32, 26, 0x07050c, 0.75).setStrokeStyle(1, COLOR.line));
    for (let i = 0; i < D.ENH_MAX; i++) {
      const x = 25 + (i % 10) * 22.5, y = 252 + Math.floor(i / 10) * 9;
      b.add(this.add.rectangle(x, y, 18, 5, i < enh ? (i >= 15 ? 0xff9a3a : i >= 10 ? 0xffd75e : 0x6fd3ff) : 0x2a2438).setOrigin(0, 0.5));
    }
    // 정보 패널
    // 높이는 체크 줄 수만큼(부적 줄이 패널 테두리에 걸쳐 겹쳐 보였다)
    const nChk = max ? 0 : (enh >= D.DESTROY_FROM ? 1 : 0) + (sv.charm > 0 && D.ENH_RATE[enh] < 100 ? 1 : 0);
    b.add(panel(this, 12, 272, W - 24, max ? 56 : 62 + nChk * 17, { fill: 0x15111f }));   // 빈 칸 없이 내용만큼
    if (max) {
      b.add(this.add.text(W / 2, 300, '최대 강화', font(14, '#ffd75e')).setOrigin(0.5));
    } else {
      const pity = D.pityRate(sv), rate = Math.min(100, D.ENH_RATE[enh] + (this.useCharm ? D.CHARM_RATE : 0) + this.apron() + pity), gold = D.enhGold(sv.tier, enh), stone = D.enhStone(sv.tier, enh);
      const danger = enh >= D.DESTROY_FROM;
      const row = (y, a, v, col) => { b.add(this.add.text(24, y, a, font9(10, '#a89cc8'))); b.add(this.add.text(W - 24, y, v, font(10, col)).setOrigin(1, 0)); };
      row(280, '성공 확률', rate + '%' + (this.useCharm ? ' (부적)' : '') + (pity ? ` (실패 보정 +${pity})` : ''), rate >= 70 ? '#5fdc6a' : rate >= 35 ? '#ffd75e' : '#ff7070');
      row(296, '실패하면', danger ? (this.useGuard ? '방지권이 지킴 · 금화 30% 환급' : `파괴 → +${D.shatterTo(enh)} · 금화 30% 환급`) : '그대로 유지', danger ? (this.useGuard ? '#9ae0ff' : '#ff5050') : '#e8e2f8');
      row(312, '비용', `금화 ${fmt(gold)} · 강화석 ${stone}`, sv.gold >= gold && sv.stone >= stone ? '#ffd75e' : '#ff7070');
      if (danger) {
        const chk = this.add.container(24, 340);
        chk.add(this.add.rectangle(0, 0, 12, 12, 0x000000).setStrokeStyle(1, 0x9ae0ff).setOrigin(0, 0.5));
        if (this.useGuard) chk.add(this.add.text(6, 0, '✓', font(10, '#9ae0ff')).setOrigin(0.5));
        chk.add(this.add.text(18, 0, `방지권 쓰기 · 실패 때만 씀 (${sv.guard}장)`, font9(10, sv.guard ? '#e8e2f8' : '#5a5070')).setOrigin(0, 0.5));
        chk.setSize(200, 18).setInteractive({ useHandCursor: true });
        chk.on('pointerup', () => { if (this.busy) return; if (!sv.guard) { sfx('deny'); track('guard_toggle_fail'); return; } sfx('click'); this.guardOff = !this.guardOff; track('guard_toggle', { on: !this.guardOff, guard: sv.guard }); this.show('forge'); });
        b.add(chk);
      }
      // 행운 부적: 가지고 있을 때만 보인다(기본으로 켜짐)
      if (sv.charm > 0 && D.ENH_RATE[enh] < 100) {
        const ck = this.add.container(24, danger ? 357 : 340);
        ck.add(this.add.rectangle(0, 0, 12, 12, 0x000000).setStrokeStyle(1, 0xffd75e).setOrigin(0, 0.5));
        if (this.useCharm) ck.add(this.add.text(6, 0, '✓', font(10, '#ffd75e')).setOrigin(0.5));
        ck.add(this.add.text(18, 0, `행운 부적 쓰기 +${D.CHARM_RATE}%p (${sv.charm}장)`, font9(10, '#e8e2f8')).setOrigin(0, 0.5));
        ck.setSize(200, 18).setInteractive({ useHandCursor: true });
        ck.on('pointerup', () => { if (this.busy) return; sfx('click'); this.charmOff = !this.charmOff; this.show('forge'); });
        b.add(ck);
      }
      const ok = sv.gold >= gold && sv.stone >= stone;
      const eb = button(this, sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1 ? 82 : W / 2, 404, sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1 ? 124 : 180, 30, ok ? '강화' : sv.gold < gold ? `금화 ${fmt(gold - sv.gold)} 부족` : `강화석 ${stone - sv.stone} 부족`, () => this.enhance(), { size: ok ? 15 : 11, color: danger ? 0x8a2f3a : 0x2f6b3a, onDeny: () => this.enhance() });
      eb.setEnabled(ok); b.add(eb);
      // 처음 하는 사람: 강화 버튼을 가리킨다
      this.forgeArrow = sv.cleared >= 1 && !sv.tut.forge && ok;
      if (this.forgeArrow) {
        const ar = this.add.text(eb.x, 376, '▼ 눌러서 강화', font(11, '#ffffff')).setOrigin(0.5); b.add(ar);
        this.tweens.add({ targets: ar, y: 382, duration: 350, yoyo: true, repeat: -1 });
      }
      // +10부터는 칼이 붉게 달아오른다
      if (danger) { this.halo.setTint(0xff3a2a).setAlpha(0.5); this.tweens.add({ targets: this.halo, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 }); }
    }
    // 승급: +10 이상이고 그 등급 챕터 보스를 깨면 다음 등급 무기로(지금보다 약해지지 않는 강화 수치부터)
    if (sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1) {
      const need = (sv.tier + 1) * D.STAGES_PER_CHAPTER, okBoss = sv.cleared >= need, cost = D.promoteGold(sv.tier);
      const pb = button(this, max ? W / 2 : 200, 404, max ? 180 : 110, 30, `승급 ${fmt(cost)}`, () => this.promote(), { size: 12, color: 0x2f6b3a });
      pb.setEnabled(okBoss && sv.gold >= cost); b.add(pb);
      if (this.forgeArrow) { /* 첫 강화 안내와 겹치지 않게 승급 안내는 숨긴다 */ }
      else if (!okBoss) b.add(this.add.text(W / 2, 375, `승급하려면 ${sv.tier + 1}장 보스를 쓰러뜨려야 한다`, font9(10, '#ff9a8a')).setOrigin(0.5, 0));
      else {
        // 승급하면 몇 강부터 시작하는지와 공격력을 지금과 견줘 보여 준다
        const e = D.promoteEnh(sv.tier, sv.enh), now = Math.round(D.weaponAtk(sv.tier, sv.enh)), next = Math.round(D.weaponAtk(sv.tier + 1, e));
        b.add(this.add.text(W / 2, 372, `${D.tierName(sv.tier + 1, wtypeOf(sv))}: 공격력 ${now} → ${next} (+${e}부터)`, font9(10, next >= now ? '#c8a0ff' : '#ff9a8a')).setOrigin(0.5, 0));
      }
    }
  }

  // 대장장이 앞치마를 끼면 강화 성공 +5%p
  apron() { return gearStats(this.sv).fx.has('apron') ? 5 : 0; }

  enhance() {
    const sv = this.sv, enh = sv.enh;
    // 망치질 중에 또 누르면 버리지 않고 끝난 뒤 이어서 한다(파괴 구간은 한 번씩만)
    if (this.busy) { if (enh < D.DESTROY_FROM) this.enhQ = true; return; }
    if (enh >= D.ENH_MAX) return;
    const gold = D.enhGold(sv.tier, enh), stone = D.enhStone(sv.tier, enh);
    if (sv.gold < gold || sv.stone < stone) {
      track('enhance_blocked', { from: enh, tier: sv.tier, gold_short: Math.max(0, gold - sv.gold), stone_short: Math.max(0, stone - sv.stone) });
      // 탭을 멋대로 바꾸면 연타가 '전투 시작'에 떨어졌다: 알림만 띄우고 아래 탭으로 가게 둔다
      sfx('deny'); toast(this, sv.sweep > 0 ? '전투 탭에서 소탕으로 벌자' : '전투 탭에서 금화·강화석을 벌자', '#ffd75e', 372);
      return;
    }
    this.busy = true;
    sv.gold -= gold; sv.stone -= stone;
    const danger = enh >= D.DESTROY_FROM, guard = danger && this.useGuard && sv.guard > 0;
    const charm = this.useCharm;
    if (charm) sv.charm--;
    const win = Math.random() * 100 < D.ENH_RATE[enh] + (charm ? D.CHARM_RATE : 0) + this.apron() + D.pityRate(sv);
    sv.pity = win || !D.pityOn(enh) ? 0 : (sv.pity || 0) + 1;
    let outcome = win ? 'success' : danger && !guard ? 'shatter' : 'fail';
    if (guard && !win) sv.guard--;   // 방지권은 칼을 지켜 냈을 때만 쓴다(성공해도 사라지면 아까워서 안 켰다)
    if (!win && danger) sv.gold += Math.round(gold * D.FAIL_REFUND);
    if (win) { sv.enh++; sv.stats.maxEnh = Math.max(sv.stats.maxEnh || 0, sv.enh); }
    else if (outcome === 'shatter') {
      sv.enh = D.shatterTo(enh); sv.stats.destroyed++;
      // 대장장이 앞치마: 칼을 세 번 부수면
      if (sv.stats.destroyed >= 3 && grantEgg(sv, 'apron')) this.time.delayedCall(1800, () => toast(this, '숨겨진 장비 「대장장이 앞치마」를 얻었다!', '#ff8ae0'));
    }
    track('enhance', { result: outcome, from: enh, tier: sv.tier, rate: D.ENH_RATE[enh] + (charm ? D.CHARM_RATE : 0), guard, charm, gold_cost: gold, gold_left: sv.gold, stone_left: sv.stone, queued: !!this.enhQ });
    mission('enh'); sv.tut.forge = true;
    save();
    this.refreshTop();
    // 망치질 세 번(확률이 낮을수록 한 번 더 뜸을 들인다). 연달아 세 번 넘게 두드리면 두 번으로 줄인다(천장 구간은 스무 번 가까이 두드려 지쳤다)
    this.enhN = (this.enhN || 0) + 1;
    const quick = this.quick = this.enhN > 3;
    const hits = quick || D.ENH_RATE[enh] >= 100 ? 2 : D.ENH_RATE[enh] < 40 ? 4 : 3;
    const h = this.hammer, sw = this.sword;
    this.tweens.killTweensOf(sw); sw.y = 168;
    const strike = i => {
      this.tweens.add({
        targets: h, angle: -50, x: W / 2 + 26, y: 150, duration: 110, ease: 'Quad.In', onComplete: () => {
          sfx('anvil');
          this.cameras.main.shake(70, quick ? 0.003 : 0.006);
          this.sparks(W / 2 + 6, 176, 10 + i * 4, 0xffc46a);
          sw.setTintFill?.(0xffffff); this.time.delayedCall(50, () => sw.clearTint?.());
          // 파괴 구간 마지막 한 방 전: 붉게 달아오르고 숨을 고른다
          const last = i === hits - 2, tense = danger && last;
          if (tense) { sfx('warn'); this.time.delayedCall(60, () => sw.setTint?.(0xff5a3a)); this.tweens.add({ targets: sw, scale: sw.scale * 1.12, duration: 500, ease: 'Quad.Out' }); }
          this.tweens.add({ targets: h, angle: 30, x: W / 2 + 54, y: 130, duration: 220, ease: 'Quad.Out', onComplete: () => i + 1 < hits ? this.time.delayedCall(tense ? (quick ? 380 : 750) : last ? 320 : 60, () => strike(i + 1)) : (this.reveal(outcome, enh, guard)) });
        },
      });
    };
    strike(0);
  }

  reveal(outcome, from, guarded) {
    const sw = this.sword;
    if (outcome === 'success') {
      sfx('success');
      const p = this.add.sprite(W / 2, 214, 'fx2_r2s').setOrigin(0.5, 1).setScale(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).play('fxPillar');
      p.once('animationcomplete', () => p.destroy());
      this.sparks(W / 2, 168, 40, 0xffe08a);
      this.tweens.add({ targets: sw, scale: sw.scale * 1.25, duration: 160, yoyo: true });
      const awake = (from + 1) % D.ENH_MILESTONE === 0;
      const an = D.AWAKENINGS.find(x => x[0] === from + 1);
      this.flashText(awake ? `칼이 각성했다!  +${from + 1}${an ? ` ${an[1]}` : ''}` : `강화 성공!  +${from + 1}`, '#ffd75e');
      // +8부터와 각성(+5 단위)은 화면을 번쩍이고 오른 공격력을 크게 띄운다
      if (from + 1 >= 8 || awake) {
        const tier = this.sv.tier, a0 = Math.round(D.weaponAtk(tier, from)), a1 = Math.round(D.weaponAtk(tier, from + 1));
        this.cameras.main.flash(220, 255, 220, 120);
        this.sparks(W / 2, 168, 30, 0xffffff);
        const t = this.add.text(W / 2, 222, `공격력 ${a0} → ${a1}`, font(18, '#ffe08a', 4)).setOrigin(0.5).setDepth(60).setScale(0.3);
        this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.Out' });
        this.tweens.add({ targets: t, y: 210, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
      }
    } else if (outcome === 'fail') {
      sfx('fail');
      sw.setTint?.(0x6a6a7a); this.time.delayedCall(400, () => sw.clearTint?.());
      this.tweens.add({ targets: sw, x: W / 2 + 4, duration: 45, yoyo: true, repeat: 4 });
      this.flashText(from >= D.DESTROY_FROM ? '실패… 방지권이 지켰다\n금화 30% 환급' : '강화 실패', '#a8a0c0');
    } else {
      sfx('shatter');
      this.cameras.main.shake(350, 0.02);
      this.cameras.main.flash(250, 255, 60, 60);
      // 칼이 조각나 흩어진다
      for (let i = 0; i < 14; i++) {
        const sh = this.add.rectangle(W / 2 + R(-20, 20), 168 + R(-24, 24), R(3, 7), R(3, 9), Phaser.Utils.Array.GetRandom([0xd8e0f0, 0x9aa4b8, 0x6a7080])).setDepth(40);
        this.tweens.add({ targets: sh, x: sh.x + R(-110, 110), y: sh.y + R(-60, 120), angle: R(-360, 360), alpha: 0, duration: R(600, 1000), ease: 'Quad.Out', onComplete: () => sh.destroy() });
      }
      sw.setVisible(false);
      this.flashText(`파괴!  +${from} → +${D.shatterTo(from)}`, '#ff5050');
    }
    // 낮은 단계 성공은 짧게 끊어 연타가 답답하지 않게
    const wait = outcome === 'shatter' ? 1500 : this.quick ? 380 : outcome === 'success' && from + 1 < 8 ? 450 : 900;
    this.time.delayedCall(wait, () => {
      this.busy = false; this.show('forge');
      if (outcome === 'shatter' && !guarded) this.shatterWin(from);
      const q = this.enhQ; this.enhQ = false;
      if (q && outcome !== 'shatter' && this.sv.enh < D.DESTROY_FROM) this.enhance();
    });
  }

  // 부서진 직후: 방지권이 있었다면 지켰다는 걸 보여 주고 바로 살 수 있게
  shatterWin(from) {
    const sv = this.sv, c = this.modal(), cost = D.GEM_SHOP.find(x => x.id === 'guard').cost, back = D.restoreGem(from);
    track('shatter_offer_show', { from, gem: sv.gem, restore_cost: back });
    c.add(panel(this, 24, 140, W - 48, 210, { fill: 0x1a0e12, line: 0xff5050 }));
    c.add(this.add.text(W / 2, 164, `칼이 부서졌다  +${from} → +${D.shatterTo(from)}`, font(14, '#ff5050')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 188, sv.guard > 0 ? '다음엔 방지권을 켜면 단계를 지킨다' : '방지권이 있으면 단계를 지킬 수 있다', font9(11, '#e8e2f8')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 206, `다음 +10 강화부터는 꼭 쓰자 (보유 ${sv.guard}장)`, font9(10, '#a89cc8')).setOrigin(0.5));
    // 부서진 바로 그 자리에서만 되살릴 수 있다(창을 닫으면 끝)
    const rb = button(this, W / 2, 240, 190, 30, `+${from}으로 되살리기  보석 ${back}`, () => {
      track('shatter_restore_click', { from, enough: sv.gem >= back });
      if (sv.gem < back) { c.close(); this.shopPage = 'pack'; this.show('shop'); toast(this, '보석이 모자라다', '#ff9a8a'); return; }
      sv.gem -= back; sv.enh = from; sv.stats.destroyed--; save(); sfx('win'); c.close(); this.refreshTop(); this.show('forge'); toast(this, `+${from} 칼이 돌아왔다!`, '#ffd75e');
    }, { size: 11, color: 0x2f6b3a });
    c.add([rb, gemIcon(this, W / 2 - 80, 240, 12)]);
    const bt = button(this, W / 2, 280, 190, 28, `방지권 사기  보석 ${cost}`, () => {
      track('shatter_guard_click', { enough: sv.gem >= cost });
      if (sv.gem < cost) { c.close(); this.shopPage = 'pack'; this.show('shop'); toast(this, '보석이 모자라다', '#ff9a8a'); return; }
      sv.gem -= cost; sv.guard++; save(); sfx('buy'); c.close(); toast(this, '파괴 방지권 +1', '#9ae0ff');
    }, { size: 11, color: 0x3a3846 });
    c.add([bt, gemIcon(this, W / 2 - 80, 280, 12)]);
    c.add(button(this, W / 2, 322, 110, 24, '그냥 닫기', () => { track('shatter_offer_close', { from }); c.close(); }, { size: 10, color: 0x3a3846 }));
  }

  promote() {
    const sv = this.sv, cost = D.promoteGold(sv.tier);
    if (this.busy || sv.gold < cost || sv.cleared < (sv.tier + 1) * D.STAGES_PER_CHAPTER) return;
    this.busy = true;
    sv.gold -= cost; sv.enh = D.promoteEnh(sv.tier, sv.enh); sv.tier++; save(); this.refreshTop();
    track('promote', { tier: sv.tier, cost, cleared: sv.cleared });
    sfx('win');
    this.cameras.main.flash(400, 200, 160, 255);
    const p = this.add.sprite(W / 2, 214, 'fx2_r2s').setOrigin(0.5, 1).setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8a0ff).play('fxPillar');
    p.once('animationcomplete', () => p.destroy());
    this.sparks(W / 2, 168, 60, 0xc8a0ff);
    this.flashText(`승급!  ${D.tierName(sv.tier, wtypeOf(sv))}`, '#c8a0ff');
    this.time.delayedCall(1400, () => { this.busy = false; this.show('forge'); });
  }

  sparks(x, y, n, tint) {
    for (let i = 0; i < n; i++) {
      const a = RF(-Math.PI, 0), v = R(30, 110);
      const s = this.add.image(x, y, 'spark').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(40).setScale(R(1, 2));
      this.tweens.add({ targets: s, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v + 40, alpha: 0, duration: R(300, 650), ease: 'Quad.Out', onComplete: () => s.destroy() });
    }
  }

  flashText(msg, color) {
    const t = this.add.text(W / 2, 120, msg, { ...font(16, color), align: 'center' }).setOrigin(0.5).setDepth(60).setScale(0.4);
    // 긴 문구가 화면 밖으로 넘치지 않게 폭에 맞춰 줄인다
    const fit = Math.min(1, (W - 16) / t.width);
    this.tweens.add({ targets: t, scale: fit, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: 100, delay: 900, duration: 300, onComplete: () => t.destroy() });
  }

  // ── 훈련 탭 ──
  trainTab() {
    const sv = this.sv, b = this.body;
    b.add(this.add.text(W / 2, 52, '훈련장', font(15)).setOrigin(0.5));
    b.add(this.add.text(W / 2, 70, `금화로 영원히 강해진다. ${D.TRAIN_MILE}레벨마다 한 단계 덤`, font9(10, '#a89cc8')).setOrigin(0.5));
    // 한 줄에 이름·레벨 / 설명·지금 효과 두 덩어리만(Lv·효과·★·설명이 한 줄에 다 있어 빽빽했다)
    D.TRAINING.forEach((t, i) => {
      const lv = sv.train[t.id] || 0, max = lv >= t.max, cost = D.trainCost(t, lv);
      const y = 84 + i * 40;
      b.add(panel(this, 12, y, W - 24, 36, { fill: 0x1a1528 }));
      const nm = this.add.text(22, y + 5, t.name, font(11)); b.add(nm);
      const mile = t.max >= D.TRAIN_MILE && !max && lv % D.TRAIN_MILE === D.TRAIN_MILE - 1;
      b.add(this.add.text(28 + nm.width, y + 6, max ? `Lv ${lv} 최대` : `Lv ${lv}${mile ? ' (다음에 덤)' : ''}`, font9(10, mile ? '#ffd75e' : '#a89cc8')));
      const tvv = D.trainVal(t, lv), val = !lv ? '' : t.unit === '%' ? ` +${Math.round(tvv * 100)}%` : t.unit === '회' ? '' : ` +${tvv.toFixed(1)}`;
      b.add(this.add.text(22, y + 20, t.desc + val, font9(10, '#c8bfe0')));
      const btn = button(this, W - 52, y + 18, 70, 26, max ? '최대' : fmt(cost), () => {
        if (sv.gold < cost || max) return;
        sv.gold -= cost; sv.train[t.id] = lv + 1; save();
        track('train', { stat: t.id, lv: lv + 1, cost, power: D.powerOf(sv) });
        sfx('buy'); this.refreshTop(); this.bump(0);
        this.show('train');
      }, { size: 10, color: 0x3a3846 });
      btn.setEnabled(!max && sv.gold >= cost);
      b.add(btn);
    });
  }

  update() {
    if (this.topTxt) this.topTxt.forEach(t => { const v = t.get(); if (t.text !== String(v)) t.setText(v); });
    // 남은 시간 글자(특가·성장 꾸러미). 날이 바뀌거나 꾸러미가 끝나면 칸을 다시 그린다
    for (const k of this.ticks || []) {
      if (k.redraw?.()) { if (!this.busy) this.show(this.tab); return; }
      const v = k.f?.(); if (k.t && k.t.text !== v) k.t.setText(v);
    }
  }

  // ── 꾸미기: 칼빛·영웅 스킨·캐시 무기를 보석으로 사고 골라 낀다 ──
  skinPage() {
    const sv = this.sv, b = this.body, page = this.skinTab ||= 'blade';
    [['blade', '칼빛'], ['hero', '영웅'], ['weapon', '무기']].forEach(([id, name], i) => {
      const x = 50 + i * 85, on = page === id;
      b.add(this.add.text(x, 84, name, font(11, on ? '#ffffff' : '#8a80a0')).setOrigin(0.5));
      if (on) b.add(this.add.rectangle(x, 95, 50, 2, 0xffffff));
      const hit = this.add.rectangle(x, 86, 80, 22, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { if (this.busy) return; this.skinTab = id; sfx('click'); this.show('shop'); });
      b.add(hit);
    });
    // 한 칸: 미리보기 · 이름 · 효과 · 버튼
    const cell = (i, it, own, on, preview, onBuy) => {
      const x = 16 + (i % 2) * 122, y = 102 + Math.floor(i / 2) * 74, c = this.add.container(x, y); b.add(c);
      c.add(panel(this, 0, 0, 116, 68, { fill: on ? 0x2e2448 : COLOR.panel, line: on ? 0xffd75e : COLOR.line }));
      c.add(preview(20, 26));
      c.add(this.add.text(40, 6, it.name, font(10)));
      c.add(this.add.text(40, 21, it.desc, { ...font9(10, '#c8bfe0'), wordWrap: { width: 72 } }));
      const label = on ? '끼는 중' : own ? '끼기' : `   ${it.cost}`;
      const bt = button(this, x + 58, y + 56, 104, 18, label, () => {
        if (this.busy || on) return;
        if (!own) {
          if (sv.gem < it.cost) { sfx('deny'); track('cosm_buy_fail', { item: it.id, kind: page, gem: sv.gem }); this.gemShort(it.cost); return; }
          sv.gem -= it.cost; track('cosm_buy', { item: it.id, kind: page, cost: it.cost }); sfx('buy'); toast(this, `${it.name} 얻음!`, '#ffd75e');
        } else sfx('click');
        onBuy(); save(); this.refreshTop(); this.show('shop');
      }, { size: 10, color: on ? 0x3b2f5c : own ? 0x2f6b3a : 0x8a2f6a });
      b.add(bt);
      if (!own) b.add(gemIcon(this, x + 40, y + 56, 9));
    };
    const slash = sk => (x, y) => { const fx = this.add.sprite(x, y, 'fx1_r0s', 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5); return sk ? skinFx(fx, sk) : fx; };
    if (page === 'blade') {
      b.add(this.add.text(W / 2, 410, '휘두르는 궤적 색만 바뀐다 · 능력치는 그대로', font9(10, '#a89cc8')).setOrigin(0.5));
      D.SKINS.forEach((sk, i) => {
        const own = !sk.id || sv.skins?.[sk.id], on = (sv.skin || '') === sk.id;
        cell(i, sk, own, on, slash(sk.id && sk), () => { (sv.skins ||= {})[sk.id] = true; sv.skin = sk.id; track('skin_equip', { skin: sk.id || 'none' }); });
      });
    } else if (page === 'hero') {
      b.add(this.add.text(W / 2, 410, '몸 색이 바뀌고 작은 능력치가 붙는다', font9(10, '#a89cc8')).setOrigin(0.5));
      HERO_SKINS.forEach((hs, i) => {
        const own = !hs.id || sv.hskins?.[hs.id], on = (sv.hskin || '') === hs.id;
        cell(i, hs, own, on, (x, y) => { const h = this.add.sprite(x, y, 'hero2_r0s').play('idle').setScale(0.8); return hs.id ? skinFx(h, hs) : h; },
          () => { (sv.hskins ||= {})[hs.id] = true; sv.hskin = hs.id; track('hskin_equip', { skin: hs.id || 'none' }); });
      });
    } else {
      b.add(this.add.text(W / 2, 410, `그 무기를 들면 피해 +${CASH_W_DMG * 100}% · 고유 궤적 색`, font9(10, '#a89cc8')).setOrigin(0.5));
      WTYPES.forEach((w, i) => {
        const cw = CASH_W[w.id], own = !!sv.cw?.[w.id], on = own && sv.wtype === w.id;
        const it = { id: w.id, name: cw.name, desc: `${w.name} 피해 +${CASH_W_DMG * 100}%`, cost: CASH_W_GEM };
        // 산 무기를 누르면 그 무기 종류로 바꿔 든다(해금 안 된 종류도 들 수 있다. 보스 무기 해금 보상은 따로 남는다)
        cell(i, it, own, on, slash(cw), () => { (sv.cw ||= {})[w.id] = true; sv.wtype = w.id; track('cashw_equip', { w: w.id, unlocked: hasW(sv, w.id) }); });
      });
    }
  }

  // ── 비급: 스킬을 사서 판 시작부터 들고 간다. 보석으로 비급 Lv을 올리면 시작 Lv도 오른다. 짝 스킬끼리는 시너지 ──
  bookPage() {
    const sv = this.sv, b = this.body;
    b.add(this.add.text(16, 76, `낀 비급 스킬을 판 시작부터 Lv${D.bookSkillLv(1)}~${D.bookSkillLv(D.BOOK_MAX)}로 들고 간다`, font9(10, '#a89cc8')));
    D.BOOKS.forEach((k, i) => {
      const def = D.SKILLS[k], lv = D.bookLv(sv, k), own = lv > 0, on = own && sv.book === k, max = lv >= D.BOOK_MAX;
      const x = 16 + (i % 2) * 122, y = 92 + Math.floor(i / 2) * 60, c = this.add.container(x, y); b.add(c);
      c.add(panel(this, 0, 0, 116, 56, { fill: on ? 0x2e2448 : COLOR.panel, line: on ? 0xffd75e : COLOR.line }));
      c.add(skillIcon(this, 18, 18, def, 22));
      c.add(this.add.text(34, 5, def.name, font(10)));
      // 산 비급은 판 시작 Lv, 안 산 건 설명 한 줄
      c.add(own ? this.add.text(34, 21, `시작 Lv${D.bookSkillLv(lv)} (${lv}/${D.BOOK_MAX})`, font9(9, max ? '#ffd75e' : '#9ae0ff'))
        : this.add.text(34, 21, BOOK_SHORT[k] || def.desc[0], font9(9, '#c8bfe0')));
      const buyLv = async cost => {
        if (sv.gem < cost) { sfx('deny'); track('book_buy_fail', { skill: k, lv: lv + 1, gem: sv.gem }); this.gemShort(cost); return false; }
        sv.gem -= cost; (sv.books ||= {})[k] = lv + 1; track(own ? 'book_up' : 'book_buy', { skill: k, lv: lv + 1, cost }); sfx('buy');
        toast(this, own ? `${def.name} 비급 Lv${lv + 1} · 시작 Lv${D.bookSkillLv(lv + 1)}` : `${def.name} 비급 얻음!`, '#ffd75e');
        return true;
      };
      if (!own) {
        b.add(button(this, x + 58, y + 44, 104, 16, `   ${D.BOOK_COST[0]}`, async () => {
          if (this.busy || !(await buyLv(D.BOOK_COST[0]))) return;
          sv.book = k; save(); this.refreshTop(); this.show('shop');
        }, { size: 9, color: 0x8a2f6a }));
        b.add(gemIcon(this, x + 40, y + 44, 8));
        return;
      }
      // 산 비급: 왼쪽 끼기, 오른쪽 비급 Lv 올리기
      b.add(button(this, x + 28, y + 44, 48, 16, on ? '끼는 중' : '끼기', () => {
        if (this.busy || on) return;
        sfx('click'); sv.book = k; save(); this.show('shop');
      }, { size: 9, color: on ? 0x3b2f5c : 0x2f6b3a }));
      const cost = D.BOOK_COST[lv];
      const up = button(this, x + 85, y + 44, 54, 16, max ? '최대' : `  ${cost}`, async () => {
        if (this.busy || max || !(await buyLv(cost))) return;
        save(); this.refreshTop(); this.show('shop');
      }, { size: 9, color: 0x8a2f6a });
      up.setEnabled(!max); b.add(up);
      if (!max) b.add(gemIcon(this, x + 70, y + 44, 8));
    });
    b.add(this.add.text(16, 338, '시너지 · 둘 다 가지면 두 스킬이 더 자주 나간다', font(10, '#ffb050')));
    D.SYNERGY.forEach((x, i) => b.add(this.add.text(16 + (i % 2) * 122, 356 + Math.floor(i / 2) * 15, `${x.name}: ${D.SKILLS[x.a].name}+${D.SKILLS[x.b].name}`, font9(9, '#c8bfe0'))));
  }

  // ── 특가: 오늘의 특가(하루 한 번 무작위 할인) · 성장 꾸러미(장 보스 첫 처치 뒤 24시간) · 큰 꾸러미(달마다 한 번) ──
  dealPage() {
    const sv = this.sv, b = this.body, deal = todayDeal(sv), grow = growOffer(sv);
    const after = it => { this.refreshTop(); this.bump(4); toast(this, `${it.name} 구매 완료!`, '#ffd75e'); this.show('shop'); };
    const buyBtn = (x, y, it, sold) => {
      const bt = button(this, x, y, 64, 26, sold ? '구매함' : won(it.price), async () => {
        if (this.busy || sold) return;
        this.busy = true;
        const ok = await buy(this, sv, it);
        this.busy = false;
        if (ok && this.scene.isActive()) after(it);
      }, { size: 10, color: 0x2f6b3a });
      bt.setEnabled(!sold); b.add(bt);
    };
    // 줄바꿈이 '금화 / 1,580'처럼 항목 안에서 끊기지 않게 항목 안 띄어쓰기는 붙인다
    const nb = t => t.split(' · ').map(x => x.replace(/ /g, '\u00a0')).join(' · ');
    const timer = (y, f) => { const t = this.add.text(W - 16, y, f(), font9(10, '#ff9a8a')).setOrigin(1, 0); b.add(t); this.ticks.push({ t, f }); };
    // 오늘의 특가
    track('view_item_list', { item_list_id: 'deal', items: [deal.id, grow?.id].filter(Boolean).join(','), gem: sv.gem });
    b.add(this.add.text(16, 74, '오늘의 특가', font(12, '#ffd75e')));
    timer(77, () => `남은 ${leftText(msToMidnight())}`);
    const day = sv.deal.day; this.ticks.push({ redraw: () => dayKey() !== day });
    b.add(panel(this, 12, 92, W - 24, 78, { fill: 0x2a1a30, line: deal.got ? COLOR.line : 0xffd75e }));
    b.add(this.add.rectangle(42, 131, 48, 48, 0x8a2f3a).setStrokeStyle(1, 0xff9a8a));
    b.add(this.add.text(42, 124, `-${deal.off}%`, font(13, '#ffffff')).setOrigin(0.5));
    b.add(this.add.text(42, 140, '할인', font9(10, '#ffd0d0')).setOrigin(0.5));
    b.add(this.add.text(76, 98, deal.name, font(12, '#ffffff')));
    b.add(this.add.text(76, 116, nb(giveText(deal.give, sv)), { ...font9(10, '#e8e2f8'), wordWrap: { width: W - 100 } }));
    const was = this.add.text(76, 150, won(deal.base), font9(10, '#8a80a0')); b.add(was);
    b.add(this.add.rectangle(76, 157, was.width, 1, 0xa89cc8).setOrigin(0, 0.5));
    b.add(this.add.text(82 + was.width, 150, '하루 1번', font9(10, '#ff9ad0')));
    buyBtn(W - 52, 154, deal, deal.got);
    // 성장 꾸러미
    b.add(this.add.text(16, 180, '성장 꾸러미', font(12, '#9ae0ff')));
    if (grow) {
      timer(183, () => `남은 ${leftText(growLeft(sv))}`);
      this.ticks.push({ redraw: () => growLeft(sv) <= 0 });
      b.add(panel(this, 12, 198, W - 24, 52, { line: 0x9ae0ff }));
      b.add(icon(this, 30, 224, 13, 20));
      b.add(this.add.text(46, 203, grow.name, font(11, '#9ae0ff')));
      b.add(this.add.text(46, 219, nb(giveText(grow.give, sv)), { ...font9(9, '#e8e2f8'), wordWrap: { width: W - 136 } }));
      buyBtn(W - 52, 224, grow, false);
    } else {
      b.add(panel(this, 12, 198, W - 24, 52, { fill: 0x100d16 }));
      b.add(this.add.text(W / 2, 224, '장 보스를 처음 잡으면 24시간 동안\n그 장에 맞는 강화석·방지권 꾸러미가 열린다', { ...font9(10, '#8a80a0'), align: 'center' }).setOrigin(0.5));
    }
    // 큰 꾸러미(달마다 한 번): 3장에 들어선 뒤에만 보인다(2-2·플레이 20분에 33,000원이 보이면 이르다, 37차)
    if (sv.cleared < 2 * D.STAGES_PER_CHAPTER) return;
    b.add(this.add.text(16, 262, '큰 꾸러미', font(12, '#ffb050')));
    b.add(this.add.text(W - 16, 265, '보석 첫 구매 2배와 따로', font9(9, '#8a80a0')).setOrigin(1, 0));
    D.BIG_PACKS.forEach((it, i) => {
      const y = 280 + i * 70, sold = soldOut(sv, it);
      b.add(panel(this, 12, y, W - 24, 66, { line: sold ? COLOR.line : 0xffb050 }));
      b.add(gemIcon(this, 30, y + 33, 18));
      b.add(this.add.text(46, y + 4, it.name, font(11, '#ffb050')));
      const dt = this.add.text(46, y + 19, nb(it.desc), { ...font9(9, '#e8e2f8'), wordWrap: { width: W - 136 } }); b.add(dt);
      b.add(this.add.text(46, y + 21 + dt.height, sold ? '이번 달은 샀다' : it.tag, font9(9, '#ff9ad0')));
      buyBtn(W - 52, y + 33, it, sold);
    });
  }

  // ── 상점 탭: 보석으로 사기·광고 보상 / 패키지(결제) ──
  shopTab() {
    const sv = this.sv, b = this.body, page = this.shopPage || 'deal';   // 맨 앞 칸은 특가
    const sub = (x, id, name) => {
      const bt = button(this, x, 54, 50, 24, name, () => { this.shopPage = id; track('shop_page', { page: id, gem: sv.gem }); this.show('shop'); }, { size: 11, color: page === id ? 0x7a5a1a : id === 'deal' ? 0x5a2a3a : 0x2a2440 });
      b.add(bt);
      // 특가 칸: 오늘 특가를 안 샀거나 성장 꾸러미가 열려 있으면 빨간 점
      if (id === 'deal' && (growOffer(sv) || !todayDeal(sv).got)) b.add(this.add.circle(x + 21, 45, 3.5, 0xff3a3a));
    };
    [['deal', '특가'], ['gem', '보석'], ['skin', '꾸미기'], ['book', '비급'], ['pack', '패키지']].forEach(([id, name], i) => sub(32 + i * 51.5, id, name));
    if (page === 'deal') return this.dealPage();
    if (page === 'skin') return this.skinPage();
    if (page === 'book') return this.bookPage();
    const after = msg => { this.refreshTop(); this.bump(4); toast(this, msg, '#ffd75e'); this.show('shop'); };
    if (page === 'gem') {
      b.add(this.add.text(16, 76, '보석으로 사기', font(11, '#ff9ad0')));
      // 파괴 구간(+10)에 닿기 전엔 방지권을 맨 뒤로 민다
      const far = sv.tier === 0 && sv.enh < D.DESTROY_FROM - 2;
      D.GEM_SHOP.slice().sort((a, c) => far ? (a.id === 'guard') - (c.id === 'guard') : 0).forEach((it, i) => {
        const x = 16 + (i % 2) * 122, y = 92 + Math.floor(i / 2) * 56;
        const c = this.add.container(x, y); b.add(c);
        c.add(panel(this, 0, 0, 116, 52));
        c.add(icon(this, 18, 22, it.icon, 22));
        c.add(this.add.text(34, 5, it.name, font(10)));
        c.add(this.add.text(34, 20, it.desc || giveText(it.give, this.sv), font9(10, '#a89cc8')));   // 이름을 되풀이하지 않고 쓰임새를 적는다
        const ok = sv.gem >= it.cost;
        c.add(gemIcon(this, 40, 41, 10));
        c.add(this.add.text(50, 34, String(it.cost), font(10, ok ? '#ff9ad0' : '#7a5a6a')));
        const z = this.add.zone(x, y, 116, 52).setOrigin(0).setInteractive({ useHandCursor: true }); b.add(z);
        z.on('pointerup', () => {
          if (this.busy) return;
          if (sv.gem < it.cost) { sfx('deny'); track('gem_shop_fail', { item: it.id, gem: sv.gem }); this.gemShort(it.cost); return; }
          sv.gem -= it.cost; grant(sv, it.give); sfx('buy'); track('gem_shop_buy', { item: it.id, cost: it.cost, gem_left: sv.gem });
          after(`${it.name} 구매!`);
        });
      });
      b.add(this.add.text(16, 262, '무료 보상 (광고)', font(11, '#9ae0ff')));
      Object.entries(D.ADS).filter(([k]) => k !== 'double').forEach(([k, ad], i) => {
        const y = 296 + i * 40, left = adsLeft(sv, k);
        b.add(panel(this, 16, y - 18, W - 32, 36));
        b.add(this.add.text(28, y - 14, ad.name, font(11)));
        b.add(this.add.text(28, y + 1, left ? `오늘 ${left}번 더 받을 수 있다` : '오늘은 다 받았다', font9(10, left ? '#c8bfe0' : '#8a80a0')));
        const bt = button(this, W - 52, y, 64, 24, !left ? '내일' : sv.noAds ? '받기' : '보기 ▶', async () => {
          if (this.busy || adsLeft(sv, k) <= 0) return;
          this.busy = true;
          const ok = await showAd(this, sv, k);
          this.busy = false;
          if (!ok || !this.scene.isActive()) return;
          sv.ads[k] = (sv.ads[k] || 0) + 1; grant(sv, ad.give);
          track('ad_reward', { kind: k, n: sv.ads[k] });
          after(`${ad.name} 받았다`);
        }, { size: 10, color: 0x2f6b3a });
        bt.setEnabled(left > 0); b.add(bt);
      });
      const info = [`매일 접속하면 보석 +${D.GEM_FREE.daily}`, `스테이지 첫 클리어 보석 +${D.GEM_FREE.stageFirst} · 보스 +${D.GEM_FREE.bossFirst}`];
      if (sv.passLeft > 0) info.push(`월정액: 남은 ${sv.passLeft}일 · 매일 보석 ${D.PASS_DAILY.gem}`);
      info.forEach((t, i) => b.add(this.add.text(W / 2, 366 + i * 15, t, font9(10, i === 2 ? '#ffd75e' : '#a89cc8')).setOrigin(0.5)));
      return;
    }
    // 패키지
    track('view_item_list', { item_list_id: 'pack', items: D.IAP.filter(it => !soldOut(sv, it)).map(it => it.id).join(','), gem: sv.gem });
    D.IAP.forEach((it, i) => {
      const y = 76 + i * 50, sold = soldOut(sv, it);
      const hot = it.id === 'starter' || it.id === 'pass' || it.id === 'cosm';
      b.add(panel(this, 12, y, W - 24, 46, { line: hot && !sold ? 0xffd75e : COLOR.line }));
      b.add(gemIcon(this, 30, y + 23, 18));
      b.add(this.add.text(46, y + 5, it.name, font(11, hot ? '#ffd75e' : '#ffffff')));
      b.add(this.add.text(46, y + 20, it.desc || giveText(it.give) + (it.passDays ? ` (+매일 ${D.PASS_DAILY.gem})` : '') + (it.noAds ? ' · 광고 없음' : ''), font9(it.desc ? 8 : 9, '#e8e2f8')));
      const tag = it.id === 'pass' && sv.passLeft > 0 ? `남은 ${sv.passLeft}일 · 사면 연장` : [it.tag, firstX2(sv, it) && '첫 구매 보석 2배'].filter(Boolean).join(' · ');
      if (tag) b.add(this.add.text(46, y + 32, tag, font9(9, firstX2(sv, it) ? '#ffd75e' : '#ff9ad0')));
      const bt = button(this, W - 46, y + 23, 60, 26, sold ? '구매함' : won(it.price), async () => {
        if (this.busy || sold) return;
        this.busy = true;
        const ok = await buy(this, sv, it);
        this.busy = false;
        if (ok && this.scene.isActive()) after(`${it.name} 구매 완료!`);
      }, { size: 9, color: 0x2f6b3a });
      bt.setEnabled(!sold); b.add(bt);
    });
  }
}

const RF = Phaser.Math.FloatBetween;
Object.assign(Lobby.prototype, GearTab, ContentTab);
