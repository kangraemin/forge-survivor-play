import { t } from './i18n.js';
import { PETS } from './gear.js';
import { font, font9 } from './ui.js';
const W = 270;
// 펫 역할: 줍기(떨어진 것을 끌어온다) · 약화(적이 20% 더 아프게 맞는다) · 표식(센 적 하나를 찍어 40% 더 아프게) · 수호(피해를 막는다)
// 펫마다 주 역할이 하나 있고, 맵 상성(fit)이 좋으면 범위·빈도가 늘어난다. 그림은 assets/pet2 (docs/pet2.md)
export const ROLES = {
  pickup: { name: t('petRoles.10fbba'), icon: 'role_pickup', color: '#ffd75e', desc: t('petRoles.a01b38') },
  weaken: { name: t('petRoles.69d8b7'), icon: 'role_weaken', color: '#c08aff', desc: t('petRoles.462087') },
  mark: { name: t('petRoles.840ba0'), icon: 'role_mark', color: '#ff7a7a', desc: t('petRoles.819390') },
  guard: { name: t('petRoles.0be109'), icon: 'role_guard', color: '#7ad0ff', desc: t('petRoles.9f506f') },
};
export const PET_ROLE = {
  general: 'guard', lavagolem: 'guard', crystcolossus: 'guard', sandcolossus: 'guard',
  kingslime: 'pickup', swampqueen: 'pickup', tidewyrm: 'pickup', wyrm: 'pickup',
  lich: 'weaken', voidlord: 'weaken', steamgeneral: 'weaken', thunderdragon: 'weaken',
  demonlord: 'mark', stormcaptain: 'mark', mirrorlord: 'mark', forgegod: 'mark',
};
export const roleOf = id => ROLES[PET_ROLE[id]];

export const FREE_PET_IDS = Object.keys(PET_ROLE);
const ROLE_ICONS = ['pickup', 'weaken', 'mark', 'guard'];
const STATUS_ICONS = ['freeze', 'poison', 'weaken'];

// Boot: 시트(32x32 셀)와 역할 아이콘을 읽고 애니메이션을 만든다
export function loadPetRoles(scene) {
  for (const id of FREE_PET_IDS) for (const k of ['pickup', 'cast']) scene.load.spritesheet(`pr_${id}_${k}`, `assets/pet2/${id}_${k}.png`, { frameWidth: 32, frameHeight: 32 });
  for (const r of ROLE_ICONS) scene.load.image(`role_${r}`, `assets/pet2/ui_role_${r}.png`);
  for (const k of STATUS_ICONS) scene.load.image(`status_${k}`, `assets/pet2/status_${k}.png`);
  scene.load.spritesheet('fx_mark_target', 'assets/pet2/fx_mark_target.png', { frameWidth: 32, frameHeight: 32 });
}
export function makePetRoleAnims(scene) {
  for (const id of FREE_PET_IDS) for (const k of ['pickup', 'cast']) {
    const key = `pr_${id}_${k}`;
    if (scene.textures.exists(key) && !scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 2 }), frameRate: 8, repeat: 0 });
  }
  if (scene.textures.exists('fx_mark_target') && !scene.anims.exists('fx_mark_target')) scene.anims.create({ key: 'fx_mark_target', frames: scene.anims.generateFrameNumbers('fx_mark_target', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
}

const D2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 전투: Pet.update에서 매 프레임 부른다. pet.rt는 역할 타이머
export function roleTick(pet, dt) {
  const s = pet.s, role = PET_ROLE[pet.def.id];
  pet.rt = (pet.rt || 0) + dt;
  const f = pet.fit;
  if (role === 'pickup') {
    if (pet.rt < 1500 / f) return;
    pet.rt = 0;
    const r = 150 * f;
    const its = s.items.getChildren().filter(i => !i.pull && D2(i, s.hero) < r);
    const gms = s.gems.getChildren().filter(g => !g.pull && D2(g, s.hero) < r);
    if (!its.length && !gms.length) return;
    its.slice(0, 4).forEach(i => { i.pull = true; });
    gms.slice(0, 8).forEach(g => { g.pull = true; });
    roleAnim(pet, 'pickup');
  } else if (role === 'weaken') {
    if (pet.rt < 4000 / f) return;
    const ms = pet.near(160, f > 1 ? 3 : 2).filter(m => !(m.curse > s.bt));
    if (!ms.length) return;
    pet.rt = 0;
    ms.forEach(m => { m.curse = s.bt + 4000 * f; statusIcon(s, m, 'weaken', 4000 * f); });
    roleAnim(pet, 'cast');
  } else if (role === 'mark') {
    if (pet.rt < 6000 / f) return;
    const live = s.liveMobs.filter(m => !m.dead && m.active && D2(m, pet) < 220);
    if (!live.length) return;
    pet.rt = 0;
    const t = live.sort((a, b) => (b.isBoss ? 1e9 : b.hp) - (a.isBoss ? 1e9 : a.hp))[0];
    t.marked = s.bt + 5000 * f;
    const fx = s.add.sprite(t.x, t.y, 'fx_mark_target').setDepth(31).play('fx_mark_target');
    const follow = () => { if (!fx.active || t.dead || !t.active) { s.events.off('update', follow); fx.destroy(); return; } fx.setPosition(t.x, t.y - 4); };
    s.events.on('update', follow);
    s.time.delayedCall(5000 * f, () => { s.events.off('update', follow); if (fx.active) fx.destroy(); });
    roleAnim(pet, 'cast');
  }
}

function roleAnim(pet, kind) {
  const key = `pr_${pet.def.id}_${kind}`, g = pet.g, s = pet.s;
  if (!s.anims.exists(key)) return;
  g.play(key);
  s.time.delayedCall(450, () => { if (g.active && s.anims.exists(pet.def.id)) g.play(pet.def.id); });
}

function statusIcon(s, m, kind, ms) {
  if (!s.textures.exists(`status_${kind}`)) return;
  const i = s.add.image(m.x, m.y - 20, `status_${kind}`).setDepth(31);
  const follow = () => { if (!i.active || m.dead || !m.active) { s.events.off('update', follow); i.destroy(); return; } i.setPosition(m.x, m.y - m.height * (m.bs || 1) * 0.5 - 6); };
  s.events.on('update', follow);
  s.time.delayedCall(ms, () => { s.events.off('update', follow); if (i.active) i.destroy(); });
}

// 52차: 펫 설명 카드 — 얻을 때 팝업·펫 탭에서 같은 모양. 그림·이름·역할·실제 효과(수치)·잘 듣는 장·지금 펫과 비교
const ROLE_FX = {
  pickup: () => t('petRoles.e1c9e7'),
  weaken: () => t('petRoles.0efcb2'),
  mark: () => t('petRoles.fb23df'),
  guard: () => t('gear.e0457f'),
};
export function petCard(s, c, p, sv, y0 = 100) {
  const role = roleOf(p.id), cur = PETS.find(x => x.id === sv.pet), curRole = cur && roleOf(cur.id), id = PET_ROLE[p.id];
  const chN = i => t('lobby.022fbd', { v: i + 1 });
  c.add(s.add.image(W / 2, y0 + 20, 'disc').setScale(0.9).setTint(p.color).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD));
  const fb = s.registry.get('fallback')?.[p.id];
  if (s.anims.exists(p.id)) { const g = s.add.sprite(W / 2, y0 + 20, null).play(p.id).setScale(fb ? 1.2 : 0.6); if (fb) g.setTint(p.color); c.add(g); }
  let y = y0 + 48;
  c.add(s.add.text(W / 2, y, `${p.name}  Lv ${sv.pets?.[p.id] || 0}`, font(14, '#ffffff')).setOrigin(0.5)); y += 22;
  const line = (txt, style) => { const o = s.add.text(24, y, txt, { ...style, wordWrap: { width: W - 48 } }).setOrigin(0, 0); c.add(o); y += o.height + 3; };
  if (role) {
    if (s.textures.exists(role.icon)) c.add(s.add.image(34, y + 7, role.icon).setScale(0.62));
    c.add(s.add.text(50, y, t('petRoles.77fe00', { name: role.name }), font(12, role.color))); y += 18;
    line(`- ${ROLE_FX[id]()}`, font9(10, '#f2e4bc'));
    line(id === 'guard' ? t('petRoles.455a20') : t('petRoles.1c3d00'), font9(10, '#f2e4bc'));
  }
  line(t('lobby.7e168d', { v: (p.good || []).map(chN).join(' · ') || '-' }), font9(10, '#5fdc6a'));
  y += 3;
  c.add(s.add.text(24, y, t('petRoles.66ac2a'), font(12, '#ffd75e'))); y += 18;
  if (!cur) line(t('petRoles.78fc89'), font9(10, '#f2e4bc'));
  else if (cur.id === p.id) line(t('petRoles.e960b5'), font9(10, '#f2e4bc'));
  else {
    line(t('petRoles.7d68c8', { name: cur.name, v: curRole?.name || '-', name2: p.name, v2: role?.name || '-' }), font9(10, '#f2e4bc'));
    line(curRole && role && curRole === role ? t('petRoles.95dbce') : t('petRoles.433048', { v: curRole?.name || '-', v2: role?.name || '-' }), font9(10, '#a1b2b6'));
  }
  return y;
}
