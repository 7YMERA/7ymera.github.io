/* The arcade (#arcade): three small games built from the day job. Plain JS and canvas 2D, no libraries.
   1. Last Train   : one-button runner along the KL rail. Jump scope creep, grab requirements.
   2. Scope Creep  : 45-second triage. Build it, or park it for later?
   3. Spec Match   : pair each tool with where it was used.
   Best scores live in localStorage (wrapped, because it can throw). Nothing runs until the section is near the screen,
   and the runner's loop stops when it is off screen, paused or the tab is hidden. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, box = d.getElementById('arcade');
  if (!box) return;
  function $(s, r) { return (r || box).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || box).querySelectorAll(s)); }

  /* ---------- saved bests ---------- */
  var best = { train: 0, creep: 0, match: 0 };
  try { var raw = JSON.parse(localStorage.getItem('arc-best') || '{}'); ['train', 'creep', 'match'].forEach(function (k) { if (+raw[k] > 0) best[k] = +raw[k]; }); } catch (e) { /* private mode */ }
  function busy(on) { root.classList.toggle('arc-on', !!on); }
  function save() { try { localStorage.setItem('arc-best', JSON.stringify(best)); } catch (e) { /* fine */ } showBests(); }
  function showBests() {
    var t = $('#arc-best-train'), c = $('#arc-best-creep'), m = $('#arc-best-match');
    if (t) t.textContent = best.train ? best.train : '-';
    if (c) c.textContent = best.creep ? best.creep : '-';
    if (m) m.textContent = best.match ? best.match + ' moves' : '-';
  }

  /* ---------- sound: off until asked, three tiny oscillator blips ---------- */
  var soundBtn = $('#arc-sound');
  function beep(f, len, type, vol, slide) { if (window.__sfx) window.__sfx.beep(f, len, type, vol, slide); }   // sfx.js owns the audio and the on/off state
  function paintSound() { if (!soundBtn) return; var on = !!(window.__sfx && window.__sfx.on); soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); soundBtn.querySelector('b').textContent = on ? 'On' : 'Off'; }
  if (soundBtn) {
    if (!window.__sfx) soundBtn.hidden = true;
    soundBtn.addEventListener('click', function () { if (window.__sfx) { window.__sfx.toggle(); beep(660, .08, 'square', .05); } });
    d.addEventListener('sfx-change', paintSound); paintSound();
  }

  /* ---------- tabs ---------- */
  var tabs = $$('[role=tab]'), panels = $$('[role=tabpanel]'), active = 'train';
  function pick(id, focus) {
    active = id;
    tabs.forEach(function (t) { var on = t.getAttribute('data-game') === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-game') !== id; });
    if (id !== 'train') runner.pause();
    if (id !== 'creep') creep.stop();
    if (id === 'train') runner.resize();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t.getAttribute('data-game')); });
    t.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (n) { e.preventDefault(); pick(tabs[(i + n + tabs.length) % tabs.length].getAttribute('data-game'), true); }
    });
  });

  /* =====================================================================
     1. LAST TRAIN
     ===================================================================== */
  var runner = (function () {
    var cv = $('#arc-canvas'), ctx = cv.getContext('2d'), over = $('#arc-over'), overTitle = $('#arc-over-title'), overText = $('#arc-over-text'), go = $('#arc-go'), jumpBtn = $('#arc-jump'), live = $('#arc-live');
    var W = 720, H = 270, GY = 218, DPR = 1, scale = 1;
    var state = 'idle', raf = 0, last = 0, visible = false, hold = false;
    var P, obs, toks, speed, dist, score, got, nextObs, shake, sky, col, theme = '';

    function colours() {
      var cs = getComputedStyle(root);
      function g(n, f) { var v = cs.getPropertyValue(n).trim(); return v || f; }
      col = { bg: g('--bg', '#f3f6f6'), surface: g('--surface', '#fff'), ink: g('--ink', '#0b1b3a'), accent: g('--accent', '#0a6c74'), soft: g('--accent-soft', '#ddeeee'), gold: g('--gold', '#a86d12'), line: g('--line', '#d6e0e2'), accInk: g('--accent-ink', '#fff') };
      theme = root.getAttribute('data-theme');
    }

    function resize() {
      var w = cv.clientWidth || W; DPR = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * DPR); cv.height = Math.round(w * H / W * DPR); scale = cv.width / W;
      if (state !== 'playing') draw(0);
    }
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (!box.hidden) resize(); }).observe(cv);
    else addEventListener('resize', resize);

    function reset() {
      P = { x: 90, y: GY, vy: 0, w: 58, h: 34, air: false };
      obs = []; toks = []; speed = 300; dist = 0; score = 0; got = 0; nextObs = 520; shake = 0;
      sky = { far: 0, near: 0, ground: 0 };
    }

    function jump() {
      if (state === 'idle' || state === 'over') { start(); return; }
      if (state === 'paused') { resume(); return; }
      if (!P.air) { P.vy = -760; P.air = true; beep(520, .12, 'square', .035, 1.8); }
    }
    function start() { colours(); reset(); over.hidden = true; state = 'playing'; busy(true); setLive('Go'); loop0(); jumpBtn.focus({ preventScroll: true }); }
    function setLive(t) { if (live) live.textContent = t; }
    function pause() { if (state === 'playing') { state = 'paused'; busy(false); cancelAnimationFrame(raf); over.hidden = false; overTitle.textContent = 'Paused'; overText.textContent = 'Jump or press Start to carry on.'; go.textContent = 'Resume'; } }
    function resume() { over.hidden = true; state = 'playing'; busy(true); loop0(); }
    function end() {
      state = 'over'; busy(false); cancelAnimationFrame(raf);
      var s = Math.floor(score), isBest = s > best.train;
      if (isBest) { best.train = s; save(); }
      beep(200, .35, 'sawtooth', .05, .35);
      over.hidden = false; overTitle.textContent = isBest ? 'New best: ' + s : 'Derailed at ' + s;
      overText.textContent = got + ' requirement' + (got === 1 ? '' : 's') + ' collected over ' + Math.floor(dist / 10) + ' m. Scope creep wins this round.';
      go.textContent = 'Try again'; setLive('Game over, ' + s + ' points'); go.focus({ preventScroll: true });
      draw(0); shake = 0;
    }
    function loop0() { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    function loop(t) {
      if (state !== 'playing') return;
      if (!visible || d.hidden) { pause(); return; }
      var dt = Math.min((t - last) / 1000, .033); last = t;
      update(dt); draw(dt); raf = requestAnimationFrame(loop);
    }

    function update(dt) {
      speed = 300 + Math.min(dist / 60, 260);
      dist += speed * dt; score += speed * dt / 10;
      // player
      P.vy += 2300 * dt; P.y += P.vy * dt;
      if (P.y >= GY) { P.y = GY; P.vy = 0; P.air = false; }
      // spawn obstacles; the gap always leaves room to land and jump again
      nextObs -= speed * dt;
      if (nextObs <= 0) {
        var wd = 26 + Math.random() * 28, ht = 30 + Math.random() * 22;
        obs.push({ x: W + 40, w: wd, h: ht, kind: Math.random() < .5 ? 0 : 1 });
        if (Math.random() < .55) { // a token arc over the obstacle
          for (var k = 0; k < 3; k++) toks.push({ x: W + 40 + wd / 2 - 46 + k * 46, y: GY - 96 - (k === 1 ? 26 : 0), t: 0 });
        } else toks.push({ x: W + 150, y: GY - 40, t: 0 });
        nextObs = speed * (.78 + Math.random() * .55) + 120;
      }
      obs.forEach(function (o) { o.x -= speed * dt; });
      toks.forEach(function (o) { o.x -= speed * dt; o.t += dt; });
      obs = obs.filter(function (o) { return o.x + o.w > -20; });
      toks = toks.filter(function (o) { return o.x > -20; });
      // collisions (a little forgiving)
      var px = P.x + 8, pw = P.w - 16, py = P.y - P.h + 4;
      for (var i = 0; i < obs.length; i++) {
        var o = obs[i];
        if (px < o.x + o.w - 3 && px + pw > o.x + 3 && P.y > GY - o.h + 4) { shake = .25; end(); return; }
      }
      for (var j = toks.length - 1; j >= 0; j--) {
        var tk = toks[j];
        if (Math.abs(tk.x - (P.x + P.w / 2)) < 30 && Math.abs(tk.y - (P.y - P.h / 2)) < 32) { toks.splice(j, 1); got++; score += 25; beep(880 + got % 5 * 80, .09, 'triangle', .05); }
      }
      sky.far = (sky.far + speed * dt * .12) % 1400; sky.near = (sky.near + speed * dt * .35) % 900; sky.ground = (sky.ground + speed * dt) % 40;
    }

    /* drawing: everything is a few filled shapes, in the page's own colours */
    function tower(x, base, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, base - h, w, h); }
    function landmarks(off, base, c) {
      ctx.fillStyle = c;
      // twin towers with a sky bridge
      var x = 150 - off; for (var rep = 0; rep < 3; rep++, x += 1400) {
        var a = x;
        rr(a, base - 150, 26, 150, 12); rr(a + 44, base - 150, 26, 150, 12);
        ctx.fillRect(a + 24, base - 92, 22, 5); ctx.fillRect(a + 10, base - 178, 6, 30); ctx.fillRect(a + 54, base - 178, 6, 30);
        // KL tower
        var b = x + 520; ctx.fillRect(b, base - 138, 5, 138); rr(b - 8, base - 156, 21, 22, 8); ctx.fillRect(b + 1, base - 190, 3, 36);
        // tall tapered tower
        var m = x + 880; ctx.beginPath(); ctx.moveTo(m, base); ctx.lineTo(m + 12, base - 190); ctx.lineTo(m + 15, base - 190); ctx.lineTo(m + 27, base); ctx.closePath(); ctx.fill(); ctx.fillRect(m + 12.5, base - 226, 2.5, 38);
      }
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); }

    function draw(dt) {
      if (!col || theme !== root.getAttribute('data-theme')) colours();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      var sx = shake > 0 ? (Math.random() - .5) * 10 * Math.min(1, shake * 4) : 0; if (shake > 0) shake = Math.max(0, shake - dt * 1.2);
      ctx.save(); ctx.translate(sx, 0);
      ctx.fillStyle = col.bg; ctx.fillRect(-10, 0, W + 20, H);
      var s = sky || { far: 0, near: 0, ground: 0 };
      landmarks(s.far, GY - 6, col.soft);
      // near blocks
      ctx.globalAlpha = .9; ctx.fillStyle = col.soft;
      for (var i = -1; i < 12; i++) { var bx = i * 90 - s.near % 90; var hh = 34 + ((i + Math.floor(s.near / 90) + 40) * 37 % 51); tower(bx, GY - 6, 62, hh, col.soft); }
      ctx.globalAlpha = 1;
      // rail bed
      ctx.fillStyle = col.line; ctx.fillRect(0, GY, W, 3);
      ctx.fillStyle = col.ink; ctx.globalAlpha = .18; for (var k = -1; k < W / 40 + 1; k++) ctx.fillRect(k * 40 - s.ground, GY + 6, 22, 4); ctx.globalAlpha = 1;
      ctx.fillStyle = col.surface; ctx.fillRect(0, GY + 12, W, H - GY);
      if (P) {
        // tokens
        toks.forEach(function (o) {
          var bob = Math.sin(o.t * 6) * 3; ctx.save(); ctx.translate(o.x, o.y + bob);
          ctx.fillStyle = col.gold; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(12, 0); ctx.lineTo(0, 13); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = col.bg; ctx.font = '700 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', 0, 1); ctx.restore();
        });
        // obstacles: hazard-striped scope creep
        obs.forEach(function (o) {
          ctx.fillStyle = col.ink; rr(o.x, GY - o.h, o.w, o.h, 4);
          ctx.fillStyle = col.gold; ctx.save(); ctx.beginPath(); ctx.rect(o.x, GY - o.h, o.w, o.h); ctx.clip();
          for (var z = -o.h; z < o.w + o.h; z += 14) { ctx.beginPath(); ctx.moveTo(o.x + z, GY); ctx.lineTo(o.x + z + 7, GY); ctx.lineTo(o.x + z + 7 + o.h, GY - o.h); ctx.lineTo(o.x + z + o.h, GY - o.h); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        });
        // the train
        var x = P.x, y = P.y - P.h;
        ctx.fillStyle = col.accent; rr(x, y, P.w, P.h - 6, 9);
        ctx.fillStyle = col.accInk; ctx.globalAlpha = .9; ctx.fillRect(x + 8, y + 7, 12, 9); ctx.fillRect(x + 24, y + 7, 12, 9); ctx.fillRect(x + 40, y + 7, 10, 9); ctx.globalAlpha = 1;
        ctx.fillStyle = col.gold; ctx.fillRect(x + 4, y + P.h - 16, P.w - 8, 3);
        ctx.strokeStyle = col.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 30, y - 9); ctx.lineTo(x + 40, y - 9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 26, y - 9); ctx.lineTo(x + 44, y - 9); ctx.stroke();
        ctx.fillStyle = col.ink; ctx.beginPath(); ctx.arc(x + 14, P.y - 3, 4.5, 0, 7); ctx.arc(x + P.w - 14, P.y - 3, 4.5, 0, 7); ctx.fill();
      }
      ctx.restore();
      // score
      ctx.fillStyle = col.ink; ctx.font = '700 15px ui-monospace,Menlo,monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(String(Math.floor(score || 0)).padStart(5, '0'), W - 14, 12);
      ctx.globalAlpha = .6; ctx.fillText('best ' + (best.train || 0), W - 14, 32); ctx.globalAlpha = 1;
    }

    // controls
    function down(e) { if (e && e.cancelable) e.preventDefault(); jump(); }
    cv.addEventListener('pointerdown', function (e) { if (state === 'playing') down(e); });
    jumpBtn.addEventListener('pointerdown', function (e) { down(e); });
    jumpBtn.addEventListener('click', function (e) { /* keyboard / assistive click without a pointerdown */ if (e.detail === 0) jump(); });
    go.addEventListener('click', function () { if (state === 'paused') resume(); else start(); });
    d.addEventListener('keydown', function (e) {
      if (active !== 'train' || box.hidden) return;
      var k = e.key;
      if (state === 'playing' && (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W')) { e.preventDefault(); jump(); }
      else if (state === 'playing' && (k === 'p' || k === 'P' || k === 'Escape')) pause();
    }, true);
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (!visible) pause(); }, { threshold: .15 }).observe(cv);
    d.addEventListener('visibilitychange', function () { if (d.hidden) pause(); });

    reset(); colours();
    return { pause: pause, resize: resize, draw: function () { draw(0); }, peek: function () { return { state: state, score: score, speed: speed, dist: dist, obs: obs.map(function (o) { return o.x | 0; }), y: P.y }; } };
  })();

  /* =====================================================================
     2. SCOPE CREEP
     ===================================================================== */
  var DECK = [
    ['Users can log in securely', 1, 'Without a login nothing else is safe.'],
    ['Approvers can see an audit trail', 1, 'Maker-checker only works if every step is recorded.'],
    ['Flag duplicate rows before they reach the dashboard', 1, 'Bad data in means a bad report out.'],
    ['The approved week exports to the poster', 1, 'That is the whole point of the workflow.'],
    ['Public view shows totals only', 1, 'Privacy is a requirement, not a nice-to-have.'],
    ['Send an email when a request is approved', 1, 'People cannot act on what they never hear about.'],
    ['Managers and requestors see different screens', 1, 'Role-based access keeps each person to their job.'],
    ['Reject a file that is not a PDF', 1, 'An edge case that would otherwise break extraction.'],
    ['Show a clear error when the upload fails', 1, 'Silent failures are how trust gets lost.'],
    ['Keep a test pack for every release', 1, 'If you cannot test it, you cannot sign it off.'],
    ['Work on a phone screen', 1, 'Most users will open it on a phone first.'],
    ['Let a person confirm before anything is overwritten', 1, 'A human approves every step.'],
    ['Save a draft so nothing is lost', 1, 'Losing an hour of typing is an instant bug report.'],
    ['Write down what stays with people', 1, 'A good spec says what the AI should not decide.'],
    ['Can the logo spin on hover?', 0, 'Fun, but nobody asked for it. Phase 2, maybe.'],
    ['Add a chatbot to the footer', 0, 'A solution looking for a problem.'],
    ['Make it run on a smart fridge', 0, 'No user, no requirement.'],
    ['Rebuild it in a new framework before launch', 0, 'Classic. Ship first, rewrite never.'],
    ['Change everything the night before go-live', 0, 'This is how projects miss their date.'],
    ['Put blockchain in it', 0, 'Ask what problem it solves. There is not one.'],
    ['Just one more field, it is tiny', 0, 'It is never tiny. Every field needs a test.'],
    ['Predict next week\'s lottery numbers', 0, 'Out of scope by about a universe.'],
    ['Use a custom font on every screen', 0, 'Brand polish for later, after it works.'],
    ['Skip testing so we can ship Friday', 0, 'Nope. The test pack is the safety net.'],
    ['Also support a language nobody on the team speaks', 0, 'Without owners it will be wrong. Park it.'],
    ['Add dark mode to the admin export', 0, 'Nice, but not for this release.'],
    ['Add a leaderboard of the busiest approvers', 0, 'Measures the wrong thing, and people notice.'],
    ['Generate a fresh theme song for every login', 0, 'Please do not.']
  ];
  var creep = (function () {
    var card = $('#sc-card'), why = $('#sc-why'), bar = $('#sc-bar'), scoreEl = $('#sc-score'), streakEl = $('#sc-streak'), timeEl = $('#sc-time'), over = $('#sc-over'), overTitle = $('#sc-over-title'), overText = $('#sc-over-text'), start = $('#sc-start'), yes = $('#sc-yes'), no = $('#sc-no'), live = $('#sc-live');
    var TOTAL = 45, running = false, left = TOTAL, score = 0, streak = 0, right = 0, wrong = 0, queue = [], cur = null, timer = 0, t0 = 0;
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function next() {
      if (!queue.length) queue = shuffle(DECK.slice());
      cur = queue.pop(); card.textContent = cur[0]; card.classList.remove('good', 'bad'); card.style.transform = '';
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    }
    function paint() { scoreEl.textContent = score; streakEl.textContent = streak > 1 ? 'x' + mult() : '-'; timeEl.textContent = Math.ceil(left) + 's'; bar.style.transform = 'scaleX(' + Math.max(0, left / TOTAL) + ')'; }
    function mult() { return Math.min(1 + Math.floor(streak / 3), 5); }
    function begin() {
      running = true; left = TOTAL; score = 0; streak = 0; right = 0; wrong = 0; queue = shuffle(DECK.slice());
      over.hidden = true; why.textContent = 'Build it (a real requirement) or Park it (scope creep).'; next(); paint(); yes.disabled = no.disabled = false;
      busy(true); t0 = performance.now(); clearInterval(timer); timer = setInterval(tick, 100); yes.focus({ preventScroll: true });
    }
    function tick() {
      if (d.hidden) { t0 = performance.now() - (TOTAL - left) * 1000; return; }
      left = TOTAL - (performance.now() - t0) / 1000; if (left <= 0) { left = 0; paint(); finish(); return; } paint();
    }
    function stop() { if (running) { running = false; busy(false); clearInterval(timer); over.hidden = false; overTitle.textContent = 'Paused'; overText.textContent = 'Press Start for a fresh round.'; start.textContent = 'Start'; yes.disabled = no.disabled = true; } }
    function finish() {
      running = false; busy(false); clearInterval(timer); yes.disabled = no.disabled = true;
      var isBest = score > best.creep; if (isBest) { best.creep = score; save(); }
      var rank = score >= 400 ? 'Scope Whisperer' : score >= 250 ? 'Senior Business Analyst' : score >= 120 ? 'Business Analyst' : score >= 40 ? 'Junior Analyst' : 'Intern with a sticky note';
      over.hidden = false; overTitle.textContent = (isBest ? 'New best: ' : 'Time. ') + score + ' points';
      overText.textContent = rank + '. ' + right + ' right, ' + wrong + ' wrong.'; start.textContent = 'Play again'; start.focus({ preventScroll: true });
      if (live) live.textContent = 'Round over, ' + score + ' points. ' + rank;
      beep(isBest ? 784 : 330, .3, 'triangle', .05);
    }
    function answer(build) {
      if (!running || !cur) return;
      var ok = (cur[1] === 1) === build;
      if (ok) { streak++; score += 10 * mult(); right++; beep(660 + Math.min(streak, 8) * 40, .08, 'triangle', .05); }
      else { streak = 0; wrong++; score = Math.max(0, score - 5); left = Math.max(0, left - 2); t0 -= 2000; beep(180, .18, 'sawtooth', .05, .6); }
      why.textContent = (ok ? 'Right. ' : 'Not quite. ') + cur[2];
      card.classList.add(ok ? 'good' : 'bad'); card.style.transform = 'translateX(' + (build ? 26 : -26) + 'px) rotate(' + (build ? 3 : -3) + 'deg)';
      paint();
      var self = cur; setTimeout(function () { if (running && cur === self) next(); }, 160);
    }
    yes.addEventListener('click', function () { answer(true); });
    no.addEventListener('click', function () { answer(false); });
    start.addEventListener('click', begin);
    d.addEventListener('keydown', function (e) {
      if (active !== 'creep' || !running || box.hidden) return;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); answer(true); }
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); answer(false); }
    });
    return { stop: stop };
  })();

  /* =====================================================================
     3. SPEC MATCH  (a tool, and where it was used)
     ===================================================================== */
  (function () {
    var PAIRS = [['Supabase', 'SMK data dashboard'], ['Power Apps', 'IT Asset Disposal app'], ['FastAPI', 'TaskMatch'], ['Stripe', 'MyLokalEvent'], ['Next.js', 'KakiLima'], ['Leaflet', 'JumaatFinder'], ['Apps Script', 'Poster automation'], ['Postman', 'Mock-API tests']];
    var grid = $('#mt-grid'), movesEl = $('#mt-moves'), pairsEl = $('#mt-pairs'), msg = $('#mt-msg'), again = $('#mt-again');
    var open = [], moves = 0, found = 0, lock = false, cards = [];
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function build() {
      var deck = []; PAIRS.forEach(function (p, i) { deck.push({ id: i, t: p[0], kind: 'tool' }); deck.push({ id: i, t: p[1], kind: 'use' }); });
      shuffle(deck); grid.textContent = ''; cards = []; open = []; moves = 0; found = 0; lock = false;
      deck.forEach(function (c, n) {
        var b = d.createElement('button'); b.type = 'button'; b.className = 'mt-card ' + c.kind; b.setAttribute('aria-label', 'Card ' + (n + 1) + ', face down');
        b.innerHTML = '<span class="mt-in"><span class="mt-face mt-front" aria-hidden="true"></span><span class="mt-face mt-back"></span></span>';
        b.querySelector('.mt-back').textContent = c.t;
        b.addEventListener('click', function () { flip(b, c, n); });
        grid.appendChild(b); cards.push({ el: b, data: c, n: n, done: false });
      });
      movesEl.textContent = '0'; pairsEl.textContent = '0 / ' + PAIRS.length; msg.textContent = 'Match each tool with the project it was used in.'; again.hidden = true;
    }
    function flip(b, c, n) {
      var cd = cards[n]; if (lock || cd.done || b.classList.contains('on')) return;
      b.classList.add('on'); b.setAttribute('aria-label', (c.kind === 'tool' ? 'Tool: ' : 'Used in: ') + c.t); open.push(cd); beep(500, .05, 'triangle', .04);
      if (open.length < 2) return;
      moves++; movesEl.textContent = moves; lock = true;
      var a = open[0], z = open[1]; open = [];
      if (a.data.id === z.data.id && a.data.kind !== z.data.kind) {
        a.done = z.done = true; found++; pairsEl.textContent = found + ' / ' + PAIRS.length; a.el.classList.add('ok'); z.el.classList.add('ok'); lock = false; beep(760, .12, 'triangle', .05);
        msg.textContent = PAIRS[a.data.id][0] + ' went into ' + PAIRS[a.data.id][1] + '.';
        if (found === PAIRS.length) win();
      } else {
        msg.textContent = 'Not a pair. Remember where they were.';
        setTimeout(function () { [a, z].forEach(function (x) { x.el.classList.remove('on'); x.el.setAttribute('aria-label', 'Card ' + (x.n + 1) + ', face down'); }); lock = false; }, 800);
      }
    }
    function win() {
      var isBest = !best.match || moves < best.match; if (isBest) { best.match = moves; save(); }
      msg.textContent = 'All matched in ' + moves + ' moves' + (isBest ? ', a new best.' : '.') + ' Perfect is 8.'; again.hidden = false; again.focus({ preventScroll: true }); beep(880, .3, 'triangle', .05);
    }
    again.addEventListener('click', build);
    build();
  })();

  /* ---------- lazy: draw the first frame once the section is near ---------- */
  showBests(); pick('train');
  var ready = false;
  new IntersectionObserver(function (en) { if (en[0].isIntersecting && !ready) { ready = true; runner.resize(); } }, { rootMargin: '400px' }).observe(box);
  new IntersectionObserver(function (en) { root.classList.toggle('arc-view', en[0].isIntersecting); }).observe(box); // the Back to top button steps aside
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#arcade"]'); if (a) setTimeout(function () { runner.resize(); }, 50);
  });
  window.__arcade = { pick: pick, peek: runner.peek };
})();
