// 포털판 어댑터 선택. index.html에 빌드(tools/build_portal.mjs)가 window.__FORGE_PORTAL = 'crazygames' | 'itch' 를 넣는다
// 아무것도 안 넣으면(웹·토스) 이 파일은 아무 일도 하지 않는다. main.js 맨 위에서 가져와 다른 모듈보다 먼저 깃발을 건다
import { install as installCrazy, init as initCrazy } from './crazygames.js';
import { install as installItch } from './itch.js';

const which = typeof window !== 'undefined' ? window.__FORGE_PORTAL : '';
if (which === 'crazygames') installCrazy();
else if (which === 'itch') installItch();

// Phaser를 띄우기 전에 기다릴 일(SDK 초기화 + 저장소 연결). 포털이 아니면 바로 끝난다
export const portalReady = () => (which === 'crazygames' ? initCrazy() : Promise.resolve());
