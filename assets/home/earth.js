/* earth.js: a real-imagery Earth seen as a limb from low orbit, in three.js (r128, already on the page). Reusable: the entry gate uses it
 * now; the logo reveal can mount the same thing later.
 *
 *   var e = OrbitEarth.mount(container, { base: '/assets/home/earth/', v: '20261122r', autoStart: true, onReady: fn });
 *   e.setView({ arc: .3, px: 0, py: 0, warp: 0, spin: 1 });   // arc: how high the limb rises (fraction of the screen height, from the bottom)
 *   e.render(dt);          // draw one frame (when autoStart is false; the gate drives it so it can snapshot in the same task)
 *   e.klScreen();          // {x, y, visible} of Kuala Lumpur in CSS px inside the container
 *   e.canvas;  e.ready (Promise);  e.dispose();
 *
 * Layers: day map (NASA Blue Marble, public domain), a drifting cloud sphere, city lights on the night side, a specular ocean glint, a
 * sun terminator, a Fresnel rim on the globe and an analytic atmosphere glow around the limb. Transparent canvas (stars go behind it).
 * Own loop (autoStart) pauses when the tab is hidden or the canvas is off screen. DPR is capped at 1.5. Returns null without THREE/WebGL.
 * Earth: NASA 3D Resources (colour + normal maps, reprojected to equirectangular); clouds, ocean mask and city lights: NASA Visible Earth / Blue Marble.
 */
(function () {
  'use strict';
  var KL = { lat: 3.139, lon: 101.687 };

  var VERT = 'varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vT; varying vec3 vB;\n' +
    'void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);\n' +
    '  float a = uv.x * 6.2831853, th = (1.0 - uv.y) * 3.1415927; vec3 T = vec3(sin(a), 0.0, cos(a)), Bn = vec3(cos(a) * cos(th), sin(th), -sin(a) * cos(th));\n' +
    '  vT = normalize(mat3(modelMatrix) * T); vB = normalize(mat3(modelMatrix) * Bn); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var COMMON = 'uniform vec3 sun; uniform vec3 sphereC;\n' +
    'vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }\n';
  var EARTH_F = 'precision highp float; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vT; varying vec3 vB;\n' + COMMON +
    'uniform sampler2D dayMap, specMap, lightMap, normMap; uniform float uTime, uRelief;\n' +
    'void main(){\n' +
    '  vec3 N0 = normalize(vN), V = normalize(cameraPosition - vW);\n' +
    '  vec3 nm = texture2D(normMap, vUv).xyz * 2.0 - 1.0; vec3 N = normalize(N0 + (nm.x * vT + nm.y * vB) * uRelief * (1.0 - 0.8 * texture2D(specMap, vUv).r));\n' +
    '  float ndl = dot(N, sun), day = smoothstep(-0.10, 0.22, ndl);\n' +
    '  vec3 alb = lin(texture2D(dayMap, vUv).rgb);\n' +
    '  vec3 col = alb * (0.014 + 1.45 * max(ndl, 0.0)) * day;\n' +
    '  float oc = texture2D(specMap, vUv).r;\n' +
    '  vec3 R = reflect(-sun, N); float sp = pow(max(dot(R, V), 0.0), 48.0) * oc * 0.9 + pow(max(dot(R, V), 0.0), 9.0) * oc * 0.12;\n' +
    '  col += vec3(0.85, 0.93, 1.0) * sp * day;\n' +
    '  float twi = exp(-pow((ndl + 0.02) / 0.09, 2.0));\n' +
    '  col += vec3(1.0, 0.45, 0.16) * twi * 0.10 * (0.35 + alb.b);\n' +                       // sunset band along the terminator
    '  vec3 lights = lin(texture2D(lightMap, vUv).rrr) * vec3(1.6, 1.05, 0.55);\n' +
    '  col += lights * (1.0 - day) * 1.6;\n' +
    '  col += vec3(0.004, 0.009, 0.024) * (1.0 - day);\n' +
    '  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);\n' +
    '  col += vec3(0.20, 0.50, 1.0) * fr * (0.15 + 1.4 * smoothstep(-0.25, 0.55, ndl)) * 0.95;\n' +
    '  col = col / (1.0 + col * 0.22);\n' +
    '  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);\n' +
    '}';
  var CLOUD_F = 'precision highp float; varying vec3 vN; varying vec3 vW; varying vec2 vUv;\n' + COMMON +
    'uniform sampler2D cloudMap;\n' +
    'void main(){\n' +
    '  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);\n' +
    '  float ndl = dot(N, sun), day = smoothstep(-0.12, 0.3, ndl);\n' +
    '  float a = texture2D(cloudMap, vUv).r; a = smoothstep(0.08, 0.95, a);\n' +
    '  float edge = 1.0 - max(dot(N, V), 0.0);\n' +
    '  float lit = 0.05 + 1.15 * max(ndl, 0.0);\n' +
    '  vec3 col = vec3(0.92, 0.96, 1.0) * lit * day + vec3(0.02, 0.035, 0.07) * (1.0 - day);\n' +
    '  col += vec3(1.0, 0.55, 0.3) * exp(-pow((ndl + 0.02) / 0.08, 2.0)) * 0.12;\n' +
    '  gl_FragColor = vec4(col, clamp(a * (0.82 + edge * 0.3), 0.0, 0.95));\n' +
    '}';
  var HALO_F = 'precision highp float; varying vec3 vN; varying vec3 vW; varying vec2 vUv;\n' + COMMON +
    'uniform float uR;\n' +
    'void main(){\n' +
    '  vec3 O = cameraPosition, D = normalize(vW - O);\n' +
    '  float t = dot(sphereC - O, D); vec3 P = O + D * t - sphereC; float b = length(P);\n' +
    '  float h = max(b - 1.0, 0.0);\n' +
    '  float lit = smoothstep(-0.35, 0.55, dot(normalize(P), sun));\n' +
    '  float g = exp(-h / 0.014) * 0.95 + exp(-h / 0.05) * 0.5 + exp(-h / 0.16) * 0.16;\n' +
    '  vec3 c = mix(vec3(0.16, 0.42, 1.0), vec3(0.62, 0.86, 1.0), exp(-h / 0.02));\n' +
    '  c = mix(c, vec3(1.0, 0.62, 0.35), exp(-pow(dot(normalize(P), sun) / 0.12, 2.0)) * 0.35 * exp(-h / 0.03));\n' +
    '  float a = g * (0.08 + 0.92 * lit) * smoothstep(0.0, 0.004, b - 0.999);\n' +
    '  gl_FragColor = vec4(c * a, a);\n' +
    '}';

  function solveCenter(arc, zc, fov) {
    /* the sphere (radius 1) sits at (0, yc, -zc) below the camera; find yc so its silhouette top lands at `arc` of the screen height */
    var lo = -6, hi = 0, i, tf = Math.tan(fov / 2), want = 2 * arc - 1;
    for (i = 0; i < 40; i++) {
      var yc = (lo + hi) / 2, dist = Math.sqrt(yc * yc + zc * zc), top = Math.atan2(yc, zc) + Math.asin(Math.min(1, 1 / dist));
      var ndc = Math.tan(top) / tf;
      if (ndc > want) hi = yc; else lo = yc;
    }
    return (lo + hi) / 2;
  }

  function mount(container, o) {
    var T = window.THREE; o = o || {};
    if (!T || !container) return null;
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
    if (!renderer || !renderer.getContext()) return null;
    var cv = renderer.domElement; cv.className = (o.className || 'orbit-earth'); cv.setAttribute('aria-hidden', 'true');
    renderer.setClearColor(0x000000, 0); container.appendChild(cv);
    var scene = new T.Scene(), FOV = 40, ZC = 1.45;
    var cam = new T.PerspectiveCamera(FOV, 1, 0.05, 20);
    var base = o.base || '/assets/home/earth/', v = o.v ? '?v=' + o.v : '';
    var loader = new T.TextureLoader(), maxA = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    var pending = 5, failed = false, resolveReady, ready = new Promise(function (r) { resolveReady = r; });
    function tex(name) {
      var t = loader.load(base + name + v, function () { if (--pending === 0) { done(); } }, undefined, function () { failed = true; if (--pending === 0) done(); });
      t.anisotropy = maxA; t.wrapS = T.RepeatWrapping; return t;
    }
    var big = (window.innerWidth >= 900 || o.hd) && renderer.capabilities.maxTextureSize >= 4096, q = big ? '4k' : '2k';
    var day = tex('earth-day-' + q + '-2.webp'), norm = tex('earth-normal-' + q + '-1.webp'), spec = tex('earth-spec-1.webp'), lights = tex('earth-lights-1.webp'), clouds = tex('earth-clouds-1.webp');
    var isReady = false;
    function done() { isReady = true; resolveReady(!failed); if (o.onReady) o.onReady(!failed); if (!failed) kick(); }

    var sun = new T.Vector3(0.72, 0.5, 0.22).normalize(), C = new T.Vector3(0, -1.2, -ZC);
    var shared = { sun: { value: sun }, sphereC: { value: C } };
    function mat(frag, extra, opts) {
      var u = { sun: shared.sun, sphereC: shared.sphereC }, k; for (k in extra) u[k] = extra[k];
      var m = { uniforms: u, vertexShader: VERT, fragmentShader: frag }; for (k in opts) m[k] = opts[k]; return new T.ShaderMaterial(m);
    }
    var group = new T.Group(), earthMesh = new T.Mesh(new T.SphereGeometry(1, 128, 96), mat(EARTH_F, { dayMap: { value: day }, specMap: { value: spec }, lightMap: { value: lights }, normMap: { value: norm }, uTime: { value: 0 }, uRelief: { value: o.relief == null ? .9 : o.relief } }, {}));
    var cloudMesh = new T.Mesh(new T.SphereGeometry(1.012, 128, 96), mat(CLOUD_F, { cloudMap: { value: clouds } }, { transparent: true, depthWrite: false }));
    earthMesh.add(cloudMesh); group.add(earthMesh); scene.add(group);
    var halo = new T.Mesh(new T.SphereGeometry(1.3, 64, 48), mat(HALO_F, { uR: { value: 1 } }, { transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending }));
    scene.add(halo);

    var view = { arc: o.arc == null ? .3 : o.arc, px: 0, py: 0, warp: 0, spin: o.spin == null ? 1 : o.spin };
    var klLocal = (function () { var u = (KL.lon + 180) / 360, la = KL.lat * Math.PI / 180; return new T.Vector3(-Math.cos(2 * Math.PI * u) * Math.cos(la), Math.sin(la), Math.sin(2 * Math.PI * u) * Math.cos(la)).normalize(); })();
    var W = 1, H = 1, time = 0, lastT = 0, raf = 0, disposed = false, visible = true, klv = new T.Vector3(), rayTmp = new T.Vector3();
    function layout() {
      var arc = view.arc - view.warp * .12, yc = solveCenter(arc, ZC, FOV * Math.PI / 180);
      C.set(0, yc, -ZC); group.position.copy(C); halo.position.copy(C);
      /* orient so Kuala Lumpur sits on the sunlit limb, right of centre: shoot a ray at that spot of the screen and hit the sphere */
      var ax = W < 640 ? .32 : .2, ay = (2 * arc - 1) - .17;
      cam.updateMatrixWorld(); rayTmp.set(ax, ay, .5).unproject(cam).sub(cam.position).normalize();
      var oc = new T.Vector3().copy(cam.position).sub(C), b = oc.dot(rayTmp), cc = oc.dot(oc) - 1, disc = b * b - cc;
      var tt = disc > 0 ? -b - Math.sqrt(disc) : -b, hit = new T.Vector3().copy(cam.position).addScaledVector(rayTmp, tt).sub(C).normalize();
      group.quaternion.setFromUnitVectors(klLocal, hit);
    }
    function size() {
      var w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      W = w; H = h; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix(); layout();
    }
    function render(dt) {
      if (disposed || !isReady) return;
      time += dt || 0;
      cam.rotation.y = -view.px * .012; cam.rotation.x = view.py * .008;
      layout();
      earthMesh.rotation.y = time * .0035 * view.spin; cloudMesh.rotation.y = time * .0048 * view.spin;
      earthMesh.material.uniforms.uTime.value = time;
      renderer.render(scene, cam);
    }
    function loop(now) {
      raf = 0; if (disposed) return;
      var dt = Math.min(.05, (now - lastT) / 1000); lastT = now; render(dt);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }
    function kick() { if (o.autoStart === false || raf || disposed || !visible || document.hidden) return; lastT = performance.now(); raf = requestAnimationFrame(loop); }
    var io = window.IntersectionObserver ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }) : null; if (io) io.observe(container);
    var ro = window.ResizeObserver ? new ResizeObserver(function () { size(); if (isReady && o.autoStart === false) render(0); }) : null; if (ro) ro.observe(container);
    function vis() { if (!document.hidden) kick(); } document.addEventListener('visibilitychange', vis);
    size();
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });

    return {
      canvas: cv, ready: ready, render: render,
      setView: function (p) { var k; for (k in p) view[k] = p[k]; },
      klScreen: function () {
        klv.copy(klLocal).applyMatrix4(earthMesh.matrixWorld).project(cam);
        return { x: (klv.x * .5 + .5) * W, y: (1 - (klv.y * .5 + .5)) * H, visible: klv.z < 1 };
      },
      dispose: function () {
        if (disposed) return; disposed = true; if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect(); if (ro) ro.disconnect(); document.removeEventListener('visibilitychange', vis);
        [earthMesh, cloudMesh, halo].forEach(function (m) { m.geometry.dispose(); m.material.dispose(); });
        [day, norm, spec, lights, clouds].forEach(function (t) { t.dispose(); });
        renderer.dispose(); try { var x = renderer.getContext().getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* gone */ }
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    };
  }
  window.OrbitEarth = { mount: mount };
})();
