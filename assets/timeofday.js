/* The view picker for the 3D city: Plain · Golden hour · Night. Three big buttons with a small animated sky on each.
   Self-mounting: it goes into `#enter .enter-sticky` (the drone-flight HUD) on any page that has one, and into any element marked `data-tod-mount` (the /flight/ panel).
   It drives window.SceneTime (assets/scene.js): SceneTime.mode('day'|'golden'|'night'). The choice is remembered in localStorage; `?time=golden` in the address overrides it.
   Keyboard: a radio group (arrow keys move and choose, Home and End jump). Pages with <html data-daycycle> do not get it, the scroll is their time of day. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (root.hasAttribute('data-daycycle')) return;
  var MODES = [
    { id: 'day', t: 0, label: 'Plain', sub: 'Daylight' },
    { id: 'golden', t: 1, label: 'Golden hour', sub: 'Low sun' },
    { id: 'night', t: 2, label: 'Night', sub: 'Lights on' },
    { id: 'live', t: -1, label: 'Live KL', sub: 'MYT now' }
  ];
  var KEY = 'tod', pickers = [], lock = null, lockTimer = 0, liveTimer = 0, liveOn = false;
  function klNow() {
    var d = new Date(Date.now() + 8 * 3600000);
    var h = d.getUTCHours(), m = d.getUTCMinutes(), hm = h + m / 60;
    var hh = (h < 10 ? '0' : '') + h, mm = (m < 10 ? '0' : '') + m;
    // Map KL solar hour (UTC+8) to SceneTime t: 0 day, 1 golden (dawn ~06:45-08:00, dusk ~18:00-19:30), 2 night
    var t;
    if (hm >= 8.2 && hm <= 17.5) t = 0;
    else if (hm > 17.5 && hm <= 19.0) t = (hm - 17.5) / 1.5;
    else if (hm > 19.0 && hm <= 20.2) t = 1 + (hm - 19.0) / 1.2;
    else if (hm >= 6.0 && hm < 7.2) t = 2 - (hm - 6.0) / 1.2;
    else if (hm >= 7.2 && hm < 8.2) t = 1 - (hm - 7.2) / 1.0;
    else t = 2;
    return { t: Math.max(0, Math.min(2, t)), clock: hh + ':' + mm + ' MYT' };
  }
  function updateLiveLabels() {
    var k = klNow();
    pickers.forEach(function (el) {
      var sm = el.querySelector('[data-m="live"] .tod-t small');
      if (sm) sm.textContent = k.clock;
    });
    return k;
  }
  function stopLive() { liveOn = false; if (liveTimer) { clearInterval(liveTimer); liveTimer = 0; } }
  function startLive(instant) {
    liveOn = true;
    var k = updateLiveLabels();
    if (window.SceneTime) SceneTime.mode(k.t, instant ? 0 : 1200);
    if (!liveTimer) liveTimer = setInterval(function () {
      if (!liveOn) return;
      var n = updateLiveLabels();
      if (window.SceneTime) SceneTime.mode(n.t, 1200);
    }, 30000);
  }
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function byId(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }
  function nearest(t) { return liveOn ? 'live' : (t < 0.5 ? 'day' : t < 1.5 ? 'golden' : 'night'); }
  var SKY = '<svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 40V30h9v-6h7v6h6V20h5v10h8V27h6v13h4V12l2-8 2 8v28h5V12l2-8 2 8v28h4V25h7v-9h6v9h5v15z"/></svg>';

  function build(host, compact) {
    var el = document.createElement('div');
    el.className = 'tod' + (compact ? ' tod--compact' : '');
    el.setAttribute('role', 'radiogroup');
    el.setAttribute('aria-label', 'Time of day over the city');
    MODES.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tod-b'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1; b.dataset.m = m.id;
      b.innerHTML = '<span class="tod-sw tod-sw--' + m.id + '" aria-hidden="true"><i class="tod-glow"></i><i class="tod-orb"></i><i class="tod-st a"></i><i class="tod-st b"></i><i class="tod-st c"></i>' + SKY + '</span>' +
        '<span class="tod-t"><b>' + m.label + '</b><small>' + m.sub + '</small></span>';
      b.addEventListener('click', function () { choose(m.id); });
      el.appendChild(b);
    });
    el.addEventListener('keydown', function (e) {
      var k = e.key, cur = MODES.map(function (m) { return m.id; }).indexOf(el.querySelector('[aria-checked="true"]') ? el.querySelector('[aria-checked="true"]').dataset.m : 'day'), n = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') n = (cur + 1) % MODES.length;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') n = (cur + MODES.length - 1) % MODES.length;
      else if (k === 'Home') n = 0; else if (k === 'End') n = MODES.length - 1;
      if (n < 0) return;
      e.preventDefault(); choose(MODES[n].id); var t = el.querySelector('[data-m="' + MODES[n].id + '"]'); if (t) t.focus();
    });
    host.appendChild(el);
    pickers.push(el);
    updateLiveLabels();
    return el;
  }
  function show(id) {
    pickers.forEach(function (el) {
      var bs = el.querySelectorAll('.tod-b');
      for (var i = 0; i < bs.length; i++) { var on = bs[i].dataset.m === id; bs[i].setAttribute('aria-checked', on ? 'true' : 'false'); bs[i].tabIndex = on ? 0 : -1; }
    });
  }
  function choose(id, instant) {
    var m = byId(id); if (!m) return;
    if (id === 'live') {
      lock = 'live'; clearTimeout(lockTimer); lockTimer = setTimeout(function () { lock = null; }, 2000);
      show('live'); put('live'); startLive(instant);
      return;
    }
    stopLive();
    lock = id; clearTimeout(lockTimer); lockTimer = setTimeout(function () { lock = null; if (window.SceneTime) show(nearest(SceneTime.get())); }, 2000);
    show(id); put(id);
    if (window.SceneTime) SceneTime.mode(id, instant ? 0 : undefined);
  }
  document.addEventListener('scenetime', function (e) {
    var t = e.detail.t;
    if (liveOn) { show('live'); return; }
    if (lock) { var bm = byId(lock); if (bm && bm.t >= 0 && Math.abs(t - bm.t) < 0.03) lock = null; else return; }
    show(nearest(t));
  });

  function mountAll() {
    var sticky = document.querySelector('#enter .enter-sticky');
    if (sticky && !sticky.querySelector('.tod')) {
      var el = build(sticky, false);
      el.classList.add('tod--hud');
      if (!document.querySelector('header.top, .top')) el.classList.add('tod--nohead');
      // collapsible: a big "View" tab folds the picker down to the choice in use and opens it again; mid-flight it folds itself (scene.js sets html.ride-mid) so the landmark labels show, and stays as you leave it after that
      var tog = document.createElement('button'); tog.type = 'button'; tog.className = 'tod-tog'; tog.setAttribute('aria-expanded', 'true');
      tog.innerHTML = '<span>View</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
      el.insertBefore(tog, el.firstChild);
      var setMin = function (v) { el.classList.toggle('tod--min', v); tog.setAttribute('aria-expanded', v ? 'false' : 'true'); tog.setAttribute('aria-label', v ? 'Show all views' : 'Fold the view picker'); };
      tog.addEventListener('click', function () { setMin(!el.classList.contains('tod--min')); });
      el.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.tod-b'); if (b && el.classList.contains('tod--min')) { e.stopPropagation(); setMin(false); } }, true);
      var wasMid = false;
      new MutationObserver(function () { var mid = document.documentElement.classList.contains('ride-mid') || document.documentElement.classList.contains('free-fly'); if (mid && !wasMid) setMin(true); if (!mid && wasMid) setMin(false); wasMid = mid; }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    var hosts = document.querySelectorAll('[data-tod-mount]');
    for (var i = 0; i < hosts.length; i++) if (!hosts[i].querySelector('.tod')) build(hosts[i], true);
    show(window.SceneTime ? nearest(SceneTime.get()) : 'day');
  }
  function start() {
    mountAll();
    var q = /[?&]time=(day|golden|night|live)/.exec(location.search), want = q ? q[1] : get(), tries = 0;
    var m = want && byId(want);
    (function apply() {
      if (window.SceneTime) {
        if (m) { choose(m.id, true); }
        else show(nearest(SceneTime.get()));
        return;
      }
      if (++tries < 60) setTimeout(apply, 100);
    })();
  }
  window.TimeOfDay = { mount: function (el, compact) { var p = build(el, !!compact); show(window.SceneTime ? nearest(SceneTime.get()) : 'day'); return p; }, choose: choose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
