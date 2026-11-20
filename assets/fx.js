/* fx.js: three small flourishes borrowed from Halcyon.
   1. A trailing cursor ring (mouse only) that swells over buttons and says "Drag" over the globe and the lab.
   2. Scrambling text: the name in the header re-scrambles as you move across it, and each small section label decodes once as it arrives.
   3. Three faint vertical rules, so the page reads like a control panel.
   Nothing here runs on touch screens, and nothing moves with prefers-reduced-motion. */
(function () {
  'use strict';
  var d = document, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GL = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789<>/[]#%&*+=';

  /* ---- scramble ---- */
  function scramble(el, text, ms) {
    if (!el || el.__sc) return; el.__sc = true;
    var n = text.length, t0 = performance.now(), per = ms / Math.max(n, 1);
    el.setAttribute('aria-label', text);
    var id = setInterval(function () {
      var k = Math.floor((performance.now() - t0) / per), out = '';
      for (var i = 0; i < n; i++) { var c = text.charAt(i); out += i < k || c === ' ' || c === '·' || c === '-' ? c : GL.charAt((Math.random() * GL.length) | 0); }
      el.textContent = out;
      var sf = window.__sfx; if (sf && sf.on) { if (k < n) { sf.glyph(); if (k !== el.__k) { el.__k = k; sf.lock(k / n); } } }
      if (k >= n) { clearInterval(id); el.textContent = text; el.__sc = false; el.__k = -1; el.removeAttribute('aria-label'); if (sf && sf.on) sf.done(); }
    }, 40);
  }
  if (!reduce) {
    var mark = d.querySelector('.top .mark');
    if (mark) {
      var tn = null; for (var i = mark.childNodes.length - 1; i >= 0; i--) if (mark.childNodes[i].nodeType === 3 && mark.childNodes[i].textContent.trim()) { tn = mark.childNodes[i]; break; }
      if (tn) { var sp = d.createElement('span'); sp.textContent = tn.textContent.trim(); mark.replaceChild(sp, tn); mark.addEventListener('pointerenter', function () { scramble(sp, sp.textContent, 420); }); }
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); var t = e.target.textContent.trim(); if (t && t.length < 60 && !e.target.children.length) scramble(e.target, t, 520); } }); }, { threshold: .6 });
      d.querySelectorAll('.sec-head .eyebrow').forEach(function (el) { io.observe(el); });
    }
  }

  /* ---- headings arrive with a brief colour split (from the Mirage study's chromatic transition) ---- */
  if (!reduce && 'IntersectionObserver' in window) {
    var hio = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { hio.unobserve(e.target); e.target.classList.add('cg-go'); } }); }, { threshold: .55 });
    d.querySelectorAll('.sec-head h2').forEach(function (h) { if (h.children.length) return; h.setAttribute('data-text', h.textContent.trim()); h.classList.add('cg'); hio.observe(h); });
  }

  /* ---- a ring on every press (the study's "pointer ripple"), and a bigger pulse from the theme switch ---- */
  function ripple(x, y, big) {
    if (reduce) return; var live = d.querySelectorAll('.fx-rp').length; if (live > 5) return;
    var r = d.createElement('i'); r.className = 'fx-rp' + (big ? ' big' : ''); r.style.left = x + 'px'; r.style.top = y + 'px'; r.setAttribute('aria-hidden', 'true');
    r.addEventListener('animationend', function () { r.remove(); }); d.body.appendChild(r);
  }
  d.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('input, textarea, select, canvas#arc-canvas, #arc-jump')) return; ripple(e.clientX, e.clientY, false); }, { passive: true });
  var tb = d.getElementById('theme-btn');
  if (tb) tb.addEventListener('click', function () { var r = tb.getBoundingClientRect(); ripple(r.left + r.width / 2, r.top + r.height / 2, true); if (window.__sfx && window.__sfx.on) window.__sfx.ripple(); });

  /* ---- rules ---- */
  var g = d.createElement('div'); g.className = 'fx-grid'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = '<i></i><i></i><i></i>'; d.body.appendChild(g);

  /* ---- cursor ring ---- */
  if (reduce || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var ring = d.createElement('div'), lab = d.createElement('span');
  ring.className = 'fx-ring'; ring.setAttribute('aria-hidden', 'true'); ring.appendChild(lab); d.body.appendChild(ring);
  var tx = -100, ty = -100, x = -100, y = -100, s = 1, ts = 1, raf = 0, shown = false, text = '';
  var HOT = 'a, button, [role=tab], summary, input, select, label, .chip, [data-copy]';
  function frame() {
    raf = 0; x += (tx - x) * .18; y += (ty - y) * .18; s += (ts - s) * .2;
    ring.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
    if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(ts - s) > .05) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  d.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!shown) { shown = true; x = tx; y = ty; ring.classList.add('on'); }
    var t = e.target, tagged = t.closest && t.closest('[data-cursor]'), hot = t.closest && t.closest(HOT);
    var want = tagged ? tagged.getAttribute('data-cursor') : '';
    ts = tagged ? 2.7 : hot ? 1.8 : 1;
    if (want !== text) { text = want; lab.textContent = text; ring.classList.toggle('lab', !!text); }
    kick();
  }, { passive: true });
  d.addEventListener('pointerdown', function () { ts *= .8; kick(); });
  d.documentElement.addEventListener('pointerleave', function () { ring.classList.remove('on'); shown = false; });
  d.addEventListener('visibilitychange', function () { if (d.hidden) ring.classList.remove('on'); });
})();
