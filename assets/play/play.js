/* play.js: the arcade hall at /play/ and the lab at /lab/ (one script, chosen by <body data-page="play|lab">: the games page keeps the hero, the
   games and the data toys; the lab page keeps Orbit, Particle lab, Glass lab, Skyline anatomy and Liquid glass lab, and has no hero of its own,
   its first screen is the satellite inspector, mounted by satellite.js on [data-sat-hero]).
   1. The hero's attract-mode loop (Last Train playing itself) and the high-score strip.
   2. The cabinet grid: every card has a live canvas preview. One shared loop draws only the ones on screen, at 30 fps,
      and stops while a game is open.
   3. The stage: a full-screen dialog that hosts one toy at a time. Esc or the Back button closes it, focus is trapped,
      the page behind is inert and scroll-locked, and the browser's Back button closes it too (history state, #id links work).
   4. The SQL playgrounds, lifted out of the notes that describe them (so there is one copy of each) and mounted here.
   5. The hidden-train easter egg.
   The games themselves live in arcade.js, halcyon.js and stack.js. pad.js maps a gamepad onto the keyboard.
   Reduced motion: previews and the hero draw one still frame. Nothing here animates anything but transform and opacity in CSS. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, body = d.body;
  var PAGE = body.getAttribute('data-page') === 'lab' ? 'lab' : 'play', PAGE_NAME = PAGE === 'lab' ? 'Lab' : 'Play', BASE_TITLE = d.title;
  var calmQ = matchMedia('(prefers-reduced-motion: reduce)');
  function calm() { return calmQ.matches; }
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
  function S() { return window.SFX || window.__sfx || null; }
  function beep(f, len, type, vol, slide) { var s = S(); if (s && s.beep) { try { s.beep(f, len, type, vol, slide); } catch (e) { /* sound is optional */ } } }

  /* =====================================================================
     saved scores
     ===================================================================== */
  function scores() {
    var o = { stack: 0, train: 0, creep: 0, match: 0 };
    try { var a = JSON.parse(localStorage.getItem('arc-best') || '{}'); ['train', 'creep', 'match'].forEach(function (k) { if (+a[k] > 0) o[k] = +a[k]; }); } catch (e) { /* private mode */ }
    try { var b = JSON.parse(localStorage.getItem('play-best') || '{}'); if (+b.stack > 0) o.stack = +b.stack; } catch (e) { /* private mode */ }
    return o;
  }
  var UNIT = { stack: 'floors', train: 'pts', creep: 'pts', match: 'moves' };
  function paintScores() {
    var s = scores();
    $$('[data-hi-show]').forEach(function (el) { var v = s[el.dataset.hiShow]; el.textContent = v ? String(v).padStart(3, '0') : '---'; el.classList.toggle('on', !!v); });
    $$('[data-hi-tag]').forEach(function (el) { var k = el.dataset.hiTag, v = s[k]; el.textContent = v ? 'HI ' + v + ' ' + UNIT[k] : ''; el.hidden = !v; });
    var h = $('#stage-hi'); if (h && cur && s[cur.score]) { h.textContent = 'Best ' + s[cur.score] + ' ' + UNIT[cur.score]; h.hidden = false; } else if (h) h.hidden = true;
  }
  d.addEventListener('play-best', paintScores);
  addEventListener('storage', paintScores);

  /* =====================================================================
     the stage
     ===================================================================== */
  var stage = $('#stage'), hall = $('#hall'), stageTitle = $('#stage-title'), stageSub = $('#stage-sub');
  var CAB = {
    stack: { view: 'stack', title: 'Skyline Stack', sub: 'Arcade floor · cabinet 01', score: 'stack' },
    train: { view: 'arcade', title: 'Last Train', sub: 'Arcade floor · cabinet 02', score: 'train', pick: 'train' },
    creep: { view: 'arcade', title: 'Scope Creep', sub: 'Arcade floor · cabinet 03', score: 'creep', pick: 'creep' },
    match: { view: 'arcade', title: 'Spec Match', sub: 'Arcade floor · cabinet 04', score: 'match', pick: 'match' },
    orbit: { view: 'halcyon', title: 'Orbit', sub: 'The lab · Halcyon', pick: 'orbit' },
    lab: { view: 'halcyon', title: 'Particle lab', sub: 'The lab · Halcyon', pick: 'lab' },
    glass: { view: 'glass', title: 'Glass lab', sub: 'The lab · one WebGL shader', src: '/lab/glass.html' },
    anatomy: { view: 'anatomy', title: 'Skyline anatomy', sub: 'The lab · exploded KL meshes' },
    lglass: { view: 'glass', title: 'Liquid glass lab', sub: 'The lab · WebGL2 optical shader', src: '/lab/liquid-glass.html' },
    'sql-company': { view: 'sql', title: 'Company SQL', sub: 'Data toys · SQLite in your browser', sql: 'company' },
    'sql-jom': { view: 'sql', title: 'Jom Al-Quran SQL', sub: 'Data toys · SQLite in your browser', sql: 'jom' },
    atlas: { view: 'sql', title: 'Join Atlas', sub: 'Data toys · a map of the schema', sql: 'atlas' },
    egg: { view: 'egg', title: 'Back room', sub: 'Out of order' }
  };
  // which page each cabinet lives on: the rest are dropped, so a stray #id from the other page opens nothing
  var LAB_IDS = { orbit: 1, lab: 1, glass: 1, anatomy: 1, lglass: 1, 'sql-company': 1, 'sql-jom': 1, atlas: 1 };
  Object.keys(CAB).forEach(function (id) { if ((LAB_IDS[id] ? 'lab' : 'play') !== PAGE) delete CAB[id]; });
  var cur = null, curId = '', opener = null, pushed = false, views = $$('.view', stage);
  var previewsOn = true;

  function setInert(on) {
    if (on) { hall.setAttribute('inert', ''); hall.setAttribute('aria-hidden', 'true'); } else { hall.removeAttribute('inert'); hall.removeAttribute('aria-hidden'); }
  }
  function focusables() { return $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, iframe, [tabindex]:not([tabindex="-1"])', stage).filter(function (el) { return el.offsetParent !== null || el === d.activeElement; }); }

  function show(id, opts) {
    opts = opts || {};
    var c = CAB[id]; if (!c) return false;
    if (cur) return false;
    cur = c; curId = id; opener = opts.opener || d.activeElement;
    stage.hidden = false; stage.classList.add('is-open'); setInert(true); root.classList.add('play-lock');
    stageTitle.textContent = c.title; stageSub.textContent = c.sub; d.title = c.title + ' · ' + PAGE_NAME + ' · Alif Najmi';
    views.forEach(function (v) { v.hidden = v.dataset.view !== c.view; });
    $('#stage-body').scrollTop = 0;
    previewsOn = false;
    if (c.pick && c.view === 'arcade' && window.__arcade) window.__arcade.pick(c.pick);
    if (c.pick && c.view === 'halcyon' && window.__halcyon) window.__halcyon.pick(c.pick);
    if (c.view === 'glass') { var f = $('#glass-frame'); var th = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; f.title = c.title; f.src = (c.src || '/lab/glass.html') + '?embed=1&theme=' + th; }
    if (c.view === 'sql') mountSql(c.sql);
    if (c.view === 'egg') eggPaint();
    d.dispatchEvent(new CustomEvent('play-view', { detail: { id: c.view === 'stack' ? 'stack' : c.view, cab: id } }));
    // let layout settle, then nudge the games to measure their canvases
    setTimeout(function () { try { dispatchEvent(new Event('resize')); } catch (e) { /* fine */ } }, 40);
    paintScores();
    if (c.view === 'stack') { stageTitle.focus({ preventScroll: true }); } else stageTitle.focus({ preventScroll: true });
    return true;
  }
  function hide() {
    if (!cur) return;
    var was = curId; cur = null; curId = '';
    stage.hidden = true; stage.classList.remove('is-open'); setInert(false); root.classList.remove('play-lock');
    d.title = BASE_TITLE;
    d.dispatchEvent(new CustomEvent('play-view', { detail: { id: null } }));
    var f = $('#glass-frame'); if (f && f.getAttribute('src')) f.removeAttribute('src');
    if (d.fullscreenElement && d.exitFullscreen) { try { d.exitFullscreen(); } catch (e) { /* fine */ } }
    previewsOn = true; wakePreviews(); paintScores();
    var back = opener && d.contains(opener) ? opener : $('.cab[data-open="' + was + '"]');
    if (back && back.focus) back.focus({ preventScroll: true });
    pushed = false;
  }
  function open(id, opts) {
    if (!CAB[id] || cur) return;
    var ok = show(id, opts); if (!ok) return;
    if (!(opts && opts.noPush)) { try { history.pushState({ play: id }, '', '#' + id); pushed = true; } catch (e) { pushed = false; } }
  }
  function close() {
    if (!cur) return;
    if (pushed) { var t = setTimeout(hide, 450); addEventListener('popstate', function once() { clearTimeout(t); removeEventListener('popstate', once); }); try { history.back(); } catch (e) { hide(); } }
    else { hide(); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ } }
  }
  addEventListener('popstate', function () {
    var st = history.state;
    if (cur && !(st && st.play)) hide();
    else if (!cur && st && st.play && CAB[st.play]) show(st.play, {});
  });

  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-open]');
    if (a && hall.contains(a)) { e.preventDefault(); open(a.dataset.open, { opener: a }); }
  });
  $('#stage-close').addEventListener('click', close);
  d.addEventListener('keydown', function (e) {
    if (cur) {
      if (e.key === 'Escape') {
        var t = e.target; if (t && /^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName)) return;
        e.preventDefault(); close(); return;
      }
      if (e.key === 'Tab') {
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1], a = d.activeElement;
        if (!stage.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (a === first || a === stageTitle)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      }
      // arrow keys walk the Spec Match grid
      var m = e.target && e.target.closest && e.target.closest('.mt-card');
      if (m && /^Arrow/.test(e.key)) {
        var cards = $$('.mt-card'), i = cards.indexOf(m), n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 4 : -4;
        if (cards[i + n]) { e.preventDefault(); cards[i + n].focus(); }
      }
      return;
    }
    // the hall: arrow keys move between cabinets, Enter on the page inserts a coin
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target, onCab = tg && tg.classList && tg.classList.contains('cab');
    if (/^Arrow/.test(e.key) && (onCab || (!e.isTrusted && (tg === body || tg === d)))) {
      var cabs = $$('.cab'); if (!cabs.length) return;
      if (!onCab) { e.preventDefault(); cabs[0].focus(); return; }
      var r0 = tg.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2, best = null, bs = 1e9;
      cabs.forEach(function (c) {
        if (c === tg) return; var r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, dx = x - cx, dy = y - cy, ok, sc;
        if (e.key === 'ArrowRight') { ok = dx > 20; sc = dx + Math.abs(dy) * 3; } else if (e.key === 'ArrowLeft') { ok = dx < -20; sc = -dx + Math.abs(dy) * 3; }
        else if (e.key === 'ArrowDown') { ok = dy > 20; sc = dy + Math.abs(dx) * 3; } else { ok = dy < -20; sc = -dy + Math.abs(dx) * 3; }
        if (ok && sc < bs) { bs = sc; best = c; }
      });
      if (best) { e.preventDefault(); best.focus(); }
    } else if (e.key === 'Enter' && (tg === body || tg === d)) { e.preventDefault(); coin(); }
  });
  d.addEventListener('play-pad-start', function () { if (!cur) coin(); });

  // sound and fullscreen live in the stage bar, because the header is out of reach while a game is open
  var ss = $('#stage-sound'), hs = $('#sfx-btn');
  function mirror() { if (!hs) { ss.hidden = true; return; } ss.hidden = hs.hidden; ss.setAttribute('aria-pressed', hs.getAttribute('aria-pressed') || 'false'); ss.setAttribute('aria-label', hs.getAttribute('aria-label') || 'Sound'); ss.classList.toggle('on', hs.classList.contains('on')); }
  ss.addEventListener('click', function () { if (hs) hs.click(); setTimeout(mirror, 30); });
  d.addEventListener('sfx-change', mirror);
  if (hs && 'MutationObserver' in window) new MutationObserver(mirror).observe(hs, { attributes: true });
  setTimeout(mirror, 300); mirror();
  var fsBtn = $('#stage-full');
  if (stage.requestFullscreen) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', function () { if (d.fullscreenElement) d.exitFullscreen(); else stage.requestFullscreen().catch(function () { /* refused */ }); });
  }

  /* =====================================================================
     SQL playgrounds: pulled out of the notes that explain them
     ===================================================================== */
  var SQL = {
    company: { url: '/notes/database.html', id: 'dbp', js: '/assets/db-playground.js', lede: 'The real schema and data of a university project that models a company from the CEO down, rebuilt in SQLite. Pick one of the original queries, open a table, or write your own and press Run.', note: '/notes/database.html', label: 'Read the story' },
    jom: { url: '/notes/jom-al-quran.html', id: 'dbp', js: '/assets/db-playground.js', lede: 'A tuition-centre database with every personal detail scrubbed. Try the ready questions or write your own SQL. Press Run or Ctrl+Enter.', note: '/notes/jom-al-quran.html', label: 'Read the story' },
    atlas: { url: '/notes/jom-al-quran.html', id: 'ja', js: '/assets/join-atlas.js', lede: 'The same database as a map. Pick the tables you care about and the atlas finds the shortest route between them and writes the JOINs.', note: '/notes/jom-al-quran.html', label: 'Read the story' }
  };
  var sqlNow = '', sqlSeq = 0;
  function mountSql(kind) {
    var c = SQL[kind], host = $('#sql-host'); if (!c || sqlNow === kind) return;
    sqlNow = kind; var seq = ++sqlSeq;
    $('#sql-lede').textContent = c.lede; var n = $('#sql-note'); n.href = c.note; n.textContent = c.label;
    host.innerHTML = '<p class="sql-wait">Loading the playground…</p>';
    fetch(c.url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      if (seq !== sqlSeq) return;
      var doc = new DOMParser().parseFromString(html, 'text/html'), node = doc.getElementById(c.id);
      if (!node) throw new Error('missing');
      node = d.importNode(node, true);
      ['data-db', 'data-drift'].forEach(function (a) { var v = node.getAttribute(a); if (v) node.setAttribute(a, v.replace(/^\.\.\//, '/')); });
      host.textContent = ''; host.appendChild(node);
      // the scripts bind to the element's id when they run, so run a fresh copy each time
      var s = d.createElement('script'); s.src = c.js + '?v=20261121a&m=' + seq; s.async = false; host.appendChild(s);
    }).catch(function () {
      if (seq !== sqlSeq) return; sqlNow = '';
      host.innerHTML = '<p class="sql-wait">Could not load the playground. <a href="' + c.note + '">Open it in the note instead</a>.</p>';
    });
  }

  /* =====================================================================
     the hidden train
     ===================================================================== */
  var eggN = 0; try { eggN = +localStorage.getItem('play-egg') || 0; } catch (e) { /* fine */ }
  function eggPaint() {
    var ec = $('#egg-count'); if (ec) ec.textContent = eggN ? 'Trains run from this room: ' + eggN : 'Trains run from this room: 0';
    var t = $('[data-egg-tag]'); if (t) t.textContent = eggN ? 'Found' : '???';
  }
  if ($('#egg-ring')) $('#egg-ring').addEventListener('click', function () {
    var tr = $('#egg-train'); tr.classList.remove('run'); void tr.getBoundingClientRect(); tr.classList.add('run');
    eggN++; try { localStorage.setItem('play-egg', String(eggN)); } catch (e) { /* fine */ }
    $('#egg-count').textContent = 'Next stop: hiring. Trains run from this room: ' + eggN;
    var s = S(); if (s && s._train) { try { s._train(); } catch (e) { /* fine */ } }
    beep(784, .18, 'triangle', .06); setTimeout(function () { beep(587, .3, 'triangle', .06); }, 180);
  });
  eggPaint();

  /* =====================================================================
     insert coin
     ===================================================================== */
  var heroCur = function () { return 'stack'; }; // the hero block below swaps in the slideshow's current cabinet
  function coin() {
    var b = $('#coin'); if (!b) return; if (b) { b.classList.remove('drop'); void b.offsetWidth; b.classList.add('drop'); }
    beep(988, .07, 'square', .05); setTimeout(function () { beep(1319, .3, 'square', .05); }, 80);
    var id = heroCur(); setTimeout(function () { open(id, { opener: $('.cab[data-open="' + id + '"]') }); }, calm() ? 0 : 320);
  }
  if ($('#coin')) $('#coin').addEventListener('click', coin);

  /* =====================================================================
     previews: tiny canvases on dark "screens", one shared loop
     ===================================================================== */
  var C = { bg: '#06101a', bg2: '#0b1f2e', teal: '#4fc2c8', gold: '#e3b14e', blue: '#6aa8ff', ink: '#eaf1ff', dim: '#17384a', mute: '#5b7b8c' };
  var PW = 320, PH = 200;
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function glowLine(g, col, w, fn) { g.strokeStyle = col; g.globalAlpha = .18; g.lineWidth = w * 3; fn(); g.stroke(); g.globalAlpha = .9; g.lineWidth = w; fn(); g.stroke(); g.globalAlpha = 1; }
  function px(g, size) { g.font = '600 ' + size + 'px "Pixelify Sans", "JetBrains Mono", monospace'; }
  function mono(g, size) { g.font = '500 ' + size + 'px "JetBrains Mono", monospace'; }
  function backdrop(g) { g.fillStyle = C.bg; g.fillRect(0, 0, PW, PH); }

  function skylineBlocks(g, t, base, speed, col, hmin, hrange) {
    g.fillStyle = col; for (var i = 0; i < 16; i++) { var x = ((i * 30 - t * speed) % 480 + 480) % 480 - 40, h = hmin + hash(i * 3.1) * hrange; g.fillRect(x, base - h, 20 + hash(i) * 12, h); }
  }
  function twin(g, x, base, h, col) { g.fillStyle = col; var w = h * .11; g.fillRect(x - w - 2, base - h, w, h); g.fillRect(x + 2, base - h, w, h); g.fillRect(x - w * .5, base - h * .5, w * 2 + 4, 2); g.fillRect(x - w / 2 - 2, base - h - 8, 2, 8); g.fillRect(x + w / 2 + 2, base - h - 8, 2, 8); }

  var PV = {
    train: function (g, t) {
      backdrop(g); var base = 150;
      skylineBlocks(g, t, base, 9, '#0c2433', 16, 40); twin(g, ((330 - t * 14) % 520 + 520) % 520 - 90, base, 78, '#12354a');
      skylineBlocks(g, t, base, 24, '#10304a', 8, 24);
      g.fillStyle = C.bg2; g.fillRect(0, base, PW, PH - base);
      glowLine(g, C.teal, 1.5, function () { g.beginPath(); g.moveTo(0, base); g.lineTo(PW, base); });
      g.fillStyle = C.mute; for (var i = 0; i < 14; i++) g.fillRect(((i * 24 - t * 150) % 336 + 336) % 336 - 12, base + 8, 12, 3);
      var sp = 160, per = 230, tx = 62, jump = 0;
      var obs = []; for (var k = -1; k < 3; k++) { var ox = 330 + k * per - ((t * sp) % per); obs.push(ox); }
      obs.forEach(function (ox) {
        var dx = ox - tx; var j = 1 - Math.pow((dx - 8) / 46, 2); if (j > 0) jump = Math.max(jump, j * 44);
        g.save(); g.beginPath(); g.rect(ox, base - 24, 22, 24); g.clip(); g.fillStyle = '#10222d'; g.fillRect(ox, base - 24, 22, 24); g.fillStyle = C.gold;
        for (var z = -26; z < 30; z += 9) { g.beginPath(); g.moveTo(ox + z, base); g.lineTo(ox + z + 4.5, base); g.lineTo(ox + z + 28.5, base - 24); g.lineTo(ox + z + 24, base - 24); g.fill(); }
        g.restore();
        if (ox + 11 > tx + 18) { var ty = base - 66 - Math.sin(t * 6 + ox) * 2; g.fillStyle = C.gold; g.beginPath(); g.moveTo(ox + 11, ty - 7); g.lineTo(ox + 18, ty); g.lineTo(ox + 11, ty + 7); g.lineTo(ox + 4, ty); g.fill(); }
      });
      var y = base - jump - 2; g.fillStyle = C.teal; rr(g, tx, y - 22, 44, 20, 6); g.fill(); g.fillStyle = C.bg; [6, 18, 30].forEach(function (o) { g.fillRect(tx + o, y - 17, 9, 7); });
      g.fillStyle = C.gold; g.fillRect(tx + 3, y - 8, 38, 2); g.fillStyle = C.ink; g.beginPath(); g.arc(tx + 10, y, 3, 0, 7); g.arc(tx + 34, y, 3, 0, 7); g.fill();
      px(g, 14); g.textAlign = 'right'; g.fillStyle = C.ink; g.fillText(String(Math.floor(t * 16)).padStart(5, '0'), PW - 12, 22);
    },
    creep: function (g, t) {
      backdrop(g); var cyc = 3.6, n = Math.floor(t / cyc), p = (t % cyc) / cyc, build = n % 2 === 0;
      var texts = [['Users can log in', 'Add a chatbot'], ['Export to the poster', 'Put blockchain in it'], ['Save a draft', 'One more field, tiny']];
      var txt = texts[Math.floor(n / 2) % 3][build ? 0 : 1];
      var enter = ease(p / .15), leave = ease((p - .62) / .2);
      var x = 160 + (build ? 1 : -1) * leave * 220, rot = (build ? 1 : -1) * leave * .3, sc = .9 + enter * .1;
      g.save(); g.translate(x, 92); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = enter;
      g.fillStyle = '#0d2535'; rr(g, -108, -40, 216, 80, 12); g.fill(); g.strokeStyle = leave > 0 ? (build ? C.teal : C.gold) : C.ink; g.lineWidth = 2; g.stroke();
      px(g, 17); g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0);
      if (p > .42) { var a = ease((p - .42) / .1); g.save(); g.globalAlpha = a; g.translate(0, -38); g.rotate(build ? -.12 : .12); px(g, 22); g.fillStyle = build ? C.teal : C.gold; g.strokeStyle = build ? C.teal : C.gold; g.lineWidth = 2; var lab = build ? 'BUILD' : 'PARK'; var wd = g.measureText(lab).width + 14; g.strokeRect(-wd / 2, -14, wd, 28); g.fillText(lab, 0, 1); g.restore(); }
      g.restore(); g.textBaseline = 'alphabetic';
      g.fillStyle = C.dim; g.fillRect(24, 168, 272, 6); g.fillStyle = C.gold; g.fillRect(24, 168, 272 * (1 - ((t * .04) % 1)), 6);
      px(g, 13); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('SCORE ' + String(Math.floor(t * 9) * 10).padStart(4, '0'), 24, 24); g.textAlign = 'right'; g.fillStyle = C.gold; g.fillText('x' + (1 + Math.floor((n % 6) / 2)), 296, 24);
      g.textAlign = 'left'; mono(g, 9); g.fillStyle = C.mute; g.fillText('PARK  <   >  BUILD', 24, 190);
    },
    match: function (g, t) {
      backdrop(g); var cols = 4, rows = 3, cw = 56, ch = 46, gx = 10, ox = (PW - (cols * cw + (cols - 1) * gx)) / 2, oy = 22, cyc = 8;
      var tint = [C.teal, C.gold, C.blue, C.ink, C.teal, C.gold];
      for (var i = 0; i < 12; i++) {
        var pair = i % 6, c = i % cols, r = Math.floor(i / cols), cx = ox + c * (cw + gx) + cw / 2, cy = oy + r * (ch + gx) + ch / 2;
        var ct = t % cyc, st = pair * 1.15, f = ct - st, flip = 0, done = false;
        if (f > 0 && f < 2.4) flip = f < .35 ? f / .35 : f > 1.9 ? Math.max(0, 1 - (f - 1.9) / .35) : 1;
        if (ct > 7) done = false; if (ct > st + 2.4 && pair % 2 === 0 && ct < 7.6) done = true;
        var sx = Math.abs(Math.cos(Math.PI * clamp(flip, 0, 1) * 1)), face = flip > .5 || done;
        if (done) { sx = 1; }
        g.save(); g.translate(cx, cy); g.scale(Math.max(.04, done ? 1 : sx), 1);
        g.fillStyle = face ? '#0f2b3d' : C.dim; rr(g, -cw / 2, -ch / 2, cw, ch, 7); g.fill(); g.strokeStyle = done ? C.gold : face ? tint[pair] : '#22506a'; g.lineWidth = done ? 2 : 1.5; g.stroke();
        if (face) { g.fillStyle = tint[pair]; g.fillRect(-14, -3, 28, 6); g.fillRect(-14, 8, 18, 3); } else { g.fillStyle = '#22506a'; g.fillRect(-5, -5, 10, 10); }
        g.restore();
      }
      px(g, 13); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('MOVES ' + String(Math.floor(t % cyc * 2)).padStart(2, '0'), 24, 190); g.textAlign = 'right'; g.fillStyle = C.gold; g.fillText(Math.min(6, Math.floor((t % cyc) / 1.4)) + ' / 6', 296, 190);
    },
    stack: function (g, t) {
      backdrop(g); var cyc = 9.9, ct = t % cyc, k = Math.floor(ct / .9), ph = (ct % .9) / .9, FHh = 11, base = 176;
      var cam = Math.max(0, (k + 1) * FHh - 86);
      var ground = base + cam;
      // skyline with altitude marks
      var marks = [[.12, 310, 'tm'], [.88, 421, 'kl'], [.28, 445, 'ex'], [.74, 452, 'pt']];
      marks.forEach(function (m) { var h = m[1] / 5.2, topY = ground - h; g.fillStyle = '#0d2738'; var cx = m[0] * PW; if (m[2] === 'pt') twin(g, cx, ground, h, '#0d2738'); else if (m[2] === 'kl') { g.fillRect(cx - 1.5, topY, 3, h); g.beginPath(); g.ellipse(cx, topY + h * .38, 7, 4, 0, 0, 7); g.fill(); } else g.fillRect(cx - h * .045, topY, h * .09, h);
        if (topY > -4 && topY < PH) { g.fillStyle = C.mute; g.globalAlpha = .5; for (var x = 0; x < PW; x += 14) g.fillRect(x, topY, 6, 1); g.globalAlpha = 1; } });
      g.fillStyle = C.bg2; g.fillRect(0, ground, PW, PH); g.fillStyle = C.teal; g.fillRect(0, ground, PW, 1.5);
      var wBase = 96, sw = [];
      for (var i = 0; i <= k; i++) { var off = i === 0 ? 0 : (hash(i * 5.3) < .4 ? 0 : (hash(i * 2.7) - .5) * 26); sw.push({ off: off }); }
      var x = PW / 2, w = wBase; for (i = 0; i <= k; i++) { var o = sw[i].off; if (i > 0) { w = Math.max(40, w - Math.abs(o) * .5); x += o * .5; } var y = ground - (i + 1) * FHh;
        g.fillStyle = i % 4 === 3 ? '#2c8f96' : C.teal; g.fillRect(x - w / 2, y, w, FHh - 1); g.fillStyle = C.ink; g.globalAlpha = .55; g.fillRect(x - w / 2, y, w, 1.2); g.globalAlpha = 1;
        g.fillStyle = C.gold; for (var q = 0; q < w / 11 - 1; q++) if (hash(i * 7 + q) < .6) g.fillRect(x - w / 2 + 4 + q * 11, y + 3.5, 5, 4); }
      // the sliding floor
      var R = 120, bxp = PW / 2 + Math.sin((ct) * 3.4 + k) * R * (1 - ph * 0) , by = ground - (k + 2) * FHh;
      var tri = Math.abs(((ph * 2 + (k % 2)) % 2) - 1) * 2 - 1; bxp = x + tri * R * (1 - ph);
      g.fillStyle = C.gold; g.globalAlpha = .9; g.fillRect(bxp - w / 2, by, w, FHh - 1); g.globalAlpha = 1;
      px(g, 14); g.textAlign = 'left'; g.fillStyle = C.ink; g.fillText('FLOOR ' + String(k + 1).padStart(2, '0'), 12, 22);
      px(g, 11); g.fillStyle = C.gold; if (ph < .25 && k > 1 && k % 3 === 0) { g.textAlign = 'center'; g.globalAlpha = 1 - ph * 4; g.fillText('PERFECT', x, ground - (k + 1) * FHh - 8 - ph * 30); g.globalAlpha = 1; }
    },
    orbit: function (g, t) {
      backdrop(g); var cx = 160, cy = 100, R = 66, yaw = t * .35;
      for (var i = 0; i < 70; i++) { g.fillStyle = C.ink; g.globalAlpha = .12 + hash(i) * .5; g.fillRect(hash(i * 1.3) * PW, hash(i * 2.9) * PH, 1, 1); } g.globalAlpha = 1;
      g.fillStyle = '#0a2236'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
      var N = 520, ga = Math.PI * (3 - Math.sqrt(5));
      for (i = 0; i < N; i++) { var yy = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - yy * yy), a = i * ga + yaw, X = Math.cos(a) * r, Z = Math.sin(a) * r; if (Z < 0) continue; var land = hash(Math.floor(Math.atan2(X, Z) * 4) * 3 + Math.floor(yy * 5)) > .5; g.fillStyle = land ? C.teal : '#1d4f6c'; g.globalAlpha = .35 + Z * .6; g.fillRect(cx + X * R, cy - yy * R, 1.6, 1.6); }
      g.globalAlpha = 1; g.strokeStyle = C.blue; g.lineWidth = 1; g.globalAlpha = .5; g.beginPath(); g.arc(cx, cy, R + 1, 0, 7); g.stroke(); g.globalAlpha = 1;
      // KL and arcs
      var kl = [cx + Math.sin(.6 - yaw * 0 + Math.sin(t * .35) * 0) * 18 + 14, cy + 6];
      var ends = [[cx - 38, cy - 34], [cx + 40, cy - 30], [cx - 10, cy + 52]];
      ends.forEach(function (e, j) { var ph = (t * .5 + j * .33) % 1; g.strokeStyle = C.gold; g.globalAlpha = .75; g.lineWidth = 1.2; g.beginPath(); g.moveTo(kl[0], kl[1]); g.quadraticCurveTo((kl[0] + e[0]) / 2, Math.min(kl[1], e[1]) - 40, e[0], e[1]); g.stroke(); var q = ph, bx = (1 - q) * (1 - q) * kl[0] + 2 * (1 - q) * q * ((kl[0] + e[0]) / 2) + q * q * e[0], by = (1 - q) * (1 - q) * kl[1] + 2 * (1 - q) * q * (Math.min(kl[1], e[1]) - 40) + q * q * e[1]; g.fillStyle = C.ink; g.globalAlpha = 1; g.fillRect(bx - 1.5, by - 1.5, 3, 3); });
      g.fillStyle = C.gold; g.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 3)); g.beginPath(); g.arc(kl[0], kl[1], 3.5, 0, 7); g.fill(); g.globalAlpha = 1;
      // satellites
      for (i = 0; i < 3; i++) { var an = t * (.5 + i * .17) + i * 2.1, rx = R + 22 + i * 14, ry = (R + 22 + i * 14) * .3; g.strokeStyle = C.mute; g.globalAlpha = .35; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rx, ry, i * .35 - .2, 0, 7); g.stroke(); g.globalAlpha = 1; var ex = rx * Math.cos(an), ey = ry * Math.sin(an), rt = i * .35 - .2; g.fillStyle = C.ink; g.fillRect(cx + ex * Math.cos(rt) - ey * Math.sin(rt) - 2, cy + ex * Math.sin(rt) + ey * Math.cos(rt) - 1, 4, 3); }
      px(g, 11); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('KUALA LUMPUR  3.139 N  101.687 E', 12, 190);
    },
    lab: function (g, t) {
      backdrop(g); var s = PV._lab || (PV._lab = (function () { var N = 520, A = new Float32Array(N * 3), B = new Float32Array(N * 3), ga = Math.PI * (3 - Math.sqrt(5)); for (var i = 0; i < N; i++) { var y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y); A[3 * i] = Math.cos(i * ga) * r * .8; A[3 * i + 1] = y * .8; A[3 * i + 2] = Math.sin(i * ga) * r * .8; var tw = i % 2 ? 1 : -1, h = hash(i * 1.7), wd = (1 - h * .35) * .13; B[3 * i] = tw * .22 + (hash(i * 3.3) - .5) * wd * 2; B[3 * i + 1] = h * 1.6 - .8; B[3 * i + 2] = (hash(i * 5.9) - .5) * wd * 2; } return { N: N, A: A, B: B }; })());
      var u = ease((Math.sin(t * .6) + 1) / 2 * 1.6 - .3), yaw = t * .5, cs = Math.cos(yaw), sn = Math.sin(yaw), sc = 78;
      for (var i = 0; i < s.N; i++) { var x = s.A[3 * i] + (s.B[3 * i] - s.A[3 * i]) * u, y = s.A[3 * i + 1] + (s.B[3 * i + 1] - s.A[3 * i + 1]) * u, z = s.A[3 * i + 2] + (s.B[3 * i + 2] - s.A[3 * i + 2]) * u; var X = x * cs - z * sn, Z = x * sn + z * cs, per = 1 / (1 + Z * .35); g.globalAlpha = clamp(.35 + Z * .35 + .4, .2, 1); g.fillStyle = i % 5 === 0 ? C.gold : i % 3 === 0 ? C.blue : C.teal; var q = 1.4 * per; g.fillRect(160 + X * sc * per - q / 2, 100 - y * sc * per - q / 2, q, q); }
      g.globalAlpha = 1; px(g, 11); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText(u > .5 ? 'PETRONAS TOWERS' : 'SPHERE', 12, 190); g.textAlign = 'right'; g.fillText('520 PARTICLES', 308, 190);
    },
    glass: function (g, t) {
      var off = PV._glassOff; if (!off) { off = PV._glassOff = document.createElement('canvas'); off.width = 360; off.height = 200; var o = off.getContext('2d'), gr = o.createLinearGradient(0, 0, 360, 200); gr.addColorStop(0, '#0a3b4a'); gr.addColorStop(.4, '#2c8f96'); gr.addColorStop(.7, '#6aa8ff'); gr.addColorStop(1, '#e3b14e'); o.fillStyle = gr; o.fillRect(0, 0, 360, 200); o.fillStyle = 'rgba(255,255,255,.25)'; o.beginPath(); o.arc(250, 70, 46, 0, 7); o.fill(); o.fillStyle = 'rgba(6,16,26,.7)'; for (var i = 0; i < 7; i++) { var h = 30 + hash(i) * 80; o.fillRect(20 + i * 46, 200 - h, 26, h); } }
      g.fillStyle = C.bg; g.fillRect(0, 0, PW, PH); var ribs = 16, rw = PW / ribs;
      for (var i = 0; i < ribs; i++) { var sh = Math.sin(t * .8 + i * .42) * 10 + (i - 8) * 1.6, sx = clamp(i * rw + sh + 20, 0, 360 - rw); g.drawImage(off, sx, 0, rw, 200, i * rw, 0, rw + .5, PH); var lg = g.createLinearGradient(i * rw, 0, (i + 1) * rw, 0); lg.addColorStop(0, 'rgba(255,255,255,.22)'); lg.addColorStop(.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = lg; g.fillRect(i * rw, 0, rw, PH); }
      var lx = ((t * 50) % 440) - 60; var sg = g.createLinearGradient(lx - 40, 0, lx + 40, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.28)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(lx - 40, 0, 80, PH);
      px(g, 14); g.textAlign = 'left'; g.fillStyle = C.ink; g.fillText('Seen through glass', 14, 188);
    },
    anatomy: function (g, t) {
      backdrop(g);
      var ex = (Math.sin(t * 1.1) * .5 + .5) * 14;
      var cx = 160, base = 172;
      g.strokeStyle = 'rgba(255,210,122,.28)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(cx, 18); g.lineTo(cx, base + 6); g.stroke(); g.setLineDash([]);
      var widths = [74, 52, 46, 34, 14], heights = [18, 22, 16, 20, 26];
      var y = base;
      for (var i = 0; i < 5; i++) {
        var h = heights[i], w = widths[i], lift = i * ex, yy = y - h - lift;
        var hi = Math.floor(t * .9) % 5 === i;
        g.fillStyle = hi ? C.gold : (i % 2 ? '#164166' : '#0f2d49');
        g.strokeStyle = hi ? '#fff0c2' : C.blue; g.lineWidth = 1.4;
        g.fillRect(cx - w / 2, yy, w, h); g.strokeRect(cx - w / 2, yy, w, h);
        g.fillStyle = hi ? C.gold : C.mute; mono(g, 8); g.textAlign = 'left';
        g.fillText('0' + (i + 1), cx + w / 2 + 12, yy + h / 2 + 3);
        y -= h + 2;
      }
      px(g, 11); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('EXPLODED STRATA · 4 LANDMARKS', 12, 190);
    },
    sat: function (g, t) {
      backdrop(g);
      for (var i = 0; i < 26; i++) { g.globalAlpha = .25 + hash(i * 2.3) * .5; g.fillStyle = C.ink; g.fillRect(hash(i * 1.7) * PW, hash(i * 4.1) * 150, 1.2, 1.2); } g.globalAlpha = 1;
      var cx = 160, cy = 96, sw = Math.sin(t * .35) * 5;
      function draw(xr) {
        g.save(); g.translate(cx, cy + sw); g.rotate(-.2 + Math.sin(t * .3) * .05);
        g.lineWidth = 1.2; g.strokeStyle = xr ? C.teal : C.blue;
        [-1, 1].forEach(function (sd) {
          var x0 = sd * 26, w = 82; g.fillStyle = xr ? 'rgba(79,194,200,.08)' : '#12305a'; g.fillRect(sd > 0 ? x0 : x0 - w, -22, w, 44); g.strokeRect(sd > 0 ? x0 : x0 - w, -22, w, 44);
          g.beginPath(); for (var k = 1; k < 5; k++) { var gx = (sd > 0 ? x0 : x0 - w) + k * w / 5; g.moveTo(gx, -22); g.lineTo(gx, 22); } for (k = 1; k < 3; k++) { g.moveTo(sd > 0 ? x0 : x0 - w, -22 + k * 44 / 3); g.lineTo((sd > 0 ? x0 : x0 - w) + w, -22 + k * 44 / 3); } g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
        });
        g.fillStyle = xr ? 'rgba(227,177,78,.12)' : C.gold; g.strokeStyle = xr ? C.gold : '#fff0c2'; g.fillRect(-26, -26, 52, 52); g.strokeRect(-26, -26, 52, 52);
        if (xr) { g.strokeStyle = C.gold; g.beginPath(); g.moveTo(-18, -18); g.lineTo(18, 18); g.moveTo(18, -18); g.lineTo(-18, 18); g.rect(-9, -9, 18, 18); g.stroke(); }
        else { g.fillStyle = C.bg2; g.beginPath(); g.arc(0, -34, 11, 0, 7); g.fill(); g.strokeStyle = C.mute; g.stroke(); }
        g.restore();
      }
      draw(false);
      var ang = t * .8, rx = cx + Math.cos(ang) * 58, ry = cy + Math.sin(ang * 1.3) * 18;
      g.save(); g.beginPath(); g.arc(rx, ry, 34, 0, 7); g.clip(); g.fillStyle = 'rgba(6,16,26,.88)'; g.fillRect(rx - 40, ry - 40, 80, 80); draw(true); g.restore();
      g.strokeStyle = C.teal; g.lineWidth = 1.4; g.beginPath(); g.arc(rx, ry, 34, 0, 7); g.stroke();
      px(g, 11); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('GPM · TRMM · AIM · X-RAY', 12, 190);
    },
    lglass: function (g, t) {
      backdrop(g);
      var cx = 160, cy = 94, sz = 104, ang = t * 1.1;
      var r = 24 + Math.sin(t * .8) * 18;
      g.save();
      rr(g, cx - sz / 2, cy - sz / 2, sz, sz, r);
      var grd = g.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50);
      grd.addColorStop(0, 'rgba(120,190,255,.22)'); grd.addColorStop(.5, 'rgba(255,255,255,.06)'); grd.addColorStop(1, 'rgba(255,210,122,.22)');
      g.fillStyle = grd; g.fill();
      g.strokeStyle = C.blue; g.lineWidth = 2; g.stroke();
      // orbiting specular rim
      var sx = cx + Math.cos(ang) * (sz * .46), sy = cy + Math.sin(ang) * (sz * .46);
      var sp = g.createRadialGradient(sx, sy, 2, sx, sy, 32);
      sp.addColorStop(0, 'rgba(255,255,255,.9)'); sp.addColorStop(.45, 'rgba(106,168,255,.4)'); sp.addColorStop(1, 'rgba(255,210,122,0)');
      g.fillStyle = sp; g.fill();
      // \7 mark inside
      g.fillStyle = C.ink; px(g, 42); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\\7', cx, cy + 2);
      g.restore(); g.textBaseline = 'alphabetic';
      mono(g, 9); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('WEBGL2 · DISPERSION · CUSTOM SVG', 12, 190);
    },
    sql: function (g, t) { sqlPv(g, t, ['SELECT E_department,', '       count(*) AS people', 'FROM Employee', 'GROUP BY 1', 'ORDER BY 2 DESC;'], [['Sales', '41'], ['Finance', '33'], ['IT', '27'], ['Legal', '12']], ['department', 'people']); },
    sql2: function (g, t) { sqlPv(g, t, ['SELECT who, count(*)', 'FROM (SELECT \'Students\' who', '      FROM Student) t', 'GROUP BY who;'], [['Students', '120'], ['Teachers', '14'], ['Clients', '86']], ['who', 'how_many']); },
    atlas: function (g, t) {
      backdrop(g); var N = [[50, 50], [110, 36], [170, 64], [236, 40], [276, 86], [220, 118], [150, 104], [84, 96], [40, 140], [120, 152], [200, 160], [270, 150], [160, 28], [60, 18]];
      var E = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 0], [7, 8], [6, 9], [9, 10], [10, 5], [5, 4], [4, 11], [11, 10], [1, 12], [12, 2], [0, 13], [13, 1]];
      g.strokeStyle = C.dim; g.lineWidth = 1.4; E.forEach(function (e) { g.beginPath(); g.moveTo(N[e[0]][0], N[e[0]][1]); g.lineTo(N[e[1]][0], N[e[1]][1]); g.stroke(); });
      var path = [[8, 7, 6, 5, 4], [0, 1, 2, 5, 11], [13, 1, 2, 3, 4]][Math.floor(t / 3.2) % 3], pr = ((t % 3.2) / 3.2) * 1.5;
      glowLine(g, C.gold, 2, function () { g.beginPath(); path.forEach(function (n, i) { var seg = clamp(pr * (path.length - 1) - (i - 1), 0, 1); if (i === 0) g.moveTo(N[n][0], N[n][1]); else { var p = N[path[i - 1]]; g.lineTo(p[0] + (N[n][0] - p[0]) * seg, p[1] + (N[n][1] - p[1]) * seg); } }); });
      N.forEach(function (n, i) { var on = path.indexOf(i) >= 0 && pr * (path.length - 1) >= path.indexOf(i) - .1; g.fillStyle = on ? C.gold : '#0f2b3d'; g.strokeStyle = on ? C.gold : C.teal; g.lineWidth = 1.5; rr(g, n[0] - 10, n[1] - 6, 20, 12, 3); g.fill(); g.stroke(); });
      mono(g, 9); g.textAlign = 'left'; g.fillStyle = C.mute; g.fillText('20 TABLES · 36 LINKS · SHORTEST ROUTE', 12, 192);
    },
    egg: function (g, t) {
      backdrop(g); var fl = hash(Math.floor(t * 9)) > .88 ? .4 : 1;
      g.fillStyle = '#0b1c28'; g.fillRect(70, 14, 180, 172); g.strokeStyle = C.dim; g.lineWidth = 2; g.strokeRect(70, 14, 180, 172);
      g.globalAlpha = fl; px(g, 74); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.gold; g.fillText('?', 160, 92); g.globalAlpha = 1; g.textBaseline = 'alphabetic';
      g.save(); g.beginPath(); g.rect(0, 0, PW, PH); g.clip(); g.translate(160, 104); g.rotate(-.28); g.fillStyle = C.gold; g.fillRect(-260, -11, 520, 22); g.fillStyle = '#10222d'; for (var i = -22; i < 22; i++) { g.beginPath(); g.moveTo(i * 12, -11); g.lineTo(i * 12 + 6, -11); g.lineTo(i * 12 - 2, 11); g.lineTo(i * 12 - 8, 11); g.fill(); } g.restore();
      var ct = t % 7, tx = -130 + ct * 70; if (ct < 6) { g.fillStyle = C.teal; g.globalAlpha = .9; for (var c = 0; c < 3; c++) rr(g, tx + c * 42, 172, 38, 14, 4), g.fill(); g.globalAlpha = 1; }
      g.fillStyle = C.mute; g.fillRect(0, 187, PW, 1.5);
    }
  };
  function sqlPv(g, t, lines, rows, head) {
    backdrop(g); var cps = 22, total = lines.join('\n').length, ct = t % 9, typed = Math.min(total, Math.floor(ct * cps)), done = typed >= total, s = lines.join('\n').slice(0, typed).split('\n');
    g.fillStyle = '#0b1c28'; g.fillRect(14, 12, 292, 88); mono(g, 10); g.textAlign = 'left';
    var kw = /^(SELECT|FROM|GROUP|ORDER|BY|AS|DESC|count)$/i;
    s.forEach(function (ln, i) { var x = 24; ln.split(/(\s+|,|\(|\)|;)/).forEach(function (w) { if (!w) return; g.fillStyle = kw.test(w) ? C.gold : /^'/.test(w) ? C.blue : C.ink; g.fillText(w, x, 30 + i * 13); x += g.measureText(w).width; }); });
    if (!done && Math.floor(t * 2) % 2 === 0) { var li = s.length - 1, w = g.measureText(s[li]).width; g.fillStyle = C.teal; g.fillRect(24 + w + 1, 22 + li * 13, 6, 10); }
    var show = done ? clamp((ct - total / cps - .2) / .25, 0, 1) : 0; if (show > 0) {
      g.globalAlpha = show; g.fillStyle = '#0d2535'; g.fillRect(14, 108, 292, 82); g.fillStyle = C.teal; g.fillRect(14, 108, 292, 14); g.fillStyle = C.bg; mono(g, 9); g.fillText(head[0], 22, 118); g.textAlign = 'right'; g.fillText(head[1], 298, 118); g.textAlign = 'left';
      rows.forEach(function (r, i) { var a = clamp((ct - total / cps - .4 - i * .25) / .2, 0, 1); g.globalAlpha = show * a; g.fillStyle = C.ink; g.fillText(r[0], 22, 136 + i * 14); g.textAlign = 'right'; g.fillStyle = C.gold; g.fillText(r[1], 298, 136 + i * 14); g.textAlign = 'left'; }); g.globalAlpha = 1;
    }
  }

  var pvs = $$('canvas.pv').map(function (cv) { return { cv: cv, g: cv.getContext('2d'), fn: PV[cv.dataset.pv], vis: false, t0: hash(cv.dataset.pv.length * 3 + cv.dataset.pv.charCodeAt(0)) * 6 }; });
  var pvRaf = 0, pvLast = 0;
  function drawPv(p, t) { var g = p.g; g.setTransform(p.cv.width / PW, 0, 0, p.cv.height / PH, 0, 0); g.textBaseline = 'alphabetic'; g.textAlign = 'left'; try { p.fn(g, t + p.t0); } catch (e) { /* a preview must never break the page */ } }
  function pvTick(ms) {
    pvRaf = 0; if (!previewsOn || d.hidden) return;
    var any = false; if (ms - pvLast >= 32) { pvLast = ms; pvs.forEach(function (p) { if (p.vis) drawPv(p, ms / 1000); }); }
    pvs.forEach(function (p) { if (p.vis) any = true; });
    if (any && !calm()) pvRaf = requestAnimationFrame(pvTick);
  }
  function wakePreviews() { if (!pvRaf && previewsOn) { pvRaf = requestAnimationFrame(pvTick); } }
  if ('IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (en) { en.forEach(function (e) { var p = pvs.filter(function (x) { return x.cv === e.target; })[0]; if (p) { p.vis = e.isIntersecting; if (e.isIntersecting && calm()) drawPv(p, 2.4); } }); wakePreviews(); }, { rootMargin: '120px' });
    pvs.forEach(function (p) { pio.observe(p.cv); });
  } else pvs.forEach(function (p) { p.vis = true; drawPv(p, 2.4); });
  d.addEventListener('visibilitychange', wakePreviews);
  calmQ.addEventListener && calmQ.addEventListener('change', function () { pvs.forEach(function (p) { if (p.vis) drawPv(p, 2.4); }); wakePreviews(); });

  // a cabinet's screen lights up while you hover or focus it: the preview speeds nothing, only the glow changes (CSS)

  /* =====================================================================
     the hero's attract loop: Last Train plays itself
     ===================================================================== */
  var hero = $('.hero-play');
  if (hero) (function () {
  var acv = $('#attract'), ag = acv.getContext('2d', { alpha: true }), aw = 0, ah = 0, adpr = 1, gY = 0, aOn = true, aVis = true, aRaf = 0, aLast = 0, AP = null, aTheme = '';
  function rgb(c) { var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((c || '').trim()); if (m) { var h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; } return [128, 128, 128]; }
  function mixc(a, b, t) { var A = rgb(a), B = rgb(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; }
  function aPal() {
    var cs = getComputedStyle(root); function gv(n, f) { var v = cs.getPropertyValue(n).trim(); return v || f; }
    var bg = gv('--bg', '#f3f6f6'), ink = gv('--ink', '#0f1e24'), accent = gv('--accent', '#0a6c74'), gold = gv('--gold', '#a86d12'), surface = gv('--surface', '#fff'), line = gv('--line', '#d6e0e2');
    var dark = (rgb(bg)[0] + rgb(bg)[1] + rgb(bg)[2]) / 3 < 110;
    AP = { dark: dark, bg: bg, ink: ink, accent: accent, gold: gold, surface: surface, line: line, far: dark ? mixc(bg, accent, .13) : mixc(bg, accent, .1), mid: dark ? mixc(bg, accent, .24) : mixc(bg, accent, .2), near: dark ? mixc(bg, accent, .4) : mixc(bg, accent, .34), street: dark ? mixc(bg, '#000', .4) : mixc(bg, ink, .07), sunA: dark ? '#e8f0ff' : gold };
    aTheme = root.getAttribute('data-theme') || '';
  }
  function aResize() {
    var r = hero.getBoundingClientRect(); aw = Math.round(r.width); ah = Math.round(r.height); if (!aw || !ah) return;
    adpr = Math.min(window.devicePixelRatio || 1, 1.75); acv.width = Math.round(aw * adpr); acv.height = Math.round(ah * adpr);
    var foot = $('.hero-foot'); gY = ah - (foot ? foot.offsetHeight + 36 : 150); gY = clamp(gY, ah * .52, ah - 90); aDraw(performance.now() / 1000);
  }
  function aDraw(t) {
    if (!aw) return; if (!AP || aTheme !== (root.getAttribute('data-theme') || '')) aPal();
    var g = ag, s = Math.min(1.25, Math.max(.62, aw / 1100)), H = ah, W = aw, gy = gY, sp = 250 * Math.max(.7, s);
    g.setTransform(adpr, 0, 0, adpr, 0, 0); g.clearRect(0, 0, W, H);
    // sun or moon with a neon ring
    var sx = W * .74, sy = gy - 210 * s - 40, sr = 62 * s; g.strokeStyle = AP.sunA; g.globalAlpha = AP.dark ? .9 : .8; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.stroke(); g.globalAlpha = AP.dark ? .08 : .14; g.fillStyle = AP.sunA; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
    g.globalAlpha = .35; g.lineWidth = 1; g.beginPath(); g.arc(sx, sy, sr + 12 * s, 0, 7); g.stroke(); g.globalAlpha = 1;
    if (AP.dark) { g.fillStyle = '#fff'; for (var i = 0; i < 46; i++) { g.globalAlpha = .25 + .5 * Math.abs(Math.sin(t * .8 + i)); g.fillRect(hash(i) * W, hash(i + 40) * gy * .7, 1.4, 1.4); } g.globalAlpha = 1; }
    // far blocks, landmarks, mid blocks
    function layer(speed, col, hmin, hr, wmin, wr, seed) { g.fillStyle = col; var x = -((t * speed) % 4000), k = 0; while (x < W + 200) { var w = (wmin + hash(k * 1.7 + seed) * wr) * s, h = (hmin + hash(k * 2.3 + seed) * hr) * s; if (x + w > -20) g.fillRect(x, gy - h, w, h + 2); x += w + (4 + hash(k + seed) * 10) * s; k++; } }
    layer(6, AP.far, 40, 120, 30, 40, 1);
    // landmarks scroll slowly in a loop: Petronas, KL Tower, Exchange 106, Merdeka 118
    var loop = 1500 * s, lm = [[.12, 'pt', 250], [.38, 'kl', 232], [.6, 'ex', 244], [.84, 'md', 330]];
    lm.forEach(function (L, idx) {
      var x = ((L[0] * loop - t * 12 * s) % loop + loop) % loop - 160 * s, h = L[2] * s * 1.15;
      g.fillStyle = AP.mid;
      if (L[1] === 'pt') { var w = h * .11; g.fillRect(x - w - 2, gy - h, w, h); g.fillRect(x + 2, gy - h, w, h); g.fillRect(x - w * .6, gy - h * .5, w * 2.2 + 4, 3 * s); g.fillRect(x - w / 2 - 2, gy - h - 10 * s, 2, 10 * s); g.fillRect(x + w / 2 + 2, gy - h - 10 * s, 2, 10 * s); }
      else if (L[1] === 'kl') { g.fillRect(x - 2, gy - h, 4, h); g.beginPath(); g.ellipse(x, gy - h * .64, 11 * s, 7 * s, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 14 * s, gy); g.lineTo(x - 2, gy - h * .4); g.lineTo(x + 2, gy - h * .4); g.lineTo(x + 14 * s, gy); g.fill(); }
      else if (L[1] === 'ex') { var b = h * .09; g.beginPath(); g.moveTo(x - b / 2, gy); g.lineTo(x - b * .42, gy - h * .88); g.lineTo(x - b * .1, gy - h); g.lineTo(x + b * .1, gy - h); g.lineTo(x + b * .42, gy - h * .88); g.lineTo(x + b / 2, gy); g.fill(); }
      else { var w0 = h * .13; g.beginPath(); g.moveTo(x - w0, gy); g.lineTo(x - w0 * .7, gy - h * .55); g.lineTo(x - w0 * .3, gy - h * .9); g.lineTo(x - 2, gy - h); g.lineTo(x + 2, gy - h); g.lineTo(x + w0 * .3, gy - h * .9); g.lineTo(x + w0 * .7, gy - h * .55); g.lineTo(x + w0, gy); g.fill(); }
      if (AP.dark) { g.fillStyle = AP.gold; g.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 2 + idx)); g.fillRect(x - 1.5, gy - h - 4, 3, 3); g.globalAlpha = 1; }
    });
    layer(22, AP.near, 18, 70, 24, 40, 7);
    if (AP.dark) { g.fillStyle = AP.gold; g.globalAlpha = .55; var xk = -((t * 22) % 4000), kk = 0; while (xk < W + 200) { var wk = (24 + hash(kk * 1.7 + 7) * 40) * s, hk = (18 + hash(kk * 2.3 + 7) * 70) * s; if (xk + wk > 0) for (var wy = gy - hk + 6; wy < gy - 6; wy += 11) for (var wx = xk + 4; wx < xk + wk - 6; wx += 9) if (hash(wx * .31 + wy * .17) > .6) g.fillRect(wx, wy, 3, 4); xk += wk + (4 + hash(kk + 7) * 10) * s; kk++; } g.globalAlpha = 1; }
    // street, neon rail
    g.fillStyle = AP.street; g.fillRect(0, gy, W, H - gy);
    g.strokeStyle = AP.accent; g.globalAlpha = .22; g.lineWidth = 7; g.beginPath(); g.moveTo(0, gy + 1); g.lineTo(W, gy + 1); g.stroke(); g.globalAlpha = 1; g.lineWidth = 2; g.beginPath(); g.moveTo(0, gy + 1); g.lineTo(W, gy + 1); g.stroke();
    g.fillStyle = AP.ink; g.globalAlpha = .22; for (i = 0; i < W / 40 + 2; i++) g.fillRect(((i * 40 - t * sp) % (W + 80) + W + 80) % (W + 80) - 40, gy + 10, 22, 4); g.globalAlpha = 1;
    // the bot: obstacles and tokens are functions of time, so the loop needs no state
    var per = 380 * s, tx = Math.max(70, W * .2), jump = 0;
    for (var k2 = -1; k2 < W / per + 2; k2++) {
      var ox = W * .55 + k2 * per - ((t * sp) % per), ow = 30 * s, oh = 38 * s, dx = ox - tx;
      var j = 1 - Math.pow((dx - 12 * s) / (84 * s), 2); if (j > 0) jump = Math.max(jump, j * 78 * s);
      g.save(); g.beginPath(); g.rect(ox, gy - oh, ow, oh); g.clip(); g.fillStyle = AP.ink; g.fillRect(ox, gy - oh, ow, oh); g.fillStyle = AP.gold;
      for (var z = -oh; z < ow + oh; z += 14 * s) { g.beginPath(); g.moveTo(ox + z, gy); g.lineTo(ox + z + 7 * s, gy); g.lineTo(ox + z + 7 * s + oh, gy - oh); g.lineTo(ox + z + oh, gy - oh); g.fill(); }
      g.restore();
      for (var q = 0; q < 3; q++) { var kx = ox + ow / 2 - 40 * s + q * 40 * s; if (kx < tx + 20) continue; var ky = gy - 110 * s - (q === 1 ? 24 * s : 0) + Math.sin(t * 6 + q) * 3; g.fillStyle = AP.gold; g.beginPath(); g.moveTo(kx, ky - 12 * s); g.lineTo(kx + 11 * s, ky); g.lineTo(kx, ky + 12 * s); g.lineTo(kx - 11 * s, ky); g.fill(); }
    }
    var tw = 92 * s, th = 44 * s, ty = gy - jump - 3; g.fillStyle = AP.accent; rr(g, tx, ty - th, tw, th - 8 * s, 12 * s); g.fill();
    g.fillStyle = AP.surface; for (i = 0; i < 3; i++) g.fillRect(tx + 11 * s + i * 25 * s, ty - th + 11 * s, 18 * s, 13 * s);
    g.fillStyle = AP.gold; g.fillRect(tx + 6 * s, ty - 22 * s, tw - 12 * s, 4 * s); g.fillStyle = AP.ink; g.beginPath(); g.arc(tx + 20 * s, ty - 2, 6 * s, 0, 7); g.arc(tx + tw - 20 * s, ty - 2, 6 * s, 0, 7); g.fill();
    if (jump > 4) { g.fillStyle = AP.accent; g.globalAlpha = .15; g.fillRect(tx + 8 * s, gy - 2, tw - 16 * s, 3); g.globalAlpha = 1; }
    // street readout
    g.font = '600 ' + Math.round(13 * Math.max(.9, s)) + 'px "Pixelify Sans","JetBrains Mono",monospace'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = AP.ink; g.globalAlpha = .5; g.fillText('AUTO-PILOT', 16, gy + 26); g.textAlign = 'right'; g.fillText('SCORE ' + String(Math.floor(t * sp / 10) % 100000).padStart(5, '0'), W - 16, gy + 26); g.globalAlpha = 1; g.textBaseline = 'alphabetic';
  }
  function aLoop(ms) {
    aRaf = 0; if (!aOn || !aVis || d.hidden || cur) return;
    if (ms - aLast >= 16) { aLast = ms; if (!hsCv || hsCur() === 'train') aDraw(ms / 1000); }
    if (!calm()) aRaf = requestAnimationFrame(aLoop);
  }
  function aWake() { if (!aRaf && aOn && aVis && !cur && !calm()) aRaf = requestAnimationFrame(aLoop); }
  if ('ResizeObserver' in window) new ResizeObserver(aResize).observe(hero); else addEventListener('resize', aResize);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { aVis = en[0].isIntersecting; aWake(); }).observe(hero);
  d.addEventListener('visibilitychange', aWake); d.addEventListener('play-view', function (e) { if (!e.detail.id) { setTimeout(aWake, 0); } });
  new MutationObserver(function () { aTheme = ''; if (calm() || !aRaf) aDraw(performance.now() / 1000); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  aPal(); aResize(); aWake();
  if (calm()) aDraw(7.3);

  /* =====================================================================
     the hero's showcase: every cabinet in turn, a live screen on the right; the second line of the title, the lede and Insert coin follow it
     ===================================================================== */
  var HS = [
    ['train', 'Game', 'Last Train', 'the skyline.', 'An arcade in one room. Ride the KL line, jump the scope creep and grab every requirement before the last train home.'],
    ['stack', 'Game', 'Skyline Stack', 'the tower.', 'One button, one tower. Stack Kuala Lumpur floor by floor, past Menara TM, KL Tower and Petronas, all the way up Merdeka 118.'],
    ['creep', 'Game', 'Scope Creep', 'the backlog.', 'Forty-five seconds of triage. Real requirement or creep? Build it or park it.'],
    ['match', 'Game', 'Spec Match', 'the stack.', 'Pair each tool with the project it shipped in. Fewest moves wins.']
  ];
  var hsI = 0, hsCv = $('#hero-show'), hsRaf = 0, hsLast = 0, hsHold = false, hsTimer = 0, hsVis = true, hsFade = 1;
  function hsCur() { return hsCv ? HS[hsI][0] : 'stack'; }
  function hsPvKey(id) { return id.indexOf('sql') === 0 ? 'sql' : id; }
  // every slide fills the whole hero: Last Train on the hero's own renderer, the others are their cabinet previews drawn full bleed (vector, so sharp at any size), cover-fitted with their middle at 64 % across so the title keeps the left
  function hsDraw(t) {
    if (!aw) return; var id = hsCur();
    if (id === 'train') { aDraw(t); return; }
    var g = ag, fn = PV[hsPvKey(id)], s = Math.max(aw / PW, ah / PH), tx = Math.min(0, Math.max(aw - PW * s, aw * .64 - PW * s / 2)), ty = (ah - PH * s) / 2;
    g.setTransform(adpr, 0, 0, adpr, 0, 0); g.clearRect(0, 0, aw, ah);
    g.setTransform(adpr * s, 0, 0, adpr * s, adpr * tx, adpr * ty); g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.globalAlpha = 1;
    try { fn(g, t); } catch (e) {}
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }
  function hsLoop(ms) { hsRaf = 0; if (!hsVis || d.hidden || cur) return; if (hsCur() !== 'train' && ms - hsLast >= 32) { hsLast = ms; hsDraw(ms / 1000); } if (!calm() && hsCur() !== 'train') hsRaf = requestAnimationFrame(hsLoop); }
  function hsWake() { if (!hsRaf && hsCv) hsRaf = requestAnimationFrame(hsLoop); }
  function hsSet(i, user) {
    if (!hsCv) return; hsI = (i + HS.length) % HS.length; var s = HS[hsI];
    var dark = s[0] !== 'train'; hero.classList.toggle('hs-dark', dark); hero.classList.remove('hs-swap'); void hero.offsetWidth; hero.classList.add('hs-swap');
    $('#hs-kind').textContent = s[1]; $('#hs-name').textContent = s[2];
    var l2 = $('#hs-l2'), le = $('#hs-lede');
    if (l2) { l2.classList.remove('hs-in'); void l2.offsetWidth; l2.textContent = s[3]; l2.classList.add('hs-in'); }
    if (le) le.textContent = s[4];
    $$('#hs-dots button').forEach(function (b, k) { b.setAttribute('aria-selected', k === hsI ? 'true' : 'false'); b.tabIndex = k === hsI ? 0 : -1; });
    var tg = $('.attract-tag'); if (tg) tg.lastChild.textContent = 'Now showing · ' + s[2];
    hsDraw(performance.now() / 1000); hsWake(); aWake(); hsArm(user);
  }
  function hsArm(user) { clearTimeout(hsTimer); if (calm()) return; hsTimer = setTimeout(function () { if (hsHold || cur || d.hidden || !hsVis) { hsArm(); return; } hsSet(hsI + 1); }, user ? 9000 : 5200); }
  if (hsCv) {
    var dots = $('#hs-dots');
    HS.forEach(function (s, k) { var b = d.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', s[2]); b.title = s[2]; b.addEventListener('click', function () { hsSet(k, true); }); dots.appendChild(b); });
    $('#hs-prev').addEventListener('click', function () { hsSet(hsI - 1, true); });
    $('#hs-next').addEventListener('click', function () { hsSet(hsI + 1, true); });
    $('#hs-open').addEventListener('click', function () { var id = hsCur(); open(id, { opener: $('.cab[data-open="' + id + '"]') }); });
    var shw = $('#hero-show');
    shw.addEventListener('pointerenter', function () { hsHold = true; }); shw.addEventListener('pointerleave', function () { hsHold = false; });
    shw.addEventListener('focusin', function () { hsHold = true; }); shw.addEventListener('focusout', function () { hsHold = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { hsVis = en[0].isIntersecting; hsWake(); }).observe(shw);
    d.addEventListener('visibilitychange', hsWake); d.addEventListener('play-view', function (e) { if (!e.detail.id) setTimeout(hsWake, 0); });
    hsSet(0); hsWake(); if (calm()) hsDraw(2.4);
  }

  heroCur = hsCur;
  })();

  /* =====================================================================
     start up
     ===================================================================== */
  paintScores(); wakePreviews();
  var h0 = location.hash.replace('#', ''); if (CAB[h0]) { setTimeout(function () { open(h0, { noPush: true }); }, 60); }
  addEventListener('hashchange', function () { var h = location.hash.replace('#', ''); if (!cur && CAB[h]) open(h, { noPush: true }); });
  window.__play = { open: open, close: close, cur: function () { return curId; }, scores: scores };
})();
