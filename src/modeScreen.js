// 로비의 모드 선택 화면(Lobby에 섞어 쓴다). 규칙은 modes.js, 데이터는 modeData.js
import * as D from './data.js';
import { sfx } from './sfx.js';
import { track } from './log.js';
import { font, font9, panel, button, fmt, toast } from './ui.js';
import { ensureModeArt, MODE_ICON } from './modeArt.js';
import { MODE_IDS, MODE_DEFS, MODE_N, modeStage, modeOpen, modeDone, modeCount, modeReward } from './modeData.js';

const { W } = D;

export const ModeScreen = {
  // 전투 탭 그림 왼쪽의 진입 버튼(회색 하나). 1장 보스를 깨기 전엔 눌러도 열리지 않는다
  modeEntry(pv, AY) {
    const sv = this.sv;
    if (!(sv.stats?.runs > 0)) return;
    const open = sv.cleared >= D.STAGES_PER_CHAPTER;
    const bt = button(this, 36, AY + 40, 54, 22, '모드', () => {
      if (!open) { sfx('deny'); toast(this, '본편 1장을 깨면 열려요', '#ff9090'); return; }
      sfx('click'); track('mode_open', {});
      this.modeScr = true; this.modeId = this.modeId || 'guard'; this.modeN = this.modeN ?? 0; this.show('battle');
    }, { size: 11, color: 0x3a3846 });
    if (!open) bt.label.setAlpha(0.5);
    pv.add(bt);
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
    b.add(this.add.text(W / 2, 56, '모드', font(15, '#ffd75e')).setOrigin(0.5));
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
    b.add(this.add.text(38, 112, `${def.name}  ${modeCount(sv, id)}/${MODE_N}판`, font(11, def.css)).setOrigin(0, 0.5));
    b.add(this.add.text(W - 14, 112, `완주 「${def.title}」`, font9(9, '#ffb050')).setOrigin(1, 0.5));
    def.desc.forEach((s, i) => b.add(this.add.text(24, 128 + i * 13, s, font9(10, '#d8d0e8'))));
    // 15판 격자(5열 x 3행)
    for (let k = 0; k < MODE_N; k++) {
      const cx = 35 + (k % 5) * 50, cy = 186 + Math.floor(k / 5) * 34;
      const open = modeOpen(sv, k), made = !!modeStage(id, k), done = modeDone(sv, id, k), sel = k === n;
      const g = this.add.container(cx, cy);
      g.add(panel(this, -23, -15, 46, 30, { fill: !open || !made ? 0x100d16 : sel ? 0x2e2548 : 0x1c1729, line: sel ? 0xffd75e : 0x3a3150 }));
      g.add(this.add.text(0, -3, String(k + 1), font(11, open && made ? '#ffffff' : '#4a4060')).setOrigin(0.5));
      g.add(this.add.text(0, 9, done ? '★' : !open ? '잠김' : made ? '' : '준비 중', font9(8, done ? '#ffd75e' : '#5a5070')).setOrigin(0.5));
      g.setSize(46, 30).setInteractive({ useHandCursor: true });
      g.on('pointerup', () => { sfx('click'); this.modeN = k; this.show('battle'); });
      b.add(g);
    }
    // 고른 판 정보
    const cfg = modeStage(id, n), open = modeOpen(sv, n), ch = D.CHAPTERS[n];
    b.add(this.add.text(24, 276, `${n + 1}판  ${ch ? ch.name : ''}`, font(12, '#ffd75e')));
    let canGo = false;
    if (!cfg) b.add(this.add.text(24, 294, '아직 준비 중이에요', font9(10, '#a1b2b6')));
    else {
      b.add(this.add.text(24, 294, cfg.goal, font9(10, '#ffffff')));
      cfg.note.split(' · ').forEach((s, i) => b.add(this.add.text(24, 308 + i * 13, s, font9(10, '#a1b2b6'))));
      const rw = modeReward(cfg.c, !modeDone(sv, id, n));
      b.add(this.add.text(24, 336, modeDone(sv, id, n) ? '다시 깨면' : '첫 클리어 보상', font9(10, '#f2e4bc')));
      b.add(this.add.text(24, 349, `금화 ${fmt(rw.gold)}  강화석 ${rw.stone}${rw.gem ? `  보석 ${rw.gem}` : ''}`, font9(10, '#f2e4bc')));
      if (!open) b.add(this.add.text(24, 364, `본편 ${n + 1}장을 깨면 열려요`, font9(10, '#ff9090')));
      else canGo = true;
    }
    const go = button(this, W / 2, 398, 190, 32, '시작', () => this.startModeBattle(id, n), { size: 14, color: 0x2f6b3a });
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
