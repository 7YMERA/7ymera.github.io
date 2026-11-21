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
    { id: 'night', t: 2, label: 'Night', sub: 'Lights on' }
  ];
  var KEY = 'tod', pickers = [], lock = null, lockTimer = 0;
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function byId(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }
  function nearest(t) { return t < 0.5 ? 'day' : t < 1.5 ? 'golden' : 'night'; }
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
      if (k === 'ArrowRight' || k === 'ArrowDown') n = (cur + 1) % 3;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') n = (cur + 2) % 3;
      else if (k === 'Home') n = 0; else if (k === 'End') n = 2;
      if (n < 0) return;
      e.preventDefault(); choose(MODES[n].id); var t = el.querySelector('[data-m="' + MODES[n].id + '"]'); if (t) t.focus();
    });
    host.appendChild(el);
    pickers.push(el);
    return el;
  }
  function show(id) {
    pickers.forEach(function (el) {
      var bs = el.querySelectorAll('.tod-b');
      for (var i = 0; i < bs.length; i++) { var on = bs[i].dataset.m === id; bs[i].setAttribute('aria-checked', on ? 'true' : 'false'); bs[i].tabIndex = on ? 0 : -1; }
    });
  }
  function choose(id) {
    var m = byId(id); if (!m) return;
    lock = id; clearTimeout(lockTimer); lockTimer = setTimeout(function () { lock = null; if (window.SceneTime) show(nearest(SceneTime.get())); }, 2000);
    show(id); put(id);
    if (window.SceneTime) SceneTime.mode(id);
  }
  document.addEventListener('scenetime', function (e) {
    var t = e.detail.t;
    if (lock) { if (Math.abs(t - byId(lock).t) < 0.03) lock = null; else return; }
    show(nearest(t));
  });

  function mountAll() {
    var sticky = document.querySelector('#enter .enter-sticky');
    if (sticky && !sticky.querySelector('.tod')) {
      var el = build(sticky, false);
      el.classList.add('tod--hud');
      if (!document.querySelector('header.top, .top')) el.classList.add('tod--nohead');
    }
    var hosts = document.querySelectorAll('[data-tod-mount]');
    for (var i = 0; i < hosts.length; i++) if (!hosts[i].querySelector('.tod')) build(hosts[i], true);
    show(window.SceneTime ? nearest(SceneTime.get()) : 'day');
  }
  function start() {
    mountAll();
    var q = /[?&]time=(day|golden|night)/.exec(location.search), want = q ? q[1] : get(), tries = 0;
    var m = want && byId(want);
    (function apply() {
      if (window.SceneTime) {
        if (m) { SceneTime.mode(m.id, 0); show(m.id); }
        else show(nearest(SceneTime.get()));
        return;
      }
      if (++tries < 60) setTimeout(apply, 100);
    })();
  }
  window.TimeOfDay = { mount: function (el, compact) { var p = build(el, !!compact); show(window.SceneTime ? nearest(SceneTime.get()) : 'day'); return p; }, choose: choose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
