/* gate.js: the "Get started" entry gate for the front page. Plain JS, no libraries. Pair with gate.css.
 *
 * Why it exists: browsers only start audio after a click, tap or key. The visitor presses a button first, so the score can start the
 * instant they enter. Two ways in: "Get started" (with sound) and "Enter without sound" (stores sfx-on = 0 before sfx.js can arm).
 *
 * Load this file in <head> WITHOUT defer: it must mark <html> and publish window.__gate before the deferred scripts run.
 *   window.__gate = { open: false, then(fn) }   fn runs when the gate opens (at once if it already has). Absent when the gate is not
 *                                               shown (same session, other pages, ?gate=1 forces it), so callers start as before.
 *   'gate-open' is fired on document at the moment the curtain starts to part.
 *   'sfx-cue' {name:'gate'} is fired on enter (the button click is the audio gesture; nothing here stops propagation).
 *
 * Sequence: starfield + Earth limb + comets (canvas) -> `\7` mark and 7YMERA assemble (staggered clip) -> mono boot lines type in,
 * 1 px progress line, eased 000..100 counter (waits near 90 until window load) -> the button -> on enter: flash + ring pulses, warp,
 * boot text glitches out, the screen splits on a horizontal seam (Halcyon curtain) and the halves part, then everything is removed.
 * Reduced motion: no motion at all, button at once, a plain fade out. Only transform and opacity are animated.
 */
(function () {
  'use strict';
  var d = document, root = d.documentElement, w = window, me = d.currentScript, VER = '';
  try { VER = (me && me.src.match(/[?&]v=([^&]+)/) || [])[1] || ''; } catch (e) { /* ignore */ }

  /* ---- should it show? ---- */
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var q = '';
  try { q = new URLSearchParams(location.search).get('gate'); } catch (e) { /* old browser */ }
  var forced = q === '1';
  var path = location.pathname.replace(/index\.html$/, '');
  var onFront = path === '/' || path === '';
  // every load of the front page starts at the gate (owner, 22 Nov): it is also the gesture that lets the sound play
  if (!(forced || (onFront && !location.hash)) || q === '0') return;
  if (!d.addEventListener || !w.requestAnimationFrame) return;
  // a refresh lands back at the top, at the gate, not mid-flight where the browser would restore the scroll
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) { /* ignore */ }
  w.scrollTo(0, 0);

  var reduce = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var waiting = [], gate = { open: false, then: function (fn) { if (gate.open) { try { fn(); } catch (e) { /* ignore */ } } else waiting.push(fn); } };
  w.__gate = gate;
  root.classList.add('gate-on');

  /* sound: "Enter without sound" must store sfx-on = 0 BEFORE sfx.js sees the same gesture (it arms on pointerdown/keydown/click in
     the capture phase on window; listeners run in registration order and this file loads first). */
  var NOSOUND = '.gate-nosound';
  ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'].forEach(function (n) {
    w.addEventListener(n, function (e) {
      var t = e.target, hit = t && t.closest && t.closest(NOSOUND);
      if (!hit && n === 'keydown' && (e.key === 'Enter' || e.key === ' ') && d.activeElement && d.activeElement.matches && d.activeElement.matches(NOSOUND)) hit = true;
      if (hit) ls('sfx-on', '0');
    }, { capture: true, passive: true });
  });

  var soundOff = ls('sfx-on') === '0';
  var MARK = 'M12 8H40L81 108H53Z M94 8H154V29L122 108H96L127 31H94Z';
  var GLY = '#%&/\\<>=+*7YMERA01';
  var DUR = 2000;                   // the counter's eased run, ms
  var BOOT = ['> acquiring orbit', '> locking on Kuala Lumpur', '> score armed'];

  function el(tag, cls, html) { var n = d.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  var G = null;                     // the running gate
  function build() {
    if (G || !d.body) return;
    var tpl =
      '<div class="gate-live">' +
        '<canvas class="gate-cv" aria-hidden="true"></canvas>' +
        '<div class="gate-grain" aria-hidden="true"></div><div class="gate-vig" aria-hidden="true"></div>' +
        '<div class="gate-kl" aria-hidden="true"><i class="gate-kl-ring"></i><i class="gate-kl-dot"></i><span>KUALA LUMPUR<br>3.14&deg;N 101.69&deg;E</span></div>' +
        '<div class="gate-hud tl" aria-hidden="true"><i></i>[ 7YMERA ]</div>' +
        '<div class="gate-hud tr" aria-hidden="true">[ <b class="gate-status">BOOTING</b> ]<i></i></div>' +
        '<div class="gate-hud bl" aria-hidden="true"><i></i>[ <b class="gate-clock">--:--:--</b> MYT ]</div>' +
        '<div class="gate-hud br" aria-hidden="true">[ ENTRY 001 ]<i></i></div>' +
        '<div class="gate-core">' +
          '<div class="gate-brand">' +
            '<div class="gate-glow" aria-hidden="true"></div>' +
            '<svg class="gate-mark" viewBox="0 0 156 112" aria-hidden="true"><path class="gm-fill" d="' + MARK + '"/><path class="gm-line" d="' + MARK + '" pathLength="1"/></svg>' +
            '<h2 class="gate-word" id="gate-title"><span class="gate-sr">7YMERA</span>' +
              '7YMERA'.split('').map(function (c, i) { return '<span class="gw" aria-hidden="true" style="--i:' + i + '"><i>' + c + '</i></span>'; }).join('') +
            '</h2>' +
            '<p class="gate-tag" aria-hidden="true">[ Alif Najmi &middot; Business Analyst ]</p>' +
          '</div>' +
          '<div class="gate-stage">' +
            '<div class="gate-boot" aria-hidden="true">' +
              '<div class="gate-lines"><p></p><p></p><p></p></div>' +
              '<div class="gate-count"><span class="gate-num">000</span><span class="gate-pct">%</span></div>' +
              '<div class="gate-bar"><i></i></div>' +
            '</div>' +
            '<div class="gate-cta" hidden>' +
              '<div class="gate-btn-wrap">' +
                '<button class="gate-btn" type="button" aria-label="Get started, with sound">' +
                  '<span class="gate-btn-fill" aria-hidden="true"></span><span class="gate-btn-glint" aria-hidden="true"></span>' +
                  '<span class="gate-btn-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.6"/></svg></span>' +
                  '<span class="gate-btn-txt" aria-hidden="true"><span class="gate-btn-label">Get started</span><span class="gate-btn-sub">' + (soundOff ? 'sound is off' : 'with sound') + '</span></span>' +
                  '<span class="gate-btn-arr" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
                '</button>' +
              '</div>' +
              (soundOff ? '' : '<button class="gate-nosound" type="button">Enter without sound</button>') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<p class="gate-hp" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.6"/></svg><span>Best with headphones</span></p>' +
        '<p class="gate-credit" aria-hidden="true">Earth: NASA 3D Resources · NASA Blue Marble</p>' +
      '</div>' +
      '<p class="gate-sr" id="gate-desc">Entry screen. Choose Get started to enter with sound, or Enter without sound.</p>';

    var rootEl = el('div', 'gate' + (reduce ? ' reduce' : ''), tpl);
    rootEl.id = 'gate'; rootEl.setAttribute('role', 'dialog'); rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-labelledby', 'gate-title'); rootEl.setAttribute('aria-describedby', 'gate-desc'); rootEl.tabIndex = -1;
    function $(s) { return rootEl.querySelector(s); }
    try {   // film grain tile
      var gc = d.createElement('canvas'); gc.width = gc.height = 128; var gx = gc.getContext('2d'), id = gx.createImageData(128, 128), gi;
      for (gi = 0; gi < id.data.length; gi += 4) { var gv = Math.random() * 255; id.data[gi] = id.data[gi + 1] = id.data[gi + 2] = gv; id.data[gi + 3] = 255; }
      gx.putImageData(id, 0, 0); rootEl.querySelector('.gate-grain').style.backgroundImage = 'url(' + gc.toDataURL('image/png') + ')';
    } catch (e) { /* no grain */ }

    /* the page behind: unreachable until the gate opens */
    var behind = [];
    [].slice.call(d.body.children).forEach(function (n) {
      if (n.tagName === 'SCRIPT' || n.tagName === 'NOSCRIPT' || n.tagName === 'STYLE') return;
      behind.push({ n: n, a: n.getAttribute('aria-hidden'), i: n.hasAttribute('inert') });
      n.setAttribute('aria-hidden', 'true'); n.setAttribute('inert', '');
    });
    d.body.appendChild(rootEl);
    root.classList.add('gate-lock');
    root.classList.remove('gate-on');   // the overlay covers the page now; the pre-paint cover can go
    try { rootEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }

    var live = $('.gate-live'), cv = $('.gate-cv'), ctx = cv.getContext('2d'), kl = $('.gate-kl'), E = null, earthDone = false, earthOn = false, handed = null;
    var num = $('.gate-num'), bar = $('.gate-bar i'), lines = [].slice.call(rootEl.querySelectorAll('.gate-lines p'));
    var status = $('.gate-status'), clock = $('.gate-clock'), cta = $('.gate-cta'), btn = $('.gate-btn'), nos = $('.gate-nosound'), wrap = $('.gate-btn-wrap');
    var label = $('.gate-btn-label'), txt = $('.gate-btn-txt'), word = [].slice.call(rootEl.querySelectorAll('.gw i'));
    var state = 'boot', raf = 0, dead = false, timers = [];
    function later(fn, ms) { var t = setTimeout(function () { if (!dead) fn(); }, ms); timers.push(t); return t; }

    /* ---------------- the canvas: stars, comets, Earth's limb ---------------- */
    var W = 0, H = 0, dpr = 1, M = 24, earth = null, klPos = { x: 0, y: 0 };
    var stars = [], comets = [], nextComet = 1.4, px = 0, py = 0, tpx = 0, tpy = 0, warp = 0, tWarp = 0, t0 = performance.now(), last = t0;

    function rnd(a, b) { return a + Math.random() * (b - a); }
    function seed() {
      stars = [];
      var n = Math.round(clamp(W * H / 4200, 120, 340)), i;
      for (i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * .92, z: Math.pow(Math.random(), 1.6) * .85 + .15, tw: rnd(.6, 2.4), ph: rnd(0, 6.28), k: Math.random() < .14 ? 1 : Math.random() < .16 ? 2 : 0 });
    }
    function paintEarth() {
      if (E) { return; }
      var mobile = W < 640, ah = H * (mobile ? .2 : .3), R = Math.max(W * (mobile ? 2.1 : 1.3), 640), cx = W / 2 + M, cy = H + M + R - ah;
      var c = d.createElement('canvas'); c.width = Math.round((W + 2 * M) * dpr); c.height = Math.round((H + 2 * M) * dpr);
      var g = c.getContext('2d'); g.scale(dpr, dpr);
      var gr = g.createRadialGradient(cx, cy, R * .93, cx, cy, R * 1.2);   // atmosphere haze
      gr.addColorStop(0, 'rgba(60,140,255,.0)'); gr.addColorStop(.1, 'rgba(110,185,255,.5)'); gr.addColorStop(.2, 'rgba(70,140,255,.22)'); gr.addColorStop(.5, 'rgba(40,90,220,.07)'); gr.addColorStop(1, 'rgba(20,50,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.clip();   // the planet
      var b = g.createRadialGradient(cx, cy, R * .5, cx, cy, R);
      b.addColorStop(0, '#010309'); b.addColorStop(.82, '#03091a'); b.addColorStop(.94, '#0a1d3f'); b.addColorStop(.985, '#1f4f8e'); b.addColorStop(1, '#5aa0e6');
      g.fillStyle = b; g.fillRect(0, 0, c.width, c.height);
      var sun = g.createLinearGradient(cx + R * .35, cy - R, cx - R * .3, cy - R * .8);   // sunlit limb, upper right
      sun.addColorStop(0, 'rgba(170,215,255,.42)'); sun.addColorStop(1, 'rgba(120,180,255,0)');
      g.fillStyle = sun; g.fillRect(0, 0, c.width, c.height);
      var i, a, r, x, y, s;
      for (i = 0; i < 260; i++) {   // soft cloud streaks, tangent to the limb
        a = -1.5708 + rnd(-.42, .42) * (mobile ? .55 : 1) + (W * .02 / R); r = R * rnd(.8, .992); x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r; s = rnd(30, 130);
        g.save(); g.translate(x, y); g.rotate(a + 1.5708 + rnd(-.25, .25)); g.scale(1, rnd(.07, .2));
        var cg = g.createRadialGradient(0, 0, 0, 0, 0, s); var al = rnd(.03, .1) * (1 - (R - r) / (R * .2));
        cg.addColorStop(0, 'rgba(190,220,255,' + al.toFixed(3) + ')'); cg.addColorStop(1, 'rgba(190,220,255,0)');
        g.fillStyle = cg; g.beginPath(); g.arc(0, 0, s, 0, 6.2832); g.fill(); g.restore();
      }
      for (i = 0; i < 90; i++) {   // night-side city lights
        a = -1.5708 + rnd(-.5, .5); r = R * rnd(.9, .975); g.fillStyle = 'rgba(255,205,120,' + rnd(.15, .55).toFixed(2) + ')';
        g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rnd(.8, 1.8), rnd(.8, 1.8));
      }
      g.restore();
      var rim = g.createLinearGradient(0, 0, c.width / dpr, 0);   // the bright rim line
      rim.addColorStop(0, 'rgba(150,200,255,.15)'); rim.addColorStop(.62, 'rgba(210,235,255,.95)'); rim.addColorStop(1, 'rgba(150,200,255,.5)');
      g.strokeStyle = rim; g.lineWidth = 1.3; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.stroke();
      g.strokeStyle = 'rgba(110,180,255,.28)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R + 2, 0, 6.2832); g.stroke();
      earth = c;
      var kx = W * (mobile ? .66 : .6), s2 = (kx - W / 2) / (R * .965);   // Kuala Lumpur sits on the sunlit limb
      klPos.x = kx; klPos.y = cy - M - Math.sqrt(Math.max(0, 1 - s2 * s2)) * R * .965;
      kl.style.transform = 'translate3d(' + klPos.x.toFixed(1) + 'px,' + klPos.y.toFixed(1) + 'px,0)';
    }
    function resize() {
      W = Math.max(1, live.clientWidth || innerWidth); H = Math.max(1, live.clientHeight || innerHeight); dpr = Math.min(w.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      seed(); paintEarth(); rect = null; draw(0, performance.now());
    }
    function draw(dt, now) {
      var t = (now - t0) / 1000, i, s, k;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var ax = px * 14, ay = py * 9, cx0 = W / 2, cy0 = H * .46;
      var tint = ['rgba(255,255,255,', 'rgba(190,215,255,', 'rgba(255,224,170,'];
      for (k = 0; k < 3; k++) {
        if (warp > .02) ctx.strokeStyle = tint[k] + (.55 + warp * .4) + ')';
        ctx.beginPath();
        for (i = 0; i < stars.length; i++) {
          s = stars[i]; if (s.k !== k) continue;
          var x = s.x + ax * s.z - (reduce ? 0 : t * 2.2 * s.z), y = s.y + ay * s.z;
          x = ((x % W) + W) % W;
          var tw = reduce ? .8 : .6 + .4 * Math.sin(t * s.tw + s.ph);
          if (warp > .02) {
            var dx = x - cx0, dy = y - cy0, L = warp * (.18 + s.z * .5);
            ctx.lineWidth = .6 + s.z * 1.1; ctx.moveTo(x, y); ctx.lineTo(x + dx * L, y + dy * L);
          } else { ctx.fillStyle = tint[k] + (tw * (.35 + s.z * .65)).toFixed(2) + ')'; ctx.fillRect(x, y, s.z * 1.7 + .3, s.z * 1.7 + .3); }
        }
        if (warp > .02) ctx.stroke();
      }
      if (!reduce && warp < .4) {
        nextComet -= dt;
        if (nextComet <= 0 && comets.length < 2) { nextComet = rnd(3, 6.5); var a = rnd(.35, .6); comets.push({ x: rnd(W * .1, W * .95), y: rnd(-20, H * .25), vx: -Math.cos(a) * rnd(620, 980), vy: Math.sin(a) * rnd(380, 600), life: 0, len: rnd(110, 200) }); }
        for (i = comets.length - 1; i >= 0; i--) {
          var c = comets[i]; c.life += dt; c.x += c.vx * dt; c.y += c.vy * dt;
          var fade = Math.min(1, c.life * 5) * Math.max(0, 1 - c.life / 1.5), sp = Math.hypot(c.vx, c.vy), ux = c.vx / sp, uy = c.vy / sp;
          var gr = ctx.createLinearGradient(c.x, c.y, c.x - ux * c.len, c.y - uy * c.len);
          gr.addColorStop(0, 'rgba(255,240,215,' + (.9 * fade).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(120,170,255,0)');
          ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - ux * c.len, c.y - uy * c.len); ctx.stroke();
          if (c.life > 1.5 || c.y > H) comets.splice(i, 1);
        }
      }
      if (earth && !E) ctx.drawImage(earth, -M + px * -6, -M + py * -4 + warp * 34, W + 2 * M, H + 2 * M);
    }
    function frame(now) {
      raf = 0; if (dead) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      px += (tpx - px) * Math.min(1, dt * 3); py += (tpy - py) * Math.min(1, dt * 3);
      warp += (tWarp - warp) * Math.min(1, dt * 5);
      if (state === 'boot') counter(now);
      magnet(dt);
      drawEarth(dt);
      draw(dt, now);
      raf = requestAnimationFrame(frame);
    }
    function drawEarth(dt) {
      if (!E || !earthOn) return;
      var mobile = W < 640;
      E.setView({ arc: mobile ? .24 : .33, px: px, py: py, warp: warp, spin: reduce ? 0 : 1 });
      E.render(dt);
      var k = E.klScreen(); kl.style.transform = 'translate3d(' + k.x.toFixed(1) + 'px,' + k.y.toFixed(1) + 'px,0)'; kl.style.opacity = k.visible ? '' : '0';
    }
    var still = reduce;   // reduced motion: one frame, redrawn only when needed
    function kick() { if (!raf && !dead && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    /* ---------------- boot: typed lines, counter, progress ---------------- */
    var loaded = d.readyState === 'complete', cur = 0, bootT = performance.now(), readyAt = 0;
    if (!loaded) w.addEventListener('load', function () { loaded = true; }, { once: true });
    later(function () { loaded = true; earthDone = true; }, 7500);   // failsafe: never hang the gate on a stuck asset
    function counter(now) {
      var t = Math.min((now - bootT) / DUR, 1), p = 1 - Math.pow(1 - t, 2.4), cap = (loaded && earthDone) ? 1 : .9, target = Math.min(p, cap);
      cur += (target - cur) * .35; if (target >= 1 && cur > .996) cur = 1;
      var v = Math.round(cur * 100); num.textContent = ('00' + v).slice(-3); bar.style.transform = 'scaleX(' + cur.toFixed(4) + ')';
      if (cur >= 1 && !readyAt) { readyAt = now; later(ready, 320); }
    }
    function type(p, text, done) {
      var i = 0; p.textContent = '';
      (function step() { if (dead) return; if (state !== 'boot') { p.textContent = text; return; } i++; p.textContent = text.slice(0, i); if (i < text.length) later(step, 22); else if (done) done(); })();
    }
    function startBoot() {
      status.textContent = 'ACQUIRING';
      BOOT.forEach(function (s, i) { later(function () { type(lines[i], s); if (i === 1) kl.classList.add('lock'); if (i === 2) status.textContent = 'ARMED'; }, 160 + i * 620); });
      var tick = function () { try { clock.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false }); } catch (e) { clock.textContent = '--:--:--'; } };
      tick(); var ci = setInterval(function () { if (dead) clearInterval(ci); else tick(); }, 1000); timers.push(ci);
    }
    function ready() {
      if (state !== 'boot') return;
      state = 'ready'; status.textContent = 'READY';
      lines.forEach(function (p, i) { p.textContent = BOOT[i]; });   // typing can lag behind the counter on a slow machine: the log is complete when it docks
      kl.classList.add('lock');
      var fl = reduce ? [] : [lines[0].parentNode, $('.gate-count'), $('.gate-bar')].map(function (n) { return { n: n, a: n.getBoundingClientRect() }; });
      rootEl.classList.add('ready');
      cta.hidden = false; rect = null;
      fl.forEach(function (f) {   // the loading sequence stays: it glides from the centre to its dock (FLIP, transform only)
        var b = f.n.getBoundingClientRect(); if (!f.a.width || !b.width || !f.n.animate) return;
        f.n.style.transformOrigin = '0 0';
        f.n.animate([{ transform: 'translate3d(' + (f.a.left - b.left) + 'px,' + (f.a.top - b.top) + 'px,0) scale(' + (f.a.width / b.width) + ',' + (f.a.height / b.height) + ')' }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.76,0,.24,1)' });
      });
      try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }

    /* ---------------- the button: magnetic pull, scramble, keys ---------------- */
    var rect = null, mx = -1e4, my = -1e4, bx = 0, by = 0, scr = 0;
    function magnet(dt) {
      if (state !== 'ready' || reduce) return;
      if (!rect) { var r = wrap.getBoundingClientRect(); rect = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      var dx = mx - rect.x, dy = my - rect.y, dist = Math.hypot(dx, dy), pull = dist < 260 ? (1 - dist / 260) : 0;
      var tx = clamp(dx * .16 * (.35 + pull), -16, 16) * (pull ? 1 : 0), ty = clamp(dy * .22 * (.35 + pull), -12, 12) * (pull ? 1 : 0), k = Math.min(1, dt * 9);
      bx += (tx - bx) * k; by += (ty - by) * k;
      btn.style.transform = 'translate3d(' + bx.toFixed(2) + 'px,' + by.toFixed(2) + 'px,0)';
      txt.style.transform = 'translate3d(' + (bx * .35).toFixed(2) + 'px,' + (by * .35).toFixed(2) + 'px,0)';
    }
    function scramble(node, text, ms) {
      if (reduce || !node) return; var n = text.length, s = performance.now(), my = ++scr;
      (function step() {
        if (dead || my !== scr) return;
        var k = Math.floor(((performance.now() - s) / ms) * n), out = '', i, ch;
        for (i = 0; i < n; i++) { ch = text.charAt(i); out += i < k || ch === ' ' ? ch : GLY.charAt((Math.random() * GLY.length) | 0); }
        node.textContent = out;
        if (k < n) requestAnimationFrame(step); else node.textContent = text;
      })();
    }
    btn.addEventListener('pointerenter', function () { scramble(label, 'Get started', 420); });
    btn.addEventListener('focus', function () { scramble(label, 'Get started', 420); });
    btn.addEventListener('click', function () { enter(false); });
    if (nos) nos.addEventListener('click', function () { enter(true); });
    w.addEventListener('pointermove', onMove, { passive: true });
    function onMove(e) { mx = e.clientX; my = e.clientY; tpx = (e.clientX / Math.max(1, W)) * 2 - 1; tpy = (e.clientY / Math.max(1, H)) * 2 - 1; }
    if (reduce) { tpx = tpy = 0; }
    /* focus trap while the gate is up */
    rootEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [btn, nos].filter(function (n) { return n && !cta.hidden; });
      if (!f.length) { e.preventDefault(); rootEl.focus(); return; }
      var i = f.indexOf(d.activeElement);
      if (e.shiftKey) { if (i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } }
      else if (i === -1 || i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    d.addEventListener('focusin', function keep(e) { if (dead) { d.removeEventListener('focusin', keep); return; } if (!rootEl.contains(e.target)) { try { (state === 'ready' ? btn : rootEl).focus({ preventScroll: true }); } catch (x) { /* ignore */ } } });

    /* ---------------- enter: flash, rings, warp, glitch, split ---------------- */
    function ringPulse() {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, i;
      var f = el('i', 'gate-flash'); f.style.left = cx + 'px'; f.style.top = cy + 'px'; live.appendChild(f);
      for (i = 0; i < 3; i++) { var n = el('i', 'gate-pulse'); n.style.left = cx + 'px'; n.style.top = cy + 'px'; n.style.animationDelay = (i * 130) + 'ms'; live.appendChild(n); }
    }
    function glitchWord() {
      if (reduce) return; var s = performance.now();
      (function step() {
        if (dead) return; var k = (performance.now() - s) / 380;
        word.forEach(function (n, i) { n.textContent = k > .55 + i * .06 ? '' : GLY.charAt((Math.random() * GLY.length) | 0); });
        if (k < 1) requestAnimationFrame(step);
      })();
    }
    function enter(silent) {
      if (state !== 'ready') return;
      state = 'leaving';
      if (silent) ls('sfx-on', '0');
      ss('gate-seen', '1');
      try { d.dispatchEvent(new CustomEvent('sfx-cue', { detail: { name: 'gate' } })); } catch (e) { /* no sound */ }
      rootEl.classList.add('leaving'); btn.disabled = true; if (nos) nos.disabled = true; status.textContent = silent ? 'SILENT' : 'GO';
      if (reduce) { sweep(); return; }
      ringPulse(); tWarp = 1; kick();
      later(glitchWord, 120);
      later(sweep, 560);
    }
    /* the chess grid covers the gate (navy and gold blocks slide in from the right), the page is set underneath (gate dismissed, the Earth handed to
       the reveal), then the blocks sweep out to the left onto the \7 glass on the Earth. No grid script (or it throws): the old split seam. */
    function sweep() {
      if (!w.ChessGrid) { if (reduce) { rootEl.classList.add('fade'); later(function () { opened(); finish(); }, 420); } else split(); return; }
      var m = innerWidth < 640;
      try {
        w.ChessGrid.play({ cols: m ? 6 : 8, color: '#040b1f', color2: '#0f2a5e', edge: 'rgba(255,210,122,.38)', duration: m ? .62 : .72, onCovered: function () { try { drawEarth(0); } catch (e) { /* ignore */ } opened(); finish(); } });
      } catch (e) { if (w.console) console.warn(e); opened(); finish(); }
    }
    function snapshot(cy) {   // freeze the current frame into two halves
      var src = cv;
      if (E && earthOn) { drawEarth(0); src = d.createElement('canvas'); src.width = cv.width; src.height = cv.height; var sc = src.getContext('2d'); sc.drawImage(cv, 0, 0); sc.drawImage(E.canvas, 0, 0, src.width, src.height); }
      var h2 = Math.round(cv.height / 2), top = el('div', 'gate-half g-top'), bot = el('div', 'gate-half g-bot'), a = d.createElement('canvas'), b = d.createElement('canvas');
      a.width = b.width = cv.width; a.height = h2; b.height = cv.height - h2;
      a.getContext('2d').drawImage(src, 0, 0, cv.width, h2, 0, 0, cv.width, h2);
      b.getContext('2d').drawImage(src, 0, h2, cv.width, cv.height - h2, 0, 0, cv.width, cv.height - h2);
      top.appendChild(a); bot.appendChild(b); return [top, bot];
    }
    function split() {
      draw(0, performance.now());
      var halves = snapshot(), seam = el('i', 'gate-seam');
      live.hidden = true;
      halves.forEach(function (h) { rootEl.appendChild(h); }); rootEl.appendChild(seam);
      rootEl.classList.add('g-split');
      void rootEl.offsetWidth;
      opened();
      rootEl.classList.add('g-go');
      later(finish, 1250);
    }
    function opened() {
      if (gate.open) return;
      gate.open = true; root.classList.remove('gate-lock');
      /* hand the live Earth to the page (assets/home/orbit.js picks it up in its gate.then callback below): the reveal behind the halves is the
         same instance, same view, so the shot does not cut. If nobody takes it, finish() disposes it as before. */
      if (E && earthOn && !w.__orbitEarth) { drawEarth(0); handed = E; w.__orbitEarth = E; E = null; earthOn = false; }
      behind.forEach(function (b) { if (b.a == null) b.n.removeAttribute('aria-hidden'); else b.n.setAttribute('aria-hidden', b.a); if (!b.i) b.n.removeAttribute('inert'); });
      try { d.dispatchEvent(new CustomEvent('gate-open')); } catch (e) { /* ignore */ }
      var f = waiting.splice(0); f.forEach(function (fn) { try { fn(); } catch (e) { if (w.console) console.warn(e); } });
    }
    function finish() {
      if (dead) return; dead = true; cancelAnimationFrame(raf); timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      w.removeEventListener('pointermove', onMove);
      if (E) { E.dispose(); E = null; }
      if (handed && w.__orbitEarth === handed) { handed.dispose(); w.__orbitEarth = null; }   // not taken: free it
      cv.width = cv.height = 0; earth = null; stars = [];
      [].slice.call(rootEl.querySelectorAll('canvas')).forEach(function (c) { c.width = c.height = 0; });
      rootEl.remove(); root.classList.remove('gate-lock', 'gate-on'); G = null;
      try { if (d.activeElement && d.activeElement !== d.body) d.activeElement.blur(); } catch (e) { /* ignore */ }
    }

    var ro = w.ResizeObserver ? new ResizeObserver(function () { if (!dead) { resize(); if (still) draw(0, performance.now()); } }) : null;
    if (ro) ro.observe(live); else w.addEventListener('resize', resize);
    try {
      if (w.OrbitEarth && w.THREE) {
        E = w.OrbitEarth.mount(live, { autoStart: false, className: 'gate-earth', v: VER, arc: innerWidth < 640 ? .24 : .33, spin: reduce ? 0 : 1 });
        if (E) {
          live.insertBefore(E.canvas, cv.nextSibling);
          E.ready.then(function (ok) {
            earthDone = true;
            if (dead) return;
            if (!ok) { E.dispose(); E = null; paintEarth(); draw(0, performance.now()); return; }
            earthOn = true; rootEl.classList.add('earth-in'); drawEarth(0); if (still) { draw(0, performance.now()); }
          });
        }
      }
    } catch (e) { E = null; if (w.console) console.warn(e); }
    if (!E) earthDone = true;
    resize();
    G = { root: rootEl, enter: enter };
    if (reduce) { status.textContent = 'READY'; num.textContent = '100'; bar.style.transform = 'scaleX(1)'; lines.forEach(function (p, i) { p.textContent = BOOT[i]; }); state = 'boot'; ready(); tick0(); }
    else { startBoot(); kick(); }
    function tick0() { try { clock.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false }); } catch (e) { /* ignore */ } }
    d.addEventListener('visibilitychange', function () { if (!d.hidden) { last = performance.now(); } });
  }

  try {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build, { once: true }); else build();
  } catch (e) {
    if (w.console) console.warn('gate failed, opening', e);
    root.classList.remove('gate-on', 'gate-lock'); gate.open = true; waiting.splice(0).forEach(function (fn) { try { fn(); } catch (x) { /* ignore */ } });
  }
})();
