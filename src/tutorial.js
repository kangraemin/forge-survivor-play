// 로비 안내: 1-1을 처음 깨고 로비로 돌아오면 코치마크로 장비·강화·펫·재화·다음 판을 짚어 준다. 한 번 보면 저장(sv.tut.coach.main), 설정에서 다시 볼 수 있다
// 가리키는 자리는 각 탭을 그리는 코드(Lobby.js·gearTab.js)의 좌표를 따른다 — 그 자리를 옮기면 여기 사각형도 같이 고친다
import { W, H } from './data.js';
import { coachRun, coachOne, coachMark, coachSeen } from './coach.js';
import { t } from './i18n.js';
import { save } from './save.js';

const TAB_W = W / 4;
const toBattle = s => { s.modeScr = false; s.tower = false; s.show('battle'); };
const toGear = page => s => { s.gearPage = page; s.invPage = 0; s.show('gear'); };

// 도전(모드) 버튼 한 장: 2장 보스를 처음 잡고 로비에 오면
export const modeStep = () => ({
  prep: toBattle,
  rect: [8, 96, 56, 24],
  title: t('tutorial.f2372e'),
  lines: [t('tutorial.b472a1'), t('tutorial.63e871'), t('tutorial.efd1d0')],
});

// 53차: 처음엔 필수 3장(강화 → 확률·파괴 경고 → 출정)만 강제하고, 장비·펫·교역은 그 탭을 처음 열 때 한 장씩 띄운다.
// 설정 '안내 다시 보기'는 예전처럼 전부(full) 돌린다
const S = {
  gear: () => ({ prep: toGear('gear'), rect: [8, 112, 254, 64], title: t('tutorial.0beb93'), lines: [t('tutorial.9d95af'), t('tutorial.c30dc6'), t('tutorial.623eaf')] }),
  bag: () => ({ prep: toGear('gear'), rect: [8, 200, 254, 196], title: t('tutorial.75b593'), lines: [t('tutorial.8702ba'), t('tutorial.034aa9'), t('tutorial.3c3864')] }),
  enh: () => ({ prep: s => s.show('forge'), rect: [8, 36, 254, 48], title: t('tutorial.c6e002'), lines: [t('tutorial.788a1e'), t('tutorial.833c7a'), t('tutorial.84819f'), t('tutorial.79c055')] }),
  risk: () => ({ prep: s => s.show('forge'), rect: [8, 268, 254, 156], title: t('tutorial.4d2e02'), lines: [t('tutorial.7c12b8'), t('tutorial.3f4886'), t('tutorial.ba22b4'), t('tutorial.ab8195')] }),
  pet: () => ({ prep: toGear('pet'), rect: [8, 38, 254, 194], title: t('tutorial.9c10e5'), lines: [t('tutorial.a318b6'), t('tutorial.8341bf'), t('tutorial.877862'), t('tutorial.dd0e26')] }),
  petRole: () => ({ prep: toGear('pet'), rect: sc => (sc.sv.cleared >= 3 ? [150, 84, 56, 150] : [8, 80, 254, 152]), title: t('tutorial.9534e5'), lines: [t('tutorial.3d478e'), t('tutorial.87c0b8'), t('tutorial.c5cc6c'), t('tutorial.5fce56'), t('tutorial.155748')] }),
  cur: () => ({ prep: s => s.show('forge'), rect: [0, 0, 168, 35], title: t('tutorial.a9b064'), lines: [t('tutorial.04a269'), t('tutorial.370b54'), t('tutorial.4b1711'), t('tutorial.94d771')] }),
  trade: () => ({ prep: s => s.show('shop'), rect: [TAB_W * 3, H - 50, TAB_W, 50], title: t('tutorial.b5e582'), lines: [t('tutorial.1c3431'), t('tutorial.a4495a')] }),
  go: () => ({ prep: toBattle, rect: [20, 382, 150, 32], title: t('tutorial.69cde5'), lines: [t('tutorial.554406'), t('tutorial.968c2d'), t('tutorial.ce6923')] }),
};
const noPrep = f => () => { const { prep, ...r } = f(); return r; };
// 탭을 처음 열 때 한 장: 탭 id → 안내 한 장(그 탭 안에서 바로 띄우므로 화면 전환 없음)
export const TAB_COACH = { tab_gear: noPrep(S.gear), tab_pet: noPrep(S.pet), tab_shop: noPrep(S.trade) };

export function tutorialSteps(scene, full = false) {
  if (!full) return [S.enh(), S.risk(), S.go()];
  const steps = [S.gear(), S.bag(), S.enh(), S.risk(), S.pet(), S.petRole(), S.cur(), S.trade()];
  // 이미 2장 보스를 넘긴 사람은 도전 버튼도 한 번에 보여 준다
  if (scene.sv.cleared >= 6) steps.push(modeStep());
  steps.push(S.go());
  return steps;
}

// 메인 안내를 띄운다. 이미 뜨는 중이면 false. full=true는 설정의 '다시 보기'
export function runTutorial(scene, full = false) {
  const sv = scene.sv, prev = sv.tut?.coach?.main;
  return !!coachRun(scene, tutorialSteps(scene, full), {
    id: 'main',
    onEnd: skipped => {
      if (sv.cleared >= 6 && full) coachMark(sv, 'mode');
      // 새 방식(2)으로 본 사람만 탭 안내 한 장씩을 받는다. 건너뛰었으면 탭 안내도 다 본 걸로 친다. 다시 보기는 기존 표시를 그대로 둔다
      sv.tut.coach.main = full ? (prev || 1) : 2;
      if (!full && skipped) Object.keys(TAB_COACH).forEach(k => { sv.tut.coach[k] = 1; });
      save();
      scene.show(skipped && !sv.tut.forge ? 'forge' : 'battle');
      scene.refreshTop?.();
    },
  });
}

// 탭을 처음 열 때: 새 방식으로 메인 안내를 본 사람에게만 한 장
export function tabCoach(scene, tab) {
  const sv = scene.sv;
  if (sv.tut?.coach?.main !== 2 || scene.busy || scene._coach || !TAB_COACH[tab] || coachSeen(sv, tab)) return false;
  return coachOne(scene, tab, TAB_COACH[tab]());
}

// 로비가 열릴 때: 띄울 안내가 있으면 띄우고 true
export function tutorialDue(sv) { return sv.cleared >= 1 && !coachSeen(sv, 'main'); }
export function modeDue(sv) { return sv.cleared >= 6 && coachSeen(sv, 'main') && !coachSeen(sv, 'mode'); }
export function runModeCoach(scene) { return coachOne(scene, 'mode', modeStep()); }
