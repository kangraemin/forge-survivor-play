// 코치마크: 화면을 어둡게 덮고 가리킬 곳만 구멍 뚫듯 밝히며, 깜빡이는 화살표와 말풍선으로 설명한다. 탭하면 다음 단계
// 공용 함수 coachRun(여러 장)·coachOne(한 장). 새 탭·기능이 처음 열릴 때 같은 모양으로 한 장만 띄울 수 있다
// 본 기록은 sv.tut.coach[id]에 남는다(저장 형식은 그대로: tut은 자유 칸)
import { W, H, PC } from './data.js';
import { font, font9, button, fixedContainer } from './ui.js';
import { insetsGame, inTossShell } from './safeArea.js';
import { sfx } from './sfx.js';
import { track } from './log.js';
import { load, save } from './save.js';
import { t } from './i18n.js';
import { wrapTo } from './textfit.js';

const DIM = 0.8, BW = W - 28;
export const coachSeen = (sv, id) => !!sv.tut?.coach?.[id];
export function coachMark(sv, id, on = true) { sv.tut ||= {}; sv.tut.coach ||= {}; if (on) sv.tut.coach[id] = 1; else delete sv.tut.coach[id]; save(); }
// 처음 켠 사람인가: 한 판도 안 했고 깬 판도 없다 → 로비를 건너뛰고 바로 1-1
export const isFirstRun = sv => !!sv && (sv.stats?.runs | 0) === 0 && (sv.cleared | 0) === 0 && !(sv.hardCleared | 0) && !(sv.inv?.length);

// steps: [{ prep?: scene => void, rect: [x,y,w,h] | scene => [x,y,w,h], title, lines: [문장...] }]
// opts: { id: 저장 키, onEnd: (skipped) => void, skip: 건너뛰기 버튼(기본: 2장 이상일 때)}
export function coachRun(scene, steps, { id, onEnd, skip = steps.length > 1 } = {}) {
  if (!steps.length || scene._coach) return null;
  const c = scene._coach = fixedContainer(scene).setDepth(3000);
  scene.busy = true;
  let i = -1, done = false, card = null;
  // 한 장짜리: 카드 밖 아무 데나(가리킨 버튼 포함) 누르면 카드가 닫히고 그 터치가 그대로 동작한다. 버튼이 장면 입력 이벤트를 막으므로(stopPropagation) 캔버스에서 직접 듣는다
  const cv = scene.game.canvas;
  const onDown = e => {
    if (done || !card) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (!(x >= card[0] && x <= card[0] + card[2] && y >= card[1] && y <= card[1] + card[3])) end(false, true);
  };
  cv.addEventListener('pointerdown', onDown, true);
  // 65차: 키보드만으로도 닫는다. Enter·Space = 다음(마지막 장이면 확인), Esc = 건너뛰기(한 장짜리는 닫기)
  const onKey = e => {
    if (done || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) { if (steps.length === 1) end(false, true); else next(); } }   // 한 장짜리는 화면을 옮기지 않고 닫는다(바로 Enter로 강화)
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(steps.length > 1, steps.length === 1); }
  };
  document.addEventListener('keydown', onKey, true);
  track('coach_start', { id, n: steps.length });
  const end = (skipped, stay) => {
    if (done) return; done = true; cv.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true);
    c.list.forEach(o => scene.tweens.killTweensOf(o)); c.destroy(); scene._coach = null; scene.busy = false;
    if (id) coachMark(load(), id);
    track(skipped ? 'coach_skip' : 'coach_done', { id, at: i + 1 });
    onEnd?.(skipped, stay);
  };
  const next = () => { sfx('click'); i + 1 >= steps.length ? end(false) : draw(i + 1); };
  function draw(n) {
    i = n;
    const st = steps[n];
    st.prep?.(scene);
    const kill = o => { scene.tweens.killTweensOf(o); o.list?.forEach(kill); };
    c.list.forEach(kill); c.removeAll(true);
    track('coach_step', { id, n: n + 1 });
    const r0 = typeof st.rect === 'function' ? st.rect(scene) : st.rect;
    const rx = Math.max(0, r0[0]), ry = Math.max(0, r0[1]), rw = Math.min(W - rx, r0[2]), rh = Math.min(H - ry, r0[3]);
    // 맨 아래 막: 아무 데나 탭하면 다음. 한 장짜리 카드는 막지 않는다 — 카드 밖을 누르면 카드가 닫히고 그 터치가 그대로 동작한다(61차: 뒤 화면이 막힌 줄 알았다)
    const pass = steps.length === 1;
    card = null;
    if (!pass) c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.001).setOrigin(0).setInteractive().on('pointerup', next));
    // 구멍 뚫린 어두운 막: 위·아래·왼·오른쪽 네 장
    const dim = (x, y, w, h) => w > 0 && h > 0 && c.add(scene.add.rectangle(x, y, w, h, 0x05030a, DIM).setOrigin(0));
    dim(0, 0, W, ry); dim(0, ry + rh, W, H - ry - rh); dim(0, ry, rx, rh); dim(rx + rw, ry, W - rx - rw, rh);
    const hl = scene.add.rectangle(rx + rw / 2, ry + rh / 2, rw + 2, rh + 2).setStrokeStyle(2, 0x7fe6ee);
    c.add(hl); scene.tweens.add({ targets: hl, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    // 말풍선
    const ins = insetsGame(scene.game), minY = (inTossShell() ? ins.xTop : ins.top) + 6;   // 토스 X 버튼·노치 아래로
    // 말풍선 글자는 공용 글자 맞춤(textfit)이 다시 줄바꿈하며 높이를 바꿔 줄이 겹쳤다: 맞춤에서 빼고(isBtnLabel) 여기서 직접 줄바꿈·크기를 정한다
    const room = H - 12 - minY, TW = BW - 22;
    let title, lines, ys, hh;
    for (let sz = 10; sz >= 7; sz -= 0.5) {
      [title, ...(lines || [])].forEach(o => o && o.destroy());
      title = scene.add.text(BW / 2 + 14, 0, st.title, { ...font(Math.min(13, sz + 3), '#ffd75e'), wordWrap: { width: BW - 20 } }).setOrigin(0.5, 0);
      lines = st.lines.map(s => { const o = scene.add.text(24, 0, '', { ...font9(sz, '#ffffff'), wordWrap: { width: TW } }).setLineSpacing(2); o.isBtnLabel = true; o.setText(wrapTo(o, '- ' + s, TW)); return o; });
      title.isBtnLabel = true; title.setText(wrapTo(title, st.title, BW - 20));
      hh = 10 + title.height + 6;
      ys = lines.map(l => { const y = hh; hh += l.height + 4; return y; });
      hh += 6 + 24 + 8;   // 아래 버튼 줄
      if (hh <= room) break;
    }
    const below = ry + rh + 18 + hh <= H - 6, above = ry - 18 - hh >= minY;
    let by = below || !above ? ry + rh + 18 : ry - 18 - hh;
    if (!below && !above) by = Math.max(minY, Math.min(H - 6 - hh, (ry + rh / 2 > H / 2) ? ry - 18 - hh : ry + rh + 18));
    by = Math.max(minY, Math.min(H - 6 - hh, by));
    const bx = 14, up = by >= ry + rh;
    if (pass) card = [bx, by, BW, hh];   // up: 말풍선이 구멍 아래라 화살표는 위를 가리킨다
    const bg = scene.add.graphics();
    bg.fillStyle(0x1a1426, 0.98).fillRect(bx, by, BW, hh); bg.lineStyle(1, 0x7fe6ee, 1).strokeRect(bx + 0.5, by + 0.5, BW - 1, hh - 1);
    c.add(bg);
    title.setPosition(bx + BW / 2, by + 10); c.add(title);
    lines.forEach((l, k) => { l.setPosition(bx + 10, by + ys[k]); c.add(l); });
    // 깜빡이는 화살표(구멍 중앙 x, 말풍선과 구멍 사이)
    const ax = Math.max(bx + 12, Math.min(bx + BW - 12, rx + rw / 2)), ay = up ? ry + rh + 9 : ry - 9;
    const ar = scene.add.text(ax, ay, up ? '▲' : '▼', font(14, '#7fe6ee')).setOrigin(0.5); c.add(ar);
    scene.tweens.add({ targets: ar, y: ay + (up ? 4 : -4), alpha: 0.4, duration: 380, yoyo: true, repeat: -1 });
    // 아래 줄: 왼쪽 건너뛰기(보조), 가운데 쪽수, 오른쪽 확인은 청록 보조색(구멍 안 주황 행동 버튼과 둘로 보이던 것 55차: 주황은 한 화면 하나)
    const by2 = by + hh - 20;
    if (skip) c.add(button(scene, bx + 44, by2, 76, 24, t('coach.88130a'), () => end(true), { size: 10, color: 0x3a3846 }));
    if (steps.length > 1) c.add(scene.add.text(bx + BW / 2, by2, `${n + 1}/${steps.length}`, font9(9, '#a1b2b6')).setOrigin(0.5));
    c.add(button(scene, bx + BW - 44, by2, 76, 24, (n + 1 >= steps.length ? t('lobby.468266') : t('coach.854c76')) + (PC ? ' [Enter]' : ''), next, { size: 11, color: 0x1d6f80 }));
  }
  draw(0);
  return c;
}

// 새 탭·기능이 처음 열릴 때 한 장짜리. 이미 본 적이 있으면 아무것도 안 한다. 띄웠으면 true
export function coachOne(scene, id, step, onEnd) {
  const sv = load();
  if (coachSeen(sv, id) || scene._coach) return false;
  return !!coachRun(scene, [step], { id, onEnd });
}
