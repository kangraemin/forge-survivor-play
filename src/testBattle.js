// 테스트 모드 전투 도구: 무적·배속·즉시 레벨업·웨이브 넘기기·보스 소환·즉시 승패. 테스트 패널(testPanel.js)과 Battle.js가 쓴다
// 일반 플레이에서는 tst.god가 늘 false라 아무 영향이 없다(Battle.js가 isTest()일 때만 testGo를 읽는다)
import * as D from './data.js';
import { BossAI } from './boss.js';

export const tst = { god: false, speed: 1 };

// 배속: 전투 장면의 시간 흐름을 n배로(1·2·4). 판이 새로 시작해도 Battle.init이 tst.speed를 읽는다
export function setSpeed(sc, n) {
  tst.speed = n;
  if (!sc || sc.sys.settings.key !== 'Battle') return;
  sc.speed = n;
  sc.physics.world.timeScale = 1 / n; sc.time.timeScale = n; sc.tweens.timeScale = n; sc.anims.globalTimeScale = n;
}

// 판 시작 직후(Battle.create 끝): { mid, boss, floor, result }
export function testBattleStart(sc) {
  const g = sc.testGo || {};
  if (g.floor > 1 && sc.endless) sc.wave = g.floor - 1;   // 무한의 탑 N층부터(몹 체력·피해가 층에 맞게 커진다)
  if (g.mid && !sc.endless) { sc.wave = sc.waveCount - 1; sc.waveT = sc.waveLen * 0.31; }   // 마지막 웨이브 30%를 넘기면 중간보스가 나온다
  if (g.boss && sc.isBoss) { sc.wave = sc.waveCount; sc.time.delayedCall(900, () => { if (!sc.over && !sc.bossPhase) sc.startBoss(); }); }
  if (g.result) sc.time.delayedCall(900, () => { if (!sc.over) sc.ui.result(g.result === 'win'); });
}

const live = sc => !!sc && sc.sys.settings.key === 'Battle' && !sc.over && !!sc.ui && !!sc.run;

export function levelUpNow(sc) {
  if (!live(sc)) return false;
  sc.run.lv++; sc.lvTxt.setText('Lv ' + sc.run.lv);
  sc.ui.levelUp();
  return true;
}
export function skipWave(sc) {
  if (!live(sc) || sc.bossPhase || sc.mode) return false;
  sc.waveT = sc.waveLen;
  return true;
}
export function summonBoss(sc) {
  if (!live(sc) || sc.bossPhase || sc.boss) return false;
  if (sc.isBoss) { sc.wave = sc.waveCount; sc.startBoss(); return true; }
  // 장 보스 판이 아니면 이 장의 중간보스를 소환한다
  const key = !sc.endless && sc.ch.mid && D.BOSSES[sc.ch.mid] ? sc.ch.mid : 'general';
  if (sc.midBoss?.m?.active) return false;
  sc.midDone = true; sc.midWave = sc.wave;
  sc.midBoss = new BossAI(sc, key, sc.mobHpMul, true);
  sc.banner(D.BOSSES[key].name, '');
  return true;
}
export function instantResult(sc, win) {
  if (!live(sc)) return false;
  sc.ui.result(!!win);
  return true;
}
