// NumiPaws static site build. Node >= 20, built-in modules only.
// Usage: node build.mjs   ->  writes dist/
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Build constants -------------------------------------------------------
const HEADLINE = 'a';        // 'a' | 'b'  hero.titleA / hero.titleB
const YOUTUBE_ID = '';       // empty = play button rendered disabled
const SITE = 'https://numipaws.com';
const APP  = 'https://app.numipaws.com/#/';
// ---------------------------------------------------------------------------

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const LANGS = ['en', 'ro'];
const LANG_INFO = {
  en: { name: 'English', code: 'EN', flag: 'gb', ogLocale: 'en_US' },
  ro: { name: 'Română', code: 'RO', flag: 'ro', ogLocale: 'ro_RO' },
};
// name: src/<name>.template.html; path: URL path under the language root.
const PAGES = [
  { name: 'index', path: '' },
  { name: 'privacy', path: 'privacy/' },
  { name: 'terms', path: 'terms/' },
];

const t0 = performance.now();
function fail(msg) { console.error('build failed: ' + msg); process.exit(1); }

// ---- Copy ------------------------------------------------------------------
const copy = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(join(ROOT, 'copy', l + '.json'), 'utf8'))]));

// Every language must have the same key tree and the same array lengths.
function shape(v, path, out) {
  if (Array.isArray(v)) { out.push(`${path}[${v.length}]`); v.forEach((x, i) => shape(x, `${path}.${i}`, out)); }
  else if (v && typeof v === 'object') { for (const k of Object.keys(v).sort()) shape(v[k], `${path}.${k}`, out); }
  else out.push(path);
  return out;
}
const base = new Set(shape(copy[LANGS[0]], '', []));
for (const l of LANGS.slice(1)) {
  const other = new Set(shape(copy[l], '', []));
  const onlyBase = [...base].filter(k => !other.has(k)), onlyOther = [...other].filter(k => !base.has(k));
  if (onlyBase.length || onlyOther.length) {
    fail(`copy key trees differ. Only in ${LANGS[0]}: ${onlyBase.join(', ') || '-'}. Only in ${l}: ${onlyOther.join(', ') || '-'}`);
  }
}
if (!YOUTUBE_ID && !copy.en.video.note) fail('video.note is required');

// ---- CSP for local testing: the _headers value as a meta tag, minus the two
//      directives that meta tags ignore --------------------------------------
const headers = readFileSync(join(ROOT, 'public', '_headers'), 'utf8');
const cspLine = headers.split('\n').find(l => l.trim().startsWith('Content-Security-Policy:'));
if (!cspLine) fail('public/_headers has no Content-Security-Policy line');
const cspMeta = cspLine.replace(/^\s*Content-Security-Policy:\s*/, '')
  .split(';').map(s => s.trim())
  .filter(s => s && !/^(frame-ancestors|upgrade-insecure-requests)\b/.test(s))
  .join('; ');

// ---- Template engine -------------------------------------------------------
// {{ path.to.key }}            escaped scalar; arrays indexed: games.list.3.name
// {{#if key}}...{{/if}}        block kept when key is truthy (non-empty)
// {{#unless key}}...{{/unless}} block kept when key is falsy
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function lookup(data, key, lang, where) {
  let v = data;
  for (const part of key.split('.')) {
    if (v == null || typeof v !== 'object' || !(part in v)) fail(`${where}: missing key "${key}" (${lang})`);
    v = v[part];
  }
  return v;
}

function render(tpl, data, lang, where) {
  tpl = tpl.replace(/\{\{#(if|unless)\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, kind, key, body) => {
    const v = lookup(data, key, lang, where);
    const truthy = Array.isArray(v) ? v.length > 0 : Boolean(v);
    return (kind === 'if') === truthy ? body : '';
  });
  const out = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = lookup(data, key, lang, where);
    if (v == null || v === '' || typeof v === 'object') fail(`${where}: key "${key}" is empty or not a string (${lang})`);
    return esc(v);
  });
  const left = out.match(/\{\{[^\n]{0,40}/);
  if (left) fail(`${where}: unresolved template syntax near "${left[0]}" (${lang})`);
  return out;
}

// ---- Render ----------------------------------------------------------------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const read = name => readFileSync(join(ROOT, 'src', `${name}.template.html`), 'utf8');
const templates = Object.fromEntries(PAGES.map(p => [p.name, read(p.name)]));

const langRoot = l => (l === 'en' ? '/' : `/${l}/`);
const pagePath = (l, p) => langRoot(l) + p.path;

let count = 0;
for (const lang of LANGS) {
  const otherLang = LANGS.find(l => l !== lang);
  const q = 'lang=' + lang;
  for (const page of PAGES) {
    const data = {
      ...copy[lang],
      site: {
        lang, otherLang,
        langName: LANG_INFO[lang].name, otherLangName: LANG_INFO[otherLang].name,
        langCode: LANG_INFO[lang].code, flag: LANG_INFO[lang].flag,
        enChecked: String(lang === 'en'), roChecked: String(lang === 'ro'),
        enPath: pagePath('en', page), roPath: pagePath('ro', page),
        otherHref: pagePath(otherLang, page),
        homeHref: langRoot(lang), privacyHref: langRoot(lang) + 'privacy/', termsHref: langRoot(lang) + 'terms/',
        enHref: SITE + pagePath('en', page), roHref: SITE + pagePath('ro', page),
        canonical: SITE + pagePath(lang, page),
        ogImage: SITE + '/assets/og.png', ogLocale: LANG_INFO[lang].ogLocale,
        youtubeId: YOUTUBE_ID,
        headline: HEADLINE === 'b' ? copy[lang].hero.titleB : copy[lang].hero.titleA,
        cspMeta, page: page.name,
      },
      links: {
        login: APP + 'login?' + q,
        parent: APP + 'signup?role=parent&' + q,
        teacher: APP + 'signup?role=teacher&' + q,
      },
    };
    const html = render(templates[page.name], data, lang, `src/${page.name}.template.html`);
    const outDir = join(DIST, lang === 'en' ? '' : lang, page.path);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html);
    count++;
  }
}

// 404: one page, both languages linked.
{
  const data = { en: copy.en, ro: copy.ro, site: { cspMeta, ogImage: SITE + '/assets/og.png' } };
  writeFileSync(join(DIST, '404.html'), render(read('404'), data, 'en+ro', 'src/404.template.html'));
  count++;
}

// Static files.
cpSync(join(ROOT, 'public'), DIST, { recursive: true });
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
for (const f of ['styles.css', 'site.js']) cpSync(join(ROOT, 'src', f), join(DIST, f));

// Every same-origin asset reference in the output must exist.
const missing = new Set();
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html') || e.name.endsWith('.css')) {
      const text = readFileSync(p, 'utf8');
      for (const m of text.matchAll(/(?:src|href|srcset)="(\/(?:assets|favicon)[^"\s]*)"|url\((\/assets\/[^)]+)\)/g)) {
        const ref = m[1] || m[2];
        if (!existsSync(join(DIST, ref))) missing.add(ref);
      }
    }
  }
})(DIST);
if (missing.size) console.warn('warning: referenced files not found in dist/: ' + [...missing].join(', '));

console.log(`built ${count} pages into dist/ in ${Math.round(performance.now() - t0)} ms`);
