/* cursor.js: the site's custom pointer, an orbital / HUD reticle. Plain JS, no libraries. Pair with cursor.css.
     idle     a crisp centre dot plus a reticle of four bracket corners that lags the pointer and slowly turns while you move
     link     over links and buttons the brackets snap to the target's box and wrap it (with a small magnetic pull)
     text     over paragraphs and headings it becomes a thin I-beam caret, sized to the line
     canvas   over a <canvas> (or anything with data-cursor="crosshair") a crosshair with live X / Y telemetry
     label    data-cursor="Drag" (any text) opens the reticle and shows the word
     press    a ripple ring and the brackets squeeze
     trail    a faint comet of recent positions, drawn on one canvas, only the changed part is cleared each frame
   Colours come from the page's CSS variables (--accent, --ink, --gold, --bg), so day, night and golden hour all follow.
   It does nothing on touch or coarse pointers and with prefers-reduced-motion (the native cursor stays), and the native cursor is never
   hidden over input, textarea, select or editable text. Layout is read only when the pointer enters a new target (cached), and the frame
   loop sleeps when nothing moves. Only transform and opacity are animated. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, mqFine = matchMedia('(hover: hover) and (pointer: fine)'), mqRed = matchMedia('(prefers-reduced-motion: reduce)');
  var active = false, built = false, cu, dot, cs = [], xh, tel, beam, lab, cv, cx;
  var tx = -200, ty = -200, dx = -200, dy = -200, rx = -200, ry = -200, hw = 15, hh = 15, ang = 0, pr = 1, prT = 1, shown = false, raf = 0, lastT = 0, lastMove = 0, mode = 'idle', over = null, rect = null, rectAt = 0, dirty = false;
  var tgHW = 15, tgHH = 15, tgAng = 0, label = '', beamH = 24, W = 0, H = 0, trail = [], TN = 9, prevBox = null, col = { r: '#0a6c74', i: '#0f1e24', b: '#f3f6f6' }, colAt = 0, colTimer = 0, lastTel = '';
  var HOT = 'a[href], button, [role=button], [role=tab], [role=link], summary, label, .chip, [data-copy], input[type=checkbox], input[type=radio], input[type=range], input[type=button], input[type=submit], [tabindex]:not([tabindex="-1"])';
  var NATIVE = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=""], [contenteditable="true"]';
  var TEXT = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, td, th, pre, code, dt, dd';

  function el(tag, cls, parent) { var e = d.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function build() {
    if (built) return; built = true;
    cv = el('canvas', 'cu-tr', d.body); cv.setAttribute('aria-hidden', 'true'); cx = cv.getContext('2d');
    cu = el('div', 'cu', d.body); cu.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) cs.push(el('i', 'cu-c c' + i, cu));
    xh = el('div', 'cu-xh', cu); el('i', 'h', xh); el('i', 'v', xh); tel = el('span', 'cu-tel', cu);
    beam = el('div', 'cu-beam', cu); lab = el('span', 'cu-lab', cu); dot = el('i', 'cu-dot', cu);
    resize();
  }
  function resize() { if (!cv) return; W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; prevBox = null; }

  /* colours follow the theme tokens, refreshed on theme and time-of-day changes, never per frame */
  function readColors() {
    colAt = performance.now(); if (!cu) return; var cs2 = getComputedStyle(root), T = window.SceneTime && SceneTime.get ? +SceneTime.get() : -1;
    function v(n, f) { var s = cs2.getPropertyValue(n).trim(); return s || f; }
    var acc = v('--accent', '#0a6c74'), gold = v('--gold', '#a86d12');
    col.r = (T > .55 && T < 1.45) ? gold : acc; col.i = v('--ink', '#0f1e24'); col.b = v('--bg', '#f3f6f6');
    cu.style.setProperty('--cu-r', col.r); cu.style.setProperty('--cu-i', col.i); cu.style.setProperty('--cu-b', col.b);
  }
  function colorsSoon() { if (colTimer) return; colTimer = setTimeout(function () { colTimer = 0; readColors(); }, Math.max(60, 260 - (performance.now() - colAt))); }

  /* what is under the pointer: classified once per new element, rects cached */
  function classify(t) {
    over = t; rect = null; label = ''; var m = 'idle', n;
    if (!t || t === root || t === d.body) { setMode('idle'); return; }
    if (t.closest(NATIVE)) { setMode('native'); return; }
    if ((n = t.closest('[data-cursor]'))) {
      var v = n.getAttribute('data-cursor');
      if (v === 'crosshair') m = 'xh'; else { label = v; lab.textContent = v; m = 'lab'; }
    } else if (t.tagName === 'CANVAS' && !t.classList.contains('cu-tr')) m = 'xh';
    else if ((n = t.closest(HOT))) {
      var r = n.getBoundingClientRect();
      if (r.width < W * .6 && r.height < H * .5 && r.width > 4 && r.height > 4) { rect = { x: r.left, y: r.top, w: r.width, h: r.height, el: n }; m = 'link'; }
      else m = 'idle';
    } else if ((n = t.closest(TEXT))) {
      var s = getComputedStyle(n), fs = parseFloat(s.fontSize) || 16;
      if (fs <= 42 && s.userSelect !== 'none') { var lh = parseFloat(s.lineHeight); beamH = clamp(isNaN(lh) ? fs * 1.35 : lh, 16, 46); m = 'text'; }
    }
    setMode(m);
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function setMode(m) {
    if (m === mode) { if (m === 'link' || m === 'lab' || m === 'text') kick(); return; }
    mode = m; cu.className = 'cu m-' + m + (shown ? ' on' : '') + (cu.classList.contains('pr') ? ' pr' : ''); kick();
  }

  function frame(now) {
    raf = 0; var dt = Math.min(2.5, (now - (lastT || now - 16)) / 16.67); lastT = now;
    var k1 = 1 - Math.pow(1 - .24, dt), k2 = 1 - Math.pow(1 - .18, dt), moving = now - lastMove < 1400, busy = false;
    // targets by mode
    var gx = tx, gy = ty;
    if (mode === 'link' && rect) {
      if (dirty && now - rectAt > 90) { var r = rect.el.getBoundingClientRect(); rect.x = r.left; rect.y = r.top; rect.w = r.width; rect.h = r.height; rectAt = now; dirty = false; }
      var cx0 = rect.x + rect.w / 2, cy0 = rect.y + rect.h / 2; gx = cx0 + (tx - cx0) * .16; gy = cy0 + (ty - cy0) * .16;
      tgHW = rect.w / 2 + 6; tgHH = rect.h / 2 + 6; tgAng = Math.round(ang / 6.2832) * 6.2832;
    } else if (mode === 'xh') { tgHW = tgHH = 24; tgAng = Math.round((ang - .7854) / 1.5708) * 1.5708 + .7854; }
    else if (mode === 'lab') { tgHW = tgHH = 36; tgAng = Math.round(ang / 6.2832) * 6.2832; }
    else if (mode === 'text') { tgHW = tgHH = 9; tgAng = Math.round(ang / 6.2832) * 6.2832; }
    else { tgHW = tgHH = 15 + (moving ? Math.sin(now / 260) * 1.2 : 0); if (moving) ang += .014 * dt; else tgAng = ang; if (moving) tgAng = ang; }
    dx = tx; dy = ty;                                    // the dot never lags
    rx += (gx - rx) * k2; ry += (gy - ry) * k2; hw += (tgHW - hw) * k1; hh += (tgHH - hh) * k1; pr += (prT - pr) * (1 - Math.pow(1 - .3, dt));
    if (mode === 'idle' && !moving) { /* hold the angle */ } else ang += (tgAng - ang) * k1 * (mode === 'idle' ? 0 : 1);
    var ca = Math.cos(ang), sa = Math.sin(ang), shw = hw * pr, shh = hh * pr, deg = (ang * 57.2958).toFixed(2), i;
    var sx = [-1, 1, 1, -1], sy = [-1, -1, 1, 1];
    for (i = 0; i < 4; i++) { var ox = sx[i] * shw, oy = sy[i] * shh; cs[i].style.transform = 'translate3d(' + (rx + ox * ca - oy * sa).toFixed(2) + 'px,' + (ry + ox * sa + oy * ca).toFixed(2) + 'px,0) rotate(' + deg + 'deg)'; }
    dot.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
    if (mode === 'xh') { xh.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)'; var s = 'X ' + pad(Math.round(dx)) + '  Y ' + pad(Math.round(dy)); if (s !== lastTel) { lastTel = s; tel.textContent = s; } tel.style.transform = 'translate3d(' + (dx + 30).toFixed(1) + 'px,' + (dy + 22).toFixed(1) + 'px,0)'; }
    else if (mode === 'text') beam.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) scaleY(' + (beamH / 24).toFixed(3) + ')';
    else if (mode === 'lab') lab.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    drawTrail();
    if (Math.abs(gx - rx) + Math.abs(gy - ry) + Math.abs(tgHW - hw) + Math.abs(tgHH - hh) + Math.abs(prT - pr) * 20 + (mode !== 'idle' ? Math.abs(tgAng - ang) * 20 : 0) > .06 || moving || trail.length) busy = true;
    if (busy) raf = requestAnimationFrame(frame);
  }
  function pad(n) { return ('000' + Math.max(0, n)).slice(-4); }

  /* the comet: recent dot positions, drawn as tapering, fading segments; only the previous drawing's bounding box is cleared */
  function drawTrail() {
    if (prevBox) { cx.clearRect(prevBox[0], prevBox[1], prevBox[2], prevBox[3]); prevBox = null; }
    trail.push(dx, dy); if (trail.length > TN * 2) trail.splice(0, 2);
    var n = trail.length / 2, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, moved = false, i;
    for (i = 1; i < n; i++) if (Math.abs(trail[i * 2] - trail[i * 2 - 2]) + Math.abs(trail[i * 2 + 1] - trail[i * 2 - 1]) > .6) { moved = true; break; }
    if (!moved) { if (n > 1) trail.length = 0; return; }       // pointer at rest: nothing to draw, and the loop may sleep
    if (mode === 'text' || mode === 'native') return;
    cx.lineCap = 'round'; cx.strokeStyle = col.r;
    for (i = 1; i < n; i++) {
      var x0 = trail[i * 2 - 2], y0 = trail[i * 2 - 1], x1 = trail[i * 2], y1 = trail[i * 2 + 1], f = i / n;
      cx.globalAlpha = .5 * f * f; cx.lineWidth = .6 + 3.2 * f; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
      if (x1 < minx) minx = x1; if (x1 > maxx) maxx = x1; if (y1 < miny) miny = y1; if (y1 > maxy) maxy = y1; if (x0 < minx) minx = x0; if (x0 > maxx) maxx = x0; if (y0 < miny) miny = y0; if (y0 > maxy) maxy = y0;
    }
    cx.globalAlpha = 1; prevBox = [Math.floor(minx - 6), Math.floor(miny - 6), Math.ceil(maxx - minx + 12), Math.ceil(maxy - miny + 12)];
  }
  function kick() { if (!raf && active) raf = requestAnimationFrame(frame); }

  /* events */
  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY; lastMove = performance.now();
    if (!shown) { shown = true; rx = tx; ry = ty; dx = tx; dy = ty; cu.classList.add('on'); root.classList.add('cu-on'); }
    kick();
  }
  function onOver(e) { if (e.pointerType && e.pointerType !== 'mouse') return; if (e.target !== over) classify(e.target); }
  function onDown(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    prT = .74; cu.classList.add('pr');
    if (mode !== 'native' && d.querySelectorAll('.cu-rp').length < 4) { var r = el('i', 'cu-rp', d.body); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; r.style.setProperty('--cu-r', col.r); r.addEventListener('animationend', function () { r.remove(); }); }
    kick();
  }
  function onUp() { prT = 1; cu.classList.remove('pr'); kick(); }
  function onLeave() { shown = false; cu.classList.remove('on'); }
  function onScroll() { if (mode === 'link') { dirty = true; kick(); } }
  var rzT = 0; function onResize() { clearTimeout(rzT); rzT = setTimeout(resize, 120); }
  var mo = null;

  function enable() {
    if (active) return; active = true; build(); readColors();
    d.addEventListener('pointermove', onMove, { passive: true }); d.addEventListener('pointerover', onOver, { passive: true });
    d.addEventListener('pointerdown', onDown, { passive: true }); addEventListener('pointerup', onUp, { passive: true }); addEventListener('pointercancel', onUp);
    root.addEventListener('pointerleave', onLeave); addEventListener('blur', onLeave); addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onResize);
    d.addEventListener('scenetime', colorsSoon);
    mo = new MutationObserver(colorsSoon); mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
  }
  function disable() {
    if (!active) return; active = false; root.classList.remove('cu-on'); shown = false;
    d.removeEventListener('pointermove', onMove); d.removeEventListener('pointerover', onOver); d.removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); root.removeEventListener('pointerleave', onLeave); removeEventListener('blur', onLeave);
    removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); d.removeEventListener('scenetime', colorsSoon); if (mo) mo.disconnect();
    if (cu) cu.classList.remove('on'); if (cx) cx.clearRect(0, 0, W, H); if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function want() { return mqFine.matches && !mqRed.matches; }
  function sync() { if (want()) enable(); else disable(); }
  function boot() { sync(); }
  [mqFine, mqRed].forEach(function (m) { if (m.addEventListener) m.addEventListener('change', sync); else if (m.addListener) m.addListener(sync); });
  if (d.body) boot(); else d.addEventListener('DOMContentLoaded', boot);
  window.__cursor = { get active() { return active; }, get mode() { return mode; }, enable: enable, disable: disable };
})();
