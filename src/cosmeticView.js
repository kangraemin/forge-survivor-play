import { COS_ANCHORS as ANCH1, BASE_HEAD } from './cosmeticAnchors.js';
import { COS_ANCHORS2 } from './cosmeticAnchors2.js';
const COS_ANCHORS = { ...ANCH1, ...COS_ANCHORS2 };
import { BODY_LOOKS, COS_ROWS, cosmetic, EFFECT_FRAMES, AURAS, effectTex } from './cosmetics.js';

export const HAND = {
  walkFront: { w: 37, f: [[7, 30, 115], [6, 31, 115], [7, 31, 115], [6, 32, 115]] },
  walkUp: { w: 39, f: [[29, 31, 65], [29, 32, 65], [29, 31, 65], [30, 32, 65]] },
  walkSide: { w: 40, f: [[12, 33, 35], [12, 33, 35], [11, 33, 35], [11, 33, 35]] },
  slash: { w: 58, f: [[21, 9, -55], [41, 32, 35], [44, 24, 0], [25, 36, 30]] },
  pose: { w: 63, f: [[28, 31, 75], [25, 29, 170], [27, 32, 50], [28, 33, 50]] },
};
const COS_HAND = {
  walkFront: { w: 37, f: [[8, 32, 115], [8, 33, 115], [8, 32, 115], [8, 33, 115]] },
  walkUp: { w: 39, f: [[29, 32, 65], [29, 33, 65], [29, 32, 65], [29, 33, 65]] },
  walkSide: { w: 40, f: [[27, 33, 35], [26, 32, 35], [27, 33, 35], [26, 32, 35]] },
  slash: { w: 58, f: [[22, 9, -55], [40, 35, 35], [46, 27, 0], [39, 36, 30]] },
  pose: { w: 63, f: [[28, 32, 75], [43, 31, 170], [22, 33, 115], [22, 33, 115]] },
};
export const bodyId = look => look.costume || look.character || '';
const baseRows = ['hn_hero2_r0s', 'hn_hero2_r1s', 'hn_hero_r1s', 'hn_hero_r2s', 'hn_hero2_r2s'];
export function dressHero(hero, look) {
  const id = bodyId(look);
  if (!BODY_LOOKS.some(it => it.id === id)) return hero;
  const rows = COS_ROWS.map((_, i) => `cos_${id}_${i}`);
  const anim = (key, row, rate, repeat = -1, frames = [0, 1, 2, 3]) => hero.anims.create({ key, frames: frames.map(frame => ({ key: rows[row], frame })), frameRate: rate, repeat });
  anim('walkFront', 0, 8); anim('walkUp', 1, 8); anim('walkSide', 2, 8); anim('slash', 3, 26, 0);
  anim('idle', 4, 2.5, -1, [2, 3]); anim('idleL', 4, 2.5, -1, [2, 3]);
  anim('hurtPose', 4, 1, 0, [0]); anim('dashPose', 4, 1, 0, [1]);
  hero.cosBody = id; hero.play('idle'); return hero;
}
export const weaponKey = (look, wid, tier) => look.weapon ? `cos_${look.weapon}` : `w_${wid}${tier}`;
export function anchorPoint(hero, x, y, width = hero.width) {
  const dx = (hero.flipX ? width - x : x) - hero.originX * width;
  const dy = y - hero.originY * hero.height;
  const a = hero.rotation, sx = dx * hero.scaleX, sy = dy * hero.scaleY;
  return { x: hero.x + sx * Math.cos(a) - sy * Math.sin(a), y: hero.y + sx * Math.sin(a) + sy * Math.cos(a) };
}
export function placeHeld(hero, weapon) {
  if (!weapon) return;
  const k = hero.anims.currentAnim?.key, f = hero.flipX ? -1 : 1;
  const hands = hero.cosBody ? COS_HAND : HAND;
  const T = hands[k] || hands.pose, fi = hero.anims.currentFrame?.textureFrame ?? 2;
  let [gx, gy, th] = T.f[Math.min(Number(fi), 3)];
  const row = ({ walkFront: 0, walkUp: 1, walkSide: 2, slash: 3 })[k] ?? 4;
  const anchor = COS_ANCHORS[hero.cosBody]?.[row]?.[Number(fi)];
  if (anchor) { [gx, gy] = anchor; th = anchor[4] ?? th; }
  const te = f > 0 ? th : 180 - th;
  const at = anchorPoint(hero, gx, gy, T.w);
  weapon.setPosition(at.x, at.y)
    .setFlipX(f < 0).setAngle(te + (f > 0 ? 45 : 135) + hero.angle)
    .setDepth(hero.depth + (k === 'walkUp' ? -0.001 : 0.001)).setAlpha(hero.alpha);
}

// Battle.fxFree와 같은 free-list 재사용. 파티클/잔상 총 24개, 새 tween·타이머 없음.
// 전투·미리보기 모두 같은 풀을 사용하며, 걷기/베기/처치에 별도 발산 패턴을 쓴다.
export class CosmeticVfx {
  constructor(scene, parent = null, cap = 24) { this.s = scene; this.parent = parent; this.cap = cap; this.all = []; this.free = []; this.live = []; this.clock = 0; this.last = {}; }
  take(texture, frame) {
    let p = this.free.pop();
    if (!p && this.all.length < this.cap) { p = this.s.add.image(0, 0, texture, frame); this.all.push(p); this.parent?.add(p); }
    if (!p) return null;
    p.setTexture(texture, frame).setActive(true).setVisible(true).setAlpha(1).setAngle(0).setFlipX(false).clearTint();
    this.live.push(p); return p;
  }
  burst(effect, event, x, y, hero) {
    if (!effect || !EFFECT_FRAMES[effect]) return;
    const key = effect + ':' + event, gap = event === 'walk' ? 350 : event === 'kill' ? 450 : 240;
    if (this.clock - (this.last[key] ?? -Infinity) < gap) return;
    this.last[key] = this.clock;
    const frames = EFFECT_FRAMES[effect], n = event === 'walk' ? 1 : event === 'kill' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const p = this.take(effectTex(effect), frames[(i + Math.floor(this.clock / 350)) % frames.length]); if (!p) break;
      const a = event === 'slash' ? -1.2 + i * 0.8 : i * Math.PI * 2 / n;
      p.setPosition(x + (event === 'walk' ? -5 : Math.cos(a) * 14), y + (event === 'walk' ? 19 : -8 + Math.sin(a) * 12));
      p.setScale(event === 'kill' ? 0.65 : 0.5).setDepth((hero?.depth || 10) + 0.04);
      p.vx = Math.cos(a) * (event === 'walk' ? 5 : 22); p.vy = event === 'walk' ? -9 : Math.sin(a) * 16 - 15;
      p.life = p.total = effect === 'steam' ? 900 : 650; p.opacity = 0.85;
    }
    if (effect === 'gold' && hero && event !== 'walk') {
      const p = this.take(hero.texture.key, hero.frame.name);
      if (p) { p.setPosition(hero.x - 4, hero.y).setScale(hero.scaleX, hero.scaleY).setFlipX(hero.flipX).setTintFill(0xffd57a).setDepth(hero.depth - 0.02); p.vx = -8; p.vy = 0; p.life = p.total = 230; p.opacity = 0.3; }
    }
  }
  update(dt) {
    this.clock += dt;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.life -= dt;
      if (p.life <= 0) { p.setActive(false).setVisible(false); this.free.push(p); this.live.splice(i, 1); continue; }
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.alpha = p.opacity * Math.min(1, p.life / 220);
    }
  }
  destroy() { this.all.forEach(p => p.destroy()); this.all = []; this.live = []; this.free = []; }
}

export class CosmeticActor {
  constructor(scene, hero, look, parent = null) {
    this.s = scene; this.hero = hero; this.look = look; this.pool = new CosmeticVfx(scene, parent); this.t = 0; this.pickT = 0;
    this.effect = cosmetic(bodyId(look))?.effect;
    if (look.head) { this.head = scene.add.image(hero.x, hero.y, `cos_${look.head}`); parent?.add(this.head); }
    if (look.pet) { this.pet = scene.add.sprite(hero.x + 28, hero.y + 15, `cos_${look.pet}`).play(`pet_${look.pet}`); parent?.add(this.pet); }
    const bid = bodyId(look);   // 유료 캐릭터 고유 주변 이펙트: 몸 둘레를 도는 얼음 고리(그림만, 능력치 무관)
    if (AURAS.includes(bid)) { this.aura = scene.add.sprite(hero.x, hero.y, `cos_aura_${bid}`).play(`aura_${bid}`); parent?.add(this.aura); }
    this.petSlash = 0;
    this.onAnim = anim => {
      if (anim.key !== 'slash') return;
      this.emit('slash');
      if (this.pet && scene.anims.exists(`pet_${look.pet}_slash`)) { this.pet.play(`pet_${look.pet}_slash`); this.petSlash = 360; }
    };
    hero.on('animationstart', this.onAnim);
  }
  emit(event, x = this.hero.x, y = this.hero.y) {
    this.pool.burst(this.effect, event, x, y, this.hero);
    if (event === 'slash') this.pool.burst(cosmetic(this.look.weapon)?.effect, event, x + (this.hero.flipX ? -16 : 16), y, this.hero);
  }
  update(dt, moving = false, preview = false) {
    this.t += dt; this.pool.update(dt);
    const h = this.hero, k = h.anims.currentAnim?.key;
    if (moving) this.emit('walk');
    if (this.head) {
      const row = ({ walkFront: 0, walkUp: 1, walkSide: 2, slash: 3 })[k] ?? 4, fi = Number(h.anims.currentFrame?.textureFrame ?? 2);
      const anchor = COS_ANCHORS[h.cosBody]?.[row]?.[fi];
      const head = anchor ? anchor.slice(2, 4) : BASE_HEAD[row][fi];
      const at = anchorPoint(h, head[0], head[1], COS_ROWS[row]);
      this.head.setPosition(at.x, at.y).setOrigin(0.5, 0.8)
        .setScale(0.95 * h.scaleX, 0.95 * h.scaleY).setAngle(h.angle).setFlipX(h.flipX).setAlpha(h.alpha).setDepth(h.depth + 0.02);
    }
    if (this.aura) {
      this.aura.setPosition(h.x, h.y).setScale(h.scaleX, h.scaleY).setAlpha((k === 'slash' ? 0.3 : 0.55) * h.alpha).setVisible(h.visible).setDepth(h.depth + 0.015);
    }
    if (this.pet) {
      if (this.petSlash > 0 && (this.petSlash -= dt) <= 0) this.pet.play(`pet_${this.look.pet}`);
      const f = h.flipX ? -1 : 1, q = 1 - Math.pow(0.9, dt / 16.7);
      this.pet.x += (h.x + 30 * f - this.pet.x) * q; this.pet.y += (h.y + 16 + Math.sin(this.t / 180) * 2 - this.pet.y) * q;
      this.pet.setFlipX(f < 0).setDepth(h.depth - 0.01);
      this.pool.burst(cosmetic(this.look.pet)?.effect, 'walk', this.pet.x, this.pet.y - 14, h);
      // 보스 펫은 그대로 함께 동행. 자동 줍기는 은화 1개/8초, 반경56으로 제한한다.
      if (!preview && ['ghost', 'baby_capy', 'mini_snowman'].includes(this.look.pet) && (this.pickT += dt) >= 8000) {
        this.pickT = 0;
        const it = this.s.items?.getChildren().find(o => o.kind === 'silver' && !o.pull && Math.hypot(o.x - h.x, o.y - h.y) < 56);
        if (it) { it.pull = true; this.pool.burst(cosmetic(this.look.pet).effect, 'kill', it.x, it.y, h); }
      }
    }
  }
  destroy() { this.hero.off('animationstart', this.onAnim); this.pool.destroy(); this.head?.destroy(); this.pet?.destroy(); this.aura?.destroy(); }
}

// 미리보기는 하나만 실행. 탭을 닫으면 update 리스너와 풀을 전부 해제한다.
export function lookPreview(scene, parent, x, y, look, wid = 'sword', tier = 0) {
  const c = scene.add.container(x, y); parent.add(c);
  c.add(scene.add.ellipse(0, 25, 50, 10, 0x050910, 0.7));
  const hero = scene.add.sprite(0, 0, baseRows[4], 2); c.add(hero); dressHero(hero, look).play('idle');
  const weapon = scene.add.image(0, 0, weaponKey(look, wid, tier)).setOrigin(0.2, 0.8).setDisplaySize(24, 24); c.add(weapon);
  const actor = new CosmeticActor(scene, hero, look, c);
  let elapsed = 0, last = '';
  const update = (_, dt) => {
    elapsed += dt; const phase = elapsed % 4400, anim = phase < 1500 ? 'idle' : phase < 3100 ? 'walkSide' : phase < 3300 ? 'slash' : 'idle';
    if (anim !== last) { hero.play(anim); last = anim; if (phase >= 3300) actor.emit('kill', 21, -4); }
    actor.update(dt, anim === 'walkSide', true); placeHeld(hero, weapon); c.sort('depth');
  };
  scene.events.on('update', update);
  c.once('destroy', () => { scene.events.off('update', update); actor.destroy(); });
  c.hero = hero; c.actor = actor; return c;
}
