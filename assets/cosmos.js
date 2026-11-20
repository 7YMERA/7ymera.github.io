/* cosmos.js: space as the page's second backdrop. Halcyon's idea is a descent from orbit to Kuala Lumpur, so the whole site gets that frame:
   1. A sky layer over the top of the 3D city: depth-parallax stars, a slow nebula haze and the odd comet at night, and in both themes an orbit
      arc with two satellites gliding along it. It fades out lower down the screen so it never sits in front of the buildings.
   2. Telemetry: a vertical readout on the left (altitude falling from 408 km as you scroll, the phase, KL's coordinates and clock) and a
      descent rail on the right whose ticks are the sections (they are links) with a dot for where you are.
   3. Four faint corner brackets, like a viewfinder.
   Canvas 2D, about 30 fps, paused in a hidden tab and during the arcade games, static with prefers-reduced-motion. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = d.getElementById('gl'), body = d.body, TAU = Math.PI * 2, rnd = Math.random;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 1. the sky ---------- */
  var cv = d.createElement('canvas'); cv.id = 'cosmos'; cv.setAttribute('aria-hidden', 'true');
  if (gl && gl.parentNode) gl.parentNode.insertBefore(cv, gl.nextSibling); else body.insertBefore(cv, body.firstChild);
  var ctx = cv.getContext('2d'), W = 0, H = 0, K = 1, dark = true, stars = [], comet = null, nextComet = 0, mx = 0, my = 0, tmx = 0, tmy = 0, last = 0, raf = 0, hid = false;
  var sats = [{ n: 'AIM', p: 74, o: .1 }, { n: 'GPM', p: 101, o: .62 }];
  function make() {
    var n = Math.round(Math.min(170, W * H / 7500)); stars = [];
    for (var i = 0; i < n; i++) stars.push({ x: rnd(), y: rnd(), z: .2 + rnd() * .8, r: rnd() < .06 ? 1.6 : .6 + rnd() * .8, ph: rnd() * TAU, w: .6 + rnd() * 1.8, c: rnd() < .15 ? 1 : rnd() < .2 ? 2 : 0 });
  }
  function fit() { K = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = Math.round(W * K); cv.height = Math.round(H * K); make(); frame(performance.now(), true); }
  function fade(y) { var f = 1 - y / (H * .66); return f <= 0 ? 0 : Math.pow(f, 1.3); }
  var STC = ['255,255,255', '175,205,255', '255,225,170'];
  function frame(now, once) {
    raf = 0; if (!once && (hid || d.hidden)) return;
    var dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    dark = root.getAttribute('data-theme') === 'dark';
    mx += (tmx - mx) * .06; my += (tmy - my) * .06;
    var t = now / 1000, sy = scrollY;
    ctx.setTransform(K, 0, 0, K, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    if (dark) {
      // nebula haze: blue and a trace of gold, drifting, strongest at the very top
      var hz = [[.22 + Math.sin(t * .05) * .06, -.05, 'rgba(50,95,220,.13)', .62], [.78 + Math.cos(t * .04) * .05, .02, 'rgba(40,130,200,.09)', .55], [.5, -.12, 'rgba(227,177,78,.045)', .5]];
      hz.forEach(function (c) { var x = c[0] * W - mx * 18, y = c[1] * H - sy * .02, r = Math.max(W, H) * c[3], g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c[2]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .8); });
      // stars with depth: nearer ones slide more with the pointer and with the scroll
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], x = ((s.x * W - mx * 26 * s.z) % W + W) % W, y = (((s.y * H * 1.1) - sy * .06 * s.z - my * 14 * s.z) % (H * 1.1) + H * 1.1) % (H * 1.1), a = fade(y); if (a <= .01) continue;
        var tw = reduce ? 1 : .65 + .35 * Math.sin(t * s.w + s.ph); ctx.fillStyle = 'rgba(' + STC[s.c] + ',' + (a * tw * (.35 + .65 * s.z)).toFixed(3) + ')';
        var r = s.r * (.7 + .5 * s.z); ctx.fillRect(x - r / 2, y - r / 2, r, r);
        if (s.r > 1.5) { ctx.fillRect(x - r * 3, y - .4, r * 6, .8); ctx.fillRect(x - .4, y - r * 3, .8, r * 6); }
      }
      // a comet every so often
      if (!reduce) {
        if (!comet && t > nextComet) { comet = { x: W * (.45 + rnd() * .5), y: rnd() * H * .2, vx: -(380 + rnd() * 260), vy: 150 + rnd() * 120, life: 0, max: 1.1 + rnd() * .5 }; nextComet = t + 6 + rnd() * 8; }
        if (comet) {
          comet.life += dt; comet.x += comet.vx * dt; comet.y += comet.vy * dt; var f = comet.life / comet.max;
          if (f >= 1) comet = null; else {
            var al = Math.sin(Math.PI * f) * fade(comet.y), L = 150, len = Math.hypot(comet.vx, comet.vy), tx = comet.x - comet.vx / len * L, ty = comet.y - comet.vy / len * L, g = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
            g.addColorStop(0, 'rgba(235,245,255,' + (.9 * al).toFixed(3) + ')'); g.addColorStop(1, 'rgba(120,170,255,0)'); ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(comet.x, comet.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(comet.x, comet.y, 1.8, 0, TAU); ctx.fill();
          }
        }
      }
    }
    // the orbit arc and its satellites (both themes)
    var cx = W * .5 - mx * 10, cyA = H * -.55 - sy * .03, rx = W * .78, ry = H * .98, tilt = -.1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1; ctx.strokeStyle = dark ? 'rgba(150,190,255,.16)' : 'rgba(20,60,150,.16)'; ctx.beginPath();
    for (var k = 0; k <= 120; k++) { var an = Math.PI * (.08 + .84 * k / 120), ex = Math.cos(an) * rx, ey = Math.sin(an) * ry, px = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), py = cyA + ex * Math.sin(tilt) + ey * Math.cos(tilt); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    sats.forEach(function (st) {
      var u = ((t / st.p + st.o) % 1), an = Math.PI * (.08 + .84 * u), ex = Math.cos(an) * rx, ey = Math.sin(an) * ry, px = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), py = cyA + ex * Math.sin(tilt) + ey * Math.cos(tilt), a = fade(py); if (a < .03) return;
      var edge = Math.min(u, 1 - u) < .08 ? Math.min(u, 1 - u) / .08 : 1; a *= edge;
      ctx.fillStyle = dark ? 'rgba(235,244,255,' + (.9 * a).toFixed(3) + ')' : 'rgba(20,60,150,' + (.8 * a).toFixed(3) + ')';
      ctx.save(); ctx.translate(px, py); ctx.rotate(.785); ctx.fillRect(-2.2, -2.2, 4.4, 4.4); ctx.restore();
      if (dark) { ctx.globalCompositeOperation = 'lighter'; var g2 = ctx.createRadialGradient(px, py, 0, px, py, 16); g2.addColorStop(0, 'rgba(160,200,255,' + (.5 * a).toFixed(3) + ')'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(px - 16, py - 16, 32, 32); ctx.fillRect(px - 14, py - .5, 28, 1); ctx.globalCompositeOperation = 'source-over'; }
      ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.fillStyle = dark ? 'rgba(200,222,255,' + (.7 * a).toFixed(3) + ')' : 'rgba(20,60,150,' + (.7 * a).toFixed(3) + ')'; ctx.fillText(st.n, px + 8, py + 3);
    });
    ctx.globalCompositeOperation = 'source-over';
    if (!once && !reduce) raf = requestAnimationFrame(loop);
  }
  var lastDraw = 0;
  function loop(now) { raf = 0; if (now - lastDraw < 33) { raf = requestAnimationFrame(loop); return; } lastDraw = now; if (root.classList.contains('arc-on') || root.classList.contains('flying')) { raf = requestAnimationFrame(loop); return; } frame(now); }
  addEventListener('resize', fit);
  addEventListener('pointermove', function (e) { if (e.pointerType && e.pointerType !== 'mouse') return; tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
  d.addEventListener('visibilitychange', function () { hid = d.hidden; if (!hid && !raf && !reduce) { last = 0; raf = requestAnimationFrame(loop); } });
  new MutationObserver(function () { if (reduce) frame(performance.now(), true); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  fit(); if (!reduce) raf = requestAnimationFrame(loop);

  /* ---------- 2. telemetry and the descent rail ---------- */
  var SEC = [['me', 'ME'], ['notes', 'NOTES'], ['studied', 'UTP'], ['toolkit', 'SKILLS'], ['work', 'WORK'], ['pulse', 'PULSE'], ['journey', 'JOURNEY'], ['halcyon', 'HALCYON'], ['arcade', 'ARCADE'], ['enter', 'FLIGHT'], ['contact', 'CONTACT']];
  var tele = d.createElement('div'); tele.id = 'tele'; tele.className = 'tele';
  tele.innerHTML = '<p class="tele-l" aria-hidden="true"></p><nav class="tele-r" aria-label="Descent: jump to a section"><i class="tele-line"></i><ol></ol><b class="tele-dot"></b><span class="tele-alt" aria-hidden="true"></span></nav><i class="vf tl"></i><i class="vf tr"></i><i class="vf bl"></i><i class="vf br"></i>';
  body.appendChild(tele);
  var left = tele.querySelector('.tele-l'), rail = tele.querySelector('.tele-r'), ol = rail.querySelector('ol'), dot = rail.querySelector('.tele-dot'), altEl = rail.querySelector('.tele-alt');
  var ticks = [], railH = 0, cur = -1;
  SEC.forEach(function (s) { var li = d.createElement('li'), a = d.createElement('a'); a.href = '#' + s[0]; a.setAttribute('aria-label', s[1].charAt(0) + s[1].slice(1).toLowerCase()); a.innerHTML = '<i></i><span>' + s[1] + '</span>'; li.appendChild(a); ol.appendChild(li); ticks.push({ id: s[0], li: li, a: a, el: null }); });
  function measure() {
    var h = Math.max(1, root.scrollHeight - innerHeight); railH = rail.clientHeight || 1;
    ticks.forEach(function (t) { t.el = d.getElementById(t.id); var vis = t.el && t.el.offsetHeight > 0; t.li.hidden = !vis; if (vis) { t.p = clamp(t.el.offsetTop / h, 0, 1); t.li.style.transform = 'translate3d(0,' + (t.p * railH).toFixed(1) + 'px,0)'; } });
  }
  function fmtAlt(p) { var km = 408 * Math.pow(1 - p, 2.4); if (km >= 10) return km.toFixed(0) + ' KM'; if (km >= 1) return km.toFixed(1) + ' KM'; return Math.max(0, Math.round(km * 1000)) + ' M'; }
  function phase(p) { return p < .1 ? 'ORBIT' : p < .3 ? 'DESCENT' : p < .62 ? 'SKYLINE' : p < .93 ? 'STREET' : 'ARRIVED'; }
  function tick() {
    if (d.hidden) return;
    var h = Math.max(1, root.scrollHeight - innerHeight), p = clamp(scrollY / h, 0, 1), tm = '';
    try { tm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()); } catch (e) { /* no Intl */ }
    left.textContent = 'ALT ' + fmtAlt(p) + '  ·  ' + phase(p) + '  ·  ' + Math.round(p * 100) + '%  ·  KL 3.139N 101.687E  ·  ' + tm + ' MYT';
    dot.style.transform = 'translate3d(0,' + (p * railH).toFixed(1) + 'px,0)'; altEl.style.transform = 'translate3d(0,' + (p * railH).toFixed(1) + 'px,0)'; altEl.textContent = fmtAlt(p);
    var at = -1; ticks.forEach(function (t, i) { if (t.el && !t.li.hidden && t.el.getBoundingClientRect().top <= innerHeight * .4) at = i; });
    if (at !== cur) { if (cur > -1) ticks[cur].li.classList.remove('on'); cur = at; if (cur > -1) ticks[cur].li.classList.add('on'); }
  }
  measure(); tick(); setInterval(tick, 250); setInterval(measure, 2500);
  addEventListener('resize', measure); addEventListener('load', measure);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(measure);
})();
