/* GlassReveal: a liquid-glass logo reveal in one WebGL2 pass, in plain JS (no React).
 *
 * Concept and credit: the idea, the single-pass "SDF becomes a glass bevel" approach and the spring timeline come from
 * zanwei/glass-icon-reveal (MIT), via 21st.dev. The shader, the signed-distance builder (an EDT in the style of TinySDF)
 * and the spring timeline below were written for this site as a plain-JS class; no 21st.dev mark is used, the logo is
 * the owner's own "\7" monogram (see assets/home/home.js).
 *
 * How it works
 *   1. The logo (an SVG string, URL or canvas) is rasterised once into a 256 x 256 canvas, and an exact Euclidean
 *      distance transform turns it into a signed distance field (R16F texture, 0.5 = the edge, inside is brighter).
 *   2. One fragment shader draws the page ground with a faint hairline ruler pattern (so there is something to refract),
 *      then, inside the logo, bends that pattern by a bevel profile derived from the distance field, splits the colours
 *      (dispersion), frosts it while the glass is still "wet", and adds rim light, an inner edge, a sweep of light and
 *      a soft shadow. Nothing is a texture lookup except the field.
 *   3. A small set of critically-tuned springs (intro, refraction, frost, sweep, release) is stepped by a timeline:
 *      the glass drops in big and blurred, focuses, lets go (a breath of extra refraction) and settles at rest.
 *
 *   var g = new GlassReveal(el, { logo: svgString, look: 'light'|'dark', background: '#e7eef7', onRelease: fn, onDone: fn });
 *   g.replay();  g.setLook('dark', '#050912');  g.dispose();
 *
 * Also handled: IntersectionObserver pause, ResizeObserver, context loss and restore, prefers-reduced-motion (one still
 * frame at the final state), and a CSS mask fallback (same logo, flat) when WebGL2 is missing.
 */
(function () {
  'use strict';

  var SDF_N = 256, SDF_R = 36; // field size in texels, and the distance (texels) the field is encoded over
  var INF = 1e20;

  /* ---------- exact distance transform (Felzenszwalb and Huttenlocher), the same one TinySDF uses ---------- */
  function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0; z[0] = -INF; z[1] = INF; f[0] = grid[offset];
    for (var q = 1, k = 0, s = 0; q < length; q++) {
      f[q] = grid[offset + q * stride];
      var q2 = q * q;
      do { var r = v[k]; s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    for (q = 0, k = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      var r2 = v[k], qr = q - r2;
      grid[offset + q * stride] = f[r2] + qr * qr;
    }
  }
  function edt(grid, n) {
    var f = new Float64Array(n), v = new Uint16Array(n), z = new Float64Array(n + 1), i;
    for (i = 0; i < n; i++) edt1d(grid, i, n, n, f, v, z);
    for (i = 0; i < n; i++) edt1d(grid, i * n, 1, n, f, v, z);
  }
  /** alpha (0..255, n x n) to a signed distance as floats: 0.5 on the edge, brighter inside, darker outside. */
  function buildField(alpha, n) {
    var outer = new Float64Array(n * n), inner = new Float64Array(n * n), i, a, out = new Float32Array(n * n);
    for (i = 0; i < n * n; i++) {
      a = alpha[i] / 255;
      outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, .5 - a), 2);
      inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - .5), 2);
    }
    edt(outer, n); edt(inner, n);
    for (i = 0; i < n * n; i++) {
      var d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]); // positive outside
      out[i] = Math.max(0, Math.min(1, .5 - d / (2 * SDF_R)));
    }
    // a light blur of the field: a slanted edge has a faint stair-step in its distance, and the shader differentiates it
    var tmp = new Float32Array(n * n), pass, x, y, k;
    for (pass = 0; pass < 2; pass++) {
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) { var sx = 0; for (k = -2; k <= 2; k++) sx += out[y * n + Math.min(n - 1, Math.max(0, x + k))]; tmp[y * n + x] = sx / 5; }
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) { var sy = 0; for (k = -2; k <= 2; k++) sy += tmp[Math.min(n - 1, Math.max(0, y + k)) * n + x]; out[y * n + x] = sy / 5; }
    }
    return out;
  }

  /* ---------- a spring (semi-implicit Euler, sub-stepped so it stays stable) ---------- */
  function Spring(x, k, c) { this.x = x; this.v = 0; this.t = x; this.k = k; this.c = c; }
  Spring.prototype.step = function (dt) {
    var n = Math.max(1, Math.ceil(dt / .004)), h = dt / n;
    for (var i = 0; i < n; i++) { this.v += (-this.k * (this.x - this.t) - this.c * this.v) * h; this.x += this.v * h; }
  };
  Spring.prototype.settled = function () { return Math.abs(this.x - this.t) < 5e-4 && Math.abs(this.v) < 5e-3; };

  /* ---------- shaders ---------- */
  var VERT = '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}';
  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime; uniform sampler2D uSdf;',
    'uniform vec4 uBox;  // xy: logo centre in px (top-left origin), z: side of the field square on screen, w: field radius in texels',
    'uniform vec4 uA;    // x: appear, y: refraction, z: dispersion, w: frost',
    'uniform vec4 uB;    // x: sweep (0..1), y: release pulse, z: bevel width px, w: scale',
    'uniform vec2 uMouse;',
    'uniform vec3 uBg, uInk, uAccent; uniform float uDark;',
    'out vec4 o;',
    // the ground: page colour, a faint accent wash, and a ruler of hairlines (the thing the glass bends)
    'vec3 ground(vec2 p){',
    '  vec3 c=uBg;',
    '  vec2 q=(p-uRes*vec2(.72,.30))/vec2(uRes.x*.55,uRes.y*.6);',
    '  c=mix(c,uAccent,.10*exp(-dot(q,q))*(.8+.2*sin(uTime*.35)));',
    '  q=(p-uRes*vec2(.18,.85))/vec2(uRes.x*.45,uRes.y*.5);',
    '  c=mix(c,uAccent,.07*exp(-dot(q,q)));',
    '  float s=26.,x=p.x/s+.5,id=floor(x),d=abs(fract(x)-.5)*s;',
    '  float major=mod(id,4.)<.5?1.:0.;',
    '  float line=1.-smoothstep(.35,1.25+major*.5,d);',
    '  c=mix(c,uInk,line*(.075+.07*major));',
    '  float y=abs(fract(p.y/(s*4.)+.5)-.5)*s*4.; c=mix(c,uInk,(1.-smoothstep(.3,1.1,y))*.05);',
    '  return c;}',
    'vec3 glass(vec2 p,vec2 off,float fr){',
    '  vec3 a=ground(p+off);',
    '  if(fr>.02){a+=ground(p+off+vec2(fr*7.,0.))+ground(p+off-vec2(fr*7.,0.))+ground(p+off+vec2(0.,fr*7.))+ground(p+off-vec2(0.,fr*7.));a/=5.;}',
    '  return a;}',
    'void main(){',
    '  vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    '  float side=uBox.z*uB.w, tp=side/256.;',
    '  vec2 lp=(fc-uBox.xy-uMouse*vec2(10.,7.)*(1.-uA.w*.7))/side+.5;',
    '  float sv=texture(uSdf,lp).r;',
    '  float e=(sv-.5)*2.*uBox.w*tp;                          // px; > 0 inside the logo',
    '  float eps=1.5/256.;',
    '  vec2 g=vec2(texture(uSdf,lp+vec2(eps,0.)).r-texture(uSdf,lp-vec2(eps,0.)).r,texture(uSdf,lp+vec2(0.,eps)).r-texture(uSdf,lp-vec2(0.,eps)).r);',
    '  vec2 gd=g/(length(g)+1e-5);                              // unit vector pointing inwards',
    '  float inside=smoothstep(-.8,.8,e);',
    '  float bw=uB.z*uB.w;',
    '  float t=clamp(e/bw,0.,1.);',
    '  float edge=1.-t;',
    '  vec3 base=ground(fc);',
    // drop shadow, a little down and to the right
    '  float se=(texture(uSdf,lp-vec2(.012,.03)).r-.5)*2.*uBox.w*tp;',
    '  float sh=smoothstep(-16.,3.,se)*(1.-inside)*(.16-.07*uDark)*uA.x;',
    '  base=mix(base,mix(uInk,vec3(0.),.5),sh);',
    // refraction: the bevel throws the ground inwards at the rim, the flat middle magnifies a touch
    '  float k=uA.y;',
    '  vec2 bend=gd*pow(edge,1.55)*bw*k*1.15;',
    '  vec2 mag=(fc-uBox.xy)*(-.07*k*(1.-edge*edge));',
    '  vec2 off=bend+mag;',
    '  float dz=uA.z;',
    '  vec3 gl;',
    '  gl.r=glass(fc,off*(1.+dz*.55),uA.w).r;',
    '  gl.g=glass(fc,off,uA.w).g;',
    '  gl.b=glass(fc,off*(1.-dz*.55),uA.w).b;',
    // body: a touch of ink so the glass reads on a light page, darker toward the rim like a thick edge
    '  gl=mix(gl,uInk,(.16+.05*(1.-uDark*.4))+edge*edge*(.30-.12*uDark));',
    // light: two rim lights from the top-left and a faint one from the opposite side
    '  vec2 L=normalize(vec2(-.62,-.78)+uMouse*.5+vec2(sin(uTime*.4)*.06,0.));',
    '  vec2 nrm=-gd;',
    '  float s1=pow(max(dot(nrm,L),0.),2.2)*pow(edge,2.4);',
    '  float s2=pow(max(dot(nrm,-L),0.),3.)*pow(edge,2.)*.45;',
    '  float core=smoothstep(.0,.06,t)*(1.-smoothstep(.06,.2,t));  // a thin bright line just inside the edge',
    '  gl+=vec3(1.)*(s1*.62+s2*.34)+vec3(1.)*core*.14;',
    // a sweep of light across the face, once, then a slow breath
    '  float pos=lp.x+lp.y*.45;',
    '  float sw=exp(-pow((pos-(uB.x*2.1-.55))*5.5,2.));',
    '  gl+=vec3(1.)*sw*.34*inside*(1.-edge*.6);',
    '  gl+=vec3(1.)*uB.y*.18*edge;',
    '  vec3 col=mix(base,gl,inside*uA.x);',
    '  o=vec4(col,1.);',
    '}'
  ].join('\n');

  function parseColor(c, fallback) {
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = 1;
      var x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c || fallback; x.fillRect(0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255];
    } catch (e) { return [.9, .93, .97]; }
  }

  var LOOKS = {
    light: { ink: '#0b2a6b', accent: '#2aa6e8', dark: 0, bg: '#e7eef7' },
    dark: { ink: '#a8d8ff', accent: '#3a7be0', dark: 1, bg: '#050912' }
  };

  function GlassReveal(el, opts) {
    opts = opts || {};
    var self = this;
    this.el = el; this.opts = opts;
    this.look = opts.look === 'dark' ? 'dark' : 'light';
    this.bg = opts.background || LOOKS[this.look].bg;
    this.size = opts.size || .46;            // the logo's width as a share of the shorter side... see layout()
    this.onRelease = opts.onRelease || null; this.onDone = opts.onDone || null; this.onReady = opts.onReady || null;
    this.reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.instant = !!opts.instant || this.reduce;
    this.disposed = false; this.visible = true; this.raf = 0; this.lastT = 0; this.clock = 0; this.mx = 0; this.my = 0; this.tmx = 0; this.tmy = 0;
    this.gl = null; this.prog = null; this.tex = null; this.field = null; this.u = {};
    this.fired = {}; this.idleSkip = 0;
    this._loop = function (t) { self.frame(t); };
    this.springs = {
      appear: new Spring(0, 60, 12), refr: new Spring(2.4, 22, 6.5), disp: new Spring(1.7, 20, 7),
      frost: new Spring(1, 16, 8), sweep: new Spring(0, 9, 6.5), pulse: new Spring(0, 70, 7), scale: new Spring(1.55, 34, 8.5)
    };
    // the timeline: at `at` seconds, set a spring's target
    this.timeline = [
      { at: .05, s: 'appear', to: 1 }, { at: .05, s: 'scale', to: 1 },
      { at: .30, s: 'refr', to: 1.15 }, { at: .30, s: 'disp', to: 1.05 }, { at: .38, s: 'frost', to: 0 },
      { at: 1.15, s: 'sweep', to: 1 },
      { at: 1.9, s: 'pulse', to: 1, ev: 'release' }, { at: 2.15, s: 'pulse', to: 0 },
      { at: 2.0, s: 'refr', to: .62 }, { at: 2.0, s: 'disp', to: .42 }
    ];
    this.rest = { appear: 1, refr: .62, disp: .42, frost: 0, sweep: 1, pulse: 0, scale: 1 };

    el.classList.add('gr');
    this.mount();
  }

  GlassReveal.prototype.mount = function () {
    var self = this;
    var cv = document.createElement('canvas'); cv.className = 'gr-canvas'; cv.setAttribute('aria-hidden', 'true');
    var gl = null;
    try { gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    this.cv = cv;
    if (!gl) { this.fallback(); return; }
    this.gl = gl; this.el.appendChild(cv);
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.lost = true; cancelAnimationFrame(self.raf); self.raf = 0; });
    cv.addEventListener('webglcontextrestored', function () { self.lost = false; self.initGL(); self.layout(); self.kick(); });
    if (!this.initGL()) { cv.remove(); this.gl = null; this.fallback(); return; }
    // the field needs the logo; until it is ready nothing is drawn but the ground
    this.loadLogo(function (alpha) {
      if (self.disposed) return;
      self.field = buildField(alpha, SDF_N); self.uploadField(); self.fieldReady = true;
      if (self.onReady) self.onReady(self);
      self.start();
    });
    this.ro = ('ResizeObserver' in window) ? new ResizeObserver(function () { self.layout(); self.kick(); }) : null;
    if (this.ro) this.ro.observe(this.el); else { this._rz = function () { self.layout(); self.kick(); }; addEventListener('resize', this._rz); }
    this.io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (en) {
      self.visible = en[0].isIntersecting; if (self.visible) self.kick(); else { cancelAnimationFrame(self.raf); self.raf = 0; }
    }) : null;
    if (this.io) this.io.observe(this.el);
    this._pm = function (e) {
      var r = self.el.getBoundingClientRect(); if (!r.width) return;
      self.tmx = ((e.clientX - r.left) / r.width - .5) * 2; self.tmy = ((e.clientY - r.top) / r.height - .5) * 2; self.kick();
    };
    this._pl = function () { self.tmx = self.tmy = 0; self.kick(); };
    this._ck = function () { if (self.opts.replayOnClick !== false) self.replay(); };
    this.el.addEventListener('pointermove', this._pm, { passive: true });
    this.el.addEventListener('pointerleave', this._pl);
    this.el.addEventListener('click', this._ck);
    this.layout();
  };

  GlassReveal.prototype.initGL = function () {
    var gl = this.gl;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { if (window.console) console.warn('GlassReveal shader:', gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
    this.prog = p; gl.useProgram(p);
    var names = ['uRes', 'uTime', 'uSdf', 'uBox', 'uA', 'uB', 'uMouse', 'uBg', 'uInk', 'uAccent', 'uDark'];
    for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(p, names[i]);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, SDF_N, SDF_N, 0, gl.RED, gl.FLOAT, this.field || new Float32Array(SDF_N * SDF_N));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u.uSdf, 0);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    return true;
  };
  GlassReveal.prototype.uploadField = function () {
    var gl = this.gl; if (!gl || !this.tex || !this.field) return;
    gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, SDF_N, SDF_N, 0, gl.RED, gl.FLOAT, this.field);
  };

  /* the logo: an svg string, a url, or a canvas/image; drawn to fit 70 % of a 256 square, alpha out */
  GlassReveal.prototype.loadLogo = function (done) {
    var src = this.opts.logo, self = this;
    function fromImage(img, w, h) {
      var c = document.createElement('canvas'); c.width = c.height = SDF_N; var x = c.getContext('2d', { willReadFrequently: true });
      var fit = SDF_N * .70, k = Math.min(fit / w, fit / h);
      x.drawImage(img, (SDF_N - w * k) / 2, (SDF_N - h * k) / 2, w * k, h * k);
      var d = x.getImageData(0, 0, SDF_N, SDF_N).data, a = new Uint8Array(SDF_N * SDF_N);
      for (var i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      self.aspect = w / h; done(a);
    }
    if (src && src.tagName === 'CANVAS') return fromImage(src, src.width, src.height);
    var img = new Image(), url = src;
    if (typeof src === 'string' && src.charAt(0) === '<') url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    img.onload = function () { fromImage(img, img.naturalWidth || 300, img.naturalHeight || 200); };
    img.onerror = function () { self.gl = null; if (self.cv) self.cv.remove(); self.fallback(); };
    img.decoding = 'async'; img.src = url;
  };

  GlassReveal.prototype.layout = function () {
    if (!this.gl || this.lost) return;
    var r = this.el.getBoundingClientRect(), w = Math.max(2, r.width), h = Math.max(2, r.height);
    var dpr = Math.min(window.devicePixelRatio || 1, w < 720 ? 1.5 : 2);
    this.W = w; this.H = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.gl.viewport(0, 0, this.cv.width, this.cv.height);
    this.needDraw = true;
  };

  GlassReveal.prototype.start = function () { this.clock = 0; this.fired = {}; this.timeIdx = {}; this.applyInstant(); this.kick(); };

  GlassReveal.prototype.applyInstant = function () {
    var s = this.springs, r = this.rest, k;
    if (this.instant) { for (k in r) { s[k].x = s[k].t = r[k]; s[k].v = 0; } this.clock = 99; this.doneFired = true; if (this.onDone && !this.reduceCalled) { this.reduceCalled = true; var f = this.onDone, me = this; setTimeout(function () { f(me); }, 0); } }
    else {
      var init = { appear: 0, refr: 2.4, disp: 1.7, frost: 1, sweep: 0, pulse: 0, scale: 1.55 };
      for (k in init) { s[k].x = s[k].t = init[k]; s[k].v = 0; }
      this.doneFired = false;
    }
    this.needDraw = true;
  };

  GlassReveal.prototype.replay = function () {
    if (this.disposed) return;
    if (!this.gl) { this.replayFallback(); return; }
    if (this.reduce) return;
    this.instant = false; this.reduceCalled = false; this.start();
  };

  GlassReveal.prototype.setLook = function (look, background) {
    this.look = look === 'dark' ? 'dark' : 'light';
    if (background) this.bg = background; else this.bg = LOOKS[this.look].bg;
    this.needDraw = true; this.kick();
  };

  GlassReveal.prototype.kick = function () {
    if (this.disposed || this.lost || !this.gl || !this.fieldReady || !this.visible) return;
    this.needDraw = true;
    if (!this.raf) { this.lastT = 0; this.raf = requestAnimationFrame(this._loop); }
  };

  GlassReveal.prototype.frame = function (t) {
    this.raf = 0;
    if (this.disposed || this.lost || !this.visible) return;
    var dt = this.lastT ? Math.min(.05, (t - this.lastT) / 1000) : .016; this.lastT = t;
    var s = this.springs, k, busy = false;
    if (this.clock < 90) {
      this.clock += dt;
      for (var i = 0; i < this.timeline.length; i++) {
        var ev = this.timeline[i];
        if (!this.fired[i] && this.clock >= ev.at) {
          this.fired[i] = true; s[ev.s].t = ev.to;
          if (ev.ev === 'release' && this.onRelease) { try { this.onRelease(this); } catch (e) { /* the page's callback must not stop the loop */ } }
        }
      }
    }
    for (k in s) { s[k].step(dt); if (!s[k].settled()) busy = true; }
    // the pointer eases toward its target
    var dm = 1 - Math.exp(-dt * 5); this.mx += (this.tmx - this.mx) * dm; this.my += (this.tmy - this.my) * dm;
    var moving = Math.abs(this.tmx - this.mx) + Math.abs(this.tmy - this.my) > .002;
    this.draw(t / 1000);
    if (!this.doneFired && this.clock > 2.6 && !busy) { this.doneFired = true; if (this.onDone) { try { this.onDone(this); } catch (e2) { /* ignore */ } } }
    if (this.reduce && this.clock > 90 && !busy) return; // one still frame, no loop
    // idle: a slow drift of the wash and the sweep's breath, at half rate
    if (!busy && !moving) { if ((++this.idleSkip & 1) === 0) this.draw(t / 1000); this.raf = requestAnimationFrame(this._loop); return; }
    this.raf = requestAnimationFrame(this._loop);
  };

  GlassReveal.prototype.draw = function (time) {
    var gl = this.gl, u = this.u, s = this.springs, L = LOOKS[this.look];
    if (!gl || !this.W) return;
    var bg = parseColor(this.bg, L.bg), ink = parseColor(this.opts.ink || L.ink, L.ink), ac = parseColor(this.opts.accent || L.accent, L.accent);
    var W = this.cv.width, H = this.cv.height, d = this.dpr;
    // the logo: its width is `size` of the shorter side (wider on a phone), centred a little above the middle to leave room for the name below
    var aspect = this.aspect || 1.5, wide = this.W < 720;
    var logoW = Math.min(this.W * (wide ? .66 : .44), this.H * (wide ? .4 : .4) * aspect, 760) * (this.opts.scale || 1);
    var side = logoW / .70; // the logo fills 70 % of the field square
    var cy = this.H * (wide ? .36 : .38);
    gl.useProgram(this.prog);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uTime, time);
    gl.uniform4f(u.uBox, this.W * .5 * d, cy * d, side * d, SDF_R);
    gl.uniform4f(u.uA, s.appear.x, s.refr.x, s.disp.x, s.frost.x);
    gl.uniform4f(u.uB, s.sweep.x, s.pulse.x, Math.max(8, logoW * .085) * d, s.scale.x);
    gl.uniform2f(u.uMouse, this.mx, this.my);
    gl.uniform3f(u.uBg, bg[0], bg[1], bg[2]); gl.uniform3f(u.uInk, ink[0], ink[1], ink[2]); gl.uniform3f(u.uAccent, ac[0], ac[1], ac[2]);
    gl.uniform1f(u.uDark, L.dark);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.needDraw = false;
  };

  /* no WebGL2: the same mark, flat, through a CSS mask. replay() re-runs a small CSS fade. */
  GlassReveal.prototype.fallback = function () {
    var el = this.el, src = this.opts.logo, url = src;
    el.classList.add('gr-flat');
    if (typeof src === 'string' && src.charAt(0) === '<') url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    var d = document.createElement('div'); d.className = 'gr-mask'; d.setAttribute('aria-hidden', 'true');
    if (typeof url === 'string') { var m = 'url("' + url + '") center / contain no-repeat'; d.style.webkitMask = m; d.style.mask = m; }
    el.appendChild(d); this.maskEl = d;
    var me = this;
    setTimeout(function () { if (me.onRelease) me.onRelease(me); if (me.onDone) me.onDone(me); if (me.onReady) me.onReady(me); }, this.instant ? 0 : 900);
    this._ck = function () { if (me.opts.replayOnClick !== false) me.replay(); };
    el.addEventListener('click', this._ck);
  };
  GlassReveal.prototype.replayFallback = function () {
    var d = this.maskEl; if (!d || this.reduce) return;
    d.classList.remove('go'); void d.offsetWidth; d.classList.add('go');
  };

  GlassReveal.prototype.dispose = function () {
    if (this.disposed) return; this.disposed = true;
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.ro) this.ro.disconnect(); if (this._rz) removeEventListener('resize', this._rz);
    if (this.io) this.io.disconnect();
    this.el.removeEventListener('pointermove', this._pm); this.el.removeEventListener('pointerleave', this._pl); this.el.removeEventListener('click', this._ck);
    var gl = this.gl;
    if (gl) {
      try { gl.deleteTexture(this.tex); gl.deleteProgram(this.prog); } catch (e) { /* context may already be gone */ }
      var ext = null; try { ext = gl.getExtension('WEBGL_lose_context'); } catch (e2) { /* none */ }
      if (ext) { try { ext.loseContext(); } catch (e3) { /* ignore */ } }
    }
    if (this.cv && this.cv.parentNode) this.cv.parentNode.removeChild(this.cv);
    if (this.maskEl && this.maskEl.parentNode) this.maskEl.parentNode.removeChild(this.maskEl);
    this.gl = null; this.el.classList.remove('gr');
  };

  window.GlassReveal = GlassReveal;
})();
