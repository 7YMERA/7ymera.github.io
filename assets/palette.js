/* palette.js: Site-wide Ctrl+K / Cmd+K Command Palette for 7YMERA.
 * Plain JS, zero dependencies. Works on Home, Portfolio, Lab, Play, Notes, and Flight. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  if (d.getElementById('cmd-backdrop')) return;

  var ITEMS = [
    // Pages
    { g: 'Pages', t: 'Home — Orbit, Descent & KL Flight', k: '/', href: '/' },
    { g: 'Pages', t: 'Portfolio — Work, Skills, Experience & CV', k: '/portfolio/', href: '/portfolio/' },
    { g: 'Pages', t: 'Lab — Satellites, Shaders, Score Lab & SQL', k: '/lab/', href: '/lab/' },
    { g: 'Pages', t: 'Play — Arcade Hall & Flight Log', k: '/play/', href: '/play/' },
    { g: 'Pages', t: 'Notes — 13 Technical Write-ups', k: '/notes/', href: '/notes/' },
    { g: 'Pages', t: 'Flight Viewer — Standalone 3D KL City', k: '/flight/', href: '/flight/' },
    { g: 'Pages', t: 'Resume / Printable CV', k: '/resume.html', href: '/resume.html' },
    // Lab & Games
    { g: 'Lab & Games', t: 'NASA Satellite X-Ray Inspector', k: 'Lab', href: '/lab/#satellite' },
    { g: 'Lab & Games', t: 'Score Lab — Live Web Audio Stem Mixer', k: 'Lab', href: '/lab/#scorelab' },
    { g: 'Lab & Games', t: 'Skyline Anatomy — Exploded KL Landmarks', k: 'Lab', href: '/lab/#anatomy' },
    { g: 'Lab & Games', t: 'Liquid Glass Lab — WebGL2 Optical Shader', k: 'Lab', href: '/lab/#lglass' },
    { g: 'Lab & Games', t: 'Orbit Globe & Particle Lab (Halcyon)', k: 'Lab', href: '/lab/#orbit' },
    { g: 'Lab & Games', t: 'Company SQL (49 tables) & Join Atlas', k: 'SQL', href: '/lab/#sql-company' },
    { g: 'Lab & Games', t: 'Jom Al-Quran SQL (26 tables)', k: 'SQL', href: '/lab/#sql-jom' },
    { g: 'Lab & Games', t: 'Skyline Stack — Stack past Merdeka 118', k: 'Game', href: '/play/#stack' },
    { g: 'Lab & Games', t: 'Last Train — KL Runner', k: 'Game', href: '/play/#train' },
    { g: 'Lab & Games', t: 'Scope Creep — 45s BA Triage', k: 'Game', href: '/play/#creep' },
    { g: 'Lab & Games', t: 'Spec Match — Tool & Project Pairs', k: 'Game', href: '/play/#match' },
    // Notes
    { g: 'Notes', t: 'Building this site (3D KL, zero frameworks)', k: 'Note', href: '/notes/portfolio-site.html' },
    { g: 'Notes', t: 'TaskMatch v2 — Rebuilding my FYP properly', k: 'Note', href: '/notes/taskmatch-v2.html' },
    { g: 'Notes', t: 'SLB IT Asset Disposal — 26 Interactive Screens', k: 'Note', href: '/notes/slb-screens.html' },
    { g: 'Notes', t: 'SMK Subang — Dashboard 150 teachers open', k: 'Note', href: '/notes/smk-dashboard.html' },
    { g: 'Notes', t: 'MyLokalEvent v2 — BM-first rebuild', k: 'Note', href: '/notes/mylokalevent-v2.html' },
    { g: 'Notes', t: 'KakiLima — Accessible civic reporting in 4 languages', k: 'Note', href: '/notes/kakilima.html' },
    { g: 'Notes', t: 'JumaatFinder — 565 geocoded masjid & surau', k: 'Note', href: '/notes/jumaatfinder.html' },
    { g: 'Notes', t: 'Jom Al-Quran — 56 tables back from Oracle', k: 'Note', href: '/notes/jom-al-quran.html' },
    // Actions
    { g: 'Actions', t: 'Switch Light / Dark Theme', k: 'Theme', act: function () {
      var cur = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    }},
    { g: 'Actions', t: 'Toggle Sound / Procedural Score', k: 'Audio', act: function () {
      var s = window.SFX || window.__sfx; if (s && s.toggle) s.toggle();
    }},
    { g: 'Actions', t: 'Sky Time: Day', k: 'Scene', act: function () { if (window.TimeOfDay) TimeOfDay.choose('day'); else if (window.SceneTime) SceneTime.mode('day'); } },
    { g: 'Actions', t: 'Sky Time: Golden Hour', k: 'Scene', act: function () { if (window.TimeOfDay) TimeOfDay.choose('golden'); else if (window.SceneTime) SceneTime.mode('golden'); } },
    { g: 'Actions', t: 'Sky Time: Night', k: 'Scene', act: function () { if (window.TimeOfDay) TimeOfDay.choose('night'); else if (window.SceneTime) SceneTime.mode('night'); } },
    { g: 'Actions', t: 'Sky Time: Live KL', k: 'Scene', act: function () { if (window.TimeOfDay) TimeOfDay.choose('live'); } }
  ];

  var bd = d.createElement('div');
  bd.id = 'cmd-backdrop'; bd.className = 'cmd-backdrop'; bd.setAttribute('role', 'dialog'); bd.setAttribute('aria-modal', 'true'); bd.setAttribute('aria-label', 'Command palette');
  bd.innerHTML =
    '<div class="cmd-dlg">' +
      '<div class="cmd-top">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input class="cmd-in" id="cmd-in" type="search" placeholder="Jump to a page, game, lab, note, or action…" autocomplete="off" spellcheck="false">' +
        '<button class="cmd-esc" type="button" id="cmd-esc">ESC</button>' +
      '</div>' +
      '<div class="cmd-list" id="cmd-list" role="listbox"></div>' +
      '<div class="cmd-foot" data-flightlog data-fl-compact></div>' +
    '</div>';
  d.body.appendChild(bd);

  // Inject a subtle Ctrl+K trigger button in headers that don't already have #qj-open
  var topWrap = d.querySelector('header.top .wrap');
  if (topWrap && !d.getElementById('qj-open')) {
    var kb = d.createElement('button');
    kb.type = 'button'; kb.className = 'icon-btn k-btn'; kb.id = 'cmd-open-btn';
    kb.setAttribute('aria-label', 'Open command palette (Ctrl+K)');
    kb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><kbd>' + (/Mac|iPhone|iPad/i.test(navigator.platform || '') ? '⌘K' : 'Ctrl K') + '</kbd>';
    var sfxBtn = topWrap.querySelector('#sfx-btn');
    if (sfxBtn) topWrap.insertBefore(kb, sfxBtn); else topWrap.appendChild(kb);
    kb.addEventListener('click', open);
  }

  var input = d.getElementById('cmd-in'), list = d.getElementById('cmd-list'), escBtn = d.getElementById('cmd-esc');
  var isOpen = false, shown = [], idx = 0, prevFocus = null;

  function render(q) {
    var s = (q || '').trim().toLowerCase();
    shown = ITEMS.filter(function (it) {
      if (!s) return true;
      return (it.t + ' ' + it.g + ' ' + it.k).toLowerCase().indexOf(s) >= 0;
    });
    idx = 0;
    if (!shown.length) { list.innerHTML = '<p class="cmd-empty">No matching destinations or actions.</p>'; return; }
    var html = '', lastG = '';
    shown.forEach(function (it, i) {
      if (it.g !== lastG) { lastG = it.g; html += '<p class="cmd-grp">' + lastG + '</p>'; }
      html += '<button type="button" class="cmd-item' + (i === 0 ? ' on' : '') + '" data-i="' + i + '" role="option"><span>' + it.t + '</span><small>' + it.k + '</small></button>';
    });
    list.innerHTML = html;
  }

  function highlight(n) {
    if (!shown.length) return;
    idx = (n + shown.length) % shown.length;
    var btns = list.querySelectorAll('.cmd-item');
    for (var i = 0; i < btns.length; i++) {
      var on = i === idx;
      btns[i].classList.toggle('on', on);
      if (on) btns[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function run(i) {
    var it = shown[i]; if (!it) return;
    close();
    if (it.act) { it.act(); return; }
    if (it.href) location.href = it.href;
  }

  function open() {
    if (isOpen) return;
    isOpen = true; prevFocus = d.activeElement;
    bd.classList.add('open');
    input.value = ''; render('');
    if (window.FlightLog) window.FlightLog.render(bd.querySelector('[data-flightlog]'));
    setTimeout(function () { input.focus(); }, 20);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; bd.classList.remove('open');
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) {} }
  }

  input.addEventListener('input', function () { render(input.value); });
  list.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cmd-item');
    if (b) run(+b.dataset.i);
  });
  bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
  escBtn.addEventListener('click', close);

  d.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      // On /portfolio/ keep native #qj-open if present unless Shift is held, or unify cleanly
      if (d.getElementById('qj-open') && !e.shiftKey) return;
      e.preventDefault();
      if (isOpen) close(); else open();
      return;
    }
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); highlight(idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(idx - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
  });

  window.CommandPalette = { open: open, close: close };
})();
