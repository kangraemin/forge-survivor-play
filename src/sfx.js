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
export const setSound = v => { on = v; };
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

const SOUNDS = {
  swing: (c, t) => hiss(c, t, { dur: 0.09, vol: 0.18, hp: 1800, lp: 6000 }),
  hit: (c, t) => { tone(c, t, { f0: 220, f1: 90, dur: 0.07, vol: 0.25 }); hiss(c, t, { dur: 0.05, vol: 0.25, hp: 2000 }); },
  crit: (c, t) => { tone(c, t, { f0: 900, f1: 300, dur: 0.12, vol: 0.2 }); hiss(c, t, { dur: 0.1, vol: 0.3, hp: 1500 }); },
  kill: (c, t) => { tone(c, t, { f0: 160, f1: 50, dur: 0.14, type: 'triangle', vol: 0.35 }); hiss(c, t, { dur: 0.12, vol: 0.18, hp: 300, lp: 2500 }); },
  gem: (c, t) => tone(c, t, { f0: 1200 + Math.random() * 300, f1: 1800, dur: 0.05, type: 'sine', vol: 0.12 }),
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

export function sfx(name, gap = 40) {
  if (!on) return;
  const c = ac(); if (!c) return;
  const now = performance.now();
  if (now - (last[name] || 0) < gap) return;
  last[name] = now;
  try { SOUNDS[name](c, c.currentTime); } catch { /* 오디오 실패는 무시 */ }
}
