// 끊겨 보이던 2~4장 애니메이션(몹·보스·펫·주인공)을 8장 그림(assets/smooth/<키>.png)으로 바꾼다
//  - 칸 크기는 원래와 같다. 장수가 늘어난 만큼 frameRate도 올려 한 바퀴 길이(=공격·예고 타이밍)는 그대로다
//  - 원래 그림을 받은 뒤에만 바꾼다(대체 그림으로 도는 몹은 그대로). 판정·시뮬은 그림과 상관없다
import { SMOOTH } from './smoothList.js';

// 8장 그림 키 -> 따라 받을 원래 그림 키(lazy가 원래 그림을 받을 때 같이 받는다)
export const SM_SRC = {};
for (const [k, [src]] of Object.entries(SMOOTH)) SM_SRC['sm_' + k] = src;
export const withSmooth = pred => k => pred(k) || (!!SM_SRC[k] && pred(SM_SRC[k]));

export function loadSmooth(S) {
  for (const [k, [, fw, fh, , px = 0, pt = 0]] of Object.entries(SMOOTH)) S.load.spritesheet('sm_' + k, `assets/smooth/${k}.png`, { frameWidth: fw + 2 * px, frameHeight: fh + pt });
}

// buildAnims 끝에서 부른다. 원래 그림으로 만든 애니메이션만 같은 키의 8장으로 바꾼다
export function applySmooth(s) {
  for (const [k, [, fw, fh, tex, px = 0, pt = 0]] of Object.entries(SMOOTH)) {
    const a = s.anims.get(k), sk = 'sm_' + k;
    if (!a || !tex || a.frames[0]?.textureKey !== tex || !s.textures.exists(sk)) continue;
    // 넓힌 칸: 스프라이트 크기·중심은 원래 칸(fw x fh)으로 두고, 넘친 부분만 바깥에 그린다
    if (px || pt) for (const f of Object.values(s.textures.get(sk).frames)) if (f.name !== '__BASE') f.setTrim(fw, fh, -px, -pt, fw + 2 * px, fh + pt);
    const n = s.textures.get(sk).frameTotal - 1, rate = a.frameRate * n / a.frames.length, repeat = a.repeat;
    s.anims.remove(k);
    s.anims.create({ key: k, frames: s.anims.generateFrameNumbers(sk, {}), frameRate: rate, repeat }).smSrc = tex;
  }
}
// 무기를 쥔 주인공(heroW) 걷기·숨쉬기의 8장 그림 키(없으면 null)
export const smoothHeld = (sc, key) => sc.textures?.exists('sm_' + key) ? 'sm_' + key : null;
