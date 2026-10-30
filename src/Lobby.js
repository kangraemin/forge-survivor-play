import { cosmeticPage } from './cosmeticShop.js';
import { openSettings } from './settingsPanel.js';
import { tutorialDue, runTutorial, modeDue, runModeCoach, tabCoach } from './tutorial.js';
import { nextGoal, salesOpen } from './nextGoal.js';
import { cashHidden, shareHidden, adWord, trialInfo, openFull } from './platform/flags.js';   // 포털판(CrazyGames·itch): 현금 상품·공유 숨김
import { shareBrag, braggable, bragGem, lobbyShareTick, openShare, myCode } from './share.js';
import { cosmetic, todaySale, available, winterItems, SALE_OFF } from './cosmetics.js';
// 로비: 전투(스테이지 선택·소탕), 대장간(강화·승급), 훈련(영구 능력치)
import * as D from './data.js';
import { load, save, mission } from './save.js';
import { sfx, setSound, setMusic, setMusicLevel, setVib, unlock, playBgm, preloadBattleBgm } from './sfx.js';
import { font, font9, panel, button, icon, fmt, COLOR, toast, gemIcon, markIcon, fixedContainer, skinFx, hiCam, skillIcon, weaponIcon, setBackdrop } from './ui.js';
import { iapTag, showAd, buy, grant, giveText, adsLeft, adsDaily, priceLabel, firstX2, todayDeal, growOffer, growLeft, soldOut, leftText, msToMidnight, kstDay } from './shop.js';
import { track, logUser } from './log.js';
import { GearTab } from './gearTab.js';
import { inTossShell } from './safeArea.js';
import { ContentTab } from './contentTab.js';
import { modeSeen } from './modeData.js';
import { ModeScreen } from './modeScreen.js';
import { dexRefresh, titleName } from './codex.js';
import { itemName, PETS, gearStats, grantEgg, makeItem, addItems, RARITY, spFree, WTYPES, hasW, wtypeOf, recPets, HERO_SKINS, CASH_W, CASH_W_GEM, CASH_W_DMG } from './gear.js';
import { t, tt } from './i18n.js';
import { petCard } from './petRoles.js';

const { W, H } = D;
const R = Phaser.Math.Between;
// 하단 탭은 넷(디자인 인계): 훈련은 성장 탭 안 '훈련' 칸으로 옮겼다. show('train')은 성장 > 훈련으로 연다
const TABS = [['battle', t('lobby.b9e139'), 1], ['forge', t('lobby.348786'), 13], ['gear', t('lobby.705103'), 11], ['shop', t('lobby.f7cc86'), 12]];

// 스테이지별 권장 전투력(data.js recPower)
export const recAtk = D.recPower;

// 비급 칸은 좁아 설명 첫 줄만 남기면 문장이 중간에서 잘렸다: 한 줄에 들어가는 짧은 설명
const BOOK_SHORT = { spin: t('lobby.a93ede'), dagger: t('lobby.84ce88'), bolt: t('lobby.fbf767'), holy: t('lobby.7c19f3'), fireball: t('lobby.d1b2e7'), ice: t('lobby.37aa13'), orb: t('lobby.500ede') };

export class Lobby extends Phaser.Scene {
  constructor() { super('Lobby'); }

  // 씬 인스턴스는 재사용되니 전투에서 돌아올 때 잠금·체크 상태를 비운다
  init(data) { if (data?.modeSel) { this.modeScr = true; this.modeId = data.modeSel; this.modeN = data.modeN ?? 0; } else this.modeScr = false; this.tab = data?.tab || this.tab || 'battle'; this.busy = false; this.enhQ = false; this.guardOff = false; this.charmOff = false; if (data?.cosmetic) { this.shopPage = 'skin'; this.skinTab = cosmetic(data.cosmetic)?.kind || 'costume'; this.cosSelected = { [this.skinTab]: data.cosmetic }; this.legacySkins = false; } }
  // 방지권은 가지고 있으면 기본으로 쓴다(직접 끈 경우만 안 씀)
  get useGuard() { return !this.guardOff && this.sv?.guard > 0; }
  get useCharm() { return !this.charmOff && this.sv?.charm > 0 && D.ENH_RATE[this.sv.enh] < 100; }

  create() {
    // 전투가 멈춘 채 끝났어도 로비 애니메이션은 돌아야 한다(애니메이션 관리자는 장면끼리 공유)
    this.anims.resumeAll(); this.anims.globalTimeScale = 1;
    this.sv = load();
    const sv = this.sv;
    setSound(sv.sound); setMusicLevel(sv.musicLvl); setMusic(!sv.musicOff && sv.sound !== false); setVib(!sv.vibOff);
    this.input.once('pointerdown', () => { unlock(); playBgm('lobby'); });
    playBgm('lobby');
    if (!sv.musicOff && sv.sound !== false) preloadBattleBgm();   // 1장 전투 곡을 로비에 있는 동안 받아 둔다
    // 1-1을 처음 깨고 오면 대장간으로 안내한다
    if (this.shopPage !== 'skin' && sv.cleared >= 1 && !sv.tut.forgeShown) { sv.tut.forgeShown = true; this.tab = 'forge'; save(); }
    // 54차: 업데이트로 받은 도전 증표(이미 깬 도전·깬 장 몫)를 한 번 알린다
    if (sv.markGift > 0) { const n = sv.markGift; sv.markGift = 0; save(); this.time.delayedCall(900, () => toast(this, t('lobby.8574d6', { n }), '#7fe6ee', 112)); }
    // 어려움은 마왕을 잡은 뒤에만. 전투 탭이 보던 난이도를 기억한다
    this.hard = !!sv.hardOn && D.hardOpen(sv);
    dexRefresh(sv);
    // 처음 고를 챕터는 지금 도전할 곳
    // 판을 새로 깼으면 다음 도전 칸으로 옮긴다(깬 칸에 머물러 1-1만 되풀이했다)
    if (this.selC === undefined || this.lastProg !== this.prog) this.selTop();
    this.lastProg = this.prog;
    this.makeTextures();
    hiCam(this).setBackgroundColor('#0d0a14');
    // 세로로 긴 폰(390x844)에서 판 위아래 남는 검은 띠를 전투 화면처럼 바닥 무늬로 채운다(44차)
    setBackdrop(this, 'tiles', 0x6a5a82);
    this.bg = this.add.container(0, 0);
    // 49차: 세로로 더 긴 폰(H>480)도 본문은 위에서부터 채운다. 남는 높이에는 시즌·오늘의 판매 배너를 둔다(banner)
    this.body = this.add.container(0, 0);
    this.makeTop();
    this.makeTabs();
    logUser({ cleared: sv.cleared, tier: sv.tier, enh: sv.enh, payer: !!sv.paidTotal, paid_total: sv.paidTotal || 0, no_ads: !!sv.noAds, pass: sv.passLeft > 0 });
    track('lobby_enter', { tab: this.tab, cleared: sv.cleared, tier: sv.tier, enh: sv.enh, power: D.powerOf(sv), gold: sv.gold, stone: sv.stone, gem: sv.gem, runs: sv.stats.runs, guard: sv.guard, sweep: sv.sweep });
    this.show(this.tab);
    this.cameras.main.fadeIn(200);
    // 55차: 16장 알림을 켜 둔 사람은 16장이 열린 뒤 처음 로비에서 한 번 알려 준다
    if (sv.tut?.ch16Notify && !sv.tut.ch16Told && D.openN() > D.MAIN_CHAPTERS) { sv.tut.ch16Told = 1; save(); this.time.delayedCall(900, () => toast(this, t('lobby.ch16Open'), '#9ae0ff', 112)); }
    // 자리를 비웠다 돌아오면 견습생이 번 것을 먼저 준다(다른 창보다 앞)
    const idle = this.idleReward();
    if (idle) this.time.delayedCall(250, () => this.welcomeWin(idle));
    // 1-1을 처음 깨고 오면(또는 이 안내를 아직 못 본 기존 유저) 코치마크 안내(tutorial.js). 다른 창보다 앞
    else if (this.shopPage !== 'skin' && tutorialDue(sv)) this.time.delayedCall(350, () => !this.busy && runTutorial(this));
    else if (this.tab === 'forge' && sv.tut.forgeShown && !sv.tut.forge) this.time.delayedCall(300, () => toast(this, t('lobby.2ee336'), '#ffd75e', 112));
    // 47차: 팝업은 한 번에 하나, 순서는 새 펫 → 출석 → 꾸러미. 구매 유도(성장·첫 결제 꾸러미)는 하루 한 번, 직전에 다른 팝업이 뜬 뒤 한 판은 더 해야 뜬다
    else if (sv.petJoinPending && this.tab === 'battle') { sv.popRun = sv.stats.runs; this.time.delayedCall(250, () => this.petWin()); }
    // 세 판을 하고 난 뒤부터(처음엔 창이 연달아 뜨지 않게): 출석 창, 1-3을 깨면 첫 결제 꾸러미 한 번
    else if (!sv.loginGot && sv.stats.runs >= 3 && sv.loginPop !== sv.day) { sv.loginPop = sv.day; sv.popRun = sv.stats.runs; save(); this.time.delayedCall(250, () => this.missionWin(true)); }
    // 장 보스를 처음 잡고 오면 24시간 성장 꾸러미를 한 번 띄운다
    else if (this.offerOk() && growOffer(sv) && !sv.grow.shown && this.tab === 'battle') this.time.delayedCall(250, () => this.tab === 'battle' && !this.busy && this.growWin());
    else if (this.offerOk() && salesOpen(sv) && sv.cleared >= 2 && !sv.bought.starter && !sv.starterShown && this.tab === 'battle') this.time.delayedCall(250, () => this.tab === 'battle' && this.starterWin());
    // 2장 보스를 처음 잡고 오면 도전 버튼을 한 장짜리 코치마크로 짚는다(다른 창이 떠 있으면 다음 번에)
    if (modeDue(sv) && this.tab === 'battle' && !this.modeScr) this.time.delayedCall(600, () => !this.busy && this.tab === 'battle' && runModeCoach(this));
  }

  // 지금 난이도에서 깬 판 수, 그 다음 도전할 판을 고른다
  get prog() { return this.hard ? this.sv.hardCleared || 0 : this.sv.cleared; }
  selTop() { const top = Math.min(this.prog, D.openTotal() - 1); this.selC = Math.floor(top / D.STAGES_PER_CHAPTER); this.selS = top % D.STAGES_PER_CHAPTER; }

  // 로비 위에 뜨는 창
  modal() {
    const c = fixedContainer(this).setDepth(2000);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive());
    this.busy = true;
    c.close = () => { c.destroy(); this.busy = false; this.refreshTop(); this.show(this.tab); if (modeDue(this.sv) && this.tab === 'battle' && !this.modeScr) this.time.delayedCall(250, () => !this.busy && runModeCoach(this)); };   // 앞 창을 닫고 나서 도전 안내(2장 보스 직후 펫·꾸러미 창이 먼저 뜬다)
    return c;
  }

  // ── 오늘의 임무 + 출석 ──
  missionReady() {
    const sv = this.sv;
    const n = D.MISSIONS.filter(m => (sv.mis[m.id] || 0) >= m.need && !sv.misGot[m.id]).length;
    const all = D.MISSIONS.every(m => sv.misGot[m.id]) && !sv.misGot.all;
    return n + (all ? 1 : 0) + (sv.loginGot ? 0 : 1) + this.weeklyReady() + this.ordersReady();
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
      toast(this, t('lobby.ff9ac4', { giveText: giveText(g, sv) }), '#ffd75e');
    };
    if (auto) claim();
    c.add(panel(this, 16, 60, W - 32, 370, { fill: 0x1a1426, line: 0xffd75e }));
    const body = this.add.container(0, 0); c.add(body);
    this.misPage = page;
    const draw = () => {
      body.removeAll(true);
      // 위: 오늘 / 이번 주 두 칸
      [['day', t('lobby.276ef2')], ['week', t('lobby.db9056')], ['order', t('lobby.ordTitle')]].forEach(([id, name], i) => {
        const x = 46 + i * 66, on = this.misPage === id;
        const nt = this.add.text(x, 80, name, font(on ? 13 : 11, on ? '#ffd75e' : '#7d8f94')).setOrigin(0.5); nt.setScale(Math.min(1, 62 / nt.width)); body.add(nt);
        if (on) body.add(this.add.rectangle(x, 92, 56, 2, 0xffd75e));
        if (id === 'week' && this.weeklyReady()) body.add(this.add.circle(x + 29, 74, 3.5, 0xff3a3a));
        if (id === 'order' && this.ordersReady()) body.add(this.add.circle(x + 29, 74, 3.5, 0xff3a3a));
        const hit = this.add.rectangle(x, 80, 66, 24, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => { if (this.misPage === id) return; sfx('click'); this.misPage = id; draw(); });
        body.add(hit);
      });
      body.add(button(this, W - 38, 80, 26, 22, 'X', () => c.close(), { size: 11, color: 0x3a3846 }));
      if (this.misPage === 'week') return this.weeklyDraw(body, draw);
      if (this.misPage === 'order') return this.ordersDraw(body, draw);
      D.MISSIONS.forEach((m, i) => {
        const y = 102 + i * 40, have = Math.min(m.need, sv.mis[m.id] || 0), done = have >= m.need, got = sv.misGot[m.id];
        body.add(panel(this, 26, y, W - 52, 34, { fill: got ? 0x141018 : 0x293845 }));
        body.add(this.add.text(36, y + 5, m.name, font9(10, got ? '#6a6080' : '#ffffff')));
        body.add(this.add.text(36, y + 19, t('lobby.cb7823', { have, need: m.need, gem: D.MISSION_GIVE.gem, stone: D.MISSION_GIVE.stone }), font9(10, done ? '#5fdc6a' : '#a1b2b6')));
        const bt = button(this, W - 60, y + 17, 52, 24, got ? t('lobby.8d8680') : t('lobby.98d0f0'), () => {
          if (got || !done) return;
          sv.misGot[m.id] = true; track('mission_claim', { mission: m.id }); grant(sv, D.MISSION_GIVE); sfx('coin'); this.refreshTop(); draw();
        }, { size: 10, color: 0x2f6b3a });
        bt.setEnabled(done && !got); body.add(bt);
      });
      const allDone = D.MISSIONS.every(m => sv.misGot[m.id]);
      const ab = button(this, W / 2, 236, 190, 24, sv.misGot.all ? t('lobby.96d0ce') : t('lobby.1eb65d', { gem: D.MISSION_ALL.gem }), () => {
        if (!allDone || sv.misGot.all) return;
        sv.misGot.all = true; track('mission_claim', { mission: 'all' }); grant(sv, D.MISSION_ALL); sfx('win'); this.refreshTop(); draw();
      }, { size: 10, color: 0x3a3846 });
      ab.setEnabled(allDone && !sv.misGot.all); body.add(ab);
      // 출석 7일
      body.add(this.add.rectangle(W / 2, 258, W - 60, 1, 0x475c66));
      body.add(this.add.text(W / 2, 272, t('lobby.659c18', { streak: sv.streak }), font(12, '#9ae0ff')).setOrigin(0.5));
      body.add(this.add.text(W / 2, 288, mul > 1 ? t('lobby.d10aaa', { v: Math.floor((sv.streak - 1) / 7) + 1, mul }) : t('lobby.a5d115'), font9(10, mul > 1 ? '#ffd75e' : '#a1b2b6')).setOrigin(0.5));
      D.LOGIN_REWARDS.map(scaled).forEach((g, i) => {
        const x = W / 2 + (i - 3) * 31, y = 324, past = i < day || (i === day && sv.loginGot), today = i === day;
        body.add(this.add.rectangle(x, y, 28, 50, today ? 0x3b2f5c : 0x15111f).setStrokeStyle(1, today ? 0xffd75e : 0x293845));
        body.add(this.add.text(x, y - 16, t('lobby.e69dc6', { v: i + 1 }), font9(10, today ? '#ffd75e' : '#7d8f94')).setOrigin(0.5).setPadding(0, 2));
        const [k, v] = Object.entries(g)[0];
        body.add(k === 'gem' ? gemIcon(this, x, y - 3, 12) : icon(this, x, y - 3, { goldStage: 12, stone: 13, guard: 11, sweep: 15 }[k], 14));
        body.add(this.add.text(x, y + 10, k === 'goldStage' ? fmt(Math.round(D.dunBase(sv).gold * v)) : String(v), font9(10, '#ffffff')).setOrigin(0.5));
        if (g.skin && !sv.skins?.[g.skin]) body.add(this.add.text(x, y + 20, t('lobby.51f3f1'), font9(9, '#ff9a5a')).setOrigin(0.5));
        if (past) { body.add(this.add.rectangle(x, y, 28, 50, 0x000000, 0.55)); body.add(this.add.text(x + 9, y - 15, '✓', font(11, '#5fdc6a')).setOrigin(0.5)); }
      });
      const lb = button(this, W / 2, 380, 170, 26, sv.loginGot ? t('lobby.99c3e7') : t('lobby.2125ed'), () => { claim(); draw(); }, { size: 11, color: 0x2f6b3a });
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
    c.add(this.add.text(W / 2, 152, t('lobby.a8e4af'), font(14, '#ffd75e')).setOrigin(0.5));
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    // 최대보다 오래 비웠으면 실제로 비운 시간과 지급 상한을 따로 적는다(13시간 비웠는데 '8시간'이라 하면 이상했다)
    c.add(this.add.text(W / 2, 174, raw > D.IDLE.capH ? t('lobby.f5fc73', { floor: Math.floor(raw), capH: D.IDLE.capH }) : t('lobby.04bd54', { v: hh ? t('lobby.0ae74a', { hh }) : '', mm }), font9(10, '#a1b2b6')).setOrigin(0.5));
    const tx = [];
    [[12, gold, '#ffd75e'], [13, stone, '#9ae0ff']].forEach(([ic, v, col], i) => {
      const x = W / 2 - 50 + i * 100;
      c.add(icon(this, x, 214, ic, 26));
      const t = this.add.text(x, 242, '+' + fmt(v), font(13, col)).setOrigin(0.5); c.add(t); tx.push(t);
    });
    c.add(gem ? this.add.text(W / 2, 268, t('lobby.24c04a', { gem }), font(10, '#ff9ad0')).setOrigin(0.5) : this.add.text(W / 2, 268, t('lobby.fb9c09', { capH: D.IDLE.capH }), font9(9, '#7d8f94')).setOrigin(0.5));
    if (adsLeft(sv, 'double') > 0) {
      const db = button(this, W / 2, 296, 180, 24, sv.noAds ? t('lobby.be822d') : adWord(t('lobby.37b6a9'), t('lobby.be822d')), async () => {
        if (db.used) return; db.used = true; db.setEnabled(false);
        const ok = await showAd(this, sv, 'double');
        if (!ok || !this.scene.isActive()) { db.used = false; db.setEnabled(true); return; }
        sv.ads.double = (sv.ads.double || 0) + 1;
        sv.gold += gold; sv.stone += stone; save(); this.refreshTop();
        tx[0].setText('+' + fmt(gold * 2)); tx[1].setText('+' + fmt(stone * 2));
        sfx('coin'); db.label.setText(t('lobby.63b8a7')); track('idle_double', { gold, stone });
      }, { size: 10, color: 0x1d6f80 });   // 53차: 광고 2배는 청록(보조), 주황은 '좋아' 하나
      c.add(db);
    }
    c.add(button(this, W / 2, 330, 110, 26, t('lobby.764be8'), () => c.close(), { size: 11, color: 0x2f6b3a }));
  }

  offerOk() { const sv = this.sv; return !cashHidden() && sv.offerDay !== sv.day && (sv.popRun ?? -1) < sv.stats.runs; }
  // 새 보스 펫 합류(클리어 카드를 닫은 뒤 로비에서)
  petWin() {
    const sv = this.sv, p = PETS.find(x => x.id === sv.petJoinPending);
    delete sv.petJoinPending; save();
    if (!p) return;
    const c = this.modal();
    c.add(panel(this, 14, 60, W - 28, 372, { fill: 0x1a1426, line: p.color }));
    c.add(this.add.text(W / 2, 80, t('lobby.87c061'), font(15, '#ffd75e')).setOrigin(0.5));
    petCard(this, c, p, sv, 94);
    c.add(button(this, W / 2 + 46, 404, 84, 28, t('lobby.818a75'), () => { sv.pet = p.id; save(); sfx('buy'); track('pet_join_take', { pet: p.id }); c.close(); }, { size: 11, color: 0x2f6b3a }));
    c.add(button(this, W / 2 - 50, 404, 76, 28, sv.pet === p.id ? t('lobby.468266') : t('lobby.0fcd14'), () => { track('pet_join_later', { pet: p.id }); c.close(); }, { size: 10, color: 0x3a3846 }));
  }

  // 1-3을 깬 뒤 한 번만: 첫 결제 꾸러미
  // 55차: 16장 예고 카드를 누르면: 업데이트 알림 켜기(저장은 tut.ch16Notify 하나) + 친구에게 알리기. 출시는 15장까지 그대로
  ch16Win() {
    const sv = this.sv, c = this.modal();
    track('ch16_open', { on: !!sv.tut?.ch16Notify });
    c.add(panel(this, 20, 150, W - 40, 190, { fill: 0x1a1426, line: 0x9ae0ff }));
    c.add(this.add.text(W / 2, 172, t('lobby.ch16Title'), font(13, '#9ae0ff')).setOrigin(0.5));
    [t('lobby.ch16L1'), t('lobby.ch16L2')].forEach((s2, i) => { const tx = this.add.text(32, 194 + i * 40, '- ' + s2, { ...font9(10, '#e8f4f8'), wordWrap: { width: W - 64 } }).setLineSpacing(2); c.add(tx); });
    const on = !!sv.tut?.ch16Notify;
    const nb = button(this, shareHidden() ? W / 2 : 82, 316, shareHidden() ? 140 : 108, 28, on ? t('lobby.ch16Done') : t('lobby.ch16On'), () => {
      if (sv.tut?.ch16Notify) return;
      sv.tut ||= {}; sv.tut.ch16Notify = 1; save(); track('ch16_notify_on'); sfx('coin'); toast(this, t('lobby.ch16Thx'), '#9ae0ff', 112); c.close();
    }, { size: 11, color: 0x2f6b3a });
    nb.setEnabled(!on); c.add(nb);
    if (!shareHidden()) c.add(button(this, 196, 316, 108, 28, t('lobby.ch16Share'), async () => { const r = await openShare(this, t('share.6ee53a', { myCode: myCode() })); track('ch16_share', { ok: r }); }, { size: 11, color: 0x1d6f80 }));
    c.add(button(this, W - 40, 172, 24, 20, 'X', () => c.close(), { size: 10 }));
  }

  starterWin() {
    const sv = this.sv, it = D.IAP.find(x => x.id === 'starter'), c = this.modal();
    sv.offerDay = sv.day; sv.popRun = sv.stats.runs;
    sv.starterShown = true; save(); track('starter_offer_show', { cleared: sv.cleared });
    c.add(panel(this, 24, 130, W - 48, 210, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(this.add.text(W / 2, 152, t('lobby.5bda6c'), font9(10, '#ff9ad0')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 172, it.name, font(14, '#ffd75e')).setOrigin(0.5));
    c.add(gemIcon(this, W / 2, 204, 26));
    c.add(this.add.text(W / 2, 230, giveText(it.give), { ...font9(10, '#f2e4bc'), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5, 0));
    { const tg = this.add.text(W / 2, 268, `${iapTag(it)}  ·  ${priceLabel(it)}`, font(11, '#ffd75e')).setOrigin(0.5); tg.setScale(Math.min(1, (W - 56) / tg.width)); c.add(tg); }
    c.add(button(this, 88, 310, 96, 28, t('lobby.2d4e13'), () => { track('starter_offer_close'); c.close(); }, { size: 11, color: 0x3a3846 }));
    c.add(button(this, 186, 310, 100, 28, t('lobby.c91e61'), async () => {
      track('starter_offer_click');
      const ok = await buy(this, sv, it);
      if (ok) toast(this, t('lobby.d19e31', { name: it.name }), '#ffd75e');
      c.close();
    }, { size: 12, color: 0x2f6b3a }));
  }

  // 장 보스 첫 처치 뒤 한 번: 24시간 성장 꾸러미
  growWin() {
    const sv = this.sv, it = growOffer(sv);
    if (!it) return;
    const c = this.modal();
    sv.offerDay = sv.day; sv.popRun = sv.stats.runs;
    sv.grow.shown = true; save(); track('grow_offer_show', { c: it.c });
    c.add(panel(this, 24, 130, W - 48, 210, { fill: 0x1a1426, line: 0xffd75e }));
    c.add(this.add.text(W / 2, 152, t('lobby.ed0dd7', { v: it.c + 1 }), font9(10, '#ff9ad0')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 172, it.name, font(13, '#ffd75e')).setOrigin(0.5));
    c.add(icon(this, W / 2, 202, 13, 24));
    c.add(this.add.text(W / 2, 222, giveText(it.give, sv), { ...font9(10, '#f2e4bc'), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2, 256, t('lobby.1c99ba', { won: priceLabel(it) }), font(10, '#ffd75e')).setOrigin(0.5));
    const lt = this.add.text(W / 2, 274, '', font9(10, '#ff9a8a')).setOrigin(0.5); c.add(lt);
    const tick = () => { if (!lt.active) return; lt.setText(t('lobby.480780', { leftText: leftText(growLeft(sv)) })); this.time.delayedCall(1000, tick); }; tick();
    c.add(button(this, 88, 310, 96, 28, t('lobby.2d4e13'), () => { track('grow_offer_close'); c.close(); }, { size: 11, color: 0x3a3846 }));
    c.add(button(this, 186, 310, 100, 28, t('lobby.c91e61'), async () => {
      track('grow_offer_click');
      const ok = await buy(this, sv, it);
      if (ok) toast(this, t('lobby.d19e31', { name: it.name }), '#ffd75e');
      c.close();
    }, { size: 12, color: 0x2f6b3a }));
  }

  makeTextures() {
    const g = this.make.graphics({ add: false });
    // 망치 그림이 로드돼도 불티(spark)는 따로 만든다(같이 건너뛰면 강화 불꽃이 깨진다)
    if (!this.textures.exists('spark')) g.fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('spark', 2, 2);
    // 설정 톱니(48차): 18x18
    if (!this.textures.exists('gear')) {
      g.clear().fillStyle(0xcfd6dc);
      for (let k = 0; k < 8; k++) g.fillCircle(9 + Math.cos(k * Math.PI / 4) * 7.2, 9 + Math.sin(k * Math.PI / 4) * 7.2, 1.9);
      g.fillCircle(9, 9, 6).fillStyle(0x0b111a).fillCircle(9, 9, 2.6);
      g.generateTexture('gear', 18, 18);
    }
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
    this.add.rectangle(0, 0, W, 34, 0x0b111a, 0.96).setOrigin(0).setDepth(50);
    this.add.rectangle(0, 34, W, 1, COLOR.line).setOrigin(0).setDepth(50);
    const items = [[12, () => fmt(sv.gold)], [13, () => fmt(sv.stone)], [11, () => sv.guard], [15, () => `${sv.sweep}`], [-1, () => fmt(sv.gem)]];
    // 상단은 금화·강화석·보석 셋만(디자인 인계): 방지권은 대장간, 소탕권은 전투 탭에서 보인다. 칸 번호(bump)는 그대로 둔다
    this.topTxt = items.map(([ic, get], i) => {
      const x = [4, 56, -1, -1, 108][i];
      const t = this.add.text(x + 17, 10, '', font(11, '#f2e4bc', 0)).setDepth(51);
      t.get = get;
      if (x < 0) return t.setVisible(false);
      if (ic < 0) gemIcon(this, x + 7, 17, 13).setDepth(51);
      else this.add.existing(icon(this, x + 7, 17, ic, 14).setDepth(51));
      return t;
    });
    // 54차: 도전 증표(승급 재료). 도전이 열리면 보석 아래 줄에 작게 보인다
    if (sv.cleared >= D.STAGES_PER_CHAPTER) {
      const mk = this.add.text(108 + 17, 23, '', font9(9, '#7fe6ee', 0)).setDepth(51); mk.get = () => String(sv.mark | 0);
      markIcon(this, 108 + 7, 28, 10).setDepth(51); this.topTxt.push(mk);
    }
    // 알림 종·소리·설정(48차): 종 44px, 소리 30px, 설정 톱니 44px로 따로 떨어뜨린다
    // 50차: 토스 안에서는 오른쪽 위 X 버튼과 겹치지 않게 세 아이콘을 왼쪽으로 모은다(누르는 칸도 좁힌다)
    const toss = inTossShell(), bx = toss ? 166 : 176, sx = toss ? 190 : 212, gx = toss ? 214 : 248, hw = toss ? 24 : 44;
    if (this.textures.exists('bell') && sv.cleared > 0) {
      const bell = this.add.image(bx, 17, 'bell').setDepth(51);
      this.add.rectangle(bx, 22, hw, 44, 0xffffff, 0.001).setDepth(51).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (this.busy) return; sfx('click'); track('bell_tap'); this.missionWin(); });
      this.bellDot = this.add.circle(bx + 10, 10, 3, 0xed786f).setDepth(52);
      // 점만으론 무슨 알림인지 모른다(42차): 종 아래에 한 줄로 뭘 받는지 작게 보여 준다
      this.bellHint = this.add.text(bx + 22, 31, '', font(8, '#ffd75e', 2)).setOrigin(1, 0.5).setDepth(52);
    }
    // 소리 켜고 끄기
    const snd = this.add.text(sx, 17, sv.sound ? '♪' : '×', font(13)).setOrigin(0.5).setDepth(51);
    this.add.rectangle(sx, 22, toss ? 26 : 30, 44, 0xffffff, 0.001).setDepth(51).setInteractive({ useHandCursor: true }).on('pointerup', () => { sv.sound = !sv.sound; sv.musicOff = !sv.sound; track('sound_toggle', { on: sv.sound }); setSound(sv.sound); setMusic(sv.sound); snd.setText(sv.sound ? '♪' : '×'); save(); sfx('click'); if (sv.sound) playBgm('lobby'); });
    // 설정(저장 내보내기·가져오기, 구매 복원, 이펙트 간단히): 톱니 아이콘, 누르는 칸 44px
    this.add.image(gx, 17, 'gear').setDepth(51);
    this.add.rectangle(gx, 22, hw, 44, 0xffffff, 0.001).setDepth(51).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (this.busy) return; sfx('click'); openSettings(this); });
    this.refreshTop();
    lobbyShareTick(this).catch(() => {});   // 친구 초대 보상 확인(서버가 죽었으면 조용히 넘어간다)
  }
  refreshTop() { this.topTxt.forEach(t => t.setText(t.get())); this.bellDot?.setVisible(this.missionReady() > 0); this.bellHint?.setText(this.bellText()); }
  // 받을 것이 하나뿐이면 이름, 여럿이면 개수. 없으면 빈 글
  bellText() {
    const sv = this.sv, n = D.MISSIONS.filter(m => (sv.mis[m.id] || 0) >= m.need && !sv.misGot[m.id]).length + this.ordersReady();
    const all = D.MISSIONS.every(m => sv.misGot[m.id]) && !sv.misGot.all, wk = this.weeklyReady(), lg = sv.loginGot ? 0 : 1;
    const kinds = (n + (all ? 1 : 0) > 0) + (wk > 0) + lg;
    if (!kinds) return '';
    if (kinds > 1) return t('lobby.c56722', { v: n + (all ? 1 : 0) + wk + lg });
    return lg ? t('lobby.0c7523') : wk ? t('lobby.993ab6', { wk }) : t('lobby.2f4c8a', { v: n + (all ? 1 : 0) });
  }
  bump(i) { const t = this.topTxt[i]; this.tweens.add({ targets: t, scale: 1.3, duration: 90, yoyo: true }); }

  makeTabs() {
    this.add.rectangle(0, H - 50, W, 50, 0x0b111a, 0.97).setOrigin(0).setDepth(50);
    this.add.rectangle(0, H - 50, W, 1, COLOR.line).setOrigin(0).setDepth(50);
    this.tabBtns = TABS.map(([id, name, ic], i) => {
      const tw = W / TABS.length, x = tw / 2 + i * tw, c = this.add.container(x, H - 25).setDepth(51);
      // 고른 탭은 아래 주황 줄(45×2) + 주황 이름(디자인 인계 하단 탭 규격)
      const hl = this.add.rectangle(0, 23, 45, 2, 0xffb85c), lb = this.add.text(0, 12, name, font(10)).setOrigin(0.5);
      c.add([hl, icon(this, 0, -7, ic, 18), lb]);
      c.hl = hl; c.lb = lb; c.setSize(tw, 50).setInteractive({ useHandCursor: true });
      // 처음엔 전투만: 1-1을 깨면 나머지 탭이 열린다
      const locked = () => id !== 'battle' && this.sv.cleared === 0;
      if (locked()) c.setAlpha(0.3);   // 자물쇠 이모지·주황 표기가 탭마다 붙어 지저분했다(40차). 누르면 토스트로 알려 준다
      c.on('pointerup', () => { if (this.busy) return; if (locked()) { sfx('deny'); track('locked_tab_tap', { tab: id }); toast(this, t('lobby.c48b8f', { name }), '#ff9a8a'); return; } sfx('click'); this.show(id); });
      // 장비 탭: 찍을 스탯이 남았으면 빨간 점
      if (id === 'gear' && !locked() && spFree(this.sv) > 0) c.add(this.add.circle(tw / 2 - 10, -16, 4, 0xff5050));
      // 상점 탭: 성장 꾸러미(24시간 한정)가 열려 있으면 빨간 점
      if (id === 'shop' && !locked() && !cashHidden() && growOffer(this.sv)) c.add(this.add.circle(tw / 2 - 10, -16, 4, 0xff5050));
      c.id = id; return c;
    });
  }

  show(id) {
    if (id !== this.lastTab) { track('tab_view', { tab: id, page: id === 'shop' ? this.shopPage : undefined }); this.lastTab = id; }
    if (id === 'train') { this.gearPage = 'train'; id = 'gear'; }
    if (id !== 'forge') this.clearBrag();
    this.tab = id; this.ticks = [];
    this.tabBtns.forEach(b => { b.hl.setVisible(b.id === id); b.lb.setColor(b.id === id ? '#ffb85c' : '#a1b2b6'); });
    // 탭 안 오브젝트의 트윈만 끊는다(토스트·결과 글씨·날아가는 동전은 끝까지 돈다)
    const kill = o => { this.tweens.killTweensOf(o); o.list?.forEach(kill); };
    [this.body, this.bg].forEach(kill);
    this.body.removeAll(true); this.bg.removeAll(true);
    this.banner(id);
    if (id === 'battle') { this.battleTab(); this.trialLink(); }
    if (id === 'forge') this.forgeTab();
    if (id === 'gear') this.gearTab();
    if (id === 'shop') this.shopTab();
    this.body.setAlpha(0); this.tweens.add({ targets: this.body, alpha: 1, duration: 150 });
    // 53차: 장비·펫·교역은 그 탭을 처음 열 때 안내 한 장씩(메인 안내는 필수 3장만)
    const tc = id === 'shop' ? 'tab_shop' : id === 'gear' ? (this.gearPage === 'pet' ? 'tab_pet' : this.gearPage === 'gear' ? 'tab_gear' : '') : '';
    if (tc) this.time.delayedCall(450, () => this.tab === id && !this.busy && tabCoach(this, tc));
  }

  // 49차: 가변 높이 화면(H>480)에서 남는 높이를 채우는 배너. 상점은 위(본문을 아래로 민다), 나머지 탭은 본문 아래 탭바 위
  // 왼쪽 '겨울 꾸미기'(행사 기간만), 오른쪽 '오늘의 특가'. 높이가 모자라면(480) 아예 만들지 않는다
  banner(id) {
    this.bn?.destroy(); this.bn = null; this.body.y = 0;
    const extra = H - 480, sv = this.sv, top = id === 'shop';
    const bh = Math.min(top ? extra - 4 : extra - 10, 50);
    // 50차: 모드 선택 화면에서는 겨울·오늘의 특가 배너를 숨긴다(시작 버튼 아래가 광고처럼 보였다)
    if (id === 'battle' && this.modeScr) return;
    if (id === 'forge' && H >= 575 && sv.cleared >= 1) return;   // 55차: 키 큰 폰의 대장간은 아래 빈 자리를 오늘의 의뢰 3개가 쓴다(판매 배너와 겹치지 않게)
    // 50차: 처음 시작한 계정(1판도 못 깸): 비는 자리에 첫 목표 한 줄과 모드 예고 카드를 둔다
    if (id === 'battle' && sv.cleared < 1 && !this.tower && bh >= 34) {
      const c = this.bn = this.add.container(0, 436).setDepth(10), w = W - 24;
      const bh2 = Math.min(bh, Math.floor((H - 50 - 436 - 10) / 2));   // 52차: 두 번째 카드가 아래 탭 줄에 가려지던 것(카드 둘이 들어갈 높이로 줄인다)
      const card = (y, line, title, tc, sub) => {
        c.add(panel(this, 12, y, w, bh2, { fill: 0x141b27, line }));
        c.add(this.add.text(24, y + 6, title, font(11, tc)));
        c.add(this.add.text(24, y + 6 + 16, sub, { ...font9(10, '#a1b2b6'), wordWrap: { width: w - 24 } }));
      };
      // 52차: 단계 버튼 아래 빈 띠에 1장 보상 미리보기
      c.add(this.add.text(W / 2, -206, t('lobby.f6a172'), font9(10, '#ffd75e')).setOrigin(0.5));
      card(0, 0xffd75e, t('lobby.d68777'), '#ffd75e', t('lobby.968a66'));
      card(bh2 + 6, 0x475c66, t('lobby.394214'), '#ffffff', t('lobby.9465aa'));
      return;
    }
    if (bh < 34 || sv.cleared < 1) return;
    const goal = nextGoal(sv, D.powerOf(sv));
    // 53차: 첫 승급(또는 1장 클리어) 전에는 겨울·특가 띠를 숨기고 그 자리에 '다음 목표' 카드 하나만 둔다(판매 자체는 그대로, 노출 시점만)
    if (!salesOpen(sv)) {
      if (id !== 'battle' || this.tower || !goal) return;
      const c = this.bn = this.add.container(0, 436).setDepth(10), w = W - 24;
      c.add(panel(this, 12, 0, w, bh, { fill: 0x141b27, line: 0x7fe6ee }));
      c.add(this.add.text(24, 6, goal.title, font(11, '#7fe6ee')));
      c.add(this.add.text(24, 22, goal.sub, { ...font9(10, '#cfe0ea'), wordWrap: { width: w - 24 } }));
      c.add(this.add.rectangle(12, 0, w, bh, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (this.busy) return; sfx('click'); track('goal_card_tap', { kind: goal.kind, act: goal.act }); this.goGoal(goal); }));
      return;
    }
    const y0 = top ? 38 : 436, ts = todaySale(), win = available({ winter: true });
    if (top) this.body.y = bh + 4;
    const c = this.bn = this.add.container(0, y0).setDepth(10);
    const goSkin = (tab, sel) => { sfx('click'); this.shopPage = 'skin'; this.skinTab = tab; if (sel) { this.cosSelected = this.cosSelected || {}; this.cosSelected[ts.kind] = sel; } track('banner_tap', { to: tab }); this.show('shop'); };
    const card = (x, w, line, title, tc, sub, fn) => {
      c.add(panel(this, x, 0, w, bh, { fill: 0x141b27, line }));
      c.add(this.add.text(x + 8, 6, title, font(11, tc)));
      const sb = this.add.text(x + 8, 21, sub, { ...font9(10, '#a1b2b6'), wordWrap: { width: w - 16 } }).setLineSpacing(2);
      if (sb.height > 16 && sb.y + sb.height > bh - 16) { sb.setWordWrapWidth(null); sb.setScale(Math.max(0.6, Math.min(1, (w - 16) / sb.width))); }   // 55차: 두 줄이 되면 오른쪽 아래 '보러 가기'와 겹쳐, 한 줄로 줄인다
      c.add(sb);
      c.add(this.add.text(x + w - 8, bh - 6, t('lobby.5d2a5b'), font9(9, '#7d8f94')).setOrigin(1, 1));
      c.add(this.add.rectangle(x, 0, w, bh, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.busy) fn(); }));
    };
    // 15장을 다 깼고 16장이 아직 안 열렸으면 '16장 예고' 배너가 자리를 차지한다(탭하면 안내)
    if (sv.cleared >= D.MAIN_CHAPTERS * D.STAGES_PER_CHAPTER && D.openN() <= D.MAIN_CHAPTERS && !top && this.textures.exists('ban_ch16')) {
      const im = this.add.image(12, 0, 'ban_ch16').setOrigin(0); im.setScale((W - 24) / im.width); c.add(im);
      c.add(this.add.text(24, 8, t('lobby.e3cee5'), font(11, '#9ae0ff')));
      c.add(this.add.text(24, 24, t('lobby.3f8470'), font9(9, '#ffffff')));
      c.add(this.add.rectangle(12, 0, W - 24, im.displayHeight, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.busy) { sfx('click'); this.ch16Win(); } }));
      return;
    }
    // 52차: 1장을 깨면 모드 4종이 열린다 — 처음 들어갈 때까지 큰 카드 + 빨간 점으로 알린다(작은 회색 '모드' 버튼만 있어 못 찾았다)
    if (id === 'battle' && sv.cleared >= D.STAGES_PER_CHAPTER && !modeSeen(sv) && !this.modeScr) {
      c.add(panel(this, 12, 0, W - 24, bh, { fill: 0x1a2236, line: 0x5fc8ff }));
      c.add(this.add.text(24, 8, t('lobby.f6d312'), font(12, '#9ae0ff')));
      c.add(this.add.text(24, 25, t('lobby.8e8973'), font9(10, '#cfe0ea')));
      c.add(this.add.circle(W - 30, 12, 5, 0xff3a3a));
      c.add(this.add.rectangle(12, 0, W - 24, bh, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (this.busy) return; sfx('click'); this.openModes(); }));
      return;
    }
    const half = (W - 24 - 6) / 2;
    // 53차: 승급이 증표에 막혔으면 왼쪽 칸을 '도전 X장 깨면 증표' 목표 카드로 바꾸고 바로 가기를 단다
    if (goal?.kind === 'mark') card(12, half, 0x7fe6ee, goal.title, '#7fe6ee', goal.sub, () => this.goChallenge());
    else if (!win && D.openN() <= D.MAIN_CHAPTERS && sv.cleared >= 5 * D.STAGES_PER_CHAPTER) card(12, half, 0x9ae0ff, t('lobby.ch16Soon'), '#9ae0ff', t('lobby.3f8470'), () => { sfx('click'); this.ch16Win(); });   // 55차: 후반 신호 — 16장 준비 중(표시만, 알림 신청 없음)
    else card(12, half, win ? 0x7ad0ff : COLOR.line, win ? t('lobby.4c24d0') : t('lobby.8306ca'), win ? '#9ae0ff' : '#ffffff', win ? t('lobby.01ac36', { length: winterItems().length }) : t('lobby.34a1d0'), () => goSkin(win ? 'winter' : 'character'));
    card(12 + half + 6, half, 0xff9ad0, t('lobby.b0904d'), '#ff9ad0', t('lobby.f1b741', { name: ts.name, SALE_OFF }), () => goSkin(ts.kind, ts.id));
  }

  // 다음 목표 카드·전투 카드 줄을 탭하면 갈 곳: 소탕으로 벌기는 방금 깬 판을 골라 소탕 버튼 앞으로
  goGoal(goal) {
    if (goal.to === 'forge') return this.show('forge');
    if (goal.to === 'challenge') return this.goChallenge();
    if (goal.act === 'sweep' || goal.act === 'play') { const top = Math.max(0, Math.min(this.prog, D.openTotal()) - 1); this.hard = false; this.selC = Math.floor(top / D.STAGES_PER_CHAPTER); this.selS = top % D.STAGES_PER_CHAPTER; }
    this.show('battle');
  }

  // itch.io 체험판: 전체판 링크(토스·스토어). 다른 판에서는 아무것도 그리지 않는다
  trialLink() {
    const t = trialInfo(); if (!t) return;
    const b = button(this, W / 2, H - 62, 170, 16, `${t.label} ▶`, () => { track('full_link', { from: 'lobby' }); openFull('lobby'); }, { size: 9, color: 0x3a3846 });
    this.body.add(b);
  }

  // ── 전투 탭 ──
  battleTab() {
    if (this.modeScr) return this.modePage();
    if (this.tower) return this.towerPage();
    const sv = this.sv, b = this.body, c = this.selC, ch = D.CHAPTERS[c], hard = this.hard, prog = this.prog;
    const atk = D.powerOf(sv);
    // 챕터 제목과 화살표(어려움은 붉게)
    b.add(this.add.text(W / 2, 56, (hard ? tt('lobby.chTitleHard', { n: c + 1, name: ch.name }) : tt('lobby.chTitle', { n: c + 1, name: ch.name })), font(15, hard ? '#ff7070' : '#ffd75e')).setOrigin(0.5));
    const unlockedC = Math.floor(Math.min(prog, D.openTotal() - 1) / D.STAGES_PER_CHAPTER);
    const arrow = (x, d, ok) => {
      const t = this.add.text(x, 56, d < 0 ? '◀' : '▶', font(14, ok ? '#ffffff' : '#3a3450')).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => { if (!ok) return; sfx('click'); this.selC += d; this.selS = Math.min(this.selS, this.selC < unlockedC ? D.STAGES_PER_CHAPTER - 1 : prog % D.STAGES_PER_CHAPTER); if (this.selC === unlockedC) this.selS = Math.min(prog, D.openTotal() - 1) % D.STAGES_PER_CHAPTER; this.show('battle'); });
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
    const lbk = this.textures.exists('lobby_bg' + (c + 1)) ? 'lobby_bg' + (c + 1) : 'lobby_bg';   // 장마다 배경이 다르다(5장은 마왕성 lobby_bg)
    if (this.textures.exists(lbk)) pv.add(this.add.image(0, AY - 30, lbk).setOrigin(0).setCrop(0, 30, W, AH));
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
    pv.add(this.add.text(W - 34, AY + 52, bossLeft > 0 ? tt('lobby.6019de', { bossLeft }) : bossLeft === 0 ? tt('lobby.e0436f') : tt('lobby.b78093'), font(9, bossLeft < 0 ? '#a8a0c0' : '#ff9090', 3)).setOrigin(0.5, 0));
    this.modeEntry(pv, AY);   // 모드 선택으로 가는 버튼(modeScreen.js)
    if (sv.title) pv.add(this.add.text(10, AY + 4, `「${titleName(sv.title)}」`, font9(10, '#ffb050', 3)));
    // 돌아올 이유: 자리를 비워도 견습생이 번다(조용한 한 줄)
    if (sv.cleared >= 1) pv.add(this.add.text(sv.title ? 90 : 10, AY + 4, tt('lobby.dc2acf', { fmt: fmt(Math.round(D.dunBase(sv).gold * D.IDLE.perH)) }), font9(9, '#d8d0e8', 3)));
    // 스테이지 3칸: 그림 아래 띠에 작게. 무엇이 다른지는 아래 정보판에
    for (let s = 0; s < D.STAGES_PER_CHAPTER; s++) {
      const idx = c * D.STAGES_PER_CHAPTER + s, x = 47 + s * 88, y = AY + AH - 20;
      const locked = idx > prog, done = idx < prog, sel = s === this.selS, boss = D.isBossS(s);
      const g = this.add.container(x, y);
      g.add(panel(this, -38, -14, 76, 28, { fill: locked ? 0x100d16 : sel ? (hard ? 0x3a1a24 : 0x2e2548) : hard ? 0x22121a : 0x1c1729, line: sel ? 0xffd75e : boss && !locked ? 0xa03848 : 0x3a3150 }));
      g.add(this.add.text(0, 0, locked ? tt('lobby.956f2f') : `${c + 1}-${s + 1}${boss ? tt('lobby.510dda') : ''}`, font(11, locked ? '#4a4060' : boss ? '#ff9090' : '#ffffff')).setOrigin(0.5));
      if (done) g.add(this.add.text(34, -12, '★', font(9, '#ffd75e')).setOrigin(1, 0));
      g.setSize(76, 28).setInteractive({ useHandCursor: true });
      g.on('pointerup', () => { if (locked) { sfx('deny'); track('locked_stage_tap', { stage: `${c + 1}-${s + 1}` }); toast(this, tt('lobby.386eb1'), '#ff9090'); return; } sfx('click'); this.selS = s; track('stage_select', { stage: `${c + 1}-${s + 1}` }); this.show('battle'); });
      b.add(g);
    }
    // 메뉴 줄: 임무·던전·기록·난이도(받을 게 있으면 빨간 점)
    if (sv.stats.runs > 0) this.menuRow(b);
    // 선택한 스테이지 정보판: 무엇이 다른지 → 전투력 막대 → 보상
    const s = this.selS, idx = c * D.STAGES_PER_CHAPTER + s, done = idx < prog, rec = D.recOf(c, s, hard), boss = D.isBossS(s);
    b.add(panel(this, 12, 244, W - 24, 132, { fill: 0x15111f }));   // 아래 버튼이 탭 바에 붙지 않게 짧게
    const vr = D.stageVariant(c, s), mod = D.stageMod(c);
    const head = boss ? tt('lobby.18b85c', { name: D.BOSSES[ch.boss].name }) : s === 1 ? tt('lobby.dc9a53', { name: mod.name }) : vr ? tt('lobby.d9fdf3', { pre: D.VARIANTS[vr[1]].pre, v: D.MOB_NAMES[ch.mobs[vr[0]]] }) : tt('lobby.7b4737');
    const last = idx >= D.openTotal() - 1;
    const sub = hard ? (boss ? (last ? tt('lobby.7ca614') : tt('lobby.e4d0c4', { v: c + 2 })) : tt('lobby.f2e9c7'))
      : boss ? (last ? tt('lobby.d1dda0') : tt('lobby.679a15', { v: c + 2 })) : s === 1 ? tt('lobby.4be6a0', { desc: mod.desc }) : vr ? D.VARIANTS[vr[1]].desc : tt('lobby.7a25f3');
    b.add(this.add.text(24, 254, `${hard ? tt('lobby.52de23') : ''}${c + 1}-${s + 1}  ${head}`, font(12, boss || hard ? '#ff9090' : '#ffffff')));
    b.add(this.add.text(24, 273, sub, { ...font9(10, '#a1b2b6'), wordWrap: { width: W - 48 } }));
    // 전투력: 숫자 두 개보다 막대 하나가 빨리 읽힌다
    const pc = D.powerCol(atk, rec, s), ratio = Math.min(1, atk / rec);   // rec는 난이도에 맞춘 권장
    const pl = this.add.text(24, 300, tt('lobby.8673e1'), font9(10, '#a1b2b6')), pt = this.add.text(24 + pl.width + 6, 299, `${fmt(atk)} / ${fmt(rec)}`, font(11, pc));
    b.add([pl, pt]);
    // 이 맵에 잘 듣는 펫(데려가고 있으면 초록). 보상 줄과 겹치지 않게 전투력 줄 오른쪽에 둔다
    const rps = recPets(sv, c);
    if (rps.length) {
      const nm = rps.map(p => p.name);
      const rt = this.add.text(W - 24, 301, tt('lobby.1843fc', { join: nm.join(' / ') }), font9(9, rps.some(p => p.id === sv.pet) ? '#5fdc6a' : '#ffd75e')).setOrigin(1, 0);
      if (rt.x - rt.width < pt.x + pt.width + 8) rt.setText(tt('lobby.21537d', { v: nm[0] }));
      b.add(rt);
    }
    const bar = this.add.graphics();
    bar.fillStyle(0x2a2338, 1).fillRect(24, 316, W - 48, 6);
    bar.fillStyle(Phaser.Display.Color.HexStringToColor(pc).color, 1).fillRect(24, 316, Math.max(2, (W - 48) * ratio), 6);
    b.add(bar);
    // 다음 목표 카드(파란 카드)가 같은 말을 하고 있으면 이 줄은 숨긴다. 아니면 지금 할 행동 하나만 말한다
    const goalCardOn = !salesOpen(sv) && sv.cleared >= 1 && H - 490 >= 34;
    if (atk < rec && goalCardOn) { /* 카드가 말한다 */ }
    else if (atk < rec) {
      const pg = nextGoal(sv, atk), act = pg?.kind === 'power' ? pg : { act: 'enh', to: 'forge', title: tt('nextGoal.enh') };
      const t = this.add.text(24, 328, `${act.title}  ▶`, font(10, '#ffb070')).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => { sfx('click'); track('to_forge_click', { from: 'battle_tab', power: atk, rec, stage: `${c + 1}-${s + 1}`, act: act.act }); this.goGoal(act); });
      b.add(t);
    } else b.add(this.add.text(24, 328, done ? tt('lobby.c3bb9a') : tt('lobby.7053d6'), font9(10, '#7d8f94')));
    // 보상: 아이콘 + 숫자
    b.add(this.add.rectangle(W / 2, 344, W - 48, 1, 0x2e2740));
    b.add(this.add.text(24, 352, done ? tt('lobby.0c955c') : tt('lobby.7c9612'), font9(10, '#a1b2b6')));
    const wNew = boss && WTYPES.some(w => !hasW(sv, w.id));   // 보스를 처음 잡으면 아직 해금 안 된 무기 하나를 무작위로 준다(캐시 무기와 따로 센다)
    const rw = [[12, fmt(Math.round(D.goldOf(c, s, hard) * (done ? 1 : D.FIRST_CLEAR_MUL)))], [13, `${D.stoneOf(c, s, hard)}`]];
    if (!done && hard) rw.push(boss ? [11, tt('lobby.2e604f')] : [7, tt('lobby.cf313a')], [-1, String(boss ? D.HARD.bossGem : D.HARD.firstGem)]);
    else if (!done) rw.push(boss ? [11, wNew ? tt('lobby.6d5b7a') : tt('lobby.2e604f')] : [7, tt('lobby.c5e28a')]);
    let rx = Math.max(78, 24 + b.list[b.list.length - 1].width + 10);   // 52차: 영어 'First Clear'가 아이콘과 겹쳤다(앞 글자 폭 뒤에서 시작)
    rw.forEach(([ic, v]) => {
      b.add(ic < 0 ? gemIcon(this, rx, 359, 11) : icon(this, rx, 359, ic, 14));
      const t = this.add.text(rx + 10, 352, v, font(10, '#ffffff')); b.add(t);
      rx += 10 + t.width + 14;
    });
    const go = button(this, 95, 398, 150, 32, boss ? tt('lobby.4549db') : tt('lobby.e630cd'), () => this.startBattle(c, s, false, hard), { size: 14, color: boss || hard ? 0x8a2a3a : 0x2f6b3a });
    const sw = button(this, 214, 398, 76, 32, tt('lobby.1157aa', { sweep: sv.sweep }), () => this.sweep(c, s), { size: 11, color: 0x3a3846 });
    sw.setEnabled(done && sv.sweep > 0);
    b.add([go, sw]);
  }

  // 보석이 모자라면 패키지 탭으로 보낸다(첫 구매 2배를 같이 알린다)
  gemShort(need) {
    const sv = this.sv, first = D.FIRST_BUY_X2.some(id => !sv.bought?.[id]);
    this.shopPage = cashHidden() ? 'gem' : 'pack'; this.show('shop');
    toast(this, t('lobby.598484', { v: need - sv.gem, v2: first && !cashHidden() ? t('lobby.4349b5') : '' }), '#ff9a8a');
  }

  // ── 무한의 탑 ──
  towerPage() {
    const sv = this.sv, b = this.body;
    const c = Math.floor(Math.min(sv.cleared, D.openTotal() - 1) / D.STAGES_PER_CHAPTER);
    b.add(this.add.text(W / 2, 56, t('battle.6304cf'), font(15, '#c8a0ff')).setOrigin(0.5));
    const back = this.add.text(22, 56, '◀', font(14)).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => { sfx('click'); this.tower = false; this.show('battle'); });
    b.add(back);
    b.add(panel(this, 12, 74, W - 24, 92, { fill: 0x1a1430, line: 0x8a6ac8 }));
    b.add(this.add.text(W / 2, 100, t('lobby.88bdb0', { v: sv.endBest || 0 }), font(22, '#ffd75e')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 128, t('lobby.447216', { v: c + 1, name: D.CHAPTERS[c].name }), font9(10, '#a1b2b6')).setOrigin(0.5));
    b.add(this.add.text(W / 2, 146, t('lobby.469014'), font9(10, '#a1b2b6')).setOrigin(0.5));
    b.add(this.add.text(24, 180, t('lobby.e4fa09'), font(12, '#c8a0ff')));
    [t('lobby.86aa27', { floorSec: D.ENDLESS.floorSec }), t('lobby.9dff6a'), t('lobby.bf14d9'), t('lobby.2092af')].forEach((t, i) =>
      b.add(this.add.text(24, 200 + i * 17, '- ' + t, font9(10, '#f2e4bc'))));
    b.add(this.add.text(24, 276, t('lobby.0c955c'), font(12, '#c8a0ff')));
    [t('lobby.9f3b03', { stonePerFloor: D.ENDLESS.stonePerFloor }), t('lobby.a8ca98', { gemPerNewFloor: D.ENDLESS.gemPerNewFloor }), t('lobby.29ad75')].forEach((t, i) =>
      b.add(this.add.text(24, 296 + i * 17, '- ' + t, font9(10, '#f2e4bc'))));
    const go = button(this, W / 2, 398, 190, 32, t('lobby.6369c3'), () => this.startBattle(c, 0, true), { size: 14, color: 0x2f6b3a });
    b.add(go);
    this.tweens.add({ targets: go, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  tv(id) { const t = D.TRAINING.find(x => x.id === id); return D.trainVal(t, this.sv.train[id] || 0); }

  startBattle(c, s, endless = false, hard = false, dungeon = null) {
    if (this.busy) return; this.busy = true;
    const sv = this.sv, rec = D.recOf(c, s, hard), pw = D.powerOf(sv);
    // 새 장 첫 판에 처음 들어가면 도입 보상(금화 꾸러미 + 소탕권). 한 번만
    const intro = !endless && !dungeon && !hard && s === 0 && D.introOf(c);
    if (intro && !(sv.intro ||= {})[c]) {
      sv.intro[c] = 1; sv.gold += intro.gold; sv.sweep = Math.min(D.SWEEP_MAX, sv.sweep + intro.sweep); save();
      toast(this, t('lobby.7cee49', { fmt: fmt(intro.gold), sweep: intro.sweep }), '#ffd75e');
      track('chapter_intro', { c, gold: intro.gold });
    }
    track('battle_start_click', { stage: endless ? 'tower' : dungeon ? 'dungeon' : `${hard ? 'H' : ''}${c + 1}-${s + 1}`, idx: c * D.STAGES_PER_CHAPTER + s, power: pw, rec, ratio: Math.round(pw / rec * 100) / 100, replay: c * D.STAGES_PER_CHAPTER + s < (hard ? sv.hardCleared : sv.cleared), tier: sv.tier, enh: sv.enh, hard, dungeon: dungeon || 'none' });
    sfx('bossIn');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle', { chapter: c, stage: s, endless, hard, dungeon }));
  }

  // 소탕: 깬 스테이지 보상을 바로 받는다(하루 5장)
  sweep(c, s) {
    const sv = this.sv, gold = D.goldOf(c, s, this.hard), stone = D.stoneOf(c, s, this.hard);
    if (sv.sweep <= 0) return;
    sv.sweep--; sv.gold += gold; sv.stone += stone; mission('clear'); mission('sweep'); save();
    track('sweep', { stage: `${this.hard ? 'H' : ''}${c + 1}-${s + 1}`, gold, stone, left: sv.sweep });
    sfx('coin');
    for (let i = 0; i < 10; i++) {
      const p = this.add.image(214 + R(-20, 20), 412 + R(-8, 8), 'silver').setTint(0xffd75e).setScale(2).setDepth(60);
      this.tweens.add({ targets: p, x: 18, y: 17, duration: 450, delay: i * 40, ease: 'Quad.In', onComplete: () => { p.destroy(); if (i === 9) { this.refreshTop(); this.bump(0); this.bump(1); this.bump(3); } } });
    }
    // 소탕도 절반 확률로 장비 하나(대부분 일반)
    const it = Math.random() < 0.5 ? makeItem(this.hard ? D.openN() - 1 : c, { rarity: Math.random() < 0.75 ? 0 : 1 }) : null;
    if (it) { addItems(sv, [it]); save(); }
    toast(this, t('lobby.21fc0a', { fmt: fmt(gold), stone, v: it ? `  ·  ${RARITY[it.r].name} ${itemName(it)}` : '' }), '#ffd75e');
    this.time.delayedCall(500, () => this.show('battle'));
  }

  // ── 대장간 탭 ──
  // 강화 단계마다 칼 모습이 달라진다(42차): +5 푸른 빛, +10 불티·주황 테, +15 보랏빛 룬, +20 금백 광채·빛기둥
  // 구간 번호(0~4): 크기·빛·테두리·이펙트를 구간마다 한 단계씩 키운다
  static stageOf(enh) { return enh >= 20 ? 4 : enh >= 15 ? 3 : enh >= 10 ? 2 : enh >= 5 ? 1 : 0; }
  swordAura(enh) {
    const b = this.body, sw = this.sword, st = Lobby.stageOf(enh);
    const col = [0, 0x5fc8ff, 0xff8a2a, 0xd06bff, 0xfff2b0][st];
    if (st < 1) return;
    sw.preFX?.addGlow(col, [0, 3, 5, 7, 9][st], 0, false, 0.1, 12);
    // 모서리 괄호 테두리: 직각·1px, 구간이 오를수록 커지고 밝아진다
    const hw = [0, 46, 54, 62, 70][st], hh = hw - 2, cl = [0, 8, 10, 13, 16][st], fr = this.add.graphics();
    fr.lineStyle(st >= 3 ? 2 : 1, col, 0.9);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const x = W / 2 + sx * hw, y = 168 + sy * hh;
      fr.lineBetween(x, y, x - sx * cl, y); fr.lineBetween(x, y, x, y - sy * cl);
    });
    b.addAt(fr, 0);
    const ring = this.add.image(W / 2, 168, 'disc').setScale(1.1 + st * 0.15).setTint(col).setAlpha(0.2 + st * 0.06).setBlendMode(Phaser.BlendModes.ADD);
    b.addAt(ring, 0);
    this.tweens.add({ targets: ring, scale: ring.scale + 0.25, alpha: 0.1, duration: 800 - st * 100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    if (st >= 2) for (let i = 0; i < (st >= 4 ? 16 : st >= 3 ? 11 : 6); i++) {
      const e = this.add.circle(W / 2 + R(-24, 24), 205, R(1, st >= 4 ? 3 : 2), st >= 4 ? 0xfff2b0 : i % 2 ? 0xffd75e : 0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      b.add(e);
      this.tweens.add({ targets: e, y: R(110, 140), x: e.x + R(-10, 10), alpha: { from: 0.9, to: 0 }, duration: R(900, 1400), delay: i * 130, repeat: -1 });
    }
    if (st >= 3) {
      const rc = this.add.container(W / 2, 168);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        rc.add(this.add.rectangle(Math.cos(a) * 44, Math.sin(a) * 44, 5, 5, 0xe8a0ff).setAngle(45).setBlendMode(Phaser.BlendModes.ADD));
      }
      b.add(rc);
      this.tweens.add({ targets: rc, angle: 360, duration: 6000, repeat: -1 });
    }
    if (st >= 4) {
      // 바깥 룬 고리는 반대로 돌고, 칼 뒤로 빛기둥이 선다
      const rc2 = this.add.container(W / 2, 168);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        rc2.add(this.add.rectangle(Math.cos(a) * 60, Math.sin(a) * 60, 4, 4, 0xfff2b0).setAngle(45).setBlendMode(Phaser.BlendModes.ADD));
      }
      b.add(rc2);
      this.tweens.add({ targets: rc2, angle: -360, duration: 9000, repeat: -1 });
      const beam = this.add.rectangle(W / 2, 168, 26, 150, 0xfff2b0, 0.16).setBlendMode(Phaser.BlendModes.ADD);
      b.addAt(beam, 0);
      this.tweens.add({ targets: beam, alpha: 0.06, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  forgeTab() {
    const sv = this.sv, b = this.body, bg = this.bg;
    if (this.textures.exists('forge_bg')) {
      const im = this.add.image(W / 2, 35, 'forge_bg').setOrigin(0.5, 0);
      im.setScale(Math.max(W / im.width, (H - 85) / im.height)).setAlpha(0.55);
      bg.add(im);
    }
    bg.add(this.add.rectangle(0, 35, W, H - 85, 0x0b111a, 0.35).setOrigin(0));
    // 화덕 불빛이 일렁인다
    const glow = this.add.image(W / 2, 200, 'disc').setScale(3.4).setTint(0xff7a2a).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    bg.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.4, scale: 3.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const t = D.TIERS[sv.tier], enh = sv.enh, max = enh >= D.ENH_MAX;
    // 머리(디자인 인계 forge_ready): 왼쪽 '대장간' 제목, 오른쪽 +N → +N+1. 둘째 줄은 무기 이름과 공격력 변화
    b.add(this.add.text(14, 40, tt('lobby.348786'), font(18, '#f2e4bc', 0)));
    b.add(this.add.text(W - 14, 44, max ? tt('lobby.05f3c1', { enh }) : `+${enh} → +${enh + 1}`, font(13, enh >= 15 ? '#ff9a3a' : '#ffb85c', 0)).setOrigin(1, 0));
    b.add(this.add.text(14, 64, D.tierName(sv.tier, wtypeOf(sv)), font(11, '#a1b2b6', 0)));
    b.add(this.add.text(W - 14, 64, tt('lobby.f87b0a', { fmt: fmt(Math.round(D.weaponAtk(sv.tier, enh))), v: max ? '' : ` → ${fmt(Math.round(D.weaponAtk(sv.tier, enh + 1)))} (+${Math.round((D.weaponAtk(sv.tier, enh + 1) / D.weaponAtk(sv.tier, enh) - 1) * 100)}%)` }), font(11, '#73d6c1', 0)).setOrigin(1, 0));
    // 다음 각성(+5 단위)까지 남은 단계: 거기서 공격력이 한 번 더 뛰고 칼 모습이 바뀐다
    if (!max) {
      const next = (Math.floor(enh / D.ENH_MILESTONE) + 1) * D.ENH_MILESTONE;
      // +15까지는 각성 때 무엇이 바뀌는지 이름을 보여 준다
      const an = D.AWAKENINGS.find(x => x[0] === next), nm = an ? ` [${an[1]}]` : '';
      this.awakeTxt = this.add.text(W / 2, 90, next === enh + 1 ? tt('lobby.13b5b2', { v: nm || ` ×${D.MILESTONE_MUL}` }) : tt('lobby.f7a901', { next, nm, v: next - enh }), font(8, next === enh + 1 ? '#ffd75e' : '#a8a0c0', 2)).setOrigin(0.5);
      b.add(this.awakeTxt);
    }
    // 모루 위의 칼
    const stg = Lobby.stageOf(enh), halo = this.halo = this.add.image(W / 2, 170, 'disc').setScale(1.6 + stg * 0.2).setTint([0x9ad8ff, 0x7fd0ff, 0xffb060, 0xd890ff, 0xfff2b0][stg]).setAlpha(0.3 + stg * 0.07).setBlendMode(Phaser.BlendModes.ADD);
    // 강화할수록 칼이 커지고 빛깔이 물든다(+5 푸른, +10 주황, +15 보라). 그림은 든 무기 종류를 따른다
    const wid = wtypeOf(sv).id;
    this.sword = weaponIcon(this, W / 2, 168, wid, sv.tier, 72 * [1, 1.1, 1.22, 1.36, 1.5][stg] * (1 + (enh % 5) * 0.01));
    const et = enh >= 20 ? 0xfff4c8 : enh >= 15 ? 0xf0c0ff : enh >= 10 ? 0xffc088 : enh >= 5 ? 0xb8e4ff : 0;
    // 룬 등급 색(t.tint)은 검 시트 그림용: 다른 종류는 등급 색을 그림에 이미 칠해 뒀다
    if (t.tint && wid === 'sword' && sv.tier < 5) this.sword.setTint?.(t.tint); else if (et) this.sword.setTint?.(et);
    this.tweens.add({ targets: this.sword, y: 162, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.hammer = this.add.image(W / 2 + 54, 130, 'hammer').setScale(2.2).setOrigin(0.5, 0.9).setAngle(30);
    b.add([halo, this.sword, this.hammer]);
    // 이상한 돌멩이: 모루 위 칼을 스무 번 건드리면 떨어진다
    this.sword.setInteractive().on('pointerup', () => {
      if (this.busy || sv.eggs?.rock) return;
      sv.taps = (sv.taps || 0) + 1; sfx('hit', 40);
      // 다섯 번마다 뭔가 있다는 기척을 준다
      if (sv.taps % 5 === 0 && sv.taps < 20) { save(); toast(this, [tt('lobby.699ce0'), tt('lobby.39179b'), tt('lobby.edd15a')][sv.taps / 5 - 1], '#a1b2b6'); }
      this.tweens.add({ targets: this.sword, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, onComplete: () => this.sword.setAngle(0) });
      if (sv.taps >= 20 && grantEgg(sv, 'rock')) { save(); sfx('win'); toast(this, tt('lobby.8dd49f'), '#ff8ae0'); track('egg_found', { egg: 'rock' }); }
    });
    if (!max) b.bringToTop(this.awakeTxt);
    this.swordAura(enh);
    // 55차: 대장간 의뢰 칩(회색 — 주황 버튼은 강화 하나)
    if (sv.cleared >= 1 && H >= 575) this.ordersInline(b, 424);
    else if (sv.cleared >= 1) {
      const oc = button(this, 80, 232, 132, 20, tt('lobby.ordChip', { done: this.ordersDone(), n: this.orders().length }), () => { if (!this.busy) { sfx('click'); track('order_open'); this.missionWin(false, 'order'); } }, { size: 10, color: 0x3a3846 });
      b.add(oc);
      if (this.ordersReady() > 0) b.add(this.add.circle(142, 223, 4, 0xff3a3a));
    }
    // 강화 단계 표시(20칸)
    b.add(this.add.rectangle(W / 2, 256, W - 32, 26, 0x0b111a, 0.75).setStrokeStyle(1, COLOR.line));
    for (let i = 0; i < D.ENH_MAX; i++) {
      const x = 25 + (i % 10) * 22.5, y = 252 + Math.floor(i / 10) * 9;
      b.add(this.add.rectangle(x, y, 18, 5, i < enh ? (i >= 15 ? 0xff9a3a : i >= 10 ? 0xffd75e : 0x6fd3ff) : 0x2a2438).setOrigin(0, 0.5));
    }
    // 정보 패널
    // 높이는 체크 줄 수만큼(부적 줄이 패널 테두리에 걸쳐 겹쳐 보였다)
    const nChk = max ? 0 : (enh >= D.DESTROY_FROM ? 1 : 0) + (sv.charm > 0 && D.ENH_RATE[enh] < 100 ? 1 : 0);
    b.add(panel(this, 12, 272, W - 24, max ? 56 : 62 + nChk * 17 + (nChk === 2 ? 6 : 0), { fill: 0x15111f }));   // 빈 칸 없이 내용만큼
    if (max) {
      b.add(this.add.text(W / 2, 300, tt('lobby.6ea04e'), font(14, '#ffd75e')).setOrigin(0.5));
    } else {
      const pity = D.pityRate(sv), rate = Math.min(100, D.ENH_RATE[enh] + (this.useCharm ? D.CHARM_RATE : 0) + this.apron() + pity), gold = D.enhGold(sv.tier, enh), stone = D.enhStone(sv.tier, enh);
      const danger = enh >= D.DESTROY_FROM;
      const row = (y, a, v, col) => { b.add(this.add.text(24, y, a, font9(10, '#a1b2b6'))); b.add(this.add.text(W - 24, y, v, font(10, col)).setOrigin(1, 0)); };
      row(280, tt('lobby.c59895'), tt('lobby.12668b', { rate, v: this.useCharm ? tt('lobby.740c15') : '', v2: pity ? tt('lobby.a195a4', { pity }) : '' }), rate >= 70 ? '#5fdc6a' : rate >= 35 ? '#ffd75e' : '#ff7070');
      row(296, tt('lobby.c514c8'), danger ? (this.useGuard ? tt('lobby.d229de') : tt('lobby.7e6ae8', { shatterTo: D.shatterTo(enh) })) : tt('lobby.e4e5f6'), danger ? (this.useGuard ? '#9ae0ff' : '#ff5050') : '#f2e4bc');
      row(312, tt('lobby.5b4db1'), tt('lobby.82ef52', { fmt: fmt(gold), stone }), sv.gold >= gold && sv.stone >= stone ? '#ffd75e' : '#ff7070');
      if (danger) {
        const chk = this.add.container(24, 340);
        chk.add(this.add.rectangle(0, 0, 12, 12, 0x000000).setStrokeStyle(1, 0x9ae0ff).setOrigin(0, 0.5));
        if (this.useGuard) chk.add(this.add.text(6, 0, '✓', font(10, '#9ae0ff')).setOrigin(0.5));
        chk.add(this.add.text(18, 0, tt('lobby.6f1df6', { guard: sv.guard }), font9(10, sv.guard ? '#f2e4bc' : '#5c6e76')).setOrigin(0, 0.5));
        chk.setSize(200, 18).setInteractive({ useHandCursor: true });
        chk.on('pointerup', () => { if (this.busy) return; if (!sv.guard) { sfx('deny'); track('guard_toggle_fail'); return; } sfx('click'); this.guardOff = !this.guardOff; track('guard_toggle', { on: !this.guardOff, guard: sv.guard }); this.show('forge'); });
        b.add(chk);
      }
      // 행운 부적: 가지고 있을 때만 보인다(기본으로 켜짐)
      if (sv.charm > 0 && D.ENH_RATE[enh] < 100) {
        const ck = this.add.container(24, danger ? 357 : 340);
        ck.add(this.add.rectangle(0, 0, 12, 12, 0x000000).setStrokeStyle(1, 0xffd75e).setOrigin(0, 0.5));
        if (this.useCharm) ck.add(this.add.text(6, 0, '✓', font(10, '#ffd75e')).setOrigin(0.5));
        ck.add(this.add.text(18, 0, tt('lobby.5677bb', { CHARM_RATE: D.CHARM_RATE, charm: sv.charm }), font9(10, '#f2e4bc')).setOrigin(0, 0.5));
        ck.setSize(200, 18).setInteractive({ useHandCursor: true });
        ck.on('pointerup', () => { if (this.busy) return; sfx('click'); this.charmOff = !this.charmOff; this.show('forge'); });
        b.add(ck);
      }
      const ok = sv.gold >= gold && sv.stone >= stone;
      const eb = button(this, sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1 ? 82 : W / 2, 404, sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1 ? 124 : 180, 30, ok ? tt('lobby.3e1a33') : sv.gold < gold ? tt('lobby.06342c', { fmt: fmt(gold - sv.gold) }) : tt('lobby.a8bce1', { v: stone - sv.stone }), () => this.enhance(), { size: ok ? 15 : 11, color: danger ? 0x8a2f3a : 0x2f6b3a, onDeny: () => this.enhance() });
      eb.setEnabled(ok); b.add(eb);
      // 처음 하는 사람: 강화 버튼을 가리킨다
      this.forgeArrow = sv.cleared >= 1 && !sv.tut.forge && ok;
      if (this.forgeArrow) {
        const ar = this.add.text(eb.x, 376, tt('lobby.60cf6b'), font(11, '#ffffff')).setOrigin(0.5); b.add(ar);
        this.tweens.add({ targets: ar, y: 382, duration: 350, yoyo: true, repeat: -1 });
      }
      // +10부터는 칼이 붉게 달아오른다
      if (danger) { this.halo.setTint(0xff3a2a).setAlpha(0.5); this.tweens.add({ targets: this.halo, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 }); }
    }
    // 승급: +10 이상이고 그 등급 챕터 보스를 깨면 다음 등급 무기로(지금보다 약해지지 않는 강화 수치부터)
    if (sv.enh >= D.PROMOTE_NEED && sv.tier < D.TIERS.length - 1) {
      const need = D.TIER_AT[sv.tier + 1], okBoss = sv.cleared >= need, cost = D.promoteGold(sv.tier);
      // 54차: 3장 무기 이상으로 올릴 때부터 도전 증표가 든다. 모자라면 승급 버튼이 도전 화면으로 가는 버튼이 된다
      const mkNeed = D.markNeed(sv.tier + 1), mkHave = sv.mark | 0, okMark = mkHave >= mkNeed, markBlock = okBoss && !okMark;
      const pb = button(this, max ? W / 2 : 200, 404, max ? 180 : 110, 30, markBlock ? tt('lobby.24e1eb') : tt('lobby.3adf57', { fmt: fmt(cost) }), () => markBlock ? this.goChallenge() : this.promote(), { size: 12, color: markBlock ? 0x1d6f80 : 0x2f6b3a });
      pb.setEnabled(okBoss && (markBlock || sv.gold >= cost)); b.add(pb);
      if (mkNeed && okBoss) {
        const mt = this.add.text(W / 2, 361, tt('lobby.ab8f9f', { mkHave, mkNeed }), font9(10, okMark ? '#7fe6ee' : '#ff9a8a')).setOrigin(0.5, 0); mt.setScale(Math.min(1, (W - 80) / mt.width)); b.add(mt); b.add(markIcon(this, mt.x - mt.displayWidth / 2 - 9, 367, 12));
      }
      if (markBlock && !sv.tut.markAsk) { sv.tut.markAsk = true; save(); this.time.delayedCall(300, () => toast(this, tt('lobby.867885'), '#7fe6ee', 112)); }
      if (this.forgeArrow) { /* 첫 강화 안내와 겹치지 않게 승급 안내는 숨긴다 */ }
      else if (!okBoss) b.add(this.add.text(W / 2, 375, tt('lobby.1eecc2', { v: need / D.STAGES_PER_CHAPTER }), font9(10, '#ff9a8a')).setOrigin(0.5, 0));
      else if (markBlock) { const g = nextGoal(sv), mt2 = this.add.text(W / 2, 375, g?.sub || tt('lobby.867885'), font9(10, '#7fe6ee')).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }); mt2.on('pointerup', () => this.goChallenge()); b.add(mt2); }   // 53차: '도전 X장을 깨면 증표' 구체 목표 + 탭하면 도전으로
      else {
        // 승급하면 몇 강부터 시작하는지와 공격력을 지금과 견줘 보여 준다
        const e = D.promoteEnh(sv.tier, sv.enh), now = Math.round(D.weaponAtk(sv.tier, sv.enh)), next = Math.round(D.weaponAtk(sv.tier + 1, e));
        b.add(this.add.text(W / 2, 375, tt('lobby.ade394', { tierName: D.tierName(sv.tier + 1, wtypeOf(sv)), fmt: fmt(now), fmt2: fmt(next), e }), font9(10, next >= now ? '#c8a0ff' : '#ff9a8a')).setOrigin(0.5, 0));
      }
    }
  }

  // +10 이상 강화 성공 순간의 자랑하기(테두리 버튼). 다음 강화·탭 이동·8초 뒤에 사라진다
  clearBrag() { this.bragB?.destroy(); this.bragB = null; this.bragT?.remove(); }
  bragEnh(lv) {
    this.clearBrag();
    if (shareHidden()) return;   // 포털판은 링크 공유를 하지 않는다
    const sv = this.sv;
    const b = this.bragB = button(this, W / 2, 224, 132, 22, braggable() ? t('lobby.df7096', { bragGem: bragGem() }) : t('overlay.c5cca3'), async () => {
      b.setEnabled(false);
      const r = await shareBrag(this, t('lobby.a71e5a', { v: sv.title ? `[${titleName(sv.title)}] ` : '', tierName: D.tierName(sv.tier, wtypeOf(sv)), lv }), 'enh');
      if (!this.scene.isActive()) return;
      if (r.gem) { b.label.setText(t('overlay.ab7e90')); this.refreshTop(); } else b.setEnabled(true);
    }, { size: 10, color: 0x3a3846 }).setDepth(60);
    this.bragT = this.time.delayedCall(8000, () => this.clearBrag());
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
      sfx('deny'); toast(this, sv.sweep > 0 ? t('lobby.aa7b63') : t('lobby.47d5b6'), '#ffd75e', 372);
      return;
    }
    this.clearBrag();
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
      if (sv.stats.destroyed >= 3 && grantEgg(sv, 'apron')) this.time.delayedCall(1800, () => toast(this, t('lobby.32ecbf'), '#ff8ae0'));
    }
    track('enhance', { result: outcome, from: enh, tier: sv.tier, rate: D.ENH_RATE[enh] + (charm ? D.CHARM_RATE : 0), guard, charm, gold_cost: gold, gold_left: sv.gold, stone_left: sv.stone, queued: !!this.enhQ });
    mission('enh'); if (!win) mission('fail'); sv.tut.forge = true;
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
      this.flashText(awake ? tt('lobby.2e1006', { v: from + 1, v2: an ? ` ${an[1]}` : '' }) : tt('lobby.7bbb23', { v: from + 1 }), '#ffd75e');
      if (from + 1 >= 10) this.bragEnh(from + 1);   // +10 이상 성공: 자랑하기
      // +8부터와 각성(+5 단위)은 화면을 번쩍이고 오른 공격력을 크게 띄운다
      if (from + 1 >= 8 || awake) {
        const tier = this.sv.tier, a0 = Math.round(D.weaponAtk(tier, from)), a1 = Math.round(D.weaponAtk(tier, from + 1));
        this.cameras.main.flash(220, 255, 220, 120);
        this.sparks(W / 2, 168, 30, 0xffffff);
        const t = this.add.text(W / 2, 222, tt('lobby.3fa514', { fmt: fmt(a0), fmt2: fmt(a1) }), font(18, '#ffe08a', 4)).setOrigin(0.5).setDepth(60).setScale(0.3);
        this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.Out' });
        this.tweens.add({ targets: t, y: 210, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
      }
    } else if (outcome === 'fail') {
      sfx('fail');
      sw.setTint?.(0x6a6a7a); this.time.delayedCall(400, () => sw.clearTint?.());
      this.tweens.add({ targets: sw, x: W / 2 + 4, duration: 45, yoyo: true, repeat: 4 });
      this.flashText(from >= D.DESTROY_FROM ? tt('lobby.0eefb0') : tt('lobby.1951f5'), '#a8a0c0');
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
      this.flashText(tt('lobby.c92607', { from, shatterTo: D.shatterTo(from) }), '#ff5050');
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
    c.add(this.add.text(W / 2, 164, t('lobby.34db2f', { from, shatterTo: D.shatterTo(from) }), font(14, '#ff5050')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 188, sv.guard > 0 ? t('lobby.b7c259') : t('lobby.8f31cf'), font9(11, '#f2e4bc')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 206, t('lobby.a63109', { guard: sv.guard }), font9(10, '#a1b2b6')).setOrigin(0.5));
    // 부서진 바로 그 자리에서만 되살릴 수 있다(창을 닫으면 끝)
    const rb = button(this, W / 2, 240, 190, 30, t('lobby.3f14ed', { from, back }), () => {
      track('shatter_restore_click', { from, enough: sv.gem >= back });
      if (sv.gem < back) { c.close(); this.shopPage = cashHidden() ? 'gem' : 'pack'; this.show('shop'); toast(this, t('lobby.60eef5'), '#ff9a8a'); return; }
      sv.gem -= back; sv.enh = from; sv.stats.destroyed--; save(); sfx('win'); c.close(); this.refreshTop(); this.show('forge'); toast(this, t('lobby.50781e', { from }), '#ffd75e');
    }, { size: 11, color: 0x2f6b3a });
    c.add([rb, gemIcon(this, W / 2 - 80, 240, 12)]);
    const bt = button(this, W / 2, 280, 190, 28, t('lobby.31f2b8', { cost }), () => {
      track('shatter_guard_click', { enough: sv.gem >= cost });
      if (sv.gem < cost) { c.close(); this.shopPage = cashHidden() ? 'gem' : 'pack'; this.show('shop'); toast(this, t('lobby.60eef5'), '#ff9a8a'); return; }
      sv.gem -= cost; sv.guard++; save(); sfx('buy'); c.close(); toast(this, t('lobby.99ad39'), '#9ae0ff');
    }, { size: 11, color: 0x3a3846 });
    c.add([bt, gemIcon(this, W / 2 - 80, 280, 12)]);
    c.add(button(this, W / 2, 322, 110, 24, t('lobby.0ad48e'), () => { track('shatter_offer_close', { from }); c.close(); }, { size: 10, color: 0x3a3846 }));
  }

  promote() {
    const sv = this.sv, cost = D.promoteGold(sv.tier), mk = D.markNeed(sv.tier + 1);
    if (this.busy || sv.gold < cost || sv.cleared < D.TIER_AT[sv.tier + 1] || (sv.mark | 0) < mk) return;
    this.busy = true;
    sv.gold -= cost; sv.mark = (sv.mark | 0) - mk; sv.enh = D.promoteEnh(sv.tier, sv.enh); sv.tier++; save(); this.refreshTop();
    track('promote', { tier: sv.tier, cost, mark: mk, cleared: sv.cleared });
    sfx('win');
    this.cameras.main.flash(400, 200, 160, 255);
    const p = this.add.sprite(W / 2, 214, 'fx2_r2s').setOrigin(0.5, 1).setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8a0ff).play('fxPillar');
    p.once('animationcomplete', () => p.destroy());
    this.sparks(W / 2, 168, 60, 0xc8a0ff);
    this.flashText(t('lobby.fb5943', { tierName: D.tierName(sv.tier, wtypeOf(sv)) }), '#c8a0ff');
    this.time.delayedCall(1400, () => { this.busy = false; this.show('forge'); });
  }

  // 대장간 → 도전 화면(증표 모으러). 전투 탭에서 도전 선택 화면을 연다
  goChallenge() {
    if (this.busy) return;
    sfx('click'); this.sv.tut.markGuide = true; save();
    this.tab = 'battle'; this.openModes();
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
    b.add(this.add.text(W / 2, 74, t('lobby.66d7bf', { TRAIN_MILE: D.TRAIN_MILE }), font9(10, '#a1b2b6')).setOrigin(0.5));
    // 한 줄에 이름·레벨 / 설명·지금 효과 두 덩어리만(Lv·효과·★·설명이 한 줄에 다 있어 빽빽했다)
    D.TRAINING.forEach((t, i) => {
      const lv = sv.train[t.id] || 0, max = lv >= t.max, cost = D.trainCost(t, lv);
      const y = 84 + i * 40;
      b.add(panel(this, 12, y, W - 24, 36, { fill: 0x1a1528 }));
      const nm = this.add.text(22, y + 5, t.name, font(11)); b.add(nm);
      const mile = t.max >= D.TRAIN_MILE && !max && lv % D.TRAIN_MILE === D.TRAIN_MILE - 1;
      b.add(this.add.text(28 + nm.width, y + 6, max ? tt('lobby.46c2b9', { lv }) : `Lv ${lv}${mile ? tt('lobby.41b358') : ''}`, font9(10, mile ? '#ffd75e' : '#a1b2b6')));
      const tvv = D.trainVal(t, lv), val = !lv ? '' : t.unit === '%' ? ` +${Math.round(tvv * 100)}%` : t.unit === 'once' ? '' : ` +${tvv.toFixed(1)}`;
      b.add(this.add.text(22, y + 20, t.desc + val, font9(10, '#a1b2b6')));
      const btn = button(this, W - 52, y + 18, 70, 26, max ? tt('lobby.869e9f') : fmt(cost), () => {
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
    if (!this.legacySkins) return cosmeticPage(this);
    this.legacySkinPage();
    this.body.add(button(this, 135, 429, 128, 18, t('lobby.3c81f8'), () => { this.legacySkins = false; this.show('shop'); }, { size: 9 }));
  }

  legacySkinPage() {
    const sv = this.sv, b = this.body, page = this.legacyTab ||= 'blade';
    [['blade', t('lobby.1e82f9')], ['hero', t('lobby.be8063')], ['weapon', t('lobby.8c4dac')]].forEach(([id, name], i) => {
      const x = 50 + i * 85, on = page === id;
      b.add(this.add.text(x, 84, name, font(11, on ? '#ffffff' : '#7d8f94')).setOrigin(0.5));
      if (on) b.add(this.add.rectangle(x, 95, 50, 2, 0xffffff));
      const hit = this.add.rectangle(x, 86, 80, 22, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { if (this.busy) return; this.legacyTab = id; sfx('click'); this.show('shop'); });
      b.add(hit);
    });
    // 한 칸: 미리보기 · 이름 · 효과 · 버튼
    const cell = (i, it, own, on, preview, onBuy) => {
      const x = 16 + (i % 2) * 122, y = 102 + Math.floor(i / 2) * 74, c = this.add.container(x, y); b.add(c);
      c.add(panel(this, 0, 0, 116, 68, { fill: on ? 0x2e2448 : COLOR.panel, line: on ? 0xffd75e : COLOR.line }));
      c.add(preview(20, 26));
      c.add(this.add.text(40, 6, it.name, font(10)));
      c.add(this.add.text(40, 21, it.desc, { ...font9(10, '#a1b2b6'), wordWrap: { width: 72 } }));
      const label = on ? t('lobby.776e59') : own ? t('lobby.2fdb4c') : `   ${it.cost}`;
      const bt = button(this, x + 58, y + 56, 104, 18, label, () => {
        if (this.busy || on) return;
        if (!own) {
          if (sv.gem < it.cost) { sfx('deny'); track('cosm_buy_fail', { item: it.id, kind: page, gem: sv.gem }); this.gemShort(it.cost); return; }
          sv.gem -= it.cost; track('cosm_buy', { item: it.id, kind: page, cost: it.cost }); sfx('buy'); toast(this, t('lobby.adcc86', { name: it.name }), '#ffd75e');
        } else sfx('click');
        onBuy(); save(); this.refreshTop(); this.show('shop');
      }, { size: 10, color: on ? 0x3b2f5c : own ? 0x3a3846 : 0x8a2f6a });
      b.add(bt);
      if (!own) b.add(gemIcon(this, x + 40, y + 56, 9));
    };
    const slash = sk => (x, y) => { const fx = this.add.sprite(x, y, 'fx1_r0s', 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5); return sk ? skinFx(fx, sk) : fx; };
    if (page === 'blade') {
      b.add(this.add.text(W / 2, 410, t('lobby.0c3c70'), font9(10, '#a1b2b6')).setOrigin(0.5));
      D.SKINS.forEach((sk, i) => {
        const own = !sk.id || sv.skins?.[sk.id], on = (sv.skin || '') === sk.id;
        cell(i, sk, own, on, slash(sk.id && sk), () => { (sv.skins ||= {})[sk.id] = true; sv.skin = sk.id; track('skin_equip', { skin: sk.id || 'none' }); });
      });
    } else if (page === 'hero') {
      b.add(this.add.text(W / 2, 410, t('lobby.d0f3b4'), font9(10, '#a1b2b6')).setOrigin(0.5));
      HERO_SKINS.forEach((hs, i) => {
        const own = !hs.id || sv.hskins?.[hs.id], on = (sv.hskin || '') === hs.id;
        cell(i, hs, own, on, (x, y) => { const h = this.add.sprite(x, y, 'hero2_r0s').play('idleL').setScale(0.8); return hs.id ? skinFx(h, hs) : h; },
          () => { (sv.hskins ||= {})[hs.id] = true; sv.hskin = hs.id; track('hskin_equip', { skin: hs.id || 'none' }); });
      });
    } else {
      b.add(this.add.text(W / 2, 410, t('lobby.2c522b', { v: CASH_W_DMG * 100 }), font9(10, '#a1b2b6')).setOrigin(0.5));
      WTYPES.forEach((w, i) => {
        const cw = CASH_W[w.id], own = !!sv.cw?.[w.id], on = own && sv.wtype === w.id;
        const it = { id: w.id, name: cw.name, desc: t('lobby.973b7f', { name: w.name, v: CASH_W_DMG * 100 }), cost: CASH_W_GEM };
        // 산 무기를 누르면 그 무기 종류로 바꿔 든다(해금 안 된 종류도 들 수 있다. 보스 무기 해금 보상은 따로 남는다)
        cell(i, it, own, on, slash(cw), () => { (sv.cw ||= {})[w.id] = true; sv.wtype = w.id; track('cashw_equip', { w: w.id, unlocked: hasW(sv, w.id) }); });
      });
    }
  }

  // ── 비급: 스킬을 사서 판 시작부터 들고 간다. 보석으로 비급 Lv을 올리면 시작 Lv도 오른다. 짝 스킬끼리는 시너지 ──
  bookPage() {
    const sv = this.sv, b = this.body;
    b.add(this.add.text(16, 76, t('lobby.e80d10', { bookSkillLv: D.bookSkillLv(1), bookSkillLv2: D.bookSkillLv(D.BOOK_MAX) }), font9(10, '#a1b2b6')));
    D.BOOKS.forEach((k, i) => {
      const def = D.SKILLS[k], lv = D.bookLv(sv, k), own = lv > 0, on = own && sv.book === k, max = lv >= D.BOOK_MAX;
      const x = 16 + (i % 2) * 122, y = 92 + Math.floor(i / 2) * 60, c = this.add.container(x, y); b.add(c);
      c.add(panel(this, 0, 0, 116, 56, { fill: on ? 0x2e2448 : COLOR.panel, line: on ? 0xffd75e : COLOR.line }));
      c.add(skillIcon(this, 18, 18, def, 22));
      c.add(this.add.text(34, 5, def.name, font(10)));
      // 산 비급은 판 시작 Lv, 안 산 건 설명 한 줄
      c.add(own ? this.add.text(34, 21, t('lobby.dfecef', { bookSkillLv: D.bookSkillLv(lv), lv, BOOK_MAX: D.BOOK_MAX }), font9(9, max ? '#ffd75e' : '#9ae0ff'))
        : this.add.text(34, 21, BOOK_SHORT[k] || def.desc[0], font9(9, '#a1b2b6')));
      const buyLv = async cost => {
        if (sv.gem < cost) { sfx('deny'); track('book_buy_fail', { skill: k, lv: lv + 1, gem: sv.gem }); this.gemShort(cost); return false; }
        sv.gem -= cost; (sv.books ||= {})[k] = lv + 1; track(own ? 'book_up' : 'book_buy', { skill: k, lv: lv + 1, cost }); sfx('buy');
        toast(this, own ? t('lobby.805826', { name: def.name, v: lv + 1, bookSkillLv: D.bookSkillLv(lv + 1) }) : t('lobby.24ddcd', { name: def.name }), '#ffd75e');
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
      b.add(button(this, x + 28, y + 44, 48, 16, on ? t('lobby.776e59') : t('lobby.2fdb4c'), () => {
        if (this.busy || on) return;
        sfx('click'); sv.book = k; save(); this.show('shop');
      }, { size: 9, color: on ? 0x3b2f5c : 0x2f6b3a }));
      const cost = D.BOOK_COST[lv];
      const up = button(this, x + 85, y + 44, 54, 16, max ? t('lobby.869e9f') : `  ${cost}`, async () => {
        if (this.busy || max || !(await buyLv(cost))) return;
        save(); this.refreshTop(); this.show('shop');
      }, { size: 9, color: 0x8a2f6a });
      up.setEnabled(!max); b.add(up);
      if (!max) b.add(gemIcon(this, x + 70, y + 44, 8));
    });
    b.add(this.add.text(16, 338, t('lobby.03bf39'), font(10, '#ffb050')));
    D.SYNERGY.forEach((x, i) => { const st = this.add.text(16, 356 + i * 14, `${x.name}: ${D.SKILLS[x.a].name}+${D.SKILLS[x.b].name}`, font9(9, '#a1b2b6')); st.setScale(Math.min(1, (W - 32) / st.width)); b.add(st); });   // 55차: 한 줄씩(영어에서 두 칸이 겹쳤다)
  }

  // ── 특가: 오늘의 특가(하루 한 번 무작위 할인) · 성장 꾸러미(장 보스 첫 처치 뒤 24시간) · 큰 꾸러미(달마다 한 번) ──
  dealPage() {
    const sv = this.sv, deal = todayDeal(sv), grow = growOffer(sv);
    let b = this.body;   // 53차: 접는 칸 아래 꾸러미는 b를 접이식 묶음으로 바꿔 그린다(아래 buyBtn 등이 b를 따라간다)
    const after = it => { this.refreshTop(); this.bump(4); toast(this, t('lobby.d19e31', { name: it.name }), '#ffd75e'); this.show('shop'); };
    const buyBtn = (x, y, it, sold, ghost = true) => {   // 한 화면에 채운 주황은 오늘의 특가 하나만(49차)
      const bt = button(this, x, y, 64, 26, sold ? t('lobby.b83fab') : priceLabel(it), async () => {
        if (this.busy || sold) return;
        this.busy = true;
        const ok = await buy(this, sv, it);
        this.busy = false;
        if (ok && this.scene.isActive()) after(it);
      }, { size: 10, color: 0x2f6b3a, ghost });
      bt.setEnabled(!sold); b.add(bt);
    };
    // 줄바꿈이 '금화 / 1,580'처럼 항목 안에서 끊기지 않게 항목 안 띄어쓰기는 붙인다
    const nb = t => t.split(' · ').map(x => x.replace(/ /g, '\u00a0')).join(' · ');
    const timer = (y, f) => { const t = this.add.text(W - 16, y, f(), font9(10, '#ff9a8a')).setOrigin(1, 0); b.add(t); this.ticks.push({ t, f }); };
    // 오늘의 특가
    track('view_item_list', { item_list_id: 'deal', items: [deal.id, grow?.id].filter(Boolean).join(','), gem: sv.gem });
    b.add(this.add.text(16, 74, t('lobby.34d5dd'), font(12, '#ffd75e')));
    timer(77, () => t('lobby.6d1861', { leftText: leftText(msToMidnight()) }));
    const day = sv.deal.day; this.ticks.push({ redraw: () => String(kstDay()) !== day });
    b.add(panel(this, 12, 92, W - 24, 78, { line: deal.got ? COLOR.line : 0xffd75e }));
    b.add(this.add.rectangle(42, 131, 48, 48, 0x8a2f3a).setStrokeStyle(1, 0xff9a8a));
    b.add(this.add.text(42, 124, `-${deal.off}%`, font(13, '#ffffff')).setOrigin(0.5));
    b.add(this.add.text(42, 140, t('lobby.a99a39'), font9(10, '#ffd0d0')).setOrigin(0.5));
    const dn = this.add.text(76, 98, deal.name, font(12, '#ffffff')); b.add(dn);
    b.add(this.add.text(76 + dn.width + 6, 101, t('lobby.67f39e'), font9(10, '#ff9ad0')));   // 49차: 가격 버튼에 가려지던 문구를 이름 줄로
    b.add(this.add.text(76, 116, nb(giveText(deal.give, sv)), { ...font9(10, '#f2e4bc'), wordWrap: { width: W - 100 } }));
    // 46차: 원가는 보석 상점에서 실제로 파는 구성품 합계(상시 판매가)가 있을 때만 긋는다
    const wasLabel = deal.base ? priceLabel(deal, deal.base) : '';
    const was = wasLabel ? this.add.text(76, 150, t('lobby.6af491', { won: wasLabel }), font9(10, '#a1b2b6')) : null;
    if (was) { b.add(was); b.add(this.add.rectangle(76, 157, was.width, 1, 0xa1b2b6).setOrigin(0, 0.5)); }
    buyBtn(W - 52, 154, deal, deal.got, false);
    // 53차: 오늘의 특가만 크게 두고 나머지 꾸러미(성장·큰 꾸러미)는 접는다. 목록은 그대로 남아 있다
    const moreN = (grow ? 1 : 0) + (sv.cleared < 2 * D.STAGES_PER_CHAPTER ? 1 : D.BIG_PACKS.length);
    const open = !!this.dealMore;
    b.add(button(this, W / 2, 190, W - 24, 22, open ? t('lobby.61eaf1') : t('lobby.60517d', { moreN }), () => { sfx('click'); this.dealMore = !open; track('deal_more', { open: !open }); this.show('shop'); }, { size: 10, color: 0x293845 }));
    if (!open) return;
    const sec = this.add.container(0, 26); this.body.add(sec); b = sec;
    // 성장 꾸러미
    b.add(this.add.text(16, 180, t('lobby.be1a56'), font(12, '#9ae0ff')));
    if (grow) {
      timer(183, () => t('lobby.6d1861', { leftText: leftText(growLeft(sv)) }));
      this.ticks.push({ redraw: () => growLeft(sv) <= 0 });
      b.add(panel(this, 12, 198, W - 24, 52, { line: 0x9ae0ff }));
      b.add(icon(this, 30, 224, 13, 20));
      b.add(this.add.text(46, 203, grow.name, font(11, '#9ae0ff')));
      b.add(this.add.text(46, 219, nb(giveText(grow.give, sv)), { ...font9(9, '#f2e4bc'), wordWrap: { width: W - 136 } }));
      buyBtn(W - 52, 224, grow, false);
    } else {
      b.add(panel(this, 12, 198, W - 24, 52, { fill: 0x0b111a }));
      b.add(this.add.text(W / 2, 224, t('lobby.911815'), { ...font9(10, '#a1b2b6'), align: 'center' }).setOrigin(0.5));
    }
    // 큰 꾸러미(달마다 한 번): 3장에 들어선 뒤에만 보인다(2-2·플레이 20분에 33,000원이 보이면 이르다, 37차)
    if (sv.cleared < 2 * D.STAGES_PER_CHAPTER) {
      // 큰 꾸러미가 열리기 전엔 아래가 비어 있었다(40차): 초보 꾸러미를 추천 칸으로 올린다. 사면 패키지 칸으로 안내만
      const st = D.IAP.find(x => x.id === 'starter'), sold = soldOut(sv, st);
      b.add(this.add.text(16, 262, t('lobby.4b0ea2'), font(12, '#ffb85c')));
      b.add(panel(this, 12, 280, W - 24, 66, { line: sold ? COLOR.line : 0xffb85c }));
      b.add(gemIcon(this, 30, 313, 18));
      b.add(this.add.text(46, 284, st.name, font(11, '#ffb85c')));
      // 설명은 '·'를 붙여 써서 줄이 안 바뀌고 버튼까지 넘쳤다: 띄워서 끊기게 한다
      const dt = this.add.text(46, 299, nb(st.desc.replace(/·/g, ' · ')), { ...font9(9, '#f2e4bc'), wordWrap: { width: W - 136 } }); b.add(dt);
      b.add(this.add.text(46, 301 + dt.height, sold ? t('lobby.f88db7') : st.tag, font9(9, '#a1b2b6')));
      buyBtn(W - 52, 313, st, sold);
      return;
    }
    b.add(this.add.text(16, 254, t('lobby.ed3669'), font(12, '#ffb050')));
    b.add(this.add.text(W - 16, 257, t('lobby.401227'), font9(9, '#7d8f94')).setOrigin(1, 0));
    D.BIG_PACKS.forEach((it, i) => {
      const y = 270 + i * 54, sold = soldOut(sv, it);   // 49차: 꾸러미가 셋으로 늘어 한 칸을 50으로 줄인다
      b.add(panel(this, 12, y, W - 24, 50, { line: sold ? COLOR.line : 0xffb050 }));
      b.add(gemIcon(this, 30, y + 25, 16));
      b.add(this.add.text(46, y + 1, it.name, font(10, '#ffb050')));
      const dt = this.add.text(46, y + 14, nb(it.desc), { ...font9(9, '#f2e4bc'), wordWrap: { width: W - 136 } }); b.add(dt);
      for (const k of [0.85, 0.75, 0.65]) if (dt.displayHeight > 23) { dt.setScale(k).setWordWrapWidth((W - 136) / k); }   // 55차: 영어에서 석 줄이 되면 줄여 두 줄에 담는다
      { const tg = this.add.text(46, y + 38, sold ? t('lobby.474c86') : it.tag, font9(9, '#ff9ad0')); tg.setScale(Math.min(1, 134 / tg.width)); b.add(tg); }
      buyBtn(W - 52, y + 25, it, sold);
    });
  }

  // ── 상점 탭: 보석으로 사기·광고 보상 / 패키지(결제) ──
  shopTab() {
    const sv = this.sv, b = this.body, cashOff = cashHidden(), page = (cashOff && (!this.shopPage || this.shopPage === 'deal' || this.shopPage === 'pack')) ? 'gem' : (this.shopPage || 'deal');   // 맨 앞 칸은 특가
    const sub = (x, id, name) => {
      const bt = button(this, x, 54, 50, 24, name, () => { this.shopPage = id; track('shop_page', { page: id, gem: sv.gem }); this.show('shop'); }, { size: 11, color: page === id ? 0x7a5a1a : id === 'deal' ? 0x5a2a3a : 0x2a2440 });
      b.add(bt);
      // 특가 칸: 오늘 특가를 안 샀거나 성장 꾸러미가 열려 있으면 빨간 점
      if (id === 'deal' && !cashOff && (growOffer(sv) || !todayDeal(sv).got)) b.add(this.add.circle(x + 21, 45, 3.5, 0xff3a3a));
    };
    const pages = [['deal', t('lobby.d13f0b')], ['gem', t('lobby.1fed91')], ['skin', t('lobby.c75e2d')], ['book', t('lobby.e56a7a')], ['pack', t('lobby.da2e67')]].filter(([id]) => !(cashOff && (id === 'deal' || id === 'pack')));
    pages.forEach(([id, name], i) => sub(cashOff ? 56 + i * 79 : 32 + i * 51.5, id, name));   // 포털판은 특가·패키지 칸이 없다
    if (page === 'deal') return this.dealPage();
    if (page === 'skin') return this.skinPage();
    if (page === 'book') return this.bookPage();
    const after = msg => { this.refreshTop(); this.bump(4); toast(this, msg, '#ffd75e'); this.show('shop'); };
    if (page === 'gem') {
      b.add(this.add.text(16, 76, t('lobby.eab7d0'), font(11, '#ff9ad0')));
      // 파괴 구간(+10)에 닿기 전엔 방지권을 맨 뒤로 민다
      const far = sv.tier === 0 && sv.enh < D.DESTROY_FROM - 2;
      D.GEM_SHOP.slice().sort((a, c) => far ? (a.id === 'guard') - (c.id === 'guard') : 0).forEach((it, i) => {
        const x = 16 + (i % 2) * 122, y = 92 + Math.floor(i / 2) * 56;
        const c = this.add.container(x, y); b.add(c);
        c.add(panel(this, 0, 0, 116, 52));
        c.add(icon(this, 18, 22, it.icon, 22));
        const gn = this.add.text(34, 5, it.name, font(10)); gn.setScale(Math.min(1, 78 / gn.width)); c.add(gn);   // 55차: 긴 이름은 칸 폭에 맞춘다
        const gd = this.add.text(34, 20, it.desc || giveText(it.give, this.sv), font9(10, '#a1b2b6')); gd.setScale(Math.min(1, 78 / gd.width)); c.add(gd);   // 이름을 되풀이하지 않고 쓰임새를 적는다
        const ok = sv.gem >= it.cost;
        c.add(gemIcon(this, 40, 41, 10));
        c.add(this.add.text(50, 34, String(it.cost), font(10, ok ? '#ff9ad0' : '#7a5a6a')));
        const z = this.add.zone(x, y, 116, 52).setOrigin(0).setInteractive({ useHandCursor: true }); b.add(z);
        z.on('pointerup', () => {
          if (this.busy) return;
          if (sv.gem < it.cost) { sfx('deny'); track('gem_shop_fail', { item: it.id, gem: sv.gem }); this.gemShort(it.cost); return; }
          sv.gem -= it.cost; grant(sv, it.give); sfx('buy'); track('gem_shop_buy', { item: it.id, cost: it.cost, gem_left: sv.gem });
          after(t('lobby.2186d6', { name: it.name }));
        });
      });
      b.add(this.add.text(16, 262, adWord(t('lobby.e4b459'), t('lobby.65d48b')), font(11, '#9ae0ff')));
      Object.entries(D.ADS).filter(([k]) => k !== 'double').forEach(([k, ad], i) => {
        const y = 296 + i * 40, left = adsLeft(sv, k);
        b.add(panel(this, 16, y - 18, W - 32, 36));
        b.add(this.add.text(28, y - 14, ad.name, font(11)));
        b.add(this.add.text(28, y + 1, left ? (adsDaily(sv, k) > ad.daily ? t('lobby.217972', { adsDaily: adsDaily(sv, k), left }) : t('lobby.0ed640', { left })) : t('lobby.07f3b9'), font9(10, left ? '#a1b2b6' : '#7d8f94')));
        const bt = button(this, W - 52, y, 64, 24, !left ? t('lobby.ad95f2') : sv.noAds ? t('lobby.98d0f0') : adWord(t('lobby.76dfd6'), t('lobby.98d0f0')), async () => {
          if (this.busy || adsLeft(sv, k) <= 0) return;
          this.busy = true;
          const ok = await showAd(this, sv, k);
          this.busy = false;
          if (!ok || !this.scene.isActive()) return;
          sv.ads[k] = (sv.ads[k] || 0) + 1; grant(sv, ad.give);
          track('ad_reward', { kind: k, n: sv.ads[k] });
          after(t('lobby.9a8193', { name: ad.name }));
        }, { size: 10, color: 0x2f6b3a, ghost: i > 0 });   // 49차: 광고 버튼은 첫 줄만 채운 주황, 나머지는 테두리형
        bt.setEnabled(left > 0); b.add(bt);
      });
      const info = [t('lobby.46f8b4', { daily: D.GEM_FREE.daily }), t('lobby.fcaf90', { stageFirst: D.GEM_FREE.stageFirst, bossFirst: D.GEM_FREE.bossFirst })];
      if (sv.passLeft > 0) info.push(t('lobby.cba420', { passLeft: sv.passLeft, gem: D.PASS_DAILY.gem }));
      info.forEach((t, i) => b.add(this.add.text(W / 2, 366 + i * 15, t, font9(10, i === 2 ? '#ffd75e' : '#a1b2b6')).setOrigin(0.5)));
      return;
    }
    // 패키지
    track('view_item_list', { item_list_id: 'pack', items: D.IAP.filter(it => !soldOut(sv, it)).map(it => it.id).join(','), gem: sv.gem });
    // 48차: 패키지를 보석 / 꾸러미 / 정기로 나눈다
    const grp = this.packSub && D.PACK_GROUPS[this.packSub] ? this.packSub : 'gem';
    [['gem', t('lobby.1fed91')], ['bundle', t('lobby.bd7e72')], ['sub', t('lobby.10a191')]].forEach(([id, name], i) => b.add(button(this, 52 + i * 83, 86, 78, 22, name, () => { this.packSub = id; track('pack_sub', { sub: id }); this.show('shop'); }, { size: 10, color: grp === id ? 0x7a5a1a : 0x2a2440 })));
    const list = D.PACK_GROUPS[grp].map(id => D.IAP.find(x => x.id === id)).filter(Boolean);
    // 49차: 한 화면에 채운 주황 버튼은 하나만. 보석은 gem2, 꾸러미는 안 산 첫 항목, 정기는 월정액이 추천이고 나머지는 테두리형
    const main = grp === 'gem' ? 'gem2' : (list.find(x => !soldOut(sv, x)) || list[0] || {}).id;
    list.forEach((it, i) => {
      const y = 100 + i * 50, sold = soldOut(sv, it);
      const hot = it.id === 'starter' || it.id === 'pass' || it.id === 'cosm';
      b.add(panel(this, 12, y, W - 24, 46, { line: hot && !sold ? 0xffd75e : COLOR.line }));
      b.add(gemIcon(this, 30, y + 23, 18));
      b.add(this.add.text(46, y + 5, it.name, font(11, hot ? '#ffd75e' : '#ffffff')));
      { const ds = this.add.text(46, y + 20, it.desc || giveText(it.give) + (it.passDays ? t('lobby.d0b2c6', { gem: D.PASS_DAILY.gem }) : '') + (it.noAds ? t('lobby.a92d94') : ''), font9(it.desc ? 8 : 9, '#f2e4bc')); ds.setScale(Math.min(1, (W - 46 - 70) / ds.width)); b.add(ds); }   // 55차: 버튼 밑으로 깔리지 않게 폭에 맞춤
      const tag = it.id === 'pass' && sv.passLeft > 0 ? t('lobby.5661ab', { passLeft: sv.passLeft }) : [iapTag(it), firstX2(sv, it) && t('lobby.788a4a')].filter(Boolean).join(' · ');
      if (tag) { const tg = this.add.text(46, y + 32, tag, font9(9, firstX2(sv, it) ? '#ffd75e' : '#ff9ad0')); tg.setScale(Math.min(1, (W - 46 - 70) / tg.width)); b.add(tg); }
      const bt = button(this, W - 46, y + 23, 60, 26, sold ? t('lobby.b83fab') : priceLabel(it), async () => {
        if (this.busy || sold) return;
        this.busy = true;
        const ok = await buy(this, sv, it);
        this.busy = false;
        if (ok && this.scene.isActive()) after(t('lobby.d19e31', { name: it.name }));
      }, { size: 9, color: 0x2f6b3a, ghost: it.id !== main });
      bt.setEnabled(!sold); b.add(bt);
    });
  }
}

const RF = Phaser.Math.FloatBetween;
Object.assign(Lobby.prototype, GearTab, ContentTab, ModeScreen);
