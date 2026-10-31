// 포털판 어댑터 선택. index.html에 빌드(tools/build_portal.mjs)가 window.__FORGE_PORTAL = 'crazygames' | 'itch' 를 넣는다
// 아무것도 안 넣으면(웹·토스) 이 파일은 아무 일도 하지 않는다. main.js 맨 위에서 가져와 다른 모듈보다 먼저 깃발을 건다
import { install as installCrazy, init as initCrazy } from './crazygames.js';
import { install as installItch } from './itch.js';
import { installDesktop } from './desktop.js';

const which = typeof window !== 'undefined' ? window.__FORGE_PORTAL : '';
if (which === 'crazygames') installCrazy();
else if (which === 'itch') installItch();
const fineWide = () => { try { return innerHeight / innerWidth < 1.15 && matchMedia('(pointer:fine)').matches; } catch { return false; } };   // 64차: 웹(GitHub Pages)도 PC 가로 창이면 같은 배경·안내를 쓴다
if (which === 'crazygames' || which === 'itch' || fineWide()) { const go = () => installDesktop(); document.body ? go() : addEventListener('DOMContentLoaded', go); }   // 55차: 가로로 넓은 창의 좌우 배경·키보드 안내(모바일·토스판은 이 길을 안 탄다)

// Phaser를 띄우기 전에 기다릴 일(SDK 초기화 + 저장소 연결). 포털이 아니면 바로 끝난다
export const portalReady = () => (which === 'crazygames' ? initCrazy() : Promise.resolve());
