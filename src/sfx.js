// 효과음: 파일 없이 WebAudio로 합성한다. 같은 소리가 한 프레임에 몰리면 묶어서 한 번만 낸다
let ctx = null, master = null, on = true;
const last = {};

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const setSound = v => { on = v; if (!v) stopBgm(); };
export const unlock = () => ac();

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
  if (!on) return;
  const c = ac(); if (!c) return;
  const now = performance.now();
  if (now - (last[name] || 0) < gap) return;
  last[name] = now;
  try { SOUNDS[name](c, c.currentTime, p); } catch { /* 오디오 실패는 무시 */ }
}

// ── 배경음: 파일 없이 짧은 마디를 합성해 반복한다 ──
// 단조 4화음 진행(i-VI-III-VII) 위에 베이스와 아르페지오. 챕터마다 으뜸음, 보스는 빠르고 거칠게
const SEMI = [0, -4, 3, -2];                 // 화음 진행(으뜸음 기준 반음)
const ARP = [0, 3, 7, 12, 7, 3, 7, 3];       // 단3화음 펼침
const ROOT = [110, 98, 116.5, 92.5, 82.4];   // 장별 으뜸음(Hz)
let bgm = null;
export function playBgm(kind, chapter = 0) {
  // 첫 터치 전에는 오디오를 만들지 않는다(브라우저 자동재생 제한)
  if (!on || !ctx) return;
  const c = ac(); if (!c) return;
  if (bgm && bgm.kind === kind && bgm.ch === chapter) return;
  stopBgm();
  const boss = kind === 'boss', lobby = kind === 'lobby';
  const step = boss ? 0.115 : lobby ? 0.2 : 0.14, root = lobby ? 110 : ROOT[chapter % ROOT.length];
  const g = c.createGain(); g.gain.value = 0; g.connect(master);
  g.gain.linearRampToValueAtTime(lobby ? 0.22 : 0.28, c.currentTime + 1);
  const st = { kind, ch: chapter, g, i: 0, next: c.currentTime + 0.05 };
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
  const g = bgm.g;
  try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); } catch { /* 무시 */ }
  setTimeout(() => g.disconnect(), 400);
  bgm = null;
}
