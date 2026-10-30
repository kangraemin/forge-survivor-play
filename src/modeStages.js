import { t } from './i18n.js';
// 모드 3~15장 판 데이터(순수 값). 규칙 코드는 modeRules.js(지키기·점령·사냥)와 modeBreach.js(돌파)
// 설계표 docs/modes.md. tw는 그 판의 '규칙 비틀기' 한 줄(문서·보고용), rule은 규칙 함수 이름
// c: 본편 장 번호(0부터). sec: 제한 시간(초). 판 길이 목표는 90초~2분
export const STAGE_DATA = {
  guard: {
    2: { c: 2, goal: t('modeStages.4e5b15'), note: t('modeStages.704265'), obj: 'cart', go: true, hp: 3, route: 560, speed: 6.4, sec: 210, raid: 0.7, cap: 5, raiders: ['imp', 'fskull'], shooters: ['fskull'], rule: 'lavaCart', tw: t('modeStages.c18a49') },
    3: { c: 3, goal: t('modeStages.0b977d'), note: t('modeStages.390dee'), obj: 'cart', go: true, hp: 3, route: 560, speed: 6, sec: 210, raid: 0.75, cap: 5, raiders: ['wolf'], rule: 'iceSled', tw: t('modeStages.cd4e82') },
    4: { c: 4, goal: t('modeStages.23a7ce'), note: t('modeStages.b21d26'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['cultist', 'gargoyle'], shooters: ['cultist'], rule: 'sigil', tw: t('modeStages.9cddf4') },
    5: { c: 5, goal: t('modeStages.d4cce5'), note: t('modeStages.a69c37'), obj: 'cart', go: true, hp: 3, route: 540, speed: 6.4, sec: 210, raid: 0.7, cap: 5, raiders: ['drowned'], rule: 'tideCart', tw: t('modeStages.149ff2') },
    6: { c: 6, goal: t('modeStages.0bf16c'), note: t('modeStages.8f5a04'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['toxslime', 'sporespider'], rule: 'herbJar', tw: t('modeStages.677278') },
    7: { c: 7, goal: t('modeStages.da5298'), note: t('modeStages.de33ec'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['crystbat', 'prism'], shooters: ['prism'], rule: 'crystalCore', tw: t('modeStages.ddb1b5') },
    8: { c: 8, goal: t('modeStages.491171'), note: t('modeStages.78cc2a'), obj: 'cart', go: true, hp: 3, route: 560, speed: 6.2, sec: 210, raid: 0.7, cap: 5, raiders: ['galewolf'], rule: 'sailCart', tw: t('modeStages.e6103a') },
    9: { c: 9, goal: t('modeStages.60a827'), note: t('modeStages.69cee6'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['abysspider'], rule: 'lantern', tw: t('modeStages.3ec252') },
    10: { c: 10, goal: t('modeStages.5d765f'), note: t('modeStages.b21cbe'), obj: 'cart', go: true, hp: 3, route: 540, speed: 6.4, sec: 210, raid: 0.7, cap: 5, raiders: ['scorpion'], rule: 'caravan', tw: t('modeStages.41dc94') },
    11: { c: 11, goal: t('modeStages.1ad96c'), note: t('modeStages.7fbc32'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['clockimp'], rule: 'boiler', tw: t('modeStages.0bb644') },
    12: { c: 12, goal: t('modeStages.6e10a7'), note: t('modeStages.f53994'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['stormwolf'], rule: 'lightningAltar', tw: t('modeStages.f73900') },
    13: { c: 13, goal: t('modeStages.0de528'), note: t('modeStages.768f22'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['mirrorknight', 'glassgarg'], rule: 'statue', tw: t('modeStages.a94f13') },
    14: { c: 14, goal: t('modeStages.cb4216'), note: t('modeStages.a085fc'), obj: 'altar', go: false, hp: 3, sec: 105, raid: 0.7, cap: 6, raiders: ['anvilimp', 'flamegiant'], rule: 'anvilGuard', tw: t('modeStages.3d72bc') },
  },
  capture: {
    2: { c: 2, goal: t('modeStages.2e1d82'), note: t('modeStages.259e06'), n: 3, rad: 240, r: 44, cap: 22, sec: 230, spawnKind: 'imp', rule: 'lavaPads', tw: t('modeStages.65b378') },
    3: { c: 3, goal: t('modeStages.e4a3c5'), note: t('modeStages.556460'), n: 4, rad: 250, r: 42, cap: 16, sec: 230, spawnKind: 'wolf', rule: 'blizzard', tw: t('modeStages.11e8b0') },
    4: { c: 4, goal: t('modeStages.99c9be'), note: t('modeStages.93c205'), n: 3, rad: 235, r: 44, cap: 21, sec: 230, spawnKind: 'cultist', rule: 'sigilRing', tw: t('modeStages.26ea31') },
    5: { c: 5, goal: t('modeStages.1a80b8'), note: t('modeStages.510cc5'), n: 3, rad: 240, r: 44, cap: 22, sec: 230, spawnKind: 'drowned', rule: 'floodAltars', tw: t('modeStages.043f9d') },
    6: { c: 6, goal: t('modeStages.c0fbb8'), note: t('modeStages.130adb'), n: 4, rad: 255, r: 44, cap: 16, sec: 230, spawnKind: 'toxslime', rule: 'dryLands', tw: t('modeStages.c772f4') },
    7: { c: 7, goal: t('modeStages.d2a784'), note: t('modeStages.b5a63a'), n: 3, rad: 230, r: 46, cap: 22, sec: 230, spawnKind: 'crystbat', rule: 'resonance', tw: t('modeStages.e7fff4') },
    8: { c: 8, goal: t('modeStages.38dba0'), note: t('modeStages.a4c7c1'), n: 4, rad: 255, r: 44, cap: 16, sec: 230, spawnKind: 'galegarg', rule: 'flagpoles', tw: t('modeStages.d3cb9d') },
    9: { c: 9, goal: t('modeStages.ddac76'), note: t('modeStages.2fb26d'), n: 3, rad: 300, r: 46, cap: 21, sec: 240, spawnKind: 'voidslime', rule: 'lighthouses', tw: t('modeStages.c90f5f') },
    10: { c: 10, goal: t('modeStages.e19a36'), note: t('modeStages.a6a3c4'), n: 3, rad: 240, r: 52, cap: 22, sec: 230, spawnKind: 'scorpion', rule: 'oasis', tw: t('modeStages.ea887b') },
    11: { c: 11, goal: t('modeStages.4498c5'), note: t('modeStages.4c821b'), n: 4, rad: 255, r: 44, cap: 16, sec: 230, spawnKind: 'clockimp', rule: 'valves', tw: t('modeStages.4df6ab') },
    12: { c: 12, goal: t('modeStages.c89ced'), note: t('modeStages.4bb780'), n: 3, rad: 245, r: 46, cap: 22, sec: 230, spawnKind: 'stormwolf', rule: 'rodPillars', tw: t('modeStages.dc3f2c') },
    13: { c: 13, goal: t('modeStages.5b1b72'), note: t('modeStages.9ba636'), n: 3, rad: 230, r: 46, cap: 10, sec: 230, spawnKind: 'phantompriest', rule: 'prisms', tw: t('modeStages.d668d5') },
    14: { c: 14, goal: t('modeStages.3e10d8'), note: t('modeStages.412480'), n: 4, rad: 255, r: 46, cap: 18, sec: 240, spawnKind: 'anvilimp', rule: 'anvilZones', tw: t('modeStages.bb710c') },
  },
  breach: {
    2: { c: 2, goal: t('modeData.e76e1d'), note: t('modeStages.bc45a7'), path: true, wall: 56, wallDmg: 0.22, rule: 'lavaFlood', tw: t('modeStages.445a2d') },
    3: { c: 3, goal: t('modeData.e76e1d'), note: t('modeStages.83eaa7'), path: true, wall: 56, wallDmg: 0.22, rule: 'avalanche', tw: t('modeStages.169bda') },
    4: { c: 4, goal: t('modeData.e76e1d'), note: t('modeStages.5cb076'), path: true, wall: 61, wallDmg: 0.22, rule: 'sealStones', tw: t('modeStages.0ee1fa') },
    5: { c: 5, goal: t('modeData.e76e1d'), note: t('modeStages.5083d5'), path: true, wall: 54, wallDmg: 0.22, rule: 'tidalWave', tw: t('modeStages.02e042') },
    6: { c: 6, goal: t('modeData.e76e1d'), note: t('modeStages.98750c'), path: true, wall: 54, wallDmg: 0.22, rule: 'fogCurrent', tw: t('modeStages.98a035') },
    7: { c: 7, goal: t('modeData.e76e1d'), note: t('modeStages.2153f9'), path: true, wall: 54, wallDmg: 0.22, rule: 'crystalCollapse', tw: t('modeStages.8a8f29') },
    8: { c: 8, goal: t('modeData.e76e1d'), note: t('modeStages.d69d1d'), path: true, wall: 49, wallDmg: 0.22, rule: 'stormWind', tw: t('modeStages.29c53b') },
    9: { c: 9, goal: t('modeData.e76e1d'), note: t('modeStages.dc2829'), path: true, wall: 56, wallDmg: 0.22, rule: 'abyssDark', tw: t('modeStages.2fa39a') },
    10: { c: 10, goal: t('modeData.e76e1d'), note: t('modeStages.25dbf4'), path: true, wall: 54, wallDmg: 0.22, rule: 'sandStorm', tw: t('modeStages.dd5ba4') },
    11: { c: 11, goal: t('modeData.e76e1d'), note: t('modeStages.61ff0c'), path: true, wall: 54, wallDmg: 0.22, rule: 'steamLine', tw: t('modeStages.d1855b') },
    12: { c: 12, goal: t('modeData.e76e1d'), note: t('modeStages.407b12'), path: true, wall: 54, wallDmg: 0.22, rule: 'thunderFront', tw: t('modeStages.45b7b4') },
    13: { c: 13, goal: t('modeData.e76e1d'), note: t('modeStages.a953f8'), path: true, wall: 49, wallDmg: 0.22, rule: 'mirrorWall', tw: t('modeStages.308a41') },
    14: { c: 14, goal: t('modeData.e76e1d'), note: t('modeStages.b024b1'), path: true, wall: 59, wallDmg: 0.22, mobMul: 1.7, rule: 'furnace', tw: t('modeStages.84c084') },
  },
  hunt: {
    2: { c: 2, goal: t('modeStages.71d3e7'), note: t('modeStages.2b5dd8'), sec: 170, run: 62, prey: ['fskull', 'fskull', 'fskull', 'fskull'], rule: 'lavaPools', tw: t('modeStages.6d8560') },
    3: { c: 3, goal: t('modeStages.38c82d'), note: t('modeStages.0d0033'), sec: 170, run: 64, prey: ['wolf', 'yeti', 'wolf', 'wolf', 'yeti'], rule: 'herdTracks', tw: t('modeStages.f9a02e') },
    4: { c: 4, goal: t('modeStages.65db1a'), note: t('modeStages.ebc6a8'), sec: 170, run: 56, prey: ['dknight', 'dknight', 'dknight', 'dknight'], rule: 'escorts', tw: t('modeStages.4cb159') },
    5: { c: 5, goal: t('modeStages.d96cff'), note: t('modeStages.b23d3a'), sec: 170, run: 62, prey: ['wraith', 'wraith', 'wraith', 'wraith', 'wraith'], rule: 'divers', tw: t('modeStages.46771c') },
    6: { c: 6, goal: t('modeStages.0d6bca'), note: t('modeStages.b6a77d'), sec: 170, run: 62, prey: ['sporespider', 'sporespider', 'sporespider', 'sporespider', 'sporespider'], rule: 'streamDrift', tw: t('modeStages.d158a3') },
    7: { c: 7, goal: t('modeStages.e2358c'), note: t('modeStages.812e8d'), sec: 170, run: 58, prey: ['crystgolem', 'crystgolem', 'crystgolem', 'crystgolem'], rule: 'laserCover', tw: t('modeStages.8b6747') },
    8: { c: 8, goal: t('modeStages.1c14ca'), note: t('modeStages.386b56'), sec: 170, run: 62, prey: ['galegarg', 'galegarg', 'galegarg', 'galegarg', 'galegarg'], rule: 'windRiders', tw: t('modeStages.24662c') },
    9: { c: 9, goal: t('modeStages.ab5523'), note: t('modeStages.0b99bf'), sec: 180, run: 60, prey: ['voidpriest', 'voidpriest', 'voidpriest', 'voidpriest', 'voidpriest'], rule: 'darkHide', tw: t('modeStages.8a6843') },
    10: { c: 10, goal: t('modeStages.b95de3'), note: t('modeStages.347f63'), sec: 170, run: 62, prey: ['scorpion', 'scorpion', 'scorpion', 'scorpion', 'scorpion'], rule: 'sandBurrow', tw: t('modeStages.5b6e8b') },
    11: { c: 11, goal: t('modeStages.0725e2'), note: t('modeStages.253784'), sec: 170, run: 50, prey: ['clockimp', 'clockimp', 'clockimp', 'clockimp', 'clockimp'], rule: 'overclock', tw: t('modeStages.180316') },
    12: { c: 12, goal: t('modeStages.8cbc9a'), note: t('modeStages.200253'), sec: 170, run: 60, prey: ['stormwolf', 'stormwolf', 'stormwolf', 'stormwolf', 'stormwolf'], rule: 'blinkRods', tw: t('modeStages.fbbb46') },
    13: { c: 13, goal: t('modeStages.8b76e6'), note: t('modeStages.dc38a2'), sec: 180, run: 58, prey: ['phantompriest', 'phantompriest', 'phantompriest', 'phantompriest', 'phantompriest'], rule: 'decoys', tw: t('modeStages.2b8e1d') },
    14: { c: 14, goal: t('modeStages.55ff3f'), note: t('modeStages.451860'), sec: 180, run: 56, prey: ['flamegiant', 'flamegiant', 'flamegiant', 'flamegiant'], rule: 'anvilOrbit', tw: t('modeStages.80a9f8') },
  },
};

// 별 2개 조건(제한 시간 par초): 판 길이에 맞춰 정한다. 성물함 지키기(수레 아님)는 par 없이 물건 체력 keep 이상이 조건
const PAR_K = { guard: 0.6, capture: 0.55, hunt: 0.62 };
for (const id of Object.keys(STAGE_DATA)) for (const c of Object.values(STAGE_DATA[id])) {
  if (c.par) continue;
  if (id === 'breach') c.par = 150;
  else if (id === 'guard' && !c.go) c.keep = c.keep || 0.6;
  else c.par = Math.round(c.sec * PAR_K[id] / 5) * 5;
}
