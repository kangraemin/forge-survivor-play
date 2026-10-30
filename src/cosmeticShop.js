import { COS_TABS, COSMETICS, COS_PACKS, cosmetic, wardrobe, equippedLook, equipCosmetic, buyCosmetic, buyCosmeticPack, packBase, ownsCosmetic, available, WINTER, todayLook, startTrial } from './cosmetics.js';
import { lookPreview } from './cosmeticView.js';
import { font, font9, panel, button, toast } from './ui.js';
import { buy, won } from './shop.js';
import { save } from './save.js';
import { track } from './log.js';

function icon(scene, parent, it, x, y, size = 28) {
  const body = it.kind === 'character' || it.kind === 'costume';
  const ob = scene.add.image(x, y, body ? `cos_${it.id}_4` : `cos_${it.id}`, body ? 2 : 0);
  ob.setScale(size / Math.max(ob.width, ob.height)); parent.add(ob); return ob;
}
export function cosmeticPage(s) {
  const sv = s.sv, b = s.body, state = wardrobe(sv);
  const kind = COS_TABS.some(([k]) => k === s.skinTab) ? s.skinTab : (s.skinTab = 'character');
  const all = COSMETICS.filter(it => it.kind === kind); s.cosSelected ||= {};
  let selected = cosmetic(s.cosSelected[kind]);
  if (selected?.kind !== kind) selected = cosmetic(equippedLook(sv)[kind]) || all[0];
  s.cosSelected[kind] = selected.id;
  const page = Math.floor(all.indexOf(selected) / 6), pages = Math.ceil(all.length / 6);
  const redraw = () => { save(); s.refreshTop(); s.show('shop'); };
  COS_TABS.forEach(([k, label], i) => {
    b.add(button(s, 29 + i * 53, 84, 50, 22, label, () => { s.skinTab = k; redraw(); }, { size: 10, color: kind === k ? 0x456074 : 0x3a3846 }));
  });
  const look = { ...equippedLook(sv), [kind]: selected.id };
  if (kind === 'costume') look.character = ''; if (kind === 'character') look.costume = '';
  b.add(panel(s, 12, 101, 246, 104, { fill: 0x13202e, line: 0x648393 }));
  const preview = lookPreview(s, b, 56, 154, look, sv.wtype, sv.tier); preview.setName('cosmetic-preview');
  b.add(s.add.text(105, 112, selected.name, { ...font(11), wordWrap: { width: 145 } }));
  b.add(s.add.text(105, 139, selected.desc, { ...font9(10, '#b4cfda'), wordWrap: { width: 143 } }));
  b.add(s.add.text(105, 171, kind === 'pet' ? '보스 펫과 함께 동행' : '외형·이펙트만 변경', font9(10, '#83d5c8')));
  b.add(button(s, 200, 192, 94, 18, '기본으로 해제', () => { equipCosmetic(sv, kind, ''); redraw(); }, { size: 9 }));
  all.slice(page * 6, page * 6 + 6).forEach((it, i) => {
    const x = 54 + (i % 3) * 81, y = 233 + Math.floor(i / 3) * 53;
    const bt = button(s, x, y, 76, 48, it.name, () => { s.cosSelected[kind] = it.id; redraw(); }, { size: 7, color: it.id === selected.id ? 0x43566d : 0x3a3846 });
    bt.label.setY(15); b.add(bt); icon(s, b, it, x, y - 7, 28);
    if (state.owned[it.id]) b.add(s.add.text(x + 32, y - 21, '✓', font9(9, '#9be7cd')).setOrigin(1, 0));
  });
  b.add(button(s, 36, 330, 40, 22, '◀', () => { s.cosSelected[kind] = all[((page + pages - 1) % pages) * 6].id; redraw(); }, { size: 11 }).setEnabled(pages > 1));
  b.add(s.add.text(135, 330, `${page + 1} / ${pages} · ${all.length}종`, font9(10, '#b4cfda')).setOrigin(0.5));
  b.add(button(s, 234, 330, 40, 22, '▶', () => { s.cosSelected[kind] = all[((page + 1) % pages) * 6].id; redraw(); }, { size: 11 }).setEnabled(pages > 1));
  const own = ownsCosmetic(sv, selected.id), on = equippedLook(sv)[kind] === selected.id, sale = available(selected);
  const label = on ? '착용 중' : own ? '이 모습으로 착용' : !sale ? '판매 기간 종료' : `보석 ${selected.cost} · 구매 후 착용`;
  b.add(button(s, 135, 364, 238, 30, label, () => {
    if (s.busy || on) return;
    if (own) equipCosmetic(sv, kind, selected.id);
    else if (!buyCosmetic(sv, selected.id)) { if (sv.gem < selected.cost) s.gemShort(selected.cost); return; }
    track(own ? 'cosmetic_equip' : 'cosmetic_buy', { id: selected.id, kind, cost: own ? 0 : selected.cost }); redraw();
  }, { size: 11, color: 0x2f6b3a }).setEnabled(!on && (own || sale)));
  b.add(s.add.text(135, 387, selected.id === 'santa' ? WINTER.label : kind === 'costume' ? '의상은 기본 모험가용 · 선택하면 캐릭터가 전환돼요' : kind === 'character' ? '캐릭터 선택 시 의상 해제 · 장비 성능은 그대로' : '미리보기: 서기 → 걷기 → 베기 → 처치 효과', font9(9, '#a1b2b6')).setOrigin(0.5));
  b.add(button(s, 74, 410, 116, 24, '묶음 20% 할인', () => cosmeticPacks(s), { size: 10 }));
  b.add(button(s, 196, 410, 116, 24, '이전 꾸미기', () => { s.legacySkins = true; redraw(); }, { size: 10 }));
}
export function cosmeticPacks(s, index = 0) {
  const sv = s.sv, pack = COS_PACKS[index], c = s.modal(), own = pack.give.cosmetics.some(id => ownsCosmetic(sv, id));
  c.add(panel(s, 16, 93, 238, 306, { fill: 0x152332 }));
  c.add(s.add.text(135, 116, pack.name, font(15, '#ffe0a0')).setOrigin(0.5));
  pack.give.cosmetics.forEach((id, i) => { const it = cosmetic(id); icon(s, c, it, 61 + i * 74, 166, 42); c.add(s.add.text(61 + i * 74, 201, it.name, font9(8, '#dae7ed')).setOrigin(0.5)); });
  c.add(s.add.text(135, 230, `각각 ${packBase(pack)} → 묶음 ${pack.gemCost} 보석`, font9(11, '#ffe0a0')).setOrigin(0.5));
  c.add(s.add.text(135, 250, '보석 가격 기준 20% 할인 · 상시 판매\n원화는 별도 구매 선택 · 중복 구매 불가', { ...font9(10, '#b4cfda'), align: 'center' }).setOrigin(0.5));
  let purchasing = false;
  c.add(button(s, 135, 290, 210, 28, own ? '구성품 보유 · 개별 구매를 이용해요' : `${pack.gemCost} 보석으로 구매`, () => { if (purchasing) return; if (!buyCosmeticPack(sv, pack)) { toast(s, '보석이 부족해요'); return; } save(); c.close(); }, { color: 0x2f6b3a, size: 10 }).setEnabled(!own));
  const cash = button(s, 135, 325, 210, 28, `${won(pack.price)} 결제로 구매`, async () => {
    if (purchasing) return; purchasing = true; cash.setEnabled(false); const ok = await buy(s, sv, pack); if (!c.active) return;
    if (ok) c.close(); else { purchasing = false; cash.setEnabled(true); }
  }, { size: 11 }); c.add(cash.setEnabled(!own));
  c.add(button(s, 78, 371, 100, 24, '다른 묶음', () => { if (purchasing) return; c.close(); cosmeticPacks(s, (index + 1) % COS_PACKS.length); }, { size: 10 }));
  c.add(button(s, 192, 371, 100, 24, '닫기', () => { if (!purchasing) c.close(); }, { size: 10 }));
}

// 결과 위 빈 영역의 작은 추천 카드. 보상·재도전 버튼을 가리거나 자동 창을 띄우지 않는다.
export function cosmeticResultCard(s, parent, win) {
  if (s.bot || s.dungeon || s.endless || !(s.sv.stats.runs === 1 || (win && s.isBoss) || s.cosTrial)) return;
  const sv = s.sv, state = wardrobe(sv), it = cosmetic(s.cosTrial) || todayLook();
  parent.add(panel(s, 20, 18, 230, 60, { fill: 0x142a31, line: 0x507b89 }));
  icon(s, parent, it, 43, 48, 42);
  parent.add(s.add.text(67, 26, `${s.cosTrial ? '체험 끝' : '오늘의 꾸미기'} · ${it.name}`, font9(10, '#d5e9ee')));
  const trial = !s.cosTrial && !state.tried[it.id] && !state.owned[it.id] && available(it);
  const bt = button(s, 153, 58, 172, 24, trial ? '이 옷 입고 다시 하기 · 1판 무료' : `꾸미기 보기 · ${it.cost} 보석`, () => {
    if (trial) {
      if (!startTrial(sv, it.id)) return; save();
      s.scene.start('Battle', { chapter: s.c, stage: s.s, hard: s.hard, bot: false });
    } else s.scene.start('Lobby', { tab: 'shop', cosmetic: it.id });
  }, { size: 9 }); parent.add(bt);
}
