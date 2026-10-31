// 테스트 패널: 테스트 모드(주인 코드를 맞춘 기기)에서만 만든다. 일반 플레이에서는 이 파일의 install이 불리지 않는다
//  왼쪽 위 TEST 버튼 또는 PC 키보드 ` (백틱)로 연다. 열려 있는 동안 지금 장면은 멈춘다
import * as D from './data.js';
import { load, save } from './save.js';
import { PETS, WTYPES, HERO_SKINS } from './gear.js';
import { tutorialSteps } from './tutorial.js';
import { coachRun } from './coach.js';
import { isTest, isKo, askDisableTest, copyRealToTest, clearTestSave } from './testMode.js';
import { tst, setSpeed, levelUpNow, skipWave, summonBoss, instantResult } from './testBattle.js';
import { PRESETS, applyPreset, addCurrency, setSword, unlockAll, setWeapon, setCash } from './testPresets.js';

const KO = {
  badge: 'TEST', title: '테스트 패널', close: '닫기', // i18n-ignore
  go: '바로 가기', goNote: ['장과 판을 골라 바로 들어갑니다.', '잠금·강화 경고는 건너뜁니다.'], // i18n-ignore
  chapter: '장', hard: '어려움', stage: n => n + "판", mid: '중간보스만', boss: '장 보스만', tower: '무한의 탑', floor: '층', dungeon: '오늘의 던전', prologue: '프롤로그', // i18n-ignore
  presets: '진행도 프리셋', presetNote: ['테스트 저장만 바뀝니다.', '적용하면 화면을 다시 엽니다.'], // i18n-ignore
  p: { new: '새 유저', c1: '1장 클리어', c5: '5장 클리어', c10: '10장 클리어', c15: '15장 끝', all: '전부 해금' }, // i18n-ignore
  wp: '무기', wpNote: ['무기 종류를 고르면 장착하고 주 스탯을 맞춥니다.', '칼 등급·캐시 무기·칼빛·영웅 스킨을 바로 끼워 봅니다.'], tier: '칼 등급', cash: '캐시 무기', cashOff: '캐시 무기 끄기', light: '칼빛', hskin: '영웅 스킨', none: '없음', // i18n-ignore
  vals: '값 넣기', valsNote: ['누를 때마다 더해집니다.'], gold: '금화', stone: '강화석', gem: '보석', guard: '보호권', big: '큰 수', enh: '칼 강화', unlock: '무기·펫·꾸미기 전부 해금', // i18n-ignore
  battle: '전투 중', battleNote: ['전투 장면에서만 동작합니다.'], god: '무적', speed: '배속', lvup: '레벨업 카드', skip: '웨이브 넘기기', summon: '보스 소환', win: '즉시 승리', lose: '즉시 패배', // i18n-ignore
  screens: '화면 바로 열기', rWin: '승리 결과창', rLose: '패배 결과창', newPet: '새 펫 창', shop: '상점', attend: '출석', tut: n => "안내 " + n, tutNote: ['안내 단계를 하나씩 다시 봅니다.'], // i18n-ignore
  save: '테스트 저장', copy: '내 진행도 복사해서 다시 시작', reset: '테스트 저장 처음 상태로', off: '테스트 모드 끄기', // i18n-ignore
  inLobby: '로비에서 눌러 주세요.', inBattle: '전투 중에 눌러 주세요.', done: '적용했습니다.', fail: '지금은 안 됩니다.', // i18n-ignore
}; // i18n-ignore
const EN = { // i18n-ignore
  badge: 'TEST', title: 'Test panel', close: 'Close', // i18n-ignore
  go: 'Shortcuts', goNote: ['Pick a chapter and stage to jump in.', 'Locks and power warnings are skipped.'],
  chapter: 'Chapter', hard: 'Hard', stage: n => `Stage ${n}`, mid: 'Mid-boss only', boss: 'Chapter boss only', tower: 'Endless tower', floor: 'Floor', dungeon: 'Daily dungeon', prologue: 'Prologue',
  presets: 'Progress presets', presetNote: ['Only the test save changes.', 'The screen reopens after applying.'],
  p: { new: 'New user', c1: 'Ch 1 clear', c5: 'Ch 5 clear', c10: 'Ch 10 clear', c15: 'Ch 15 end', all: 'Everything' },
  wp: 'Weapon', wpNote: ['Pick a weapon type to equip it and match the main stat.', 'Try sword tier, cash weapon, blade light and hero skin right away.'], tier: 'Sword tier', cash: 'Cash weapon', cashOff: 'Cash weapon off', light: 'Blade light', hskin: 'Hero skin', none: 'None',
  vals: 'Set values', valsNote: ['Each press adds to the amount.'], gold: 'Gold', stone: 'Stones', gem: 'Gems', guard: 'Guards', big: 'Big', enh: 'Sword +', unlock: 'Unlock all weapons, pets, looks',
  battle: 'In battle', battleNote: ['Works only inside a battle.'], god: 'Invincible', speed: 'Speed', lvup: 'Level-up cards', skip: 'Skip wave', summon: 'Summon boss', win: 'Instant win', lose: 'Instant lose',
  screens: 'Open screens', rWin: 'Win result', rLose: 'Lose result', newPet: 'New pet window', shop: 'Shop', attend: 'Attendance', tut: n => `Tutorial ${n}`, tutNote: ['Replay each tutorial step.'],
  save: 'Test save', copy: 'Restart with a copy of my progress', reset: 'Reset test save', off: 'Turn off test mode',
  inLobby: 'Press this in the lobby.', inBattle: 'Press this during a battle.', done: 'Applied.', fail: 'Not available now.',
};
const L = () => (isKo() ? KO : EN);

let root = null, badge = null, game = null, paused = null;
const KEYS = ['Lobby', 'Battle', 'Prologue'];
const cur = () => game?.scene.getScenes(true).find(s => KEYS.includes(s.sys.settings.key)) || null;
const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; return e; };
const BTN = 'min-height:44px;padding:6px 10px;margin:3px;border:1px solid #475c66;background:#3a3846;color:#fff;font:inherit;font-size:14px;cursor:pointer';
const btn = (label, fn, hi) => { const b = el('button', BTN + (hi ? ';background:#ffb85c;color:#111923' : ''), label); b.onclick = fn; return b; };

function open() {
  if (root) return;
  const sc = cur();
  if (sc && !sc.scene.isPaused()) { sc.scene.pause(); paused = sc; }
  build();
}
function close() {
  root?.remove(); root = null;
  if (paused) { try { paused.scene.resume(); } catch { /* 장면이 바뀜 */ } paused = null; }
}
const toggle = () => (root ? close() : open());

// 동작 하나를 하고 패널을 닫는다(장면을 먼저 다시 돌린 뒤 실행)
function act(fn, { stay = false } = {}) {
  const m = L();
  const sc = paused || cur();
  if (!stay) close();
  try {
    const r = fn(sc);
    if (r === false) note(m.fail);
  } catch (e) { console.warn('test panel', e); note(m.fail); }
}
function note(s) {
  const n = el('div', 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;background:#000d;color:#ffd75e;padding:8px 14px;font-size:14px;font-family:G9,sans-serif', s);
  document.body.append(n); setTimeout(() => n.remove(), 1600);
}
const startBattle = (sc, data) => {
  if (!sc) return false;
  sc.scene.start('Battle', data);   // 로비든 전투든 그 판으로 바로
  return true;
};
const reloadSoon = () => setTimeout(() => location.reload(), 150);

function section(title, lines) {
  const d = el('div', 'margin:12px 0 4px');
  d.append(el('div', 'color:#ffd75e;font-size:16px;margin-bottom:2px', title));
  for (const l of lines || []) d.append(el('div', 'color:#cfc6e0;font-size:12px;line-height:1.5', '- ' + l));
  const row = el('div', 'display:flex;flex-wrap:wrap;margin-top:4px');
  d.append(row);
  return { d, row };
}

function build() {
  const m = L(), sv = load();
  root = el('div', 'position:fixed;left:0;right:0;bottom:0;max-height:88vh;overflow:auto;z-index:100000;background:#1a1426f2;border-top:2px solid #ffd75e;color:#fff;font-family:G9,sans-serif;padding:10px 12px calc(14px + env(safe-area-inset-bottom));box-sizing:border-box;max-width:560px;margin:0 auto');
  const head = el('div', 'display:flex;align-items:center;justify-content:space-between');
  head.append(el('div', 'font-size:18px;color:#ffd75e', m.title), btn(m.close, close));
  root.append(head);

  // 바로 가기
  const g = section(m.go, m.goNote); root.append(g.d);
  const sel = el('select', 'min-height:44px;font:inherit;font-size:14px;margin:3px;background:#0d0a14;color:#fff;border:1px solid #475c66');
  D.CHAPTERS.forEach((c, i) => { const o = el('option', '', `${m.chapter} ${i + 1}${c.name ? ' ' + c.name : ''}`); o.value = i; sel.append(o); });
  sel.value = String(Math.min(7, D.CHAPTERS.length - 1));
  const hardL = el('label', 'display:flex;align-items:center;margin:3px;font-size:14px'); const hard = el('input'); hard.type = 'checkbox'; hard.style.cssText = 'width:22px;height:22px;margin-right:6px'; hardL.append(hard, m.hard);
  const fl = el('input', 'width:64px;min-height:44px;font:inherit;font-size:14px;margin:3px;background:#0d0a14;color:#fff;border:1px solid #475c66;padding:0 6px'); fl.type = 'number'; fl.value = '10'; fl.min = '1';
  g.row.append(sel, hardL);
  const c = () => +sel.value;
  // 바로 가기는 테스트 저장의 진행도도 '그 판이 다음 도전 판'이 되게 맞춘다(낮추는 것도 허용). 이긴 뒤 로비·다음 판이 그 판 기준으로 이어진다
  const go = (s, extra = {}) => act(sc => {
    const sv = load(), idx = c() * D.STAGES_PER_CHAPTER + s;
    if (hard.checked) sv.hardCleared = idx; else sv.cleared = idx;
    save();
    return startBattle(sc, { chapter: c(), stage: s, endless: false, hard: hard.checked, dungeon: null, ...extra });
  });
  for (let s = 0; s < D.STAGES_PER_CHAPTER; s++) g.row.append(btn(m.stage(s + 1), () => go(s)));
  g.row.append(
    btn(m.mid, () => go(0, { testGo: { mid: true } })),
    btn(m.boss, () => go(D.STAGES_PER_CHAPTER - 1, { testGo: { boss: true } })),
    fl, btn(`${m.tower} ${m.floor}`, () => act(sc => startBattle(sc, { chapter: c(), stage: 0, endless: true, testGo: { floor: Math.max(1, +fl.value | 0) } }))),
    btn(m.dungeon, () => act(sc => startBattle(sc, { chapter: c(), stage: 0, dungeon: D.dunToday() }))),
    btn(m.prologue, () => act(sc => { sc.scene.start('Prologue', { replay: true }); })),
  );

  // 프리셋
  const p = section(m.presets, m.presetNote); root.append(p.d);
  for (const pr of PRESETS) p.row.append(btn(m.p[pr.id], () => act(() => { const s = load(); applyPreset(s, pr.id); save(); reloadSoon(); })));

  // 무기
  const wsec = section(m.wp, m.wpNote); root.append(wsec.d);
  const applyW = fn => act(() => { const s = load(); fn(s); save(); reloadSoon(); });
  for (const w of WTYPES) wsec.row.append(btn(w.name + (sv.wtype === w.id || (!sv.wtype && w.id === 'sword') ? ' *' : ''), () => applyW(s => setWeapon(s, w.id)), (sv.wtype || 'sword') === w.id));
  const tr = el('div', 'display:flex;flex-wrap:wrap;width:100%;align-items:center;margin-top:6px');
  tr.append(el('span', 'font-size:14px;margin:3px', m.tier));
  D.TIERS.forEach((_, i) => tr.append(btn(String(i + 1), () => applyW(s => setSword(s, { tier: i })), sv.tier === i)));
  wsec.row.append(tr);
  const cr = el('div', 'display:flex;flex-wrap:wrap;width:100%;align-items:center;margin-top:6px');
  cr.append(btn(m.cash, () => applyW(s => setCash(s, true))), btn(m.cashOff, () => applyW(s => setCash(s, false))));
  cr.append(el('span', 'font-size:14px;margin:3px 3px 3px 10px', m.light));
  for (const k of D.SKINS) cr.append(btn(k.id ? k.name : m.none, () => applyW(s => { (s.skins ||= {})[k.id] = true; s.skin = k.id; }), (sv.skin || '') === k.id));
  const hr = el('div', 'display:flex;flex-wrap:wrap;width:100%;align-items:center;margin-top:6px');
  hr.append(el('span', 'font-size:14px;margin:3px', m.hskin));
  for (const k of HERO_SKINS) hr.append(btn(k.id ? k.name : m.none, () => applyW(s => { (s.hskins ||= {})[k.id] = true; s.hskin = k.id; }), (sv.hskin || '') === k.id));
  wsec.row.append(cr, hr);

  // 값
  const v = section(m.vals, m.valsNote); root.append(v.d);
  const add = (key, n) => act(() => { const s = load(); addCurrency(s, key, n); save(); note(m.done); }, { stay: true });
  v.row.append(
    btn(`${m.gold} +100k`, () => add('gold', 1e5)), btn(`${m.stone} +1k`, () => add('stone', 1e3)), btn(`${m.gem} +1k`, () => add('gem', 1e3)), btn(`${m.guard} +10`, () => add('guard', 10)),
    btn(`${m.big} ${m.gold} +1e12`, () => add('gold', 1e12)),
  );
  const er = el('div', 'display:flex;flex-wrap:wrap;width:100%;align-items:center');
  const enh = el('input', 'width:72px;min-height:44px;font:inherit;font-size:14px;margin:3px;background:#0d0a14;color:#fff;border:1px solid #475c66;padding:0 6px'); enh.type = 'number'; enh.min = '0'; enh.max = String(D.ENH_MAX); enh.value = String(sv.enh || 0);
  er.append(el('span', 'font-size:14px;margin:3px', m.enh), enh, btn('OK', () => act(() => { const s = load(); setSword(s, { enh: +enh.value }); save(); note(m.done); }, { stay: true })), btn(m.unlock, () => act(() => { const s = load(); unlockAll(s); save(); reloadSoon(); })));
  v.row.append(er);

  // 전투 중
  const b = section(m.battle, m.battleNote); root.append(b.d);
  const inB = fn => act(sc => (sc?.sys.settings.key === 'Battle' ? fn(sc) : (note(m.inBattle), false)));
  const god = btn(`${m.god}: ${tst.god ? 'ON' : 'OFF'}`, () => { tst.god = !tst.god; god.textContent = `${m.god}: ${tst.god ? 'ON' : 'OFF'}`; }, tst.god);
  b.row.append(god);
  for (const n of [1, 2, 4]) b.row.append(btn(`${m.speed} ${n}x`, () => act(sc => { setSpeed(sc, n); })));
  b.row.append(
    btn(m.lvup, () => inB(sc => levelUpNow(sc))), btn(m.skip, () => inB(sc => skipWave(sc))), btn(m.summon, () => inB(sc => summonBoss(sc))),
    btn(m.win, () => inB(sc => instantResult(sc, true))), btn(m.lose, () => inB(sc => instantResult(sc, false))),
  );

  // 화면 열기
  const s = section(m.screens, m.tutNote); root.append(s.d);
  const inL = fn => act(sc => (sc?.sys.settings.key === 'Lobby' ? fn(sc) : (note(m.inLobby), false)));
  const result = win => act(sc => startBattle(sc, { chapter: 0, stage: 0, endless: false, hard: false, dungeon: null, testGo: { result: win ? 'win' : 'lose' } }));
  s.row.append(
    btn(m.rWin, () => result(true)), btn(m.rLose, () => result(false)),
    btn(m.newPet, () => inL(sc => { const pet = PETS.find(x => !sc.sv.pets?.[x.id]) || PETS[0]; sc.sv.petJoinPending = pet.id; sc.petWin(); })),
    btn(m.shop, () => inL(sc => sc.show('shop'))), btn(m.attend, () => inL(sc => sc.missionWin(false))),
  );
  const nSteps = 9;
  for (let i = 0; i < nSteps; i++) {
    s.row.append(btn(m.tut(i + 1), () => inL(sc => {
      const st = tutorialSteps(sc, true);
      if (!st[i]) return false;
      return !!coachRun(sc, [st[i]], { id: 'test' + i, onEnd() {} });
    })));
  }

  // 테스트 저장
  const sa = section(m.save, []); root.append(sa.d);
  sa.row.append(
    btn(m.copy, () => act(() => { if (copyRealToTest()) reloadSoon(); else note(m.fail); })),
    btn(m.reset, () => act(() => { clearTestSave(); reloadSoon(); })),
    btn(m.off, () => { close(); askDisableTest(); }),
  );
  document.body.append(root);
}

export function installTestPanel(g) {
  if (!isTest() || badge) return;   // 테스트 모드가 아니면 아무것도 만들지 않는다
  game = g;
  badge = el('button', 'position:fixed;left:calc(2px + env(safe-area-inset-left));top:calc(2px + env(safe-area-inset-top));z-index:99999;min-width:44px;min-height:44px;background:#c0392bcc;color:#fff;border:1px solid #fff8;font:inherit;font-size:12px;padding:0 6px;opacity:.85', L().badge);
  badge.onclick = toggle;
  document.body.append(badge);
  window.addEventListener('keydown', e => {
    if (e.key === '`' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); toggle(); }
  });
}
