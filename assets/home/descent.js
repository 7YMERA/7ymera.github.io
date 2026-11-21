/* Descent: a scroll-scrubbed fall from low Earth orbit to Kuala Lumpur, drawn on one 2D canvas (no libraries).
 *   0.00 - 0.22  ORBIT      stars with depth parallax, the limb of the Earth with its atmosphere, ALT 408 km
 *   0.14 - 0.45  MALAYSIA   the coast traced in gold, peninsula and Borneo, as the globe grows under us
 *   0.45 - 0.80  KUALA LUMPUR  a reticle locks on 3.139 N 101.687 E, the graticule opens out, ALT counts down to 460 m
 *   0.80 - 1.00  THE CLOUDS a deck of cloud streams past, the screen turns to sky; the stage then dissolves onto the 3D city
 * The Earth is an orthographic globe sampled per pixel from assets/halcyon/land.json (360 x 180, 2 bits a cell, 2 = Malaysia)
 * at a low resolution and scaled up; the gold coast is hand-placed lat/lon points through the same projection.
 * Scroll progress is smoothed with a critically damped spring. Off-screen it does nothing. Reduced motion: no smoothing, no twinkle.
 */
(function () {
  'use strict';
  var KL = [3.139, 101.687], D2R = Math.PI / 180;
  var PEN = [[6.50, 100.19], [6.10, 100.35], [5.60, 100.38], [5.10, 100.45], [4.60, 100.62], [4.20, 100.70], [3.80, 100.80], [3.40, 101.10], [3.00, 101.35], [2.60, 101.75], [2.25, 102.10], [1.90, 102.60], [1.50, 103.25], [1.30, 103.55], [1.28, 103.85], [1.35, 104.15], [1.65, 104.25], [2.20, 103.95], [2.70, 103.80], [3.20, 103.45], [3.80, 103.35], [4.40, 103.45], [5.00, 103.45], [5.50, 103.05], [6.00, 102.45], [6.25, 102.10], [6.10, 101.85], [5.90, 101.25], [6.10, 100.95], [6.30, 100.60], [6.50, 100.19]];
  var BOR = [[1.80, 109.65], [1.70, 110.30], [2.20, 111.10], [2.90, 112.00], [3.30, 113.05], [4.00, 113.90], [4.60, 114.20], [4.95, 115.15], [5.30, 115.20], [5.95, 115.60], [6.40, 116.35], [6.90, 116.80], [7.35, 117.00], [6.60, 117.70], [5.95, 118.10], [5.00, 118.35], [4.40, 118.60], [4.20, 117.90], [4.50, 117.40]];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

  function Descent(section, opts) {
    opts = opts || {};
    this.sec = section; this.cv = section.querySelector('canvas'); this.ctx = this.cv.getContext('2d', { alpha: false });
    this.stage = section.querySelector('.ds-stage');
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.p = 0; this.ps = 0; this.v = 0; this.visible = false; this.raf = 0; this.last = 0; this.cache = {}; this.t = 0;
    this.land = null; this.mx = 0; this.my = 0; this.tmx = 0; this.tmy = 0;
    this.onProgress = opts.onProgress || null;
    this.off = document.createElement('canvas'); this.offCtx = this.off.getContext('2d');
    this.stars = []; this.mkStars(); this.mkClouds();
    this.phases = [].slice.call(section.querySelectorAll('[data-a]'));
    this.rd = {
      alt: section.querySelector('[data-r="alt"]'), unit: section.querySelector('[data-r="unit"]'), lat: section.querySelector('[data-r="lat"]'),
      lon: section.querySelector('[data-r="lon"]'), vel: section.querySelector('[data-r="vel"]'), mark: section.querySelector('[data-r="mark"]'), pct: section.querySelector('[data-r="pct"]')
    };
    this.sky = ['#cfe6f7', '#eaf4fb'];
    var me = this; this._loop = function (t) { me.frame(t); };
    this.readSky();
    this.size();
    this.loadLand();
    var self = this;
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.size(); self.cache = {}; self.kick(); }).observe(this.stage);
    new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; if (self.visible) self.kick(); }, { rootMargin: '10% 0px' }).observe(section);
    addEventListener('scroll', function () { self.readScroll(); self.kick(); }, { passive: true });
    addEventListener('pointermove', function (e) { self.tmx = e.clientX / innerWidth - .5; self.tmy = e.clientY / innerHeight - .5; if (self.visible) self.kick(); }, { passive: true });
    new MutationObserver(function () { self.readSky(); self.cache = {}; self.kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.readScroll(); this.ps = this.p; this.kick();
  }

  Descent.prototype.readSky = function () {
    var cs = getComputedStyle(document.documentElement);
    this.sky = [cs.getPropertyValue('--sky2').trim() || '#cfe6f7', cs.getPropertyValue('--sky1').trim() || '#eaf4fb'];
  };

  Descent.prototype.readScroll = function () {
    var r = this.sec.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight);
    this.p = clamp(-r.top / span, 0, 1);
  };

  Descent.prototype.loadLand = function () {
    var me = this;
    fetch('/assets/halcyon/land.json').then(function (r) { return r.json(); }).then(function (j) {
      var raw = b64(j.data), w = j.w, h = j.h, n = w * h, L = new Float32Array(n), M = new Float32Array(n);
      for (var i = 0; i < n; i++) { var c = (raw[i >> 2] >> ((i & 3) * 2)) & 3; L[i] = c ? 1 : 0; M[i] = c === 2 ? 1 : 0; }
      me.land = { w: w, h: h, L: L, M: M }; me.cache = {}; me.kick();
    }).catch(function () { /* the globe stays a plain ocean */ });
  };

  Descent.prototype.size = function () {
    var r = this.stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, r.width < 720 ? 1.5 : 2);
    this.W = Math.max(2, r.width); this.H = Math.max(2, r.height); this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    var target = this.W < 720 ? 30000 : 52000, ds = Math.max(3, Math.ceil(Math.sqrt(this.W * this.H / target)));
    this.ds = ds; this.off.width = Math.ceil(this.W / ds); this.off.height = Math.ceil(this.H / ds);
    this.img = this.offCtx.createImageData(this.off.width, this.off.height);
  };

  Descent.prototype.mkStars = function () {
    var s = [], seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 300; i++) s.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, d: .15 + rnd() * .85, r: .5 + rnd() * rnd() * 1.9, ph: rnd() * 6.28, gold: rnd() < .08 });
    this.stars = s;
  };
  Descent.prototype.mkClouds = function () {
    var c = document.createElement('canvas'); c.width = c.height = 512; var x = c.getContext('2d'), seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 46; i++) {
      var px = rnd() * 512, py = rnd() * 512, r = 30 + rnd() * 80;
      for (var ox = -512; ox <= 512; ox += 512) for (var oy = -512; oy <= 512; oy += 512) {
        var g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      }
    }
    this.cloud = c;
  };

  Descent.prototype.kick = function () { if (!this.raf && this.visible) { this.last = 0; this.raf = requestAnimationFrame(this._loop); } };

  Descent.prototype.frame = function (t) {
    this.raf = 0; if (!this.visible) return;
    var dt = this.last ? Math.min(.05, (t - this.last) / 1000) : .016; this.last = t; this.t = t / 1000;
    // critically damped follow
    if (this.reduce) { this.ps = this.p; this.v = 0; }
    else { var o = 2 / .35, x = o * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = this.ps - this.p, tmp = (this.v + o * ch) * dt; this.v = (this.v - o * tmp) * e; this.ps = this.p + (ch + tmp) * e; }
    var dm = 1 - Math.exp(-dt * 4); this.mx += (this.tmx - this.mx) * dm; this.my += (this.tmy - this.my) * dm;
    this.draw();
    if (this.onProgress) this.onProgress(this.ps);
    if (!this.reduce || Math.abs(this.ps - this.p) > 1e-4) this.raf = requestAnimationFrame(this._loop);
  };

  /* ---- projection ---- */
  Descent.prototype.setView = function (z) {
    var W = this.W, H = this.H, e = sstep(0, 1, z);
    var R0 = Math.min(W * .86, H * 1.35), R = R0 * Math.exp(Math.log(900) * z);
    var psi = 62 * (1 - sstep(0, .5, z * 1.35)), // KL's distance north of the sub-satellite point, degrees
      lat0 = KL[0] - psi, lon0 = KL[1] - psi * .18;
    var v = { R: R, lat0: lat0 * D2R, lon0: lon0 * D2R, sin0: Math.sin(lat0 * D2R), cos0: Math.cos(lat0 * D2R) };
    var tx = W * .5 + this.mx * 16 * (1 - e), ty = H * (.6 - .06 * e) + this.my * 10 * (1 - e);
    this.view = v; v.tx = tx; v.ty = ty;
    var p = this.proj(KL[0], KL[1], v, true);
    v.cx = tx - p[0]; v.cy = ty + p[1];
    return v;
  };
  // lat, lon (deg) -> screen offsets relative to the globe centre (x right, y up), and visibility
  Descent.prototype.proj = function (lat, lon, v, noCull) {
    var f = lat * D2R, dl = lon * D2R - v.lon0, cf = Math.cos(f), sf = Math.sin(f);
    var vis = v.sin0 * sf + v.cos0 * cf * Math.cos(dl);
    return [v.R * cf * Math.sin(dl), v.R * (v.cos0 * sf - v.sin0 * cf * Math.cos(dl)), noCull || vis > 0];
  };

  Descent.prototype.draw = function () {
    var ctx = this.ctx, W = this.W, H = this.H, d = this.dpr, p = this.ps;
    var z = clamp((p - .05) / .8, 0, 1), cloudK = sstep(.72, .93, p), wash = sstep(.9, .985, p);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // space
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#02040c'); g.addColorStop(1, '#070d22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var nk = 1 - sstep(.25, .55, p);
    if (nk > 0) {
      ctx.globalAlpha = .55 * nk;
      var n1 = ctx.createRadialGradient(W * .22, H * .3, 0, W * .22, H * .3, W * .55); n1.addColorStop(0, 'rgba(70,60,170,.55)'); n1.addColorStop(1, 'rgba(70,60,170,0)');
      ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);
      var n2 = ctx.createRadialGradient(W * .85, H * .18, 0, W * .85, H * .18, W * .4); n2.addColorStop(0, 'rgba(30,110,170,.4)'); n2.addColorStop(1, 'rgba(30,110,170,0)');
      ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
    this.drawStars(ctx, p, z);
    var v = this.setView(z);
    if (p < .92) { this.drawEarth(ctx, v, z, p); this.drawAtmosphere(ctx, v, z); this.drawGraticule(ctx, v, z); this.drawCoast(ctx, v, z, p); this.drawReticle(ctx, v, z, p); }
    if (cloudK > 0) this.drawClouds(ctx, cloudK, p);
    if (wash > 0) { ctx.globalAlpha = wash; var s = ctx.createLinearGradient(0, 0, 0, H); s.addColorStop(0, this.sky[1]); s.addColorStop(1, this.sky[0]); ctx.fillStyle = s; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.readouts(p, z);
  };

  Descent.prototype.drawStars = function (ctx, p, z) {
    var W = this.W, H = this.H, S = this.stars, i, a = 1 - sstep(.3, .6, p);
    if (a <= 0) return;
    var cx = W / 2, cy = H * .45, k = 1 + z * 2.2, tw = this.reduce ? 0 : 1;
    for (i = 0; i < S.length; i++) {
      var s = S[i], sc = 1 + (k - 1) * s.d;
      var x = cx + s.x * W * .6 * sc - this.mx * 30 * s.d, y = cy + s.y * H * .6 * sc - this.my * 20 * s.d;
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      var al = a * (.45 + .55 * s.d) * (1 - tw * .35 * (.5 + .5 * Math.sin(this.t * (1 + s.d * 2) + s.ph)));
      ctx.globalAlpha = al; ctx.fillStyle = s.gold ? '#ffd27a' : '#dfeaff';
      var r = s.r * (.8 + z * .6 * s.d); ctx.fillRect(x - r / 2, y - r / 2, r, r);
      if (s.r > 1.9) { ctx.globalAlpha = al * .25; ctx.fillRect(x - r * 3, y - .4, r * 6, .8); ctx.fillRect(x - .4, y - r * 3, .8, r * 6); }
    }
    ctx.globalAlpha = 1;
  };

  Descent.prototype.drawEarth = function (ctx, v, z, p) {
    var W = this.W, H = this.H, ds = this.ds, ow = this.off.width, oh = this.off.height, R = v.R;
    // a sphere that is off screen entirely needs no pass; one that fills it is flat
    var land = this.land, data = this.img.data, x, y, i = 0;
    var k = this.key = [Math.round(v.cx), Math.round(v.cy), Math.round(R), Math.round(v.lat0 * 1e4), Math.round(v.lon0 * 1e4), ow, this.land ? 1 : 0, this.sky[0]].join();
    if (this.cache.k !== k) {
      this.cache.k = k;
      // colours: night-blue ocean, slate land, Malaysia warmed to gold; as we fall the palette moves toward the city's blue
      var f = sstep(.55, .95, z), oc = [8 + 20 * f, 30 + 40 * f, 64 + 60 * f], lc = [38 + 50 * f, 78 + 50 * f, 104 + 44 * f], mc = [196 - 40 * f, 150 - 6 * f, 60 + 60 * f];
      var L = land ? land.L : null, M = land ? land.M : null, lw = land ? land.w : 0, lh = land ? land.h : 0;
      var sin0 = v.sin0, cos0 = v.cos0, lon0 = v.lon0, invR = 1 / R;
      for (y = 0; y < oh; y++) {
        var dy = (v.cy - (y + .5) * ds) * invR;
        for (x = 0; x < ow; x++, i += 4) {
          var dx = ((x + .5) * ds - v.cx) * invR, r2 = dx * dx + dy * dy;
          if (r2 >= 1) { data[i + 3] = 0; continue; }
          var zz = Math.sqrt(1 - r2), lat = Math.asin(clamp(zz * sin0 + dy * cos0, -1, 1)), lon = lon0 + Math.atan2(dx, zz * cos0 - dy * sin0);
          var lf = 0, mf = 0;
          if (L) {
            var fy = 90 - lat / D2R - .5, fx = lon / D2R + 180 - .5; fx = ((fx % lw) + lw) % lw;
            var y0 = Math.floor(fy), x0 = Math.floor(fx), ty = fy - y0, tx = fx - x0, y1 = clamp(y0 + 1, 0, lh - 1); y0 = clamp(y0, 0, lh - 1);
            var x1 = (x0 + 1) % lw, a0 = y0 * lw + x0, a1 = y0 * lw + x1, b0 = y1 * lw + x0, b1 = y1 * lw + x1;
            lf = (L[a0] * (1 - tx) + L[a1] * tx) * (1 - ty) + (L[b0] * (1 - tx) + L[b1] * tx) * ty;
            mf = (M[a0] * (1 - tx) + M[a1] * tx) * (1 - ty) + (M[b0] * (1 - tx) + M[b1] * tx) * ty;
            lf = sstep(.35, .65, lf); mf = sstep(.35, .65, mf);
          }
          var sh = .32 + .68 * Math.pow(zz, .55), rr = oc[0], gg = oc[1], bb = oc[2];
          rr += (lc[0] - rr) * lf; gg += (lc[1] - gg) * lf; bb += (lc[2] - bb) * lf;
          rr += (mc[0] - rr) * mf; gg += (mc[1] - gg) * mf; bb += (mc[2] - bb) * mf;
          data[i] = rr * sh; data[i + 1] = gg * sh; data[i + 2] = bb * sh; data[i + 3] = 255;
        }
      }
      this.offCtx.putImageData(this.img, 0, 0);
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(this.off, 0, 0, ow * ds, oh * ds);
  };

  Descent.prototype.drawAtmosphere = function (ctx, v, z) {
    var R = v.R; if (R > this.W * 6) return;
    var g = ctx.createRadialGradient(v.cx, v.cy, R * .965, v.cx, v.cy, R * 1.07);
    g.addColorStop(0, 'rgba(110,180,255,0)'); g.addColorStop(.38, 'rgba(120,190,255,.55)'); g.addColorStop(.55, 'rgba(90,150,255,.22)'); g.addColorStop(1, 'rgba(60,110,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(v.cx, v.cy, R * 1.07, 0, 6.2832); ctx.fill();
    // a thin bright limb line
    ctx.strokeStyle = 'rgba(190,225,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(v.cx, v.cy, R, 0, 6.2832); ctx.stroke();
  };

  Descent.prototype.drawGraticule = function (ctx, v, z) {
    var pxDeg = v.R * D2R, step = [10, 5, 2, 1, .5, .2, .1, .05, .02, .01, .005, .002, .001], st = 10, i;
    for (i = 0; i < step.length; i++) { st = step[i]; if (pxDeg * st < 220) { /* keep going finer while lines are far apart */ } if (pxDeg * step[i] >= 150) break; }
    var a = (.1 + .22 * sstep(.2, .6, z)) * (1 - sstep(.86, .92, this.ps));
    ctx.strokeStyle = 'rgba(150,210,255,' + a.toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath();
    var span = Math.min(80, Math.max(st * 6, Math.hypot(this.W, this.H) / pxDeg * .75)), la0 = Math.floor((KL[0] - span) / st) * st, la1 = KL[0] + span, lo0 = Math.floor((KL[1] - span) / st) * st, lo1 = KL[1] + span, la, lo, n = 0;
    var seg = Math.max(st / 2, span / 36);
    for (la = la0; la <= la1 && n < 40; la += st, n++) { var pen = false; for (lo = lo0; lo <= lo1; lo += seg) { var q = this.proj(la, lo, v); if (q[2]) { var X = v.cx + q[0], Y = v.cy - q[1]; if (pen) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); pen = true; } else pen = false; } }
    for (lo = lo0, n = 0; lo <= lo1 && n < 40; lo += st, n++) { pen = false; for (la = la0; la <= la1; la += seg) { var q2 = this.proj(la, lo, v); if (q2[2]) { var X2 = v.cx + q2[0], Y2 = v.cy - q2[1]; if (pen) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); pen = true; } else pen = false; } }
    ctx.stroke();
  };

  Descent.prototype.drawCoast = function (ctx, v, z, p) {
    var k = sstep(.1, .34, p), fade = 1 - sstep(.74, .86, p); if (k <= 0 || fade <= 0) return;
    var me = this;
    function trace(pts, frac, close) {
      var P = [], i, tot = 0, L = [0];
      for (i = 0; i < pts.length; i++) { var q = me.proj(pts[i][0], pts[i][1], v); P.push([v.cx + q[0], v.cy - q[1], q[2]]); if (i) { tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(tot); } }
      var lim = tot * frac; ctx.beginPath(); var pen = false;
      for (i = 0; i < P.length; i++) {
        if (!P[i][2]) { pen = false; continue; }
        if (L[i] > lim) { if (i && pen) { var t = (lim - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); ctx.lineTo(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t); } break; }
        if (pen) ctx.lineTo(P[i][0], P[i][1]); else ctx.moveTo(P[i][0], P[i][1]); pen = true;
      }
      ctx.stroke();
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalAlpha = fade * .35; ctx.strokeStyle = '#ffb938'; ctx.lineWidth = 7; trace(PEN, k); trace(BOR, k);
    ctx.globalAlpha = fade; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.8; trace(PEN, k); trace(BOR, k);
    ctx.globalAlpha = 1;
  };

  Descent.prototype.drawReticle = function (ctx, v, z, p) {
    var k = sstep(.42, .56, p) * (1 - sstep(.84, .9, p)); if (k <= 0) return;
    var x = v.tx, y = v.ty, r = 34 + 6 * Math.sin(this.t * 2), s = 1 + (1 - k) * .8;
    ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#ffd27a'; ctx.fillStyle = '#ffd27a'; ctx.lineWidth = 1.5;
    ctx.translate(x, y); ctx.scale(s, s);
    var c = 22; ctx.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { ctx.moveTo(q[0] * (r + c), q[1] * r); ctx.lineTo(q[0] * r, q[1] * r); ctx.lineTo(q[0] * r, q[1] * (r + c)); });
    ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = k * .35; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, 6.2832); ctx.stroke();
    ctx.restore();
  };

  Descent.prototype.drawClouds = function (ctx, k, p) {
    var W = this.W, H = this.H, c = this.cloud, i, t = this.t * (this.reduce ? 0 : 1);
    for (i = 0; i < 3; i++) {
      var sc = (1.2 + i * .9) * (1 + (p - .72) * (3 + i * 3)) * (W / 900 + .6), sz = 512 * sc;
      var ox = (-t * 10 * (i + 1)) % sz, oy = (-(p * 1400 * (i + 1))) % sz;
      ctx.globalAlpha = k * (.5 - i * .1);
      for (var x = ox - sz; x < W; x += sz) for (var y = oy - sz; y < H; y += sz) ctx.drawImage(c, x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  };

  function fmtAlt(km) { return km >= 10 ? [Math.round(km).toString(), 'KM'] : km >= 1 ? [km.toFixed(1), 'KM'] : [Math.round(km * 1000 / 5) * 5 + '', 'M']; }
  Descent.prototype.readouts = function (p, z) {
    var alt = 408 * Math.exp(-Math.log(408 / .46) * z), a = fmtAlt(alt), rd = this.rd, c = this.cache;
    var lat = KL[0] + (62 * (1 - sstep(0, .5, z * 1.35))) * -1, lon = KL[1] - 62 * (1 - sstep(0, .5, z * 1.35)) * .18;
    var vel = 7.66 * (1 - sstep(.1, .9, p)), pct = Math.round(p * 100);
    function set(el, key, val) { if (el && c[key] !== val) { c[key] = val; el.textContent = val; } }
    set(rd.alt, 'alt', a[0]); set(rd.unit, 'unit', a[1]);
    set(rd.lat, 'lat', Math.abs(lat).toFixed(3) + '° ' + (lat >= 0 ? 'N' : 'S')); set(rd.lon, 'lon', lon.toFixed(3) + '° E');
    set(rd.vel, 'vel', vel.toFixed(2) + ' KM/S'); set(rd.pct, 'pct', ('00' + pct).slice(-3));
    if (rd.mark) rd.mark.style.transform = 'translate3d(0,' + (z * 100).toFixed(2) + '%,0)';
    for (var i = 0; i < this.phases.length; i++) {
      var e = this.phases[i], a0 = +e.dataset.a, b0 = +e.dataset.b, f = sstep(a0, a0 + .05, p) * (1 - sstep(b0 - .05, b0, p));
      var q = f.toFixed(3); if (e.__q !== q) { e.__q = q; e.style.setProperty('--o', q); e.style.setProperty('--y', ((1 - f) * 18).toFixed(1) + 'px'); }
    }
  };

  window.Descent = Descent;
})();
