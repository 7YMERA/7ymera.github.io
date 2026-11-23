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
      if (!compact) {
        var full = n >= STAMPS.length;
        html += '<div class="fl-actions">' +
          '<button type="button" class="fl-pass-btn' + (full ? ' full' : '') + '" data-fl-pass>' +
          (full ? 'Download Certified Pilot Boarding Pass (.PNG)' : 'Download Flight Log Boarding Pass (' + n + '/' + STAMPS.length + ' .PNG)') +
          '</button>' +
          (full
            ? '<a class="fl-reward" href="/#enter">Grand Fireworks unlocked in Free Fly &#8599;</a>'
            : '<span class="fl-hint">Unlock all 8 stamps for the Certified Pilot seal &amp; Grand Finale Fireworks over KL.</span>') +
          '</div>';
      }
      host.innerHTML = html;
      var btn = host.querySelector('[data-fl-pass]');
      if (btn) btn.addEventListener('click', function () { api.downloadBoardingPass(); });
    },
    downloadBoardingPass: function () {
      var o = load(), n = api.count(), full = n >= STAMPS.length;
      var W = 1200, H = 520, cv = d.createElement('canvas');
      cv.width = W; cv.height = H;
      var g = cv.getContext('2d');

      // Deep night KL sky backdrop
      var bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#040a1a'); bg.addColorStop(0.6, '#0a1c3f'); bg.addColorStop(1, '#07122b');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);

      // Subtle architectural grid
      g.strokeStyle = 'rgba(127, 211, 255, 0.06)'; g.lineWidth = 1;
      for (var x = 40; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (var y = 40; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

      // Outer border & perforated stub divider
      g.strokeStyle = full ? '#ffd27a' : '#7fd3ff'; g.lineWidth = 3;
      g.strokeRect(20, 20, W - 40, H - 40);
      var stubX = 860;
      g.save();
      g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255, 210, 122, 0.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(stubX, 20); g.lineTo(stubX, H - 20); g.stroke();
      g.restore();

      // Top header bar
      g.fillStyle = full ? '#ffd27a' : '#7fd3ff';
      g.font = '700 16px "JetBrains Mono", monospace';
      g.fillText('\\7YMERA · KUALA LUMPUR FLIGHT LOG BOARDING PASS', 54, 68);
      g.fillStyle = '#9db6dc';
      g.font = '500 14px "JetBrains Mono", monospace';
      g.fillText('3.1390° N · 101.6869° E · KLCC / MERDEKA 118 AIRSPACE', 54, 94);

      // Title & status
      g.fillStyle = '#ffffff';
      g.font = '800 42px "Bricolage Grotesque", system-ui, sans-serif';
      g.fillText(full ? 'CERTIFIED 7YMERA PILOT' : 'KL FLIGHT LOG PASS', 54, 152);
      g.fillStyle = full ? '#ffd27a' : '#7fd3ff';
      g.font = '600 17px "JetBrains Mono", monospace';
      g.fillText(full ? 'ALL 8/8 STAMPS CLEARED · GRAND FIREWORKS UNLOCKED' : 'CLEARANCE PROGRESS: ' + n + ' OF ' + STAMPS.length + ' STAMPS COLLECTED', 54, 184);

      // Stamp grid (2 columns x 4 rows)
      STAMPS.forEach(function (s, idx) {
        var col = idx % 2, row = Math.floor(idx / 2);
        var sx = 54 + col * 388, sy = 216 + row * 62, got = !!o[s.id];
        g.fillStyle = got ? 'rgba(255, 210, 122, 0.14)' : 'rgba(255, 255, 255, 0.03)';
        g.strokeStyle = got ? '#ffd27a' : 'rgba(157, 182, 220, 0.25)';
        g.lineWidth = 1.5;
        g.fillRect(sx, sy, 368, 48); g.strokeRect(sx, sy, 368, 48);
        g.fillStyle = got ? '#ffd27a' : '#5b7b8c';
        g.font = '700 16px "JetBrains Mono", monospace';
        g.fillText(got ? '[✓]' : '[ ]', sx + 14, sy + 30);
        g.fillStyle = got ? '#ffffff' : '#6a7d96';
        g.font = '600 17px "Albert Sans", system-ui, sans-serif';
        g.fillText(s.title, sx + 56, sy + 30);
      });

      // Right stub: Scores, date, skyline silhouette & faux barcode
      var playB = {}, arcB = {};
      try { playB = JSON.parse(localStorage.getItem('play-best') || '{}'); } catch (e) {}
      try { arcB = JSON.parse(localStorage.getItem('arc-best') || '{}'); } catch (e) {}
      var rx = stubX + 34;
      g.fillStyle = '#ffd27a'; g.font = '700 14px "JetBrains Mono", monospace';
      g.fillText('FLIGHT STUB', rx, 68);
      g.fillStyle = '#ffffff'; g.font = '800 54px "JetBrains Mono", monospace';
      g.fillText(n + '/' + STAMPS.length, rx, 134);
      g.fillStyle = '#9db6dc'; g.font = '600 12px "JetBrains Mono", monospace';
      g.fillText('ISSUED (MYT)', rx, 174);
      g.fillStyle = '#eaf1ff'; g.font = '600 16px "JetBrains Mono", monospace';
      var dtStr = new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: '2-digit' });
      g.fillText(dtStr.toUpperCase(), rx, 198);

      g.fillStyle = '#9db6dc'; g.font = '600 12px "JetBrains Mono", monospace';
      g.fillText('ARCADE TELEMETRY', rx, 240);
      g.fillStyle = '#eaf1ff'; g.font = '500 15px "JetBrains Mono", monospace';
      g.fillText('STACK    : ' + (+playB.stack || 0) + ' FLR', rx, 268);
      g.fillText('DISPATCH : ' + (+playB.dispatch || 0) + ' PTS', rx, 294);
      g.fillText('TRAIN    : ' + (+arcB.train || 0) + ' PTS', rx, 320);

      // Skyline mini-silhouette + boarding barcode
      g.fillStyle = 'rgba(127, 211, 255, 0.22)';
      g.fillRect(rx, 378, 272, 2);
      var bars = [18, 28, 12, 42, 42, 16, 26, 52, 22, 34, 14, 24];
      bars.forEach(function (bh, bi) { g.fillRect(rx + bi * 22, 378 - bh, 14, bh); });
      g.fillStyle = '#eaf1ff';
      for (var k = 0; k < 34; k++) {
        var bw = (k * 7 + n * 3) % 3 === 0 ? 5 : 2;
        g.fillRect(rx + k * 8, 404, bw, 56);
      }
      g.fillStyle = '#9db6dc'; g.font = '500 11px "JetBrains Mono", monospace';
      g.fillText('7YMERA.GITHUB.IO · KL FLIGHT LOG', rx, 480);

      try {
        var a = d.createElement('a');
        a.download = '7ymera-kl-boarding-pass-' + n + 'of' + STAMPS.length + '.png';
        a.href = cv.toDataURL('image/png');
        a.click();
      } catch (e) {}
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
