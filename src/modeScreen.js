// 로비의 모드 선택 화면(Lobby에 섞어 쓴다). 규칙은 modes.js, 데이터는 modeData.js
import * as D from './data.js';
import { sfx } from './sfx.js';
import { track } from './log.js';
import { font, font9, panel, button, fmt, toast } from './ui.js';
import { ensureModeArt, MODE_ICON } from './modeArt.js';
import { modeSeen, MODE_IDS, MODE_DEFS, MODE_N, modeStage, modeOpen, modeDone, modeCount, modeReward, repeatReward, modeStars, modeStarTotal, modeBest, starTexts, fmtT } from './modeData.js';
import { t } from './i18n.js';
import { save } from './save.js';

const { W } = D;

export const ModeScreen = {
  // 전투 탭 그림 왼쪽의 진입 버튼(회색 하나). 1장 보스를 깨기 전엔 눌러도 열리지 않는다
  modeEntry(pv, AY) {
    const sv = this.sv;
    if (!(sv.stats?.runs > 0)) return;
    const open = sv.cleared >= D.STAGES_PER_CHAPTER;
    const bt = button(this, 36, AY + 40, 54, 22, t('modeScreen.cd1abb'), () => {
      if (!open) { sfx('deny'); toast(this, t('modeScreen.5f28d7'), '#ff9090'); return; }
      sfx('click'); this.openModes();
    }, { size: 11, color: 0x3a3846 });
    if (!open) bt.label.setAlpha(0.5);
    pv.add(bt);
    if (open && !modeSeen(sv)) pv.add(this.add.circle(36 + 25, AY + 40 - 10, 4, 0xff3a3a));
  },
  openModes() {
    track('mode_open', {});
    const sv = this.sv; sv.modes = { ...sv.modes, seen: true }; save();
    this.modeScr = true; this.modeId = this.modeId || 'guard'; this.modeN = this.modeN ?? 0; this.show('battle');
  },

  // ── 모드 선택: 4모드 탭 + 15판 목록 + 선택한 판 정보 ──
  modePage() {
    ensureModeArt(this);
    const sv = this.sv, b = this.body;
    const id = this.modeId = MODE_IDS.includes(this.modeId) ? this.modeId : 'guard';
    const def = MODE_DEFS[id];
    let n = Phaser.Math.Clamp(this.modeN ?? 0, 0, MODE_N - 1); this.modeN = n;
    this.bg.add(this.add.image(0, Math.round((D.H - 480) * 0.5), 'ma_modes_bg').setOrigin(0).setAlpha(0.55));   // 모드 선택 배경
    // 제목 줄
    const back = this.add.text(22, 56, '◀', font(14)).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => { sfx('click'); this.modeScr = false; this.show('battle'); });
    b.add(back);
    b.add(this.add.text(W / 2, 56, t('modeScreen.cd1abb'), font(15, '#ffd75e')).setOrigin(0.5));
    // 모드 탭 4개
    MODE_IDS.forEach((mid, i) => {
      const d = MODE_DEFS[mid], on = mid === id, x = 39 + i * 64;
      const t = button(this, x, 84, 60, 24, d.name, () => { sfx('click'); this.modeId = mid; this.modeN = Math.min(this.modeN, MODE_N - 1); this.show('battle'); }, { size: 11, color: on ? 0x4a3f6e : 0x3a3846 });
      t.label.setColor(on ? d.css : '#a1b2b6');
      b.add(t);
      if (on) b.add(this.add.rectangle(x, 98, 56, 2, d.color).setOrigin(0.5));
    });
    // 모드 설명 3줄
    b.add(this.add.image(24, 112, 'ma_' + MODE_ICON[id]).setDisplaySize(20, 20));
    b.add(this.add.text(38, 112, t('modeScreen.d79435', { name: def.name, modeCount: modeCount(sv, id), MODE_N, modeStarTotal: modeStarTotal(sv, id), v: MODE_N * 3 }), font(11, def.css)).setOrigin(0, 0.5));
    b.add(this.add.text(W - 14, 112, t('modeScreen.43aef2', { title: def.title }), font9(9, '#ffb050')).setOrigin(1, 0.5));
    def.desc.forEach((s, i) => b.add(this.add.text(24, 128 + i * 13, s, font9(10, '#d8d0e8'))));
    // 15판 격자(5열 x 3행)
    for (let k = 0; k < MODE_N; k++) {
      const cx = 35 + (k % 5) * 50, cy = 186 + Math.floor(k / 5) * 34;
      const open = modeOpen(sv, k), made = !!modeStage(id, k), done = modeDone(sv, id, k), sel = k === n;
      const g = this.add.container(cx, cy);
      g.add(panel(this, -23, -15, 46, 30, { fill: !open || !made ? 0x100d16 : sel ? 0x2e2548 : 0x1c1729, line: sel ? 0xffd75e : 0x3a3150 }));
      g.add(this.add.text(0, -3, String(k + 1), font(11, open && made ? '#ffffff' : '#4a4060')).setOrigin(0.5));
      const sc = modeStars(sv, id, k);
      if (done) g.add(this.add.text(0, 9, '★'.repeat(Math.max(1, sc)) + '☆'.repeat(3 - Math.max(1, sc)), font9(8, '#ffd75e')).setOrigin(0.5));
      else g.add(this.add.text(0, 9, !open ? t('lobby.956f2f') : made ? '' : t('modeScreen.e86e2d'), font9(8, '#5a5070')).setOrigin(0.5));
      g.setSize(46, 30).setInteractive({ useHandCursor: true });
      g.on('pointerup', () => { sfx('click'); this.modeN = k; this.show('battle'); });
      b.add(g);
    }
    // 고른 판 정보
    const cfg = modeStage(id, n), open = modeOpen(sv, n), ch = D.CHAPTERS[n];
    b.add(this.add.text(24, 276, t('modeScreen.793516', { v: n + 1, v2: ch ? ch.name : '' }), font(12, '#ffd75e')));
    let canGo = false;
    if (!cfg) b.add(this.add.text(24, 294, t('modeScreen.f95728'), font9(10, '#a1b2b6')));
    else {
      b.add(this.add.text(24, 294, cfg.goal, font9(10, '#ffffff')));
      cfg.note.split(' · ').forEach((s, i) => b.add(this.add.text(24, 308 + i * 13, s, font9(10, '#a1b2b6'))));
      const rw = modeDone(sv, id, n) ? repeatReward(cfg.c, modeStars(sv, id, n) || 1) : modeReward(cfg.c, true);
      b.add(this.add.text(24, 336, modeDone(sv, id, n) ? t('modeScreen.9c666f') : t('modeScreen.08604a'), font9(10, '#f2e4bc')));
      b.add(this.add.text(24, 349, t('modeScreen.5ffb61', { fmt: fmt(rw.gold), stone: rw.stone, v: rw.gem ? t('modeScreen.7fece3', { gem: rw.gem }) : '' }), font9(10, '#f2e4bc')));
      if (!open) b.add(this.add.text(24, 364, t('modeScreen.e21281', { v: n + 1 }), font9(10, '#ff9090')));
      else {
        canGo = true;
        const k = modeStars(sv, id, n), bt = modeBest(sv, id, n), tx = starTexts(cfg);
        b.add(this.add.text(24, 364, t('modeScreen.bb225e', { repeat: '★'.repeat(k), repeat2: '☆'.repeat(3 - k), v: bt ? t('modeScreen.5bd986', { fmtT: fmtT(bt.t), hurt: bt.hurt }) : '' }), font9(10, k ? '#ffd75e' : '#a1b2b6')));
        b.add(this.add.text(24, 377, `★ ${tx[0]}  ★★ ${tx[1]}  ★★★ ${tx[2]}`, font9(9, '#8d86a0')));
      }
    }
    const go = button(this, W / 2, 408, 190, 32, t('modeScreen.e89cc8'), () => this.startModeBattle(id, n), { size: 14, color: 0x2f6b3a });
    go.setEnabled(canGo);
    b.add(go);
  },

  startModeBattle(id, n) {
    if (this.busy) return; this.busy = true;
    track('mode_start_click', { mode: id, n: n + 1, power: D.powerOf(this.sv) });
    sfx('bossIn');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle', { mode: { id, n } }));
  },
};
