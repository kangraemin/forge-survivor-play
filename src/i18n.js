// 다국어: 키 기반 사전 t('키', {변수}). 언어는 모듈이 불릴 때 정해지고(저장된 선택 → 주소의 ?lang= → 기기 언어),
// 사전은 최상위 await로 먼저 읽어 와서 data.js 같은 표에서도 바로 t()를 쓸 수 있다. 언어를 바꾸면 페이지를 다시 연다.
export const LANGS = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'pt-BR', 'de', 'fr', 'ru', 'id', 'th', 'vi', 'tr'];
// 언어 이름은 그 언어의 글씨로(번역하지 않는다)
export const LANG_NAME = { ko: '한국어', en: 'English', ja: '日本語', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', es: 'Español', 'pt-BR': 'Português (BR)', de: 'Deutsch', fr: 'Français', ru: 'Русский', id: 'Indonesia', th: 'ไทย', vi: 'Tiếng Việt', tr: 'Türkçe' };
export const LS_KEY = 'forge-survivor-lang';
const IS_NODE = typeof window === 'undefined';

const norm = s => {
  s = String(s || '').toLowerCase();
  if (/^zh[-_](tw|hk|mo|hant)/.test(s)) return 'zh-Hant';
  if (s.startsWith('zh')) return 'zh-Hans';
  if (s.startsWith('pt')) return 'pt-BR';
  if (s === 'in' || s.startsWith('id')) return 'id';
  const b = s.split(/[-_]/)[0];
  return LANGS.includes(b) ? b : '';
};
function detect() {
  if (IS_NODE) return process.env.GAME_LANG || 'ko';
  try { const q = norm(new URLSearchParams(location.search).get('lang')); if (q) return q; } catch { /* 주소 없음 */ }
  try { const s = localStorage.getItem(LS_KEY); if (s && LANGS.includes(s)) return s; } catch { /* 저장소 막힘 */ }
  for (const l of navigator.languages || [navigator.language]) { const n = norm(l); if (n) return n; }
  return 'en';
}
export const lang = detect();

async function loadJson(name) {
  const u = new URL(`./i18n/${name}.json`, import.meta.url);
  if (IS_NODE) { const fs = await import('node:fs'); return JSON.parse(fs.readFileSync(u, 'utf8')); }
  const r = await fetch(u); if (!r.ok) throw new Error('i18n ' + name);
  return r.json();
}
const KO = await loadJson('ko');
let DICT = KO;
if (lang !== 'ko') { try { DICT = { ...KO, ...(await loadJson(lang)) }; } catch { DICT = KO; } }   // 사전을 못 읽으면 한국어로

// 글꼴: 기본 Galmuri(한글·라틴)에 없는 글자는 무료(OFL) 글꼴을 이 언어일 때만 받아서 같은 이름(G11·G9)으로 덮는다
async function loadFonts() {
  if (IS_NODE || lang === 'ko') return;
  const px = { ja: 'ja', 'zh-Hans': 'zh_hans', 'zh-Hant': 'zh_hant', ru: 'latin', vi: 'latin', tr: 'latin' }[lang];
  const jobs = [];
  const add = async (file, opts) => {
    try {
      const buf = await (await fetch(new URL('../fonts/' + file, import.meta.url))).arrayBuffer();
      for (const fam of ['G11', 'G9']) { const ff = new FontFace(fam, buf.slice(0), opts); await ff.load(); document.fonts.add(ff); }
    } catch { /* 글꼴을 못 받아도 기본 글꼴로 */ }
  };
  if (px) jobs.push(add(`fusion-pixel-12px-proportional-${px}.otf.woff2`));
  if (lang === 'th') jobs.push(add('NotoSansThai-subset.woff2', { unicodeRange: 'U+0E00-0E7F' }));
  await Promise.all(jobs);
}
await loadFonts();
if (!IS_NODE) { document.documentElement.lang = lang; const ti = KO['app.title'] && (DICT['app.title'] || KO['app.title']); if (ti) document.title = ti; }

// 문장 안 {이름}을 vars 값으로 바꾼다. 키가 없으면 한국어, 그것도 없으면 키 자체
export function t(key, vars) {
  let s = DICT[key] ?? KO[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
// 언어를 바꾸고 다시 연다(표·창 글자가 처음 만들어질 때 정해지므로)
export const tt = t;
export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  try { localStorage.setItem(LS_KEY, l); } catch { /* 저장소 막힘 */ }
  location.reload();
}
export const isCJK = lang === 'ja' || lang.startsWith('zh');
