/* Image stream: a plain-JS take on 21st.dev's "Image Stream Hero", one-sided.
 * Images ride along a single wall that recedes towards a vanishing point,
 * coming out of the distance and sliding past you. Only transform and
 * opacity animate, so the browser just moves finished layers around.
 *
 * Usage: <div class="stream" data-stream='["a.webp","b.webp"]'></div>
 * Optional data-speed (seconds for one panel to travel the wall, default 28).
 */
(function () {
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-stream]').forEach(function (el) {
    var imgs = JSON.parse(el.getAttribute('data-stream') || '[]');
    if (!imgs.length) return;
    var speed = +(el.dataset.speed || 28), count = 9;
    var wall = document.createElement('div');
    wall.className = 'stream-wall'; wall.setAttribute('aria-hidden', 'true');
    for (var k = 0; k < count; k++) {
      var p = document.createElement('div');
      p.className = 'stream-panel';
      // Spread the panels evenly along the wall by starting each one part
      // of the way through the same loop.
      p.style.animationDuration = speed + 's';
      p.style.animationDelay = (-(k / count) * speed).toFixed(2) + 's';
      if (calm) p.style.animationPlayState = 'paused';
      var img = document.createElement('img');
      img.src = imgs[k % imgs.length]; img.alt = ''; img.decoding = 'async'; img.draggable = false;
      p.appendChild(img); wall.appendChild(p);
    }
    el.appendChild(wall);
    // Pause while off-screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { el.classList.toggle('offscreen', !es[0].isIntersecting); }).observe(el);
    }
  });
})();
