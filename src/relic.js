// 마왕의 목걸이(프롤로그 보스를 진짜로 잡은 사람, sv.proRelic): 일반 몹을 쓰러뜨리면 낮은 확률로
// 그 몹이 보랏빛으로 일어나 우리 편이 되어 싸운다. 적 몹에게 붙어 맞으면 체력이 깎여 다시 쓰러진다
import { sfx } from './sfx.js';

const CHANCE = 0.04, MAX = 3, HP_K = 4, HIT_EVERY = 700, HIT_MUL = 0.8, TOUCH = 16, SPD = 1.15;

// kill()에서: 쓰러진 몹을 우리 편으로 일으킬지
export function relicKill(s, m) {
  if (!s.sv?.proRelic || s.pro || s.over || m.elite || m.mid || m.goblin || m.mini || m.bat) return;
  const al = (s.allies ||= []);
  if (al.length >= MAX || Math.random() >= CHANCE) return;
  const a = s.add.sprite(m.x, m.y, m.texture.key).setDepth(m.depth).setScale(m.bs || m.scaleX).setTint(0xb070ff);
  if (s.anims.exists(m.kind)) a.play(m.kind);
  a.hp = a.maxHp = m.maxHp * HP_K; a.spd = (m.spd || 40) * SPD; a.cd = 0; a.hurtCd = 0;
  a.bar = s.add.rectangle(m.x, m.y - 12, 14, 2, 0xb070ff).setDepth(m.depth + 1);
  al.push(a);
  sfx('heal', 120); s.spark?.explode(8, m.x, m.y);
  a.setScale(0.2 * a.scaleX); s.tweens.add({ targets: a, scale: m.bs || 1, duration: 260, ease: 'Back.Out' });
}

// update에서: 가장 가까운 졸개에게 다가가 때리고, 붙어 있는 적에게 맞는다
// 보스·중간보스는 안 때린다: 방벽(bossWeak)이 답 아닌 타격으로 보고 주인공에게 되갚는다(시뮬 8-3 C 93%→70%)
export function relicTick(s, dt) {
  const al = s.allies;
  if (!al?.length) return;
  const mobs = s.mobs.getChildren().filter(m => m.active && !m.dead);
  for (let i = al.length - 1; i >= 0; i--) {
    const a = al[i];
    let tgt = null, bd = 1e9;
    for (const m of mobs) { if (m.isBoss || m.mid) continue; const d = Math.hypot(m.x - a.x, m.y - a.y); if (d < bd) { bd = d; tgt = m; } }
    if (!tgt) {   // 적이 없으면 주인공 곁으로
      const d = Math.hypot(s.hero.x - a.x, s.hero.y - a.y);
      if (d > 30) { a.x += (s.hero.x - a.x) / d * a.spd * dt / 1000; a.y += (s.hero.y - a.y) / d * a.spd * dt / 1000; }
    } else if (bd > TOUCH - 4) {
      a.x += (tgt.x - a.x) / bd * a.spd * dt / 1000; a.y += (tgt.y - a.y) / bd * a.spd * dt / 1000;
      a.setFlipX(tgt.x < a.x);
    }
    if (tgt && bd <= TOUCH && (a.cd -= dt) <= 0) { a.cd = HIT_EVERY; s.hitMob(tgt, HIT_MUL, { src: 'ally', kb: 40, fx: 'small', from: a }); }
    // 붙어 있는 적들에게 맞는다
    if ((a.hurtCd -= dt) <= 0) {
      a.hurtCd = 500;
      for (const m of mobs) if (Math.hypot(m.x - a.x, m.y - a.y) <= TOUCH) a.hp -= m.dmg || 5;
    }
    a.bar.setPosition(a.x, a.y - 12).setScale(Math.max(0, a.hp / a.maxHp), 1);
    if (a.hp <= 0 || s.over) {
      al.splice(i, 1); a.bar.destroy();
      s.tweens.add({ targets: a, alpha: 0, scaleY: a.scaleY * 0.2, duration: 220, onComplete: () => a.destroy() });
    }
  }
}
