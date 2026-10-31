// 64차: PC(마우스가 주 입력인 기기) 조작. 폰·토스에서는 아무것도 하지 않는다.
//  - 키보드: Esc(일시정지·창 닫기), Enter/Space(주 버튼 = 주황·초록 버튼 확인), 1·2·3(레벨업 카드), F(전체 화면)
//  - 우클릭 메뉴·글자 선택·그림 끌기를 막고, 창 크기가 바뀌면 다시 맞추고, 전체 화면 버튼을 둔다
//  - WASD·방향키 이동과 Space 궁극기는 Battle.js에 이미 있다. 버튼 hover·손 모양 커서는 ui.js button이 한다
import { PC } from './data.js';
import { t } from './i18n.js';

// 장면 안의 눌러지는 버튼(ui.js button)을 위에 그려진 순서로 모은다. 안 보이거나 비활성인 것은 뺀다
function buttons(sc) {
  const out = [];
  const walk = (list, top, vis) => {
    for (const o of list) {
      if (!o || !o.active) continue;
      const v = vis && o.visible !== false && (o.alpha === undefined || o.alpha > 0.05);
      const d = top ?? (o.depth || 0);
      if (o.isBtn) { if (v && o.enabled !== false && o.input?.enabled) out.push({ o, d }); continue; }
      if (o.list) walk(o.list, d, v);
    }
  };
  walk(sc.children.list, null, true);
  return out;
}
const press = b => { b.armed = true; b.emit('pointerup', null, 0, 0, null); };
// 주 버튼(주황) 중 가장 위에 있는 것. minDepth보다 아래(창 뒤)의 버튼은 누르지 않는다
const primary = (sc, minDepth = 0) => {
  const c = buttons(sc).filter(x => x.o.col === 0x2f6b3a && x.d >= minDepth);
  if (!c.length) return null;
  const top = Math.max(...c.map(x => x.d));
  const same = c.filter(x => x.d === top);
  return same[same.length - 1].o;
};

export function installPcInput(game) {
  addEventListener('resize', () => { try { game.scale.refresh(); } catch { /* 크기 맞춤 실패는 무시 */ } });
  if (!PC) return;
  const stop = e => { const tg = e.target; if (tg && /^(INPUT|TEXTAREA)$/.test(tg.tagName)) return; e.preventDefault(); };
  ['contextmenu', 'selectstart', 'dragstart'].forEach(ev => document.addEventListener(ev, stop));
  const css = document.createElement('style');
  css.textContent = '#game canvas{user-select:none;-webkit-user-select:none;-webkit-user-drag:none}#fsbtn{position:fixed;z-index:6;top:8px;right:8px;width:34px;height:34px;padding:0;color:#fff;background:rgba(12,10,20,.72);border:1px solid #475c66;border-radius:6px;font:20px/30px sans-serif;cursor:pointer}#fsbtn:hover{background:rgba(29,111,128,.9)}';
  document.head.appendChild(css);

  const fs = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch { /* 전체 화면을 못 켜는 환경 */ } };
  if (!window.__FORGE_PORTAL && document.documentElement.requestFullscreen) {   // 포털(itch·CrazyGames)은 자기 전체 화면 버튼이 있다
    const b = document.createElement('button'); b.id = 'fsbtn'; b.type = 'button'; b.textContent = '⛶'; b.title = t('desk.fullscreen'); b.setAttribute('aria-label', t('desk.fullscreen'));
    b.addEventListener('click', e => { e.stopPropagation(); fs(); b.blur(); });
    document.body.appendChild(b);
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) return;
    const k = e.key, sc = game.scene.getScenes(true).find(s => s.sys.settings.key !== 'BgLoad');
    if (!sc) return;
    if ((k === 'f' || k === 'F') && !e.repeat) return fs();
    const key = sc.sys.settings.key, enter = k === 'Enter' || k === ' ';
    if (key === 'Boot') {
      if (enter && sc.registry.get('tapGate')) { e.preventDefault(); sc.input.emit('pointerup', { upX: 0, upY: 0, downX: 0, downY: 0 }); }
      return;
    }
    if (key === 'Battle') {
      const ov = sc.ui;
      if (!ov || sc.over && !ov.open) return;
      if (ov.open === 'level' && /^[1-3]$/.test(k) && ov.cardsC?.active) { e.preventDefault(); ov.pick(ov.cardsC.list[+k - 1]?.key); return; }
      if (k === 'Escape') {
        e.preventDefault();
        if (!ov.open) { if (!sc.paused) ov.pauseMenu(); return; }
        if (ov.open === 'pause') { const b = primary(sc, 100); if (b) press(b); }
        return;
      }
      if (enter && ov.open && !e.repeat) { const b = primary(sc, 100); if (b) { e.preventDefault(); press(b); } }
      return;
    }
    if (key === 'Lobby') {
      if (k === 'Escape') { if (sc.busy && sc.modalC?.active) { e.preventDefault(); sc.modalC.close?.(); } return; }
      if (enter && !e.repeat) { const b = primary(sc, sc.busy ? 1000 : 0); if (b) { e.preventDefault(); press(b); } }
    }
  });
}
