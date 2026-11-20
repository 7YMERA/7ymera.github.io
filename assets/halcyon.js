/* #halcyon: two pieces of Halcyon (my separate scroll-driven descent from orbit to Kuala Lumpur), ported to plain canvas 2D.
   1. Orbit        : a dotted globe from real country outlines, pulsing arcs from Kuala Lumpur, NASA satellites on their rings,
                     and an arc from wherever you are (guessed from your time zone only; nothing leaves the browser).
   2. Particle lab : one cloud of dust that morphs between a Chladni plate, a sphere, the Earth, the real KL landmark models
                     (sampled from assets/city/*.json), a knot, a helix and a wave. "Explode" pulls any form apart in slices.
   Nothing runs until the section is near the screen, and the loops stop when it is off screen, on another tab or hidden. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, box = d.getElementById('halcyon');
  if (!box) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = Math.min(innerWidth, innerHeight) < 700;
  var TAU = Math.PI * 2, rnd = Math.random;
  function $(s) { return box.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(box.querySelectorAll(s)); }
  function b64(str, Type) { var bin = atob(str), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Type(u.buffer); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var BLUE = '#6aa8ff', GOLD = '#e3b14e', INK = '#eaf1ff';

  /* ---------- tabs ---------- */
  var tabs = $$('[role=tab]'), panels = $$('[role=tabpanel]'), active = 'orbit', visible = false;
  function pick(id, focus) {
    active = id;
    tabs.forEach(function (t) { var on = t.getAttribute('data-hx') === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-hx') !== id; });
    if (id === 'lab') lab.wake(); else orbit.wake();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t.getAttribute('data-hx')); });
    t.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (n) { e.preventDefault(); pick(tabs[(i + n + tabs.length) % tabs.length].getAttribute('data-hx'), true); }
    });
  });

  /* ---------- the land: a 360 x 180 bitmap, 2 bits a cell (0 sea, 1 land, 2 Malaysia), made from Natural Earth ---------- */
  var land = null, landWait = [];
  function withLand(fn) { if (land) return fn(); landWait.push(fn); if (landWait.length > 1) return; fetch('assets/halcyon/land.json').then(function (r) { return r.json(); }).then(function (j) {
    var raw = b64(j.data, Uint8Array); land = { w: j.w, h: j.h, cell: function (lat, lon) { var x = Math.min(j.w - 1, Math.max(0, Math.floor(lon + 180))), y = Math.min(j.h - 1, Math.max(0, Math.floor(90 - lat))), i = y * j.w + x; return (raw[i >> 2] >> ((i & 3) * 2)) & 3; } };
    landWait.splice(0).forEach(function (f) { f(); }); }).catch(function () { landWait = []; }); }

  /* a shared canvas helper: size to the element, DPR capped, redraw when it changes */
  function sizer(cv, redraw) {
    var o = { w: 300, h: 300, k: 1 };
    function fit() { var r = cv.getBoundingClientRect(); var dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2); o.w = Math.max(200, r.width); o.h = Math.max(200, r.height); o.k = dpr; cv.width = Math.round(o.w * dpr); cv.height = Math.round(o.h * dpr); if (redraw) redraw(); }
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (!cv.closest('[hidden]')) fit(); }).observe(cv); else addEventListener('resize', fit);
    o.fit = fit; return o;
  }
  function drag(cv, st, onMove) {
    var down = false, lx = 0, ly = 0, moved = 0;
    cv.addEventListener('pointerdown', function (e) { down = true; lx = e.clientX; ly = e.clientY; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } });
    cv.addEventListener('pointermove', function (e) {
      if (down) { var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy); st.vy = dx * .006; st.vp = dy * .004; st.yaw += dx * .006; st.pitch = clamp(st.pitch + dy * .004, -1.2, 1.2); st.touched = performance.now(); }
      if (onMove) onMove(e, down);
    });
    function up() { down = false; }
    cv.addEventListener('pointerup', function (e) { up(); if (moved < 6 && st.onTap) st.onTap(e); });
    cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  }

  /* =====================================================================
     1. ORBIT
     ===================================================================== */
  var CITIES = [['Kuala Lumpur', 3.139, 101.687, 2.8], ['George Town', 5.416, 100.33, 1.4], ['Johor Bahru', 1.49, 103.74, 1.2], ['Ipoh', 4.597, 101.09, .8], ['Melaka', 2.19, 102.25, .7], ['Kuantan', 3.81, 103.33, .6], ['Kota Bharu', 6.13, 102.24, .6], ['Kuching', 1.553, 110.359, 1], ['Kota Kinabalu', 5.98, 116.07, 1], ['Miri', 4.4, 114, .5],
    ['Singapore', 1.352, 103.82, 2.2], ['Bangkok', 13.75, 100.5, 2.2], ['Jakarta', -6.2, 106.85, 2.4], ['Medan', 3.59, 98.67, 1], ['Manila', 14.6, 121, 2], ['Ho Chi Minh City', 10.8, 106.7, 1.8], ['Hong Kong', 22.3, 114.2, 2.2], ['Shanghai', 31.2, 121.5, 2.6], ['Beijing', 39.9, 116.4, 2.6], ['Seoul', 37.6, 127, 2.4], ['Tokyo', 35.7, 139.7, 3], ['Delhi', 28.6, 77.2, 2.6], ['Mumbai', 19.1, 72.9, 2.4], ['Dubai', 25.2, 55.3, 1.8], ['Moscow', 55.75, 37.6, 2.2], ['Istanbul', 41, 29, 2], ['Cairo', 30, 31.2, 2], ['Lagos', 6.5, 3.4, 1.8], ['Nairobi', -1.3, 36.8, 1.2], ['Johannesburg', -26.2, 28, 1.8], ['London', 51.5, -.13, 2.6], ['Paris', 48.9, 2.35, 2.2], ['New York', 40.7, -74, 3], ['Toronto', 43.7, -79.4, 1.8], ['San Francisco', 37.8, -122.4, 2.2], ['Mexico City', 19.4, -99.1, 2.2], ['Sao Paulo', -23.5, -46.6, 2.6], ['Sydney', -33.9, 151.2, 2]];
  var MYS = 10; // the first ten are Malaysian: gold
  var HUBS = [10, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 30, 32, 34, 36, 37, 11, 12]; // arcs from Kuala Lumpur
  // a guess of where the visitor is, from the time zone alone: [lat, lon, label]
  var TZ = { 'Asia/Kuala_Lumpur': [3.139, 101.687, 'Kuala Lumpur'], 'Asia/Singapore': [1.35, 103.82, 'Singapore'], 'Asia/Jakarta': [-6.2, 106.85, 'Jakarta'], 'Asia/Bangkok': [13.75, 100.5, 'Bangkok'], 'Asia/Ho_Chi_Minh': [10.8, 106.7, 'Ho Chi Minh City'], 'Asia/Manila': [14.6, 121, 'Manila'], 'Asia/Hong_Kong': [22.3, 114.2, 'Hong Kong'], 'Asia/Shanghai': [31.2, 121.5, 'Shanghai'], 'Asia/Taipei': [25, 121.5, 'Taipei'], 'Asia/Seoul': [37.6, 127, 'Seoul'], 'Asia/Tokyo': [35.7, 139.7, 'Tokyo'], 'Asia/Kolkata': [28.6, 77.2, 'India'], 'Asia/Calcutta': [28.6, 77.2, 'India'], 'Asia/Dhaka': [23.8, 90.4, 'Dhaka'], 'Asia/Karachi': [24.9, 67, 'Karachi'], 'Asia/Dubai': [25.2, 55.3, 'Dubai'], 'Asia/Riyadh': [24.7, 46.7, 'Riyadh'], 'Asia/Tehran': [35.7, 51.4, 'Tehran'], 'Europe/Istanbul': [41, 29, 'Istanbul'], 'Europe/Moscow': [55.75, 37.6, 'Moscow'], 'Europe/London': [51.5, -.13, 'London'], 'Europe/Dublin': [53.3, -6.3, 'Dublin'], 'Europe/Paris': [48.9, 2.35, 'Paris'], 'Europe/Berlin': [52.5, 13.4, 'Berlin'], 'Europe/Madrid': [40.4, -3.7, 'Madrid'], 'Europe/Rome': [41.9, 12.5, 'Rome'], 'Europe/Amsterdam': [52.4, 4.9, 'Amsterdam'], 'Europe/Stockholm': [59.3, 18.1, 'Stockholm'], 'Europe/Warsaw': [52.2, 21, 'Warsaw'], 'Africa/Cairo': [30, 31.2, 'Cairo'], 'Africa/Lagos': [6.5, 3.4, 'Lagos'], 'Africa/Nairobi': [-1.3, 36.8, 'Nairobi'], 'Africa/Johannesburg': [-26.2, 28, 'Johannesburg'], 'America/New_York': [40.7, -74, 'New York'], 'America/Toronto': [43.7, -79.4, 'Toronto'], 'America/Chicago': [41.9, -87.6, 'Chicago'], 'America/Denver': [39.7, -105, 'Denver'], 'America/Los_Angeles': [34.05, -118.2, 'Los Angeles'], 'America/Vancouver': [49.3, -123.1, 'Vancouver'], 'America/Mexico_City': [19.4, -99.1, 'Mexico City'], 'America/Sao_Paulo': [-23.5, -46.6, 'Sao Paulo'], 'America/Argentina/Buenos_Aires': [-34.6, -58.4, 'Buenos Aires'], 'America/Bogota': [4.7, -74.1, 'Bogota'], 'Australia/Sydney': [-33.9, 151.2, 'Sydney'], 'Australia/Melbourne': [-37.8, 145, 'Melbourne'], 'Australia/Perth': [-31.95, 115.9, 'Perth'], 'Pacific/Auckland': [-36.85, 174.8, 'Auckland'], 'Pacific/Honolulu': [21.3, -157.9, 'Honolulu'] };
  function whereAmI() {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* no Intl */ }
    if (TZ[tz]) return { lat: TZ[tz][0], lon: TZ[tz][1], name: TZ[tz][2], exact: false };
    var off = -new Date().getTimezoneOffset() / 60; // the longitude a time zone usually sits at
    return { lat: 25, lon: clamp(off * 15, -170, 170), name: 'about UTC' + (off >= 0 ? '+' : '') + off, exact: false, rough: true };
  }
  function xyz(lat, lon) { var la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; }
  function km(a, b) { var A = xyz(a[0], a[1]), B = xyz(b[0], b[1]); var dt = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1); return Math.acos(dt) * 6371; }

  var orbit = (function () {
    var cv = $('#hx-globe'), ctx = cv.getContext('2d'), probe = $('#hx-probe'), read = $('#hx-read');
    var S = { yaw: -101.687 * Math.PI / 180 + .1, pitch: .16, vy: 0, vp: 0, touched: 0, auto: !reduce, onTap: null };
    var sz = sizer(cv, function () { draw(performance.now()); });
    var raf = 0, dots = null, me = whereAmI(), meXYZ = xyz(me.lat, me.lon), hover = -1, goal = null;
    var arcs = [], sats = [{ n: 'AIM', i: .5, r: 1.3, s: .32, p: 0 }, { n: 'GPM', i: 1.05, r: 1.42, s: .24, p: 2.1 }, { n: 'TRMM', i: .33, r: 1.22, s: .4, p: 4.2 }];
    var proj = [], ptr = { x: -999, y: -999, in: false }, SR = 80;

    function build() {
      var n = small ? 3600 : 6500, ga = Math.PI * (3 - Math.sqrt(5)); dots = [];
      for (var i = 0; i < n; i++) {
        var y = 1 - (i + .5) / n * 2, lat = Math.asin(y) * 180 / Math.PI, lon = ((ga * i * 180 / Math.PI) % 360 + 540) % 360 - 180, c = land.cell(lat, lon);
        if (c) { var v = xyz(lat, lon); dots.push([v[0], v[1], v[2], c === 2 ? 1 : 0]); }
      }
    }
    function slerp(A, B, t) { var dt = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1), om = Math.acos(dt), s = Math.sin(om) || 1, a = Math.sin((1 - t) * om) / s, b = Math.sin(t * om) / s; return [A[0] * a + B[0] * b, A[1] * a + B[1] * b, A[2] * a + B[2] * b, om]; }
    function makeArcs() {
      var K = xyz(CITIES[0][1], CITIES[0][2]);
      arcs = HUBS.map(function (h, i) { return { a: K, b: xyz(CITIES[h][1], CITIES[h][2]), ph: i * .137, sp: .09 + (i % 5) * .02, gold: false }; });
      arcs.push({ a: meXYZ, b: K, ph: 0, sp: .12, gold: true, me: true });
    }
    function rot(p) {
      var cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
      var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
      return [x, y * cp - z * sp, y * sp + z * cp];
    }
    function status() {
      var dkm = Math.round(km([me.lat, me.lon], [CITIES[0][1], CITIES[0][2]]) / 100) * 100, off = -new Date().getTimezoneOffset() / 60, df = 8 - off;
      var rel = df === 0 ? 'the same time zone as you' : Math.abs(df) + ' h ' + (df > 0 ? 'ahead of' : 'behind') + ' you';
      var from = me.rough ? 'your time zone (' + me.name + ')' : 'you (' + me.name + ', guessed from your time zone)';
      read.textContent = 'Gold arc: ' + from + ' to Kuala Lumpur, about ' + dkm.toLocaleString('en-GB') + ' km. KL is ' + rel + '. Nothing is sent anywhere.';
    }

    function draw(time) {
      if (!dots) { ctx.setTransform(sz.k, 0, 0, sz.k, 0, 0); ctx.fillStyle = '#06132b'; ctx.fillRect(0, 0, sz.w, sz.h); return; }
      var W = sz.w, H = sz.h, R = Math.min(W, H) * .36, cx = W / 2, cy = H / 2, t = time / 1000;
      ctx.setTransform(sz.k, 0, 0, sz.k, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#06132b'; ctx.fillRect(0, 0, W, H);
      // stars (fixed, cheap)
      ctx.fillStyle = 'rgba(190,215,255,.55)';
      for (var s = 0; s < 70; s++) { ctx.fillRect((s * 131.7) % W, (s * 71.3) % H, s % 7 === 0 ? 1.6 : 1, s % 7 === 0 ? 1.6 : 1); }
      // atmosphere + ocean disc
      var g = ctx.createRadialGradient(cx, cy, R * .92, cx, cy, R * 1.28); g.addColorStop(0, 'rgba(90,150,255,.42)'); g.addColorStop(1, 'rgba(90,150,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, TAU); ctx.fill();
      var og = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); og.addColorStop(0, '#12306b'); og.addColorStop(1, '#071a3d');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,170,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      // a faint graticule: the equator and six meridians turn with the globe
      ctx.strokeStyle = 'rgba(120,170,255,.10)';
      for (var gm = 0; gm < 6; gm++) { ctx.beginPath(); var gs = false; for (var gk = 0; gk <= 48; gk++) { var ga2 = gk / 48 * TAU, gp = rot([Math.sin(ga2) * Math.cos(gm * Math.PI / 6), Math.cos(ga2), Math.sin(ga2) * Math.sin(gm * Math.PI / 6)]); if (gp[2] > 0) { var gx = cx + gp[0] * R, gy = cy - gp[1] * R; if (gs) ctx.lineTo(gx, gy); else { ctx.moveTo(gx, gy); gs = true; } } else gs = false; } ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      // satellites' rings and the ones behind the planet
      var satDraw = [];
      sats.forEach(function (st) {
        var ang = t * st.s + st.p, ci = Math.cos(st.i), si = Math.sin(st.i);
        function at(a) { var x = Math.cos(a) * st.r, z = Math.sin(a) * st.r; var p = [x, z * si, z * ci]; return p; }
        ctx.strokeStyle = 'rgba(140,190,255,.16)'; ctx.lineWidth = 1; ctx.beginPath();
        var first = true; for (var k = 0; k <= 48; k++) { var q = at(k / 48 * TAU), r2 = rotP(q); if (r2[2] < 0 && r2[0] * r2[0] + r2[1] * r2[1] < 1) { first = true; continue; } var X = cx + r2[0] * R, Y = cy - r2[1] * R; if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y); }
        ctx.stroke();
        var p = rotP(at(ang)); satDraw.push([st.n, p]);
      });
      function rotP(p) { var cp = Math.cos(S.pitch), sp = Math.sin(S.pitch); return [p[0], p[1] * cp - p[2] * sp, p[1] * sp + p[2] * cp]; } // rings keep their tilt in view space
      // land
      var n = dots.length, c0 = [BLUE, GOLD];
      for (var pass = 0; pass < 2; pass++) {
        ctx.fillStyle = c0[pass];
        for (var i = 0; i < n; i++) {
          var p = dots[i]; if ((p[3] | 0) !== pass) continue;
          var r = rot(p); if (r[2] <= 0) continue;
          var dx = cx + r[0] * R, dy = cy - r[1] * R, q = pass ? 2.6 : 1.9;
          if (ptr.in) { var ex2 = dx - ptr.x, ey2 = dy - ptr.y, e2 = ex2 * ex2 + ey2 * ey2; if (e2 < SR * SR) { var f = 1 - Math.sqrt(e2) / SR; ctx.globalAlpha = 1; ctx.fillStyle = pass ? '#ffe3a0' : '#e6f0ff'; ctx.fillRect(dx - q * (1 + f) / 2, dy - q * (1 + f) / 2, q * (1 + f), q * (1 + f)); ctx.fillStyle = c0[pass]; continue; } }
          ctx.globalAlpha = .4 + .6 * r[2]; ctx.fillRect(dx - q / 2, dy - q / 2, q, q);
        }
      }
      ctx.globalAlpha = 1;
      // arcs and the pulses on them
      proj.length = 0;
      arcs.forEach(function (a) {
        var om = slerp(a.a, a.b, 0)[3], lift = .04 + .22 * om / Math.PI, prev = null, pts = 40;
        ctx.strokeStyle = a.gold ? 'rgba(227,177,78,.8)' : 'rgba(106,168,255,.38)'; ctx.lineWidth = a.gold ? 1.8 : 1; ctx.beginPath();
        for (var k = 0; k <= pts; k++) { var f = k / pts, v = slerp(a.a, a.b, f), h = 1 + lift * Math.sin(Math.PI * f), r = rot([v[0] * h, v[1] * h, v[2] * h]); var vis = r[2] > .02; var X = cx + r[0] * R, Y = cy - r[1] * R; if (vis) { if (prev) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); prev = true; } else prev = null; }
        ctx.stroke();
        var f2 = (t * a.sp + a.ph) % 1, v2 = slerp(a.a, a.b, f2), h2 = 1 + lift * Math.sin(Math.PI * f2), r2 = rot([v2[0] * h2, v2[1] * h2, v2[2] * h2]);
        if (r2[2] > .02) { ctx.fillStyle = a.gold ? '#ffe3a0' : '#cfe3ff'; ctx.beginPath(); ctx.arc(cx + r2[0] * R, cy - r2[1] * R, a.gold ? 3.2 : 2.2, 0, TAU); ctx.fill(); }
      });
      // cities
      CITIES.forEach(function (c, i) {
        var r = rot(xyz(c[1], c[2])); var vis = r[2] > .03; var X = cx + r[0] * R, Y = cy - r[1] * R; proj[i] = vis ? [X, Y] : null; if (!vis) return;
        var gold = i < MYS, rad = (i === 0 ? 4.5 : 1.6 + c[3] * .55) * (hover === i ? 1.6 : 1);
        ctx.fillStyle = gold ? '#ffd27a' : '#dbe9ff'; ctx.beginPath(); ctx.arc(X, Y, rad, 0, TAU); ctx.fill();
        ctx.fillStyle = gold ? 'rgba(227,177,78,.22)' : 'rgba(150,190,255,.16)'; ctx.beginPath(); ctx.arc(X, Y, rad * 2.8, 0, TAU); ctx.fill();
        if (ptr.in && (X - ptr.x) * (X - ptr.x) + (Y - ptr.y) * (Y - ptr.y) < SR * SR) { ctx.font = '600 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(230,240,255,.95)'; ctx.fillText(c[0].toUpperCase(), X + 8, Y - 6); }
      });
      // the visitor
      var rm = rot(meXYZ); if (rm[2] > .03) { var mx = cx + rm[0] * R, my = cy - rm[1] * R; ctx.strokeStyle = '#ffe3a0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(mx, my, 6 + Math.sin(t * 3) * 1.2, 0, TAU); ctx.stroke(); ctx.fillStyle = '#ffe3a0'; ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left'; ctx.fillText('YOU', mx + 10, my + 4); }
      // beacon rings over Kuala Lumpur
      var K = xyz(CITIES[0][1], CITIES[0][2]);
      for (var b = 0; b < 3; b++) {
        var ph = ((t * .45) + b / 3) % 1, ang = .02 + ph * .14; ctx.strokeStyle = 'rgba(227,177,78,' + (.7 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.beginPath();
        var ux = Math.abs(K[1]) > .9 ? [1, 0, 0] : [0, 1, 0], e1 = cross(K, ux), l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1]; var e2 = cross(K, e1), started = false;
        for (var m = 0; m <= 36; m++) { var a2 = m / 36 * TAU, ca = Math.cos(ang), sa = Math.sin(ang); var pt = [K[0] * ca + (e1[0] * Math.cos(a2) + e2[0] * Math.sin(a2)) * sa, K[1] * ca + (e1[1] * Math.cos(a2) + e2[1] * Math.sin(a2)) * sa, K[2] * ca + (e1[2] * Math.cos(a2) + e2[2] * Math.sin(a2)) * sa]; var rr = rot(pt); if (rr[2] > .02) { var X = cx + rr[0] * R, Y = cy - rr[1] * R; if (started) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); started = true; } } else started = false; }
        ctx.stroke();
      }
      function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
      // satellites in front
      satDraw.forEach(function (sd) {
        var p = sd[1]; if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) return;
        var X = cx + p[0] * R, Y = cy - p[1] * R; ctx.fillStyle = '#eaf3ff'; ctx.save(); ctx.translate(X, Y); ctx.rotate(.785); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
        ctx.font = '600 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(210,228,255,.8)'; ctx.fillText(sd[0], X + 8, Y + 3);
        flare(X, Y, 16, false);
        if (sd[0] === 'AIM') plexus(X, Y, t);
      });
      var rk = rot(K); if (rk[2] > .03) flare(cx + rk[0] * R, cy - rk[1] * R, 26, true);
      // the scan lens under the pointer (the study's cursor-proximity "data scan")
      if (ptr.in) {
        ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 18; ctx.strokeStyle = 'rgba(207,227,255,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, SR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(227,177,78,.8)'; ctx.beginPath(); ctx.moveTo(ptr.x - 7, ptr.y); ctx.lineTo(ptr.x + 7, ptr.y); ctx.moveTo(ptr.x, ptr.y - 7); ctx.lineTo(ptr.x, ptr.y + 7); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      // a halo and anamorphic streak with a little chromatic spread; the ghosts slide opposite the pointer
      function flare(x, y, size, gold) {
        var sx = ptr.in ? (cx - ptr.x) * .04 : 0, sy = ptr.in ? (cy - ptr.y) * .04 : 0;
        ctx.globalCompositeOperation = 'lighter';
        var g = ctx.createRadialGradient(x, y, 0, x, y, size); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(.3, gold ? 'rgba(255,205,120,.3)' : 'rgba(140,185,255,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
        var sg = ctx.createLinearGradient(x - size * 3.2, y, x + size * 3.2, y); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, gold ? 'rgba(255,220,150,.45)' : 'rgba(190,215,255,.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(x - size * 3.2, y - .8, size * 6.4, 1.6);
        var gx = (cx - x) * .55 + sx * 4, gy = (cy - y) * .55 + sy * 4;
        [['rgba(106,168,255,.35)', -1.6, .5], ['rgba(255,255,255,.28)', 0, .5], ['rgba(227,177,78,.35)', 1.6, .5]].forEach(function (c) { ctx.strokeStyle = c[0]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + gx + c[1], y + gy, size * c[2] + 8, 0, TAU); ctx.stroke(); });
        ctx.globalCompositeOperation = 'source-over';
      }
      // a small drifting network around a satellite, dots joined when close (the study's "plexus")
      function plexus(x, y, t) {
        var pts = [], n = 16; for (var i = 0; i < n; i++) { var a = i * 2.399 + t * (.18 + (i % 4) * .05), rr = 20 + (i * 37 % 34); pts.push([x + Math.cos(a) * rr, y + Math.sin(a * 1.3) * rr * .8]); }
        ctx.strokeStyle = 'rgba(160,200,255,.32)'; ctx.lineWidth = 1; ctx.beginPath();
        for (var a2 = 0; a2 < n; a2++) for (var b2 = a2 + 1; b2 < n; b2++) { if (Math.hypot(pts[a2][0] - pts[b2][0], pts[a2][1] - pts[b2][1]) < 34) { ctx.moveTo(pts[a2][0], pts[a2][1]); ctx.lineTo(pts[b2][0], pts[b2][1]); } }
        ctx.stroke(); ctx.fillStyle = 'rgba(220,235,255,.8)'; pts.forEach(function (q) { ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2); });
      }
    }

    function loop(now) {
      raf = 0; if (!visible || active !== 'orbit' || d.hidden) return;
      var dt = Math.min(.05, (now - (loop.t || now)) / 1000); loop.t = now;
      if (goal) { S.yaw += (goal.yaw - S.yaw) * Math.min(1, dt * 4); S.pitch += (goal.pitch - S.pitch) * Math.min(1, dt * 4); if (Math.abs(goal.yaw - S.yaw) + Math.abs(goal.pitch - S.pitch) < .003) goal = null; }
      else if (now - S.touched > 1500 && S.auto) S.yaw += dt * .12;
      draw(now); raf = requestAnimationFrame(loop);
    }
    function wake() { if (visible && active === 'orbit' && !raf) { sz.fit(); loop.t = 0; raf = requestAnimationFrame(loop); } }
    function face(lat, lon) { var yaw = -lon * Math.PI / 180, cur = S.yaw, d2 = ((yaw - cur) % TAU + TAU + Math.PI) % TAU - Math.PI; goal = { yaw: cur + d2, pitch: clamp(lat * Math.PI / 180 + .25, -1, 1) }; }
    drag(cv, S, function (e, down) {
      var r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = -1, bd = 18;
      if (!down) proj.forEach(function (p, i) { if (!p) return; var dd = Math.hypot(p[0] - mx, p[1] - my); if (dd < bd) { bd = dd; best = i; } });
      ptr.x = mx; ptr.y = my; ptr.in = true;
      if (best !== hover) { hover = best; cv.style.cursor = hover > -1 ? 'pointer' : 'grab'; }
      if (hover > -1 && !down) { probe.hidden = false; probe.textContent = CITIES[hover][0]; probe.style.transform = 'translate(' + (mx + 12) + 'px,' + (my - 8) + 'px)'; } else probe.hidden = true;
    });
    cv.addEventListener('pointerleave', function () { probe.hidden = true; hover = -1; ptr.in = false; });
    S.onTap = function () { if (hover > -1) face(CITIES[hover][1], CITIES[hover][2]); };
    $('#hx-kl').addEventListener('click', function () { face(CITIES[0][1], CITIES[0][2]); S.touched = performance.now(); });
    $('#hx-me').addEventListener('click', function () { face(me.lat, me.lon); S.touched = performance.now(); });
    var spin = $('#hx-spin'); spin.setAttribute('aria-pressed', S.auto ? 'true' : 'false'); spin.querySelector('b').textContent = S.auto ? 'On' : 'Off';
    spin.addEventListener('click', function () { S.auto = !S.auto; spin.setAttribute('aria-pressed', S.auto ? 'true' : 'false'); spin.querySelector('b').textContent = S.auto ? 'On' : 'Off'; });
    cv.style.cursor = 'grab';
    var started = false;
    function init() { if (started) return; started = true; withLand(function () { build(); makeArcs(); status(); sz.fit(); wake(); }); }
    return { init: init, wake: function () { init(); wake(); }, draw: draw };
  })();

  /* =====================================================================
     2. PARTICLE LAB
     ===================================================================== */
  var lab = (function () {
    var cv = $('#hx-lab'), ctx = cv.getContext('2d'), nameEl = $('#hx-form'), chips = $('#hx-chips');
    var N = small ? 2400 : 4200, S = { yaw: .5, pitch: -.22, vy: 0, vp: 0, touched: 0 };
    var sz = sizer(cv, function () { draw(performance.now()); });
    var A = new Float32Array(N * 3), B = new Float32Array(N * 3), tA = new Float32Array(N), tB = new Float32Array(N), delay = new Float32Array(N), seed = new Float32Array(N * 3);
    var cur = 0, prog = 1, dur = reduce ? .35 : 2.4, ex = 0, exGoal = 0, auto = !reduce, autoT = 0, raf = 0, cache = {}, started = false, qx = new Float32Array(N), qy = new Float32Array(N), qs = new Float32Array(N), qg = new Uint8Array(N);
    for (var i = 0; i < N; i++) { delay[i] = rnd() * .45; seed[i * 3] = rnd() - .5; seed[i * 3 + 1] = rnd() - .5; seed[i * 3 + 2] = rnd() - .5; }

    function byHeight(pos) { var t = new Float32Array(N); for (var i = 0; i < N; i++) { var v = (pos[i * 3 + 1] + .7) / 1.6; t[i] = v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v); } return t; }
    function chladni(m, n) { var pos = new Float32Array(N * 3), i = 0; for (var g = 0; i < N && g < N * 700; g++) { var x = rnd() * 2 - 1, z = rnd() * 2 - 1; var f = Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * z) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * z); if (Math.abs(f) < .03) { pos[3 * i] = x * 1.55; pos[3 * i + 1] = (rnd() - .5) * .05; pos[3 * i + 2] = z * 1.55; i++; } } for (; i < N; i++) { pos[3 * i] = (rnd() * 2 - 1) * 1.55; pos[3 * i + 2] = (rnd() * 2 - 1) * 1.55; } return { pos: pos, tint: byHeight(pos) }; }
    function sphere() { var pos = new Float32Array(N * 3), ga = Math.PI * (3 - Math.sqrt(5)); for (var i = 0; i < N; i++) { var y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y); pos[3 * i] = Math.cos(ga * i) * r; pos[3 * i + 1] = y; pos[3 * i + 2] = Math.sin(ga * i) * r; } return { pos: pos, tint: byHeight(pos) }; }
    function earth() { var pos = new Float32Array(N * 3), tint = new Float32Array(N), i = 0; for (var g = 0; i < N && g < N * 40; g++) { var v = rnd() * 2 - 1, lon = rnd() * TAU - Math.PI, lat = Math.asin(v); var c = land.cell(lat * 180 / Math.PI, lon * 180 / Math.PI); if (!c) continue; var cl = Math.cos(lat); pos[3 * i] = cl * Math.sin(lon) * 1.02; pos[3 * i + 1] = Math.sin(lat) * 1.02; pos[3 * i + 2] = cl * Math.cos(lon) * 1.02; tint[i++] = c === 2 ? 1 : 0; } return { pos: pos, tint: tint }; }
    function knot() { var pos = new Float32Array(N * 3); for (var i = 0; i < N; i++) { var t = rnd() * TAU, r = .55 + .22 * Math.cos(3 * t), a = rnd() * TAU, rr = .07 * Math.sqrt(rnd()); pos[3 * i] = r * Math.cos(2 * t) * 1.5 + rr * Math.cos(a); pos[3 * i + 1] = .45 * Math.sin(3 * t) * 1.4 + rr * Math.sin(a); pos[3 * i + 2] = r * Math.sin(2 * t) * 1.5 + rr * Math.cos(a + 1); } return { pos: pos, tint: byHeight(pos) }; }
    function helix() { var pos = new Float32Array(N * 3); for (var i = 0; i < N; i++) { var t = (rnd() * 2 - 1) * Math.PI * 3, strand = rnd() < .72, ph = rnd() < .5 ? 0 : Math.PI, nz = function () { return (rnd() - .5) * .06; }; if (strand) { pos[3 * i] = Math.cos(t + ph) * .62 + nz(); pos[3 * i + 1] = t * .2 + nz(); pos[3 * i + 2] = Math.sin(t + ph) * .62 + nz(); } else { var k = rnd() * 2 - 1; pos[3 * i] = Math.cos(t) * .62 * k + nz(); pos[3 * i + 1] = t * .2 + nz(); pos[3 * i + 2] = Math.sin(t) * .62 * k + nz(); } } return { pos: pos, tint: byHeight(pos) }; }
    function plexusForm() {
      var M = 84, pos = new Float32Array(N * 3), tint = new Float32Array(N), no = new Uint16Array(N), c = new Float32Array(M * 3);
      for (var m = 0; m < M; m++) { var x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1); c[m * 3] = x * 1.25; c[m * 3 + 1] = y * 1.05; c[m * 3 + 2] = z * 1.25; }
      for (var i = 0; i < N; i++) { var q = i % M, g = function () { return (rnd() + rnd() + rnd() - 1.5) * .09; }; pos[3 * i] = c[q * 3] + g(); pos[3 * i + 1] = c[q * 3 + 1] + g(); pos[3 * i + 2] = c[q * 3 + 2] + g(); no[i] = q; tint[i] = q % 9 === 0 ? 1 : 0; }
      return { pos: pos, tint: tint, nodes: c, nodeOf: no };
    }
    function wave() { var pos = new Float32Array(N * 3), i = 0; for (var g = 0; i < N && g < N * 200; g++) { var r = Math.sqrt(rnd()) * 1.6, a = rnd() * TAU; if (Math.cos(r * 15) < .82) continue; pos[3 * i] = Math.cos(a) * r; pos[3 * i + 1] = .28 * Math.cos(r * 6.5) + (rnd() - .5) * .03; pos[3 * i + 2] = Math.sin(a) * r; i++; } return { pos: pos, tint: byHeight(pos) }; }
    // a landmark: area-weighted random points on the real model's triangles, all at one scale so the heights stay honest
    function landmark(json) {
      var P = b64(json.positions, Float32Array), tris = Array.prototype.slice.call(b64(json.body, Uint16Array)).concat(Array.prototype.slice.call(b64(json.glass, Uint16Array))), nT = tris.length / 3, cum = new Float32Array(nT), total = 0, t;
      var minY = 1e9, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (var v = 0; v < P.length; v += 3) { if (P[v + 1] < minY) minY = P[v + 1]; if (P[v] < minX) minX = P[v]; if (P[v] > maxX) maxX = P[v]; if (P[v + 2] < minZ) minZ = P[v + 2]; if (P[v + 2] > maxZ) maxZ = P[v + 2]; }
      for (t = 0; t < nT; t++) { var a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3; var ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]; total += .5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); cum[t] = total; }
      var s = 2 / 644.04, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, pos = new Float32Array(N * 3), tint = new Float32Array(N);
      for (var i = 0; i < N; i++) {
        var r = rnd() * total, lo = 0, hi = nT - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        var ia = tris[lo * 3] * 3, ib = tris[lo * 3 + 1] * 3, ic = tris[lo * 3 + 2] * 3, uu = rnd(), vv = rnd(); if (uu + vv > 1) { uu = 1 - uu; vv = 1 - vv; } var w = 1 - uu - vv;
        pos[3 * i] = (P[ia] * w + P[ib] * uu + P[ic] * vv - cx) * s; var y = (P[ia + 1] * w + P[ib + 1] * uu + P[ic + 1] * vv - minY) * s - 1; pos[3 * i + 1] = y; pos[3 * i + 2] = (P[ia + 2] * w + P[ib + 2] * uu + P[ic + 2] * vv - cz) * s; tint[i] = y > .2 ? 1 : 0;
      }
      return { pos: pos, tint: tint };
    }
    var FORMS = [
      { k: 'chladni', n: 'Chladni plate', make: function () { return chladni(3, 5); } },
      { k: 'sphere', n: 'Sphere', make: sphere },
      { k: 'earth', n: 'Earth', need: 'land', make: earth },
      { k: 'klcc', n: 'Petronas Towers', file: 'klcc.json' },
      { k: 'menara', n: 'KL Tower', file: 'menara_kl.json' },
      { k: 'merdeka', n: 'Merdeka 118', file: 'merdeka118.json' },
      { k: 'exchange', n: 'The Exchange 106', file: 'exchange106.json' },
      { k: 'knot', n: 'Torus knot', make: knot },
      { k: 'helix', n: 'Double helix', make: helix },
      { k: 'wave', n: 'Standing wave', make: wave },
      { k: 'plexus', n: 'Plexus network', make: plexusForm }
    ];
    function get(f, cb) {
      if (cache[f.k]) return cb(cache[f.k]);
      function done(form) { cache[f.k] = form; cb(form); }
      if (f.file) { fetch('assets/city/' + f.file).then(function (r) { return r.json(); }).then(function (j) { done(landmark(j)); }).catch(function (e) { console.error(e); nameEl.textContent = 'Could not load ' + f.n; }); }
      else if (f.need === 'land') withLand(function () { done(f.make()); });
      else done(f.make());
    }
    function setTo(k, instant) {
      var f = FORMS[k]; nameEl.textContent = 'Gathering ' + f.n + '...';
      get(f, function (form) {
        // freeze where every particle is now, then slide each to its place in the next form
        for (var i = 0; i < N; i++) { var e = ease(prog, delay[i]); for (var c = 0; c < 3; c++) A[i * 3 + c] = A[i * 3 + c] + (B[i * 3 + c] - A[i * 3 + c]) * e; tA[i] = tA[i] + (tB[i] - tA[i]) * e; }
        B.set(form.pos); tB.set(form.tint); prog = instant ? 1 : 0; cur = k; nodesNow = form.nodes || null; nodeOf = form.nodeOf || null; if (nodesNow) { var MM = nodesNow.length / 3; ndx = new Float32Array(MM); ndy = new Float32Array(MM); ndz = new Float32Array(MM); } nameEl.textContent = f.n;
        $$('.hx-chip').forEach(function (b, n) { b.setAttribute('aria-pressed', n === k ? 'true' : 'false'); });
        if (instant) { A.set(B); tA.set(tB); }
        wake();
      });
    }
    function ease(p, dl) { var u = clamp((p - dl) / (1 - .45), 0, 1); return u * u * (3 - 2 * u); }

    var LP = { x: -999, y: -999, in: false }, LR = 90, nodesNow = null, nodeOf = null, ndx = null, ndy = null, ndz = null;
    function drift(time) { var M = nodesNow.length / 3; for (var m = 0; m < M; m++) { ndx[m] = Math.sin(time * .0006 + m * 1.7) * .09; ndy[m] = Math.cos(time * .0005 + m * 2.3) * .09; ndz[m] = Math.sin(time * .0007 - m * 1.1) * .09; } }
    function draw(time) {
      var W = sz.w, H = sz.h; ctx.setTransform(sz.k, 0, 0, sz.k, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#06132b'; ctx.fillRect(0, 0, W, H);
      // a soft, drifting haze behind the dust (the study's "space cloud"), two big gradients that wander slowly
      var t = time / 1000; ctx.globalCompositeOperation = 'lighter';
      [[.3 + Math.sin(t * .11) * .12, .4, 'rgba(60,110,230,.16)', .55], [.72 + Math.cos(t * .09) * .1, .62, 'rgba(227,177,78,.07)', .5]].forEach(function (c) { var hx = c[0] * W, hy = c[1] * H + Math.sin(t * .13 + c[0] * 9) * 20, r = Math.max(W, H) * c[3], g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r); g.addColorStop(0, c[2]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      var cyw = Math.cos(S.yaw), syw = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch), F = 3.4, sc = Math.min(W, H) * (W / H > 1.3 ? .34 : .3), cx = W / 2, cyy = H * .52;
      var u = ex, pl = !!nodesNow && prog >= 1;
      if (pl) drift(time);
      function proj(x, y, z, o) { // explode, turn, project: o = [x, y, size]
        if (u > .001) { var band = Math.floor(clamp((y + 1) / 2, 0, .999) * 8); y += (band - 3.5) * .17 * u; var rr = 1 + .12 * u * (band % 2 ? 1 : -.4); x *= rr; z *= rr; }
        var x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, k = F / (F + z2);
        o[0] = cx + x1 * k * sc; o[1] = cyy - y1 * k * sc; o[2] = k;
      }
      var o3 = [0, 0, 0], inLens = 0, R2 = LR * LR;
      for (var i = 0; i < N; i++) {
        var e = ease(prog, delay[i]), x = A[i * 3] + (B[i * 3] - A[i * 3]) * e, y = A[i * 3 + 1] + (B[i * 3 + 1] - A[i * 3 + 1]) * e, z = A[i * 3 + 2] + (B[i * 3 + 2] - A[i * 3 + 2]) * e;
        if (prog < 1) { var sw = Math.sin(e * Math.PI) * .35; x += seed[i * 3] * sw * 2; y += seed[i * 3 + 1] * sw * 2; z += seed[i * 3 + 2] * sw * 2; }
        else if (pl) { var m = nodeOf[i]; x += ndx[m]; y += ndy[m]; z += ndz[m]; }
        proj(x, y, z, o3);
        var px = o3[0], py = o3[1], k = o3[2], size = clamp(.7 + 1.5 * k * k, .8, 3), g = (tA[i] + (tB[i] - tA[i]) * e) > .5 ? 1 : 0;
        if (LP.in) { var ddx = px - LP.x, ddy = py - LP.y, d2 = ddx * ddx + ddy * ddy; if (d2 < R2) { var dd = Math.sqrt(d2) || 1, f = 1 - dd / LR; px += ddx / dd * f * f * 26; py += ddy / dd * f * f * 26; size += f * 1.8; g = 2; inLens++; } }
        qx[i] = px; qy[i] = py; qs[i] = size; qg[i] = g;
      }
      // plexus: join the nodes that drift close, three links at most each
      if (pl) {
        var M = nodesNow.length / 3, np = [], links = new Uint8Array(M), pt = [0, 0, 0];
        for (var m2 = 0; m2 < M; m2++) { proj(nodesNow[m2 * 3] + ndx[m2], nodesNow[m2 * 3 + 1] + ndy[m2], nodesNow[m2 * 3 + 2] + ndz[m2], pt); np.push([pt[0], pt[1]]); }
        ctx.strokeStyle = 'rgba(120,170,255,.34)'; ctx.lineWidth = 1; ctx.beginPath();
        for (var a2 = 0; a2 < M; a2++) for (var b2 = a2 + 1; b2 < M && links[a2] < 3; b2++) {
          var qx2 = nodesNow[a2 * 3] + ndx[a2] - nodesNow[b2 * 3] - ndx[b2], qy2 = nodesNow[a2 * 3 + 1] + ndy[a2] - nodesNow[b2 * 3 + 1] - ndy[b2], qz2 = nodesNow[a2 * 3 + 2] + ndz[a2] - nodesNow[b2 * 3 + 2] - ndz[b2];
          if (qx2 * qx2 + qy2 * qy2 + qz2 * qz2 < .42 && links[b2] < 3) { links[a2]++; links[b2]++; ctx.moveTo(np[a2][0], np[a2][1]); ctx.lineTo(np[b2][0], np[b2][1]); }
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      var cols = ['rgba(106,168,255,.8)', 'rgba(227,177,78,.85)', 'rgba(240,247,255,.95)'];
      for (var pass = 0; pass < 3; pass++) { ctx.fillStyle = cols[pass]; for (var j = 0; j < N; j++) { if (qg[j] !== pass) continue; ctx.fillRect(qx[j], qy[j], qs[j], qs[j]); } }
      // the scan lens (the study's cursor-proximity "data scan"): a dashed ring, a cross and a live count
      if (LP.in) {
        ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 18; ctx.strokeStyle = 'rgba(207,227,255,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(LP.x, LP.y, LR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(227,177,78,.85)'; ctx.beginPath(); ctx.moveTo(LP.x - 7, LP.y); ctx.lineTo(LP.x + 7, LP.y); ctx.moveTo(LP.x, LP.y - 7); ctx.lineTo(LP.x, LP.y + 7); ctx.stroke();
        ctx.fillStyle = 'rgba(230,240,255,.9)'; ctx.font = '600 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left'; ctx.fillText('SCAN ' + inLens, LP.x + LR * .72, LP.y - LR * .72);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function loop(now) {
      raf = 0; if (!visible || active !== 'lab' || d.hidden) return;
      var dt = Math.min(.05, (now - (loop.t || now)) / 1000); loop.t = now;
      if (prog < 1) prog = Math.min(1, prog + dt / dur);
      ex += (exGoal - ex) * Math.min(1, dt * 5);
      if (!reduce && now - S.touched > 1200) S.yaw += dt * .22;
      if (auto && prog >= 1) { autoT += dt; if (autoT > 5.5) { autoT = 0; setTo((cur + 1) % FORMS.length); } }
      draw(now); raf = requestAnimationFrame(loop);
    }
    function wake() { if (visible && active === 'lab' && !raf) { sz.fit(); loop.t = 0; raf = requestAnimationFrame(loop); } }
    // chips
    FORMS.forEach(function (f, n) {
      var b = d.createElement('button'); b.type = 'button'; b.className = 'hx-chip'; b.textContent = f.n; b.setAttribute('aria-pressed', n === 0 ? 'true' : 'false');
      b.addEventListener('click', function () { auto = false; syncAuto(); setTo(n); }); chips.appendChild(b);
    });
    var exBtn = $('#hx-explode'), autoBtn = $('#hx-auto');
    exBtn.addEventListener('click', function () { exGoal = exGoal ? 0 : 1; exBtn.setAttribute('aria-pressed', exGoal ? 'true' : 'false'); exBtn.querySelector('b').textContent = exGoal ? 'On' : 'Off'; wake(); });
    function syncAuto() { autoBtn.setAttribute('aria-pressed', auto ? 'true' : 'false'); autoBtn.querySelector('b').textContent = auto ? 'On' : 'Off'; }
    autoBtn.addEventListener('click', function () { auto = !auto; autoT = 0; syncAuto(); });
    syncAuto();
    drag(cv, S, function (e) { var r = cv.getBoundingClientRect(); LP.x = e.clientX - r.left; LP.y = e.clientY - r.top; LP.in = true; });
    cv.addEventListener('pointerleave', function () { LP.in = false; });
    cv.style.cursor = 'grab';
    function init() { if (started) return; started = true; var f = FORMS[0]; get(f, function (form) { A.set(form.pos); B.set(form.pos); tA.set(form.tint); tB.set(form.tint); prog = 1; sz.fit(); nameEl.textContent = f.n; wake(); }); }
    return { wake: function () { init(); wake(); } };
  })();

  /* ---------- lazy start, and a visibility switch for both loops ---------- */
  new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { if (active === 'lab') lab.wake(); else orbit.wake(); } }, { rootMargin: '200px', threshold: 0 }).observe(box);
  d.addEventListener('visibilitychange', function () { if (!d.hidden && visible) { if (active === 'lab') lab.wake(); else orbit.wake(); } });
  new IntersectionObserver(function (en) { root.classList.toggle('hx-view', en[0].isIntersecting); }).observe(box); // Back to top steps aside
  window.__halcyon = { pick: pick };
})();
