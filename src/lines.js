// 상황별 짧은 대사(대장장이·보스·무한의 탑). 미리 만들어 둔 lines/<언어>.json 만 읽는다 — 서버·LLM 호출 없음(tools/gen_lines.mjs가 만든다)
import { lang } from './i18n.js';
import { font9 } from './ui.js';

const IS_NODE = typeof window === 'undefined';
async function loadLines(name) {
  const u = new URL(`./lines/${name}.json`, import.meta.url);
  if (IS_NODE) { const fs = await import('node:fs'); return JSON.parse(fs.readFileSync(u, 'utf8')); }
  const r = await fetch(u); if (!r.ok) throw new Error('lines ' + name);
  return r.json();
}
let KO = {}, DICT = {};
try { KO = await loadLines('ko'); DICT = lang === 'ko' ? KO : await loadLines(lang).catch(() => KO); } catch { /* 대사를 못 읽으면 말풍선만 없다 */ }

const last = {};
// 같은 줄이 연달아 나오지 않게 무작위로 고른다(고정 아님). 줄이 없으면 ''
export function line(group, key) {
  const a = DICT[group]?.[key] || KO[group]?.[key];
  if (!a?.length) return '';
  const id = group + '.' + key;
  let i = Math.floor(Math.random() * a.length);
  if (a.length > 1 && i === last[id]) i = (i + 1 + Math.floor(Math.random() * (a.length - 1))) % a.length;
  last[id] = i;
  return a[i];
}

// 말풍선: 어두운 띠에 한 줄(길면 두 줄). 1.8초 뒤 사라지거나 다음 터치에 닫힌다. 입력을 가로채지 않는다
export function bubble(scene, msg, { x = 135, y = 120, depth = 3100, delay = 0, hold = 1800, color = '#f2e4bc' } = {}) {
  if (!msg || !scene?.add) return;
  scene.bubbleObj?.destroy?.();
  const tx = scene.add.text(0, 0, msg, { ...font9(11, color), wordWrap: { width: 236 }, align: 'center' }).setOrigin(0.5);
  const bg = scene.add.rectangle(0, 0, Math.min(260, tx.width + 22), tx.height + 12, 0x0a0710, 0.9).setStrokeStyle(1, 0x7d6a3a);
  const c = scene.add.container(x, y, [bg, tx]).setDepth(depth).setScrollFactor(0).setAlpha(0);
  scene.bubbleObj = c;
  let dead = false;
  const close = () => { if (dead) return; dead = true; scene.input?.off('pointerdown', close); scene.tweens.killTweensOf(c); scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => { c.destroy(); if (scene.bubbleObj === c) scene.bubbleObj = null; } }); };
  scene.time.delayedCall(delay, () => {
    if (dead || !c.active) return;
    scene.tweens.add({ targets: c, alpha: 1, duration: 160 });
    scene.time.delayedCall(hold, close);
    scene.time.delayedCall(250, () => { if (!dead) scene.input?.once('pointerdown', close); });
  });
  scene.events.once('shutdown', () => { dead = true; c.destroy(); });
}
