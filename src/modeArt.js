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

// 3~15장 장 테마 그림(game/assets/modes/ch<장>_<이름>.png, 32x32 프레임). 키는 판 번호(장-1). 지키기 4프레임, 나머지 2프레임
// 파일이 없으면 chArt가 null을 돌려 줘서 호출한 쪽이 기존 그림·도형으로 그린다
export const CH_ART = {
  guard: { 2: 'ch3_lava_cart', 3: 'ch4_ice_sled', 4: 'ch5_sigil_stone', 5: 'ch6_tide_cart', 6: 'ch7_herb_jar', 7: 'ch8_crystal_core', 8: 'ch9_sail_cart', 9: 'ch10_lantern', 10: 'ch11_caravan_cart', 11: 'ch12_boiler', 12: 'ch13_lightning_altar', 13: 'ch14_crystal_statue', 14: 'ch15_relic_anvil' },
  capture: { 2: 'ch3_lava_pad', 3: 'ch4_ember', 4: 'ch5_sigil', 5: 'ch6_altar', 6: 'ch7_dry_stone', 7: 'ch8_resonance', 8: 'ch9_flagpole', 9: 'ch10_lighthouse', 10: 'ch11_oasis', 11: 'ch12_valve', 12: 'ch13_rod_pillar', 13: 'ch14_prism', 14: 'ch15_anvil_zone' },
  breach: { 2: 'ch3_stone_step', 3: 'ch4_ice_ledge', 4: 'ch5_seal_stone', 5: 'ch6_wave', 6: 'ch7_fog_cloud', 7: 'ch8_crystal_rock', 8: 'ch9_wind_arrow', 9: 'ch10_dark_orb', 10: 'ch11_sand_swirl', 11: 'ch12_steam_vent', 12: 'ch13_thunder_cloud', 13: 'ch14_mirror_shard', 14: 'ch15_furnace_flame' },
  hunt: { 2: 'ch3_lava_pool', 3: 'ch4_tracks', 4: 'ch5_escort_sigil', 5: 'ch6_dive_ripple', 6: 'ch7_stream', 7: 'ch8_laser_cover', 8: 'ch9_wind_rider', 9: 'ch10_hide_dark', 10: 'ch11_burrow', 11: 'ch12_overclock', 12: 'ch13_blink_rod', 13: 'ch14_decoy', 14: 'ch15_anvil_orbit' },
};
export const CH_SHEETS = Object.entries(CH_ART).flatMap(([kind, m]) => Object.values(m).map(name => [name, 32, 32, kind === 'guard' ? 4 : 2, kind === 'guard' ? 8 : kind === 'capture' ? 0 : 3]));
// 그 판의 장 그림 이름(파일이 안 읽혔으면 null)
export const chArt = (scene, kind, stage) => {
  const n = CH_ART[kind]?.[stage], k = 'ma_' + n;
  return n && scene.textures.exists(k) && scene.textures.get(k).frameTotal > 2 ? n : null;
};
// 장 그림을 한 장 놓는다(없으면 null). 애니메이션이 있으면 재생
export const chSprite = (scene, kind, stage, x, y, scale = 2, depth = 6) => {
  const n = chArt(scene, kind, stage); if (!n) return null;
  const sp = scene.add.sprite(x, y, 'ma_' + n, 0).setScale(scale).setDepth(depth);
  if (scene.anims.exists('ma_' + n)) sp.play({ key: 'ma_' + n, startFrame: Math.floor(Math.random() * 2) });
  return sp;
};

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
  for (const [name, , , n, fps] of CH_SHEETS) {
    const key = 'ma_' + name;
    if (n > 1 && fps && scene.textures.exists(key) && !scene.anims.exists(key) && scene.textures.get(key).frameTotal > n)
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  }
  for (const k of MODE_IMAGES) if (!scene.textures.exists('ma_' + k)) shape(scene, 'ma_' + k, DRAW.alt);
}
export const modeAnim = (scene, spr, name) => { if (scene.anims.exists('ma_' + name)) spr.play('ma_' + name); return spr; };
