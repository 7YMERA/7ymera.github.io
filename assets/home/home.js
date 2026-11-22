/* Home page director: the glass reveal, the descent, when the 3D city is allowed on, the chapter rail and the header's tone.
 * The other pieces are their own files: glass-reveal.js, descent.js, project-deck.js (and the flight itself is scene.js). */
(function () {
  'use strict';
  var d = document, root = d.documentElement, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || d).querySelector(s); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function tsafe(f) { try { return f(); } catch (e) { return null; } }

  /* ---- the owner's mark: a backslash and a seven, bold and geometric (the site's logo is "\7ymera") ---- */
  var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="312" height="224" viewBox="0 0 156 112"><path d="M12 8H40L81 108H53Z M94 8H154V29L122 108H96L127 31H94Z" fill="#000" stroke="#000" stroke-width="4" stroke-linejoin="round"/></svg>';

  /* ---- theme ---- */
  var tb = $('#theme-btn');
  function isDark() { return root.getAttribute('data-theme') === 'dark'; }
  function syncTheme() { if (tb) tb.setAttribute('aria-pressed', isDark() ? 'true' : 'false'); }
  if (tb) tb.addEventListener('click', function () {
    var nx = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', nx); tsafe(function () { localStorage.setItem('theme', nx); }); syncTheme();
  });
  syncTheme();
  function ground() { return getComputedStyle(root).getPropertyValue('--hg').trim() || (isDark() ? '#050912' : '#e7eef7'); }

  /* ---- scramble text (the same decode feel as fx.js; kept local so the page does not depend on its internals) ---- */
  var GLY = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789<>/[]#%&*+=';
  function scramble(el, text, ms, done) {
    if (!el) return;
    if (reduce) { el.textContent = text; if (done) done(); return; }
    var n = text.length, t0 = performance.now(), per = ms / Math.max(n, 1);
    (function tick() {
      var k = Math.floor((performance.now() - t0) / per), out = '';
      for (var i = 0; i < n; i++) { var c = text.charAt(i); out += i < k || c === ' ' || c === '.' ? c : GLY.charAt((Math.random() * GLY.length) | 0); }
      el.textContent = out;
      if (k < n) requestAnimationFrame(tick); else { el.textContent = text; if (done) done(); }
    })();
  }

  /* ---- 00 · the glass reveal ---- */
  var rv = $('#reveal'), gl = $('#rv-gl'), rvText = $('#rv-text'), nameEl = $('#rv-name'), tagEl = $('#rv-tag'), gr = null, wasFar = false, arrivedOnce = false;
  var NAME = 'Alif Najmi', TAG = tagEl ? tagEl.textContent : '';
  function arrive() {
    if (!rvText) return;
    rvText.classList.add('in');
    scramble(nameEl, NAME, 900);
    setTimeout(function () { scramble(tagEl, TAG, 800); }, 380);
    arrivedOnce = true;
  }
  function hideText() { if (rvText) rvText.classList.remove('in'); }
  function makeGlass(instant) {
    if (gr || !window.GlassReveal || !gl) return;
    gr = new GlassReveal(gl, {
      logo: LOGO, look: isDark() ? 'dark' : 'light', background: ground(), instant: instant, tileSize: 560, centerY: innerWidth < 720 ? .36 : .4, tuning: { finalScale: 1.1 },
      onRelease: function () { if (!instant) arrive(); },
      onDone: function () { if (instant && !arrivedOnce) arrive(); }
    });
  }
  if (gl) {
    if (rv && !reduce) {
      (window.ScrollBus ? window.ScrollBus.move : function (f, el) { el.addEventListener('pointermove', f, { passive: true }); })(function (e) {
        if (!gr) return;
        var r = rv.getBoundingClientRect();
        gr.setPointer(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1, true);
      }, rv);
      rv.addEventListener('pointerleave', function () { if (gr) gr.setPointer(0, 0, false); });
    }
    var go = function () { makeGlass(reduce); };
    if (window.GlassReveal) go(); else addEventListener('load', go);
    // free the GPU once we have scrolled well past; come back to the finished state if the reader returns
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
      var near = en[0].isIntersecting;
      if (!near && gr) { gr.dispose(); gr = null; wasFar = true; }
      else if (near && !gr && wasFar) { wasFar = false; makeGlass(true); }
    }, { rootMargin: '80% 0px 80% 0px' }).observe(rv);
    // if WebGL never gets going, the text still has to arrive
    // (counted from when the entry gate opens, if there is one, so the name never shows behind it)
    var fallback = function () { setTimeout(function () { if (!arrivedOnce) arrive(); }, 6500); };
    if (window.__gate && !window.__gate.open && window.__gate.then) window.__gate.then(fallback); else fallback();
  }
  new MutationObserver(function () { if (gr) gr.setLook(isDark() ? 'dark' : 'light', ground()); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---- 01 · the descent ---- */
  var dsEl = $('#descent'), ds = null, dsStage = $('#ds-stage');
  function bootDescent() {
    if (!dsEl || ds || !window.Descent) return;
    ds = new Descent(dsEl, { onProgress: function (p) { if (dsStage) dsStage.style.opacity = (1 - sstep(.955, 1, p)).toFixed(3); } });
  }
  if (window.Descent) bootDescent(); else addEventListener('load', bootDescent);

  /* ---- scroll director: city on/off, header tone, chapter rail ---- */
  var enter = $('#enter'), bar = $('#top-bar'), fill = $('#rail-fill'), links = [].slice.call(d.querySelectorAll('.rail a')), secs = {}, ticking = false;
  links.forEach(function (a) { secs[a.dataset.ch] = d.getElementById(a.dataset.ch); });
  // The scroll director reads every rect first (ScrollBus read phase), then writes: aperture, city-on, header tone, rail.
  function readTick() {
    var y = scrollY, vh = innerHeight, ap = -1, city = false, i;
    // optical airlock: as the reader scrolls out of #reveal into #descent, relax the glass tile into a circular orbital lens
    if (gr && rv && !reduce) ap = clamp((y - vh * .05) / (vh * .78), 0, 1);
    // the 3D city only shows from the end of the descent to the end of the flight (the CSS fades it); outside that it stays hidden
    if (enter && enter.offsetHeight) { var top = enter.offsetTop, bot = top + enter.offsetHeight; city = y > top - vh * 1.18 && y < bot + vh * .2; }
    // header tone: light type over the dark descent stage
    var dr = dsEl ? dsEl.getBoundingClientRect() : null, onDark = !!dr && dr.top < 60 && dr.bottom > 60 && !(dsStage && +dsStage.style.opacity < .35);
    var span = Math.max(1, d.documentElement.scrollHeight - vh), cur = '', mid = vh * .5;
    for (var k in secs) { var s = secs[k]; if (!s) continue; var r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = k; }
    return function () {
      if (ap >= 0) gr.setAperture(ap);
      root.classList.toggle('city-on', city);
      root.classList.toggle('h-dark', onDark);
      bar.classList.toggle('solid', y > vh * .6);
      if (fill) fill.style.setProperty('--rp', clamp(y / span, 0, 1).toFixed(4));
      if (cur !== tick.cur) { tick.cur = cur; links.forEach(function (a) { a.classList.toggle('on', a.dataset.ch === cur); if (a.dataset.ch === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
    };
  }
  function tick() { ticking = false; readTick()(); }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
  if (window.ScrollBus) window.ScrollBus.read(readTick); else addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req); tick();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(req);

})();
