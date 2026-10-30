// Remote Config 값 읽기: 스토어 앱(store/src/forge-platform.js)이 Firebase 콘솔에서 받은 숫자를 window.forgePlatform.config 에 채운다
// 값이 없거나 숫자가 아니거나 범위를 벗어나면 현재 코드의 값(기본값)을 그대로 쓴다. 웹·포털판은 항상 기본값
// 키 목록·기본값·허용 범위는 여기 한 곳. 콘솔에는 같은 이름으로 넣는다(docs/release/firebase.md)
export const RC = {
  first_boss_at: [0.25, 0.1, 0.9],        // 첫 판(1-1) 중간보스가 나오는 시점: 마지막 웨이브 진행도(0~1)
  stage1_raid_at: [0.35, 0.1, 0.9],       // 1-1 엘리트 습격 시점: 둘째 웨이브 진행도
  first_run_len_mul: [0.8, 0.5, 1.5],     // 첫 판 웨이브 길이 배수(80초 ≈ 0.8)
  gold_unit_rate: [0.12, 0.04, 0.4],      // 금화 한 알 = 그 판 클리어 금화 × 이 비율
  gold_rush_n: [5, 0, 12],                // 금화 행렬 고블린 수(0이면 끔)
  gold_rush_at: [0.2, 0.05, 0.8],         // 금화 행렬 시점: 웨이브 진행도
};
export function rc(key) {
  const [def, lo, hi] = RC[key];
  try {
    const v = window.forgePlatform?.config?.[key];
    if (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi) return v;
  } catch { /* 기본값 */ }
  return def;
}
