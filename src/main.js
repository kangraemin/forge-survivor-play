// 게임 시작점: 270x480 세로 화면, 픽셀아트, 화면에 맞춰 늘림
// 그리는 판은 두 배(540x960)로 두고 카메라를 2배로 당긴다: 좌표는 그대로 270x480이지만 움직임이 반 픽셀 단위로 매끄러워진다
import { W, H } from './data.js';
import { PX } from './ui.js';
import { Boot } from './Boot.js';
import { Lobby } from './Lobby.js';
import { Battle } from './Battle.js';

const start = () => {
  window.game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: W * PX, height: H * PX,
    backgroundColor: '#0d0a14',
    pixelArt: true, roundPixels: true,
    // 아이폰 사파리에서 여러 텍스처를 한 번에 그리면 다른 그림이 섞여 나온다(화덕 빛이 불기둥으로 보임). 한 장씩 그린다
    render: { maxTextures: 1 },
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [Boot, Lobby, Battle],
  });
};
// 픽셀 글꼴을 먼저 받아야 첫 화면 글자가 기본 글꼴로 안 나온다
Promise.all(['G11', 'G9'].map(f => document.fonts.load(`12px ${f}`))).catch(() => {}).finally(start);
