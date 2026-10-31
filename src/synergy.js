// 66차: 스킬 짝 효과. 한쪽(prime)이 적에게 상태를 걸고, 짝(pay) 스킬이 그 적을 맞히면 추가 피해와 연쇄가 터진다.
// 이 밖에 시전 때 모양이 바뀌는 짝(whirl·twin·lava·frag)과 맞힌 자리에서 갈라지는 짝(split)이 있다. 쿨다운을 줄이는 옛 5쌍은 data.js SYN_CD.
import { SYNERGY } from './data.js';
import { sfx } from './sfx.js';

// 스킬 → 거는 상태, 상태별 지속(ms)·추가 피해 배수·색
const PRIME = { ice: 'chill', fireball: 'burn', bolt: 'shock', holy: 'mark' };
const DUR = { chill: 2600, burn: 3200, shock: 2400, mark: 1800 };
const MUL = { chill: 1.4, burn: 1.35, shock: 1.3, mark: 1.3 };
const COL = { chill: 0x9ae8ff, burn: 0xff9a5a, shock: 0xfff08a, mark: 0xffe9a0 };
// 투사체 src → 스킬 이름
export const SRC_SK = { wave: 'wave', jav: 'javelin', palm: 'palm', mis: 'missile', ice: 'ice', dagger: 'dagger', fire: 'fireball' };

// 가진 스킬이 바뀌면 활성 짝 표를 다시 만든다
export function sync(s) {
  const sk = s.run.skills, sig = Object.keys(sk).join(',');
  if (s.synSig === sig) return;
  s.synSig = sig;
  const list = SYNERGY.filter(x => x.fx && sk[x.a] && sk[x.b]);
  const f = { st: new Set(), pay: new Map(), split: new Set(), fx: new Set(list.map(x => x.fx)), n: list.length };
  for (const x of list) {
    if (x.fx === 'pay') { f.st.add(PRIME[x.prime]); if (!f.pay.has(x.pay)) f.pay.set(x.pay, []); f.pay.get(x.pay).push(PRIME[x.prime]); }
    if (x.fx === 'split') f.split.add(x.pay);
  }
  s.synFx = f.n ? f : null;
}

function tintFor(s, m, st) {
  if (m.isBoss || m.stTint) return;
  m.stTint = true; const b0 = m.baseTint; m.baseTint = COL[st]; m.setTint(COL[st]);
  s.time.delayedCall(DUR[st], () => { m.stTint = false; if (m.active && !m.dead) { m.baseTint = b0; m.clearTint(); if (b0 && b0 !== 0xffffff) m.setTint(b0); } });
}

// 맞기 전: 스킬이 상태를 건다 → 짝 스킬이 상태의 적을 맞히면 피해 배수를 돌려준다
export function onHit(s, m, skill) {
  const f = s.synFx; if (!f || !skill) return 1;
  let mul = 1;
  const need = f.pay.get(skill);
  if (need) for (const st of need) {
    const on = (m.st?.[st] || 0) > s.bt || (st === 'chill' && m.freeze > 0);
    if (!on) continue;
    mul *= m.isBoss ? 1 + (MUL[st] - 1) * 0.6 : MUL[st];
    if (s.bt - (m.synCd || -1e9) > 900) { m.synCd = s.bt; s.time.delayedCall(30, () => burst(s, m, st)); }
  }
  const st = PRIME[skill];
  if (st && f.st.has(st)) { (m.st ||= {})[st] = s.bt + DUR[st]; tintFor(s, m, st); }
  if (f.split.has(skill) && s.bt - (m.splitCd || -1e9) > 500 && s.pbullets.countActive() < 70) {
    m.splitCd = s.bt;
    const x = m.x, y = m.y, a0 = Math.random() * 6.28;
    for (let i = 0; i < 2; i++) s.weapons.bullet('dagger', x, y, a0 + i * Math.PI, 300, { mult: 0.7, pierce: 1, src: 'split', life: 600, kb: 30, tag: 'ranged', tint: 0xd8f0ff });
  }
  return mul;
}

// 상태가 터지는 연쇄: 빙결은 파쇄, 화상은 폭발, 감전은 전이, 표식은 회복
function burst(s, m, st) {
  if (s.over || !m.active) return;
  const x = m.x, y = m.y, w = s.weapons;
  if (st === 'chill') {
    if (!m.isBoss) { (m.st ||= {}).chill = 0; m.freeze = 0; }
    const ring = s.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ae8ff).setScale(0.2).setDepth(31);
    s.tweens.add({ targets: ring, scale: 1.3, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    sfx('hit', 60);
    for (const o of s.mobsNear(x, y, 40)) if (o !== m && !o.dead && Phaser.Math.Distance.Between(o.x, o.y, x, y) < 38) s.hitMob(o, 0.8, { kb: 40, tag: 'magic' });
  } else if (st === 'burn') {
    if (!m.isBoss) (m.st ||= {}).burn = 0;
    w.explode(x, y, 2, false, 'none');
  } else if (st === 'shock') {
    let n = 0;
    for (const o of s.mobsNear(x, y, 64)) if (o !== m && !o.dead && n < 3 && Phaser.Math.Distance.Between(o.x, o.y, x, y) < 64) { n++; w.zapLine(x, y, o.x, o.y); s.hitMob(o, 0.9, { kb: 20, tag: 'magic' }); }
  } else if (st === 'mark') {
    s.hp = Math.min(s.maxHp, s.hp + Math.max(1, s.maxHp * 0.004));
  }
}

// 시전 뒤: 모양이 바뀌는 짝
export function onCast(s, k) {
  const f = s.synFx; if (!f) return;
  const w = s.weapons, h = s.hero;
  if (k === 'spin' && f.fx.has('whirl')) {
    for (let i = 0; i < 4; i++) w.bullet('wave', h.x, h.y - 4, i * Math.PI / 2 + s.bt / 400, 240, { mult: 0.9, pierce: 99, src: 'wave', life: 650, kb: 80, tag: 'melee', tint: 0x9ad8ff, scale: 1.1, add: true });
  }
  if (k === 'palm' && f.fx.has('twin')) {
    const t = w.nearest(200), a = (t ? Phaser.Math.Angle.Between(h.x, h.y, t.x, t.y) : (s.face > 0 ? 0 : Math.PI)) + Math.PI;
    w.bullet('wave', h.x, h.y - 4, a, 230, { mult: 1.6, pierce: 3, src: 'palm', life: 700, kb: 160, tag: 'melee', tint: 0xffe070, scale: 1.6, add: true });
  }
  if (k === 'quake' && f.fx.has('lava')) {
    const rad = 56 * w.area();
    const p = s.add.image(h.x, h.y + 6, 'disc').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5a1a).setScale(rad / 32, rad / 32 * 0.7).setDepth(7).setAlpha(0.6);
    w.patches.push({ x: h.x, y: h.y + 6, rad, t: 3000, g: p, tick: 0 });
  }
}

// 수류탄이 터질 때 파편탄 짝이면 파편이 사방으로
export function onBoom(s, x, y, skill) {
  const f = s.synFx;
  if (!f || skill !== 'grenade' || !f.fx.has('frag')) return;
  for (let i = 0; i < 6; i++) s.weapons.bullet('dagger', x, y, i * Math.PI / 3 + Math.random() * 0.4, 280, { mult: 0.8, pierce: 1, src: 'frag', life: 600, kb: 30, tag: 'ranged', tint: 0xffd75e });
}
