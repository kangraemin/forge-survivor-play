// 모드 그림(game/assets/modes, 규격은 docs/modes_art.md). Boot가 시트를 'ma_<이름>' 키로 읽고, 여기서 애니메이션을 만든다
// 그림이 없는 횃불·거미줄과, 파일이 빠졌을 때의 대체는 간단한 도형으로 그린다
// [파일 이름, 프레임 폭, 프레임 높이, 프레임 수, 초당 프레임(0이면 정지)]
export const MODE_SHEETS = [
  ['cart', 32, 32, 4, 8], ['cart_hit', 32, 32, 2, 0], ['cart_broken', 32, 32, 1, 0], ['anvil_guard', 32, 32, 4, 5],
  ['goal_flag', 24, 32, 4, 6], ['zone_ring', 64, 64, 4, 5], ['zone_fill', 64, 64, 1, 0], ['zone_banner', 16, 32, 2, 0],
  ['wall_dark', 64, 32, 4, 6], ['wall_lava', 64, 32, 4, 6], ['wall_ice', 64, 32, 4, 6], ['wall_void', 64, 32, 4, 6],
  ['finish_gate', 64, 48, 4, 5], ['arrow_up', 16, 16, 4, 6],
  ['elite_mark', 16, 16, 4, 5], ['elite_aura', 40, 24, 4, 5], ['elite_arrow', 16, 16, 2, 4], ['catch_burst', 48, 48, 5, 14],
];
export const MODE_IMAGES = ['mode_defend', 'mode_capture', 'mode_breakout', 'mode_hunt', 'modes_bg'];
export const MODE_ICON = { guard: 'mode_defend', capture: 'mode_capture', breach: 'mode_breakout', hunt: 'mode_hunt' };
// 장 테마에 맞는 추격 벽(그 밖은 어둠)
export const wallArt = c => ({ 2: 'wall_lava', 3: 'wall_ice', 9: 'wall_void', 11: 'wall_lava', 12: 'wall_void', 14: 'wall_lava' }[c] || 'wall_dark');
export const WALL_FILL = { wall_dark: 0x0b0614, wall_lava: 0x2a0a06, wall_ice: 0x0c1a2c, wall_void: 0x07031a };

const DRAW = {
  torch: [14, 26, g => { g.fillStyle(0x5a3a1a).fillRect(6, 10, 3, 16).fillStyle(0xff9a3c).fillCircle(7.5, 7, 5).fillStyle(0xffe070).fillCircle(7.5, 8, 2.5); }],
  web: [64, 64, g => { g.lineStyle(1, 0xe8e8f0, 0.85); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(32, 32, 32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); } for (const r of [10, 20, 30]) g.strokeCircle(32, 32, r); }],
  // 파일이 없을 때만 쓰는 대체
  alt: [32, 32, g => { g.fillStyle(0x6a7284).fillRect(6, 10, 20, 16).fillStyle(0x9ae0ff).fillRect(14, 2, 4, 10); }],
};
const shape = (scene, key, [w, h, fn]) => {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false }); fn(g); g.generateTexture(key, w, h); g.destroy();
};

// 애니메이션 만들기와 도형 대체(여러 번 불러도 안전)
export function ensureModeArt(scene) {
  shape(scene, 'mode_torch', DRAW.torch); shape(scene, 'mode_web', DRAW.web);
  for (const [name, , , n, fps] of MODE_SHEETS) {
    const key = 'ma_' + name;
    if (!scene.textures.exists(key)) shape(scene, key, DRAW.alt);   // 파일이 빠졌어도 판은 돈다
    if (n > 1 && fps && !scene.anims.exists(key) && scene.textures.get(key).frameTotal > n)
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  }
  for (const k of MODE_IMAGES) if (!scene.textures.exists('ma_' + k)) shape(scene, 'ma_' + k, DRAW.alt);
}
export const modeAnim = (scene, spr, name) => { if (scene.anims.exists('ma_' + name)) spr.play('ma_' + name); return spr; };
