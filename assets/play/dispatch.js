/* dispatch.js: KL Sky-Rail Dispatch — 60-second transit switchboard arcade cabinet for /play/#dispatch.
 * Plain JS + Canvas2D, zero dependencies. DPR capped at 1.5. Respects prefers-reduced-motion. */
(function () {
  'use strict';
  var d = document, cv = d.getElementById('dp-canvas');
  if (!cv) return;
  var g = cv.getContext('2d');
  var calmQ = matchMedia('(prefers-reduced-motion: reduce)');
  function calm() { return calmQ.matches; }
  function $(id) { return d.getElementById(id); }

  var elScore = $('dp-score'), elTime = $('dp-time'), elLives = $('dp-lives'), elBest = $('dp-best'), elStreak = $('dp-streak');
  var elCard = $('dp-card'), elTitle = $('dp-card-title'), elText = $('dp-card-text'), elGo = $('dp-go'), elLive = $('dp-live');
  var swBtns = [ $('dp-sw-0'), $('dp-sw-1'), $('dp-sw-2') ];

  // 4 destination stations (strictly gold / ice-blue / teal / silver-cobalt, zero pink)
  var DESTS = [
    { id: 0, code: 'PT',   name: 'Petronas',     col: '#ffd27a', y: 0.16 },
    { id: 1, code: 'KL',   name: 'KL Tower',     col: '#7fd3ff', y: 0.39 },
    { id: 2, code: 'EX',   name: 'Exchange 106', col: '#4fc2c8', y: 0.61 },
    { id: 3, code: 'M118', name: 'Merdeka 118',  col: '#d9ecff', y: 0.84 }
  ];

  // Track geometry in normalized [0..1] coordinates:
  // Start (0.04, 0.50) -> SW0 (0.28, 0.50)
  //   SW0 = 0 (up)   -> SW1 (0.58, 0.275) -> SW1=0 -> D0 (0.90, 0.16), SW1=1 -> D1 (0.90, 0.39)
  //   SW0 = 1 (down) -> SW2 (0.58, 0.725) -> SW2=0 -> D2 (0.90, 0.61), SW2=1 -> D3 (0.90, 0.84)
  var NODES = {
    start: { x: 0.04, y: 0.50 },
    sw0:   { x: 0.28, y: 0.50, label: '1 · Pasar Seni' },
    sw1:   { x: 0.58, y: 0.275, label: '2 · KLCC' },
    sw2:   { x: 0.58, y: 0.725, label: '3 · TRX' }
  };

  var sw = [0, 0, 0]; // each 0 = upper branch, 1 = lower branch
  var trains = [], sparks = [], flashes = [0, 0, 0, 0];
  var active = false, running = false, paused = false;
  var score = 0, best = 0, streak = 0, lives = 3, timeLeft = 60, routed = 0;
  var spawnT = 0, raf = 0, lastMs = 0, W = 720, H = 420, dpr = 1;

  function loadBest() {
    try { var b = JSON.parse(localStorage.getItem('play-best') || '{}'); best = +b.dispatch || 0; } catch (e) { best = 0; }
    if (elBest) elBest.textContent = best ? String(best) : '-';
  }
  function saveBest(v) {
    if (v <= best) return;
    best = v;
    try {
      var b = JSON.parse(localStorage.getItem('play-best') || '{}');
      b.dispatch = best;
      localStorage.setItem('play-best', JSON.stringify(b));
    } catch (e) {}
    if (elBest) elBest.textContent = String(best);
    d.dispatchEvent(new Event('play-best'));
  }

  function sfxBeep(f, len, type, vol) {
    var s = window.SFX || window.__sfx;
    if (s && s.beep) { try { s.beep(f, len, type, vol); } catch (e) {} }
  }
  function sfxChime(n) {
    var s = window.SFX || window.__sfx;
    if (s && s.chime) { try { s.chime(n); } catch (e) {} }
  }

  function paintSwitchButtons() {
    var dir = [
      sw[0] === 0 ? '→ KLCC (Up)' : '→ TRX (Down)',
      sw[1] === 0 ? '→ Petronas' : '→ KL Tower',
      sw[2] === 0 ? '→ Exch. 106' : '→ Merdeka 118'
    ];
    for (var i = 0; i < 3; i++) {
      if (!swBtns[i]) continue;
      swBtns[i].setAttribute('aria-pressed', sw[i] ? 'true' : 'false');
      var sp = swBtns[i].querySelector('span');
      if (sp) sp.textContent = dir[i];
    }
  }

  function flip(i) {
    if (!active || paused) return;
    sw[i] = sw[i] ? 0 : 1;
    paintSwitchButtons();
    sfxBeep(sw[i] ? 440 : 587, 0.06, 'triangle', 0.05);
    if (!running) draw(performance.now() * 0.001);
  }

  function updateHud() {
    if (elScore) elScore.textContent = String(score);
    if (elTime) elTime.textContent = Math.max(0, Math.ceil(timeLeft)) + 's';
    if (elLives) elLives.textContent = '♥'.repeat(Math.max(0, lives)) + '·'.repeat(Math.max(0, 3 - lives));
    if (elStreak) elStreak.textContent = streak > 1 ? 'x' + streak : '-';
  }

  function showCard(title, text, btnText) {
    if (!elCard) return;
    elCard.hidden = false;
    if (elTitle) elTitle.textContent = title;
    if (elText) elText.textContent = text;
    if (elGo) elGo.textContent = btnText;
  }

  function startRun() {
    trains = []; sparks = []; flashes = [0, 0, 0, 0];
    sw = [0, 0, 0]; paintSwitchButtons();
    score = 0; streak = 0; lives = 3; timeLeft = 60; routed = 0;
    spawnT = 0.5; running = true; paused = false;
    if (elCard) elCard.hidden = true;
    updateHud();
    if (elLive) elLive.textContent = 'Shift started. Route each colored train to its matching Kuala Lumpur station.';
    sfxBeep(659, 0.09, 'triangle', 0.06);
    wake();
  }

  function endRun(reason) {
    running = false;
    saveBest(score);
    var msg = reason + ' Routed ' + routed + ' trains · Score ' + score + (score >= best && score > 0 ? ' (New personal best!)' : '.');
    showCard(lives <= 0 ? 'Signal Fault' : 'Shift Complete', msg, 'Run Another Shift');
    if (elLive) elLive.textContent = msg;
    sfxBeep(lives <= 0 ? 196 : 784, 0.25, 'triangle', 0.07);
  }

  function spawnTrain() {
    var dest = Math.floor(Math.random() * 4);
    var progress = 1 - timeLeft / 60;
    var speed = 0.20 + progress * 0.13 + Math.random() * 0.025; // normalized segment speed
    trains.push({
      dest: dest,
      seg: 0, // 0: start->sw0, 1: sw0->sw1/sw2, 2: sw1/2->dest
      branch1: 0,
      branch2: 0,
      t: 0,
      speed: speed
    });
  }

  function addSparks(nx, ny, col, ok) {
    if (calm()) return;
    var n = ok ? 14 : 10;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      var sp = (ok ? 70 : 50) + Math.random() * 90;
      sparks.push({ x: nx * W, y: ny * H, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, col: col });
    }
  }

  function segPoints(tr) {
    if (tr.seg === 0) return [NODES.start, NODES.sw0];
    if (tr.seg === 1) return [NODES.sw0, tr.branch1 === 0 ? NODES.sw1 : NODES.sw2];
    var from = tr.branch1 === 0 ? NODES.sw1 : NODES.sw2;
    var dIdx = tr.branch1 * 2 + tr.branch2;
    return [from, { x: 0.90, y: DESTS[dIdx].y }];
  }

  function step(dt) {
    if (!running || paused) return;
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; updateHud(); endRun('60-second rush hour cleared.'); return; }

    var progress = 1 - timeLeft / 60;
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnTrain();
      spawnT = Math.max(1.18, 2.55 - progress * 1.15);
    }

    for (var f = 0; f < 4; f++) flashes[f] = Math.max(0, flashes[f] - dt * 2.4);

    for (var i = trains.length - 1; i >= 0; i--) {
      var tr = trains[i];
      tr.t += tr.speed * dt * (tr.seg === 0 ? 1.1 : 1.0);
      if (tr.t >= 1) {
        if (tr.seg === 0) {
          tr.seg = 1; tr.t = 0; tr.branch1 = sw[0];
        } else if (tr.seg === 1) {
          tr.seg = 2; tr.t = 0; tr.branch2 = sw[tr.branch1 === 0 ? 1 : 2];
        } else {
          var landed = tr.branch1 * 2 + tr.branch2;
          var ok = landed === tr.dest;
          trains.splice(i, 1);
          flashes[landed] = ok ? 1 : -1;
          addSparks(0.90, DESTS[landed].y, ok ? DESTS[landed].col : '#ff8a65', ok);
          if (ok) {
            streak++; routed++;
            score += 100 + Math.min(streak - 1, 8) * 25;
            sfxChime(streak);
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
          } else {
            streak = 0; lives--;
            sfxBeep(165, 0.22, 'sawtooth', 0.06);
            if (navigator.vibrate) { try { navigator.vibrate([25, 30, 25]); } catch (e) {} }
            if (lives <= 0) { updateHud(); endRun('Too many misrouted trains.'); return; }
          }
          updateHud();
        }
      }
    }

    for (var j = sparks.length - 1; j >= 0; j--) {
      var p = sparks[j];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) sparks.splice(j, 1);
    }
    updateHud();
  }

  function curve(p0, p1) {
    var x0 = p0.x * W, y0 = p0.y * H, x1 = p1.x * W, y1 = p1.y * H;
    var cx = (x0 + x1) * 0.5;
    g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(cx, y0, cx, y1, x1, y1);
  }
  function evalCurve(p0, p1, t) {
    var x0 = p0.x * W, y0 = p0.y * H, x1 = p1.x * W, y1 = p1.y * H;
    var cx = (x0 + x1) * 0.5, u = 1 - t;
    var x = u * u * u * x0 + 3 * u * u * t * cx + 3 * u * t * t * cx + t * t * t * x1;
    var y = u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1;
    var dx = 3 * u * u * (cx - x0) + 6 * u * t * 0 + 3 * t * t * (x1 - cx);
    var dy = 6 * u * t * (y1 - y0);
    return { x: x, y: y, ang: Math.atan2(dy, dx) };
  }

  function draw(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#050c1b';
    g.fillRect(0, 0, W, H);

    // Subtle schematic grid
    g.strokeStyle = 'rgba(127, 211, 255, 0.06)';
    g.lineWidth = 1;
    for (var gx = 32; gx < W; gx += 48) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, H); g.stroke(); }
    for (var gy = 32; gy < H; gy += 48) { g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); }

    // Draw all tracks (inactive dim, active glowing)
    var segs = [
      { a: NODES.start, b: NODES.sw0, on: true, col: '#7fd3ff' },
      { a: NODES.sw0, b: NODES.sw1, on: sw[0] === 0, col: '#7fd3ff' },
      { a: NODES.sw0, b: NODES.sw2, on: sw[0] === 1, col: '#7fd3ff' },
      { a: NODES.sw1, b: { x: 0.90, y: DESTS[0].y }, on: sw[1] === 0, col: DESTS[0].col },
      { a: NODES.sw1, b: { x: 0.90, y: DESTS[1].y }, on: sw[1] === 1, col: DESTS[1].col },
      { a: NODES.sw2, b: { x: 0.90, y: DESTS[2].y }, on: sw[2] === 0, col: DESTS[2].col },
      { a: NODES.sw2, b: { x: 0.90, y: DESTS[3].y }, on: sw[2] === 1, col: DESTS[3].col }
    ];

    segs.forEach(function (s) {
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = s.on ? s.col : 'rgba(127, 211, 255, 0.16)';
      g.globalAlpha = s.on ? 0.22 : 1;
      g.lineWidth = s.on ? 12 : 4;
      curve(s.a, s.b); g.stroke();
      if (s.on) {
        g.globalAlpha = 0.95; g.lineWidth = 3.5;
        curve(s.a, s.b); g.stroke();
      }
      g.restore();
    });

    // Origin depot badge
    var sx = NODES.start.x * W, sy = NODES.start.y * H;
    g.fillStyle = '#0c1d3a'; g.strokeStyle = '#7fd3ff'; g.lineWidth = 2;
    g.beginPath(); g.arc(sx, sy, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#9db6dc'; g.font = '600 10px "JetBrains Mono", monospace'; g.textAlign = 'left';
    g.fillText('KL SENTRAL', Math.max(8, sx - 12), sy + 24);

    // Destination station platforms
    DESTS.forEach(function (st, idx) {
      var x = 0.90 * W, y = st.y * H, fl = flashes[idx];
      var bw = Math.min(116, W * 0.16), bh = 36;
      g.save();
      g.fillStyle = fl > 0 ? st.col : fl < 0 ? 'rgba(255, 110, 80, 0.45)' : 'rgba(11, 24, 48, 0.92)';
      g.strokeStyle = fl < 0 ? '#ff8a65' : st.col;
      g.lineWidth = fl !== 0 ? 3 : 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(x - 10, y - bh / 2, bw, bh, 9);
      else g.rect(x - 10, y - bh / 2, bw, bh);
      g.fill(); g.stroke();
      g.fillStyle = fl > 0 ? '#050c1b' : st.col;
      g.font = '700 12px "JetBrains Mono", monospace';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(st.code, x, y - 5);
      g.fillStyle = fl > 0 ? '#050c1b' : '#eaf1ff';
      g.font = '500 10px "Albert Sans", system-ui, sans-serif';
      g.fillText(st.name, x, y + 8);
      g.restore();
    });

    // Interactive switch nodes
    [NODES.sw0, NODES.sw1, NODES.sw2].forEach(function (nd, i) {
      var x = nd.x * W, y = nd.y * H, r = 18;
      var pulse = 0.5 + 0.5 * Math.sin(now * 4 + i);
      g.save();
      g.fillStyle = 'rgba(255, 210, 122, ' + (0.12 + pulse * 0.1) + ')';
      g.beginPath(); g.arc(x, y, r + 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#091834';
      g.strokeStyle = '#ffd27a';
      g.lineWidth = 2.4;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();

      // Switch arrow pointing toward active branch
      var dirAng = sw[i] === 0 ? -0.45 : 0.45;
      g.translate(x, y); g.rotate(dirAng);
      g.strokeStyle = '#ffd27a'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.lineTo(2, -5); g.moveTo(7, 0); g.lineTo(2, 5); g.stroke();
      g.restore();

      g.fillStyle = '#eaf1ff';
      g.font = '600 11px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText(nd.label, x, y + r + 16);
    });

    // Trains
    trains.forEach(function (tr) {
      var pts = segPoints(tr), pos = evalCurve(pts[0], pts[1], tr.t);
      var st = DESTS[tr.dest];
      g.save();
      g.translate(pos.x, pos.y);
      g.rotate(pos.ang);
      // Glow halo
      g.fillStyle = st.col;
      g.globalAlpha = 0.25;
      g.beginPath(); g.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      // Train body
      g.fillStyle = st.col;
      g.strokeStyle = '#050c1b';
      g.lineWidth = 1.6;
      g.beginPath();
      if (g.roundRect) g.roundRect(-21, -9, 42, 18, 7);
      else g.rect(-21, -9, 42, 18);
      g.fill(); g.stroke();
      // Headlight
      g.fillStyle = '#ffffff';
      g.fillRect(16, -4, 4, 8);
      // Destination code
      g.fillStyle = '#050c1b';
      g.font = '700 10px "JetBrains Mono", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(st.code, -2, 0.5);
      g.restore();
    });

    // Sparks
    sparks.forEach(function (p) {
      g.save();
      g.globalAlpha = Math.max(0, p.life / 0.55);
      g.fillStyle = p.col;
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
      g.restore();
    });

    if (paused && running) {
      g.fillStyle = 'rgba(4, 10, 22, 0.72)';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffd27a';
      g.font = '700 28px "Pixelify Sans", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('PAUSED · PRESS P', W * 0.5, H * 0.5);
    }
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = Math.max(300, Math.round(r.width));
    H = Math.max(240, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    draw(performance.now() * 0.001);
  }

  function loop(ms) {
    raf = 0;
    if (!active || d.hidden) return;
    var dt = lastMs ? Math.min(0.05, (ms - lastMs) / 1000) : 0.016;
    lastMs = ms;
    step(dt);
    draw(ms * 0.001);
    if (running && !paused) raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (!raf && active && running && !paused) { lastMs = 0; raf = requestAnimationFrame(loop); }
  }

  // Click/tap directly on switch nodes on canvas
  cv.addEventListener('pointerdown', function (e) {
    if (!active) return;
    var r = cv.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;
    var py = (e.clientY - r.top) / r.height;
    var list = [NODES.sw0, NODES.sw1, NODES.sw2];
    var bestI = -1, bestD = 0.14;
    for (var i = 0; i < 3; i++) {
      var dist = Math.hypot(px - list[i].x, py - list[i].y);
      if (dist < bestD) { bestD = dist; bestI = i; }
    }
    if (bestI >= 0) {
      e.preventDefault();
      if (!running) startRun();
      else flip(bestI);
    }
  });

  swBtns.forEach(function (btn, idx) {
    if (btn) btn.addEventListener('click', function () {
      if (!running) startRun();
      else flip(idx);
    });
  });

  if (elGo) elGo.addEventListener('click', startRun);

  d.addEventListener('keydown', function (e) {
    if (!active) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === '1' || e.key === 'a' || e.key === 'A') { e.preventDefault(); flip(0); }
    else if (e.key === '2' || e.key === 's' || e.key === 'S') { e.preventDefault(); flip(1); }
    else if (e.key === '3' || e.key === 'd' || e.key === 'D') { e.preventDefault(); flip(2); }
    else if (e.key === 'p' || e.key === 'P') {
      if (running) { e.preventDefault(); paused = !paused; draw(performance.now() * 0.001); if (!paused) wake(); }
    } else if ((e.key === ' ' || e.key === 'Enter') && !running) {
      e.preventDefault(); startRun();
    }
  });

  d.addEventListener('play-view', function (e) {
    active = !!(e.detail && e.detail.id === 'dispatch');
    if (active) {
      loadBest(); paintSwitchButtons(); updateHud();
      setTimeout(function () { resize(); draw(performance.now() * 0.001); }, 30);
    } else {
      running = false; paused = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
  });
  addEventListener('resize', function () { if (active) resize(); });
  loadBest(); paintSwitchButtons();
})();
