// 게임 시작점: 270x480 세로 화면, 픽셀아트, 화면에 맞춰 늘림
import { W, H } from './data.js';
import { Boot } from './Boot.js';
import { Lobby } from './Lobby.js';
import { Battle } from './Battle.js';

const start = () => {
  window.game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: W, height: H,
    backgroundColor: '#0d0a14',
    pixelArt: true, roundPixels: true,
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [Boot, Lobby, Battle],
  });
};
// 픽셀 글꼴을 먼저 받아야 첫 화면 글자가 기본 글꼴로 안 나온다
Promise.all(['G11', 'G9'].map(f => document.fonts.load(`12px ${f}`))).catch(() => {}).finally(start);
