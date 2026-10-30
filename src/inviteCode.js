// 기기 식별값 -> 초대 코드(8자). 브라우저·Phaser에 기대지 않아 node에서 시험한다
// 서버 server/invite-worker/src/code.js와 같은 식이어야 한다(tools/invite_curl_test.mjs가 둘을 맞춰 본다)
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function cyrb53(s, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}
export function inviteCodeOf(device) {
  const [a, b] = cyrb53('forge-invite:' + device, 7);
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHA[(a >>> (i * 5)) & 31];
  for (let i = 0; i < 4; i++) out += ALPHA[(b >>> (i * 5)) & 31];
  return out;
}
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
