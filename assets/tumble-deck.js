/* Tumble deck: a plain-JS take on 21st.dev's "Tumble Deck Showcase".
 * A stack of screenshots stands on edge, one behind the other. As you scroll
 * through the section, the front card tips forward onto the floor and the
 * deck slides up to the line. Driven by page scroll (the section is tall and
 * the stage is sticky), so the page never gets stuck and nothing is hijacked.
 *
 * Usage: <section class="deck" data-deck='[{"src":"a.webp","alt":"…","title":"…","sub":"…"}]'>
 */
(function () {
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  // Hinge angle (deg) of a card t of the way through its fall: gravity eases
  // in, then it kicks once off the floor and settles.
  function fallAngle(t) {
    var u = clamp01(t), land = 0.78;
    if (u <= land) { var k = u / land; return -90 * k * k * k; }
    var k2 = (u - land) / (1 - land);
    return -90 + 6 * Math.sin(Math.PI * k2) * (1 - k2);
  }
  // How far the deck has slid forward, in card gaps.
  function deckAdvance(pos) {
    var i = Math.floor(pos), f = pos - i, k = clamp01((f - 0.28) / 0.6);
    return i + k * k * (3 - 2 * k);
  }
  function cardPose(k, pos, depth) {
    var t = pos - k, lift = (k - Math.floor(pos) + 3) * 0.6;
    if (t >= 1) return { angle: -90, z: 0, lift: lift, opacity: t < 3 ? 1 : 0, flat: true };
    if (t > 0) return { angle: fallAngle(t), z: 0, lift: lift, opacity: 1, flat: false };
    var rel = k - deckAdvance(pos);
    return { angle: 0, z: -Math.max(rel, 0), lift: 0, opacity: clamp01(depth + 1 - rel), flat: false };
  }

  function build(root) {
    var cards = JSON.parse(root.getAttribute('data-deck') || '[]');
    var n = cards.length; if (!n) return;
    var aspect = +(root.dataset.aspect || 1.6), depth = 4;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stage = root.querySelector('.deck-stage'), scene = root.querySelector('.deck-scene');
    var title = root.querySelector('.deck-title'), sub = root.querySelector('.deck-sub'), count = root.querySelector('.deck-count');
    var els = cards.map(function (c, k) {
      var el = document.createElement('div'); el.className = 'deck-card';
      var img = document.createElement('img'); img.src = c.src; img.alt = c.alt || ''; img.draggable = false; img.decoding = 'async';
      if (k > 2) img.loading = 'lazy';
      el.appendChild(img); scene.appendChild(el); return el;
    });
    var geo = { h: 200, gap: 48 }, pos = 0, target = 0, shown = -1, running = false;

    function paint() {
      for (var k = 0; k < n; k++) {
        var p = cardPose(k, pos, depth), el = els[k];
        el.style.transform = 'translate3d(0,' + (-p.lift) + 'px,' + (p.z * geo.gap) + 'px) rotateX(' + p.angle + 'deg)';
        el.style.opacity = p.opacity;
        el.style.visibility = p.opacity > 0 ? 'visible' : 'hidden';
        el.style.setProperty('--shade', p.flat ? 0.08 : (-p.angle / 90) * 0.08);
      }
      var front = Math.min(n - 1, Math.max(0, Math.round(pos)));
      if (front !== shown) {
        shown = front;
        if (title) title.textContent = cards[front].title || '';
        if (sub) sub.textContent = cards[front].sub || '';
        if (count) count.textContent = String(front + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
      }
    }
    function fit() {
      var W = stage.clientWidth, H = stage.clientHeight;
      var wFrac = W < 520 ? 0.82 : 0.6;
      var h = Math.max(60, Math.min((W * wFrac) / aspect, H * 0.36, 520));
      var top = H * 0.5 - 0.62 * h;
      geo = { h: h, gap: 0.24 * h };
      scene.style.perspective = (6 * h) + 'px';
      scene.style.perspectiveOrigin = '50% ' + (top - 1.66 * h) + 'px';
      root.style.setProperty('--dk-w', (h * aspect) + 'px');
      root.style.setProperty('--dk-h', h + 'px');
      root.style.setProperty('--dk-top', top + 'px');
      paint();
    }
    // Scroll position through the section -> deck position 0 .. n-1.
    function readScroll() {
      var r = root.getBoundingClientRect(), span = r.height - innerHeight;
      target = clamp01(-r.top / (span || 1)) * (n - 1);
      if (reduce) { pos = Math.round(target); paint(); return; }
      if (!running) { running = true; requestAnimationFrame(follow); }
    }
    var last = 0;
    function follow(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      pos += (target - pos) * (1 - Math.exp(-dt * 10));
      if (Math.abs(target - pos) < 0.002) { pos = target; running = false; last = 0; paint(); return; }
      paint(); requestAnimationFrame(follow);
    }
    // Click or keys: jump the page to the next / previous card.
    function step(dir) {
      var r = root.getBoundingClientRect(), span = r.height - innerHeight;
      var next = Math.min(n - 1, Math.max(0, Math.round(target) + dir));
      window.scrollTo({ top: scrollY + r.top + (next / (n - 1)) * span + 1, behavior: reduce ? 'auto' : 'smooth' });
    }
    stage.addEventListener('click', function () { step(1); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    });
    root.style.setProperty('--dk-n', n);
    new ResizeObserver(fit).observe(stage);
    addEventListener('scroll', readScroll, { passive: true });
    fit(); readScroll();
  }
  document.querySelectorAll('[data-deck]').forEach(build);
})();
