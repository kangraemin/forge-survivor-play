// FX2 전투 효과 그림(game/assets/fx2, docs/fx2.md): 보스 예고 바닥·착탄·약점·페이즈 테두리·말풍선·분노 오라·습격 깃발·강화 궤적
// 시트 이름은 'x_<파일명>'. 그림이 없으면(로드 실패) 호출하는 쪽이 예전 그래픽으로 돌아간다
import { W, H } from './data.js';

// [프레임 너비, 높이, 프레임 수, 초당 프레임]
export const SHEETS = {
  warn_slam: [96, 96, 4, 8], warn_charge: [128, 40, 4, 8], warn_fan: [96, 96, 3, 8], warn_summon: [96, 96, 4, 8],
  impact_slam: [112, 112, 5, 20], impact_charge: [128, 40, 4, 16],
  weakpoint: [32, 32, 4, 10], weakpoint_break: [48, 48, 4, 18],
  rage_aura: [112, 112, 4, 8], trap_spikes: [80, 64, 4, 10],
  slash_plus5: [80, 80, 3, 24], slash_plus10: [96, 96, 4, 28], slash_plus15: [112, 112, 4, 28],
};
const IMAGES = ['phase_border', 'boss_bubble', 'raid_flag', 'merchant_tent'];

export function loadFx2(scene) {
  for (const [k, [w, h]] of Object.entries(SHEETS)) scene.load.spritesheet('x_' + k, `assets/fx2/${k}.png`, { frameWidth: w, frameHeight: h });
  for (const k of IMAGES) scene.load.image('x_' + k, `assets/fx2/${k}.png`);
}
export function makeFx2Anims(scene) {
  for (const [k, [, , n, fps]] of Object.entries(SHEETS)) {
    if (!scene.textures.exists('x_' + k) || scene.anims.exists('x_' + k)) continue;
    const loop = k === 'weakpoint' || k === 'rage_aura';
    scene.anims.create({ key: 'x_' + k, frames: scene.anims.generateFrameNumbers('x_' + k, { start: 0, end: n - 1 }), frameRate: fps, repeat: loop ? -1 : 0 });
  }
}
export const has = (s, k) => s.textures.exists('x_' + k);

// ── 예고 바닥: 시간(0~1)에 따라 프레임이 차오른다. 그림이 없으면 null ──
// 원형(내려찍기)·소환 마법진: 납작한 타원(가로 r, 세로 0.75r)
export function warnDisc(s, x, y, r, summon = false) {
  const k = summon ? 'warn_summon' : 'warn_slam';
  if (!has(s, k)) return null;
  const sp = s.add.sprite(x, y, 'x_' + k, 0).setDepth(9).setScale(r * 2 / 90, r * 1.5 / 90);
  sp.step = f => sp.setFrame(Math.min(3, Math.floor(f * 4))).setAlpha(0.7 + 0.3 * Math.abs(Math.sin(f * 12)));
  return sp;
}
// 직선 띠(돌진·조준선): (x,y)에서 ang 방향으로 len, 폭 w
export function warnStrip(s, x, y, ang, len, w) {
  if (!has(s, 'warn_charge')) return null;
  const sp = s.add.sprite(x, y, 'x_warn_charge', 0).setOrigin(0, 0.5).setRotation(ang).setScale(len / 122, w / 34).setDepth(9);
  sp.step = f => sp.setFrame(Math.min(3, Math.floor(f * 4))).setAlpha(0.75 + 0.25 * Math.abs(Math.sin(f * 14)));
  return sp;
}
// 부채꼴(약 ±45도): 꼭짓점이 (x,y), ang 방향으로 반지름 len
export function warnFan(s, x, y, ang, len) {
  if (!has(s, 'warn_fan')) return null;
  const sp = s.add.sprite(x, y, 'x_warn_fan', 0).setOrigin(0.5, 80 / 96).setRotation(ang + Math.PI / 2).setScale(len / 78).setDepth(9);
  sp.step = f => sp.setFrame(Math.min(2, Math.floor(f * 3))).setAlpha(0.75 + 0.25 * Math.abs(Math.sin(f * 14)));
  return sp;
}
// 시간에 맞춰 step을 돌려 주는 트윈. ms 뒤 onDone
export function runWarn(s, sp, ms, onDone) {
  const st = { f: 0 };
  s.tweens.add({ targets: st, f: 1, duration: ms, onUpdate: () => sp.active && sp.step(st.f), onComplete: () => { sp.destroy(); onDone && onDone(); } });
}

// ── 한 번 재생하고 사라지는 그림 ──
export function playOnce(s, key, x, y, { sx = 1, sy = sx, rot = 0, depth = 30, alpha = 1, origin } = {}) {
  if (!has(s, key)) return null;
  const sp = s.add.sprite(x, y, 'x_' + key, 0).setScale(sx, sy).setRotation(rot).setDepth(depth).setAlpha(alpha);
  if (origin) sp.setOrigin(origin[0], origin[1]);
  sp.play('x_' + key); sp.once('animationcomplete', () => sp.destroy());
  return sp;
}

// ── 페이즈 전환 화면 테두리(9슬라이스 12px, 중앙은 비어 있다) ──
export function phaseBorder(s, ms = 900, tint = 0xffd060) {
  if (!has(s, 'phase_border')) return null;
  const b = s.add.nineslice(0, 0, 'x_phase_border', undefined, W, H, 12, 12, 12, 12).setOrigin(0).setScrollFactor(0).setDepth(62).setTint(tint).setAlpha(0);
  s.tweens.add({ targets: b, alpha: 0.95, duration: 120, yoyo: true, hold: ms * 0.5, onComplete: () => b.destroy() });
  return b;
}
// 약점 구간 동안 켜 두는 옅은 테두리. 반환한 것을 destroy하면 꺼진다
export function weakBorder(s) {
  if (!has(s, 'phase_border')) return null;
  const b = s.add.nineslice(0, 0, 'x_phase_border', undefined, W, H, 12, 12, 12, 12).setOrigin(0).setScrollFactor(0).setDepth(62).setTint(0xffc040).setAlpha(0.2);
  s.tweens.add({ targets: b, alpha: 0.65, duration: 260, yoyo: true, repeat: -1 });
  return b;
}
// 말풍선 틀(9슬라이스 12/12/10/14, 왼쪽 아래 꼬리). 글자 폭에 맞춰 늘려 컨테이너로 돌려 준다
export function bubbleFrame(s, w, h) {
  if (!has(s, 'boss_bubble')) return null;
  return s.add.nineslice(0, 0, 'x_boss_bubble', undefined, w, h, 12, 12, 10, 14).setOrigin(0.5);
}

// 분노 오라: 보스 뒤에서 반복
export function rageAura(s, m) {
  if (!has(s, 'rage_aura')) return null;
  const a = s.add.sprite(m.x, m.y, 'x_rage_aura', 0).setDepth(8).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
  a.setScale(Math.max(1, m.displayWidth * 1.5 / 100)).play('x_rage_aura');
  const follow = () => { if (!m.active || !a.active) { s.events.off('update', follow); a.destroy(); return; } a.setPosition(m.x, m.y + m.displayHeight * 0.05); };
  s.events.on('update', follow);
  return a;
}

// 습격 깃발: 화면 가장자리(원점 기준 방향 ex, ey)에 꽂혀 깜빡인다
export function raidFlag(s, ex, ey, ms = 2600) {
  if (!has(s, 'raid_flag')) return null;
  const x = ex > 0.5 ? W - 22 : ex < -0.5 ? 22 : W / 2, y = ey > 0.5 ? H - 40 : ey < -0.5 ? 100 : H / 2;
  const f = s.add.image(x, y, 'x_raid_flag').setScrollFactor(0).setDepth(61).setScale(1.5);
  s.tweens.add({ targets: f, y: y - 4, scale: 1.75, duration: 200, yoyo: true, repeat: Math.floor(ms / 400), onComplete: () => s.tweens.add({ targets: f, alpha: 0, duration: 300, onComplete: () => f.destroy() }) });
  return f;
}
