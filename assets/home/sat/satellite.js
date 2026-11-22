/* Satellite: a real NASA satellite floating over the Earth limb in the orbit chapter (#descent), and an inspector.
 *
 * Models: GPM, TRMM and AIM from NASA 3D Resources (free to use; credited on screen). Draco-compressed glb, loaded only when the
 * orbit chapter is near (three.js r128 + GLTFLoader + DRACOLoader from jsdelivr, same version as the page's three.js).
 *   - its own transparent WebGL canvas over the descent canvas, sized to the sticky stage; paused off screen, the GL context
 *     released when the chapter is well past
 *   - "Inspect the satellite": the model comes forward, drag rotates (inertia), wheel / pinch zooms, Esc or Close leaves.
 *     Page scroll is never locked: the wheel only zooms while the pointer is on the model and the zoom has room.
 *   - hover (or the X-ray button, for touch) turns the materials to an x-ray: additive fresnel rim, faint wireframe, a scan line
 *   - Explode / Assemble (button and slider): every part is pushed out along its centroid direction, with leader lines and labels
 * Cues for sound: sat-on, sat-off, sat-xray, sat-explode, sat-assemble (document 'sfx-cue').
 * Reduced motion: no tumble, no inertia, instant transitions.
 */
(function () {
  'use strict';
  var d = document, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE = '/assets/home/sat/';
  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
  var LIBS = [
    [CDN + 'loaders/GLTFLoader.js', 'sha384-fljlqkjWlmSFjkESkQvm77heIZpoWmXEOzlCA7kOpGUH+95Zk0yGfQieWM2q136E'],
    [CDN + 'loaders/DRACOLoader.js', 'sha384-TNRcLasZnnfIJJskDY5XlrfmsKTjBSy98MtyLuX+3rQWRbpSQvtFIdikNpcOh3SN']
  ];
  var MODELS = {
    gpm: { file: 'gpm.glb', name: 'GPM', full: 'Global Precipitation Measurement', note: 'NASA + JAXA Core Observatory · launched 2014 · rain and snow, from orbit' },
    trmm: { file: 'trmm.glb', name: 'TRMM', full: 'Tropical Rainfall Measuring Mission', note: 'NASA + JAXA · launched 1997 · the tropics’ rain, for 17 years' },
    aim: { file: 'aim.glb', name: 'AIM', full: 'Aeronomy of Ice in the Mesosphere', note: 'NASA · launched 2007 · the highest clouds on Earth' }
  };
  var ORDER = ['gpm', 'trmm', 'aim'];

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
    var s = String(raw || '').replace(/^TRMM\s*\[|\]$/g, '').replace(/^Pivot-/, '');
    if (rules) {
      for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(s)) return RULES[i][1];
    }
    s = s.replace(/\.\d+$/, '').replace(/[_\-\/]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/\b(Surfaces|Parts)\b/i, function (m) { return m.toLowerCase(); });
    if (!s) return 'Part';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function loadScript(src, integrity) {
    return new Promise(function (res, rej) {
      var s = d.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; if (integrity) s.integrity = integrity;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('script ' + src)); };
      d.head.appendChild(s);
    });
  }
  var libsJob = null;
  function loadLibs() {
    if (libsJob) return libsJob;
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

  /* ---------- the x-ray shaders ---------- */
  var XVERT = 'varying vec3 vN; varying vec3 vV; varying vec3 vP;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }';
  var XFRAG = 'uniform float uX; uniform float uT; uniform float uScan; uniform float uW; uniform vec3 uCol;\nvarying vec3 vN; varying vec3 vV; varying vec3 vP;\n' +
    'void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float dy = (vP.y - uScan) / uW; float scan = exp(-dy * dy); float hatch = 0.55 + 0.45 * sin(vP.y * 140.0 - uT * 3.0);\n' +
    'vec3 c = uCol * (f * 1.25 + 0.05) + vec3(0.55, 0.92, 1.0) * scan * (0.55 + 0.45 * hatch) * 1.1; gl_FragColor = vec4(c * uX, 1.0); }';

  function Sat(section) {
    var me = this;
    this.sec = section; this.stage = section.querySelector('.ds-stage');
    this.THREE = null; this.renderer = null; this.cache = {}; this.cur = null; this.curKey = 'gpm';
    this.open = false; this.k = 0; this.kT = 0; this.e = 0; this.eT = 0; this.x = 0; this.xT = 0; this.xForce = false; this.hover = false; this.hoverPart = -1;
    this.zoom = 1; this.zoomT = 1; this.vx = 0; this.vy = 0; this.drag = null; this.ptrs = {}; this.pinch0 = 0; this.idle = 0;
    this.p = 0; this.near = false; this.far = false; this.raf = 0; this.last = 0; this.lastDraw = 0; this.t = 0; this.alpha = 0; this.ready = false; this.failed = false;
    this.mx = -9; this.my = -9; this.swap = 1; this.pauseT = 0; this.W = 0; this.H = 0;
    this._loop = function (n) { me.frame(n); };
    this.build();
    this.bind();
  }

  /* ---------- DOM ---------- */
  Sat.prototype.build = function () {
    var me = this, st = this.stage, base = st.querySelector('canvas');
    var cv = el('canvas', 'sat-cv'); cv.setAttribute('aria-hidden', 'true'); this.cv = cv;
    base.parentNode.insertBefore(cv, base.nextSibling);
    this.svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.svg.setAttribute('class', 'sat-lines'); this.svg.setAttribute('aria-hidden', 'true');
    st.appendChild(this.svg);
    this.pathAmb = d.createElementNS('http://www.w3.org/2000/svg', 'path'); this.svg.appendChild(this.pathAmb);
    // ambient: tag next to the model + the big button
    var amb = el('div', 'sat-amb');
    amb.innerHTML = '<div class="sat-tag" aria-hidden="true"><p class="cap"><span>[ <b data-s="n">GPM</b> ]</span> <em>+</em></p><p class="sat-tag-full" data-s="full"></p><p class="sat-tag-note" data-s="note"></p></div>' +
      '<button class="sat-go" type="button" aria-label="Inspect the satellite: rotate it, x-ray it, take it apart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 11H4l-1 2 1 2h5M15 11h5l1 2-1 2h-5M12 9V5M12 15v4"/></svg><span><small>[ + ] 3D · drag · x-ray · explode</small><b>Inspect the satellite</b></span></button>' +
      '<p class="sat-credit">3D model: NASA 3D Resources</p>';
    st.appendChild(amb); this.amb = amb; this.tag = amb.querySelector('.sat-tag'); this.goBtn = amb.querySelector('.sat-go');
    // the inspector
    var ins = el('div', 'sat-ins'); ins.setAttribute('role', 'group'); ins.setAttribute('aria-label', 'Satellite inspector'); ins.setAttribute('aria-hidden', 'true');
    ins.innerHTML = '<div class="sat-head"><p class="cap"><span>[ Inspect ]</span> NASA satellite <em>+</em></p><h3 data-s="full"></h3><p class="sat-note" data-s="note"></p><p class="sat-part" data-s="part" aria-live="polite"></p></div>' +
      '<button class="sat-close" type="button" aria-label="Close the satellite inspector (Escape)"><span>Close</span><kbd>Esc</kbd></button>' +
      '<div class="sat-sw" role="group" aria-label="Choose a satellite">' + ORDER.map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="false"><b>' + MODELS[k].name + '</b><small>' + MODELS[k].full + '</small></button>'; }).join('') + '</div>' +
      '<div class="sat-labs"></div>' +
      '<div class="sat-dock"><div class="sat-row"><button class="sat-ex" type="button" aria-pressed="false"><span class="sat-ex-i" aria-hidden="true"></span><b>Explode</b></button>' +
      '<label class="sat-sl"><span class="cap">[ Parts apart ]</span><input type="range" min="0" max="100" value="0" aria-label="How far the parts are pushed apart"></label>' +
      '<button class="sat-xr" type="button" aria-pressed="false"><b>X-ray</b></button></div>' +
      '<p class="sat-hint">Drag to turn · scroll or pinch to zoom · hover for x-ray</p><p class="sat-credit">3D model: NASA 3D Resources (free to use)</p></div>';
    st.appendChild(ins); this.ins = ins; this.labs = ins.querySelector('.sat-labs');
    this.exBtn = ins.querySelector('.sat-ex'); this.xrBtn = ins.querySelector('.sat-xr'); this.slider = ins.querySelector('input[type=range]'); this.partEl = ins.querySelector('[data-s="part"]');
    this.swBtns = [].slice.call(ins.querySelectorAll('.sat-sw button'));
    this.closeBtn = ins.querySelector('.sat-close');
    this.pathsL = [];
    this.setText();
  };
  Sat.prototype.setText = function () {
    var m = MODELS[this.curKey], me = this;
    [].forEach.call(this.stage.querySelectorAll('[data-s]'), function (e) {
      var k = e.getAttribute('data-s'); if (k === 'n') e.textContent = m.name; else if (k === 'full') e.textContent = m.full; else if (k === 'note') e.textContent = m.note;
    });
    this.swBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === me.curKey ? 'true' : 'false'); });
  };

  /* ---------- events ---------- */
  Sat.prototype.bind = function () {
    var me = this, cv = this.cv;
    this.goBtn.addEventListener('click', function () { me.openIns(); });
    this.closeBtn.addEventListener('click', function () { me.closeIns(); });
    d.addEventListener('keydown', function (e) {
      if (!me.open) return;
      if (e.key === 'Escape') { me.closeIns(); e.preventDefault(); return; }
      var t = e.target && e.target.tagName; if (t === 'INPUT') return;
      var s = .12, h = true;
      if (e.key === 'ArrowLeft') me.spin(-s, 0); else if (e.key === 'ArrowRight') me.spin(s, 0); else if (e.key === 'ArrowUp') me.spin(0, -s); else if (e.key === 'ArrowDown') me.spin(0, s);
      else if (e.key === '+' || e.key === '=') me.zoomT = clamp(me.zoomT * 1.15, .6, 2.4); else if (e.key === '-') me.zoomT = clamp(me.zoomT / 1.15, .6, 2.4);
      else h = false;
      if (h) e.preventDefault();
    });
    this.exBtn.addEventListener('click', function () { me.setExplode(me.eT > .5 ? 0 : 1, true); });
    this.slider.addEventListener('input', function () { var v = +me.slider.value / 100, was = me.eT; me.eT = v; me.syncEx(); if (v > .5 && was <= .5) cue('sat-explode'); else if (v <= .5 && was > .5) cue('sat-assemble'); });
    this.xrBtn.addEventListener('click', function () { me.xForce = !me.xForce; me.xrBtn.setAttribute('aria-pressed', me.xForce ? 'true' : 'false'); if (me.xForce) cue('sat-xray'); });
    this.swBtns.forEach(function (b) { b.addEventListener('click', function () { me.switchTo(b.dataset.m); }); });
    // pointer: hover everywhere (ambient x-ray), drag and pinch in the inspector
    addEventListener('pointermove', function (e) { var r = me.cv.getBoundingClientRect(); me.mx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1; me.my = -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1); if (me.raf === 0 && me.running()) me.kick(); }, { passive: true });
    this.bindCanvas();
    // when to run
    new IntersectionObserver(function (en) { me.near = en[0].isIntersecting; me.check(); }, { rootMargin: '8% 0px' }).observe(this.sec);
    addEventListener('scroll', function () { me.readScroll(); if (!me.ready && !me.loading && me.sec.getBoundingClientRect().top < innerHeight * .8) me.preload(); me.check(); }, { passive: true });
    new ResizeObserver(function () { me.size(); me.kick(); }).observe(this.stage);
    d.addEventListener('visibilitychange', function () { if (d.hidden) me.stop(); else me.kick(); });
    this.readScroll();
  };
  Sat.prototype.pdist = function () { var k = Object.keys(this.ptrs), a = this.ptrs[k[0]], b = this.ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  Sat.prototype.readScroll = function () { var r = this.sec.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight); this.p = clamp(-r.top / span, 0, 1); };
  Sat.prototype.running = function () { return this.ready && this.near && !d.hidden && (this.p < .32 || this.open); };
  Sat.prototype.check = function () {
    if (this.open && this.p > .33) this.closeIns();
    if (this.running()) { this.pauseT = 0; this.kick(); } else this.stop();
  };
  Sat.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0;
    var me = this;
    if (this.renderer && !this.relT) this.relT = setTimeout(function () { me.relT = 0; if (!me.running()) me.release(); }, 3500);
  };
  Sat.prototype.release = function () {
    if (!this.renderer) return;
    try { this.renderer.dispose(); var ext = this.renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) { /* gone */ }
    this.renderer = null;
    // the canvas keeps its element but a lost context cannot be reused: swap in a fresh one
    var n = this.cv.cloneNode(false); this.cv.parentNode.replaceChild(n, this.cv); this.cv = n; this.bindCanvas(); this.cv.style.touchAction = this.open ? 'none' : '';
  };

  /* ---------- load ---------- */
  Sat.prototype.preload = function () {
    if (this.loading || this.ready || this.failed) return;
    if (navigator.connection && navigator.connection.saveData && !this.open) return;
    this.boot(this.curKey);
  };
  Sat.prototype.boot = function (key) {
    var me = this; if (this.loading) return; this.loading = true; this.stage.classList.add('sat-loading');
    return loadLibs().then(function () { me.THREE = window.THREE; return me.fetchModel(key); }).then(function (m) {
      me.loading = false; me.stage.classList.remove('sat-loading'); me.ready = true; me.useModel(key, m); me.check();
    }).catch(function (e) {
      me.loading = false; me.failed = true; me.stage.classList.remove('sat-loading'); me.stage.classList.add('sat-failed'); if (window.console) console.warn('satellite:', e && e.message);
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
  }
  // turn a loaded scene into parts in one normalised space (radius 1, centred), each with its own box and explode offset
  Sat.prototype.parts = function (scene, key) {
    var T = this.THREE; scene.updateMatrixWorld(true);
    var items = [], box = new T.Box3(), i;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      var g = o.geometry.clone(); floaty(g, T); if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); box.union(g.boundingBox);
      items.push({ geo: g, mat: o.material, mesh: o.name || '', matName: (o.material && o.material.name) || '' });
    });
    var c = box.getCenter(new T.Vector3()), s = 1 / (box.getSize(new T.Vector3()).length() / 2);
    var useMat = items.length > 1 && items.every(function (it) { return /^(Fake|Mesh|Object|Group|Cube|Scene)/i.test(it.mesh) || !it.mesh; });
    var tris = 0;
    items.forEach(function (it, n) {
      it.geo.translate(-c.x, -c.y, -c.z); it.geo.scale(s, s, s); it.geo.computeBoundingBox(); it.geo.computeBoundingSphere();
      it.box = it.geo.boundingBox.clone(); it.center = it.box.getCenter(new T.Vector3()); it.diag = it.box.getSize(new T.Vector3()).length();
      it.label = cleanName(useMat ? it.matName : (it.mesh || it.matName), useMat); it.n = n;
      tris += (it.geo.index ? it.geo.index.count : it.geo.attributes.position.count) / 3;
      var len = it.center.length(), dir = it.center.clone();
      if (len < .09) { var a = (n * 2.399963) % 6.2832, y = ((n * .618) % 1) * 2 - 1, r = Math.sqrt(1 - y * y); dir.set(Math.cos(a) * r, y, Math.sin(a) * r); len = .09; }
      it.off = dir.normalize().multiplyScalar(.34 + .8 * Math.min(1, len));
    });
    // callouts: the biggest part of each distinct name
    var seen = {}, sorted = items.slice().sort(function (a, b) { return b.diag - a.diag; }), lab = [];
    sorted.forEach(function (it) { if (!seen[it.label] && it.diag > .06) { seen[it.label] = 1; lab.push(it); } });
    return { key: key, items: items, labeled: lab, tris: tris };
  };

  /* ---------- three.js scene ---------- */
  Sat.prototype.ensureRenderer = function () {
    if (this.renderer) return true;
    var T = this.THREE; if (!T) return false;
    var r;
    try { r = new T.WebGLRenderer({ canvas: this.cv, alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { this.failed = true; this.stage.classList.add('sat-failed'); return false; }
    r.setClearColor(0x000000, 0); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    this.renderer = r;
    if (!this.scene) {
      var sc = this.scene = new T.Scene(), cam = this.cam = new T.PerspectiveCamera(32, 1, .1, 50); cam.position.set(0, 0, 6.4);
      var key = new T.DirectionalLight(0xfff1dc, 2.6); key.position.set(-3, 3.2, 4); sc.add(key);
      var rim = new T.DirectionalLight(0x6fb4ff, 2.2); rim.position.set(4, -1, -3); sc.add(rim);
      var fill = new T.HemisphereLight(0x9fc4ff, 0x10203c, .55); sc.add(fill);
      this.pivot = new T.Group(); sc.add(this.pivot); this.holder = new T.Group(); this.pivot.add(this.holder);
      this.pivot.quaternion.setFromEuler(new T.Euler(.5, -.75, .12));
      this.xmat = new T.ShaderMaterial({ uniforms: { uX: { value: 0 }, uT: { value: 0 }, uScan: { value: 0 }, uW: { value: .09 }, uCol: { value: new T.Color(.18, .62, 1) } }, vertexShader: XVERT, fragmentShader: XFRAG, transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false, side: T.DoubleSide });
      this.wmat = new T.MeshBasicMaterial({ color: 0x3aa8ff, wireframe: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthTest: false, depthWrite: false });
      this.ray = new T.Raycaster(); this.inv = new T.Matrix4(); this.v3 = new T.Vector3(); this.q = new T.Quaternion(); this.q2 = new T.Quaternion();
    }
    this.envFor(r);
    this.size();
    if (this.cur) this.attach(this.cur);
    return true;
  };
  Sat.prototype.envFor = function (r) {
    var T = this.THREE, es = new T.Scene(), g = new T.SphereGeometry(10, 24, 16);
    var m = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 p; void main(){ float u = p.y * .5 + .5; vec3 space = vec3(.01, .02, .05); vec3 earth = vec3(.10, .26, .55) * 1.6; vec3 c = mix(earth, space, smoothstep(.15, .55, u)); c += vec3(.45, .6, .9) * pow(max(0., 1. - abs(p.y + .08) * 6.), 2.) * .6; gl_FragColor = vec4(c, 1.); }' });
    es.add(new T.Mesh(g, m));
    function panel(x, y, z, w, h, col, k) { var q = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide })); q.position.set(x, y, z); q.lookAt(0, 0, 0); es.add(q); }
    panel(-5, 5, 4, 5, 3, 0xfff0d8, 9); panel(6, 1, -4, 3, 6, 0x7fb8ff, 5); panel(0, -6, 3, 6, 2, 0x5a96ff, 3);
    var pm = new T.PMREMGenerator(r); this.scene.environment = pm.fromScene(es, .02).texture; pm.dispose(); g.dispose(); m.dispose();
  };
  Sat.prototype.useModel = function (key, m) {
    this.curKey = key; this.cur = m; this.setText();
    if (this.renderer || this.ensureRendererIfNeeded()) this.attach(m);
    this.buildLabels(m); this.swap = reduce ? 1 : 0;
  };
  Sat.prototype.ensureRendererIfNeeded = function () { return this.near ? this.ensureRenderer() : false; };
  Sat.prototype.attach = function (m) {
    var T = this.THREE, h = this.holder, me = this;
    while (h.children.length) h.remove(h.children[0]);
    this.mats = []; var seenM = {};
    m.items.forEach(function (it) {
      if (!it.solid) {
        var mat = it.mat; if (mat.metalness > .5) mat.roughness = Math.max(mat.roughness || 0, .32); mat.envMapIntensity = 1.2;
        if (!mat.__b) { mat.__b = { c: mat.color ? mat.color.clone() : null, e: 1.2 }; }
        it.solid = new T.Mesh(it.geo, mat); it.xr = new T.Mesh(it.geo, me.xmat); it.xr.renderOrder = 20;
        it.wf = m.tris < 400000 ? new T.Mesh(it.geo, me.wmat) : null; if (it.wf) it.wf.renderOrder = 21;
        it.group = new T.Group(); it.group.add(it.solid); it.group.add(it.xr); if (it.wf) it.group.add(it.wf);
      }
      it.xr.visible = false; if (it.wf) it.wf.visible = false; it.solid.frustumCulled = it.xr.frustumCulled = false; if (it.wf) it.wf.frustumCulled = false;
      h.add(it.group);
      if (!seenM[it.mat.uuid]) { seenM[it.mat.uuid] = 1; me.mats.push(it.mat); }
    });
    this.xApplied = -1; this.tinted(0);
  };
  Sat.prototype.tinted = function (x) {
    if (Math.abs(x - this.xApplied) < .004) return; this.xApplied = x;
    var k = 1 - .86 * x, wire = this.cur && this.cur.items[0] && this.cur.items[0].wf;
    this.mats.forEach(function (m) { if (m.__b.c && m.color) m.color.copy(m.__b.c).multiplyScalar(k); m.envMapIntensity = m.__b.e * (1 - .93 * x); m.needsUpdate = false; });
    this.xmat.uniforms.uX.value = x; this.wmat.opacity = (wire ? .16 : 0) * x;
    var on = x > .01;
    this.cur.items.forEach(function (it) { it.xr.visible = on; if (it.wf) it.wf.visible = on; });
  };

  Sat.prototype.switchTo = function (key) {
    if (key === this.curKey && this.cur) return; var me = this;
    this.eT = this.eT; this.stage.classList.add('sat-loading');
    this.boot2(key).then(function (m) { me.stage.classList.remove('sat-loading'); if (m) me.useModel(key, m); me.kick(); });
  };
  Sat.prototype.boot2 = function (key) { var me = this; return loadLibs().then(function () { me.THREE = window.THREE; return me.fetchModel(key); }).catch(function () { return null; }); };

  /* ---------- state ---------- */
  Sat.prototype.openIns = function () {
    if (this.open) return;
    var me = this; this.open = true; this.kT = 1; this.stage.classList.add('sat-open'); this.ins.setAttribute('aria-hidden', 'false'); this.cv.style.touchAction = 'none';
    this.amb.setAttribute('inert', ''); this.ins.removeAttribute('inert'); cue('sat-on');
    if (!this.ready && !this.loading) this.boot(this.curKey);
    setTimeout(function () { try { me.closeBtn.focus({ preventScroll: true }); } catch (e) { /* ok */ } }, 60);
    this.kick();
  };
  Sat.prototype.closeIns = function () {
    if (!this.open) return; this.open = false; this.kT = 0; this.stage.classList.remove('sat-open'); this.ins.setAttribute('aria-hidden', 'true'); this.cv.style.touchAction = '';
    this.amb.removeAttribute('inert'); this.setExplode(0, false); this.xForce = false; this.xrBtn.setAttribute('aria-pressed', 'false'); this.zoomT = 1; this.drag = null; this.ptrs = {};
    cue('sat-off'); try { this.goBtn.focus({ preventScroll: true }); } catch (e) { /* ok */ }
    this.kick();
  };
  Sat.prototype.setExplode = function (v, sound) {
    var was = this.eT; this.eT = v; this.slider.value = Math.round(v * 100); this.syncEx();
    if (sound !== false && v > .5 && was <= .5) cue('sat-explode'); else if (sound !== false && v <= .5 && was > .5) cue('sat-assemble');
    if (!this.open && v === 0) { this.e = reduce ? 0 : this.e; }
  };
  Sat.prototype.syncEx = function () {
    var on = this.eT > .5; this.exBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); this.exBtn.querySelector('b').textContent = on ? 'Assemble' : 'Explode'; this.kick();
  };
  Sat.prototype.spin = function (ax, ay) {
    if (!this.pivot) return; var T = this.THREE;
    this.q.setFromAxisAngle(this.v3.set(0, 1, 0), ax); this.q2.setFromAxisAngle(this.v3.set(1, 0, 0), ay);
    this.pivot.quaternion.premultiply(this.q).premultiply(this.q2); if (this.raf === 0) this.kick();
  };

  Sat.prototype.size = function () {
    var r = this.stage.getBoundingClientRect(); this.W = Math.max(2, r.width); this.H = Math.max(2, r.height);
    if (!this.renderer) return;
    var dpr = Math.min(devicePixelRatio || 1, this.W < 720 ? 1.5 : 2); this.dpr = dpr;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(this.W, this.H, false); this.cam.aspect = this.W / this.H; this.cam.updateProjectionMatrix();
  };

  Sat.prototype.kick = function () { if (!this.raf && this.running()) { this.last = 0; this.raf = requestAnimationFrame(this._loop); } };

  /* ---------- frame ---------- */
  Sat.prototype.frame = function (now) {
    this.raf = 0; if (!this.running()) return;
    if (!this.renderer && !this.ensureRenderer()) return;
    var dt = this.last ? Math.min(.05, (now - this.last) / 1000) : .016; this.last = now; this.t += dt;
    this.readScroll();
    var W = this.W, H = this.H, T = this.THREE, open = this.open, mob = W < 720;
    // fades: the satellite belongs to the first quarter of the descent
    var a = open ? 1 : 1 - sstep(.19, .29, this.p); this.alpha = a;
    this.cv.style.opacity = (a * (this.swap < 1 ? .0 + this.swap : 1)).toFixed(3);
    this.amb.style.opacity = a.toFixed(3); this.amb.style.visibility = a < .02 ? 'hidden' : 'visible'; this.amb.style.pointerEvents = a < .5 ? 'none' : '';
    // eased state
    var kk = reduce ? 1 : 1 - Math.exp(-dt * 5), ke = reduce ? 1 : 1 - Math.exp(-dt * 4.2), kx = reduce ? 1 : 1 - Math.exp(-dt * 9);
    this.k += (this.kT - this.k) * kk; if (Math.abs(this.kT - this.k) < .002) this.k = this.kT;
    this.e += (this.eT - this.e) * ke; if (Math.abs(this.eT - this.e) < .002) this.e = this.eT;
    this.zoom += (this.zoomT - this.zoom) * kk;
    if (this.swap < 1) this.swap = Math.min(1, this.swap + dt * 3.2);
    // hover test against the part boxes (cheap), x-ray follows it
    var k = this.k, ease = k * k * (3 - 2 * k);
    this.layout(ease);
    var over = this.hit();
    if (over !== this.hoverPart) { this.hoverPart = over; if (open) this.partEl.textContent = over >= 0 ? '[ Part ] ' + this.cur.items[over].label.toUpperCase() : ''; }
    var hov = over >= 0 && a > .5 && !this.drag; if (hov && !this.hover) cue('sat-xray'); this.hover = over >= 0 && a > .5;
    this.xT = (hov || (open && this.xForce)) ? 1 : 0; this.x += (this.xT - this.x) * kx; if (Math.abs(this.xT - this.x) < .003) this.x = this.xT;
    this.cv.classList.toggle('hov', this.hover && open); this.stage.classList.toggle('sat-hov', this.hover && !open);
    // rotation: inertia after a drag, a slow tumble when idle
    if (!this.drag && !reduce) {
      this.vx *= Math.exp(-dt * 2.6); this.vy *= Math.exp(-dt * 2.6);
      this.idle += dt; var tum = open ? sstep(2, 4, this.idle) * .45 : 1, f = this.x > .5 ? .35 : 1;
      this.spin((this.vx + .21 * tum * f) * dt, (this.vy + .05 * tum * f * Math.sin(this.t * .4)) * dt);
    }
    // x-ray and scan line
    this.tinted(this.x);
    var u = this.xmat.uniforms; u.uT.value = this.t; var R = this.pivot.scale.x;
    u.uScan.value = this.pivot.position.y + (reduce ? 0 : Math.sin(this.t * 1.7)) * R * 1.15; u.uW.value = .07 * R + .02;
    // explode
    var e = this.e, items = this.cur.items, i;
    for (i = 0; i < items.length; i++) { var o = items[i].off; items[i].group.position.set(o.x * e, o.y * e, o.z * e); }
    // draw (ambient is capped near 30 fps)
    if (open || this.x > .01 || now - this.lastDraw > 30) { this.lastDraw = now; this.renderer.render(this.scene, this.cam); }
    this.overlay(ease, e);
    this.raf = requestAnimationFrame(this._loop);
  };

  // where the model sits: ambient over the limb (upper right), or centre stage when inspected
  Sat.prototype.layout = function (ease) {
    var W = this.W, H = this.H, mob = W < 720, cam = this.cam, hh = Math.tan(cam.fov * Math.PI / 360) * cam.position.z, hw = hh * cam.aspect;
    var m = Math.min(W, H);
    var rA = mob ? W * .2 : m * .17, rI = mob ? W * .34 : m * .31;
    var nxA = mob ? .22 : .5, nyA = (mob ? .34 : .22) + this.p * 1.5, nxI = 0, nyI = mob ? .02 : .0;
    var nx = nxA + (nxI - nxA) * ease, ny = nyA + (nyI - nyA) * ease, rpx = rA + (rI - rA) * ease;
    var bob = reduce ? 0 : Math.sin(this.t * .55) * .012;
    var ez = 1 / (1 + .5 * this.e), z = (1 + (this.zoom - 1) * ease), sw = .55 + .45 * this.swap;
    var rr = rpx * z * ez * sw, sc = rr / (H / 2) * hh;
    this.pivot.position.set(nx * hw, (ny + bob) * hh, 0); this.pivot.scale.setScalar(sc);
    this.pivot.updateMatrixWorld(true);
    this.scr = { x: (nx * .5 + .5) * W, y: (1 - (ny + bob) * .5 - .5) * H, r: rr * 1.0 };
  };
  // nearest part box under the pointer, in pivot space; -1 if none
  Sat.prototype.hit = function () {
    if (!this.cur || this.alpha < .5) return -1;
    var T = this.THREE, r = this.ray; r.setFromCamera({ x: this.mx, y: this.my }, this.cam);
    this.inv.copy(this.pivot.matrixWorld).invert(); var o = r.ray.clone().applyMatrix4(this.inv), best = -1, bt = 1e9, items = this.cur.items, e = this.e, tmp = this.hitV || (this.hitV = new T.Vector3()), bx = this.hitB || (this.hitB = new T.Box3());
    for (var i = 0; i < items.length; i++) {
      var it = items[i]; bx.copy(it.box); bx.translate(tmp.copy(it.off).multiplyScalar(e));
      var p = o.intersectBox(bx, tmp); if (p) { var t = p.distanceToSquared(o.origin); if (t < bt) { bt = t; best = i; } }
    }
    return best;
  };

  // DOM: the tag by the model, the callouts and their leader lines
  Sat.prototype.buildLabels = function (m) {
    var me = this, n = this.W < 720 ? 5 : 8; this.labs.innerHTML = ''; while (this.pathsL.length) { this.svg.removeChild(this.pathsL.pop()); }
    this.lab = m.labeled.slice(0, n).map(function (it, i) {
      var e = el('span', 'sat-lab', '<i>' + ('0' + (i + 1)).slice(-2) + '</i>' + it.label); me.labs.appendChild(e);
      var p = d.createElementNS('http://www.w3.org/2000/svg', 'path'); me.svg.appendChild(p); me.pathsL.push(p);
      return { it: it, e: e, p: p, w: 0 };
    });
  };
  Sat.prototype.overlay = function (ease, e) {
    var W = this.W, H = this.H, s = this.scr, T = this.THREE, mob = W < 720, a = this.alpha;
    // ambient tag + leader
    var tx = mob ? Math.max(14, s.x - s.r * .1) : Math.min(W - 270, s.x + s.r * 1.25), ty = mob ? s.y + s.r * 1.2 : s.y - s.r * 1.05;
    this.tag.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)'; this.tag.style.opacity = ((1 - ease) * a).toFixed(3);
    var sx = s.x + (mob ? 0 : s.r * .7), sy = s.y - (mob ? -s.r * .9 : s.r * .7);
    this.pathAmb.setAttribute('d', ease < .98 ? 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) + 'L' + (mob ? tx : tx - 14).toFixed(1) + ',' + (mob ? ty : ty + 10).toFixed(1) : ''); this.pathAmb.style.opacity = ((1 - ease) * a * .8).toFixed(3);
    // callouts: columns left and right, spread so none overlap
    var labs = this.lab || [], vis = e > .03 && this.open, i;
    this.labs.style.opacity = vis ? Math.min(1, (e - .03) * 4).toFixed(3) : 0;
    if (!vis) { for (i = 0; i < labs.length; i++) labs[i].p.setAttribute('d', ''); return; }
    var cam = this.cam, v = this.v3, L = [], R = [], lw = mob ? 118 : 178, gap = mob ? 25 : 32, top = mob ? 150 : 150, bot = H - (mob ? 240 : 170);
    for (i = 0; i < labs.length; i++) {
      var b = labs[i], c = b.it.center.clone().addScaledVector(b.it.off, e); v.copy(c).applyMatrix4(this.pivot.matrixWorld).project(cam);
      b.px = (v.x * .5 + .5) * W; b.py = (-v.y * .5 + .5) * H; (b.px > s.x ? R : L).push(b);
    }
    var self = this;
    function place(arr, right) {
      arr.sort(function (p, q) { return p.py - q.py; });
      var y = top - gap; arr.forEach(function (b) { y = Math.max(clamp(b.py, top, bot), y + gap); b.ly = y; });
      var over = y - bot; if (over > 0) arr.forEach(function (b) { b.ly -= over; });
      var colX = right ? Math.min(W - 14 - lw, s.x + s.r * (mob ? 1.15 : 1.45)) : Math.max(14 + lw, s.x - s.r * (mob ? 1.15 : 1.45));
      arr.forEach(function (b) {
        b.lx = colX; var ex = right ? colX - 10 : colX + 10;
        b.e.style.transform = 'translate3d(' + (right ? colX : colX - lw) + 'px,' + (b.ly - 12) + 'px,0)'; b.e.classList.toggle('l', !right); b.e.style.width = lw + 'px';
        var k1 = right ? Math.max(b.px + 12, ex - 26) : Math.min(b.px - 12, ex + 26);
        b.p.setAttribute('d', 'M' + b.px.toFixed(1) + ',' + b.py.toFixed(1) + 'L' + k1.toFixed(1) + ',' + b.ly.toFixed(1) + 'L' + ex.toFixed(1) + ',' + b.ly.toFixed(1));
        b.p.style.opacity = Math.min(1, (e - .03) * 4).toFixed(3);
      });
    }
    place(L, false); place(R, true);
  };

  Sat.prototype.bindCanvas = function () {
    var me = this, cv = this.cv;
    cv.addEventListener('pointerdown', function (e) {
      if (!me.open) return;
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
      me.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(me.ptrs);
      if (ids.length === 2) { me.pinch0 = me.pdist(); me.pz0 = me.zoomT; me.drag = null; } else { me.drag = { x: e.clientX, y: e.clientY, t: performance.now() }; me.vx = me.vy = 0; }
      cv.classList.add('grab'); me.idle = 0;
    });
    cv.addEventListener('pointermove', function (e) {
      var p = me.ptrs[e.pointerId]; if (!p) return;
      var ids = Object.keys(me.ptrs);
      if (ids.length === 2) { p.x = e.clientX; p.y = e.clientY; if (me.pinch0 > 0) me.zoomT = clamp(me.pz0 * me.pdist() / me.pinch0, .6, 2.4); return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y, now = performance.now(), dt = Math.max(.008, (now - me.drag.t) / 1000);
      p.x = e.clientX; p.y = e.clientY; me.drag.t = now;
      me.spin(dx * .0085, dy * .0085); me.vx = me.vx * .6 + (dx * .0085 / dt) * .4; me.vy = me.vy * .6 + (dy * .0085 / dt) * .4; me.idle = 0;
    });
    function up(e) { delete me.ptrs[e.pointerId]; if (!Object.keys(me.ptrs).length) { me.drag = null; cv.classList.remove('grab'); } if (reduce) me.vx = me.vy = 0; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) {
      if (!me.open || !me.hover) return;
      var nz = clamp(me.zoomT * Math.exp(-e.deltaY * .0016), .6, 2.4);
      if (nz === me.zoomT) return; // at the limit: let the page scroll
      me.zoomT = nz; e.preventDefault(); me.idle = 0;
    }, { passive: false });
  };

  function boot() {
    var sec = d.getElementById('descent'); if (!sec || !sec.querySelector('.ds-stage')) return;
    window.SatelliteStage = new Sat(sec);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
