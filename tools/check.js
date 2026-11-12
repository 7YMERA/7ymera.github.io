// Smoke test for every page. Serve the repo first: python3 -m http.server 8765
// Usage: node tools/check.js [baseUrl] [--static]   (default http://localhost:8765/)
//   default   static quality pass (once per page) + site-level pass + browser pass
//   --static  only the static passes: fast, needs no server
//   --root=DIR  check a copy of the site in DIR instead of the repo (used to test the rules)
// Browser pass: page errors, 4xx/5xx responses, broken images and sideways scroll
// at desktop (1300, light) and phone (390, dark) sizes. Exit code 1 on any problem.
//
// ADDING A STATIC RULE: add one entry to PAGE_RULES (per page) or SITE_RULES (whole site).
// A rule is { name, run } where run returns an array of problems; each problem is a string,
// or [message, needle] where needle is source text used to find the line number.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const staticOnly = args.includes('--static');
const base = args.find(a => !a.startsWith('--')) || 'http://localhost:8765/';
const rootArg = args.find(a => a.startsWith('--root='));
const root = rootArg ? path.resolve(rootArg.slice(7)) : path.join(__dirname, '..');
const ORIGIN = 'https://7ymera.github.io';
const pages = ['', 'flight/', '404.html'].concat(fs.readdirSync(path.join(root, 'notes')).filter(f => f.endsWith('.html')).map(f => 'notes/' + f));

// ---------- helpers ----------
const fileOf = u => (u === '' || u.endsWith('/')) ? u + 'index.html' : u;       // 'notes/' -> 'notes/index.html'
const urlPathOf = u => '/' + (fileOf(u).replace(/(^|\/)index\.html$/, '$1'));    // file -> canonical URL path
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const exists = f => { try { return fs.statSync(path.join(root, f)).isFile(); } catch (e) { return false; } };
const isExternal = s => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(s);                     // http:, mailto:, data:, //cdn ...
const esc = s => String(s).replace(/&/g, '&amp;');                                  // attribute text as written in source
function lineOf(src, needle) { const i = needle ? src.indexOf(needle) : -1; return i < 0 ? 0 : src.slice(0, i).split('\n').length; }
/** Resolve a local href/src found on page `u` to { file, frag } or null when it is external/empty. */
function resolveLocal(u, ref) {
  if (!ref || isExternal(ref)) return null;
  const url = new URL(ref, 'http://local/' + fileOf(u));
  let p = decodeURIComponent(url.pathname).slice(1);
  if (p === '' || p.endsWith('/')) p += 'index.html';
  else if (!exists(p) && exists(p + '/index.html')) p += '/index.html';
  return { file: p, frag: decodeURIComponent(url.hash.slice(1)), query: url.search };
}

// ---------- in-page fact collection ----------
// Runs inside Chromium on an inert DOMParser document (no scripts run, no network), so it reads the file as written.
function collectFacts(src) {
  const doc = new DOMParser().parseFromString(src, 'text/html');
  const text = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const nameOf = el => {
    if ((el.getAttribute('aria-label') || '').trim()) return true;
    const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    if (by.some(id => { const t = doc.getElementById(id); return t && text(t); })) return true;
    if (text(el)) return true;
    if ([...el.querySelectorAll('img[alt]')].some(i => i.getAttribute('alt').trim())) return true;
    if ([...el.querySelectorAll('svg title')].some(t => text(t))) return true;
    return !!(el.getAttribute('title') || '').trim();
  };
  const refAttrs = { a: 'href', link: 'href', script: 'src', img: 'src', source: 'src', iframe: 'src', video: 'src', audio: 'src' };
  const refs = [];
  for (const [tag, attr] of Object.entries(refAttrs)) for (const el of doc.querySelectorAll(tag + '[' + attr + ']'))
    refs.push({ tag, attr, url: el.getAttribute(attr), rel: el.getAttribute('rel') || '' });
  return {
    titles: [...doc.head.querySelectorAll('title')].map(text),   // head only: inline SVG <title> is an accessible name, not a page title,
    descriptions: [...doc.querySelectorAll('meta[name=description]')].map(m => (m.getAttribute('content') || '').trim()),
    robots: (doc.querySelector('meta[name=robots]') || { getAttribute: () => '' }).getAttribute('content') || '',
    canonicals: [...doc.querySelectorAll('link[rel=canonical]')].map(l => l.getAttribute('href') || ''),
    lang: doc.documentElement.getAttribute('lang'),
    headings: [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ level: +h.tagName[1], text: text(h).slice(0, 40) })),
    imgsNoAlt: [...doc.querySelectorAll('img:not([alt])')].map(i => i.getAttribute('src') || '(no src)'),
    unnamed: [...doc.querySelectorAll('button, a[href], [role=button]')].filter(e => !nameOf(e))
      .map(e => ({ tag: e.tagName.toLowerCase(), needle: e.getAttribute('href') || e.id || e.getAttribute('class') || '' })),
    ids: [...doc.querySelectorAll('[id]')].map(e => e.id),
    ldjson: [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
    refs,
  };
}
// Parse an XML file in the browser; returns { error, locs } (locs = every URL the file lists).
function parseXml(src) {
  const d = new DOMParser().parseFromString(src, 'application/xml');
  const err = d.querySelector('parsererror');
  if (err) return { error: (err.textContent || 'parse error').split('\n')[0].slice(0, 120), locs: [] };
  const locs = [...d.querySelectorAll('url > loc, item > link, channel > link')].filter(e => e.tagName === 'loc' || e.tagName === 'link').map(e => e.textContent.trim());
  const self = [...d.getElementsByTagName('atom:link')].map(e => e.getAttribute('href'));
  return { error: '', locs: locs.concat(self) };
}

// ---------- per-page rules: (facts, ctx) => problems ----------
// ctx = { u, src, file, noindex, factsOf(file) } ; `all` is filled for cross-page rules below
const PAGE_RULES = [
  { name: 'title', run: f => f.titles.length !== 1 ? [`${f.titles.length} <title> elements (need exactly 1)`]
      : (f.titles[0].length < 10 || f.titles[0].length > 65) ? [`<title> is ${f.titles[0].length} chars (need 10-65): "${f.titles[0]}"`] : [] },
  { name: 'description', run: f => f.descriptions.length !== 1 ? [`${f.descriptions.length} meta descriptions (need exactly 1)`]
      : (f.descriptions[0].length < 50 || f.descriptions[0].length > 170) ? [`meta description is ${f.descriptions[0].length} chars (need 50-170)`] : [] },
  { name: 'canonical', run: (f, c) => {
      if (c.noindex) return [];
      if (f.canonicals.length !== 1) return [`${f.canonicals.length} canonical links (need exactly 1)`];
      let p; try { p = new URL(f.canonicals[0]).pathname; } catch (e) { return [`canonical is not an absolute URL: ${f.canonicals[0]}`]; }
      return p === urlPathOf(c.u) ? [] : [[`canonical path ${p} does not match file (expected ${urlPathOf(c.u)})`, f.canonicals[0]]];
  } },
  { name: 'h1', run: f => { const n = f.headings.filter(h => h.level === 1).length; return n === 1 ? [] : [`${n} <h1> elements (need exactly 1)`]; } },
  { name: 'heading-levels', run: f => f.headings.flatMap((h, i) => i && h.level - f.headings[i - 1].level > 1
      ? [[`heading skips a level: h${f.headings[i - 1].level} -> h${h.level} "${h.text}"`, h.text]] : []) },
  { name: 'lang', run: f => f.lang ? [] : ['<html> has no lang attribute'] },
  { name: 'img-alt', run: f => f.imgsNoAlt.map(s => [`<img> without alt attribute: ${s}`, s]) },
  { name: 'accessible-name', run: f => f.unnamed.map(e => [`<${e.tag}> has no accessible name (${e.needle || 'no id/class/href'})`, e.needle]) },
  { name: 'duplicate-ids', run: f => [...new Set(f.ids.filter((id, i) => f.ids.indexOf(id) !== i))].map(id => [`duplicate id "${id}"`, `id="${id}"`]) },
  { name: 'json-ld', run: f => f.ldjson.flatMap((t, i) => { try { JSON.parse(t); return []; } catch (e) { return [[`ld+json block #${i + 1} is not valid JSON: ${e.message}`, 'application/ld+json']]; } }) },
  { name: 'local-links', run: (f, c) => f.refs.flatMap(r => {
      const t = resolveLocal(c.u, r.url); if (!t) return [];
      const where = `${r.tag} ${r.attr}="${r.url}"`;
      if (!exists(t.file)) return [[`dead local ${where}: ${t.file} not found`, esc(r.url)]];
      if (t.frag && /\.html$/.test(t.file) && !c.factsOf(t.file).ids.includes(t.frag)) return [[`dead fragment ${where}: no id "${t.frag}" in ${t.file}`, esc(r.url)]];
      return [];
  }) },
  { name: 'cache-key', run: (f, c) => f.refs.flatMap(r => {
      if (!(r.tag === 'script' || (r.tag === 'link' && /stylesheet/i.test(r.rel)))) return [];
      const t = resolveLocal(c.u, r.url); if (!t) return [];
      c.keys.add((/[?&]v=([^&]+)/.exec(t.query) || [])[1] || '');
      return /[?&]v=[^&]+/.test(t.query) ? [] : [[`local ${r.tag} ${r.url} has no ?v= cache key`, esc(r.url)]];
  }) },
];

// ---------- site-level rules: (site) => problems ----------
// site = { pageInfo: [{u, noindex}], keys: Set, xml: {file: {error, locs}} }
const urlToFile = loc => { try { const x = new URL(loc); if (x.origin !== ORIGIN) return null; let p = decodeURIComponent(x.pathname).slice(1); return (p === '' || p.endsWith('/')) ? p + 'index.html' : p; } catch (e) { return null; } };
const SITE_RULES = [
  { name: 'cache-key-agreement', run: s => { const v = [...s.keys].filter(Boolean); return v.length > 1 ? [`pages disagree on the ?v= key, distinct values: ${v.sort().join(', ')}`] : []; } },
  ...['sitemap.xml', 'feed.xml'].flatMap(file => [
    { name: file + ' parses', run: s => !exists(file) ? [`${file} is missing`] : s.xml[file].error ? [`${file} does not parse: ${s.xml[file].error}`] : [] },
    { name: file + ' urls', run: s => !exists(file) ? [] : s.xml[file].locs.flatMap(l => {
        const f = urlToFile(l); if (f === null) return [`${file}: ${l} is not on ${ORIGIN}`];
        return exists(f) ? [] : [`${file}: ${l} has no file (${f})`]; }) },
  ]),
  { name: 'sitemap-coverage', run: s => {
      const listed = new Set((s.xml['sitemap.xml'] || { locs: [] }).locs.map(urlToFile));
      return s.pageInfo.filter(p => !p.noindex && !listed.has(fileOf(p.u))).map(p => `indexable page ${fileOf(p.u)} is not in sitemap.xml`); } },
  { name: 'robots', run: () => !exists('robots.txt') ? ['robots.txt is missing']
      : read('robots.txt').split('\n').some(l => /^sitemap:\s*https:\/\/7ymera\.github\.io\/sitemap\.xml\s*$/i.test(l)) ? [] : [`robots.txt has no "Sitemap: ${ORIGIN}/sitemap.xml" line`] },
  { name: '404', run: () => {
      if (!exists('404.html')) return ['404.html is missing'];
      const src = read('404.html'), bad = [];
      for (const m of src.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/gi)) if (!isExternal(m[1]) && !m[1].startsWith('/')) bad.push(`404.html: local URL "${m[1]}" is not root-absolute (line ${lineOf(src, m[0])})`);
      return bad; } },
  { name: 'manifest-and-icons', run: () => {
      if (!exists('site.webmanifest')) return [];
      try { return (JSON.parse(read('site.webmanifest')).icons || []).filter(i => !exists(i.src.replace(/^\//, ''))).map(i => `site.webmanifest icon ${i.src} not found`); }
      catch (e) { return ['site.webmanifest is not valid JSON']; } } },
];

// ---------- runners ----------
async function staticPass(b) {
  const pg = await b.newPage(); await pg.setContent('<!doctype html><title>x</title>');
  const cache = {};
  const factsOf = async f => cache[f] || (cache[f] = await pg.evaluate(collectFacts, read(f)));
  // Pre-collect facts for every page so rules can stay synchronous.
  for (const u of pages) await factsOf(fileOf(u));
  for (const f of new Set(pages.flatMap(u => cache[fileOf(u)].refs.map(r => (resolveLocal(u, r.url) || {}).file)).filter(f => f && /\.html$/.test(f) && exists(f)))) await factsOf(f);
  const sync = f => cache[f];
  const site = { pageInfo: [], keys: new Set(), xml: {} };
  let bad = 0;
  for (const u of pages) {
    const file = fileOf(u), src = read(file), f = cache[file], noindex = /noindex/i.test(f.robots);
    site.pageInfo.push({ u, noindex });
    const ctx = { u, src, file, noindex, factsOf: sync, keys: site.keys };
    const errs = PAGE_RULES.flatMap(r => r.run(f, ctx).map(p => {
      const [msg, needle] = Array.isArray(p) ? p : [p]; const ln = lineOf(src, needle);
      return `[${r.name}] ${msg}${ln ? ` (${file}:${ln})` : ` (${file})`}`; }));
    console.log((errs.length ? 'FAIL ' : 'ok   ') + 'static ' + (u || 'index.html') + (errs.length ? '\n     ' + errs.join('\n     ') : ''));
    bad += errs.length;
  }
  for (const file of ['sitemap.xml', 'feed.xml']) site.xml[file] = exists(file) ? await pg.evaluate(parseXml, read(file)) : { error: 'missing', locs: [] };
  const errs = SITE_RULES.flatMap(r => r.run(site).map(m => `[${r.name}] ${m}`));
  console.log((errs.length ? 'FAIL ' : 'ok   ') + 'static site-level' + (errs.length ? '\n     ' + errs.join('\n     ') : ''));
  await pg.close();
  return bad + errs.length;
}

async function browserPass(b) {
  let bad = 0;
  for (const [w, h, theme] of [[1300, 900, 'light'], [390, 844, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    for (const u of pages) {
      const p = await ctx.newPage(), errs = [];
      p.on('pageerror', e => errs.push('JS: ' + e.message));
      p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
      await p.goto(base + u, { waitUntil: 'networkidle' });
      await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      await p.evaluate(async () => { document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; }); await new Promise(r => setTimeout(r, 1200)); });
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth,
        broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')) }));
      if (r.sw > r.vw) errs.push(`sideways scroll: ${r.sw}px > ${r.vw}px`);
      r.broken.forEach(s => errs.push('broken image: ' + s));
      console.log((errs.length ? 'FAIL ' : 'ok   ') + w + ' ' + (u || 'index.html') + (errs.length ? '\n     ' + errs.join('\n     ') : ''));
      bad += errs.length; await p.close();
    }
    await ctx.close();
  }
  return bad;
}

(async () => {
  const b = await chromium.launch();
  let bad = await staticPass(b);
  if (!staticOnly) bad += await browserPass(b);
  await b.close(); process.exit(bad ? 1 : 0);
})();
