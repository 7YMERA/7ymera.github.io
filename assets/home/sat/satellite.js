/* Satellite inspector: a NASA satellite, big and centred, lit like a photograph, with an x-ray, an explode and three models.
 *
 * Where it lives: the first screen of /lab/ (lab/index.html, host `<div class="sat-stage" data-sat-hero>`). Mode 'cabinet' with `hero: true`:
 * no scroll listener, no readScroll (the stage is always fully in), it sizes from its own container (ResizeObserver), and it renders only
 * while the stage is on screen (IntersectionObserver), the tab is visible, and no cabinet is open over it (play.js's 'play-view' event
 * with any id covers it). Scrolled away or covered, the loop stops and the GL context is freed a few seconds later; the glb stay cached.
 * Three.js, the loaders and the glb are fetched on /lab/ only. Without `hero` the same mode is a cabinet host (#sat-stage, opened by the
 * 'play-view' event with id 'sat'); no page uses that now. `SatelliteStage.frames` counts renders. Styles: assets/play/sat.css.
 * (It used to be the hero of the home page's orbit chapter, then a cabinet on /play/. The 'scroll' mode below is the old home path:
 * #descent with data-hold; it is no longer booted anywhere, the home page links to /lab/.)
 *
 * Scroll mode (unused): #descent carries data-hold (a share of the section's scroll). While raw progress is inside the hold,
 * descent.js keeps its own map at 0 and this file owns the stage: arrival, hero (slow sway, mouse parallax), exit.
 *
 * Models: GPM, TRMM and AIM from NASA 3D Resources (free to use, credited on screen), Draco glb. Loaded when the cabinet opens,
 * three.js r128 + GLTFLoader + DRACOLoader. The glb carry flat colour materials only, so each material is classed by name
 * (cells, foil, metal, panel) and given a real PBR look: metalness, roughness, a procedural solar cell grid and an environment map
 * (PMREM from a small procedural space room: sun softbox, cool rim strip, Earth-bounce glow), a key light, a rim light, ACES.
 *
 * DataScan (the x-ray): a cursor-targeted reveal in screen space on the satellite's own materials. A comet trail of capsules (the
 * cursor path), radius grows with cursor speed, fbm-noised soft edge, closes in about a second when the cursor stops. Inside it the
 * solid shell is dithered away and an additive ghost pass (cyan creases, fresnel, hatching, interior colour at 8 % / 20 % for
 * front / back faces) shows the inside. Outside it the satellite is fully solid. Touch: the finger scans while dragging
 * (vertical drags still scroll); the X-ray button sweeps a big scan circle by itself.
 *
 * Extras: plexus of '+' nodes drifting round it (cursor shoves them), a warm lens flare, a label that follows the model, Explode
 * with leader-line part labels, model tabs, zoom buttons. The wheel is never captured. Rendering pauses off screen and when the tab
 * is hidden; DPR is capped at 1.75; phones start on AIM. Cues (document 'sfx-cue'): sat-on, sat-off, sat-xray, sat-explode, sat-assemble.
 * Reduced motion: no sway, no trail, no speed growth, no auto sweep inertia.
 */
(function () {
  'use strict';
  var d = document, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touchy = matchMedia('(hover: none)').matches;
  var BASE = '/assets/home/sat/';
  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', THREE_SRI = 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu';
  var LIBS = [
    [CDN + 'loaders/GLTFLoader.js', 'sha384-fljlqkjWlmSFjkESkQvm77heIZpoWmXEOzlCA7kOpGUH+95Zk0yGfQieWM2q136E'],
    [CDN + 'loaders/DRACOLoader.js', 'sha384-TNRcLasZnnfIJJskDY5XlrfmsKTjBSy98MtyLuX+3rQWRbpSQvtFIdikNpcOh3SN']
  ];
  var MODELS = {
    gpm: { file: 'gpm.glb', name: 'GPM', full: 'Global Precipitation Measurement', agency: 'NASA + JAXA', year: 2014, note: 'NASA + JAXA Core Observatory · launched 2014 · rain and snow, from orbit' },
    trmm: { file: 'trmm.glb', name: 'TRMM', full: 'Tropical Rainfall Measuring Mission', agency: 'NASA + JAXA', year: 1997, note: 'NASA + JAXA · launched 1997 · the tropics’ rain, for 17 years' },
    aim: { file: 'aim.glb', name: 'AIM', full: 'Aeronomy of Ice in the Mesosphere', agency: 'NASA', year: 2007, note: 'NASA · launched 2007 · the highest clouds on Earth' }
  };
  var ORDER = ['gpm', 'trmm', 'aim'];
  var TRAIL = 16;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function cue(name) { try { d.dispatchEvent(new CustomEvent('sfx-cue', { detail: { name: name } })); } catch (e) { /* no sound */ } }
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- clean part names: "Gold-fl-instruments-3" -> "Gold thermal blanket" ---------- */
  var RULES = [
    [/solarpanel(edge|front)/i, 'Array frame'], [/solarpanel.*back|solar.*back/i, 'Array backing'], [/solar/i, 'Solar array'],
    [/gold/i, 'Gold thermal blanket'], [/mainbody|main.?bus|body/i, 'Main bus'], [/dishrails|rails/i, 'Dish rails'], [/spinning/i, 'Spinning dish'],
    [/reflector|dot.?reflector/i, 'Reflector'], [/dish/i, 'Antenna dish'], [/bottombox|box/i, 'Equipment box'], [/silver/i, 'Silver foil'],
    [/bronze/i, 'Bronze foil'], [/darkgrey|grey|gray/i, 'Grey panels'], [/black/i, 'Black panels'], [/cloth/i, 'Insulation cloth'],
    [/glass|lens/i, 'Optics'], [/white/i, 'White panels']
  ];
  function cleanName(raw, rules) {
    var s = String(raw || '').replace(/^TRMM[_ ]*\[?|\]$/g, '').replace(/^Pivot-/, '').replace(/_\d+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
    if (rules) {
      for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(s)) return RULES[i][1];
    }
    s = s.replace(/\.\d+$/, '').replace(/[_\-\/]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/\b(Surfaces|Parts)\b/i, function (m) { return m.toLowerCase(); });
    if (!s) return 'Part';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // which look a material gets, from its name
  function classify(n) {
    n = String(n || '').toLowerCase();
    if (/solar.*(back|edge)|white.?back|solar.?(small|parts)/.test(n)) return 'panel';
    if (/solar|panel ?\d|blue_surf/.test(n)) return 'cell';
    if (/gold|bronze|orange|brown/.test(n)) return 'gold';
    if (/silver|reflector|dish|rail|lens|glass|microwave|virs|ceres|imager/.test(n)) return 'metal';
    if (/black|dark|grey|gray/.test(n)) return 'dark';
    return 'paint';
  }

  function loadScript(src, integrity) {
    return new Promise(function (res, rej) {
      var s = d.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; if (integrity) s.integrity = integrity;
      s.onload = function () { res(); }; s.onerror = function () { s.remove(); rej(new Error('script ' + src)); };
      d.head.appendChild(s);
    });
  }
  var libsJob = null;
  function loadLibs() {
    if (libsJob) return libsJob;
    // three.js: the home page ships its own; /play/ does not, so inject the same r128 build (same SRI) on first need
    if (!window.THREE && !d.querySelector('script[src*="three.min.js"]')) loadScript(THREE_SRC, THREE_SRI).catch(function () { /* the wait below times out */ });
    libsJob = new Promise(function (res, rej) {
      var t0 = performance.now();
      (function wait() {
        if (window.THREE) return res();
        if (performance.now() - t0 > 20000) return rej(new Error('three.js did not load'));
        setTimeout(wait, 120);
      })();
    }).then(function () { return LIBS.reduce(function (p, l) { return p.then(function () { return loadScript(l[0], l[1]); }); }, Promise.resolve()); });
    libsJob.catch(function () { libsJob = null; });
    return libsJob;
  }

  /* ---------- GLSL ---------- */
  // the DataScan mask: a trail of capsules in screen space (x, y in 0..1 with y up; z strength; w radius in screen heights)
  var SCAN_PARS = 'uniform vec4 uTrail[' + TRAIL + '];\nuniform vec2 uRes;\nuniform float uSoft;\nuniform float uEdge;\nuniform float uTime;\nuniform float uOn;\n' +
    'float sc_h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n' +
    'float sc_n(vec2 p){ vec2 i = floor(p), f = fract(p); float a = sc_h(i), b = sc_h(i + vec2(1.0, 0.0)), c = sc_h(i + vec2(0.0, 1.0)), e = sc_h(i + vec2(1.0, 1.0)); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(a, b, u.x), mix(c, e, u.x), u.y); }\n' +
    'float sc_f(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * sc_n(p); p = p * 2.02 + 7.1; a *= 0.5; } return v; }\n' +
    'float scanMask(){\n  if (uOn < 0.5) return 0.0;\n  vec2 scr = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;\n' +
    '  float warp = (sc_f(scr * 2.4 + vec2(uTime * 0.10, uTime * 0.07)) - 0.5) * uEdge;\n  float m = 0.0;\n' +
    '  for (int i = 0; i < ' + (TRAIL - 1) + '; i++) {\n    vec4 a = uTrail[i], b = uTrail[i + 1];\n    if (a.z <= 0.0 || b.z <= 0.0) continue;\n' +
    '    vec2 pa = scr - a.xy; pa.x *= asp; vec2 ba = b.xy - a.xy; ba.x *= asp;\n' +
    '    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);\n    float dist = length(pa - ba * h);\n' +
    '    float rad = mix(a.w, b.w, h); float st = mix(a.z, b.z, h);\n    float r = dist / max(rad, 1e-4) + warp;\n' +
    '    m = max(m, (1.0 - smoothstep(1.0 - uSoft, 1.0, r)) * st);\n  }\n  return clamp(m, 0.0, 1.0);\n}\n' +
    'float scanDither(){ return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }\n';

  // solid pass: the glb's own PBR material, patched. Inside the scan the shell is dithered away (soft edge), the rim glows cyan.
  var CELL_GLSL = '{ vec3 an = abs(normalize(vON)); vec2 q = (an.x > an.y && an.x > an.z) ? vOP.yz : ((an.y > an.z) ? vOP.xz : vOP.xy); q *= uCellF;\n' +
    ' vec2 g = abs(fract(q) - 0.5); vec2 fw = fwidth(q); vec2 e = 0.5 - g;\n' +
    ' float ln = max(1.0 - smoothstep(0.018, 0.018 + fw.x * 1.4 + 0.01, e.x), 1.0 - smoothstep(0.018, 0.018 + fw.y * 1.4 + 0.01, e.y));\n' +
    ' ln *= 1.0 - smoothstep(0.35, 0.8, fw.x + fw.y);\n' +
    ' vec2 id = floor(q); float tone = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);\n' +
    ' vec2 bus = abs(fract(q / 8.0) - 0.5); float seg = (1.0 - smoothstep(0.0, 0.012 + fw.x * 0.18, 0.5 - bus.x)) + (1.0 - smoothstep(0.0, 0.012 + fw.y * 0.18, 0.5 - bus.y));\n' +
    ' vec3 cc = mix(vec3(0.010, 0.030, 0.140), vec3(0.030, 0.085, 0.330), tone);\n' +
    ' diffuseColor.rgb = mix(cc, vec3(0.52, 0.58, 0.74), clamp(ln * 0.85 + seg * 0.5, 0.0, 1.0)); cellLn = ln; }\n';
  function patchSolid(mat, kind, U) {
    mat.onBeforeCompile = function (sh) {
      for (var k in U) sh.uniforms[k] = U[k];
      var cell = kind === 'cell';
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;\nuniform float uCellF;\n' + SCAN_PARS)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat scanM = scanMask(); float cellLn = 0.0;\nif (scanM > 0.004 && scanDither() < smoothstep(0.22, 0.78, scanM)) discard;\n')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (cell ? CELL_GLSL : ''))
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + (cell ? 'roughnessFactor = mix(0.2, 0.55, cellLn);\n' : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float ring = smoothstep(0.02, 0.2, scanM) * (1.0 - smoothstep(0.2, 0.62, scanM)); totalEmissiveRadiance += ring * vec3(0.05, 0.55, 1.0) * 1.7; }\n');
    };
    mat.customProgramCacheKey = function () { return 'satscan-' + kind; };
  }
  // ghost pass: layered, double sided, only inside the scan
  var GVERT = 'varying vec3 vN; varying vec3 vV;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  var GFRAG = SCAN_PARS + 'uniform vec3 uCol; uniform float uFront; uniform float uBack; uniform float uGain; uniform float uT;\nvarying vec3 vN; varying vec3 vV;\n' +
    'void main(){\n float m = scanMask(); if (m < 0.01) discard;\n vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; float nv = abs(dot(n, normalize(vV)));\n' +
    ' float fres = pow(1.0 - nv, 2.2); vec3 fn = fwidth(n) * 1.0; float crease = clamp((length(fn) - 0.02) * 9.0, 0.0, 1.0);\n' +
    ' float face = gl_FrontFacing ? uFront : uBack; float hatch = 0.6 + 0.4 * sin(gl_FragCoord.y * 1.3 + uT * 3.0);\n' +
    ' vec3 cy = vec3(0.16, 0.74, 1.0); vec3 col = mix(uCol * 1.5, cy, 0.5) + cy * crease * 0.8;\n' +
    ' float edge = (fres * 0.10 + crease * 0.38) * hatch;\n' +
    ' float al = clamp(m * (face * uGain + edge), 0.0, 0.7); gl_FragColor = linearToOutputTexel(vec4(col * 1.2, al)); }';

  /* ---------- a procedural space room for reflections ---------- */
  function makeEnv(T, renderer) {
    var sc = new T.Scene();
    var geo = new T.SphereGeometry(40, 48, 24), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), i, y, c = new T.Color();
    for (i = 0; i < pos.count; i++) {
      y = pos.getY(i) / 40; // -1 (below: the Earth) .. 1 (above: space)
      if (y < 0) c.setRGB(0.02, 0.05, 0.12).lerp(new T.Color(0.20, 0.42, 0.95), Math.pow(-y, 0.7) * 0.9);
      else c.setRGB(0.02, 0.05, 0.12).lerp(new T.Color(0.004, 0.008, 0.02), Math.pow(y, 0.5));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    sc.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    function panel(w, h, color, p) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); sc.add(m); return m;
    }
    panel(9, 6, new T.Color(20, 17, 13), [-26, 22, 3]);            // the sun, a hard softbox up-left, a little behind the camera line
    panel(34, 4, new T.Color(1.4, 3.2, 8.5), [24, -4, -20]);       // cool rim strip behind, right
    panel(30, 9, new T.Color(.16, .22, .45), [2, 20, 16]);         // a soft sky-blue fill above the camera, so flat faces keep some form
    panel(22, 12, new T.Color(0.35, 0.8, 2.2), [0, -26, 6]);        // Earth bounce below
    panel(8, 8, new T.Color(5.5, 5.0, 4.6), [18, 18, -14]);        // a second small glint
    var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(sc, 0.025);
    pm.dispose(); geo.dispose();
    return rt.texture;
  }

  /* ---------- the plexus: '+' nodes and thin links drifting round the satellite ---------- */
  function crossTex(T) {
    var c = d.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.lineCap = 'butt'; x.beginPath(); x.moveTo(32, 6); x.lineTo(32, 58); x.moveTo(6, 32); x.lineTo(58, 32); x.stroke();
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 12); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  function Plexus(T, n) {
    var seed = 9, i; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    this.T = T; this.n = n; this.base = new Float32Array(n * 3); this.ph = new Float32Array(n * 4); this.off = new Float32Array(n * 3); this.pos = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      var a = rnd() * 6.2832, b = Math.acos(2 * rnd() - 1), r = .78 + rnd() * .34;
      this.base[i * 3] = Math.sin(b) * Math.cos(a) * 2.05 * r; this.base[i * 3 + 1] = Math.cos(b) * 1.35 * r; this.base[i * 3 + 2] = Math.sin(b) * Math.sin(a) * 1.1 * r;
      this.ph[i * 4] = rnd() * 6.28; this.ph[i * 4 + 1] = rnd() * 6.28; this.ph[i * 4 + 2] = rnd() * 6.28; this.ph[i * 4 + 3] = .5 + rnd();
    }
    this.group = new T.Group();
    var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    this.points = new T.Points(pg, new T.PointsMaterial({ map: crossTex(T), size: .34, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0xffffff, opacity: .95 }));
    this.points.frustumCulled = false;
    var maxL = n * 3; this.lp = new Float32Array(maxL * 6); this.lc = new Float32Array(maxL * 8); this.maxL = maxL;
    var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(this.lp, 3).setUsage(T.DynamicDrawUsage)); lg.setAttribute('color', new T.BufferAttribute(this.lc, 4).setUsage(T.DynamicDrawUsage));
    lg.setDrawRange(0, 0);
    this.lines = new T.LineSegments(lg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.lines.frustumCulled = false; this.group.add(this.lines); this.group.add(this.points);
    this.flag = new Uint8Array(n * n); this.v = new T.Vector3();
  }
  Plexus.prototype.update = function (t, dt, cam, mx, my, on) {
    var n = this.n, i, j, k, p = this.pos, B = this.base, P = this.ph, O = this.off, v = this.v, asp = cam.aspect, amp = reduce ? 0 : 1;
    var relax = Math.exp(-dt / .9);
    this.group.updateMatrixWorld(true);
    for (i = 0; i < n; i++) {
      var bx = B[i * 3], by = B[i * 3 + 1], bz = B[i * 3 + 2], s = P[i * 4 + 3];
      var x = bx + amp * .16 * Math.sin(t * .35 * s + P[i * 4]), y = by + amp * .12 * Math.sin(t * .3 * s + P[i * 4 + 1]), z = bz + amp * .14 * Math.sin(t * .28 * s + P[i * 4 + 2]);
      if (on) { // the cursor shoves nearby nodes, in screen space, and the web re-knits behind it
        v.set(x, y, z).applyMatrix4(this.group.matrixWorld).project(cam);
        var dx = (v.x - mx) * asp, dy = v.y - my, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < .42) { var f = (1 - dd / .42); f *= f * .045; var il = 1 / Math.max(dd, .02); O[i * 3] += dx * il * f * 5; O[i * 3 + 1] += dy * il * f * 5; O[i * 3 + 2] += (i % 2 ? 1 : -1) * f * 2; }
      }
      O[i * 3] *= relax; O[i * 3 + 1] *= relax; O[i * 3 + 2] *= relax;
      p[i * 3] = x + O[i * 3]; p[i * 3 + 1] = y + O[i * 3 + 1]; p[i * 3 + 2] = z + O[i * 3 + 2];
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    // links: each node to its nearest few, fading with distance
    var lp = this.lp, lc = this.lc, cnt = 0, fl = this.flag, D = .95; fl.fill(0);
    for (i = 0; i < n && cnt < this.maxL; i++) {
      var best = [-1, -1, -1], bd = [9, 9, 9];
      for (j = 0; j < n; j++) {
        if (j === i) continue;
        var ex = p[i * 3] - p[j * 3], ey = p[i * 3 + 1] - p[j * 3 + 1], ez = p[i * 3 + 2] - p[j * 3 + 2], q = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (q > D) continue;
        for (k = 0; k < 3; k++) if (q < bd[k]) { for (var m = 2; m > k; m--) { bd[m] = bd[m - 1]; best[m] = best[m - 1]; } bd[k] = q; best[k] = j; break; }
      }
      for (k = 0; k < 3; k++) {
        j = best[k]; if (j < 0) continue; var a = i < j ? i : j, b = i < j ? j : i; if (fl[a * n + b]) continue; fl[a * n + b] = 1;
        if (cnt >= this.maxL) break;
        var al = clamp(1 - bd[k] / D, 0, 1); al = Math.pow(al, .7) * .75;
        var o = cnt * 6, c4 = cnt * 8;
        lp[o] = p[a * 3]; lp[o + 1] = p[a * 3 + 1]; lp[o + 2] = p[a * 3 + 2]; lp[o + 3] = p[b * 3]; lp[o + 4] = p[b * 3 + 1]; lp[o + 5] = p[b * 3 + 2];
        lc[c4] = .85; lc[c4 + 1] = .93; lc[c4 + 2] = 1; lc[c4 + 3] = al; lc[c4 + 4] = .85; lc[c4 + 5] = .93; lc[c4 + 6] = 1; lc[c4 + 7] = al;
        cnt++;
      }
    }
    var g = this.lines.geometry; g.setDrawRange(0, cnt * 2); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  };

  /* ---------- the controller ---------- */
  function Sat(section, opts) {
    var me = this; opts = opts || {};
    this.cab = opts.mode === 'cabinet'; this.hero = !!opts.hero;
    this.sec = section; this.stage = this.cab ? opts.stage : section.querySelector('.ds-stage');
    this.hold = this.cab ? 0 : (parseFloat(section.getAttribute('data-hold')) || 0.2);
    this.frames = 0; // render count (a debug counter: it stops rising when the cabinet closes)
    this.THREE = null; this.renderer = null; this.cache = {}; this.cur = null;
    this.mob = innerWidth < 720;
    this.curKey = this.mob ? 'aim' : 'gpm';
    try { var qs = /[?&]sat=(gpm|trmm|aim)\b/.exec(location.search); if (qs) this.curKey = qs[1]; } catch (e) { /* default */ }
    this.arr = this.cab ? 1 : 0; this.u = 0; this.x = 0; this.alpha = this.cab ? 1 : 0; this.uiA = 0; this.near = false; this.on = false;
    this.ready = false; this.failed = false; this.loading = false; this.raf = 0; this.last = 0; this.t = 0; this.swap = 1;
    this.e = 0; this.eT = 0; this.zoom = .7; this.zoomT = .7; this.auto = false; // starts fully zoomed out (owner); + zooms in
    this.yaw = 0; this.pitch = 0; this.vyaw = 0; this.vpitch = 0; this.drag = null;
    this.mx = 0; this.my = 0; this.pmx = 0; this.pmy = 0; this.inside = false; this.W = 0; this.H = 0;
    this.act = 0; this.energy = 0; this.hx = .5; this.hy = .5; this.tx = .5; this.ty = .5; this.lastMove = -9; this.lastSample = 0; this.samples = []; this.lastCue = -9; this.prevInt = 0;
    this.sceneRoot = null;
    this._loop = function (n) { me.frame(n); };
    this.build(); this.bind();
  }

  /* ---------- DOM ---------- */
  Sat.prototype.build = function () {
    var me = this, st = this.stage, base = this.cab ? null : st.querySelector('canvas');
    var cv = el('canvas', 'sat-cv'); cv.setAttribute('aria-hidden', 'true'); this.cv = cv;
    var fx = el('div', 'sat-fx'); fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<i class="sat-glow"></i><i class="sat-halo"></i><i class="sat-streak"></i><i class="sat-gh g1"></i><i class="sat-gh g2"></i><i class="sat-gh g3"></i>';
    if (base) { base.parentNode.insertBefore(cv, base.nextSibling); base.parentNode.insertBefore(fx, cv); } else { st.appendChild(fx); st.appendChild(cv); }
    this.fx = fx; this.fxs = [].slice.call(fx.children);
    this.svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.svg.setAttribute('class', 'sat-lines'); this.svg.setAttribute('aria-hidden', 'true');
    st.appendChild(this.svg);
    this.pathAmb = d.createElementNS('http://www.w3.org/2000/svg', 'path'); this.svg.appendChild(this.pathAmb);
    this.dot = d.createElementNS('http://www.w3.org/2000/svg', 'circle'); this.dot.setAttribute('r', '4'); this.svg.appendChild(this.dot);
    var ui = el('div', 'sat-ui'); ui.setAttribute('role', 'group'); ui.setAttribute('aria-label', 'Satellite viewer');
    ui.innerHTML =
      '<div class="sat-tag" aria-hidden="true"><p class="cap"><span>[ <b data-s="n">GPM</b> ]</span> <em>+</em></p><p class="sat-tag-full" data-s="full"></p><p class="sat-tag-note" data-s="agy"></p></div>' +
      '<div class="sat-labs" aria-hidden="true"></div>' +
      '<div class="sat-title"><p class="cap"><span>[ NASA satellite ]</span> <em>+</em></p><h2 data-s="n">GPM</h2><p class="sat-sub" data-s="note"></p></div>' +
      '<div class="sat-sw" role="group" aria-label="Choose a satellite">' + ORDER.map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="false"><b>' + MODELS[k].name + '</b><small>' + MODELS[k].year + '</small></button>'; }).join('') + '</div>' +
      '<div class="sat-act"><button class="sat-ex" type="button" aria-pressed="false"><span class="sat-ex-i" aria-hidden="true"></span><b>Explode</b></button>' +
      '<button class="sat-xr" type="button" aria-pressed="false"><span class="sat-xr-i" aria-hidden="true"></span><b>X-ray</b></button>' +
      '<span class="sat-zm"><button class="sat-zo" type="button" aria-label="Zoom out">&minus;</button><button class="sat-zi" type="button" aria-label="Zoom in">+</button></span></div>' +
      '<p class="sat-hint" aria-live="polite"></p><p class="sat-credit">3D model: NASA 3D Resources</p>';
    st.appendChild(ui); this.ui = ui; this.tag = ui.querySelector('.sat-tag'); this.labs = ui.querySelector('.sat-labs');
    this.exBtn = ui.querySelector('.sat-ex'); this.xrBtn = ui.querySelector('.sat-xr'); this.hint = ui.querySelector('.sat-hint');
    this.swBtns = [].slice.call(ui.querySelectorAll('.sat-sw button'));
    this.gap = this.cab ? null : st.querySelector('.ds-ph[data-a="-.05"]');
    if (this.cab) { this.msg = el('p', 'sat-msg', 'The 3D models did not load. Check your connection and try again.'); this.msg.setAttribute('role', 'status'); st.appendChild(this.msg); }
    this.pathsL = []; this.setText();
    this.hint.textContent = touchy ? 'Drag a finger across the satellite to x-ray it' : 'Move your cursor over the satellite to x-ray it';
  };
  Sat.prototype.setText = function () {
    var m = MODELS[this.curKey], me = this;
    [].forEach.call(this.stage.querySelectorAll('[data-s]'), function (e) {
      var k = e.getAttribute('data-s'); e.textContent = k === 'n' ? m.name : k === 'full' ? m.full : k === 'agy' ? m.agency + ' · launched ' + m.year : m.note;
    });
    this.swBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === me.curKey ? 'true' : 'false'); });
  };

  /* ---------- events ---------- */
  Sat.prototype.bind = function () {
    var me = this, cv = this.cv;
    this.exBtn.addEventListener('click', function () { me.setExplode(me.eT > .5 ? 0 : 1); });
    this.xrBtn.addEventListener('click', function () { me.setAuto(!me.auto); });
    this.ui.querySelector('.sat-zi').addEventListener('click', function () { me.zoomT = clamp(me.zoomT * 1.22, .7, 1.9); me.kick(); });
    this.ui.querySelector('.sat-zo').addEventListener('click', function () { me.zoomT = clamp(me.zoomT / 1.22, .7, 1.9); me.kick(); });
    this.swBtns.forEach(function (b) { b.addEventListener('click', function () { me.switchTo(b.dataset.m); }); });
    // mouse: the scan follows the cursor wherever it is on the stage
    addEventListener('pointermove', function (e) { if (e.pointerType === 'touch' || (me.cab && !me.near)) return; me.pointer(e.clientX, e.clientY); }, { passive: true });
    d.addEventListener('pointerleave', function () { me.inside = false; });
    // touch: the finger scans while it drags over the stage (vertical drags are still the page's: the canvas is touch-action pan-y)
    function tp(e) { if (e.pointerType === 'touch') me.pointer(e.clientX, e.clientY, true); }
    cv.addEventListener('pointerdown', function (e) {
      tp(e);
      if (e.pointerType !== 'touch' && e.button === 0) { me.drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } cv.classList.add('grab'); me.vyaw = me.vpitch = 0; }
    });
    cv.addEventListener('pointermove', function (e) {
      tp(e);
      if (!me.drag || e.pointerType === 'touch') return;
      var dx = e.clientX - me.drag.x, dy = e.clientY - me.drag.y; me.drag.x = e.clientX; me.drag.y = e.clientY;
      me.yaw += dx * .006; me.pitch = clamp(me.pitch + dy * .005, -1.2, 1.2); me.vyaw = dx * .006 * 40; me.vpitch = dy * .005 * 40; me.kick();
    });
    function up() { me.drag = null; cv.classList.remove('grab'); if (reduce) me.vyaw = me.vpitch = 0; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    d.addEventListener('keydown', function (e) {
      if (!me.on || e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'x' || e.key === 'X') me.setAuto(!me.auto);
    });
    // when to run
    new ResizeObserver(function () { me.size(); me.kick(); }).observe(this.stage);
    d.addEventListener('visibilitychange', function () { if (d.hidden) me.stop(); else me.kick(); });
    if (this.cab && this.hero) {
      // hero: an always-open stage (the first screen of /lab/). It runs while it is on screen, the tab is visible and no cabinet is open over it
      this.vis = false; this.covered = false;
      var upd = function () { if (me.vis && !me.covered) me.open(); else me.close(); };
      if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { me.vis = en[en.length - 1].isIntersecting; upd(); }).observe(this.stage);
      else { this.vis = true; upd(); }
      d.addEventListener('play-view', function (e) { me.covered = !!(e.detail && e.detail.id); upd(); });
      return;
    }
    if (this.cab) {
      // cabinet: no scroll path. play.js announces the open view; we run only while ours is the one showing
      d.addEventListener('play-view', function (e) { if (e.detail && e.detail.id === 'sat') me.open(); else me.close(); });
      return;
    }
    new IntersectionObserver(function (en) { me.near = en[0].isIntersecting; me.check(); }, { rootMargin: '10% 0px' }).observe(this.sec);
    addEventListener('scroll', function () { me.readScroll(); if (!me.ready && !me.loading && !me.failed && me.sec.getBoundingClientRect().top < innerHeight * 1.6) me.preload(); me.check(); }, { passive: true });
    this.readScroll();
    if (this.sec.getBoundingClientRect().top < innerHeight * 1.6) this.preload();
  };
  // cabinet open / close: open loads on first use and starts the loop, close stops it (the renderer is released a few seconds later)
  Sat.prototype.open = function () {
    this.near = true; this.size();
    if (this.failed && !(navigator.connection && navigator.connection.saveData)) { this.failed = false; this.stage.classList.remove('sat-failed'); }
    if (!this.ready) this.preload(); // a no-op if it is already loading
    this.check(); this.kick();
  };
  Sat.prototype.close = function () {
    if (!this.near) return;
    this.near = false; this.check(); this.stop();
  };
  Sat.prototype.pointer = function (cx, cy, touch) {
    var r = this.stage.getBoundingClientRect(); if (r.height < 2) return;
    var x = (cx - r.left) / r.width, y = (cy - r.top) / r.height;
    this.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    this.pmx = (x - .5) * 2; this.pmy = (y - .5) * 2;
    if (!this.inside || this.alpha < .3 || this.auto) { this.kick(); return; }
    if (touch && !this.moved) this.hx = x, this.hy = 1 - y;
    this.tx = x; this.ty = 1 - y; this.lastMove = this.t; this.moved = true; this.kick();
  };
  Sat.prototype.setAuto = function (on) {
    this.auto = on; this.xrBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); this.xrBtn.querySelector('b').textContent = on ? 'X-ray on' : 'X-ray';
    if (on) { this.cueX(true); this.hint.classList.add('gone'); } this.kick();
  };
  Sat.prototype.cueX = function (force) { if (force || this.t - this.lastCue > 2.2) { this.lastCue = this.t; cue('sat-xray'); } };
  Sat.prototype.setExplode = function (v) {
    var was = this.eT; this.eT = v; this.exBtn.setAttribute('aria-pressed', v > .5 ? 'true' : 'false'); this.exBtn.querySelector('b').textContent = v > .5 ? 'Assemble' : 'Explode';
    if (v > .5 && was <= .5) cue('sat-explode'); else if (v <= .5 && was > .5) cue('sat-assemble'); this.kick();
  };
  Sat.prototype.readScroll = function () {
    if (this.cab) return; // the cabinet is always fully in: arr 1, x 0, alpha 1
    var r = this.sec.getBoundingClientRect(), vh = innerHeight, span = Math.max(1, r.height - vh);
    this.arr = clamp(1 - r.top / vh, 0, 1);
    this.u = (-r.top) / Math.max(1, this.hold * span);
    this.x = sstep(.5, 1.12, this.u);
    this.alpha = sstep(.12, .62, this.arr) * (1 - sstep(.7, 1, this.x)) * (this.u > 1.3 ? 0 : 1);
  };
  Sat.prototype.running = function () { return this.ready && this.near && !d.hidden && this.alpha > .004; };
  Sat.prototype.check = function () {
    var onNow = this.alpha > .35 && (!this.cab || this.near); if (onNow !== this.on) { this.on = onNow; cue(onNow ? 'sat-on' : 'sat-off'); if (!onNow) { this.act = 0; this.samples.length = 0; if (this.auto) this.setAuto(false); if (this.eT > 0) this.setExplode(0); } }
    var a = this.alpha, hide = a < .004 || (this.cab && !this.near);
    this.ui.style.visibility = hide ? 'hidden' : 'visible'; this.fx.style.visibility = hide ? 'hidden' : 'visible'; this.svg.style.visibility = hide ? 'hidden' : 'visible';
    this.cv.style.visibility = hide ? 'hidden' : 'visible'; this.cv.style.pointerEvents = hide ? 'none' : a > .5 ? 'auto' : 'none';
    this.ui.style.pointerEvents = a > .5 ? '' : 'none';
    this.stage.classList.toggle('sat-hero', !hide);
    if (this.gap && !this.failed) this.gap.style.setProperty('--sat-gap', (1 - sstep(.05, .5, a)).toFixed(3));
    if (this.running()) { this.kick(); } else this.stop();
  };
  Sat.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0;
    var me = this; if (this.renderer && !this.relT) this.relT = setTimeout(function () { me.relT = 0; if (!me.running()) me.release(); }, 4000);
  };
  Sat.prototype.release = function () {
    if (!this.renderer) return;
    try { this.renderer.dispose(); var ext = this.renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) { /* gone */ }
    this.renderer = null; this.env = null; this.scene = null; this.plex = null;
    // a lost context cannot be reused: swap in a fresh canvas; models re-attach to a new scene when we come back
    var n = this.cv.cloneNode(false); this.cv.parentNode.replaceChild(n, this.cv); this.cv = n; this.rebindCanvas();
    var me = this; Object.keys(this.cache).forEach(function (k) { me.cache[k].items.forEach(function (it) { it.solid = null; it.ghost = null; it.group = null; }); me.cache[k].mats = null; });
  };
  Sat.prototype.rebindCanvas = function () {
    // the listeners are on the old canvas: bind the same handlers to the new one (only pointerdown/move/up matter)
    var me = this, cv = this.cv;
    function tp(e) { if (e.pointerType === 'touch') me.pointer(e.clientX, e.clientY, true); }
    cv.addEventListener('pointerdown', function (e) { tp(e); if (e.pointerType !== 'touch' && e.button === 0) { me.drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } cv.classList.add('grab'); } });
    cv.addEventListener('pointermove', function (e) {
      tp(e); if (!me.drag || e.pointerType === 'touch') return;
      var dx = e.clientX - me.drag.x, dy = e.clientY - me.drag.y; me.drag.x = e.clientX; me.drag.y = e.clientY; me.yaw += dx * .006; me.pitch = clamp(me.pitch + dy * .005, -1.2, 1.2); me.kick();
    });
    function up() { me.drag = null; cv.classList.remove('grab'); } cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  };

  /* ---------- load ---------- */
  Sat.prototype.preload = function () {
    if (this.loading || this.ready || this.failed) return;
    if (navigator.connection && navigator.connection.saveData) { this.failed = true; this.stage.classList.add('sat-failed'); return; }
    this.boot(this.curKey);
  };
  Sat.prototype.boot = function (key) {
    var me = this; if (this.loading) return; this.loading = true; this.stage.classList.add('sat-loading');
    return loadLibs().then(function () { me.THREE = window.THREE; return me.fetchModel(key); }).then(function (m) {
      me.loading = false; me.stage.classList.remove('sat-loading'); me.ready = true; me.useModel(key, m); me.readScroll(); me.check();
    }).catch(function (e) {
      me.loading = false; me.failed = true; me.stage.classList.remove('sat-loading'); me.stage.classList.add('sat-failed'); if (me.gap) me.gap.style.removeProperty('--sat-gap'); if (window.console) console.warn('satellite:', e && e.message);
    });
  };
  Sat.prototype.fetchModel = function (key) {
    var me = this, T = this.THREE;
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    return new Promise(function (res, rej) {
      if (!me.gltf) {
        var dr = new T.DRACOLoader(); dr.setDecoderPath(CDN + 'libs/draco/gltf/');
        me.gltf = new T.GLTFLoader(); me.gltf.setDRACOLoader(dr);
      }
      me.gltf.load(BASE + MODELS[key].file, function (g) { me.cache[key] = me.parts(g.scene, key); res(me.cache[key]); }, undefined, function () { rej(new Error('model ' + key)); });
    });
  };
  // Draco hands back quantised (normalised integer) attributes; transforms need real floats
  function floaty(g, T) {
    ['position', 'normal'].forEach(function (n) {
      var a = g.attributes[n]; if (!a || a.array instanceof Float32Array) return;
      var f = new Float32Array(a.count * 3), i; for (i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(n, new T.BufferAttribute(f, 3));
    });
    ['uv', 'uv2'].forEach(function (n) { if (g.attributes[n]) g.deleteAttribute(n); });
  }
  // turn a loaded scene into parts in one normalised space (radius 1, centred), each with its own box and explode offset.
  // The glb's own root scale is baked into the geometry first (matrixWorld), then the whole thing is normalised.
  Sat.prototype.parts = function (scene, key) {
    var T = this.THREE; scene.updateMatrixWorld(true);
    var items = [], box = new T.Box3(), i;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      var g = o.geometry.clone(); floaty(g, T); if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); box.union(g.boundingBox);
      items.push({ geo: g, mat: o.material, mesh: o.name || '', matName: (o.material && o.material.name) || '' });
    });
    var c = box.getCenter(new T.Vector3()), s = 1 / (box.getSize(new T.Vector3()).length() / 2);
    var GEN = /^(Fake|Mesh\d*|Object|Group|Cube|Scene|BrowserInput|\/Browser)/i;
    var tris = 0;
    items.forEach(function (it, n) {
      it.geo.translate(-c.x, -c.y, -c.z); it.geo.scale(s, s, s); it.geo.computeBoundingBox(); it.geo.computeBoundingSphere();
      it.box = it.geo.boundingBox.clone(); it.center = it.box.getCenter(new T.Vector3()); it.diag = it.box.getSize(new T.Vector3()).length();
      it.label = GEN.test(it.mesh) || !it.mesh ? cleanName(it.matName, true) : cleanName(it.mesh, false); it.n = n;
      tris += (it.geo.index ? it.geo.index.count : it.geo.attributes.position.count) / 3;
      var len = it.center.length(), dir = it.center.clone();
      if (len < .09) { var a = (n * 2.399963) % 6.2832, y = ((n * .618) % 1) * 2 - 1, r = Math.sqrt(1 - y * y); dir.set(Math.cos(a) * r, y, Math.sin(a) * r); len = .09; }
      it.off = dir.normalize().multiplyScalar(.34 + .8 * Math.min(1, len));
    });
    var seen = {}, sorted = items.slice().sort(function (a, b) { return b.diag - a.diag; }), lab = [];
    sorted.forEach(function (it) { if (!seen[it.label] && it.diag > .06) { seen[it.label] = 1; lab.push(it); } });
    return { key: key, items: items, labeled: lab, tris: tris };
  };

  /* ---------- three.js scene ---------- */
  Sat.prototype.ensureRenderer = function () {
    if (this.renderer) return true;
    var T = this.THREE; if (!T) return false;
    var r;
    try { r = new T.WebGLRenderer({ canvas: this.cv, alpha: true, antialias: this.W >= 720, powerPreference: 'high-performance' }); } catch (e) { this.failed = true; this.stage.classList.add('sat-failed'); return false; }
    r.setClearColor(0x000000, 0); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = .95; r.physicallyCorrectLights = true;
    this.renderer = r;
    var sc = this.scene = new T.Scene(), cam = this.cam = new T.PerspectiveCamera(30, 1, .1, 60); cam.position.set(0, 0, 6.6);
    try { this.env = makeEnv(T, r); sc.environment = this.env; } catch (e) { /* lights alone */ }
    var key = new T.DirectionalLight(0xfff0dc, 3.0); key.position.set(-3.2, 3.4, 4); sc.add(key);
    var rim = new T.DirectionalLight(0x5aa8ff, 2.6); rim.position.set(4.2, -.6, -3.4); sc.add(rim);
    var bounce = new T.DirectionalLight(0x3f78ff, .6); bounce.position.set(-.5, -4, 2); sc.add(bounce);
    sc.add(new T.HemisphereLight(0x7f9fe0, 0x050c20, .12));
    this.pivot = new T.Group(); sc.add(this.pivot); this.holder = new T.Group(); this.pivot.add(this.holder);
    this.eul = new T.Euler(0, 0, 0, 'YXZ'); this.v3 = new T.Vector3(); this.v4 = new T.Vector3();
    // shared uniforms: every patched material and every ghost reads these same objects
    var tr = []; for (var i = 0; i < TRAIL; i++) tr.push(new T.Vector4(0, 0, 0, 0));
    this.U = { uTrail: { value: tr }, uRes: { value: new T.Vector2(2, 2) }, uSoft: { value: .5 }, uEdge: { value: .35 }, uTime: { value: 0 }, uOn: { value: 0 }, uCellF: { value: 34 } };
    this.plex = new Plexus(T, this.mob ? 34 : 56); sc.add(this.plex.group);
    this.size();
    if (this.cur) this.attach(this.cur);
    return true;
  };
  Sat.prototype.useModel = function (key, m) {
    this.curKey = key; this.cur = m; this.setText();
    if (this.renderer || this.ensureRenderer()) this.attach(m);
    this.buildLabels(m); this.swap = reduce ? 1 : 0;
  };
  Sat.prototype.matsFor = function (m) {
    var T = this.THREE, U = this.U, me = this;
    if (m.mats && m.matsScene === this.scene) return m.mats;
    var out = {};
    m.items.forEach(function (it) {
      var src = it.mat, id = src.uuid; if (out[id]) return;
      if (src.color && !src.userData.base) src.userData.base = src.color.clone();
      var kind = classify(src.name), mat = src, col = src.userData.base ? src.userData.base.clone() : new T.Color(1, 1, 1);
      mat.envMapIntensity = .5;
      if (kind === 'cell') { mat.metalness = .8; mat.roughness = .3; mat.envMapIntensity = 1.0; }
      else if (kind === 'panel') { mat.metalness = .25; mat.roughness = .6; col.multiplyScalar(.85); }
      else if (kind === 'gold') { mat.metalness = .95; mat.roughness = .34; mat.envMapIntensity = 1.1; col.lerp(new T.Color(1, .74, .32), .45); }
      else if (kind === 'metal') { mat.metalness = .9; mat.roughness = .3; mat.envMapIntensity = 1.0; col.lerp(new T.Color(.48, .58, .9), .4).multiplyScalar(.72); }
      else if (kind === 'dark') { mat.metalness = .55; mat.roughness = .42; col.multiplyScalar(.9); }
      else { mat.metalness = .3; mat.roughness = .52; }
      if (mat.color) mat.color.copy(col);
      patchSolid(mat, kind, U); mat.needsUpdate = true;
      var gm = new T.ShaderMaterial({
        uniforms: { uTrail: U.uTrail, uRes: U.uRes, uSoft: U.uSoft, uEdge: U.uEdge, uTime: U.uTime, uOn: U.uOn, uCol: { value: new T.Color(col.r, col.g, col.b) }, uFront: { value: .08 }, uBack: { value: .2 }, uGain: { value: m.tris > 200000 ? .55 : 1 }, uT: { value: 0 } },
        vertexShader: GVERT, fragmentShader: GFRAG, transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide, extensions: { derivatives: true }
      });
      out[id] = { solid: mat, ghost: gm };
    });
    m.mats = out; m.matsScene = this.scene; return out;
  };
  Sat.prototype.attach = function (m) {
    var T = this.THREE, h = this.holder, mats = this.matsFor(m);
    while (h.children.length) h.remove(h.children[0]);
    m.items.forEach(function (it) {
      var mm = mats[it.mat.uuid];
      it.solid = new T.Mesh(it.geo, mm.solid); it.solid.frustumCulled = false;
      it.ghost = new T.Mesh(it.geo, mm.ghost); it.ghost.frustumCulled = false; it.ghost.renderOrder = 10; it.ghost.visible = false;
      it.group = new T.Group(); it.group.add(it.solid); it.group.add(it.ghost); h.add(it.group);
    });
    this.ghostOn = false;
  };
  Sat.prototype.switchTo = function (key) {
    if (key === this.curKey && this.cur) return; var me = this;
    this.stage.classList.add('sat-loading'); this.curKey = key; this.setText(); if (this.eT > 0) this.setExplode(0);
    this.boot2(key).then(function (m) { me.stage.classList.remove('sat-loading'); if (m) { me.useModel(key, m); } me.kick(); });
  };
  Sat.prototype.boot2 = function (key) { var me = this; return loadLibs().then(function () { me.THREE = window.THREE; return me.fetchModel(key); }).catch(function () { return null; }); };

  Sat.prototype.size = function () {
    var r = this.stage.getBoundingClientRect(); this.W = Math.max(2, r.width); this.H = Math.max(2, r.height); this.mob = this.W < 720;
    if (!this.renderer) return;
    var dpr = Math.min(devicePixelRatio || 1, this.mob ? 1.5 : 1.75); this.dpr = dpr;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(this.W, this.H, false); this.cam.aspect = this.W / this.H; this.cam.updateProjectionMatrix();
    this.U.uRes.value.set(Math.round(this.W * dpr), Math.round(this.H * dpr));
  };
  Sat.prototype.kick = function () { if (!this.raf && this.running()) { this.last = 0; this.raf = requestAnimationFrame(this._loop); } };

  /* ---------- the scan: head, speed, trail ---------- */
  Sat.prototype.scan = function (dt) {
    var T = this.THREE, U = this.U, W = this.W, H = this.H, i;
    var gate = 1 - sstep(.35, .8, this.x), tr = U.uTrail.value;
    var px, py;
    if (this.auto) { // the X-ray button: a big circle sweeps the satellite on its own
      var s = this.scr, tt = this.t * (reduce ? .35 : .8);
      px = clamp(s.x / W + Math.sin(tt) * .3 * (this.mob ? .8 : 1), .05, .95); py = clamp(1 - (s.y / H) + Math.sin(tt * 1.7 + 1) * .2, .05, .95);
      this.tx = px; this.ty = py; this.lastMove = this.t; this.moved = true;
    }
    var k = reduce ? 1 : 1 - Math.exp(-dt / .055);
    var ox = this.hx, oy = this.hy; this.hx += (this.tx - this.hx) * k; this.hy += (this.ty - this.hy) * k;
    var spd = Math.hypot((this.hx - ox), (this.hy - oy) * H / W) / Math.max(dt, .001); // screen widths per second
    var sp = this.auto ? .5 : clamp(spd / 1.2, 0, 1), moving = this.t - this.lastMove < .12 && this.inside || this.auto || this.touchHold;
    if (!reduce) {
      var tau = sp > this.energy ? .35 : 1.1; this.energy += (sp - this.energy) * (1 - Math.exp(-dt / tau));
    } else this.energy = 0;
    this.act += moving ? Math.min(1, dt / .12) : -dt / 1.0; this.act = clamp(this.act, 0, 1);
    var strength = this.act * this.act * (3 - 2 * this.act) * gate;
    var base = (this.mob ? .13 : .11) * (this.auto ? 1.35 : 1), rad = base * (1 + (reduce ? 0 : .9) * this.energy) * (.5 + .5 * this.act);
    if (strength > .5 && this.prevInt <= .5) this.cueX(false); this.prevInt = strength;
    // samples: a comet tail of past heads, fading over about 0.7 s
    if (!reduce && this.t - this.lastSample > .045 && strength > .02) { this.lastSample = this.t; this.samples.unshift({ x: this.hx, y: this.hy, s: strength, r: rad, t: this.t }); }
    while (this.samples.length && (this.t - this.samples[this.samples.length - 1].t > .7 || this.samples.length > TRAIL - 1)) this.samples.pop();
    tr[0].set(this.hx, this.hy, strength, rad);
    for (i = 1; i < TRAIL; i++) {
      var sm = this.samples[i - 1];
      if (!sm) { tr[i].set(0, 0, 0, 0); continue; }
      var age = (this.t - sm.t) / .7, f = clamp(1 - age, 0, 1);
      tr[i].set(sm.x, sm.y, sm.s * f * f * (3 - 2 * f), sm.r * (1 - .35 * age));
    }
    var on = strength > .01;
    U.uOn.value = on ? 1 : 0; U.uTime.value = this.t;
    if (on !== this.ghostOn) { this.ghostOn = on; var items = this.cur.items; for (i = 0; i < items.length; i++) items[i].ghost.visible = on; }
    if (on) { var m = this.cur.mats; for (var q in m) m[q].ghost.uniforms.uT.value = this.t; if (strength > .1 && this.hint) this.hint.classList.add('gone'); }
    this.stage.classList.toggle('sat-scan', on);
  };

  /* ---------- frame ---------- */
  Sat.prototype.frame = function (now) {
    this.raf = 0; if (!this.running()) return;
    if (!this.renderer && !this.ensureRenderer()) return;
    var dt = this.last ? Math.min(.06, (now - this.last) / 1000) : .016; this.last = now; this.t += dt;
    this.readScroll();
    var a = this.alpha, T = this.THREE, W = this.W, H = this.H;
    // UI and canvas fade
    this.uiA = sstep(.4, .95, this.arr) * (1 - sstep(0, .4, this.x));
    this.cv.style.opacity = (a * (this.swap < 1 ? this.swap : 1)).toFixed(3);
    this.ui.style.opacity = this.uiA.toFixed(3); this.fx.style.opacity = a.toFixed(3); this.svg.style.opacity = this.uiA.toFixed(3);
    this.ui.style.pointerEvents = this.uiA > .5 ? '' : 'none'; this.cv.style.pointerEvents = a > .5 ? 'auto' : 'none';
    if (this.gap) this.gap.style.setProperty('--sat-gap', (1 - sstep(.05, .5, a)).toFixed(3));
    var onNow = a > .35; if (onNow !== this.on) this.check();
    var ke = reduce ? 1 : 1 - Math.exp(-dt * 3.6), kz = reduce ? 1 : 1 - Math.exp(-dt * 5);
    this.e += (this.eT - this.e) * ke; if (Math.abs(this.eT - this.e) < .002) this.e = this.eT;
    this.zoom += (this.zoomT - this.zoom) * kz;
    if (this.swap < 1) this.swap = Math.min(1, this.swap + dt * 2.6);
    var km = reduce ? 1 : 1 - Math.exp(-dt * 3); this.mx += (this.pmx - this.mx) * km; this.my += (this.pmy - this.my) * km;
    // pose: a slow sway, mouse parallax, drag with inertia
    if (!this.drag) { this.vyaw *= Math.exp(-dt * 2.4); this.vpitch *= Math.exp(-dt * 2.4); this.yaw += this.vyaw * dt; this.pitch = clamp(this.pitch + this.vpitch * dt, -1.2, 1.2); this.pitch *= Math.exp(-dt * .25); }
    var sw = reduce ? 0 : this.t, ex = this.x;
    this.eul.set(.22 + this.pitch + Math.sin(sw * .21) * .07 + this.my * .09 + ex * .5, -.62 + Math.PI + this.yaw + Math.sin(sw * .16) * .45 + this.mx * .18 - ex * .9, .42 + Math.sin(sw * .13) * .05, 'YXZ');
    this.pivot.quaternion.setFromEuler(this.eul);
    this.cam.position.x = -this.mx * .16; this.cam.position.y = this.my * .1; this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld(true);
    this.layout();
    this.scan(dt);
    // explode
    var e = this.e, items = this.cur.items, i; for (i = 0; i < items.length; i++) { var o = items[i].off; items[i].group.position.set(o.x * e, o.y * e, o.z * e); }
    // plexus follows the satellite's place (not its turning)
    this.plex.group.position.copy(this.pivot.position); this.plex.group.scale.setScalar(this.pivot.scale.x * (1 + .9 * this.x * this.x));
    this.plex.points.material.opacity = .95 * a * (1 - this.x * .6); this.plex.lines.material.opacity = a;
    this.plex.update(this.t, dt, this.cam, (this.inside ? this.pmx : 9), (this.inside ? -this.pmy : 9), !reduce);
    this.renderer.render(this.scene, this.cam); this.frames++;
    this.overlay();
    this.raf = requestAnimationFrame(this._loop);
  };

  // where the model sits: big, a little right of centre on desktop; flying past the camera on the way out
  Sat.prototype.layout = function () {
    var W = this.W, H = this.H, mob = this.mob, cam = this.cam, hh = Math.tan(cam.fov * Math.PI / 360) * cam.position.z, hw = hh * cam.aspect;
    var rr0 = mob ? Math.min(W * .9, H * .46) : Math.min(W * .47, H * .86);
    var ar = sstep(.12, 1, this.arr), x = this.x;
    var nx = (mob ? 0 : .17) + (-1.5 * x * x) - (1 - ar) * .35, ny = (mob ? .36 : .12) + .75 * x * x - (1 - ar) * .55;
    var bob = reduce ? 0 : Math.sin(this.t * .55) * .012, ez = 1 / (1 + .42 * this.e), z = this.zoom;
    var rr = rr0 * (.72 + .28 * ar) * (1 + 2.1 * x * x) * z * ez * (.55 + .45 * this.swap);
    var sc = rr / (H / 2) * hh;
    this.pivot.position.set(nx * hw, (ny + bob) * hh, 0); this.pivot.scale.setScalar(sc); this.pivot.updateMatrixWorld(true);
    this.scr = { x: (nx * .5 + .5) * W, y: (.5 - (ny + bob) * .5) * H, r: rr };
  };

  Sat.prototype.buildLabels = function (m) {
    var me = this, n = this.W < 720 ? 5 : 8; this.labs.innerHTML = ''; while (this.pathsL.length) { this.svg.removeChild(this.pathsL.pop()); }
    this.lab = m.labeled.slice(0, n).map(function (it, i) {
      var e = el('span', 'sat-lab', '<i>' + ('0' + (i + 1)).slice(-2) + '</i>' + it.label); me.labs.appendChild(e);
      var p = d.createElementNS('http://www.w3.org/2000/svg', 'path'); me.svg.appendChild(p); me.pathsL.push(p);
      return { it: it, e: e, p: p };
    });
  };
  // DOM: the flare, the tag that follows the model, the part callouts and their leader lines
  Sat.prototype.overlay = function () {
    var W = this.W, H = this.H, s = this.scr, mob = this.mob, e = this.e, i, fs = this.fxs, ua = this.uiA;
    // lens flare: a glint on the sun side of the model, ghosts mirrored through the centre of the frame
    var gx = s.x - s.r * .34, gy = s.y - s.r * .3, cx = W / 2, cy = H / 2, vx = cx - gx, vy = cy - gy;
    function put(n, x, y, sc) { fs[n].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + sc.toFixed(3) + ')'; }
    var hs = Math.max(W, H) / 1000;
    put(0, s.x, s.y + s.r * .1, Math.max(.6, s.r / 420)); put(1, gx, gy, hs * 1.0); put(2, gx, gy, hs * 1.0);
    put(3, gx + vx * .7, gy + vy * .7, hs * .9); put(4, gx + vx * 1.25, gy + vy * 1.25, hs * 1.4); put(5, gx + vx * 1.85, gy + vy * 1.85, hs * .7);
    // tag
    var tw = mob ? 150 : 250, tx = mob ? 20 : clamp(s.x + s.r * .34, 40, W - tw - 28), ty = mob ? H * .06 + 96 : clamp(s.y - s.r * .5, 118, H * .3);
    this.tag.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
    var tag = 1 - e; this.tag.style.opacity = tag.toFixed(3);
    var cxp = s.x + s.r * .02, cyp = s.y - s.r * .04;
    this.pathAmb.setAttribute('d', tag > .02 ? 'M' + cxp.toFixed(1) + ',' + cyp.toFixed(1) + 'L' + (tx - 8).toFixed(1) + ',' + (ty + 12).toFixed(1) : '');
    this.pathAmb.style.opacity = (tag * .8).toFixed(3); this.dot.setAttribute('cx', cxp.toFixed(1)); this.dot.setAttribute('cy', cyp.toFixed(1)); this.dot.style.opacity = tag.toFixed(3);
    // callouts
    var labs = this.lab || [], vis = e > .03;
    this.labs.style.opacity = vis ? Math.min(1, (e - .03) * 4).toFixed(3) : 0;
    if (!vis) { for (i = 0; i < labs.length; i++) labs[i].p.setAttribute('d', ''); return; }
    var cam = this.cam, v = this.v3, L = [], R = [], lw = mob ? 118 : 178, gap = mob ? 25 : 32, top = mob ? 120 : 130, bot = mob ? H * .42 : H * .5;
    for (i = 0; i < labs.length; i++) {
      var b = labs[i], c = b.it.center.clone().addScaledVector(b.it.off, e); v.copy(c).applyMatrix4(this.pivot.matrixWorld).project(cam);
      b.px = (v.x * .5 + .5) * W; b.py = (-v.y * .5 + .5) * H; (b.px > s.x ? R : L).push(b);
    }
    var leftMin = mob ? 14 : 24;
    if (mob) { R = R.concat(L); L = []; }
    function place(arr, right) {
      arr.sort(function (p, q) { return p.py - q.py; });
      var y = top - gap; arr.forEach(function (b) { y = Math.max(clamp(b.py, top, bot), y + gap); b.ly = y; });
      var over = y - bot; if (over > 0) arr.forEach(function (b) { b.ly -= over; });
      var colX = right ? W - (mob ? 14 : 36) - lw : leftMin + lw;
      arr.forEach(function (b) {
        var ex2 = right ? colX - 10 : colX + 10;
        b.e.style.transform = 'translate3d(' + (right ? colX : colX - lw) + 'px,' + (b.ly - 12) + 'px,0)'; b.e.classList.toggle('l', !right); b.e.style.width = lw + 'px';
        var k1 = right ? Math.max(b.px + 12, ex2 - 26) : Math.min(b.px - 12, ex2 + 26);
        b.p.setAttribute('d', 'M' + b.px.toFixed(1) + ',' + b.py.toFixed(1) + 'L' + k1.toFixed(1) + ',' + b.ly.toFixed(1) + 'L' + ex2.toFixed(1) + ',' + b.ly.toFixed(1));
        b.p.style.opacity = Math.min(1, (e - .03) * 4).toFixed(3);
      });
    }
    place(L, false); place(R, true);
  };

  function boot() {
    var hero = d.querySelector('[data-sat-hero]');
    if (hero) { window.SatelliteStage = new Sat(null, { mode: 'cabinet', stage: hero, hero: true }); return; }
    var host = d.getElementById('sat-stage');
    if (host) { window.SatelliteStage = new Sat(null, { mode: 'cabinet', stage: host }); return; }
    var sec = d.getElementById('descent'); if (!sec || !sec.querySelector('.ds-stage')) return;
    window.SatelliteStage = new Sat(sec);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
