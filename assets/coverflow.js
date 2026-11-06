/* Coverflow: a plain-JS take on 21st.dev's "Coverflow Carousel".
 * The centre cover faces you; the others turn away on either side. Below it,
 * the matching detail panel shows. Arrows, keys, swipe, or click a side cover.
 *
 * Markup:
 * <div class="cf" data-cf>
 *   <div class="cf-stage"><div class="cf-item">…cover…</div> …</div>
 *   <button class="cf-btn" data-dir="-1">…</button><button class="cf-btn" data-dir="1">…</button>
 *   <div class="cf-details"><div class="cf-detail">…</div> …</div>
 * </div>
 */
(function () {
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-cf]').forEach(function (root) {
    var items = [].slice.call(root.querySelectorAll('.cf-item'));
    var details = [].slice.call(root.querySelectorAll('.cf-detail'));
    var dots = root.querySelector('.cf-dots');
    var n = items.length, cur = +(root.dataset.start || 0);
    if (!n) return;
    if (calm) root.classList.add('calm');

    if (dots) items.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Show ' + (i + 1) + ' of ' + n);
      b.addEventListener('click', function () { go(i); });
      dots.appendChild(b);
    });

    function layout() {
      var w = root.clientWidth, small = w < 640;
      var size = small ? Math.min(220, w * 0.56) : Math.min(300, w * 0.28);
      var gap = small ? size * 0.42 : size * 0.62;
      root.style.setProperty('--cf-size', size + 'px');
      // Space by the covers' real width (the notes covers are wider than tall).
      var iw = items[0].offsetWidth || size; gap = gap * iw / size; size = iw;
      items.forEach(function (el, i) {
        // Loop round, so there are always covers on both sides.
        var d = ((i - cur) % n + n + Math.floor(n / 2)) % n - Math.floor(n / 2);
        var a = Math.abs(d), s = d < 0 ? -1 : 1;
        // A cover wrapping from one end to the other jumps without animating.
        var prev = el._d === undefined ? d : el._d; el._d = d;
        el.style.transition = Math.abs(prev - d) > 1 ? 'none' : '';
        var x = d === 0 ? 0 : s * (size * 0.55 + gap * (a - 0.4));
        var t = 'translate3d(' + x.toFixed(1) + 'px,0,' + (a ? -120 - a * 40 : 0) + 'px)' +
                (d ? ' rotateY(' + (-s * 48) + 'deg)' : '') + ' scale(' + (d ? 0.9 : 1) + ')';
        el.style.transform = t;
        el.style.zIndex = 100 - a;
        el.style.opacity = a > 3 ? 0 : 1;
        el.style.pointerEvents = a > 3 ? 'none' : '';
        el.classList.toggle('on', d === 0);
        el.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      });
      details.forEach(function (el, i) { el.hidden = i !== cur; });
      if (dots) [].forEach.call(dots.children, function (b, i) {
        b.classList.toggle('on', i === cur);
        if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }
    function go(i) {
      cur = ((i % n) + n) % n;
      layout();
      var d = details[cur];
      if (d && !calm) { d.classList.remove('in'); void d.offsetWidth; d.classList.add('in'); }
    }

    items.forEach(function (el, i) { el.addEventListener('click', function () { if (i !== cur) go(i); }); });
    root.querySelectorAll('.cf-btn').forEach(function (b) {
      b.addEventListener('click', function () { go(cur + +b.dataset.dir); });
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });
    var stage = root.querySelector('.cf-stage'), x0 = null;
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    stage.addEventListener('pointerup', function (e) {
      if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    });
    new ResizeObserver(layout).observe(root);
    layout();
  });
})();
