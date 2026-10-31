// 66차: 보스 약점·해법. 4~15장 장 보스·중간보스마다 '이 갈래로 치면 덜 들어간다'는 장치 하나를 갖는다.
// 근접 무기라도 원거리·마법·관통·광역·둔화 보조 스킬을 섞으면 풀린다(무기를 바꿀 필요는 없다). 플레이어 스탯은 건드리지 않고 보스 쪽 규칙만 더한다.
import { t } from './i18n.js';
import { font } from './ui.js';
import * as D from './data.js';
import { insetsGame } from './safeArea.js';

// 보스 key → 약점 종류
export const WEAK = {
  lavagolem: 'armor',
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

// 66·67차: 약점 갈래마다 '답 스킬' 2~5개(범용 2 + 무기 전용 몇 개). 무기 기본 공격은 답이 아니다 — 스킬을 골라 키워야 풀린다.
// 막힌 딱지가 붙은 스킬은 피해가 WARD.block 배만 들어가고, 답 스킬이 보스 방벽(WARD.frac x 체력)을 깨면 WARD.open ms 동안 약점이 드러나 전부 들어간다. 방벽은 다시 차오른다.
export const ANS = {
  thorn: ['dagger', 'bolt', 'volley', 'grenade', 'missile'],
  ward: ['spin', 'dagger', 'quake', 'palm'],
  mirror: ['spin', 'dagger', 'wave', 'quake', 'palm', 'missile'],
  armor: ['dagger', 'ice', 'javelin', 'volley', 'missile'],
  swift: ['ice', 'palm', 'holy'],
};
export const WARD = { frac: 0.17, block: 0.2, open: 9000, tc: 6000, th: 0.55, rs: 4, midx: 2, midRs: 1.5 };
// hint: 등장 때 말풍선(답 스킬 이름이 {list}로 들어간다), tag: 막혔을 때 뜨는 짧은 글
export const KINDS = {
  thorn: { hint: list => t('bw.hint.thorn', { list }), tag: t('bw.tag.thorn') },
  ward: { hint: list => t('bw.hint.ward', { list }), tag: t('bw.tag.ward') },
  mirror: { hint: list => t('bw.hint.mirror', { list }), tag: t('bw.tag.mirror') },
  armor: { hint: list => t('bw.hint.armor', { list }), tag: t('bw.tag.armor') },
  swift: { hint: list => t('bw.hint.swift', { list }), tag: t('bw.tag.swift') },
  guard: { hint: () => t('bw.hint.guard'), tag: t('bw.tag.guard'), f: (o, m, ai) => (ai.guards() > 0 ? 0.15 : 1) },
};
// 이 판 무기로 얻을 수 있는 답 스킬 이름들(힌트 글에 쓴다)
export const answersFor = (kind, wid) => (ANS[kind] || []).filter(k => !D.SKILLS[k].own || D.SKILLS[k].own === wid);

// [최대 체력 비율, 간격 ms, 보스 공격력 비율 바닥]
const RETORT = { thorn: [0.05, 1000, 0.7], ward: [0.04, 1000, 0.35], mirror: [0.04, 1000, 0.35], armor: [0.04, 1000, 0.3], swift: [0.03, 1000, 0.3] };

// 약점이 적용되는 판: 일반 진행(무한의 탑·던전·연습·모드는 제외)
export function weakOf(s, key) {
  if (s.endless || s.dungeon || s.practice || s.mode) return null;
  const k = WEAK[key];
  if (!k) return null;
  const w = { kind: k, ...KINDS[k] };
  w.hint = w.hint(answersFor(k, s.wtype?.id).map(x => D.SKILLS[x].name).join(' · '));
  return w;
}

// hitMob에서: 보스가 받는 피해 배수. 못 푼 갈래로 칠수록 보스가 되갚는다
export function weakMul(s, m, o) {
  const ai = m.bossAI, w = ai?.wk; if (!w) return 1;
  let mul;
  if (w.f) mul = w.f(o, m, ai);
  else {
    const wmax = (ai.fitBase || m.maxHp) * WARD.frac * (ai.mid ? WARD.midx : 1);
    if (ai.ward === undefined) ai.ward = wmax;
    if (ai.openUntil > s.bt) mul = 1;
    else {
      if (ai.openUntil) { ai.openUntil = 0; ai.ward = wmax; }
      if (o.skill && ANS[w.kind].includes(o.skill)) {
        mul = 1; ai.ward -= (o.raw || 0) * Math.min(1, (s.run?.skills?.[o.skill] || 1) / 5) ** 2;   // 답 스킬은 5레벨이 돼야 방벽을 제대로 깬다
        if (ai.ward <= 0) {
          ai.openUntil = s.bt + WARD.open;
          const tx = s.add.text(m.x, m.y - m.displayHeight * 0.5, t('battle.6fbdb2'), font(12, '#ffe060', 3)).setOrigin(0.5).setDepth(40);
          s.tweens.add({ targets: tx, y: tx.y - 20, alpha: 0, duration: 900, onComplete: () => tx.destroy() });
        }
      } else mul = WARD.block;
    }
    ai.wardFrac = ai.openUntil > s.bt ? 0 : Math.max(0, ai.ward / wmax);
    wardBar(s, ai);
  }
  if (typeof window !== 'undefined' && window.__wkStat) { const st = window.__wkStat, r = o.raw || 0, k = o.skill || o.tag || 'x'; st.raw += r; st.dealt += r * mul; (st.by[k] ||= [0, 0])[0] += r; st.by[k][1] += r * mul; }   // 시뮬 계측(브라우저에서는 꺼져 있다)
  if (mul < 1 && s.bt - (ai.wkTxt || -1e9) > 1200) {
    ai.wkTxt = s.bt;
    const tx = s.add.text(m.x + Phaser.Math.Between(-16, 16), m.y - m.displayHeight * 0.45, w.tag, font(9, '#ff9a5a', 3)).setOrigin(0.5).setDepth(40);
    s.tweens.add({ targets: tx, y: tx.y - 16, alpha: 0, duration: 700, onComplete: () => tx.destroy() });
  }
  // 되받아치기: 막힌 타격 비율(최근 피해 가중)이 클수록 세다. 되갚는 양은 내 최대 체력에 비례해 일정하다 — 체력 투자·강화로 버티는 게 아니라 '풀어야' 끝난다
  const dt = s.bt - (ai.sT ?? s.bt), dec = Math.exp(-dt / WARD.tc); ai.sT = s.bt;
  const r = o.raw || 1; ai.tw = (ai.tw || 0) * dec + r; ai.pw = (ai.pw || 0) * dec + (mul < 1 ? r : 0);
  const R = w.kind === 'guard' ? null : RETORT[w.kind], share = ai.pw / ai.tw, k = Math.max(0, (share - WARD.th) / (1 - WARD.th));
  if (mul < 1 && R && k > 0 && s.bt - (ai.thornAt || -1e9) > R[1]) { ai.thornAt = s.bt; s.hurt(Math.max(m.dmg * R[2], s.maxHp * R[0] * WARD.rs * (ai.mid ? WARD.midRs : 1)) * k, w.kind); }
  return mul;
}

// 방벽 막대: 체력 막대 바로 아래 가는 줄(차 있을수록 막혀 있다, 비면 약점 노출)
function wardBar(s, ai) {
  const b0 = ai.bar?.[0]; if (!b0) return;
  if (!ai.wb) { ai.wb = s.add.rectangle(35, b0.y + 7, 200, 3, 0x7fd8ff).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100); ai.bar.push(ai.wb); }
  ai.wb.setScale(Math.max(0.001, ai.wardFrac), 1).setFillStyle(ai.openUntil > s.bt ? 0xffe060 : 0x7fd8ff);
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

// 등장 힌트: 배너(장 이름·각성·변종)가 사라진 뒤 체력 막대 아래 고정 한 줄로 4초. 보스 머리 말풍선(패턴 외침)에 묻혀 안 읽혔다
export function showHint(ai) {
  const w = ai.wk; if (!w) return;
  const s = ai.s;
  let waited = 0;
  const tryShow = () => {
    if (!ai.m.active || ai.m.dead || s.over) return;
    if ((s.bannerObjs || waited < 1800) && waited < 9000) { waited += 300; s.time.delayedCall(300, tryShow); return; }
    const y = 92 + insetsGame(s.game).top + 22;
    const tx = s.add.text(D.W / 2, y, w.hint, { ...font(11, '#ffe9a0', 4), wordWrap: { width: D.W - 24 }, align: 'center' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(112).setAlpha(0);
    const bg = s.add.rectangle(D.W / 2, y + tx.height / 2, Math.min(D.W - 8, tx.width + 20), tx.height + 8, 0x000000, 0.65).setScrollFactor(0).setDepth(111).setAlpha(0);
    s.tweens.add({ targets: [tx, bg], alpha: 1, duration: 200 });
    s.tweens.add({ targets: [tx, bg], alpha: 0, delay: 4000, duration: 300, onComplete: () => { tx.destroy(); bg.destroy(); } });
  };
  tryShow();
}
