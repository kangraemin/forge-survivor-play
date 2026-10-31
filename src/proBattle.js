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
import { font, button } from './ui.js';
import { track } from './log.js';
import { t } from './i18n.js';
import { insetsGame } from './safeArea.js';

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
  // 건너뛰기(왼쪽 아래): 누르면 바로 새 목표 화면
  s.proSkipBtn = button(s, 38, D.H - 26 - ins.bottom, 62, 20, t('coach.88130a'), () => proSkip(s), { size: 10 });
  s.proSkipBtn.setScrollFactor(0).setDepth(100);
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
    // 몹: 화면이 늘 가득 차 있다(초당 3~7마리, 동시 최대 60)
    s.spawnAcc = (s.spawnAcc || 0) + dt * (3.4 + 3.2 * f) / 1000;
    const cap = Math.min(60, 26 + P.t / 1000 * 0.9);
    while (s.spawnAcc >= 1) { s.spawnAcc--; if (s.mobs.countActive() < cap) s.spawn(); }
    if (!P.elite && P.t > PRO_PLAY_MS * 0.4) { P.elite = true; s.spawn(false, s.ch.mobs[1], { elite: true, force: true }); }
    if (!P.ring && P.t > PRO_PLAY_MS * 0.58) { P.ring = true; s.encircle(); }
    if ((P.fT = (P.fT || 0) + dt) > 16000) { P.fT = 0; s.formation(); }
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

// ── 보스 ──
const LAND = 2300;   // 경고 시작 → 착지
const DOOM = 17400;  // 착지 후 이 시각에 피할 수 없는 마지막 공격 예고
const KILL = 19400;  // 착지 후 이 시각에 확실히 쓰러진다

function bossIn(s) {
  const P = s.pro, h = s.hero;
  P.phase = 'boss'; P.pt = 0; s.xpMul = 0;
  s.hp = s.maxHp;
  sfx('warn'); s.time.delayedCall(450, () => sfx('boom'));
  s.cameras.main.shake(LAND, 0.006);
  // 남은 몹은 흩어지고 구슬은 끌려온다
  s.mobs.getChildren().slice().forEach(m => { if (m.isBoss || m.dead) return; m.dead = true; m.body.enable = false; s.tweens.add({ targets: m, alpha: 0, scale: 0.3, duration: 250, onComplete: () => m.destroy() }); });
  s.ebullets.clear(true, true);
  s.gems.getChildren().forEach(g => { g.pull = true; });
  s.proSkipBtn?.setVisible(true);
  const red = s.add.rectangle(0, 0, D.GW, D.H, 0xff1a10, 1).setOrigin(0).setScrollFactor(0).setDepth(58).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  red.wideFx = true; P.red = red;
  s.tweens.add({ targets: red, alpha: 0.2, duration: 400, yoyo: true, repeat: 5 });
  const w = s.add.text(D.W / 2, 175, t('prologue.warn'), font(18, '#ff6a5a', 5)).setOrigin(0.5).setScrollFactor(0).setDepth(112).setAlpha(0);
  s.tweens.add({ targets: w, alpha: 1, duration: 300, yoyo: true, hold: 1500, onComplete: () => w.destroy() });
  s.hitstop = 0;
  track('prologue_boss', { t: Math.round(s.bt / 1000), lv: s.run.lv });
  // 몸: 위에서 떨어져 쿵. 닿으면 크게 아프다
  const tx = h.x, ty = h.y - 130;
  const m = s.mobs.create(tx, ty - 420, 'pro_boss', 0).setOrigin(0.5, 0.85).setScale(1.15).setDepth(12);
  m.preFX?.addGlow(0xff2a10, 3, 0, false, 0.1, 10);
  m.isBoss = true; m.kind = 'proboss'; m.kbRes = 0; m.color = 0xff3a20; m.hitBy = {}; m.baseTint = 0xffffff; m.bs = 1.15; m.dead = false;
  m.bossAI = { busy: 0, dealt: 0, die() {}, holdFloor() {} };
  m.maxHp = m.hp = 1e15;                           // 숫자는 뜨지만 체력은 거의 안 깎인다(1e15의 몇 만 분의 1)
  m.dmg = s.maxHp * 0.22;
  m.body.setSize(m.width * 0.5, m.height * 0.3).setOffset(m.width * 0.25, m.height * 0.6);
  m.body.enable = false; m.setImmovable(true); m.spd = 20;
  P.boss = m;
  P.shadow = s.add.ellipse(tx, ty + 6, 170, 34, 0x000000, 0.55).setDepth(6).setAlpha(0);
  P.aura = s.add.image(tx, ty - 60, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3010).setScale(5).setDepth(11).setAlpha(0);
  s.tweens.add({ targets: P.shadow, alpha: 0.55, duration: LAND });
  s.tweens.add({ targets: m, y: ty, duration: LAND - 100, ease: 'Quad.In', onComplete: () => {
    if (P.done) return;
    sfx('boom'); s.cameras.main.shake(400, 0.02); s.cameras.main.flash(200, 255, 200, 160);
    const ring = s.add.image(m.x, m.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5030).setScale(0.3, 0.14).setDepth(31);
    s.tweens.add({ targets: ring, scaleX: 7, scaleY: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    s.tweens.add({ targets: P.aura, alpha: { from: 0.7, to: 0.3 }, duration: 500, yoyo: true, repeat: -1 });
    m.body.enable = true; P.landed = true; P.ft = 0; P.sched = schedule(s);
    bossBar(s);
  } });
}

function bossBar(s) {
  const P = s.pro, y = 112 + insetsGame(s.game).top, F = o => { o.setScrollFactor(0).setDepth(100); return o; };
  const back = F(s.add.rectangle(D.W / 2, y, 200, 10, 0x1a0a10).setStrokeStyle(1, 0xff6a5a));
  const bar = F(s.add.rectangle(35, y, 198, 6, 0xe8343a).setOrigin(0, 0.5));
  const n = F(s.add.text(D.W / 2, y - 12, '???', font(11, '#ffd0c0', 3)).setOrigin(0.5));
  const v = F(s.add.text(D.W / 2, y, '???', font(8, '#ffffff', 2)).setOrigin(0.5));
  s.tweens.add({ targets: [n, v], alpha: 0.4, duration: 260, yoyo: true, repeat: -1 });
  P.bar = [back, bar, n, v];
}

// 위험 구역: ms 동안 붉게 차오르고, 끝나면 터진다. 안에 있으면 맞는다
function zone(s, kind, x, y, a, b, ms, frac) {
  const P = s.pro;
  const g = kind === 'rect' ? s.add.rectangle(x, y, a, b, 0xff2020, 0.18).setStrokeStyle(1, 0xff6040) : s.add.ellipse(x, y, a * 2, a * 1.5, 0xff2020, 0.18).setStrokeStyle(1, 0xff6040);
  g.setDepth(7);
  const inner = kind === 'rect' ? s.add.rectangle(x, y, a, b, 0xff3a20, 0.4).setDepth(7.1).setScale(1, 0.05) : s.add.ellipse(x, y, a * 2, a * 1.5, 0xff3a20, 0.4).setDepth(7.1).setScale(0.05);
  s.tweens.add({ targets: inner, scaleX: 1, scaleY: 1, duration: ms, ease: 'Quad.In' });
  sfx('warn', 200);
  (P.zones ||= []).push(g, inner);
  s.time.delayedCall(ms, () => {
    g.destroy(); inner.destroy();
    if (P.done) return;
    const hero = s.hero;
    const hit = kind === 'rect' ? Math.abs(hero.x - x) < a / 2 + 6 && Math.abs(hero.y - y) < b / 2 + 8 : (((hero.x - x) / (a + 6)) ** 2 + ((hero.y - y) / (a * 0.75 + 6)) ** 2) < 1;
    sfx('boom', 80); s.cameras.main.shake(120, 0.006);
    const fx = s.add.sprite(x, y, 'fx2_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setTint(0xff7040).setScale(kind === 'rect' ? 1.4 : Math.max(1, a / 36)).play('fxCrit');
    fx.once('animationcomplete', () => fx.destroy());
    s.spark.explode(10, x, y);
    if (hit) { s.iframe = -1; s.hurt(s.maxHp * frac, 'proboss'); }
  });
}

function schedule(s) {
  const hero = () => s.hero, mv = () => s.moveV || { x: 0, y: 0 }, bs = () => s.pro.boss;
  const circ = (dx = 0, dy = 0, ms = 1300, r = 44, f = 0.32) => () => zone(s, 'circle', hero().x + dx, hero().y + dy, r, 0, ms, f);
  return [
    { t: 1500, fn: circ() },
    { t: 4300, fn: () => zone(s, 'rect', hero().x, hero().y, 420, 40, 1300, 0.32) },
    { t: 7000, fn: () => { circ()(); zone(s, 'circle', hero().x + mv().x * 80, hero().y + mv().y * 80, 40, 0, 1200, 0.32); } },
    { t: 9700, fn: () => { zone(s, 'circle', bs().x, bs().y + 20, 84, 0, 1300, 0.34); circ(0, 0, 1300, 36)(); } },
    { t: 12300, fn: circ(0, 0, 1000, 38) }, { t: 12900, fn: circ(0, 0, 1000, 38) }, { t: 13500, fn: circ(0, 0, 1000, 38) },
    { t: 15200, fn: () => { zone(s, 'rect', hero().x, hero().y, 40, 420, 1200, 0.32); circ(0, 0, 1200, 38)(); } },
    { t: DOOM, fn: () => doom(s) },
    { t: KILL, fn: () => proKill(s, 'doom') },
  ];
}

// 피할 수 없는 마지막 공격: 화면 전체가 붉게 차오른다
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
}

function bossTick(s, dt) {
  const P = s.pro, m = P.boss;
  if (!m || !m.active) return;
  P.aura?.setPosition(m.x, m.y - 60);
  P.shadow?.setPosition(m.x, m.y + 6);
  if (!P.landed) return;
  P.ft += dt;
  for (let i = P.sched.length - 1; i >= 0; i--) if (P.ft >= P.sched[i].t) { const e = P.sched.splice(i, 1)[0]; e.fn(); }
  if (P.done) return;
  // 천천히 다가온다
  const h = s.hero, dx = h.x - m.x, dy = h.y - m.y, L = Math.hypot(dx, dy) || 1;
  if (P.ft < DOOM) m.setVelocity(L > 80 ? dx / L * m.spd : 0, L > 80 ? dy / L * m.spd : 0); else m.setVelocity(0, 0);
  m.setDepth(11 + m.y / 1600).setFlipX(dx < 0);
  // 졸개가 조금 나온다(검이 닿을 곳이 늘 있게)
  s.spawnAcc = (s.spawnAcc || 0) + dt * 0.9 / 1000;
  while (s.spawnAcc >= 1) { s.spawnAcc--; if (s.mobs.countActive() < 12) s.spawn(); }
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
  P.zones?.forEach(o => o.destroy());
  s.tweens.add({ targets: [P.red, P.doomV].filter(Boolean), alpha: 0, duration: 300 });
  track('prologue_boss_dead', { t: Math.round(s.bt / 1000), lv: s.run.lv, why: P.why || 'hit', ft: Math.round(P.ft || 0) });
  s.time.delayedCall(1500, () => {
    s.cameras.main.fadeOut(500, 0, 0, 0);
    s.cameras.main.once('camerafadeoutcomplete', () => {
      if (P.done) return; P.done = true;
      sandboxEnd();
      s.scene.start('Prologue', { phase: 'after', replay: P.replay, wk });
    });
  });
}
