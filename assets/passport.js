/* passport.js: Cross-site "Flight Log" Passport tracking visitor discoveries in localStorage.
 * Plain JS, zero dependencies. API: window.FlightLog = { STAMPS, has, count, unlock, render }. */
(function () {
  'use strict';
  var d = document, KEY = 'fl-stamps';
  var STAMPS = [
    { id: 'flight', title: 'KL Skyline Flight', desc: 'Completed the drone flight over Kuala Lumpur', href: '/#enter' },
    { id: 'freefly', title: 'Free-Fly Pilot', desc: 'Took manual control of the KL drone', href: '/#enter' },
    { id: 'traincam', title: 'Sky-Rail Rider', desc: 'Rode a live train on the KL viaduct', href: '/#enter' },
    { id: 'postcard', title: 'Skyline Postcard', desc: 'Captured a Kuala Lumpur skyline postcard', href: '/#enter' },
    { id: 'scorelab', title: 'Sound Designer', desc: 'Mixed stems in the Web Audio Score Lab', href: '/lab/#scorelab' },
    { id: 'satellite', title: 'Orbital Scanner', desc: 'Scanned a NASA satellite in the Lab', href: '/lab/#satellite' },
    { id: 'sql', title: 'Data Explorer', desc: 'Explored a live SQLite database in-browser', href: '/lab/#sql-company' },
    { id: 'egg', title: 'Back Room', desc: 'Rang the bell in the hidden back room', href: '/play/#egg' }
  ];

  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  var toastEl = null, toastT = 0;
  function showToast(st, n) {
    if (!d.body) return;
    if (!toastEl) {
      toastEl = d.createElement('div');
      toastEl.className = 'fl-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      toastEl.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:1100;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;background:rgba(6,13,30,.94);color:#eef5ff;border:1.5px solid rgba(255,210,122,.7);box-shadow:0 16px 40px -12px rgba(0,0,0,.55);font:500 13px/1.35 var(--f-body,system-ui);max-width:min(340px,calc(100vw - 36px));opacity:0;transform:translate3d(0,14px,0);pointer-events:none;transition:opacity .28s ease,transform .28s ease;';
      d.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<span style="display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:rgba(255,210,122,.16);border:1px solid #ffd27a;color:#ffd27a;font:700 11px var(--f-mono,monospace);flex:none">' + n + '/' + STAMPS.length + '</span><div><b style="display:block;font:600 10px/1 var(--f-mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:#ffd27a;margin-bottom:3px">Flight Log Stamp</b><span style="display:block;font-weight:600;color:#fff">' + st.title + '</span></div>';
    void toastEl.offsetWidth;
    toastEl.style.opacity = '1'; toastEl.style.transform = 'none';
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      if (toastEl) { toastEl.style.opacity = '0'; toastEl.style.transform = 'translate3d(0,14px,0)'; }
    }, 3600);
  }

  var api = {
    STAMPS: STAMPS,
    has: function (id) { return !!load()[id]; },
    count: function () { var o = load(), c = 0; STAMPS.forEach(function (s) { if (o[s.id]) c++; }); return c; },
    unlock: function (id) {
      var st = null;
      for (var i = 0; i < STAMPS.length; i++) if (STAMPS[i].id === id) { st = STAMPS[i]; break; }
      if (!st) return false;
      var o = load();
      if (o[id]) return false;
      o[id] = Date.now();
      save(o);
      var n = api.count();
      showToast(st, n);
      if (window.SFX && window.SFX.chime) { try { window.SFX.chime(4); } catch (e) {} }
      try { d.dispatchEvent(new CustomEvent('flightlog-change', { detail: { id: id, count: n, total: STAMPS.length } })); } catch (e) {}
      renderAll();
      return true;
    },
    render: function (host) {
      if (!host) return;
      var o = load(), n = api.count(), compact = host.hasAttribute('data-fl-compact');
      var html = '<div class="fl-head"><div><span class="fl-eye">Flight Log Passport</span>' +
        (compact ? '' : '<h3>Your discoveries across 7YMERA</h3>') +
        '</div><span class="fl-badge"><b>' + n + '</b> / ' + STAMPS.length + '</span></div>' +
        '<div class="fl-grid">';
      STAMPS.forEach(function (s) {
        var got = !!o[s.id];
        html += '<a class="fl-stamp' + (got ? ' got' : '') + '" href="' + s.href + '">' +
          '<span class="fl-dot" aria-hidden="true">' + (got ? '&#10003;' : '&bull;') + '</span>' +
          '<span><b>' + s.title + '</b>' + (compact ? '' : '<small>' + s.desc + '</small>') + '</span></a>';
      });
      html += '</div>';
      host.innerHTML = html;
    }
  };

  function renderAll() {
    var nodes = d.querySelectorAll('[data-flightlog]');
    for (var i = 0; i < nodes.length; i++) api.render(nodes[i]);
  }
  window.FlightLog = api;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', renderAll);
  else renderAll();
  window.addEventListener('storage', function (e) { if (e.key === KEY) renderAll(); });
})();
