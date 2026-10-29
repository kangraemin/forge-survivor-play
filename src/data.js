import { gearStats, tagMul, wtypeOf, SP_RESET_GEM } from './gear.js';
// 게임 데이터와 밸런스 수치. 숫자는 전부 여기서만 바꾼다. 근거는 docs/DESIGN.md
export const W = 270, H = 480;

// 챕터: 몬스터 3종 + 보스. dur은 일반 스테이지 길이(초)
export const CHAPTERS = [
  { name: '이끼 폐허', tiles: 'tiles', mobs: ['slime', 'skel', 'bat'], boss: 'kingslime', dur: 150, dark: 0.45, light: 0xff9a3c },
  { name: '망자의 묘지', tiles: 'tile2', mobs: ['zombie', 'ghost', 'spider'], boss: 'lich', dur: 165, dark: 0.6, light: 0x9ad8ff },
  { name: '용암 동굴', tiles: 'tile3', mobs: ['imp', 'golem', 'fskull'], boss: 'lavagolem', dur: 180, dark: 0.5, light: 0xff6a2a },
  { name: '얼어붙은 설원', tiles: 'tile4', mobs: ['wolf', 'yeti', 'icesp'], boss: 'wyrm', dur: 195, dark: 0.35, light: 0xbfe8ff },
  { name: '마왕성', tiles: 'tile5', mobs: ['dknight', 'cultist', 'gargoyle'], boss: 'demonlord', dur: 210, dark: 0.6, light: 0xff4060 },
];
export const STAGES_PER_CHAPTER = 6;

// 몬스터 기본값(1챕터 기준). ai: chase 추적, swarm 빠르고 흔들림, tank 느리고 단단함, float 겹쳐 통과, charge 돌진, ranged 거리 두고 쏨
// sheet/row: 걷기 시트 위치, die: 전용 죽음 시트 행(없으면 공통 연기)
export const MOBS = {
  slime: { sheet: 'mob', row: 0, die: 0, hp: 14, spd: 30, dmg: 6, ai: 'chase', color: 0x6fe36a },
  skel: { sheet: 'mob', row: 1, die: 1, hp: 30, spd: 24, dmg: 7.5, ai: 'tank', color: 0xe8e2c8 },
  bat: { sheet: 'mob', row: 2, die: 2, hp: 8, spd: 52, dmg: 4, ai: 'swarm', color: 0xa45cff },
  zombie: { sheet: 'z2', row: 0, hp: 16, spd: 26, dmg: 6, ai: 'chase', color: 0x7fae5a },
  ghost: { sheet: 'z2', row: 1, hp: 11, spd: 40, dmg: 5, ai: 'float', color: 0xaee6ff },
  spider: { sheet: 'z2', row: 2, hp: 18, spd: 32, dmg: 6.5, ai: 'charge', color: 0x8a4cc0 },
  imp: { sheet: 'z3', row: 0, hp: 10, spd: 54, dmg: 4, ai: 'swarm', color: 0xff5a3a },
  golem: { sheet: 'z3', row: 1, hp: 44, spd: 19, dmg: 7.5, ai: 'tank', color: 0xff9a3a },
  fskull: { sheet: 'z3', row: 2, hp: 13, spd: 30, dmg: 5, ai: 'ranged', color: 0xffc23a },
  wolf: { sheet: 'z4', row: 0, hp: 18, spd: 44, dmg: 6.5, ai: 'charge', color: 0xdff2ff },
  yeti: { sheet: 'z4', row: 1, hp: 48, spd: 21, dmg: 8, ai: 'tank', color: 0xffffff },
  icesp: { sheet: 'z4', row: 2, hp: 13, spd: 30, dmg: 5, ai: 'ranged', color: 0x7fe8ff },
  dknight: { sheet: 'z5', row: 0, hp: 46, spd: 25, dmg: 8, ai: 'tank', color: 0xc04050 },
  cultist: { sheet: 'z5', row: 1, hp: 15, spd: 28, dmg: 5, ai: 'ranged', color: 0xb070ff },
  gargoyle: { sheet: 'z5', row: 2, hp: 14, spd: 52, dmg: 4.5, ai: 'swarm', color: 0x9a9aa8 },
};

export const MOB_NAMES = {
  slime: '슬라임', skel: '해골', bat: '박쥐', zombie: '좀비', ghost: '유령', spider: '거미', imp: '임프', golem: '골렘', fskull: '불해골',
  wolf: '늑대', yeti: '설인', icesp: '얼음 정령', dknight: '암흑 기사', cultist: '사교도', gargoyle: '가고일',
};
// 변종: 스테이지마다 하나씩 새로 나와 판마다 몬스터가 달라 보이게 한다(같은 그림에 색·크기·행동을 바꾼다)
export const VARIANTS = {
  split: { pre: '분열', desc: '쓰러지면 둘로 갈라진다', tint: 0xc070ff },
  swift: { pre: '광폭', desc: '붉게 달아오르면 돌진한다', tint: 0xff5050, spd: 1.35, ai: 'charge' },
  armor: { pre: '철갑', desc: '단단하고 잘 밀리지 않는다', tint: 0x8fa8d0, hp: 1.5, scale: 1.2, kb: 0.25 },
  burst: { pre: '폭탄', desc: '쓰러지면 잠시 뒤 터진다 — 떨어져라', tint: 0xffa030 },
  giant: { pre: '거대', desc: '크고 질기다', tint: 0xffe070, hp: 3, scale: 1.7, spd: 0.8, kb: 0.2 },
};
// 스테이지 s(1~5)에 새로 나오는 변종: [챕터 몹 번호, 변종]. 0번 스테이지는 기본 몹만
export const STAGE_VARIANT = [null, [0, 'split'], [2, 'swift'], [1, 'armor'], [0, 'burst'], [2, 'giant']];
export const VARIANT_RATE = 0.22, VARIANT_OLD_RATE = 0.1;   // 이번 변종 / 앞 스테이지 변종이 섞이는 비율
// 판 규칙: 같은 스테이지도 판마다 다르게 흘러가도록 시작할 때 하나를 뽑는다(안 뽑힐 수도 있다)
export const RUN_MODS = [
  { id: 'horde', name: '떼', desc: '한 종류가 몰려온다' },
  { id: 'mutant', name: '변종 소굴', desc: '변종이 두 배로 나온다' },
  { id: 'rush', name: '질풍', desc: '몹이 빠르지만 약하다', spd: 1.2, hp: 0.85 },
];
export const RUN_MOD_CHANCE = 0.6;

// 보스: sheet/row는 2프레임 시트. hp는 1챕터 배율 기준 값(챕터 배율이 곱해진다)
// rage: 체력 절반 아래에서 새로 섞여 나오는 공격(같은 패턴만 반복된다는 평가)
export const BOSSES = {
  kingslime: { name: '슬라임 왕', sheet: 'boss1', row: 0, hp: 1500, dmg: 12, spd: 26, color: 0x6fe36a, pattern: ['jump', 'summon', 'jump', 'ring'], rage: 'pools' },
  lich: { name: '리치 왕', sheet: 'boss1', row: 1, hp: 1500, dmg: 12, spd: 22, color: 0x9dff7a, pattern: ['ring', 'summon', 'aimed', 'ring'], rage: 'sweep' },
  lavagolem: { name: '용암 거신', sheet: 'boss1', row: 2, hp: 1650, dmg: 14, spd: 18, color: 0xff7a2a, pattern: ['slam', 'ring', 'charge', 'slam'], rage: 'pools' },
  wyrm: { name: '서리 용', sheet: 'boss2', row: 0, hp: 1650, dmg: 14, spd: 30, color: 0x9ae8ff, pattern: ['aimed', 'charge', 'ring', 'aimed'], rage: 'sweep' },
  demonlord: { name: '마왕', sheet: 'boss2', row: 1, hp: 1800, dmg: 15, spd: 28, color: 0xff3a50, pattern: ['charge', 'ring', 'slam', 'summon', 'aimed'], rage: 'sweep' },
  general: { name: '해골 장군', sheet: 'boss2', row: 2, hp: 500, dmg: 11, spd: 24, color: 0xe8e2c8, pattern: ['charge', 'summon', 'aimed'], rage: 'slam' },
};

// 챕터 배율: 무기 등급이 오를 때(약 2.1배) 몬스터 체력도 같이 오른다. 4~5장 벽이 너무 높아 조금 낮췄다
export const chapterHp = c => Math.pow(2.05, c) * GEAR_HP(c);           // c는 0부터
export const chapterDmg = c => 0.65 * Math.pow(1.18, c);   // 1.25면 3장부터 무기 등급 체력 보너스를 앞질러 30초 만에 녹았다
// 스테이지마다 확 어려워진다: 1-1은 누구나 깨고, 1-2부터는 대충 움직이면 죽고 대장간에서 몇 번 강화하면 깬다
// s는 0~5. 1-2에서 바로 벽을 느끼게 크게 뛰고, 1-6 권장이 +10쯤(승급 조건)에 닿게 뒤로 갈수록 완만히
const STAGE_HP = [1, 1.45, 1.7, 1.92, 2.12, 2.3];
export const stageMul = s => STAGE_HP[s] ?? 1;
export const stageDmg = s => 1 + 0.1 * s;                // 피해는 공격력으로 못 막으니 체력보다 완만하게
export const stageSpawn = s => 0.35 * s;                 // 초당 더 나오는 몹 수
// 판 안 시간에 따른 체력 상승(처음 0.75배 → 끝날 즈음 1.7배)
export const timeHp = f => 0.75 + 0.95 * f;          // 초반 몹은 약하고 많게

// ── 무기·대장간 ──
export const TIERS = [
  { name: '녹슨 철검', atk: 10, icon: 0 },
  { name: '강철검', atk: 21, icon: 1 },
  { name: '미스릴검', atk: 44, icon: 2 },
  { name: '룬 대검', atk: 92, icon: 2, tint: 0xffa0ff },
  { name: '전설의 화염검', atk: 190, icon: 3 },
];
// +5·+10·+15·+20을 넘을 때마다 칼이 한 번 더 깨어난다(×1.1). 한 단계 +10%만으론 강해진 게 안 느껴진다
export const ENH_MILESTONE = 5, MILESTONE_MUL = 1.1;
// +11부터는 한 단계마다 ×1.15: 더하기로는 단계가 오를수록 오름폭이 +10%→+8%로 줄어 파괴를 무릅쓸 이유가 없었다
export const OVER10_MUL = 1.15;
export const weaponAtk = (tier, enh) => TIERS[tier].atk * (1 + 0.1 * Math.min(enh, 10)) * Math.pow(OVER10_MUL, Math.max(0, enh - 10)) * Math.pow(MILESTONE_MUL, Math.floor(enh / ENH_MILESTONE));
// 강화 성공 확률(%) — 인덱스는 현재 강화 수치
export const ENH_RATE = [100, 100, 95, 90, 85, 75, 65, 55, 50, 45, 45, 40, 36, 32, 28, 22, 18, 15, 12, 10];
export const ENH_MAX = 20;
export const DESTROY_FROM = 10;                            // +10에서 +11을 노릴 때부터 실패하면 파괴
// 부서지면 두 단계 떨어진다(+0이나 +5까지 떨어지면 성공 +10%에 실패 -32%라 아무도 위험을 지지 않았다)
export const SHATTER_DROP = 2;
export const shatterTo = enh => Math.max(0, enh - SHATTER_DROP);
export const FAIL_REFUND = 0.3;                            // 위험 구간에서 실패하면 금화 30%를 돌려준다
const TIER_COST = [1, 2.2, 4.8, 10.5, 23];
export const enhGold = (tier, enh) => Math.round(40 * TIER_COST[tier] * Math.pow(1.22, enh) / 5) * 5;
export const enhStone = (tier, enh) => Math.ceil((enh + 1) / 2) + tier;
export const PROMOTE_NEED = 10;                            // 승급하려면 +10 이상
export const promoteGold = tier => Math.round(600 * TIER_COST[tier + 1] / 50) * 50;
// 승급하면 지금 공격력 이상이 되는 가장 낮은 강화 수치에서 시작한다(+0부터면 223 → 190으로 약해졌다)
export const promoteEnh = (tier, enh) => { let e = 0; while (e < PROMOTE_NEED - 1 && weaponAtk(tier + 1, e) < weaponAtk(tier, enh)) e++; return e; };

// ── 스테이지 보상(금화·강화석) ──
export const clearGold = (c, s) => Math.round(75 * TIER_COST[c] * (1 + 0.2 * s) / 5) * 5;
export const FIRST_CLEAR_MUL = 2.5;
export const clearStone = (c, s) => 3 + s + c * 2;
export const FAIL_STONE_RATE = 0.5;                        // 져도 강화석을 같은 식으로 조금 준다(0개면 허탈했다)
// 자리를 비운 동안 견습생이 번다: 30분 넘게 비우면, 최대 8시간까지 시간당 지금 스테이지 클리어 보상의 50%(25%면 8시간이 두 판어치라 돌아올 맛이 없었다)
export const IDLE = { minMin: 30, capH: 8, perH: 0.5, bonusH: 12, bonusGem: 10 };   // 12시간 넘게 비웠으면 보석도 조금
export const FREE_REVIVE_RUNS = 3;   // 처음 세 판은 부활이 공짜(첫 판부터 광고를 들이밀지 않는다)
// 보스가 이 시간(ms) 넘게 버티면 지쳐서 받는 피해가 늘어난다(보스전이 늘어지지 않게)
export const BOSS_TIRED = { ms: 75000, mul: 1.5 };
export const FAIL_GOLD_RATE = 0.5;                         // 실패해도 버틴 시간 비율 × 클리어 금화의 50%를 준다
// 은화는 판이 끝나면 사라진다(아껴 두지 말고 상점에서 바로 쓰게)
export const SWEEP_DAILY = 5, SWEEP_MAX = 12;

// ── 훈련(영구 능력치). v는 레벨당 효과 ──
export const TRAINING = [
  { id: 'hp', name: '체력', desc: '최대 체력', v: 0.06, unit: '%', max: 15, base: 50 },
  { id: 'atk', name: '근력', desc: '모든 피해', v: 0.03, unit: '%', max: 15, base: 60 },
  { id: 'def', name: '갑옷', desc: '받는 피해 감소', v: 0.015, unit: '%', max: 20, base: 70 },
  { id: 'spd', name: '신속', desc: '이동 속도', v: 0.02, unit: '%', max: 10, base: 60 },
  { id: 'mag', name: '자력', desc: '줍는 거리', v: 0.1, unit: '%', max: 10, base: 40 },
  { id: 'luck', name: '행운', desc: '은화·치명타', v: 0.04, unit: '%', max: 10, base: 80 },
  { id: 'regen', name: '회복', desc: '초당 체력 회복', v: 0.1, unit: '', max: 10, base: 90 },
  { id: 'revive', name: '부활', desc: '한 판에 한 번 되살아남', v: 1, unit: '회', max: 1, base: 2500 },
];
// 5레벨마다 이정표: 한 레벨치 효과를 덤으로 준다(부활 같은 1회짜리는 제외)
export const TRAIN_MILE = 5, TRAIN_MILE_BONUS = 1;
export const trainVal = (t, lv) => (lv + (t.max >= TRAIN_MILE ? Math.floor(lv / TRAIN_MILE) * TRAIN_MILE_BONUS : 0)) * t.v;
// 전투력: 무기 공격력에 훈련(근력·체력·갑옷)을 합친 값. 권장 전투력과 비교한다(훈련만 올려도 숫자가 오른다)
// 장비(능력치·세트)와 무기 종류의 주 스탯(검·도끼 힘, 창 민첩)도 넣는다
export const powerOf = sv => {
  const tv = id => trainVal(TRAINING.find(t => t.id === id), sv.train?.[id] || 0);
  const g = gearStats(sv);
  return Math.round(weaponAtk(sv.tier, sv.enh) * (1 + tv('atk') + g.atk) * tagMul(sv, wtypeOf(sv).tag) * (1 + (tv('hp') + g.hp) * 0.25 + Math.min(0.6, tv('def') + g.def) * 0.5));
};
// 스테이지별 권장 전투력: 그 챕터 무기 등급에서 강화를 조금씩 더 올려야 깨지게
// 보스 판은 봇 실측에서 권장 100~130%로도 졌다: 권장을 올려 화면이 '충분'이라고 속이지 않게 한다
export const recPower = (c, s) => Math.round(TIERS[Math.min(c, TIERS.length - 1)].atk * stageMul(s) * (s === 5 ? 1.25 : 1) * GEAR_HP(c));
// 2장부터 장비·스탯으로 늘어나는 힘만큼 몹 체력과 권장 전투력을 올린다(1장은 장비 없이도 깨지게 그대로). 스탯(1점 +2%, 5점 보너스)까지 넣고 sim 완주 중앙 5.4h로 맞춘 값
export const GEAR_HP = c => 1 + 0.36 * c;
// 전투력 색: 권장을 넘어도 보스 판은 20% 여유가 있어야 초록(20차 봇: 1-6 권장 114%에서 졌다)
export const powerCol = (pw, rp, s) => pw >= rp * (s === 5 ? 1.2 : 1) ? '#5fdc6a' : pw >= rp ? '#ffd75e' : '#ff8070';
export const trainCost = (t, lv) => Math.round(t.base * Math.pow(1.23, lv) / 5) * 5;

// ── 판 안 성장 ──
export const PLAYER = { hp: 100, spd: 84, iframe: 600, pickup: 46 };
// 몹이 많아진 만큼 레벨업 간격을 늘리되, Lv6부터는 40% 줄여 한 판 안에 진화까지 닿게 한다
// 2레벨은 바로, 3~5레벨은 고르게(17차 150초에 Lv5, 18차 20초에 카드 4연타, 19차 20초에 3장 뒤 30초 공백)
const XP_EARLY = [0, 5, 18, 30, 38, 50];
export const xpNeed = lv => lv <= 5 ? XP_EARLY[lv] : Math.max(53, Math.round((8 + (lv - 1) * 11) * 0.6));
export const PASSIVE_LV3 = 3;                                         // 이 레벨에 닿으면 한 번 더 붙는 보너스
export const ACTIVE_SLOTS = 4, PASSIVE_SLOTS = 4, SKILL_MAX = 5;

// 액티브 스킬. lv별 수치는 Battle에서 lv로 계산한다
export const SKILLS = {
  sword: { name: '검 휘두르기', type: 'active', icon: 0, desc: ['가장 가까운 적을 벤다', '피해 +25%', '뒤쪽도 함께 벤다', '범위 +20%', '피해 +40%, 빨라진다'] },
  spin: { name: '회전 베기', type: 'active', icon: 4, desc: ['주변을 한 바퀴 벤다', '피해 +30%', '범위 +20%', '더 자주 쓴다', '두 바퀴 돈다'] },
  dagger: { name: '투척 단검', type: 'active', icon: 5, desc: ['가까운 적에게 단검을 던진다', '단검 +1', '피해 +30%', '단검 +1, 관통', '단검 +2'] },
  bolt: { name: '번개', type: 'active', icon: 6, desc: ['무작위 적에게 벼락', '벼락 +1', '피해 +40%', '벼락 +1', '번개가 튄다'] },
  holy: { name: '성역', type: 'active', icon: 7, desc: ['발밑의 빛이 계속 태운다', '범위 +20%', '피해 +30%', '적을 느리게 한다', '범위 +30%'] },
  fireball: { name: '화염구', type: 'active', icon: 8, desc: ['터지는 불덩이를 쏜다', '피해 +30%', '폭발 범위 +30%', '불덩이 +1', '바닥에 불이 남는다'] },
  ice: { name: '얼음 파편', type: 'active', icon: 9, desc: ['꿰뚫는 얼음을 쏜다', '파편 +1', '적을 얼린다', '피해 +40%', '파편 +2'] },
  // 무기 전용 스킬: 그 무기를 든 판에서만 레벨업 카드에 나온다(진화 없음)
  wave: { name: '검기', type: 'active', icon: 0, tint: 0x9ad8ff, own: 'sword', desc: ['베는 방향으로 검기를 날린다', '피해 +30%', '검기 +1', '꿰뚫는다', '검기 +2, 커진다'] },
  javelin: { name: '투창', type: 'active', icon: 5, tint: 0xa8ffb0, own: 'spear', desc: ['가장 먼 적에게 창을 던진다', '피해 +30%', '창 +1', '맞은 적을 밀친다', '창 +2'] },
  quake: { name: '지진', type: 'active', icon: 4, tint: 0xffb050, own: 'axe', desc: ['발밑에서 충격파가 퍼진다', '범위 +20%', '피해 +40%', '더 자주 쓴다', '두 번 퍼진다'] },
  orb: { name: '수호 구슬', type: 'active', icon: 11, tint: 0x9ad0ff, desc: ['구슬이 몸 주위를 돈다', '구슬 +1', '피해 +30%', '구슬 +1', '구슬 +1, 빨라진다'] },
  might: { name: '숫돌', type: 'passive', icon: 0, tint: 0xff9a5a, desc: ['피해 +10%'], bonus: '피해 +10% 더' },
  haste: { name: '신속 물약', type: 'passive', icon: 10, desc: ['이동 속도 +8%'], bonus: '이동 속도 +8% 더' },
  focus: { name: '집중', type: 'passive', icon: 15, desc: ['재사용 대기 -8%'], bonus: '재사용 대기 -6% 더' },
  area: { name: '넓은 칼날', type: 'passive', icon: 4, tint: 0x8affa0, desc: ['공격 범위 +10%'], bonus: '공격 범위 +10% 더' },
  magnet: { name: '자석', type: 'passive', icon: 13, desc: ['줍는 거리 +30%'], bonus: '줍는 거리 +40% 더' },
  vigor: { name: '활력', type: 'passive', icon: 14, desc: ['최대 체력 +20, 회복 +0.3/초'], bonus: '회복 +0.6/초 더' },
};
export const PASSIVE_KEYS = ['might', 'haste', 'focus', 'area', 'magnet', 'vigor'];

// ── 판 안 상점(웨이브 사이) ──
// 가격 = 내림((기본가 + 회차×3) × (1 + 0.1×회차)) — 브로타토 가격 공식 변형. 회차는 이번 판에서 상점이 열린 횟수(0부터)
export const SHOP_ITEMS = [
  { id: 'meat', name: '회복 물약', icon: 14, price: 18, desc: '체력 40% 회복' },
  { id: 'whet', name: '숫돌 갈기', icon: 0, price: 30, desc: '이번 판 피해 +8%' },
  { id: 'boots', name: '신속 물약', icon: 10, price: 22, desc: '이번 판 이동 +6%' },
  { id: 'heart', name: '철벽 방패', icon: 11, price: 34, desc: '이번 판 최대 체력 +15' },
  { id: 'tome', name: '수련서', icon: 15, price: 40, desc: '즉시 레벨 업' },
  { id: 'chest', name: '빛의 축복', icon: 7, price: 55, desc: '가진 스킬 하나 +1' },
  { id: 'mana', name: '마나 수정', icon: 13, price: 20, desc: '궁극기 게이지 가득' },
  { id: 'magnet', name: '탐욕의 동전', icon: 12, price: 16, desc: '이번 판 줍는 거리 +25%' },
];
export const SHOP_SLOTS = 4;
export const shopPrice = (base, round) => Math.floor((base + round * 3) * (1 + 0.1 * round));
export const rerollCost = (round, n) => 3 + round + 2 * n;   // n: 이번 상점에서 리롤한 횟수

// 웨이브: 일반 스테이지는 3웨이브(사이 상점 2번), 보스 스테이지는 2웨이브 + 보스
export const WAVES = 3;

// 궁극기(마나): 처치로 차고 가득 차면 버튼으로 쓴다
// 처치 +1, 엘리트 +10, 피격 +2. 발동: 화면 전체 큰 피해 + 2초 무적(보스는 피해 절반)
export const MANA_MAX = 100;
export const MANA_KILL = 1, MANA_ELITE = 10, MANA_HURT = 2;

// ── 드롭 ──
export const DROP = {
  silver: 0.55,        // 일반 몹 은화 확률(1개)
  heal: 0.02,          // 고기(최대 체력 15%) 기본 확률
  healLow: 0.03,       // 체력 40% 이하일 때 추가
  healCrit: 0.06,      // 체력 30% 이하일 때 추가
  healPity: 90000,     // 마지막 고기 뒤 90초 지나면 다음 처치에 확정
  magnet: 0.002,       // 화면의 보석을 다 끌어오는 자석
  eliteSilver: [15, 25],
  bossSilver: 100,
};
export const HEAL_PCT = 0.15;

// ── 과금 ──
// 보석: 유료 재화. 무료로도 꾸준히 모인다(출석·첫 클리어·광고). 보석 1개 ≈ 10원
// 보석으로는 '시간'과 '안전'을 산다(소탕권·방지권·강화석). 무기 공격력을 직접 팔지 않아 실력·강화의 재미를 지킨다
export const GEM_FREE = { daily: 20, stageFirst: 5, bossFirst: 50 };
export const IAP = [
  { id: 'starter', name: '초보 대장장이 꾸러미', price: 1200, once: true, tag: '1회 한정 · 가치 8배', desc: '보석300 방지권3 강화석60 금화3천', give: { gem: 300, guard: 3, stone: 60, gold: 3000 } },
  { id: 'pass', name: '대장장이 월정액', price: 4900, tag: '총 보석 2,100 · 하루 163원 · 매일 소탕권 +3', give: { gem: 300 }, passDays: 30 },
  { id: 'noads', name: '광고 제거', price: 5900, once: true, tag: '광고 없이 바로 보상', give: { gem: 100 }, noAds: true },
  { id: 'gem1', name: '보석 한 줌', price: 1200, give: { gem: 120 } },
  { id: 'gem2', name: '보석 주머니', price: 5900, tag: '인기 · +10%', give: { gem: 650 } },
  { id: 'gem3', name: '보석 상자', price: 12000, tag: '+17%', give: { gem: 1400 } },
];
// 보석 묶음은 처음 살 때 보석 2배
export const FIRST_BUY_X2 = ['gem1', 'gem2', 'gem3'];
export const PASS_DAILY = { gem: 60, sweep: 3 };
// 보석으로 사는 것. gold 꾸러미는 지금 도전 중인 스테이지 클리어 금화의 3배
// 행운 부적: 강화 한 번 성공 확률 +5%p(1회 소모). 부서진 칼 되살리기: 보석 30 + 단계×10
export const CHARM_RATE = 5;
// 레벨업 카드 추방(이번 판에서 다시 안 나옴) 횟수
export const BANISH_PER_RUN = 2;
// 공짜 빼기·다시 뽑기를 다 쓰면 보석으로 더 쓴다
export const BAN_GEM = 5, REROLL_GEM = 5;
// 무한의 탑: 1장 보스를 깨면 열린다. 층(웨이브)마다 몹이 세지고 3층마다 해골 장군
export const ENDLESS = { unlock: 6, floorSec: 50, maxF: 3, gemPerNewFloor: 5, stonePerFloor: 2, goldPerFloor: 0.3, hpGrow: 1.22, dmgGrow: 1.12 };
// 칼빛(궤적 색) 꾸미기: 능력치는 그대로, 보이는 것만 바뀐다
export const SKINS = [
  { id: '', name: '기본 칼빛', desc: '강화 단계 색', cost: 0 },
  { id: 'flame', name: '불꽃 칼빛', desc: '붉은 불길이 남는다', hue: 175, tint: 0xff5a2a, cost: 300 },
  { id: 'silver', name: '은빛 칼빛', desc: '하얀 달빛이 남는다', gray: true, tint: 0xffffff, cost: 600 },
  { id: 'gold', name: '황금 칼빛', desc: '금빛 궤적 + 불티', hue: -150, tint: 0xffd75e, cost: 1200, ember: true },
];
export const restoreGem = enh => 30 + enh * 10;
export const GEM_SHOP = [
  { id: 'guard', name: '파괴 방지권', icon: 11, cost: 80, give: { guard: 1 } },
  { id: 'charm', name: '행운 부적', icon: 7, cost: 120, give: { charm: 1 } },
  { id: 'sweep', name: '소탕권 5장', icon: 15, cost: 40, give: { sweep: 5 } },
  { id: 'stone', name: '강화석 40개', icon: 13, cost: 60, give: { stone: 40 } },
  { id: 'gold', name: '금화 꾸러미', icon: 12, cost: 100, give: { goldStage: 3 } },
  { id: 'spReset', name: '스탯 초기화권', icon: 14, cost: SP_RESET_GEM, give: { spReset: 1 } },
];
// 보상형 광고: 하루 횟수 제한
export const ADS = {
  gem: { name: '보석 +15', daily: 3, give: { gem: 15 } },
  sweep: { name: '소탕권 +2', daily: 2, give: { sweep: 2 } },
  double: { daily: 10 },   // 클리어 보상 2배
};
export const REVIVE_GEM = 30; // 쓰러졌을 때 보석 부활(판당 1번, 광고 부활과 같은 기회)

// ── 매일 할 일: 임무 3개 + 출석 7일 ──
export const MISSIONS = [
  { id: 'kill', name: '몬스터 100마리 처치', need: 100 },
  { id: 'clear', name: '스테이지 클리어·소탕 1번', need: 1 },
  { id: 'enh', name: '대장간에서 강화 1번', need: 1 },
];
export const MISSION_GIVE = { gem: 5, stone: 2 };
export const MISSION_ALL = { gem: 10 };
// 출석: 하루 빠지면 처음으로 돌아가지 않고 그 자리에 멈춘다
export const LOGIN_REWARDS = [
  { goldStage: 1 }, { stone: 20 }, { guard: 1 }, { goldStage: 2 }, { sweep: 3 }, { stone: 40 }, { gem: 100, skin: 'flame' },  // 7일째: 처음 한 번은 불꽃 칼빛까지
];

// ── 진화: 액티브 5레벨 + 짝 패시브를 가지면 레벨업 카드에 진화가 뜬다 ──
export const EVOS = {
  sword: { need: 'might', name: '폭풍검', desc: '사방을 베고 피해 2배' },
  spin: { need: 'haste', name: '칼바람', desc: '세 바퀴 돌고 훨씬 자주' },
  dagger: { need: 'focus', name: '천검', desc: '사방으로 단검 10개 관통' },
  bolt: { need: 'area', name: '연쇄 번개', desc: '벼락 5개가 4마리씩 튄다' },
  holy: { need: 'vigor', name: '심판의 땅', desc: '범위 넓게, 태우며 회복' },
  fireball: { need: 'magnet', name: '용암 비', desc: '화면 곳곳에 불덩이 비' },
  orb: { need: 'area', name: '태양 고리', desc: '큰 구슬 6개가 넓고 빠르게 돈다' },
  ice: { need: 'focus', name: '눈보라', desc: '사방으로 얼음 12개, 맞으면 언다' },
};
