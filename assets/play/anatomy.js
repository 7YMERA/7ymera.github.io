/* anatomy.js: Exploded Skyline Anatomy (Halcyon watch-exploded-view concept, built from the real KL landmark meshes).
   Loads assets/city/{klcc,merdeka118,menara_kl,exchange106}.json, slices triangles into 5 architectural strata by height,
   and renders an interactive 3D-projected exploded diagram on one 2D canvas (zero extra WebGL context risk). */
(function () {
  'use strict';
  var d = document;
  var LANDMARKS = [
    {
      id: 'klcc', name: 'Petronas Twin Towers', file: '/assets/city/klcc.json', height: '452 m', year: '1998',
      strata: [
        { name: 'Podium & Suria Base', range: '0 – 75 m', note: 'Six-storey retail concourse anchoring both 88-storey towers.' },
        { name: 'Lower Octagonal Shaft', range: '75 – 160 m', note: 'Rub el Hizb 8-pointed star plan in stainless steel & glass.' },
        { name: 'Double-Deck Skybridge', range: '160 – 210 m', note: 'Floors 41–42 at 170 m, hinged on giant ball bearings to let towers sway.' },
        { name: 'Upper Stepped Tiers', range: '210 – 375 m', note: 'Five concentric setbacks tapering toward the Observation Deck.' },
        { name: 'Pinnacles & Spires', range: '375 – 452 m', note: '73.5 m twin spires with aviation beacons and crown rings.' }
      ]
    },
    {
      id: 'merdeka', name: 'Merdeka 118', file: '/assets/city/merdeka118.json', height: '678.9 m', year: '2024',
      strata: [
        { name: 'Podium & 118 Mall', range: '0 – 95 m', note: 'Glass-domed civic plinth overlooking Stadium Merdeka.' },
        { name: 'Lower Faceted Core', range: '95 – 245 m', note: 'Triangular crystalline facade inspired by Malaysian songket patterns.' },
        { name: 'Mid Office & Hotel Zone', range: '245 – 410 m', note: 'Asymmetric diagonal steel outriggers resisting tropical wind loads.' },
        { name: 'Observation Crown', range: '410 – 518 m', note: 'Southeast Asia’s highest observation deck at 500+ m.' },
        { name: '160 m Spire', range: '518 – 678.9 m', note: 'Slender lit spire echoing Tunku Abdul Rahman’s raised hand.' }
      ]
    },
    {
      id: 'menara', name: 'Menara KL', file: '/assets/city/menara_kl.json', height: '421 m', year: '1996',
      strata: [
        { name: 'Bukit Nanas Plinth', range: '0 – 65 m', note: 'Set atop the 94 m Bukit Nanas forest reserve hill.' },
        { name: 'Lower Concrete Shaft', range: '65 – 165 m', note: 'Fluted cylindrical core housing high-speed lifts and stairwells.' },
        { name: 'Upper Shaft & Collar', range: '165 – 255 m', note: 'Tapering structural neck rising to the broadcast pod.' },
        { name: 'Muqarnas Observation Pod', range: '255 – 335 m', note: 'Six-storey revolving head inspired by traditional Malaysian gasing.' },
        { name: 'Broadcast Antenna Mast', range: '335 – 421 m', note: 'Steel telecommunications spire crowning the KL skyline.' }
      ]
    },
    {
      id: 'exchange', name: 'The Exchange 106', file: '/assets/city/exchange106.json', height: '445 m', year: '2019',
      strata: [
        { name: 'TRX Plaza Base', range: '0 – 85 m', note: 'Financial district plinth connected to the TRX MRT interchange.' },
        { name: 'Lower Glass Monolith', range: '85 – 185 m', note: 'Column-free trading floor plates wrapped in reflective glazing.' },
        { name: 'Mid Tower Stack', range: '185 – 295 m', note: 'Clean rectilinear shaft with recessed vertical mullions.' },
        { name: 'Upper Executive Floors', range: '295 – 380 m', note: 'High-zone suites leading up to the illuminated crown.' },
        { name: 'Illuminated Lattice Crown', range: '380 – 445 m', note: '48 m sloped glass pyramid lit from within at night.' }
      ]
    }
  ];

  function b64(str, Type) {
    var bin = atob(str), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Type(u.buffer);
  }

  var cache = {};
  function loadLandmark(lm) {
    if (cache[lm.id]) return Promise.resolve(cache[lm.id]);
    return fetch(lm.file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var pos = b64(j.positions, Float32Array);
      var bIdx = b64(j.body, Uint16Array);
      var gIdx = b64(j.glass, Uint16Array);
      // compute bounds
      var minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, i;
      for (i = 0; i < pos.length; i += 3) {
        var x = pos[i], y = pos[i + 1], z = pos[i + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      var cx = (minX + maxX) * .5, cz = (minZ + maxZ) * .5, spanY = Math.max(1e-3, maxY - minY);
      var scale = 1 / Math.max(spanY, (maxX - minX) * 1.1, (maxZ - minZ) * 1.1);
      // collect triangles, subsampled to ~2200 max for silky 60fps 2D rendering on every device
      var strata = [[], [], [], [], []];
      function collect(idx, isGlass) {
        var tris = idx.length / 3, step = Math.max(1, Math.floor(tris / (isGlass ? 900 : 1200)));
        for (var t = 0; t < tris; t += step) {
          var i0 = idx[t * 3] * 3, i1 = idx[t * 3 + 1] * 3, i2 = idx[t * 3 + 2] * 3;
          var ax = (pos[i0] - cx) * scale, ay = (pos[i0 + 1] - minY) * scale, az = (pos[i0 + 2] - cz) * scale;
          var bx = (pos[i1] - cx) * scale, by = (pos[i1 + 1] - minY) * scale, bz = (pos[i1 + 2] - cz) * scale;
          var cx2 = (pos[i2] - cx) * scale, cy2 = (pos[i2 + 1] - minY) * scale, cz2 = (pos[i2 + 2] - cz) * scale;
          var my = (ay + by + cy2) / 3;
          var normY = (my / (spanY * scale));
          var band = Math.max(0, Math.min(4, Math.floor(normY * 5)));
          // face normal for simple directional shading
          var ux = bx - ax, uy = by - ay, uz = bz - az;
          var vx = cx2 - ax, vy = cy2 - ay, vz = cz2 - az;
          var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          var nl = Math.hypot(nx, ny, nz) || 1;
          strata[band].push({
            a: [ax, ay, az], b: [bx, by, bz], c: [cx2, cy2, cz2],
            n: [nx / nl, ny / nl, nz / nl], m: [(ax + bx + cx2) / 3, my, (az + bz + cz2) / 3],
            g: isGlass ? 1 : 0
          });
        }
      }
      collect(bIdx, false);
      collect(gIdx, true);
      var out = { strata: strata, hNorm: spanY * scale };
      cache[lm.id] = out;
      return out;
    });
  }

  function init() {
    var root = d.getElementById('anatomy');
    if (!root) return;
    var cv = d.getElementById('an-canvas'), ctx = cv.getContext('2d');
    var tabs = d.getElementById('an-tabs'), list = d.getElementById('an-strata');
    var slider = d.getElementById('an-explode'), pctEl = d.getElementById('an-pct');
    var titleEl = d.getElementById('an-name'), metaEl = d.getElementById('an-meta'), noteEl = d.getElementById('an-note');
    var spinBtn = d.getElementById('an-spin'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    var cur = 0, data = null, explode = 0.55, tExplode = 0.55, activeBand = -1;
    var yaw = 0.62, pitch = 0.28, autoSpin = !reduce, dragging = false, lx = 0, ly = 0;
    var raf = 0, active = false, lastT = 0;

    function buildTabs() {
      tabs.innerHTML = '';
      LANDMARKS.forEach(function (lm, i) {
        var b = d.createElement('button');
        b.type = 'button'; b.className = 'arc-tab'; b.setAttribute('aria-selected', i === cur ? 'true' : 'false');
        b.innerHTML = lm.name + '<small>' + lm.height + ' · ' + lm.year + '</small>';
        b.addEventListener('click', function () { pick(i); });
        tabs.appendChild(b);
      });
    }

    function buildStrata() {
      var lm = LANDMARKS[cur];
      list.innerHTML = '';
      // render top-to-bottom so spire is at top
      for (var i = lm.strata.length - 1; i >= 0; i--) {
        (function (idx) {
          var s = lm.strata[idx], b = d.createElement('button');
          b.type = 'button'; b.className = 'an-sbtn' + (activeBand === idx ? ' on' : '');
          b.innerHTML = '<b>0' + (idx + 1) + '</b><span>' + s.name + '</span><small>' + s.range + '</small>';
          b.addEventListener('click', function () {
            activeBand = activeBand === idx ? -1 : idx;
            updateInfo(); buildStrata();
          });
          list.appendChild(b);
        })(i);
      }
    }

    function updateInfo() {
      var lm = LANDMARKS[cur];
      titleEl.textContent = lm.name;
      if (activeBand >= 0) {
        var s = lm.strata[activeBand];
        metaEl.textContent = 'Stratum 0' + (activeBand + 1) + ' · ' + s.range;
        noteEl.textContent = s.note;
      } else {
        metaEl.textContent = lm.height + ' · ' + lm.year + ' · Drag to rotate, click a stratum to inspect';
        noteEl.textContent = 'Real SketchUp mesh sliced into 5 structural strata. Pull the Explode slider to separate the landmark like a watch movement.';
      }
    }

    function pick(i) {
      cur = i; activeBand = -1; data = null;
      buildTabs(); buildStrata(); updateInfo();
      loadLandmark(LANDMARKS[cur]).then(function (res) { data = res; kick(); }).catch(function () { noteEl.textContent = 'Could not load landmark mesh.'; });
    }

    slider.addEventListener('input', function () {
      tExplode = +slider.value / 100;
      pctEl.textContent = Math.round(tExplode * 100) + '%';
      kick();
    });
    spinBtn.addEventListener('click', function () {
      autoSpin = !autoSpin;
      spinBtn.setAttribute('aria-pressed', autoSpin ? 'true' : 'false');
      spinBtn.querySelector('b').textContent = autoSpin ? 'On' : 'Off';
      kick();
    });
    cv.addEventListener('pointerdown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      yaw += (e.clientX - lx) * .009;
      pitch = Math.max(-0.45, Math.min(0.85, pitch + (e.clientY - ly) * .006));
      lx = e.clientX; ly = e.clientY; kick();
    });
    cv.addEventListener('pointerup', function () { dragging = false; });
    cv.addEventListener('pointercancel', function () { dragging = false; });

    function size() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }

    function draw(now) {
      raf = 0;
      if (!active) return;
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
      lastT = now;
      if (autoSpin && !dragging && !reduce) yaw += dt * 0.36;
      explode += (tExplode - explode) * (reduce ? 1 : Math.min(1, dt * 8));
      size();
      var W = cv.width, H = cv.height, dpr = Math.min(devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // deep blueprint / horology background
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#040915'); bg.addColorStop(1, '#09162b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // subtle technical grid
      ctx.strokeStyle = 'rgba(130,178,240,.06)'; ctx.lineWidth = 1;
      var gs = 32 * dpr;
      ctx.beginPath();
      for (var gx = 0; gx < W; gx += gs) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
      for (var gy = 0; gy < H; gy += gs) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
      ctx.stroke();

      if (!data) {
        ctx.fillStyle = '#8fb2d8'; ctx.font = (13 * dpr) + 'px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText('LOADING MESH STRATA…', W / 2, H / 2);
        return;
      }

      var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var spread = explode * 0.48;
      var totalH = data.hNorm + spread * 4;
      var sc = Math.min(W, H) * 0.68 / Math.max(0.85, totalH * 0.92);
      var ox = W * 0.5, oy = H * 0.5 + (totalH * 0.44) * sc;

      // vertical axis centerline when exploded
      if (explode > 0.05) {
        ctx.strokeStyle = 'rgba(255,210,122,' + (explode * 0.25).toFixed(3) + ')';
        ctx.setLineDash([4 * dpr, 6 * dpr]);
        ctx.beginPath(); ctx.moveTo(ox, oy + 14 * dpr); ctx.lineTo(ox, oy - totalH * sc - 16 * dpr); ctx.stroke();
        ctx.setLineDash([]);
      }

      function proj(x, y, z) {
        var rx = x * cy - z * sy, rz = x * sy + z * cy;
        var ry = y * cp - rz * sp, rz2 = y * sp + rz * cp;
        var p = 2.6 / (2.6 - rz2 * 0.55);
        return [ox + rx * sc * p, oy - ry * sc * p, rz2];
      }

      // collect and depth-sort visible triangles across all 5 strata
      var drawList = [];
      for (var b = 0; b < 5; b++) {
        var tris = data.strata[b], lift = b * spread;
        var hi = activeBand === -1 || activeBand === b;
        for (var i = 0; i < tris.length; i++) {
          var tr = tris[i];
          var pm = proj(tr.m[0], tr.m[1] + lift, tr.m[2]);
          drawList.push({ tr: tr, lift: lift, z: pm[2], b: b, hi: hi });
        }
      }
      drawList.sort(function (a, b) { return a.z - b.z; });

      var lx0 = 0.55, ly0 = 0.72, lz0 = 0.42;
      for (var k = 0; k < drawList.length; k++) {
        var item = drawList[k], tr = item.tr, lift = item.lift;
        var p0 = proj(tr.a[0], tr.a[1] + lift, tr.a[2]);
        var p1 = proj(tr.b[0], tr.b[1] + lift, tr.b[2]);
        var p2 = proj(tr.c[0], tr.c[1] + lift, tr.c[2]);
        // rotated normal dot light
        var nx = tr.n[0] * cy - tr.n[2] * sy, nz = tr.n[0] * sy + tr.n[2] * cy;
        var lit = Math.abs(nx * lx0 + tr.n[1] * ly0 + nz * lz0);
        var shade = 0.35 + lit * 0.65;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath();
        if (activeBand === item.b) {
          ctx.fillStyle = 'rgba(' + Math.round(235 * shade) + ',' + Math.round(178 * shade) + ',' + Math.round(78 * shade) + ',0.92)';
          ctx.strokeStyle = 'rgba(255,228,150,0.45)';
        } else if (item.hi) {
          if (tr.g) {
            ctx.fillStyle = 'rgba(' + Math.round(125 * shade) + ',' + Math.round(182 * shade) + ',' + Math.round(248 * shade) + ',0.78)';
          } else {
            ctx.fillStyle = 'rgba(' + Math.round(52 * shade) + ',' + Math.round(96 * shade) + ',' + Math.round(168 * shade) + ',0.86)';
          }
          ctx.strokeStyle = 'rgba(180,218,255,0.14)';
        } else {
          ctx.fillStyle = 'rgba(28,48,84,0.28)';
          ctx.strokeStyle = 'rgba(100,145,210,0.08)';
        }
        ctx.fill();
        ctx.lineWidth = 0.6 * dpr;
        ctx.stroke();
      }

      // callout ticks on the right for each stratum when exploded
      if (explode > 0.12) {
        var lm = LANDMARKS[cur];
        ctx.font = '600 ' + Math.round(10.5 * dpr) + 'px "JetBrains Mono", monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (var s = 0; s < 5; s++) {
          var sy0 = ((s + 0.5) / 5) * data.hNorm + s * spread;
          var pt = proj(0.24, sy0, 0);
          var tx = Math.min(W - 145 * dpr, Math.max(ox + 70 * dpr, pt[0] + 24 * dpr));
          var on = activeBand === s;
          ctx.strokeStyle = on ? '#ffd27a' : 'rgba(159,208,255,0.35)';
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath(); ctx.moveTo(pt[0], pt[1]); ctx.lineTo(tx - 6 * dpr, pt[1]); ctx.stroke();
          ctx.fillStyle = on ? '#ffd27a' : 'rgba(215,232,255,0.72)';
          ctx.fillText('0' + (s + 1) + ' ' + lm.strata[s].range, tx, pt[1]);
        }
      }

      if (active && (autoSpin || dragging || Math.abs(tExplode - explode) > 0.002)) raf = requestAnimationFrame(draw);
    }

    function kick() { if (!raf && active) { lastT = 0; raf = requestAnimationFrame(draw); } }

    d.addEventListener('play-view', function (e) {
      active = !!(e.detail && e.detail.id === 'anatomy');
      if (active) {
        if (!data) pick(cur);
        else kick();
      } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });
    addEventListener('resize', function () { if (active) kick(); });
    buildTabs(); buildStrata(); updateInfo();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
