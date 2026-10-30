// 그림 지연 로딩: 첫 화면(1-1 전투 또는 로비)에 꼭 필요한 그림만 Boot에서 받고, 나머지는 뒤에서 받는다.
//  - Boot.preload가 모든 그림 목록을 registerAssets로 등록하고, criticalKeys가 고른 것만 바로 받는다.
//  - Lobby·Battle은 시작 직전(preload)에 그 화면이 쓰는 그림을 받아 두고(ensure), 끝나면 애니메이션을 다시 맞춘다.
//  - startBg는 화면이 뜬 뒤 남은 그림을 장면 밖 로더(BgLoad)로 순서대로 받는다.
//  - 아직 안 받은 그림은 코드가 textures.exists로 건너뛰거나(대체 그림) 시작 전에 기다린다.
import { equippedLook } from './cosmetics.js';
import { STAGES_PER_CHAPTER } from './data.js';
import { load } from './save.js';

const reg = new Map();   // key -> ['image'|'spritesheet', key, url, cfg]
export const registerAssets = list => { for (const it of list) reg.set(it[1], it); };
const items = pred => [...reg.values()].filter(it => pred(it[1]));
const chNo = sv => Math.min(18, Math.floor(((sv?.cleared | 0)) / STAGES_PER_CHAPTER) + 1);   // 로비가 처음 보여 주는 장(1부터)

// 장 n의 그림: 몹·바닥·소품·로비 배경·(16~18장) 보스·장치
const chapterTest = (n, lobby = true) => k => {
  const m = /^(z|tile|prop|lobby_bg|boss|gimmick)(\d+)(?:_|$)/.exec(k);
  return !!m && +m[2] === n && (m[1] !== 'boss' || n >= 16) && (lobby || m[1] !== 'lobby_bg');
};
const bossTest = k => /^(boss|mid)\d/.test(k) && !/^boss(1[6-8])/.test(k);
const equippedTest = look => {
  const ids = Object.values(look || {}).filter(Boolean);
  const re = ids.length ? new RegExp(`^cos_(${ids.join('|')})(_\\d|_slash)?$`) : null;
  return k => !!re && re.test(k) || ids.some(id => k === `cos_aura_${id}`);
};
const lobbyTest = sv => {
  const n = chNo(sv);
  return k => ['forge_bg', 'bell', 'ban_ch16', 'ban_ch16_big'].includes(k) || k === `lobby_bg${n}` || (k === 'lobby_bg' && !reg.has(`lobby_bg${n}`)) || /^ma_mode_/.test(k);   // 장 배경이 없는 장만 기본 배경
};

// Boot가 지금 받을 그림: 주인공·기본 몹·효과·아이콘·무기와 지금 입은 꾸미기(+재방문이면 로비 그림)
export function criticalKeys(sv, { REQUIRED, ICONS }) {
  const base = new Set([...REQUIRED, ...ICONS, 'icons_r0', 'icons_r1', 'icons_r2', 'icons_r3', 'boss1_r0', 'boss1_r1', 'boss1_r2', 'cos_fx', 'cos_fx2']);
  const eq = equippedTest(equippedLook(sv));
  const first = (sv.stats?.runs | 0) === 0 && (sv.cleared | 0) === 0;
  const lob = first ? () => false : lobbyTest(sv);
  return k => base.has(k) || /^(hn_|w_)/.test(k) || eq(k) || lob(k);
}

// 장면 안 로더에 아직 없는 그림만 올린다(받을 게 있으면 true)
function queue(scene, pred) {
  let n = 0;
  for (const [t, k, u, c] of items(pred)) {
    if (scene.textures.exists(k)) continue;
    if (t === 'image') scene.load.image(k, u); else scene.load.spritesheet(k, u, c);
    n++;
  }
  return n > 0;
}

// Battle·Lobby 시작 직전에 부른다(scene.preload 안). 이 화면이 쓸 그림을 모두 받은 뒤에 create가 돈다
export function ensureBattle(scene) {
  const sv = scene.sv, n = (scene.c | 0) + 1, ch = chapterTest(n, false), eq = equippedTest(scene.cosLook);
  const early = n === 1 && (scene.s | 0) === 0 && !scene.mode && !scene.endless && !scene.dungeon;   // 1-1: 기본 그림만으로 충분하다
  const t = [ch, eq, k => (n >= 2 || scene.mode) && bossTest(k)];
  if (!early) t.push(k => /^(x_|pr_|role_|status_|fx_mark_target)/.test(k));   // 보스 연출(fx2)·펫 역할 그림
  if (scene.mode) t.push(k => /^ma_/.test(k));
  return queue(scene, k => t.some(f => f(k)));
}
// 프롤로그처럼 정해진 그림만 받는 화면용(scene.preload 안): 키가 test에 맞는 것 중 아직 없는 것을 올린다
export const ensureKeys = (scene, test) => queue(scene, test);
export function ensureLobby(scene, data) {
  const sv = load(), lob = lobbyTest(sv), eq = equippedTest(equippedLook(sv));
  return queue(scene, k => lob(k) || eq(k) || (data?.modeSel && /^ma_/.test(k)));
}

// 같은 그림을 화면 로더와 뒤 로더가 거의 동시에 받아도 두 번째 등록은 조용히 버린다(Phaser는 '키가 이미 있다'를 오류로 찍는다)
export function quietDupes(game) {
  const tm = game.textures, ck = tm.checkKey;
  tm.checkKey = function (key) { return key && this.exists(key) ? false : ck.call(this, key); };
}

// ── 뒤에서 받기 ──
export class BgLoad extends Phaser.Scene {
  constructor() { super('BgLoad'); }
}
export function startBg(game, buildAnims, sv) {
  if (game.scene.getScene('BgLoad')) return;
  const sc = game.scene.add('BgLoad', BgLoad, true);
  const n = chNo(sv);
  const rest = [];   // 나머지 장: 가까운 장부터
  for (let d = 0; d <= 18; d++) for (const c of [n + d, n - d]) if (c >= 1 && c <= 18 && !rest.includes(c)) rest.push(c);
  const steps = [
    k => /^(x_|pr_|role_|status_|fx_mark_target)/.test(k),
    chapterTest(n), bossTest, k => /^(ma_|ban_)/.test(k),
    k => /^cos_/.test(k),
    ...rest.map(chapterTest),
  ];
  const run = scene => {
    const next = () => {
      const pred = steps.shift();
      if (!pred) return;
      if (!queue(scene, pred)) return next();
      scene.load.once('complete', () => { try { buildAnims(scene); } catch { /* 무시 */ } setTimeout(next, 60); });
      scene.load.start();
    };
    next();
  };
  const go = () => { const s = game.scene.getScene('BgLoad'); if (s?.load) run(s); };
  // 첫 화면(로비 또는 전투)이 열리고 1.5초 뒤에 시작: 화면 전환에 필요한 그림과 대역폭을 다투지 않는다
  const wait = setInterval(() => {
    if (!(game.scene.isActive('Lobby') || game.scene.isActive('Battle'))) return;
    clearInterval(wait); setTimeout(go, 1500);
  }, 300);
}

// Battle·Lobby에 preload와 애니메이션 재정렬을 붙인다(그 파일들은 고치지 않는다)
export function installLazy(Battle, Lobby, buildAnims) {
  Battle.prototype.preload = function () { ensureBattle(this); };
  const bc = Battle.prototype.create;
  Battle.prototype.create = function (...a) { buildAnims(this); return bc.apply(this, a); };
  const li = Lobby.prototype.init;
  Lobby.prototype.init = function (data) { this._lazyData = data; return li.call(this, data); };
  Lobby.prototype.preload = function () { ensureLobby(this, this._lazyData); };
  const lc = Lobby.prototype.create;
  Lobby.prototype.create = function (...a) { buildAnims(this); return lc.apply(this, a); };
}
