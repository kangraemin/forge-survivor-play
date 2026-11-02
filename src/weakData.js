// 68차: 보스 약점 표만 따로 둔다. bossWeak.js는 화면 코드(ui·sfx)를 불러서 도감(codex.js)·시뮬이 그대로 import하면 document가 없다고 멈춘다
// 보스 key → 약점 종류
export const WEAK = {
  kingslime: 'armor',
  lavagolem: 'armor',
  wyrm: 'swift', glacierbear: 'armor',
  demonlord: 'guard', executioner: 'thorn',
  tidewyrm: 'ward', coralcrab: 'armor',
  swampqueen: 'thorn', bogtoad: 'swift',
  crystcolossus: 'mirror', crystscorp: 'armor',
  stormcaptain: 'swift', griffin: 'ward',
  voidlord: 'guard', voideye: 'mirror',
  sandcolossus: 'armor', sandmummy: 'guard',
  steamgeneral: 'armor', steamspider: 'guard',
  thunderdragon: 'swift', thunderbird: 'mirror',
  mirrorlord: 'guard', harlequin: 'mirror',
  forgegod: 'armor', anviltortoise: 'thorn',
  frostking: 'swift', frostknight: 'armor',
  skywhale: 'swift', skypirate: 'thorn',
  clockwarden: 'ward', clockdancer: 'swift',
  bonedragon: 'armor', boneknight: 'ward',
  blackking: 'armor', royalguard: 'mirror',
};
