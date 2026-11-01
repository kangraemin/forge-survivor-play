// 주인공 쓰러짐 그림: 무엇에 죽었는지(불·얼음·독·번개·어둠·맞음)에 따라 다른 16프레임(assets/heroDie/<원인>.png, art/heroDie/)
//  - 마지막으로 맞은 출처(hurt의 src)와 그 판 장(章)으로 원인을 고른다. 그림은 판정·시뮬과 상관없다
import * as D from './data.js';

export const DIE_CAUSES = ['hit', 'fire', 'ice', 'poison', 'shock', 'dark'];
export const DIE_FW = 80;

// 장마다 기본 원인(보스·몹 이름이 따로 안 걸리면 이걸 쓴다)
const CH_CAUSE = ['hit', 'dark', 'fire', 'ice', 'dark', 'hit', 'poison', 'hit', 'shock', 'dark',
  'hit', 'fire', 'shock', 'dark', 'fire', 'ice', 'hit', 'hit', 'dark', 'dark'];
// 장 기본과 다른 것만 적는다
const KEY_CAUSE = { slime: 'poison', kingslime: 'poison', lava: 'fire', zap: 'shock', bash: 'hit', harpoon: 'hit', wraith: 'dark', skyray: 'shock', executioner: 'hit', dknight: 'hit',
  tidewyrm: 'hit', coralcrab: 'hit', crystbat: 'hit', galewolf: 'hit', mirage: 'dark', clockimp: 'fire', boneknight: 'hit', royalguard: 'hit' };

let owner = null;
const chOf = k => {
  if (!owner) { owner = {}; D.CHAPTERS.forEach((c, i) => [c.boss, c.mid, ...(c.mobs || [])].forEach(x => { if (x && owner[x] == null) owner[x] = i; })); }
  return owner[k];
};

// s.lastHit: hurt에 들어온 마지막 출처('elite_' + 몹 이름, 'boss', 'shot', 'lava' …)
export function dieCause(s) {
  let k = String(s.lastHit || '').replace(/^elite_/, '');
  if (KEY_CAUSE[k]) return KEY_CAUSE[k];
  if (chOf(k) == null) {
    // 보스 공격·탄·바닥 같은 출처는 지금 싸우는 보스를 본다
    k = s.bossPhase ? s.ch?.boss : s.midBoss?.m?.active ? s.ch?.mid : '';
    if (KEY_CAUSE[k]) return KEY_CAUSE[k];
  }
  const i = chOf(k) ?? D.CHAPTERS.indexOf(s.ch);
  return CH_CAUSE[i] || 'hit';
}

export function dieAnims(scene) {
  for (const c of DIE_CAUSES) {
    const key = 'hdie_' + c;
    if (scene.textures.exists(key) && !scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 15 }), frameRate: 14, repeat: 0 });
  }
}
