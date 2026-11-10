// Makes assets/city-light.webp and assets/city-dark.webp: the still picture of the city behind the notes pages.
// Serve the repo first (python3 -m http.server 8765), then:  node tools/make-note-backdrops.js
// It opens the home page, hides everything except the WebGL canvas, takes a 1600x1000 frame per theme, blurs it a little
// (Pillow) and writes WebP. Needs playwright (preinstalled in Claude Code cloud sessions) and Python with Pillow.
const { chromium } = require('playwright'); const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const root = path.resolve(__dirname, '..'); const base = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-'));
  for (const th of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    await p.goto(base); await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), th); await p.waitForTimeout(4500);
    await p.addStyleTag({ content: 'body>*:not(#gl){display:none!important} html.gl body{overflow:hidden}' }); await p.waitForTimeout(800);
    const png = path.join(tmp, th + '.png'); await p.screenshot({ path: png }); await p.close();
    execFileSync('python3', ['-I', '-c', 'import sys;from PIL import Image,ImageFilter;Image.open(sys.argv[1]).convert("RGB").filter(ImageFilter.GaussianBlur(2.2)).save(sys.argv[2],"WEBP",quality=62,method=6)', png, path.join(root, 'assets', 'city-' + th + '.webp')]);
    console.log('wrote assets/city-' + th + '.webp');
  }
  await b.close();
})();
