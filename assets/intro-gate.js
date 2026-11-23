/* intro-gate.js: World-class full-bleed interactive Canvas2D entry gates for Play, Lab, Portfolio & Notes
   + scroll-driven 3D Hardcover Journal Book Flip on /notes/.
   Zero external libraries, capped DPR, clean rAF teardown on exit, reduced-motion safe. */
(function () {
  'use strict';
  var d = document, w = window, path = (location.pathname || '/').toLowerCase();
  var page = path.indexOf('/play') === 0 ? 'play'
    : path.indexOf('/lab') === 0 ? 'lab'
    : path.indexOf('/portfolio') === 0 ? 'portfolio'
    : path.indexOf('/notes') === 0 && (path === '/notes/' || path === '/notes/index.html') ? 'notes'
    : '';
  if (!page) return;

  var reduce = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MARK = 'M12 8H40L81 108H53Z M94 8H154V29L122 108H96L127 31H94Z';
  var GLY = '#%&/\\<>=+*7YMERA01';
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mytClock() {
    try { return new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false }); }
    catch (e) { return '--:--:--'; }
  }

  function unlockAudio() {
    try { localStorage.setItem('sfx-on', '1'); } catch (e) {}
    if (!w.SFX) return;
    try { SFX.set(true); } catch (e) {}
    setTimeout(function () {
      try {
        if (page === 'play') {
          SFX.beep(988, .08, 'square', .08);
          setTimeout(function () { SFX.beep(1319, .26, 'square', .085); }, 85);
        } else if (page === 'lab') {
          SFX.cue('sat-on');
        } else if (page === 'notes') {
          SFX.chime(0);
          setTimeout(function () { SFX.chime(4); }, 110);
        } else {
          SFX.done();
        }
      } catch (e) {}
    }, 80);
  }

  /* ==================== FULL-BLEED LIVING CANVAS WORLDS ==================== */
  function startCanvas(cv, mode) {
    var ctx = cv.getContext('2d');
    if (!ctx) return { trigger: function () {}, stop: function () {} };
    var W = 1, H = 1, dpr = 1, raf = 0, dead = false;
    var px = 0, py = 0, tpx = 0, tpy = 0, burst = 0, burstAt = 0;
    var sparks = [];

    function resize() {
      W = Math.max(1, w.innerWidth); H = Math.max(1, w.innerHeight);
      dpr = Math.min(w.devicePixelRatio || 1, W <= 820 ? 1.05 : 1.35);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    resize();

    function onMove(e) {
      tpx = (e.clientX / Math.max(1, W)) * 2 - 1;
      tpy = (e.clientY / Math.max(1, H)) * 2 - 1;
    }
    w.addEventListener('pointermove', onMove, { passive: true });
    w.addEventListener('resize', resize);

    // Per-mode procedural seeds
    var stars = [], i;
    for (i = 0; i < (W <= 820 ? 65 : 120); i++) {
      stars.push({ x: Math.random(), y: Math.random() * .62, r: .6 + Math.random() * 1.4, ph: Math.random() * 6.28, sp: .8 + Math.random() * 2 });
    }
    // Lab 3D Fibonacci sphere points
    var sphere = [], SN = W <= 820 ? 110 : 175, phiG = Math.PI * (3 - Math.sqrt(5));
    for (i = 0; i < SN; i++) {
      var y = 1 - (i / (SN - 1)) * 2, rad = Math.sqrt(1 - y * y), th = phiG * i;
      sphere.push({ x: Math.cos(th) * rad, y: y, z: Math.sin(th) * rad, gold: i % 9 === 0, sz: 1.2 + (i % 4) * .55 });
    }
    // Portfolio golden dust motes
    var motes = [];
    for (i = 0; i < 42; i++) motes.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .012, vy: -.008 - Math.random() * .014, r: 1 + Math.random() * 1.8, a: .25 + Math.random() * .55 });
    // Notes floating directory cards
    var folders = [];
    for (i = 0; i < 18; i++) folders.push({ x: Math.random(), y: Math.random(), z: .35 + Math.random() * .85, s: 18 + Math.random() * 22, ph: Math.random() * 6.28 });

    function drawKLHorizon(g, cx, hy, sc, alpha, strokeOnly) {
      g.save(); g.translate(cx, hy); g.scale(sc, sc);
      if (strokeOnly) { g.strokeStyle = 'rgba(127,211,255,' + alpha + ')'; g.lineWidth = 1.2 / sc; }
      else { g.fillStyle = 'rgba(4,10,26,' + alpha + ')'; g.strokeStyle = 'rgba(255,210,122,' + (alpha * .55) + ')'; g.lineWidth = 1.1 / sc; }
      // Menara KL (left)
      g.beginPath(); g.moveTo(-210, 0); g.lineTo(-206, -98); g.lineTo(-215, -108); g.lineTo(-215, -118); g.lineTo(-203, -124); g.lineTo(-203, -158);
      g.lineTo(-200, -158); g.lineTo(-200, -124); g.lineTo(-188, -118); g.lineTo(-188, -108); g.lineTo(-197, -98); g.lineTo(-193, 0); g.closePath();
      if (!strokeOnly) g.fill(); g.stroke();
      // Petronas Twin Towers (center-left)
      [-86, -42].forEach(function (tx) {
        g.beginPath(); g.moveTo(tx - 14, 0); g.lineTo(tx - 12, -108); g.lineTo(tx - 8, -138); g.lineTo(tx - 3, -152);
        g.lineTo(tx, -176); g.lineTo(tx + 3, -152); g.lineTo(tx + 8, -138); g.lineTo(tx + 12, -108); g.lineTo(tx + 14, 0); g.closePath();
        if (!strokeOnly) g.fill(); g.stroke();
      });
      // Skybridge
      g.beginPath(); g.rect(-72, -82, 16, 6); if (!strokeOnly) g.fill(); g.stroke();
      // Merdeka 118 (center-right, tallest)
      g.beginPath(); g.moveTo(32, 0); g.lineTo(44, -142); g.lineTo(58, -178); g.lineTo(66, -184); g.lineTo(70, -242);
      g.lineTo(73, -184); g.lineTo(86, -162); g.lineTo(94, 0); g.closePath();
      if (!strokeOnly) g.fill(); g.stroke();
      // Exchange 106 (right, glowing faceted crown)
      g.beginPath(); g.moveTo(156, 0); g.lineTo(158, -142); g.lineTo(166, -166); g.lineTo(186, -166); g.lineTo(194, -142); g.lineTo(196, 0); g.closePath();
      if (!strokeOnly) g.fill(); g.stroke();
      g.restore();
    }

    var tStart = performance.now(), scrollZ = 0;
    function frame(now) {
      if (dead) return;
      var t = (now - tStart) * .001;
      px += (tpx - px) * .06; py += (tpy - py) * .06;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var bEl = burst ? clamp((now - burstAt) / 700, 0, 1) : 0;

      if (mode === 'play') {
        /* 1. PLAY: Synthwave Cobalt-Gold Outrun Grid + KL Horizon Silhouette + Coin Sparks */
        var hy = H * .56 + py * 14;
        var sky = ctx.createLinearGradient(0, 0, 0, hy);
        sky.addColorStop(0, '#020612'); sky.addColorStop(.68, '#0b1c44'); sky.addColorStop(1, '#2a3d68');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy);
        // Horizon golden sun-band
        var glow = ctx.createRadialGradient(W * .5 - px * 26, hy, 8, W * .5 - px * 26, hy, Math.max(W, H) * .48);
        glow.addColorStop(0, 'rgba(255,214,132,.46)'); glow.addColorStop(.45, 'rgba(58,160,238,.22)'); glow.addColorStop(1, 'rgba(3,8,20,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        // Stars
        for (i = 0; i < stars.length; i++) {
          var s = stars[i], a = .28 + .65 * (.5 + .5 * Math.sin(t * s.sp + s.ph));
          ctx.fillStyle = 'rgba(225,240,255,' + a.toFixed(2) + ')';
          ctx.fillRect(s.x * W - px * 16 * s.r, s.y * hy, s.r, s.r);
        }
        // KL Skyline silhouette right on the horizon
        var kSc = clamp(W / 680, .62, 1.28);
        drawKLHorizon(ctx, W * .5 - px * 22, hy + 2, kSc, .92, false);
        // Ground floor
        var gnd = ctx.createLinearGradient(0, hy, 0, H);
        gnd.addColorStop(0, '#07132c'); gnd.addColorStop(1, '#02050e');
        ctx.fillStyle = gnd; ctx.fillRect(0, hy, W, H - hy);
        // Perspective scrolling grid (accelerates 6x on coin drop!)
        scrollZ = (scrollZ + (burst ? .095 : .016)) % 1;
        ctx.strokeStyle = 'rgba(58,160,238,.42)'; ctx.lineWidth = 1.1;
        var vpX = W * .5 - px * 42;
        for (i = -12; i <= 12; i++) {
          ctx.beginPath(); ctx.moveTo(vpX + i * 26, hy); ctx.lineTo(vpX + i * W * .22, H); ctx.stroke();
        }
        for (i = 0; i < 14; i++) {
          var z = (i + scrollZ) / 14, pyG = hy + Math.pow(z, 2.3) * (H - hy);
          ctx.strokeStyle = 'rgba(127,211,255,' + (0.08 + z * 0.55).toFixed(2) + ')';
          ctx.beginPath(); ctx.moveTo(0, pyG); ctx.lineTo(W, pyG); ctx.stroke();
        }
        // Horizon gold line
        ctx.strokeStyle = 'rgba(255,210,122,.78)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
        // Pixel spark burst on coin drop
        for (i = sparks.length - 1; i >= 0; i--) {
          var sp = sparks[i]; sp.x += sp.vx; sp.y += sp.vy; sp.vy += .16; sp.a *= .95;
          ctx.fillStyle = sp.gold ? 'rgba(255,210,122,' + sp.a.toFixed(2) + ')' : 'rgba(127,211,255,' + sp.a.toFixed(2) + ')';
          ctx.fillRect(sp.x, sp.y, sp.s, sp.s);
          if (sp.a < .03) sparks.splice(i, 1);
        }
      } else if (mode === 'lab') {
        /* 2. LAB: Interactive 3D Fibonacci Particle Sphere + Radar Sweep + Shockwave Detonation */
        ctx.fillStyle = '#030814'; ctx.fillRect(0, 0, W, H);
        var cx = W * .5, cy = H * .5, R = Math.min(W, H) * .33;
        // Faint radial blueprint circles
        ctx.strokeStyle = 'rgba(58,160,238,.12)'; ctx.lineWidth = 1;
        [.65, 1.0, 1.38].forEach(function (k) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, 6.2832); ctx.stroke(); });
        // Rotating radar wedge
        var rAng = t * .65;
        ctx.strokeStyle = 'rgba(127,211,255,.22)';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rAng) * R * 1.45, cy + Math.sin(rAng) * R * 1.45); ctx.stroke();
        // Sphere scale: implode then shockwave explode on IGNITE
        var spScale = !burst ? 1 : (bEl < .25 ? (1 - bEl * 2.2) : (0.45 + Math.pow((bEl - .25) / .75, 1.5) * 4.2));
        var ry = t * .28 + px * .6, rx = .35 + py * .5;
        var cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx);
        for (i = 0; i < sphere.length; i++) {
          var p = sphere[i];
          var x1 = p.x * cyR - p.z * syR, z1 = p.x * syR + p.z * cyR;
          var y2 = p.y * cxR - z1 * sxR, z2 = p.y * sxR + z1 * cxR;
          var depth = 2.6 / (2.6 - z2);
          var sx = cx + x1 * R * spScale * depth, sy = cy + y2 * R * spScale * depth;
          var al = clamp((.25 + (z2 + 1) * .38) * (1 - bEl * .7), 0, 1);
          ctx.fillStyle = p.gold ? 'rgba(255,210,122,' + al.toFixed(2) + ')' : 'rgba(127,211,255,' + al.toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(sx, sy, p.sz * depth, 0, 6.2832); ctx.fill();
        }
      } else if (mode === 'portfolio') {
        /* 3. PORTFOLIO: Architectural Midnight Blueprint Elevation of KL Skyline + Compass Arcs */
        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#050d20'); bg.addColorStop(.55, '#091836'); bg.addColorStop(1, '#050b1a');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // Subtle architectural drafting grid
        ctx.strokeStyle = 'rgba(127,211,255,.06)'; ctx.lineWidth = 1;
        var step = W <= 820 ? 48 : 68, ox = (-px * 18) % step, oy = (-py * 14) % step;
        for (var gx = ox; gx < W; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (var gy = oy; gy < H; gy += step) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
        // Golden compass arcs
        var cx2 = W * .5 - px * 14, cy2 = H * .52 - py * 10, arcR = Math.min(W, H) * .42;
        ctx.strokeStyle = 'rgba(255,210,122,.16)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx2, cy2, arcR, -.4 + t * .04, 1.3 + t * .04); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx2, cy2, arcR * 1.18, 2.5 - t * .03, 4.1 - t * .03); ctx.stroke();
        // Wireframe KL skyline elevation anchored neatly along lower third
        var baseLine = H * .86 - py * 8, pSc = clamp(W / 620, .65, 1.35);
        ctx.strokeStyle = 'rgba(255,210,122,.24)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W * .08, baseLine); ctx.lineTo(W * .92, baseLine); ctx.stroke();
        drawKLHorizon(ctx, W * .5 - px * 22, baseLine, pSc, .32, true);
        // Floating champagne-gold dust motes
        for (i = 0; i < motes.length; i++) {
          var m = motes[i]; m.x = (m.x + m.vx + 1) % 1; m.y = (m.y + m.vy + 1) % 1;
          ctx.fillStyle = 'rgba(255,218,142,' + m.a.toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.r, 0, 6.2832); ctx.fill();
        }
      } else if (mode === 'notes') {
        /* 4. NOTES: 7YMERA OS Isometric Directory Grid + Floating Wireframe Folders */
        var nbg = ctx.createRadialGradient(W * .5, H * .44, 30, W * .5, H * .5, Math.max(W, H) * .72);
        nbg.addColorStop(0, '#0d1f44'); nbg.addColorStop(.65, '#061026'); nbg.addColorStop(1, '#020612');
        ctx.fillStyle = nbg; ctx.fillRect(0, 0, W, H);
        // Blueprint dot matrix
        ctx.fillStyle = 'rgba(127,211,255,.16)';
        var ds = W <= 820 ? 44 : 56;
        for (var dx = 20; dx < W; dx += ds) {
          for (var dy = 20; dy < H; dy += ds) {
            ctx.fillRect(dx - px * 8, dy - py * 8, 1.5, 1.5);
          }
        }
        // Floating wireframe folder silhouettes drifting upward
        for (i = 0; i < folders.length; i++) {
          var f = folders[i];
          f.y -= .00045 * f.z * (burst ? 12 : 1);
          if (f.y < -.1) f.y = 1.1;
          var fx = f.x * W - px * 28 * f.z, fy = f.y * H - py * 20 * f.z, fs = f.s * f.z;
          var fa = (.1 + .14 * (.5 + .5 * Math.sin(t + f.ph))) * (1 - bEl * .8);
          ctx.strokeStyle = i % 4 === 0 ? 'rgba(255,210,122,' + fa.toFixed(2) + ')' : 'rgba(127,211,255,' + fa.toFixed(2) + ')';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(fx, fy); ctx.lineTo(fx + fs * .38, fy); ctx.lineTo(fx + fs * .48, fy + fs * .16);
          ctx.lineTo(fx + fs, fy + fs * .16); ctx.lineTo(fx + fs, fy + fs * .72); ctx.lineTo(fx, fy + fs * .72);
          ctx.closePath(); ctx.stroke();
        }
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
      trigger: function (bx, by) {
        burst = 1; burstAt = performance.now();
        if (mode === 'play') {
          for (var k = 0; k < 48; k++) {
            var a = Math.random() * 6.2832, spd = 2.5 + Math.random() * 8.5;
            sparks.push({ x: bx || W * .5, y: by || H * .44, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 3.5, s: 2.5 + Math.random() * 3.5, a: 1, gold: k % 3 !== 0 });
          }
        }
      },
      stop: function () {
        dead = true; cancelAnimationFrame(raf);
        w.removeEventListener('pointermove', onMove);
        w.removeEventListener('resize', resize);
        cv.width = cv.height = 0;
      }
    };
  }

  /* ==================== MAGNETIC BUTTON + SCRAMBLE ==================== */
  function attachMagnet(btn, labelEl, baseText) {
    if (!btn || reduce) return function () {};
    var mx = -1e4, my = -1e4, bx = 0, by = 0, scr = 0, dead = false, raf = 0;
    function onMove(e) { mx = e.clientX; my = e.clientY; }
    w.addEventListener('pointermove', onMove, { passive: true });
    function loop() {
      if (dead) return;
      var r = btn.getBoundingClientRect(), cx = r.left + r.width * .5, cy = r.top + r.height * .5;
      var dx = mx - cx, dy = my - cy, dist = Math.hypot(dx, dy), pull = dist < 240 ? (1 - dist / 240) : 0;
      var tx = clamp(dx * .16 * (.35 + pull), -14, 14) * (pull ? 1 : 0);
      var ty = clamp(dy * .2 * (.35 + pull), -10, 10) * (pull ? 1 : 0);
      bx += (tx - bx) * .16; by += (ty - by) * .16;
      btn.style.transform = 'translate3d(' + bx.toFixed(2) + 'px,' + by.toFixed(2) + 'px,0)';
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    function scramble() {
      if (!labelEl) return;
      var n = baseText.length, s = performance.now(), myId = ++scr;
      (function step() {
        if (dead || myId !== scr) return;
        var k = Math.floor(((performance.now() - s) / 360) * n), out = '';
        for (var i = 0; i < n; i++) { var c = baseText.charAt(i); out += (i < k || c === ' ') ? c : GLY.charAt((Math.random() * GLY.length) | 0); }
        labelEl.textContent = out;
        if (k < n) requestAnimationFrame(step); else labelEl.textContent = baseText;
      })();
    }
    btn.addEventListener('pointerenter', scramble);
    btn.addEventListener('focus', scramble);
    return function () { dead = true; cancelAnimationFrame(raf); w.removeEventListener('pointermove', onMove); };
  }

  /* ==================== BUILD ENTRY GATE ==================== */
  function buildGate() {
    if (location.hash && location.hash.length > 1) return;

    var el = d.createElement('div');
    el.className = 'ig-gate ig-gate--' + page;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');

    var hud = {
      play:      { tl: '[ ARCADE HALL ]', tr: '[ CREDITS: <b data-ig-st>00</b> ]', br: '[ 124 BPM · CHIPS ]', btn: 'Drop Coin' },
      lab:       { tl: '[ SECTOR 04 · LAB ]', tr: '[ <b data-ig-st>SEALED</b> ]', br: '[ 118 BPM · THE GRID ]', btn: 'Ignite' },
      portfolio: { tl: '[ ALIF NAJMI · CV ]', tr: '[ <b data-ig-st>KUALA LUMPUR</b> ]', br: '[ 78 BPM · LOUNGE ]', btn: 'Open Portfolio' },
      notes:     { tl: '[ 7YMERA OS · /NOTES ]', tr: '[ <b data-ig-st>STANDBY</b> ]', br: '[ 64 BPM · STUDY ]', btn: 'Boot Workspace' }
    }[page];

    var centerHtml = '';
    if (page === 'play') {
      el.setAttribute('aria-label', 'Enter Arcade Hall');
      centerHtml =
        '<div class="ig-inner">' +
          '<div class="ig-coin-rig" data-ig-go role="button" tabindex="-1" aria-hidden="true">' +
            '<div class="ig-coin">\\7</div>' +
            '<div class="ig-slot-plate"><div class="ig-slot-slit"></div></div>' +
          '</div>' +
          '<p class="ig-kicker">5 Cabinets Online · KL Skyline Arcade</p>' +
          '<h2 class="ig-title">Insert Coin</h2>' +
          '<p class="ig-sub">Stack Kuala Lumpur higher than Merdeka 118, ride the last train, triage the backlog, and stamp your Flight Log.</p>' +
          '<div class="ig-btn-wrap"><button type="button" class="ig-btn" data-ig-go>' +
            '<span class="ig-btn-fill" aria-hidden="true"></span><span class="ig-btn-glint" aria-hidden="true"></span>' +
            '<span class="ig-btn-label">' + hud.btn + '</span><span class="ig-btn-arr" aria-hidden="true">' + ARROW + '</span>' +
          '</button></div>' +
        '</div>';
    } else if (page === 'lab') {
      el.setAttribute('aria-label', 'Ignite Experimental Lab');
      centerHtml =
        '<div class="ig-inner">' +
          '<div class="ig-reactor" aria-hidden="true"><div class="ig-r-ring"></div><div class="ig-r-ring ig-r-ring--2"></div><div class="ig-r-ring ig-r-ring--3"></div><div class="ig-r-core">L4</div></div>' +
          '<p class="ig-kicker">Orbital Telemetry · Shaders · SQL · Score Lab</p>' +
          '<h2 class="ig-title">The Lab</h2>' +
          '<p class="ig-sub">X-ray a live NASA satellite, bend light through liquid glass, query real SQLite databases, and remix the skyline score.</p>' +
          '<div class="ig-btn-wrap"><button type="button" class="ig-btn" data-ig-go>' +
            '<span class="ig-btn-fill" aria-hidden="true"></span><span class="ig-btn-glint" aria-hidden="true"></span>' +
            '<span class="ig-btn-label">' + hud.btn + '</span><span class="ig-btn-arr" aria-hidden="true">' + ARROW + '</span>' +
          '</button></div>' +
        '</div>';
    } else if (page === 'portfolio') {
      el.setAttribute('aria-label', 'Open Alif Najmi Portfolio');
      centerHtml =
        '<div class="ig-inner">' +
          '<svg class="ig-mark" viewBox="0 0 156 112" aria-hidden="true"><path class="igm-fill" d="' + MARK + '"/><path class="igm-line" d="' + MARK + '" pathLength="1"/></svg>' +
          '<h2 class="ig-pf-name">Alif Najmi</h2>' +
          '<div class="ig-pf-rule" aria-hidden="true"></div>' +
          '<p class="ig-kicker">Business Analyst · axrail.ai · Kuala Lumpur</p>' +
          '<p class="ig-sub">Shipped products, SLB internship systems, UTP Computer Science coursework, credentials, and interactive CV.</p>' +
          '<div class="ig-btn-wrap"><button type="button" class="ig-btn" data-ig-go>' +
            '<span class="ig-btn-fill" aria-hidden="true"></span><span class="ig-btn-glint" aria-hidden="true"></span>' +
            '<span class="ig-btn-label">' + hud.btn + '</span><span class="ig-btn-arr" aria-hidden="true">' + ARROW + '</span>' +
          '</button></div>' +
        '</div>';
    } else if (page === 'notes') {
      el.setAttribute('aria-label', 'Boot Notes Workstation');
      centerHtml =
        '<div class="ig-pc">' +
          '<div class="ig-pc-bar" aria-hidden="true"><i></i><i></i><i></i><span>7YMERA OS · WORKSTATION</span></div>' +
          '<div class="ig-pc-body">' +
            '<div class="ig-term" id="ig-term" aria-hidden="true"><p>&gt; mounting /projects/10-folders ... <b>OK</b></p><p>&gt; indexing 13 engineering field notes ... <b>OK</b></p><p>&gt; quiet study audio deck (64 bpm) ... <b>READY</b></p></div>' +
            '<div class="ig-pc-chips" aria-hidden="true">' +
              '<span class="ig-pc-chip"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>10 Folders</span>' +
              '<span class="ig-pc-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>13 Journal Notes</span>' +
            '</div>' +
            '<div class="ig-pc-prog" aria-hidden="true"><i></i></div>' +
            '<div class="ig-btn-wrap"><button type="button" class="ig-btn" data-ig-go>' +
              '<span class="ig-btn-fill" aria-hidden="true"></span><span class="ig-btn-glint" aria-hidden="true"></span>' +
              '<span class="ig-btn-label">' + hud.btn + '</span><span class="ig-btn-arr" aria-hidden="true">' + ARROW + '</span>' +
            '</button></div>' +
          '</div>' +
        '</div>';
    }

    var doorsHtml = '';
    if (page === 'lab') doorsHtml = '<div class="ig-hatch ig-hatch--top" aria-hidden="true"></div><div class="ig-hatch ig-hatch--bot" aria-hidden="true"></div><div class="ig-laser" aria-hidden="true"></div>';
    if (page === 'portfolio') doorsHtml = '<div class="ig-folio ig-folio--l" aria-hidden="true"></div><div class="ig-folio ig-folio--r" aria-hidden="true"></div><div class="ig-seam-v" aria-hidden="true"></div>';

    el.innerHTML =
      '<canvas class="ig-cv" aria-hidden="true"></canvas>' +
      '<div class="ig-vig" aria-hidden="true"></div>' +
      '<div class="ig-hud tl" aria-hidden="true"><i></i>' + hud.tl + '</div>' +
      '<div class="ig-hud tr" aria-hidden="true">' + hud.tr + '<i></i></div>' +
      '<div class="ig-hud bl" aria-hidden="true"><i></i>[ <b data-ig-clk>' + mytClock() + '</b> MYT ]</div>' +
      '<div class="ig-hud br" aria-hidden="true">' + hud.br + '<i></i></div>' +
      '<div class="ig-stage">' + centerHtml + '</div>' +
      doorsHtml;

    d.body.appendChild(el);

    var clkEl = el.querySelector('[data-ig-clk]');
    var clkTimer = setInterval(function () { if (clkEl) clkEl.textContent = mytClock(); }, 1000);
    var cvCtrl = startCanvas(el.querySelector('.ig-cv'), page);
    var mainBtn = el.querySelector('button.ig-btn');
    var stopMag = attachMagnet(mainBtn, el.querySelector('.ig-btn-label'), hud.btn);

    var done = false;
    function dismiss(ev) {
      if (done) return;
      done = true;
      clearInterval(clkTimer);
      stopMag();
      unlockAudio();
      var stEl = el.querySelector('[data-ig-st]');
      if (stEl) stEl.textContent = page === 'play' ? '01 · READY' : page === 'lab' ? 'IGNITED' : page === 'notes' ? 'BOOTING' : 'OPEN';

      if (reduce) {
        cvCtrl.stop();
        el.remove();
        return;
      }

      var r = mainBtn ? mainBtn.getBoundingClientRect() : { left: w.innerWidth * .5, top: w.innerHeight * .5, width: 0, height: 0 };
      var cx = (ev && ev.clientX) || (r.left + r.width * .5), cy = (ev && ev.clientY) || (r.top + r.height * .5);
      var flash = d.createElement('i'); flash.className = 'ig-flash'; flash.style.left = cx + 'px'; flash.style.top = cy + 'px'; el.appendChild(flash);

      cvCtrl.trigger(cx, cy);
      el.classList.add('ig-go');

      var hold = page === 'play' ? 760 : page === 'lab' ? 800 : page === 'portfolio' ? 840 : 740;
      setTimeout(function () { el.classList.add('ig-out'); }, hold);
      setTimeout(function () { cvCtrl.stop(); if (el.parentNode) el.remove(); }, hold + 500);
    }

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-ig-go]')) dismiss(e);
    });
    d.addEventListener('keydown', function onKey(e) {
      if (done) { d.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); }
    });
  }

  /* ==================== NOTES: SCROLL-DRIVEN 3D HARDCOVER JOURNAL FLIP ==================== */
  function buildNotesJournal() {
    if (page !== 'notes') return;
    var listSec = d.querySelector('.ni-list');
    var idx = listSec && listSec.querySelector('.notes-index');
    if (!idx || listSec.querySelector('.nj-wrap')) return;

    var wrap = d.createElement('div');
    wrap.className = 'nj-wrap' + (reduce ? ' nj-open' : '');

    var book = d.createElement('div');
    book.className = 'nj-book';
    book.innerHTML = '<div class="nj-book-head"><b>Field Notes · Vol. I</b><span>Exited PC Workspace · Journal View · 13 Entries</span></div>';

    var cover = d.createElement('button');
    cover.type = 'button';
    cover.className = 'nj-cover';
    cover.setAttribute('aria-label', 'Flip open Field Notes journal');
    cover.innerHTML =
      '<div class="nj-cover-in">' +
        '<small>ALIF NAJMI · VOL. I</small>' +
        '<strong>Field Notes Journal</strong>' +
        '<span>Exiting the PC file workspace — flipping open all 13 engineering write-ups.</span>' +
        '<em>Click or scroll to flip open</em>' +
      '</div>';

    idx.parentNode.insertBefore(wrap, idx);
    book.appendChild(idx);
    wrap.appendChild(book);
    wrap.appendChild(cover);

    var opened = reduce;
    function openBook() {
      if (opened) return;
      opened = true;
      wrap.classList.add('nj-open');
      if (w.SFX && SFX.on) { try { SFX.chime(2); } catch (e) {} }
    }
    cover.addEventListener('click', openBook);

    if (!reduce && 'IntersectionObserver' in w) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio >= 0.2) {
            openBook();
            obs.disconnect();
          }
        });
      }, { threshold: [0.2] });
      obs.observe(wrap);
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () { buildGate(); buildNotesJournal(); });
  } else {
    buildGate();
    buildNotesJournal();
  }
})();
