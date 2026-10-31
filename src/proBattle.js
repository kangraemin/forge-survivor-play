// 첫 실행 프롤로그의 전투(직접 하는 1분 30초). Battle.js가 this.pro 가드로 부른다.
//  - 풀템(+20 최강 무기·최강 펫·최강 장비)·스킬 여러 개 보유로 시작. 레벨업 때 '한 번만 더 고르면 MAX'인 스킬이 나온다
//  - 약 90초 일반 구간은 죽지 않고, 그 뒤 15장 마지막 보스(PROLOGUE_BOSS 그림)가 나와 절대 못 잡고 확실히 죽는다 → Prologue.js의 'after'(무기 파괴·부활 컷신)로 이어진다
//  - 데이터 보호: 이 판의 저장 상태는 메모리 모래판(save.js sandboxBegin)에서만 쓰인다. 진짜 저장에는 Prologue.js가 '봤음' 하나만 적는다
import * as D from './data.js';
import { fresh } from './saveCore.js';
import { applyPreset, setWeapon } from './testPresets.js';
import { PET_MAX, RARITY } from './gear.js';
import { sandboxEnd } from './save.js';
import { sfx } from './sfx.js';
import { font, button, viewRect } from './ui.js';
import { track } from './log.js';
import { t } from './i18n.js';
import { insetsGame } from './safeArea.js';
import { BossAI } from './boss.js';
const R = Phaser.Math.Between, RF = Phaser.Math.FloatBetween;

export const PRO_PLAY_MS = 90000;        // 일반 구간 길이(전투 시간, 카드 고르는 시간은 안 센다)
export const PRO_LV_MS = 11500;          // 레벨업 간격
export const PRO_FIRST_LV_MS = 6500;     // 첫 레벨업은 빨리(10초 안에 '내가 강해진다'를 보인다)
export const PRO_SKILLS = { sword: 4, spin: 4, bolt: 4, fireball: 3, might: 3, haste: 4, area: 3, magnet: 2 };   // 액티브·패시브 슬롯이 꽉 찬 채 시작: 카드는 전부 지금 가진 걸 올린다
const KEEP = ['lang', 'sound', 'musicOff', 'musicLvl', 'vibOff', 'fxLite', 'bagAuto'];
const MAXC = RARITY[4].color;
const WEAPON_ICON = 'w_axe9';
const GEAR_ICONS = ['gs_helm', 'gs_armor', 'gs_boots', 'gs_ring', 'gs_collar'];

// 모래판 저장: 진짜 저장은 건드리지 않는 새 객체(설정 몇 개만 복사)
export function makeProSv(real) {
  const sv = fresh();
  applyPreset(sv, 'c15');                          // 15장 클리어 상태: 최강 장비(전설 5부위)·훈련·도끼
  setWeapon(sv, 'axe');
  sv.tier = D.TIERS.length - 1; sv.enh = D.ENH_MAX;
  sv.pets = { thunderdragon: PET_MAX }; sv.pet = 'thunderdragon';
  for (const tr of D.TRAINING) sv.train[tr.id] = tr.max;
  sv.train.revive = 0;                             // 부활로 판이 이어지지 않게
  sv.stats.runs = 9; sv.tut.ult = true; sv.book = null;
  sv.cleared = 45; sv.prologue = 1;
  for (const k of KEEP) if (real?.[k] !== undefined) sv[k] = real[k];
  return sv;
}

export function proState(data) {
  return { replay: !!data.replay, phase: 'play', t: 0, pt: 0, lvT: 0, sched: [], done: false };
}

// ── 시작 ──
export function proSetup(s) {
  const P = s.pro, r = s.run;
  s.waveCount = 1; s.waveLen = PRO_PLAY_MS; s.waveT = 0;
  // 몹은 한두 번에 쓰러지고(쓸어버리는 맛), 닿아도 체력의 2~3%만 깎는다
  s.mobHpMul = Math.max(1, s.atk * s.wM * 0.45 / 20);
  s.mobDmgMul = s.maxHp * 0.025 / 7;
  s.xpMul = 0.08;                                   // 구슬은 막대를 조금만 올린다. 레벨업은 시간으로(proTick)
  r.skills = { ...PRO_SKILLS }; r.evo = {}; r.lv = 6; r.xp = D.xpNeed(6, false) * (1 - PRO_FIRST_LV_MS / PRO_LV_MS); r.revive = 0; r.freeReroll = 0; r.banLeft = 0;
  P.t0 = 0;
}

export function proIntro(s) {
  const ins = insetsGame(s.game);
  s.banner(t('prologue.introT'), t('prologue.introS'));
  // 풀템 표시: 무기 +20과 최강 장비 다섯 칸
  const y0 = 70 + ins.top, F = o => { o.setScrollFactor(0).setDepth(100); return o; };
  const badge = [];
  if (s.textures.exists(WEAPON_ICON)) badge.push(F(s.add.image(16, y0 + 8, WEAPON_ICON).setScale(0.5)));
  const enh = F(s.add.text(32, y0 + 8, '+20', font(13, '#ffd75e')).setOrigin(0, 0.5)); badge.push(enh);
  GEAR_ICONS.forEach((k, i) => { if (s.textures.exists(k)) badge.push(F(s.add.image(66 + i * 14, y0 + 8, k).setTint(MAXC).setScale(0.8))); });
  s.proBadge = badge;
  // 건너뛰기(왼쪽 아래)는 설정의 '다시 보기'에서만. 처음엔 끝까지 직접 한다(사용자 10/31)
  if (s.pro.replay) { s.proSkipBtn = button(s, 38, D.H - 26 - ins.bottom, 62, 20, t('coach.88130a'), () => proSkip(s), { size: 10 }); s.proSkipBtn.setScrollFactor(0).setDepth(100); }
}

export function proSkip(s) {
  const P = s.pro; if (P.done) return;
  P.done = true; s.over = true; sfx('click');
  sandboxEnd();
  s.scene.start('Prologue', { phase: 'skip', replay: P.replay, at: Math.round(s.bt / 1000), part: P.phase, lv: s.run.lv });
}

// ── 피격·드롭 ──
export function proHurt(s, d) {
  const P = s.pro;
  if (P.phase === 'play') return Math.max(1, Math.min(d, Math.floor(s.hp - s.maxHp * 0.25)));   // 일반 구간엔 체력이 25% 밑으로 안 간다
  if (P.killed) return 0;   // 보스를 잡은 뒤엔 무너지는 성만 주인공을 쓰러뜨린다
  // 보스 공격·몸통 박치기는 한 대 맞으면 GRACE 동안 다시 안 맞는다(장판이 무적을 뚫고 몸통 피해와 한 프레임에 겹쳐 두 대씩 맞던 것)
  if (s.bt < (P.graceT || 0)) return 0;
  P.graceT = s.bt + GRACE;
  return d;
}
export function proDrop(s, m) {
  s.addGem(m.x, m.y, m.elite ? 10 : 1);
  if (Math.random() < 0.012) s.addItem(m.x, m.y, 'meat');
  else if (Math.random() < 0.01) s.addItem(m.x, m.y, 'magnetItem');
}

// ── 레벨업 연출 ──
// 스킬이 MAX가 됐다: 금빛 번쩍임·퍼지는 고리·큰 글자
export function proMaxFx(s, k) {
  const h = s.hero, name = D.SKILLS[k].name;
  sfx('ult'); sfx('success');
  s.cameras.main.flash(260, 255, 230, 140); s.cameras.main.shake(260, 0.006);
  for (let i = 0; i < 3; i++) {
    const ring = s.add.image(h.x, h.y + 10, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(i === 1 ? 0xffffff : 0xffd75e).setScale(0.3).setDepth(60);
    s.tweens.add({ targets: ring, scale: 5 + i * 1.5, alpha: 0, duration: 650 + i * 150, delay: i * 120, onComplete: () => ring.destroy() });
  }
  const sp = s.add.sprite(h.x, h.y - 10, 'fx2_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(60).setTint(0xffd070).setScale(3.6).play('fxSpin');
  sp.once('animationcomplete', () => sp.destroy());
  s.spark.explode(36, h.x, h.y);
  const tx = s.add.text(h.x, h.y - 40, 'MAX!', font(26, '#ffd75e', 5)).setOrigin(0.5).setDepth(62).setScale(0.3);
  s.tweens.add({ targets: tx, scale: 1.25, duration: 260, ease: 'Back.Out', onComplete: () => s.tweens.add({ targets: tx, y: tx.y - 34, alpha: 0, duration: 700, delay: 350, onComplete: () => tx.destroy() }) });
  s.banner(t('prologue.maxT', { name }), t('prologue.maxS'));
}
// 진화: 더 크게 — 하얀 섬광, 고리 다섯, 불꽃
export function proEvoFx(s, base) {
  const h = s.hero;
  sfx('ult'); sfx('bossIn');
  s.cameras.main.flash(420, 255, 255, 255); s.cameras.main.shake(520, 0.012);
  for (let i = 0; i < 5; i++) {
    const ring = s.add.image(h.x, h.y + 10, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint([0xffd75e, 0xff9a3a, 0xffffff, 0xff5a3a, 0xffd75e][i]).setScale(0.3).setDepth(60);
    s.tweens.add({ targets: ring, scale: 5 + i * 1.8, alpha: 0, duration: 700 + i * 160, delay: i * 110, onComplete: () => ring.destroy() });
  }
  const sp = s.add.sprite(h.x, h.y - 10, 'fx2_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(60).setTint(0xff9a3a).setScale(5.5).play('fxSpin');
  sp.once('animationcomplete', () => sp.destroy());
  s.spark.explode(60, h.x, h.y);
  const tx = s.add.text(h.x, h.y - 44, t('prologue.evoT'), font(24, '#ff9a3a', 5)).setOrigin(0.5).setDepth(62).setScale(0.3);
  s.tweens.add({ targets: tx, scale: 1.2, duration: 300, ease: 'Back.Out', onComplete: () => s.tweens.add({ targets: tx, y: tx.y - 40, alpha: 0, duration: 800, delay: 500, onComplete: () => tx.destroy() }) });
}

// ── 매 프레임 ──
export function proTick(s, dt) {
  const P = s.pro, r = s.run;
  if (P.done) return;
  if (P.phase === 'play') {
    P.t += dt; s.waveT = Math.min(P.t, PRO_PLAY_MS - 1);
    const f = s.progress();
    // 몹: 화면이 미어터진다(초당 6~13마리, 동시 최대 90). 풀템이라 쏟아지는 족족 쓸린다
    s.spawnAcc = (s.spawnAcc || 0) + dt * (6 + 7 * f) / 1000;
    const cap = Math.min(90, 40 + P.t / 1000 * 1.2);
    while (s.spawnAcc >= 1) { s.spawnAcc--; if (s.mobs.countActive() < cap) s.spawn(); }
    if ((P.eT = (P.eT || 0) + dt) > 9000) { P.eT = 0; for (let i = 0; i < 2; i++) s.spawn(false, s.ch.mobs[R(0, 2)], { elite: true, force: true }); }
    if (!P.ring && P.t > PRO_PLAY_MS * 0.58) { P.ring = true; s.encircle(); }
    if ((P.fT = (P.fT || 0) + dt) > 10000) { P.fT = 0; s.formation(); }
    swarmTick(s, dt);
    // 체력: 천천히 차오른다(일반 구간은 죽지 않는다)
    s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.012 * dt / 1000);
    // 레벨업: 시간으로 (구슬은 거들 뿐). 보스 직전 3.5초는 카드를 열지 않는다
    const need = D.xpNeed(r.lv, false);
    if (P.t < PRO_PLAY_MS - 3500) {
      r.xp += dt * need / PRO_LV_MS;
      if (r.xp >= need) { r.xp -= need; r.lv++; s.lvTxt.setText('Lv ' + r.lv); s.ui.levelUp(); }
    }
    if (P.t >= PRO_PLAY_MS) bossIn(s);
  } else {
    P.pt += dt;
    bossTick(s, dt);
  }
}

// ── 보스 떼: 중간보스·이전 장 보스가 줄줄이 내려오고 몇 초 만에 터진다(타격감) ──
const SWARM = [...new Set(D.CHAPTERS.slice(0, 14).flatMap(c => [c.mid, c.boss]).filter(k => k && D.BOSSES[k]))];
function swarmTick(s, dt) {
  const P = s.pro;
  P.bosses = (P.bosses || []).filter(b => b.m.active && !b.m.dead);
  P.bosses.forEach(b => b.update(dt));
  if (P.t < 6000 || P.t > PRO_PLAY_MS - 5000) return;
  if ((P.sT = (P.sT || 0) - dt) > 0 || P.bosses.length >= 4) return;
  P.sT = R(3200, 5200) * (P.t < 30000 ? 1.3 : 1);
  const n = P.t > 50000 && Math.random() < 0.5 ? 2 : 1;
  for (let i = 0; i < n; i++) swarmBoss(s, SWARM[(P.si = (P.si ?? R(0, SWARM.length - 1)) + 1) % SWARM.length]);
}
function swarmBoss(s, key) {
  const b = new BossAI(s, key, 1, true, true);
  b.bar?.forEach(o => o.destroy()); b.bar = null;   // 위쪽 체력 막대는 마지막 보스 몫
  b.holdFloor = b.fit = () => {};                    // 버티기·체력 맞춤 없이 그냥 맞고 터진다
  const dps = s.realDps?.() || 0;
  b.m.maxHp = b.m.hp = Math.max(s.atk * s.wM * 20, dps * RF(2.5, 4));   // 2.5~4초면 터진다
  b.m.setScale(b.m.scaleX * 0.85);
  s.pro.bosses.push(b);
  sfx('bossIn');
}

// ── 보스 ──
// 10/31: 보스 체력은 진짜로 줄어든다. 체력이 줄수록 공격이 거세진다(2/3 난사 → 1/3 화면 전체 → 마지막 거의 즉사기).
// 피할 틈은 늘 남기지만 피해가 커서 신컨만 버틴다(목표: 1% 미만). 잡으면 성이 무너져 어차피 쓰러지고, 그 대신 금화·마왕의 목걸이를 받는다
const LAND = 2300;     // 경고 시작 → 착지
const KILL_T = 120000;  // 붙어서 계속 때리면 이 정도에 잡힌다(착지 5초 뒤 실제 피해로 체력을 맞춘다)
const MIN_T = 105000;  // 이보다 빨리는 못 잡는다(단계를 건너뛰지 못하게)
const CAP = 150000;    // 이때까지 못 잡으면 피할 수 없는 마지막 공격
const HIT = [0, 0.1, 0.07, 0.06, 0.6];   // 단계별 한 대 피해(최대 체력 비율). 4단계는 두 대면 쓰러진다. 싸움이 2분이라 1~3단계는 몇 번 실수해도 버티게
const GRACE = 700;   // 한 대 맞으면 이만큼은 보스 공격에 다시 안 맞는다(겹친 장판 두 개에 한꺼번에 맞던 것)

function bossIn(s) {
  const P = s.pro, h = s.hero;
  P.phase = 'boss'; P.pt = 0; s.xpMul = 0;
  s.hp = s.maxHp;
  sfx('warn'); s.time.delayedCall(450, () => sfx('boom'));
  s.cameras.main.shake(LAND, 0.006);
  // 남은 몹은 흩어지고 구슬은 끌려온다
  s.mobs.getChildren().slice().forEach(m => { if (m.isBoss || m.dead) return; m.dead = true; m.body.enable = false; s.tweens.add({ targets: m, alpha: 0, scale: 0.3, duration: 250, onComplete: () => m.destroy() }); });
  s.ebullets.clear(true, true);
  (P.bosses || []).forEach((b, i) => s.time.delayedCall(i * 120, () => b.m.active && !b.m.dead && b.die())); P.bosses = [];
  s.gems.getChildren().forEach(g => { g.pull = true; });
  const red = s.add.rectangle(0, 0, D.GW, D.H, 0xff1a10, 1).setOrigin(0).setScrollFactor(0).setDepth(58).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  red.wideFx = true; P.red = red;
  s.tweens.add({ targets: red, alpha: 0.2, duration: 400, yoyo: true, repeat: 5 });
  shout(s, t('prologue.warn'), '#ff6a5a');
  s.hitstop = 0;
  track('prologue_boss', { t: Math.round(s.bt / 1000), lv: s.run.lv });
  // 맵 끝에서 보스를 만나면 화면 반쪽이 맵 밖이라 갈 곳이 없다: 경고 동안 주인공을 안쪽으로 옮긴다
  const wb = s.physics.world.bounds, cx = Phaser.Math.Clamp(h.x, wb.x + 220, wb.right - 220), cy = Phaser.Math.Clamp(h.y, wb.y + 330, wb.bottom - 260);
  if (cx !== h.x || cy !== h.y) { h.body.reset(cx, cy); s.cameras.main.centerOn(cx, cy); }
  // 몸: 위에서 떨어져 쿵. 닿으면 크게 아프다
  const tx = h.x, ty = h.y - 130;
  const m = s.mobs.create(tx, ty - 420, 'pro_boss', 0).setOrigin(0.5, 0.85).setScale(1.15).setDepth(12);
  m.preFX?.addGlow(0xff2a10, 3, 0, false, 0.1, 10);
  m.isBoss = true; m.kind = 'proboss'; m.kbRes = 0; m.color = 0xff3a20; m.hitBy = {}; m.baseTint = 0xffffff; m.bs = 1.15; m.dead = false;
  m.bossAI = { busy: 0, dealt: 0, die: () => bossDown(s), holdFloor: () => floorHp(s) };
  // 처음 체력은 어림값(지금 피해량 기준). 착지 5초 뒤 보스에 실제로 들어간 피해로 다시 맞춘다
  m.maxHp = m.hp = Math.max(1000, (s.realDps?.() || 0) * KILL_T / 1000);
  m.dmg = s.maxHp * 0.1;   // 몸통 박치기도 장판 한 대 정도(0.22면 붙어 싸우다 두 번에 반이 날아갔다)
  m.body.setSize(m.width * 0.5, m.height * 0.3).setOffset(m.width * 0.25, m.height * 0.6);
  m.body.enable = false; m.setImmovable(true); m.spd = 20;
  P.boss = m; P.bph = 1; P.live = [];
  P.shadow = s.add.ellipse(tx, ty + 6, 170, 34, 0x000000, 0.55).setDepth(6).setAlpha(0);
  P.aura = s.add.image(tx, ty - 60, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3010).setScale(5).setDepth(11).setAlpha(0);
  s.tweens.add({ targets: P.shadow, alpha: 0.55, duration: LAND });
  s.tweens.add({ targets: m, y: ty, duration: LAND - 100, ease: 'Quad.In', onComplete: () => {
    if (P.done) return;
    sfx('boom'); s.cameras.main.shake(400, 0.02); s.cameras.main.flash(200, 255, 200, 160);
    const ring = s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5030).setScale(0.3, 0.14).setDepth(31);
    s.tweens.add({ targets: ring, scaleX: 7, scaleY: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    s.tweens.add({ targets: P.aura, alpha: { from: 0.7, to: 0.3 }, duration: 500, yoyo: true, repeat: -1 });
    m.body.enable = true; P.landed = true; P.ft = 0; P.aT = 1500; P.aN = 0;
    bossBar(s);
  } });
}

// 화면 가운데 큰 글자 한 줄(잠깐 떴다 사라진다)
function shout(s, text, color, y = 175) {
  const w = s.add.text(D.W / 2, y, text, font(18, color, 5)).setOrigin(0.5).setScrollFactor(0).setDepth(112).setAlpha(0);
  s.tweens.add({ targets: w, alpha: 1, duration: 300, yoyo: true, hold: 1500, onComplete: () => w.destroy() });
  return w;
}

function bossBar(s) {
  const P = s.pro, y = 112 + insetsGame(s.game).top, F = o => { o.setScrollFactor(0).setDepth(100); return o; };
  const back = F(s.add.rectangle(D.W / 2, y, 200, 10, 0x1a0a10).setStrokeStyle(1, 0xff6a5a));
  const bar = F(s.add.rectangle(35, y, 198, 6, 0xe8343a).setOrigin(0, 0.5));
  const n = F(s.add.text(D.W / 2, y - 12, '???', font(11, '#ffd0c0', 3)).setOrigin(0.5));
  const v = F(s.add.text(D.W / 2, y, '100%', font(8, '#ffffff', 2)).setOrigin(0.5));
  s.tweens.add({ targets: n, alpha: 0.4, duration: 260, yoyo: true, repeat: -1 });
  P.bar = [back, bar, n, v];
}

// 너무 빨리 죽지 않게: 시간에 비례한 체력 바닥(MIN_T 전에는 못 잡는다)
function floorHp(s) {
  const P = s.pro, m = P.boss;
  if (!m || !P.landed) { if (m) m.hp = Math.max(m.hp, m.maxHp * 0.999); return; }
  m.hp = Math.max(m.hp, m.maxHp * Math.max(0, 1 - P.ft / MIN_T));
}

// 위험 구역: ms 동안 붉게 차오르고, 끝나면 터진다. 안에 있으면 맞는다(무적 시간도 소용없다)
function zone(s, kind, x, y, a, b, ms, frac) {
  const P = s.pro;
  const g = kind === 'rect' ? s.add.rectangle(x, y, a, b, 0xff2020, 0.18).setStrokeStyle(1, 0xff6040) : s.add.ellipse(x, y, a * 2, a * 1.5, 0xff2020, 0.18).setStrokeStyle(1, 0xff6040);
  g.setDepth(7);
  const inner = kind === 'rect' ? s.add.rectangle(x, y, a, b, 0xff3a20, 0.4).setDepth(7.1).setScale(1, 0.05) : s.add.ellipse(x, y, a * 2, a * 1.5, 0xff3a20, 0.4).setDepth(7.1).setScale(0.05);
  s.tweens.add({ targets: inner, scaleX: 1, scaleY: 1, duration: ms, ease: 'Quad.In' });
  sfx('warn', 200);
  const z = { kind, x, y, a, b, end: s.bt + ms };
  (P.live ||= []).push(z);
  (P.zones ||= []).push(g, inner);
  s.time.delayedCall(ms, () => {
    g.destroy(); inner.destroy();
    P.live = P.live.filter(o => o !== z);
    if (P.done || P.killed || P.dying) return;
    const hero = s.hero;
    sfx('boom', 80); s.cameras.main.shake(120, 0.006);
    const fx = s.add.sprite(x, y, 'fx2_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setTint(0xff7040).setScale(kind === 'rect' ? 1.4 : Math.max(1, a / 36)).play('fxCrit');
    fx.once('animationcomplete', () => fx.destroy());
    s.spark.explode(10, x, y);
    if (inZone(z, hero.x, hero.y) && s.bt >= (s.pro.graceT || 0)) { s.iframe = -1; s.hurt(s.maxHp * frac, 'proboss'); }
  });
}
export const inZone = (z, x, y) => z.kind === 'rect' ? Math.abs(x - z.x) < z.a / 2 + 6 && Math.abs(y - z.y) < z.b / 2 + 8 : (((x - z.x) / (z.a + 6)) ** 2 + ((y - z.y) / (z.a * 0.75 + 6)) ** 2) < 1;

// 단계별 공격 한 묶음. 돌아온 값 = 다음 공격까지(ms)
function attack(s, ph) {
  const P = s.pro, h = s.hero, mv = s.moveV || { x: 0, y: 0 }, m = P.boss, n = P.aN++;
  const v = viewRect(s), f = HIT[ph];
  const circ = (x, y, r, ms) => zone(s, 'circle', x, y, r, 0, ms, f);
  const rect = (x, y, w, hh, ms) => zone(s, 'rect', x, y, w, hh, ms, f);
  const rx = () => RF(v.x + 30, v.right - 30), ry = () => RF(v.y + 60, v.bottom - 40);
  if (ph === 1) {   // 하나씩 또박또박
    const k = n % 3;
    if (k === 0) circ(h.x, h.y, 46, 1100);
    else if (k === 1) n % 2 ? rect(h.x, h.y, 44, v.height + 80, 1100) : rect(h.x, h.y, v.width + 80, 44, 1100);
    else { circ(h.x, h.y, 40, 1100); circ(h.x + mv.x * 90, h.y + mv.y * 90, 40, 1100); }
    return 1400;
  }
  if (ph === 2) {   // 난사: 서 있는 곳 + 가려는 곳을 계속 노린다
    circ(h.x, h.y, 44, 1000);
    if (n % 2) circ(h.x + mv.x * 95, h.y + mv.y * 95, 42, 1000);   // 가려는 곳은 한 번 걸러(매번이면 쉴 틈 없이 쫓겨 1초마다 맞았다)
    if (n % 3 === 0) circ(m.x, m.y + 20, 90, 1000);
    if (n % 4 === 1) circ(rx(), ry(), 56, 1000);
    return 800;   // 2분 싸움: 2·3단계가 길어져 간격을 넓혔다
  }
  if (ph === 3) {   // 화면 전체: 흩뿌리고, 가끔 십자로 가른다
    circ(h.x, h.y, 42, 1000);
    for (let i = 0; i < 3; i++) circ(rx(), ry(), RF(48, 70), 1000);
    if (n % 5 === 2) { rect(v.centerX, h.y, v.width + 80, 40, 1050); rect(h.x, v.centerY, 40, v.height + 80, 1050); }
    return 600;
  }
  // 4단계: 화면을 칸으로 나눠 거의 다 덮는다. 주인공 옆 한 칸만 비운다(제때 옮기면 산다)
  const C = 3, Rr = 4, cw = v.width / C, ch = (v.height - 40) / Rr;
  const hc = Phaser.Math.Clamp(Math.floor((h.x - v.x) / cw), 0, C - 1), hr = Phaser.Math.Clamp(Math.floor((h.y - v.y - 40) / ch), 0, Rr - 1);
  const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [hc + a, hr + b]).filter(([a, b]) => a >= 0 && a < C && b >= 0 && b < Rr && !(a === hc && b === hr && n % 2));
  const [sc, sr] = near[R(0, near.length - 1)];
  for (let c = 0; c < C; c++) for (let r = 0; r < Rr; r++) if (c !== sc || r !== sr) circ(v.x + cw * (c + 0.5), v.y + 40 + ch * (r + 0.5), Math.max(cw, ch) * 0.62, 900);
  return 1150;
}

// 단계가 바뀔 때: 붉게 번쩍이고 한 줄 외친다
function phaseUp(s, ph) {
  const P = s.pro, m = P.boss;
  P.bph = ph; P.aT = 900;
  sfx('bossIn'); s.cameras.main.shake(500, 0.012); s.cameras.main.flash(220, 255, 60, 40);
  m.setFrame(1); s.time.delayedCall(700, () => m.active && !P.killed && m.setFrame(0));
  s.tweens.add({ targets: P.aura, scale: 5 + ph, duration: 500 });
  shout(s, [t('prologue.p2'), t('prologue.p3'), t('prologue.p4')][ph - 2], '#ff6a5a', 200);
  track('prologue_boss_phase', { ph, ft: Math.round(P.ft) });
}

// 피할 수 없는 마지막 공격: 화면 전체가 붉게 차오른다(제한 시간 안에 못 잡았을 때)
function doom(s) {
  const P = s.pro;
  sfx('warn'); sfx('bossIn');
  P.boss.setFrame(1);
  s.tweens.add({ targets: P.boss, scale: 1.45, duration: 1800, ease: 'Sine.Out' });
  s.tweens.add({ targets: P.aura, alpha: 0.9, scale: 8, duration: 1800 });
  const v = s.add.rectangle(0, 0, D.GW, D.H, 0xff1a10, 0.05).setOrigin(0).setScrollFactor(0).setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
  v.wideFx = true;
  s.tweens.add({ targets: v, alpha: 0.55, duration: 1900, ease: 'Quad.In' });
  s.cameras.main.shake(1900, 0.008);
  P.doomV = v;
  s.time.delayedCall(2000, () => proKill(s, 'doom'));
}

function bossTick(s, dt) {
  const P = s.pro, m = P.boss;
  if (!m || !m.active) return;
  P.aura?.setPosition(m.x, m.y - 60);
  P.shadow?.setPosition(m.x, m.y + 6);
  if (!P.landed || P.killed) return;
  P.ft += dt;
  // 착지 5초 뒤: 실제로 들어간 피해로 체력을 맞춘다(붙어서 계속 때리면 KILL_T쯤)
  if (!P.fitted && P.ft >= 5000) {
    P.fitted = true;
    const dealt = m.bossAI.dealt || 0, per = dealt / 5;
    if (per > 0) { const mx = Math.max(dealt * 1.5, per * KILL_T / 1000); m.hp = Math.max(1, m.hp / m.maxHp * mx); m.maxHp = mx; }
  }
  floorHp(s);
  const f = Math.max(0, m.hp / m.maxHp);
  if (P.bar) { P.bar[1].width = 198 * f; P.bar[3].setText(Math.ceil(f * 100) + '%'); }
  const ph = f > 2 / 3 ? 1 : f > 1 / 3 ? 2 : f > 0.12 ? 3 : 4;
  if (ph > P.bph) phaseUp(s, ph);
  if (!P.capped && P.ft >= CAP) { P.capped = true; P.zones?.forEach(o => o.active && o.destroy()); doom(s); }
  if (!P.capped && (P.aT -= dt) <= 0) P.aT = attack(s, P.bph);
  if (P.done) return;
  // 천천히 다가온다
  const h = s.hero, dx = h.x - m.x, dy = h.y - m.y, L = Math.hypot(dx, dy) || 1;
  if (!P.capped) m.setVelocity(L > 80 ? dx / L * m.spd : 0, L > 80 ? dy / L * m.spd : 0); else m.setVelocity(0, 0);
  m.setDepth(11 + m.y / 1600).setFlipX(dx < 0);
  // 졸개가 조금 나온다(검이 닿을 곳이 늘 있게)
  s.spawnAcc = (s.spawnAcc || 0) + dt * 0.9 / 1000;
  while (s.spawnAcc >= 1) { s.spawnAcc--; if (s.mobs.countActive() < 12) s.spawn(); }
}

// ── 보스를 진짜로 잡았다 → 성이 무너진다 → 주인공도 깔린다(이야기상 쓰러짐은 그대로, 대신 보상) ──
function bossDown(s) {
  const P = s.pro, m = P.boss;
  if (P.killed || P.dying || P.done) return;
  P.killed = true;
  track('prologue_boss_kill', { ft: Math.round(P.ft), lv: s.run.lv, hp_pct: Math.round(s.hp / s.maxHp * 100) });
  P.zones?.forEach(o => o.active && o.destroy()); P.live = [];
  m.setVelocity(0, 0);
  // 막타: 느려지고 하얗게 번쩍, 마왕이 무너져 내린다
  const sl = 0.3;
  s.time.timeScale = sl; s.tweens.timeScale = sl; s.anims.globalTimeScale = sl;
  setTimeout(() => { try { s.time.timeScale = 1; s.tweens.timeScale = 1; s.anims.globalTimeScale = 1; } catch { /* 장면이 닫힘 */ } }, 700);
  sfx('boom'); sfx('win'); s.time.delayedCall(150, () => sfx('boom')); s.time.delayedCall(350, () => sfx('boom'));
  s.cameras.main.flash(500, 255, 255, 255); s.cameras.main.shake(900, 0.03);
  P.bar?.forEach(o => s.tweens.add({ targets: o, alpha: 0, duration: 400 }));
  s.tweens.add({ targets: P.aura, alpha: 0, scale: 10, duration: 1200 });
  m.setTintFill(0xffffff);
  s.time.delayedCall(250, () => m.clearTint());
  s.tweens.add({ targets: m, scaleY: m.scaleY * 0.15, scaleX: m.scaleX * 1.3, alpha: 0, duration: 1500, delay: 400, ease: 'Quad.In' });
  for (let i = 0; i < 10; i++) s.time.delayedCall(i * 110, () => {
    const fx = s.add.sprite(m.x + R(-50, 50), m.y - R(0, 150), 'fx1_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setScale(1.8).play('fxHit');
    fx.once('animationcomplete', () => fx.destroy());
  });
  s.goo.setParticleTint(0xff3a20); s.goo.explode(80, m.x, m.y - 60);
  s.mobs.getChildren().slice().forEach(o => { if (o === m || o.dead) return; o.dead = true; o.body.enable = false; s.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.destroy() }); });
  s.time.delayedCall(300, () => shout(s, t('prologue.bossDown'), '#ffd75e'));
  s.time.delayedCall(2600, () => collapse(s));
}

function collapse(s) {
  const P = s.pro, h = s.hero;
  if (P.done || P.dying) return;
  P.spawnOff = true;
  shout(s, t('prologue.collapse'), '#ff9a5a', 160);
  sfx('bossIn'); s.cameras.main.shake(3400, 0.014);
  const dark = s.add.rectangle(0, 0, D.GW, D.H, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(57).setAlpha(0);
  dark.wideFx = true;
  s.tweens.add({ targets: dark, alpha: 0.45, duration: 3000 });
  const v = viewRect(s);
  const rock = (x, y, sz, ms, onLand) => {
    const sh = s.add.ellipse(x, y + sz * 0.3, sz * 1.2, sz * 0.4, 0x000000, 0.5).setDepth(6).setScale(0.2);
    const r = s.add.rectangle(x, v.y - 30, sz, sz * 0.8, Phaser.Display.Color.GetColor(R(80, 120), R(70, 95), R(60, 80))).setStrokeStyle(1, 0x2a2018).setDepth(30).setAngle(R(0, 90));
    s.tweens.add({ targets: sh, scale: 1, duration: ms });
    s.tweens.add({ targets: r, y, angle: r.angle + R(-120, 120), duration: ms, ease: 'Quad.In', onComplete: () => {
      sfx('boom', 60); s.spark.explode(6, x, y);
      sh.destroy(); r.setDepth(6 + y / 1600);
      s.tweens.add({ targets: r, alpha: 0, duration: 1600, delay: 800, onComplete: () => r.destroy() });
      onLand?.();
    } });
  };
  // 돌이 쏟아진다(주인공 둘레엔 안 떨어지다가 마지막 큰 돌이 정통으로)
  for (let i = 0; i < 26; i++) s.time.delayedCall(i * 110, () => {
    let x, y; do { x = RF(v.x + 10, v.right - 10); y = RF(v.y + 50, v.bottom - 20); } while (Math.hypot(x - h.x, y - h.y) < 46);
    rock(x, y, R(10, 22), R(380, 560));
  });
  s.time.delayedCall(2700, () => {
    if (P.done || P.dying) return;
    sfx('warn');
    rock(h.x, h.y - 4, 44, 700, () => { s.cameras.main.shake(500, 0.04); proKill(s, 'castle'); });
  });
}

// 확실히 쓰러진다(무적 시간도 소용없다)
export function proKill(s, why) {
  const P = s.pro; if (P.done || P.dying) return;
  s.iframe = -1; s.petShield = false;
  P.why = why;
  s.hp = 0; proDie(s);
}

// 죽음: 밝아지고 흔들리고 날아간 뒤 어두워지며 Prologue의 '무기 파괴' 장면으로
export function proDie(s) {
  const P = s.pro; if (P.dying || P.done) return;
  P.dying = true; s.hp = 0; s.over = true;
  s.physics.pause();
  const h = s.hero;
  sfx('boom'); sfx('hurt');
  s.cameras.main.flash(380, 255, 255, 255); s.cameras.main.shake(700, 0.035);
  const ring = s.add.image(h.x, h.y + 10, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5030).setScale(0.3, 0.14).setDepth(63);
  s.tweens.add({ targets: ring, scaleX: 9, scaleY: 4, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
  h.play('hurtPose'); h.clearTint();
  s.tweens.add({ targets: h, x: h.x - 50 * (s.face || 1), y: h.y + 24, angle: 90 * (s.face || 1), alpha: 0.5, duration: 520, ease: 'Quad.Out' });
  const wk = s.heroWeapon?.texture?.key || WEAPON_ICON;
  if (s.heroWeapon) s.tweens.add({ targets: s.heroWeapon, x: h.x + 90, y: h.y - 90, angle: 700, alpha: 0, duration: 700 });
  P.zones?.forEach(o => o.active && o.destroy());
  s.tweens.add({ targets: [P.red, P.doomV].filter(Boolean), alpha: 0, duration: 300 });
  track('prologue_boss_dead', { t: Math.round(s.bt / 1000), lv: s.run.lv, why: P.why || 'hit', ft: Math.round(P.ft || 0), won: !!P.killed });
  s.time.delayedCall(1500, () => {
    s.cameras.main.fadeOut(500, 0, 0, 0);
    s.cameras.main.once('camerafadeoutcomplete', () => {
      if (P.done) return; P.done = true;
      sandboxEnd();
      s.scene.start('Prologue', { phase: 'after', replay: P.replay, wk, won: !!P.killed });   // won: 보스를 진짜로 잡았다(성에 깔려 쓰러졌다) → 새 목표 화면에서 보상
    });
  });
}
