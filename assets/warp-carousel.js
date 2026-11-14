/* Warp reel: a plain-JS port of Louis Studios' "Warp Carousel" (21st.dev), used as the opening's background reel.
 * A ring of cards turns in front of the viewer; the next card always enters from the right and the edges flare like a wide lens.
 * Everything is drawn by one WebGL2 fragment shader over a texture array (one layer per card). The original paints stat cards;
 * here every card is a project screenshot, and the stage is transparent so the 3D city shows through. No dragging (it is a backdrop).
 *
 * Usage: <div class="reel" data-reel='["a.webp","b.webp"]' data-warp></div>   (data-warp turns it on; without WebGL2 the old CSS curved reel runs instead)
 * Optional: data-interval (seconds between spins, default 4.2), data-step (cards per spin, default 2), data-warp-amount (0 to 1, default 1).
 */
(function () {
  var CW = 256, CH = 164, CR = 10, FOCAL = 734.103;
  var G = { qA: 0.46401, XLA: 165.774, zA: 35.354, psiA: 1.44638, a1: 1.31454, a2: 1.10948, qB: 0.74999, XB: 204.525, ZB: 355.405,
    bB: 0.69311, bE: 0.04614, vC: 203.134, aC: 229.260, kB: 0.01087, bP: 0.99129, qPR: 1.01828, bPL: 1.00920, qPL: 1.07139 };

  /* pose of a card at ring offset q (0 front, +1 right, -1 left): centre x, depth behind the front plane, yaw */
  function poseAt(q0) {
    var q = q0;
    if (Math.abs(q) < 1) q -= G.kB * Math.pow(Math.sin(Math.PI * q), 2);
    var s = q < 0 ? -1 : 1, a = Math.abs(q), half = CW / 2;
    if (a <= G.qA) {
      var t = a / G.qA, xl = -half + (G.XLA + half) * Math.pow(t, G.a1), zl = G.zA * Math.pow(t, 4), psi = G.psiA * Math.pow(t, G.a2);
      return [s * (xl + half * Math.cos(psi)), zl + half * Math.sin(psi), s * psi];
    }
    var dXL = ((G.XLA + half) * G.a1) / G.qA, dZL = (G.zA * 4) / G.qA, dps = (G.psiA * G.a2) / G.qA, Hx, Hz;
    if (a <= G.qB) {
      var L = G.qB - G.qA, tt = (a - G.qA) / L, hx = G.XLA + CW * Math.cos(G.psiA), hz = G.zA + CW * Math.sin(G.psiA),
        dhx = dXL - CW * Math.sin(G.psiA) * dps, dhz = dZL + CW * Math.cos(G.psiA) * dps,
        h00 = 2 * Math.pow(tt, 3) - 3 * tt * tt + 1, h10 = Math.pow(tt, 3) - 2 * tt * tt + tt, h01 = -2 * Math.pow(tt, 3) + 3 * tt * tt, h11 = Math.pow(tt, 3) - tt * tt;
      Hx = h00 * hx + h10 * L * dhx * G.bB + h01 * G.XB + h11 * L * G.vC * G.bE;
      Hz = h00 * hz + h10 * L * dhz * G.bB + h01 * G.ZB;
    } else {
      var d = a - G.qB; Hx = G.XB + G.vC * d + G.aC * d * d; Hz = G.ZB;
    }
    var qP = s < 0 ? G.qPL : G.qPR, bP = s < 0 ? G.bPL : G.bP, LP = qP - G.qA, tp = Math.min(1, (a - G.qA) / LP);
    var psi2 = (2 * Math.pow(tp, 3) - 3 * tp * tp + 1) * G.psiA + (Math.pow(tp, 3) - 2 * tp * tp + tp) * LP * dps * bP + (-2 * Math.pow(tp, 3) + 3 * tp * tp) * Math.PI;
    return [s * (Hx - half * Math.cos(psi2)), Hz - half * Math.sin(psi2), s * psi2];
  }

  /* spin curve over one step, in reference frames (30 fps), with the slow creep at the tail */
  var TK = [0, 3, 6, 8, 10, 11, 12, 13, 14, 16, 18, 21, 25, 30, 36, 45, 55, 70, 88, 110];
  var TB = [0, 0.02175, 0.12069, 0.22549, 0.35493, 0.43254, 0.51436, 0.5952, 0.6751, 0.83199, 0.9709, 1.12669, 1.27958, 1.40975, 1.53561, 1.68385, 1.79183, 1.89191, 1.95233, 2];
  var DRIFT = 0.06511, STEP_FRAMES = 110;
  var SLOPES = (function () {
    var n = TK.length, h = [], dl = [], d = [], k;
    for (k = 0; k < n - 1; k++) { h.push(TK[k + 1] - TK[k]); dl.push((TB[k + 1] - TB[k]) / h[k]); }
    for (k = 0; k < n; k++) d.push(0);
    for (k = 1; k < n - 1; k++) {
      if (dl[k - 1] * dl[k] <= 0) d[k] = 0;
      else { var w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1]; d[k] = (w1 + w2) / (w1 / dl[k - 1] + w2 / dl[k]); }
    }
    var v = (dl[0] + dl[n - 2]) / 2; d[0] = v; d[n - 1] = v; return d;
  })();
  function spin(frames) {
    if (frames <= 0) return 0;
    if (frames >= STEP_FRAMES) return 1;
    var i = 0; while (i < TK.length - 2 && frames > TK[i + 1]) i++;
    var h = TK[i + 1] - TK[i], t = (frames - TK[i]) / h,
      h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t, h01 = -2 * t * t * t + 3 * t * t, h11 = t * t * t - t * t;
    return (h00 * TB[i] + h10 * h * SLOPES[i] + h01 * TB[i + 1] + h11 * h * SLOPES[i + 1]) / 2;
  }
  function spinN(frames, n) { // the curve fitted into n frames: the fast part keeps its timing, only the slow tail stretches
    if (n <= STEP_FRAMES + 0.5) return spin(frames * STEP_FRAMES / Math.max(1, n));
    var knee = 80; if (frames <= knee) return spin(frames);
    return spin(knee + (frames - knee) * (STEP_FRAMES - knee) / (n - knee));
  }

  var VERT = '#version 300 es\nin vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  var FRAG = '#version 300 es\n' +
    'precision highp float;\nprecision highp sampler2DArray;\n' +
    'uniform sampler2DArray uTex;\nuniform vec2 uRes;\nuniform float uUnit;\nuniform vec4 uPose[4];\nuniform float uWarp;\nout vec4 outColor;\n' +
    'const float F = ' + FOCAL.toFixed(2) + ';\nconst float CW = ' + CW.toFixed(1) + ';\nconst float CH = ' + CH.toFixed(1) + ';\nconst float CR = ' + CR.toFixed(1) + ';\n' +
    'float lensH(float a){\n  if (a <= 232.0) return a;\n' +
    '  float k[9] = float[9](232.0, 238.0, 245.0, 253.0, 262.0, 275.0, 295.0, 325.0, 360.0);\n' +
    '  float d[9] = float[9](1.1759, 1.0671, 1.0156, 1.0965, 0.6487, 0.2700, -0.1991, -0.4782, -0.0318);\n  float s = 232.0;\n' +
    '  for (int i = 0; i < 8; i++){\n    if (a <= k[i]) break;\n    float x = min(a, k[i+1]);\n    float t = (x - k[i]) / (k[i+1] - k[i]);\n' +
    '    s += (x - k[i]) * mix(1.0, mix(d[i], d[i+1], t * 0.5), uWarp);\n  }\n  if (a > 360.0) s += (a - 360.0) * mix(1.0, d[8], uWarp);\n  return s;\n}\n' +
    'float lensS(float a){\n  float t = clamp((a - 262.0) / 93.0, 0.0, 2.0);\n  return 1.0 + uWarp * (0.42 * pow(t, 1.5) + 0.045 * smoothstep(320.0, 360.0, a));\n}\n' +
    'float sdRound(vec2 p, vec2 b, float r){\n  vec2 q = abs(p) - b + r;\n  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;\n}\n' +
    'vec4 shadeCard(vec4 pose, vec2 ps, float fx, float fy, out float depth){\n  depth = 1e9;\n  if (pose.w < 0.0) return vec4(0.0);\n' +
    '  float k = ps.x / F;\n  float c = cos(pose.z), sn = sin(pose.z);\n  float den = sn * k - c;\n  if (abs(den) < 1e-5) return vec4(0.0);\n' +
    '  float A = pose.x, B = F + pose.y;\n  float s = (A - B * k) / den;\n  float t = B + s * sn;\n  if (t < 4.0) return vec4(0.0);\n' +
    '  float y = t * ps.y / F;\n  float dsdk = (B * c - A * sn) / (den * den);\n  float fs = min(abs(dsdk / F) * fx, 48.0);\n  float fyc = min(t / F * fy, 48.0);\n' +
    '  vec2 p = vec2(s, y);\n  float d = sdRound(p, vec2(CW, CH) * 0.5, CR);\n  vec2 q = abs(p) - vec2(CW, CH) * 0.5 + CR;\n' +
    '  vec2 n = q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n  if (q.x > 0.0 && q.y > 0.0) n = normalize(q);\n' +
    '  float fp = length(vec2(fs * n.x, fyc * n.y)) + 1e-4;\n  if (d > fp) return vec4(0.0);\n  float cov = clamp(0.5 - d / fp, 0.0, 1.0);\n  if (cov <= 0.0) return vec4(0.0);\n' +
    '  vec2 uv = vec2(s / CW + 0.5, 0.5 - y / CH);\n  vec4 tex = textureGrad(uTex, vec3(uv, pose.w), vec2(fs / CW, 0.0), vec2(0.0, fyc / CH));\n  depth = t;\n  return vec4(tex.rgb, 1.0) * cov;\n}\n' +
    'vec4 scene(vec2 ps, float fx, float fy){\n  vec4 col[4];\n  float dep[4];\n  for (int i = 0; i < 4; i++) col[i] = shadeCard(uPose[i], ps, fx, fy, dep[i]);\n' +
    '  for (int i = 0; i < 3; i++)\n    for (int j = 0; j < 3; j++)\n      if (j < 3 - i && dep[j] > dep[j+1]) {\n' +
    '        float td = dep[j]; dep[j] = dep[j+1]; dep[j+1] = td;\n        vec4 tc = col[j]; col[j] = col[j+1]; col[j+1] = tc;\n      }\n' +
    '  vec4 acc = vec4(0.0);\n  for (int i = 0; i < 4; i++) acc += (1.0 - acc.a) * col[i];\n  return acc;\n}\n' +
    /* premultiplied output: the stage is transparent, so the colour and the alpha both come out of the cards */
    'vec4 render(vec2 pu){\n  float au = min(abs(pu.x), 360.0);\n  float px = 1.0 / uUnit;\n' +
    '  if (au < 236.0 || uWarp <= 0.0) return scene(pu, px, px);\n' +
    '  float e = 0.064 * uWarp * smoothstep(275.0, 360.0, au);\n  float S0 = lensS(au);\n  float sg = pu.x < 0.0 ? -1.0 : 1.0;\n' +
    '  float blur = 1.0 + 30.0 * pow(smoothstep(240.0, 340.0, au), 1.5) * uWarp;\n  float fyb = 1.0 + 15.0 * smoothstep(280.0, 352.0, au) * uWarp;\n' +
    '  float gain = 1.0 + 0.17 * smoothstep(285.0, 350.0, au) * uWarp;\n  vec3 acc;\n  float al = 0.0;\n' +
    '  for (int ch = 0; ch < 3; ch++){\n    float off = uWarp * (ch == 0 ? -20.92 : (ch == 1 ? 0.0 : 11.91));\n' +
    '    float h = lensH(au) + off * smoothstep(289.8, 344.9, au);\n    float h0 = lensH(au - 0.5) + off * smoothstep(289.8, 344.9, au - 0.5);\n    float h1 = lensH(au + 0.5) + off * smoothstep(289.8, 344.9, au + 0.5);\n' +
    '    float fx = px * max(abs(h1 - h0), 0.02) * blur;\n    float S = S0 * (ch == 0 ? 1.0 + e : (ch == 1 ? 1.0 : 1.0 - e));\n' +
    '    vec4 c = scene(vec2(sg * h, pu.y / S), fx, px / S * fyb);\n    c.rgb = min(c.rgb * gain, vec3(c.a));\n    acc[ch] = c.rgb[ch];\n    al = max(al, c.a);\n  }\n' +
    '  return vec4(min(acc, vec3(al)), al);\n}\n' +
    'void main(){\n  vec2 pu = (gl_FragCoord.xy - 0.5 * uRes) / uUnit;\n  outColor = render(pu);\n}';

  function mod(a, n) { return ((a % n) + n) % n; }

  function build(el) {
    var images = JSON.parse(el.getAttribute('data-reel') || '[]');
    if (!images.length) return false;
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.bindAttribLocation(prog, 0, 'aPos'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return false; }

    el.setAttribute('data-warp-on', '');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    el.appendChild(canvas);

    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var loc = {}; ['uTex', 'uRes', 'uUnit', 'uPose', 'uWarp'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    var tex = gl.createTexture(), aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    var d = el.dataset, gap = Math.max(1, +(d.interval || 4.2)), stepN = Math.max(1, Math.round(+(d.step || 2))), warp = Math.max(0, Math.min(1, +(d.warpAmount || 1)));
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var list = []; while (list.length < 4) images.forEach(function (s) { list.push(s); });
    var N = list.length, imgs = new Array(N), cards = [], texW = 0, dirty = true, W = 0, H = 0, unit = 1, small = false;

    // the card textures: each screenshot cropped to fill the card (top-aligned, so the page header shows)
    function paintCard(i) {
      var cv = cards[i], ctx = cv.getContext('2d'), im = imgs[i];
      ctx.clearRect(0, 0, cv.width, cv.height);
      var g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, '#1a2c52'); g.addColorStop(1, '#0d1830'); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      if (im && im.naturalWidth) {
        var k = Math.max(cv.width / im.naturalWidth, cv.height / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
        ctx.drawImage(im, (cv.width - w) / 2, 0, w, h);
      }
    }
    function uploadAll() {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, texW, cards[0].height, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (var i = 0; i < N; i++) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, texW, cards[i].height, 1, gl.RGBA, gl.UNSIGNED_BYTE, cards[i]);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    }
    var upTimer = 0;
    function scheduleUpload() { clearTimeout(upTimer); upTimer = setTimeout(function () { for (var i = 0; i < N; i++) paintCard(i); uploadAll(); dirty = true; kick(); }, 120); }
    list.forEach(function (src, i) { var im = new Image(); im.decoding = 'async'; im.onload = function () { imgs[i] = im; scheduleUpload(); }; im.src = src; });

    function resize() {
      var r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, small ? 1 : 1.25);
      small = r.width < 700;
      W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
      if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H;
      // the 720-unit stage fills the width on wide screens; on a phone it is sized by height so the ring runs off both sides
      unit = small ? (H / 440) * 1.35 : Math.min(W / 720, H / 440);
      var want = Math.min(small ? 384 : 512, Math.max(256, Math.round(CW * unit * 1.25)));
      if (want !== texW) {
        texW = want; cards = [];
        for (var i = 0; i < N; i++) { var cv = document.createElement('canvas'); cv.width = texW; cv.height = Math.round(texW * CH / CW); cards.push(cv); paintCard(i); }
        uploadAll();
      }
      dirty = true;
    }

    var P = DRIFT, from = P, to = P, t0 = 0, n = gap * 30, nextAuto = 0, last = 0, raf = 0, visible = true, hiddenAt = 0, spinning = false;
    var poseArr = new Float32Array(16);
    function poseSet(p) {
      var ids = [], c; for (c = 0; c < N; c++) ids.push({ c: c, q: mod(c - p + N / 2, N) - N / 2 });
      ids.sort(function (a, b) { return Math.abs(a.q) - Math.abs(b.q); });
      return ids.slice(0, 4).map(function (o) { return Math.abs(o.q) > 2.05 ? { pose: [0, 0, 0], layer: -1 } : { pose: poseAt(o.q), layer: o.c }; });
    }
    function draw() {
      if (!texW) return;
      var set = poseSet(P);
      set.forEach(function (s, i) { poseArr[i * 4] = s.pose[0]; poseArr[i * 4 + 1] = s.pose[1]; poseArr[i * 4 + 2] = s.pose[2]; poseArr[i * 4 + 3] = s.layer; });
      gl.viewport(0, 0, W, H); gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex); gl.uniform1i(loc.uTex, 0);
      gl.uniform2f(loc.uRes, W, H); gl.uniform1f(loc.uUnit, unit); gl.uniform4fv(loc.uPose, poseArr); gl.uniform1f(loc.uWarp, warp);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(ms) {
      raf = 0; if (!visible) return;
      var now = ms / 1000;
      if (!reduce) {
        if (!t0) { t0 = now; nextAuto = now + gap; to = P + stepN; from = P; spinning = true; }
        if (now >= nextAuto) { nextAuto += gap; from = P; to = Math.round(P - DRIFT) + stepN + DRIFT; t0 = now; spinning = true; }
        if (spinning) { var f = (now - t0) * 30; P = from + (to - from) * spinN(f, n); if (f >= n) { P = to; spinning = false; } }
      }
      if (spinning || dirty) { if (now - last > (small ? 1 / 30 : 1 / 45) || dirty) { draw(); last = now; dirty = false; } }
      if (!reduce || dirty) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(loop); }

    resize();
    new ResizeObserver(function () { resize(); kick(); }).observe(el);
    var inView = true;
    function setVisible(v) {
      if (v === visible) return; var now = performance.now() / 1000;
      if (!v) hiddenAt = now; else { var dt = now - hiddenAt; t0 += dt; nextAuto += dt; }
      visible = v; if (v) kick();
    }
    new IntersectionObserver(function (es) { inView = es.some(function (e) { return e.isIntersecting; }); setVisible(inView && document.visibilityState === 'visible'); }).observe(el);
    document.addEventListener('visibilitychange', function () { setVisible(inView && document.visibilityState === 'visible'); });
    kick();
    return true;
  }

  document.querySelectorAll('[data-reel][data-warp]').forEach(build);
})();
