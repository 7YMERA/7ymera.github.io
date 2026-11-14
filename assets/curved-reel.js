/* Curved reel: a plain-JS port of 21st.dev's "Tilted Grid Hero".
 * One row of images streams right to left round the inside of a cylinder.
 * Each tile is cut into vertical strips, each a facet of the cylinder; the
 * tile itself is what moves, so its strips can't drift apart. Every tile
 * swaps to its next image as it wraps, out of sight.
 *
 * Usage: <div class="reel" data-reel='["a.webp","b.webp"]'></div>
 * Optional data-speed, data-tile, data-aspect, data-gap, data-axis,
 * data-curve, data-fade (same meaning as the original props).
 * Press and hold to stop it; let go and it carries on.
 */
(function () {
  var CAMERA = 1.6, MAX_WIDTH = 55;

  function arc(bend) { return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend)); }
  function deg(r) { return r * 180 / Math.PI; }
  function round(n) { return +n.toFixed(4); }

  function measure(width, height, o, mw) {
    var h = Math.min(o.tile / 100 * height, mw / 100 * width / o.aspect);
    var radius = width * arc(o.bend);
    if (!(h > 0) || !(radius > 0)) return { columns: 2, sweep: 0, unit: 0, limit: 0 };
    var unit = deg(h / radius);
    var pitch = (o.aspect + o.gap / 100) * unit;
    var limit = deg(o.bend) + o.aspect * unit / 2;
    var columns = Math.min(60, Math.max(2, Math.ceil(2 * limit / pitch)));
    var sweep = round(columns * pitch / 2);
    return { columns: columns, sweep: sweep, unit: round(unit), limit: round(Math.min(sweep, limit)) };
  }

  var count = 0;
  function build(el) {
    var images = JSON.parse(el.getAttribute('data-reel') || '[]');
    if (!images.length) return;
    var d = el.dataset, SLICES = +(d.slices || 16);
    var base = {
      speed: +(d.speed || 4), tile: +(d.tile || 26), aspect: +(d.aspect || 16 / 9),
      gap: +(d.gap || 6), axis: +(d.axis || 50), fade: +(d.fade || 12),
      bend: Math.min(85, Math.max(5, +(d.curve || 80))) * Math.PI / 180
    };
    var id = 'reel' + (++count), orbit = id + '-o', tileCls = id + '-t';
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.containerType = 'size';
    images.forEach(function (src) { new Image().src = src; });

    var band = document.createElement('div');
    band.className = 'reel-band'; band.setAttribute('aria-hidden', 'true');
    var style = document.createElement('style');
    el.appendChild(style); el.appendChild(band);

    var o = base, last = null;
    function render(width, height) {
      // Narrow screens: smaller tiles and a deeper bend, so the reel wraps round the sides
      // instead of showing one flat banner (the tiles are otherwise most of the screen wide).
      var narrow = width < 600, mw = narrow ? 30 : MAX_WIDTH;
      o = narrow ? { speed: base.speed, tile: base.tile * 0.62, aspect: base.aspect, gap: base.gap, axis: base.axis, fade: base.fade, bend: 85 * Math.PI / 180 } : base;
      var L = measure(width, height, o, mw);
      if (last && last.columns === L.columns && last.sweep === L.sweep && last.unit === L.unit && last.narrow === narrow) return;
      last = L; last.narrow = narrow;
      var u = function (n) { return 'calc(' + round(n) + ' * min(' + o.tile + 'cqh, ' + round(mw / o.aspect) + 'cqw))'; };
      var r = 100 * arc(o.bend), radius = (+r.toFixed(3)) + 'cqw';
      var turn = function (a) { return 'translateZ(' + radius + ') rotateY(' + round(a) + 'deg) translateZ(-' + radius + ')'; };
      var hide = round((L.sweep - L.limit) / (2 * L.sweep || 1) * 100);
      style.textContent =
        '@keyframes ' + orbit + '{from{transform:' + turn(-L.sweep) + '}to{transform:' + turn(L.sweep) + '}' +
        '0%,' + hide + '%,' + (100 - hide) + '%,100%{visibility:hidden}' +
        (hide + 0.001) + '%,' + (100 - hide - 0.001) + '%{visibility:visible}}' +
        '@media(prefers-reduced-motion:reduce){.' + tileCls + '{animation-play-state:paused}}';

      var share = o.aspect / SLICES, duration = L.columns * o.speed;
      band.style.perspective = (+(r * CAMERA).toFixed(3)) + 'cqw';
      band.style.perspectiveOrigin = '50% ' + o.axis + '%';
      // The fade is drawn by two overlays (see .reel::before/::after in CSS)
      // instead of a mask: a mask over a 3D scene makes Safari repaint it
      // every frame, which shows as flicker near the edges.
      el.style.setProperty('--reel-fade', o.fade + '%');
      band.innerHTML = '';

      for (var t = 0; t < L.columns; t++) {
        (function (t) {
          var first = L.columns - 1 - t;
          var tile = document.createElement('div');
          tile.className = tileCls + ' reel-tile';
          tile.style.cssText = 'position:absolute;transform-style:preserve-3d;' +
            'left:calc(50% - ' + u(o.aspect / 2) + ');top:calc(' + o.axis + '% - ' + u(0.5) + ');' +
            'width:' + u(o.aspect) + ';height:' + u(1) + ';' +
            'animation:' + orbit + ' ' + duration + 's linear ' + (-t * o.speed) + 's infinite;' +
            (reduce ? 'animation-play-state:paused;' : '');
          var imgs = [];
          for (var k = 0; k < SLICES; k++) {
            var s = document.createElement('div');
            s.className = 'reel-slice' + (k === 0 ? ' first' : '') + (k === SLICES - 1 ? ' last' : '');
            s.style.cssText = 'left:' + u((o.aspect - share) / 2) + ';height:' + u(1) + ';' +
              'width:' + (k === SLICES - 1 ? u(share) : 'calc(' + u(share) + ' + 1px)') + ';' +
              'transform:' + turn((o.aspect / 2 - (k + 0.5) * share) * L.unit) + ';';
            var img = document.createElement('img');
            img.alt = ''; img.draggable = false; img.decoding = 'async';
            img.style.cssText = 'left:' + u(-k * share) + ';width:' + u(o.aspect) + ';height:' + u(1) + ';';
            s.appendChild(img); tile.appendChild(s); imgs.push(img);
          }
          // Decode the next image before swapping, so a strip never flashes
          // empty for a frame while it loads.
          function setSrc(n) {
            var src = images[n % images.length];
            if (imgs[0].getAttribute('src') === src) return;
            var pre = new Image(); pre.src = src;
            var swap = function () { imgs.forEach(function (i) { i.src = src; }); };
            (pre.decode ? pre.decode() : Promise.resolve()).then(swap, swap);
          }
          imgs.forEach(function (i) { i.src = images[first % images.length]; });
          tile.addEventListener('animationiteration', function (e) {
            var lap = Math.round(e.elapsedTime / duration);
            setSrc(lap * L.columns + first);
          });
          band.appendChild(tile);
        })(t);
      }
      band.style.opacity = '1';
    }

    // Press and hold to stop the row; let go and it carries on.
    function hold() { el.classList.add('held'); }
    function letGo() { el.classList.remove('held'); }
    el.addEventListener('pointerdown', function (e) { if (e.button <= 0) hold(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, letGo); });
    el.addEventListener('touchstart', hold, { passive: true });
    el.addEventListener('touchend', letGo); el.addEventListener('touchcancel', letGo);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    var ro = new ResizeObserver(function (entries) {
      var b = entries[0].contentRect; render(b.width, b.height);
    });
    ro.observe(el);
  }

  document.querySelectorAll('[data-reel]:not([data-warp-on])').forEach(build); // the warp reel (warp-carousel.js, loads first) takes the ones it can run
})();
