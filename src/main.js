// 게임 시작점: 270x480 세로 화면, 픽셀아트, 화면에 맞춰 늘림
// 그리는 판은 기기 픽셀에 맞춘 PX배로 두고 카메라를 PX배로 당긴다: 좌표는 그대로 270x480
import { portalReady } from './platform/index.js';   // 포털판(CrazyGames·itch) 깃발: 다른 모듈보다 먼저
import './log.js';
import { W, H, GW, OFF, WIDE } from './data.js';
import { PX } from './ui.js';
import { installTextFit } from './textfit.js';
import { installPcInput } from './pcInput.js';
import { Boot, buildAnims } from './Boot.js';
import { installLazy } from './lazy.js';
import { Lobby } from './Lobby.js';
import { Battle } from './Battle.js';
import { Prologue } from './Prologue.js';
import { load } from './save.js';
import { captureRef, deviceId } from './share.js';
import { initSafeArea } from './safeArea.js';
import { earlyBgm, setMusicLevel } from './sfx.js';

// 로딩 화면부터 로비 곡을 튼다(음악을 꺼 둔 저장값이면 틀지 않는다). 로비가 같은 요소를 이어 쓴다
try { const s0 = load(); setMusicLevel(s0.musicLvl); earlyBgm(!s0.musicOff && s0.sound !== false); } catch { /* 저장소 문제는 게임을 막지 않는다 */ }

installLazy(Battle, Lobby, buildAnims);   // 첫 화면 밖 그림은 뒤에서 받고, 화면 시작 직전에 필요한 것만 기다린다
const start = () => {
  initSafeArea();
  window.__wideCol = { off: OFF / GW, w: W / GW };   // 넓은 화면에서 가운데 열(기본 판)의 위치(platform/desktop.js가 옆 패널을 놓는 데 쓴다)
  // 초대 링크(?ref=)는 첫 실행 때 한 번만 저장한다. 기기 식별값도 미리 받아 둔다(공유 버튼이 바로 열리게)
  try { captureRef(load()); } catch { /* 저장소 문제는 게임을 막지 않는다 */ }
  deviceId().catch(() => {});
  window.game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: GW * PX, height: H * PX,
    backgroundColor: '#0d0a14', transparent: WIDE,   // 넓은 화면은 캔버스가 창 전폭이라 양옆은 비워 두어 배경(#sidebg)이 보이게 한다
   
    pixelArt: true, roundPixels: true,
    // 아이폰 사파리에서 여러 텍스처를 한 번에 그리면 다른 그림이 섞여 나온다(화덕 빛이 불기둥으로 보임). 한 장씩 그린다
    render: { maxTextures: 1 },
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [Boot, Lobby, Battle, Prologue],
  });
  installPcInput(window.game);   // PC 키보드·마우스 보조(폰·토스에서는 아무것도 안 한다)
  installTextFit(window.game);   // 긴 번역 글자를 상자 안에 맞춘다(한국어는 아무 일도 안 한다)
  // 판이 화면보다 조금 크면 줄일 때 픽셀이 빠져 글자가 깨진다: 줄일 때는 매끄럽게
  const smooth = () => window.game.canvas && (window.game.canvas.style.imageRendering = 'auto');
  smooth(); window.game.events.once('ready', smooth);
  // 주소창이 접히거나 펴지면 보이는 영역이 바뀐다: 다시 맞춘다
  window.visualViewport?.addEventListener('resize', () => window.game.scale.refresh());
};
// 픽셀 글꼴을 먼저 받아야 첫 화면 글자가 기본 글꼴로 안 나온다
Promise.all(['G11', 'G9'].map(f => document.fonts.load(`12px ${f}`))).catch(() => {}).then(() => portalReady()).catch(() => {}).finally(start);
