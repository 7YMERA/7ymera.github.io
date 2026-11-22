/* chess-grid.js: "Chess Grid Transition", ported to plain JS (no React, no GSAP). Plain script, no dependencies.
 *
 * Ported from the 21st.dev "Chess Grid Transition" (Hyperiux Vault, https://vault.hyperiux.com). A fixed full-screen grid of blocks:
 * each block slides in from the right to cover the view (staggered diagonally), the caller swaps what is underneath, then the blocks
 * slide out to the left to reveal it.
 *
 *   ChessGrid.play({ cols, color, color2, edge, duration, onCovered, onDone })
 *     cols        4..16, default 8                        color / color2   block colours (a chess pattern if both are given)
 *     edge        optional hairline colour inset on every block
 *     duration    seconds scale, default 1 (a block's slide is .8 * duration, the stagger step .1 * duration)
 *     onCovered   called once, when the whole view is covered: swap the page underneath here
 *     onDone      called when the grid has gone and been removed
 *   returns { cancel() }.   ChessGrid.playing   true while a grid is on screen.
 *
 * Layout is the original's: rows follow the viewport (phone <= 639 px: cols * 1.125 rows and blocks 1.6 x wide; tablet <= 1025: cols * 1.25;
 * desktop: cols * .5), a 2 px overlap hides the seams. Easing: power2.out to cover, power2.in to leave (cubic-bezier equivalents).
 * Only `transform` and `opacity` animate, through the Web Animations API (a plain rAF timer where that is missing).
 * The grid is fixed, aria-hidden, pointer-events none, z-index 1100 (above the entry gate's 1000).
 * Reduced motion: no blocks at all, a plain .2 s opacity fade of one colour over the view and back.
 */
(function () {
  'use strict';
  var w = window, d = document;
  var OVERLAP = 2, FADE = 0.2, OUT = 'cubic-bezier(.5,1,.89,1)', IN = 'cubic-bezier(.11,0,.5,0)';   // power2.out / power2.in
  var CG = { playing: false };
  w.ChessGrid = CG;

  function layout() { var x = w.innerWidth; return x <= 639 ? 'mobile' : x <= 1025 ? 'tablet' : 'desktop'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function reduced() { return !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function anim(node, frames, opt) {
    if (node.animate) return node.animate(frames, opt);
    var a = { finished: null, cancel: function () {} };   // no WAAPI: jump to the end state
    var last = frames[frames.length - 1];
    for (var k in last) if (k !== 'offset' && k !== 'easing') node.style[k] = last[k];
    a.finished = Promise.resolve(); return a;
  }

  CG.play = function (o) {
    o = o || {};
    var cols = clamp(Math.round(o.cols || 8), 4, 16), D = o.duration > 0 ? o.duration : 1, c1 = o.color || '#07122b', c2 = o.color2 || c1, edge = o.edge || '';
    var lay = layout(), rows = lay === 'mobile' ? Math.max(4, Math.round(cols * 1.125)) : lay === 'tablet' ? Math.max(4, Math.round(cols * 1.25)) : Math.max(2, Math.round(cols * 0.5));
    var ws = lay === 'mobile' ? 1.6 : 1, dead = false, anims = [], covered = false;
    var wrap = d.createElement('div');
    wrap.className = 'chess-grid'; wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:1100;overflow:hidden;pointer-events:none;';
    CG.playing = true;
    function done() {
      if (dead) return; dead = true; CG.playing = false;
      anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } });
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (o.onDone) { try { o.onDone(); } catch (e) { if (w.console) console.warn(e); } }
    }
    function swap() { if (covered) return; covered = true; if (o.onCovered) { try { o.onCovered(); } catch (e) { if (w.console) console.warn(e); } } }
    d.body.appendChild(wrap);

    if (reduced()) {   // one colour, a quick fade in, swap, fade out
      wrap.style.background = c1; wrap.style.opacity = '0';
      var a1 = anim(wrap, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE * 1000, fill: 'forwards', easing: 'ease' }); anims.push(a1);
      (a1.finished || Promise.resolve()).then(function () {
        if (dead) return; swap();
        var a2 = anim(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE * 1000, fill: 'forwards', easing: 'ease' }); anims.push(a2);
        (a2.finished || Promise.resolve()).then(done, done);
      }, done);
      return { cancel: done };
    }

    var step = 0.1 * D, blockT = 0.8 * D * 1000, cells = [], r, c, n, last = 0;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      n = d.createElement('div');
      n.style.cssText = 'position:absolute;will-change:transform;backface-visibility:hidden;' +
        'width:calc(100%/' + cols + '*' + ws + ' + ' + OVERLAP + 'px);height:calc(100%/' + rows + ' + ' + OVERLAP + 'px);' +
        'left:calc(' + c + '*100%/' + cols + '*' + ws + ' - ' + (OVERLAP / 2) + 'px);top:calc(' + r + '*100%/' + rows + ' - ' + (OVERLAP / 2) + 'px);' +
        'background:' + ((r + c) % 2 ? c2 : c1) + ';' + (edge ? 'box-shadow:inset 0 0 0 1px ' + edge + ';' : '') + 'transform:translate3d(' + ((cols - c + 1) * 100) + '%,0,0);';
      wrap.appendChild(n); cells.push({ n: n, r: r, c: c });
      last = Math.max(last, (r + c) * step * 1000);
    }
    var coverEnd = last + blockT, revealEnd = last + blockT;
    cells.forEach(function (k) {   // cover: from the right, power2.out
      var delay = (k.r * step + k.c * step) * 1000;
      anims.push(anim(k.n, [{ transform: 'translate3d(' + ((cols - k.c + 1) * 100) + '%,0,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: blockT, delay: delay, fill: 'both', easing: OUT }));
    });
    var t0 = performance.now();
    (function wait() {   // one timer for the whole cover (blocks may be many; the last one defines the end)
      if (dead) return;
      if (performance.now() - t0 < coverEnd) { setTimeout(wait, 30); return; }
      swap();
      anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } }); anims = [];
      cells.forEach(function (k) { k.n.style.transform = 'translate3d(0,0,0)'; });
      cells.forEach(function (k) {   // reveal: out to the left, power2.in
        var delay = (k.r * step + k.c * step) * 1000;
        anims.push(anim(k.n, [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(' + (-(k.c + 2) * 100) + '%,0,0)' }], { duration: blockT, delay: delay, fill: 'both', easing: IN }));
      });
      setTimeout(done, revealEnd + 80);
    })();
    return { cancel: done };
  };
})();
