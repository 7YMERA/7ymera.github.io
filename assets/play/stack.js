/* stack.js: SKYLINE STACK, a one-button tower stacker that climbs past the Kuala Lumpur skyline.
   Tap, Space, Enter or the A button to drop the sliding floor. Whatever overhangs is cut away and falls. Land it dead centre
   (a "perfect") and the floor keeps its width; chain perfects and the tower grows wider again. The backdrop is the real skyline
   at the real heights (one floor = 14 m): out-build Menara TM, KL Tower, Exchange 106, Petronas and finally Merdeka 118.
   Plain canvas 2D, no libraries. Colours come from the page's CSS tokens, so both themes work. Sound goes through window.SFX
   (or the older window.__sfx) and is skipped silently when it is missing or off. Mounts only where #stk exists.
   Loop rules: it runs only while its view is open, on screen and the tab is visible. Reduced motion removes the shake,
   slow-motion, sway, particles and the attract-mode bot, and the game stays fully playable. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, wrap = d.getElementById('stk');
  if (!wrap) return;
  var cv = d.getElementById('stk-canvas'), ctx = cv.getContext('2d', { alpha: false });
  function $(id) { return d.getElementById(id); }
  var el = { floor: $('stk-floor'), metres: $('stk-metres'), combo: $('stk-combo'), next: $('stk-next'), bar: $('stk-bar'), best: $('stk-best'), pause: $('stk-pause'),
    banner: $('stk-banner'), card: $('stk-card'), title: $('stk-card-title'), text: $('stk-card-text'), chips: $('stk-chips'), go: $('stk-go'), hint: $('stk-hint'), live: $('stk-live') };
  var calmQ = matchMedia('(prefers-reduced-motion: reduce)');
  function calm() { return calmQ.matches; }

  /* ---------- constants (world units; one floor is 28 units tall and 14 m) ---------- */
  var VH = 720, FH = 28, BW = 200, M_PER = 14, PERFECT = 6, GROUND = 96;
  var LAND = [
    { id: 'tm', name: 'Menara TM', m: 310, f: .1 },
    { id: 'kl', name: 'KL Tower', m: 421, f: .9 },
    { id: 'ex', name: 'Exchange 106', m: 445, f: .24 },
    { id: 'pt', name: 'Petronas Towers', m: 452, f: .76 },
    { id: 'md', name: 'Merdeka 118', m: 678.9, f: .5 }
  ];
  var RANKS = [[0, 'Scaffolding'], [6, 'Shophouse'], [14, 'Mid-rise'], [23, 'Menara TM'], [31, 'KL Tower'], [33, 'Petronas'], [49, 'Merdeka 118']];
  var PENT = [523.25, 587.33, 659.26, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.3];

  /* ---------- tiny helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgb(c) {
    c = String(c || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (m) { var h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    m = /rgba?\(([^)]+)\)/.exec(c); if (m) { var p = m[1].split(','); return [+p[0], +p[1], +p[2]]; }
    return [128, 128, 128];
  }
  function mix(a, b, t) { var A = rgb(a), B = rgb(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; }
  function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
  function S() { return window.SFX || window.__sfx || null; }
  function snd(kind, a) {
    var s = S(); if (!s || !s.beep) return;
    try {
      if (kind === 'drop') s.beep(150, .13, 'triangle', .07, .5);
      else if (kind === 'perfect') { s.beep(PENT[Math.min(a, PENT.length - 1)], .2, 'sine', .08); s.beep(PENT[Math.min(a, PENT.length - 1)] * 2, .12, 'sine', .03); }
      else if (kind === 'land') { [0, 2, 4, 7].forEach(function (i, k) { setTimeout(function () { s.beep(PENT[i] * (k > 2 ? 1 : 1), .28, 'triangle', .07); }, k * 90); }); }
      else if (kind === 'over') { s.beep(240, .6, 'sawtooth', .05, .25); }
      else if (kind === 'best') { if (s.done) s.done(); }
      else if (kind === 'start') { s.beep(660, .08, 'square', .04); setTimeout(function () { s.beep(990, .1, 'square', .04); }, 70); }
    } catch (e) { /* sound is a bonus */ }
  }
  function buzz(ms) { try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(ms); } catch (e) { /* fine */ } }

  /* ---------- saved best ---------- */
  var KEY = 'play-best', best = 0;
  function readBest() { try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); best = +o.stack > 0 ? +o.stack : 0; } catch (e) { best = 0; } }
  function saveBest() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); o.stack = best; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
    try { d.dispatchEvent(new CustomEvent('play-best', { detail: { game: 'stack', best: best } })); } catch (e) { /* old browsers */ }
  }
  readBest();

  /* ---------- colours from the page tokens ---------- */
  var P = null, themeKey = '', skyGrad = null, vigGrad = null;
  function palette() {
    var cs = getComputedStyle(root);
    function g(n, f) { var v = cs.getPropertyValue(n).trim(); return v || f; }
    var bg = g('--bg', '#f3f6f6'), ink = g('--ink', '#0f1e24'), accent = g('--accent', '#0a6c74'), gold = g('--gold', '#a86d12'), soft = g('--accent-soft', '#ddeeee'), surface = g('--surface', '#fff'), muted = g('--muted', '#52636a'), line = g('--line', '#d6e0e2');
    var dark = (rgb(bg)[0] + rgb(bg)[1] + rgb(bg)[2]) / 3 < 110;
    P = { dark: dark, bg: bg, ink: ink, accent: accent, gold: gold, soft: soft, surface: surface, muted: muted, line: line };
    P.skyHi = dark ? mix(bg, '#000000', .6) : mix(bg, accent, .2);
    P.space = dark ? '#02060c' : mix(bg, accent, .55);
    P.far = dark ? mix(bg, accent, .16) : mix(bg, accent, .13);
    P.sil = dark ? mix(bg, accent, .22) : mix(bg, accent, .15);
    P.silHit = dark ? mix(bg, gold, .34) : mix(bg, gold, .3);
    P.body = []; for (var i = 0; i < 4; i++) P.body.push(dark ? mix(accent, bg, .5 - i * .1) : mix(accent, ink, i * .13));
    P.edge = dark ? mix(accent, '#ffffff', .35) : mix(accent, '#ffffff', .3);
    P.winOn = dark ? mix(gold, '#ffffff', .2) : mix(gold, '#ffffff', .35);
    P.winOff = dark ? mix(accent, bg, .72) : mix(accent, ink, .45);
    P.ground = dark ? mix(bg, '#000', .35) : mix(bg, ink, .08);
    P.text = ink; P.glow = dark ? accent : gold;
    skyGrad = null; vigGrad = null; themeKey = root.getAttribute('data-theme') || '';
  }

  /* ---------- sizing ---------- */
  var W = 0, H = 0, DPR = 1, sc = 1, VW = 400, quality = 1, slowN = 0, ema = 16;
  function resize() {
    var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2); if (w * h * DPR * DPR > 2.4e6) DPR = Math.max(1, Math.sqrt(2.4e6 / (w * h))); DPR = Math.max(.5, DPR * quality);
    W = Math.round(w * DPR); H = Math.round(h * DPR);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    sc = H / VH; VW = W / sc; skyGrad = null; vigGrad = null; initScenery();
    if (state !== 'playing' && !raf) draw();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap); else addEventListener('resize', resize);

  /* ---------- state ---------- */
  var state = 'ready', demo = true, active = false, raf = 0, last = 0, time = 0;
  var slabs, blk, combo, perfects, maxCombo, reached, lockUntil = 0, overT = 0, botTol = 4, restartAt = 0;
  var camY = 0, camX = 0, zoom = 1, zoomT = 1, shake = 0, punch = 0, ts = 1, tsT = 1, slowLeft = 0;
  var parts = [], debris = [], rings = [], floats = [], stars = [], clouds = [], blocks = [], nextTrain = 3, train = null;

  function initScenery() {
    stars = []; for (var i = 0; i < 80; i++) stars.push({ x: hash(i) * 1.1, y: hash(i + 99) * 1, r: .6 + hash(i + 7) * 1.4, p: hash(i + 31) * 6 });
    clouds = []; for (i = 0; i < 12; i++) clouds.push({ x: hash(i + 200) * 1.3 - .15, y: 500 + hash(i + 300) * 2600, w: 90 + hash(i + 400) * 140, v: 4 + hash(i + 500) * 8 });
    blocks = []; var x = -40; while (x < VW + 200) { var w = 38 + hash(x + 1) * 54; blocks.push({ x: x, w: w, h: 50 + hash(x + 5) * 190 }); x += w + 4 + hash(x + 9) * 12; }
  }

  function reset(asDemo) {
    slabs = [{ x: 0, w: BW, n: 0, seed: 1, sq: 0, flash: 0 }];
    combo = 0; perfects = 0; maxCombo = 0; reached = 0; camY = 0; camX = 0; zoom = 1; zoomT = 1; shake = 0; punch = 0; ts = 1; tsT = 1; slowLeft = 0;
    parts.length = 0; debris.length = 0; rings.length = 0; floats.length = 0; time = 0;
    demo = !!asDemo; spawn(); paintHud(true);
  }
  function top() { return slabs[slabs.length - 1]; }
  function range() { return Math.min(250, VW * .5); }
  function spawn() {
    var t = top(), n = t.n + 1, dir = n % 2 ? 1 : -1, R = range();
    blk = { x: t.x - dir * R, w: t.w, n: n, dir: dir, v: Math.min(150 + n * 5.5, 440), t: 0 };
    botTol = hash(n * 3.3 + time) < .14 ? 22 + hash(n) * 30 : 2 + hash(n * 7.7) * 7;
  }

  /* ---------- the drop ---------- */
  function drop() {
    if (!blk || blk.falling) return;
    var t = top(), dx = blk.x - t.x, ax = Math.abs(dx);
    if (ax >= t.w - .5) { miss(); return; }
    var topY = (t.n + 1) * FH;
    var perfect = ax <= PERFECT;
    var s;
    if (perfect) {
      combo++; perfects++; if (combo > maxCombo) maxCombo = combo;
      var nw = blk.w; if (combo >= 3 && nw < BW) nw = Math.min(BW, nw + 7);
      s = { x: t.x, w: nw, n: blk.n, seed: blk.n * 9.7 + 3, sq: 1, flash: 1 };
      burst(t.x, topY, nw, combo);
      if (!calm()) { shake = Math.max(shake, 2.2); tsT = .42; slowLeft = .2; }
      snd('perfect', combo - 1); buzz(8);
      floats.push({ t: combo > 1 ? 'PERFECT x' + combo : 'PERFECT', x: s.x, y: topY + 18, life: 1.1, max: 1.1, c: 'gold', s: 20 });
    } else {
      combo = 0;
      var l = Math.max(t.x - t.w / 2, blk.x - blk.w / 2), r = Math.min(t.x + t.w / 2, blk.x + blk.w / 2);
      s = { x: (l + r) / 2, w: r - l, n: blk.n, seed: blk.n * 9.7 + 3, sq: 1, flash: 0 };
      // the cut-off piece falls away on its own
      var cw = blk.w - s.w, cx = dx > 0 ? r + cw / 2 : l - cw / 2;
      debris.push({ x: cx, y: topY, w: cw, n: blk.n, vx: (dx > 0 ? 1 : -1) * (40 + ax * .8), vy: 0, rot: 0, vr: (dx > 0 ? 1 : -1) * (.5 + Math.random() * .9), a: 1, seed: blk.n });
      if (!calm()) shake = Math.max(shake, 3 + Math.min(6, cw * .05));
      snd('drop'); buzz(12);
      dust(s.x, topY, s.w, 6);
    }
    slabs.push(s);
    if (!demo) { paintHud(false); landmarkCheck(); }
    spawn();
  }

  function miss() {
    var t = top(), topY = (t.n + 1) * FH, dir = blk.x > t.x ? 1 : -1;
    debris.push({ x: blk.x, y: topY, w: blk.w, n: blk.n, vx: dir * 70, vy: 0, rot: 0, vr: dir * .9, a: 1, seed: blk.n });
    blk.falling = true; blk = null; combo = 0;
    if (!calm()) { shake = 12; tsT = .3; slowLeft = .75; }
    snd('over'); buzz(40);
    state = 'over'; overT = 0; zoomT = clamp((VH * .8) / (topY + 150), .34, 1); lockUntil = performance.now() + 650;
    if (demo) { restartAt = performance.now() + 1700; return; }
    var n = t.n, newBest = n > best;
    if (newBest) { best = n; saveBest(); }
    el.pause.hidden = true; paintHud(true);
    gameOverCard(n, newBest);
  }

  function rank(n) { var r = RANKS[0][1]; RANKS.forEach(function (x) { if (n >= x[0]) r = x[1]; }); return r; }
  function gameOverCard(n, newBest) {
    var m = Math.round(n * M_PER);
    setTimeout(function () {
      if (state !== 'over' || demo) return;
      el.card.dataset.mode = 'over'; el.card.hidden = false;
      el.title.textContent = newBest && n > 0 ? 'New best: ' + n + ' floors' : n + ' floors, ' + m + ' m';
      el.text.textContent = rank(n) + (perfects ? '. ' + perfects + ' perfect' + (perfects === 1 ? '' : 's') + ', best chain ' + maxCombo + '.' : '. Aim for the centre of the floor below.');
      el.chips.textContent = '';
      LAND.forEach(function (L) { if (m >= L.m) { var li = d.createElement('li'); li.textContent = L.name; el.chips.appendChild(li); } });
      el.go.textContent = 'Build again'; el.hint.textContent = 'Space, tap or A to go again';
      el.live.textContent = 'Game over. ' + n + ' floors, ' + m + ' metres. Best ' + best + '.';
      if (newBest && n > 0) snd('best');
      el.go.focus({ preventScroll: true });
    }, calm() ? 200 : 900);
  }

  function landmarkCheck() {
    var n = top().n, m = n * M_PER;
    while (reached < LAND.length && m >= LAND[reached].m) {
      var L = LAND[reached++]; banner(L);
      snd('land'); buzz(30);
      if (!calm()) { shake = Math.max(shake, 7); punch = 1; tsT = .3; slowLeft = Math.max(slowLeft, .55); confetti(L); }
      el.live.textContent = 'Reached ' + L.name + ', ' + L.m + ' metres.';
    }
  }
  var bannerT = 0;
  function banner(L) {
    el.banner.textContent = '';
    var b = d.createElement('b'); b.textContent = L.name; var s = d.createElement('span'); s.textContent = L.m + ' m beaten';
    el.banner.appendChild(b); el.banner.appendChild(s);
    el.banner.classList.remove('on'); void el.banner.offsetWidth; el.banner.classList.add('on');
    clearTimeout(bannerT); bannerT = setTimeout(function () { el.banner.classList.remove('on'); }, 2600);
  }

  /* ---------- effects ---------- */
  function addPart(p) { if (parts.length < 260) parts.push(p); }
  function burst(x, y, w, c) {
    if (calm()) return;
    rings.push({ x: x, y: y, r: w * .4, max: w * 1.1 + 40, life: .5, m: .5 });
    var n = Math.min(10 + c * 3, 30);
    for (var i = 0; i < n; i++) {
      var side = i % 2 ? 1 : -1, px = x + side * (w / 2) * Math.random();
      addPart({ x: px, y: y, vx: side * (30 + Math.random() * 170), vy: 90 + Math.random() * 300, life: .6 + Math.random() * .5, max: 1.1, s: 2 + Math.random() * 3, c: Math.random() < .6 ? 'gold' : 'edge', g: 700 });
    }
  }
  function dust(x, y, w, n) {
    if (calm()) return;
    for (var i = 0; i < n; i++) addPart({ x: x + (Math.random() - .5) * w, y: y, vx: (Math.random() - .5) * 90, vy: 30 + Math.random() * 90, life: .4 + Math.random() * .3, max: .7, s: 2 + Math.random() * 2, c: 'soft', g: 300 });
  }
  function confetti(L) {
    var y = (top().n + 1) * FH + 40, cols = ['gold', 'edge', 'ink', 'soft'];
    for (var i = 0; i < 46; i++) { var side = i % 2 ? 1 : -1; addPart({ x: camX + side * (VW * .42), y: y + Math.random() * 120, vx: -side * (60 + Math.random() * 260), vy: 220 + Math.random() * 360, life: 1.4 + Math.random(), max: 2.4, s: 3 + Math.random() * 4, c: cols[i % 4], g: 520, sq: true }); }
  }

  /* ---------- update ---------- */
  function update(rdt) {
    var calmNow = calm();
    // slow motion eases in and out of real time
    if (slowLeft > 0) { slowLeft -= rdt; if (slowLeft <= 0) tsT = 1; }
    ts += (tsT - ts) * Math.min(1, rdt * 14); var dt = rdt * ts; time += dt;
    // the sliding floor
    if (blk && (state === 'playing' || state === 'ready')) {
      var R = range(), cx = top().x; blk.t += dt;
      blk.x += blk.dir * blk.v * dt;
      if (blk.x > cx + R) { blk.x = cx + R; blk.dir = -1; } else if (blk.x < cx - R) { blk.x = cx - R; blk.dir = 1; }
      if (demo && !calmNow && state === 'ready' && Math.abs(blk.x - top().x) <= botTol && blk.t > .25) drop();
    }
    if (state === 'over' && demo && performance.now() > restartAt) reset(true), state = 'ready';
    // camera
    var t = top(), topY = (t.n + 1) * FH, goal = state === 'over' && zoomT < 1 ? 0 : Math.max(0, topY - 190 / Math.max(zoom, .5));
    camY += (goal - camY) * Math.min(1, rdt * 3.4); camX += (t.x - camX) * Math.min(1, rdt * 2.6);
    zoom += (zoomT - zoom) * Math.min(1, rdt * (state === 'over' ? 1.6 : 4)); punch = Math.max(0, punch - rdt * 2.4);
    shake = Math.max(0, shake - rdt * 24);
    // squash and glow settle
    slabs.forEach(function (s) { if (s.sq > 0) s.sq = Math.max(0, s.sq - rdt * 4); if (s.flash > 0) s.flash = Math.max(0, s.flash - rdt * 1.7); });
    // loose pieces
    for (var i = debris.length - 1; i >= 0; i--) { var p = debris[i]; p.vy += 1500 * dt; p.y -= p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt; p.a -= dt * .5; if (p.a <= 0 || p.y < camY - 600) debris.splice(i, 1); }
    for (i = parts.length - 1; i >= 0; i--) { p = parts[i]; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); }
    for (i = rings.length - 1; i >= 0; i--) { p = rings[i]; p.life -= dt; p.r += (p.max - p.r) * Math.min(1, dt * 9); if (p.life <= 0) rings.splice(i, 1); }
    for (i = floats.length - 1; i >= 0; i--) { p = floats[i]; p.life -= dt; p.y += 46 * dt; if (p.life <= 0) floats.splice(i, 1); }
    // the passing train at street level
    nextTrain -= rdt; if (nextTrain <= 0 && !train) { train = { x: -260, v: 190 }; nextTrain = 9 + Math.random() * 6; }
    if (train) { train.x += train.v * rdt; if (train.x > VW + 300) train = null; }
  }

  /* ---------- drawing ---------- */
  function sy(wy) { return VH - GROUND - (wy - camY); }
  function rect(x, y, w, h) { ctx.fillRect(x, y, w, h); }

  function skyline(kind, cx, base, h, col, k) {
    // silhouettes drawn upward from `base` (screen y of the ground) to height h
    var u = h; ctx.fillStyle = col; ctx.beginPath();
    var ws = Math.min(1, VW / 640);
    if (kind === 'pt') {
      var a = u * .1 * ws + 0, gap = u * .03 * ws; [-1, 1].forEach(function (s) {
        var x0 = cx + s * (a / 2 + gap / 2);
        ctx.moveTo(x0 - a / 2, base); ctx.lineTo(x0 - a / 2, base - u * .74); ctx.lineTo(x0 - a * .4, base - u * .74); ctx.lineTo(x0 - a * .4, base - u * .83); ctx.lineTo(x0 - a * .28, base - u * .83); ctx.lineTo(x0 - a * .28, base - u * .9);
        ctx.lineTo(x0 - a * .12, base - u * .9); ctx.lineTo(x0 - a * .04, base - u); ctx.lineTo(x0 + a * .04, base - u); ctx.lineTo(x0 + a * .12, base - u * .9); ctx.lineTo(x0 + a * .28, base - u * .9); ctx.lineTo(x0 + a * .28, base - u * .83);
        ctx.lineTo(x0 + a * .4, base - u * .83); ctx.lineTo(x0 + a * .4, base - u * .74); ctx.lineTo(x0 + a / 2, base - u * .74); ctx.lineTo(x0 + a / 2, base); ctx.closePath();
      });
      ctx.fill(); ctx.fillRect(cx - (a + gap / 2), base - u * .42, a * 2 + gap, u * .02);
    } else if (kind === 'kl') {
      var s1 = u * .014 * Math.max(.7, ws); ctx.moveTo(cx - u * .05 * ws, base); ctx.lineTo(cx - s1, base - u * .38); ctx.lineTo(cx - s1, base - u * .6); ctx.lineTo(cx + s1, base - u * .6); ctx.lineTo(cx + s1, base - u * .38); ctx.lineTo(cx + u * .05 * ws, base); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, base - u * .66, u * .045 * ws + s1, u * .03, 0, 0, 7); ctx.fill(); ctx.fillRect(cx - s1 * .5, base - u, s1, u * .36); ctx.fillRect(cx - s1 * 1.6, base - u * .72, s1 * 3.2, u * .02);
    } else if (kind === 'ex') {
      var b = u * .1 * ws; ctx.moveTo(cx - b / 2, base); ctx.lineTo(cx - b * .42, base - u * .86); ctx.lineTo(cx - b * .22, base - u * .9); ctx.lineTo(cx - b * .22, base - u * .95); ctx.lineTo(cx - b * .04, base - u); ctx.lineTo(cx + b * .04, base - u); ctx.lineTo(cx + b * .22, base - u * .95); ctx.lineTo(cx + b * .22, base - u * .9); ctx.lineTo(cx + b * .42, base - u * .86); ctx.lineTo(cx + b / 2, base); ctx.closePath(); ctx.fill();
    } else if (kind === 'tm') {
      var f = u * .075 * ws; [[-1.1, .82], [0, 1], [1.1, .9]].forEach(function (q) { ctx.fillRect(cx + q[0] * f - f * .5, base - u * q[1], f, u * q[1]); });
    } else { // md: Merdeka 118, a faceted taper with a long spire
      var w0 = u * .13 * ws; ctx.moveTo(cx - w0, base); ctx.lineTo(cx - w0 * .9, base - u * .3); ctx.lineTo(cx - w0 * .72, base - u * .55); ctx.lineTo(cx - w0 * .5, base - u * .78); ctx.lineTo(cx - w0 * .3, base - u * .9); ctx.lineTo(cx - w0 * .12, base - u * .93); ctx.lineTo(cx - u * .004, base - u);
      ctx.lineTo(cx + u * .004, base - u); ctx.lineTo(cx + w0 * .12, base - u * .93); ctx.lineTo(cx + w0 * .3, base - u * .9); ctx.lineTo(cx + w0 * .5, base - u * .78); ctx.lineTo(cx + w0 * .72, base - u * .55); ctx.lineTo(cx + w0 * .9, base - u * .3); ctx.lineTo(cx + w0, base); ctx.closePath(); ctx.fill();
    }
  }

  function draw() {
    if (!W) return;
    if (!P || themeKey !== (root.getAttribute('data-theme') || '')) palette();
    var tt = time, g = ctx;
    g.setTransform(sc, 0, 0, sc, 0, 0);
    // sky
    if (!skyGrad) { skyGrad = g.createLinearGradient(0, 0, 0, VH); skyGrad.addColorStop(0, P.skyHi); skyGrad.addColorStop(1, P.bg); }
    g.fillStyle = skyGrad; g.fillRect(0, 0, VW + 1, VH + 1);
    var alt = camY, spaceA = clamp((alt - 300) / 1600, 0, 1) * (P.dark ? .85 : .5);
    if (spaceA > 0) { g.globalAlpha = spaceA; g.fillStyle = P.space; g.fillRect(0, 0, VW + 1, VH + 1); g.globalAlpha = 1; }
    // stars (night, and the thin air up high)
    var starA = P.dark ? .9 : clamp((alt - 900) / 1500, 0, .55);
    if (starA > 0) { g.fillStyle = P.dark ? '#ffffff' : P.bg; stars.forEach(function (s) { g.globalAlpha = starA * (.5 + .5 * Math.sin(tt * 1.4 + s.p)); g.fillRect(s.x * VW, (s.y * VH + alt * .04) % VH, s.r, s.r); }); g.globalAlpha = 1; }
    // clouds drift in daylight
    if (!P.dark) { g.fillStyle = mix(P.bg, '#ffffff', .8); g.globalAlpha = .55; clouds.forEach(function (c) { var yy = VH - GROUND - (c.y - alt * .55); if (yy < -40 || yy > VH + 40) return; var xx = ((c.x * VW + tt * c.v) % (VW + 300)) - 150; rect(xx, yy, c.w, 14); rect(xx + c.w * .15, yy - 10, c.w * .5, 12); }); g.globalAlpha = 1; }

    // the world (zoom pivots at the ground, so a toppled tower pulls back to show the whole skyline)
    g.save();
    var sx = 0, syk = 0; if (shake > 0) { sx = (Math.random() - .5) * shake * 2; syk = (Math.random() - .5) * shake * 2; }
    var z = zoom * (1 + punch * .03);
    g.translate(VW / 2 + sx, VH - GROUND + syk); g.scale(z, z); g.translate(-VW / 2, -(VH - GROUND));
    var baseY = sy(0);

    // distant blocks along the ground (parallax)
    if (baseY < VH + 400) {
      g.fillStyle = P.far; var off = camX * .2;
      blocks.forEach(function (b) { rect(b.x - off, baseY - b.h, b.w, b.h + 10); });
    }
    // altitude marks and the real skyline
    LAND.forEach(function (L) {
      var h = L.m / M_PER * FH, topS = sy(h), hit = reached > LAND.indexOf(L) && !demo;
      if (topS > VH + 50 && baseY > VH + 400) return;
      var cx = L.f * VW - camX * .12;
      skyline(L.id, cx, baseY, h, hit ? P.silHit : P.sil);
      if (P.dark && !hit) { g.fillStyle = P.gold; g.globalAlpha = .5 + .5 * Math.sin(tt * 2 + L.m); rect(cx - 1.5, topS - 3, 3, 3); g.globalAlpha = 1; }
      if (topS > -20 && topS < VH + 20) {
        g.fillStyle = hit ? P.gold : P.muted; g.globalAlpha = hit ? .9 : .5;
        for (var x = 0; x < VW + 20; x += 18) g.fillRect(x, topS, 8, 1.2);
        g.globalAlpha = 1; g.font = '500 11px "JetBrains Mono", monospace'; g.textBaseline = 'bottom';
        var left = L.f > .5; g.textAlign = left ? 'left' : 'right'; g.fillStyle = hit ? P.gold : P.muted; g.fillText((hit ? '+ ' : '') + L.name.toUpperCase() + '  ' + L.m + ' m', left ? 10 : VW - 10, topS - 5);
      }
    });
    // street, viaduct and the passing train
    if (baseY < VH + 60) {
      g.fillStyle = P.ground; rect(-50, baseY, VW + 100, VH);
      g.fillStyle = P.accent; rect(-50, baseY, VW + 100, 2);
      g.fillStyle = P.line; rect(-50, baseY - 18, VW + 100, 3);
      if (train) { var tx = train.x - camX * .05; g.fillStyle = P.accent; for (var c2 = 0; c2 < 3; c2++) { rect(tx - c2 * 82, baseY - 40, 76, 22); } g.fillStyle = P.winOn; for (c2 = 0; c2 < 3; c2++) for (var k = 0; k < 5; k++) rect(tx - c2 * 82 + 6 + k * 14, baseY - 35, 9, 8); }
    }
    // the tower
    var tn = top().n, topIdx = slabs.length - 1;
    var sway = calm() ? 0 : Math.sin(tt * 1.3) * Math.min(5, tn * .09);
    for (var i = 0; i < slabs.length; i++) {
      var s = slabs[i], yb = sy(s.n * FH), yt = yb - FH;
      if (yt > VH + 40 / z || yb < -60) continue;
      var swx = sway * (i / Math.max(1, topIdx)) * (i / Math.max(1, topIdx)), sq = s.sq * 5;
      var x0 = s.x - camX + VW / 2 + swx - s.w / 2, y0 = yt + sq * (i === topIdx ? 1 : 0);
      g.fillStyle = P.body[Math.floor(s.n / 3) % 4]; rect(x0, y0, s.w, FH - 1 - (i === topIdx ? sq : 0));
      g.fillStyle = P.edge; rect(x0, y0, s.w, 2);
      var nW = Math.max(2, Math.floor(s.w / 17)), gapW = s.w / nW;
      g.fillStyle = P.winOff; g.beginPath(); var lit = [];
      for (var q = 0; q < nW; q++) { var wx = x0 + q * gapW + gapW * .22; if (hash(s.seed + q * 1.91) < .62) lit.push(wx); else g.rect(wx, y0 + 9, gapW * .56, 9); }
      g.fill(); g.fillStyle = P.winOn; g.beginPath(); lit.forEach(function (wx) { g.rect(wx, y0 + 9, gapW * .56, 9); }); g.fill();
      if (s.flash > 0) { g.globalAlpha = s.flash * .75; g.fillStyle = P.dark ? '#ffffff' : P.gold; rect(x0, y0, s.w, FH - 1); g.globalAlpha = 1; }
    }
    // the sliding floor and its guide
    var t = top(), tswx = sway, tx0 = t.x - camX + VW / 2 + tswx;
    if (blk) {
      var by = sy(blk.n * FH) - FH, bx = blk.x - camX + VW / 2 + tswx - blk.w / 2;
      g.globalAlpha = .28; g.fillStyle = P.gold; rect(tx0 - t.w / 2 - .5, by + FH, 1.4, 600); rect(tx0 + t.w / 2 - .5, by + FH, 1.4, 600); rect(tx0 - 1, by + FH - 6, 2, 6); g.globalAlpha = 1;
      g.fillStyle = P.body[Math.floor(blk.n / 3) % 4]; rect(bx, by, blk.w, FH - 1); g.fillStyle = P.edge; rect(bx, by, blk.w, 2);
      var nb = Math.max(2, Math.floor(blk.w / 17)), gb = blk.w / nb; g.fillStyle = P.winOn; g.beginPath(); for (q = 0; q < nb; q++) if (hash(blk.n * 9.7 + 3 + q * 1.91) < .62) g.rect(bx + q * gb + gb * .22, by + 9, gb * .56, 9); g.fill();
      if (Math.abs(blk.x - t.x) <= PERFECT) { g.globalAlpha = .5; g.strokeStyle = P.gold; g.lineWidth = 2; g.strokeRect(bx, by, blk.w, FH - 1); g.globalAlpha = 1; }
    }
    // loose pieces, rings, sparks
    debris.forEach(function (p) { g.save(); g.globalAlpha = clamp(p.a, 0, 1); g.translate(p.x - camX + VW / 2, sy(p.y + FH / 2)); g.rotate(p.rot); g.fillStyle = P.body[Math.floor(p.n / 3) % 4]; rect(-p.w / 2, -FH / 2, p.w, FH - 1); g.fillStyle = P.edge; rect(-p.w / 2, -FH / 2, p.w, 2); g.restore(); });
    rings.forEach(function (r) { g.globalAlpha = clamp(r.life / r.m, 0, 1) * .8; g.strokeStyle = P.gold; g.lineWidth = 2; g.beginPath(); g.ellipse(t.x - camX + VW / 2 + sway, sy((t.n + 1) * FH), r.r, r.r * .22, 0, 0, 7); g.stroke(); });
    g.globalAlpha = 1;
    parts.forEach(function (p) { var a = clamp(p.life / p.max * 1.4, 0, 1); g.globalAlpha = a; g.fillStyle = p.c === 'gold' ? P.gold : p.c === 'edge' ? P.edge : p.c === 'ink' ? P.ink : P.soft; var px = p.x - camX + VW / 2, py = sy(p.y); if (p.sq) { rect(px, py, p.s, p.s * .6); } else rect(px - p.s / 2, py - p.s / 2, p.s, p.s); });
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    floats.forEach(function (f) { g.globalAlpha = clamp(f.life / f.max * 2, 0, 1); g.font = '600 ' + f.s + 'px "Pixelify Sans", "JetBrains Mono", monospace'; var fx = f.x - camX + VW / 2 + sway, fy = sy(f.y); g.fillStyle = P.bg; g.fillText(f.t, fx + 1.5, fy + 1.5); g.fillStyle = P.gold; g.fillText(f.t, fx, fy); });
    g.globalAlpha = 1;
    g.restore();
    // vignette keeps the edges calm
    if (!vigGrad) { vigGrad = g.createRadialGradient(VW / 2, VH * .5, VH * .35, VW / 2, VH * .5, Math.max(VW, VH) * .75); vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(1, P.dark ? 'rgba(0,0,0,.45)' : 'rgba(15,30,36,.10)'); }
    g.fillStyle = vigGrad; g.fillRect(0, 0, VW + 1, VH + 1);
  }

  /* ---------- HUD (DOM, written only when it changes) ---------- */
  var hud = { f: -1, c: -1, n: '', b: -1 };
  function paintHud(force) {
    var n = top().n, m = Math.round(n * M_PER);
    if (force || hud.f !== n) {
      hud.f = n; el.floor.textContent = n; el.metres.textContent = m + ' m';
      var nx = null; for (var i = 0; i < LAND.length; i++) if (m < LAND[i].m) { nx = LAND[i]; break; }
      var txt = nx ? 'Next ' + nx.name + ' ' + nx.m + ' m' : 'Above the whole skyline';
      if (txt !== hud.n) { hud.n = txt; el.next.textContent = txt; }
      var prev = 0; for (i = LAND.length - 1; i >= 0; i--) if (m >= LAND[i].m) { prev = LAND[i].m; break; }
      el.bar.style.transform = 'scaleX(' + (nx ? clamp((m - prev) / (nx.m - prev), 0, 1) : 1) + ')';
    }
    if (force || hud.c !== combo) { hud.c = combo; el.combo.textContent = combo > 1 ? 'x' + combo : ''; el.combo.classList.toggle('on', combo > 1); }
    if (force || hud.b !== best) { hud.b = best; el.best.textContent = best || '-'; }
  }

  /* ---------- loop and controls ---------- */
  function loop(t) {
    raf = 0; if (!active || d.hidden) return;
    var dt = Math.min((t - last) / 1000, .05); ema += ((t - last) - ema) * .05; last = t;
    if (ema > 26 && quality > .55 && ++slowN > 45) { slowN = 0; quality *= .82; ema = 16; resize(); } else if (ema <= 26) slowN = 0;
    if (state === 'paused') { draw(); return; }
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (raf || !active || d.hidden || state === 'paused') return; last = performance.now(); raf = requestAnimationFrame(loop); }
  function sleep() { cancelAnimationFrame(raf); raf = 0; }

  function begin() {
    reset(false); state = 'playing'; el.card.hidden = true; el.card.dataset.mode = ''; el.pause.hidden = false; snd('start');
    el.live.textContent = 'Go. Drop each floor onto the one below.'; lockUntil = 0; wake();
  }
  function act() {
    var now = performance.now();
    if (state === 'ready' || (state === 'over' && demo)) { begin(); }
    else if (state === 'playing') { drop(); }
    else if (state === 'paused') { resume(); }
    else if (state === 'over' && !demo && now > lockUntil && !el.card.hidden) { begin(); }
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused'; sleep(); draw();
    el.card.dataset.mode = 'pause'; el.card.hidden = false; el.title.textContent = 'Paused'; el.text.textContent = 'The tower will wait.'; el.chips.textContent = ''; el.go.textContent = 'Resume'; el.hint.textContent = 'P, Start or tap Resume';
  }
  function resume() { if (state !== 'paused') return; state = 'playing'; el.card.hidden = true; el.card.dataset.mode = ''; wake(); }
  function toReady() {
    reset(true); state = 'ready'; el.pause.hidden = true; el.card.dataset.mode = 'ready'; el.card.hidden = false; el.title.textContent = 'Skyline Stack';
    el.text.textContent = 'Drop each floor onto the one below. Land it dead centre to keep the full width. Climb past the real KL skyline.'; el.chips.textContent = '';
    LAND.forEach(function (L) { var li = d.createElement('li'); li.textContent = L.name + ' ' + L.m + ' m'; el.chips.appendChild(li); });
    el.go.textContent = 'Press start'; el.hint.textContent = 'Tap, Space or A to build'; paintHud(true);
  }

  cv.addEventListener('pointerdown', function (e) { if (e.cancelable) e.preventDefault(); act(); });
  el.go.addEventListener('click', function () { if (state === 'paused') resume(); else if (state === 'ready' || state === 'over') begin(); });
  el.pause.addEventListener('click', function () { pause(); el.pause.blur(); });
  d.addEventListener('keydown', function (e) {
    if (!active) return;
    var tg = e.target; if (tg && tg.closest && tg.closest('button, a, input, textarea, select')) return;
    var k = e.key;
    if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 'ArrowUp') { if (e.repeat) { e.preventDefault(); return; } e.preventDefault(); act(); }
    else if (k === 'p' || k === 'P') { e.preventDefault(); if (state === 'playing') pause(); else if (state === 'paused') resume(); }
  });
  d.addEventListener('visibilitychange', function () { if (d.hidden) { if (state === 'playing') pause(); sleep(); } else wake(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { var v = en[0].isIntersecting; if (!v && state === 'playing') pause(); if (v && active) wake(); else if (!v) sleep(); }, { threshold: .05 }).observe(wrap);

  // the page tells us when this view opens and closes
  d.addEventListener('play-view', function (e) {
    var on = e.detail && e.detail.id === 'stack';
    if (on && !active) { active = true; readBest(); resize(); if (state === 'playing') pause(); if (state === 'ready' || state === 'over') toReady(), state = 'ready'; paintHud(true); wake(); }
    else if (!on && active) { active = false; if (state === 'playing') pause(); sleep(); }
  });

  palette(); initScenery(); toReady(); resize(); draw();
  window.__stack = {
    peek: function () { var t = top(); return { state: state, demo: demo, n: t.n, topX: t.x, topW: t.w, blockX: blk ? blk.x : null, blockW: blk ? blk.w : null, combo: combo, perfects: perfects, best: best, reached: reached, perfectTol: PERFECT, active: active }; },
    act: act, pause: pause, begin: begin
  };
})();
