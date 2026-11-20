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
      if (k >= n) { clearInterval(id); el.textContent = text; el.__sc = false; el.removeAttribute('aria-label'); }
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
