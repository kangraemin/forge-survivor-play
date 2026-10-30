// 효과음: 파일 없이 WebAudio로 합성한다. 같은 소리가 한 프레임에 몰리면 묶어서 한 번만 낸다
let ctx = null, master = null, on = true, musicOn = true, vibOn = true, held = false;
let bgm = null;
const last = {};

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C(); ctx.onstatechange = onCtxState; master = ctx.createGain(); master.gain.value = held ? 0 : 0.35; master.connect(ctx.destination);
  }
  // 아이폰은 앱을 나갔다 오면 'interrupted'가 된다: running이 아니면 다시 깨운다
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}
// 백그라운드에서 돌아오면 소리가 멈춰 있었다. 50차: 'interrupted'·'suspended'를 모두 다시 깨우고, 돌아온 뒤 몇 번 더 재시도한다.
// 깨워도 안 되거나 'closed'면 오디오를 새로 만들어 배경음을 이어 튼다(아이폰은 터치 안에서만 깨워 준다)
let wakeTries = 0, wakeTimer = null, acted = false;   // acted: 사용자가 한 번이라도 만졌나(만지기 전에 컨텍스트를 새로 지어 봐야 소용없다)
function rebuild() {
  const had = bgm; const kind = had?.kind, ch = had?.ch;
  if (had) { clearInterval(had.timer); if (had.el) stopEl(had.el); bgm = null; }
  try { ctx && ctx.close(); } catch { /* 무시 */ }
  if (lingering) { clearTimeout(lingering.dying); try { stopEl(lingering.el); } catch { /* 무시 */ } lingering = null; }
  for (const k in preloaded) delete preloaded[k];   // 옛 컨텍스트에 묶인 요소는 못 쓴다
  ctx = null; master = null; noiseBuf = null;
  if (ac() && kind && musicOn) playBgm(kind, ch);
}
const wake = () => {
  if (bgm && bgm.el && bgm.el.paused && musicOn && !document.hidden) playEl(bgm.el).catch(() => {});   // 파일 음악: 백그라운드에서 멈췄으면 다시 튼다
  if (bgm && bgm.want) retryFile();
  if (!ctx) return;
  if (ctx.state === 'closed') { rebuild(); return; }
  if (ctx.state === 'running') {
    if (bgm && bgm.next < ctx.currentTime - 0.5) bgm.next = ctx.currentTime + 0.05;   // 멈춰 있던 사이 밀린 박자를 지금으로 당긴다
    return;
  }
  ctx.resume().catch(() => {});
};
function wakeSoon() {
  wake(); wakeTries = 0; clearInterval(wakeTimer);
  wakeTimer = setInterval(() => {
    wake();
    if (ctx && ctx.state === 'running') { clearInterval(wakeTimer); return; }
    if (++wakeTries >= 6) { clearInterval(wakeTimer); if (ctx && ctx.state !== 'running' && !document.hidden && acted) rebuild(); }
  }, 400);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeSoon(); });
window.addEventListener('pageshow', wakeSoon);
window.addEventListener('focus', wakeSoon);
// 54차: iOS는 touchend·click 같은 '활성화 제스처'에서만 resume이 먹는다(드래그·pointerdown만으로는 안 될 수 있다). 효과음과 음악은 같은 컨텍스트라 같은 길로 깨운다.
// 깨웠는데도 running이 아니거나 시계(currentTime)가 안 가면 다음 제스처 안에서 컨텍스트를 새로 만든다(제스처 밖에서 만든 컨텍스트는 아이폰이 안 깨워 준다)
let needRebuild = false;
function gesture(e) {
  acted = true;
  if (!ctx && e && (e.type === 'touchend' || e.type === 'click' || e.type === 'pointerup')) ac();   // 첫 제스처가 드래그여도 끝날 때 컨텍스트를 만들고 깨운다
  if (ctx && needRebuild && ctx.state !== 'running') { needRebuild = false; rebuild(); return; }
  needRebuild = false;
  wake();
  if (!ctx || ctx.state === 'running') return;
  const c = ctx, t0 = c.currentTime;
  let p; try { p = c.resume(); } catch { /* 무시 */ }
  const check = () => { if (ctx === c && (c.state !== 'running' || c.currentTime <= t0)) needRebuild = true; };
  if (p && p.then) p.then(() => setTimeout(check, 300), () => { needRebuild = true; }); else setTimeout(check, 300);
}
['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach(e => document.addEventListener(e, gesture, true));
// 49차: 효과음·음악·진동을 따로 끈다(설정 창). 위쪽 ♪ 버튼은 셋 중 소리 둘을 함께 켜고 끈다
export const setSound = v => { on = v; };
export const setMusic = v => { musicOn = v; if (!v) stopBgm(); };
export const setVib = v => { vibOn = v; };
export const unlock = () => ac();
// 포털판: 광고 중·사이트 음소거 설정일 때 전체 소리를 끈다(platform/crazygames.js)
export const holdAudio = v => { held = !!v; if (master) master.gain.value = held ? 0 : 0.35; if (bgm && bgm.el) bgm.el.muted = held; };

let noiseBuf = null;
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// 톤 하나: 주파수 f0→f1, 길이 dur, 파형 type
function tone(c, t, { f0, f1 = f0, dur, type = 'square', vol = 0.3 }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(c, t, { dur, vol = 0.3, hp = 800, lp = 8000 }) {
  const s = c.createBufferSource(), g = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
  s.buffer = noise(c); f1.type = 'highpass'; f1.frequency.value = hp; f2.type = 'lowpass'; f2.frequency.value = lp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f1).connect(f2).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.02);
}

let gemN = 0, gemT = 0;
function combo() { const now = performance.now(); gemN = now - gemT < 450 ? Math.min(12, gemN + 1) : 0; gemT = now; return gemN; }

const SOUNDS = {
  swing: (c, t) => hiss(c, t, { dur: 0.09, vol: 0.18, hp: 1800, lp: 6000 }),
  // p: 음 높이 배율(강화 단계가 오를수록 맞는 소리가 높고 날카로워진다)
  hit: (c, t, p = 1) => { tone(c, t, { f0: 220 * p, f1: 90 * p, dur: 0.07, vol: 0.25 }); hiss(c, t, { dur: 0.05, vol: 0.25, hp: 2000 * p }); },
  crit: (c, t) => { tone(c, t, { f0: 900, f1: 300, dur: 0.12, vol: 0.2 }); hiss(c, t, { dur: 0.1, vol: 0.3, hp: 1500 }); },
  kill: (c, t) => { tone(c, t, { f0: 160, f1: 50, dur: 0.14, type: 'triangle', vol: 0.35 }); hiss(c, t, { dur: 0.12, vol: 0.18, hp: 300, lp: 2500 }); },
  // 연달아 주우면 음이 한 칸씩 올라간다(최대 한 옥타브)
  gem: (c, t) => { const n = combo(); const f = 880 * Math.pow(2, n / 12); tone(c, t, { f0: f, f1: f * 1.5, dur: 0.06, type: 'sine', vol: 0.12 }); },
  coin: (c, t) => { tone(c, t, { f0: 1500, dur: 0.05, type: 'square', vol: 0.08 }); tone(c, t + 0.05, { f0: 2000, dur: 0.08, type: 'square', vol: 0.08 }); },
  hurt: (c, t) => { tone(c, t, { f0: 300, f1: 80, dur: 0.18, type: 'sawtooth', vol: 0.25 }); },
  level: (c, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.07, { f0: f, dur: 0.14, type: 'square', vol: 0.12 })),
  heal: (c, t) => [440, 554, 659].forEach((f, i) => tone(c, t + i * 0.06, { f0: f, dur: 0.12, type: 'sine', vol: 0.18 })),
  ult: (c, t) => { tone(c, t, { f0: 80, f1: 600, dur: 0.5, type: 'sawtooth', vol: 0.25 }); hiss(c, t + 0.1, { dur: 0.7, vol: 0.35, hp: 200 }); },
  boom: (c, t) => { tone(c, t, { f0: 120, f1: 30, dur: 0.35, type: 'triangle', vol: 0.45 }); hiss(c, t, { dur: 0.3, vol: 0.3, hp: 100, lp: 1500 }); },
  zap: (c, t) => { hiss(c, t, { dur: 0.15, vol: 0.3, hp: 3000 }); tone(c, t, { f0: 1400, f1: 200, dur: 0.12, type: 'sawtooth', vol: 0.12 }); },
  shoot: (c, t) => tone(c, t, { f0: 700, f1: 400, dur: 0.06, type: 'triangle', vol: 0.1 }),
  weak: (c, t) => { tone(c, t, { f0: 1100, f1: 1700, dur: 0.1, type: 'square', vol: 0.12 }); tone(c, t + 0.1, { f0: 1700, f1: 2200, dur: 0.12, type: 'square', vol: 0.1 }); hiss(c, t, { dur: 0.08, vol: 0.12, hp: 3000 }); },
  warn: (c, t) => { tone(c, t, { f0: 440, dur: 0.12, vol: 0.15 }); tone(c, t + 0.16, { f0: 440, dur: 0.12, vol: 0.15 }); },
  click: (c, t) => tone(c, t, { f0: 900, f1: 700, dur: 0.04, type: 'square', vol: 0.1 }),
  buy: (c, t) => { tone(c, t, { f0: 1200, dur: 0.05, vol: 0.1 }); tone(c, t + 0.06, { f0: 1600, dur: 0.1, vol: 0.1 }); },
  deny: (c, t) => tone(c, t, { f0: 150, dur: 0.15, type: 'square', vol: 0.15 }),
  anvil: (c, t) => { tone(c, t, { f0: 1800, f1: 1700, dur: 0.35, type: 'triangle', vol: 0.25 }); tone(c, t, { f0: 2650, dur: 0.25, type: 'sine', vol: 0.12 }); hiss(c, t, { dur: 0.06, vol: 0.3, hp: 2500 }); },
  success: (c, t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, t + i * 0.08, { f0: f, dur: 0.25, type: 'square', vol: 0.12 })),
  fail: (c, t) => [392, 330, 262].forEach((f, i) => tone(c, t + i * 0.12, { f0: f, dur: 0.2, type: 'triangle', vol: 0.2 })),
  shatter: (c, t) => { hiss(c, t, { dur: 0.6, vol: 0.45, hp: 1500 }); tone(c, t, { f0: 2400, f1: 300, dur: 0.5, type: 'sawtooth', vol: 0.12 }); },
  bossIn: (c, t) => { tone(c, t, { f0: 55, f1: 40, dur: 1.2, type: 'sawtooth', vol: 0.3 }); tone(c, t, { f0: 82, f1: 60, dur: 1.2, type: 'square', vol: 0.12 }); },
  win: (c, t) => [523, 523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.11, { f0: f, dur: 0.22, type: 'square', vol: 0.13 })),
};

export function sfx(name, gap = 40, p) {
  if (!on) { if (BUZZ[name]) buzz(BUZZ[name]); return; }   // 효과음을 꺼도 진동은 따로 켜 둘 수 있다
  const c = ac(); if (!c) return;
  const now = performance.now();
  if (now - (last[name] || 0) < gap) return;
  last[name] = now;
  try { SOUNDS[name](c, c.currentTime, p); } catch { /* 오디오 실패는 무시 */ }
  if (BUZZ[name]) buzz(BUZZ[name]);
}

// 폰 진동: 손에 오는 타격감. 소리를 끄면 같이 꺼진다. 너무 자주 울리면 저려서 간격을 둔다
// 아이폰 사파리는 navigator.vibrate가 없다 → 앱판(앱인토스 triggerHaptic·네이티브 햅틱)은 forgePlatform.haptic(ms)로 넣는다
const BUZZ = { crit: 12, hurt: 25, boom: 30, success: 40, shatter: 120, bossIn: 60 };
let lastBuzz = 0;
export function buzz(ms) {
  const now = performance.now();
  if (!vibOn || now - lastBuzz < 90) return;
  lastBuzz = now;
  try { window.forgePlatform?.haptic ? window.forgePlatform.haptic(ms) : navigator.vibrate?.(ms); } catch { /* 지원 안 하면 무시 */ }
}

// ── 배경음: 파일 없이 짧은 마디를 합성해 반복한다 ──
// 단조 4화음 진행(i-VI-III-VII) 위에 베이스와 아르페지오. 챕터마다 으뜸음, 보스는 빠르고 거칠게
const SEMI = [0, -4, 3, -2];                 // 화음 진행(으뜸음 기준 반음)
const ARP = [0, 3, 7, 12, 7, 3, 7, 3];       // 단3화음 펼침
const ROOT = [110, 98, 116.5, 92.5, 82.4];   // 장별 으뜸음(Hz)
// 실제 음악 파일: 장 묶음 → 파일. 표에 없는 곳(13장~)은 아래 절차 생성 BGM을 그대로 쓴다. 곡이 늘면 여기만 고친다
// battle의 장 번호는 0부터(0=1장). lobby는 장과 무관
const BGM_FILES = {
  lobby: 'assets/bgm/lobby.mp3',
  battle: [[0, 2, 'assets/bgm/ch1_3.mp3'], [3, 5, 'assets/bgm/ch4_6.mp3'], [6, 8, 'assets/bgm/ch7_9.mp3'], [9, 11, 'assets/bgm/ch10_12.mp3'], [12, 14, 'assets/bgm/ch13_15.mp3']],   // [시작 장, 끝 장, 파일] — 16장~(업데이트 장)은 곡이 없어 절차 BGM
  boss: 'assets/bgm/boss.mp3',     // 중간보스·장 보스 등장 때. 잡으면 그 장 묶음 곡으로 돌아간다
  mode: 'assets/bgm/modes.mp3',    // 모드 4종(지키기·점령·돌파·사냥)
};
// 파일 음악 기본 음량(0~1). 효과음 최대치(master 0.35 x 톤 0.25~0.45 = 약 -16dB)보다 한 단계 아래로 둔다.
// 두 곡 모두 평균 -17.8dB·최대 -3dB라 0.6이면 최대가 -7.6dB로 효과음보다 컸다 → 0.2(평균 -32dB·최대 -17dB, 절차 BGM과 비슷). 음량 설정이 생기면 여기에 곱한다
// 53차: 웹·itch에서 배경음악이 크다는 말이 나와 0.2 → 0.035로(-15dB). 측정(tools/audio_levels.mjs): 효과음 소리 나는 구간 RMS 평균 -35dB, 음악은 0.07일 때 -43dB였고 0.035면 -49dB.
// 효과음 한 톤 최대는 베기·피격 약 -21dB, 처치 -18dB, 레벨업 -27dB(master 0.35 x 톤 vol). 음악 설정(끔/작게/보통)의 '작게'는 절반(-6dB)
const BGM_BASE = 0.05;   // 54차: 아이폰에서 gain이 실제로 먹게 되니 0.015(-57dB)는 폰 스피커로 안 들렸다. 효과음 평균보다 약 11dB 아래
let musicMul = 1;   // 보통 1, 작게 0.5
const bv = () => BGM_BASE * musicMul;
// 54차: iOS Safari는 <audio>.volume을 JS로 못 바꾼다(항상 1.0) → 파일 음악을 WebAudio GainNode로 거쳐 크기를 정한다.
// el.volume을 그대로 쓰는 기존 코드(페이드·감시·설정)가 GainNode를 움직이도록 요소마다 volume 속성을 가로챈다. 요소는 컨텍스트 하나에만 묶이므로 컨텍스트를 새로 만들면 요소도 새로 만든다
let forceNative = false;   // MediaElementSource 경로가 무음이면 요소 직접 출력으로(크기 조절은 포기, 소리는 난다)
function attachGain(el) {
  if (!el || el._g || forceNative) return;
  const c = ctx || ac(); if (!c) return;
  try {
    const src = c.createMediaElementSource(el), g = c.createGain();
    g.gain.value = bv(); src.connect(g); g.connect(c.destination);
    const an = c.createAnalyser(); an.fftSize = 1024; g.connect(an);
    el._g = g; el._gctx = c; el._an = an;
    Object.defineProperty(el, 'volume', { configurable: true, get: () => g.gain.value, set: v => { g.gain.value = Math.max(0, Math.min(1, v)); } });
  } catch { /* 연결 못 하면 요소 음량을 그대로 쓴다(데스크톱) */ }
}
// iOS: 컨텍스트가 running이 되기 전에 요소를 play하면 MediaElementSource 경로가 무음이 된다 → running 전이면 미뤄 두었다가 running이 될 때 튼다
function playEl(el) {
  if (el._g && ctx && ctx.state !== 'running') { el._pend = true; return Promise.resolve(); }
  el._pend = false; return el.play();
}
function onCtxState() { if (ctx && ctx.state === 'running' && bgm && bgm.el && bgm.el._pend && musicOn) playEl(bgm.el).catch(() => {}); }
// 무음 감지: 틀고 2초 뒤 GainNode 출력이 계속 0이면 이 경로를 버리고 새 요소를 직접 출력으로 튼다(한 요소는 한 MediaElementSource만 된다)
function watchSilence(st, tries = 0) {
  setTimeout(() => {
    try {
      const el = st.el;
      if (bgm !== st || !el || !el._an || forceNative || !musicOn || held || document.hidden) return;
      if (!ctx || ctx.state !== 'running' || el.paused || el._fx || el._g.gain.value < 0.001) { if (tries < 4) watchSilence(st, tries + 1); return; }
      const buf = new Float32Array(1024); let peak = 0, n = 0;
      const t = setInterval(() => {
        el._an.getFloatTimeDomainData(buf); for (const x of buf) peak = Math.max(peak, Math.abs(x));
        if (++n < 8) return;
        clearInterval(t);
        if (peak < 1e-6 && bgm === st) { console.info('bgm silent -> native output'); nativeFallback(st); }
      }, 60);
    } catch { /* 무시 */ }
  }, 2000);
}
function nativeFallback(st) {
  forceNative = true;
  for (const k in preloaded) if (preloaded[k]._g) delete preloaded[k];
  const old = st.el, el = new Audio(st.file);
  el.loop = true; el.muted = held; el.volume = bv();
  try { el.currentTime = old.currentTime || 0; } catch { /* 무시 */ }
  st.el = el; try { old.pause(); } catch { /* 무시 */ }
  el.play().catch(() => {});
}
const PGAIN = (lobby) => (lobby ? 0.06 : 0.07) * musicMul;   // 절차 BGM(0.22/0.28 → 0.06/0.07)
export const setMusicLevel = lv => {
  musicMul = lv === 1 ? 0.5 : 1;
  try {
    if (bgm && bgm.el && !bgm.el._fx) bgm.el.volume = bv();
    if (bgm && bgm.g && ctx) { const g = bgm.g.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(PGAIN(bgm.kind === 'lobby'), t); }
  } catch { /* 무시 */ }
};
function bgmFile(kind, chapter) {
  const f = BGM_FILES[kind];
  if (!f) return null;
  if (typeof f === 'string') return f;
  const hit = f.find(([a, b]) => chapter >= a && chapter <= b);
  return hit ? hit[2] : null;
}
let lingering = null;   // 막 멈추라고 했지만 아직 살아 있는 파일 음악
const badFiles = new Set();   // 불러오기 실패한 파일(다시 시도하지 않고 절차 BGM으로)
// 서서히 줄이고 멈춘다(ms). file이 있으면 요소를 버리지 않고 멈춰서 보관한다 → 다시 틀 때 파일을 새로 받지 않는다
function stopEl(el, ms = 300, file = null) {
  if (!el) return;
  const n = Math.max(1, Math.round(ms / 60)), v0 = el.volume; let i = 0;
  el._fx = true;
  const t = setInterval(() => {
    i++;
    if (i >= n) {
      clearInterval(t); el._fx = false;
      try { el.pause(); if (file && !badFiles.has(file) && !preloaded[file]) { preloaded[file] = el; el.volume = bv(); } else { el.removeAttribute('src'); el.load(); } } catch { /* 무시 */ }
    } else { try { el.volume = Math.max(0, v0 * (1 - i / n)); } catch { /* 일부 기기는 음량 고정 */ } }
  }, 60);
}
function fadeIn(el, ms = 800) {
  const n = Math.max(1, Math.round(ms / 60)); let i = 0;
  try { el.volume = 0; } catch { return; }
  el._fx = true;   // 감시가 페이드 중 음량을 건드리지 않게
  const t = setInterval(() => { i++; try { el.volume = Math.min(bv(), bv() * i / n); } catch { /* 무시 */ } if (i >= n) { clearInterval(t); el._fx = false; } }, 60);
}
// 미리 받아 둔 음악 요소(재생은 아직 안 함). 장면이 열리기 전에 파일을 받아 두면 틀 때 바로 나온다
const preloaded = {};
export function preloadBgm(file) {
  if (!file || preloaded[file] || badFiles.has(file) || (bgm && bgm.file === file) || typeof Audio === 'undefined') return;
  try { const el = new Audio(); el.preload = 'auto'; el.loop = true; el.src = file; el.load(); preloaded[file] = el; } catch { /* 무시 */ }
}
export const preloadBattleBgm = () => preloadBgm(bgmFile('battle', 0));
// 전투 곡이 흐르는 동안 필요한 것만 미리 받는다: 보스 곡(중간보스·장 보스가 곧 나온다)과, 묶음의 마지막 장이면 다음 묶음 곡
function preloadAhead(kind, chapter) {
  if (kind !== 'battle') return;
  setTimeout(() => {
    if (!bgm || bgm.kind !== 'battle' || bgm.ch !== chapter || !musicOn) return;
    preloadBgm(bgmFile('boss', 0));
    const f = BGM_FILES.battle, i = f.findIndex(([a, b]) => chapter >= a && chapter <= b);
    if (i >= 0 && f[i + 1] && chapter === f[i][1]) preloadBgm(f[i + 1][2]);
  }, 6000);
}
// 게임이 열리자마자(로딩 화면부터) 로비 곡을 튼다. 같은 요소를 로비가 이어 쓴다. 자동재생이 막히면 첫 터치(wake)에서 튼다
export function earlyBgm(enabled) {
  musicOn = !!enabled;
  if (!musicOn || bgm || typeof Audio === 'undefined') return;
  const file = bgmFile('lobby', 0); if (!file) return;
  const el = new Audio(); attachGain(el); el.loop = true; el.preload = 'auto'; el.volume = bv(); el.muted = held; el.src = file;
  const st = { kind: 'lobby', ch: 0, file, el };
  el.addEventListener('error', () => { if (bgm === st) { badFiles.add(file); bgm = null; stopEl(el); } });
  bgm = st;
  const p = playEl(el);
  if (p && p.catch) p.catch(() => { /* 막힘: 첫 입력 때 wake가 다시 튼다 */ });
  watchSilence(bgm);
}
const resumeAt = {};   // 보스 곡으로 넘어가기 전 전투 곡의 재생 위치(파일 → 초). 보스를 잡고 돌아오면 거기서 이어서
function startFile(kind, chapter, file, crossfade) {
  const pre = preloaded[file]; delete preloaded[file];
  const el = pre || new Audio(file);
  attachGain(el);
  const at = kind !== 'boss' && resumeAt[file] > 0 ? resumeAt[file] : 0; delete resumeAt[file];
  if (pre || at) { try { el.currentTime = at; } catch { /* 무시 */ } }
  el.loop = true; el.preload = 'auto'; el.volume = bv(); el.muted = held;
  if (crossfade) fadeIn(el);
  const st = { kind, ch: chapter, file, el };
  const fail = () => { if (bgm === st) { badFiles.add(file); bgm = null; stopEl(el); playBgm(kind, chapter); } };
  el.addEventListener('error', fail);
  const p = playEl(el);
  if (p && p.catch) p.catch(e => {
    if (bgm !== st) return;
    if (e && e.name === 'NotAllowedError') { bgm = null; startProc(kind, chapter, st); }   // 자동재생 막힘: 절차 BGM으로 대신하다 다음 터치에 파일로 바꾼다
    else fail();
  });
  bgm = st;
  watchSilence(st);
  preloadAhead(kind, chapter);
}
// 터치 때: 막혀 있던 파일 음악을 다시 시도한다
function retryFile() {
  const w = bgm && bgm.want;
  if (!w || !musicOn || bgm.retrying) return;
  const old = bgm; old.retrying = true;
  const el = new Audio(w.file); attachGain(el);
  el.loop = true; el.volume = bv(); el.muted = held;
  playEl(el).then(() => {
    if (bgm !== old) { el.pause(); return; }
    clearInterval(old.timer); const g = old.g; try { g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2); } catch { /* 무시 */ } setTimeout(() => g.disconnect(), 300);
    bgm = { kind: w.kind, ch: w.ch, file: w.file, el }; watchSilence(bgm);
    el.addEventListener('error', () => { if (bgm && bgm.el === el) { badFiles.add(w.file); bgm = null; stopEl(el); playBgm(w.kind, w.ch); } });
  }).catch(() => { old.retrying = false; });
}
export function playBgm(kind, chapter = 0) {
  // 첫 터치 전에는 오디오를 만들지 않는다(브라우저 자동재생 제한)
  if (!musicOn || !ctx) return;
  const c = ac(); if (!c) return;
  if (bgm && bgm.kind === kind && bgm.ch === chapter) return;
  // 같은 파일이면 이어서 튼다(1장 → 2장 전투)
  const file = bgmFile(kind, chapter);
  if (file && bgm && bgm.file === file && bgm.el) { bgm.kind = kind; bgm.ch = chapter; return; }
  if (kind === 'boss' && bgm && bgm.el && bgm.kind !== 'boss') { try { resumeAt[bgm.file] = bgm.el.currentTime; } catch { /* 무시 */ } }
  stopBgm();
  if (file && lingering && lingering.file === file && !badFiles.has(file)) {   // 같은 곡: 처음부터 다시 틀지 않고 이어서
    clearTimeout(lingering.dying); bgm = lingering; lingering = null; bgm.kind = kind; bgm.ch = chapter;
    if (bgm.el.paused) playEl(bgm.el).catch(() => {});
    return;
  }
  let cross = false;
  if (lingering) { clearTimeout(lingering.dying); stopEl(lingering.el, 800, lingering.file); lingering = null; cross = true; }   // 다른 곡으로 바뀔 때: 이전 곡은 0.8초 페이드아웃, 새 곡은 페이드인
  if (file && !badFiles.has(file) && typeof Audio !== 'undefined') { startFile(kind, chapter, file, cross); return; }
  startProc(kind, chapter);
}
function startProc(kind, chapter, blocked) {
  const c = ctx; if (!c) return;
  const boss = kind === 'boss', lobby = kind === 'lobby';
  const step = boss ? 0.115 : lobby ? 0.2 : 0.14, root = lobby ? 110 : ROOT[chapter % ROOT.length];
  const g = c.createGain(); g.gain.value = 0; g.connect(master);
  g.gain.linearRampToValueAtTime(PGAIN(lobby), c.currentTime + 1);
  const st = { kind, ch: chapter, g, i: 0, next: c.currentTime + 0.05, t0: performance.now() };
  if (blocked) st.want = { kind, ch: chapter, file: blocked.file };
  const note = (t, f, dur, type, vol) => {
    const o = c.createOscillator(), e = c.createGain();
    o.type = type; o.frequency.value = f;
    e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(e).connect(g); o.start(t); o.stop(t + dur + 0.02);
  };
  // 0.1초마다 0.3초 앞까지 미리 예약한다(탭이 잠깐 버벅여도 박자가 밀리지 않게)
  st.timer = setInterval(() => {
    while (st.next < c.currentTime + 0.3) {
      const i = st.i, bar = Math.floor(i / 8) % 4, r = root * Math.pow(2, SEMI[bar] / 12), t = st.next;
      if (i % 4 === 0) note(t, r / 2, step * 3.5, boss ? 'sawtooth' : 'triangle', boss ? 0.16 : 0.3);
      if (!lobby || i % 2 === 0) note(t, r * 2 * Math.pow(2, ARP[i % 8] / 12), step * 0.9, 'square', lobby ? 0.035 : 0.045);
      if (boss && i % 2 === 1) hissTo(c, t, g);
      st.i++; st.next += step;
    }
  }, 100);
  bgm = st;
}
function hissTo(c, t, g) {
  const s = c.createBufferSource(), e = c.createGain(), f = c.createBiquadFilter();
  s.buffer = noise(c); f.type = 'highpass'; f.frequency.value = 6000;
  e.gain.setValueAtTime(0.06, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  s.connect(f).connect(e).connect(g); s.start(t); s.stop(t + 0.06);
}
export function stopBgm() {
  if (!bgm) return;
  clearInterval(bgm.timer);
  if (bgm.el) {   // 파일 음악: 바로 끄지 않고 잠깐 둔다 — 화면이 바뀌며 같은 곡을 곧 다시 틀면 이어서 쓴다
    const st = bgm; bgm = null;
    st.dying = setTimeout(() => { if (lingering === st) lingering = null; stopEl(st.el, 300, st.file); }, 350);
    lingering = st; return;
  }
  const g = bgm.g;
  try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8); } catch { /* 무시 */ }
  setTimeout(() => g.disconnect(), 900);
  bgm = null;
}

// 결과창: 파일 음악은 그대로 이어 튼다(같은 곡 묶음의 다음 판·재도전에서 끊기지 않게). 절차 BGM(보스·모드)만 서서히 끈다
export function endBgm() {
  if (!bgm) { for (const k in resumeAt) delete resumeAt[k]; return; }
  if (!bgm.el) { stopBgm(); return; }
  if (bgm.kind === 'boss' && bgmFile('battle', bgm.ch)) { playBgm('battle', bgm.ch); return; }   // 보스를 잡으면(지면) 그 장 묶음 곡으로 되돌아간다 — 전투 곡이 있는 장만
  for (const k in resumeAt) delete resumeAt[k];
  if (bgm.kind === 'boss' || bgm.kind === 'mode') {   // 곡이 없는 장의 보스·모드 곡은 결과창에서 1초에 걸쳐 끈다
    clearInterval(bgm.timer);
    const st = bgm; bgm = null; stopEl(st.el, 1000, st.file);
  }
}
// 장면을 떠날 때: 파일 음악은 끄지 않고 잠깐(4초) 둔다 → 다음 판이 같은 곡이면 이어서 쓰고, 다른 곡(로비)이면 playBgm이 0.8초 페이드로 바꾼다
export function leaveBgm() {
  for (const k in resumeAt) delete resumeAt[k];
  if (!bgm) return;
  if (!bgm.el) { stopBgm(); return; }
  clearInterval(bgm.timer);
  const st = bgm; bgm = null;
  if (lingering && lingering !== st) { clearTimeout(lingering.dying); stopEl(lingering.el, 300, lingering.file); }
  st.dying = setTimeout(() => { if (lingering === st) lingering = null; stopEl(st.el, 800, st.file); }, 4000);
  lingering = st;
}

// 감시: 1초마다 소리가 실제로 나오는 상태인지 본다. 일시정지·가림·창 전환·광고·시스템 소리 끊김 뒤에 어느 한 곳이 0이나 멈춤으로 남으면 되돌린다
// (컨텍스트 중단·닫힘, master 0, 파일 음악이 브라우저에 의해 멈춤·음소거·음량 0, 절차 BGM 게인 0·박자 밀림)
function watchdog() {
  if (typeof document === 'undefined' || document.hidden) return;
  try {
    if (ctx) {
      if (ctx.state === 'closed') { rebuild(); return; }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      if (master && !held && master.gain.value < 0.01) master.gain.value = 0.35;
    }
    if (!bgm || !musicOn) return;
    if (bgm.el) {
      const el = bgm.el;
      if (el.paused && !bgm.want) playEl(el).catch(() => {});
      if (!held && el.muted) el.muted = false;
      if (!el._fx && el.volume < bv() * 0.5) el.volume = bv();
    } else if (bgm.g && ctx && ctx.state === 'running') {
      if (bgm.next < ctx.currentTime - 0.5) bgm.next = ctx.currentTime + 0.05;
      if (performance.now() - (bgm.t0 || 0) > 2500 && bgm.g.gain.value < 0.05) { const g = bgm.g.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(PGAIN(bgm.kind === 'lobby'), t + 0.3); }
    }
  } catch { /* 감시는 게임을 막지 않는다 */ }
}
setInterval(watchdog, 1000);
