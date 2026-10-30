// 모드 데이터(순수 값). 설계표는 docs/modes.md. Phaser·씬에 기대지 않아 codex.js·Lobby가 가볍게 불러 쓴다
import * as D from './data.js';

export const MODE_N = 15;   // 모드마다 판 수(본편 장 수와 같다)
export const MODE_IDS = ['guard', 'capture', 'breach', 'hunt'];
export const MODE_DEFS = {
  guard: { name: '지키기', color: 0x5fc8ff, css: '#5fc8ff', one: '물건을 지켜라', desc: ['몹이 물건을 노려요.', '물건 HP가 0이 되면 져요.', '버티거나 끝까지 보내면 이겨요.'], title: '수호자', ach: '지키기 15판 완주' },
  capture: { name: '점령', color: 0x7ddc6a, css: '#7ddc6a', one: '거점을 점령하라', desc: ['원 안에 서 있으면 게이지가 차요.', '벗어나면 천천히 빠져요.', '거점을 전부 차지하면 이겨요.'], title: '정복자', ach: '점령 15판 완주' },
  breach: { name: '돌파', color: 0xff8a5a, css: '#ff8a5a', one: '끝까지 달려라', desc: ['위쪽 끝으로 달려요.', '뒤에서 죽음의 벽이 밀려와요.', '벽에 닿으면 큰 피해를 입어요.'], title: '돌파자', ach: '돌파 15판 완주' },
  hunt: { name: '사냥', color: 0xffd75e, css: '#ffd75e', one: '정예를 잡아라', desc: ['정예가 도망 다녀요.', '화면 밖은 화살표가 알려 줘요.', '시간 안에 전부 잡으면 이겨요.'], title: '추적자', ach: '사냥 15판 완주' },
};

// 지금 만들어진 판. 나머지 판은 설계만 있고 로비에서 '준비 중'으로 보인다
// c: 본편 장 번호(0부터). sec: 제한 시간(초). 나머지는 모드 규칙마다 다르다(modes.js)
export const MODE_STAGES = {
  guard: [
    { c: 0, goal: '수레 곁에 서서 끝까지 보내라', note: '수레 곁에 서야 간다 · 박쥐가 수레를 먼저 문다', obj: 'cart', go: true, hp: 2.8, route: 520, speed: 7.5, sec: 170, par: 125, raid: 0.7, cap: 5, raiders: ['slime', 'bat'] },
    { c: 1, goal: '성물함을 105초 동안 지켜라', note: '유령은 겹쳐 통과해 갉는다 · 거미 돌진은 성물함에 크게 먹힌다', obj: 'altar', go: false, hp: 3, sec: 105, keep: 0.6, raid: 0.7, cap: 6, raiders: ['ghost', 'spider'], mult: { spider: 2.5 } },
  ],
  capture: [
    { c: 0, goal: '횃불 터 3곳을 점령하라', note: '서 있으면 차오른다 · 점령 중엔 박쥐 떼가 쏟아진다', n: 3, rad: 230, r: 42, cap: 24, sec: 190, par: 105, spawnKind: 'bat' },
    { c: 1, goal: '무덤 4곳을 점령하라', note: '무덤에서 좀비가 솟는다 · 비워 둔 무덤은 유령이 게이지를 갉는다', n: 4, rad: 250, r: 42, cap: 12, sec: 220, par: 125, spawnKind: 'zombie', ghosts: true },
  ],
  breach: [
    { c: 0, goal: '위쪽 문까지 달려라', note: '이끼 어둠이 밀려온다 · 횃불에 닿으면 벽이 물러난다', wallName: '이끼 어둠', len: 1360, legs: 4, wall: 32, wallDmg: 0.22, torches: 3, par: 100 },
    { c: 1, goal: '위쪽 문까지 달려라', note: '망자의 안개가 밀려온다 · 거미줄에서는 느려진다', wallName: '망자의 안개', len: 1360, legs: 5, wall: 38, wallDmg: 0.22, webs: 4, par: 100 },
  ],
  hunt: [
    { c: 0, goal: '도망치는 정예 5마리를 잡아라', note: '정예는 달리다 멈춘다 · 박쥐 대장은 빠르다', sec: 170, par: 110, prey: ['slime', 'bat', 'slime', 'bat', 'skel'] },
    { c: 1, goal: '도망치는 정예 6마리를 잡아라', note: '유령 대장은 어둠에 숨는다 · 가까이 가야 보인다', sec: 200, par: 120, prey: ['ghost', 'spider', 'ghost', 'zombie', 'ghost', 'spider'] },
  ],
};

export const modeStage = (id, n) => MODE_STAGES[id]?.[n];                       // n: 0부터. 없으면 아직 준비 중
export const modeOpen = (sv, n) => (sv.cleared | 0) >= (n + 1) * D.STAGES_PER_CHAPTER;   // 본편 n+1장 보스를 깨면 열린다
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
export const starTexts = cfg => ['클리어', cfg.par ? `${fmtT(cfg.par)} 안에` : `물건 ${Math.round((cfg.keep || 0.6) * 100)}% 이상`, `받은 피해 ${Math.round(STAR_HURT * 100)}% 이하`];
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
