// 66차: 보스 약점·해법. 4~15장 장 보스·중간보스마다 '이 갈래로 치면 덜 들어간다'는 장치 하나를 갖는다.
// 근접 무기라도 원거리·마법·관통·광역·둔화 보조 스킬을 섞으면 풀린다(무기를 바꿀 필요는 없다). 플레이어 스탯은 건드리지 않고 보스 쪽 규칙만 더한다.
import { t } from './i18n.js';
import { font } from './ui.js';

// 보스 key → 약점 종류
export const WEAK = {
  wyrm: 'swift', glacierbear: 'armor',
  demonlord: 'guard', executioner: 'thorn',
  tidewyrm: 'ward', coralcrab: 'armor',
  swampqueen: 'thorn', bogtoad: 'swift',
  crystcolossus: 'mirror', crystscorp: 'armor',
  stormcaptain: 'swift', griffin: 'ward',
  voidlord: 'guard', voideye: 'mirror',
  sandcolossus: 'armor', sandmummy: 'guard',
  steamgeneral: 'armor', steamspider: 'guard',
  thunderdragon: 'swift', thunderbird: 'mirror',
  mirrorlord: 'guard', harlequin: 'mirror',
  forgegod: 'armor', anviltortoise: 'thorn',
};

// hint: 등장 때 말풍선, tag: 깎였을 때 뜨는 짧은 글. f: 맞은 방식에 따른 배수(o = { tag, pierce, skill })
export const KINDS = {
  thorn: { hint: t('bw.hint.thorn'), tag: t('bw.tag.thorn'), f: o => (o.tag === 'melee' ? 0.3 : 1) },
  ward: { hint: t('bw.hint.ward'), tag: t('bw.tag.ward'), f: o => (o.tag === 'ranged' && !o.pierce ? 0.2 : 1) },
  mirror: { hint: t('bw.hint.mirror'), tag: t('bw.tag.mirror'), f: o => (o.tag === 'magic' ? 0.25 : 1) },
  armor: { hint: t('bw.hint.armor'), tag: t('bw.tag.armor'), f: o => (o.pierce ? 1 : 0.25) },
  swift: { hint: t('bw.hint.swift'), tag: t('bw.tag.swift'), f: (o, m) => (m.slow > 0 || m.freeze > 0 ? 1 : 0.5) },
  guard: { hint: t('bw.hint.guard'), tag: t('bw.tag.guard'), f: (o, m, ai) => (ai.guards() > 0 ? 0.15 : 1) },
};

// [최대 체력 비율, 간격 ms, 보스 공격력 비율 바닥]
const RETORT = { thorn: [0.1, 600, 0.7], ward: [0.07, 900, 0.35], mirror: [0.07, 900, 0.35], armor: [0.06, 1000, 0.3], swift: [0.05, 1000, 0.3] };

// 약점이 적용되는 판: 일반 진행(무한의 탑·던전·연습·모드는 제외)
export function weakOf(s, key) {
  if (s.endless || s.dungeon || s.practice || s.mode) return null;
  const k = WEAK[key];
  return k ? { kind: k, ...KINDS[k] } : null;
}

// hitMob에서: 맞은 방식에 따라 보스가 받는 피해 배수. 가시는 근접으로 칠 때 되받아친다
export function weakMul(s, m, o) {
  const ai = m.bossAI, w = ai?.wk; if (!w) return 1;
  const mul = w.f(o, m, ai);
  if (mul < 1 && s.bt - (ai.wkTxt || -1e9) > 1200) {
    ai.wkTxt = s.bt;
    const tx = s.add.text(m.x + Phaser.Math.Between(-16, 16), m.y - m.displayHeight * 0.45, w.tag, font(9, '#ff9a5a', 3)).setOrigin(0.5).setDepth(40);
    s.tweens.add({ targets: tx, y: tx.y - 16, alpha: 0, duration: 700, onComplete: () => tx.destroy() });
  }
  // 되받아치기: 못 푼 갈래로 칠수록 보스가 되갚는다(가시=근접 반사, 방패=막힌 원거리, 거울=마법 반사, 장갑=관통 못 한 타격의 충격, 질주=둔화 없이 건드린 반격). 풀면(mul=1) 아무 일도 없다
  // 되갚는 양은 내 최대 체력에 비례해 일정하다 — 체력 투자·강화로 버티는 게 아니라 '풀어야' 끝난다
  // 최근 타격 중 막힌 비율(share)이 클수록 되갚음이 세다. 풀이 스킬이 딜의 상당 부분을 맡으면(막힌 비율 25% 아래) 되갚음이 없다
  ai.tw = (ai.tw || 0) * 0.985 + 1; ai.pw = (ai.pw || 0) * 0.985 + (mul < 1 ? 1 : 0);
  const R = w.kind === 'guard' ? null : RETORT[w.kind], share = ai.pw / ai.tw, k = Math.max(0, (share - 0.25) / 0.75);
  if (mul < 1 && R && k > 0 && s.bt - (ai.thornAt || -1e9) > R[1]) { ai.thornAt = s.bt; s.hurt(Math.max(m.dmg * R[2], s.maxHp * R[0]) * k, w.kind); }
  return mul;
}

// 소환형(guard): 졸개가 살아 있는 동안 보스가 거의 안 다친다. 광역으로 졸개를 쓸어야 한다
export const GuardMixin = {
  guards() { return this.gdList ? (this.gdList = this.gdList.filter(g => g.active && !g.dead)).length : 0; },
  guardTick(dt) {
    const s = this.s, m = this.m;
    if (this.wk?.kind !== 'guard') return;
    this.gdT = (this.gdT ?? 3500) - dt;
    if (this.gdT <= 0 && this.guards() < 10 && !m.dead) {
      this.gdT = this.guards() === 0 ? 8000 : 5000;   // 졸개를 쓸어 두면 느리게, 남겨 두면 빨리 불어난다
      const n = this.mid ? 3 : 4;
      this.gdList = this.gdList || [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + Math.random(), x = Phaser.Math.Clamp(m.x + Math.cos(a) * 52, 40, 1560), y = Phaser.Math.Clamp(m.y + Math.sin(a) * 40, 40, 1560);
        const g = s.spawn(false, s.ch.mobs[0], { force: true, at: { x, y } });
        if (g) { g.guard = true; g.orb = true; g.setTint(0xa0ffd0); g.baseTint = 0xa0ffd0; this.gdList.push(g); }
      }
      this.bubble(t('bw.guardcall'), 1600);
    }
    // 방벽: 졸개가 있는 동안 보스 둘레에 초록 막
    const on = this.guards() > 0;
    if (on && !this.gdGfx) this.gdGfx = s.add.ellipse(m.x, m.y, m.displayWidth * 1.2, m.displayHeight * 1.1, 0x66ffaa, 0.18).setStrokeStyle(2, 0xbfffd8, 0.9).setDepth(m.depth + 0.5);
    if (this.gdGfx) { this.gdGfx.setPosition(m.x, m.y).setVisible(on); }
  },
};

// 등장 힌트: 체력 막대가 뜰 때(1.7초) 말풍선 한 줄
export function showHint(ai) {
  const w = ai.wk; if (!w) return;
  ai.s.time.delayedCall(1900, () => { if (ai.m.active && !ai.m.dead) ai.bubble(w.hint, 3600); });
}
