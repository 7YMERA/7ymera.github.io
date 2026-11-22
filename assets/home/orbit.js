/* orbit.js: the one HD Earth behind the front page's first two chapters (00 Mark and 01 Descent). Plain JS; needs earth.js and three.js r128.
 *
 * One fixed layer (#orbit, deep space) holds one OrbitEarth canvas for the whole sequence:
 *   gate      the entry gate shows the Earth; when it opens it hands the same instance over (window.__orbitEarth, see gate.js), so the picture
 *             does not change as the two halves slide apart. With no gate (?gate=0) the stage mounts its own and fades it in.
 *   00 Mark   the glass reveal sits on it: glass-reveal.js samples this canvas (setEarth) and refracts it.
 *   scroll    from #reveal into #descent the camera moves from the gate's limb view to the descent's "408 km up" frame.
 *   01 Descent  descent.js drives the camera from its own smoothed progress (zoom about Kuala Lumpur, tilt to look straight down) and draws its
 *             gold Malaysia trace, rails, cities and reticle on its 2D canvas through stage.project(lat, lon), so they sit on the real map.
 *             The imagery is only good to about 5x zoom (4k texture), so the Earth fades out between p = .24 and .4 into the descent's deep blue; the camera maths
 *             keeps running (noDraw) so the overlays stay registered until p = .9, where the Earth is disposed (the 3D city takes over at .88).
 *
 *   OrbitStage.intent   true while the stage wants the page dark (html.orbit-live); false if WebGL / three.js / the textures failed
 *   OrbitStage.live     an Earth exists and is ready      OrbitStage.amt   0..1 fade-in of the Earth (the glass uses it)
 *   OrbitStage.frame(now, urgent)   update the pose and render one frame (once per animation frame; callers: descent, glass, own loop)
 *   OrbitStage.project(lat, lon)    {x, y, visible} in the layer's CSS px      OrbitStage.onFrame(fn(canvas)) / offFrame(fn)
 * Reduced motion: no camera animation; three still frames (reveal, orbit, Malaysia) with a quick fade through black between them.
 */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement, me = d.currentScript, VER = '';
  try { VER = (me && me.src.match(/[?&]v=([^&]+)/) || [])[1] || ''; } catch (e) { /* ignore */ }
  var reduce = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var st = { intent: true, live: false, amt: 0, ek: 1, W: 1, H: 1, canvas: null, descent: null, p: 0 };
  w.OrbitStage = st;
  var cbs = [];
  st.onFrame = function (fn) { if (cbs.indexOf(fn) < 0) cbs.push(fn); };
  st.offFrame = function (fn) { var i = cbs.indexOf(fn); if (i >= 0) cbs.splice(i, 1); };
  st.project = function (lat, lon) { return E ? E.project(lat, lon) : { x: -9999, y: -9999, visible: false }; };
  st.klScreen = function () { return E ? E.klScreen() : null; };

  var E = null, layer = null, loading = false, raf = 0, lastNow = 0, lastRender = 0, lastY = -1, lastMove = 0, stamp = -1;
  var sa = 0, sv = 0, rise = 1, warp = 0, px = 0, py = 0, geomT = 0, descTop = 0, descH = 1, curKey = -1, swapT = 0, gone = false;
  var rv = d.getElementById('reveal'), dsEl = d.getElementById('descent'), main = d.getElementById('main');
  if (!rv || !dsEl || !main) { st.intent = false; return; }
  root.classList.add('orbit-live');

  function geom() {
    var r = dsEl.getBoundingClientRect(), y = w.pageYOffset || 0;
    descTop = r.top + y; descH = r.height; geomT = performance.now();
  }
  /* the descent's own progress; when its loop is not running (off screen) the raw scroll gives the same number */
  function descentP() {
    var ds = st.descent;
    if (ds && ds.visible) return ds.ps;
    var q = clamp(((w.pageYOffset || 0) - descTop) / Math.max(1, descH - (w.innerHeight || 1)), 0, 1);
    return q;
  }

  /* ---- poses ---- */
  /* the gate's limb view (arc .33 / .24) is where the shot starts; while the glass plays the camera tips down and the limb rises to sit behind the
     lower part of the tile (`rise` 0 -> 1); the descent's first frame is a little higher still on desktop, a little lower on a phone */
  function pReveal(W, rise) { var m = W < 640, arc = lerp(m ? .24 : .33, m ? .56 : .52, sstep(0, 1, rise)); return { arc: arc, ax: m ? .32 : .2, ay: (2 * arc - 1) - .17 }; }
  function pDescent(W) { return { arc: W < 640 ? .5 : .56, ax: 0, ay: -.2 }; }
  function pose(a, pp) {
    var W = st.W, R = pReveal(W, rise), D = pDescent(W), e = sstep(0, 1, a), z = clamp((pp - .05) / .8, 0, 1), ez = sstep(0, 1, z), tilt = sstep(0, .5, z * 1.35);
    return {
      arc: lerp(R.arc, D.arc, e), ax: lerp(R.ax, D.ax, e), ay: lerp(R.ay, D.ay, e) + .12 * ez,
      zoom: Math.exp(Math.log(900) * Math.pow(z, 1.25)),   // slower than the old 2D globe at first: the 4k map only holds up to about 5x
      tilt: tilt, sunK: tilt * .85,
      pin: sstep(0, .85, a)   // pin must reach exactly 1: any residue is multiplied by the zoom
    };
  }

  /* ---- one frame ---- */
  st.frame = function (now, urgent) {
    if (!E || !st.live || now === stamp) return false;
    var y = w.pageYOffset || 0;
    if (y !== lastY) { lastY = y; lastMove = now; }
    var dt = lastNow ? Math.min(.05, (now - lastNow) / 1000) : .016;
    var moving = now - lastMove < 700 || Math.abs(sa - (descTop > 0 ? clamp(y / descTop, 0, 1) : 0)) > .002 || warp > .02 || st.amt < 1;
    if (!urgent && !moving && now - lastRender < 30) return false;
    stamp = now; lastNow = now; lastRender = now;
    if (now - geomT > 1500) geom();
    var a = descTop > 0 ? clamp(y / descTop, 0, 1) : 0, real = descentP(), pp = real, key = 0;
    if (reduce) {
      key = (a < .5 ? 0 : 2) + (real < .12 ? 0 : 1);
      if (curKey < 0) curKey = key;
      else if (key !== curKey && !swapT) {   // three still frames: fade out, change the frame, fade back in
        layer.classList.add('swap'); swapT = setTimeout(function () { swapT = 0; curKey = key; layer.classList.remove('swap'); }, 240);
      }
      sa = (curKey & 2) ? 1 : 0; pp = (curKey & 1) ? .26 : 0;
    } else {   // critically damped follow of the scroll, the same feel as the descent's own spring
      var o = 2 / .35, x = o * dt, ex = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = sa - a, tmp = (sv + o * ch) * dt;
      sv = (sv - o * tmp) * ex; sa = a + (ch + tmp) * ex;
    }
    st.p = real; st.sa = sa;
    var ps = pose(sa, pp);
    rise = Math.min(1, rise + dt / 2.6);
    px += (0 - px) * Math.min(1, dt * 3); py += (0 - py) * Math.min(1, dt * 3); warp += (0 - warp) * Math.min(1, dt * 2.5);
    ps.px = px; ps.py = py; ps.warp = warp; ps.spin = reduce ? 0 : 1;
    E.setView(ps);
    // the Earth is only worth drawing while its imagery holds up; the maths keeps running for the overlays
    st.ek = 1 - sstep(.24, .4, real);
    var shown = st.ek > .004 && real < .5;
    if (st.amt < 1) st.amt = Math.min(1, st.amt + dt / .9);
    E.render(dt, !shown);
    var cv = E.canvas; cv.style.opacity = shown ? (st.amt * st.ek).toFixed(3) : '0';
    sync();
    if (shown) for (var i = 0; i < cbs.length; i++) { try { cbs[i](cv); } catch (e) { if (w.console) console.warn(e); } }
    if (real > .9) release();
    return true;
  };

  function sync() { var g = descentP() >= .5; if (g !== gone) { gone = g; if (layer) layer.classList.toggle('gone', g); } }
  function size() { st.W = layer.clientWidth || w.innerWidth; st.H = layer.clientHeight || w.innerHeight; }

  /* ---- own loop (the descent and the glass drive frames themselves while they run) ---- */
  function loop(now) {
    raf = 0; if (!E || !st.live || d.hidden || gone) return;
    var ds = st.descent;
    if (!(ds && ds.raf)) st.frame(now, false);
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && E && st.live && !d.hidden && !gone) raf = requestAnimationFrame(loop); }
  w.addEventListener('scroll', function () { sync(); ensure(); kick(); }, { passive: true });
  d.addEventListener('visibilitychange', function () { if (!d.hidden) { lastNow = 0; kick(); } });
  w.addEventListener('resize', function () { geom(); size(); });
  w.addEventListener('load', geom);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(geom);

  /* ---- mount / hand-over / release ---- */
  function build() {
    layer = d.createElement('div'); layer.id = 'orbit'; layer.className = 'orbit'; layer.setAttribute('aria-hidden', 'true');
    main.parentNode.insertBefore(layer, main); size(); geom();
  }
  function fail() {
    st.intent = false; st.live = false; root.classList.remove('orbit-live');
    if (E) { try { E.dispose(); } catch (e) { /* gone */ } E = null; }
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    try { d.dispatchEvent(new CustomEvent('orbit-state', { detail: { intent: false } })); } catch (e) { /* ignore */ }
  }
  function adopt(e, fromGate) {
    E = e; st.live = true; st.canvas = e.canvas; size();
    e.setSpace(true);
    if (fromGate) {
      e.attach(layer, 'orbit-earth'); st.amt = 1; rise = reduce ? 1 : 0;
      px = e.view.px || 0; py = e.view.py || 0; warp = e.view.warp || 0;
    } else { st.amt = 0; e.canvas.style.opacity = '0'; }
    e.setView({ spin: reduce ? 0 : 1 });
    lastNow = 0; stamp = -1; sv = 0; geom(); sa = descTop > 0 ? clamp((w.pageYOffset || 0) / descTop, 0, 1) : 0; sync();
    var t = performance.now(); st.frame(t, true);   // paint now, in this task: the gate's halves are about to leave
    kick();
  }
  function mountOwn() {
    if (loading || E || !st.intent || !w.OrbitEarth || !w.THREE) return;
    loading = true;
    var W = layer.clientWidth || w.innerWidth, e = w.OrbitEarth.mount(layer, { autoStart: false, space: true, className: 'orbit-earth', v: VER, arc: W < 640 ? .24 : .33, spin: reduce ? 0 : 1 });
    if (!e) { loading = false; fail(); return; }
    e.canvas.style.opacity = '0';
    e.ready.then(function (ok) { loading = false; if (!ok) { e.dispose(); fail(); return; } adopt(e, false); });
  }
  function release() {
    if (!E) return;
    try { E.dispose(); } catch (e) { /* gone */ }
    E = null; st.live = false; st.canvas = null; st.amt = 0;
  }
  function ensure() {   // scrolled back up from the city: bring the Earth back
    if (E || loading || !st.intent || booted === false) return;
    if (descentP() < .86) mountOwn();
  }

  var booted = false;
  function boot() {
    if (!w.THREE || !w.OrbitEarth) { fail(); return; }
    build(); booted = true;
    var take = function () {
      var g = w.__orbitEarth;
      if (g) { w.__orbitEarth = null; adopt(g, true); }
      else if (descentP() < .86) mountOwn();
    };
    if (w.__gate && !w.__gate.open && w.__gate.then) w.__gate.then(take); else take();
  }
  // deferred scripts run while readyState is 'interactive' and three.js (last in the page) has not run yet: wait for DOMContentLoaded
  if (d.readyState === 'complete') boot(); else d.addEventListener('DOMContentLoaded', boot, { once: true });
})();
