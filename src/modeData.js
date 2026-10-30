// 모드 데이터(순수 값). 설계표는 docs/modes.md. Phaser·씬에 기대지 않아 codex.js·Lobby가 가볍게 불러 쓴다
import * as D from './data.js';
import { t } from './i18n.js';
import { STAGE_DATA } from './modeStages.js';

export const MODE_N = 15;   // 모드마다 판 수(본편 장 수와 같다)
export const MODE_IDS = ['guard', 'capture', 'breach', 'hunt'];
export const MODE_DEFS = {
  guard: { name: t('modeData.69c4bf'), color: 0x5fc8ff, css: '#5fc8ff', one: t('modeData.6ab7e7'), desc: [t('modeData.ae3cce'), t('modeData.558888'), t('modeData.d49757')], title: t('modeData.55655c'), ach: t('modeData.5b0ef0') },
  capture: { name: t('modeData.7b547e'), color: 0x7ddc6a, css: '#7ddc6a', one: t('modeData.e08bcb'), desc: [t('modeData.dc9602'), t('modeData.67e0bf'), t('modeData.02429a')], title: t('modeData.bfc201'), ach: t('modeData.c96fad') },
  breach: { name: t('modeData.b4d052'), color: 0xff8a5a, css: '#ff8a5a', one: t('modeData.b82968'), desc: [t('modeData.2ad3ec'), t('modeData.e7867c'), t('modeData.da21fd')], title: t('modeData.673268'), ach: t('modeData.51d65f') },
  hunt: { name: t('modeData.05b381'), color: 0xffd75e, css: '#ffd75e', one: t('modeData.16caa3'), desc: [t('modeData.5e7aac'), t('modeData.3ab9cc'), t('modeData.96b4d9')], title: t('modeData.5dff0d'), ach: t('modeData.e3cf27') },
};

// 지금 만들어진 판. 나머지 판은 설계만 있고 로비에서 '준비 중'으로 보인다
// c: 본편 장 번호(0부터). sec: 제한 시간(초). 나머지는 모드 규칙마다 다르다(modes.js)
export const MODE_STAGES = {
  guard: [
    { c: 0, goal: t('modeData.57102c'), note: t('modeData.ec9452'), obj: 'cart', go: true, hp: 2.8, route: 520, speed: 7.5, sec: 170, par: 125, raid: 0.7, cap: 5, raiders: ['slime', 'bat'] },
    { c: 1, goal: t('modeData.848a4d'), note: t('modeData.ee5deb'), obj: 'altar', go: false, hp: 3, sec: 105, keep: 0.6, raid: 0.7, cap: 6, raiders: ['ghost', 'spider'], mult: { spider: 2.5 } },
  ],
  capture: [
    { c: 0, goal: t('modeData.c46b8b'), note: t('modeData.2e5a65'), n: 3, rad: 230, r: 42, cap: 24, sec: 190, par: 105, spawnKind: 'bat' },
    { c: 1, goal: t('modeData.1c8a59'), note: t('modeData.868936'), n: 4, rad: 250, r: 42, cap: 12, sec: 220, par: 125, spawnKind: 'zombie', ghosts: true },
  ],
  breach: [
    { c: 0, goal: t('modeData.e76e1d'), note: t('modeData.6e29d4'), wallName: t('modeData.92af58'), len: 1360, legs: 4, wall: 32, wallDmg: 0.22, torches: 3, par: 100 },
    { c: 1, goal: t('modeData.e76e1d'), note: t('modeData.a4b266'), wallName: t('modeData.3a0d36'), len: 1360, legs: 5, wall: 38, wallDmg: 0.22, webs: 4, par: 100 },
  ],
  hunt: [
    { c: 0, goal: t('modeData.7b3f57'), note: t('modeData.19263b'), sec: 170, par: 110, prey: ['slime', 'bat', 'slime', 'bat', 'skel'] },
    { c: 1, goal: t('modeData.978760'), note: t('modeData.cb8474'), sec: 200, par: 120, prey: ['ghost', 'spider', 'ghost', 'zombie', 'ghost', 'spider'] },
  ],
};

// 3~15장 판(modeStages.js)을 배열 인덱스=장 번호로 합친다
for (const id of Object.keys(STAGE_DATA)) for (const n of Object.keys(STAGE_DATA[id])) MODE_STAGES[id][+n] = STAGE_DATA[id][n];

export const modeStage = (id, n) => MODE_STAGES[id]?.[n];                       // n: 0부터. 없으면 아직 준비 중
export const modeOpen = (sv, n) => (sv.cleared | 0) >= (n + 1) * D.STAGES_PER_CHAPTER;   // 본편 n+1장 보스를 깨면 열린다
// 52차: 모드 입구를 한 번이라도 열었거나 이미 모드를 깬 계정이면 '새로 열림' 안내를 더 띄우지 않는다
export const modeSeen = sv => !!(sv.modes?.seen || Object.keys(sv.modes?.clear || {}).length);
export const modeDone = (sv, id, n) => !!sv.modes?.clear?.[`${id}:${n}`];
export const modeCount = (sv, id) => { let k = 0; for (let n = 0; n < MODE_N; n++) if (modeDone(sv, id, n)) k++; return k; };
// 보상: 본편 같은 장 x-2 기준. 첫 클리어는 금화 ×FIRST_CLEAR_MUL·보석, 다시 깨면 금화 60%·강화석 절반(별 1개 기준)
export const modeReward = (c, first) => ({
  gold: Math.round(D.clearGold(c, 1) * (first ? D.FIRST_CLEAR_MUL : 0.6) / 5) * 5,
  stone: first ? D.clearStone(c, 1) : Math.ceil(D.clearStone(c, 1) / 2),
  gem: first ? D.GEM_FREE.stageFirst : 0,
});

// 50차: 별 3개. ★1 클리어 · ★2 제한 시간(par초) 안에 · ★3 받은 피해가 내 체력의 STAR_HURT 이하
// 저장 modes.stars[키]는 비트 마스크(1·2·4). 첫 클리어 보상은 ★1에 이미 들어 있고, ★2·★3은 처음 따는 순간 따로 준다
export const STAR_HURT = 0.6;
export const fmtT = sec => { const t = Math.max(0, Math.round(sec)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
export const starTexts = cfg => [t('modeData.330ccf'), cfg.par ? t('modeData.8db565', { fmtT: fmtT(cfg.par) }) : t('modeData.636a63', { round: Math.round((cfg.keep || 0.6) * 100) }), t('modeData.9376bf', { round: Math.round(STAR_HURT * 100) })];
export const starMask = (sv, id, n) => sv.modes?.stars?.[`${id}:${n}`] | 0;
export const starCount = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
export const modeStars = (sv, id, n) => starCount(starMask(sv, id, n));
export const modeStarTotal = (sv, id) => { let k = 0; for (let n = 0; n < MODE_N; n++) k += modeStars(sv, id, n); return k; };
export const modeBest = (sv, id, n) => sv.modes?.best?.[`${id}:${n}`] || null;   // { t: 가장 빠른 클리어(초), hurt: 가장 적은 피해(%) }
// 첫 ★2·★3 보너스(별마다 한 번): 금화 0.8판·강화석 절반·보석 3
export const starFirstReward = c => ({ gold: Math.round(D.clearGold(c, 1) * 0.8 / 5) * 5, stone: Math.ceil(D.clearStone(c, 1) / 2), gem: 3 });
// 다시 깰 때 보상: 별 1개는 기존 값 그대로, 별이 늘면 비례해 늘어난다(금화 ×0.6/0.8/1.0, 강화석 ×1/1.5/2)
export const repeatReward = (c, stars) => {
  const k = Math.max(1, Math.min(3, stars)), base = modeReward(c, false);
  return { gold: Math.round(D.clearGold(c, 1) * (0.4 + 0.2 * k) / 5) * 5, stone: Math.ceil(base.stone * (1 + 0.5 * (k - 1))), gem: 0 };
};

// 54차: 도전 증표. 단계를 처음 깨면 1개(그 단계에서 한 번만), 이미 깬 단계를 다시 깨면 하루 MARK_REPEAT_DAY번까지 1개
export const markGot = (sv, id, n) => !!sv.modes?.mark?.[`${id}:${n}`];
export const markLeftToday = sv => Math.max(0, D.MARK_REPEAT_DAY - (sv.markN | 0));
export const markGain = (sv, id, n) => (modeDone(sv, id, n) && markGot(sv, id, n) ? markLeftToday(sv) > 0 : !markGot(sv, id, n)) ? 1 : 0;
