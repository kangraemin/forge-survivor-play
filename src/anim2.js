// anim2: 보스·중간보스 동작 그림(대기·걷기·맞음·쓰러짐·패턴마다 준비→발동→회수, docs/anim2.md)
//  - 물리 몸(m)은 그대로 두고 그리지만 않는다. 그 위에 그림용 스프라이트(껍데기)를 매 프레임 겹친다 — 판정·충돌·시뮬은 바뀌지 않는다
//  - 그림은 보스가 나올 판에서만 뒤에서 받는다(lazy). 다 받기 전에는 예전 그림 그대로
//  - 패턴 그림은 발동 프레임(hit)이 기존 판정 시각에 오게 준비 구간을 늘이거나 줄인다
let spec = null, specP = null;
const loadSpec = () => specP ||= fetch('assets/anim2/spec.json').then(r => r.json()).then(j => (spec = j)).catch(() => (spec = {}));
const sheetOf = b => b && `${b.sheet}_r${b.row}`;
const tex = (k, act) => `a2_${k}_${act}`;

// 패턴 시작부터 판정까지(ms). [보통, 분노]. 표에 없는 패턴은 probe가 예고 시간을 잰다
const HIT = { jump: [940, 740], charge: [750, 550], ring: [350, 350], aimed: [250, 250], summon: [700, 700], slam: [900, 900], sweep: [850, 650], pools: [850, 850] };
const PREP = { jump: [220, 220] };   // 준비 자세(0..ready)에 쓰는 시간. 나머지는 공중·휘두름 구간

// 판 시작(Battle.create)이나 보스 등장 때 부른다. 받을 그림이 이미 있으면 바로 끝난다
export function anim2Warm(s, bossKeys, D) {
  if (s.bot || typeof fetch !== 'function') return Promise.resolve(false);
  return loadSpec().then(() => {
    const keys = bossKeys.map(k => sheetOf(D.BOSSES[k])).filter(k => k && spec[k]);
    const todo = [];
    for (const k of keys) for (const [act, e] of Object.entries(spec[k])) if (!s.textures.exists(tex(k, act))) todo.push([k, act, e]);
    if (!todo.length) return true;
    return new Promise(res => {
      if (!s.sys?.isActive()) return res(false);
      let left = todo.length;
      const done = () => { if (--left <= 0) res(true); };
      for (const [k, act, e] of todo) {
        const key = tex(k, act);
        s.load.once(`filecomplete-spritesheet-${key}`, done);
        s.load.spritesheet(key, 'assets/' + e.file, { frameWidth: e.fw, frameHeight: e.fh });
      }
      s.load.once('loaderror', done);   // 한 장이 없어도 나머지는 쓴다(없는 동작은 예전 그림)
      s.load.start();
    });
  });
}

// 기본 동작 반복 애니메이션
function baseAnim(s, k, act) {
  const key = tex(k, act), e = spec[k][act];
  if (!s.anims.exists(key) && s.textures.exists(key)) s.anims.create({ key, frames: s.anims.generateFrameNumbers(key, { start: 0, end: e.n - 1 }), frameRate: e.fps, repeat: act === 'idle' || act === 'move' ? -1 : 0 });
  return s.anims.exists(key) ? key : null;
}

// 패턴 애니메이션: 0..hit-1을 hitMs에 나눠 담고, hit부터는 권장 속도
function skillAnim(s, k, act, hitMs) {
  const e = spec[k][act], src = tex(k, act);
  if (!e || !s.textures.exists(src)) return null;
  const hit = e.hit ?? Math.floor(e.n / 2), ready = Math.min(e.ready ?? hit - 1, hit - 1);
  const key = `${src}_${hitMs}`;
  if (s.anims.exists(key)) return key;
  const step = Math.round(1000 / e.fps), pre = PREP[act]?.[0], fr = [];
  for (let i = 0; i < e.n; i++) {
    let d = step;
    if (i < hit) {
      const nPrep = ready + 1, nMid = hit - nPrep;
      if (pre != null && nMid > 0) d = i <= ready ? pre / nPrep : (hitMs - pre) / nMid;
      else d = hitMs / hit;
    }
    fr.push({ key: src, frame: i, duration: Math.max(1, Math.round(d) - 1) });
  }
  s.anims.create({ key, frames: fr, frameRate: 1000, repeat: 0 });
  return key;
}

// 패턴 함수가 바로 거는 예고(warnCircle·delayedCall)를 보고 판정까지 시간을 어림한다(패턴 동작은 그대로 한 번 돈다)
export function probeHit(ai, pat, fast, run) {
  const s = ai.s, tm = s.time, orig = tm.delayedCall, wc = [], dc = [];
  const ow = Object.prototype.hasOwnProperty.call(ai, 'warnCircle');
  tm.delayedCall = function (d, ...a) { dc.push(d); return orig.call(this, d, ...a); };
  const wOrig = ai.warnCircle;
  ai.warnCircle = function (x, y, r, ms, ...a) { wc.push(ms); return wOrig.call(this, x, y, r, ms, ...a); };
  try { run(); } finally { tm.delayedCall = orig; if (ow) ai.warnCircle = wOrig; else delete ai.warnCircle; }
  if (HIT[pat]) return HIT[pat][fast ? 1 : 0];
  if (wc.length) return Math.min(...wc);
  if (dc.length && !dc.some(d => d === 0)) { const d = Math.min(...dc); if (d >= 200) return Math.min(d, 1400); }
  return 800;
}

// 껍데기: 물리 몸 m을 따라다니며 그 상태(위치·뒤집기·색·투명도·크기)를 그대로 옮긴다
export function attachSkin(ai, D) {
  const s = ai.s, m = ai.m, k = sheetOf(ai.b);
  if (s.bot || !k) return null;
  const sk = { ai, k, sp: null, busy: false, dead: false };
  anim2Warm(s, [ai.key], D).then(ok => { if (ok && !sk.dead && m.active && !m.dead && spec[k]?.idle) on(sk); });
  return sk;
}

function on(sk) {
  const { ai, k } = sk, s = ai.s, m = ai.m, e = spec[k].idle;
  if (!baseAnim(s, k, 'idle')) return;
  baseAnim(s, k, 'move');
  const sp = sk.sp = s.add.sprite(m.x, m.y, tex(k, 'idle')).setOrigin(0.5, (e.footY + 1) / e.fh).play(tex(k, 'idle'));
  sp.preFX?.addGlow(0x000000, 2.5, 0, false, 0.1, 8);
  sk.oy = m.frame.height / 2;   // 예전 그림은 발이 프레임 맨 아래에 닿는다
  sk.sc = e.scale || 1;
  m.willRender = () => false;
  sk.sync = () => sync(sk);
  s.events.on('postupdate', sk.sync);
  s.events.once('shutdown', () => off(sk));
  sync(sk);
}

function sync(sk) {
  const m = sk.ai.m, sp = sk.sp;
  if (!sp || !m.active) return;
  sp.setPosition(m.x, m.y + sk.oy * m.scaleY).setScale(m.scaleX * sk.sc, m.scaleY * sk.sc).setFlipX(m.flipX).setAngle(m.angle).setAlpha(m.alpha).setDepth(m.depth);
  if (m.isTinted) { sp.setTint(m.tintTopLeft); sp.tintFill = m.tintFill; } else if (sp.isTinted) sp.clearTint();
  if (!sk.busy) {
    const v = m.body?.velocity, act = v && v.x * v.x + v.y * v.y > 16 && spec[sk.k].move ? 'move' : 'idle';
    if (sp.anims.currentAnim?.key !== tex(sk.k, act)) sp.play(tex(sk.k, act));
  }
}

// 잔상: ms 동안 gap마다 지금 그림을 붉게 남기고 흐리게 지운다(돌진·도약)
export function skinGhosts(sk, ms, gap = 60) {
  const sp = sk?.sp, s = sk?.ai.s;
  if (!sp || sk.dead) return;
  for (let t = 0; t < ms; t += gap) s.time.delayedCall(t, () => {
    if (!sp.active || sk.dead) return;
    const gh = s.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX)
      .setDepth(sp.depth - 0.01).setTintFill(0xff6040).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: gh, alpha: 0, duration: 260, onComplete: () => gh.destroy() });
  });
}

function off(sk) { sk.dead = true; if (sk.sync) sk.ai.s.events.off('postupdate', sk.sync); sk.sync = null; }

// 패턴 시작: 발동 프레임이 hitMs에 오게 재생하고 끝나면 대기·걷기로
export function skinSkill(sk, pat, hitMs) {
  if (!sk?.sp || !spec[sk.k][pat]) return false;
  const key = skillAnim(sk.ai.s, sk.k, pat, hitMs);
  if (!key) return false;
  sk.busy = true;
  sk.sp.play(key);
  sk.sp.once('animationcomplete-' + key, () => { sk.busy = false; });
  return true;
}

export function skinHurt(sk) {
  if (!sk?.sp || sk.busy || !spec[sk.k].hurt) return;
  const key = baseAnim(sk.ai.s, sk.k, 'hurt');
  if (!key) return;
  sk.busy = true; sk.sp.play(key); sk.sp.once('animationcomplete-' + key, () => { sk.busy = false; });
}

// 쓰러짐: 물리 몸이 사라져도 껍데기는 쓰러지는 그림을 끝까지 보여 준 뒤 흐려진다
export function skinDie(sk) {
  if (!sk) return false;
  off(sk);
  const sp = sk.sp, s = sk.ai.s;
  if (!sp) return false;
  const key = spec[sk.k].die && baseAnim(s, sk.k, 'die');
  sp.clearTint();
  const fade = () => s.tweens.add({ targets: sp, alpha: 0, duration: 600, delay: 300, onComplete: () => sp.destroy() });
  if (key) { sp.play(key); sp.once('animationcomplete-' + key, fade); } else fade();
  return true;
}
