/* Glass folders: a plain-JS take on 21st.dev's "Glassmorphism Folder Cards".
 * One folder per topic. A back panel holds a screenshot of the project, the
 * files sit in the pocket, and a milky glass front panel is hinged on its
 * bottom edge. Hover leans the glass; click (or Enter / Space) opens the
 * folder and fans the files out, each one a link.
 *
 * The real component frosts with backdrop-filter. Over this site's moving
 * aurora that would re-blur every frame, so the glass here is a translucent
 * milky gradient instead: same look at rest, no per-frame cost.
 *
 * Usage: <div class="fd-grid" data-folders='[{"label":"…","cover":"img.webp",
 *   "files":[{"name":"…","meta":"…","href":"…","img":"…"}]}]'></div>
 */
(function () {
  var W = 340, H = 272, HEADROOM = 54, FRONT_TOP = 74, FRONT_H = H - FRONT_TOP, MAX = 4;
  var BACK = 'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
  var FRONT = 'M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 ' + (FRONT_H - 22) +
    'A22 22 0 0 1 318 ' + FRONT_H + 'L22 ' + FRONT_H + 'A22 22 0 0 1 0 ' + (FRONT_H - 22) + 'Z';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // a small stable jitter per file name, so the stack looks hand-placed
  var jitter = function (s, n) { var h = 2166136261; for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (((h >>> (n * 5)) & 255) / 255) - .5; };
  var openOne = null;

  document.querySelectorAll('[data-folders]').forEach(function (grid) {
    var folders = JSON.parse(grid.getAttribute('data-folders') || '[]');
    grid.innerHTML = folders.map(function (f, fi) {
      var files = f.files.slice(-MAX), n = files.length;
      var sheets = files.map(function (file, v) {
        var slot = n <= 1 ? 0 : (v / (n - 1)) * 2 - 1, depth = n - 1 - v;
        var ext = /^https?:/.test(file.href) ? ' target="_blank" rel="noopener"' : '';
        var art = file.img ? '<img class="fd-sheet-img" src="' + esc(file.img) + '" alt="" loading="lazy" draggable="false">' :
          '<span class="fd-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
        return '<a class="fd-sheet' + (file.img ? ' fd-sheet--img' : '') + '" role="listitem" href="' + esc(file.href) + '"' + ext + ' tabindex="-1"' +
          ' style="--slot:' + slot.toFixed(3) + ';--depth:' + depth + ';--jx:' + (jitter(file.name, 1) * 10).toFixed(2) + 'px;--jr:' + (jitter(file.name, 2) * 3.2).toFixed(2) + 'deg;z-index:' + (v + 1) + '">' +
          art + '<span class="fd-sheet-head"><span class="fd-sheet-name">' + esc(file.name) + '</span>' + (file.meta ? '<span class="fd-sheet-meta">' + esc(file.meta) + '</span>' : '') + '</span></a>';
      }).join('');
      var count = f.files.length + (f.files.length === 1 ? ' item' : ' items');
      return '<div class="fd" data-tone="' + (f.tone || 'light') + '">' +
        '<div class="fd-stage"><div class="fd-tilt">' +
          '<div class="fd-shadow" aria-hidden="true"></div>' +
          '<div class="fd-back" style="clip-path:path(\'' + BACK + '\')" aria-hidden="true"><img class="fd-art" src="' + esc(f.cover) + '" alt="" loading="lazy" draggable="false"><div class="fd-back-sheen"></div></div>' +
          '<svg class="fd-rim fd-back-rim" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + BACK + '"/></svg>' +
          '<div class="fd-files" role="list" aria-label="' + esc(f.label) + ' contents">' + sheets + '</div>' +
          '<div class="fd-front" style="clip-path:path(\'' + FRONT + '\')">' +
            '<div class="fd-tint" aria-hidden="true"></div>' +
            '<svg class="fd-rim fd-front-rim" viewBox="0 0 ' + W + ' ' + FRONT_H + '" aria-hidden="true"><defs><linearGradient id="fd-rim-' + fi + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient></defs><path d="' + FRONT + '" stroke="url(#fd-rim-' + fi + ')"/></svg>' +
            '<button type="button" class="fd-hit" aria-expanded="false" aria-label="Open ' + esc(f.label) + ', ' + count + '"></button>' +
            '<div class="fd-label"><span class="fd-kicker">' + esc(f.kicker || '') + '</span><span class="fd-title">' + esc(f.label) + '</span><span class="fd-meta">' + count + '</span></div>' +
            '<span class="fd-open-hint" aria-hidden="true">Open <b>→</b></span>' +
          '</div>' +
        '</div></div></div>';
    }).join('');

    var roots = Array.prototype.slice.call(grid.querySelectorAll('.fd'));
    function setOpen(root, on) {
      root.toggleAttribute('data-open', on);
      var hit = root.querySelector('.fd-hit'), label = root.querySelector('.fd-title').textContent, meta = root.querySelector('.fd-meta').textContent;
      hit.setAttribute('aria-expanded', String(on));
      hit.setAttribute('aria-label', (on ? 'Close ' : 'Open ') + label + ', ' + meta);
      root.querySelectorAll('.fd-sheet').forEach(function (s) { s.tabIndex = on ? 0 : -1; });
      if (on) { if (openOne && openOne !== root) setOpen(openOne, false); openOne = root; }
      else if (openOne === root) openOne = null;
    }
    roots.forEach(function (root) {
      root.querySelector('.fd-hit').addEventListener('click', function () { setOpen(root, !root.hasAttribute('data-open')); });
      // the light follows the cursor (mouse only), written straight to the element
      var raf = 0, px = 0, py = 0;
      root.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = root.getBoundingClientRect(); px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; root.style.setProperty('--px', px.toFixed(3)); root.style.setProperty('--py', py.toFixed(3)); });
      });
      root.addEventListener('pointerleave', function () { root.style.setProperty('--px', 0); root.style.setProperty('--py', 0); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openOne) { var r = openOne; setOpen(r, false); r.querySelector('.fd-hit').focus(); }
    });
    document.addEventListener('pointerdown', function (e) { if (openOne && !openOne.contains(e.target)) setOpen(openOne, false); });

    // Everything is drawn at 340 wide and scaled to the folder's real width.
    function fit() {
      roots.forEach(function (root) {
        var k = root.clientWidth / W;
        root.style.height = ((H + HEADROOM) * k) + 'px';
        root.querySelector('.fd-stage').style.transform = 'translateY(' + (HEADROOM * k) + 'px) scale(' + k + ')';
      });
    }
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(grid); else addEventListener('resize', fit);
    fit();

    // assemble the first time the row scrolls into view
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return; io.unobserve(e.target);
          var i = roots.indexOf(e.target); setTimeout(function () { e.target.setAttribute('data-entered', ''); }, (i % 3) * 120);
        });
      }, { threshold: .25 });
      roots.forEach(function (r) { io.observe(r); });
    } else roots.forEach(function (r) { r.setAttribute('data-entered', ''); });
  });
})();
