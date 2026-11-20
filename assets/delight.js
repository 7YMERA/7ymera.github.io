/* Small quality-of-life layer: keyboard shortcuts, live tab title, Kuala Lumpur clock, share, back to top,
   and one hidden train. Plain JS, no libraries. Everything degrades to nothing if it fails. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return d.getElementById(id); }
  function toast(msg) {
    var t = $('toast-foot'); if (!t) return;
    t.textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(function () { t.textContent = ''; }, 3200);
  }

  /* ---- sections: which one am I in, and where do j / k go ---- */
  var SECS = [['me', 'Me'], ['notes', 'Notes'], ['studied', 'What UTP put me through'], ['toolkit', 'Skills'], ['work', 'Work'], ['pulse', 'Pulse'], ['journey', 'Journey'], ['arcade', 'Arcade'], ['enter', 'Fly over KL'], ['contact', 'Contact']];
  function live() { return SECS.map(function (s) { return [d.getElementById(s[0]), s[1]]; }).filter(function (s) { return s[0] && s[0].offsetHeight > 0; }); }
  function current() {
    var list = live(), y = innerHeight * .4, at = -1;
    list.forEach(function (s, i) { if (s[0].getBoundingClientRect().top <= y) at = i; });
    return { list: list, at: at };
  }
  function step(dir) {
    var c = current(), to = c.at + dir;
    if (to < 0) { scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); return; }
    if (to >= c.list.length) to = c.list.length - 1;
    var el = c.list[to][0]; el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    try { history.replaceState(null, '', '#' + el.id); } catch (e) { /* file:// and sandboxes */ }
  }

  /* ---- tab title follows the section; a hidden tab gets a nudge ---- */
  var base = d.title, lastName = '';
  function title() {
    if (d.hidden) { d.title = 'Mind the gap · come back soon'; return; }
    d.title = lastName ? lastName + ' · ' + base : base;
  }
  d.addEventListener('visibilitychange', title);

  /* ---- back to top, big and labelled ---- */
  var up = d.createElement('button');
  up.type = 'button'; up.className = 'to-top'; up.setAttribute('aria-label', 'Back to the top');
  up.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg><span>Top</span>';
  up.addEventListener('click', function () { scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); });
  d.body.appendChild(up);

  var tick = 0;
  function onScroll() {
    if (tick) return; tick = requestAnimationFrame(function () {
      tick = 0;
      up.classList.toggle('on', scrollY > innerHeight * 1.6);
      var c = current(), name = c.at > -1 ? c.list[c.at][1] : '';
      if (name !== lastName) { lastName = name; title(); }
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---- Kuala Lumpur clock ---- */
  var clock = $('kl-clock');
  function paint() {
    if (!clock || d.hidden) return;
    var now = new Date(), t;
    try { t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }).format(now); } catch (e) { clock.textContent = ''; return; }
    var hr = parseInt(t, 10), mine = -now.getTimezoneOffset() / 60, diff = 8 - mine;
    var rel = diff === 0 ? 'the same time as you' : Math.abs(diff) % 1 ? 'a ' + (diff > 0 ? 'few hours ahead of' : 'few hours behind') + ' you' : Math.abs(diff) + ' h ' + (diff > 0 ? 'ahead of' : 'behind') + ' you';
    clock.innerHTML = '<i class="kl-dot ' + (hr >= 7 && hr < 19 ? 'day' : 'night') + '" aria-hidden="true"></i>';
    clock.appendChild(d.createTextNode("It's " + t + ' in Kuala Lumpur, ' + rel + '.'));
  }
  paint(); setInterval(paint, 30000); d.addEventListener('visibilitychange', paint);

  /* ---- share ---- */
  var share = $('share-site');
  if (share) share.addEventListener('click', function () {
    var url = location.origin + '/', data = { title: base, text: 'Alif Najmi: business analyst who ships software.', url: url };
    if (navigator.share) { navigator.share(data).catch(function () { /* cancelled */ }); return; }
    var settled = false;
    function say(m) { if (!settled) { settled = true; toast(m); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { say('Link copied'); }, function () { say('Copy this link: ' + url); });
      setTimeout(function () { say('Copy this link: ' + url); }, 900); /* a browser that never answers */
    } else say('Copy this link: ' + url);
  });

  /* ---- shortcuts sheet ---- */
  var sheet = d.createElement('div');
  sheet.className = 'kbd-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Keyboard shortcuts');
  var rows = [['Ctrl K', 'or /', 'Quick jump to anything'], ['J', 'K', 'Next / previous section'], ['T', '', 'Switch light and dark'], ['Home', '', 'Back to the top'], ['?', '', 'This sheet']];
  sheet.innerHTML = '<div class="kbd-box"><h2>Keyboard shortcuts</h2><ul>' + rows.map(function (r) {
    return '<li><span>' + r[2] + '</span><span class="kbd-keys"><kbd>' + r[0].replace('Ctrl K', 'Ctrl K') + '</kbd>' + (r[1] ? (r[1] === 'or /' ? ' <em>or</em> <kbd>/</kbd>' : ' <kbd>' + r[1] + '</kbd>') : '') + '</span></li>';
  }).join('') + '</ul><button type="button" class="kbd-close">Got it</button></div>';
  d.body.appendChild(sheet);
  var lastFocus = null;
  function openSheet() { lastFocus = d.activeElement; sheet.hidden = false; sheet.querySelector('.kbd-close').focus(); }
  function closeSheet() { sheet.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.classList.contains('kbd-close')) closeSheet(); });

  function typing(e) { var t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  d.addEventListener('keydown', function (e) {
    if (!sheet.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
      else if (e.key === 'Tab') { e.preventDefault(); sheet.querySelector('.kbd-close').focus(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    var qj = $('qj'); if (qj && !qj.hidden) return;
    var k = e.key;
    if (k === '?') { e.preventDefault(); openSheet(); }
    else if (k === '/') { e.preventDefault(); var b = $('qj-open'); if (b) b.click(); }
    else if (k === 't' || k === 'T') { var tb = $('theme-btn'); if (tb) tb.click(); }
    else if (k === 'j' || k === 'J') { e.preventDefault(); step(1); }
    else if (k === 'k' || k === 'K') { e.preventDefault(); step(-1); }
  });

  /* ---- quick-jump entries that run something instead of going somewhere ---- */
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#do-"]'); if (!a) return;
    e.preventDefault();
    var what = a.getAttribute('href').slice(4);
    setTimeout(function () {
      if (what === 'keys') openSheet();
      else if (what === 'theme') { var tb = $('theme-btn'); if (tb) tb.click(); }
      else if (what === 'share' && share) share.click();
      else if (what === 'train') train();
    }, 30);
  }, true);

  /* ---- the train: click the name five times ---- */
  function train() {
    if (d.querySelector('.hidden-train')) return;
    var el = d.createElement('div'); el.className = 'hidden-train'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 0 360 44" width="360" height="44"><g fill="currentColor"><rect x="2" y="6" width="112" height="28" rx="9"/><rect x="120" y="6" width="112" height="28" rx="9"/><rect x="238" y="6" width="112" height="28" rx="9"/></g><g fill="var(--bg)"><rect x="14" y="12" width="20" height="10" rx="3"/><rect x="42" y="12" width="20" height="10" rx="3"/><rect x="70" y="12" width="20" height="10" rx="3"/><rect x="132" y="12" width="20" height="10" rx="3"/><rect x="160" y="12" width="20" height="10" rx="3"/><rect x="188" y="12" width="20" height="10" rx="3"/><rect x="250" y="12" width="20" height="10" rx="3"/><rect x="278" y="12" width="20" height="10" rx="3"/><rect x="306" y="12" width="20" height="10" rx="3"/></g><rect x="0" y="38" width="360" height="3" fill="currentColor" opacity=".35"/></svg>';
    d.body.appendChild(el);
    toast('Next stop: hiring.');
    setTimeout(function () { el.remove(); }, calm ? 2500 : 6200);
  }
  var mark = d.querySelector('.top .mark'), taps = 0, tapT = 0;
  if (mark) mark.addEventListener('click', function () {
    var n = Date.now(); taps = n - tapT < 1200 ? taps + 1 : 1; tapT = n;
    if (taps >= 5) { taps = 0; train(); }
  });

  window.__delight = { step: step, sheet: openSheet, train: train };
})();
