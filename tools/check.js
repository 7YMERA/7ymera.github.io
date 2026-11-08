// Smoke test for every page. Serve the repo first: python3 -m http.server 8765
// Usage: node tools/check.js [baseUrl]   (default http://localhost:8765/)
// Reports page errors, 4xx/5xx responses, broken images and sideways scroll
// at desktop (1300, light) and phone (390, dark) sizes. Exit code 1 on any problem.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const root = path.join(__dirname, '..');
const pages = [''].concat(fs.readdirSync(path.join(root, 'notes')).filter(f => f.endsWith('.html')).map(f => 'notes/' + f));
(async () => {
  const b = await chromium.launch(); let bad = 0;
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
  await b.close(); process.exit(bad ? 1 : 0);
})();
