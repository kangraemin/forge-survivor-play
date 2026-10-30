// 공용 글자 맞춤: 긴 번역이 상자(패널·카드·화면) 밖으로 나가지 않게, 매 프레임 새로 생기거나 바뀐 글자만 맞춘다.
// 순서: 조금 줄이기(80%까지) -> 상자 폭 안에서 줄바꿈 -> 그래도 넘치면 최소 크기까지 줄이기. 한국어는 건드리지 않는다.
// 버튼 글자는 ui.js button()이 따로 맞춘다. 화면마다 따로 땜질하지 않는다.
import { lang } from './i18n.js';

const NOSPACE = lang === 'ja' || lang === 'zh-Hans' || lang === 'zh-Hant' || lang === 'th';
const MIN = 7, SCREEN_W = 270;
let seg = null;
try { if (NOSPACE) seg = new Intl.Segmenter(lang, { granularity: 'word' }); } catch { seg = null; }

const tokens = s => seg ? [...seg.segment(s)].map(x => x.segment) : s.split(/(\s+)/).filter(Boolean);

// 글자 폭을 재서 maxW 안에서 줄바꿈한 문자열을 돌려준다
export function wrapTo(o, s, maxW) {
  const ctx = o.context; o.style.syncFont(o.canvas, ctx);
  const w = x => ctx.measureText(x).width;
  const out = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const tk of tokens(para)) {
      if (w(line + tk) <= maxW || !line.trim()) {
        if (!line && /^\s+$/.test(tk)) continue;
        line += tk;
        // 한 토큰이 혼자 maxW를 넘으면 글자 단위로 자른다
        while (w(line) > maxW && [...line].length > 1) {
          let cut = [...line]; let tail = '';
          while (w(cut.join('')) > maxW && cut.length > 1) tail = cut.pop() + tail;
          out.push(cut.join('')); line = tail;
        }
      } else { out.push(line.trimEnd()); line = /^\s+$/.test(tk) ? '' : tk; }
    }
    out.push(line.trimEnd());
  }
  return out.join('\n');
}

const visibleChain = o => { for (let q = o; q; q = q.parentContainer) if (!q.visible || q.alpha < 0.05) return false; return true; };
const worldOf = o => o.getWorldTransformMatrix();

function fitOne(o, panels, GH, rects) {
  if (o.isBtnLabel) return;
  const base = o._fitBase, orig = o._fitOrig;
  const m = worldOf(o), ax = m.tx, ay = m.ty, sx = Math.abs(m.scaleX) || 1;
  const host = panels.filter(p => ax >= p.x && ax <= p.x + p.w && ay >= p.y && ay <= p.y + p.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
  const L = host ? host.x : 0, R = host ? host.x + host.w : SCREEN_W, B = host ? host.y + host.h : GH;
  const ox = o.originX;
  let avail = ox === 0.5 ? 2 * Math.min(ax - L, R - ax) - 3 : ox === 0 ? R - ax - 2 : ax - L - 2;
  if (o.style.wordWrapWidth && avail > o.style.wordWrapWidth) avail = o.style.wordWrapWidth;   // 원래 줄바꿈 폭은 넘지 않는다
  avail = Math.max(avail / sx, 24);
  const set = (txt, size) => { o._fitApplying = true; o.setFontSize(size); o.setText(txt); o._fitApplying = false; };
  const wrapW = o.style.wordWrapWidth;
  // 이웃(다른 글자·버튼)과 부딪히는지: 내 기준점을 이미 덮고 있는 물체는 일부러 겹친 것이라 무시한다
  const mine = rects.filter(r => r.o !== o && !(ax > r.x && ax < r.x + r.w && ay > r.y && ay < r.y + r.h));
  const clash = () => {
    const b = o.getBounds();
    return mine.some(r => Math.min(b.right, r.x + r.w) - Math.max(b.x, r.x) > 2 && Math.min(b.bottom, r.y + r.h) - Math.max(b.y, r.y) > 3);
  };
  const fits = () => { const b = o.getBounds(); return o.width <= avail + 0.5 && b.bottom <= B + 1 && !clash(); };
  const attempts = [];
  const single = !orig.includes('\n') && !wrapW;
  attempts.push([() => (NOSPACE && wrapW ? wrapTo(o, orig, avail) : orig), base]);
  if (single) for (let sz = base - 0.5; sz >= MIN; sz -= 0.5) attempts.push([() => orig, sz]);   // 한 줄 글자는 먼저 줄인다(이웃과 겹치지 않게)
  for (let sz = base; sz >= MIN; sz -= 0.5) attempts.push([() => wrapTo(o, orig, avail), sz]);
  let ok = false;
  for (const [mk, sz] of attempts) { set(mk(), sz); if (fits()) { ok = true; break; } }
  if (!ok) { set(single ? orig : wrapTo(o, orig, avail), MIN); (window.__fitBad ||= []).push({ text: orig, avail: Math.round(avail), base }); }   // 끝까지 안 되면 짧은 번역(_short) 대상
  o._fitApplied = o.text; o._fitSize = parseFloat(o.style.fontSize);
  (window.__fitStats ||= { n: 0, bad: 0 }).n++;
  if (!ok) window.__fitStats.bad++;
}

function walk(list, vis, acc) {
  for (const o of list) {
    if (!o.active) continue;
    const v = vis && o.visible && o.alpha >= 0.05;
    if (o.type === 'Text') acc.texts.push([o, v]);
    else if (o.box && v) acc.panels.push(o);
    else if (o.isBtn && v) acc.btns.push(o);
    if (o.list) walk(o.list, v, acc);
  }
}

export function installTextFit(game) {
  if (lang === 'ko') return;
  game.events.on('prerender', () => {
    for (const sc of game.scene.getScenes(true)) {
      const acc = { texts: [], panels: [], btns: [] };
      walk(sc.children.list, true, acc);
      let pending = null;
      for (const [o, v] of acc.texts) {
        if (!v || o.isBtnLabel || o.noFit) continue;
        const sz = parseFloat(o.style.fontSize);
        // 아직 안 맞췄거나, 게임 코드가 글자·크기를 바꾼 것
        if (o._fitApplied === o.text && o._fitSize === sz) continue;
        if (o._fitApplied !== o.text || o._fitSize !== sz) { o._fitOrig = o.text; o._fitBase = sz; }
        (pending ||= []).push(o);
      }
      if (!pending) continue;
      const GH = Math.round(game.scale.gameSize.height / sc.cameras.main.zoom);
      const panels = acc.panels.map(o => { const m = worldOf(o); return { x: m.tx + o.box.x, y: m.ty + o.box.y, w: o.box.w, h: o.box.h }; });
      const rects = [];
      for (const [q, v] of acc.texts) if (v && !q.isBtnLabel && String(q.text).trim()) { const b = q.getBounds(); rects.push({ o: q, x: b.x, y: b.y, w: b.width, h: b.height }); }
      for (const q of acc.btns) { const m = worldOf(q), w = q.width * Math.abs(m.scaleX), h = q.height * Math.abs(m.scaleY); rects.push({ o: q, x: m.tx - w / 2, y: m.ty - h / 2, w, h }); }
      for (const o of pending) { fitOne(o, panels, GH, rects); const b = o.getBounds(), r = rects.find(r => r.o === o); if (r) { r.x = b.x; r.y = b.y; r.w = b.width; r.h = b.height; } }
    }
  });
}
