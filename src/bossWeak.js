// 66차: 보스 약점·해법. 4~20장 장 보스·중간보스마다 '이 갈래로 치면 덜 들어간다'는 장치 하나를 갖는다.
// 근접 무기라도 원거리·마법·관통·광역·둔화 보조 스킬을 섞으면 풀린다(무기를 바꿀 필요는 없다). 플레이어 스탯은 건드리지 않고 보스 쪽 규칙만 더한다.
import { t } from './i18n.js';
import { font } from './ui.js';
import * as D from './data.js';
import { insetsGame } from './safeArea.js';
import { mission } from './save.js';

// 보스 key → 약점 종류(표는 weakData.js: 도감이 브라우저 없이도 읽는다)
import { WEAK } from './weakData.js';
export { WEAK };

// 66·67차: 약점 갈래마다 '답 스킬' 2~5개(범용 2 + 무기 전용 몇 개). 무기 기본 공격은 답이 아니다 — 스킬을 골라 키워야 풀린다.
// 막힌 딱지가 붙은 스킬은 피해가 WARD.block 배만 들어가고, 답 스킬이 보스 방벽(WARD.frac x 체력)을 깨면 WARD.open ms 동안 약점이 드러나 전부 들어간다. 방벽은 다시 차오른다.
export const ANS = {
  thorn: ['dagger', 'bolt', 'volley', 'grenade', 'missile', 'javelin', 'wave'],
  ward: ['spin', 'dagger', 'quake', 'palm', 'wave', 'grenade'],
  mirror: ['spin', 'dagger', 'wave', 'quake', 'palm', 'missile'],
  armor: ['dagger', 'ice', 'javelin', 'volley', 'missile', 'grenade'],
  swift: ['ice', 'palm', 'holy', 'javelin', 'quake', 'volley'],
};
// 68차: 무기 전용 스킬이 약점 다섯 갈래 중 꼭 셋을 푼다(검·창·총은 하나뿐이라 주력 몰빵 빌드가 16~18-3에서 8~26%였다)
export const WARD = { frac: 0.13, block: 0.2, open: 9000, tc: 6000, th: 0.55, rs: 4, midx: 2, midRs: 1.5, lateRs: 0.55 };   // lateRs: 16장부터 되갚기 배수(무기가 막힌 비율이 15장보다 커서 같은 세기면 C가 보스전 20~40초에 쓰러졌다)
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
const RETORT = { thorn: [0.05, 1000, 0.7], ward: [0.04, 1000, 0.35], mirror: [0.055, 1000, 0.35], armor: [0.055, 1000, 0.3], swift: [0.03, 1000, 0.3] };

// 약점이 적용되는 판: 일반 진행(무한의 탑·던전·연습·모드는 제외)
export function weakOf(s, key) {
  if (s.endless || s.dungeon || s.practice || s.mode || s.pro) return null;
  const k = WEAK[key];
  if (!k) return null;
  const w = { kind: k, ...KINDS[k] };
  w.hint = w.hint(answersFor(k, s.wtype?.id).map(x => D.SKILLS[x].name).join(' · '));
  return w;
}

// 68차: 이 판에서 만날 보스(x-2 중간보스·x-3 장 보스, 이미 나온 보스가 있으면 그 보스)의 약점과 답 스킬. 레벨업 카드 딱지·일시정지 안내에 쓴다
export function stageWeak(s) {
  const live = s.mobs?.getChildren?.().find(m => m.isBoss && m.active && !m.dead && m.bossAI?.wk);
  if (live) return { kind: live.bossAI.wk.kind, hint: live.bossAI.wk.hint, ans: answersFor(live.bossAI.wk.kind, s.wtype?.id) };
  const key = s.s === 2 ? s.ch?.boss : s.s === 1 ? s.ch?.mid : null;
  const w = key && weakOf(s, key);
  return w ? { kind: w.kind, hint: w.hint, ans: answersFor(w.kind, s.wtype?.id) } : null;
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
          ai.openUntil = s.bt + WARD.open; weakFound(s, m.kind); mission('ward');
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
  if (mul < 1 && R && k > 0 && s.bt - (ai.thornAt || -1e9) > R[1]) { ai.thornAt = s.bt; s.hurt(Math.max(ai.b?.lateCh ? 0 : m.dmg * R[2], s.maxHp * R[0] * WARD.rs * (ai.mid ? WARD.midRs : 1) * (ai.b?.lateCh ? WARD.lateRs : 1)) * k, w.kind); }   // 16장부터는 보스 공격력이 커서 바닥(공격력 비율)이 되갚기를 집어삼켰다(시뮬 20-3 C 21%) — 내 체력 비율만 쓴다
  return mul;
}

// 68차: 약점을 한 번이라도 푼 보스를 도감에 남긴다(도감 보스 칸·약점 업적이 읽는다)
export const weakFound = (s, key) => { if (s.sv && WEAK[key]) ((s.sv.dex ||= {}).w ||= {})[key] = 1; };

// 방벽 막대: 체력 막대 바로 아래 가는 줄(차 있을수록 막혀 있다, 비면 약점 노출)
function wardBar(s, ai) {
  const b0 = ai.bar?.[0]; if (!b0) return;
  // 68차: 3px은 안 보였다(평가) → 6px + '방벽' 글. 열린 동안은 노란 막대가 남은 시간만큼 줄어든다
  if (!ai.wb) {
    ai.wb = s.add.rectangle(35, b0.y + 9, 200, 6, 0x7fd8ff).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    ai.wbl = s.add.text(33, b0.y + 9, t('bw.bar'), font(9, '#7fd8ff', 2)).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
    ai.bar.push(ai.wb, ai.wbl);
  }
  const open = ai.openUntil > s.bt;
  ai.wb.setScale(Math.max(0.001, open ? (ai.openUntil - s.bt) / WARD.open : ai.wardFrac), 1).setFillStyle(open ? 0xffe060 : 0x7fd8ff);
  ai.wbl.setText(open ? t('bw.barOpen') : t('bw.bar')).setColor(open ? '#ffe060' : '#7fd8ff');
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
    if (this.gdOn && !on) { weakFound(s, m.kind); mission('ward'); }   // 졸개를 다 쓸었다 = 약점을 풀었다
    this.gdOn = on;
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
