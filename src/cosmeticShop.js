import { COS_TABS, COSMETICS, COS_PACKS, cosmetic, wardrobe, equippedLook, equipCosmetic, buyCosmetic, buyCosmeticPack, packBase, ownsCosmetic, available, isWinter, winterItems, WINTER, todayLook, startTrial, salePrice, todaySale, SALE_OFF } from './cosmetics.js';
import { lookPreview } from './cosmeticView.js';
import { font, font9, panel, button, toast } from './ui.js';
import { buy, priceLabel, webForeign } from './shop.js';
import { cashHidden } from './platform/flags.js';   // 포털판: 결제 버튼 숨김
import { save } from './save.js';
import { track } from './log.js';
import * as D from './data.js';
import { t } from './i18n.js';

function icon(scene, parent, it, x, y, size = 28) {
  const body = it.kind === 'character' || it.kind === 'costume';
  const ob = scene.add.image(x, y, body ? `cos_${it.id}_4` : `cos_${it.id}`, body ? 2 : 0);
  ob.setScale(size / Math.max(ob.width, ob.height)); parent.add(ob); return ob;
}
export function cosmeticPage(s) {
  const sv = s.sv, b = s.body, state = wardrobe(sv);
  const tab = COS_TABS.some(([k]) => k === s.skinTab) ? s.skinTab : (s.skinTab = available({ winter: true }) ? 'winter' : 'character');
  const all = tab === 'winter' ? winterItems() : COSMETICS.filter(it => it.kind === tab); s.cosSelected ||= {};
  let selected = cosmetic(s.cosSelected[tab]);
  if (!all.includes(selected)) selected = (tab === 'winter' ? null : cosmetic(equippedLook(sv)[tab])) || all[0];
  s.cosSelected[tab] = selected.id;
  const kind = selected.kind;
  const page = Math.floor(all.indexOf(selected) / 6), pages = Math.ceil(all.length / 6);
  const redraw = () => { save(); s.refreshTop(); s.show('shop'); };
  COS_TABS.forEach(([k, label], i) => {
    b.add(button(s, 25 + i * 44, 84, 42, 22, label, () => { s.skinTab = k; redraw(); }, { size: 10, color: tab === k ? (k === 'winter' ? 0x3a7a9a : 0x456074) : k === 'winter' ? 0x2d4a5c : 0x3a3846 }));
  });
  const look = { ...equippedLook(sv), [kind]: selected.id };
  if (kind === 'costume') look.character = ''; if (kind === 'character') look.costume = '';
  b.add(panel(s, 12, 101, 246, 104, { fill: 0x13202e, line: 0x648393 }));
  const preview = lookPreview(s, b, 56, 154, look, sv.wtype, sv.tier); preview.setName('cosmetic-preview');
  b.add(s.add.text(105, 112, selected.name, { ...font(11), wordWrap: { width: 145 } }));
  b.add(s.add.text(105, 139, selected.desc, { ...font9(10, '#b4cfda'), wordWrap: { width: 143 } }));
  const sp0 = salePrice(sv, selected);
  if (!state.owned[selected.id] && sp0.off) b.add(s.add.text(105, 171, sp0.why === 'today' ? t('cosmeticShop.0b2a55', { SALE_OFF }) : t('cosmeticShop.dbd59e', { SALE_OFF }), font9(10, '#ffd75e')));
  else b.add(s.add.text(105, 171, kind === 'pet' ? t('cosmeticShop.715ff2') : t('cosmeticShop.32665b'), font9(10, '#83d5c8')));
  const body = kind === 'character' || kind === 'costume', canTry = body && !state.owned[selected.id] && !state.tried[selected.id] && available(selected);
  if (canTry) b.add(button(s, 118, 192, 76, 18, t('cosmeticShop.da4148'), () => { if (startTrial(sv, selected.id)) { save(); s.scene.start('Battle', { chapter: 0, stage: 0, bot: false, practice: true }); } }, { size: 9, color: 0x1f5a4a }));
  b.add(button(s, canTry ? 214 : 200, 192, canTry ? 84 : 94, 18, t('cosmeticShop.3ff902'), () => { equipCosmetic(sv, kind, ''); redraw(); }, { size: 9 }));
  const ts0 = todaySale();
  all.slice(page * 6, page * 6 + 6).forEach((it, i) => {
    const x = 54 + (i % 3) * 81, y = 233 + Math.floor(i / 3) * 53;
    const bt = button(s, x, y, 76, 48, it.name, () => { s.cosSelected[tab] = it.id; redraw(); }, { size: 7, color: it.id === selected.id ? 0x43566d : 0x3a3846 });
    bt.label.setY(15); b.add(bt); icon(s, b, it, x, y - 7, 28);
    if (state.owned[it.id]) b.add(s.add.text(x + 32, y - 21, '✓', font9(9, '#9be7cd')).setOrigin(1, 0));
    else if (it.id === ts0.id) b.add(s.add.text(x + 32, y - 21, '★', font9(9, '#ffd75e')).setOrigin(1, 0));
  });
  b.add(button(s, 36, 330, 40, 22, '◀', () => { s.cosSelected[tab] = all[((page + pages - 1) % pages) * 6].id; redraw(); }, { size: 11 }).setEnabled(pages > 1));
  b.add(s.add.text(135, 330, t('cosmeticShop.253177', { v: page + 1, pages, length: all.length }), font9(10, '#b4cfda')).setOrigin(0.5));
  b.add(button(s, 234, 330, 40, 22, '▶', () => { s.cosSelected[tab] = all[((page + 1) % pages) * 6].id; redraw(); }, { size: 11 }).setEnabled(pages > 1));
  const own = ownsCosmetic(sv, selected.id), on = equippedLook(sv)[kind] === selected.id, sale = available(selected);
  const sp = salePrice(sv, selected), price = sp.price;
  const label = on ? t('cosmeticShop.ba6353') : own ? t('cosmeticShop.0e2ddf') : !sale ? t('cosmeticShop.8769e3') : sp.off ? t('cosmeticShop.07ea18', { price, cost: selected.cost }) : t('cosmeticShop.e2c590', { cost: selected.cost });
  b.add(button(s, 135, 364, 238, 30, label, () => {
    if (s.busy || on) return;
    if (own) equipCosmetic(sv, kind, selected.id);
    else if (!buyCosmetic(sv, selected.id)) { if (sv.gem < price) s.gemShort(price); return; }
    track(own ? 'cosmetic_equip' : 'cosmetic_buy', { id: selected.id, kind, cost: own ? 0 : price }); redraw();
  }, { size: 11, color: 0x2f6b3a }).setEnabled(!on && (own || sale)));
  b.add(s.add.text(135, 387, isWinter(selected) ? WINTER.label : kind === 'costume' ? t('cosmeticShop.3704f4') : kind === 'character' ? t('cosmeticShop.cb3434') : t('cosmeticShop.83aa58'), font9(9, '#a1b2b6')).setOrigin(0.5));
  const ts = todaySale();
  b.add(button(s, 47, 410, 78, 24, t('cosmeticShop.f55a07'), () => { s.skinTab = ts.kind; s.cosSelected[ts.kind] = ts.id; redraw(); }, { size: 9, color: 0x6a4a1a }));
  b.add(button(s, 135, 410, 78, 24, t('cosmeticShop.2ab89d'), () => cosmeticPacks(s, tab === 'winter' ? COS_PACKS.findIndex(p => p.winter) : 0), { size: 9 }));
  b.add(button(s, 223, 410, 78, 24, t('cosmeticShop.a5c27c'), () => { s.legacySkins = true; redraw(); }, { size: 9 }));
}
export function cosmeticPacks(s, index = 0) {
  const sv = s.sv, pack = COS_PACKS[index], c = s.modal(), own = pack.give.cosmetics.some(id => ownsCosmetic(sv, id)), inSeason = !pack.winter || available({ winter: true });
  c.add(panel(s, 16, 93, 238, 306, { fill: 0x152332 }));
  c.add(s.add.text(135, 116, pack.name, font(15, '#ffe0a0')).setOrigin(0.5));
  pack.give.cosmetics.forEach((id, i) => { const it = cosmetic(id); icon(s, c, it, 61 + i * 74, 166, 42); c.add(s.add.text(61 + i * 74, 201, it.name, font9(8, '#dae7ed')).setOrigin(0.5)); });
  c.add(s.add.text(135, 230, t('cosmeticShop.a03404', { packBase: packBase(pack), gemCost: pack.gemCost }), font9(11, '#ffe0a0')).setOrigin(0.5));
  c.add(s.add.text(135, 250, (pack.winter ? t('cosmeticShop.58c8d2') : t('cosmeticShop.1573f5')) + (cashHidden() ? '' : t('cosmeticShop.9224f6')), { ...font9(10, '#b4cfda'), align: 'center' }).setOrigin(0.5));
  let purchasing = false;
  c.add(button(s, 135, 290, 210, 28, own ? t('cosmeticShop.808679') : t('cosmeticShop.772d31', { gemCost: pack.gemCost }), () => { if (purchasing) return; if (!buyCosmeticPack(sv, pack)) { toast(s, t('cosmeticShop.0c7031')); return; } save(); c.close(); }, { color: 0x2f6b3a, size: 10 }).setEnabled(!own && inSeason));
  const cash = button(s, 135, 325, 210, 28, webForeign() ? priceLabel(pack) : t('cosmeticShop.a713b2', { won: priceLabel(pack) }), async () => {
    if (purchasing) return; purchasing = true; cash.setEnabled(false); const ok = await buy(s, sv, pack); if (!c.active) return;
    if (ok) c.close(); else { purchasing = false; cash.setEnabled(true); }
  }, { size: 11 }); c.add(cash.setEnabled(!own && inSeason)); if (cashHidden()) { cash.setVisible(false); cash.setEnabled(false); }   // 포털판은 현금 결제 버튼이 없다
  c.add(button(s, 78, 371, 100, 24, t('cosmeticShop.7fcd13'), () => { if (purchasing) return; c.close(); cosmeticPacks(s, (index + 1) % COS_PACKS.length); }, { size: 10 }));
  c.add(button(s, 192, 371, 100, 24, t('cosmeticShop.94b7db'), () => { if (!purchasing) c.close(); }, { size: 10 }));
}

// 결과 위 빈 영역의 작은 추천 카드. 보상·재도전 버튼을 가리거나 자동 창을 띄우지 않는다.
export function cosmeticResultCard(s, parent, win) {
  s.cosCard = false;
  // 48차: 첫 3판은 보상과 '다음 판'만. 추천 카드는 4판째부터(보스 격파 때나 체험 끝)이고, 위쪽 HUD를 가리지 않게 결과 창 아래에 둔다
  const gate = s.sv.stats.runs > 3 && win && s.isBoss;
  if (s.bot || s.dungeon || s.endless || !(gate || s.cosTrial)) return false;
  const base = 458, room = D.H - base - 4;
  if (room < 40) return false;   // 480 높이 화면은 아래 빈 곳이 없어 카드를 건너뛴다
  const sv = s.sv, state = wardrobe(sv), it = cosmetic(s.cosTrial) || todayLook();
  s.cosCard = true;
  parent.add(panel(s, 20, base, 230, 40, { fill: 0x142a31, line: 0x507b89 }));
  icon(s, parent, it, 40, base + 20, 28);
  const owned = state.owned[it.id];
  parent.add(s.add.text(60, base + 3, `${s.cosTrial ? t('cosmeticShop.78c07a') : t('cosmeticShop.60604a')} · ${it.name}`, font9(9, '#d5e9ee')));
  const trial = !s.cosTrial && !state.tried[it.id] && !owned && available(it);
  const bt = button(s, 156, base + 27, 176, 18, trial ? t('cosmeticShop.19b489') : owned ? t('cosmeticShop.5e9764', { name: it.name }) : t('cosmeticShop.88dcf0', { price: salePrice(sv, it).price }), () => {
    if (trial) {
      if (!startTrial(sv, it.id)) return; save();
      s.scene.start('Battle', { chapter: 0, stage: 0, bot: false, practice: true });
    } else s.scene.start('Lobby', { tab: 'shop', cosmetic: it.id });
  }, { size: 9 }); parent.add(bt);
  return true;
}
